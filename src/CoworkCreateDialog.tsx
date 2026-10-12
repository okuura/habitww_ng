import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import type { User } from '@supabase/supabase-js';
import { supabase, type CoworkGroup, type Habit } from './supabase';
import CoworkHabitPicker, { NEW_HABIT } from './CoworkHabitPicker';
import { displayNameOf } from './cowork';

// グループを作る: 名前、登録する自分の習慣、承認できる人

interface Props {
  open: boolean;
  onClose: () => void;
  habits: Habit[];
  user: User;
  /** 新しい習慣を作って返す(失敗なら null) */
  onCreateHabit: (name: string) => Promise<Habit | null>;
  onCreated: (group: CoworkGroup) => void;
  onError: (message: string) => void;
}

export default function CoworkCreateDialog({ open, onClose, habits, user, onCreateHabit, onCreated, onError }: Props) {
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [habitId, setHabitId] = useState(habits[0]?.id ?? NEW_HABIT);
  const [newName, setNewName] = useState('');
  const [approval, setApproval] = useState<'owner' | 'anyone'>('owner');
  const [saving, setSaving] = useState(false);

  // グループ名は、名前を触っていなければ選んだ習慣の名前にする
  const selectedHabit = habits.find(h => h.id === habitId);
  const effectiveName = nameTouched ? name : (habitId === NEW_HABIT ? newName : selectedHabit?.name ?? '');
  const canSave = effectiveName.trim().length > 0 && (habitId !== NEW_HABIT || newName.trim().length > 0);

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    let hid = habitId;
    if (hid === NEW_HABIT) {
      const created = await onCreateHabit(newName.trim());
      if (!created) { setSaving(false); onError('習慣を作れませんでした'); return; }
      hid = created.id;
    }
    const { data: group, error } = await supabase
      .from('cowork_groups')
      .insert({ name: effectiveName.trim(), approval })
      .select()
      .single();
    if (error || !group) { setSaving(false); onError('グループを作れませんでした'); return; }
    const { error: joinError } = await supabase.rpc('cowork_join', {
      p_token: (group as CoworkGroup).invite_token, p_habit_id: hid, p_display_name: displayNameOf(user),
    });
    setSaving(false);
    if (joinError) { onError('グループに習慣を登録できませんでした'); return; }
    onCreated(group as CoworkGroup);
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700 }}>グループを作る</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
          仲間はそれぞれ自分の習慣を 1 つ登録します。お互いの「今日やったか」と、みんなで達成した日が見えます。
        </Typography>
        <div>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>登録する自分の習慣</Typography>
          <CoworkHabitPicker habits={habits} value={habitId} onChange={setHabitId} newName={newName} onNewName={setNewName} />
        </div>
        <TextField
          size="small"
          label="グループ名"
          value={effectiveName}
          onChange={e => { setNameTouched(true); setName(e.target.value); }}
          inputProps={{ maxLength: 30 }}
        />
        <div>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>参加を承認できる人</Typography>
          <RadioGroup value={approval} onChange={e => setApproval(e.target.value as 'owner' | 'anyone')}>
            <FormControlLabel value="owner" control={<Radio size="small" />} label={<Typography variant="body2">作成者(あなた)だけ</Typography>} sx={{ mx: 0 }} />
            <FormControlLabel value="anyone" control={<Radio size="small" />} label={<Typography variant="body2">メンバー全員</Typography>} sx={{ mx: 0 }} />
          </RadioGroup>
        </div>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={saving} sx={{ borderRadius: 2 }}>キャンセル</Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!canSave || saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ borderRadius: 2, fontWeight: 700 }}
        >
          作る
        </Button>
      </DialogActions>
    </Dialog>
  );
}
