import { useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import { alpha, darken } from '@mui/material/styles';

// 習慣の追加: 習慣カードと同じ形のカードに、名前・目標・カラーを書き込む。
// 作ったカードは一覧に裏面の姿で現れ、くるっと表(草グラフ)に返る(App 側)

interface AddHabitDialogProps {
  open: boolean;
  onClose: () => void;
  /** カードの地の色(ライト/ダークで変わる) */
  paperBg: string;
  colors: string[];
  name: string;
  onNameChange: (v: string) => void;
  /** 目標(任意)。カード裏面の「理想の姿」になる */
  ideal: string;
  onIdealChange: (v: string) => void;
  color: string;
  onColorChange: (v: string) => void;
  saving: boolean;
  onSubmit: () => void;
}

export default function AddHabitDialog({
  open, onClose, paperBg, colors, name, onNameChange, ideal, onIdealChange, color, onColorChange, saving, onSubmit,
}: AddHabitDialogProps) {
  // 作ったあとすぐ裏面を見せるので、裏面のコードを先に読み込んでおく
  useEffect(() => {
    if (open) import('./HabitCardBack');
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth maxWidth="xs"
      PaperProps={{ sx: { bgcolor: 'transparent', backgroundImage: 'none', boxShadow: 'none', overflow: 'visible', m: 2, width: 'calc(100% - 32px)' } }}
    >
      <Box
        sx={{
          borderRadius: '24px',
          bgcolor: paperBg,
          border: '1px solid',
          borderColor: alpha(color, 0.55),
          boxShadow: `0 0 0 3px ${alpha(color, 0.12)}, 0 18px 50px rgba(0,0,0,0.45)`,
          transition: 'border-color 200ms, box-shadow 200ms',
          px: 2.25, pt: 1.75, pb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0, transition: 'background-color 200ms' }} />
          <InputBase
            autoFocus
            fullWidth
            placeholder="習慣(例: 毎日30分読書)"
            value={name}
            onChange={e => onNameChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
            inputProps={{ maxLength: 40, 'aria-label': '習慣', autoComplete: 'off' }}
            // 16px 以上(iOS がフォーカス時に拡大しないように)
            sx={{ fontWeight: 800, fontSize: '1.1rem', '& input::placeholder': { fontWeight: 600, fontSize: '1rem' } }}
          />
        </Box>

        <Typography sx={{ mt: 1.5, fontSize: '0.62rem', fontWeight: 700, color: 'text.secondary' }}>目標(任意)</Typography>
        <InputBase
          fullWidth
          placeholder="例: 月に4冊読む人"
          value={ideal}
          onChange={e => onIdealChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
          inputProps={{ maxLength: 80, 'aria-label': '目標', autoComplete: 'off' }}
          sx={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid', borderColor: 'divider', pb: 0.25 }}
        />

        <Typography sx={{ mt: 1.75, mb: 1, fontSize: '0.62rem', fontWeight: 700, color: 'text.secondary' }}>カラー</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          {colors.map(c => (
            <Box
              key={c}
              role="button"
              aria-label={`カラー ${c}`}
              aria-pressed={c === color}
              onClick={() => onColorChange(c)}
              sx={{
                width: 30, height: 30, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                boxShadow: c === color ? `0 0 0 2px ${paperBg}, 0 0 0 4px ${c}` : 'none',
                transform: c === color ? 'scale(1.05)' : 'none',
                transition: 'transform 150ms, box-shadow 150ms',
              }}
            />
          ))}
        </Box>

        <Box sx={{ height: '1px', bgcolor: 'divider', mt: 2, mb: 1.25 }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} sx={{ borderRadius: 2, color: 'text.secondary' }}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={onSubmit}
            disabled={!name.trim() || saving}
            sx={{
              borderRadius: 2, fontWeight: 700, flex: 1,
              bgcolor: color, color: theme => theme.palette.getContrastText(color),
              '&:hover': { bgcolor: darken(color, 0.08) },
            }}
          >
            カードを作る
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
