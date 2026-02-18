import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, RotateCw, RotateCcw } from 'lucide-react';

interface ImageViewerProps {
  images: { url: string; name?: string }[];
  initialIndex: number;
  onClose: () => void;
}

export default function ImageViewer({ images, initialIndex, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [rotation, setRotation] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAnimatingRef = useRef(false);

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  useEffect(() => {
    setRotation(0);
  }, [currentIndex]);

  const goTo = useCallback((index: number) => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    setCurrentIndex(index);
    setTouchDelta(0);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => { isAnimatingRef.current = false; }, 200);
  }, []);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) goTo(currentIndex - 1);
  }, [currentIndex, goTo]);

  const goNext = useCallback(() => {
    if (currentIndex < images.length - 1) goTo(currentIndex + 1);
  }, [currentIndex, images.length, goTo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': goPrev(); break;
        case 'ArrowRight': goNext(); break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, [onClose, goPrev, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
    setTouchDelta(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const delta = e.touches[0].clientX - touchStart;
    setTouchDelta(delta);
  };

  const handleTouchEnd = () => {
    if (touchStart === null) return;
    const threshold = 60;
    if (touchDelta > threshold) {
      goPrev();
    } else if (touchDelta < -threshold) {
      goNext();
    }
    setTouchStart(null);
    setTouchDelta(0);
  };

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-sm animate-fade-in"
      style={{ margin: 0 }}
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 relative z-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {hasMultiple && (
            <span className="text-white/70 text-sm font-medium">
              {currentIndex + 1} из {images.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setRotation(r => r - 90)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Повернуть влево"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setRotation(r => r + 90)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Повернуть вправо"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all ml-2"
            title="Закрыть"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center relative overflow-hidden select-none"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {hasMultiple && currentIndex > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 md:left-4 z-10 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-all"
          >
            <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" />
          </button>
        )}

        <div
          className="flex items-center justify-center w-full h-full px-12 md:px-16"
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `translateX(${touchDelta}px)`,
            transition: touchStart !== null ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <img
            src={currentImage.url}
            alt={currentImage.name || 'Изображение'}
            className="max-w-full max-h-[calc(100vh-100px)] w-auto h-auto object-contain rounded-lg"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: 'transform 0.3s ease',
            }}
            draggable={false}
          />
        </div>

        {hasMultiple && currentIndex < images.length - 1 && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 md:right-4 z-10 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-all"
          >
            <ChevronRight className="w-6 h-6 md:w-7 md:h-7" />
          </button>
        )}
      </div>

      {hasMultiple && (
        <div className="flex justify-center gap-1.5 pb-4" onClick={(e) => e.stopPropagation()}>
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
