import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, RotateCw, RotateCcw, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface ImageViewerProps {
  images: { url: string; name?: string }[];
  initialIndex: number;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;
const MAX_PAN_OVERFLOW = 100;
const DRAG_THRESHOLD = 5;

export default function ImageViewer({ images, initialIndex, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOffsetStartRef = useRef({ x: 0, y: 0 });
  const wasDraggingRef = useRef(false);
  const dragDistRef = useRef(0);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchDelta, setTouchDelta] = useState(0);

  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const lastTapRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(currentIndex);
  const scaleRef = useRef(scale);
  currentIndexRef.current = currentIndex;
  scaleRef.current = scale;

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;
  const isZoomed = scale > 1;

  const clampPan = useCallback((offset: { x: number; y: number }, s: number) => {
    const container = imageContainerRef.current;
    if (!container || s <= 1) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const maxX = (rect.width * (s - 1)) / 2 + MAX_PAN_OVERFLOW;
    const maxY = (rect.height * (s - 1)) / 2 + MAX_PAN_OVERFLOW;
    return {
      x: Math.max(-maxX, Math.min(maxX, offset.x)),
      y: Math.max(-maxY, Math.min(maxY, offset.y)),
    };
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPanOffset({ x: 0, y: 0 });
    setTouchStart(null);
    setTouchDelta(0);
  }, []);

  useEffect(() => {
    setRotation(0);
    resetZoom();
  }, [currentIndex, resetZoom]);

  const zoomIn = useCallback(() => {
    setScale(s => {
      const newScale = Math.min(s + ZOOM_STEP, MAX_SCALE);
      if (newScale === 1) setPanOffset({ x: 0, y: 0 });
      return newScale;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setScale(s => {
      const newScale = Math.max(s - ZOOM_STEP, MIN_SCALE);
      if (newScale === 1) setPanOffset({ x: 0, y: 0 });
      return newScale;
    });
  }, []);

  const goTo = useCallback((index: number) => {
    setCurrentIndex(index);
    setTouchDelta(0);
  }, []);

  const goPrev = useCallback(() => {
    if (currentIndexRef.current > 0) goTo(currentIndexRef.current - 1);
  }, [goTo]);

  const goNext = useCallback(() => {
    if (currentIndexRef.current < images.length - 1) goTo(currentIndexRef.current + 1);
  }, [goTo, images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': if (!isZoomed) goPrev(); break;
        case 'ArrowRight': if (!isZoomed) goNext(); break;
        case '+':
        case '=': zoomIn(); break;
        case '-': zoomOut(); break;
        case '0': resetZoom(); break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose, goPrev, goNext, zoomIn, zoomOut, resetZoom, isZoomed]);

  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      setScale(s => {
        const newScale = Math.min(Math.max(s + delta, MIN_SCALE), MAX_SCALE);
        if (newScale === 1) setPanOffset({ x: 0, y: 0 });
        return newScale;
      });
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scaleRef.current <= 1) return;
    e.preventDefault();
    setIsPanning(true);
    wasDraggingRef.current = false;
    dragDistRef.current = 0;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOffsetStartRef.current = { ...panOffset };
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > DRAG_THRESHOLD) {
      wasDraggingRef.current = true;
    }
    dragDistRef.current = dist;
    const newOffset = {
      x: panOffsetStartRef.current.x + dx,
      y: panOffsetStartRef.current.y + dy,
    };
    setPanOffset(clampPan(newOffset, scaleRef.current));
  }, [isPanning, clampPan]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
    }
  }, [isPanning]);

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStartDistRef.current = getTouchDistance(e.touches);
      pinchStartScaleRef.current = scaleRef.current;
      setTouchStart(null);
      setTouchDelta(0);
      return;
    }

    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        if (scaleRef.current > 1) {
          resetZoom();
        } else {
          setScale(2.5);
        }
        lastTapRef.current = 0;
        setTouchStart(null);
        setTouchDelta(0);
        return;
      }
      lastTapRef.current = now;

      if (scaleRef.current > 1) {
        setIsPanning(true);
        wasDraggingRef.current = false;
        dragDistRef.current = 0;
        panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        panOffsetStartRef.current = { x: panOffset.x, y: panOffset.y };
      } else {
        setTouchStart(e.touches[0].clientX);
        setTouchDelta(0);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
      e.preventDefault();
      const currentDist = getTouchDistance(e.touches);
      const ratio = currentDist / pinchStartDistRef.current;
      const newScale = Math.min(Math.max(pinchStartScaleRef.current * ratio, MIN_SCALE), MAX_SCALE);
      setScale(newScale);
      if (newScale === 1) setPanOffset({ x: 0, y: 0 });
      return;
    }

    if (e.touches.length === 1) {
      if (isPanning && scaleRef.current > 1) {
        const dx = e.touches[0].clientX - panStartRef.current.x;
        const dy = e.touches[0].clientY - panStartRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > DRAG_THRESHOLD) wasDraggingRef.current = true;
        const newOffset = {
          x: panOffsetStartRef.current.x + dx,
          y: panOffsetStartRef.current.y + dy,
        };
        setPanOffset(clampPan(newOffset, scaleRef.current));
      } else if (touchStart !== null) {
        const delta = e.touches[0].clientX - touchStart;
        setTouchDelta(delta);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pinchStartDistRef.current !== null && e.touches.length < 2) {
      pinchStartDistRef.current = null;
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      return;
    }

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

  const handleBackdropClick = useCallback(() => {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    if (isZoomed) {
      resetZoom();
    } else {
      onClose();
    }
  }, [isZoomed, resetZoom, onClose]);

  const handleImageContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
  }, []);

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-sm animate-fade-in"
      style={{ margin: 0 }}
      onClick={handleBackdropClick}
    >
      <div className="flex items-center justify-between px-4 py-3 relative z-10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {hasMultiple && (
            <span className="text-white/70 text-sm font-medium">
              {currentIndex + 1} из {images.length}
            </span>
          )}
          {isZoomed && (
            <span className="text-white/50 text-xs">
              {Math.round(scale * 100)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all disabled:opacity-30 disabled:hover:bg-white/10"
            title="Уменьшить"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all disabled:opacity-30 disabled:hover:bg-white/10"
            title="Увеличить"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          {isZoomed && (
            <button
              onClick={resetZoom}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
              title="Сбросить масштаб"
            >
              <Maximize className="w-5 h-5" />
            </button>
          )}
          <div className="w-px h-6 bg-white/20 mx-1" />
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
        onClick={handleBackdropClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {hasMultiple && currentIndex > 0 && !isZoomed && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 md:left-4 z-10 w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-all"
          >
            <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" />
          </button>
        )}

        <div
          ref={imageContainerRef}
          className="flex items-center justify-center w-full h-full px-12 md:px-16"
          onClick={handleImageContainerClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: isZoomed ? (isPanning ? 'grabbing' : 'grab') : 'default',
            transform: isZoomed ? 'none' : `translateX(${touchDelta}px)`,
            transition: touchStart !== null || isPanning ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <img
            src={currentImage.url}
            alt={currentImage.name || 'Изображение'}
            className="max-w-full max-h-[calc(100vh-100px)] w-auto h-auto object-contain rounded-lg"
            style={{
              transform: `rotate(${rotation}deg) scale(${scale}) translate(${panOffset.x / scale}px, ${panOffset.y / scale}px)`,
              transition: isPanning || pinchStartDistRef.current !== null ? 'none' : 'transform 0.3s ease',
              transformOrigin: 'center center',
            }}
            draggable={false}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (scale > 1) {
                resetZoom();
              } else {
                setScale(2.5);
              }
            }}
          />
        </div>

        {hasMultiple && currentIndex < images.length - 1 && !isZoomed && (
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
