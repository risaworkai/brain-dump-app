-- brain_dumps / categories: RLS 有効化 + ポリシー設定
-- Supabase SQL Editor に「中身だけ」貼り付けて RUN（ファイルパスは入力しない）。
--
-- 参照: docs/05_RLS仕様書.md
-- 手順: docs/20260530_04_rls_実行手順.md
--
-- 前提: brain_dumps.user_id 列あり（20260530_02_user_id.sql 済み）
--       categories.user_id 列あり（20260530_03_categories_user_id.sql 済み）推奨
--
-- ルール:
--   brain_dumps … auth.uid() = user_id
--   INSERT      … WITH CHECK のみ
--   SELECT/UPDATE/DELETE … USING のみ
--   categories SELECT … authenticated 全員許可（USING (true)）
--   anon        … ポリシー未定義のため全操作拒否

-- ============================================================
-- brain_dumps
-- ============================================================

alter table public.brain_dumps enable row level security;

drop policy if exists brain_dumps_select_own on public.brain_dumps;
drop policy if exists brain_dumps_insert_own on public.brain_dumps;
drop policy if exists brain_dumps_update_own on public.brain_dumps;
drop policy if exists brain_dumps_delete_own on public.brain_dumps;

-- BD-01 SELECT … USING
create policy brain_dumps_select_own
  on public.brain_dumps
  for select
  to authenticated
  using (user_id = auth.uid());

-- BD-02 INSERT … WITH CHECK
create policy brain_dumps_insert_own
  on public.brain_dumps
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- BD-03 UPDATE … USING
create policy brain_dumps_update_own
  on public.brain_dumps
  for update
  to authenticated
  using (user_id = auth.uid());

-- BD-04 DELETE … USING
create policy brain_dumps_delete_own
  on public.brain_dumps
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on table public.brain_dumps to authenticated;

-- ============================================================
-- categories
-- ============================================================

alter table public.categories enable row level security;

drop policy if exists categories_select_authenticated on public.categories;
drop policy if exists categories_select_own on public.categories;
drop policy if exists categories_insert_own on public.categories;
drop policy if exists categories_update_own on public.categories;
drop policy if exists categories_delete_own on public.categories;

-- CT-01 SELECT … 認証済みユーザー全員（USING）
create policy categories_select_authenticated
  on public.categories
  for select
  to authenticated
  using (true);

-- CT-02 INSERT … WITH CHECK
create policy categories_insert_own
  on public.categories
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- CT-03 UPDATE … USING
create policy categories_update_own
  on public.categories
  for update
  to authenticated
  using (user_id = auth.uid());

-- CT-04 DELETE … USING
create policy categories_delete_own
  on public.categories
  for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on table public.categories to authenticated;
