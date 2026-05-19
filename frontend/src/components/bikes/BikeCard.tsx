import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Motorcycle } from "../../types";
import ServiceLogForm from "../logs/ServiceLogForm";

interface Props {
  bike: Motorcycle;
}

export default function BikeCard({ bike }: Props) {
  const navigate = useNavigate();
  const [showLog, setShowLog] = useState(false);
  const unit = bike.mileage_unit ?? "km";
  const hasPhoto = !!bike.image_path;

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Hero */}
        <div
          onClick={() => navigate(`/bikes/${bike.id}`)}
          style={{
            cursor: "pointer", overflow: "hidden", position: "relative",
            background: hasPhoto ? "var(--surface)" : "linear-gradient(135deg, var(--purple) 0%, #9d8df7 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
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
          onClick={() => navigate(`/bikes/${bike.id}`)}
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
          <button
            className="btn btn-primary"
            style={{ width: "100%", fontSize: 13 }}
            onClick={() => setShowLog(true)}
          >
            + บันทึกการบำรุงรักษา
          </button>
        </div>
      </div>

      {showLog && (
        <ServiceLogForm
          bikeId={bike.id}
          currentMileage={bike.current_mileage}
          onClose={() => setShowLog(false)}
        />
      )}
    </>
  );
}
