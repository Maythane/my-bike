import type { ServiceLog, FuelLog, FuelEconomy } from "../../types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

export function ServiceHistoryRow({ log, unit, isLast, onEdit, onDelete, onImageClick }: {
  log: ServiceLog; unit: string; isLast: boolean; onEdit: () => void; onDelete: () => void;
  onImageClick: (images: string[], index: number) => void;
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
            <Button onClick={onEdit} size="sm" style={{ color: "var(--purple)", borderColor: "var(--purple-border)", background: "var(--purple-bg)" }}>แก้ไข</Button>
            <Button onClick={onDelete} size="sm" style={{ color: "var(--steel)", borderColor: "var(--hairline)", background: "transparent" }}>ลบ</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FuelHistoryRow({ log, unit, isLast, onEdit, onDelete, onImageClick }: {
  log: FuelLog; unit: string; isLast: boolean; onEdit: () => void; onDelete: () => void;
  onImageClick: (images: string[], index: number) => void;
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
              {log.is_full_tank
                ? <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99, background: "rgba(15,123,108,0.10)", color: "var(--green)" }}>เต็มถัง</span>
                : <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99, background: "rgba(148,163,184,0.15)", color: "var(--slate)" }}>ไม่เต็มถัง</span>
              }
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
            <Button onClick={onEdit} size="sm" style={{ color: "var(--purple)", borderColor: "var(--purple-border)", background: "var(--purple-bg)" }}>แก้ไข</Button>
            <Button onClick={onDelete} size="sm" style={{ color: "var(--steel)", borderColor: "var(--hairline)", background: "transparent" }}>ลบ</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FuelEconomyCard({ economy }: { economy: FuelEconomy }) {
  return (
    <Card style={{ marginBottom: 20, padding: "20px 20px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
        อัตราสิ้นเปลือง
      </div>
      <div className="economy-hero">
        <div className="economy-hero-value">{economy.avg_km_per_liter ?? "—"}</div>
        <span style={{ fontSize: 14, color: "var(--slate)", paddingBottom: 6 }}>km/L เฉลี่ย</span>
      </div>
      <div style={{ borderTop: "1px solid var(--hairline)", marginBottom: 14 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 12 }}>
        <StatItem label="ล่าสุด" value={economy.last_km_per_liter} suffix="km/L" />
        <StatItem label="ดีสุด" value={economy.best_km_per_liter} suffix="km/L" />
        <StatItem label="น้ำมันรวม" value={economy.total_fuel} suffix="L" />
        {economy.total_cost != null && <StatItem label="ค่าน้ำมันรวม" value={`฿${economy.total_cost.toLocaleString()}`} />}
      </div>
    </Card>
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
