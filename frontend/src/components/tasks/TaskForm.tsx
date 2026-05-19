import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTask, createTaskFromTemplate } from "../../api/tasks";
import { getTemplates } from "../../api/templates";
import type { TaskTemplate } from "../../types";

interface Props {
  bikeId: number;
  onClose: () => void;
}

export default function TaskForm({ bikeId, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"custom" | "template">("template");
  const [form, setForm] = useState({ name: "", interval_km: "", interval_months: "", notes: "" });
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: getTemplates });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSuccess = () => {
    qc.invalidateQueries({ queryKey: ["tasks", bikeId] });
  };

  const customMut = useMutation({
    mutationFn: () =>
      createTask(bikeId, {
        name: form.name,
        interval_km: form.interval_km ? +form.interval_km : null,
        interval_months: form.interval_months ? +form.interval_months : null,
        notes: form.notes || null,
      }),
    onMutate: () => onClose(),
    onSuccess,
  });

  const templateMut = useMutation({
    mutationFn: () => createTaskFromTemplate(bikeId, selectedTemplate!),
    onMutate: () => onClose(),
    onSuccess,
  });

  const categories = [...new Set(templates.map((t: TaskTemplate) => t.category))];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Add Maintenance Task</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["template", "custom"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                background: tab === t ? "var(--accent-green)" : "var(--bg-elevated)",
                color: tab === t ? "#000" : "var(--text-primary)",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {t === "template" ? "From Template" : "Custom"}
            </button>
          ))}
        </div>

        {tab === "template" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {categories.map((cat) => (
              <div key={cat}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  {cat}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {templates
                    .filter((t: TaskTemplate) => t.category === cat)
                    .map((t: TaskTemplate) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t.id === selectedTemplate ? null : t.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          background: selectedTemplate === t.id ? "var(--accent-green)" : "var(--bg-elevated)",
                          color: selectedTemplate === t.id ? "#000" : "var(--text-primary)",
                          textAlign: "left",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 500 }}>{t.name}</span>
                          {t.model && (
                            <span style={{ fontSize: 10, color: selectedTemplate === t.id ? "inherit" : "var(--accent-green)", fontWeight: 700, textTransform: "uppercase" }}>
                              {t.model}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, opacity: 0.7 }}>
                          {[t.default_interval_km && `${t.default_interval_km.toLocaleString()} km`, t.default_interval_months && `${t.default_interval_months} mo`].filter(Boolean).join(" / ")}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!selectedTemplate || templateMut.isPending}
                onClick={() => templateMut.mutate()}
              >
                Add Task
              </button>
            </div>
          </div>
        )}

        {tab === "custom" && (
          <>
            <div className="form-group">
              <label>Task Name</label>
              <input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Oil Change" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Interval (km)</label>
                <input type="number" value={form.interval_km} onChange={(e) => set("interval_km", e.target.value)} placeholder="3000" />
              </div>
              <div className="form-group">
                <label>Interval (months)</label>
                <input type="number" value={form.interval_months} onChange={(e) => set("interval_months", e.target.value)} placeholder="6" />
              </div>
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="e.g. Use 10W-40 synthetic" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!form.name || (!form.interval_km && !form.interval_months) || customMut.isPending}
                onClick={() => customMut.mutate()}
              >
                Add Task
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
