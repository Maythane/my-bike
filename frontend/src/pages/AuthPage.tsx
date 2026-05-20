import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { sendOtp } from "../api/auth";
import Blobs from "../components/ui/Blobs";

type Tab = "login" | "register";

function isPhoneIdentifier(value: string): boolean {
  return /^\+?[0-9]{8,15}$/.test(value.trim());
}

export default function AuthPage() {
  const { isAuthenticated, login, loginWithOtp, register } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // OTP state (phone login only)
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const isPhone = tab === "login" && isPhoneIdentifier(identifier);

  function resetOtp() {
    setOtpSent(false);
    setOtp("");
    setCountdown(0);
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    setError(null);
    resetOtp();
  }

  async function handleSendOtp() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await sendOtp(identifier.trim());
      setOtpSent(true);
      setCountdown(300);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "ส่ง OTP ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    if (tab === "register" && password !== confirm) {
      setError("Password ไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      if (tab === "login" && isPhone && otpSent) {
        await loginWithOtp(identifier.trim(), otp.trim());
      } else if (tab === "login") {
        await login(identifier.trim(), password);
      } else {
        await register(identifier.trim(), password);
      }
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="auth-page">
      <Blobs />
      <div className="auth-card">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🏍️</div>
          <h1>Moto Tracker</h1>
          <h2>ติดตามการบำรุงรักษารถมอเตอร์ไซค์</h2>
        </div>

        <div className="auth-tabs">
          <div
            className={`auth-tab${tab === "login" ? " active" : ""}`}
            onClick={() => handleTabChange("login")}
          >
            เข้าสู่ระบบ
          </div>
          <div
            className={`auth-tab${tab === "register" ? " active" : ""}`}
            onClick={() => handleTabChange("register")}
          >
            สมัครสมาชิก
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            {tab === "register" ? "Email" : "Email / Username / เบอร์โทร"}
            <input
              type="text"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); resetOtp(); setError(null); }}
              placeholder={tab === "register" ? "you@example.com" : "Email, username หรือเบอร์โทร"}
              required
              autoFocus
              autoComplete="username"
            />
          </label>

          {/* Phone OTP flow */}
          {isPhone && !otpSent && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={handleSendOtp}
              style={{ marginTop: "0.25rem" }}
            >
              {loading ? "กำลังส่ง…" : "ส่ง OTP"}
            </button>
          )}

          {isPhone && otpSent && (
            <>
              <label>
                รหัส OTP (6 หลัก)
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                  autoFocus
                />
              </label>
              <div style={{ fontSize: 12, color: "var(--slate)", marginTop: -8 }}>
                {countdown > 0
                  ? `OTP หมดอายุใน ${mm}:${ss}`
                  : "OTP หมดอายุแล้ว"}
                {countdown === 0 && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    style={{ marginLeft: 8, color: "var(--purple)", background: "none",
                             border: "none", cursor: "pointer", fontSize: 12 }}
                  >
                    ส่งใหม่
                  </button>
                )}
              </div>
            </>
          )}

          {/* Password flow (non-phone) */}
          {!isPhone && (
            <label>
              Password
              <div className="pw-wrap">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1} aria-label={showPassword ? "ซ่อน password" : "แสดง password"}>
                  {showPassword ? "🙈" : "👁"}
                </button>
              </div>
            </label>
          )}

          {tab === "register" && (
            <label>
              Confirm Password
              <div className="pw-wrap">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="pw-toggle" onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1} aria-label={showConfirm ? "ซ่อน password" : "แสดง password"}>
                  {showConfirm ? "🙈" : "👁"}
                </button>
              </div>
            </label>
          )}

          {error && <p className="auth-error">{error}</p>}

          {/* Submit button: hidden when phone but OTP not sent yet */}
          {!(isPhone && !otpSent) && (
            <button
              type="submit"
              disabled={loading || (isPhone && otpSent && (otp.length < 6 || countdown === 0))}
              className="btn btn-primary"
              style={{ marginTop: "0.5rem" }}
            >
              {loading
                ? "กำลังดำเนินการ…"
                : tab === "login"
                  ? isPhone ? "ยืนยัน OTP" : "เข้าสู่ระบบ"
                  : "สมัครสมาชิก"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
