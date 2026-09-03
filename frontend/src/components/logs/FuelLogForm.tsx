import { useState, useRef, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createFuelLog, updateFuelLog, uploadFuelLogImage, deleteFuelLogImageById } from "../../api/fuel";
import { getAllMotorcycles } from "../../api/motorcycles";
import { useGeoLocation } from "../../hooks/useGeoLocation";
import Lightbox from "../ui/Lightbox";
import type { FuelLog, LogImage } from "../../types";

const FUEL_TYPES = ["E20", "E85", "91", "95", "ดีเซล", "อื่นๆ"];
const MAX_IMAGES = 5;

interface Props {
  bikeId?: number;
  currentMileage?: number;
  tankCapacity?: number | null;
  onClose: () => void;
  log?: FuelLog;
  pastLocations?: string[];
}

export default function FuelLogForm({ bikeId, currentMileage, tankCapacity, onClose, log, pastLocations = [] }: Props) {
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
  const effectiveTankCapacity = bikeId !== undefined
    ? (tankCapacity ?? null)
    : (pickedBike?.tank_capacity ?? null);

  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const fileRef = useRef<HTMLInputElement>(null);

  const topStations = useMemo(() => {
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
    date: log?.date ?? today,
    mileage_at_fillup: log?.mileage_at_fillup ?? effectiveMileage,
    fuel_amount: log?.fuel_amount != null ? String(log.fuel_amount) : "",
    fuel_type: log?.fuel_type ?? "E20",
    is_full_tank: log?.is_full_tank ?? true,
    cost: log?.cost != null ? String(log.cost) : "",
    price_per_liter: (log?.cost && log?.fuel_amount)
      ? (log.cost / log.fuel_amount).toFixed(2)
      : "",
    location: log?.location ?? "",
    notes: log?.notes ?? "",
  });

  const { getLocation, loading: geoLoading, geoError } = useGeoLocation((loc) => set("location", loc));

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const existingImages: LogImage[] = (log?.images ?? []).filter(img => !removedIds.includes(img.id));
  const totalImages = existingImages.length + pendingFiles.length;
  const allPreviews = [...existingImages.map(i => i.image_path), ...pendingPreviews];

  const set = (k: string, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    // If we're creating a new log and have a bike, sync the mileage if it's currently 0 or default
    if (!isEdit && (bikeId !== undefined || pickedBike)) {
      const targetMileage = bikeId !== undefined ? currentMileage : pickedBike?.current_mileage;
      if (targetMileage && (form.mileage_at_fillup === 0 || form.mileage_at_fillup === undefined)) {
        set("mileage_at_fillup", targetMileage);
      }
    }
  }, [bikeId, currentMileage, pickedBike?.id, pickedBike?.current_mileage, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFuelAmount = (val: string) => {
    const liters = parseFloat(val);
    const ppl = parseFloat(form.price_per_liter);
    setForm((f) => ({
      ...f,
      fuel_amount: val,
      cost: !isNaN(liters) && liters > 0 && !isNaN(ppl) && ppl > 0
        ? String(Math.round(liters * ppl))
        : f.cost,
    }));
  };

  const handlePricePerLiter = (val: string) => {
    const ppl = parseFloat(val);
    const liters = parseFloat(form.fuel_amount);
    setForm((f) => ({
      ...f,
      price_per_liter: val,
      cost: !isNaN(ppl) && ppl > 0 && !isNaN(liters) && liters > 0
        ? String(Math.round(liters * ppl))
        : f.cost,
    }));
  };

  const handleCost = (val: string) => {
    const cost = parseFloat(val);
    const liters = parseFloat(form.fuel_amount);
    setForm((f) => ({
      ...f,
      cost: val,
      price_per_liter: !isNaN(cost) && cost > 0 && !isNaN(liters) && liters > 0
        ? (cost / liters).toFixed(2)
        : f.price_per_liter,
    }));
  };

  const liters = parseFloat(form.fuel_amount);
  const ppl = parseFloat(form.price_per_liter);
  const calcHint = !isNaN(liters) && liters > 0 && !isNaN(ppl) && ppl > 0
    ? `${liters}L × ฿${ppl.toFixed(2)} = ฿${Math.round(liters * ppl).toLocaleString()}`
    : null;

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
      const created = await createFuelLog(effectiveBikeId, {
        date: form.date,
        mileage_at_fillup: Number(form.mileage_at_fillup),
        fuel_amount: Number(form.fuel_amount),
        fuel_type: form.fuel_type,
        is_full_tank: form.is_full_tank,
        cost: form.cost ? Number(form.cost) : null,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      });
      for (const file of pendingFiles) await uploadFuelLogImage(created.id, file);
      return created;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel-logs", effectiveBikeId] });
      qc.invalidateQueries({ queryKey: ["fuel-economy", effectiveBikeId] });
      qc.invalidateQueries({ queryKey: ["motorcycle", effectiveBikeId] });
      onClose();
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      await updateFuelLog(log!.id, {
        date: form.date,
        mileage_at_fillup: Number(form.mileage_at_fillup),
        fuel_amount: Number(form.fuel_amount),
        fuel_type: form.fuel_type,
        is_full_tank: form.is_full_tank,
        cost: form.cost ? Number(form.cost) : null,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      });
      for (const id of removedIds) await deleteFuelLogImageById(id);
      for (const file of pendingFiles) await uploadFuelLogImage(log!.id, file);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel-logs", effectiveBikeId] });
      qc.invalidateQueries({ queryKey: ["fuel-economy", effectiveBikeId] });
      qc.invalidateQueries({ queryKey: ["motorcycle", effectiveBikeId] });
      onClose();
    },
  });

  const isPending = createMut.isPending || updateMut.isPending;
  const submit = () => (isEdit ? updateMut.mutate() : createMut.mutate());
  const valid = !!effectiveBikeId && String(form.mileage_at_fillup) !== "" && form.fuel_amount && Number(form.fuel_amount) > 0;

  return (
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onPointerDownOutside={(e) => { if (lightboxIndex !== null) e.preventDefault(); }}
        onInteractOutside={(e) => { if (lightboxIndex !== null) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "แก้ไขรายการเติมน้ำมัน" : "บันทึกการเติมน้ำมัน"}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 overflow-y-auto flex-1">
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
          <label>ประเภทเชื้อเพลิง</label>
          <div className="modal-chip-scroll">
            {FUEL_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={"chip" + (form.fuel_type === t ? " chip-active" : "")}
                onClick={() => set("fuel_type", t)}
              >{t}</button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>วันที่</label>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="form-group">
            <label>ระยะที่เติม (km)</label>
            <input type="number" value={form.mileage_at_fillup} onChange={(e) => set("mileage_at_fillup", e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label>การเติม</label>
          <div className="modal-chip-scroll">
            <button
              type="button"
              className={"chip" + (form.is_full_tank ? " chip-active" : "")}
              onClick={() => set("is_full_tank", true)}
            >
              เต็มถัง{effectiveTankCapacity ? ` (${effectiveTankCapacity} L)` : ""}
            </button>
            <button
              type="button"
              className={"chip" + (!form.is_full_tank ? " chip-active" : "")}
              onClick={() => set("is_full_tank", false)}
            >
              ไม่เต็มถัง
            </button>
          </div>
          {form.is_full_tank && (
            <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 5 }}>
              km/L จะคำนวณระหว่างจุดเติมเต็มถัง 2 ครั้งติดกัน
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>จำนวน (ลิตร)</label>
            <input type="number" step="0.01" value={form.fuel_amount} onChange={(e) => handleFuelAmount(e.target.value)} placeholder="5.50" />
          </div>
          <div className="form-group">
            <label>ราคา/ลิตร (฿) <span style={{ color: "var(--steel)", fontWeight: 400 }}>— ไม่บังคับ</span></label>
            <input type="number" step="0.01" value={form.price_per_liter} onChange={(e) => handlePricePerLiter(e.target.value)} placeholder="43.00" />
          </div>
        </div>

        <div className="form-group">
          <label>รวม (฿) <span style={{ color: "var(--steel)", fontWeight: 400 }}>— ไม่บังคับ</span></label>
          <input type="number" step="1" value={form.cost} onChange={(e) => handleCost(e.target.value)} placeholder="250" />
          {calcHint && (
            <div style={{ fontSize: 11, color: "var(--accent-green)", marginTop: 5, fontWeight: 500 }}>
              = {calcHint}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>สถานที่ <span style={{ color: "var(--steel)", fontWeight: 400 }}>— ไม่บังคับ</span></label>
          {topStations.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {topStations.map((name) => (
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
                  ⛽ {name}
                </button>
              ))}
            </div>
          )}
          <div className="modal-inline-row">
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="เช่น ปั้มบางจาก, เชลล์ใกล้บ้าน…"
              style={{ flex: 1 }}
            />
            <PinButton loading={geoLoading} onClick={getLocation} />
          </div>
          {geoError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4 }}>{geoError}</div>}
        </div>

        <div className="form-group">
          <label>หมายเหตุ <span style={{ color: "var(--steel)", fontWeight: 400 }}>— ไม่บังคับ</span></label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="เช่น สังเกตประหยัดน้ำมัน, เติมช่วงราคาลด…" />
        </div>

        <div className="form-group">
          <label>รูปภาพ / ใบเสร็จ <span style={{ color: "var(--steel)", fontWeight: 400 }}>— ไม่บังคับ</span> (สูงสุด {MAX_IMAGES} รูป)</label>
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
          <Button variant="default" disabled={!valid || isPending} onClick={submit}>
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
        gap: 3, flexShrink: 0, transition: "border-color 0.15s, background 0.15s" }}
    >
      <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
      <span style={{ fontSize: 10 }}>รูปภาพ</span>
    </button>
  );
}
