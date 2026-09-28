import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme, alpha, darken } from '@mui/material/styles';
import { useRef, useEffect, useState } from 'react';

interface ActivityGridProps {
  completionsByDate: Map<string, number>; // date -> intensity (1|2)
  habitColor: string;
  onYesterdayClick?: () => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Dark mode per-level colors for 2-tier system.
// Level 1 (達成): medium color = old "しっかり達成" color
// Level 2 (ばっちり達成): bright color = old "ばっちり達成" color
function getStdColorDark(hex: string): string {
  const c = hex.toLowerCase();
  if (c === '#5e9e22') return '#48B620';
  if (c === '#2196f3') return '#2275D3';
  if (c === '#ff9800') return '#DF8B16';
  return hex;
}
function getHighColorDark(hex: string): string {
  const c = hex.toLowerCase();
  if (c === '#5e9e22') return '#85F55C';
  if (c === '#2196f3') return '#6FB0F7';
  if (c === '#ff9800') return '#FAC978';
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d > 0) {
    if (max === r) h = (((g - b) / d) % 6 + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const ns = Math.min(s + 0.15, 1);
  const nl = Math.min(l + 0.05, 0.9);
  const cv = (1 - Math.abs(2 * nl - 1)) * ns;
  const x = cv * (1 - Math.abs((h / 60) % 2 - 1));
  const m = nl - cv / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  const sec = Math.floor(h / 60) % 6;
  if (sec === 0) { r1 = cv; g1 = x; }
  else if (sec === 1) { r1 = x; g1 = cv; }
  else if (sec === 2) { g1 = cv; b1 = x; }
  else if (sec === 3) { g1 = x; b1 = cv; }
  else if (sec === 4) { r1 = x; b1 = cv; }
  else { r1 = cv; b1 = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const INTENSITY_LABELS = ['', '達成', 'ばっちり達成'];

export default function ActivityGrid({ completionsByDate, habitColor, onYesterdayClick }: ActivityGridProps) {
  const theme = useTheme();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; text: string } | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = today.getFullYear();

  const jan1 = new Date(year, 0, 1);
  const startDay = new Date(jan1);
  startDay.setDate(startDay.getDate() - startDay.getDay());

  const dec31 = new Date(year, 11, 31);
  const endDay = new Date(dec31);
  endDay.setDate(endDay.getDate() + (6 - endDay.getDay()));

  const weeks: Date[][] = [];
  const cursor = new Date(startDay);
  while (cursor <= endDay) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const monthLabels: { weekIndex: number; label: string }[] = [];
  weeks.forEach((week, i) => {
    const firstDayOfWeek = week[0];
    if (i === 0 || firstDayOfWeek.getMonth() !== weeks[i - 1][0].getMonth()) {
      if (firstDayOfWeek.getFullYear() === year || week.some(d => d.getFullYear() === year)) {
        monthLabels.push({ weekIndex: i, label: MONTHS[firstDayOfWeek.getMonth()] });
      }
    }
  });

  const CELL_SIZE = 11;
  const CELL_GAP = 2;
  const LABEL_WIDTH = 24;
  const isDark = theme.palette.mode === 'dark';

  // Level 1 (達成): medium color — same as old "しっかり達成"
  // Level 2 (ばっちり達成): bright color — same as old "ばっちり達成"
  function getStdColor(): string {
    return isDark ? getStdColorDark(habitColor) : habitColor;
  }

  function getCellBg(intensity: number): string {
    if (intensity === 0) return alpha(habitColor, 0.1);
    if (intensity === 1) return getStdColor();
    return isDark ? getHighColorDark(habitColor) : darken(habitColor, 0.48);
  }

  useEffect(() => {
    const container = scrollContainerRef.current;
    const cell = todayCellRef.current;
    if (!container || !cell) return;
    const containerRect = container.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const cellCenterRelative = cellRect.left - containerRect.left + container.scrollLeft + cellRect.width / 2;
    container.scrollLeft = cellCenterRelative - container.clientWidth / 2;
  }, []);

  return (
    <Box
      ref={scrollContainerRef}
      sx={{
        overflowX: 'auto',
        overflowY: 'hidden',
        pb: 0.5,
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
        msOverflowStyle: 'none',
        touchAction: 'pan-x pan-y',
      }}
    >
      <Box sx={{ display: 'inline-flex', flexDirection: 'column', minWidth: 'min-content' }}>
        {/* Month labels row */}
        <Box sx={{ display: 'flex', ml: `${LABEL_WIDTH}px`, mb: 0.5 }}>
          {weeks.map((_, i) => {
            const label = monthLabels.find(m => m.weekIndex === i);
            return (
              <Box
                key={i}
                sx={{ width: CELL_SIZE + CELL_GAP, flexShrink: 0, overflow: 'visible' }}
              >
                {label && (
                  <Typography
                    variant="caption"
                    sx={{ fontSize: '0.65rem', color: 'text.secondary', whiteSpace: 'nowrap', lineHeight: 1 }}
                  >
                    {label.label}
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>

        {/* Grid rows */}
        <Box sx={{ display: 'flex', gap: 0, position: 'relative' }}>
          {/* Day labels */}
          <Box sx={{ display: 'flex', flexDirection: 'column', mr: 0.5, width: LABEL_WIDTH }}>
            {DAYS.map((day, i) => (
              <Box key={day} sx={{ height: CELL_SIZE + CELL_GAP, display: 'flex', alignItems: 'center' }}>
                {(i % 2 === 1) && (
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1 }}>
                    {day}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>

          {/* Cells */}
          <Box sx={{ display: 'flex', gap: `${CELL_GAP}px` }}>
            {weeks.map((week, wi) => (
              <Box key={wi} sx={{ display: 'flex', flexDirection: 'column', gap: `${CELL_GAP}px` }}>
                {week.map((day, di) => {
                  const dateStr = toLocalDateString(day);
                  const isFuture = day > today;
                  const isOutsideYear = day.getFullYear() !== year;
                  const intensity = completionsByDate.get(dateStr) ?? 0;
                  const isCompleted = intensity > 0;
                  const isToday = dateStr === toLocalDateString(today);
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  const isYesterday = dateStr === toLocalDateString(yesterday);
                  const isYesterdayClickable = isYesterday && !isCompleted && !!onYesterdayClick;

                  let cellBg: string;
                  let cellBorder: string;

                  if (isOutsideYear) {
                    cellBg = 'transparent';
                    cellBorder = 'none';
                  } else if (isFuture) {
                    cellBg = isDark ? theme.palette.grey[800] : theme.palette.grey[200];
                    cellBorder = 'none';
                  } else if (isToday) {
                    cellBg = getCellBg(intensity);
                    cellBorder = intensity === 0 ? `1.5px solid ${getStdColor()}` : 'none';
                  } else if (isYesterdayClickable) {
                    cellBg = getCellBg(0);
                    cellBorder = `1.5px dashed ${getStdColor()}`;
                  } else {
                    cellBg = getCellBg(intensity);
                    cellBorder = 'none';
                  }

                  const intensityLabel = isCompleted ? ` - ${INTENSITY_LABELS[intensity]}` : '';
                  const tooltip = isOutsideYear
                    ? ''
                    : `${dateStr}${intensityLabel}${isYesterdayClickable ? ' (タップで登録)' : ''}`;

                  return (
                    <Box
                      key={di}
                      ref={isToday ? todayCellRef : undefined}
                      onClick={isYesterdayClickable ? onYesterdayClick : undefined}
                      onMouseEnter={!isOutsideYear ? (e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const parentRect = e.currentTarget.closest('[data-grid-container]')?.getBoundingClientRect();
                        setHoverInfo({
                          x: rect.left - (parentRect?.left ?? 0) + rect.width / 2,
                          y: rect.top - (parentRect?.top ?? 0),
                          text: tooltip,
                        });
                      } : undefined}
                      onMouseLeave={() => setHoverInfo(null)}
                      sx={{
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        borderRadius: '2px',
                        backgroundColor: cellBg,
                        border: cellBorder,
                        cursor: isYesterdayClickable ? 'pointer' : 'default',
                        transition: theme.transitions.create('background-color', {
                          duration: theme.transitions.duration.shorter,
                        }),
                        flexShrink: 0,
                        ...(isYesterdayClickable && {
                          '&:hover': { backgroundColor: alpha(habitColor, 0.3) },
                        }),
                      }}
                    />
                  );
                })}
              </Box>
            ))}
          </Box>

          {/* Lightweight hover tooltip */}
          {hoverInfo && (
            <Box
              sx={{
                position: 'absolute',
                left: hoverInfo.x,
                top: hoverInfo.y - 4,
                transform: 'translate(-50%, -100%)',
                bgcolor: 'text.primary',
                color: 'background.paper',
                px: 1,
                py: 0.25,
                borderRadius: 0.5,
                fontSize: '0.65rem',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 10,
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {hoverInfo.text}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
