import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import type { Habit, HabitCompletion } from './supabase';

// アーカイブした習慣の一覧(記録画面の最下部のリンクから)。「戻す」で記録画面に戻し、「削除」は既存の確認へ

interface Props {
  open: boolean;
  onClose: () => void;
  habits: Habit[];
  completions: HabitCompletion[];
  onRestore: (habitId: string) => void;
  onDelete: (habitId: string) => void;
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export default function ArchivedHabitsDialog({ open, onClose, habits, completions, onRestore, onDelete }: Props) {
  const counts = new Map<string, number>();
  for (const c of completions) counts.set(c.habit_id, (counts.get(c.habit_id) ?? 0) + 1);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>アーカイブした習慣</DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        {habits.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>アーカイブした習慣はありません</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {habits.map((h, i) => (
              <Box
                key={h.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1.25, borderTop: i === 0 ? 'none' : '1px solid', borderColor: 'divider' }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: h.color, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }} noWrap>{h.name}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.3 }}>
                    計 {counts.get(h.id) ?? 0}日
                  </Typography>
                  {h.archived_at && (
                    <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', lineHeight: 1.3 }}>
                      {fmtDate(h.archived_at)} にアーカイブ
                    </Typography>
                  )}
                </Box>
                <Button size="small" variant="outlined" onClick={() => onRestore(h.id)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, minWidth: 0, flexShrink: 0 }}>
                  戻す
                </Button>
                <Button size="small" onClick={() => onDelete(h.id)} sx={{ borderRadius: 2, textTransform: 'none', minWidth: 0, color: 'error.main', flexShrink: 0 }}>
                  削除
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
