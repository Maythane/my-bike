import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReminders, updateReminders, markReminderDone, createReminder, deleteReminder } from "../api/reminders";
import { getAllMotorcycles } from "../api/motorcycles";
import type { ServiceReminder } from "../types";

const STATUS_COLOR: Record<string, string> = {
  ok:       "var(--green)",
  due_soon: "var(--accent-amber)",
  overdue:  "var(--red)",
  never:    "var(--steel)",
};

const STATUS_LABEL: Record<string, string> = {
  ok:       "ปกติ",
  due_soon: "ใกล้ถึงรอบ",
  overdue:  "เกินกำหนด",
  never:    "ยังไม่เคยบันทึก",
};

type Draft = { interval_km: number; enabled: boolean; item_name: string };

export default function ServiceRemindersPage() {
  const { bikeId } = useParams<{ bikeId: string }>();
  const id = Number(bikeId);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [confirmMileage, setConfirmMileage] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [doneError, setDoneError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newInterval, setNewInterval] = useState("3000");

  const { data: bikes = [] } = useQuery({ queryKey: ["motorcycles"], queryFn: getAllMotorcycles });
  const bike = bikes.find((b) => b.id === id);
  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["service-reminders", id],
    queryFn: () => getReminders(id),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["service-reminders", id] });

  const saveMut = useMutation({
    mutationFn: () =>
      updateReminders(id, reminders.map((r: ServiceReminder) => ({
        item_key: r.item_key,
        item_name: drafts[r.item_key]?.item_name ?? r.item_name,
        interval_km: drafts[r.item_key]?.interval_km ?? r.interval_km,
        enabled: drafts[r.item_key]?.enabled ?? r.enabled,
      }))),
    onSuccess: () => { invalidate(); setEditMode(false); setDrafts({}); setSaveError(null); },
    onError: (e: unknown) => setSaveError(String(e)),
  });

  const doneMut = useMutation({
    mutationFn: ({ itemKey, mileage }: { itemKey: string; mileage: number }) =>
      markReminderDone(id, itemKey, { mileage }),
    onSuccess: () => { invalidate(); setConfirmingKey(null); setConfirmMileage(""); setDoneError(null); },
    onError: (e: unknown) => setDoneError(String(e)),
  });

  const addMut = useMutation({
    mutationFn: () => createReminder(id, { item_name: newName.trim(), interval_km: Number(newInterval) || 3000 }),
    onSuccess: () => { invalidate(); setNewName(""); setNewInterval("3000"); },
    onError: (e: unknown) => setSaveError(String(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (itemKey: string) => deleteReminder(id, itemKey),
    onSuccess: () => invalidate(),
    onError: (e: unknown) => setSaveError(String(e)),
  });

  function enterEdit() {
    const d: Record<string, Draft> = {};
    reminders.forEach((r: ServiceReminder) => {
      d[r.item_key] = { interval_km: r.interval_km, enabled: r.enabled, item_name: r.item_name };
    });
    setDrafts(d);
    setEditMode(true);
  }

  function cancelEdit() { setDrafts({}); setEditMode(false); setSaveError(null); }

  const bikeName = bike ? (bike.nickname ?? `${bike.make} ${bike.model}`) : "…";

  return (
    <>
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Button variant="ghost" size="sm" onClick={() => {
          document.documentElement.dataset.navDir = "back";
          setTimeout(() => { delete document.documentElement.dataset.navDir; }, 500);
          navigate("/", { viewTransition: true });
        }}>← กลับ</Button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0 }}>รอบซ่อมบำรุง</h1>
          <p style={{ fontSize: 13, color: "var(--slate)", margin: "2px 0 0" }}>{bikeName}</p>
        </div>
        {!editMode ? (
          <Button size="sm" style={{ color: "var(--purple)", borderColor: "var(--purple-border)", background: "var(--purple-bg)" }}
            onClick={enterEdit}>ตั้งค่า</Button>
        ) : (
          <div style={{ display: "flex", gap: 8, flexDirection: "column", alignItems: "flex-end" }}>
            {saveError && <div style={{ fontSize: 11, color: "var(--red)", textAlign: "right" }}>{saveError}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" style={{ color: "var(--slate)" }} onClick={cancelEdit}>ยกเลิก</Button>
              <Button variant="default" size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                {saveMut.isPending ? "กำลังบันทึก…" : "บันทึก"}
              </Button>
            </div>
          </div>
        )}
      </div>

      {bike && (
        <div style={{ fontSize: 13, color: "var(--slate)", marginBottom: 16 }}>
          เลขไมล์ปัจจุบัน: <strong style={{ color: "var(--ink)" }}>{bike.current_mileage.toLocaleString()} กม.</strong>
        </div>
      )}

      {isLoading && <p style={{ color: "var(--slate)", fontSize: 14 }}>กำลังโหลด…</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {reminders.map((r: ServiceReminder) => {
          const draft = drafts[r.item_key];
          const displayEnabled = draft ? draft.enabled : r.enabled;
          const displayInterval = draft ? draft.interval_km : r.interval_km;
          const displayName = draft ? draft.item_name : r.item_name;
          const statusColor = STATUS_COLOR[r.status];

          return (
            <div key={r.item_key} className="reminder-card" style={{ opacity: displayEnabled ? 1 : 0.45 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", flex: 1 }}>{displayName}</span>
                <span className="reminder-badge" style={{ background: `${statusColor}22`, color: statusColor }}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              {r.last_done_mileage !== null && (
                <div className="reminder-bar-wrap">
                  <div className="reminder-bar-fill" style={{
                    width: `${Math.min(100, Math.max(0, ((r.interval_km - (r.km_remaining ?? 0)) / r.interval_km) * 100))}%`,
                    background: statusColor,
                  }} />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--slate)" }}>
                <span>
                  {r.last_done_mileage !== null
                    ? `ครั้งล่าสุด: ${r.last_done_mileage.toLocaleString()} กม.`
                    : "ยังไม่เคยบันทึก"}
                </span>
                <span>
                  {r.km_remaining !== null
                    ? r.km_remaining <= 0
                      ? `เกิน ${Math.abs(r.km_remaining).toLocaleString()} กม.`
                      : `อีก ${r.km_remaining.toLocaleString()} กม.`
                    : `ทุก ${r.interval_km.toLocaleString()} กม.`}
                </span>
              </div>

              {editMode && (
                <div className="reminder-edit-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={displayEnabled}
                        onChange={(e) => setDrafts((d) => ({ ...d, [r.item_key]: { ...d[r.item_key], enabled: e.target.checked } }))}
                      />
                      <span className="toggle-switch-track" />
                    </label>
                    <input
                      type="text"
                      className="reminder-name-input"
                      value={displayName}
                      onChange={(e) => setDrafts((d) => ({ ...d, [r.item_key]: { ...d[r.item_key], item_name: e.target.value } }))}
                      placeholder="ชื่อรายการ"
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--slate)", flexShrink: 0 }}>
                    <span>ทุก</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="reminder-interval-input"
                      value={displayInterval}
                      onChange={(e) => {
                        const val = Number(e.target.value.replace(/[^0-9]/g, ""));
                        if (val > 0) setDrafts((d) => ({ ...d, [r.item_key]: { ...d[r.item_key], interval_km: val } }));
                      }}
                    />
                    <span>กม.</span>
                    {r.is_custom && (
                      <Button
                        size="sm"
                        style={{ color: "var(--red)", borderColor: "transparent", background: "transparent", padding: "2px 4px", fontSize: 15 }}
                        onClick={() => deleteMut.mutate(r.item_key)}
                        disabled={deleteMut.isPending}
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {!editMode && displayEnabled && (
                <Button
                  size="sm"
                  style={{ width: "100%", marginTop: 4, color: "var(--slate)", borderColor: "var(--hairline)" }}
                  onClick={() => {
                    setConfirmingKey(r.item_key);
                    setConfirmMileage(String(bike?.current_mileage ?? ""));
                  }}
                >
                  บันทึกการเปลี่ยน / ซ่อม
                </Button>
              )}
            </div>
          );
        })}

        {editMode && (
          <div className="reminder-card" style={{ borderStyle: "dashed", opacity: 0.9 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--slate)", marginBottom: 2 }}>+ เพิ่มรายการใหม่</div>
            <input
              type="text"
              placeholder="ชื่อรายการ เช่น โซ่, ยาง"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ marginBottom: 6 }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate)" }}>
              <span>ทุก</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="reminder-interval-input"
                value={newInterval}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  setNewInterval(v);
                }}
              />
              <span>กม.</span>
              <Button
                variant="default"
                size="sm"
                style={{ marginLeft: "auto" }}
                disabled={!newName.trim() || addMut.isPending}
                onClick={() => addMut.mutate()}
              >
                {addMut.isPending ? "…" : "เพิ่ม"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>

    {confirmingKey && (() => {
      const item = reminders.find((r: ServiceReminder) => r.item_key === confirmingKey);
      return (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 24px",
          }}
          onClick={() => { setConfirmingKey(null); setConfirmMileage(""); }}
        >
          <div
            style={{
              background: "rgba(12,12,28,0.92)",
              backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--shadow-modal)",
              width: "100%", maxWidth: 320,
              padding: "24px 20px 20px",
              display: "flex", flexDirection: "column", gap: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div style={{ fontSize: 11, color: "var(--slate)", marginBottom: 4 }}>บันทึกการซ่อม</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{item?.item_name}</div>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--slate)", marginBottom: 6, display: "block" }}>เลขไมล์ที่ซ่อม (กม.)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={confirmMileage}
                onChange={(e) => setConfirmMileage(e.target.value.replace(/[^0-9]/g, ""))}
                autoFocus
              />
            </div>

            {doneError && <div style={{ fontSize: 11, color: "var(--red)" }}>{doneError}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                size="sm"
                style={{ flex: 1, color: "var(--slate)" }}
                onClick={() => { setConfirmingKey(null); setConfirmMileage(""); setDoneError(null); }}
              >
                ยกเลิก
              </Button>
              <Button
                variant="default"
                size="sm"
                style={{ flex: 1 }}
                disabled={!confirmMileage || doneMut.isPending}
                onClick={() => doneMut.mutate({ itemKey: confirmingKey!, mileage: Number(confirmMileage) })}
              >
                {doneMut.isPending ? "กำลังบันทึก…" : "ยืนยัน"}
              </Button>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}
