-- 習慣の並び順(カードの長押しドラッグで並べ替え)。小さい順に表示する
ALTER TABLE habits ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 既存の習慣は今の表示順(作成順)で 0,1,2… を振る
UPDATE habits h SET sort_order = r.rn - 1
FROM (SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at) AS rn FROM habits) r
WHERE h.id = r.id;
