import type { SvgIconComponent } from '@mui/icons-material';
import type { AchievementCategory, Tier } from './achievements';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StyleIcon from '@mui/icons-material/Style';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import ParkIcon from '@mui/icons-material/Park';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import BoltIcon from '@mui/icons-material/Bolt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import WbTwilightIcon from '@mui/icons-material/WbTwilight';
import BedtimeIcon from '@mui/icons-material/Bedtime';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import WeekendIcon from '@mui/icons-material/Weekend';
import CakeIcon from '@mui/icons-material/Cake';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CelebrationIcon from '@mui/icons-material/Celebration';

// バッジの絵の種類(achievements.ts の icon)ごとのアイコンと色

export const ICONS: Record<string, { Icon: SvgIconComponent; color: string }> = {
  fire: { Icon: LocalFireDepartmentIcon, color: '#f4511e' },
  trophy: { Icon: EmojiEventsIcon, color: '#e09b00' },
  'rank-bronze': { Icon: StyleIcon, color: '#a0633a' },
  'rank-silver': { Icon: StyleIcon, color: '#8e99a8' },
  'rank-gold': { Icon: StyleIcon, color: '#a88f45' },
  'rank-platinum': { Icon: StyleIcon, color: '#a9aaa8' },
  'rank-holo': { Icon: StyleIcon, color: '#8c7cf0' },
  calendar: { Icon: CalendarMonthIcon, color: '#1e88e5' },
  spring: { Icon: LocalFloristIcon, color: '#ec6f9a' },
  summer: { Icon: WbSunnyIcon, color: '#f9a825' },
  autumn: { Icon: ParkIcon, color: '#d35400' },
  winter: { Icon: AcUnitIcon, color: '#29a3d6' },
  check: { Icon: TaskAltIcon, color: '#16a085' },
  bolt: { Icon: BoltIcon, color: '#f2b400' },
  sparkle: { Icon: AutoAwesomeIcon, color: '#9c4dcc' },
  sunrise: { Icon: WbTwilightIcon, color: '#ff7a45' },
  moon: { Icon: BedtimeIcon, color: '#5363c4' },
  comeback: { Icon: AutorenewIcon, color: '#43a047' },
  weekend: { Icon: WeekendIcon, color: '#8d6e63' },
  cake: { Icon: CakeIcon, color: '#e8487f' },
  collection: { Icon: CollectionsBookmarkIcon, color: '#607d8b' },
  clock: { Icon: ScheduleIcon, color: '#7e57c2' },
  party: { Icon: CelebrationIcon, color: '#e53935' },
};

export const emblemColor = (icon: string) => (ICONS[icon] ?? ICONS.trophy).color;


// --- 形と金属 -----------------------------------------------------------------

/** カテゴリごとのバッジの形 */
export type BadgeShape = 'shield' | 'trophy' | 'card' | 'ribbon' | 'coin' | 'hexagon' | 'rosette' | 'gem' | 'star';

export const SHAPE: Record<AchievementCategory, BadgeShape> = {
  streak: 'shield',
  total: 'trophy',
  rank: 'card',
  month: 'ribbon',
  season: 'coin',
  perfectDay: 'hexagon',
  onTime: 'rosette',
  bacchiri: 'gem',
  time: 'coin',
  comeback: 'hexagon',
  anniversary: 'ribbon',
  collector: 'coin',
  secret: 'star',
};

/** 金属の縁の色(明るい→暗い)と、刻む文字の地の色 */
export const METAL: Record<Tier, { stops: string[]; dark: string; label: string }> = {
  bronze: { stops: ['#fde3c8', '#d99a62', '#a8652f', '#e7b088', '#6f421d'], dark: '#5a3415', label: '#b8743d' },
  silver: { stops: ['#ffffff', '#d5dbe3', '#9aa5b4', '#eef1f5', '#66717f'], dark: '#3f4855', label: '#8e99a8' },
  gold: { stops: ['#fff6c8', '#f2c94c', '#c48a10', '#ffe58a', '#8a5c08'], dark: '#6b4500', label: '#d4a017' },
  platinum: { stops: ['#ff9aa8', '#ffe08a', '#9af0c0', '#8ad8ff', '#c3a8ff', '#ff9ad9'], dark: '#4b4686', label: '#8c7cf0' },
};
