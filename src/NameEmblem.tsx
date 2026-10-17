import Box from '@mui/material/Box';
import { ACHIEVEMENTS } from './achievements';
import AchievementEmblem from './AchievementEmblem';

// 名前の横に出す小さなバッジ(X の認証バッジのような位置づけ)。設定で選んだ実績の id を渡す

export default function NameEmblem({ id, size = 18 }: { id: string | null | undefined; size?: number }) {
  const a = id ? ACHIEVEMENTS.find(x => x.id === id) : undefined;
  if (!a) return null;
  return (
    <Box component="span" title={a.name} aria-label={`バッジ: ${a.name}`} sx={{ display: 'inline-flex', verticalAlign: 'middle', ml: 0.5, lineHeight: 0, flexShrink: 0 }}>
      <AchievementEmblem badge={a} earned size={size} hideMark />
    </Box>
  );
}
