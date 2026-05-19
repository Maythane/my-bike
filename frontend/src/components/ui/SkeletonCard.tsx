export default function SkeletonCard() {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="skeleton" style={{ height: 20, width: "60%" }} />
      <div className="skeleton" style={{ height: 14, width: "40%" }} />
      <div className="skeleton" style={{ height: 6, width: "100%", marginTop: 8 }} />
    </div>
  );
}
