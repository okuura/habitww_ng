import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Fab from '@mui/material/Fab';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { AppShellSkeleton, StatsPageSkeleton, SharePageSkeleton } from './SkeletonFallbacks';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Snackbar from '@mui/material/Snackbar';
import AddIcon from '@mui/icons-material/Add';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BarChartIcon from '@mui/icons-material/BarChart';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ShareIcon from '@mui/icons-material/Share';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { alpha, darken, lighten } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import type { User } from '@supabase/supabase-js';
import theme from './theme';
import {
  supabase,
  initialSession,
  takePreloadedData,
  readCachedData,
  writeCachedData,
  clearCachedData,
  type Habit,
  type HabitCompletion,
  type HabitShare,
} from './supabase';
import ActivityGrid from './ActivityGrid';
import LoginPage from './LoginPage';

const StatsPage = lazy(() => import('./StatsPage'));
const ShareModal = lazy(() => import('./ShareModal'));
const QRScannerDialog = lazy(() => import('./QRScannerDialog'));
const ShareHabitsPage = lazy(() => import('./ShareHabitsPage'));

// Last known data, read once at startup. Lets the app paint real content
// immediately (stale-while-revalidate) while auth + fresh data load.
const initialCache = readCachedData();

const HABIT_COLORS = [
  '#4caf50', '#2196f3', '#ff9800', '#e91e63',
  '#9c27b0', '#00bcd4', '#ff5722', '#8bc34a',
];

