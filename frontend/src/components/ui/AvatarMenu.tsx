import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchMe } from "../../api/auth";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import AccountModal from "./AccountModal";

export default function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 60_000,
  });

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const displayName = user?.username ? `@${user.username}` : (user?.email ?? "…");
  const initial = (user?.username?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  return (
    <>
      <div className="avatar-menu" ref={ref}>
        <button className="avatar-btn" onClick={() => setOpen((v) => !v)} title="บัญชีผู้ใช้">
          {initial}
        </button>

        {open && (
          <div className="avatar-dropdown">
            <div className="avatar-dropdown-header">
              <div className="avatar-dropdown-email">Signed in as</div>
              <div className="avatar-dropdown-user">{displayName}</div>
            </div>

            <div
              className="avatar-dropdown-item"
              onClick={() => { setOpen(false); setShowAccount(true); }}
            >
              <span>👤</span> Manage Account
            </div>
            <div
              className="avatar-dropdown-item"
              onClick={() => { setOpen(false); navigate("/settings", { viewTransition: true }); }}
            >
              <span>⚙️</span> Settings
            </div>

            <div className="avatar-dropdown-divider" />

            <div className="avatar-dropdown-item" onClick={toggle} style={{ justifyContent: "space-between" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>{theme === "dark" ? "🌙" : "☀️"}</span> Dark Mode
              </span>
              <span style={{
                display: "inline-flex", width: 36, height: 20, borderRadius: 99,
                background: theme === "dark" ? "var(--purple)" : "var(--hairline)",
                alignItems: "center", padding: "0 2px", transition: "background 0.2s",
                flexShrink: 0,
              }}>
                <span style={{
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                  marginLeft: theme === "dark" ? "auto" : 0,
                  transition: "margin 0.2s",
                }} />
              </span>
            </div>

            <div className="avatar-dropdown-divider" />

            <div
              className="avatar-dropdown-item danger"
              onClick={() => { setOpen(false); logout(); }}
            >
              <span>🚪</span> Logout
            </div>
          </div>
        )}
      </div>

      {showAccount && createPortal(
        <AccountModal onClose={() => setShowAccount(false)} />,
        document.body
      )}
    </>
  );
}
