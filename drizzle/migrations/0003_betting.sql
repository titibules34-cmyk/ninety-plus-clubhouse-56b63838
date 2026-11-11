create type public.bet_status as enum ('pending','won','lost','void');

-- Cached provider responses (odds per league, sports list). Server-only.
create table public.odds_cache (
  cache_key text primary key,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);
grant all on public.odds_cache to service_role;
alter table public.odds_cache enable row level security;

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stake numeric(14,2) not null check (stake > 0),
  total_odds numeric(14,2) not null,
  potential_win numeric(14,2) not null,
  payout numeric(14,2) not null default 0,
  status public.bet_status not null default 'pending',
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index bets_user_idx on public.bets(user_id, created_at desc);
grant select on public.bets to authenticated;
grant all on public.bets to service_role;
alter table public.bets enable row level security;

create table public.bet_selections (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets(id) on delete cascade,
  event_id text not null,
  sport_key text not null,
  sport_title text not null default '',
  home_team text not null,
  away_team text not null,
  commence_time timestamptz not null,
  market text not null,
  pick text not null,
  point numeric(6,2),
  odds numeric(10,2) not null,
  result public.bet_status not null default 'pending',
  home_score int,
  away_score int
);
create index bet_selections_bet_idx on public.bet_selections(bet_id);
create index bet_selections_pending_idx on public.bet_selections(sport_key) where result = 'pending';
grant select on public.bet_selections to authenticated;
grant all on public.bet_selections to service_role;
alter table public.bet_selections enable row level security;

create policy "read own, admin or downline bets" on public.bets for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.is_ancestor(auth.uid(), user_id));
create policy "read selections of visible bets" on public.bet_selections for select to authenticated
  using (exists (select 1 from public.bets b where b.id = bet_id
    and (b.user_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.is_ancestor(auth.uid(), b.user_id))));

-- Places a ticket atomically: checks account status and available funds, holds the stake in "pending".
create or replace function public.place_bet(_user_id uuid, _stake numeric, _total_odds numeric, _selections jsonb)
returns table (bet_id uuid, bet_code text)
language plpgsql security definer set search_path = public
as $$
declare
  p public.profiles%rowtype;
  new_id uuid;
  new_code text;
begin
  select * into p from public.profiles where id = _user_id for update;
  if not found then raise exception 'NO_ACCOUNT'; end if;
  if p.status <> 'aktiv' then raise exception 'ACCOUNT_BLOCKED'; end if;
  if _stake <= 0 then raise exception 'BAD_STAKE'; end if;
  if p.balance + p.overdraft - p.pending < _stake then raise exception 'INSUFFICIENT_FUNDS'; end if;
  loop
    new_code := lpad((floor(random() * 10000000000))::bigint::text, 10, '0');
    exit when not exists (select 1 from public.bets where code = new_code);
  end loop;
  insert into public.bets (code, user_id, stake, total_odds, potential_win)
    values (new_code, _user_id, _stake, _total_odds, round(_stake * _total_odds, 2))
    returning id into new_id;
  insert into public.bet_selections (bet_id, event_id, sport_key, sport_title, home_team, away_team, commence_time, market, pick, point, odds)
  select new_id, s->>'event_id', s->>'sport_key', coalesce(s->>'sport_title',''), s->>'home_team', s->>'away_team',
         (s->>'commence_time')::timestamptz, s->>'market', s->>'pick', nullif(s->>'point','')::numeric, (s->>'odds')::numeric
  from jsonb_array_elements(_selections) s;
  update public.profiles set pending = pending + _stake where id = _user_id;
  return query select new_id, new_code;
end $$;

-- Records final results for selections, then settles every ticket that has no pending legs left.
-- _results: [{ "id": uuid, "result": "won"|"lost"|"void", "home_score": int, "away_score": int }]
create or replace function public.settle_selections(_results jsonb)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  b record;
  settled int := 0;
  odds_won numeric;
  win numeric;
begin
  update public.bet_selections bs
     set result = (r->>'result')::public.bet_status,
         home_score = nullif(r->>'home_score','')::int,
         away_score = nullif(r->>'away_score','')::int
    from jsonb_array_elements(_results) r
   where bs.id = (r->>'id')::uuid and bs.result = 'pending';

  for b in
    select bt.* from public.bets bt
     where bt.status = 'pending'
       and exists (select 1 from public.bet_selections s where s.bet_id = bt.id and s.id in (select (r->>'id')::uuid from jsonb_array_elements(_results) r))
       and not exists (select 1 from public.bet_selections s where s.bet_id = bt.id and s.result = 'pending')
     for update
  loop
    if exists (select 1 from public.bet_selections s where s.bet_id = b.id and s.result = 'lost') then
      update public.bets set status = 'lost', payout = 0, settled_at = now() where id = b.id;
      update public.profiles set pending = pending - b.stake, balance = balance - b.stake where id = b.user_id;
    elsif not exists (select 1 from public.bet_selections s where s.bet_id = b.id and s.result = 'won') then
      update public.bets set status = 'void', payout = b.stake, settled_at = now() where id = b.id;
      update public.profiles set pending = pending - b.stake where id = b.user_id;
    else
      select coalesce(exp(sum(ln(s.odds))), 1) into odds_won from public.bet_selections s where s.bet_id = b.id and s.result = 'won';
      win := round(b.stake * odds_won, 2);
      update public.bets set status = 'won', payout = win, settled_at = now() where id = b.id;
      update public.profiles set pending = pending - b.stake, balance = balance - b.stake + win where id = b.user_id;
    end if;
    settled := settled + 1;
  end loop;
  return settled;
end $$;

revoke all on function public.place_bet(uuid, numeric, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.settle_selections(jsonb) from public, anon, authenticated;
grant execute on function public.place_bet(uuid, numeric, numeric, jsonb) to service_role;
grant execute on function public.settle_selections(jsonb) to service_role;