import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  completed_date: string;
  created_at: string;
  intensity: number; // 1=達成, 2=ばっちり達成
}

export interface HabitShare {
  id: string;
  habit_id: string;
  user_id: string;
  share_token: string;
  sharer_name: string;
  created_at: string;
}

export interface SharedHabitViewer {
  id: string;
  habit_share_id: string;
  viewer_user_id: string;
  sort_order: number;
  created_at: string;
}
