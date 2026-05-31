import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUpdateEmail,
  fetchUpdatePassword,
  fetchUpdateUsername,
  fetchUpdateDisplayName,
  fetchUploadAvatar,
  fetchDeleteAvatar,
  fetchRequestPhone,
  fetchConfirmPhone,
  fetchMe,
} from "../../api/auth";
import EyeIcon from "./EyeIcon";

type Section = "email" | "password" | "username" | "phone";

const UserCircleIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
  const [open, setOpen] = useState<Section | null>(null);

  // Profile edit state
  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName]       = useState("");
  const [avatarPreview, setAvatarPreview]   = useState<string | null>(null);
  const [avatarFile, setAvatarFile]         = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar]     = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError]     = useState<string | null>(null);

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

  function openProfileEdit() {
    setDisplayName(user?.display_name ?? "");
    setAvatarPreview(null);
    setAvatarFile(null);
    setRemoveAvatar(false);
    setProfileError(null);
    setEditingProfile(true);
  }

  function handleAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setProfileError("ไฟล์ใหญ่เกิน 2MB"); return; }
    setAvatarFile(file);
    setRemoveAvatar(false);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleProfileSave() {
    if (profileLoading) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      if (removeAvatar) await fetchDeleteAvatar();
      else if (avatarFile) await fetchUploadAvatar(avatarFile);
      if (displayName.trim() !== (user?.display_name ?? ""))
        await fetchUpdateDisplayName(displayName.trim());
      qc.invalidateQueries({ queryKey: ["me"] });
      setEditingProfile(false);
    } catch (err: any) {
      setProfileError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally { setProfileLoading(false); }
  }

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
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
  }

  function toggleSection(s: Section) {
    if (open === s) { setOpen(null); reset(); }
    else { setOpen(s); reset(); }
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
  const initial = (user?.display_name?.[0] ?? user?.username?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const currentAvatar = avatarPreview ?? (removeAvatar ? null : user?.avatar_url) ?? null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box acct-modal">

        {editingProfile ? (
          <div className="acct-profile-edit">
            {/* Header */}
            <div className="acct-profile-edit-header">
              <span className="acct-profile-edit-title">แก้ไขโปรไฟล์</span>
              <button className="modal-close" onClick={() => setEditingProfile(false)}>✕</button>
            </div>

            {/* Body: left=avatar, right=fields+actions */}
            <div className="acct-profile-edit-body">

              {/* Left column */}
              <div className="acct-avatar-edit-wrap">
                <div className="acct-avatar-edit" onClick={() => !currentAvatar && avatarInputRef.current?.click()}>
                  {currentAvatar
                    ? <img src={currentAvatar} alt="avatar" className="acct-avatar-img" />
                    : <span className="acct-avatar-placeholder"><UserCircleIcon /></span>
                  }
                  <button type="button" className="acct-avatar-badge"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentAvatar) {
                        setAvatarPreview(null); setAvatarFile(null); setRemoveAvatar(true);
                        if (avatarInputRef.current) avatarInputRef.current.value = "";
                      } else { avatarInputRef.current?.click(); }
                    }}>
                    {currentAvatar ? <XIcon /> : <PlusIcon />}
                  </button>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*"
                  style={{ display: "none" }} onChange={handleAvatarFileChange} />
                <p className="acct-avatar-label">Upload Image</p>
                <p className="acct-avatar-hint">Max file size: 2MB</p>
                <button type="button" className="btn btn-ghost btn-sm acct-avatar-add-btn"
                  onClick={() => avatarInputRef.current?.click()}>
                  Add Image
                </button>
              </div>

              {/* Right column — fields top, actions bottom */}
              <div className="acct-profile-fields">
                <div className="acct-profile-fields-top">
                  <div className="auth-field">
                    <label htmlFor="display-name">
                      ชื่อที่แสดง <span style={{ color: "var(--purple)" }}>*</span>
                    </label>
                    <input
                      id="display-name"
                      className="auth-input"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={user?.username ?? user?.email ?? "เช่น Mark Rider"}
                      maxLength={50}
                      autoFocus
                    />
                  </div>
                  {profileError && <p className="auth-error">{profileError}</p>}
                </div>

                <div className="acct-profile-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingProfile(false)}>ยกเลิก</button>
                  <button className="btn btn-primary btn-sm" onClick={handleProfileSave} disabled={profileLoading}>
                    {profileLoading ? "กำลังบันทึก…" : "บันทึก"}
                  </button>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Profile header */
          <div className="acct-header">
            <button className="acct-avatar-lg" onClick={openProfileEdit} title="แก้ไขโปรไฟล์">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="avatar" className="acct-avatar-img" />
                : initial
              }
              <span className="acct-avatar-edit-hint">แก้ไข</span>
            </button>
            <div className="acct-header-info">
              <div className="acct-display-name">
                {user?.display_name || (user?.username ? `@${user.username}` : (user?.email ?? "…"))}
              </div>
              {(user?.display_name || user?.username) && (
                <div className="acct-sub-text">{user.email}</div>
              )}
            </div>
            <button className="modal-close acct-close-btn" onClick={onClose}>✕</button>
          </div>
        )}

        {/* Accordion sections */}
        <div className="acct-sections">

          {/* Email */}
          <div className="acct-section">
            <button className="acct-section-row" onClick={() => toggleSection("email")}>
              <span className="acct-section-icon" style={{ background: "rgba(99,102,241,0.14)", color: "#818cf8" }}>✉</span>
              <span className="acct-section-label">Email</span>
              <span className="acct-section-value">{user?.email ?? "—"}</span>
              <span className={`acct-chevron${open === "email" ? " is-open" : ""}`}>›</span>
            </button>
            {open === "email" && (
              <div className="acct-section-body">
                <form onSubmit={handleEmailSubmit} className="auth-form">
                  <label>Email ใหม่
                    <input type="email" value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="new@example.com" autoFocus required />
                  </label>
                  {error && <p className="auth-error">{error}</p>}
                  {success && <p className="auth-success">✓ {success}</p>}
                  <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
                    {loading ? "กำลังอัปเดต…" : "Update Email"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Password */}
          <div className="acct-section">
            <button className="acct-section-row" onClick={() => toggleSection("password")}>
              <span className="acct-section-icon" style={{ background: "rgba(245,158,11,0.14)", color: "#f59e0b" }}>🔑</span>
              <span className="acct-section-label">Password</span>
              <span className="acct-section-value">••••••••</span>
              <span className={`acct-chevron${open === "password" ? " is-open" : ""}`}>›</span>
            </button>
            {open === "password" && (
              <div className="acct-section-body">
                <form onSubmit={handlePasswordSubmit} className="auth-form">
                  <label>Password ปัจจุบัน
                    <div className="pw-wrap">
                      <input type={showCurrent ? "text" : "password"} value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)} autoFocus required />
                      <button type="button" className="pw-toggle" tabIndex={-1}
                        onClick={() => setShowCurrent((v) => !v)}><EyeIcon visible={showCurrent} /></button>
                    </div>
                  </label>
                  <label>Password ใหม่
                    <div className="pw-wrap">
                      <input type={showNew ? "text" : "password"} value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        minLength={8} placeholder="อย่างน้อย 8 ตัวอักษร" required />
                      <button type="button" className="pw-toggle" tabIndex={-1}
                        onClick={() => setShowNew((v) => !v)}><EyeIcon visible={showNew} /></button>
                    </div>
                  </label>
                  <label>ยืนยัน Password ใหม่
                    <div className="pw-wrap">
                      <input type={showConfirm ? "text" : "password"} value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)} required />
                      <button type="button" className="pw-toggle" tabIndex={-1}
                        onClick={() => setShowConfirm((v) => !v)}><EyeIcon visible={showConfirm} /></button>
                    </div>
                  </label>
                  {error && <p className="auth-error">{error}</p>}
                  {success && <p className="auth-success">✓ {success}</p>}
                  <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
                    {loading ? "กำลังเปลี่ยน…" : "Change Password"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Username */}
          <div className="acct-section">
            <button className="acct-section-row" onClick={() => toggleSection("username")}>
              <span className="acct-section-icon acct-icon-at" style={{ background: "rgba(167,139,250,0.14)", color: "var(--purple)" }}>@</span>
              <span className="acct-section-label">Username</span>
              <span className="acct-section-value">
                {user?.username ? `@${user.username}` : <em style={{ color: "var(--steel)", fontStyle: "normal" }}>ยังไม่ได้ตั้ง</em>}
              </span>
              <span className={`acct-chevron${open === "username" ? " is-open" : ""}`}>›</span>
            </button>
            {open === "username" && (
              <div className="acct-section-body">
                <form onSubmit={handleUsernameSubmit} className="auth-form">
                  <label>Username ใหม่
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="เช่น rider_mark"
                      pattern="[a-zA-Z0-9_]+"
                      minLength={3}
                      maxLength={30}
                      autoFocus
                      required
                    />
                  </label>
                  <p style={{ fontSize: 11, color: "var(--slate)", margin: "-4px 0 2px" }}>
                    a–z, 0–9, _ · 3–30 ตัวอักษร
                  </p>
                  {error && <p className="auth-error">{error}</p>}
                  {success && <p className="auth-success">✓ {success}</p>}
                  <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
                    {loading ? "กำลังบันทึก…" : "Set Username"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="acct-section">
            <button className="acct-section-row" onClick={() => toggleSection("phone")}>
              <span className="acct-section-icon" style={{ background: "rgba(34,197,94,0.12)", color: "var(--green)", fontSize: 13 }}>📱</span>
              <span className="acct-section-label">เบอร์โทร</span>
              <span className="acct-section-value" style={user?.phone_verified ? { color: "var(--green)" } : undefined}>
                {user?.phone_verified
                  ? `✓ ${user.phone}`
                  : <em style={{ color: "var(--steel)", fontStyle: "normal" }}>ยังไม่ได้เพิ่ม</em>
                }
              </span>
              <span className={`acct-chevron${open === "phone" ? " is-open" : ""}`}>›</span>
            </button>
            {open === "phone" && (
              <div className="acct-section-body">
                {!otpSent ? (
                  <div className="auth-form">
                    <label>เบอร์โทร
                      <input type="tel" value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0812345678" autoFocus />
                    </label>
                    {error && <p className="auth-error">{error}</p>}
                    <button type="button" className="btn btn-primary btn-sm"
                      disabled={loading || !phone.trim()} onClick={handleSendOtp}>
                      {loading ? "กำลังส่ง…" : "ส่ง OTP"}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handlePhoneConfirm} className="auth-form">
                    <p style={{ fontSize: 13, color: "var(--slate)", margin: "0 0 2px" }}>
                      ส่ง OTP ไปที่ <strong style={{ color: "var(--ink)" }}>{phone}</strong>
                    </p>
                    <label>รหัส OTP (6 หลัก)
                      <input type="text" inputMode="numeric" maxLength={6} value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456" autoFocus required />
                    </label>
                    <div style={{ fontSize: 12, color: "var(--slate)", marginTop: -4, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      {countdown > 0 ? `OTP หมดอายุใน ${mm}:${ss}` : "OTP หมดอายุแล้ว"}
                      {countdown === 0 && (
                        <button type="button" onClick={handleSendOtp} disabled={loading}
                          style={{ color: "var(--purple)", background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: 0 }}>
                          ส่งใหม่
                        </button>
                      )}
                    </div>
                    {error && <p className="auth-error">{error}</p>}
                    {success && <p className="auth-success">✓ {success}</p>}
                    <button type="submit"
                      disabled={loading || otpCode.length < 6 || countdown === 0}
                      className="btn btn-primary btn-sm">
                      {loading ? "กำลังยืนยัน…" : "ยืนยัน"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
