import { BrowserRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GaragePage from "./pages/GaragePage";
import BikePage from "./pages/BikePage";
import ShockSettingsPage from "./pages/ShockSettingsPage";
import { useTheme } from "./hooks/useTheme";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { getToken } from "./hooks/useAuth";

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

function Blobs() {
  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}
    >
      {/* Neon green — top-right */}
      <div style={{
        position: "absolute",
        width: 560, height: 560,
        background: "radial-gradient(circle, rgba(57,255,150,0.55) 0%, transparent 70%)",
        filter: "blur(90px)",
        top: "-140px", right: "-100px",
        animation: "blob-float 13s ease-in-out infinite",
        opacity: 0.6,
      }} />
      {/* Cyan — bottom-left */}
      <div style={{
        position: "absolute",
        width: 480, height: 480,
        background: "radial-gradient(circle, rgba(0,210,255,0.50) 0%, transparent 70%)",
        filter: "blur(80px)",
        bottom: "5%", left: "-80px",
        animation: "blob-float 17s ease-in-out infinite reverse",
        animationDelay: "-6s",
        opacity: 0.5,
      }} />
      {/* Deep violet — centre */}
      <div style={{
        position: "absolute",
        width: 420, height: 420,
        background: "radial-gradient(circle, rgba(124,58,237,0.55) 0%, transparent 70%)",
        filter: "blur(80px)",
        top: "38%", left: "45%",
        transform: "translate(-50%, -50%)",
        animation: "blob-float 20s ease-in-out infinite",
        animationDelay: "-10s",
        opacity: 0.45,
      }} />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
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
        <NavLink
          to="/shock-settings"
          className={({ isActive }) => `app-nav-link app-nav-link-accent${isActive ? " is-active" : ""}`}
        >
          ตั้งค่าโช้ค
        </NavLink>
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={toggle}
        title={theme === "dark" ? "เปลี่ยนเป็น light mode" : "เปลี่ยนเป็น dark mode"}
        className="app-nav-toggle"
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.10) rotate(15deg)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1) rotate(0deg)")}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>
      <button
        onClick={() => { localStorage.removeItem("moto_token"); window.location.href = "/login"; }}
        className="app-nav-toggle"
        title="ออกจากระบบ"
      >
        🚪
      </button>
    </nav>
  );
}

function AppShell() {
  const { theme, toggle } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative", zIndex: 1 }}>
      <NavBar theme={theme} toggle={toggle} />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><GaragePage /></ProtectedRoute>} />
          <Route path="/bikes/:bikeId" element={<ProtectedRoute><BikePage /></ProtectedRoute>} />
          <Route path="/shock-settings" element={<ProtectedRoute><ShockSettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
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
