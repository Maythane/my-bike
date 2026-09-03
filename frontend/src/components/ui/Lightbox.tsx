import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

const CLOSE_DURATION = 200;

export default function Lightbox({ images, initialIndex, onClose }: Props) {
  const [idx, setIdx] = useState(initialIndex);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const [closing, setClosing] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  // prevent click from firing after touch on iOS
  const touchDidAct = useRef(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, CLOSE_DURATION);
  }, [onClose]);

  const prev = useCallback(() => {
    setDir("right");
    setIdx(i => Math.max(0, i - 1));
  }, []);

  const next = useCallback(() => {
    setDir("left");
    setIdx(i => Math.min(images.length - 1, i + 1));
  }, [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose, prev, next]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchDidAct.current = false;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = startX.current - e.changedTouches[0].clientX;
    const dy = startY.current - e.changedTouches[0].clientY;

    // Horizontal swipe
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      touchDidAct.current = true;
      if (dx > 0) next(); else prev();
      return;
    }

    // Tap (no movement) → close
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      e.preventDefault();
      touchDidAct.current = true;
      handleClose();
    }
  };

  // Desktop fallback — skip if touch already handled the event
  const onBackdropClick = (e: React.MouseEvent) => {
    if (touchDidAct.current) { touchDidAct.current = false; return; }
    e.stopPropagation();
    handleClose();
  };

  const btnTouchEnd = (action: () => void) => (e: React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    touchDidAct.current = true;
    action();
  };

  const imgAnimation = closing
    ? `lb-image-out ${CLOSE_DURATION}ms ease forwards`
    : dir === "left"
    ? "lb-from-right 0.22s ease"
    : dir === "right"
    ? "lb-from-left 0.22s ease"
    : "lb-image-appear 0.28s cubic-bezier(0.34,1.56,0.64,1)";

  const backdropAnimation = closing
    ? `lb-backdrop-out ${CLOSE_DURATION}ms ease forwards`
    : "lb-backdrop-in 0.20s ease";

  // position: absolute — backdrop is position:fixed inset:0 (full viewport), so
  // absolute children land at the same screen coords as fixed would. Avoids the
  // iOS Safari bug where nested position:fixed elements miss touch events.
  const btnStyle: React.CSSProperties = {
    position: "absolute",
    width: 44, height: 44, borderRadius: "50%",
    background: "rgba(255,255,255,0.15)", color: "#fff",
    border: "none", fontSize: 22, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
    WebkitTapHighlightColor: "transparent",
    zIndex: 301,
  };

  return (
    <div
      onClick={onBackdropClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={(e) => e.stopPropagation()}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 300,
        userSelect: "none",
        touchAction: "none",        // prevent iOS scroll container stealing touch
        WebkitUserSelect: "none",
        animation: backdropAnimation,
      }}
    >
      <img
        key={idx}
        src={images[idx]}
        alt=""
        style={{
          maxWidth: "92vw", maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: 10,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          animation: imgAnimation,
          pointerEvents: "none",
        }}
      />

      {/* Close */}
      <button
        onTouchEnd={btnTouchEnd(handleClose)}
        onClick={e => { e.stopPropagation(); handleClose(); }}
        style={{ ...btnStyle, top: 16, right: 16 }}
        aria-label="ปิด"
      >×</button>

      {/* Prev / Next — use vh-based top so they stay centered on any viewport */}
      {images.length > 1 && idx > 0 && (
        <button
          onTouchEnd={btnTouchEnd(prev)}
          onClick={e => { e.stopPropagation(); prev(); }}
          style={{ ...btnStyle, left: 16, top: "50vh", transform: "translateY(-50%)" }}
          aria-label="ก่อนหน้า"
        >‹</button>
      )}
      {images.length > 1 && idx < images.length - 1 && (
        <button
          onTouchEnd={btnTouchEnd(next)}
          onClick={e => { e.stopPropagation(); next(); }}
          style={{ ...btnStyle, right: 16, top: "50vh", transform: "translateY(-50%)" }}
          aria-label="ถัดไป"
        >›</button>
      )}

      {/* Dot indicators */}
      {images.length > 1 && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
          {images.map((_, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: "50%",
              background: i === idx ? "#fff" : "rgba(255,255,255,0.35)",
              transition: "background 0.2s",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}
