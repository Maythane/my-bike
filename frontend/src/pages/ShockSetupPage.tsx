import { useState, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getShockSetting, updateShockSetting, lookupShockChart } from "../api/shock";
import { fetchShockBrands } from "../api/shockBrands";
import { getAllMotorcycles } from "../api/motorcycles";
import type { ShockBand } from "../types";

export default function ShockSetupPage() {
  const { bikeId } = useParams<{ bikeId: string }>();
  const id = Number(bikeId);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const from = location.state?.from as string | undefined;
  const backTo = from === "shock-settings" ? "/shock-settings"
    : from === "settings" ? "/settings"
    : "/";

  const { data: bikes = [] } = useQuery({ queryKey: ["motorcycles"], queryFn: getAllMotorcycles });
  const { data: brands = [] } = useQuery({ queryKey: ["shock-brands"], queryFn: fetchShockBrands });
  const { data: saved } = useQuery({ queryKey: ["shock-setting", id], queryFn: () => getShockSetting(id) });

  const [motoMake, setMotoMake]       = useState<string | null>(null);
  const [motoModel, setMotoModel]     = useState<string | null>(null);
  const [shockBrand, setShockBrand]   = useState<string | null>(null);
  const [shockModel, setShockModel]   = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<{ found: boolean; bands: ShockBand[] | null } | null>(null);
  const [saved2, setSaved] = useState(false);

  // Derive unique makes and models from registered bikes
  const motoMakes = useMemo(() => [...new Set(bikes.map((b) => b.make))].sort(), [bikes]);
  const motoModels = useMemo(
    () => [...new Set(bikes.filter((b) => b.make === motoMake).map((b) => b.model))].sort(),
    [bikes, motoMake],
  );

  const selectedBrandData = brands.find((b) => b.name === shockBrand);
  const allFilled = motoMake && motoModel && shockBrand;

  const lookupMut = useMutation({
    mutationFn: () => lookupShockChart(shockBrand!, shockModel ?? null, motoMake, motoModel),
    onSuccess: (data) => setLookupResult(data),
  });

  const saveMut = useMutation({
    mutationFn: () => updateShockSetting(id, {
      shock_brand: shockBrand ?? undefined,
      shock_model: shockModel ?? undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shock-setting", id] });
      setSaved(true);
      setTimeout(() => navigate(backTo, { viewTransition: true }), 1000);
    },
  });

  function handleMotoMakeSelect(make: string) {
    setMotoMake(make);
    setMotoModel(null);
    setShockBrand(null);
    setShockModel(null);
    setLookupResult(null);
  }
  function handleMotoModelSelect(model: string) {
    setMotoModel(model);
    setShockBrand(null);
    setShockModel(null);
    setLookupResult(null);
  }
  function handleShockBrandSelect(brand: string) {
    setShockBrand(brand);
    setShockModel(null);
    setLookupResult(null);
  }
  function handleShockModelSelect(model: string) {
    setShockModel(model);
    setLookupResult(null);
  }

  const currentBike = bikes.find((b) => b.id === id);

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            document.documentElement.dataset.navDir = "back";
            setTimeout(() => { delete document.documentElement.dataset.navDir; }, 500);
            navigate(backTo, { viewTransition: true });
          }}
        >← กลับ</Button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            ตั้งค่าโช้ค
          </h1>
          {currentBike && (
            <p style={{ fontSize: 13, color: "var(--slate)", margin: "2px 0 0" }}>
              {currentBike.nickname ?? `${currentBike.make} ${currentBike.model}`}
            </p>
          )}
        </div>
      </div>

      {/* Saved indicator */}
      {saved?.shock_brand && !shockBrand && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: "var(--r)",
          background: "var(--purple-bg)", border: "1px solid var(--purple-border)",
          fontSize: 13, color: "var(--purple)",
        }}>
          ปัจจุบัน: <strong>{saved.shock_brand}</strong>
          {saved.shock_model && <> · {saved.shock_model}</>}
          <span style={{ color: "var(--slate)", fontWeight: 400 }}> — เลือกใหม่ด้านล่างเพื่อเปลี่ยน</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Step 1: ยี่ห้อรถ */}
        <StepSection n={1} label="ยี่ห้อรถ" active={!motoMake} done={!!motoMake}>
          <ChipGroup
            items={motoMakes}
            selected={motoMake}
            onSelect={handleMotoMakeSelect}
          />
          {motoMakes.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--slate)" }}>ยังไม่มีรถในระบบ — เพิ่มรถก่อน</p>
          )}
        </StepSection>

        {/* Step 2: รุ่นรถ */}
        {motoMake && (
          <StepSection n={2} label="รุ่นรถ" active={!motoModel} done={!!motoModel}>
            <ChipGroup
              items={motoModels}
              selected={motoModel}
              onSelect={handleMotoModelSelect}
            />
          </StepSection>
        )}

        {/* Step 3: Shock Brand */}
        {motoModel && (
          <StepSection n={3} label="Shock Brand" active={!shockBrand} done={!!shockBrand}>
            <ChipGroup
              items={brands.map((b) => b.name)}
              selected={shockBrand}
              onSelect={handleShockBrandSelect}
            />
          </StepSection>
        )}

        {/* Step 4: รุ่นย่อย Shock */}
        {shockBrand && selectedBrandData && selectedBrandData.shock_models.length > 0 && (
          <StepSection n={4} label="รุ่นย่อย Shock" active={!shockModel} done={!!shockModel}>
            <ChipGroup
              items={selectedBrandData.shock_models}
              selected={shockModel}
              onSelect={handleShockModelSelect}
            />
          </StepSection>
        )}

        {/* Lookup / Result */}
        {allFilled && (
          <div>
            {!lookupResult ? (
              <Button
                variant="default"
                style={{ width: "100%" }}
                onClick={() => lookupMut.mutate()}
                disabled={lookupMut.isPending}
              >
                {lookupMut.isPending ? "กำลังค้นหา…" : "ค้นหาข้อมูล Preset"}
              </Button>
            ) : lookupResult.found && lookupResult.bands ? (
              <PresetsFound
                bands={lookupResult.bands}
                shockBrand={shockBrand!}
                shockModel={shockModel}
                onSave={() => saveMut.mutate()}
                saving={saveMut.isPending}
                saved={saved2}
              />
            ) : (
              <NoPresetFound shockBrand={shockBrand!} shockModel={shockModel} onSave={() => saveMut.mutate()} saving={saveMut.isPending} saved={saved2} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step section wrapper ── */
function StepSection({ n, label, active, done, children }: {
  n: number; label: string; active: boolean; done: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ opacity: done ? 0.7 : 1, transition: "opacity 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          background: done ? "var(--purple-bg)" : active ? "var(--purple)" : "var(--surface-soft)",
          border: `1px solid ${done || active ? "var(--purple-border)" : "var(--glass-border)"}`,
          color: done || active ? "var(--purple)" : "var(--steel)",
          fontSize: 11, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {done ? "✓" : n}
        </div>
        <span style={{
          fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const,
          letterSpacing: "0.08em",
          color: active ? "var(--ink)" : done ? "var(--slate)" : "var(--steel)",
        }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ── Chip group ── */
function ChipGroup({ items, selected, onSelect }: {
  items: string[]; selected: string | null; onSelect: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
      {items.map((item) => (
        <button
          key={item}
          className={selected === item ? "chip-brand-active" : "chip-brand-idle"}
          onClick={() => onSelect(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

/* ── Found: show chart table + save button ── */
function PresetsFound({ bands, shockBrand, shockModel, onSave, saving, saved }: {
  bands: ShockBand[]; shockBrand: string; shockModel: string | null;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        padding: "12px 14px", borderRadius: "var(--r)",
        background: "rgba(57,255,150,0.08)", border: "1px solid var(--green-border)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>✅</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
            พบข้อมูล Preset
          </div>
          <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 2 }}>
            {shockBrand}{shockModel ? ` · ${shockModel}` : ""}
          </div>
        </div>
      </div>

      <Card style={{ padding: "16px", overflowX: "auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
          ตารางค่าแนะนำ
        </div>
        <table className="shock-table">
          <thead>
            <tr>
              <th>น้ำหนักรวม (กก.)</th>
              <th>Preload (mm)</th>
              <th>Street Comp / Reb</th>
              <th>Heavy Comp / Reb</th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b) => (
              <tr key={b.label}>
                <td>{b.label}</td>
                <td>{b.preloadMin}{b.preloadMin !== b.preloadMax ? ` - ${b.preloadMax}` : ""}</td>
                <td>{b.streetCompMin}-{b.streetCompMax} / {b.streetRebMin}-{b.streetRebMax}</td>
                <td>{b.heavyCompMin}-{b.heavyCompMax} / {b.heavyRebMin}-{b.heavyRebMax}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {saved ? (
        <p style={{ color: "var(--green)", fontSize: 14, textAlign: "center" }}>✓ บันทึกแล้ว กลับไปหน้าก่อนหน้า…</p>
      ) : (
        <Button variant="default" onClick={onSave} disabled={saving}>
          {saving ? "กำลังบันทึก…" : `บันทึก ${shockBrand}${shockModel ? ` ${shockModel}` : ""} ให้รถนี้`}
        </Button>
      )}
    </div>
  );
}

/* ── Not found ── */
function NoPresetFound({ shockBrand, shockModel, onSave, saving, saved }: {
  shockBrand: string; shockModel: string | null;
  onSave: () => void; saving: boolean; saved: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        padding: "14px 16px", borderRadius: "var(--r)",
        background: "rgba(255,112,112,0.08)", border: "1px solid rgba(255,112,112,0.25)",
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
          ⚠️ ยังไม่มีข้อมูล Chart สำหรับโช้คนี้
        </div>
        <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--ink)" }}>{shockBrand}{shockModel ? ` ${shockModel}` : ""}</strong>
          {" "}ยังไม่มีข้อมูลค่าตั้งในระบบ — ระบบจะใช้ค่าอ้างอิงทั่วไปแทน
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--steel)" }}>
        ยังสามารถบันทึกโช้คนี้ให้รถได้ และใช้ตารางค่าอ้างอิงทั่วไปในหน้า Shock Settings
      </p>
      {saved ? (
        <p style={{ color: "var(--green)", fontSize: 14, textAlign: "center" }}>✓ บันทึกแล้ว กลับไปหน้าก่อนหน้า…</p>
      ) : (
        <Button variant="secondary" onClick={onSave} disabled={saving}>
          {saving ? "กำลังบันทึก…" : `บันทึก ${shockBrand}${shockModel ? ` ${shockModel}` : ""} ให้รถนี้อยู่ดี`}
        </Button>
      )}
    </div>
  );
}
