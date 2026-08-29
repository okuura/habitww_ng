/*
  # Fix over-permissive UPDATE policy on habit_completions

  20260705035317 added "Anyone can update completions" (anon+authenticated,
  USING true / WITH CHECK true), which let any client rewrite any user's
  completion rows. Replace it with an owner-scoped policy matching the
  SELECT/INSERT/DELETE policies from 20260517033138.

  Sharing is view-only (viewers only get SELECT), so this does not affect
  the share feature.
*/

DROP POLICY IF EXISTS "Anyone can update completions" ON habit_completions;

CREATE POLICY "Users can update own completions"
  ON habit_completions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM habits
      WHERE habits.id = habit_completions.habit_id
        AND habits.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM habits
      WHERE habits.id = habit_completions.habit_id
        AND habits.user_id = auth.uid()
    )
  );
