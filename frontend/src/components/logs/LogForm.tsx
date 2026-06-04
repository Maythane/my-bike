import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import client from "../../api/client";
import type { ServiceLog } from "../../types";
import type { TaskWithStatus } from "../../types";

const createServiceLog = (bikeId: number, data: object) =>
  client.post<ServiceLog>(`/api/motorcycles/${bikeId}/service-logs`, data).then((r) => r.data);

interface Props {
  task: TaskWithStatus;
  currentMileage?: number;
  onClose: () => void;
}

export default function LogForm({ task, currentMileage, onClose }: Props) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    date_performed: today,
    mileage_at_service: currentMileage ?? task.last_service_km ?? 0,
    cost: "",
    location: "",
    notes: "",
  });

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () =>
      createServiceLog(task.motorcycle_id, {
        name: task.name,
        date_performed: form.date_performed,
        mileage_at_service: +form.mileage_at_service,
        cost: form.cost ? +form.cost : null,
        location: form.location || null,
        notes: form.notes || null,
      }),
    onMutate: () => onClose(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", task.motorcycle_id] });
      qc.invalidateQueries({ queryKey: ["service-logs", task.motorcycle_id] });
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Log: {task.name}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Date</label>
            <input type="date" value={form.date_performed} onChange={(e) => set("date_performed", e.target.value)} />
          </div>
          <div className="form-group">
            <label>Mileage at Service</label>
            <input type="number" value={form.mileage_at_service} onChange={(e) => set("mileage_at_service", +e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Cost (optional)</label>
            <input type="number" step="0.01" value={form.cost} onChange={(e) => set("cost", e.target.value)} placeholder="500.00" />
          </div>
          <div className="form-group">
            <label>Location (optional)</label>
            <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Shop name" />
          </div>
        </div>

        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Any observations..." />
        </div>

        <div className="modal-actions">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="default" disabled={mut.isPending} onClick={() => mut.mutate()}>
            Save Log
          </Button>
        </div>
      </div>
    </div>
  );
}
