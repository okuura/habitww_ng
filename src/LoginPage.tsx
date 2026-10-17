import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import type { Provider } from '@supabase/supabase-js';
import { supabase } from './supabase';

// ログイン画面: 画面全体のやわらかいグラデーションと漂うぼかし円の上に、アプリアイコン・Habitww・一言・ボタン。
// カードは置かない。ログインの流れ(signInWithOAuth)は変えない

const GOOGLE_ICON = (
  <Box component="svg" viewBox="0 0 24 24" sx={{ width: 20, height: 20, flexShrink: 0 }}>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </Box>
);

const X_ICON = (
  <Box component="svg" viewBox="0 0 24 24" sx={{ width: 18, height: 18, flexShrink: 0 }}>
    <path
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      fill="currentColor"
    />
  </Box>
);

const APPLE_ICON = (
  <Box component="svg" viewBox="0 0 24 24" sx={{ width: 20, height: 20, flexShrink: 0 }}>
    <path
      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      fill="currentColor"
    />
  </Box>
);

/**
 * ログイン方法(Supabase → Authentication → Providers で各プロバイダの有効化が必要)。
 * enabled: false のものはボタンを出さない
 */
const LOGIN_PROVIDERS: { provider: Provider; label: string; icon: ReactNode; enabled: boolean }[] = [
  { provider: 'google', label: 'Google で続ける', icon: GOOGLE_ICON, enabled: true },
  // Apple Developer Program 登録後に Supabase で有効化してから true にする(docs/integration.md)
  { provider: 'apple', label: 'Apple で続ける', icon: APPLE_ICON, enabled: false },
  // X は OAuth 2.0 版('x')。'twitter' は旧 OAuth 1.0a
  { provider: 'x', label: 'X で続ける', icon: X_ICON, enabled: true },
];

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;
const drift1 = keyframes`
  from { transform: translate(0, 0); }
  to   { transform: translate(60px, 40px); }
`;
const drift2 = keyframes`
  from { transform: translate(0, 0); }
  to   { transform: translate(-50px, 60px); }
`;
const drift3 = keyframes`
  from { transform: translate(0, 0); }
  to   { transform: translate(40px, -50px); }
`;

/** 背景に漂うぼかし円 */
const BLOBS = [
  { left: '-10%', top: '-8%', size: 'min(70vw, 420px)', color: '#66bb6a', opacity: 0.55, darkOpacity: 0.28, anim: drift1, duration: 22 },
  { left: '55%', top: '10%', size: 'min(60vw, 360px)', color: '#4db6ac', opacity: 0.5, darkOpacity: 0.26, anim: drift2, duration: 26 },
  { left: '20%', top: '62%', size: 'min(65vw, 380px)', color: '#c5e1a5', opacity: 0.6, darkOpacity: 0.18, anim: drift3, duration: 18 },
];

export default function LoginPage() {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const [loading, setLoading] = useState<Provider | null>(null);
  const [failed, setFailed] = useState(false);

  const handleLogin = async (provider: Provider) => {
    if (loading) return;
    setLoading(provider);
    setFailed(false);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    // 成功ならこのあとリダイレクトされる。戻ってきたら失敗
    if (error) { setLoading(null); setFailed(true); }
  };

  return (
    <Box
      sx={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pt: 'env(safe-area-inset-top)', pb: 'env(safe-area-inset-bottom)', px: 2,
        background: dark
          ? 'linear-gradient(160deg, #0b1712 0%, #0e1f1b 100%)'
          : 'linear-gradient(160deg, #eef7f1 0%, #e3f3ef 100%)',
      }}
    >
      {/* 漂うぼかし円 */}
      {BLOBS.map((b, i) => (
        <Box
          key={i}
          aria-hidden
          sx={{
            position: 'absolute', left: b.left, top: b.top, width: b.size, height: b.size, borderRadius: '50%',
            bgcolor: b.color, opacity: dark ? b.darkOpacity : b.opacity, filter: 'blur(70px)',
            animation: `${b.anim} ${b.duration}s ease-in-out infinite alternate`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* 中身(カードは無し。背景の上にそのまま) */}
      <Box sx={{ position: 'relative', width: 'min(100%, 360px)', textAlign: 'center', animation: `${fadeUp} 500ms cubic-bezier(0.2, 0.8, 0.25, 1)` }}>
        <Box
          component="img"
          src="/app-icon-512.png"
          alt=""
          aria-hidden
          sx={{ width: 112, height: 112, display: 'block', mx: 'auto', mb: 2.5, borderRadius: '26px', boxShadow: '0 12px 32px rgba(20,60,40,0.22)' }}
        />

        <Typography
          component="h1"
          sx={{ fontFamily: '"Fredoka", "Roboto", sans-serif', fontWeight: 700, letterSpacing: 0.5, fontSize: '2.5rem', lineHeight: 1.1, color: 'text.primary' }}
        >
          Habitww
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.95rem', mt: 1, mb: 5 }}>
          小さな努力が大きな成果に
        </Typography>

        <Stack spacing={1.25}>
          {LOGIN_PROVIDERS.filter(p => p.enabled).map(({ provider, label, icon }) => {
            const filledDark = provider === 'x' || provider === 'apple';
            const bg = filledDark ? (dark ? '#ffffff' : '#0f0f0f') : '#ffffff';
            const fg = filledDark ? (dark ? '#0f0f0f' : '#ffffff') : '#1a1a1a';
            const busy = loading === provider;
            return (
              <Button
                key={provider}
                fullWidth
                disabled={loading !== null}
                onClick={() => handleLogin(provider)}
                sx={{
                  position: 'relative', height: 52, borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem', textTransform: 'none',
                  bgcolor: bg, color: fg, border: filledDark ? 'none' : '1px solid rgba(0,0,0,0.1)',
                  boxShadow: '0 2px 10px rgba(20,60,40,0.1)',
                  transition: 'transform .12s, box-shadow .12s, filter .12s',
                  '&:hover': { bgcolor: bg, filter: 'brightness(0.97)', boxShadow: '0 6px 18px rgba(20,60,40,0.16)' },
                  '&:active': { transform: 'scale(0.985)' },
                  '&.Mui-disabled': { bgcolor: bg, color: fg, opacity: busy ? 1 : 0.55 },
                }}
              >
                <Box sx={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', color: fg }}>
                  {busy ? <CircularProgress size={18} sx={{ color: fg }} /> : icon}
                </Box>
                {label}
              </Button>
            );
          })}
        </Stack>
        {failed && (
          <Typography variant="caption" sx={{ display: 'block', color: 'error.main', mt: 1.5 }}>
            ログインできませんでした。もう一度お試しください
          </Typography>
        )}
      </Box>
    </Box>
  );
}
