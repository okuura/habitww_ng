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
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import LightModeIcon from '@mui/icons-material/LightMode';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ShareIcon from '@mui/icons-material/Share';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NotificationsIcon from '@mui/icons-material/Notifications';
import BoltIcon from '@mui/icons-material/Bolt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { alpha, darken, lighten } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import type { User } from '@supabase/supabase-js';
import theme from './theme';
// Heavy display face for the streak pop (unicode-range subsets: only used glyphs load)
import '@fontsource/dela-gothic-one';
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
const HabitTimeDialog = lazy(() => import('./HabitTimeDialog'));
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

const rainbowShift = keyframes`
  0%   { background-position: 0% 50%; }
  100% { background-position: 300% 50%; }
`;

const confettiFall = keyframes`
  0%   { transform: translate3d(0, -12vh, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(var(--drift), 110vh, 0) rotate(var(--spin)); opacity: 0.9; }
`;

const feverBannerIn = keyframes`
  0%   { transform: scale(0.6); opacity: 0; }
  15%  { transform: scale(1.08); opacity: 1; }
  25%  { transform: scale(1); }
  80%  { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.05); opacity: 0; }
`;

const RAINBOW = 'linear-gradient(90deg, #ff5f6d, #ffc371, #f9f871, #7cf29c, #5ad1ff, #a18cff, #ff7ad9, #ff5f6d)';
const FEVER_MS = 3200;
const FEVER_PIECES = 48;

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

function ConfettiBurst({ color, count = CONFETTI_CONFIGS.length }: { color: string; count?: number }) {
  const colors = [lighten(color, 0.4), color, darken(color, 0.3), lighten(color, 0.6)];
  return (
    <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {CONFETTI_CONFIGS.slice(0, count).map((cfg, i) => (
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

// Full-screen celebration when every habit is done for today:
// confetti rain in the habit colors + a rainbow "ALL CLEAR!" banner.
function FeverOverlay({ colors }: { colors: string[] }) {
  const [pieces] = useState(() =>
    Array.from({ length: FEVER_PIECES }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      dur: 2.2 + Math.random() * 1.2,
      size: 7 + Math.random() * 7,
      drift: `${(Math.random() - 0.5) * 30}vw`,
      spin: `${Math.round((Math.random() - 0.5) * 1440)}deg`,
      color: colors.length ? colors[i % colors.length] : '#4caf50',
      round: Math.random() < 0.4,
    })),
  );
  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1400, pointerEvents: 'none', overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute', top: 0, left: `${p.left}%`,
            width: p.size, height: p.round ? p.size : p.size * 0.6,
            bgcolor: p.color, borderRadius: p.round ? '50%' : '2px',
            '--drift': p.drift, '--spin': p.spin,
            animation: `${confettiFall} ${p.dur}s ${p.delay}s cubic-bezier(0.25, 0.6, 0.4, 1) both`,
          } as object}
        />
      ))}
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
        <Box
          sx={{
            px: 3, py: 2, borderRadius: 4, textAlign: 'center',
            bgcolor: 'rgba(0,0,0,0.58)', backdropFilter: 'blur(6px)',
            boxShadow: '0 0 40px rgba(255,255,255,0.25)',
            animation: `${feverBannerIn} ${FEVER_MS}ms ease-out forwards`,
          }}
        >
          <Typography
            sx={{
              fontWeight: 900, fontSize: { xs: '2.2rem', sm: '2.8rem' }, lineHeight: 1.1, letterSpacing: 1,
              background: RAINBOW, backgroundSize: '300% 100%',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              animation: `${rainbowShift} 2s linear infinite`,
            }}
          >
            ALL CLEAR!
          </Typography>
          <Typography sx={{ color: '#fff', fontWeight: 700, mt: 0.5, fontSize: '1rem' }}>
            今日の習慣、全部やりきった 🎉
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 全期間での最長連続日数 */
function bestStreak(completedDates: Set<string>): number {
  const sorted = [...completedDates].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const ds of sorted) {
    if (prev !== null) {
      const p = new Date(prev + 'T00:00:00');
      p.setDate(p.getDate() + 1);
      run = toLocalDateString(p) === ds ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = ds;
  }
  return best;
}

