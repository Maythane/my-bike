import { useState, useEffect, type FormEvent, type SVGProps } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const UserIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
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
  const [username, setUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
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
    setUsername("");
    setRegEmail("");
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
        await register(username.trim(), password, regEmail.trim() || undefined);
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

  /* Shared card classes */
  const cardBase =
    "w-full bg-[var(--glass-bg)] backdrop-blur-[16px] border border-[var(--glass-border)] rounded-[var(--r-md)] p-8 flex flex-col gap-6 relative z-10 shadow-[var(--shadow-card)]";

  return (
    <div className="min-h-dvh flex items-center justify-center p-5">
      <Blobs />

      {tab === "login" ? (
        <div className={`${cardBase} max-w-[360px]`}>
          {/* Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <img src="/favicon.svg" className="w-12 h-12 flex-shrink-0" alt="My Bike" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-semibold tracking-[0.06em] text-[var(--purple)]">Moto Tracker</span>
              <h1 className="text-[1.625rem] font-bold text-[var(--ink)] m-0">ยินดีต้อนรับกลับมา</h1>
            </div>
            <p className="text-sm text-[var(--slate)] m-0 max-w-[28ch]">ติดตามการบำรุงรักษาและอัตราบริโภคเชื้อเพลิงรถของคุณ</p>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-5">
            {/* Google button */}
            <button
              type="button"
              disabled
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--glass-border)] rounded-[var(--r)] text-[0.9375rem] font-medium text-[var(--ink)] cursor-pointer transition-[background,border-color] duration-150 hover:not-disabled:bg-[var(--elevated)] hover:not-disabled:border-[var(--hairline-strong)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GoogleIcon className="w-[18px] h-[18px] flex-shrink-0" />
              Sign in with Google
            </button>

            {/* Separator */}
            <div className="flex items-center gap-3">
              <span className="flex-1 h-px bg-[var(--hairline)]" />
              <span className="text-[0.8125rem] text-[var(--slate)] whitespace-nowrap">or sign in with email</span>
              <span className="flex-1 h-px bg-[var(--hairline)]" />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="login-identifier" className="text-xs font-semibold text-muted-foreground">Email / Username / Telephone</label>
                <div className="flex items-center h-10 w-full rounded-[var(--radius-sm)] border border-border bg-input px-3.5 gap-2.5 transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary focus-within:bg-white/[.10]">
                  <MailIcon width={16} height={16} className="flex-shrink-0 text-[var(--slate)]" />
                  <input
                    id="login-identifier"
                    type="text"
                    style={{ padding: 0 }}
                    className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
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
                <Button
                  type="button"
                  variant="default"
                  disabled={loading}
                  onClick={handleSendOtp}
                >
                  {loading ? "กำลังส่ง…" : "ส่ง OTP"}
                </Button>
              )}

              {isPhone && otpSent && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="otp-input" className="text-xs font-semibold text-muted-foreground">รหัส OTP (6 หลัก)</label>
                  <Input
                    id="otp-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    required
                    autoFocus
                  />
                  <div className="flex items-center gap-2 text-xs text-[var(--slate)] -mt-1">
                    {countdown > 0 ? `OTP หมดอายุใน ${mm}:${ss}` : "OTP หมดอายุแล้ว"}
                    {countdown === 0 && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={loading}
                        className="text-[var(--purple)] text-xs bg-none border-none cursor-pointer p-0 hover:underline"
                      >
                        ส่งใหม่
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!isPhone && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="text-xs font-semibold text-muted-foreground">Password</label>
                    <a href="#" className="text-sm text-primary hover:text-primary/80 underline-offset-4 hover:underline">ลืมรหัสผ่าน?</a>
                  </div>
                  <div className="flex items-center h-10 w-full rounded-[var(--radius-sm)] border border-border bg-input px-3.5 gap-2.5 transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary focus-within:bg-white/[.10]">
                    <LockIcon width={16} height={16} className="flex-shrink-0 text-[var(--slate)]" />
                    <input
                      id="login-password"
                      style={{ padding: 0 }}
                      className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="flex-shrink-0 flex items-center justify-center w-6 text-[var(--slate)] hover:text-[var(--ink)] transition-colors duration-150"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "ซ่อน password" : "แสดง password"}
                    >
                      {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
                    </button>
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-destructive mt-1">{error}</p>}

              {!(isPhone && !otpSent) && (
                <Button
                  type="submit"
                  variant="default"
                  className="w-full flex items-center justify-center gap-2 mt-1"
                  disabled={loading || (isPhone && otpSent && (otp.length < 6 || countdown === 0))}
                >
                  {loading ? "กำลังดำเนินการ…" : isPhone ? "ยืนยัน OTP" : "เข้าสู่ระบบ"}
                  {!loading && !isPhone && <ArrowRightIcon width={16} height={16} />}
                </Button>
              )}
            </form>

            <p className="text-sm text-[var(--slate)] text-center">
              ยังไม่มีบัญชีใช้งาน?{" "}
              <button
                type="button"
                className="text-sm text-primary hover:text-primary/80 underline-offset-4 hover:underline bg-transparent border-0 cursor-pointer p-0 font-[inherit]"
                onClick={() => handleTabChange("register")}
              >
                สร้างบัญชีใหม่
              </button>
            </p>
          </div>
        </div>
      ) : (
        <div className={`${cardBase} max-w-[400px]`}>
          {/* Header */}
          <div className="flex flex-col items-center gap-2 text-center">
            <img src="/favicon.svg" className="w-12 h-12 flex-shrink-0" alt="Moto Tracker" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-semibold tracking-[0.06em] text-[var(--purple)]">Moto Tracker</span>
              <h1 className="text-[1.625rem] font-bold text-[var(--ink)] m-0">สร้างบัญชีใหม่</h1>
            </div>
            <p className="text-sm text-[var(--slate)] m-0 max-w-[28ch]">สมัครสมาชิกเพื่อเริ่มบันทึกข้อมูลรถของคุณ</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-username" className="text-xs font-semibold text-muted-foreground">Username <span style={{ color: "var(--purple)" }}>*</span></label>
              <div className="flex items-center h-10 w-full rounded-[var(--radius-sm)] border border-border bg-input px-3.5 gap-2.5 transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary focus-within:bg-white/[.10]">
                <UserIcon width={16} height={16} className="flex-shrink-0 text-[var(--slate)]" />
                <input
                  id="reg-username"
                  type="text"
                  style={{ padding: 0 }}
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "")); setError(null); }}
                  placeholder="rider_mark"
                  pattern="[a-zA-Z0-9_]+"
                  minLength={3}
                  maxLength={30}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <p style={{ fontSize: 11, color: "var(--slate)", margin: "2px 0 0" }}>a–z, 0–9, _ · 3–30 ตัวอักษร</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-password" className="text-xs font-semibold text-muted-foreground">Password <span style={{ color: "var(--purple)" }}>*</span></label>
              <div className="flex items-center h-10 w-full rounded-[var(--radius-sm)] border border-border bg-input px-3.5 gap-2.5 transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary focus-within:bg-white/[.10]">
                <LockIcon width={16} height={16} className="flex-shrink-0 text-[var(--slate)]" />
                <input
                  id="reg-password"
                  style={{ padding: 0 }}
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="flex-shrink-0 flex items-center justify-center w-6 text-[var(--slate)] hover:text-[var(--ink)] transition-colors duration-150"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "ซ่อน password" : "แสดง password"}
                >
                  {showPassword ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-confirm" className="text-xs font-semibold text-muted-foreground">ยืนยัน Password <span style={{ color: "var(--purple)" }}>*</span></label>
              <div className="flex items-center h-10 w-full rounded-[var(--radius-sm)] border border-border bg-input px-3.5 gap-2.5 transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary focus-within:bg-white/[.10]">
                <LockIcon width={16} height={16} className="flex-shrink-0 text-[var(--slate)]" />
                <input
                  id="reg-confirm"
                  style={{ padding: 0 }}
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="flex-shrink-0 flex items-center justify-center w-6 text-[var(--slate)] hover:text-[var(--ink)] transition-colors duration-150"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "ซ่อน password" : "แสดง password"}
                >
                  {showConfirm ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-email" className="text-xs font-semibold text-muted-foreground" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                Email
                <span style={{ fontSize: 11, color: "var(--steel)", fontWeight: 400 }}>(ไม่บังคับ)</span>
              </label>
              <div className="flex items-center h-10 w-full rounded-[var(--radius-sm)] border border-dashed border-border bg-input px-3.5 gap-2.5 opacity-80 transition-colors duration-150 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary focus-within:bg-white/[.10]">
                <MailIcon width={16} height={16} className="flex-shrink-0 text-[var(--slate)]" />
                <input
                  id="reg-email"
                  type="email"
                  style={{ padding: 0 }}
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="email@example.com"
                  autoComplete="email"
                />
              </div>
              <p style={{ fontSize: 11, color: "var(--slate)", margin: "2px 0 0" }}>แนะนำ — ใช้กู้รหัสผ่าน, เพิ่มทีหลังได้ใน Account</p>
            </div>

            {error && <p className="text-xs text-destructive mt-1">{error}</p>}

            <Button type="submit" variant="default" className="w-full flex items-center justify-center gap-2 mt-1" disabled={loading}>
              {loading ? "กำลังดำเนินการ…" : "สร้างบัญชี"}
              {!loading && <ArrowRightIcon width={16} height={16} />}
            </Button>
          </form>

          <div className="border-t border-[var(--hairline)] pt-4 -mt-2">
            <p className="text-sm text-[var(--slate)] text-center">
              มีบัญชีแล้ว?{" "}
              <button
                type="button"
                className="text-sm text-primary hover:text-primary/80 underline-offset-4 hover:underline bg-transparent border-0 cursor-pointer p-0 font-[inherit]"
                onClick={() => handleTabChange("login")}
              >
                เข้าสู่ระบบ
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
