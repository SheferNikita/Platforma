import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

const MAX_DURATION = 900;
const WARNING_AT = 840;
const MAX_BLOB_SIZE = 10 * 1024 * 1024;
const TIMESLICE_MS = 1000;

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  audioMimeType: string;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  isTooLarge: boolean;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const [isTooLarge, setIsTooLarge] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const warningShownRef = useRef(false);
  const recordingTimeRef = useRef(0);
  const audioUrlRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.onended = null;
        track.stop();
      });
      streamRef.current = null;
    }
  }, []);

  const revokeUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const finalizeRecording = useCallback((mimeType: string) => {
    if (chunksRef.current.length === 0) {
      toast.error('Запись пуста — аудио не было захвачено');
      return;
    }
    const blob = new Blob(chunksRef.current, { type: mimeType });
    setAudioBlob(blob);
    revokeUrl();
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    setAudioUrl(url);
    setIsTooLarge(blob.size > MAX_BLOB_SIZE);
    if (blob.size > MAX_BLOB_SIZE) {
      toast.warning('Запись очень большая. Попробуйте записать короче.');
    }
  }, [revokeUrl]);

  useEffect(() => {
    return () => {
      clearTimer();
      releaseStream();
      revokeUrl();
    };
  }, [clearTimer, releaseStream, revokeUrl]);

  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error('Ваш браузер не поддерживает запись аудио');
        return;
      }

      const { createMediaRecorder } = await import('../lib/audioRecorder');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const { recorder, mimeType } = createMediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      setAudioMimeType(mimeType);
      chunksRef.current = [];
      warningShownRef.current = false;
      recordingTimeRef.current = 0;

      revokeUrl();
      setAudioUrl(null);
      setAudioBlob(null);
      setIsTooLarge(false);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        clearTimer();
        releaseStream();
        finalizeRecording(mimeType);
      };

      recorder.onerror = () => {
        toast.error('Ошибка записи. Попробуйте ещё раз.');
        clearTimer();
        setIsRecording(false);
        setIsPaused(false);
        releaseStream();
        if (chunksRef.current.length > 0) {
          finalizeRecording(mimeType);
        }
      };

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.onended = () => {
          toast.warning('Микрофон был отключён. Запись сохранена.');
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
          setIsPaused(false);
        };
      }

      recorder.start(TIMESLICE_MS);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        const t = recordingTimeRef.current;
        setRecordingTime(t);

        if (t >= WARNING_AT && !warningShownRef.current) {
          warningShownRef.current = true;
          toast.warning('Осталась 1 минута записи');
        }

        if (t >= MAX_DURATION) {
          toast.info('Достигнут лимит записи — 15 минут');
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
          setIsPaused(false);
        }
      }, 1000);
    } catch (error) {
      releaseStream();
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          toast.error('Доступ к микрофону запрещён. Разрешите доступ в настройках браузера', { duration: 5000 });
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          toast.error('Микрофон не найден. Подключите микрофон и попробуйте снова');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          toast.error('Микрофон используется другим приложением');
        } else {
          toast.error('Не удалось получить доступ к микрофону');
        }
      } else {
        toast.error('Произошла ошибка при записи аудио');
      }
    }
  }, [clearTimer, releaseStream, finalizeRecording, revokeUrl]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && (isRecording || isPaused)) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearTimer();
    }
  }, [isRecording, isPaused, clearTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        const t = recordingTimeRef.current;
        setRecordingTime(t);

        if (t >= WARNING_AT && !warningShownRef.current) {
          warningShownRef.current = true;
          toast.warning('Осталась 1 минута записи');
        }

        if (t >= MAX_DURATION) {
          toast.info('Достигнут лимит записи — 15 минут');
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
          setIsPaused(false);
        }
      }, 1000);
    }
  }, [isPaused]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    clearTimer();
    releaseStream();
    revokeUrl();
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
    setIsPaused(false);
    setIsTooLarge(false);
    chunksRef.current = [];
    recordingTimeRef.current = 0;
  }, [clearTimer, releaseStream, revokeUrl]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    audioUrl,
    audioMimeType,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    isTooLarge,
  };
}
