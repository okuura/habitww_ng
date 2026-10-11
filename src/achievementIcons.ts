import type { SvgIconComponent } from '@mui/icons-material';
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
  'rank-bronze': { Icon: StyleIcon, color: '#b8743d' },
  'rank-silver': { Icon: StyleIcon, color: '#8e99a8' },
  'rank-gold': { Icon: StyleIcon, color: '#d4a017' },
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

