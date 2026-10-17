-- 習慣のアーカイブ: 記録画面から外すが、記録は残す(削除しない)。null なら現役。
-- 本人が自分の habits を update できる既存のポリシーで足りる
ALTER TABLE habits ADD COLUMN IF NOT EXISTS archived_at timestamptz;
