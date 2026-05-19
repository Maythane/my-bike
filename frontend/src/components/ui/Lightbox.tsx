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

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, CLOSE_DURATION);
  }, [onClose]);

  const prev = () => {
    if (idx === 0) return;
    setDir("right");
    setIdx(i => i - 1);
  };
  const next = () => {
    if (idx === images.length - 1) return;
    setDir("left");
    setIdx(i => i + 1);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose, idx]);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = startX.current - e.changedTouches[0].clientX;
    const dy = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 40) return;
    if (dx > 0) next(); else prev();
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

  const btnStyle: React.CSSProperties = {
    position: "absolute",
    width: 40, height: 40, borderRadius: "50%",
    background: "rgba(255,255,255,0.15)", color: "#fff",
    border: "none", fontSize: 22, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    backdropFilter: "blur(4px)",
    transition: "background 0.15s, transform 0.15s",
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); handleClose(); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 300,
        userSelect: "none",
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
        onClick={e => { e.stopPropagation(); handleClose(); }}
        style={{ ...btnStyle, top: 16, right: 16, fontSize: 20 }}
      >×</button>

      {/* Prev / Next */}
      {images.length > 1 && idx > 0 && (
        <button onClick={e => { e.stopPropagation(); prev(); }} style={{ ...btnStyle, left: 16, top: "50%", transform: "translateY(-50%)" }}>‹</button>
      )}
      {images.length > 1 && idx < images.length - 1 && (
        <button onClick={e => { e.stopPropagation(); next(); }} style={{ ...btnStyle, right: 16, top: "50%", transform: "translateY(-50%)" }}>›</button>
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
