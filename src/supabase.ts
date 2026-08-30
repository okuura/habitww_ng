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

let preloadedData: Promise<{ habits: Habit[]; completions: HabitCompletion[] } | null> | null =
  initialSession.then(async ({ data: { session } }) => {
    if (!session?.user) return null;
    const [{ data: habits }, { data: completions }] = await Promise.all([
      supabase.from('habits').select('*').order('created_at', { ascending: true }),
      supabase.from('habit_completions').select('*'),
    ]);
    return { habits: habits ?? [], completions: completions ?? [] };
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
