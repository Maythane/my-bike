// frontend/src/components/ui/BottomNav.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAllMotorcycles } from "../../api/motorcycles";
import ServiceLogForm from "../logs/ServiceLogForm";
import FuelLogForm from "../logs/FuelLogForm";

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  const [showService, setShowService] = useState(false);
  const [showFuel, setShowFuel] = useState(false);

  const { data: bikes = [] } = useQuery({
    queryKey: ["motorcycles"],
    queryFn: getAllMotorcycles,
  });

  const garageActive =
    location.pathname === "/" ||
    location.pathname.startsWith("/bikes/") ||
    location.pathname === "/shock-settings";
  const settingsActive = location.pathname.startsWith("/settings");

  const singleBike = bikes.length === 1 ? bikes[0] : undefined;

  function openService() {
    setFabOpen(false);
    setShowService(true);
  }
  function openFuel() {
    setFabOpen(false);
    setShowFuel(true);
  }

  return (
    <>
      {fabOpen && (
        <>
          <div className="bottom-nav-backdrop" onClick={() => setFabOpen(false)} />
          <div className="bottom-nav-popup">
            <button className="quick-log-item" onClick={openService}>
              <span
                className="quick-log-icon"
                style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-border)" }}
              >
                🔧
              </span>
              บำรุงรักษา
            </button>
            <button className="quick-log-item" onClick={openFuel}>
              <span
                className="quick-log-icon"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.28)",
                }}
              >
                ⛽
              </span>
              เติมน้ำมัน
            </button>
          </div>
        </>
      )}

      <nav className="bottom-nav">
        <button
          className={`bottom-nav-tab${garageActive ? " is-active" : ""}`}
          onClick={() => navigate("/", { viewTransition: true })}
        >
          <span style={{ fontSize: 20 }}>🏍️</span>
          Garage
        </button>

        <div className="bottom-nav-fab-wrap">
          {bikes.length > 0 && (
            <button
              className={`bottom-nav-fab${fabOpen ? " is-open" : ""}`}
              onClick={() => setFabOpen((v) => !v)}
              aria-label="บันทึกรายการ"
            >
              +
            </button>
          )}
          <span className="bottom-nav-fab-label">บันทึก</span>
        </div>

        <button
          className={`bottom-nav-tab${settingsActive ? " is-active" : ""}`}
          onClick={() => navigate("/settings", { viewTransition: true })}
        >
          <span style={{ fontSize: 20 }}>⚙️</span>
          Settings
        </button>
      </nav>

      {showService && (
        <ServiceLogForm
          bikeId={singleBike?.id}
          currentMileage={singleBike?.current_mileage}
          onClose={() => setShowService(false)}
        />
      )}
      {showFuel && (
        <FuelLogForm
          bikeId={singleBike?.id}
          currentMileage={singleBike?.current_mileage}
          tankCapacity={singleBike?.tank_capacity ?? null}
          onClose={() => setShowFuel(false)}
        />
      )}
    </>
  );
}
