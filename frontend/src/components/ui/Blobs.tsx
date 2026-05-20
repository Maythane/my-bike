export default function Blobs() {
  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}
    >
      <div style={{
        position: "absolute", width: 560, height: 560,
        background: "radial-gradient(circle, rgba(57,255,150,0.55) 0%, transparent 70%)",
        filter: "blur(90px)", top: "-140px", right: "-100px",
        animation: "blob-float 13s ease-in-out infinite", opacity: 0.6,
      }} />
      <div style={{
        position: "absolute", width: 480, height: 480,
        background: "radial-gradient(circle, rgba(0,210,255,0.50) 0%, transparent 70%)",
        filter: "blur(80px)", bottom: "5%", left: "-80px",
        animation: "blob-float 17s ease-in-out infinite reverse",
        animationDelay: "-6s", opacity: 0.5,
      }} />
      <div style={{
        position: "absolute", width: 420, height: 420,
        background: "radial-gradient(circle, rgba(124,58,237,0.55) 0%, transparent 70%)",
        filter: "blur(80px)", top: "38%", left: "45%",
        transform: "translate(-50%, -50%)",
        animation: "blob-float 20s ease-in-out infinite",
        animationDelay: "-10s", opacity: 0.45,
      }} />
    </div>
  );
}
