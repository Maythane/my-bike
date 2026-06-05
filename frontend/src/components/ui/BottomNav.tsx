// frontend/src/components/ui/BottomNav.tsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAllMotorcycles } from "../../api/motorcycles";
import ServiceLogForm from "../logs/ServiceLogForm";
import FuelLogForm from "../logs/FuelLogForm";

function cn(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

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
  const expensesActive = location.pathname.startsWith("/expenses");
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
          {/* backdrop */}
          <div
            className="fixed inset-0 z-[59] bg-black/15"
            onClick={() => setFabOpen(false)}
          />
          {/* popup menu above FAB */}
          <div
            className="fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px)+8px)] left-1/2 -translate-x-1/2 z-[61] min-w-[220px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--canvas)] shadow-[0_-6px_32px_rgba(0,0,0,0.45),0_2px_8px_rgba(0,0,0,0.22)]"
            style={{ animation: "bike-fab-popup-in 0.22s var(--jelly-ease) both" }}
          >
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
                  background: "var(--amber-bg)",
                  border: "1px solid var(--amber-border)",
                }}
              >
                ⛽
              </span>
              เติมน้ำมัน
            </button>
          </div>
        </>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 hidden border-t border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[8px] sm:hidden max-[639px]:flex max-[639px]:items-center max-[639px]:h-[calc(64px+env(safe-area-inset-bottom,0px))] max-[639px]:pb-[env(safe-area-inset-bottom,0px)]">
        {/* Garage tab */}
        <button
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-[3px] h-16 px-0 text-[10px] font-medium bg-transparent border-none cursor-pointer transition-colors [-webkit-tap-highlight-color:transparent]",
            garageActive ? "text-[var(--purple)] font-semibold" : "text-[var(--steel)]"
          )}
          onClick={() => navigate("/", { viewTransition: true })}
        >
          <span className="text-[22px] leading-none">🏍️</span>
          Garage
        </button>

        {/* Centre FAB slot */}
        <div className="flex flex-1 flex-col items-center justify-center gap-[3px] relative">
          {bikes.length > 0 && (
            <button
              className={cn(
                "w-[52px] h-[52px] rounded-full border-none cursor-pointer flex items-center justify-center text-white text-[28px] leading-none font-light -mt-5 [-webkit-tap-highlight-color:transparent] transition-[transform] duration-[250ms] [transition-timing-function:var(--jelly-ease)] active:opacity-85",
                "bg-gradient-to-br from-[var(--purple-hover)] to-[var(--purple)] shadow-[0_4px_18px_rgba(139,92,246,0.50),0_0_0_2.5px_rgba(167,139,250,0.20)]",
                fabOpen ? "rotate-45" : ""
              )}
              onClick={() => setFabOpen((v) => !v)}
              aria-label="บันทึกรายการ"
              aria-expanded={fabOpen}
            >
              +
            </button>
          )}
          <span className="text-[10px] font-medium text-[var(--steel)] mt-0.5">บันทึก</span>
        </div>

        {/* Expenses tab */}
        <button
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-[3px] h-16 px-0 text-[10px] font-medium bg-transparent border-none cursor-pointer transition-colors [-webkit-tap-highlight-color:transparent]",
            expensesActive ? "text-[var(--purple)] font-semibold" : "text-[var(--steel)]"
          )}
          onClick={() => navigate("/expenses", { viewTransition: true })}
        >
          <span className="text-[22px] leading-none">💰</span>
          ค่าใช้จ่าย
        </button>

        {/* Settings tab */}
        <button
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-[3px] h-16 px-0 text-[10px] font-medium bg-transparent border-none cursor-pointer transition-colors [-webkit-tap-highlight-color:transparent]",
            settingsActive ? "text-[var(--purple)] font-semibold" : "text-[var(--steel)]"
          )}
          onClick={() => navigate("/settings", { viewTransition: true })}
        >
          <span className="text-[22px] leading-none">⚙️</span>
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
