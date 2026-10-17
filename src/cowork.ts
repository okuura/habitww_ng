import type { User } from '@supabase/supabase-js';
import { userDisplayName, type CoworkCheer, type CoworkGroup, type CoworkMember } from './supabase';
import { addDays, parse } from './achievements';

// Cowork Habits の計算(UI を持たない純粋な関数)。
// グループの各メンバーは自分の習慣を 1 つ登録していて、「みんなで達成した日」を数える

/** 画面用に組み立てたメンバー */
export interface CoworkMemberView {
  member: CoworkMember;
  habitName: string;
  color: string;
  /** 承認された日(承認待ちなら null) */
  approvedDate: string | null;
  /** 実施した日 */
  set: Set<string>;
  dateMap: Map<string, number>;
  onTime: Set<string>;
}

export interface CoworkGroupView {
  group: CoworkGroup;
  /** 承認済み(承認順) */
  members: CoworkMemberView[];
  /** 承認待ち(申請順) */
  pending: CoworkMemberView[];
  /** 自分の行(承認待ちのときもある) */
  mine: CoworkMember | null;
  isOwner: boolean;
  canApprove: boolean;
  /** 今日の応援(このグループ) */
  cheers: CoworkCheer[];
}

/** その人に今日届いている 👏(送り主の名前は同じグループのメンバーから引く。見つからなければ出さない) */
export function cheersFor(view: { members: { member: { user_id: string; display_name: string } }[]; cheers: CoworkCheer[] }, toUserId: string): { fromUserId: string; name: string }[] {
  const names = new Map(view.members.map(m => [m.member.user_id, m.member.display_name]));
  return view.cheers
    .filter(c => c.to_user_id === toUserId)
    .flatMap(c => { const name = names.get(c.from_user_id); return name ? [{ fromUserId: c.from_user_id, name }] : []; });
}

export interface CoworkDay {
  date: string;
  /** その日に達成した人数 */
  done: number;
  /** その日までに承認されていた人数 */
  eligible: number;
  /** 2 人以上いて、全員が達成した */
  all: boolean;
}

/** グループに載せる名前(表示名、なければメールの @ の前) */
export const displayNameOf = (user: User) => userDisplayName(user) || user.email?.split('@')[0] || 'ユーザー';

/** 招待リンク */
export const inviteUrlOf = (group: CoworkGroup) =>
  `${window.location.origin}${window.location.pathname}?cowork=${group.invite_token}`;

/** ISO 時刻を端末のローカル日付 "YYYY-MM-DD" に */
export const localDateOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** from〜to の各日について、何人中何人が達成したか */
export function coworkDays(
  members: { approvedDate: string | null; set: Set<string> }[],
  from: string,
  to: string,
): CoworkDay[] {
  const out: CoworkDay[] = [];
  if (from > to) return out;
  for (let ds = from; ds <= to; ds = addDays(ds, 1)) {
    let done = 0;
    let eligible = 0;
    for (const m of members) {
      if (m.approvedDate === null || m.approvedDate > ds) continue;
      eligible++;
      if (m.set.has(ds)) done++;
    }
    out.push({ date: ds, done, eligible, all: eligible >= 2 && done === eligible });
  }
  return out;
}

/** 「みんなで達成」の連続: 今日か昨日で終わる連続と、これまでの最長 */
export function coworkStreak(days: CoworkDay[], todayStr: string): { current: number; best: number } {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = d.all ? run + 1 : 0;
    if (run > best) best = run;
  }
  // 今日の分はまだ途中なので、今日が未達成でも昨日までの連続を「続いている」とみなす
  let current = 0;
  const last = days[days.length - 1];
  const startIdx = last && last.date === todayStr && !last.all ? days.length - 2 : days.length - 1;
  for (let i = startIdx; i >= 0 && days[i].all; i--) current++;
  return { current, best };
}

/** グリッドの始まりの日(weeks 週前の週の日曜) */
export function gridStart(todayStr: string, weeks: number): string {
  return addDays(todayStr, -parse(todayStr).getDay() - 7 * (weeks - 1));
}

/** 承認日の一番早い日(数え始め)。誰もいなければ今日 */
export function earliestApproved(members: { approvedDate: string | null }[], todayStr: string): string {
  const dates = members.map(m => m.approvedDate).filter((d): d is string => d !== null).sort();
  return dates[0] ?? todayStr;
}
