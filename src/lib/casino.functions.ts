import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lineMultiplier, gridFromStops, STRIP } from "./casino/slots";
import { isValidBet, roulettePayout, type RouletteBet } from "./casino/roulette";
import { BJ_RETURN, dealerPlay, handValue, isBlackjack, outcome, SHOE, type Card, type BjOutcome } from "./casino/blackjack";
import { crashPointFrom, multiplierAt, CRASH_MAX } from "./casino/crash";
import { randomInt, randomUnit, shuffle } from "./casino/rng";

// Every outcome is drawn on the server; the browser only animates what it is told.
const stakeSchema = z.number().finite().min(1).max(1_000_000);
const money = (n: number) => Math.round(n * 100) / 100;

function moneyError(msg: string) {
  if (msg.includes("INSUFFICIENT_FUNDS")) return "Nuk keni fonde të mjaftueshme";
  if (msg.includes("ACCOUNT_BLOCKED")) return "Llogaria juaj nuk është aktive";
  if (msg.includes("ROUND_OPEN")) return "Keni një lojë të hapur";
  console.error("casino rpc failed", msg);
  return "Loja nuk u krye, provoni përsëri";
}
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

// ---------- Slots ----------
export const spinSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ stake: stakeSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const stake = money(data.stake);
    const stops = [randomInt(STRIP.length), randomInt(STRIP.length), randomInt(STRIP.length)];
    const grid = gridFromStops(stops);
    const mult = lineMultiplier(grid.map((col) => col[1]!));
    const payout = money(stake * mult);
    const db = await admin();
    const { error } = await db.rpc("casino_instant", { _user_id: context.userId, _game: "slots", _stake: stake, _payout: payout, _result: { grid, mult } as never });
    if (error) return { ok: false as const, error: moneyError(error.message) };
    return { ok: true as const, stops, grid, mult, payout };
  });

// ---------- Roulette ----------
const betSchema = z.object({
  type: z.enum(["straight", "red", "black", "even", "odd", "low", "high", "dozen", "column"]),
  value: z.number().int().optional(),
  amount: z.number().finite().min(1).max(1_000_000),
});
export const spinRoulette = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ bets: z.array(betSchema).min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const bets: RouletteBet[] = data.bets.map((b) => ({ ...b, amount: money(b.amount) }));
    if (!bets.every(isValidBet)) return { ok: false as const, error: "Bast i pavlefshëm" };
    const stake = money(bets.reduce((s, b) => s + b.amount, 0));
    if (stake > 1_000_000) return { ok: false as const, error: "Shuma është shumë e madhe" };
    const number = randomInt(37);
    const payout = roulettePayout(bets, number);
    const db = await admin();
    const { error } = await db.rpc("casino_instant", { _user_id: context.userId, _game: "roulette", _stake: stake, _payout: payout, _result: { number, bets } as never });
    if (error) return { ok: false as const, error: moneyError(error.message) };
    return { ok: true as const, number, payout, stake };
  });

// ---------- Shared open-round helpers ----------
type OpenRound<S> = { id: string; stake: number; state: S };
async function loadOpen<S>(userId: string, game: "blackjack" | "crash"): Promise<OpenRound<S> | null> {
  const db = await admin();
  const { data: r } = await db.from("casino_rounds").select("id, stake").eq("user_id", userId).eq("game", game).eq("status", "open").maybeSingle();
  if (!r) return null;
  const { data: s } = await db.from("casino_secrets").select("state").eq("round_id", r.id).maybeSingle();
  if (!s) return null;
  return { id: r.id, stake: Number(r.stake), state: s.state as S };
}
async function settle(roundId: string, payout: number, result: unknown) {
  const db = await admin();
  const { data, error } = await db.rpc("casino_settle", { _round_id: roundId, _payout: money(payout), _result: result as never });
  if (error) throw new Error(error.message);
  return data === true;
}

// ---------- Blackjack ----------
type BjState = { deck: Card[]; player: Card[]; dealer: Card[]; doubled: boolean };
export type BjView = { open: boolean; player: Card[]; dealer: Card[]; stake: number; doubled: boolean; outcome?: BjOutcome; payout?: number; canDouble: boolean };

const bjPublic = (s: BjState, stake: number, open: boolean, out?: BjOutcome, payout?: number): BjView => ({
  open, player: s.player, dealer: open ? [s.dealer[0]!] : s.dealer, stake, doubled: s.doubled,
  outcome: out, payout, canDouble: open && s.player.length === 2,
});

async function bjFinish(id: string, s: BjState, stake: number): Promise<BjView> {
  let state = s;
  if (handValue(s.player).total <= 21) {
    const d = dealerPlay(s.dealer, s.deck);
    state = { ...s, dealer: d.dealer, deck: d.deck };
  }
  const out = outcome(state.player, state.dealer);
  const payout = money(stake * BJ_RETURN[out]);
  await settle(id, payout, { player: state.player, dealer: state.dealer, outcome: out, doubled: state.doubled });
  return bjPublic(state, stake, false, out, payout);
}

export const bjCurrent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await loadOpen<BjState>(context.userId, "blackjack");
    return r ? bjPublic(r.state, r.stake, true) : null;
  });

