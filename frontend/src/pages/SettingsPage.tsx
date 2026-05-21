import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllMotorcycles } from "../api/motorcycles";
import { fetchSettings, updateSettings } from "../api/settings";
import { getShockSetting } from "../api/shock";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import { fetchMe } from "../api/auth";

export default function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const { data: bikes } = useQuery({ queryKey: ["motorcycles"], queryFn: getAllMotorcycles });

  const [unit, setUnit] = useState<"km" | "miles" | null>(null);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const effectiveUnit = unit ?? settings?.default_unit ?? "km";
  const effectiveTz = timezone ?? settings?.timezone ?? "Asia/Bangkok";

  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: () => updateSettings({ default_unit: effectiveUnit, timezone: effectiveTz }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      setSaveMsg("บันทึกแล้ว");
      setTimeout(() => setSaveMsg(null), 2000);
    },
  });

  const { theme, toggle } = useTheme();
  const { logout } = useAuth();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
  const displayName = user?.username ? `@${user.username}` : (user?.email ?? "…");
  const initial = (user?.username?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  function openGasStation() {
    if (!navigator.geolocation) {
      window.open("https://maps.google.com/?q=ปั๊มน้ำมัน", "_blank");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        window.open(
          `https://www.google.com/maps/search/ปั๊มน้ำมัน/@${coords.latitude},${coords.longitude},15z`,
          "_blank",
        );
      },
      () => window.open("https://maps.google.com/?q=ปั๊มน้ำมัน", "_blank"),
    );
  }

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            document.documentElement.dataset.navDir = "back";
            setTimeout(() => { delete document.documentElement.dataset.navDir; }, 500);
            navigate("/", { viewTransition: true });
          }}
          style={{ fontSize: 13 }}
        >
          ← กลับ
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          ⚙️ Settings
        </h1>
      </div>

      {/* ── Account ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="settings-section-label">Account</div>
        <div className="settings-card">
          <div className="settings-row" style={{ gap: 12, alignItems: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "var(--purple-bg)",
              border: "1px solid var(--purple-border)", display: "flex", alignItems: "center",
              justifyContent: "center", fontWeight: 700, fontSize: 15, color: "var(--purple)", flexShrink: 0,
            }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{displayName}</div>
              {user?.email && <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 1 }}>{user.email}</div>}
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--hairline)", marginTop: 4 }}>
            <button
              className="settings-row"
              style={{ width: "100%", background: "none", border: "none", cursor: "pointer",
                color: "#e55", fontSize: 14, fontWeight: 500, justifyContent: "flex-start", gap: 8 }}
              onClick={logout}
            >
              🚪 ออกจากระบบ
            </button>
          </div>
        </div>
      </div>

      {/* ── Appearance ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="settings-section-label">Appearance</div>
        <div className="settings-card">
          <div className="settings-row" style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, color: "var(--ink)" }}>
              {theme === "dark" ? "🌙" : "☀️"} Dark Mode
            </span>
            <button
              onClick={toggle}
              style={{
                width: 44, height: 24, borderRadius: 99, border: "none", cursor: "pointer",
                background: theme === "dark" ? "var(--purple)" : "var(--hairline)",
                position: "relative", transition: "background 0.2s",
              }}
              aria-label="Toggle dark mode"
            >
              <span style={{
                position: "absolute", top: 2,
                left: theme === "dark" ? "calc(100% - 22px)" : 2,
                width: 20, height: 20, borderRadius: "50%", background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.2s",
              }} />
            </button>
          </div>
        </div>
      </div>

      {/* ── ทั่วไป (existing unit/timezone settings) ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="settings-section-label">ทั่วไป</div>
        <div className="settings-card">
          <div className="settings-row">
            <span className="settings-row-label">Distance Unit</span>
            <div className="toggle-group">
              <button
                className={`toggle-btn${effectiveUnit === "km" ? " active" : ""}`}
                onClick={() => setUnit("km")}
              >km</button>
              <button
                className={`toggle-btn${effectiveUnit === "miles" ? " active" : ""}`}
                onClick={() => setUnit("miles")}
              >miles</button>
            </div>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">Timezone</span>
            <input
              style={{
                background: "var(--surface)", border: "1px solid var(--glass-border)",
                borderRadius: "var(--r)", padding: "6px 12px", color: "var(--ink)",
                fontSize: 13, width: 160,
              }}
              value={effectiveTz}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Shock Setup ต่อคัน (existing) ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="settings-section-label">Shock Setup ต่อคัน</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bikes?.map((bike) => (
            <BikeSockRow
              key={bike.id}
              bikeId={bike.id}
              bikeName={bike.nickname ?? `${bike.make} ${bike.model}`}
              onEdit={() => navigate(`/settings/bikes/${bike.id}/shock`, { viewTransition: true, state: { from: "settings" } })}
            />
          ))}
          {!bikes?.length && (
            <div style={{ color: "var(--slate)", fontSize: 13 }}>ยังไม่มีรถในระบบ</div>
          )}
        </div>
      </div>

      {/* ── App ── */}
      <div style={{ marginBottom: 24 }}>
        <div className="settings-section-label">App</div>
        <div className="settings-card">
          <button
            className="settings-row"
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer",
              fontSize: 14, color: "var(--ink)", justifyContent: "space-between" }}
            onClick={openGasStation}
          >
            <span>⛽ ค้นหาปั๊มน้ำมันใกล้เคียง</span>
            <span style={{ fontSize: 12, color: "var(--slate)" }}>›</span>
          </button>
        </div>
      </div>

      {/* Save button (for unit/timezone) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          className="btn btn-primary"
          onClick={() => saveSettings()}
          disabled={isPending}
        >
          {isPending ? "กำลังบันทึก…" : "Save Settings"}
        </button>
        {saveMsg && (
          <span style={{ color: "var(--green)", fontSize: 13 }}>✓ {saveMsg}</span>
        )}
      </div>
    </div>
  );
}

function BikeSockRow({
  bikeId, bikeName, onEdit,
}: { bikeId: number; bikeName: string; onEdit: () => void }) {
  const { data: setting } = useQuery({
    queryKey: ["shock-setting", bikeId],
    queryFn: () => getShockSetting(bikeId),
  });

  const shockLabel = setting?.shock_brand
    ? `${setting.shock_brand}${setting.shock_model ? ` · ${setting.shock_model}` : ""}`
    : "ยังไม่ได้ตั้งค่า";

  return (
    <div className="settings-bike-card">
      <div>
        <div className="settings-bike-name">{bikeName}</div>
        <div className="settings-bike-shock">{shockLabel}</div>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onEdit} style={{ fontSize: 12 }}>
        แก้ไข
      </button>
    </div>
  );
}
