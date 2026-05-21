import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import type { ServiceLog, FuelLog, FuelEconomy } from "../types";

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
  const [showManual, setShowManual] = useState(false);
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
    <div className="page">
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
          <div className="card" style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
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
                    color: "var(--slate)", fontSize: 13,
                  }}
                >
                  <span style={{ fontSize: 32 }}>📷</span>
                  <span>เพิ่มรูปรถ</span>
                </button>
              )}
              <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
            </div>

            <div style={{ padding: "18px 20px 0" }}>
            <div className="bike-detail-header">
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
              <div className="bike-detail-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setShowEditBike(true)}>แก้ไข</button>
                <button className="btn btn-ghost btn-sm bike-manual-btn" onClick={() => setShowManual(true)} aria-label="สมุดคู่มือรถ">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                  </svg>
                  คู่มือ
                </button>
                {/* desktop: show delete inline */}
                <button
                  className="btn btn-danger btn-sm bike-delete-desktop"
                  onClick={async () => {
                    if (await confirm(`ข้อมูลรถและประวัติการบำรุงรักษาทั้งหมดจะถูกลบด้วย`, { title: `ลบรถ "${bike.nickname ?? bike.model}"?`, confirmLabel: "ลบรถ" }))
                      deleteBikeMut.mutate();
                  }}
                >ลบ</button>
                {/* mobile: overflow ⋮ menu */}
                <div className="bike-overflow-wrap bike-delete-mobile">
                  <button
                    className="btn btn-ghost btn-sm bike-overflow-btn"
                    onClick={() => setShowOverflow((v) => !v)}
                    aria-label="เมนูเพิ่มเติม"
                  >⋮</button>
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

            <div className="bike-detail-stats">
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

            {bike && (
              <div style={{ marginBottom: 16 }}>
                <BikeSpecs make={bike.make} model={bike.model} />
              </div>
            )}

            <div className="bike-detail-primary-actions">
              <button className="btn btn-primary" style={{ fontSize: 14 }} onClick={() => setShowFuelForm(true)}>
                ⛽ บันทึกการเติมน้ำมัน
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 14 }} onClick={() => setShowLogForm(true)}>
                🔧 บันทึกการบำรุงรักษา
              </button>
              <button className="btn btn-secondary" style={{ fontSize: 14 }} onClick={handleShockClick} disabled={shockLoading}>
                {shockLoading ? "…" : "⚙️ ตั้งค่าโช้ค"}
              </button>
            </div>
            </div>{/* end padding div */}
          </div>

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

      {showManual && (
        <div className="modal-overlay bike-manual-overlay" onClick={() => setShowManual(false)}>
          <div className="bike-manual-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bike-manual-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--purple)", flexShrink: 0 }}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <span style={{ fontWeight: 700, fontSize: 15 }}>สมุดคู่มือรถ</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a href="/manual-grandfilano.pdf" target="_blank" rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>
                  เปิดใหม่ ↗
                </a>
                <button type="button" className="btn btn-ghost btn-sm modal-close" onClick={() => setShowManual(false)}>✕</button>
              </div>
            </div>
            <iframe
              src="/manual-grandfilano.pdf"
              className="bike-manual-iframe"
              title="สมุดคู่มือรถ Grand Filano"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceHistoryRow({ log, unit, isLast, onEdit, onDelete, onImageClick }: {
  log: ServiceLog; unit: string; isLast: boolean; onEdit: () => void; onDelete: () => void; onImageClick: (images: string[], index: number) => void;
}) {
  return (
    <div className="log-row">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 26, paddingTop: 15, flexShrink: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--purple)", flexShrink: 0 }} />
        {!isLast && <div style={{ width: 1, flex: 1, background: "var(--hairline)", marginTop: 5, minHeight: 8 }} />}
      </div>
      <div className="log-row-content" style={{ padding: "8px 10px 10px" }}>
        <div className="history-row-main">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500, fontSize: 14, color: "var(--ink)", marginBottom: 3 }}>{log.name}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>{fmtDate(log.date_performed)}</span>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>{log.mileage_at_service.toLocaleString()} {unit}</span>
              {log.cost && <span style={{ fontSize: 12, color: "var(--slate)" }}>฿{log.cost.toLocaleString()}</span>}
              {log.location && <span style={{ fontSize: 12, color: "var(--slate)" }}>📍 {log.location}</span>}
            </div>
            {log.notes && <div style={{ fontSize: 12, color: "var(--steel)", marginTop: 3, fontStyle: "italic" }}>{log.notes}</div>}
            {log.images.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {log.images.map((img, imgIdx) => (
                  <img key={img.id} src={img.image_path} alt="service" className="history-thumb"
                    onClick={() => onImageClick(log.images.map(i => i.image_path), imgIdx)} />
                ))}
              </div>
            )}
          </div>
          <div className="row-actions">
            <button onClick={onEdit} className="btn btn-sm" style={{ color: "var(--purple)", borderColor: "var(--purple-border)", background: "var(--purple-bg)" }}>แก้ไข</button>
            <button onClick={onDelete} className="btn btn-sm" style={{ color: "var(--steel)", borderColor: "var(--hairline)", background: "transparent" }}>ลบ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FuelHistoryRow({ log, unit, isLast, onEdit, onDelete, onImageClick }: {
  log: FuelLog; unit: string; isLast: boolean; onEdit: () => void; onDelete: () => void; onImageClick: (images: string[], index: number) => void;
}) {
  return (
    <div className="log-row">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 26, paddingTop: 15, flexShrink: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
        {!isLast && <div style={{ width: 1, flex: 1, background: "var(--hairline)", marginTop: 5, minHeight: 8 }} />}
      </div>
      <div className="log-row-content" style={{ padding: "8px 10px 10px" }}>
        <div className="history-row-main">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>{log.mileage_at_fillup.toLocaleString()} {unit}</span>
              {log.km_per_liter && <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600, flexShrink: 0 }}>{log.km_per_liter} km/L</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99, background: "rgba(245,158,11,0.12)", color: "#b45309" }}>{log.fuel_type}</span>
              {log.is_full_tank && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99, background: "rgba(15,123,108,0.10)", color: "var(--green)" }}>เต็มถัง</span>
              )}
              {log.distance_km && (
                <span style={{ fontSize: 11, color: "var(--slate)" }}>+{log.distance_km.toLocaleString()} {unit}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>{fmtDate(log.date)}</span>
              <span style={{ fontSize: 12, color: "var(--slate)" }}>{log.fuel_amount} ลิตร</span>
              {log.cost && <span style={{ fontSize: 12, color: "var(--slate)" }}>฿{log.cost.toLocaleString()}</span>}
              {log.location && <span style={{ fontSize: 12, color: "var(--slate)" }}>📍 {log.location}</span>}
            </div>
            {log.notes && <div style={{ fontSize: 12, color: "var(--steel)", marginTop: 3, fontStyle: "italic" }}>{log.notes}</div>}
            {log.images.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {log.images.map((img, imgIdx) => (
                  <img key={img.id} src={img.image_path} alt="receipt" className="history-thumb"
                    onClick={() => onImageClick(log.images.map(i => i.image_path), imgIdx)} />
                ))}
              </div>
            )}
          </div>
          <div className="row-actions">
            <button onClick={onEdit} className="btn btn-sm" style={{ color: "var(--purple)", borderColor: "var(--purple-border)", background: "var(--purple-bg)" }}>แก้ไข</button>
            <button onClick={onDelete} className="btn btn-sm" style={{ color: "var(--steel)", borderColor: "var(--hairline)", background: "transparent" }}>ลบ</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FuelEconomyCard({ economy }: { economy: FuelEconomy }) {
  return (
    <div className="card" style={{ marginBottom: 20, padding: "20px 20px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
        อัตราสิ้นเปลือง
      </div>
      <div className="economy-hero">
        <div className="economy-hero-value">
          {economy.avg_km_per_liter ?? "—"}
        </div>
        <span style={{ fontSize: 14, color: "var(--slate)", paddingBottom: 6 }}>km/L เฉลี่ย</span>
      </div>
      <div style={{ borderTop: "1px solid var(--hairline)", marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 12 }}>
        <StatItem label="ล่าสุด" value={economy.last_km_per_liter} suffix="km/L" />
        <StatItem label="ดีสุด" value={economy.best_km_per_liter} suffix="km/L" />
        <StatItem label="น้ำมันรวม" value={economy.total_fuel} suffix="L" />
        {economy.total_cost != null && <StatItem label="ค่าน้ำมันรวม" value={`฿${economy.total_cost.toLocaleString()}`} />}
      </div>
    </div>
  );
}

function StatItem({ label, value, suffix }: { label: string; value: number | string | null | undefined; suffix?: string }) {
  const display = value == null ? "—" : typeof value === "string" ? value : `${value}${suffix ? ` ${suffix}` : ""}`;
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--steel)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{display}</div>
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}
