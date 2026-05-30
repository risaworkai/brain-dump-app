-- INSERT 時に user_id が NULL なら auth.uid() を自動設定（RLS WITH CHECK 通過用）
-- Supabase SQL Editor に「中身だけ」貼り付けて RUN。
-- クライアントが user_id を付け忘れても、ログイン中 JWT があれば保存できる。
-- user_id を他人の UUID に指定した INSERT は RLS で引き続き拒否される。

create or replace function public.set_owner_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists thought_entries_set_user_id on public.thought_entries;
create trigger thought_entries_set_user_id
  before insert on public.thought_entries
  for each row
  execute function public.set_owner_user_id();

drop trigger if exists brain_dumps_set_user_id on public.brain_dumps;
create trigger brain_dumps_set_user_id
  before insert on public.brain_dumps
  for each row
  execute function public.set_owner_user_id();
