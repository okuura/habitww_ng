-- 習慣の削除を「論理削除」に: deleted_at を付けて全部の画面から外すが、記録は残して
-- これまでの実績(バッジ・メダル)の判定には使い続ける。null なら削除していない
ALTER TABLE habits ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
