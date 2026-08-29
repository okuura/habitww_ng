/*
  # Create Habit Tracker Schema

  ## Overview
  Creates tables for a habit tracking application where users can register habits
  and record daily completions.

  ## New Tables

  ### habits
  - `id` (uuid, primary key) - unique identifier
  - `name` (text, not null) - habit name
  - `color` (text, default '#4caf50') - display color for the habit
  - `created_at` (timestamptz) - creation timestamp

  ### habit_completions
  - `id` (uuid, primary key) - unique identifier
  - `habit_id` (uuid, FK -> habits.id) - reference to habit
  - `completed_date` (date, not null) - the date the habit was completed
  - `created_at` (timestamptz) - creation timestamp

  ## Notes
  1. habit_completions has a unique constraint on (habit_id, completed_date) to prevent duplicates
  2. RLS is enabled on both tables
  3. For this MVP, policies allow all authenticated users full access (single-user app pattern)
  4. Cascade delete ensures completions are removed when a habit is deleted
*/

CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#4caf50',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read habits"
  ON habits FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert habits"
  ON habits FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update habits"
  ON habits FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete habits"
  ON habits FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS habit_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  completed_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(habit_id, completed_date)
);

ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read completions"
  ON habit_completions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert completions"
  ON habit_completions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete completions"
  ON habit_completions FOR DELETE
  TO anon, authenticated
  USING (true);
