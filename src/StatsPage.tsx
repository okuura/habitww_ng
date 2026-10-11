import { useEffect, useMemo } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import type { Habit, HabitCompletion } from './supabase';
import InsightCards from './InsightCards';
import { pickInsights, recentInsightIds, rememberShownInsights } from './insights';
import { HabitComparison, PersonalBestTiles } from './PersonalRecords';
import MonthlyReviewEntry from './MonthlyReview';
import HabitTimes from './HabitTimes';
import DayRhythm from './DayRhythm';
import { timedHabitIds } from './timeStats';
import { buildContext, evaluateAll, nearGoals } from './achievements';

interface StatsPageProps {
  habits: Habit[];
  completions: HabitCompletion[];
}

export default function StatsPage({ habits, completions }: StatsPageProps) {
  // 気づき・ふりかえりの計算(過去の記録から一度に。ふりかえりでその月に取ったバッジも見せる)
  const achievements = useMemo(() => {
    const ctx = buildContext(habits, completions);
    const evaluated = evaluateAll(ctx);
    // 昨日・一昨日に出した気づきは後ろに回して、毎日入れ替わるようにする
    const insights = pickInsights(ctx, recentInsightIds(ctx.todayStr));
    return { ctx, evaluated, goals: nearGoals(ctx, evaluated), insights };
  }, [habits, completions]);

  useEffect(() => {
    rememberShownInsights(achievements.ctx.todayStr, achievements.insights);
  }, [achievements]);

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
          <HabitComparison ctx={achievements.ctx} />
        </CardContent>
      </Card>

      {/* 一日のリズム */}
      {achievements.ctx.timed.length > 0 && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <DayRhythm ctx={achievements.ctx} />
          </CardContent>
        </Card>
      )}
    </Container>
  );
}
