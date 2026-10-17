-- Cowork の「応援(👏)」。仲間の行をタップして 1 日 1 回、拍手を送る。
-- 送った側の端末のローカル日付で 1 行(habit_completions と同じ流儀)。もう一度タップで取り消し

CREATE TABLE IF NOT EXISTS cowork_cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES cowork_groups(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cheer_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, from_user_id, to_user_id, cheer_date)
);

ALTER TABLE cowork_cheers ENABLE ROW LEVEL SECURITY;

-- 読む: 同じグループの承認済みメンバー
DROP POLICY IF EXISTS cowork_cheers_select ON cowork_cheers;
CREATE POLICY cowork_cheers_select ON cowork_cheers FOR SELECT
  TO authenticated USING (is_cowork_member(group_id));

-- 送る: 自分から、自分が承認済みのグループに、相手も同じグループの承認済みメンバー
DROP POLICY IF EXISTS cowork_cheers_insert ON cowork_cheers;
CREATE POLICY cowork_cheers_insert ON cowork_cheers FOR INSERT
  TO authenticated WITH CHECK (
    from_user_id = auth.uid()
    AND is_cowork_member(group_id)
    AND EXISTS (
      SELECT 1 FROM cowork_members m
      WHERE m.group_id = cowork_cheers.group_id AND m.user_id = cowork_cheers.to_user_id AND m.status = 'approved'
    )
  );

-- 取り消す: 自分が送った分だけ
DROP POLICY IF EXISTS cowork_cheers_delete ON cowork_cheers;
CREATE POLICY cowork_cheers_delete ON cowork_cheers FOR DELETE
  TO authenticated USING (from_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS cowork_cheers_group_date ON cowork_cheers (group_id, cheer_date);

-- 相手の画面に即時に出すため Realtime に流す
ALTER PUBLICATION supabase_realtime ADD TABLE cowork_cheers;
