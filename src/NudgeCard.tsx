import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import type { Nudge } from './nudges';

// 記録画面の一覧の下に出す「新しい習慣を足してみませんか」のカード。
// 習慣カードと同じ角丸で、点線の枠(まだ無いカードの置き場所に見えるように)

interface Props {
  nudge: Nudge;
  paperBg: string;
  onAdd: () => void;
  onLater: () => void;
}

export default function NudgeCard({ nudge, paperBg, onAdd, onLater }: Props) {
  return (
    <Box
      role="region"
      aria-label="新しい習慣の提案"
      sx={{
        mt: 2, p: 2, borderRadius: '24px', bgcolor: paperBg,
        border: '1.5px dashed', borderColor: 'divider',
        display: 'flex', alignItems: 'flex-start', gap: 1.5,
      }}
    >
      <Box aria-hidden sx={{ fontSize: 28, lineHeight: 1, mt: 0.25 }}>{nudge.emoji}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3 }}>{nudge.title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, lineHeight: 1.5 }}>{nudge.body}</Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center' }}>
          <Button size="small" variant="contained" disableElevation startIcon={<AddIcon />} onClick={onAdd} sx={{ borderRadius: 2, fontWeight: 700 }}>
            追加する
          </Button>
          <Button size="small" color="inherit" onClick={onLater} sx={{ borderRadius: 2, color: 'text.secondary' }}>
            あとで
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
