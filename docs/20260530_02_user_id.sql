-- ユーザー別メモ管理: user_id 列追加 + 既存データの紐付け
-- Supabase SQL Editor に「中身だけ」貼り付けて実行する（ファイルパスは入力しない）。
--
-- user_id: uuid, NULL 可, FK → auth.users(id)

-- 1. brain_dumps に user_id を追加
alter table public.brain_dumps
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists brain_dumps_user_id_idx on public.brain_dumps (user_id);

-- 2. thought_entries に user_id を追加
alter table public.thought_entries
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists thought_entries_user_id_idx on public.thought_entries (user_id);

-- 3. 既存行をログインユーザーに紐付け（user_id が NULL の行のみ）
update public.brain_dumps
set user_id = '1efbf1dc-1df6-4bdc-95ff-5d0fb7e91bf5'::uuid
where user_id is null;

update public.thought_entries
set user_id = '1efbf1dc-1df6-4bdc-95ff-5d0fb7e91bf5'::uuid
where user_id is null;
