import { useNavigate } from "react-router-dom";
import type { ServiceReminder } from "../../types";

export default function ReminderAlertBar({ bikeId, reminders }: {
  bikeId: number;
  reminders: ServiceReminder[];
}) {
  const navigate = useNavigate();
  const urgent = reminders.filter((r) => r.enabled && (r.status === "overdue" || r.status === "due_soon"));
  if (urgent.length === 0) return null;

  const overdueCount = urgent.filter((r) => r.status === "overdue").length;
  const dueSoonCount = urgent.filter((r) => r.status === "due_soon").length;

  const parts: string[] = [];
  if (overdueCount > 0) parts.push(`${overdueCount} รายการเกินกำหนด`);
  if (dueSoonCount > 0) parts.push(`${dueSoonCount} รายการใกล้ถึงรอบ`);

  const isOverdue = overdueCount > 0;

  return (
    <button
      className="reminder-alert-bar"
      style={{
        borderColor: isOverdue ? "rgba(255,90,90,0.35)" : "rgba(245,158,11,0.35)",
        background: isOverdue ? "rgba(255,90,90,0.08)" : "rgba(245,158,11,0.08)",
      }}
      onClick={() => navigate(`/bikes/${bikeId}/reminders`, { viewTransition: true })}
    >
      <span style={{ fontSize: 16 }}>{isOverdue ? "⚠️" : "🔔"}</span>
      <span style={{ fontSize: 13, color: isOverdue ? "var(--red)" : "#f59e0b", fontWeight: 500 }}>
        {parts.join(" · ")}
      </span>
      <span style={{ fontSize: 12, color: "var(--slate)", marginLeft: "auto" }}>ดูรายละเอียด →</span>
    </button>
  );
}
