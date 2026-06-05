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
      <div
        className="rounded-[var(--r-lg)] border border-[rgba(124,58,237,0.28)] backdrop-blur-[20px]
          bg-[linear-gradient(135deg,rgba(124,58,237,0.22),rgba(79,70,229,0.14))]
          px-4 pt-5 pb-[18px] flex flex-col items-center gap-[10px] mb-5 text-center"
      >
        <button
          className="relative w-16 h-16 rounded-full overflow-visible border-0 p-0 bg-transparent
            cursor-pointer flex-shrink-0 transition-opacity active:opacity-70"
          onClick={() => !avatarLoading && avatarInputRef.current?.click()}
          aria-label="เปลี่ยนรูปโปรไฟล์"
          disabled={avatarLoading}
        >
          {user?.avatar_url
            ? <img src={user.avatar_url} alt={headingName} className="w-16 h-16 rounded-full object-cover" />
            : (
              <div className="w-16 h-16 rounded-full flex items-center justify-center
                bg-[var(--purple)] text-white/90 text-[22px] font-bold">
                {initial}
              </div>
            )
          }
          {avatarLoading
            ? (
              <div className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center">
                <span className="w-[22px] h-[22px] rounded-full border-2 border-white/30 border-t-white animate-spin block" />
              </div>
            )
            : (
              <span
                className="absolute bottom-0 right-0 w-[22px] h-[22px] rounded-full
                  bg-[var(--elevated)] border-2 border-[var(--canvas)]
                  flex items-center justify-center text-[var(--slate)]
                  pointer-events-none transition-colors
                  group-hover:bg-[var(--purple)] group-hover:text-white"
              >
                <EditIcon />
              </span>
            )
          }
        </button>
        <div>
          <div className="text-base font-bold text-[var(--ink)] leading-snug">{headingName}</div>
          {user?.display_name && user?.username && <div className="text-xs text-[var(--purple)] mt-0.5">@{user.username}</div>}
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
      <div className="text-[11px] font-semibold text-[var(--steel)] mb-1.5 ml-1">บัญชี</div>
      <div className="bg-[var(--surface)] backdrop-blur-[12px] border border-[var(--hairline)] rounded-[var(--r-lg)] overflow-hidden mb-5">

        {/* Display name */}
        <div
          className={`flex items-center gap-[10px] px-3.5 py-3 min-h-[44px] border-b border-[var(--hairline)]
            cursor-pointer select-none transition-colors hover:bg-[var(--elevated)] active:bg-[var(--elevated)]
            ${open === "displayName" ? "is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("displayName", () => setDisplayName(user?.display_name ?? ""))}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("displayName", () => setDisplayName(user?.display_name ?? ""))}
        >
          <span className="text-[13px] text-[var(--slate)] min-w-[90px] flex-shrink-0">ชื่อที่แสดง</span>
          <span className="flex-1 text-[13px] text-[var(--ink)] overflow-hidden text-ellipsis whitespace-nowrap [&_em]:text-[var(--steel)] [&_em]:not-italic">
            {user?.display_name || <em>ยังไม่ได้ตั้ง</em>}
          </span>
          <span className={`flex items-center text-[var(--steel)] flex-shrink-0 transition-transform duration-200
            ${open === "displayName" ? "rotate-90 text-[var(--purple)]" : ""}`}>
            <ChevronIcon />
          </span>
        </div>
        {open === "displayName" && (
          <div className="px-3.5 pt-3 pb-3.5 border-b border-[var(--hairline)] flex flex-col gap-[10px] bg-[var(--surface-soft)] animate-[acct-row-body-in_0.18s_ease-out_both]">
            <form onSubmit={handleDisplayNameSave} className="flex flex-col gap-4">
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
          className={`flex items-center gap-[10px] px-3.5 py-3 min-h-[44px] border-b border-[var(--hairline)]
            cursor-pointer select-none transition-colors hover:bg-[var(--elevated)] active:bg-[var(--elevated)]
            ${open === "username" ? "is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("username")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("username")}
        >
          <span className="text-[13px] text-[var(--slate)] min-w-[90px] flex-shrink-0">Username</span>
          <span className="flex-1 text-[13px] text-[var(--ink)] overflow-hidden text-ellipsis whitespace-nowrap [&_em]:text-[var(--steel)] [&_em]:not-italic">
            {user?.username ? `@${user.username}` : <em>ยังไม่ได้ตั้ง</em>}
          </span>
          <span className={`flex items-center text-[var(--steel)] flex-shrink-0 transition-transform duration-200
            ${open === "username" ? "rotate-90 text-[var(--purple)]" : ""}`}>
            <ChevronIcon />
          </span>
        </div>
        {open === "username" && (
          <div className="px-3.5 pt-3 pb-3.5 border-b border-[var(--hairline)] flex flex-col gap-[10px] bg-[var(--surface-soft)] animate-[acct-row-body-in_0.18s_ease-out_both]">
            <form onSubmit={handleUsernameSave} className="flex flex-col gap-4">
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
          className={`flex items-center gap-[10px] px-3.5 py-3 min-h-[44px]
            cursor-pointer select-none transition-colors hover:bg-[var(--elevated)] active:bg-[var(--elevated)]
            ${open === "email" ? "is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("email")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("email")}
        >
          <span className="text-[13px] text-[var(--slate)] min-w-[90px] flex-shrink-0">Email</span>
          <span className="flex-1 text-[13px] text-[var(--ink)] overflow-hidden text-ellipsis whitespace-nowrap [&_em]:text-[var(--steel)] [&_em]:not-italic">
            {user?.email || <em>ยังไม่ได้เพิ่ม</em>}
          </span>
          {!user?.email
            ? <span className="text-[11px] text-[var(--purple)] bg-[var(--purple-bg)] border border-[var(--purple-border)] rounded-[var(--r)] px-2 py-0.5 flex-shrink-0">+ เพิ่ม</span>
            : (
              <span className={`flex items-center text-[var(--steel)] flex-shrink-0 transition-transform duration-200
                ${open === "email" ? "rotate-90 text-[var(--purple)]" : ""}`}>
                <ChevronIcon />
              </span>
            )
          }
        </div>
        {open === "email" && (
          <div className="px-3.5 pt-3 pb-3.5 border-t border-[var(--hairline)] flex flex-col gap-[10px] bg-[var(--surface-soft)] animate-[acct-row-body-in_0.18s_ease-out_both]">
            <form onSubmit={handleEmailSave} className="flex flex-col gap-4">
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
      <div className="text-[11px] font-semibold text-[var(--steel)] mb-1.5 ml-1">ความปลอดภัย</div>
      <div className="bg-[var(--surface)] backdrop-blur-[12px] border border-[var(--hairline)] rounded-[var(--r-lg)] overflow-hidden mb-5">

        {/* Password */}
        <div
          className={`flex items-center gap-[10px] px-3.5 py-3 min-h-[44px] border-b border-[var(--hairline)]
            cursor-pointer select-none transition-colors hover:bg-[var(--elevated)] active:bg-[var(--elevated)]
            ${open === "password" ? "is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("password")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("password")}
        >
          <span className="text-[13px] text-[var(--slate)] min-w-[90px] flex-shrink-0">Password</span>
          <span className="flex-1 text-[13px] text-[var(--ink)] overflow-hidden text-ellipsis whitespace-nowrap">••••••••</span>
          <span className={`flex items-center text-[var(--steel)] flex-shrink-0 transition-transform duration-200
            ${open === "password" ? "rotate-90 text-[var(--purple)]" : ""}`}>
            <ChevronIcon />
          </span>
        </div>
        {open === "password" && (
          <div className="px-3.5 pt-3 pb-3.5 border-b border-[var(--hairline)] flex flex-col gap-[10px] bg-[var(--surface-soft)] animate-[acct-row-body-in_0.18s_ease-out_both]">
            <form onSubmit={handlePasswordSave} className="flex flex-col gap-4">
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
          className={`flex items-center gap-[10px] px-3.5 py-3 min-h-[44px]
            cursor-pointer select-none transition-colors hover:bg-[var(--elevated)] active:bg-[var(--elevated)]
            ${open === "phone" ? "is-open" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => toggleSection("phone")}
          onKeyDown={(e) => e.key === "Enter" && toggleSection("phone")}
        >
          <span className="text-[13px] text-[var(--slate)] min-w-[90px] flex-shrink-0">เบอร์โทร</span>
          <span
            className="flex-1 text-[13px] overflow-hidden text-ellipsis whitespace-nowrap [&_em]:text-[var(--steel)] [&_em]:not-italic"
            style={user?.phone_verified ? { color: "var(--green)" } : { color: "var(--ink)" }}
          >
            {user?.phone_verified ? user.phone : <em>ยังไม่ได้เพิ่ม</em>}
          </span>
          {!user?.phone_verified
            ? <span className="text-[11px] text-[var(--purple)] bg-[var(--purple-bg)] border border-[var(--purple-border)] rounded-[var(--r)] px-2 py-0.5 flex-shrink-0">+ เพิ่ม</span>
            : (
              <span className={`flex items-center text-[var(--steel)] flex-shrink-0 transition-transform duration-200
                ${open === "phone" ? "rotate-90 text-[var(--purple)]" : ""}`}>
                <ChevronIcon />
              </span>
            )
          }
        </div>
        {open === "phone" && (
          <div className="px-3.5 pt-3 pb-3.5 border-t border-[var(--hairline)] flex flex-col gap-[10px] bg-[var(--surface-soft)] animate-[acct-row-body-in_0.18s_ease-out_both]">
            {!otpSent ? (
              <div className="flex flex-col gap-4">
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
              <form onSubmit={handlePhoneConfirm} className="flex flex-col gap-4">
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
                <div className="flex items-center gap-2 text-xs text-[var(--slate)] -mt-1">
                  {countdown > 0 ? `OTP หมดอายุใน ${mm}:${ss}` : "OTP หมดอายุแล้ว"}
                  {countdown === 0 && (
                    <button
                      type="button"
                      className="text-[var(--purple)] text-xs hover:underline bg-transparent border-0 cursor-pointer p-0"
                      onClick={handlePhoneSend}
                      disabled={loading}
                    >
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
        variant="ghost"
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
        style={{ marginTop: 8, marginBottom: 32 }}
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
