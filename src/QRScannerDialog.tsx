import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme } from '@mui/material/styles';
import jsQR from 'jsqr';

interface QRScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onResult: (value: string) => void;
}

export default function QRScannerDialog({ open, onClose, onResult }: QRScannerDialogProps) {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const foundRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setReady(false);
    foundRef.current = false;

    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.play().then(() => {
          setReady(true);
          tick();
        });
      })
      .catch(() => {
        setError(
          'カメラへのアクセスが拒否されました。\nブラウザのカメラ許可設定を確認してください。',
        );
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || foundRef.current) return;
    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w === 0 || h === 0) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, w, h, { inversionAttempts: 'dontInvert' });
    if (code) {
      foundRef.current = true;
      onResult(code.data);
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>QRコードをスキャン</DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {error ? (
          <Box sx={{ p: 3 }}>
            <Alert severity="error" sx={{ borderRadius: 2, whiteSpace: 'pre-line' }}>
              {error}
            </Alert>
          </Box>
        ) : (
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: '1 / 1',
              bgcolor: '#000',
              overflow: 'hidden',
            }}
          >
            <video
              ref={videoRef}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              muted
              playsInline
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Overlay with scanning frame */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.35)',
              }}
            >
              {!ready && (
                <CircularProgress sx={{ color: '#fff', position: 'absolute' }} />
              )}
              {/* Scanning window */}
              <Box
                sx={{
                  width: '62%',
                  aspectRatio: '1 / 1',
                  position: 'relative',
                  boxShadow: `0 0 0 9999px rgba(0,0,0,0.45)`,
                  borderRadius: 1,
                }}
              >
                {/* Corner marks */}
                {[
                  { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 4 },
                  { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 4 },
                  { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 4 },
                  { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 4 },
                ].map((corners, i) => (
                  <Box
                    key={i}
                    sx={{
                      position: 'absolute',
                      width: 22,
                      height: 22,
                      borderStyle: 'solid',
                      borderColor: alpha(theme.palette.primary.main, 0.9),
                      borderWidth: 0,
                      ...corners,
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        )}

        <Box sx={{ px: 2.5, py: 1.5, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
            友達が表示しているQRコードを枠の中に合わせてください
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} sx={{ borderRadius: 2 }} fullWidth variant="outlined">
          閉じる
        </Button>
      </DialogActions>
    </Dialog>
  );
}
