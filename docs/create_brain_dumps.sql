-- ブレインダンプ: brain_dumps テーブル作成（RLS オフ・簡易版）
-- 新規プロジェクトはこのファイルを SQL Editor で実行してください。
-- 既に brain_dumps がある場合は add_is_done_brain_dumps.sql のみ実行で可。

create extension if not exists "pgcrypto";

create table if not exists public.brain_dumps (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  is_done boolean not null default false
);

alter table public.brain_dumps disable row level security;

grant select, insert, update, delete on table public.brain_dumps to anon, authenticated;
