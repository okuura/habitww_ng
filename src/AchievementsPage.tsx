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

/** iOS は傾き・振りのセンサーに許可が要る(ユーザー操作の中で呼ぶ)。拒否されても遊べる */
async function requestMotionPermission() {
  const w = window as unknown as Record<string, { requestPermission?: () => Promise<string> } | undefined>;
  for (const ev of [w.DeviceMotionEvent, w.DeviceOrientationEvent]) {
    if (ev && typeof ev.requestPermission === 'function') {
      try { await ev.requestPermission(); } catch { /* 許可されなくても指で遊べる */ }
    }
  }
}

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
    medals: achievements.ctx.habits.flatMap(h => h.perfectMonths.map(m => ({ habit: h.habit, year: m.year, month: m.month }))),
  }), [achievements]);
  const [toyOpen, setToyOpen] = useState(false);
  const openToyBox = async () => {
    await requestMotionPermission();
    setToyOpen(true);
  };

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
      {/* これまでの実績(overflow visible: お祝いの演出がカードの外にはみ出せるように) */}
      <Card
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 2, overflow: 'visible' }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <AchievementDots habits={habits} completions={completions} onOpenToyBox={toys.badges.length + toys.medals.length > 0 ? openToyBox : undefined} />
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
          <AchievementBook ctx={achievements.ctx} achievements={achievements.evaluated} />
        </CardContent>
      </Card>

      {toyOpen && (
        <Suspense fallback={null}>
          <ToyBox badges={toys.badges} medals={toys.medals} onClose={() => setToyOpen(false)} />
        </Suspense>
      )}
    </Container>
  );
}
