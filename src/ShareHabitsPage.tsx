import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import { alpha, useTheme } from '@mui/material/styles';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { User } from '@supabase/supabase-js';
import { supabase, type Habit, type HabitCompletion } from './supabase';
import ActivityGrid from './ActivityGrid';

interface SharedHabitView {
  viewerId: string;
  habitShareId: string;
  sharerName: string;
  habit: Habit;
  completions: HabitCompletion[];
}

interface ViewerRow {
  id: string;
  habit_share_id: string;
  habit_shares: {
    habit_id: string;
    sharer_name: string;
  };
}

interface ShareHabitsPageProps {
  user: User;
  onScanQR: () => void;
}

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calcStreak(completedDates: Set<string>): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const cursor = new Date(today);
  while (completedDates.has(toLocalDateString(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function ShareHabitsPage({ user, onScanQR }: ShareHabitsPageProps) {
  const theme = useTheme();
  const [sharedViews, setSharedViews] = useState<SharedHabitView[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSharedData = useCallback(async () => {
    const { data: viewerRows } = await supabase
      .from('shared_habit_viewers')
      .select(
        `id,
         habit_share_id,
         habit_shares (
           habit_id,
           sharer_name
         )`,
      )
      .eq('viewer_user_id', user.id)
      .order('created_at', { ascending: true });

    if (!viewerRows || viewerRows.length === 0) {
      setSharedViews([]);
      setLoading(false);
      return;
    }

    const rows = viewerRows as unknown as ViewerRow[];
    const habitIds = rows.map(r => r.habit_shares.habit_id);

    const [{ data: habits }, { data: completions }] = await Promise.all([
      supabase.from('habits').select('*').in('id', habitIds),
      supabase.from('habit_completions').select('*').in('habit_id', habitIds),
    ]);

    const views: SharedHabitView[] = rows
      .map(r => {
        const habit = habits?.find(h => h.id === r.habit_shares.habit_id);
        if (!habit) return null;
        return {
          viewerId: r.id,
          habitShareId: r.habit_share_id,
          sharerName: r.habit_shares.sharer_name,
          habit: habit as Habit,
          completions: (completions?.filter(c => c.habit_id === habit.id) ?? []) as HabitCompletion[],
        };
      })
      .filter(Boolean) as SharedHabitView[];

    setSharedViews(views);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    fetchSharedData();
  }, [fetchSharedData]);

  // Realtime: refresh when completions or shares change
  useEffect(() => {
    const channel = supabase
      .channel('share-habits-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'habit_completions' },
        fetchSharedData,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'habit_shares' },
        fetchSharedData,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSharedData]);

  const handleRemove = async (viewerId: string) => {
    await supabase.from('shared_habit_viewers').delete().eq('id', viewerId);
    setSharedViews(prev => prev.filter(v => v.viewerId !== viewerId));
  };

  const todayStr = toLocalDateString(new Date());

  return (
    <Container maxWidth="md" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          友達がシェアした習慣
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<QrCodeScannerIcon />}
          onClick={onScanQR}
          sx={{ borderRadius: 2, textTransform: 'none', flexShrink: 0 }}
        >
          QRスキャン
        </Button>
      </Box>

      {loading ? (
        <Stack spacing={1.5}>
          {[1, 2].map(i => (
            <Skeleton key={i} variant="rounded" height={180} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      ) : sharedViews.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 10,
            px: 4,
            bgcolor: 'background.paper',
            borderRadius: 3,
            border: '2px dashed',
            borderColor: 'divider',
          }}
        >
          <PeopleAltIcon sx={{ fontSize: 56, color: 'primary.light', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1 }}>
            友達の習慣を追加しよう
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
            友達が「Share Habits」でシェアしたQRコードをスキャンすると、友達の習慣の記録がここに表示されます
          </Typography>
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={onScanQR}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            QRコードをスキャン
          </Button>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {sharedViews.map(view => {
            const datesSet = new Set(view.completions.map(c => c.completed_date));
            const dateMap = new Map(view.completions.map(c => [c.completed_date, c.intensity]));
            const streak = calcStreak(datesSet);
            const totalCount = datesSet.size;
            const doneToday = datesSet.has(todayStr);

            return (
              <Card
                key={view.viewerId}
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: doneToday ? alpha(view.habit.color, 0.4) : 'divider',
                  borderRadius: 2,
                  boxShadow: doneToday
                    ? `0 0 0 3px ${alpha(view.habit.color, 0.1)}`
                    : 'none',
                  transition: theme.transitions.create(['border-color', 'box-shadow'], {
                    duration: theme.transitions.duration.shorter,
                  }),
                }}
              >
                <CardContent sx={{ pb: 1, pt: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: view.habit.color,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}
                      >
                        {view.habit.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.disabled', fontSize: '0.65rem' }}
                      >
                        {view.sharerName}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {streak > 0 && (
                        <Chip
                          icon={
                            <LocalFireDepartmentIcon sx={{ fontSize: '0.9rem !important' }} />
                          }
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
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', minWidth: 40, textAlign: 'right' }}
                      >
                        計 {totalCount}日
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleRemove(view.viewerId)}
                        sx={{
                          color: 'text.disabled',
                          '&:hover': { color: 'error.main' },
                          ml: 0.5,
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  <ActivityGrid completionsByDate={dateMap} habitColor={view.habit.color} />
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </Container>
  );
}
