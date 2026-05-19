import { useRef, useState } from "react";

export const RAIL_W = 130; // 65px × 2 buttons

export function useSwipeReveal() {
  const [tx, setTx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const txRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTx = useRef(0);
  const hasMoved = useRef(false);
  const dir = useRef<"h" | "v" | null>(null);

  const snap = (v: number) => {
    txRef.current = v;
    setTx(v);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    startTx.current = txRef.current;
    hasMoved.current = false;
    dir.current = null;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = startX.current - e.touches[0].clientX;
    const dy = startY.current - e.touches[0].clientY;
    if (!dir.current) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      dir.current = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
    }
    if (dir.current === "v") return;
    hasMoved.current = true;
    const next = Math.max(0, Math.min(RAIL_W, startTx.current + dx));
    txRef.current = next;
    setTx(next);
  };

  const onTouchEnd = () => {
    setDragging(false);
    if (!hasMoved.current) {
      if (txRef.current > 0) snap(0);
      return;
    }
    snap(txRef.current > RAIL_W / 3 ? RAIL_W : 0);
  };

  const close = () => snap(0);

  return { tx, dragging, onTouchStart, onTouchMove, onTouchEnd, close };
}
