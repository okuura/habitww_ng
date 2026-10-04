-- 習慣ごとの実施時間・通知設定と、疾風迅雷(実施時間どおりの達成)フラグ
--
-- habits.scheduled_time   : 実施時間(端末のローカル時刻として解釈)。NULL = 未設定
-- habits.notify_enabled   : 実施時間に通知する(iOS アプリ版のみが参照)
-- habit_completions.on_time: その日の最初の達成が「実施時間 + 10 分」以内だった

ALTER TABLE habits ADD COLUMN IF NOT EXISTS scheduled_time time;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS notify_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE habit_completions ADD COLUMN IF NOT EXISTS on_time boolean NOT NULL DEFAULT false;