// Dark mode per-level colors (2-tier system).
// Level 1 (達成): medium color = old "しっかり達成" color
// Level 2 (ばっちり達成): bright color = old "ばっちり達成" color
function getStdColorDark(hex: string): string {
  const c = hex.toLowerCase();
  if (c === '#5e9e22') return '#48B620';
  if (c === '#2196f3') return '#2275D3';
  if (c === '#ff9800') return '#DF8B16';
  return hex;
}
function getHighColorDark(hex: string): string {
  const c = hex.toLowerCase();
  if (c === '#5e9e22') return '#85F55C';
  if (c === '#2196f3') return '#6FB0F7';
  if (c === '#ff9800') return '#FAC978';
  // General fallback: boost saturation +15pt (cap 100%), lightness +5pt
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d > 0) {
    if (max === r) h = (((g - b) / d) % 6 + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const ns = Math.min(s + 0.15, 1);
  const nl = Math.min(l + 0.05, 0.9);
  const cv = (1 - Math.abs(2 * nl - 1)) * ns;
  const x = cv * (1 - Math.abs((h / 60) % 2 - 1));
  const m = nl - cv / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  const sec = Math.floor(h / 60) % 6;
  if (sec === 0) { r1 = cv; g1 = x; }
  else if (sec === 1) { r1 = x; g1 = cv; }
  else if (sec === 2) { g1 = cv; b1 = x; }
  else if (sec === 3) { g1 = x; b1 = cv; }
  else if (sec === 4) { r1 = x; b1 = cv; }
  else { r1 = cv; b1 = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

// Dark mode top button text color (ensures WCAG AA contrast on the vivid bg).
function getHighTextColorDark(hex: string): string | undefined {
  const c = hex.toLowerCase();
  if (c === '#5e9e22') return '#0A2A02';
  if (c === '#2196f3') return '#04182E';
  if (c === '#ff9800') return '#2E1902';
  return undefined;
}

const confettiBurst = keyframes`
  0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
  80%  { opacity: 0.8; }
  100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(0.5); opacity: 0; }
`;

const bounceIn = keyframes`
  0%   { transform: scale(1); }
  30%  { transform: scale(1.06); }
  60%  { transform: scale(0.97); }
  80%  { transform: scale(1.02); }
  100% { transform: scale(1); }
`;

const CONFETTI_CONFIGS = [
  { dx: '-55px', dy: '-90px', rot: '-120deg', delay: '0ms',   shape: 'circle' },
  { dx: '-30px', dy: '-110px', rot: '80deg',  delay: '30ms',  shape: 'square' },
  { dx: '0px',   dy: '-120px', rot: '-60deg', delay: '10ms',  shape: 'circle' },
  { dx: '28px',  dy: '-105px', rot: '140deg', delay: '50ms',  shape: 'square' },
  { dx: '52px',  dy: '-85px',  rot: '-200deg',delay: '20ms',  shape: 'circle' },
  { dx: '70px',  dy: '-55px',  rot: '90deg',  delay: '60ms',  shape: 'square' },
  { dx: '-70px', dy: '-55px',  rot: '-90deg', delay: '40ms',  shape: 'circle' },
  { dx: '-40px', dy: '-70px',  rot: '200deg', delay: '15ms',  shape: 'square' },
  { dx: '40px',  dy: '-70px',  rot: '-160deg',delay: '45ms',  shape: 'circle' },
  { dx: '10px',  dy: '-95px',  rot: '60deg',  delay: '5ms',   shape: 'square' },
  { dx: '-15px', dy: '-100px', rot: '-40deg', delay: '55ms',  shape: 'circle' },
  { dx: '60px',  dy: '-40px',  rot: '170deg', delay: '25ms',  shape: 'square' },
];

function ConfettiBurst({ color }: { color: string }) {
  const colors = [lighten(color, 0.4), color, darken(color, 0.3), lighten(color, 0.6)];
  return (
    <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {CONFETTI_CONFIGS.map((cfg, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            width: 7 + (i % 3) * 2,
            height: 7 + (i % 3) * 2,
            bgcolor: colors[i % colors.length],
            borderRadius: cfg.shape === 'circle' ? '50%' : '2px',
            '--dx': cfg.dx,
            '--dy': cfg.dy,
            '--rot': cfg.rot,
            animation: `${confettiBurst} 0.9s ${cfg.delay} cubic-bezier(0.22,1,0.36,1) forwards`,
          } as object}
        />
      ))}
    </Box>
  );
}

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calculateStreak(completedDates: Set<string>): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const cursor = new Date(today);
  while (true) {
    const dateStr = toLocalDateString(cursor);
    if (completedDates.has(dateStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export default function App() {
  return (
    <ThemeProvider theme={theme} defaultMode="system" noSsr>
      <CssBaseline />
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { mode, setMode } = useColorScheme();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [habits, setHabits] = useState<Habit[]>(initialCache?.habits ?? []);
  const [completions, setCompletions] = useState<HabitCompletion[]>(initialCache?.completions ?? []);
  const [loading, setLoading] = useState(initialCache === null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitColor, setNewHabitColor] = useState(HABIT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [celebratingHabitId, setCelebratingHabitId] = useState<string | null>(null);
  const [accountMenuAnchor, setAccountMenuAnchor] = useState<null | HTMLElement>(null);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteHabitTarget, setDeleteHabitTarget] = useState<string | null>(null);
  const [page, setPage] = useState<'habits' | 'stats' | 'share'>('habits');
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingHabitName, setEditingHabitName] = useState('');
  const [yesterdayHabitTarget, setYesterdayHabitTarget] = useState<string | null>(null);

  // Share feature state
  const [myShares, setMyShares] = useState<Map<string, HabitShare>>(new Map());
  const [habitMenuAnchor, setHabitMenuAnchor] = useState<null | HTMLElement>(null);
  const [habitMenuTarget, setHabitMenuTarget] = useState<string | null>(null);
  const [shareModalHabit, setShareModalHabit] = useState<Habit | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState<string | null>(null);
  const [pendingShareInfo, setPendingShareInfo] = useState<{
    shareId: string;
    habitName: string;
    sharerName: string;
  } | null>(null);
  const [addingShare, setAddingShare] = useState(false);

  const todayStr = toLocalDateString(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateString(yesterday);

  // Auth state listener (initialSession was kicked off at module load,
  // in parallel with React mounting)
  useEffect(() => {
    initialSession.then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') clearCachedData();
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    // First load consumes the eager fetch started at module load; later
    // calls (after add/delete) refetch. No setLoading(true): cached/current
    // content stays visible while fresh data arrives.
    const preloaded = takePreloadedData();
    let data = preloaded ? await preloaded : null;
    if (!data) {
      const [{ data: habitsData }, { data: completionsData }] = await Promise.all([
        supabase.from('habits').select('*').order('created_at', { ascending: true }),
        supabase.from('habit_completions').select('*'),
      ]);
      data = { habits: habitsData ?? [], completions: completionsData ?? [] };
    }
    setHabits(data.habits);
    setCompletions(data.completions);
    setLoading(false);
  }, [user]);

  // Persist current data (including optimistic updates) for instant next launch
  useEffect(() => {
    if (loading || !user) return;
    writeCachedData({
      habits,
      completions,
      userName: user.user_metadata?.name as string | undefined,
      userAvatar: user.user_metadata?.avatar_url as string | undefined,
    });
  }, [habits, completions, loading, user]);

  const fetchMyShares = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('habit_shares')
      .select('*')
      .eq('user_id', user.id);
    const map = new Map<string, HabitShare>();
    for (const s of data ?? []) map.set(s.habit_id, s as HabitShare);
    setMyShares(map);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
      fetchMyShares();
    }
  }, [user, fetchData, fetchMyShares]);

  // Handle ?shareToken=... URL param (deep link from QR scan)
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const shareToken = params.get('shareToken');
    if (!shareToken) return;
    window.history.replaceState({}, '', window.location.pathname);
    processScanToken(shareToken);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const processScanToken = async (rawValue: string) => {
    // Extract token from full URL or treat as raw token
    let token = rawValue.trim();
    try {
      const url = new URL(rawValue);
      const t = url.searchParams.get('shareToken');
      if (t) token = t;
    } catch {
      // rawValue is already a token
    }

    const { data: share } = await supabase
      .from('habit_shares')
      .select('id, user_id, sharer_name, habits!habit_id(name)')
      .eq('share_token', token)
      .maybeSingle();

    if (!share) {
      setSnackbarMsg('無効または期限切れのQRコードです');
      return;
    }
    if ((share as { user_id: string }).user_id === user?.id) {
      setSnackbarMsg('自分の習慣のQRコードです');
      return;
    }

    const habitName = ((share as { habits?: { name?: string } }).habits?.name) ?? '不明な習慣';

    setPendingShareInfo({
      shareId: share.id as string,
      habitName,
      sharerName: (share as { sharer_name: string }).sharer_name,
    });
    setPage('share');
  };

  const handleScanResult = (rawValue: string) => {
    setScannerOpen(false);
    processScanToken(rawValue);
  };

  const handleConfirmAddShare = async () => {
    if (!pendingShareInfo) return;
    setAddingShare(true);
    const { error } = await supabase
      .from('shared_habit_viewers')
      .insert({ habit_share_id: pendingShareInfo.shareId });

    if (error && error.code === '23505') {
      setSnackbarMsg('すでに追加済みです');
    } else if (error) {
      setSnackbarMsg('追加に失敗しました。もう一度お試しください');
    } else {
      setSnackbarMsg(`「${pendingShareInfo.habitName}」を追加しました`);
    }
    setAddingShare(false);
    setPendingShareInfo(null);
  };

  const todayIntensity = new Map<string, number>(
    completions
      .filter(c => c.completed_date === todayStr)
      .map(c => [c.habit_id, c.intensity]),
  );
  const completedToday = new Set(todayIntensity.keys());

  const completionsByHabit = new Map<string, Map<string, number>>();
  for (const c of completions) {
    if (!completionsByHabit.has(c.habit_id)) completionsByHabit.set(c.habit_id, new Map());
    completionsByHabit.get(c.habit_id)!.set(c.completed_date, c.intensity);
  }

  const handleToggle = async (habit: Habit) => {
    setToggling(habit.id);
    const current = todayIntensity.get(habit.id) ?? 0;

    // 2-level cycle: 0(未実施) → 1(達成) → 2(ばっちり達成) → 0
    const nextIntensity = current >= 2 ? 0 : current + 1;

    // Optimistic update for instant UI feedback
    setCompletions(prev => {
      const next = prev.filter(c => !(c.habit_id === habit.id && c.completed_date === todayStr));
      if (nextIntensity > 0) {
        next.push({
          id: 'optimistic',
          habit_id: habit.id,
          completed_date: todayStr,
          created_at: new Date().toISOString(),
          intensity: nextIntensity,
        });
      }
      return next;
    });

    if (nextIntensity === 0) {
      await supabase
        .from('habit_completions')
        .delete()
        .eq('habit_id', habit.id)
        .eq('completed_date', todayStr);
    } else if (current === 0) {
      await supabase
        .from('habit_completions')
        .insert({ habit_id: habit.id, completed_date: todayStr, intensity: nextIntensity });
    } else {
      await supabase
        .from('habit_completions')
        .update({ intensity: nextIntensity })
        .eq('habit_id', habit.id)
        .eq('completed_date', todayStr);
    }

    if (nextIntensity === 2) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 30, 80, 30, 120]);
      }
      setCelebratingHabitId(habit.id);
      setTimeout(() => setCelebratingHabitId(null), 1600);
    }

    setToggling(null);
  };

  const handleAddHabit = async () => {
    if (!newHabitName.trim() || !user) return;
    setSaving(true);
    await supabase.from('habits').insert({
      name: newHabitName.trim(),
      color: newHabitColor,
      user_id: user.id,
    });
    setNewHabitName('');
    setNewHabitColor(HABIT_COLORS[0]);
    setDialogOpen(false);
    setSaving(false);
    await fetchData();
  };

  const handleDeleteHabit = async () => {
    if (!deleteHabitTarget) return;
    await supabase.from('habits').delete().eq('id', deleteHabitTarget);
    setDeleteHabitTarget(null);
    await fetchData();
  };

  const handleSignOut = async () => {
    setAccountMenuAnchor(null);
    clearCachedData();
    await supabase.auth.signOut();
    setHabits([]);
    setCompletions([]);
    setMyShares(new Map());
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    await supabase.from('habits').delete().eq('user_id', user!.id);
    clearCachedData();
    await supabase.auth.signOut();
    setDeletingAccount(false);
    setDeleteAccountDialogOpen(false);
    setHabits([]);
    setCompletions([]);
  };

  const handleRenameHabit = async (habitId: string) => {
    const trimmed = editingHabitName.trim();
    if (!trimmed) { setEditingHabitId(null); return; }
    const habit = habits.find(h => h.id === habitId);
    if (habit && trimmed !== habit.name) {
      await supabase.from('habits').update({ name: trimmed }).eq('id', habitId);
      setHabits(prev => prev.map(h => h.id === habitId ? { ...h, name: trimmed } : h));
    }
    setEditingHabitId(null);
  };

  const handleYesterdayComplete = async () => {
    if (!yesterdayHabitTarget) return;
    setCompletions(prev => [...prev, {
      id: 'optimistic-y',
      habit_id: yesterdayHabitTarget,
      completed_date: yesterdayStr,
      created_at: new Date().toISOString(),
      intensity: 1,
    }]);
    setYesterdayHabitTarget(null);
    await supabase
      .from('habit_completions')
      .insert({ habit_id: yesterdayHabitTarget, completed_date: yesterdayStr, intensity: 1 });
  };

  const completedCount = habits.filter(h => completedToday.has(h.id)).length;
  const displayName = (user?.user_metadata?.name as string | undefined) ?? initialCache?.userName;
  const avatarLetter = displayName?.[0]?.toUpperCase()
    ?? user?.email?.[0].toUpperCase() ?? '?';
  const avatarSrc = (user?.user_metadata?.avatar_url as string | undefined)
    ?? (user ? undefined : initialCache?.userAvatar);

  // With cached data we render the real UI immediately, even while the
  // session is still being restored (user briefly null). Without cache,
  // wait for auth to know whether to show the app or the login page.
  if (authLoading && !initialCache) {
    return <AppShellSkeleton />;
  }

  if (!authLoading && !user) return <LoginPage />;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              {page === 'habits' ? 'Habitww' : page === 'stats' ? 'Habits Insight' : 'Share Habits'}
            </Typography>
          </Box>
          {!loading && habits.length > 0 && page === 'habits' && (
            <Chip
              label={`${completedCount} / ${habits.length} 完了`}
              color={completedCount === habits.length ? 'primary' : 'default'}
              size="small"
              sx={{ fontWeight: 600, mr: 1 }}
            />
          )}
          <IconButton size="small" onClick={e => setAccountMenuAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
            <Avatar
              src={avatarSrc}
              sx={{ width: 32, height: 32, fontSize: '0.85rem', fontWeight: 700, bgcolor: 'primary.main' }}
            >
              {!avatarSrc && avatarLetter}
            </Avatar>
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Account menu */}
      <Menu
        anchorEl={accountMenuAnchor}
        open={Boolean(accountMenuAnchor)}
        onClose={() => setAccountMenuAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 200, mt: 0.5 } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
            {displayName || 'ユーザー'}
          </Typography>
        </Box>
        <Divider />
        <MenuItem
          onClick={() => { setAccountMenuAnchor(null); setMode(mode === 'dark' ? 'light' : 'dark'); }}
          sx={{ gap: 1.5, py: 1.5 }}
        >
          {mode === 'dark'
            ? <LightModeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            : <DarkModeIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
          <Typography variant="body2">{mode === 'dark' ? 'ライトモード' : 'ダークモード'}</Typography>
        </MenuItem>
        <MenuItem onClick={handleSignOut} sx={{ gap: 1.5, py: 1.5 }}>
          <LogoutIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="body2">ログアウト</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => { setAccountMenuAnchor(null); setDeleteAccountDialogOpen(true); }}
          sx={{ gap: 1.5, py: 1.5, color: 'error.main' }}
        >
          <PersonOffIcon fontSize="small" />
          <Typography variant="body2" color="error">退会する</Typography>
        </MenuItem>
      </Menu>

      <Box sx={{ pb: 8 }}>
        {page === 'habits' && (
          <Container maxWidth="md" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, fontWeight: 500 }}>
              {new Date().toLocaleDateString('ja-JP', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
              })}
            </Typography>

            {loading ? (
              <Stack spacing={2}>
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} variant="rounded" height={200} sx={{ borderRadius: 3 }} />
                ))}
              </Stack>
            ) : habits.length === 0 ? (
              <Box
                sx={{
                  textAlign: 'center', py: 10, px: 4,
                  bgcolor: 'background.paper', borderRadius: 3,
                  border: '2px dashed', borderColor: 'divider',
                }}
              >
                <CalendarTodayIcon sx={{ fontSize: 56, color: 'primary.light', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1 }}>
                  習慣を追加しましょう
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  右下の + ボタンから習慣を登録できます
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
                  最初の習慣を追加
                </Button>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {habits.map(habit => {
                  const dateMap = completionsByHabit.get(habit.id) ?? new Map<string, number>();
                  const datesSet = new Set(dateMap.keys());
                  const currentIntensity = todayIntensity.get(habit.id) ?? 0;
                  const streak = calculateStreak(datesSet);
                  const totalCount = datesSet.size;
                  const isShared = myShares.has(habit.id);

                  return (
                    <Card
                      key={habit.id}
                      elevation={0}
                      sx={{
                        border: '1px solid',
                        borderColor: currentIntensity === 0 ? 'divider' : alpha(habit.color, 0.2 + currentIntensity * 0.1),
                        borderRadius: 2,
                        transition: theme.transitions.create(['border-color', 'box-shadow'], {
                          duration: theme.transitions.duration.shorter,
                        }),
                        boxShadow: currentIntensity === 0 ? 'none' : `0 0 0 ${currentIntensity + 1}px ${alpha(habit.color, currentIntensity * 0.08)}`,
                      }}
                    >
                      <CardContent sx={{ pb: 0.5, pt: 1.5, px: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                          <Box
                            sx={{
                              width: 10, height: 10, borderRadius: '50%',
                              bgcolor: habit.color, flexShrink: 0,
                            }}
                          />
                          {editingHabitId === habit.id ? (
                            <TextField
                              autoFocus
                              size="small"
                              value={editingHabitName}
                              onChange={e => setEditingHabitName(e.target.value)}
                              onBlur={() => handleRenameHabit(habit.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameHabit(habit.id);
                                if (e.key === 'Escape') setEditingHabitId(null);
                              }}
                              sx={{ flex: 1 }}
                              inputProps={{ sx: { fontWeight: 700, fontSize: '0.9rem', py: 0.5 } }}
                            />
                          ) : (
                            <Typography
                              variant="body1"
                              onClick={() => { setEditingHabitId(habit.id); setEditingHabitName(habit.name); }}
                              sx={{
                                fontWeight: 700, flex: 1, color: 'text.primary',
                                cursor: 'pointer', '&:hover': { color: 'primary.main' },
                              }}
                            >
                              {habit.name}
                            </Typography>
                          )}

                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {isShared && (
                              <Chip
                                label="共有中"
                                size="small"
                                sx={{
                                  bgcolor: alpha('#4caf50', 0.1),
                                  color: '#2e7d32',
                                  fontWeight: 600,
                                  fontSize: '0.62rem',
                                  height: 18,
                                }}
                              />
                            )}
                            {streak > 0 && (
                              <Chip
                                icon={<LocalFireDepartmentIcon sx={{ fontSize: '0.9rem !important' }} />}
                                label={`${streak}日`}
                                size="small"
                                sx={{
                                  bgcolor: alpha('#ff5722', 0.1),
                                  color: '#ff5722',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  height: 20,
                                  '& .MuiChip-icon': { color: '#ff5722' },
                                }}
                              />
                            )}
                            <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 40, textAlign: 'right' }}>
                              計 {totalCount}日
                            </Typography>
                            {/* 3-dot menu button */}
                            <IconButton
                              size="small"
                              onClick={e => {
                                setHabitMenuAnchor(e.currentTarget);
                                setHabitMenuTarget(habit.id);
                              }}
                              sx={{
                                color: isShared ? 'primary.main' : 'text.disabled',
                                '&:hover': { color: 'text.primary' },
                                ml: 0.5,
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>

                        <ActivityGrid
                          completionsByDate={dateMap}
                          habitColor={habit.color}
                          onYesterdayClick={() => setYesterdayHabitTarget(habit.id)}
                        />
                      </CardContent>

                      <CardActions sx={{ px: 2, pb: 1.5, pt: 0.5, position: 'relative' }}>
                        {celebratingHabitId === habit.id && <ConfettiBurst color={habit.color} />}
                        {(() => {
                          const isCelebrating = celebratingHabitId === habit.id;
                          const isDark = mode === 'dark';

                          // Same color logic as ActivityGrid getCellBg
                          const stdBg = isDark ? getStdColorDark(habit.color) : habit.color;
                          const highBg = isDark ? getHighColorDark(habit.color) : darken(habit.color, 0.48);
                          const highTextColor = isDark
                            ? (getHighTextColorDark(habit.color) ?? theme.palette.getContrastText(highBg))
                            : theme.palette.getContrastText(highBg);

                          const fireIcon = <LocalFireDepartmentIcon fontSize="small" />;

                          const btnCfgs = [
                            {
                              variant: 'outlined' as const,
                              icon: <RadioButtonUncheckedIcon />,
                              label: '実施',
                              large: false,
                              sx: {
                                borderColor: habit.color, color: habit.color,
                                '&:hover': { bgcolor: alpha(habit.color, 0.08), borderColor: habit.color },
                              },
                            },
                            {
                              variant: 'contained' as const,
                              icon: fireIcon,
                              label: '達成！',
                              large: false,
                              sx: {
                                bgcolor: stdBg,
                                color: theme.palette.getContrastText(stdBg),
                                '&:hover': { bgcolor: isDark ? lighten(stdBg, 0.06) : darken(stdBg, 0.06) },
                              },
                            },
                            {
                              variant: 'contained' as const,
                              icon: (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '1px' }}>
                                  {fireIcon}{fireIcon}
                                </Box>
                              ),
                              label: 'ばっちり達成！',
                              large: true,
                              sx: {
                                bgcolor: highBg,
                                color: highTextColor,
                                fontWeight: 800,
                                animation: isCelebrating ? `${bounceIn} 0.5s ease-out` : undefined,
                                '&:hover': { bgcolor: isDark ? lighten(highBg, 0.06) : darken(highBg, 0.06) },
                              },
                            },
                          ];
                          const cfg = btnCfgs[currentIntensity];
                          return (
                            <Button
                              fullWidth
                              variant={cfg.variant}
                              startIcon={cfg.icon}
                              onClick={() => handleToggle(habit)}
                              disabled={toggling === habit.id}
                              sx={{
                                borderRadius: 2,
                                fontWeight: 700,
                                fontSize: cfg.large ? '0.95rem' : '0.875rem',
                                py: cfg.large ? 1.1 : 0.75,
                                ...cfg.sx,
                              }}
                            >
                              {cfg.label}
                            </Button>
                          );
                        })()}
                      </CardActions>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Container>
        )}

        {page === 'stats' && (
          <Suspense fallback={<StatsPageSkeleton />}>
            <StatsPage habits={habits} completions={completions} />
          </Suspense>
        )}

        {page === 'share' && user && (
          <Suspense fallback={<SharePageSkeleton />}>
            <ShareHabitsPage user={user} onScanQR={() => setScannerOpen(true)} />
          </Suspense>
        )}
      </Box>

      {/* Habit card 3-dot menu */}
      <Menu
        anchorEl={habitMenuAnchor}
        open={Boolean(habitMenuAnchor)}
        onClose={() => { setHabitMenuAnchor(null); setHabitMenuTarget(null); }}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 200, mt: 0.5 } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            const target = habits.find(h => h.id === habitMenuTarget);
            setHabitMenuAnchor(null);
            if (target) setShareModalHabit(target);
          }}
          sx={{ gap: 1.5, py: 1.25 }}
        >
          <ShareIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Box>
            <Typography variant="body2">Share Habits</Typography>
            {habitMenuTarget && myShares.has(habitMenuTarget) && (
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: -0.25 }}>
                共有中 — タップでQRを表示
              </Typography>
            )}
          </Box>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setDeleteHabitTarget(habitMenuTarget);
            setHabitMenuAnchor(null);
            setHabitMenuTarget(null);
          }}
          sx={{ gap: 1.5, py: 1.25, color: 'error.main' }}
        >
          <DeleteOutlineIcon fontSize="small" />
          <Typography variant="body2" color="error">削除</Typography>
        </MenuItem>
      </Menu>

      {/* FAB — only on habits page */}
      {page === 'habits' && (
        <Fab
          color="primary"
          aria-label="習慣を追加"
          onClick={() => setDialogOpen(true)}
          sx={{ position: 'fixed', bottom: { xs: 76, sm: 88 }, right: { xs: 20, sm: 32 }, boxShadow: 4 }}
        >
          <AddIcon />
        </Fab>
      )}

      {/* Bottom Navigation */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 'appBar' }} elevation={3}>
        <BottomNavigation showLabels value={page} onChange={(_e, v) => setPage(v)}>
          <BottomNavigationAction label="記録" value="habits" icon={<CheckBoxIcon />} />
          <BottomNavigationAction label="統計" value="stats" icon={<BarChartIcon />} />
          <BottomNavigationAction label="Share Habits" value="share" icon={<PeopleAltIcon />} />
        </BottomNavigation>
      </Paper>

      {/* ===== Dialogs ===== */}

      {/* Add Habit */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>新しい習慣を追加</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="習慣の名前" placeholder="例: 毎日30分読書"
            value={newHabitName}
            onChange={e => setNewHabitName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddHabit(); }}
            sx={{ mt: 1, mb: 2 }}
          />
          <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary', fontWeight: 500 }}>
            カラーを選択
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {HABIT_COLORS.map(color => (
              <Box
                key={color}
                onClick={() => setNewHabitColor(color)}
                sx={{
                  width: 36, height: 36, borderRadius: '50%', bgcolor: color, cursor: 'pointer',
                  border: '3px solid',
                  borderColor: newHabitColor === color ? 'text.primary' : 'transparent',
                  transition: theme.transitions.create('transform', { duration: theme.transitions.duration.shorter }),
                  '&:hover': { transform: 'scale(1.15)' },
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ borderRadius: 2 }}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleAddHabit}
            disabled={!newHabitName.trim() || saving}
            sx={{ borderRadius: 2, fontWeight: 700, flex: 1 }}
          >
            追加する
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Habit */}
      <Dialog
        open={!!deleteHabitTarget}
        onClose={() => setDeleteHabitTarget(null)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>習慣の削除</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            この習慣を削除します。記録を含めて削除されますが、本当に削除してよろしいですか？
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={handleDeleteHabit} sx={{ borderRadius: 2 }}>はい</Button>
          <Button
            variant="contained"
            onClick={() => setDeleteHabitTarget(null)}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            いいえ
          </Button>
        </DialogActions>
      </Dialog>

      {/* Yesterday Completion */}
      <Dialog
        open={!!yesterdayHabitTarget}
        onClose={() => setYesterdayHabitTarget(null)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>昨日の分を登録</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            昨日の分を登録しますか？
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setYesterdayHabitTarget(null)} sx={{ borderRadius: 2 }}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={handleYesterdayComplete}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            はい
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Account */}
      <Dialog
        open={deleteAccountDialogOpen}
        onClose={() => !deletingAccount && setDeleteAccountDialogOpen(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main', pb: 1 }}>退会する</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            退会すると、登録したすべての習慣と記録データが完全に削除されます。この操作は取り消せません。
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            onClick={() => setDeleteAccountDialogOpen(false)}
            disabled={deletingAccount}
            sx={{ borderRadius: 2 }}
          >
            キャンセル
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteAccount}
            disabled={deletingAccount}
            startIcon={deletingAccount ? <CircularProgress size={16} color="inherit" /> : <PersonOffIcon />}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            退会する
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pending share confirmation (after QR scan) */}
      <Dialog
        open={!!pendingShareInfo}
        onClose={() => setPendingShareInfo(null)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>友達の習慣を追加</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'text.secondary' }}>
            <strong>{pendingShareInfo?.sharerName}</strong> さんの習慣「
            <strong>{pendingShareInfo?.habitName}</strong>」を追加しますか？
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setPendingShareInfo(null)} sx={{ borderRadius: 2 }}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmAddShare}
            disabled={addingShare}
            startIcon={addingShare ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            追加する
          </Button>
        </DialogActions>
      </Dialog>

      {/* Share Modal (QR code display) */}
      {shareModalHabit && user && (
        <Suspense fallback={null}>
        <ShareModal
          open={!!shareModalHabit}
          onClose={() => setShareModalHabit(null)}
          habit={shareModalHabit}
          existingShare={myShares.get(shareModalHabit.id)}
          user={user}
          onShareCreated={share => {
            setMyShares(prev => new Map(prev).set(share.habit_id, share));
          }}
          onShareDeleted={habitId => {
            setMyShares(prev => {
              const next = new Map(prev);
              next.delete(habitId);
              return next;
            });
          }}
        />
        </Suspense>
      )}

      {/* QR Scanner */}
      <Suspense fallback={null}>
      <QRScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onResult={handleScanResult}
      />
      </Suspense>

      {/* Toast notifications */}
      <Snackbar
        open={!!snackbarMsg}
        autoHideDuration={3000}
        onClose={() => setSnackbarMsg(null)}
        message={snackbarMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ bottom: { xs: 80, sm: 96 } }}
      />
    </Box>
  );
}
