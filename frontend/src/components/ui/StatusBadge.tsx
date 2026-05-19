import type { StatusLabel } from "../../types";

interface Props {
  label: StatusLabel;
  score: number;
}

const CONFIG = {
  good: { color: "var(--accent-green)", text: "Good" },
  due_soon: { color: "var(--accent-amber)", text: "Due Soon" },
  overdue: { color: "var(--accent-red)", text: "Overdue" },
};

export default function StatusBadge({ label, score }: Props) {
  const { color, text } = CONFIG[label];
  const pct = Math.min(score * 100, 100);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {text}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {Math.min(Math.round(score * 100), 100)}%
        </span>
      </div>
      <div style={{ height: 6, background: "var(--bg-elevated)", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            boxShadow: `0 0 6px ${color}`,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
