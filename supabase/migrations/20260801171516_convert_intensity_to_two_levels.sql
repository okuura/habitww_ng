-- Migrate 3-level intensity to 2-level system
-- Old: 1=達成, 2=しっかり達成, 3=ばっちり達成
-- New: 1=達成 (merged old 1+2), 2=ばっちり達成 (was old 3)

-- Update existing data: old 1,2 → new 1; old 3 → new 2
UPDATE habit_completions SET intensity = CASE WHEN intensity >= 3 THEN 2 ELSE 1 END;

-- Change default to 1 (達成)
ALTER TABLE habit_completions ALTER COLUMN intensity SET DEFAULT 1;

-- Update CHECK constraint to allow only 1-2
ALTER TABLE habit_completions DROP CONSTRAINT IF EXISTS habit_completions_intensity_check;
ALTER TABLE habit_completions ADD CONSTRAINT habit_completions_intensity_check CHECK (intensity BETWEEN 1 AND 2);
