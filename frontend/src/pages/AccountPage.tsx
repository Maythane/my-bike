import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMe,
  fetchUpdateDisplayName,
  fetchUpdateEmail,
  fetchUpdatePassword,
  fetchUpdateUsername,
  fetchUploadAvatar,
  fetchRequestPhone,
  fetchConfirmPhone,
} from "../api/auth";
import { useAuth } from "../hooks/useAuth";
import ImageCropper from "../components/ui/ImageCropper";
import EyeIcon from "../components/ui/EyeIcon";

type Section = "displayName" | "username" | "email" | "password" | "phone";

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const EditIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

export default function AccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { logout } = useAuth();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });

  // Avatar state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const cropSrcRef = useRef<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // Section accordion
  const [open, setOpen] = useState<Section | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Field values (populated when section opens)
  const [displayName, setDisplayName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => () => {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  function reset() {
    setError(null); setSuccess(null); setLoading(false);
    setDisplayName(""); setNewUsername(""); setNewEmail("");
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    setPhone(""); setOtpCode(""); setOtpSent(false); setCountdown(0);
  }

  function toggleSection(s: Section, onOpen?: () => void) {
    if (open === s) { setOpen(null); reset(); return; }
    reset();
    setOpen(s);
    onOpen?.();
  }

  // Avatar handlers
  function handleAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    const src = URL.createObjectURL(file);
    cropSrcRef.current = src;
    setCropSrc(src);
    e.target.value = "";
  }

  async function handleAvatarCropConfirm(blob: Blob) {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setCropSrc(null);
    setAvatarLoading(true);
    try {
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      await fetchUploadAvatar(file);
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      setError(safeError(err));
    } finally {
      setAvatarLoading(false);
    }
  }

  function handleAvatarCropCancel() {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setCropSrc(null);
  }

  function safeError(err: unknown): string {
    const detail = (err as any)?.response?.data?.detail;
    return typeof detail === "string" ? detail : "เกิดข้อผิดพลาด";
  }

  async function handleDisplayNameSave(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      await fetchUpdateDisplayName(displayName.trim());
      qc.invalidateQueries({ queryKey: ["me"] });
      setSuccess("อัปเดตแล้ว");
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => { setOpen(null); reset(); }, 900);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  async function handleUsernameSave(e: FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      await fetchUpdateUsername(newUsername.trim());
      qc.invalidateQueries({ queryKey: ["me"] });
      setSuccess("อัปเดตแล้ว");
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => { setOpen(null); reset(); }, 900);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  async function handleEmailSave(e: FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      await fetchUpdateEmail(newEmail.trim());
      qc.invalidateQueries({ queryKey: ["me"] });
      setSuccess("อัปเดตแล้ว");
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => { setOpen(null); reset(); }, 900);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) { setError("Password ใหม่ไม่ตรงกัน"); return; }
    if (loading) return;
    setLoading(true); setError(null);
    try {
      await fetchUpdatePassword(currentPw, newPw);
      setSuccess("เปลี่ยน password แล้ว");
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => { setOpen(null); reset(); }, 900);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  async function handlePhoneSend() {
    if (!phone.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      await fetchRequestPhone(phone.trim());
      setOtpSent(true);
      setOtpCode("");
      setCountdown(300);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  async function handlePhoneConfirm(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true); setError(null);
    try {
      await fetchConfirmPhone(phone.trim(), otpCode);
      qc.invalidateQueries({ queryKey: ["me"] });
      setSuccess("ยืนยันเบอร์โทรแล้ว");
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => { setOpen(null); reset(); }, 900);
    } catch (err) { setError(safeError(err)); }
    finally { setLoading(false); }
  }

  const headingName = user?.display_name || (user?.username ? `@${user.username}` : (user?.email ?? "…"));
  const initial = (user?.display_name?.[0] ?? user?.username?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { document.documentElement.dataset.navDir = "back"; navigate(-1); }}
          aria-label="กลับ"
          style={{ padding: "6px 8px" }}
        >
          <BackIcon />
        </Button>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>บัญชีของฉัน</h1>
      </div>

      {/* Hero */}
      <div className="acct-hero">
        <button
          className="acct-hero-avatar-btn"
          onClick={() => !avatarLoading && avatarInputRef.current?.click()}
          aria-label="เปลี่ยนรูปโปรไฟล์"
          disabled={avatarLoading}
        >
          {user?.avatar_url
            ? <img src={user.avatar_url} alt={headingName} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
            : <div className="acct-hero-avatar-inner">{initial}</div>
          }
          {avatarLoading
            ? <div className="acct-hero-avatar-loading" />
            : <span className="acct-hero-avatar-badge"><EditIcon /></span>
          }
        </button>
        <div>
          <div className="acct-hero-name">{headingName}</div>
          {user?.username && <div className="acct-hero-username">@{user.username}</div>}
        </div>
      </div>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleAvatarFileChange}
      />

      {/* Section: บัญชี */}
      <div className="acct-group-label">บัญชี</div>
      <div className="acct-page-section">

        {/* Display name */}
        <div
          className={`acct-page-row${open === "displayName" ? " is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("displayName", () => setDisplayName(user?.display_name ?? ""))}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("displayName", () => setDisplayName(user?.display_name ?? ""))}
        >
          <span className="acct-page-row-label">ชื่อที่แสดง</span>
          <span className="acct-page-row-value">{user?.display_name || <em>ยังไม่ได้ตั้ง</em>}</span>
          <span className="acct-row-chevron"><ChevronIcon /></span>
        </div>
        {open === "displayName" && (
          <div className="acct-page-row-body">
            <form onSubmit={handleDisplayNameSave} className="auth-form">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder="ชื่อที่ต้องการแสดง"
                autoFocus
                required
              />
              {error && <p className="text-xs text-destructive mt-1" role="alert">{error}</p>}
              {success && <p className="text-xs text-[oklch(0.73_0.20_148)] mt-1" role="status">{success}</p>}
              <Button variant="default" size="sm" disabled={loading}>
                {loading ? "กำลังบันทึก…" : "บันทึก"}
              </Button>
            </form>
          </div>
        )}

        {/* Username */}
        <div
          className={`acct-page-row${open === "username" ? " is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("username")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("username")}
        >
          <span className="acct-page-row-label">Username</span>
          <span className="acct-page-row-value">
            {user?.username ? `@${user.username}` : <em>ยังไม่ได้ตั้ง</em>}
          </span>
          <span className="acct-row-chevron"><ChevronIcon /></span>
        </div>
        {open === "username" && (
          <div className="acct-page-row-body">
            <form onSubmit={handleUsernameSave} className="auth-form">
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                pattern="[a-zA-Z0-9_]+"
                minLength={3}
                maxLength={30}
                placeholder="rider_mark"
                autoFocus
                required
              />
              <p style={{ fontSize: 11, color: "var(--slate)", margin: 0 }}>a–z, 0–9, _ · 3–30 ตัวอักษร</p>
              {error && <p className="text-xs text-destructive mt-1" role="alert">{error}</p>}
              {success && <p className="text-xs text-[oklch(0.73_0.20_148)] mt-1" role="status">{success}</p>}
              <Button variant="default" size="sm" disabled={loading}>
                {loading ? "กำลังบันทึก…" : "บันทึก"}
              </Button>
            </form>
          </div>
        )}

        {/* Email */}
        <div
          className={`acct-page-row${open === "email" ? " is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("email")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("email")}
          style={{ borderBottom: "none" }}
        >
          <span className="acct-page-row-label">Email</span>
          <span className="acct-page-row-value">{user?.email || <em>ยังไม่ได้เพิ่ม</em>}</span>
          {!user?.email
            ? <span className="acct-page-add-badge">+ เพิ่ม</span>
            : <span className="acct-row-chevron"><ChevronIcon /></span>
          }
        </div>
        {open === "email" && (
          <div className="acct-page-row-body" style={{ borderTop: "1px solid var(--hairline)" }}>
            <form onSubmit={handleEmailSave} className="auth-form">
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={user?.email ?? "email@example.com"}
                autoFocus
                required
              />
              {error && <p className="text-xs text-destructive mt-1" role="alert">{error}</p>}
              {success && <p className="text-xs text-[oklch(0.73_0.20_148)] mt-1" role="status">{success}</p>}
              <Button variant="default" size="sm" disabled={loading}>
                {loading ? "กำลังบันทึก…" : user?.email ? "อัปเดต Email" : "เพิ่ม Email"}
              </Button>
            </form>
          </div>
        )}

      </div>

      {/* Section: ความปลอดภัย */}
      <div className="acct-group-label">ความปลอดภัย</div>
      <div className="acct-page-section">

        {/* Password */}
        <div
          className={`acct-page-row${open === "password" ? " is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("password")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("password")}
        >
          <span className="acct-page-row-label">Password</span>
          <span className="acct-page-row-value">••••••••</span>
          <span className="acct-row-chevron"><ChevronIcon /></span>
        </div>
        {open === "password" && (
          <div className="acct-page-row-body">
            <form onSubmit={handlePasswordSave} className="auth-form">
              <div className="pw-wrap">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="Password ปัจจุบัน"
                  autoFocus
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowCurrent((v) => !v)} aria-label="แสดง/ซ่อน">
                  <EyeIcon visible={showCurrent} />
                </button>
              </div>
              <div className="pw-wrap">
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Password ใหม่ (อย่างน้อย 8 ตัว)"
                  minLength={8}
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowNew((v) => !v)} aria-label="แสดง/ซ่อน">
                  <EyeIcon visible={showNew} />
                </button>
              </div>
              <div className="pw-wrap">
                <Input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="ยืนยัน Password ใหม่"
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowConfirm((v) => !v)} aria-label="แสดง/ซ่อน">
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>
              {error && <p className="text-xs text-destructive mt-1" role="alert">{error}</p>}
              {success && <p className="text-xs text-[oklch(0.73_0.20_148)] mt-1" role="status">{success}</p>}
              <Button variant="default" size="sm" disabled={loading}>
                {loading ? "กำลังเปลี่ยน…" : "เปลี่ยน Password"}
              </Button>
            </form>
          </div>
        )}

        {/* Phone */}
        <div
          className={`acct-page-row${open === "phone" ? " is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("phone")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("phone")}
          style={{ borderBottom: "none" }}
        >
          <span className="acct-page-row-label">เบอร์โทร</span>
          <span className="acct-page-row-value" style={user?.phone_verified ? { color: "var(--green)" } : undefined}>
            {user?.phone_verified ? user.phone : <em>ยังไม่ได้เพิ่ม</em>}
          </span>
          {!user?.phone_verified
            ? <span className="acct-page-add-badge">+ เพิ่ม</span>
            : <span className="acct-row-chevron"><ChevronIcon /></span>
          }
        </div>
        {open === "phone" && (
          <div className="acct-page-row-body" style={{ borderTop: "1px solid var(--hairline)" }}>
            {!otpSent ? (
              <div className="auth-form">
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812345678"
                  autoFocus
                />
                {error && <p className="text-xs text-destructive mt-1" role="alert">{error}</p>}
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handlePhoneSend}
                  disabled={loading || !phone.trim()}
                >
                  {loading ? "กำลังส่ง…" : "ส่ง OTP"}
                </Button>
              </div>
            ) : (
              <form onSubmit={handlePhoneConfirm} className="auth-form">
                <p style={{ fontSize: 12, color: "var(--slate)", margin: 0 }}>
                  ส่ง OTP ไปที่ <strong style={{ color: "var(--ink)" }}>{phone}</strong>
                </p>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoFocus
                  required
                />
                <div className="auth-otp-hint">
                  {countdown > 0 ? `OTP หมดอายุใน ${mm}:${ss}` : "OTP หมดอายุแล้ว"}
                  {countdown === 0 && (
                    <button type="button" className="auth-resend-btn" onClick={handlePhoneSend} disabled={loading}>
                      ส่งใหม่
                    </button>
                  )}
                </div>
                {error && <p className="text-xs text-destructive mt-1" role="alert">{error}</p>}
                {success && <p className="text-xs text-[oklch(0.73_0.20_148)] mt-1" role="status">{success}</p>}
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={loading || otpCode.length < 6 || countdown === 0}
                >
                  {loading ? "กำลังยืนยัน…" : "ยืนยัน"}
                </Button>
              </form>
            )}
          </div>
        )}

      </div>

      {/* Logout */}
      <Button
        variant="destructive"
        style={{ width: "100%", marginTop: 8, marginBottom: 32 }}
        onClick={() => logout()}
      >
        ออกจากระบบ
      </Button>

      {/* ImageCropper dialog */}
      {cropSrc && (
        <ImageCropper
          src={cropSrc}
          aspectRatio={1}
          exportSize={512}
          quality={0.82}
          onConfirm={handleAvatarCropConfirm}
          onCancel={handleAvatarCropCancel}
        />
      )}
    </div>
  );
}