// "N日連続！" slammed onto the middle of the card when today's tap extends the streak
// 左下 → 右上へ斜めに(-14deg)。叩きつけの揺れはこの角度を中心に
const streakSlam = keyframes`
  0%   { transform: translate(-50%, -50%) scale(2.8) rotate(-18deg); opacity: 0; filter: blur(4px); }
  18%  { transform: translate(-50%, -50%) scale(0.92) rotate(-13deg); opacity: 1; filter: blur(0); }
  28%  { transform: translate(-50%, -50%) scale(1.1) rotate(-15deg); }
  38%  { transform: translate(-50%, -50%) scale(1) rotate(-14deg); }
  80%  { transform: translate(-50%, -50%) scale(1) rotate(-14deg); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.2) rotate(-14deg); opacity: 0; }
`;

const FIRE_GRADIENT = 'linear-gradient(180deg, #ffd54f 0%, #ff7043 45%, #d32f2f 100%)';
// 疾風迅雷: 電光(黄 → 白 → 水色)
const LIGHTNING_GRADIENT = 'linear-gradient(180deg, #fff59d 0%, #ffffff 40%, #4fc3f7 100%)';
// Flowing fire for the streak chip (same mechanism as the all-clear rainbow chip)
const FIRE_FLOW = 'linear-gradient(90deg, #ff3d00, #ff9100, #ffd740, #ff9100, #ff3d00, #d50000, #ff3d00)';

function StreakPop({ text, variant = 'fire' }: { text: string; variant?: 'fire' | 'lightning' }) {
  const isLightning = variant === 'lightning';
  return (
    <Box
      sx={{
        position: 'absolute', left: '50%', top: '50%', zIndex: 25, pointerEvents: 'none',
        whiteSpace: 'nowrap',
        animation: `${streakSlam} ${isLightning ? 1.9 : 1.6}s cubic-bezier(0.2, 0.9, 0.3, 1) forwards`,
      }}
    >
      <Box
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
          // 背景の帯なしでも読めるよう、濃い縁取り + 色付きの光彩。
          // background-clip: text の要素自体に filter をかけると WebKit で崩れることがあるので外側に置く
          filter: isLightning
            ? 'drop-shadow(0 0 1px rgba(0,0,0,0.9)) drop-shadow(0 2px 2px rgba(0,0,0,0.6)) drop-shadow(0 0 10px rgba(79,195,247,0.85))'
            : 'drop-shadow(0 0 1px rgba(0,0,0,0.9)) drop-shadow(0 2px 2px rgba(0,0,0,0.6)) drop-shadow(0 0 10px rgba(255,87,34,0.8))',
        }}
      >
        {isLightning && (
          <BoltIcon sx={{ fontSize: '2rem', color: '#ffeb3b' }} />
        )}
        <Box
          sx={{
            fontFamily: '"Dela Gothic One", "Hiragino Sans", "Noto Sans JP", sans-serif',
            fontSize: '1.55rem', lineHeight: 1.1, textAlign: 'center',
            background: isLightning ? LIGHTNING_GRADIENT : FIRE_GRADIENT,
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
          }}
        >
          {text}
        </Box>
      </Box>
    </Box>
  );
}

/** 疾風迅雷: 実施時間 + 10 分までに達成したか(それより前の達成も含む) */
const ON_TIME_GRACE_MIN = 10;
function isOnTime(habit: Habit, now: Date): boolean {
  if (!habit.scheduled_time) return false;
  const [h, m] = habit.scheduled_time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return false;
  const deadline = new Date(now);
  deadline.setHours(h, m + ON_TIME_GRACE_MIN, 0, 0);
  return now.getTime() <= deadline.getTime();
}

