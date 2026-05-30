-- categories に user_id を追加し、既存カテゴリをログインユーザーに紐付ける
-- Supabase SQL Editor に「中身だけ」貼り付けて実行する（ファイルパスは入力しない）。
--
-- 実行順: 20260530_01_categories.sql → 20260530_02_user_id.sql → 本ファイル → 20260530_04_rls_brain_dumps_categories.sql
--
-- user_id: uuid, NOT NULL（移行後）, FK → auth.users(id)

-- 1. user_id 列を追加（NULL 可で追加し、既存行を更新してから NOT NULL にする）
alter table public.categories
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists categories_user_id_idx on public.categories (user_id);

-- 2. 既存の共有カテゴリ（仮データ 5 件など）をログインユーザーに紐付け
update public.categories
set user_id = '1efbf1dc-1df6-4bdc-95ff-5d0fb7e91bf5'::uuid
where user_id is null;

-- 3. グローバル UNIQUE(name) をユーザー別 UNIQUE(user_id, name) に変更
alter table public.categories
  drop constraint if exists categories_name_key;

alter table public.categories
  drop constraint if exists categories_user_id_name_key;

alter table public.categories
  add constraint categories_user_id_name_key unique (user_id, name);

-- 4. 移行後は user_id を必須にする
alter table public.categories
  alter column user_id set not null;
