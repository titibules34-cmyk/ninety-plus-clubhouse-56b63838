create type public.casino_game as enum ('slots','roulette','blackjack','crash');

-- One row per casino round. "result" is what the player may see; hidden state lives in casino_secrets.
create table public.casino_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game public.casino_game not null,
  stake numeric(14,2) not null check (stake > 0),
  payout numeric(14,2) not null default 0,
  status text not null default 'open' check (status in ('open','settled')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index casino_rounds_user_idx on public.casino_rounds(user_id, created_at desc);
create unique index casino_rounds_one_open_idx on public.casino_rounds(user_id, game) where status = 'open';
grant select on public.casino_rounds to authenticated;
grant all on public.casino_rounds to service_role;
alter table public.casino_rounds enable row level security;
create policy "read own, admin or downline casino rounds" on public.casino_rounds for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.is_ancestor(auth.uid(), user_id));

-- Hidden round state (card shoe, crash point). Server only.
create table public.casino_secrets (
  round_id uuid primary key references public.casino_rounds(id) on delete cascade,
  state jsonb not null
);
grant all on public.casino_secrets to service_role;
alter table public.casino_secrets enable row level security;

-- Instant game (slots, roulette): stake and payout move in one step.
create or replace function public.casino_instant(_user_id uuid, _game public.casino_game, _stake numeric, _payout numeric, _result jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  p public.profiles%rowtype;
  new_id uuid;
begin
  select * into p from public.profiles where id = _user_id for update;
  if not found then raise exception 'NO_ACCOUNT'; end if;
  if p.status <> 'aktiv' then raise exception 'ACCOUNT_BLOCKED'; end if;
  if _stake <= 0 or _payout < 0 then raise exception 'BAD_STAKE'; end if;
  if p.balance + p.overdraft - p.pending < _stake then raise exception 'INSUFFICIENT_FUNDS'; end if;
  insert into public.casino_rounds (user_id, game, stake, payout, status, result, settled_at)
    values (_user_id, _game, _stake, _payout, 'settled', _result, now())
    returning id into new_id;
  update public.profiles set balance = balance - _stake + _payout where id = _user_id;
  return new_id;
end $$;

-- Multi-step game (blackjack, crash): holds the stake in "pending" until settled.
create or replace function public.casino_open(_user_id uuid, _game public.casino_game, _stake numeric, _state jsonb, _result jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  p public.profiles%rowtype;
  new_id uuid;
begin
  select * into p from public.profiles where id = _user_id for update;
  if not found then raise exception 'NO_ACCOUNT'; end if;
  if p.status <> 'aktiv' then raise exception 'ACCOUNT_BLOCKED'; end if;
  if _stake <= 0 then raise exception 'BAD_STAKE'; end if;
  if p.balance + p.overdraft - p.pending < _stake then raise exception 'INSUFFICIENT_FUNDS'; end if;
  if exists (select 1 from public.casino_rounds where user_id = _user_id and game = _game and status = 'open') then
    raise exception 'ROUND_OPEN';
  end if;
  insert into public.casino_rounds (user_id, game, stake, result) values (_user_id, _game, _stake, _result) returning id into new_id;
  insert into public.casino_secrets (round_id, state) values (new_id, _state);
  update public.profiles set pending = pending + _stake where id = _user_id;
  return new_id;
end $$;

-- Adds to the stake of an open round (blackjack double down).
create or replace function public.casino_raise(_round_id uuid, _extra numeric, _state jsonb, _result jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.casino_rounds%rowtype;
  p public.profiles%rowtype;
begin
  select * into r from public.casino_rounds where id = _round_id and status = 'open' for update;
  if not found then raise exception 'ROUND_CLOSED'; end if;
  select * into p from public.profiles where id = r.user_id for update;
  if _extra <= 0 then raise exception 'BAD_STAKE'; end if;
  if p.balance + p.overdraft - p.pending < _extra then raise exception 'INSUFFICIENT_FUNDS'; end if;
  update public.casino_rounds set stake = stake + _extra, result = _result where id = _round_id;
  update public.casino_secrets set state = _state where round_id = _round_id;
  update public.profiles set pending = pending + _extra where id = r.user_id;
end $$;

-- Saves new state of an open round without moving money.
create or replace function public.casino_update(_round_id uuid, _state jsonb, _result jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.casino_rounds set result = _result where id = _round_id and status = 'open';
  if not found then raise exception 'ROUND_CLOSED'; end if;
  update public.casino_secrets set state = _state where round_id = _round_id;
end $$;

-- Closes an open round: releases the held stake and pays the payout. Returns false if it was already closed.
create or replace function public.casino_settle(_round_id uuid, _payout numeric, _result jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  r public.casino_rounds%rowtype;
begin
  select * into r from public.casino_rounds where id = _round_id and status = 'open' for update;
  if not found then return false; end if;
  if _payout < 0 then raise exception 'BAD_PAYOUT'; end if;
  update public.casino_rounds set status = 'settled', payout = _payout, result = _result, settled_at = now() where id = _round_id;
  update public.profiles set pending = pending - r.stake, balance = balance - r.stake + _payout where id = r.user_id;
  return true;
end $$;

revoke all on function public.casino_instant(uuid, public.casino_game, numeric, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.casino_open(uuid, public.casino_game, numeric, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.casino_raise(uuid, numeric, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.casino_update(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.casino_settle(uuid, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.casino_instant(uuid, public.casino_game, numeric, numeric, jsonb) to service_role;
grant execute on function public.casino_open(uuid, public.casino_game, numeric, jsonb, jsonb) to service_role;
grant execute on function public.casino_raise(uuid, numeric, jsonb, jsonb) to service_role;
grant execute on function public.casino_update(uuid, jsonb, jsonb) to service_role;
grant execute on function public.casino_settle(uuid, numeric, jsonb) to service_role;