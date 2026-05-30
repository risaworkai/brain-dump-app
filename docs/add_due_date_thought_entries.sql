-- thought_entries に締切日（due_date）列が無い場合に追加
-- Supabase SQL Editor で実行してください。

alter table public.thought_entries
  add column if not exists due_date date;
