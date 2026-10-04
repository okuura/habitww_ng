import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import CloseIcon from '@mui/icons-material/Close';
import BoltIcon from '@mui/icons-material/Bolt';
import { alpha } from '@mui/material/styles';
import type { Habit } from './supabase';

interface HabitTimeDialogProps {
  habit: Habit;
  onClose: () => void;
  /** time: "HH:MM" または null(実施時間を削除) */
  onSave: (time: string | null, notify: boolean) => Promise<void>;
}

/** 習慣メニュー「実施時間」: 時刻 + (iOS アプリ版のみ)通知オンオフ */
export default function HabitTimeDialog({ habit, onClose, onSave }: HabitTimeDialogProps) {
  const isNativeApp = !!window.HabitwwNative;
  const [time, setTime] = useState(habit.scheduled_time?.slice(0, 5) ?? '07:00');
  // 初めて設定するときは iOS 版なら通知オンを初期値に
  const [notify, setNotify] = useState(habit.scheduled_time ? !!habit.notify_enabled : isNativeApp);
  const [saving, setSaving] = useState(false);

  const save = async (value: string | null) => {
    setSaving(true);
    // Web 版では通知設定を変更しない(iOS で設定した値を保つ)
    const nextNotify = value === null ? false : isNativeApp ? notify : !!habit.notify_enabled;
    await onSave(value, nextNotify);
    setSaving(false);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pr: 6, fontWeight: 700 }}>
        実施時間
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 400 }}>
          {habit.name}
        </Typography>
        <IconButton
          aria-label="閉じる"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          fullWidth
          inputProps={{
            step: 300,
            sx: {
              fontSize: '1.6rem', fontWeight: 700, textAlign: 'center', py: 1.5,
              // iOS は時刻を内部要素で描画し、そのままだと上・左に寄る。flex で縦横とも中央に置く
              height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center',
            },
          }}
          sx={{
            mt: 1,
            '& input::-webkit-date-and-time-value': { textAlign: 'center' },
          }}
        />

        {isNativeApp ? (
          <FormControlLabel
            control={<Switch checked={notify} onChange={e => setNotify(e.target.checked)} />}
            label="この時間に通知する"
            sx={{ mt: 1.5, ml: 0 }}
          />
        ) : (
          <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
            iOSアプリ版では実施時間に通知を送信することができます。
          </Typography>
        )}

        <Box
          sx={{
            mt: 2, p: 1.25, borderRadius: 2, display: 'flex', gap: 1, alignItems: 'flex-start',
            bgcolor: alpha('#ffc400', 0.12),
          }}
        >
          <BoltIcon sx={{ color: '#ffb300', fontSize: '1.2rem', mt: '1px' }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            設定した実施時間から10分以内（またはそれより前）に習慣を完了させると、速攻で実施した⚡️マークが付きます。
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Button
          color="inherit"
          disabled={saving || !habit.scheduled_time}
          onClick={() => save(null)}
          sx={{ color: 'text.secondary' }}
        >
          実施時間を削除
        </Button>
        <Button variant="contained" disabled={saving || !time} onClick={() => save(time)} sx={{ fontWeight: 700 }}>
          決定
        </Button>
      </DialogActions>
    </Dialog>
  );
}
