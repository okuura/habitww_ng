import { lazy, Suspense, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import type { Habit, HabitCompletion } from './supabase';
import AchievementBook from './AchievementBook';
import AchievementDots from './AchievementDots';
import NearGoals from './NearGoals';
import { buildContext, evaluateAll, nearGoals } from './achievements';

const ToyBox = lazy(() => import('./ToyBox'));

// 実績ページ: これまでの実績(ドット)、もうすぐ取れるバッジ、バッジ図鑑

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

  // おもちゃ箱に入れるもの: 取ったバッジと、習慣ごとの月間メダル
  const toys = useMemo(() => ({
    badges: achievements.evaluated.filter(a => a.state.earned),
    medals: achievements.ctx.habits.filter(h => !h.habit.deleted_at).flatMap(h => h.perfectMonths.map(m => ({ habit: h.habit, year: m.year, month: m.month }))),
  }), [achievements]);
  // 削除した習慣は「これまでの実績」のドットには出さない(バッジの判定にだけ使う)
  const shownHabits = useMemo(() => habits.filter(h => !h.deleted_at), [habits]);
  const [toyOpen, setToyOpen] = useState(false);
  const hasToys = toys.badges.length + toys.medals.length > 0;

  if (shownHabits.length === 0) {
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
      {/* これまでの実績(overflow visible: お祝いの演出がカードの外にはみ出せるように) */}
      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2, overflow: 'visible' }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <AchievementDots habits={shownHabits} completions={completions} />
        </CardContent>
      </Card>

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
          <AchievementBook ctx={achievements.ctx} achievements={achievements.evaluated} onOpenToyBox={hasToys ? () => setToyOpen(true) : undefined} />
        </CardContent>
      </Card>

      {toyOpen && (
        <Suspense fallback={null}>
          <ToyBox badges={toys.badges} totalBadges={achievements.evaluated.length} medals={toys.medals} onClose={() => setToyOpen(false)} />
        </Suspense>
      )}
    </Container>
  );
}
