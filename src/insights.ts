import { addDays, daysBetween, parse, type AchievementContext } from './achievements';
import { rarityOf } from './habitStats';
import { clock, habitTimeProfiles } from './timeStats';

// データページの「気づき」: 記録から計算した、本人もまだ気づいていないかもしれない豆知識。
// 条件を満たす候補だけを集め、日付を種にして選ぶ(同じ日は同じカード)

/** 文と、強調する部分(em) */
export type InsightPart = string | { em: string };

export interface Insight {
  id: string;
  /** カードの絵(InsightCards 側で絵に変える) */
  kind: 'weekday' | 'break' | 'time' | 'schedule' | 'pair' | 'forecast' | 'memory' | 'record' | 'activity';
  parts: InsightPart[];
  /** 選ばれやすさ(面白さ) */
  weight: number;
  color?: string;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const pct = (r: number) => `${Math.round(r * 100)}%`;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const md = (ds: string) => { const d = parse(ds); return `${d.getMonth() + 1}月${d.getDate()}日`; };

/** 習慣が数えられる範囲(作った日〜昨日) */
const span = (ctx: AchievementContext, created: string) => {
  const yesterday = addDays(ctx.todayStr, -1);
  return { from: created, to: yesterday, days: daysBetween(created, yesterday) + 1 };
};

const createdOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// --- 候補 ------------------------------------------------------------------------

/** 曜日ごとの実施率: よく続く曜日と、抜けやすい曜日 */
function weekday(ctx: AchievementContext): Insight[] {
  const chances = Array(7).fill(0);
  const done = Array(7).fill(0);
  for (const h of ctx.habits) {
    const { from, to, days } = span(ctx, createdOf(h.habit.created_at));
    if (days <= 0) continue;
    for (let ds = from; ds <= to; ds = addDays(ds, 1)) {
      const w = parse(ds).getDay();
      chances[w]++;
      if (h.set.has(ds)) done[w]++;
    }
  }
  if (chances.some(c => c < 2) || chances.reduce((a, b) => a + b, 0) < 14) return [];
  const rates = chances.map((c, i) => done[i] / c);
  const hi = rates.indexOf(Math.max(...rates));
  const lo = rates.indexOf(Math.min(...rates));
  if (rates[hi] - rates[lo] < 0.1) return [];
  return [{
    id: 'weekday', kind: 'weekday', weight: 3,
    parts: ['一番よく続くのは', { em: `${WEEKDAYS[hi]}曜日` }, `(${pct(rates[hi])})。抜けやすいのは`, { em: `${WEEKDAYS[lo]}曜日` }, `(${pct(rates[lo])})`],
  }];
}

/** 連続が途切れやすい曜日 */
function breaks(ctx: AchievementContext): Insight[] {
  const counts = Array(7).fill(0);
  let total = 0;
  for (const h of ctx.habits) {
    for (const r of h.runs) {
      const brokeOn = addDays(r.end, 1);
      if (r.len < 2 || brokeOn >= ctx.todayStr) continue; // 今日はまだ途切れていない
      counts[parse(brokeOn).getDay()]++;
      total++;
    }
  }
  if (total < 5) return [];
  const top = counts.indexOf(Math.max(...counts));
  const share = counts[top] / total;
  if (share < 0.25) return [];
  return [{
    id: 'break', kind: 'break', weight: 3,
    parts: ['連続が途切れた日の', { em: pct(share) }, 'は', { em: `${WEEKDAYS[top]}曜日` }, `。${WEEKDAYS[top]}曜日は少しだけ意識してみよう`],
  }];
}

/** 平均の実施時刻と、その変化 */
function timeShift(ctx: AchievementContext): Insight[] {
  const out: Insight[] = [];
  // 曜日の差をならした傾向(データの「曜日ごとの実施時刻」と同じ値)
  const profiles = habitTimeProfiles(ctx, 30);
  for (const p of profiles) {
    const h = p.habit;
    if (p.trend && Math.abs(p.trend.diff) >= 10 && p.mean !== null) {
      const diff = p.trend.diff;
      out.push({
        id: `time-${h.id}`, kind: 'time', weight: 3, color: h.color,
        parts: [`${h.name}の最近30日の平均実施時刻は`, { em: clock(p.mean) }, '。前の30日より', { em: `${Math.abs(diff)}分${diff < 0 ? '早く' : '遅く'}` }, 'なりました'],
      });
      continue;
    }
    const all = ctx.timed.filter(t => t.habitId === h.id).map(t => (t.hour < 4 ? t.hour + 24 : t.hour) * 60 + t.minute);
    if (all.length >= 10) {
      out.push({
        id: `time-${h.id}`, kind: 'time', weight: 1, color: h.color,
        parts: [`${h.name}をするのは、たいてい`, { em: `${clock(avg(all) % 1440)}ごろ` }],
      });
    }
  }
  return out;
}

/** 実施時間(予定)との差 */
function schedule(ctx: AchievementContext): Insight[] {
  const out: Insight[] = [];
  for (const h of ctx.habits) {
    const st = h.habit.scheduled_time;
    if (!st) continue;
    const [sh, sm] = st.split(':').map(Number);
    const planned = sh * 60 + sm;
    // 3 時間以上ずれた日は、予定とは関係なく実施した日として除く
    const diffs = ctx.timed
      .filter(t => t.habitId === h.habit.id)
      .map(t => t.hour * 60 + t.minute - planned)
      .filter(d => Math.abs(d) <= 180);
    if (diffs.length < 5) continue;
    const d = Math.round(avg(diffs));
    out.push({
      id: `schedule-${h.habit.id}`, kind: 'schedule', weight: 2, color: h.habit.color,
      parts: Math.abs(d) < 3
        ? [`${h.habit.name}は、予定の時刻`, { em: 'ほぼぴったり' }, 'に実施しています']
        : [`${h.habit.name}は、予定の時刻より平均`, { em: `${Math.abs(d)}分${d < 0 ? '早く' : '遅く'}` }, '実施しています'],
    });
  }
  return out;
}

/** 習慣どうしの関係: A をした日は B もしている */
function pair(ctx: AchievementContext): Insight[] {
  let best: { a: string; b: string; p: number; color: string } | null = null;
  for (const a of ctx.habits) {
    for (const b of ctx.habits) {
      if (a === b || a.dates.length < 14 || b.dates.length < 14) continue;
      const from = [createdOf(a.habit.created_at), createdOf(b.habit.created_at)].sort()[1];
      const to = addDays(ctx.todayStr, -1);
      const days = daysBetween(from, to) + 1;
      if (days < 14) continue;
      const aDays = a.dates.filter(d => d >= from && d <= to);
      if (aDays.length < 10) continue;
      const both = aDays.filter(d => b.set.has(d)).length;
      const pB = b.dates.filter(d => d >= from && d <= to).length / days;
      const p = both / aDays.length;
      // B をいつもやっているだけ(関係が薄い)なら出さない
      if (p >= 0.7 && p - pB >= 0.1 && (!best || p > best.p)) best = { a: a.habit.name, b: b.habit.name, p, color: b.habit.color };
    }
  }
  return best
    ? [{ id: 'pair', kind: 'pair', weight: 4, color: best.color, parts: [`${best.a}をした日は`, { em: pct(best.p) }, 'の確率で', { em: best.b }, 'もしています'] }]
    : [];
}

/** 今のペースでのカードランク到達日 */
function forecast(ctx: AchievementContext): Insight[] {
  const out: Insight[] = [];
  const from = addDays(ctx.todayStr, -28);
  for (const h of ctx.habits) {
    const r = rarityOf(h.dates.length);
    if (!r.next || r.daysToNext === null || r.daysToNext <= 3) continue; // 近いものは「もうすぐ取れる」に出る
    const pace = h.dates.filter(d => d > from).length / 28;
    if (pace < 0.2) continue;
    const need = Math.ceil(r.daysToNext / pace);
    if (need > 180) continue;
    out.push({
      id: `forecast-${h.habit.id}`, kind: 'forecast', weight: 3, color: h.habit.color,
      parts: [`このペースだと、${h.habit.name}は`, { em: md(addDays(ctx.todayStr, need)) }, `ごろ${r.next.label}カードになります`],
    });
  }
  return out;
}

/** 1 年前・半年前の今日 */
function memory(ctx: AchievementContext): Insight[] {
  const d = parse(ctx.todayStr);
  for (const [label, back] of [['1年前', 12], ['半年前', 6]] as const) {
    const past = new Date(d.getFullYear(), d.getMonth() - back, d.getDate());
    const ds = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
    const names = ctx.habits.filter(h => h.set.has(ds)).map(h => h.habit.name);
    if (names.length > 0) {
      return [{ id: 'memory', kind: 'memory', weight: 4, parts: [`${label}の今日も、あなたは`, { em: names.slice(0, 2).join('と') }, 'をしていました'] }];
    }
  }
  return [];
}

/** 月ごとの実施回数: 自己ベストの月を超えそうか */
function monthRecord(ctx: AchievementContext): Insight[] {
  const byMonth = new Map<string, number>();
  for (const ds of ctx.allCompletionDates) byMonth.set(ds.slice(0, 7), (byMonth.get(ds.slice(0, 7)) ?? 0) + 1);
  const thisMonth = ctx.todayStr.slice(0, 7);
  const now = byMonth.get(thisMonth) ?? 0;
  byMonth.delete(thisMonth);
  const bestPast = Math.max(0, ...byMonth.values());
  if (bestPast < 10) return [];
  const today = parse(ctx.todayStr);
  const elapsed = today.getDate();
  const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  if (elapsed < 5) return [];
  if (now > bestPast) {
    return [{ id: 'record', kind: 'record', weight: 5, parts: ['今月はもう', { em: `${now}回` }, `。これまでで一番多い月です(前の最高 ${bestPast}回)`] }];
  }
  const projected = Math.round((now / elapsed) * monthDays);
  if (projected > bestPast) {
    return [{ id: 'record', kind: 'record', weight: 4, parts: ['今月は、このままいくと', { em: '自己ベストの月' }, `を更新するペースです(最高 ${bestPast}回)`] }];
  }
  return [];
}

/** 始めてから、何割の日に何かしら実施しているか */
function activity(ctx: AchievementContext): Insight[] {
  const first = ctx.allCompletionDates[0];
  if (!first) return [];
  const days = daysBetween(first, ctx.todayStr) + 1;
  if (days < 14) return [];
  const active = new Set(ctx.allCompletionDates).size;
  return [{
    id: 'activity', kind: 'activity', weight: 1,
    parts: ['最初の記録から', { em: `${days}日` }, '。そのうち', { em: pct(active / days) }, 'の日に、何かしら積み上げています'],
  }];
}

// --- 選ぶ ------------------------------------------------------------------------

/** 文字列から 0..1 の決まった乱数 */
function seeded(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

export function allInsights(ctx: AchievementContext): Insight[] {
  return [weekday, breaks, timeShift, schedule, pair, forecast, memory, monthRecord, activity].flatMap(f => f(ctx));
}

/** 今日見せる気づき(同じ日は同じ並び。同じ種類は 2 枚まで) */
export function pickInsights(ctx: AchievementContext, limit = 5): Insight[] {
  const ranked = allInsights(ctx)
    .map(i => ({ i, score: i.weight * (0.5 + seeded(ctx.todayStr + i.id)) }))
    .sort((a, b) => b.score - a.score);
  const perKind = new Map<string, number>();
  const out: Insight[] = [];
  for (const { i } of ranked) {
    const n = perKind.get(i.kind) ?? 0;
    if (n >= 2) continue;
    perKind.set(i.kind, n + 1);
    out.push(i);
    if (out.length >= limit) break;
  }
  return out;
}
