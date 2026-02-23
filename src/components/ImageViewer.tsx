import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, RotateCw, RotateCcw, ZoomIn, ZoomOut, Maximize, Send } from 'lucide-react';

interface ImageViewerProps {
  images: { url: string; name?: string }[];
  initialIndex: number;
  onClose: () => void;
  onSendMessage?: (text: string) => Promise<void>;
  sendPlaceholder?: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;
const MAX_PAN_OVERFLOW = 100;
const DRAG_THRESHOLD = 5;

export default function ImageViewer({ images, initialIndex, onClose, onSendMessage, sendPlaceholder }: ImageViewerProps) {
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
  const imgRef = useRef<HTMLImageElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentIndexRef = useRef(currentIndex);
  const scaleRef = useRef(scale);
  currentIndexRef.current = currentIndex;
  scaleRef.current = scale;
  const [rotationScale, setRotationScale] = useState(1);

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;
  const isZoomed = scale > 1;

  const rotationScaleRef = useRef(rotationScale);
  rotationScaleRef.current = rotationScale;

  const clampPan = useCallback((offset: { x: number; y: number }, s: number) => {
    const container = imageContainerRef.current;
    const effectiveScale = rotationScaleRef.current * s;
    if (!container || effectiveScale <= 1) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const maxX = (rect.width * (effectiveScale - 1)) / 2 + MAX_PAN_OVERFLOW;
    const maxY = (rect.height * (effectiveScale - 1)) / 2 + MAX_PAN_OVERFLOW;
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

  const computeRotationScale = useCallback(() => {
    const img = imgRef.current;
    const container = imageContainerRef.current;
    if (!img || !container) return 1;
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const isSideways = normalizedRotation === 90 || normalizedRotation === 270;
    if (!isSideways) return 1;
    const contW = container.clientWidth;
    const contH = container.clientHeight;
    if (contW === 0 || contH === 0) return 1;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (natW === 0 || natH === 0) return 1;
    const normalFitW = Math.min(contW, natW);
    const normalFitH = Math.min(contH, natH);
    const normalScale = Math.min(normalFitW / natW, normalFitH / natH);
    const renderedW = natW * normalScale;
    const renderedH = natH * normalScale;
    const fitScale = Math.min(contH / renderedW, contW / renderedH);
    return Math.min(fitScale, 1);
  }, [rotation]);

  useEffect(() => {
    const newRS = computeRotationScale();
    setRotationScale(newRS);
    const handleResize = () => setRotationScale(computeRotationScale());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [rotation, currentIndex, computeRotationScale]);

  useEffect(() => {
    setRotation(0);
    setRotationScale(1);
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

  const handleSend = useCallback(async () => {
    if (!onSendMessage || !messageText.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage(messageText.trim());
      setMessageText('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
    } catch {
    } finally {
      setSending(false);
    }
  }, [onSendMessage, messageText, sending]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (inputFocused) {
        if (e.key === 'Escape') {
          inputRef.current?.blur();
          e.stopPropagation();
        }
        return;
      }
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
  }, [onClose, goPrev, goNext, zoomIn, zoomOut, resetZoom, isZoomed, inputFocused]);

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

  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleTextareaInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    setMessageText(el.value);
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 80) + 'px';
  }, []);

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95 backdrop-blur-sm animate-fade-in"
      style={{ margin: 0 }}
      onClick={handleBackdropClick}
    >
      <div className="flex items-center justify-between px-2 md:px-4 py-2 md:py-3 relative z-10" onClick={(e) => e.stopPropagation()}>
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

        <div className="flex items-center gap-0.5 md:gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all disabled:opacity-30 disabled:hover:bg-white/10"
            title="Уменьшить"
          >
            <ZoomOut className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all disabled:opacity-30 disabled:hover:bg-white/10"
            title="Увеличить"
          >
            <ZoomIn className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          {isZoomed && (
            <button
              onClick={resetZoom}
              className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
              title="Сбросить масштаб"
            >
              <Maximize className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          )}
          <div className="w-px h-5 md:h-6 bg-white/20 mx-0.5 md:mx-1" />
          <button
            onClick={() => setRotation(r => r - 90)}
            className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Повернуть влево"
          >
            <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button
            onClick={() => setRotation(r => r + 90)}
            className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Повернуть вправо"
          >
            <RotateCw className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all ml-1 md:ml-2"
            title="Закрыть"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>

      <div
        className={`flex-1 flex items-center justify-center relative overflow-hidden select-none ${onSendMessage ? 'pb-0' : ''}`}
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
            ref={imgRef}
            src={currentImage.url}
            alt={currentImage.name || 'Изображение'}
            className={`max-w-full w-auto h-auto object-contain rounded-lg ${onSendMessage ? 'max-h-[calc(100vh-160px)] md:max-h-[calc(100vh-140px)]' : 'max-h-[calc(100vh-100px)]'}`}
            style={{
              transform: `rotate(${rotation}deg) scale(${rotationScale * scale}) translate(${panOffset.x / (rotationScale * scale)}px, ${panOffset.y / (rotationScale * scale)}px)`,
              transition: isPanning || pinchStartDistRef.current !== null ? 'none' : 'transform 0.3s ease',
              transformOrigin: 'center center',
            }}
            draggable={false}
            onLoad={() => {
              const newRS = computeRotationScale();
              setRotationScale(newRS);
            }}
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

      {hasMultiple && !onSendMessage && (
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

      {onSendMessage && (
        <div
          className="relative z-10 px-3 md:px-6 py-2 md:py-3 bg-black/80 border-t border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {hasMultiple && (
            <div className="flex justify-center gap-1.5 pb-2">
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
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={messageText}
              onChange={handleTextareaInput}
              onKeyDown={handleTextareaKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={sendPlaceholder || 'Написать ответ...'}
              rows={1}
              className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-xl px-4 py-2.5 text-sm md:text-base resize-none outline-none focus:bg-white/15 focus:ring-1 focus:ring-white/30 transition-all"
              style={{ maxHeight: '80px' }}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!messageText.trim() || sending}
              className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-400 disabled:bg-white/10 disabled:text-white/30 text-white transition-all"
              title="Отправить"
            >
              <Send className={`w-5 h-5 ${sending ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
