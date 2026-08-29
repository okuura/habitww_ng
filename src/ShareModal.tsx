import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import { alpha, useTheme } from '@mui/material/styles';
import LinkIcon from '@mui/icons-material/Link';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { QRCodeSVG } from 'qrcode.react';
import type { User } from '@supabase/supabase-js';
import { supabase, type Habit, type HabitShare } from './supabase';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  habit: Habit;
  existingShare: HabitShare | undefined;
  user: User;
  onShareCreated: (share: HabitShare) => void;
  onShareDeleted: (habitId: string) => void;
}

export default function ShareModal({
  open,
  onClose,
  habit,
  existingShare,
  user,
  onShareCreated,
  onShareDeleted,
}: ShareModalProps) {
  const theme = useTheme();
  const [share, setShare] = useState<HabitShare | null>(existingShare ?? null);
  const [creating, setCreating] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stopConfirm, setStopConfirm] = useState(false);

  useEffect(() => {
    setShare(existingShare ?? null);
  }, [existingShare]);

  useEffect(() => {
    if (!open) {
      setStopConfirm(false);
      return;
    }
    if (share) return;

    const create = async () => {
      setCreating(true);
      const sharerName =
        (user.user_metadata?.name as string | undefined) ||
        user.email?.split('@')[0] ||
        'ユーザー';
      const { data, error } = await supabase
        .from('habit_shares')
        .insert({ habit_id: habit.id, sharer_name: sharerName })
        .select()
        .single();
      if (data && !error) {
        setShare(data as HabitShare);
        onShareCreated(data as HabitShare);
      }
      setCreating(false);
    };
    create();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const shareUrl = share
    ? `${window.location.origin}${window.location.pathname}?shareToken=${share.share_token}`
    : '';

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTweet = () => {
    const text = encodeURIComponent(`私の習慣「${habit.name}」の記録をシェアします！`);
    const url = encodeURIComponent(shareUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const handleStopSharing = async () => {
    if (!share) return;
    setStopping(true);
    await supabase.from('habit_shares').delete().eq('id', share.id);
    onShareDeleted(habit.id);
    setShare(null);
    setStopping(false);
    setStopConfirm(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: habit.color, flexShrink: 0 }}
              />
              Share Habits
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 400, color: 'text.secondary', mt: 0.25 }}>
              {habit.name}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ mt: -0.5, mr: -1, color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        {creating ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : share ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', textAlign: 'center', lineHeight: 1.6 }}
            >
              このQRコードを友達にスキャンしてもらうと、習慣の記録がリアルタイムで共有されます
            </Typography>

            {/* QR Code */}
            <Box
              sx={{
                bgcolor: '#fff',
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: alpha(habit.color, 0.35),
                boxShadow: `0 0 0 5px ${alpha(habit.color, 0.07)}`,
              }}
            >
              <QRCodeSVG
                value={shareUrl}
                size={200}
                bgColor="#ffffff"
                fgColor="#111111"
                level="M"
              />
            </Box>

            {/* Copy link */}
            <Button
              variant="outlined"
              size="small"
              startIcon={copied ? <CheckIcon /> : <LinkIcon />}
              onClick={handleCopyLink}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                borderColor: copied ? 'success.main' : undefined,
                color: copied ? 'success.main' : undefined,
                minWidth: 160,
              }}
            >
              {copied ? 'コピーしました！' : 'リンクをコピー'}
            </Button>

            {/* Stop sharing confirm */}
            {stopConfirm && (
              <Alert
                severity="warning"
                sx={{ borderRadius: 2, width: '100%' }}
                action={
                  <Button
                    size="small"
                    color="warning"
                    onClick={handleStopSharing}
                    disabled={stopping}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    {stopping ? '処理中…' : '停止する'}
                  </Button>
                }
              >
                QRコードが無効になり、全員の閲覧が停止されます
              </Alert>
            )}
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
        {/* Post to X */}
        <Button
          variant="contained"
          fullWidth
          startIcon={<OpenInNewIcon />}
          onClick={handleTweet}
          disabled={!share}
          sx={{
            borderRadius: 2,
            fontWeight: 700,
            textTransform: 'none',
            bgcolor: theme.palette.mode === 'dark' ? '#e7e9ea' : '#000',
            color: theme.palette.mode === 'dark' ? '#000' : '#fff',
            '&:hover': {
              bgcolor: theme.palette.mode === 'dark' ? '#d0d3d5' : '#222',
            },
          }}
        >
          X (旧Twitter) に投稿
        </Button>

        <Divider />

        {/* Stop sharing */}
        <Button
          variant="contained"
          color="error"
          fullWidth
          onClick={() => setStopConfirm(v => !v)}
          disabled={!share || stopping}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
        >
          共有をやめる
        </Button>
      </DialogActions>
    </Dialog>
  );
}
