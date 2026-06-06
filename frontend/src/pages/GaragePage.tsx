import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllMotorcycles, uploadBikeImage, deleteBikeImage, deleteMotorcycle } from "../api/motorcycles";
import { getFuelLogs, deleteFuelLog, getFuelEconomy } from "../api/fuel";
import { getServiceLogs, deleteServiceLog } from "../api/logs";
import { getReminders } from "../api/reminders";
import { getShockSetting } from "../api/shock";
import { getExpenseSummary } from "../api/expenses";
import ExpenseModal from "../components/expenses/ExpenseModal";
import BikeForm from "../components/bikes/BikeForm";
import ServiceLogForm from "../components/logs/ServiceLogForm";
import FuelLogForm from "../components/logs/FuelLogForm";
import Lightbox from "../components/ui/Lightbox";
import SkeletonCard from "../components/ui/SkeletonCard";
import ImageCropper from "../components/ui/ImageCropper";
import BikeSpecs from "../components/profiles/BikeSpecs";
import { useConfirm } from "../hooks/useConfirm";
import type { ServiceLog, FuelLog } from "../types";
import { ServiceHistoryRow, FuelHistoryRow, FuelEconomyCard } from "../components/logs/LogHistoryRows";

function navForward(navigate: ReturnType<typeof useNavigate>, to: string, opts?: object) {
  delete document.documentElement.dataset.navDir;
  navigate(to, { viewTransition: true, ...opts });
}

