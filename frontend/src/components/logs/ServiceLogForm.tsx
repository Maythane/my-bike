import { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createServiceLog, updateServiceLog, uploadServiceLogImage, deleteServiceLogImageById } from "../../api/logs";
import { markReminderDone } from "../../api/reminders";
import { getAllMotorcycles } from "../../api/motorcycles";
import { useGeoLocation } from "../../hooks/useGeoLocation";
import Lightbox from "../ui/Lightbox";
import type { ServiceLog, LogImage } from "../../types";

const QUICK_ITEMS = [
  "เปลี่ยนน้ำมันเครื่อง", "เปลี่ยนไส้กรองน้ำมัน", "เปลี่ยนไส้กรองอากาศ",
  "ล่อโซ่ / ปรับโซ่", "ตรวจยาง", "เปลี่ยนยาง",
  "เปลี่ยนหัวเทียน", "ตรวจเบรก", "เปลี่ยนผ้าเบรก", "ตรวจสอบทั่วไป",
];

const REMINDER_KEY_MAP: Record<string, { key: string; defaultKm: number }> = {
  "เปลี่ยนน้ำมันเครื่อง": { key: "engine_oil",  defaultKm: 3000 },
  "เปลี่ยนไส้กรองน้ำมัน": { key: "oil_filter",  defaultKm: 6000 },
  "เปลี่ยนไส้กรองอากาศ":  { key: "air_filter",  defaultKm: 8000 },
  "เปลี่ยนหัวเทียน":      { key: "spark_plug",  defaultKm: 8000 },
};

const MAX_IMAGES = 5;

interface Props {
  bikeId?: number;
  currentMileage?: number;
  onClose: () => void;
  log?: ServiceLog;
  pastLocations?: string[];
}

