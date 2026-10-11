import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import type { Habit, HabitCompletion } from './supabase';
import AchievementBook from './AchievementBook';
import NearGoals from './NearGoals';
import { buildContext, evaluateAll, nearGoals } from './achievements';

// 実績ページ: もうすぐ取れるバッジと、バッジ図鑑

interface AchievementsPageProps {
  habits: Habit[];
  completions: HabitCompletion[];
}

export default function AchievementsPage({ habits, completions }: AchievementsPageProps) {
  const achievements = useMemo(() => {
    const ctx = buildContext(habits, completions);
    const evaluated = evaluateAll(ctx);
    return { ctx, evaluated, goals: nearGoals(ctx, evaluated) };
  }, [habits, completions]);

  if (habits.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <EmojiEventsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            習慣を追加すると実績が表示されます
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      {achievements.goals.length > 0 && (
        <Card
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <NearGoals goals={achievements.goals} />
          </CardContent>
        </Card>
      )}

      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2 }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <AchievementBook ctx={achievements.ctx} achievements={achievements.evaluated} />
        </CardContent>
      </Card>
    </Container>
  );
}