export default function GaragePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { dialog: confirmDialog, confirm } = useConfirm();
  const photoRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [showEditBike, setShowEditBike] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [dropState, setDropState] = useState<"closed" | "open" | "closing">("closed");
  const [selectedBikeId, setSelectedBikeId] = useState<number | null>(null);
  const [logTab, setLogTab] = useState<"fuel" | "service">("fuel");
  const [showLogForm, setShowLogForm] = useState(false);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [editLog, setEditLog] = useState<ServiceLog | null>(null);
  const [editFuelLog, setEditFuelLog] = useState<FuelLog | null>(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [shockLoading, setShockLoading] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const openDrop = () => setDropState("open");
  const closeDrop = () => { setDropState("closing"); setTimeout(() => setDropState("closed"), 220); };
  const toggleDrop = () => dropState === "open" ? closeDrop() : openDrop();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (dropState !== "closed") closeDrop();
      if (fabOpen) setFabOpen(false);
      if (showOverflow) setShowOverflow(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dropState, fabOpen, showOverflow]);

  const { data: bikes, isLoading } = useQuery({
    queryKey: ["motorcycles"],
    queryFn: getAllMotorcycles,
  });

  const selectedBike =
    (selectedBikeId ? bikes?.find((b) => b.id === selectedBikeId) : null) ?? bikes?.[0];
  const bid = selectedBike?.id;
  const unit = selectedBike?.mileage_unit ?? "km";

  const { data: fuelLogs = [] } = useQuery({
    queryKey: ["fuel-logs", bid],
    queryFn: () => getFuelLogs(bid!),
    enabled: !!bid,
  });

  const { data: serviceLogs = [] } = useQuery({
    queryKey: ["service-logs", bid],
    queryFn: () => getServiceLogs(bid!),
    enabled: !!bid,
  });

  const { data: economy } = useQuery({
    queryKey: ["fuel-economy", bid],
    queryFn: () => getFuelEconomy(bid!),
    enabled: !!bid && logTab === "fuel",
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ["service-reminders", bid],
    queryFn: () => getReminders(bid!),
    enabled: !!bid,
  });

  const now = new Date();
  const { data: expenseSummary } = useQuery({
    queryKey: ["expense-summary", bid, now.getFullYear(), now.getMonth() + 1],
    queryFn: () => getExpenseSummary(bid!, now.getFullYear(), now.getMonth() + 1),
    enabled: !!bid,
  });

  const uploadImageMut = useMutation({
    mutationFn: (file: File) => uploadBikeImage(bid!, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["motorcycles"] }),
  });

  const deleteImageMut = useMutation({
    mutationFn: () => deleteBikeImage(bid!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["motorcycles"] }),
  });

  const deleteBikeMut = useMutation({
    mutationFn: () => deleteMotorcycle(bid!),
    onSuccess: () => { setSelectedBikeId(null); qc.invalidateQueries({ queryKey: ["motorcycles"] }); },
  });

  const deleteLogMut = useMutation({
    mutationFn: (id: number) => deleteServiceLog(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["service-logs", bid] }),
  });

  const deleteFuelMut = useMutation({
    mutationFn: (id: number) => deleteFuelLog(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fuel-logs", bid] });
      qc.invalidateQueries({ queryKey: ["fuel-economy", bid] });
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCropSrc(URL.createObjectURL(file));
    e.target.value = "";
  };

  async function handleShockClick() {
    if (!bid || shockLoading) return;
    setShockLoading(true);
    try {
      const setting = await getShockSetting(bid);
      localStorage.setItem("lastSelectedBikeId", String(bid));
      navForward(navigate,
        setting.shock_brand ? "/shock-settings" : `/settings/bikes/${bid}/shock`,
        { state: { from: "bike", bikeId: bid } },
      );
    } finally {
      setShockLoading(false);
    }
  }

  if (!isLoading && (!bikes || bikes.length === 0)) {
    return (
      <div className="page">
        <div style={{ marginBottom: 14 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>🏍️ โรงรถ</span>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon">🏍️</div>
          <h3>ยังไม่มีรถ</h3>
          <p>เพิ่มรถเพื่อเริ่มบันทึกประวัติการบำรุงรักษา</p>
          <Button variant="default" onClick={() => setShowForm(true)}>+ เพิ่มรถคันแรก</Button>
        </div>
        {showForm && <BikeForm onClose={() => setShowForm(false)} />}
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>🏍️ โรงรถ</span>
      </div>

      {isLoading && <div style={{ display: "flex", flexDirection: "column", gap: 10 }}><SkeletonCard /><SkeletonCard /></div>}

      {!isLoading && selectedBike && (
        <div className="bike-content-enter">
          {/* ── Bike selector dropdown ── */}
          <div
            className={`garage-selector-card${dropState !== "closed" ? " open" : ""}`}
            role="button"
            tabIndex={0}
            aria-expanded={dropState !== "closed"}
            aria-haspopup="listbox"
            aria-label={`${selectedBike.nickname ?? `${selectedBike.make} ${selectedBike.model}`} — เลือกรถ`}
            onClick={toggleDrop}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDrop(); } }}
          >
            <div className="garage-selector-header">
              <div className="garage-selector-thumb">
                {selectedBike.image_path
                  ? <img src={selectedBike.image_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 13 }} />
                  : <span style={{ fontSize: 28 }}>🏍️</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                  {selectedBike.nickname ?? `${selectedBike.make} ${selectedBike.model}`}
                </div>
                <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{selectedBike.year}</span>
                  {selectedBike.color && (
                    <><span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--steel)", flexShrink: 0, display: "inline-block" }} /><span>{selectedBike.color}</span></>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--purple)", marginTop: 5, fontVariantNumeric: "tabular-nums" }}>
                  {selectedBike.current_mileage.toLocaleString()} {unit}
                </div>
              </div>
              <div className="garage-selector-chevron" />
            </div>

            {dropState !== "closed" && (
              <div className={`garage-selector-dropdown${dropState === "closing" ? " closing" : ""}`} onClick={(e) => e.stopPropagation()}>
                {bikes?.map((bike) => (
                  <button
                    type="button"
                    key={bike.id}
                    className={`garage-selector-option${bike.id === selectedBike.id ? " active" : ""}`}
                    onClick={() => { setSelectedBikeId(bike.id); closeDrop(); }}
                  >
                    <div className="garage-selector-opt-thumb">
                      {bike.image_path
                        ? <img src={bike.image_path} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10 }} />
                        : <span style={{ fontSize: 20 }}>🏍️</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                        {bike.nickname ?? `${bike.make} ${bike.model}`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--slate)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                        {bike.year} · {bike.current_mileage.toLocaleString()} {bike.mileage_unit ?? "km"}
                      </div>
                    </div>
                    {bike.id === selectedBike.id && <span style={{ fontSize: 14, color: "var(--purple)" }}>✓</span>}
                  </button>
                ))}
                <button type="button" className="garage-selector-add" onClick={() => { closeDrop(); setShowForm(true); }}>
                  <div className="garage-selector-add-icon">＋</div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>เพิ่มรถ</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Full bike detail card ── */}
          <Card style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
            {/* Photo */}
            <div style={{ position: "relative" }}>
              {selectedBike.image_path ? (
                <div className="bike-hero-image" style={{ overflow: "hidden", background: "var(--surface)", position: "relative" }}>
                  <img src={selectedBike.image_path} alt={selectedBike.nickname ?? selectedBike.model}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)" }} />
                  <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 6 }}>
                    <button onClick={() => photoRef.current?.click()}
                      style={{ minHeight: 44, padding: "0 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", cursor: "pointer", backdropFilter: "blur(4px)", display: "inline-flex", alignItems: "center" }}>
                      เปลี่ยนรูป
                    </button>
                    <button onClick={async () => { if (await confirm("ลบรูปภาพของรถออก?", { title: "ลบรูปภาพ" })) deleteImageMut.mutate(); }}
                      style={{ minHeight: 44, padding: "0 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "rgba(220,38,38,0.72)", color: "#fff", border: "none", cursor: "pointer", backdropFilter: "blur(4px)", display: "inline-flex", alignItems: "center" }}>
                      ลบรูป
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => photoRef.current?.click()}
                  style={{ width: "100%", height: 120, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, background: "var(--glass-bg)", border: "none", borderBottom: "1px dashed var(--glass-border)", cursor: "pointer", color: "var(--slate)", fontSize: 13 }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                    <circle cx="12" cy="13" r="3"/>
                  </svg>
                  <span>เพิ่มรูปรถ</span>
                </button>
              )}
              <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
            </div>

            <div style={{ padding: "18px 20px 0" }}>
              <div className="flex justify-between items-start gap-3 mb-[18px] max-sm:flex-col max-sm:mb-[14px]">
                <div>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.3px", marginBottom: 3 }}>
                    {selectedBike.nickname ?? `${selectedBike.make} ${selectedBike.model}`}
                  </h1>
                  <div style={{ fontSize: 13, color: "var(--slate)" }}>
                    {selectedBike.nickname ? `${selectedBike.make} ${selectedBike.model} · ` : ""}{selectedBike.year}
                    {selectedBike.engine_cc ? ` · ${selectedBike.engine_cc} cc` : ""}
                    {selectedBike.license_plate ? ` · ${selectedBike.license_plate}` : ""}
                  </div>
                </div>
                <div className="flex gap-1.5 max-sm:w-full">
                  <Button variant="ghost" size="sm" onClick={() => setShowEditBike(true)}>แก้ไข</Button>
                  <Button variant="destructive" size="sm" className="max-sm:hidden"
                    onClick={async () => {
                      if (await confirm(`ข้อมูลรถและประวัติการบำรุงรักษาทั้งหมดจะถูกลบด้วย`, { title: `ลบรถ "${selectedBike.nickname ?? selectedBike.model}"?`, confirmLabel: "ลบรถ" }))
                        deleteBikeMut.mutate();
                    }}>ลบ</Button>
                  <div className="bike-overflow-wrap hidden max-sm:block shrink-0">
                    <Button variant="ghost" size="sm" className="bike-overflow-btn" onClick={() => setShowOverflow((v) => !v)} aria-label="เมนูเพิ่มเติม">⋮</Button>
                    {showOverflow && (
                      <>
                        <div className="bike-overflow-backdrop" onClick={() => setShowOverflow(false)} />
                        <div className="bike-overflow-menu">
                          <button className="bike-overflow-item bike-overflow-danger"
                            onClick={async () => {
                              setShowOverflow(false);
                              if (await confirm(`ข้อมูลรถและประวัติการบำรุงรักษาทั้งหมดจะถูกลบด้วย`, { title: `ลบรถ "${selectedBike.nickname ?? selectedBike.model}"?`, confirmLabel: "ลบรถ" }))
                                deleteBikeMut.mutate();
                            }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                            ลบรถคันนี้
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-6 flex-wrap pb-[18px] border-b border-[var(--hairline)] mb-[18px] max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-4 max-sm:gap-y-3 max-sm:pb-[14px] max-sm:mb-[14px]">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Odometer</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>
                    {selectedBike.current_mileage.toLocaleString()}
                    <span style={{ fontSize: 13, fontWeight: 400, color: "var(--slate)", marginLeft: 5 }}>{unit}</span>
                  </div>
                </div>
                {selectedBike.tank_capacity && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>ถัง</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{selectedBike.tank_capacity} L</div>
                  </div>
                )}
                {selectedBike.color && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>สี</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{selectedBike.color}</div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <BikeSpecs make={selectedBike.make} model={selectedBike.model} />
              </div>

              <div className="flex gap-2 pb-5 flex-wrap max-sm:flex-col max-sm:pb-4">
                <Button variant="default" style={{ fontSize: 14 }} onClick={() => setShowFuelForm(true)}>
                  ⛽ บันทึกการเติมน้ำมัน
                </Button>
                <Button variant="secondary" style={{ fontSize: 14 }} onClick={() => setShowLogForm(true)}>
                  🔧 บันทึกการบำรุงรักษา
                </Button>
                <Button variant="secondary" style={{ fontSize: 14 }} onClick={handleShockClick} disabled={shockLoading}>
                  {shockLoading ? "…" : "⚙️ ตั้งค่าโช้ค"}
                </Button>
              </div>
            </div>
          </Card>

          {/* ── Service reminder status ── */}
          {(() => {
            const overdue = reminders.filter((r) => r.enabled && r.status === "overdue").length;
            const dueSoon = reminders.filter((r) => r.enabled && r.status === "due_soon").length;
            const statusColor = overdue > 0 ? "var(--red)" : dueSoon > 0 ? "var(--accent-amber)" : "var(--green)";
            const statusText = overdue > 0 ? `${overdue} รายการเกินกำหนด` : dueSoon > 0 ? `${dueSoon} รายการใกล้ถึงรอบ` : "ปกติทุกรายการ";
            const statusBg = overdue > 0 ? "var(--red-bg)" : dueSoon > 0 ? "var(--amber-bg)" : "var(--green-bg)";
            const StatusIcon = overdue > 0
              ? () => <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              : dueSoon > 0
              ? () => <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              : () => <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
            return (
              <Card style={{ marginBottom: 10, padding: "10px 14px", background: statusBg }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: statusColor, display: "flex", alignItems: "center" }}><StatusIcon /></span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>การบำรุงรักษา</div>
                      <div style={{ fontSize: 11, color: statusColor, marginTop: 1 }}>{statusText}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    style={{ fontSize: 12, color: "var(--slate)", minHeight: "44px", padding: "0 14px" }}
                    onClick={() => navForward(navigate, `/bikes/${bid}/reminders`)}
                  >
                    จัดการ →
                  </Button>
                </div>
              </Card>
            );
          })()}

          {/* ── Expense summary card ── */}
          {expenseSummary && expenseSummary.total > 0 && (
            <Card style={{ marginBottom: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>💰 ค่าใช้จ่ายเดือนนี้</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button size="sm"
                    style={{ color: "var(--purple)", borderColor: "var(--purple-border)", background: "var(--purple-bg)", fontSize: 11 }}
                    onClick={() => setShowExpenseModal(true)}>+ เพิ่ม</Button>
                  <Button size="sm" style={{ fontSize: 11, color: "var(--slate)" }}
                    onClick={() => navForward(navigate, `/expenses`, { state: { bikeId: bid } })}>
                    ดูทั้งหมด →
                  </Button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ textAlign: "center", minWidth: 70 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--purple)" }}>
                    ฿{expenseSummary.total.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--slate)" }}>รวม</div>
                </div>
                <div style={{ width: 1, height: 36, background: "var(--hairline)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                  {expenseSummary.by_category.slice(0, 3).map((c) => (
                    <div key={c.category} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "var(--slate)" }}>{c.icon} {c.label}</span>
                      <span style={{ color: "var(--ink)", fontWeight: 500 }}>฿{c.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* ── Log tabs ── */}
          <div className="bike-segmented" role="tablist">
            {(["fuel", "service"] as const).map((t) => {
              const labels = { fuel: "⛽ เชื้อเพลิง", service: "🔧 ประวัติบำรุงรักษา" };
              const active = logTab === t;
              return (
                <button key={t} role="tab" aria-selected={active} onClick={() => setLogTab(t)} style={{
                  flex: 1, minHeight: 44, padding: "0 8px", fontSize: 13,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: active ? 700 : 400,
                  color: active ? "var(--ink)" : "var(--slate)",
                  background: active ? "var(--purple-bg)" : "transparent",
                  border: active ? "1px solid var(--purple-border)" : "1px solid transparent",
                  borderRadius: "calc(var(--r-md) - 4px)",
                  cursor: "pointer", transition: "all var(--spring)",
                  userSelect: "none", WebkitUserSelect: "none",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>{labels[t]}</button>
              );
            })}
          </div>

          {/* ── Fuel tab ── */}
          {logTab === "fuel" && (
            <div className="tab-content">
              {economy && economy.total_logs > 1 && <FuelEconomyCard economy={economy} />}
              {fuelLogs.length === 0 && (
                <div className="empty-state" style={{ padding: "48px 16px 80px" }}>
                  <div className="empty-state-icon">⛽</div>
                  <h3>ยังไม่มีข้อมูลเชื้อเพลิง</h3>
                  <p>บันทึกการเติมน้ำมันเพื่อคำนวณอัตราสิ้นเปลือง</p>
                  <Button variant="default" style={{ fontSize: 13 }} onClick={() => setShowFuelForm(true)}>
                    + บันทึกการเติมน้ำมัน
                  </Button>
                </div>
              )}
              {fuelLogs.map((fl, idx) => (
                <FuelHistoryRow key={fl.id} log={fl} unit={unit} isLast={idx === fuelLogs.length - 1}
                  onEdit={() => setEditFuelLog(fl)}
                  onDelete={async () => { if (await confirm("ลบรายการเติมน้ำมันนี้?", { title: "ลบรายการเชื้อเพลิง", confirmLabel: "ลบ" })) deleteFuelMut.mutate(fl.id); }}
                  onImageClick={(imgs, i) => setLightbox({ images: imgs, index: i })} />
              ))}
            </div>
          )}

          {/* ── Service tab ── */}
          {logTab === "service" && (
            <div className="tab-content">
              {serviceLogs.length === 0 && (
                <div className="empty-state" style={{ padding: "48px 16px 80px" }}>
                  <div className="empty-state-icon">🔧</div>
                  <h3>ยังไม่มีประวัติการบำรุงรักษา</h3>
                  <p>เริ่มบันทึกเพื่อติดตามประวัติรถของคุณ</p>
                  <Button variant="default" style={{ fontSize: 13 }} onClick={() => setShowLogForm(true)}>
                    + บันทึกการบำรุงรักษา
                  </Button>
                </div>
              )}
              {serviceLogs.map((log, idx) => (
                <ServiceHistoryRow key={log.id} log={log} unit={unit} isLast={idx === serviceLogs.length - 1}
                  onEdit={() => setEditLog(log)}
                  onDelete={async () => { if (await confirm(`ลบรายการ "${log.name}" ออกจากประวัติ?`, { title: "ลบรายการบำรุงรักษา", confirmLabel: "ลบ" })) deleteLogMut.mutate(log.id); }}
                  onImageClick={(imgs, i) => setLightbox({ images: imgs, index: i })} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Quick-log FAB ── */}
      {fabOpen && (
        <>
          <div className="bike-fab-backdrop" onClick={() => setFabOpen(false)} />
          <div className="bike-fab-popup">
            <button className="quick-log-item" onClick={() => { setFabOpen(false); setShowLogForm(true); }}>
              <span className="quick-log-icon" style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-border)" }}>🔧</span>
              บำรุงรักษา
            </button>
            <button className="quick-log-item" onClick={() => { setFabOpen(false); setShowFuelForm(true); }}>
              <span className="quick-log-icon" style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)" }}>⛽</span>
              เติมน้ำมัน
            </button>
          </div>
        </>
      )}
      <button
        className={`bike-fab${fabOpen ? " is-open" : ""}${reminders.some((r) => r.enabled && r.status === "overdue") ? " has-overdue" : ""}`}
        onClick={() => setFabOpen((v) => !v)}
        aria-label="บันทึกรายการ"
        aria-expanded={fabOpen}
      >+</button>

      {/* ── Forms & modals ── */}
      {showLogForm && selectedBike && (
        <ServiceLogForm bikeId={bid!} currentMileage={selectedBike.current_mileage} onClose={() => setShowLogForm(false)} />
      )}
      {editLog && selectedBike && (
        <ServiceLogForm bikeId={bid!} currentMileage={selectedBike.current_mileage} log={editLog} onClose={() => setEditLog(null)} />
      )}
      {showFuelForm && selectedBike && (
        <FuelLogForm bikeId={bid!} currentMileage={selectedBike.current_mileage} tankCapacity={selectedBike.tank_capacity} onClose={() => setShowFuelForm(false)}
          pastLocations={fuelLogs.map(l => l.location).filter((l): l is string => !!l?.trim())} />
      )}
      {editFuelLog && selectedBike && (
        <FuelLogForm bikeId={bid!} currentMileage={selectedBike.current_mileage} tankCapacity={selectedBike.tank_capacity} log={editFuelLog} onClose={() => setEditFuelLog(null)}
          pastLocations={fuelLogs.map(l => l.location).filter((l): l is string => !!l?.trim())} />
      )}
      {showEditBike && selectedBike && <BikeForm bike={selectedBike} onClose={() => setShowEditBike(false)} />}
      {showForm && <BikeForm onClose={() => setShowForm(false)} />}
      {cropSrc && (
        <ImageCropper src={cropSrc} aspectRatio={2}
          onConfirm={(blob) => { uploadImageMut.mutate(new File([blob], "bike-photo.jpg", { type: "image/jpeg" })); URL.revokeObjectURL(cropSrc!); setCropSrc(null); }}
          onCancel={() => { URL.revokeObjectURL(cropSrc!); setCropSrc(null); }} />
      )}
      {showExpenseModal && bid && <ExpenseModal bikeId={bid} onClose={() => setShowExpenseModal(false)} />}
      {confirmDialog}
      {lightbox && <Lightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  );
}