export default function ServiceLogForm({ bikeId, currentMileage, onClose, log, pastLocations = [] }: Props) {
  const isEdit = !!log;
  const [pickedBikeId, setPickedBikeId] = useState<number | undefined>(undefined);

  const { data: allBikes = [] } = useQuery({
    queryKey: ["motorcycles"],
    queryFn: getAllMotorcycles,
    enabled: bikeId === undefined,
  });

  const effectiveBikeId = bikeId ?? pickedBikeId;
  const pickedBike = bikeId === undefined ? allBikes.find((b) => b.id === pickedBikeId) : undefined;
  const effectiveMileage = bikeId !== undefined
    ? (currentMileage ?? 0)
    : (pickedBike?.current_mileage ?? 0);

  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const fileRef = useRef<HTMLInputElement>(null);

  const topLocations = useMemo(() => {
    if (!pastLocations.length) return [];
    const counts: Record<string, number> = {};
    for (const loc of pastLocations) {
      const key = loc.trim();
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
  }, [pastLocations]);

  const [form, setForm] = useState({
    name: log?.name ?? "",
    date_performed: log?.date_performed ?? today,
    mileage_at_service: log?.mileage_at_service ?? effectiveMileage,
    cost: log?.cost != null ? String(log.cost) : "",
    location: log?.location ?? "",
    notes: log?.notes ?? "",
  });

  const { getLocation, loading: geoLoading, geoError } = useGeoLocation((loc) => set("location", loc));

  const [reminderKm, setReminderKm] = useState<string>("");

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const existingImages: LogImage[] = (log?.images ?? []).filter(img => !removedIds.includes(img.id));
  const totalImages = existingImages.length + pendingFiles.length;
  const allPreviews = [...existingImages.map(i => i.image_path), ...pendingPreviews];

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (bikeId === undefined && pickedBike) {
      set("mileage_at_service", pickedBike.current_mileage);
    }
  }, [pickedBike?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const canAdd = Math.min(files.length, MAX_IMAGES - totalImages);
    const toAdd = files.slice(0, canAdd);
    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => setPendingPreviews(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    setPendingFiles(prev => [...prev, ...toAdd]);
    e.target.value = "";
  };

  const removePending = (i: number) => {
    setPendingFiles(prev => prev.filter((_, j) => j !== i));
    setPendingPreviews(prev => prev.filter((_, j) => j !== i));
  };

  const createMut = useMutation({
    mutationFn: async () => {
      if (!effectiveBikeId) throw new Error("No bike selected");
      const created = await createServiceLog(effectiveBikeId, {
        name: form.name.trim(),
        date_performed: form.date_performed,
        mileage_at_service: Number(form.mileage_at_service),
        cost: form.cost ? Number(form.cost) : null,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      });
      for (const file of pendingFiles) await uploadServiceLogImage(created.id, file);
      const reminderInfo = REMINDER_KEY_MAP[form.name.trim()];
      if (reminderInfo && reminderKm) {
        await markReminderDone(effectiveBikeId, reminderInfo.key, {
          mileage: Number(form.mileage_at_service),
          interval_km: Number(reminderKm),
        });
      }
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-logs", effectiveBikeId] });
      qc.invalidateQueries({ queryKey: ["motorcycle", effectiveBikeId] });
      qc.invalidateQueries({ queryKey: ["service-reminders", effectiveBikeId] });
      onClose();
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      await updateServiceLog(log!.id, {
        name: form.name.trim(),
        date_performed: form.date_performed,
        mileage_at_service: Number(form.mileage_at_service),
        cost: form.cost ? Number(form.cost) : null,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      });
      for (const id of removedIds) await deleteServiceLogImageById(id);
      for (const file of pendingFiles) await uploadServiceLogImage(log!.id, file);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service-logs", effectiveBikeId] });
      qc.invalidateQueries({ queryKey: ["motorcycle", effectiveBikeId] });
      onClose();
    },
  });

  const isPending = createMut.isPending || updateMut.isPending;
  const submit = () => (isEdit ? updateMut.mutate() : createMut.mutate());

  return (
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onPointerDownOutside={(e) => { if (lightboxIndex !== null) e.preventDefault(); }}
        onInteractOutside={(e) => { if (lightboxIndex !== null) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขรายการซ่อม" : "บันทึกการซ่อม"}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 overflow-y-auto flex-1">
        {!isEdit && (
          <div className="modal-chip-scroll" style={{ marginBottom: 18 }}>
            {QUICK_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                className={"chip" + (form.name === item ? " chip-active" : "")}
                onClick={() => {
                  const next = form.name === item ? "" : item;
                  set("name", next);
                  const info = REMINDER_KEY_MAP[next];
                  setReminderKm(info ? String(info.defaultKm) : "");
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {bikeId === undefined && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--steel)", display: "block", marginBottom: 6 }}>
              รถ
            </label>
            <select
              value={pickedBikeId ?? ""}
              onChange={(e) => setPickedBikeId(e.target.value ? Number(e.target.value) : undefined)}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: "var(--r)",
                border: "1px solid var(--hairline)", background: "var(--surface)",
                color: "var(--ink)", fontSize: 14,
              }}
            >
              <option value="">เลือกรถ...</option>
              {allBikes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nickname ?? `${b.make} ${b.model}`} ({b.current_mileage.toLocaleString()} km)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>{isEdit ? "รายการ" : "หรือพิมพ์เอง"}</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น เปลี่ยนสายพาน…" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>วันที่</label>
            <input type="date" value={form.date_performed} onChange={(e) => set("date_performed", e.target.value)} />
          </div>
          <div className="form-group">
            <label>ระยะ (km)</label>
            <input type="number" value={form.mileage_at_service} onChange={(e) => set("mileage_at_service", e.target.value)} />
          </div>
        </div>

        {!isEdit && REMINDER_KEY_MAP[form.name.trim()] && (
          <div className="form-group">
            <label>แจ้งเตือนครั้งถัดไปทุก (km)</label>
            <input
              type="number"
              value={reminderKm}
              onChange={(e) => setReminderKm(e.target.value)}
              placeholder={String(REMINDER_KEY_MAP[form.name.trim()]?.defaultKm ?? "")}
            />
          </div>
        )}

        <div className="form-group">
          <label>ค่าใช้จ่าย (฿) — ไม่บังคับ</label>
          <input type="number" step="1" value={form.cost} onChange={(e) => set("cost", e.target.value)} placeholder="350" />
        </div>

        <div className="form-group">
          <label>สถานที่ — ไม่บังคับ</label>
          {topLocations.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {topLocations.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => set("location", name)}
                  style={{
                    fontSize: 12,
                    padding: "4px 12px",
                    borderRadius: 99,
                    border: "1px solid var(--purple-border)",
                    background: form.location === name ? "var(--purple-bg)" : "transparent",
                    color: form.location === name ? "var(--ink)" : "var(--slate)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  🔧 {name}
                </button>
              ))}
            </div>
          )}
          <div className="modal-inline-row">
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="เช่น ร้านช่าง, ศูนย์บริการ…"
              style={{ flex: 1 }}
            />
            <PinButton loading={geoLoading} onClick={getLocation} />
          </div>
          {geoError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{geoError}</div>}
        </div>

        <div className="form-group">
          <label>บันทึกเพิ่มเติม — ไม่บังคับ</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="เช่น ใช้น้ำมัน 10W-40…" />
        </div>

        <div className="form-group">
          <label>รูปภาพ — ไม่บังคับ (สูงสุด {MAX_IMAGES} รูป)</label>
          <div className="modal-thumb-grid">
            {existingImages.map((img, i) => (
              <Thumb key={img.id} src={img.image_path}
                onRemove={() => setRemovedIds(prev => [...prev, img.id])}
                onPreview={() => setLightboxIndex(i)} />
            ))}
            {pendingPreviews.map((src, i) => (
              <Thumb key={`p${i}`} src={src} onRemove={() => removePending(i)}
                onPreview={() => setLightboxIndex(existingImages.length + i)} pending />
            ))}
            {totalImages < MAX_IMAGES && (
              <AddButton onClick={() => fileRef.current?.click()} />
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFiles} />
        </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>ยกเลิก</Button>
          <Button
            variant="default"
            disabled={!effectiveBikeId || !form.name.trim() || String(form.mileage_at_service) === "" || isPending}
            onClick={submit}
          >
            {isPending ? "กำลังบันทึก…" : isEdit ? "บันทึกการแก้ไข" : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {lightboxIndex !== null && createPortal(
      <Lightbox images={allPreviews} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />,
      document.body
    )}
    </>
  );
}

function PinButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title="ดึงตำแหน่งปัจจุบัน"
      style={{
        width: 40, height: 40, flexShrink: 0,
        borderRadius: "var(--r)",
        border: "1px solid var(--glass-border)",
        background: "var(--glass-bg)",
        color: loading ? "var(--muted)" : "var(--purple)",
        cursor: loading ? "default" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {loading ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.485-2.015-4.5-4.5-4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="8" cy="6" r="1.5" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

function Thumb({ src, onRemove, onPreview, pending }: {
  src: string; onRemove: () => void; onPreview: () => void; pending?: boolean;
}) {
  return (
    <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0,
      animation: "thumb-appear 0.30s cubic-bezier(0.34,1.56,0.64,1) both" }}>
      <img
        src={src} alt=""
        onClick={onPreview}
        style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, display: "block", cursor: "zoom-in",
          border: pending ? "1.5px solid var(--purple-border)" : "1px solid var(--hairline)" }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%",
          background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 13, display: "flex",
          alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", padding: 0 }}
      >×</button>
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: 80, height: 80, borderRadius: 10, border: "1.5px dashed var(--glass-border)",
        background: "var(--glass-bg)", cursor: "pointer", color: "var(--slate)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 3, flexShrink: 0,
        transition: "border-color 0.15s, background 0.15s" }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 10 }}>รูปภาพ</span>
    </button>
  );
}
