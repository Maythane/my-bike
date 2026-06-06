import { lazy, Suspense, useState } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { getToken } from "./hooks/useAuth";
import Blobs from "./components/ui/Blobs";
import AvatarMenu from "./components/ui/AvatarMenu";
import AuthPage from "./pages/AuthPage";
import { Card } from "./components/ui/card";
import { getAllMotorcycles } from "./api/motorcycles";
import ServiceLogForm from "./components/logs/ServiceLogForm";
import FuelLogForm from "./components/logs/FuelLogForm";

const GaragePage = lazy(() => import("./pages/GaragePage"));
const ShockSettingsPage = lazy(() => import("./pages/ShockSettingsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ShockSetupPage = lazy(() => import("./pages/ShockSetupPage"));
const ServiceRemindersPage = lazy(() => import("./pages/ServiceRemindersPage"));
const ExpenseDashboardPage = lazy(() => import("./pages/ExpenseDashboardPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="page" aria-label="กำลังโหลดหน้า">
      <Card style={{ height: 72, marginBottom: 10 }} />
      <Card style={{ height: 142, marginBottom: 10 }} />
      <Card style={{ height: 118 }} />
    </div>
  );
}

function NavBar() {
  const [fabOpen, setFabOpen] = useState(false);
  const [showService, setShowService] = useState(false);
  const [showFuel, setShowFuel] = useState(false);

  const { data: bikes = [] } = useQuery({
    queryKey: ["motorcycles"],
    queryFn: getAllMotorcycles,
  });

  const singleBike = bikes.length === 1 ? bikes[0] : undefined;

  return (
    <nav className="app-nav">
      <NavLink to="/" end viewTransition className="flex items-center gap-2 mr-2">
        <span style={{ fontSize: 24 }}>🏍️</span>
      </NavLink>
      
      <div className="app-nav-links">
        <NavLink
          to="/" end viewTransition
          className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
        >
          <span className="hidden sm:inline">Garage</span>
          <span className="sm:hidden text-[20px]">🏍️</span>
        </NavLink>
        <NavLink
          to="/expenses" viewTransition
          className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
        >
          <span className="hidden sm:inline">ค่าใช้จ่าย</span>
          <span className="sm:hidden text-[20px]">💰</span>
        </NavLink>
        <NavLink
          to="/settings" viewTransition
          className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
        >
          <span className="hidden sm:inline">ตั้งค่า</span>
          <span className="sm:hidden text-[20px]">⚙️</span>
        </NavLink>
      </div>

      <div style={{ flex: 1 }} />

      <div className="flex items-center gap-2">
        {bikes.length > 0 && (
          <div className="relative">
            <button
              className={`app-nav-toggle ${fabOpen ? "is-active bg-[var(--purple-bg)] border-[var(--purple-border)] text-[var(--purple)]" : ""}`}
              onClick={() => setFabOpen(!fabOpen)}
              title="บันทึกรายการ"
            >
              <span style={{ transform: fabOpen ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
            </button>

            {fabOpen && (
              <>
                <div className="fixed inset-0 z-[101]" onClick={() => setFabOpen(false)} />
                <div 
                  className="absolute top-[calc(100%+8px)] right-0 z-[102] min-w-[180px] overflow-hidden rounded-[var(--r)] border border-[var(--glass-border)] bg-[var(--canvas)] shadow-[var(--shadow-modal)]"
                  style={{ animation: "overflow-pop 0.18s var(--jelly-ease)" }}
                >
                  <button className="quick-log-item" onClick={() => { setFabOpen(false); setShowService(true); }}>
                    <span className="quick-log-icon" style={{ background: "var(--purple-bg)", border: "1px solid var(--purple-border)" }}>🔧</span>
                    บำรุงรักษา
                  </button>
                  <button className="quick-log-item" onClick={() => { setFabOpen(false); setShowFuel(true); }}>
                    <span className="quick-log-icon" style={{ background: "var(--amber-bg)", border: "1px solid var(--amber-border)" }}>⛽</span>
                    เติมน้ำมัน
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <button
          className="app-nav-toggle hidden sm:flex"
          title="ปั๊มน้ำมันใกล้เคียง"
          onClick={() => {
            if (!navigator.geolocation) {
              window.open("https://maps.google.com/?q=ปั๊มน้ำมัน", "_blank");
              return;
            }
            navigator.geolocation.getCurrentPosition(
              ({ coords }) => {
                window.open(
                  `https://www.google.com/maps/search/ปั๊มน้ำมัน/@${coords.latitude},${coords.longitude},15z`,
                  "_blank"
                );
              },
              () => {
                window.open("https://maps.google.com/?q=ปั๊มน้ำมัน", "_blank");
              }
            );
          }}
        >
          🗺️
        </button>
        <AvatarMenu />
      </div>

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
    </nav>
  );
}

function AppShell() {
  return (
    <Routes>
      {/* Public — no NavBar */}
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />

      {/* Protected — with NavBar */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", zIndex: 1 }}>
              <NavBar />
              <div style={{ flex: 1, overflowY: "auto", scrollbarGutter: "stable" }}>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/" element={<GaragePage />} />
                    <Route path="/bikes/:bikeId" element={<Navigate to="/" replace />} />
                    <Route path="/shock-settings" element={<ShockSettingsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/settings/bikes/:bikeId/shock" element={<ShockSetupPage />} />
                    <Route path="/bikes/:bikeId/reminders" element={<ServiceRemindersPage />} />
                    <Route path="/expenses" element={<ExpenseDashboardPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </div>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Blobs />
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
