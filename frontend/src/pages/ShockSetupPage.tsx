import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getShockSetting, updateShockSetting } from "../api/shock";
import { fetchShockBrands } from "../api/shockBrands";

export default function ShockSetupPage() {
  const { bikeId } = useParams<{ bikeId: string }>();
  const id = Number(bikeId);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: setting } = useQuery({
    queryKey: ["shock-setting", id],
    queryFn: () => getShockSetting(id),
  });
  const { data: brands } = useQuery({ queryKey: ["shock-brands"], queryFn: fetchShockBrands });

  const [brand, setBrand] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const effectiveBrand = brand ?? setting?.shock_brand ?? null;
  const effectiveModel = model ?? setting?.shock_model ?? null;

  const selectedBrandData = brands?.find((b) => b.name === effectiveBrand);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      updateShockSetting(id, {
        shock_brand: effectiveBrand ?? undefined,
        shock_model: effectiveModel ?? undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shock-setting", id] });
      setSaved(true);
      setTimeout(() => navigate("/settings"), 1000);
    },
  });

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/settings")}
          style={{ fontSize: 13 }}
        >
          ← Settings
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          Shock Setup
        </h1>
      </div>
      <p style={{ color: "var(--slate)", fontSize: 13, marginBottom: 20 }}>Bike ID: {id}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Step 1: Brand */}
        <div>
          <StepLabel n={1} label="Shock Brand" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {brands?.map((b) => (
              <button
                key={b.name}
                className={effectiveBrand === b.name ? "chip-brand-active" : "chip-brand-idle"}
                onClick={() => { setBrand(b.name); setModel(null); }}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Model — only when brand is selected and has models */}
        {selectedBrandData && selectedBrandData.shock_models.length > 0 && (
          <div>
            <StepLabel n={2} label="Shock Model" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selectedBrandData.shock_models.map((m) => (
                <button
                  key={m}
                  className={effectiveModel === m ? "chip-brand-active" : "chip-brand-idle"}
                  onClick={() => setModel(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {saved ? (
          <p style={{ color: "var(--green)", fontSize: 14 }}>✓ บันทึกแล้ว กลับไปหน้า Settings…</p>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => save()}
            disabled={isPending || !effectiveBrand}
          >
            {isPending ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        )}
      </div>
    </div>
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        background: "var(--purple-bg)", border: "1px solid var(--purple-border)",
        color: "var(--purple)", fontSize: 11, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{n}</div>
      <span style={{ fontSize: 12, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
    </div>
  );
}