/** "07:05:00" → "7:05" */
function formatScheduledTime(time: string): string {
  const [h, m] = time.split(':');
  return `${Number(h)}:${m}`;
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

// theme.palette is the light scheme when colorSchemes are configured, so a
// per-mode lookup is needed for anything painted from JS (not via sx tokens).
// colorSchemes is populated at runtime but absent from the Theme type.
function paperColorFor(scheme: 'light' | 'dark'): string {
  const schemes = (theme as unknown as {
    colorSchemes?: Partial<Record<'light' | 'dark', { palette: { background: { paper: string } } }>>;
  }).colorSchemes;
  return schemes?.[scheme]?.palette.background.paper ?? theme.palette.background.paper;
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
  const [celebrating, setCelebrating] = useState<{ id: string; level: 1 | 2 } | null>(null);
  const [fever, setFever] = useState(false);
  const [streakMsg, setStreakMsg] = useState<{
    id: string; text: string; variant?: 'fire' | 'lightning';
  } | null>(null);
  const [timeDialogHabit, setTimeDialogHabit] = useState<Habit | null>(null);
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
  const onTimeByHabit = new Map<string, Set<string>>();
  for (const c of completions) {
    if (!completionsByHabit.has(c.habit_id)) completionsByHabit.set(c.habit_id, new Map());
    completionsByHabit.get(c.habit_id)!.set(c.completed_date, c.intensity);
    if (c.on_time) {
      if (!onTimeByHabit.has(c.habit_id)) onTimeByHabit.set(c.habit_id, new Set());
      onTimeByHabit.get(c.habit_id)!.add(c.completed_date);
    }
  }

  const handleToggle = async (habit: Habit) => {
    setToggling(habit.id);
    const current = todayIntensity.get(habit.id) ?? 0;

    // 2-level cycle: 0(未実施) → 1(達成) → 2(ばっちり達成) → 0
    const nextIntensity = current >= 2 ? 0 : current + 1;

    const wasAllDone = habits.length > 0 && habits.every(h => completedToday.has(h.id));
    const willBeAllDone = habits.length > 0 && nextIntensity > 0
      && habits.every(h => h.id === habit.id || completedToday.has(h.id));

    // 疾風迅雷: その日の最初の達成が実施時間 + 10 分以内か
    const onTime = current === 0 && nextIntensity === 1 && isOnTime(habit, new Date());

    // Feedback fires immediately on tap — never wait for the network
    const canVibrate = typeof navigator !== 'undefined' && !!navigator.vibrate;
    if (nextIntensity > 0) {
      if (canVibrate) navigator.vibrate(nextIntensity === 2 ? [80, 30, 80, 30, 120] : 40);
      setCelebrating({ id: habit.id, level: nextIntensity === 2 ? 2 : 1 });
      setTimeout(() => setCelebrating(null), nextIntensity === 2 ? 1600 : 1100);
    }
    if (!wasAllDone && willBeAllDone) {
      if (canVibrate) navigator.vibrate([60, 40, 60, 40, 60, 40, 220]);
      setFever(true);
      setTimeout(() => setFever(false), FEVER_MS);
    }
    // First completion of the day: shout out the streak it extends
    if (current === 0 && nextIntensity === 1) {
      const before = new Set((completionsByHabit.get(habit.id) ?? new Map<string, number>()).keys());
      const after = new Set(before);
      after.add(todayStr);
      const newStreak = calculateStreak(after);
      const streakText = newStreak < 2 ? null
        : newStreak > bestStreak(before)
          ? `自己ベスト更新！ ${newStreak}日連続🔥`
          : `${newStreak}日連続！🔥`;
      // 自分の表示時間が終わったら消す(次のポップに切り替わっていたら触らない)
      const showPop = (msg: { id: string; text: string; variant?: 'fire' | 'lightning' }, ms: number) => {
        setStreakMsg(msg);
        setTimeout(() => setStreakMsg(cur => (cur === msg ? null : cur)), ms);
      };
      const showStreak = () => {
        if (!streakText) return;
        showPop({ id: habit.id, text: streakText }, 1600);
        if (canVibrate) navigator.vibrate([20, 30, 110]);
      };
      if (onTime) {
        // 「時間どおり！」→ 連続記録 の順に 1 枚ずつ見せる
        showPop({ id: habit.id, text: '時間どおり！', variant: 'lightning' }, 1900);
        if (canVibrate) navigator.vibrate([30, 20, 30, 20, 150]);
        setTimeout(showStreak, 1750);
      } else {
        showStreak();
      }
    }

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
          // 1→2 では元の on_time を引き継ぐ(DB 側も intensity だけ更新する)
          on_time: current === 0 ? onTime : prev.find(c => c.habit_id === habit.id && c.completed_date === todayStr)?.on_time,
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
        .insert({ habit_id: habit.id, completed_date: todayStr, intensity: nextIntensity, on_time: onTime });
    } else {
      await supabase
        .from('habit_completions')
        .update({ intensity: nextIntensity })
        .eq('habit_id', habit.id)
        .eq('completed_date', todayStr);
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

  const handleSaveHabitTime = async (habit: Habit, time: string | null, notify: boolean) => {
    const scheduled_time = time ? `${time}:00` : null;
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, scheduled_time, notify_enabled: notify } : h));
    setTimeDialogHabit(null);
    const { error } = await supabase
      .from('habits')
      .update({ scheduled_time, notify_enabled: notify })
      .eq('id', habit.id);
    if (error) {
      setSnackbarMsg('実施時間を保存できませんでした');
      await fetchData();
      return;
    }
    if (notify) window.HabitwwNative?.requestNotificationPermission?.();
    setSnackbarMsg(time ? `実施時間を ${formatScheduledTime(scheduled_time!)} に設定しました` : '実施時間を削除しました');
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
      {fever && <FeverOverlay colors={habits.map(h => h.color)} />}
      {/* Shared gradient for flame icons (referenced via fill: url(#fire-grad)) */}
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden focusable="false">
        <defs>
          <linearGradient id="fire-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffd54f" />
            <stop offset="45%" stopColor="#ff7043" />
            <stop offset="100%" stopColor="#d32f2f" />
          </linearGradient>
        </defs>
      </svg>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontFamily: '"Fredoka", "Roboto", sans-serif',
                fontWeight: 700,
                letterSpacing: 0.4,
                fontSize: { xs: '1.3rem', sm: '1.55rem' },
                lineHeight: 1,
                color: mode === 'dark' ? '#fff' : 'primary.main',
              }}
            >
              {page === 'habits' ? 'Habitww' : page === 'stats' ? 'Habits Insight' : 'Share Habits'}
            </Typography>
          </Box>
          {!loading && habits.length > 0 && page === 'habits' && (
            <Chip
              label={`${completedCount} / ${habits.length} 完了`}
              color={completedCount === habits.length ? 'primary' : 'default'}
              size="small"
              sx={{
                fontWeight: 600, mr: 1,
                ...(completedCount === habits.length ? {
                  background: RAINBOW, backgroundSize: '300% 100%', color: '#fff',
                  textShadow: '0 1px 1px rgba(0,0,0,0.35)',
                  animation: `${rainbowShift} 3s linear infinite`,
                } : {}),
              }}
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
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
            build {__BUILD_TIME__}
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
        {window.HabitwwNative && (
          <MenuItem
            onClick={() => { setAccountMenuAnchor(null); window.HabitwwNative?.openSettings(); }}
            sx={{ gap: 1.5, py: 1.5 }}
          >
            <NotificationsActiveIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="body2">通知・ウィジェット設定</Typography>
          </MenuItem>
        )}
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

                  const paperBg = paperColorFor(mode === 'dark' ? 'dark' : 'light');

                  return (
                    <Card
                      key={habit.id}
                      elevation={0}
                      sx={{
                        position: 'relative',
                        border: '1px solid',
                        borderColor: currentIntensity === 0 ? 'divider' : alpha(habit.color, 0.2 + currentIntensity * 0.1),
                        borderRadius: 2,
                        transition: theme.transitions.create(['border-color', 'box-shadow'], {
                          duration: theme.transitions.duration.shorter,
                        }),
                        boxShadow: currentIntensity === 0 ? 'none' : `0 0 0 ${currentIntensity + 1}px ${alpha(habit.color, currentIntensity * 0.08)}`,
                        // Level 2: the card frame flows with the same rainbow as the button
                        ...(currentIntensity === 2 ? {
                          border: '2px solid transparent',
                          background: `linear-gradient(${paperBg}, ${paperBg}) padding-box, ${RAINBOW} border-box`,
                          backgroundSize: '100% 100%, 300% 100%',
                          animation: `${rainbowShift} 3s linear infinite`,
                          boxShadow: mode === 'dark'
                            ? '0 0 14px rgba(255,255,255,0.14)'
                            : '0 2px 14px rgba(0,0,0,0.14)',
                        } : {}),
                      }}
                    >
                      {streakMsg?.id === habit.id && (
                        <StreakPop key={streakMsg.text} text={streakMsg.text} variant={streakMsg.variant} />
                      )}
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
                              // 16px 未満だと iOS がフォーカス時に画面を拡大するので、表示中の習慣名(1rem)と同じにする
                              inputProps={{ sx: { fontWeight: 700, fontSize: '1rem', py: 0.5 } }}
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
                          {habit.scheduled_time && editingHabitId !== habit.id && (
                            <Chip
                              icon={<AccessTimeIcon sx={{ fontSize: '0.85rem !important' }} />}
                              label={
                                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                                  {formatScheduledTime(habit.scheduled_time)}
                                  {habit.notify_enabled && <NotificationsIcon sx={{ fontSize: '0.75rem' }} />}
                                </Box>
                              }
                              size="small"
                              variant="outlined"
                              onClick={() => setTimeDialogHabit(habit)}
                              sx={{
                                height: 20, fontSize: '0.68rem', fontWeight: 700,
                                color: 'text.secondary', borderColor: 'divider', flexShrink: 0,
                                '& .MuiChip-icon': { color: 'text.secondary', ml: '4px' },
                                '& .MuiChip-label': { px: '6px' },
                              }}
                            />
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
                                  background: FIRE_FLOW,
                                  backgroundSize: '300% 100%',
                                  animation: `${rainbowShift} 3s linear infinite`,
                                  color: '#fff',
                                  textShadow: '0 1px 1px rgba(0,0,0,0.4)',
                                  fontWeight: 800,
                                  fontSize: '0.7rem',
                                  height: 20,
                                  boxShadow: '0 1px 6px rgba(255,61,0,0.45)',
                                  '& .MuiChip-icon': { color: '#fff8e1' },
                                  '& .MuiChip-icon path': { fill: '#fff8e1' },
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
                          onTimeDates={onTimeByHabit.get(habit.id)}
                          habitColor={habit.color}
                          onYesterdayClick={() => setYesterdayHabitTarget(habit.id)}
                        />
                      </CardContent>

                      <CardActions sx={{ px: 2, pb: 1.5, pt: 0.5, position: 'relative' }}>
                        {celebrating?.id === habit.id && (
                          <ConfettiBurst color={habit.color} count={celebrating.level === 2 ? CONFETTI_CONFIGS.length : 6} />
                        )}
                        {(() => {
                          const isCelebrating = celebrating?.id === habit.id;
                          const isDark = mode === 'dark';

                          // Same color logic as ActivityGrid getCellBg
                          const stdBg = isDark ? getStdColorDark(habit.color) : habit.color;

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
                                animation: isCelebrating ? `${bounceIn} 0.5s ease-out` : undefined,
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
                                background: RAINBOW,
                                backgroundSize: '300% 100%',
                                color: '#fff',
                                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
                                fontWeight: 800,
                                boxShadow: isDark
                                  ? '0 0 16px rgba(255,255,255,0.22), 0 2px 10px rgba(0,0,0,0.35)'
                                  : '0 2px 12px rgba(0,0,0,0.22)',
                                animation: isCelebrating
                                  ? `${rainbowShift} 3s linear infinite, ${bounceIn} 0.5s ease-out`
                                  : `${rainbowShift} 3s linear infinite`,
                                '& .MuiButton-startIcon': { filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))' },
                                '&:hover': { background: RAINBOW, backgroundSize: '300% 100%', filter: 'brightness(1.08)' },
                                '&.Mui-disabled': { background: RAINBOW, backgroundSize: '300% 100%', color: '#fff', opacity: 0.85 },
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
        <MenuItem
          onClick={() => {
            const target = habits.find(h => h.id === habitMenuTarget);
            setHabitMenuAnchor(null);
            setHabitMenuTarget(null);
            if (target) setTimeDialogHabit(target);
          }}
          sx={{ gap: 1.5, py: 1.25 }}
        >
          <AccessTimeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Box>
            <Typography variant="body2">実施時間</Typography>
            {(() => {
              const target = habits.find(h => h.id === habitMenuTarget);
              return target?.scheduled_time ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: -0.25 }}>
                  {formatScheduledTime(target.scheduled_time)}{target.notify_enabled ? ' ・通知オン' : ''}
                </Typography>
              ) : null;
            })()}
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

      {/* 実施時間ダイアログ */}
      {timeDialogHabit && (
        <Suspense fallback={null}>
          <HabitTimeDialog
            key={timeDialogHabit.id}
            habit={timeDialogHabit}
            onClose={() => setTimeDialogHabit(null)}
            onSave={(time, notify) => handleSaveHabitTime(timeDialogHabit, time, notify)}
          />
        </Suspense>
      )}

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
