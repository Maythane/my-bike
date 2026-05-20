import { useState, useEffect, useRef, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUpdateEmail,
  fetchUpdatePassword,
  fetchUpdateUsername,
  fetchRequestPhone,
  fetchConfirmPhone,
  fetchMe,
} from "../../api/auth";

type Tab = "email" | "password" | "username" | "phone";

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
  const [tab, setTab] = useState<Tab>("email");

  const [newEmail, setNewEmail]       = useState("");
  const [currentPw, setCurrentPw]     = useState("");
  const [newPw, setNewPw]             = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [phone, setPhone]             = useState("");
  const [otpCode, setOtpCode]         = useState("");
  const [otpSent, setOtpSent]         = useState(false);
  const [countdown, setCountdown]     = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  function scheduleClose(delay: number) {
    closeTimer.current = setTimeout(onClose, delay);
  }

  function reset() {
    setError(null); setSuccess(null); setLoading(false);
    setNewEmail(""); setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setNewUsername(""); setPhone(""); setOtpCode("");
    setOtpSent(false); setCountdown(0);
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      await fetchUpdateEmail(newEmail);
      setSuccess("อัปเดต email แล้ว");
      qc.invalidateQueries({ queryKey: ["me"] });
      scheduleClose(1200);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null); setSuccess(null);
    if (newPw !== confirmPw) { setError("Password ใหม่ไม่ตรงกัน"); return; }
    setLoading(true);
    try {
      await fetchUpdatePassword(currentPw, newPw);
      setSuccess("เปลี่ยน password แล้ว");
      scheduleClose(1200);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  }

  async function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      await fetchUpdateUsername(newUsername);
      setSuccess("ตั้ง username แล้ว");
      qc.invalidateQueries({ queryKey: ["me"] });
      scheduleClose(1200);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  }

  async function handleSendOtp() {
    if (loading) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      await fetchRequestPhone(phone);
      setOtpSent(true); setCountdown(300);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "ส่ง OTP ไม่สำเร็จ");
    } finally { setLoading(false); }
  }

  async function handlePhoneConfirm(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null); setSuccess(null); setLoading(true);
    try {
      await fetchConfirmPhone(phone, otpCode);
      setSuccess("ยืนยันเบอร์โทรแล้ว ✓");
      qc.invalidateQueries({ queryKey: ["me"] });
      scheduleClose(1500);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  }

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">👤 Manage Account</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="auth-tabs">
          {(["email", "password", "username", "phone"] as Tab[]).map((t) => (
            <div
              key={t}
              className={`auth-tab${tab === t ? " active" : ""}`}
              onClick={() => { setTab(t); reset(); }}
            >
              {t === "email" ? "Email" : t === "password" ? "Password"
                : t === "username" ? "Username" : "เบอร์โทร"}
            </div>
          ))}
        </div>

        {tab === "email" && (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <label>
              New Email
              <input type="email" value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com" required />
            </label>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">✓ {success}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "กำลังอัปเดต…" : "Update Email"}
            </button>
          </form>
        )}

        {tab === "password" && (
          <form onSubmit={handlePasswordSubmit} className="auth-form">
            <label>
              Current Password
              <div className="pw-wrap">
                <input type={showCurrent ? "text" : "password"} value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)} required />
                <button type="button" className="pw-toggle" tabIndex={-1}
                  onClick={() => setShowCurrent((v) => !v)}>{showCurrent ? "🙈" : "👁"}</button>
              </div>
            </label>
            <label>
              New Password
              <div className="pw-wrap">
                <input type={showNew ? "text" : "password"} value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร" required />
                <button type="button" className="pw-toggle" tabIndex={-1}
                  onClick={() => setShowNew((v) => !v)}>{showNew ? "🙈" : "👁"}</button>
              </div>
            </label>
            <label>
              Confirm New Password
              <div className="pw-wrap">
                <input type={showConfirm ? "text" : "password"} value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)} required />
                <button type="button" className="pw-toggle" tabIndex={-1}
                  onClick={() => setShowConfirm((v) => !v)}>{showConfirm ? "🙈" : "👁"}</button>
              </div>
            </label>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">✓ {success}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "กำลังเปลี่ยน…" : "Change Password"}
            </button>
          </form>
        )}

        {tab === "username" && (
          <form onSubmit={handleUsernameSubmit} className="auth-form">
            {user?.username && (
              <p style={{ fontSize: 13, color: "var(--slate)", margin: "0 0 8px" }}>
                ปัจจุบัน: <strong style={{ color: "var(--ink)" }}>@{user.username}</strong>
              </p>
            )}
            <label>
              Username ใหม่
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="เช่น rider_mark"
                pattern="[a-zA-Z0-9_]+"
                minLength={3}
                maxLength={30}
                required
              />
            </label>
            <p style={{ fontSize: 11, color: "var(--slate)", margin: "-8px 0 8px" }}>
              ใช้ได้เฉพาะ a–z, 0–9, _ (3–30 ตัว)
            </p>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">✓ {success}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "กำลังบันทึก…" : "Set Username"}
            </button>
          </form>
        )}

        {tab === "phone" && (
          <div className="auth-form">
            {user?.phone_verified && (
              <p style={{ fontSize: 13, color: "var(--slate)", margin: "0 0 8px" }}>
                ปัจจุบัน: <strong style={{ color: "var(--green)" }}>✓ {user.phone}</strong>
              </p>
            )}
            {!otpSent ? (
              <>
                <label>
                  เบอร์โทร
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812345678"
                    required
                  />
                </label>
                {error && <p className="auth-error">{error}</p>}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading || !phone.trim()}
                  onClick={handleSendOtp}
                >
                  {loading ? "กำลังส่ง…" : "ส่ง OTP"}
                </button>
              </>
            ) : (
              <form onSubmit={handlePhoneConfirm} className="auth-form">
                <p style={{ fontSize: 13, color: "var(--slate)", margin: "0 0 8px" }}>
                  ส่ง OTP ไปที่ <strong style={{ color: "var(--ink)" }}>{phone}</strong>
                </p>
                <label>
                  รหัส OTP (6 หลัก)
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    autoFocus
                    required
                  />
                </label>
                <div style={{ fontSize: 12, color: "var(--slate)", marginTop: -8, marginBottom: 8 }}>
                  {countdown > 0 ? `OTP หมดอายุใน ${mm}:${ss}` : "OTP หมดอายุแล้ว"}
                  {countdown === 0 && (
                    <button type="button" onClick={handleSendOtp} disabled={loading}
                      style={{ marginLeft: 8, color: "var(--purple)", background: "none",
                               border: "none", cursor: "pointer", fontSize: 12 }}>
                      ส่งใหม่
                    </button>
                  )}
                </div>
                {error && <p className="auth-error">{error}</p>}
                {success && <p className="auth-success">✓ {success}</p>}
                <button type="submit"
                  disabled={loading || otpCode.length < 6 || countdown === 0}
                  className="btn btn-primary">
                  {loading ? "กำลังยืนยัน…" : "ยืนยัน"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
