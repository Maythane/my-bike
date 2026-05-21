import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Motorcycle } from "../../types";
import ServiceLogForm from "../logs/ServiceLogForm";
import FuelLogForm from "../logs/FuelLogForm";

interface Props {
  bike: Motorcycle;
}

export default function BikeCard({ bike }: Props) {
  const navigate = useNavigate();
  const [showLog, setShowLog] = useState(false);
  const [showFuelLog, setShowFuelLog] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const unit = bike.mileage_unit ?? "km";
  const hasPhoto = !!bike.image_path;

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Hero */}
        <div
          onClick={() => navigate(`/bikes/${bike.id}`, { viewTransition: true })}
          style={{
            cursor: "pointer", overflow: "hidden", position: "relative",
            background: hasPhoto ? "var(--surface)" : "linear-gradient(135deg, var(--purple) 0%, #9d8df7 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            viewTransitionName: `bike-hero-${bike.id}`,
          }}
          className="garage-card-image"
        >
          {hasPhoto ? (
            <img
              src={bike.image_path!}
              alt={bike.nickname ?? bike.model}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <span style={{ fontSize: 56, lineHeight: 1, opacity: 0.85 }}>🏍️</span>
          )}
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            background: hasPhoto
              ? "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)"
              : "linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 100%)",
            padding: "32px 16px 14px",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.2px", marginBottom: 2 }}>
              {bike.nickname ?? `${bike.make} ${bike.model}`}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              {bike.nickname ? `${bike.make} ${bike.model} · ` : ""}{bike.year}
              {bike.engine_cc ? ` · ${bike.engine_cc} cc` : ""}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div
          className="garage-card-stats"
          onClick={() => navigate(`/bikes/${bike.id}`, { viewTransition: true })}
          style={{ background: "transparent" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--surface-soft)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Odometer</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.3px" }}>
              {bike.current_mileage.toLocaleString()}
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--slate)", marginLeft: 4 }}>{unit}</span>
            </div>
          </div>
          {bike.tank_capacity && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>ถัง</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{bike.tank_capacity} L</div>
            </div>
          )}
          {bike.license_plate && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>ทะเบียน</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{bike.license_plate}</div>
            </div>
          )}
        </div>

        <div style={{ padding: "10px 16px 14px", borderTop: "1px solid var(--hairline)" }}>
          <div className="bike-overflow-wrap" style={{ width: "100%" }}>
            <button
              className="btn btn-primary"
              style={{ width: "100%", fontSize: 13, justifyContent: "space-between", position: "relative", zIndex: 50 }}
              onClick={() => setShowQuickMenu((v) => !v)}
            >
              <span>+ บันทึกรายการ</span>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none"
                style={{
                  transform: showQuickMenu ? "rotate(-90deg)" : "rotate(90deg)",
                  transition: "transform 0.22s var(--jelly-ease)",
                  flexShrink: 0,
                }}
              >
                <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {showQuickMenu && (
              <>
                <div className="bike-overflow-backdrop" onClick={() => setShowQuickMenu(false)} />
                <div className="quick-log-menu">
                  <button
                    className="quick-log-item"
                    onClick={() => { setShowQuickMenu(false); setShowLog(true); }}
                  >
                    <span className="quick-log-icon" style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-border)" }}>🔧</span>
                    <span>บันทึกการบำรุงรักษา</span>
                  </button>
                  <button
                    className="quick-log-item"
                    onClick={() => { setShowQuickMenu(false); setShowFuelLog(true); }}
                  >
                    <span className="quick-log-icon" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)" }}>⛽</span>
                    <span>บันทึกการเติมน้ำมัน</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showLog && (
        <ServiceLogForm
          bikeId={bike.id}
          currentMileage={bike.current_mileage}
          onClose={() => setShowLog(false)}
        />
      )}
      {showFuelLog && (
        <FuelLogForm
          bikeId={bike.id}
          currentMileage={bike.current_mileage}
          tankCapacity={bike.tank_capacity}
          onClose={() => setShowFuelLog(false)}
        />
      )}
    </>
  );
}
