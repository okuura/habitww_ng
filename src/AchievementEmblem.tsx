import Box from '@mui/material/Box';
import { darken, lighten, keyframes } from '@mui/material/styles';
import { ICONS } from './achievementIcons';

// バッジ図鑑の 1 枚。取得済みは色付きのメダル、未取得は点線の灰色、
// 伏せたバッジは「?」だけを見せる

const RAINBOW = 'conic-gradient(from 200deg, #ff5f6d, #ffc371, #f9f871, #7cf29c, #5ad1ff, #a18cff, #ff7ad9, #ff5f6d)';

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 196, 0, 0.0), 0 2px 6px rgba(0,0,0,0.25); }
  50% { box-shadow: 0 0 0 5px rgba(255, 196, 0, 0.35), 0 2px 6px rgba(0,0,0,0.25); }
`;

interface EmblemProps {
  icon: string;
  earned: boolean;
  /** 伏せたバッジ(未取得なら「?」) */
  hidden?: boolean;
  mark?: string;
  size?: number;
  /** 新しく取った(光らせる) */
  isNew?: boolean;
}

export default function AchievementEmblem({ icon, earned, hidden, mark, size = 52, isNew }: EmblemProps) {
  const { Icon, color } = ICONS[icon] ?? ICONS.trophy;
  const holo = icon === 'rank-holo';

  if (!earned) {
    return (
      <Box
        sx={{
          position: 'relative', width: size, height: size, borderRadius: '50%', flexShrink: 0,
          border: '2px dashed', borderColor: 'divider', bgcolor: 'action.hover',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled',
        }}
      >
        {hidden
          ? <Box component="span" sx={{ fontWeight: 900, fontSize: size * 0.4, lineHeight: 1 }}>?</Box>
          : <Icon sx={{ fontSize: size * 0.42, opacity: 0.6 }} />}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative', width: size, height: size, borderRadius: '50%', flexShrink: 0,
        background: holo
          ? `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.75), rgba(255,255,255,0) 45%), ${RAINBOW}`
          : `radial-gradient(circle at 35% 28%, ${lighten(color, 0.55)}, ${color} 52%, ${darken(color, 0.3)})`,
        border: `2px solid ${holo ? '#fff' : darken(color, 0.28)}`,
        boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        animation: isNew ? `${glow} 1.6s ease-in-out infinite` : undefined,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        // 内側の細い輪(刻印した縁)
        '&::before': {
          content: '""', position: 'absolute', inset: 3, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.45)',
        },
      }}
    >
      <Icon sx={{ fontSize: size * 0.44, filter: `drop-shadow(0 1px 0 ${holo ? 'rgba(60,40,140,0.5)' : darken(color, 0.45)})` }} />
      {mark && (
        <Box
          component="span"
          sx={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            px: 0.6, borderRadius: 1, whiteSpace: 'nowrap',
            bgcolor: holo ? '#5b4bd1' : darken(color, 0.35), color: '#fff',
            fontSize: Math.max(8.5, size * 0.17), fontWeight: 800, lineHeight: 1.45,
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}
        >
          {mark}
        </Box>
      )}
    </Box>
  );
}
