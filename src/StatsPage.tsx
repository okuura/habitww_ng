import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import type { Habit, HabitCompletion } from './supabase';
import InsightCards from './InsightCards';
import { pickInsights } from './insights';
import { HabitComparison, PersonalBestTiles } from './PersonalRecords';
import MonthlyReviewEntry from './MonthlyReview';
import HabitTimes from './HabitTimes';
import { timedHabitIds } from './timeStats';
import { buildContext, evaluateAll, nearGoals } from './achievements';

interface StatsPageProps {
  habits: Habit[];
  completions: HabitCompletion[];
}

const TIME_SLOTS = [
  { label: '深夜', range: '0〜5時', hours: new Set([0, 1, 2, 3, 4, 5]) },
  { label: '朝', range: '6〜11時', hours: new Set([6, 7, 8, 9, 10, 11]) },
  { label: '昼', range: '12〜17時', hours: new Set([12, 13, 14, 15, 16, 17]) },
  { label: '夜', range: '18〜23時', hours: new Set([18, 19, 20, 21, 22, 23]) },
];

export default function StatsPage({ habits, completions }: StatsPageProps) {
  const theme = useTheme();

  // 気づき・ふりかえりの計算(過去の記録から一度に。ふりかえりでその月に取ったバッジも見せる)
  const achievements = useMemo(() => {
    const ctx = buildContext(habits, completions);
    const evaluated = evaluateAll(ctx);
    return { ctx, evaluated, goals: nearGoals(ctx, evaluated), insights: pickInsights(ctx) };
  }, [habits, completions]);

  // --- Time of day ---
  const timeOfDay = useMemo(() => {
    const counts = TIME_SLOTS.map(slot => ({ ...slot, count: 0 }));
    // あとから付けた記録(付けた時刻が実施した時刻ではない)は除く
    for (const { hour } of achievements.ctx.timed) {
      for (const slot of counts) {
        if (slot.hours.has(hour)) {
          slot.count++;
          break;
        }
      }
    }
    const max = Math.max(...counts.map(s => s.count), 1);
    return counts.map(s => ({ ...s, ratio: s.count / max }));
  }, [achievements]);

  const peakSlot = useMemo(() => {
    if (achievements.ctx.timed.length === 0) return null;
    return timeOfDay.reduce((best, s) => s.count > best.count ? s : best, timeOfDay[0]);
  }, [timeOfDay, achievements]);

  if (habits.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CalendarMonthIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            習慣を追加するとデータが表示されます
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      {/* 今日の気づき */}
      {achievements.insights.length > 0 && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <InsightCards insights={achievements.insights} />
          </CardContent>
        </Card>
      )}

      {/* 先月のふりかえり(月の初めは大きく、それ以外は小さな入口) */}
      <MonthlyReviewEntry ctx={achievements.ctx} evaluated={achievements.evaluated} goals={achievements.goals} />

      {/* 自己ベスト */}
      {achievements.ctx.allCompletionDates.length > 0 && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <PersonalBestTiles ctx={achievements.ctx} />
          </CardContent>
        </Card>
      )}

      {/* 習慣くらべ */}
      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <HabitComparison habits={habits} completions={completions} />
        </CardContent>
      </Card>

      {/* Time of day */}
      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                よく行う時間帯
              </Typography>
            </Box>
            {peakSlot && peakSlot.count > 0 && (
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                {peakSlot.label}が最多
              </Typography>
            )}
          </Box>

          {achievements.ctx.timed.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center', py: 2 }}>
              記録がまだありません
            </Typography>
          ) : (
            <Stack spacing={1.25}>
              {timeOfDay.map(slot => {
                const isPeak = peakSlot?.label === slot.label && slot.count > 0;
                return (
                  <Box key={slot.label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 52, flexShrink: 0 }}>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: isPeak ? 700 : 500, color: isPeak ? 'text.primary' : 'text.secondary', display: 'block', lineHeight: 1.2 }}
                      >
                        {slot.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
                        {slot.range}
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        flex: 1, height: 10, bgcolor: 'action.hover',
                        borderRadius: 1, overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${slot.ratio * 100}%`,
                          bgcolor: isPeak ? 'primary.main' : alpha(theme.palette.primary.main, 0.45),
                          borderRadius: 1,
                          transition: theme.transitions.create('width', {
                            duration: theme.transitions.duration.standard,
                          }),
                        }}
                      />
                    </Box>

                    <Typography
                      variant="caption"
                      sx={{
                        color: isPeak ? 'text.primary' : 'text.secondary',
                        fontWeight: isPeak ? 700 : 400,
                        minWidth: 32,
                        textAlign: 'right',
                        fontSize: '0.72rem',
                      }}
                    >
                      {slot.count}回
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* 曜日ごとの実施時刻 */}
      {timedHabitIds(achievements.ctx).size > 0 && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <HabitTimes ctx={achievements.ctx} />
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