export const bjDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ stake: stakeSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const stake = money(data.stake);
    const deck = shuffle(SHOE);
    const s: BjState = { player: [deck[0]!, deck[2]!], dealer: [deck[1]!, deck[3]!], deck: deck.slice(4), doubled: false };
    const db = await admin();
    if (isBlackjack(s.player) || isBlackjack(s.dealer)) {
      const out = outcome(s.player, s.dealer);
      const payout = money(stake * BJ_RETURN[out]);
      const { error } = await db.rpc("casino_instant", { _user_id: context.userId, _game: "blackjack", _stake: stake, _payout: payout, _result: { player: s.player, dealer: s.dealer, outcome: out } as never });
      if (error) return { ok: false as const, error: moneyError(error.message) };
      return { ok: true as const, view: bjPublic(s, stake, false, out, payout) };
    }
    const { error } = await db.rpc("casino_open", { _user_id: context.userId, _game: "blackjack", _stake: stake, _state: s as never, _result: { player: s.player, dealer: [s.dealer[0]] } as never });
    if (error) return { ok: false as const, error: moneyError(error.message) };
    return { ok: true as const, view: bjPublic(s, stake, true) };
  });

export const bjAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ action: z.enum(["hit", "stand", "double"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await loadOpen<BjState>(context.userId, "blackjack");
    if (!r) return { ok: false as const, error: "Nuk ka lojë të hapur" };
    const db = await admin();
    let s = r.state;
    let stake = r.stake;
    try {
      if (data.action === "double") {
        if (s.player.length !== 2) return { ok: false as const, error: "Dyfishimi lejohet vetëm me dy letrat e para" };
        s = { ...s, player: [...s.player, s.deck[0]!], deck: s.deck.slice(1), doubled: true };
        const { error } = await db.rpc("casino_raise", { _round_id: r.id, _extra: stake, _state: s as never, _result: { player: s.player, dealer: [s.dealer[0]] } as never });
        if (error) return { ok: false as const, error: moneyError(error.message) };
        stake = money(stake * 2);
        return { ok: true as const, view: await bjFinish(r.id, s, stake) };
      }
      if (data.action === "hit") {
        s = { ...s, player: [...s.player, s.deck[0]!], deck: s.deck.slice(1) };
        if (handValue(s.player).total >= 21) return { ok: true as const, view: await bjFinish(r.id, s, stake) };
        const { error } = await db.rpc("casino_update", { _round_id: r.id, _state: s as never, _result: { player: s.player, dealer: [s.dealer[0]] } as never });
        if (error) return { ok: false as const, error: moneyError(error.message) };
        return { ok: true as const, view: bjPublic(s, stake, true) };
      }
      return { ok: true as const, view: await bjFinish(r.id, s, stake) };
    } catch (e) {
      return { ok: false as const, error: moneyError(e instanceof Error ? e.message : "") };
    }
  });

// ---------- Crash ----------
type CrashState = { crashAt: number; startedAt: number; auto: number | null };
export type CrashView =
  | { status: "running"; startedAt: number; serverNow: number; stake: number; auto: number | null }
  | { status: "won"; cashedAt: number; payout: number; crashAt: number; stake: number }
  | { status: "lost"; crashAt: number; stake: number };

const COUNTDOWN_MS = 1500;

async function crashResolve(r: OpenRound<CrashState>, cashout: boolean): Promise<CrashView> {
  const { crashAt, startedAt, auto } = r.state;
  const now = Date.now();
  const m = multiplierAt(now - startedAt);
  if (auto && auto < crashAt && now >= startedAt && m >= auto) {
    const payout = money(r.stake * auto);
    await settle(r.id, payout, { crashAt, cashedAt: auto });
    return { status: "won", cashedAt: auto, payout, crashAt, stake: r.stake };
  }
  if (now >= startedAt && m >= crashAt) {
    await settle(r.id, 0, { crashAt });
    return { status: "lost", crashAt, stake: r.stake };
  }
  if (cashout && now >= startedAt) {
    const payout = money(r.stake * m);
    await settle(r.id, payout, { crashAt, cashedAt: m });
    return { status: "won", cashedAt: m, payout, crashAt, stake: r.stake };
  }
  return { status: "running", startedAt, serverNow: now, stake: r.stake, auto };
}

export const crashCurrent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await loadOpen<CrashState>(context.userId, "crash");
    return r ? await crashResolve(r, false) : null;
  });

export const crashStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ stake: stakeSchema, auto: z.number().min(1.01).max(CRASH_MAX).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const stake = money(data.stake);
    const state: CrashState = { crashAt: crashPointFrom(randomUnit()), startedAt: Date.now() + COUNTDOWN_MS, auto: data.auto ? money(data.auto) : null };
    const db = await admin();
    const { error } = await db.rpc("casino_open", { _user_id: context.userId, _game: "crash", _stake: stake, _state: state as never, _result: { startedAt: state.startedAt, auto: state.auto } as never });
    if (error) return { ok: false as const, error: moneyError(error.message) };
    return { ok: true as const, view: { status: "running", startedAt: state.startedAt, serverNow: Date.now(), stake, auto: state.auto } as CrashView };
  });

export const crashCashout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const r = await loadOpen<CrashState>(context.userId, "crash");
    if (!r) return { ok: false as const, error: "Nuk ka lojë të hapur" };
    return { ok: true as const, view: await crashResolve(r, true) };
  });

// ---------- History ----------
export const myCasinoRounds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ game: z.enum(["slots", "roulette", "blackjack", "crash"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase
      .from("casino_rounds")
      .select("id, stake, payout, status, created_at")
      .eq("user_id", context.userId)
      .eq("game", data.game)
      .eq("status", "settled")
      .order("created_at", { ascending: false })
      .limit(12);
    return (rows ?? []).map((r) => ({ id: r.id, stake: Number(r.stake), payout: Number(r.payout), at: r.created_at }));
  });
