/*
  # Habit Sharing Feature

  ## Overview
  Adds the ability for users to share individual habits with other users via QR codes.
  Each shared habit gets a unique token embedded in a QR code. Subscribers can view
  the sharer's habit completions in real-time.

  ## New Tables

  ### habit_shares
  Tracks which habits are currently being shared publicly.
  - `id` (uuid, primary key)
  - `habit_id` (uuid, FK → habits.id ON DELETE CASCADE) — the habit being shared; UNIQUE per habit
  - `user_id` (uuid, NOT NULL, DEFAULT auth.uid()) — the habit owner who created the share
  - `share_token` (text, UNIQUE) — the token embedded in QR codes; auto-generated UUID string
  - `sharer_name` (text) — display name of the sharer (stored at creation time)
  - `created_at` (timestamptz)

  ### shared_habit_viewers
  Tracks which users are subscribed to view which shared habits.
  - `id` (uuid, primary key)
  - `habit_share_id` (uuid, FK → habit_shares.id ON DELETE CASCADE) — cascades when sharing stops
  - `viewer_user_id` (uuid, NOT NULL, DEFAULT auth.uid()) — the subscriber
  - `sort_order` (integer, default 0) — for future drag-to-reorder functionality
  - `created_at` (timestamptz)
  - UNIQUE (habit_share_id, viewer_user_id) — prevents duplicate subscriptions

  ## Modified Tables

  ### habits
  - Added SELECT policy "viewers_read_shared_habits": authenticated viewers can read
    habits that have been shared with them via an active subscription.

  ### habit_completions
  - Added SELECT policy "viewers_read_shared_completions": authenticated viewers can
    read completions for habits shared with them.

  ## Security

  1. habit_shares: Any authenticated user can SELECT (needed for QR token validation —
     tokens are UUID-based so not guessable). Only the owner can INSERT/UPDATE/DELETE.
  2. shared_habit_viewers: Users can only read/insert/update/delete their own records.
  3. habits (new policy): Viewers can read habits if they have an active subscription.
  4. habit_completions (new policy): Viewers can read completions for subscribed habits.

  ## Notes
  1. Sharing is stopped by deleting the habit_shares row, which cascades to remove all subscriptions.
  2. Re-sharing creates a new habit_shares row with a new token, invalidating old QR codes.
  3. sort_order on shared_habit_viewers is reserved for future reordering UI.
*/

-- ==========================================
-- habit_shares
-- ==========================================
CREATE TABLE IF NOT EXISTS habit_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  share_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  sharer_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT habit_shares_habit_unique UNIQUE (habit_id)
);

ALTER TABLE habit_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_habit_shares" ON habit_shares;
CREATE POLICY "authenticated_read_habit_shares" ON habit_shares FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "owners_insert_habit_shares" ON habit_shares;
CREATE POLICY "owners_insert_habit_shares" ON habit_shares FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owners_update_habit_shares" ON habit_shares;
CREATE POLICY "owners_update_habit_shares" ON habit_shares FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owners_delete_habit_shares" ON habit_shares;
CREATE POLICY "owners_delete_habit_shares" ON habit_shares FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ==========================================
-- shared_habit_viewers
-- ==========================================
CREATE TABLE IF NOT EXISTS shared_habit_viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_share_id uuid NOT NULL REFERENCES habit_shares(id) ON DELETE CASCADE,
  viewer_user_id uuid NOT NULL DEFAULT auth.uid(),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT one_viewer_per_share UNIQUE (habit_share_id, viewer_user_id)
);

ALTER TABLE shared_habit_viewers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "viewers_select_own" ON shared_habit_viewers;
CREATE POLICY "viewers_select_own" ON shared_habit_viewers FOR SELECT
  TO authenticated USING (auth.uid() = viewer_user_id);

DROP POLICY IF EXISTS "viewers_insert_own" ON shared_habit_viewers;
CREATE POLICY "viewers_insert_own" ON shared_habit_viewers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = viewer_user_id);

DROP POLICY IF EXISTS "viewers_update_own" ON shared_habit_viewers;
CREATE POLICY "viewers_update_own" ON shared_habit_viewers FOR UPDATE
  TO authenticated USING (auth.uid() = viewer_user_id) WITH CHECK (auth.uid() = viewer_user_id);

DROP POLICY IF EXISTS "viewers_delete_own" ON shared_habit_viewers;
CREATE POLICY "viewers_delete_own" ON shared_habit_viewers FOR DELETE
  TO authenticated USING (auth.uid() = viewer_user_id);

-- ==========================================
-- Extended policies on existing tables
-- ==========================================

-- Allow viewers to read habits shared with them
DROP POLICY IF EXISTS "viewers_read_shared_habits" ON habits;
CREATE POLICY "viewers_read_shared_habits" ON habits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM habit_shares hs
      JOIN shared_habit_viewers shv ON shv.habit_share_id = hs.id
      WHERE hs.habit_id = habits.id
        AND shv.viewer_user_id = auth.uid()
    )
  );

-- Allow viewers to read completions for habits shared with them
DROP POLICY IF EXISTS "viewers_read_shared_completions" ON habit_completions;
CREATE POLICY "viewers_read_shared_completions" ON habit_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM habits h
      JOIN habit_shares hs ON hs.habit_id = h.id
      JOIN shared_habit_viewers shv ON shv.habit_share_id = hs.id
      WHERE h.id = habit_completions.habit_id
        AND shv.viewer_user_id = auth.uid()
    )
  );
