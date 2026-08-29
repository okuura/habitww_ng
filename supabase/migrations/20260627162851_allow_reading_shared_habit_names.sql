/*
# Allow reading habit names for shared habits

1. Changes
- Adds a new SELECT policy on `habits` called "public_read_shared_habits"
- Any authenticated user can read a habit's data if that habit has an active entry
  in `habit_shares` (i.e., the owner chose to share it via a QR code)

2. Reason
- When a viewer scans a QR code, they need to see the habit name in the confirmation
  dialog before being added to `shared_habit_viewers`.
- The existing `viewers_read_shared_habits` policy only covers viewers already
  subscribed, so the JOIN in the pre-subscription query returned null, causing the
  habit name to show as "不明な習慣".
- Sharing the habit name for an actively-shared habit is appropriate because the
  sharer explicitly created the share token for that purpose.
*/

DROP POLICY IF EXISTS "public_read_shared_habits" ON habits;
CREATE POLICY "public_read_shared_habits" ON habits FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM habit_shares
    WHERE habit_shares.habit_id = habits.id
  )
);
