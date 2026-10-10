import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------------------------------------------------------------------------
// Startup fast path
//
// 1. Local cache (stale-while-revalidate): the last known habits/completions
//    are kept in localStorage so the app can paint real content immediately,
//    before any network round-trip. Fresh data replaces it once fetched.
// 2. Eager fetch: session restore + data fetch start at module load, in
//    parallel with React mounting, instead of waiting for App's effects.
// ---------------------------------------------------------------------------

export interface CachedAppData {
  habits: Habit[];
  completions: HabitCompletion[];
  /** 古いキャッシュには無い */
  notes?: HabitNote[];
  userName?: string;
  userAvatar?: string;
}

const CACHE_KEY = 'habitww-data-cache';

export function readCachedData(): CachedAppData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAppData;
    return Array.isArray(parsed.habits) && Array.isArray(parsed.completions) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedData(data: CachedAppData): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // quota/private mode — cache is best-effort
  }
}

export function clearCachedData(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

export const initialSession = supabase.auth.getSession();

export interface AppData {
  habits: Habit[];
  completions: HabitCompletion[];
  notes: HabitNote[];
}

/** 自分の習慣・記録・メモをまとめて取得する(メモのテーブルが無い/読めない場合は空として扱う)。
 *  RLS では他人が共有中の習慣・購読中の習慣の記録も読めてしまうので、必ず自分の分に絞る */
export async function fetchAppData(userId: string): Promise<AppData> {
  const [{ data: habits }, { data: completions }, { data: notes }] = await Promise.all([
    supabase.from('habits').select('*').eq('user_id', userId)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('habit_completions').select('*'),
    supabase.from('habit_notes').select('habit_id, why, ideal'),
  ]);
  const own = new Set((habits ?? []).map(h => h.id));
  return {
    habits: habits ?? [],
    completions: (completions ?? []).filter(c => own.has(c.habit_id)),
    notes: notes ?? [],
  };
}

let preloadedData: Promise<AppData | null> | null =
  initialSession.then(async ({ data: { session } }) => {
    if (!session?.user) return null;
    return fetchAppData(session.user.id);
  }).catch(() => null);

/** One-shot: the first fetchData() consumes the eager fetch; later calls refetch. */
export function takePreloadedData() {
  const p = preloadedData;
  preloadedData = null;
  return p;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  scheduled_time?: string | null; // 実施時間 "HH:MM:SS"(ローカル時刻)
  notify_enabled?: boolean; // 実施時間に通知する(iOS アプリ版のみ)
  sort_order?: number; // 表示順(小さい順)
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  completed_date: string;
  created_at: string;
  intensity: number; // 1=達成, 2=ばっちり達成
  on_time?: boolean; // 疾風迅雷: 実施時間 + 10 分以内に達成
}

/** 習慣カードの裏面のメモ(本人だけが読み書きできる habit_notes テーブル) */
export interface HabitNote {
  habit_id: string;
  why: string; // なぜやるのか
  ideal: string; // 理想の姿(一言)
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
