import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Toolbar from '@mui/material/Toolbar';
import AppBar from '@mui/material/AppBar';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';

/** Full app shell skeleton — shown during auth check */
export function AppShellSkeleton() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Skeleton width={120} height={28} />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="circular" width={32} height={32} />
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
        <Skeleton width={180} height={20} sx={{ mb: 2 }} />
        <Stack spacing={1.5}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={200} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      </Container>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 'appBar' }} elevation={3}>
        <BottomNavigation showLabels value="habits">
          <BottomNavigationAction label="記録" value="habits" icon={<CheckBoxIcon />} />
          <BottomNavigationAction label="統計" value="stats" icon={<BarChartIcon />} />
          <BottomNavigationAction label="Share Habits" value="share" icon={<PeopleAltIcon />} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

/** Stats page skeleton — matches StatsPage card layout */
export function StatsPageSkeleton() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      <Stack spacing={2}>
        {/* Ring card */}
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Skeleton width={100} height={20} sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Skeleton variant="circular" width={176} height={176} sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', maxWidth: 360 }}>
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} width={80} height={24} sx={{ borderRadius: 5 }} />
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
        {/* Dots card */}
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Skeleton width={120} height={20} sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              {[1, 2].map(i => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Skeleton width={60} height={16} />
                  <Skeleton width={52} height={16} />
                  <Skeleton variant="rounded" width="100%" height={10} sx={{ flex: 1 }} />
                  <Skeleton width={32} height={16} />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
        {/* Time of day card */}
        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Skeleton width={140} height={20} sx={{ mb: 2 }} />
            <Stack spacing={1.25}>
              {[1, 2, 3, 4].map(i => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Skeleton width={52} height={28} />
                  <Skeleton variant="rounded" width="100%" height={10} sx={{ flex: 1 }} />
                  <Skeleton width={32} height={16} />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}

/** Share page skeleton — matches ShareHabitsPage layout */
export function SharePageSkeleton() {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 1.5, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Skeleton width={160} height={20} />
        <Skeleton width={110} height={32} sx={{ borderRadius: 2 }} />
      </Box>
      <Stack spacing={1.5}>
        {[1, 2].map(i => (
          <Skeleton key={i} variant="rounded" height={180} sx={{ borderRadius: 2 }} />
        ))}
      </Stack>
    </Container>
  );
}
