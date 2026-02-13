import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  audioData: string;
  mimeType?: string;
  duration?: number;
  variant?: 'light' | 'dark';
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ audioData, mimeType, duration, variant = 'light' }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const resolvedMime = mimeType || 'audio/webm';
  const src = `data:${resolvedMime};base64,${audioData}`;

  const cleanup = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [cleanup]);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;
    const dur = audio.duration || totalDuration || 1;
    setCurrentTime(audio.currentTime);
    setProgress((audio.currentTime / dur) * 100);
    animFrameRef.current = requestAnimationFrame(updateProgress);
  }, [totalDuration]);

  const togglePlay = useCallback(() => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
      cleanup();
      return;
    }

    if (audioRef.current) {
      audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
      animFrameRef.current = requestAnimationFrame(updateProgress);
      return;
    }

    const audio = new Audio(src);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    });

    audio.addEventListener('ended', () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      cleanup();
      audioRef.current = null;
    });

    audio.addEventListener('error', () => {
      setPlaying(false);
      cleanup();
      audioRef.current = null;
    });

    audio.play().then(() => {
      setPlaying(true);
      animFrameRef.current = requestAnimationFrame(updateProgress);
    }).catch(() => {
      setPlaying(false);
      audioRef.current = null;
    });
  }, [playing, src, updateProgress, cleanup]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const dur = audio.duration || totalDuration || 1;
    audio.currentTime = pct * dur;
    setProgress(pct * 100);
    setCurrentTime(pct * dur);
  }, [totalDuration]);

  const isDark = variant === 'dark';
  const displayDuration = totalDuration || duration || 0;

  return (
    <div className={`flex items-center gap-2 min-w-[140px] max-w-[240px] ${isDark ? 'text-white' : 'text-gray-700'}`}>
      <button
        onClick={togglePlay}
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
          isDark
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-[var(--button-lavender)]/20 hover:bg-[var(--button-lavender)]/30 text-[var(--button-lavender-dark)]'
        }`}
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-0.5">
        <div
          className={`h-1.5 rounded-full cursor-pointer ${isDark ? 'bg-white/20' : 'bg-gray-200'}`}
          onClick={handleSeek}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${isDark ? 'bg-white/70' : 'bg-[var(--button-lavender)]'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`text-[10px] tabular-nums ${isDark ? 'opacity-70' : 'opacity-50'}`}>
          {playing || currentTime > 0 ? formatTime(currentTime) : formatTime(displayDuration)}
        </span>
      </div>
    </div>
  );
}
