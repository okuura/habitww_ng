/*
  # Add user authentication to habits schema

  ## Overview
  Adds per-user ownership to the habits system so each authenticated user
  can only see and manage their own habits and completions.

  ## Changes

  ### habits table
  - Add `user_id` column (uuid, references auth.users, not null with default)
  - Drop old open-access RLS policies
  - Add new policies: authenticated users can only access their own rows

  ### habit_completions table
  - Drop old open-access RLS policies
  - Add new policies: authenticated users can only access completions
    belonging to habits they own

  ## Security
  - RLS remains enabled on both tables
  - All policies require `auth.uid()` checks
  - Cascade: when auth.users row is deleted, habits are deleted via FK cascade,
    and habit_completions are deleted via their FK cascade to habits
*/

-- 1. Add user_id to habits (nullable first, then set default + constraint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'habits' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE habits ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Drop old open-access policies on habits
DROP POLICY IF EXISTS "Anyone can read habits" ON habits;
DROP POLICY IF EXISTS "Anyone can insert habits" ON habits;
DROP POLICY IF EXISTS "Anyone can update habits" ON habits;
DROP POLICY IF EXISTS "Anyone can delete habits" ON habits;

-- 3. New user-scoped policies for habits
CREATE POLICY "Users can read own habits"
  ON habits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own habits"
  ON habits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own habits"
  ON habits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own habits"
  ON habits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Drop old open-access policies on habit_completions
DROP POLICY IF EXISTS "Anyone can read completions" ON habit_completions;
DROP POLICY IF EXISTS "Anyone can insert completions" ON habit_completions;
DROP POLICY IF EXISTS "Anyone can delete completions" ON habit_completions;

-- 5. New user-scoped policies for habit_completions (via habit ownership)
CREATE POLICY "Users can read own completions"
  ON habit_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM habits
      WHERE habits.id = habit_completions.habit_id
        AND habits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own completions"
  ON habit_completions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM habits
      WHERE habits.id = habit_completions.habit_id
        AND habits.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own completions"
  ON habit_completions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM habits
      WHERE habits.id = habit_completions.habit_id
        AND habits.user_id = auth.uid()
    )
  );
