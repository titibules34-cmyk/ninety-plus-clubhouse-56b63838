alter type public.app_role add value if not exists 'menaxher';
alter type public.app_role add value if not exists 'nen_menaxher';
alter type public.app_role add value if not exists 'menaxher_fundor';

alter table public.profiles add column if not exists parent_id uuid references public.profiles(id) on delete set null;