import type { Habit } from './supabase';
import type { AchievementContext, EvaluatedAchievement } from './achievements';

// 授与式の判断。「もう見せた」バッジとメダルを端末に覚えておき、新しく取れた分だけを返す

export type Award =
  | { kind: 'badge'; key: string; achievement: EvaluatedAchievement }
  | { kind: 'medal'; key: string; habit: Habit; year: number; month: number; days: number; nth: number };

export const AWARDED_KEY = 'habitww-awarded';

interface Seen { badges: string[]; medals: string[] }

export function readSeen(storage: Pick<Storage, 'getItem'> = localStorage): Seen | null {
  try {
    const raw = storage.getItem(AWARDED_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Seen>;
    return { badges: Array.isArray(v.badges) ? v.badges : [], medals: Array.isArray(v.medals) ? v.medals : [] };
  } catch {
    return null;
  }
}

export function writeSeen(seen: Seen, storage: Pick<Storage, 'setItem'> = localStorage) {
  try { storage.setItem(AWARDED_KEY, JSON.stringify(seen)); } catch { /* 覚えられなければ次も出るだけ */ }
}

/** 今取れている勲章を全部(メダルは習慣ごとに古い順、何枚目かつき) */
export function collectAwards(ctx: AchievementContext, evaluated: EvaluatedAchievement[]): Award[] {
  const out: Award[] = [];
  for (const h of ctx.habits) {
    const sorted = [...h.perfectMonths].sort((a, b) => a.year - b.year || a.month - b.month);
    sorted.forEach((m, i) => out.push({
      kind: 'medal', key: `${h.habit.id}:${m.year}-${m.month}`, habit: h.habit,
      year: m.year, month: m.month, days: new Date(m.year, m.month, 0).getDate(), nth: i + 1,
    }));
  }
  for (const a of evaluated) if (a.state.earned) out.push({ kind: 'badge', key: a.id, achievement: a });
  return out;
}

/**
 * 新しく取れた勲章。見せた分として覚える。
 * 初めて(何も覚えていない)なら、今ある分を全部「見せた」扱いにして何も返さない
 */
export function newAwards(ctx: AchievementContext, evaluated: EvaluatedAchievement[], storage: Storage = localStorage): Award[] {
  const all = collectAwards(ctx, evaluated);
  const seen = readSeen(storage);
  const badges = all.filter(a => a.kind === 'badge').map(a => a.key);
  const medals = all.filter(a => a.kind === 'medal').map(a => a.key);
  if (!seen) {
    writeSeen({ badges, medals }, storage);
    return [];
  }
  const seenB = new Set(seen.badges);
  const seenM = new Set(seen.medals);
  const fresh = all.filter(a => (a.kind === 'badge' ? !seenB.has(a.key) : !seenM.has(a.key)));
  if (fresh.length > 0) writeSeen({ badges: [...new Set([...seen.badges, ...badges])], medals: [...new Set([...seen.medals, ...medals])] }, storage);
  // メダルを先に(大きい出来事)、次にバッジ(易しい順)
  return [...fresh.filter(a => a.kind === 'medal'), ...fresh.filter(a => a.kind === 'badge')];
}
