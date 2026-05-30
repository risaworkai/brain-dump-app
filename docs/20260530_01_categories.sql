-- categories マスタ作成 + thought_entries.category_id 追加 + 仮データ 5 件
-- Supabase SQL Editor に「中身だけ」貼り付けて実行する（ファイルパスは入力しない）。
-- （旧ファイル名: 20260523_01_カテゴリマスタ導入.sql と同内容。再実行可）

create extension if not exists "pgcrypto";

-- 1. カテゴリマスタ
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_name_key unique (name)
);

alter table public.categories disable row level security;

grant select, insert, update, delete on table public.categories to anon, authenticated;

-- 2. メモテーブルにカテゴリ FK（任意・NULL 可）
alter table public.thought_entries
  add column if not exists category_id uuid references public.categories (id) on delete set null;

create index if not exists thought_entries_category_id_idx
  on public.thought_entries (category_id);

-- 3. カテゴリ仮データ（5 件）
insert into public.categories (name, sort_order)
values
  ('仕事', 1),
  ('学習', 2),
  ('アイデア', 3),
  ('AI・プロンプト', 4),
  ('その他', 5)
on conflict (name) do nothing;
