import { useState, type ReactNode } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import type { User } from '@supabase/supabase-js';
import { supabase, userDisplayName } from './supabase';

// アカウントの設定。iOS アプリの「通知・ウィジェット」設定画面と同じ、
// グループ分けされた一覧のシート(上にタイトルと「完了」)

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  user: User;
  dark: boolean;
  onUserUpdated: (user: User) => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

const MAX_NAME = 30;

export default function SettingsDialog({ open, onClose, user, dark, onUserUpdated, onSignOut, onDeleteAccount }: SettingsDialogProps) {
  const theme = useTheme();
  const savedName = userDisplayName(user) ?? '';
  const [name, setName] = useState(savedName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // 開くたびに保存済みの名前から始める
  const reset = () => { setName(userDisplayName(user) ?? ''); setStatus('idle'); };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setName(savedName); return; }
    if (trimmed === savedName) return;
    setSaving(true);
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: trimmed } });
    if (!error && data.user) {
      // すでにシェア中の習慣も新しい名前で見えるようにする
      await supabase.from('habit_shares').update({ sharer_name: trimmed }).eq('user_id', user.id);
      onUserUpdated(data.user);
      setName(trimmed);
      setStatus('saved');
    } else {
      setStatus('error');
    }
    setSaving(false);
  };

  const handleClose = async () => {
    await saveName();
    onClose();
  };

  // iOS のグループ一覧の配色
  const c = dark
    ? { bg: '#000', cell: '#1c1c1e', sep: 'rgba(84,84,88,0.6)', sub: 'rgba(235,235,245,0.6)', bar: 'rgba(28,28,30,0.94)' }
    : { bg: '#f2f2f7', cell: '#fff', sep: 'rgba(60,60,67,0.18)', sub: 'rgba(60,60,67,0.6)', bar: 'rgba(249,249,249,0.94)' };
  const accent = theme.palette.primary.main;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      TransitionProps={{ onEnter: reset }}
      fullWidth maxWidth="xs"
      sx={{ '& .MuiDialog-container': { alignItems: { xs: 'flex-end', sm: 'center' } } }}
      PaperProps={{
        sx: {
          m: 0, width: '100%', maxWidth: { xs: '100%', sm: 440 },
          height: { xs: 'calc(100% - env(safe-area-inset-top, 0px) - 12px)', sm: 'auto' },
          maxHeight: { sm: 'calc(100% - 64px)' },
          borderRadius: { xs: '12px 12px 0 0', sm: '12px' },
          bgcolor: c.bg, backgroundImage: 'none', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        },
      }}
    >
      {/* ナビゲーションバー */}
      <Box
        sx={{
          position: 'relative', flexShrink: 0, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: c.bar, borderBottom: `0.5px solid ${c.sep}`,
        }}
      >
        <Typography sx={{ fontWeight: 600, fontSize: '1.0625rem' }}>設定</Typography>
        <ButtonBase
          onClick={handleClose}
          sx={{ position: 'absolute', right: 8, px: 1, py: 0.75, borderRadius: 1, color: accent, fontWeight: 600, fontSize: '1.0625rem' }}
        >
          完了
        </ButtonBase>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pt: 1, pb: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <Section
          c={c}
          header="プロフィール"
          footer={
            status === 'error'
              ? <Box component="span" sx={{ color: 'error.main' }}>名前を保存できませんでした。もう一度お試しください</Box>
              : status === 'saved'
                ? '保存しました。シェア中の習慣にも反映されます'
                : '習慣をシェアしたとき、相手に表示される名前です'
          }
        >
          <Row c={c}>
            <Typography sx={{ fontSize: '1.0625rem', flexShrink: 0 }}>ユーザー名</Typography>
            <InputBase
              value={name}
              onChange={e => { setName(e.target.value); setStatus('idle'); }}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              placeholder="名前を入力"
              inputProps={{ maxLength: MAX_NAME, 'aria-label': 'ユーザー名', autoComplete: 'nickname', enterKeyHint: 'done' }}
              // 16px 以上(iOS がフォーカス時に拡大しないように)
              sx={{ flex: 1, ml: 2, fontSize: '1.0625rem', '& input': { textAlign: 'right', color: c.sub, p: 0 } }}
            />
            {saving && <CircularProgress size={14} sx={{ ml: 1, color: c.sub }} />}
          </Row>
          {user.email && (
            <Row c={c} divider>
              <Typography sx={{ fontSize: '1.0625rem', flexShrink: 0 }}>アカウント</Typography>
              <Typography noWrap sx={{ flex: 1, ml: 2, textAlign: 'right', fontSize: '1.0625rem', color: c.sub }}>{user.email}</Typography>
            </Row>
          )}
        </Section>

        <Section c={c}>
          <Row c={c} onClick={onSignOut}>
            <Typography sx={{ fontSize: '1.0625rem', color: accent }}>ログアウト</Typography>
          </Row>
        </Section>

        <Section c={c} footer="登録したすべての習慣と記録が削除されます。この操作は取り消せません">
          <Row c={c} onClick={onDeleteAccount}>
            <Typography sx={{ fontSize: '1.0625rem', color: 'error.main' }}>アカウントを削除</Typography>
          </Row>
        </Section>

        <Section c={c}>
          <Row c={c}>
            <Typography sx={{ fontSize: '1.0625rem', flexShrink: 0 }}>ビルド</Typography>
            <Typography noWrap sx={{ flex: 1, ml: 2, textAlign: 'right', fontSize: '1.0625rem', color: c.sub }}>{__BUILD_TIME__}</Typography>
          </Row>
        </Section>
      </Box>
    </Dialog>
  );
}

type Palette = { cell: string; sep: string; sub: string };

function Section({ c, header, footer, children }: { c: Palette; header?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ mt: header ? 2.5 : 3.5 }}>
      {header && (
        <Typography sx={{ px: 2, pb: 0.75, fontSize: '0.8125rem', color: c.sub }}>{header}</Typography>
      )}
      <Box sx={{ bgcolor: c.cell, borderRadius: '10px', overflow: 'hidden' }}>{children}</Box>
      {footer && (
        <Typography sx={{ px: 2, pt: 0.75, fontSize: '0.8125rem', lineHeight: 1.4, color: c.sub }}>{footer}</Typography>
      )}
    </Box>
  );
}

function Row({ c, divider, onClick, children }: { c: Palette; divider?: boolean; onClick?: () => void; children: ReactNode }) {
  const content = (
    <Box
      sx={{
        position: 'relative', width: '100%', minHeight: 44, px: 2, py: 1.1, display: 'flex', alignItems: 'center',
        // 区切り線は左に余白を空ける(iOS の一覧と同じ)
        ...(divider ? { '&::before': { content: '""', position: 'absolute', top: 0, left: 16, right: 0, borderTop: `1px solid ${c.sep}` } } : {}),
      }}
    >
      {children}
    </Box>
  );
  return onClick
    ? <ButtonBase onClick={onClick} sx={{ width: '100%', display: 'block', textAlign: 'left', '&:active': { bgcolor: c.sep } }}>{content}</ButtonBase>
    : content;
}
