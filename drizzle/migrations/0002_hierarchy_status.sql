create type public.account_status as enum ('aktiv','bllokuar','mbyllur');
alter table public.profiles add column if not exists status public.account_status not null default 'aktiv';
create index if not exists profiles_parent_id_idx on public.profiles(parent_id);

-- True when _node sits anywhere below _ancestor in the account tree.
create or replace function public.is_ancestor(_ancestor uuid, _node uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  with recursive up as (
    select parent_id from public.profiles where id = _node
    union
    select p.parent_id from public.profiles p join up on p.id = up.parent_id
  )
  select exists (select 1 from up where parent_id = _ancestor)
$$;

create policy "managers read descendants" on public.profiles for select to authenticated
  using (public.is_ancestor(auth.uid(), id));