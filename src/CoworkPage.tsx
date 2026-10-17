import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import AddIcon from '@mui/icons-material/Add';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import EditIcon from '@mui/icons-material/Edit';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import CheckIcon from '@mui/icons-material/Check';
import { QRCodeSVG } from 'qrcode.react';
import type { User } from '@supabase/supabase-js';
import { supabase, type CoworkCheer, type CoworkGroup, type CoworkMember, type Habit, type HabitCompletion } from './supabase';
import { inviteUrlOf, localDateOf, type CoworkGroupView, type CoworkMemberView } from './cowork';
import CoworkGroupCard from './CoworkGroupCard';
import CoworkCreateDialog from './CoworkCreateDialog';
import CoworkHabitPicker, { NEW_HABIT } from './CoworkHabitPicker';

// Cowork Habits: グループの一覧。作る・招待する・承認する・抜ける

interface Props {
  user: User;
  habits: Habit[];
  onCreateHabit: (name: string) => Promise<Habit | null>;
  onScanQR: () => void;
  onMessage: (message: string) => void;
  /** 参加などのあとに読み直すための合図(増えたら再取得) */
  reloadKey: number;
}

type MemberRow = CoworkMember & { habits: { name: string; color: string } | null };

const toLocalDateString = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function CoworkPage({ user, habits, onCreateHabit, onScanQR, onMessage, reloadKey }: Props) {
  const [groups, setGroups] = useState<CoworkGroup[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  /** 今日の応援。null はテーブルが無い(マイグレーション前)= 応援の機能を出さない */
  const [cheers, setCheers] = useState<CoworkCheer[] | null>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; view: CoworkGroupView } | null>(null);
  const [invite, setInvite] = useState<CoworkGroup | null>(null);
  const [copied, setCopied] = useState(false);
  const [rename, setRename] = useState<{ group: CoworkGroup; name: string } | null>(null);
  const [approvalEdit, setApprovalEdit] = useState<CoworkGroup | null>(null);
  const [changeHabit, setChangeHabit] = useState<{ view: CoworkGroupView; habitId: string; newName: string } | null>(null);
  const [removeMember, setRemoveMember] = useState<CoworkGroupView | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'leave' | 'delete' | 'withdraw'; view: CoworkGroupView } | null>(null);
  const [busy, setBusy] = useState(false);

  const todayStr = toLocalDateString(new Date());

  const fetchAll = useCallback(async () => {
    const { data: groupRows } = await supabase.from('cowork_groups').select('*').order('created_at', { ascending: true });
    const gs = (groupRows ?? []) as CoworkGroup[];
    if (gs.length === 0) {
      setGroups([]); setMembers([]); setCompletions([]); setCheers([]); setLoading(false);
      return;
    }
    const { data: memberRows } = await supabase
      .from('cowork_members')
      .select('*, habits(name, color)')
      .in('group_id', gs.map(g => g.id))
      .order('approved_at', { ascending: true, nullsFirst: false })
      .order('joined_at', { ascending: true });
    const ms = (memberRows ?? []) as MemberRow[];
    const approved = ms.filter(m => m.status === 'approved');
    let cs: HabitCompletion[] = [];
    if (approved.length > 0) {
      const from = approved.map(m => localDateOf(m.approved_at!)).sort()[0];
      const { data } = await supabase
        .from('habit_completions')
        .select('*')
        .in('habit_id', approved.map(m => m.habit_id))
        .gte('completed_date', from);
      cs = (data ?? []) as HabitCompletion[];
    }
    // 今日の応援(テーブルがまだ無ければ機能ごと隠す)
    const { data: cheerRows, error: cheerError } = await supabase
      .from('cowork_cheers')
      .select('*')
      .in('group_id', gs.map(g => g.id))
      .eq('cheer_date', todayStr);
    setGroups(gs); setMembers(ms); setCompletions(cs); setLoading(false);
    setCheers(cheerError ? null : (cheerRows ?? []) as CoworkCheer[]);
  }, [todayStr]);

  useEffect(() => { void Promise.resolve().then(fetchAll); }, [fetchAll, reloadKey]);

  // 仲間の記録・参加・承認を即時に反映
  useEffect(() => {
    const channel = supabase
      .channel('cowork-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_completions' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cowork_members' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cowork_groups' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cowork_cheers' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const views = useMemo<CoworkGroupView[]>(() => {
    const byHabit = new Map<string, HabitCompletion[]>();
    for (const c of completions) {
      const list = byHabit.get(c.habit_id);
      if (list) list.push(c); else byHabit.set(c.habit_id, [c]);
    }
    const toView = (m: MemberRow): CoworkMemberView => {
      const cs = byHabit.get(m.habit_id) ?? [];
      return {
        member: m,
        habitName: m.habits?.name ?? '(習慣)',
        color: m.habits?.color ?? '#9e9e9e',
        approvedDate: m.approved_at ? localDateOf(m.approved_at) : null,
        set: new Set(cs.map(c => c.completed_date)),
        dateMap: new Map(cs.map(c => [c.completed_date, c.intensity])),
        onTime: new Set(cs.filter(c => c.on_time).map(c => c.completed_date)),
      };
    };
    return groups.map(group => {
      const rows = members.filter(m => m.group_id === group.id);
      const mine = rows.find(m => m.user_id === user.id) ?? null;
      const isOwner = group.owner_id === user.id;
      const iAmApproved = mine?.status === 'approved';
      return {
        group,
        members: rows.filter(m => m.status === 'approved').map(toView),
        pending: rows.filter(m => m.status === 'pending').map(toView),
        mine,
        isOwner,
        canApprove: isOwner || (group.approval === 'anyone' && iAmApproved),
        cheers: (cheers ?? []).filter(c => c.group_id === group.id),
      };
    });
  }, [groups, members, completions, cheers, user.id]);

  // 自分宛の 👏 が増えたら知らせる(初回の読み込みは除く)
  const seenCheersRef = useRef<Set<string> | null>(null);
  const tempIdRef = useRef(0);
  useEffect(() => {
    if (cheers === null || loading) return;
    const mine = new Set(cheers.filter(c => c.to_user_id === user.id).map(c => c.id));
    const seen = seenCheersRef.current;
    seenCheersRef.current = mine;
    if (!seen) return;
    const fresh = cheers.filter(c => c.to_user_id === user.id && !seen.has(c.id));
    if (fresh.length === 0) return;
    const names = [...new Set(fresh.map(c => members.find(m => m.user_id === c.from_user_id)?.display_name).filter((n): n is string => !!n))];
    if (names.length > 0) onMessage(`${names.join('・')} さんから 👏`);
  }, [cheers, loading, members, user.id, onMessage]);

  // 応援を送る(もう一度で取り消し)。先に画面を変えて、失敗したら読み直す
  const toggleCheer = async (view: CoworkGroupView, toUserId: string) => {
    if (cheers === null) return;
    const existing = cheers.find(c => c.group_id === view.group.id && c.from_user_id === user.id && c.to_user_id === toUserId);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    if (existing) {
      setCheers(cs => (cs ?? []).filter(c => c.id !== existing.id));
      const { error } = await supabase.from('cowork_cheers').delete().eq('id', existing.id);
      if (error) { onMessage('応援を取り消せませんでした'); await fetchAll(); }
      return;
    }
    tempIdRef.current += 1;
    const temp: CoworkCheer = { id: `temp-${tempIdRef.current}`, group_id: view.group.id, from_user_id: user.id, to_user_id: toUserId, cheer_date: todayStr, created_at: '' };
    setCheers(cs => [...(cs ?? []), temp]);
    const { data, error } = await supabase
      .from('cowork_cheers')
      .insert({ group_id: view.group.id, from_user_id: user.id, to_user_id: toUserId, cheer_date: todayStr })
      .select('*')
      .single();
    if (error || !data) { onMessage('応援を送れませんでした'); await fetchAll(); return; }
    setCheers(cs => (cs ?? []).map(c => (c.id === temp.id ? (data as CoworkCheer) : c)));
  };

  const run = async (action: () => PromiseLike<{ error: unknown } | null | void>, done?: string, fail = '更新できませんでした') => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result && result.error) { onMessage(fail); return false; }
    if (done) onMessage(done);
    await fetchAll();
    return true;
  };

  const approve = (memberId: string) => run(() => supabase.rpc('cowork_approve', { p_member_id: memberId }), '承認しました');
  const reject = (memberId: string) => run(() => supabase.from('cowork_members').delete().eq('id', memberId));

  const copyInvite = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(inviteUrlOf(invite));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openMenu = (e: MouseEvent<HTMLElement>, view: CoworkGroupView) => setMenu({ anchor: e.currentTarget, view });
  const closeMenu = () => setMenu(null);

  const submitChangeHabit = async () => {
    if (!changeHabit || !changeHabit.view.mine) return;
    let hid = changeHabit.habitId;
    if (hid === NEW_HABIT) {
      const created = await onCreateHabit(changeHabit.newName.trim());
      if (!created) { onMessage('習慣を作れませんでした'); return; }
      hid = created.id;
    }
    const memberId = changeHabit.view.mine.id;
    setChangeHabit(null);
    await run(() => supabase.from('cowork_members').update({ habit_id: hid }).eq('id', memberId), '登録する習慣を変えました');
  };

  const submitConfirm = async () => {
    if (!confirm) return;
    const { kind, view } = confirm;
    setConfirm(null);
    if (kind === 'delete') {
      await run(() => supabase.from('cowork_groups').delete().eq('id', view.group.id), 'グループを削除しました');
    } else if (view.mine) {
      const id = view.mine.id;
      await run(() => supabase.from('cowork_members').delete().eq('id', id), kind === 'leave' ? 'グループを抜けました' : '申請を取り下げました');
    }
  };

  const approvedViews = views.filter(v => v.mine?.status === 'approved' || v.isOwner);
  const pendingViews = views.filter(v => v.mine?.status === 'pending' && !v.isOwner);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500, flex: 1 }}>
          仲間と続けるグループ
        </Typography>
        <Button variant="outlined" size="small" startIcon={<QrCodeScannerIcon />} onClick={onScanQR} sx={{ borderRadius: 2, textTransform: 'none', flexShrink: 0 }}>
          参加
        </Button>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ borderRadius: 2, textTransform: 'none', flexShrink: 0 }}>
          作る
        </Button>
      </Box>

      {loading ? (
        <Stack spacing={1.5}>
          {[1, 2].map(i => <Skeleton key={i} variant="rounded" height={200} sx={{ borderRadius: 2 }} />)}
        </Stack>
      ) : views.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 4, bgcolor: 'background.paper', borderRadius: 3, border: '2px dashed', borderColor: 'divider' }}>
          <Diversity3Icon sx={{ fontSize: 56, color: 'primary.light', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1 }}>
            仲間と一緒に続けよう
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
            グループを作って仲間を招待すると、それぞれが自分の習慣を登録して、お互いの「今日やったか」と、みんなで達成した日が見えます
          </Typography>
          <Stack direction="row" spacing={1} justifyContent="center">
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ textTransform: 'none', borderRadius: 2 }}>
              グループを作る
            </Button>
            <Button variant="outlined" startIcon={<QrCodeScannerIcon />} onClick={onScanQR} sx={{ textTransform: 'none', borderRadius: 2 }}>
              QRで参加
            </Button>
          </Stack>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {approvedViews.map(v => (
            <CoworkGroupCard key={v.group.id} view={v} todayStr={todayStr} onApprove={approve} onReject={reject} onMenu={openMenu} onCheer={cheers === null ? undefined : toUserId => toggleCheer(v, toUserId)} />
          ))}
          {pendingViews.map(v => (
            <Card key={v.group.id} elevation={0} sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, '&:last-child': { pb: 1.25 } }}>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                  <strong>{v.group.name}</strong>
                  <Box component="span" sx={{ color: 'text.secondary' }}> — 承認待ち</Box>
                </Typography>
                <Button size="small" onClick={() => setConfirm({ kind: 'withdraw', view: v })} sx={{ textTransform: 'none', color: 'text.secondary' }}>
                  取り下げる
                </Button>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* グループのメニュー */}
      <Menu
        anchorEl={menu?.anchor ?? null}
        open={!!menu}
        onClose={closeMenu}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 220 } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {menu && [
          <MenuItem key="invite" onClick={() => { setInvite(menu.view.group); closeMenu(); }} sx={{ gap: 1.5 }}>
            <QrCode2Icon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="body2">仲間を招待(QR・リンク)</Typography>
          </MenuItem>,
          <MenuItem key="habit" onClick={() => { setChangeHabit({ view: menu.view, habitId: menu.view.mine?.habit_id ?? habits[0]?.id ?? NEW_HABIT, newName: '' }); closeMenu(); }} sx={{ gap: 1.5 }}>
            <SwapHorizIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="body2">登録する自分の習慣を変える</Typography>
          </MenuItem>,
          ...(menu.view.isOwner ? [
            <Divider key="d1" />,
            <MenuItem key="rename" onClick={() => { setRename({ group: menu.view.group, name: menu.view.group.name }); closeMenu(); }} sx={{ gap: 1.5 }}>
              <EditIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2">グループ名を変える</Typography>
            </MenuItem>,
            <MenuItem key="approval" onClick={() => { setApprovalEdit(menu.view.group); closeMenu(); }} sx={{ gap: 1.5 }}>
              <HowToRegIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Box>
                <Typography variant="body2">参加を承認できる人</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: -0.25 }}>
                  {menu.view.group.approval === 'owner' ? '作成者だけ' : 'メンバー全員'}
                </Typography>
              </Box>
            </MenuItem>,
            <MenuItem key="remove" onClick={() => { setRemoveMember(menu.view); closeMenu(); }} sx={{ gap: 1.5 }}>
              <PersonRemoveIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2">メンバーを外す</Typography>
            </MenuItem>,
            <Divider key="d2" />,
            <MenuItem key="delete" onClick={() => { setConfirm({ kind: 'delete', view: menu.view }); closeMenu(); }} sx={{ gap: 1.5, color: 'error.main' }}>
              <DeleteOutlineIcon fontSize="small" />
              <Typography variant="body2" color="error">グループを削除</Typography>
            </MenuItem>,
          ] : [
            <Divider key="d1" />,
            <MenuItem key="leave" onClick={() => { setConfirm({ kind: 'leave', view: menu.view }); closeMenu(); }} sx={{ gap: 1.5, color: 'error.main' }}>
              <LogoutIcon fontSize="small" />
              <Typography variant="body2" color="error">グループを抜ける</Typography>
            </MenuItem>,
          ]),
        ]}
      </Menu>

      {/* 招待 QR */}
      <Dialog open={!!invite} onClose={() => setInvite(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>仲間を招待</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', lineHeight: 1.6 }}>
            「{invite?.name}」のQRコードを読み取るか、リンクを開くと参加を申請できます
          </Typography>
          {invite && (
            <Box sx={{ bgcolor: '#fff', p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <QRCodeSVG value={inviteUrlOf(invite)} size={200} bgColor="#ffffff" fgColor="#111111" level="M" />
            </Box>
          )}
          <Button
            variant="outlined" size="small" onClick={copyInvite}
            startIcon={copied ? <CheckIcon /> : <LinkIcon />}
            sx={{ borderRadius: 2, textTransform: 'none', minWidth: 160, borderColor: copied ? 'success.main' : undefined, color: copied ? 'success.main' : undefined }}
          >
            {copied ? 'コピーしました！' : 'リンクをコピー'}
          </Button>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setInvite(null)} sx={{ borderRadius: 2 }}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 名前を変える */}
      <Dialog open={!!rename} onClose={() => setRename(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>グループ名を変える</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth size="small" value={rename?.name ?? ''} onChange={e => setRename(r => r && { ...r, name: e.target.value })} inputProps={{ maxLength: 30 }} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setRename(null)} sx={{ borderRadius: 2 }}>キャンセル</Button>
          <Button
            variant="contained" disabled={!rename?.name.trim() || busy} sx={{ borderRadius: 2, fontWeight: 700 }}
            onClick={async () => {
              if (!rename) return;
              const { group, name } = rename;
              setRename(null);
              await run(() => supabase.from('cowork_groups').update({ name: name.trim() }).eq('id', group.id));
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 承認できる人 */}
      <Dialog open={!!approvalEdit} onClose={() => setApprovalEdit(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>参加を承認できる人</DialogTitle>
        <DialogContent>
          <RadioGroup
            value={approvalEdit?.approval ?? 'owner'}
            onChange={async e => {
              if (!approvalEdit) return;
              const id = approvalEdit.id;
              const approval = e.target.value as 'owner' | 'anyone';
              setApprovalEdit(null);
              await run(() => supabase.from('cowork_groups').update({ approval }).eq('id', id), approval === 'owner' ? '作成者だけが承認できます' : 'メンバー全員が承認できます');
            }}
          >
            <FormControlLabel value="owner" control={<Radio size="small" />} label={<Typography variant="body2">作成者(あなた)だけ</Typography>} sx={{ mx: 0 }} />
            <FormControlLabel value="anyone" control={<Radio size="small" />} label={<Typography variant="body2">メンバー全員</Typography>} sx={{ mx: 0 }} />
          </RadioGroup>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApprovalEdit(null)} sx={{ borderRadius: 2 }}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 登録する自分の習慣を変える */}
      <Dialog open={!!changeHabit} onClose={() => setChangeHabit(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>登録する自分の習慣</DialogTitle>
        <DialogContent>
          {changeHabit && (
            <CoworkHabitPicker
              habits={habits} value={changeHabit.habitId} onChange={v => setChangeHabit(c => c && { ...c, habitId: v })}
              newName={changeHabit.newName} onNewName={v => setChangeHabit(c => c && { ...c, newName: v })}
            />
          )}
          <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1 }}>
            変えると、この習慣の記録で「今日やったか」と「みんなで達成」を数えます
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setChangeHabit(null)} sx={{ borderRadius: 2 }}>キャンセル</Button>
          <Button
            variant="contained" onClick={submitChangeHabit} sx={{ borderRadius: 2, fontWeight: 700 }}
            disabled={busy || !changeHabit || (changeHabit.habitId === NEW_HABIT && !changeHabit.newName.trim())}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* メンバーを外す */}
      <Dialog open={!!removeMember} onClose={() => setRemoveMember(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>メンバーを外す</DialogTitle>
        <DialogContent>
          {removeMember && [...removeMember.members, ...removeMember.pending].filter(m => m.member.user_id !== user.id).map(m => (
            <Box key={m.member.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.color }} />
              <Typography variant="body2" sx={{ flex: 1 }}>{m.member.display_name}<Box component="span" sx={{ color: 'text.secondary' }}>({m.habitName}{m.member.status === 'pending' ? '・承認待ち' : ''})</Box></Typography>
              <IconButton
                size="small" aria-label="外す" disabled={busy}
                onClick={async () => {
                  const id = m.member.id;
                  const ok = await run(() => supabase.from('cowork_members').delete().eq('id', id), `${m.member.display_name}を外しました`);
                  if (ok) setRemoveMember(null);
                }}
                sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
              >
                <PersonRemoveIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          {removeMember && [...removeMember.members, ...removeMember.pending].filter(m => m.member.user_id !== user.id).length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>まだ他のメンバーがいません</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemoveMember(null)} sx={{ borderRadius: 2 }}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 抜ける / 削除 / 取り下げ の確認 */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {confirm?.kind === 'delete' ? 'グループを削除' : confirm?.kind === 'leave' ? 'グループを抜ける' : '申請を取り下げる'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            {confirm?.kind === 'delete'
              ? `「${confirm.view.group.name}」を削除すると、メンバー全員から見えなくなります。各自の習慣と記録は残ります。`
              : confirm?.kind === 'leave'
                ? `「${confirm.view.group.name}」を抜けますか？自分の習慣と記録は残ります。`
                : `「${confirm?.view.group.name}」への参加申請を取り下げますか？`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setConfirm(null)} sx={{ borderRadius: 2 }}>キャンセル</Button>
          <Button variant="contained" color={confirm?.kind === 'withdraw' ? 'primary' : 'error'} onClick={submitConfirm} disabled={busy} sx={{ borderRadius: 2, fontWeight: 700 }}>
            {confirm?.kind === 'delete' ? '削除する' : confirm?.kind === 'leave' ? '抜ける' : '取り下げる'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* グループを作る */}
      {createOpen && (
        <CoworkCreateDialog
          open
          onClose={() => setCreateOpen(false)}
          habits={habits}
          user={user}
          onCreateHabit={onCreateHabit}
          onError={onMessage}
          onCreated={async group => {
            setCreateOpen(false);
            await fetchAll();
            setInvite(group);
          }}
        />
      )}
    </Container>
  );
}
