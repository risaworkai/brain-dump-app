-- brain_dumps に user_id を追加（ユーザー別メモ管理）
-- Supabase SQL Editor に「中身だけ」貼り付けて実行する（ファイルパスは入力しない）。
--
-- user_id: uuid, NULL 可, FK → auth.users(id)

alter table public.brain_dumps
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists brain_dumps_user_id_idx on public.brain_dumps (user_id);
