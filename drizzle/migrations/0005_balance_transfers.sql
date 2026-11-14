create table public.balance_transfers (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('deposit','withdraw')),
  amount numeric(14,2) not null check (amount > 0),
  description text not null default '',
  created_at timestamptz not null default now()
);
create index balance_transfers_target_idx on public.balance_transfers (target_id, created_at desc);
create index balance_transfers_actor_idx on public.balance_transfers (actor_id, created_at desc);

grant select on public.balance_transfers to authenticated;
grant all on public.balance_transfers to service_role;
alter table public.balance_transfers enable row level security;

create policy "read own, admin or downline transfers" on public.balance_transfers
  for select to authenticated
  using (
    actor_id = auth.uid() or target_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or public.is_ancestor(auth.uid(), target_id)
  );

-- Deposit: move money from the actor's account to the target.
-- Withdraw: move money from the target's account back to the actor.
-- Only admins or an upline manager of the target may call it.
create or replace function public.transfer_balance(_actor_id uuid, _target_id uuid, _kind text, _amount numeric, _description text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.profiles%rowtype;
  t public.profiles%rowtype;
  new_id uuid;
begin
  if _actor_id = _target_id then raise exception 'SAME_ACCOUNT'; end if;
  if _kind not in ('deposit','withdraw') then raise exception 'BAD_KIND'; end if;
  if _amount is null or _amount <= 0 then raise exception 'BAD_AMOUNT'; end if;
  if not (public.has_role(_actor_id, 'admin') or public.is_ancestor(_actor_id, _target_id)) then
    raise exception 'FORBIDDEN';
  end if;
  -- lock both rows in a stable order to avoid deadlocks
  if _actor_id < _target_id then
    select * into a from public.profiles where id = _actor_id for update;
    select * into t from public.profiles where id = _target_id for update;
  else
    select * into t from public.profiles where id = _target_id for update;
    select * into a from public.profiles where id = _actor_id for update;
  end if;
  if a.id is null or t.id is null then raise exception 'NO_ACCOUNT'; end if;
  if _kind = 'deposit' then
    if a.balance + a.overdraft - a.pending < _amount then raise exception 'INSUFFICIENT_FUNDS'; end if;
    update public.profiles set balance = balance - _amount where id = _actor_id;
    update public.profiles set balance = balance + _amount where id = _target_id;
  else
    if t.balance - t.pending < _amount then raise exception 'TARGET_INSUFFICIENT'; end if;
    update public.profiles set balance = balance - _amount where id = _target_id;
    update public.profiles set balance = balance + _amount where id = _actor_id;
  end if;
  insert into public.balance_transfers (actor_id, target_id, kind, amount, description)
    values (_actor_id, _target_id, _kind, round(_amount, 2), coalesce(left(_description, 200), ''))
    returning id into new_id;
  return new_id;
end $$;

revoke all on function public.transfer_balance(uuid, uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.transfer_balance(uuid, uuid, text, numeric, text) to service_role;