import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { alpha, useTheme } from '@mui/material/styles';
import type { Provider } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { supabase } from './supabase';

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
  { provider: 'google', label: 'Googleでログイン', icon: GOOGLE_ICON, enabled: true },
  // Apple Developer Program 登録後に Supabase で有効化してから true にする(docs/integration.md)
  { provider: 'apple', label: 'Appleでログイン', icon: APPLE_ICON, enabled: false },
  // X は OAuth 2.0 版('x')。'twitter' は旧 OAuth 1.0a
  { provider: 'x', label: 'X（旧Twitter）でログイン', icon: X_ICON, enabled: true },
];

export default function LoginPage() {
  const theme = useTheme();

  const handleLogin = async (provider: Provider) => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 400,
          p: { xs: 4, sm: 5 },
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 72,
            height: 72,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            mb: 3,
          }}
        >
          <CalendarTodayIcon sx={{ fontSize: 36, color: 'primary.main' }} />
        </Box>

        <Typography
          variant="h5"
          sx={{
            fontFamily: '"Fredoka", "Roboto", sans-serif',
            fontWeight: 700,
            letterSpacing: 0.5,
            fontSize: '2rem',
            color: 'primary.main',
            mb: 1,
          }}
        >
          Habitww
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.6 }}>
          毎日の習慣を記録して、継続する力を身につけよう。
        </Typography>

        <Divider sx={{ mb: 3 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', px: 1 }}>
            ログイン
          </Typography>
        </Divider>

        <Stack spacing={1.5}>
          {LOGIN_PROVIDERS.filter(p => p.enabled).map(({ provider, label, icon }) => (
            <Button
              key={provider}
              fullWidth
              variant="outlined"
              size="large"
              onClick={() => handleLogin(provider)}
              startIcon={icon}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                fontSize: '0.95rem',
                py: 1.4,
                borderColor: 'divider',
                color: 'text.primary',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  borderColor: 'text.secondary',
                },
                textTransform: 'none',
              }}
            >
              {label}
            </Button>
          ))}
        </Stack>

        <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 3, lineHeight: 1.5 }}>
          ログインすることで、習慣データがあなたのアカウントに安全に保存されます。
        </Typography>
      </Paper>
    </Box>
  );
}
