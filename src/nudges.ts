import { addDays, daysBetween, type AchievementContext } from './achievements';
import type { Habit } from './supabase';

// 記録画面の「新しい習慣を足してみませんか」の促し(UI を持たない純粋な関数)。
// 条件を満たす候補から 1 つ選んで、最大でも 30 日に 1 回だけ出す。出している間(最長 7 日)は
// 同じカードを出し続け、「あとで」か習慣の追加で消える。同じ種類は 90 日あけて、しつこくしない

export type NudgeKind = 'steady' | 'morning' | 'night';

export interface Nudge {
  id: NudgeKind;
  /** カードの絵(絵文字) */
  emoji: string;
  title: string;
  body: string;
}

/** 端末に覚えておく状態 */
export interface NudgeState {
  /** いま出しているカードの種類と、出し始めた日 */
  id: NudgeKind;
  shownAt: string;
  /** 「あとで」か、習慣を足して閉じた */
  closed: boolean;
  /** 種類 → 最後に出した日 */
  history: Partial<Record<NudgeKind, string>>;
}

/** 次に出すまでの間隔(日) */
export const NUDGE_INTERVAL_DAYS = 30;
/** 出している間は、閉じなくてもこの日数で引っ込める */
export const NUDGE_VISIBLE_DAYS = 7;
/** 同じ種類をもう一度出すまでの間隔(日) */
export const NUDGE_SAME_KIND_DAYS = 90;
/** 直近この日数の実施率で「順調か」を見る */
const RECENT_DAYS = 14;
/** 習慣を足したばかりの間は促さない(日) */
const AFTER_ADD_DAYS = 30;
/** これ以上あるなら、足すのを勧めない */
const MAX_HABITS = 7;

/** 1 日の始まりは 4 時(timeStats と同じ)。4 時より前の記録は前日の夜とみなす */
const SLOT_OF = (hour: number): 'morning' | 'day' | 'night' => {
  const h = hour < 4 ? hour + 24 : hour;
  if (h < 11) return 'morning';
  if (h < 17) return 'day';
  return 'night';
};

const createdDate = (h: Habit) => {
  const d = new Date(h.created_at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 習慣が 1 日のどの時間帯のものか。実施時間(予定)があればそれ、無ければ最近の実施時刻の多数決
 * (記録 5 回以上)。わからなければ null
 */
export function habitSlot(ctx: AchievementContext, habit: Habit): 'morning' | 'day' | 'night' | null {
  if (habit.scheduled_time) return SLOT_OF(Number(habit.scheduled_time.split(':')[0]));
  const from = addDays(ctx.todayStr, -60);
  const counts = { morning: 0, day: 0, night: 0 };
  let n = 0;
  for (const t of ctx.timed) {
    if (t.habitId !== habit.id || t.date < from) continue;
    counts[SLOT_OF(t.hour)]++;
    n++;
  }
  if (n < 5) return null;
  const top = (Object.keys(counts) as (keyof typeof counts)[]).sort((a, b) => counts[b] - counts[a])[0];
  return counts[top] / n >= 0.6 ? top : null;
}

/**
 * 促しの候補(優先順)。active は記録画面に出ている習慣(アーカイブ・削除を除く)。
 * どれも「順調に続いている人」にだけ出す。うまくいっていないときに足すのを勧めない
 */
export function nudgeCandidates(ctx: AchievementContext, active: Habit[]): Nudge[] {
  if (active.length === 0 || active.length >= MAX_HABITS) return [];
  const data = active.map(h => ctx.habits.find(d => d.habit.id === h.id)).filter((d): d is NonNullable<typeof d> => !!d);
  if (data.length !== active.length) return [];

  // 一番新しい習慣から 30 日は、まだ定着の途中
  const youngest = Math.min(...active.map(h => daysBetween(createdDate(h), ctx.todayStr)));
  if (youngest < AFTER_ADD_DAYS) return [];

  // 直近 14 日(昨日まで)の実施率が 8 割以上
  const from = addDays(ctx.todayStr, -RECENT_DAYS);
  const to = addDays(ctx.todayStr, -1);
  let chances = 0;
  let done = 0;
  for (const d of data) {
    for (let ds = from; ds <= to; ds = addDays(ds, 1)) {
      chances++;
      if (d.set.has(ds)) done++;
    }
  }
  if (chances === 0 || done / chances < 0.8) return [];

  const out: Nudge[] = [];

  // 時間帯の空き: 2 つ以上の習慣の時間帯がわかっていて、朝か夜が無い
  const slots = active.map(h => habitSlot(ctx, h)).filter((s): s is NonNullable<typeof s> => s !== null);
  if (slots.length >= 2) {
    if (!slots.includes('morning')) {
      out.push({ id: 'morning', emoji: '🌅', title: '朝の習慣がありません', body: '朝に 1 つ足すと、1 日の始まりが整います。小さなことで大丈夫です' });
    }
    if (!slots.includes('night')) {
      out.push({ id: 'night', emoji: '🌙', title: '夜の習慣がありません', body: '寝る前に 1 つ足すと、1 日の締めくくりになります。小さなことで大丈夫です' });
    }
  }

  // 順調: 今ある習慣が全部 30 日以上続いている
  out.push(
    active.length === 1
      ? { id: 'steady', emoji: '🌱', title: `${youngest}日、順調に続いています`, body: '1 つ目が根付いてきました。2 つ目の習慣に挑戦してみませんか？' }
      : { id: 'steady', emoji: '🌱', title: `${active.length}つとも順調に続いています`, body: `いちばん新しい習慣でも ${youngest}日目。余裕があれば、もう 1 つ足してみませんか？` },
  );
  return out;
}

/**
 * 今日見せる促しと、覚えておく新しい状態。
 * - 出している途中(7 日以内、閉じていない)なら同じカード
 * - 前回出してから 30 日たっていなければ出さない
 * - 候補のうち、同じ種類を 90 日以内に出していないものを選ぶ
 */
export function pickNudge(candidates: Nudge[], state: NudgeState | null, todayStr: string): { nudge: Nudge | null; state: NudgeState | null } {
  if (state) {
    const since = daysBetween(state.shownAt, todayStr);
    if (!state.closed && since < NUDGE_VISIBLE_DAYS) {
      const same = candidates.find(c => c.id === state.id);
      // 条件を満たさなくなったら(習慣を足したなど)引っ込める
      return same ? { nudge: same, state } : { nudge: null, state: { ...state, closed: true } };
    }
    if (since < NUDGE_INTERVAL_DAYS) return { nudge: null, state };
  }
  const history = state?.history ?? {};
  const next = candidates.find(c => { const last = history[c.id]; return !last || daysBetween(last, todayStr) >= NUDGE_SAME_KIND_DAYS; });
  if (!next) return { nudge: null, state };
  return { nudge: next, state: { id: next.id, shownAt: todayStr, closed: false, history: { ...history, [next.id]: todayStr } } };
}

// --- 端末に保存 --------------------------------------------------------------------

const KEY = 'habitww-nudge';

export function readNudgeState(storage: Pick<Storage, 'getItem'> = localStorage): NudgeState | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as NudgeState;
    return s && typeof s.shownAt === 'string' && typeof s.id === 'string' ? { ...s, history: s.history ?? {} } : null;
  } catch {
    return null;
  }
}

export function writeNudgeState(state: NudgeState, storage: Pick<Storage, 'setItem'> = localStorage) {
  try { storage.setItem(KEY, JSON.stringify(state)); } catch { /* 容量不足などは無視 */ }
}
