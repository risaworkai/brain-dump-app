-- thought_entries: RLS 有効化 + ポリシー設定
-- Supabase SQL Editor に「中身だけ」貼り付けて RUN（ファイルパスは入力しない）。
--
-- 参照: docs/05_RLS仕様書.md
-- 手順: docs/20260530_05_rls_実行手順.md
--
-- 前提: thought_entries.user_id 列あり（20260530_02_user_id.sql 済み）
--       user_id が NULL の行は誰からも参照不可（必要なら fix_null_user_id_thought_entries.sql）
--
-- ルール:
--   auth.uid() = user_id
--   INSERT      … WITH CHECK のみ
--   SELECT/UPDATE/DELETE … USING のみ
--   anon        … ポリシー未定義のため全操作拒否

alter table public.thought_entries enable row level security;

drop policy if exists thought_entries_select_own on public.thought_entries;
drop policy if exists thought_entries_insert_own on public.thought_entries;
drop policy if exists thought_entries_update_own on public.thought_entries;
drop policy if exists thought_entries_delete_own on public.thought_entries;

-- TE-01 SELECT … USING
create policy thought_entries_select_own
  on public.thought_entries
  for select
  to authenticated
  using (user_id = auth.uid());

-- TE-02 INSERT … WITH CHECK
create policy thought_entries_insert_own
  on public.thought_entries
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- TE-03 UPDATE … USING
create policy thought_entries_update_own
  on public.thought_entries
  for update
  to authenticated
  using (user_id = auth.uid());

-- TE-04 DELETE … USING
create policy thought_entries_delete_own
  on public.thought_entries
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on table public.thought_entries to authenticated;
