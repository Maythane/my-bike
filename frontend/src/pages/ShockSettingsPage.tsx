import { useEffect, useMemo, useState } from "react";
import { getShockSetting, updateShockSetting } from "../api/shock";
import { listPresets, createPreset, updatePreset, deletePreset, type ShockPreset } from "../api/shock_presets";

type RideMode = "street" | "heavy";

type ShockBand = {
  label: string;
  min: number;
  max: number; // exclusive upper bound (use < for comparison), except last band
  preloadMin: number;
  preloadMax: number;
  streetCompMin: number;
  streetCompMax: number;
  streetRebMin: number;
  streetRebMax: number;
  heavyCompMin: number;
  heavyCompMax: number;
  heavyRebMin: number;
  heavyRebMax: number;
};

const SHOCK_BANDS: ShockBand[] = [
  { label: "< 50",     min: 0,   max: 50,  preloadMin: 1,  preloadMax: 3,  streetCompMin: 3,  streetCompMax: 9,  streetRebMin: 3,  streetRebMax: 9,  heavyCompMin: 5,  heavyCompMax: 11, heavyRebMin: 5,  heavyRebMax: 11 },
  { label: "50 - 70",  min: 50,  max: 70,  preloadMin: 3,  preloadMax: 3,  streetCompMin: 4,  streetCompMax: 10, streetRebMin: 4,  streetRebMax: 10, heavyCompMin: 6,  heavyCompMax: 12, heavyRebMin: 6,  heavyRebMax: 12 },
  { label: "70 - 90",  min: 70,  max: 90,  preloadMin: 3,  preloadMax: 5,  streetCompMin: 5,  streetCompMax: 11, streetRebMin: 5,  streetRebMax: 11, heavyCompMin: 7,  heavyCompMax: 13, heavyRebMin: 7,  heavyRebMax: 13 },
  { label: "90 - 110", min: 90,  max: 110, preloadMin: 8,  preloadMax: 10, streetCompMin: 6,  streetCompMax: 12, streetRebMin: 6,  streetRebMax: 12, heavyCompMin: 8,  heavyCompMax: 14, heavyRebMin: 8,  heavyRebMax: 14 },
  { label: "110 - 130",min: 110, max: 130, preloadMin: 10, preloadMax: 13, streetCompMin: 7,  streetCompMax: 13, streetRebMin: 7,  streetRebMax: 13, heavyCompMin: 9,  heavyCompMax: 15, heavyRebMin: 9,  heavyRebMax: 15 },
  { label: "130 - 150",min: 130, max: 151, preloadMin: 20, preloadMax: 22, streetCompMin: 8,  streetCompMax: 14, streetRebMin: 8,  streetRebMax: 14, heavyCompMin: 10, heavyCompMax: 16, heavyRebMin: 10, heavyRebMax: 16 },
];

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
function average(min: number, max: number) {
  return (min + max) / 2;
}

function IconSpring({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="2" x2="15" y2="2"/>
      <path d="M15 2 L5 6.5 L15 11 L5 15.5 L15 20 L5 24"/>
      <line x1="5" y1="24" x2="15" y2="24"/>
    </svg>
  );
}

function IconCompression({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v10"/>
      <path d="M8 13l4 4 4-4"/>
    </svg>
  );
}

function IconRebound({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 17V7"/>
      <path d="M8 11l4-4 4 4"/>
    </svg>
  );
}

function IconRoad({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21L9 3h6l4 18"/>
      <path d="M9 3h6"/>
      <path d="M5 21h14"/>
      <path d="M12 8v2M12 14v2"/>
    </svg>
  );
}

function IconTruck({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="7" width="14" height="11" rx="1"/>
      <path d="M15 11h3.5L22 15v3h-7V11z"/>
      <circle cx="5" cy="18" r="2"/>
      <circle cx="18" cy="18" r="2"/>
    </svg>
  );
}

