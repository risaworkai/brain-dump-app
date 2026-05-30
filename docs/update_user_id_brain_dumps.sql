-- brain_dumps の既存行に user_id を設定（移行用）
-- 事前に docs/add_user_id_brain_dumps.sql を実行してから、
-- 本ファイルの「中身だけ」を Supabase SQL Editor に貼り付けて実行する。
--
-- user_id が NULL の行のみ更新（再実行しても他ユーザーの行は上書きしない）

update public.brain_dumps
set user_id = '1efbf1dc-1df6-4bdc-95ff-5d0fb7e91bf5'::uuid
where user_id is null;
