'use client';

import { Button } from '@dripplex/ui';
import { Camera, RotateCcw } from 'lucide-react';
import * as React from 'react';

interface SelfieCaptureProps {
  /** Called with a base64 JPEG (no data: URI prefix) once the driver
   * confirms a captured frame. */
  onCapture: (selfieImageBase64: string) => void;
  disabled?: boolean;
}

/**
 * Live selfie capture for Driver-001 facial verification. Camera-only by
 * design — a file picker would let a driver submit someone else's photo,
 * defeating the "authorized driver is the one going online" security goal.
 */
export function SelfieCapture({
  onCapture,
  disabled = false,
}: SelfieCaptureProps): React.JSX.Element {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const [captured, setCaptured] = React.useState<string | null>(null);

  const stopStream = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;
  }, []);

  const startCamera = React.useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError(
        "Couldn't access your camera. Check your browser's camera permission and try again.",
      );
    }
  }, []);

  React.useEffect(() => {
    if (!captured) {
      void startCamera();
    }
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captured]);

  const takePhoto = (): void => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.split(',')[1] ?? '';
    setCaptured(base64);
    stopStream();
  };

  const retake = (): void => {
    setCaptured(null);
  };

  const confirm = (): void => {
    if (captured) {
      onCapture(captured);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="border-border bg-muted relative aspect-square w-full max-w-xs overflow-hidden rounded-full border">
        {captured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/jpeg;base64,${captured}`}
            alt="Captured selfie"
            className="h-full w-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className="h-full w-full -scale-x-100 object-cover"
          />
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {cameraError ? <p className="text-destructive text-center text-xs">{cameraError}</p> : null}

      {captured ? (
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={retake} disabled={disabled}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Retake
          </Button>
          <Button type="button" onClick={confirm} disabled={disabled}>
            Use this photo
          </Button>
        </div>
      ) : (
        <Button type="button" onClick={takePhoto} disabled={disabled || !!cameraError}>
          <Camera className="h-4 w-4" aria-hidden="true" />
          Take photo
        </Button>
      )}
    </div>
  );
}