function IconCalculator({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/>
      <rect x="7" y="5" width="10" height="3.5" rx="0.8"/>
      <circle cx="8" cy="13" r="1" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="13" r="1" fill="currentColor" stroke="none"/>
      <circle cx="8" cy="17.5" r="1" fill="currentColor" stroke="none"/>
      <circle cx="12" cy="17.5" r="1" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="17.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function IconBarChart({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="2" y="14" width="4" height="8" rx="1"/>
      <rect x="9" y="8" width="4" height="14" rx="1"/>
      <rect x="16" y="3" width="4" height="19" rx="1"/>
    </svg>
  );
}

function IconWaves({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M2 7.5C4.5 4.5 8 3 12 3s7.5 1.5 10 4.5"/>
      <path d="M4.5 11C6.5 8.8 9 7.5 12 7.5s5.5 1.3 7.5 3.5"/>
      <path d="M7.5 14.5C9 12.8 10.4 12 12 12s3 .8 4.5 2.5"/>
      <circle cx="12" cy="17.5" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

type SaveForm = {
  name: string;
  rider_weight: string;
  passenger_weight: string;
  mode: RideMode;
  preload: string;
  comp: string;
  reb: string;
  note: string;
};

// TODO(Task 11): replace with real bikeId from bike selector context
const TEMP_BIKE_ID = 0;

export default function ShockSettingsPage() {
  const [riderInput, setRiderInput] = useState("75");
  const [passengerInput, setPassengerInput] = useState("0");
  const [modeInput, setModeInput] = useState<RideMode>("street");
  const [applied, setApplied] = useState({ rider: 75, passenger: 0, mode: "street" as RideMode });
  const [showInfo, setShowInfo] = useState(false);
  const [presets, setPresets] = useState<ShockPreset[]>([]);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [editPreset, setEditPreset] = useState<ShockPreset | null>(null);
  const [editForm, setEditForm] = useState<SaveForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveForm, setSaveForm] = useState<SaveForm>({
    name: "", rider_weight: "75", passenger_weight: "0", mode: "street",
    preload: "", comp: "", reb: "", note: "",
  });

  useEffect(() => {
    getShockSetting(TEMP_BIKE_ID).then((s) => {
      setRiderInput(String(s.rider_weight));
      setPassengerInput(String(s.passenger_weight));
      setModeInput(s.mode as RideMode);
      setApplied({ rider: s.rider_weight, passenger: s.passenger_weight, mode: s.mode as RideMode });
    }).catch(() => {});
    listPresets().then(setPresets).catch(() => {});
  }, []);

  const totalWeight = applied.rider + applied.passenger;
  const activeBand = useMemo(
    () => SHOCK_BANDS.find((band) => totalWeight >= band.min && totalWeight < band.max) ?? null,
    [totalWeight],
  );

  const recommended = useMemo(() => {
    if (!activeBand) return null;
    const compMin = applied.mode === "street" ? activeBand.streetCompMin : activeBand.heavyCompMin;
    const compMax = applied.mode === "street" ? activeBand.streetCompMax : activeBand.heavyCompMax;
    const rebMin = applied.mode === "street" ? activeBand.streetRebMin : activeBand.heavyRebMin;
    const rebMax = applied.mode === "street" ? activeBand.streetRebMax : activeBand.heavyRebMax;
    return {
      preload: average(activeBand.preloadMin, activeBand.preloadMax),
      preloadRange: `${formatNumber(activeBand.preloadMin)} - ${formatNumber(activeBand.preloadMax)} mm`,
      comp: Math.round(average(compMin, compMax)),
      compRange: `${compMin} - ${compMax}`,
      reb: Math.round(average(rebMin, rebMax)),
      rebRange: `${rebMin} - ${rebMax}`,
    };
  }, [activeBand, applied.mode]);

  const unsupportedHigh = totalWeight > 150;

  function openSaveSheet() {
    setSaveForm({
      name: "",
      rider_weight: riderInput || "0",
      passenger_weight: passengerInput || "0",
      mode: modeInput,
      preload: recommended ? formatNumber(recommended.preload) : "",
      comp: recommended ? String(recommended.comp) : "",
      reb: recommended ? String(recommended.reb) : "",
      note: "",
    });
    setShowSaveSheet(true);
  }

  async function handleSave() {
    if (!saveForm.name.trim()) return;
    setSaving(true);
    try {
      const created = await createPreset({
        name: saveForm.name.trim(),
        rider_weight: Number(saveForm.rider_weight) || 0,
        passenger_weight: Number(saveForm.passenger_weight) || 0,
        mode: saveForm.mode,
        preload: Number(saveForm.preload) || 0,
        comp: Number(saveForm.comp) || 0,
        reb: Number(saveForm.reb) || 0,
        note: saveForm.note.trim() || null,
        user_id: null,
        motorcycle_id: TEMP_BIKE_ID || null,
        shock_brand: null,
        shock_model: null,
      });
      setPresets((prev) => [created, ...prev]);
      setShowSaveSheet(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePreset(id: number) {
    await deletePreset(id).catch(() => {});
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }

  function openEditSheet(p: ShockPreset) {
    setEditPreset(p);
    setEditForm({
      name: p.name,
      rider_weight: String(p.rider_weight),
      passenger_weight: String(p.passenger_weight),
      mode: p.mode as RideMode,
      preload: formatNumber(p.preload),
      comp: String(p.comp),
      reb: String(p.reb),
      note: p.note ?? "",
    });
  }

  async function handleUpdate() {
    if (!editPreset || !editForm || !editForm.name.trim()) return;
    setSaving(true);
    try {
      const updated = await updatePreset(editPreset.id, {
        name: editForm.name.trim(),
        rider_weight: Number(editForm.rider_weight) || 0,
        passenger_weight: Number(editForm.passenger_weight) || 0,
        mode: editForm.mode,
        preload: Number(editForm.preload) || 0,
        comp: Number(editForm.comp) || 0,
        reb: Number(editForm.reb) || 0,
        note: editForm.note.trim() || null,
      });
      setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditPreset(null);
      setEditForm(null);
    } finally {
      setSaving(false);
    }
  }

  function loadPreset(p: ShockPreset) {
    setRiderInput(String(p.rider_weight));
    setPassengerInput(String(p.passenger_weight));
    setModeInput(p.mode as RideMode);
    setApplied({ rider: p.rider_weight, passenger: p.passenger_weight, mode: p.mode as RideMode });
    updateShockSetting(TEMP_BIKE_ID, { rider_weight: p.rider_weight, passenger_weight: p.passenger_weight, mode: p.mode }).catch(() => {});
  }

  return (
    <div className="page shock-page">
      <div className="shock-page-header">
        <div>
          <p className="shock-page-kicker">Profender Setup</p>
          <h1>ตั้งค่าโช้ค</h1>
          <p className="shock-page-subtitle">Grand Filano 2018 - 2022 ตาม chart น้ำหนักรวมของผู้ขับขี่และคนซ้อน</p>
        </div>
      </div>

      <section className="shock-hero-card">
        <div className="shock-hero-bike" aria-hidden>
          <img
            src="/grand-filano-nobg.png"
            alt=""
            className="shock-hero-bike-image"
          />
        </div>
        <div className="shock-hero-copy">
          <span className="shock-brand">Yamaha</span>
          <h2>Grand Filano</h2>
          <div className="shock-year-pill">2018 - 2022</div>
          <p className="shock-hero-note"><strong>Profender</strong> Premium Suspension</p>
        </div>
      </section>

      {/* ── Preset strip ── */}
      <section className="shock-preset-strip">
        <div className="shock-preset-strip-head">
          <span className="shock-page-kicker" style={{ fontSize: 11 }}>💾 Presets</span>
          <button type="button" className="btn shock-preset-new-btn" onClick={openSaveSheet}>
            + บันทึกใหม่
          </button>
        </div>
        {presets.length === 0 ? (
          <p className="shock-preset-empty">ยังไม่มี preset — ตั้งค่าแล้วกด "+ บันทึกใหม่"</p>
        ) : (
          <div className="shock-preset-scroll">
            {presets.map((p) => (
              <div key={p.id} className="shock-preset-card" onClick={() => openEditSheet(p)}>
                <button
                  type="button"
                  className="shock-preset-delete"
                  onClick={(e) => { e.stopPropagation(); handleDeletePreset(p.id); }}
                  aria-label="ลบ preset"
                >✕</button>
                <div className="shock-preset-name">{p.name}</div>
                <div className="shock-preset-meta">
                  {formatNumber(p.rider_weight + p.passenger_weight)} กก.
                  · {p.mode === "street" ? "ทั่วไป" : "หนัก"}
                </div>
                <div className="shock-preset-vals">
                  Pre {formatNumber(p.preload)} mm &nbsp;·&nbsp; C {p.comp} &nbsp;·&nbsp; R {p.reb}
                </div>
                {p.note && <div className="shock-preset-note">"{p.note}"</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card shock-panel">
        <div className="shock-input-grid">
          <div className="form-group">
            <label htmlFor="rider-weight" className="shock-label">น้ำหนักผู้ขับขี่ (กก.)</label>
            <div className="shock-input-shell">
              <input
                id="rider-weight"
                inputMode="decimal"
                value={riderInput}
                onChange={(e) => setRiderInput(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="เช่น 75"
              />
              <span>กก.</span>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="passenger-weight" className="shock-label">น้ำหนักคนซ้อน (กก.)</label>
            <div className="shock-input-shell">
              <input
                id="passenger-weight"
                inputMode="decimal"
                value={passengerInput}
                onChange={(e) => setPassengerInput(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
              />
              <span>กก.</span>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="shock-label">โหมดการใช้งาน</label>
          <div className="shock-mode-toggle" role="tablist" aria-label="โหมดการใช้งาน">
            <button
              type="button"
              className={modeInput === "street" ? "is-active" : ""}
              onClick={() => setModeInput("street")}
            >
              <IconRoad size={20} />
              ใช้งานทั่วไป
            </button>
            <button
              type="button"
              className={modeInput === "heavy" ? "is-active" : ""}
              onClick={() => setModeInput("heavy")}
            >
              <IconTruck size={20} />
              บรรทุก/หนัก
            </button>
          </div>
        </div>

        <button
          type="button"
          className="btn shock-calc-btn"
          onClick={() => {
            const next = {
              rider: Number(riderInput || 0),
              passenger: Number(passengerInput || 0),
              mode: modeInput,
            };
            setApplied(next);
            updateShockSetting(TEMP_BIKE_ID, { rider_weight: next.rider, passenger_weight: next.passenger, mode: next.mode }).catch(() => {});
          }}
        >
          <IconCalculator size={20} />
          คำนวณค่าแนะนำ
        </button>
      </section>

      <section className="card shock-panel shock-results-panel">
        <div className="shock-results-head">
          <div>
            <p className="shock-results-kicker">
              <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 6 }}><IconWaves size={14} /></span>
              ผลการตั้งค่าแนะนำ
            </p>
            <h3>จากน้ำหนักรวมของคุณ</h3>
          </div>
          <div className="shock-results-side">
            <button
              type="button"
              className="shock-info-btn"
              onClick={() => setShowInfo(true)}
              aria-label="อธิบายความหมายของ preload compression และ rebound"
            >
              i
            </button>
            <div className="shock-total-pill">
              <span>น้ำหนักรวม</span>
              <strong>{formatNumber(totalWeight)}</strong>
              <small>กก.</small>
            </div>
          </div>
        </div>

        {recommended ? (
          <>
            <div className="shock-result-list">
              <div className="shock-result-row">
                <div className="shock-result-name">
                  <span className="shock-result-icon"><IconSpring size={20} /></span>
                  Preload
                </div>
                <div className="shock-result-main">
                  <span>แนะนำ</span>
                  <strong>{formatNumber(recommended.preload)} mm</strong>
                </div>
                <div className="shock-result-range">
                  <span>ช่วงแนะนำ</span>
                  <b>{recommended.preloadRange}</b>
                </div>
              </div>
              <div className="shock-result-row">
                <div className="shock-result-name">
                  <span className="shock-result-icon"><IconCompression size={20} /></span>
                  Compression
                </div>
                <div className="shock-result-main">
                  <span>แนะนำ</span>
                  <strong>{recommended.comp}</strong>
                  <small>(Clicks)</small>
                </div>
                <div className="shock-result-range">
                  <span>ช่วงแนะนำ</span>
                  <b>{recommended.compRange}</b>
                </div>
              </div>
              <div className="shock-result-row">
                <div className="shock-result-name">
                  <span className="shock-result-icon"><IconRebound size={20} /></span>
                  Rebound
                </div>
                <div className="shock-result-main">
                  <span>แนะนำ</span>
                  <strong>{recommended.reb}</strong>
                  <small>(Clicks)</small>
                </div>
                <div className="shock-result-range">
                  <span>ช่วงแนะนำ</span>
                  <b>{recommended.rebRange}</b>
                </div>
              </div>
            </div>

            <p className="shock-footnote">
              💡 เริ่มจากค่ากลางของช่วงแนะนำ แล้วปรับทีละน้อยตามสภาพถนนและความรู้สึกขณะขับขี่
            </p>
          </>
        ) : (
          <div className="shock-warning">
            <strong>{unsupportedHigh ? "น้ำหนักรวมเกินช่วง chart นี้" : "ยังไม่มีข้อมูลเพียงพอ"}</strong>
            <p>
              {unsupportedHigh
                ? "chart นี้รองรับ spring soft ช่วง 50 - 150 กก. ถ้าเกินกว่านี้ควรพิจารณาสปริงหรือเซ็ตอัปที่แข็งขึ้น"
                : "กรอกน้ำหนักผู้ขับขี่และคนซ้อนก่อนคำนวณ"}
            </p>
          </div>
        )}
      </section>

      <section className="card shock-panel">
        <div className="shock-table-head">
          <div>
            <p className="shock-results-kicker">
              <span style={{ display: "inline-flex", verticalAlign: "middle", marginRight: 6, color: "rgba(255,140,146,0.85)" }}>
                <IconBarChart size={14} />
              </span>
              ตารางช่วงน้ำหนักและค่าแนะนำ
            </p>
            <h3>อ้างอิงจาก chart รุ่นนี้</h3>
          </div>
        </div>
        <div className="shock-table-wrap">
          <table className="shock-table">
            <thead>
              <tr>
                <th>ช่วงน้ำหนักรวม<br/>(กก.)</th>
                <th>Preload<br/>(mm)</th>
                <th>ใช้งานทั่วไป (Street Use)<br/>Comp / Reb (Clicks)</th>
                <th>บรรทุก/หนัก (Heavy Duty)<br/>Comp / Reb (Clicks)</th>
              </tr>
            </thead>
            <tbody>
              {SHOCK_BANDS.map((band) => (
                <tr key={band.label} className={activeBand?.label === band.label ? "is-active" : ""}>
                  <td>{band.label}</td>
                  <td>{formatNumber(band.preloadMin)}{band.preloadMin !== band.preloadMax ? ` - ${formatNumber(band.preloadMax)}` : ""}</td>
                  <td>{band.streetCompMin} - {band.streetCompMax}</td>
                  <td>{band.heavyCompMin} - {band.heavyCompMax}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="shock-disclaimer">
          📋 ค่าข้างต้นเป็นค่าเริ่มต้นจากโรงงาน แนะนำให้ปรับตามสภาพถนน สไตล์การขับขี่ และความรู้สึกจริงหลังทดลองขี่
        </p>
      </section>

      {/* ── Edit preset sheet ── */}
      {editPreset && editForm && (
        <div className="modal-overlay" onClick={() => { setEditPreset(null); setEditForm(null); }}>
          <div className="modal modal-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="shock-results-kicker">แก้ไข Preset</p>
                <h3 className="shock-info-title" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {editPreset.name}
                </h3>
              </div>
              <button type="button" className="btn btn-ghost btn-sm modal-close"
                onClick={() => { setEditPreset(null); setEditForm(null); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="shock-label">ชื่อ preset *</label>
                <input type="text" value={editForm.name}
                  onChange={(e) => setEditForm((f) => f && ({ ...f, name: e.target.value }))}
                  placeholder="เช่น ขับคนเดียว ถนนเมือง" autoFocus />
              </div>

              <div className="shock-save-weight-row">
                <div className="form-group">
                  <label className="shock-label">น้ำหนักผู้ขับ (กก.)</label>
                  <input type="number" inputMode="decimal" value={editForm.rider_weight}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, rider_weight: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="shock-label">น้ำหนักคนซ้อน (กก.)</label>
                  <input type="number" inputMode="decimal" value={editForm.passenger_weight}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, passenger_weight: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="shock-label">โหมด</label>
                <div className="shock-save-mode-row">
                  {(["street", "heavy"] as RideMode[]).map((m) => (
                    <button key={m} type="button"
                      className={`shock-save-mode-btn${editForm.mode === m ? " is-active" : ""}`}
                      onClick={() => setEditForm((f) => f && ({ ...f, mode: m }))}>
                      {m === "street" ? "ใช้งานทั่วไป" : "บรรทุก/หนัก"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="shock-save-vals-row">
                <div className="form-group">
                  <label className="shock-label">Preload (mm)</label>
                  <input type="number" inputMode="decimal" value={editForm.preload}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, preload: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="shock-label">Comp (clicks)</label>
                  <input type="number" inputMode="numeric" value={editForm.comp}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, comp: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="shock-label">Reb (clicks)</label>
                  <input type="number" inputMode="numeric" value={editForm.reb}
                    onChange={(e) => setEditForm((f) => f && ({ ...f, reb: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="shock-label">บันทึกประสบการณ์</label>
                <textarea value={editForm.note}
                  onChange={(e) => setEditForm((f) => f && ({ ...f, note: e.target.value }))}
                  placeholder="เช่น นุ่มดี เหมาะถนนเมือง ไม่ตึงเกิน"
                  rows={3} style={{ resize: "vertical" }} />
              </div>
            </div>
            <div className="modal-actions shock-edit-preset-actions">
              <button type="button" className="btn btn-danger btn-sm"
                onClick={async () => {
                  await handleDeletePreset(editPreset.id);
                  setEditPreset(null); setEditForm(null);
                }}>
                ลบ
              </button>
              <button type="button" className="btn btn-secondary"
                onClick={() => { loadPreset(editPreset); setEditPreset(null); setEditForm(null); }}>
                โหลดค่านี้
              </button>
              <button type="button" className="btn shock-calc-btn"
                style={{ flex: 1, marginTop: 0, minHeight: 44 }}
                onClick={handleUpdate} disabled={saving || !editForm.name.trim()}>
                {saving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Save preset sheet ── */}
      {showSaveSheet && (
        <div className="modal-overlay" onClick={() => setShowSaveSheet(false)}>
          <div className="modal modal-form" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="shock-results-kicker">บันทึก Preset</p>
                <h3 className="shock-info-title">ค่าที่ตั้งจริง</h3>
              </div>
              <button type="button" className="btn btn-ghost btn-sm modal-close" onClick={() => setShowSaveSheet(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="shock-label">ชื่อ preset *</label>
                <input
                  type="text"
                  value={saveForm.name}
                  onChange={(e) => setSaveForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="เช่น ขับคนเดียว ถนนเมือง"
                  autoFocus
                />
              </div>

              <div className="shock-save-weight-row">
                <div className="form-group">
                  <label className="shock-label">น้ำหนักผู้ขับ (กก.)</label>
                  <input type="number" inputMode="decimal" value={saveForm.rider_weight}
                    onChange={(e) => setSaveForm((f) => ({ ...f, rider_weight: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="shock-label">น้ำหนักคนซ้อน (กก.)</label>
                  <input type="number" inputMode="decimal" value={saveForm.passenger_weight}
                    onChange={(e) => setSaveForm((f) => ({ ...f, passenger_weight: e.target.value }))} />
                </div>
              </div>

              <div className="form-group">
                <label className="shock-label">โหมด</label>
                <div className="shock-save-mode-row">
                  {(["street", "heavy"] as RideMode[]).map((m) => (
                    <button key={m} type="button"
                      className={`shock-save-mode-btn${saveForm.mode === m ? " is-active" : ""}`}
                      onClick={() => setSaveForm((f) => ({ ...f, mode: m }))}>
                      {m === "street" ? "ใช้งานทั่วไป" : "บรรทุก/หนัก"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="shock-save-vals-row">
                <div className="form-group">
                  <label className="shock-label">Preload (mm)</label>
                  <input type="number" inputMode="decimal" value={saveForm.preload}
                    onChange={(e) => setSaveForm((f) => ({ ...f, preload: e.target.value }))}
                    placeholder="เช่น 9" />
                </div>
                <div className="form-group">
                  <label className="shock-label">Comp (clicks)</label>
                  <input type="number" inputMode="numeric" value={saveForm.comp}
                    onChange={(e) => setSaveForm((f) => ({ ...f, comp: e.target.value }))}
                    placeholder="เช่น 9" />
                </div>
                <div className="form-group">
                  <label className="shock-label">Reb (clicks)</label>
                  <input type="number" inputMode="numeric" value={saveForm.reb}
                    onChange={(e) => setSaveForm((f) => ({ ...f, reb: e.target.value }))}
                    placeholder="เช่น 9" />
                </div>
              </div>

              <div className="form-group">
                <label className="shock-label">บันทึกประสบการณ์ (ไม่บังคับ)</label>
                <textarea
                  value={saveForm.note}
                  onChange={(e) => setSaveForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="เช่น นุ่มดี เหมาะถนนเมือง ไม่ตึงเกิน"
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowSaveSheet(false)}>ยกเลิก</button>
              <button type="button" className="btn shock-calc-btn" style={{ flex: 1, marginTop: 0, minHeight: 44 }}
                onClick={handleSave} disabled={saving || !saveForm.name.trim()}>
                {saving ? "กำลังบันทึก…" : "💾  บันทึก Preset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInfo && (
        <div className="modal-overlay" onClick={() => setShowInfo(false)} style={{ alignItems: "center" }}>
          <div className="modal shock-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="shock-results-kicker">How To Read</p>
                <h3 className="shock-info-title">อ่านค่าโช้คยังไง</h3>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowInfo(false)}>ปิด</button>
            </div>
            <div className="modal-body shock-info-body">
              <div className="shock-info-card">
                <h4><span className="shock-info-icon"><IconSpring size={18} /></span> Preload</h4>
                <p>คือค่ากดสปริงตั้งต้น ยิ่งมากรถจะยุบตัวยากขึ้น เหมาะเมื่อมีน้ำหนักบรรทุกหรือคนซ้อนมากขึ้น</p>
              </div>
              <div className="shock-info-card">
                <h4><span className="shock-info-icon"><IconCompression size={18} /></span> Compression</h4>
                <p>คือความหนืดตอนโช้คยุบ ถ้าต่ำเกินไปจะนุ่มยวบ ถ้าสูงเกินไปจะกระด้างและรับแรงกระแทกแข็งขึ้น</p>
              </div>
              <div className="shock-info-card">
                <h4><span className="shock-info-icon"><IconRebound size={18} /></span> Rebound</h4>
                <p>คือความหนืดตอนโช้คคืนตัว ถ้าน้อยไปจะเด้งเร็ว ถ้ามากไปจะคืนช้าและรู้สึกอั้นเมื่อเจอลูกระนาดต่อเนื่อง</p>
              </div>
              <div className="shock-info-tip">
                เริ่มจากค่ากลางที่แนะนำก่อน แล้วขยับทีละ 1 click หรือเล็กน้อย เพื่อหาความรู้สึกที่เหมาะกับน้ำหนักและสภาพถนนจริง
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
