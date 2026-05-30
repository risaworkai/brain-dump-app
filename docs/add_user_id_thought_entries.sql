-- thought_entries に user_id を追加（ユーザー別メモ管理）
-- Supabase SQL Editor に「中身だけ」貼り付けて実行する（ファイルパスは入力しない）。
-- 既存行は user_id が NULL のまま。ログイン後の一覧には表示されない。

alter table public.thought_entries
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists thought_entries_user_id_idx on public.thought_entries (user_id);
