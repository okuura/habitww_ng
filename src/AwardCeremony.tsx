import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { keyframes } from '@emotion/react';
import AchievementEmblem from './AchievementEmblem';
import { Medal } from './Badges';
import { nextStep, type EvaluatedAchievement } from './achievements';
import type { Award } from './awards';

// 授与式: 新しく取ったバッジ・メダルを 1 つずつ、全画面で称える。
// RankUpEffect と同じ系統の見た目(暗幕・回る光の筋・火花)。タップか「次へ」で進む

interface Props {
  awards: Award[];
  /** 「次は…」を出すための全バッジ */
  evaluated: EvaluatedAchievement[];
  onClose: () => void;
}

const GOLD = '#ffd54f';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;
const spin = keyframes`
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
`;
const dropIn = keyframes`
  0%   { transform: translateY(-70px) scale(0.5); opacity: 0; }
  60%  { transform: translateY(8px) scale(1.08); opacity: 1; }
  80%  { transform: translateY(-4px) scale(0.98); }
  100% { transform: translateY(0) scale(1); }
`;
const rise = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const burst = keyframes`
  0%   { transform: translate(-50%, -50%) rotate(var(--a)) translateY(0) scale(0.4); opacity: 0; }
  15%  { opacity: 1; }
  100% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(var(--d)) scale(1); opacity: 0; }
`;

const SPARKS = Array.from({ length: 20 }, (_, i) => ({
  angle: (i / 20) * 360 + (i % 2 ? 9 : -6),
  dist: 140 + ((i * 41) % 90),
  delay: 350 + ((i * 59) % 240),
  size: 5 + ((i * 31) % 7),
}));

export default function AwardCeremony({ awards, evaluated, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const award = awards[idx];
  const last = idx >= awards.length - 1;

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([40, 60, 40, 60, 200]);
  }, [idx]);

  if (!award) return null;
  const advance = () => (last ? onClose() : setIdx(i => i + 1));

  const accent = award.kind === 'medal' ? award.habit.color : GOLD;
  const kicker = award.kind === 'medal' ? '月間パーフェクト' : 'バッジ獲得';
  const title = award.kind === 'medal' ? `${award.year}年${award.month}月 ${award.habit.name}` : award.achievement.name;
  const lines: string[] = award.kind === 'medal'
    ? [`${award.days}日 毎日やりきった`, `${award.nth}枚目のメダル`]
    : [
      award.achievement.hint,
      ...(award.achievement.state.habit && ['streak', 'rank', 'month'].includes(award.achievement.category) ? [`「${award.achievement.state.habit.name}」で達成`] : []),
      ...(() => { const s = nextStep(evaluated, award.achievement.id); return s ? [s.text] : []; })(),
    ];

  return (
    <Box
      onClick={advance}
      role="dialog"
      aria-label={`${kicker}: ${title}`}
      sx={{
        position: 'fixed', inset: 0, zIndex: 2000, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.76)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `${fadeIn} 250ms ease-out`, cursor: 'pointer',
      }}
    >
      {/* 回る光の筋 */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute', left: '50%', top: '44%', width: 720, height: 720, borderRadius: '50%',
          background: `repeating-conic-gradient(from 0deg, ${accent}55 0deg 6deg, transparent 6deg 18deg)`,
          WebkitMaskImage: 'radial-gradient(circle, #000 15%, transparent 60%)',
          maskImage: 'radial-gradient(circle, #000 15%, transparent 60%)',
          animation: `${spin} 16s linear infinite, ${fadeIn} 900ms ease-out`,
        }}
      />

      <Box key={idx} sx={{ position: 'relative', mt: '-8vh', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', px: 3, maxWidth: 420 }}>
        {/* 火花 */}
        {SPARKS.map((s, i) => (
          <Box
            key={i}
            aria-hidden
            style={{ ['--a' as string]: `${s.angle}deg`, ['--d' as string]: `-${s.dist}px` }}
            sx={{
              position: 'absolute', left: '50%', top: 110, width: s.size, height: s.size,
              bgcolor: i % 3 === 0 ? '#fff' : accent, borderRadius: i % 2 === 0 ? '50%' : '2px',
              boxShadow: `0 0 8px ${accent}`, opacity: 0,
              animation: `${burst} 1100ms cubic-bezier(0.15, 0.7, 0.3, 1) ${s.delay}ms forwards`,
            }}
          />
        ))}

        <Typography sx={{ color: '#fff', fontWeight: 900, letterSpacing: '0.3em', pl: '0.3em', fontSize: '0.8rem', mb: 2, textShadow: `0 0 12px ${accent}`, opacity: 0, animation: `${rise} 500ms ease-out 150ms forwards` }}>
          {kicker}
        </Typography>

        <Box sx={{ animation: `${dropIn} 900ms cubic-bezier(0.2, 0.8, 0.25, 1) both`, filter: `drop-shadow(0 12px 30px ${accent}88)`, lineHeight: 0 }}>
          {award.kind === 'medal'
            ? <Medal color={award.habit.color} value={String(award.month)} unit="月" year={String(award.year)} size={120} shine />
            : <AchievementEmblem badge={award.achievement} earned size={140} />}
        </Box>

        <Typography sx={{ mt: 2.5, color: '#fff', fontWeight: 900, fontSize: '1.45rem', lineHeight: 1.25, textShadow: `0 2px 10px rgba(0,0,0,0.6), 0 0 18px ${accent}88`, opacity: 0, animation: `${rise} 500ms ease-out 700ms forwards` }}>
          {title}
        </Typography>
        {lines.map((line, i) => (
          <Typography key={i} sx={{ mt: i === 0 ? 1 : 0.5, color: i === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.65)', fontSize: i === 0 ? '0.9rem' : '0.8rem', fontWeight: i === 0 ? 600 : 500, opacity: 0, animation: `${rise} 500ms ease-out ${950 + i * 150}ms forwards` }}>
            {line}
          </Typography>
        ))}

        <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2, opacity: 0, animation: `${rise} 500ms ease-out 1400ms forwards` }}>
          {awards.length > 1 && (
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', fontWeight: 700 }}>{idx + 1} / {awards.length}</Typography>
          )}
          <Button
            variant="contained"
            onClick={e => { e.stopPropagation(); advance(); }}
            sx={{ borderRadius: 999, px: 3, fontWeight: 800, bgcolor: '#fff', color: '#1a1a1a', '&:hover': { bgcolor: '#f0f0f0' } }}
          >
            {last ? '閉じる' : '次へ'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
