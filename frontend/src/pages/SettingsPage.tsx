import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAllMotorcycles } from "../api/motorcycles";
import { fetchSettings, updateSettings } from "../api/settings";
import { getShockSetting } from "../api/shock";

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

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(-1)}
          style={{ fontSize: 13 }}
        >
          ← กลับ
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          ⚙️ Settings
        </h1>
      </div>

      {/* General settings */}
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

      {/* Per-bike shock setup */}
      <div style={{ marginBottom: 24 }}>
        <div className="settings-section-label">Shock Setup ต่อคัน</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {bikes?.map((bike) => (
            <BikeSockRow
              key={bike.id}
              bikeId={bike.id}
              bikeName={bike.nickname ?? `${bike.make} ${bike.model}`}
              onEdit={() => navigate(`/settings/bikes/${bike.id}/shock`)}
            />
          ))}
          {!bikes?.length && (
            <div style={{ color: "var(--slate)", fontSize: 13 }}>ยังไม่มีรถในระบบ</div>
          )}
        </div>
      </div>

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
