import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";

interface Props {
  src: string;
  aspectRatio?: number;
  exportSize?: number;
  quality?: number;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export default function ImageCropper({
  src,
  aspectRatio = 2,
  exportSize = 1200,
  quality = 0.88,
  onConfirm,
  onCancel,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const [cropW, setCropW] = useState(0);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const cropH = cropW > 0 ? cropW / aspectRatio : 0;
  const ready = cropW > 0 && imgNatural.w > 0;

  useLayoutEffect(() => {
    if (containerRef.current) setCropW(containerRef.current.clientWidth);
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    if (cropW === 0 || imgNatural.w === 0) return;
    const ch = cropW / aspectRatio;
    const s = Math.max(cropW / imgNatural.w, ch / imgNatural.h);
    setScale(s);
    setOffset({ x: (cropW - imgNatural.w * s) / 2, y: (ch - imgNatural.h * s) / 2 });
  }, [cropW, imgNatural, aspectRatio]);

  const clamp = useCallback((ox: number, oy: number, s: number) => ({
    x: Math.min(0, Math.max(cropW - imgNatural.w * s, ox)),
    y: Math.min(0, Math.max(cropH - imgNatural.h * s, oy)),
  }), [imgNatural, cropW, cropH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !ready) return;
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, cropW, cropH);
    ctx.drawImage(img, offset.x, offset.y, imgNatural.w * scale, imgNatural.h * scale);
  }, [cropW, cropH, imgNatural, scale, offset, ready]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    setOffset(clamp(
      dragRef.current.ox + e.clientX - dragRef.current.sx,
      dragRef.current.oy + e.clientY - dragRef.current.sy,
      scale,
    ));
  };

  const handlePointerUp = () => { dragRef.current = null; };

  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img || !ready) return;
    const exportW = Math.min(Math.round(cropW * 2), exportSize);
    const exportH = Math.round(exportW / aspectRatio);
    const ec = document.createElement("canvas");
    ec.width = exportW;
    ec.height = exportH;
    const ctx = ec.getContext("2d")!;
    ctx.drawImage(img, -offset.x / scale, -offset.y / scale, cropW / scale, cropH / scale, 0, 0, exportW, exportH);
    ec.toBlob((blob) => { if (blob) onConfirm(blob); }, "image/jpeg", quality);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-box"
        style={{ padding: 0, overflow: "hidden", maxWidth: 480, width: "calc(100% - 32px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>ปรับตำแหน่งภาพ</span>
          <button className="btn btn-ghost btn-sm modal-close" onClick={onCancel}>✕</button>
        </div>

        <div ref={containerRef} style={{ position: "relative", lineHeight: 0, cursor: ready ? "grab" : "default" }}>
          {ready ? (
            <>
              <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", touchAction: "none" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.2)" }} />
                <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.2)" }} />
                <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.2)" }} />
                <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.2)" }} />
                <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,0.65)", boxSizing: "border-box" }} />
              </div>
            </>
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--slate)", fontSize: 13 }}>
              กำลังโหลด...
            </div>
          )}
        </div>

        <div style={{ padding: "6px 0 4px", borderTop: "1px solid var(--hairline)", textAlign: "center" }}>
          <span style={{ fontSize: 12, color: "var(--slate)" }}>ลากเพื่อปรับตำแหน่ง</span>
        </div>

        <div style={{ padding: "12px 16px 18px", display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>ยกเลิก</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirm} disabled={!ready}>ใช้ภาพนี้</button>
        </div>
      </div>
    </div>
  );
}
