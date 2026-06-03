import { useState, useEffect, type FormEvent, type SVGProps } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { sendOtp } from "../api/auth";
import Blobs from "../components/ui/Blobs";

type Tab = "login" | "register";

function isPhoneIdentifier(value: string): boolean {
  return /^\+?[0-9]{8,15}$/.test(value.trim());
}

const GoogleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
    <path d="M3.06364 7.50914C4.70909 4.24092 8.09084 2 12 2C14.6954 2 16.959 2.99095 18.6909 4.60455L15.8227 7.47274C14.7864 6.48185 13.4681 5.97727 12 5.97727C9.39542 5.97727 7.19084 7.73637 6.40455 10.1C6.2045 10.7 6.09086 11.3409 6.09086 12C6.09086 12.6591 6.2045 13.3 6.40455 13.9C7.19084 16.2636 9.39542 18.0227 12 18.0227C13.3454 18.0227 14.4909 17.6682 15.3864 17.0682C16.4454 16.3591 17.15 15.3 17.3818 14.05H12V10.1818H21.4181C21.5364 10.8363 21.6 11.5182 21.6 12.2273C21.6 15.2727 20.5091 17.8363 18.6181 19.5773C16.9636 21.1046 14.7 22 12 22C8.09084 22 4.70909 19.7591 3.06364 16.4909C2.38638 15.1409 2 13.6136 2 12C2 10.3864 2.38638 8.85911 3.06364 7.50914Z" />
  </svg>
);

const MailIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
    <line x1="2" x2="22" y1="2" y2="22" />
  </svg>
);

const ArrowRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export default function AuthPage() {
  const { isAuthenticated, login, loginWithOtp, register } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      {tab === "login" ? (
        <div className="auth-card">
          <div className="auth-header">
            <img src="/favicon.svg" className="auth-logo" alt="My Bike" />
            <div className="auth-header-brand">
              <span className="auth-app-name">Moto Tracker</span>
              <h1>ยินดีต้อนรับกลับมา</h1>
            </div>
            <p>ติดตามการบำรุงรักษาและอัตราบริโภคเชื้อเพลิงรถของคุณ</p>
          </div>

          <div className="auth-body">
            <button type="button" className="auth-google-btn" disabled>
              <GoogleIcon className="auth-google-icon" />
              Sign in with Google
            </button>

            <div className="auth-separator">
              <span className="auth-separator-line" />
              <span className="auth-separator-text">or sign in with email</span>
              <span className="auth-separator-line" />
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="login-identifier">Email / Username / Telephone</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><MailIcon width={16} height={16} /></span>
                  <input
                    id="login-identifier"
                    type="text"
                    className="auth-input auth-input--icon-left"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); resetOtp(); setError(null); }}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    autoComplete="username"
                  />
                </div>
              </div>

              {isPhone && !otpSent && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={loading}
                  onClick={handleSendOtp}
                >
                  {loading ? "กำลังส่ง…" : "ส่ง OTP"}
                </button>
              )}

              {isPhone && otpSent && (
                <div className="auth-field">
                  <label htmlFor="otp-input">รหัส OTP (6 หลัก)</label>
                  <input
                    id="otp-input"
                    className="auth-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    required
                    autoFocus
                  />
                  <div className="auth-otp-hint">
                    {countdown > 0 ? `OTP หมดอายุใน ${mm}:${ss}` : "OTP หมดอายุแล้ว"}
                    {countdown === 0 && (
                      <button type="button" onClick={handleSendOtp} disabled={loading} className="auth-resend-btn">
                        ส่งใหม่
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!isPhone && (
                <div className="auth-field">
                  <div className="auth-field-header">
                    <label htmlFor="login-password">Password</label>
                    <a href="#" className="auth-link">ลืมรหัสผ่าน?</a>
                  </div>
                  <div className="auth-input-wrap">
                    <span className="auth-input-icon"><LockIcon width={16} height={16} /></span>
                    <input
                      id="login-password"
                      className="auth-input auth-input--icon-left auth-input--icon-right"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="auth-eye-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "ซ่อน password" : "แสดง password"}
                    >
                      {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="auth-error">{error}</p>}

              {!(isPhone && !otpSent) && (
                <button
                  type="submit"
                  className="btn btn-primary auth-submit-btn"
                  disabled={loading || (isPhone && otpSent && (otp.length < 6 || countdown === 0))}
                >
                  {loading ? "กำลังดำเนินการ…" : isPhone ? "ยืนยัน OTP" : "เข้าสู่ระบบ"}
                  {!loading && !isPhone && <ArrowRightIcon width={16} height={16} />}
                </button>
              )}
            </form>

            <p className="auth-footer-text">
              ยังไม่มีบัญชีใช้งาน?{" "}
              <button type="button" className="auth-link auth-link--btn" onClick={() => handleTabChange("register")}>
                สร้างบัญชีใหม่
              </button>
            </p>
          </div>
        </div>
      ) : (
        <div className="auth-card auth-card--wide">
          <div className="auth-header">
            <img src="/favicon.svg" className="auth-logo" alt="Moto Tracker" />
            <div className="auth-header-brand">
              <span className="auth-app-name">Moto Tracker</span>
              <h1>สร้างบัญชีใหม่</h1>
            </div>
            <p>สมัครสมาชิกเพื่อเริ่มบันทึกข้อมูลรถของคุณ</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="reg-email">Email address</label>
              <input
                id="reg-email"
                className="auth-input"
                type="email"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
                placeholder="you@example.com"
                required
                autoFocus
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <label htmlFor="reg-password">Password</label>
              <div className="auth-input-wrap">
                <input
                  id="reg-password"
                  className="auth-input auth-input--icon-right"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "ซ่อน password" : "แสดง password"}
                >
                  {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-confirm">Confirm Password</label>
              <div className="auth-input-wrap">
                <input
                  id="reg-confirm"
                  className="auth-input auth-input--icon-right"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "ซ่อน password" : "แสดง password"}
                >
                  {showConfirm ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
                </button>
              </div>
            </div>

            <label className="auth-checkbox-row">
              <input
                type="checkbox"
                className="auth-checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <span>
                ฉันยอมรับ{" "}
                <a href="#" className="auth-link">ข้อกำหนด</a>
                {" "}และ{" "}
                <a href="#" className="auth-link">เงื่อนไข</a>
              </span>
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={loading || !agreeTerms}
            >
              {loading ? "กำลังดำเนินการ…" : "สร้างบัญชีใหม่"}
            </button>
          </form>

          <div className="auth-card-footer">
            <p className="auth-footer-text">
              มีบัญชีแล้ว?{" "}
              <button type="button" className="auth-link auth-link--btn" onClick={() => handleTabChange("login")}>
                เข้าสู่ระบบ
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
