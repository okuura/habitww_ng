import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import type { User } from '@supabase/supabase-js';
import { supabase, userEmblem, type CoworkPreview, type Habit } from './supabase';
import CoworkHabitPicker, { NEW_HABIT } from './CoworkHabitPicker';
import { displayNameOf } from './cowork';

// 招待リンク/QR から参加する: グループの下見と、登録する自分の習慣を選ぶ

interface Props {
  token: string;
  preview: CoworkPreview;
  habits: Habit[];
  user: User;
  onCreateHabit: (name: string) => Promise<Habit | null>;
  onClose: () => void;
  /** 参加したあと(承認待ちか、作成者なら承認済み) */
  onJoined: (status: 'pending' | 'approved') => void;
  onError: (message: string) => void;
}

export default function CoworkJoinDialog({ token, preview, habits, user, onCreateHabit, onClose, onJoined, onError }: Props) {
  const [habitId, setHabitId] = useState(habits[0]?.id ?? NEW_HABIT);
  const [newName, setNewName] = useState(preview.owner_habit_name ?? '');
  const [saving, setSaving] = useState(false);
  const already = preview.my_status !== null;
  const canJoin = !already && (habitId !== NEW_HABIT || newName.trim().length > 0);

  const handleJoin = async () => {
    if (!canJoin) return;
    setSaving(true);
    let hid = habitId;
    if (hid === NEW_HABIT) {
      const created = await onCreateHabit(newName.trim());
      if (!created) { setSaving(false); onError('習慣を作れませんでした'); return; }
      hid = created.id;
    }
    const { data: memberId, error } = await supabase.rpc('cowork_join', { p_token: token, p_habit_id: hid, p_display_name: displayNameOf(user) });
    if (!error && memberId && userEmblem(user)) {
      // 名前の横のバッジも仲間に見せる(列が無ければ失敗するだけ)
      await supabase.from('cowork_members').update({ emblem: userEmblem(user) }).eq('id', memberId as string);
    }
    setSaving(false);
    if (error) {
      onError(error.code === '23505' ? 'すでにこのグループに参加しています' : '参加できませんでした。もう一度お試しください');
      return;
    }
    onJoined('pending');
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>グループに参加</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{preview.name}</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, lineHeight: 1.6 }}>
            {preview.owner_name ?? '誰か'}さんのグループ。
            {preview.members.length > 0 && (
              <>メンバー: {preview.members.map(m => `${m.display_name}(${m.habit_name})`).join('、')}</>
            )}
          </Typography>
        </Box>
        {already ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {preview.my_status === 'approved' ? 'すでに参加しています。' : '参加を申請済みです。承認をお待ちください。'}
          </Typography>
        ) : (
          <div>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>登録する自分の習慣</Typography>
            <CoworkHabitPicker
              habits={habits} value={habitId} onChange={setHabitId}
              newName={newName} onNewName={setNewName} suggestedName={preview.owner_habit_name ?? undefined}
            />
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1 }}>
              {preview.approval === 'owner' ? '作成者' : 'メンバー'}が承認するとグループが表示されます
            </Typography>
          </div>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} sx={{ borderRadius: 2 }}>{already ? '閉じる' : 'キャンセル'}</Button>
        {!already && (
          <Button
            variant="contained"
            onClick={handleJoin}
            disabled={!canJoin || saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            参加を申請
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
