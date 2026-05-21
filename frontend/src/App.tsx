import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTheme } from "./hooks/useTheme";
import { getToken } from "./hooks/useAuth";
import Blobs from "./components/ui/Blobs";
import AvatarMenu from "./components/ui/AvatarMenu";
import BottomNav from "./components/ui/BottomNav";
import AuthPage from "./pages/AuthPage";
import GaragePage from "./pages/GaragePage";
import BikePage from "./pages/BikePage";
import ShockSettingsPage from "./pages/ShockSettingsPage";
import SettingsPage from "./pages/SettingsPage";
import ShockSetupPage from "./pages/ShockSetupPage";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function NavBar({ theme, toggle }: { theme: "light" | "dark"; toggle: () => void }) {
  return (
    <nav className="app-nav">
      <span style={{ fontSize: 20 }}>🏍️</span>
      <div className="app-nav-links">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `app-nav-link${isActive ? " is-active" : ""}`}
        >
          My Garage
        </NavLink>
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={toggle}
        title={theme === "dark" ? "Light mode" : "Dark mode"}
        className="app-nav-toggle"
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.10) rotate(15deg)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1) rotate(0deg)")}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
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
  const { theme, toggle } = useTheme();
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
              <NavBar theme={theme} toggle={toggle} />
              <div style={{ flex: 1, overflowY: "auto" }}>
                <Routes>
                  <Route path="/" element={<GaragePage />} />
                  <Route path="/bikes/:bikeId" element={<BikePage />} />
                  <Route path="/shock-settings" element={<ShockSettingsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settings/bikes/:bikeId/shock" element={<ShockSetupPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
              <BottomNav />
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
