/*
  # Cowork Habits

  仲間とグループを作り、各自が「自分の習慣」を 1 つ登録して、やった/やらなかったを共有する。
  (1 つの習慣を共同編集するのではない。記録は各自の habits / habit_completions のまま)

  ## 新しいテーブル

  ### cowork_groups
  - `id`, `name`, `owner_id`(作成者), `invite_token`(招待 QR/リンクの秘密), `created_at`
  - `approval`: 加入を承認できる人。'owner' = 作成者だけ / 'anyone' = 承認済みメンバー全員

  ### cowork_members
  - `group_id`, `user_id`, `habit_id`(その人の習慣), `display_name`
  - `status`: 'pending'(承認待ち) / 'approved'
  - `joined_at`(申請した時刻), `approved_at`(承認された時刻。「みんなで達成」の数え始め)
  - UNIQUE (group_id, user_id): 1 グループに 1 人 1 習慣

  ## 既存テーブルへのポリシー追加
  - habits: 同じグループの承認済みメンバーは、メンバー(承認待ちを含む)の習慣の名前と色を読める
  - habit_completions: 同じグループの承認済みメンバーは、承認済みメンバーの記録を読める

  ## RPC(security definer)
  - cowork_preview(p_token): 参加前にグループ名・メンバー・自分の状態を見る
  - cowork_join(p_token, p_habit_id, p_display_name): トークンを検証して参加(作成者は承認済み、他は承認待ち)
  - cowork_approve(p_member_id): 承認者が承認する

  ## メモ
  - cowork_members への INSERT はポリシーを作らない(RPC 経由のみ)。招待トークンだけを秘密にする。
  - 旧 Share Habits(habit_shares / shared_habit_viewers)は画面から外すだけで、テーブルとポリシーは残す。
  - Realtime: cowork_groups と cowork_members を publication に追加する(docs/integration.md)
*/

-- ==========================================
-- テーブル
-- ==========================================
CREATE TABLE IF NOT EXISTS cowork_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  invite_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  approval text NOT NULL DEFAULT 'owner' CHECK (approval IN ('owner', 'anyone')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cowork_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES cowork_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  joined_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  CONSTRAINT one_member_per_group UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS cowork_members_group_idx ON cowork_members (group_id);
CREATE INDEX IF NOT EXISTS cowork_members_habit_idx ON cowork_members (habit_id);

ALTER TABLE cowork_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE cowork_members ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- ヘルパー(security definer: ポリシーの中から同じテーブルを見ても再帰しない)
-- ==========================================

-- 自分のそのグループでの状態('pending' / 'approved' / NULL)
CREATE OR REPLACE FUNCTION cowork_my_status(gid uuid) RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT status FROM cowork_members WHERE group_id = gid AND user_id = auth.uid();
$$;

-- 承認済みメンバーか
CREATE OR REPLACE FUNCTION is_cowork_member(gid uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM cowork_members WHERE group_id = gid AND user_id = auth.uid() AND status = 'approved'
  );
$$;

-- 加入を承認できるか(作成者、または approval = 'anyone' のときの承認済みメンバー)
CREATE OR REPLACE FUNCTION is_cowork_approver(gid uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM cowork_groups g
    WHERE g.id = gid AND (
      g.owner_id = auth.uid()
      OR (g.approval = 'anyone' AND EXISTS (
        SELECT 1 FROM cowork_members m
        WHERE m.group_id = gid AND m.user_id = auth.uid() AND m.status = 'approved'))
    )
  );
$$;

REVOKE ALL ON FUNCTION cowork_my_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_cowork_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION is_cowork_approver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cowork_my_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_cowork_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_cowork_approver(uuid) TO authenticated;

-- ==========================================
-- cowork_groups のポリシー
-- ==========================================
DROP POLICY IF EXISTS "cowork_groups_select" ON cowork_groups;
CREATE POLICY "cowork_groups_select" ON cowork_groups FOR SELECT
  TO authenticated USING (owner_id = auth.uid() OR cowork_my_status(id) IS NOT NULL);

DROP POLICY IF EXISTS "cowork_groups_insert" ON cowork_groups;
CREATE POLICY "cowork_groups_insert" ON cowork_groups FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "cowork_groups_update" ON cowork_groups;
CREATE POLICY "cowork_groups_update" ON cowork_groups FOR UPDATE
  TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "cowork_groups_delete" ON cowork_groups;
CREATE POLICY "cowork_groups_delete" ON cowork_groups FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- ==========================================
-- cowork_members のポリシー(INSERT は RPC 経由のみ)
-- ==========================================
DROP POLICY IF EXISTS "cowork_members_select" ON cowork_members;
CREATE POLICY "cowork_members_select" ON cowork_members FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR is_cowork_member(group_id));

