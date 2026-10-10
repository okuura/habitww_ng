import { useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { keyframes } from '@emotion/react';
import type { Rarity } from './habitStats';
import { FINISH } from './cardFinish';

// カードのランクが上がったときの全画面の演出。新しいランクの金属プレートが回転しながら現れ、
// 後ろで光の筋が回り、火花が飛ぶ。タップか数秒で閉じる

export interface RankUp {
  habitName: string;
  rarity: Exclude<Rarity, 'normal'>;
  label: string;
  days: number;
}

const NAME: Record<RankUp['rarity'], string> = { bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD', holo: 'HOLO' };
const ACCENT: Record<RankUp['rarity'], string[]> = {
  bronze: ['#e7a36b', '#b8743d', '#ffd2a8'],
  silver: ['#ffffff', '#c9d0da', '#9aa5b4'],
  gold: ['#ffe27a', '#ffd23f', '#fff6c8'],
  holo: ['#ff5f6d', '#ffc371', '#7cf29c', '#5ad1ff', '#a18cff', '#ff7ad9'],
};

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;
const spin = keyframes`
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to   { transform: translate(-50%, -50%) rotate(360deg); }
`;
const plateIn = keyframes`
  0%   { transform: perspective(900px) rotateY(-200deg) scale(0.4); opacity: 0; }
  55%  { transform: perspective(900px) rotateY(12deg) scale(1.06); opacity: 1; }
  75%  { transform: perspective(900px) rotateY(-5deg) scale(0.98); }
  100% { transform: perspective(900px) rotateY(0deg) scale(1); }
`;
const shine = keyframes`
  0%, 35% { transform: translateX(-130%) skewX(-20deg); }
  75%, 100% { transform: translateX(330%) skewX(-20deg); }
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

const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  angle: (i / 22) * 360 + (i % 2 ? 7 : -5),
  dist: 150 + ((i * 37) % 90),
  delay: 450 + ((i * 53) % 260),
  size: 6 + ((i * 29) % 7),
}));

export default function RankUpEffect({ rankUp, onClose }: { rankUp: RankUp; onClose: () => void }) {
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([40, 60, 40, 60, 260]);
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [onClose]);

  const finish = FINISH[rankUp.rarity]!;
  const accent = ACCENT[rankUp.rarity];
  const rays = rankUp.rarity === 'holo'
    // ホロは光の筋も虹色に(筋 1 本ごとに色を変える)
    ? `conic-gradient(${Array.from({ length: 20 }, (_, i) => {
      const c = accent[i % accent.length];
      return `${c}66 ${i * 18}deg ${i * 18 + 6}deg, transparent ${i * 18 + 6}deg ${(i + 1) * 18}deg`;
    }).join(', ')})`
    : `repeating-conic-gradient(from 0deg, ${accent[0]}55 0deg 6deg, transparent 6deg 18deg)`;

  return (
    <Box
      onClick={onClose}
      role="dialog"
      aria-label={`${rankUp.habitName}が${rankUp.label}ランクに上がりました`}
      sx={{
        position: 'fixed', inset: 0, zIndex: 2000, overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        animation: `${fadeIn} 250ms ease-out`,
        cursor: 'pointer',
      }}
    >
      {/* 回る光の筋 */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute', left: '50%', top: '46%', width: 760, height: 760, borderRadius: '50%',
          background: rays,
          WebkitMaskImage: 'radial-gradient(circle, #000 18%, transparent 62%)',
          maskImage: 'radial-gradient(circle, #000 18%, transparent 62%)',
          animation: `${spin} 14s linear infinite, ${fadeIn} 900ms ease-out`,
        }}
      />

      {/* 火花 */}
      {SPARKS.map((s, i) => (
        <Box
          key={i}
          aria-hidden
          style={{ ['--a' as string]: `${s.angle}deg`, ['--d' as string]: `-${s.dist}px` }}
          sx={{
            position: 'absolute', left: '50%', top: '46%', width: s.size, height: s.size,
            bgcolor: accent[i % accent.length], borderRadius: i % 3 === 0 ? '50%' : '2px',
            boxShadow: `0 0 8px ${accent[i % accent.length]}`,
            opacity: 0,
            animation: `${burst} 1100ms cubic-bezier(0.15, 0.7, 0.3, 1) ${s.delay}ms forwards`,
          }}
        />
      ))}

      <Box sx={{ position: 'relative', mt: '-6vh' }}>
        <Typography
          sx={{
            textAlign: 'center', color: '#fff', fontWeight: 900, letterSpacing: '0.35em', fontSize: '0.8rem', mb: 1.5,
            textShadow: `0 0 12px ${accent[0]}`, opacity: 0, animation: `${rise} 500ms ease-out 200ms forwards`,
          }}
        >
          RANK UP
        </Typography>

        {/* 新しいランクの金属プレート */}
        <Box
          sx={{
            position: 'relative', width: 'min(300px, 78vw)', aspectRatio: '1.6', borderRadius: '20px', overflow: 'hidden',
            // 回転中も角の丸みの外にはみ出さない
            clipPath: 'inset(0 round 20px)',
            background: finish.background,
            backgroundBlendMode: rankUp.rarity === 'holo' ? 'overlay, soft-light, normal' : 'soft-light, normal',
            boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${accent[0]}66, inset 0 0 0 1px rgba(255,255,255,0.5)`,
            animation: `${plateIn} 1000ms cubic-bezier(0.2, 0.8, 0.25, 1) both`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.75,
            color: finish.ink,
            '&::before': {
              content: '""', position: 'absolute', inset: 8, borderRadius: '13px', pointerEvents: 'none',
              border: `1.5px solid ${finish.line}`,
              boxShadow: '1px 1px 0 rgba(255,255,255,0.55), inset 1px 1px 0 rgba(255,255,255,0.55)',
            },
          }}
        >
          <Typography sx={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '0.28em', pl: '0.28em', textShadow: finish.engrave, lineHeight: 1 }}>
            {NAME[rankUp.rarity]}
          </Typography>
          <Typography noWrap sx={{ maxWidth: '80%', fontSize: '0.95rem', fontWeight: 800, textShadow: finish.engrave }}>
            {rankUp.habitName}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: finish.inkSub, textShadow: finish.engrave }}>
            累計 {rankUp.days}日
          </Typography>
          {/* 走る光 */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%', pointerEvents: 'none',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.75) 50%, transparent)',
              mixBlendMode: 'overlay',
              animation: `${shine} 2.2s ease-in-out 900ms infinite`,
              transform: 'translateX(-130%)',
            }}
          />
        </Box>

        <Typography
          sx={{
            mt: 2.5, textAlign: 'center', color: '#fff', fontWeight: 900, fontSize: '1.25rem',
            textShadow: `0 2px 10px rgba(0,0,0,0.6), 0 0 18px ${accent[0]}88`,
            opacity: 0, animation: `${rise} 500ms ease-out 900ms forwards`,
          }}
        >
          {rankUp.label}カードに昇格！
        </Typography>
        <Typography
          sx={{
            mt: 0.75, textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem',
            opacity: 0, animation: `${rise} 500ms ease-out 1300ms forwards`,
          }}
        >
          タップで閉じる
        </Typography>
      </Box>
    </Box>
  );
}
