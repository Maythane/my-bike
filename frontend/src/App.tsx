import { lazy, Suspense } from "react";
import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getToken } from "./hooks/useAuth";
import Blobs from "./components/ui/Blobs";
import AvatarMenu from "./components/ui/AvatarMenu";
import BottomNav from "./components/ui/BottomNav";
import AuthPage from "./pages/AuthPage";

const GaragePage = lazy(() => import("./pages/GaragePage"));
const BikePage = lazy(() => import("./pages/BikePage"));
const ShockSettingsPage = lazy(() => import("./pages/ShockSettingsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ShockSetupPage = lazy(() => import("./pages/ShockSetupPage"));
const ServiceRemindersPage = lazy(() => import("./pages/ServiceRemindersPage"));
const ExpenseDashboardPage = lazy(() => import("./pages/ExpenseDashboardPage"));

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="page" aria-label="กำลังโหลดหน้า">
      <div className="card" style={{ height: 72, marginBottom: 10 }} />
      <div className="card" style={{ height: 142, marginBottom: 10 }} />
      <div className="card" style={{ height: 118 }} />
    </div>
  );
}

function NavBar() {
  return (
    <nav className="app-nav">
      <span style={{ fontSize: 20 }}>🏍️</span>
      <div className="app-nav-links">
        <NavLink
          to="/" end viewTransition
          className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
        >
          My Garage
        </NavLink>
        <NavLink
          to="/expenses" viewTransition
          className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
        >
          💰
        </NavLink>
      </div>
      <div style={{ flex: 1 }} />
      <button
        className="app-nav-toggle"
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
        ⛽
      </button>
      <AvatarMenu />
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
              <BottomNav />
              <div style={{ flex: 1, overflowY: "auto", scrollbarGutter: "stable" }}>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/" element={<GaragePage />} />
                    <Route path="/bikes/:bikeId" element={<BikePage />} />
                    <Route path="/shock-settings" element={<ShockSettingsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/settings/bikes/:bikeId/shock" element={<ShockSetupPage />} />
                    <Route path="/bikes/:bikeId/reminders" element={<ServiceRemindersPage />} />
                    <Route path="/expenses" element={<ExpenseDashboardPage />} />
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
