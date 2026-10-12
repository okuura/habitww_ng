import Box from '@mui/material/Box';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { Habit } from './supabase';

// グループに登録する「自分の習慣」を選ぶ: 既存の習慣か、新しく作る

export const NEW_HABIT = '__new__';

interface Props {
  habits: Habit[];
  /** 選んでいる習慣の id か NEW_HABIT */
  value: string;
  onChange: (value: string) => void;
  newName: string;
  onNewName: (name: string) => void;
  /** 「新しく作る」の案内に使う名前(招待した人の習慣名など) */
  suggestedName?: string;
}

export default function CoworkHabitPicker({ habits, value, onChange, newName, onNewName, suggestedName }: Props) {
  return (
    <RadioGroup value={value} onChange={e => onChange(e.target.value)}>
      {habits.map(h => (
        <FormControlLabel
          key={h.id}
          value={h.id}
          control={<Radio size="small" />}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: h.color, flexShrink: 0 }} />
              <Typography variant="body2">{h.name}</Typography>
            </Box>
          }
          sx={{ mx: 0, py: 0.25 }}
        />
      ))}
      <FormControlLabel
        value={NEW_HABIT}
        control={<Radio size="small" />}
        label={
          <Typography variant="body2">
            {suggestedName ? `「${suggestedName}」を新しく作る` : '新しい習慣を作る'}
          </Typography>
        }
        sx={{ mx: 0, py: 0.25 }}
      />
      {value === NEW_HABIT && (
        <TextField
          autoFocus
          size="small"
          label="習慣の名前"
          value={newName}
          onChange={e => onNewName(e.target.value)}
          inputProps={{ maxLength: 30 }}
          sx={{ mt: 1, ml: 4 }}
        />
      )}
    </RadioGroup>
  );
}
