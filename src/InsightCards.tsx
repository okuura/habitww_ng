import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import type { SvgIconComponent } from '@mui/icons-material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek';
import HeartBrokenIcon from '@mui/icons-material/HeartBroken';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AlarmOnIcon from '@mui/icons-material/AlarmOn';
import LinkIcon from '@mui/icons-material/Link';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HistoryIcon from '@mui/icons-material/History';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import InsightsIcon from '@mui/icons-material/Insights';
import type { Insight } from './insights';

// 気づきカード: 横にスワイプして 1 枚ずつ読む(日替わり)

const KIND: Record<Insight['kind'], { Icon: SvgIconComponent; color: string; label: string }> = {
  weekday: { Icon: CalendarViewWeekIcon, color: '#1e88e5', label: '曜日のくせ' },
  break: { Icon: HeartBrokenIcon, color: '#e53935', label: '途切れやすい日' },
  time: { Icon: ScheduleIcon, color: '#7e57c2', label: '実施する時刻' },
  schedule: { Icon: AlarmOnIcon, color: '#f9a825', label: '予定との差' },
  pair: { Icon: LinkIcon, color: '#00897b', label: '習慣どうしの関係' },
  forecast: { Icon: TrendingUpIcon, color: '#d4a017', label: 'ランクの予測' },
  memory: { Icon: HistoryIcon, color: '#ec407a', label: 'あの日の記録' },
  record: { Icon: EmojiEventsIcon, color: '#ef6c00', label: '自己ベスト' },
  activity: { Icon: InsightsIcon, color: '#43a047', label: 'これまで' },
};

export default function InsightCards({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <LightbulbIcon sx={{ color: 'warning.main', fontSize: 20 }} />
        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', flex: 1 }}>
          今日の気づき
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'flex', gap: 1.25, overflowX: 'auto', scrollSnapType: 'x mandatory',
          // カードの影が切れないよう、外側の余白の分だけはみ出させる
          mx: { xs: -2, sm: -3 }, px: { xs: 2, sm: 3 }, pb: 0.5, scrollPaddingInline: { xs: '16px', sm: '24px' },
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {insights.map(insight => {
          const { Icon, color: kindColor, label } = KIND[insight.kind];
          const color = insight.color ?? kindColor;
          return (
            <Box
              key={insight.id}
              sx={{
                flex: insights.length > 1 ? '0 0 82%' : '1 1 100%', scrollSnapAlign: 'start',
                borderRadius: 3, p: 1.75, minHeight: 112, display: 'flex', flexDirection: 'column', gap: 1,
                background: theme => `linear-gradient(135deg, ${alpha(color, theme.palette.mode === 'dark' ? 0.22 : 0.12)}, ${alpha(color, 0.03)})`,
                border: '1px solid', borderColor: alpha(color, 0.25),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: alpha(color, 0.18), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sx={{ fontSize: 16, color }} />
                </Box>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>{label}</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                {insight.parts.map((p, i) => typeof p === 'string'
                  ? <span key={i}>{p}</span>
                  : <Box key={i} component="strong" sx={{ fontWeight: 800, fontSize: '1.05rem', mx: 0.25, color: 'text.primary', borderBottom: `3px solid ${alpha(color, 0.45)}` }}>{p.em}</Box>)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </>
  );
}