DROP POLICY IF EXISTS "cowork_members_update" ON cowork_members;
CREATE POLICY "cowork_members_update" ON cowork_members FOR UPDATE
  TO authenticated USING (user_id = auth.uid() OR is_cowork_approver(group_id))
  WITH CHECK (user_id = auth.uid() OR is_cowork_approver(group_id));

DROP POLICY IF EXISTS "cowork_members_delete" ON cowork_members;
CREATE POLICY "cowork_members_delete" ON cowork_members FOR DELETE
  TO authenticated USING (user_id = auth.uid() OR is_cowork_approver(group_id));

-- ==========================================
-- 既存テーブルへの追加ポリシー
-- ==========================================

-- 同じグループの承認済みメンバーは、メンバー(承認待ちも)の習慣の名前・色を読める
DROP POLICY IF EXISTS "cowork_read_habits" ON habits;
CREATE POLICY "cowork_read_habits" ON habits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cowork_members m
      WHERE m.habit_id = habits.id AND is_cowork_member(m.group_id)
    )
  );

-- 同じグループの承認済みメンバーは、承認済みメンバーの記録を読める
DROP POLICY IF EXISTS "cowork_read_completions" ON habit_completions;
CREATE POLICY "cowork_read_completions" ON habit_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cowork_members m
      WHERE m.habit_id = habit_completions.habit_id
        AND m.status = 'approved'
        AND is_cowork_member(m.group_id)
    )
  );

-- ==========================================
-- RPC
-- ==========================================

-- 参加前の下見: グループ名、承認の設定、作成者の名前と習慣名、承認済みメンバー、自分の状態
CREATE OR REPLACE FUNCTION cowork_preview(p_token text) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  g cowork_groups;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO g FROM cowork_groups WHERE invite_token = p_token;
  IF g.id IS NULL THEN RETURN NULL; END IF;
  RETURN json_build_object(
    'group_id', g.id,
    'name', g.name,
    'approval', g.approval,
    'owner_name', (SELECT m.display_name FROM cowork_members m WHERE m.group_id = g.id AND m.user_id = g.owner_id),
    'owner_habit_name', (
      SELECT h.name FROM cowork_members m JOIN habits h ON h.id = m.habit_id
      WHERE m.group_id = g.id AND m.user_id = g.owner_id),
    'members', (
      SELECT COALESCE(json_agg(json_build_object('display_name', m.display_name, 'habit_name', h.name)
                               ORDER BY m.approved_at), '[]'::json)
      FROM cowork_members m JOIN habits h ON h.id = m.habit_id
      WHERE m.group_id = g.id AND m.status = 'approved'),
    'my_status', (SELECT m.status FROM cowork_members m WHERE m.group_id = g.id AND m.user_id = auth.uid())
  );
END;
$$;

-- 参加する(自分の習慣を 1 つ登録)。作成者は承認済み、他は承認待ち。重複は 23505
CREATE OR REPLACE FUNCTION cowork_join(p_token text, p_habit_id uuid, p_display_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g cowork_groups;
  uid uuid := auth.uid();
  mid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  SELECT * INTO g FROM cowork_groups WHERE invite_token = p_token;
  IF g.id IS NULL THEN RAISE EXCEPTION 'invalid token' USING ERRCODE = 'P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM habits WHERE id = p_habit_id AND user_id = uid) THEN
    RAISE EXCEPTION 'not your habit' USING ERRCODE = '42501';
  END IF;
  INSERT INTO cowork_members (group_id, user_id, habit_id, display_name, status, approved_at)
  VALUES (g.id, uid, p_habit_id, COALESCE(NULLIF(trim(p_display_name), ''), 'ユーザー'),
          CASE WHEN g.owner_id = uid THEN 'approved' ELSE 'pending' END,
          CASE WHEN g.owner_id = uid THEN now() ELSE NULL END)
  RETURNING id INTO mid;
  RETURN mid;
END;
$$;

-- 承認する(承認者のみ)
CREATE OR REPLACE FUNCTION cowork_approve(p_member_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m cowork_members;
BEGIN
  SELECT * INTO m FROM cowork_members WHERE id = p_member_id;
  IF m.id IS NULL THEN RAISE EXCEPTION 'not found' USING ERRCODE = 'P0002'; END IF;
  IF NOT is_cowork_approver(m.group_id) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  UPDATE cowork_members SET status = 'approved', approved_at = now()
  WHERE id = p_member_id AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION cowork_preview(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cowork_join(text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cowork_approve(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cowork_preview(text) TO authenticated;
GRANT EXECUTE ON FUNCTION cowork_join(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION cowork_approve(uuid) TO authenticated;

-- ==========================================
-- Realtime(画面の即時反映)
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE cowork_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE cowork_members;
