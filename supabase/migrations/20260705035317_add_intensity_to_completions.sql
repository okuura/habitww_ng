-- Add intensity level (1=minimum, 2=normal, 3=extra effort) to habit completions.
-- Existing rows default to 2 (normal completion).
ALTER TABLE habit_completions
  ADD COLUMN IF NOT EXISTS intensity smallint NOT NULL DEFAULT 2
  CHECK (intensity BETWEEN 1 AND 3);

-- UPDATE policy was missing; needed to change intensity without deleting/re-inserting.
CREATE POLICY "Anyone can update completions"
  ON habit_completions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
