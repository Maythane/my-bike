import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMotorcycle, deleteMotorcycle, uploadBikeImage, deleteBikeImage } from "../api/motorcycles";
import { getShockSetting } from "../api/shock";
import { getServiceLogs, deleteServiceLog } from "../api/logs";
import { getFuelLogs, getFuelEconomy, deleteFuelLog } from "../api/fuel";
import BikeForm from "../components/bikes/BikeForm";
import ServiceLogForm from "../components/logs/ServiceLogForm";
import FuelLogForm from "../components/logs/FuelLogForm";
import SkeletonCard from "../components/ui/SkeletonCard";
import Lightbox from "../components/ui/Lightbox";
import BikeSpecs from "../components/profiles/BikeSpecs";
import ImageCropper from "../components/ui/ImageCropper";
import { useConfirm } from "../hooks/useConfirm";
import type { ServiceLog, FuelLog } from "../types";
import { ServiceHistoryRow, FuelHistoryRow, FuelEconomyCard } from "../components/logs/LogHistoryRows";
import { getReminders } from "../api/reminders";
import ReminderAlertBar from "../components/reminders/ReminderAlertBar";
import { getExpenseSummary } from "../api/expenses";
import ExpenseModal from "../components/expenses/ExpenseModal";

export default function BikePage() {
  const { bikeId } = useParams<{ bikeId: string }>();
  const bid = Number(bikeId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"service" | "fuel">("fuel");
  const [showLogForm, setShowLogForm] = useState(false);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [showEditBike, setShowEditBike] = useState(false);
  const [editLog, setEditLog] = useState<ServiceLog | null>(null);
  const [editFuelLog, setEditFuelLog] = useState<FuelLog | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [showOverflow, setShowOverflow] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [shockLoading, setShockLoading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const { dialog: confirmDialog, confirm } = useConfirm();

  const { data: bike, isLoading: bikeLoading } = useQuery({
    queryKey: ["motorcycle", bid],
    queryFn: () => getMotorcycle(bid),
    enabled: !!bid,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["service-logs", bid],
    queryFn: () => getServiceLogs(bid),
    enabled: !!bid && tab === "service",
  });

  const { data: fuelLogs = [], isLoading: fuelLoading } = useQuery({
    queryKey: ["fuel-logs", bid],
    queryFn: () => getFuelLogs(bid),
    enabled: !!bid,
  });

  const { data: economy } = useQuery({
    queryKey: ["fuel-economy", bid],
    queryFn: () => getFuelEconomy(bid),
    enabled: !!bid && tab === "fuel",
  });

  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders", bid],
    queryFn: () => getReminders(bid),
    enabled: !!bid,
  });

  const now = new Date();
  const { data: expenseSummary } = useQuery({
    queryKey: ["expense-summary", bid, now.getFullYear(), now.getMonth() + 1],
    queryFn: () => getExpenseSummary(bid, now.getFullYear(), now.getMonth() + 1),
    enabled: !!bid,
  });
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const deleteBikeMut = useMutation({
    mutationFn: () => deleteMotorcycle(bid),
    onSuccess: () => navigate("/"),
  });

  const uploadImageMut = useMutation({
    mutationFn: (file: File) => uploadBikeImage(bid, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["motorcycle", bid] }),
  });

  const deleteImageMut = useMutation({
    mutationFn: () => deleteBikeImage(bid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["motorcycle", bid] }),
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCropSrc(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleCropConfirm = (blob: Blob) => {
    uploadImageMut.mutate(new File([blob], "bike-photo.jpg", { type: "image/jpeg" }));
    URL.revokeObjectURL(cropSrc!);
    setCropSrc(null);
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

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

  const unit = bike?.mileage_unit ?? "km";

  async function handleShockClick() {
    if (shockLoading) return;
    setShockLoading(true);
    try {
      const setting = await getShockSetting(bid);
      localStorage.setItem("lastSelectedBikeId", String(bid));
      navigate(
        setting.shock_brand ? "/shock-settings" : `/settings/bikes/${bid}/shock`,
        { viewTransition: true, state: { from: "bike", bikeId: bid } },
      );
    } finally {
      setShockLoading(false);
    }
  }

  return (
    <div className="relative min-h-dvh pb-20 max-w-[680px] w-full mx-auto overflow-x-hidden touch-pan-y px-4 py-6 sm:px-6 sm:py-8">
      <button
        onClick={() => {
          document.documentElement.dataset.navDir = "back";
          setTimeout(() => { delete document.documentElement.dataset.navDir; }, 500);
          navigate("/", { viewTransition: true });
        }}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--slate)", fontSize: 13, marginBottom: 24 }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับ
      </button>

      {bikeLoading && <SkeletonCard />}

      {bike && (
        <>
          <Card style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
            {/* Bike photo */}
            <div style={{ position: "relative" }}>
              {bike.image_path ? (
                <div className="bike-hero-image" style={{ overflow: "hidden", background: "var(--surface)", position: "relative", viewTransitionName: `bike-hero-${bid}` }}>
                  <img
                    src={bike.image_path}
                    alt={bike.nickname ?? bike.model}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 80, background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 100%)" }} />
                  {/* Photo overlay controls */}
                  <div style={{
                    position: "absolute", bottom: 8, right: 8,
                    display: "flex", gap: 6,
                  }}>
                    <button
                      onClick={() => photoRef.current?.click()}
                      style={{
                        padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                        background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", cursor: "pointer", backdropFilter: "blur(4px)",
                      }}
                    >เปลี่ยนรูป</button>
                    <button
                      onClick={async () => { if (await confirm("ลบรูปภาพของรถออก?", { title: "ลบรูปภาพ" })) deleteImageMut.mutate(); }}
                      style={{
                        padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                        background: "rgba(224,80,80,0.75)", color: "#fff", border: "none", cursor: "pointer", backdropFilter: "blur(4px)",
                      }}
                    >ลบรูป</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => photoRef.current?.click()}
                  style={{
                    width: "100%", height: 120, display: "flex", alignItems: "center", justifyContent: "center",
                    flexDirection: "column", gap: 8, background: "var(--glass-bg)", border: "none", cursor: "pointer",
                    color: "var(--slate)", fontSize: 13, viewTransitionName: `bike-hero-${bid}`,
                  }}
                >
                  <span style={{ fontSize: 32 }}>📷</span>
                  <span>เพิ่มรูปรถ</span>
                </button>
              )}
              <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
            </div>

            <div style={{ padding: "18px 20px 0" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.3px", marginBottom: 3 }}>
                  {bike.nickname ?? `${bike.make} ${bike.model}`}
                </h1>
                <div style={{ fontSize: 13, color: "var(--slate)" }}>
                  {bike.nickname ? `${bike.make} ${bike.model} · ` : ""}{bike.year}
                  {bike.engine_cc ? ` · ${bike.engine_cc} cc` : ""}
                  {bike.license_plate ? ` · ${bike.license_plate}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setShowEditBike(true)}>แก้ไข</Button>
                {/* desktop: show delete inline */}
                <Button
                  variant="destructive"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={async () => {
                    if (await confirm(`ข้อมูลรถและประวัติการบำรุงรักษาทั้งหมดจะถูกลบด้วย`, { title: `ลบรถ "${bike.nickname ?? bike.model}"?`, confirmLabel: "ลบรถ" }))
                      deleteBikeMut.mutate();
                  }}
                >ลบ</Button>
                {/* mobile: overflow ⋮ menu */}
                <div className="bike-overflow-wrap sm:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="bike-overflow-btn"
                    onClick={() => setShowOverflow((v) => !v)}
                    aria-label="เมนูเพิ่มเติม"
                  >⋮</Button>
                  {showOverflow && (
                    <>
                      <div className="bike-overflow-backdrop" onClick={() => setShowOverflow(false)} />
                      <div className="bike-overflow-menu">
                        <button
                          className="bike-overflow-item bike-overflow-danger"
                          onClick={async () => {
                            setShowOverflow(false);
                            if (await confirm(`ข้อมูลรถและประวัติการบำรุงรักษาทั้งหมดจะถูกลบด้วย`, { title: `ลบรถ "${bike.nickname ?? bike.model}"?`, confirmLabel: "ลบรถ" }))
                              deleteBikeMut.mutate();
                          }}
                        >
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

            <div className="flex gap-6 items-end pt-3 pb-2">
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Odometer</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.5px" }}>
                  {bike.current_mileage.toLocaleString()}
                  <span style={{ fontSize: 13, fontWeight: 400, color: "var(--slate)", marginLeft: 5 }}>{unit}</span>
              </div>
            </div>
              {bike.tank_capacity && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>ถัง</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{bike.tank_capacity} L</div>
                </div>
              )}
              {bike.color && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>สี</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{bike.color}</div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <BikeSpecs make={bike.make} model={bike.model} />
            </div>

            <div className="flex flex-wrap gap-2 pb-4">
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
            </div>{/* end padding div */}
          </Card>

          {/* Reminder alert bar (urgent only) */}
          <ReminderAlertBar bikeId={bid} reminders={reminders} />

          {/* Reminder card — always visible */}
          {(() => {
            const overdue = reminders.filter((r) => r.enabled && r.status === "overdue").length;
            const dueSoon = reminders.filter((r) => r.enabled && r.status === "due_soon").length;
            const statusColor = overdue > 0 ? "var(--red)" : dueSoon > 0 ? "#f59e0b" : "var(--green)";
            const statusText = overdue > 0 ? `${overdue} รายการเกินกำหนด` : dueSoon > 0 ? `${dueSoon} รายการใกล้ถึงรอบ` : "ปกติทุกรายการ";
            const statusIcon = overdue > 0 ? "⚠️" : dueSoon > 0 ? "🔔" : "✅";
            return (
              <Card style={{ marginBottom: 10, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>{statusIcon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>การบำรุงรักษา</div>
                      <div style={{ fontSize: 11, color: statusColor, marginTop: 1 }}>{statusText}</div>
                    </div>
                  </div>
                  <Button size="sm" style={{ fontSize: 11, color: "var(--slate)" }}
                    onClick={() => navigate(`/bikes/${bid}/reminders`, { viewTransition: true })}>
                    จัดการ →
                  </Button>
                </div>
              </Card>
            );
          })()}

          {/* Expense summary card */}
          {expenseSummary && expenseSummary.total > 0 && (
            <Card style={{ marginBottom: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  💰 ค่าใช้จ่ายเดือนนี้
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button size="sm"
                    style={{ color: "var(--purple)", borderColor: "var(--purple-border)", background: "var(--purple-bg)", fontSize: 11 }}
                    onClick={() => setShowExpenseModal(true)}>+ เพิ่ม</Button>
                  <Button size="sm" style={{ fontSize: 11, color: "var(--slate)" }}
                    onClick={() => navigate(`/expenses`, { state: { bikeId: bid }, viewTransition: true })}>
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

          {/* Tab bar — segment control */}
          <div className="bike-segmented">
            {(["fuel", "service"] as const).map((t) => {
              const labels = { fuel: "เชื้อเพลิง", service: "ประวัติการบำรุงรักษา" };
              const active = tab === t;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: active ? 700 : 400,
                    color: active ? "var(--ink)" : "var(--slate)",
                    background: active ? "var(--purple-bg)" : "transparent",
                    border: active ? "1px solid var(--purple-border)" : "1px solid transparent",
                    borderRadius: "calc(var(--r-md) - 4px)",
                    cursor: "pointer",
                    transition: "all var(--spring)",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                  }}
                >{labels[t]}</button>
              );
            })}
          </div>

          {/* SERVICE LOG TAB */}
          {tab === "service" && (
            <>
              {logsLoading && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>}
              {!logsLoading && logs.length === 0 && (
                <div className="empty-state" style={{ padding: "36px 16px" }}>
                  <div className="empty-state-icon">🔧</div>
                  <h3>ยังไม่มีประวัติ</h3>
                  <p>กดปุ่มด้านบนเพื่อบันทึกการซ่อมครั้งแรก</p>
                </div>
              )}
              {!logsLoading && logs.length > 0 && (
                <div>
                  {logs.map((log: ServiceLog, idx: number) => (
                    <ServiceHistoryRow
                      key={log.id}
                      log={log}
                      unit={unit}
                      isLast={idx === logs.length - 1}
                      onEdit={() => setEditLog(log)}
                      onDelete={async () => { if (await confirm(`ลบรายการ "${log.name}" ออกจากประวัติ?`, { title: "ลบรายการบำรุงรักษา", confirmLabel: "ลบ" })) deleteLogMut.mutate(log.id); }}
                      onImageClick={(imgs, i) => setLightbox({ images: imgs, index: i })}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* FUEL TAB */}
          {tab === "fuel" && (
            <>
              {economy && economy.total_logs > 1 && (
                <FuelEconomyCard economy={economy} />
              )}
              {fuelLoading && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1,2].map(i => <SkeletonCard key={i} />)}</div>}
              {!fuelLoading && fuelLogs.length === 0 && (
                <div className="empty-state" style={{ padding: "36px 16px" }}>
                  <div className="empty-state-icon">⛽</div>
                  <h3>ยังไม่มีข้อมูลเชื้อเพลิง</h3>
                  <p>บันทึกการเติมน้ำมันเพื่อคำนวณอัตราสิ้นเปลือง</p>
                </div>
              )}
              {!fuelLoading && fuelLogs.length > 0 && (
                <div>
                  {fuelLogs.map((fl: FuelLog, idx: number) => (
                    <FuelHistoryRow
                      key={fl.id}
                      log={fl}
                      unit={unit}
                      isLast={idx === fuelLogs.length - 1}
                      onEdit={() => setEditFuelLog(fl)}
                      onDelete={async () => { if (await confirm("ลบรายการเติมน้ำมันนี้?", { title: "ลบรายการเชื้อเพลิง", confirmLabel: "ลบ" })) deleteFuelMut.mutate(fl.id); }}
                      onImageClick={(imgs, i) => setLightbox({ images: imgs, index: i })}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          {showExpenseModal && (
            <ExpenseModal bikeId={bid} onClose={() => setShowExpenseModal(false)} />
          )}
        </>
      )}

      {showLogForm && bike && (
        <ServiceLogForm bikeId={bid} currentMileage={bike.current_mileage} onClose={() => setShowLogForm(false)}
          pastLocations={logs.map(l => l.location).filter((l): l is string => !!l?.trim())} />
      )}
      {editLog && bike && (
        <ServiceLogForm bikeId={bid} currentMileage={bike.current_mileage} log={editLog} onClose={() => setEditLog(null)}
          pastLocations={logs.map(l => l.location).filter((l): l is string => !!l?.trim())} />
      )}
      {showFuelForm && bike && (
        <FuelLogForm bikeId={bid} currentMileage={bike.current_mileage} tankCapacity={bike.tank_capacity} onClose={() => setShowFuelForm(false)}
          pastLocations={fuelLogs.map(l => l.location).filter((l): l is string => !!l?.trim())} />
      )}
      {editFuelLog && bike && (
        <FuelLogForm bikeId={bid} currentMileage={bike.current_mileage} tankCapacity={bike.tank_capacity} log={editFuelLog} onClose={() => setEditFuelLog(null)}
          pastLocations={fuelLogs.map(l => l.location).filter((l): l is string => !!l?.trim())} />
      )}
      {showEditBike && bike && (
        <BikeForm bike={bike} onClose={() => setShowEditBike(false)} />
      )}
      {confirmDialog}
      {cropSrc && <ImageCropper src={cropSrc} aspectRatio={2} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />}
      {lightbox && <Lightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}

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
              <span className="quick-log-icon" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)" }}>⛽</span>
              เติมน้ำมัน
            </button>
          </div>
        </>
      )}
      <button
        className={`bike-fab${fabOpen ? " is-open" : ""}`}
        onClick={() => setFabOpen((v) => !v)}
        aria-label="บันทึกรายการ"
      >+</button>


    </div>
  );
}
