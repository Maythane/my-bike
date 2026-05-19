import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteTask } from "../../api/tasks";
import type { TaskWithStatus } from "../../types";
import LogForm from "../logs/LogForm";
import { useConfirm } from "../../hooks/useConfirm";

const STATUS_COLOR: Record<string, string> = {
  good: "var(--accent-green)",
  due_soon: "var(--accent-amber)",
  overdue: "var(--accent-red)",
};

const STATUS_LABEL: Record<string, string> = {
  good: "ปกติ",
  due_soon: "ใกล้ถึงระยะ",
  overdue: "ถึงระยะแล้ว",
};

interface Props {
  task: TaskWithStatus;
  currentMileage?: number;
}

export default function TaskRow({ task, currentMileage }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const deleteMut = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", task.motorcycle_id] }),
  });

  const { dialog, confirm } = useConfirm();

  const intervalText = [
    task.interval_km ? `ทุก ${task.interval_km.toLocaleString()} km` : null,
    task.interval_months ? `ทุก ${task.interval_months} เดือน` : null,
  ]
    .filter(Boolean)
    .join(" / ");

  const dueText = (() => {
    if (task.status_label === "overdue") {
      const parts = [];
      if (task.km_until_due !== null && task.km_until_due < 0)
        parts.push(`เกิน ${Math.abs(task.km_until_due).toLocaleString()} km`);
      if (task.days_until_due !== null && task.days_until_due < 0)
        parts.push(`เกิน ${Math.abs(task.days_until_due)} วัน`);
      return parts.join(" / ") || "ถึงระยะแล้ว";
    }
    if (task.status_label === "due_soon") {
      const parts = [];
      if (task.km_until_due !== null) parts.push(`อีก ${task.km_until_due.toLocaleString()} km`);
      if (task.days_until_due !== null) parts.push(`อีก ${task.days_until_due} วัน`);
      return parts.join(" / ");
    }
    return null;
  })();

  const statusColor = STATUS_COLOR[task.status_label];

  return (
    <>
      <div
        className="card"
        style={{ cursor: "pointer", borderLeft: `3px solid ${statusColor}` }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: statusColor,
                flexShrink: 0,
                boxShadow: `0 0 6px ${statusColor}`,
              }}
            />
            <span style={{ fontWeight: 600 }}>{task.name}</span>
          </div>
          <span style={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>
            {STATUS_LABEL[task.status_label]}
          </span>
        </div>

        <div style={{ marginTop: 4, marginLeft: 16, fontSize: 12, color: "var(--text-muted)" }}>
          {intervalText}
        </div>

        {dueText && (
          <div style={{ marginTop: 4, marginLeft: 16, fontSize: 12, color: statusColor }}>
            {dueText}
          </div>
        )}

        {expanded && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
            {task.last_service_date ? (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
                เซอร์วิสล่าสุด: {task.last_service_date} ที่ {task.last_service_km?.toLocaleString()} km
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>ยังไม่มีประวัติเซอร์วิส</div>
            )}
            {task.notes && (
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, fontStyle: "italic" }}>
                {task.notes}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, padding: "7px 14px" }}
                onClick={(e) => { e.stopPropagation(); setShowLog(true); }}
              >
                + บันทึกการเซอร์วิส
              </button>
              <button
                className="btn btn-danger"
                style={{ fontSize: 13, padding: "7px 14px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  (async () => {
                    if (await confirm(`ลบรายการ "${task.name}" ออก?`, { title: "ลบรายการ", confirmLabel: "ลบ" }))
                      deleteMut.mutate();
                  })();
                }}
              >
                ลบ
              </button>
            </div>
          </div>
        )}
      </div>

      {showLog && (
        <LogForm
          task={task}
          currentMileage={currentMileage}
          onClose={() => { setShowLog(false); qc.invalidateQueries({ queryKey: ["tasks", task.motorcycle_id] }); }}
        />
      )}
      {dialog}
    </>
  );
}
