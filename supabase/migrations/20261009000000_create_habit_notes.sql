-- 習慣カードの裏面に書く「なぜやるのか」「理想の姿」。
-- 共有中の習慣は public_read_shared_habits で誰でも読めるため、個人的なメモは habits に入れず
-- 本人だけが読み書きできる別テーブルにする

CREATE TABLE IF NOT EXISTS habit_notes (
  habit_id uuid PRIMARY KEY REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  why text NOT NULL DEFAULT '',
  ideal text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE habit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their habit notes" ON habit_notes;
CREATE POLICY "Owners manage their habit notes" ON habit_notes FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM habits h WHERE h.id = habit_id AND h.user_id = auth.uid())
  );
