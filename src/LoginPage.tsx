import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { alpha, useTheme } from '@mui/material/styles';
import { supabase } from './supabase';

export default function LoginPage() {
  const theme = useTheme();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
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

        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
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

        <Button
          fullWidth
          variant="outlined"
          size="large"
          onClick={handleGoogleLogin}
          startIcon={
            <Box
              component="svg"
              viewBox="0 0 24 24"
              sx={{ width: 20, height: 20, flexShrink: 0 }}
            >
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
          }
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
          Googleでログイン
        </Button>

        <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 3, lineHeight: 1.5 }}>
          ログインすることで、習慣データがあなたのアカウントに安全に保存されます。
        </Typography>
      </Paper>
    </Box>
  );
}
