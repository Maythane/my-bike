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
import ImageCropper from "./ImageCropper";

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

const XSmallIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const EmailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2.75h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 10.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 60_000 });
  const [open, setOpen] = useState<Section | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [displayName, setDisplayName]       = useState("");
  const [avatarPreview, setAvatarPreview]   = useState<string | null>(null);
  const [avatarFile, setAvatarFile]         = useState<File | null>(null);
  const [cropSrc, setCropSrc]               = useState<string | null>(null);
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
  const avatarPreviewRef = useRef<string | null>(null);
  const cropSrcRef = useRef<string | null>(null);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
  }, []);
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function openProfileEdit() {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    avatarPreviewRef.current = null;
    cropSrcRef.current = null;
    setDisplayName(user?.display_name ?? "");
    setAvatarPreview(null);
    setAvatarFile(null);
    setCropSrc(null);
    setRemoveAvatar(false);
    setProfileError(null);
    setEditingProfile(true);
  }

  function handleAvatarFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProfileError("กรุณาเลือกไฟล์รูปภาพ");
      e.target.value = "";
      return;
    }
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    const nextCropSrc = URL.createObjectURL(file);
    cropSrcRef.current = nextCropSrc;
    setProfileError(null);
    setCropSrc(nextCropSrc);
    e.target.value = "";
  }

  function handleAvatarCropConfirm(blob: Blob) {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    const previewUrl = URL.createObjectURL(blob);
    avatarPreviewRef.current = previewUrl;
    setAvatarPreview(previewUrl);
    setAvatarFile(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    setRemoveAvatar(false);
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setCropSrc(null);
  }

  function handleAvatarCropCancel() {
    if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    cropSrcRef.current = null;
    setCropSrc(null);
  }

  async function handleProfileSave() {
    if (profileLoading) return;
    if (!displayName.trim()) {
      setProfileError("กรุณาใส่ชื่อที่แสดง");
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      if (removeAvatar) await fetchDeleteAvatar();
      else if (avatarFile) await fetchUploadAvatar(avatarFile);
      if (displayName.trim() !== (user?.display_name ?? ""))
        await fetchUpdateDisplayName(displayName.trim());
      qc.invalidateQueries({ queryKey: ["me"] });
      setEditingProfile(false);
      setAvatarFile(null);
      setRemoveAvatar(false);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setProfileError(typeof detail === "string" ? detail : "เกิดข้อผิดพลาด");
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
      setSuccess("ยืนยันเบอร์โทรแล้ว");
      qc.invalidateQueries({ queryKey: ["me"] });
      scheduleClose(1500);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  }

  const mm = String(Math.floor(countdown / 60)).padStart(2, "0");
  const ss = String(countdown % 60).padStart(2, "0");
  const headingName = user?.display_name || (user?.username ? `@${user.username}` : (user?.email ?? "…"));
  const initial = (user?.display_name?.[0] ?? user?.username?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();
  const currentAvatar = avatarPreview ?? (removeAvatar ? null : user?.avatar_url) ?? null;

  return (
    <div className="modal-overlay acct-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box acct-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">

        {editingProfile ? (
          <div className="acct-profile-edit">
            <div className="acct-profile-edit-header">
              <h2 id="account-modal-title" className="acct-profile-edit-title">แก้ไขโปรไฟล์</h2>
              <button type="button" className="modal-close" onClick={() => setEditingProfile(false)} aria-label="กลับไปหน้าบัญชี">
                <CloseIcon />
              </button>
            </div>

            <div className="acct-profile-edit-body">
              <div className="acct-avatar-edit-wrap">
                <div
                  className="acct-avatar-edit"
                  role="button"
                  tabIndex={0}
                  aria-label={currentAvatar ? "รูปโปรไฟล์ปัจจุบัน" : "เพิ่มรูปโปรไฟล์"}
                  onClick={() => !currentAvatar && avatarInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (!currentAvatar && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      avatarInputRef.current?.click();
                    }
                  }}
                >
                  {currentAvatar
                    ? <img src={currentAvatar} alt="รูปโปรไฟล์" className="acct-avatar-img" />
                    : <span className="acct-avatar-placeholder"><UserCircleIcon /></span>
                  }
                  <button type="button" className="acct-avatar-badge"
                    aria-label={currentAvatar ? "ลบรูปโปรไฟล์" : "เลือกรูปโปรไฟล์"}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentAvatar) {
                        if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
                        avatarPreviewRef.current = null;
                        setAvatarPreview(null); setAvatarFile(null); setRemoveAvatar(true);
                        if (avatarInputRef.current) avatarInputRef.current.value = "";
                      } else { avatarInputRef.current?.click(); }
                    }}>
                    {currentAvatar ? <XSmallIcon /> : <PlusIcon />}
                  </button>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*"
                  style={{ display: "none" }} onChange={handleAvatarFileChange} />
                <p className="acct-avatar-label">รูปโปรไฟล์</p>
                <p className="acct-avatar-hint">ครอปและบีบอัดก่อนอัปโหลด</p>
                <button type="button" className="btn btn-ghost btn-sm acct-avatar-add-btn"
                  onClick={() => avatarInputRef.current?.click()}>
                  เลือกรูป
                </button>
              </div>

              <div className="acct-profile-fields">
                <div className="acct-profile-fields-top">
                  <div className="auth-field">
                    <label htmlFor="display-name" style={{ display: "flex", alignItems: "center", gap: 4 }}>
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
                      required
                    />
                  </div>
                  {profileError && <p className="auth-error" role="alert">{profileError}</p>}
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
          <div className="acct-header">
            <button className="acct-avatar-lg" onClick={openProfileEdit} title="แก้ไขโปรไฟล์">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="รูปโปรไฟล์" className="acct-avatar-img" />
                : initial
              }
              <span className="acct-avatar-edit-hint">แก้ไข</span>
            </button>
            <div className="acct-header-info">
              <h2 id="account-modal-title" className="acct-display-name">{headingName}</h2>
              {(user?.display_name || user?.username) && (
                <div className="acct-sub-text">{user.email}</div>
              )}
            </div>
            <button type="button" className="modal-close acct-close-btn" onClick={onClose} aria-label="ปิดหน้าต่างบัญชี">
              <CloseIcon />
            </button>
          </div>
        )}

        <div className="acct-sections">

          {/* Email */}
          <div className="acct-section">
            <button type="button" className="acct-section-row" aria-expanded={open === "email"} aria-controls="acct-email-panel" onClick={() => toggleSection("email")}>
              <span className="acct-section-icon acct-icon-email"><EmailIcon /></span>
              <span className="acct-section-label">Email</span>
              <span className="acct-section-value">{user?.email ?? "—"}</span>
              <span className={`acct-chevron${open === "email" ? " is-open" : ""}`}>›</span>
            </button>
            {open === "email" && (
              <div id="acct-email-panel" className="acct-section-body" role="region" aria-label="เปลี่ยน email">
                <form onSubmit={handleEmailSubmit} className="auth-form">
                  <div className="auth-field">
                    <label htmlFor="acct-new-email">Email ใหม่</label>
                    <input
                      id="acct-new-email"
                      className="auth-input"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="new@example.com"
                      autoFocus
                      required
                    />
                  </div>
                  {error && <p className="auth-error" role="alert">{error}</p>}
                  {success && <p className="auth-success" role="status">{success}</p>}
                  <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
                    {loading ? "กำลังอัปเดต…" : "อัปเดต Email"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Password */}
          <div className="acct-section">
            <button type="button" className="acct-section-row" aria-expanded={open === "password"} aria-controls="acct-password-panel" onClick={() => toggleSection("password")}>
              <span className="acct-section-icon acct-icon-lock"><LockIcon /></span>
              <span className="acct-section-label">Password</span>
              <span className="acct-section-value">••••••••</span>
              <span className={`acct-chevron${open === "password" ? " is-open" : ""}`}>›</span>
            </button>
            {open === "password" && (
              <div id="acct-password-panel" className="acct-section-body" role="region" aria-label="เปลี่ยน password">
                <form onSubmit={handlePasswordSubmit} className="auth-form">
                  <div className="auth-field">
                    <label htmlFor="acct-cur-pw">Password ปัจจุบัน</label>
                    <div className="pw-wrap">
                      <input
                        id="acct-cur-pw"
                        className="auth-input"
                        type={showCurrent ? "text" : "password"}
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        autoFocus
                        required
                      />
                      <button type="button" className="pw-toggle" aria-label={showCurrent ? "ซ่อน password ปัจจุบัน" : "แสดง password ปัจจุบัน"}
                        onClick={() => setShowCurrent((v) => !v)}><EyeIcon visible={showCurrent} /></button>
                    </div>
                  </div>
                  <div className="auth-field">
                    <label htmlFor="acct-new-pw">Password ใหม่</label>
                    <div className="pw-wrap">
                      <input
                        id="acct-new-pw"
                        className="auth-input"
                        type={showNew ? "text" : "password"}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        minLength={8}
                        placeholder="อย่างน้อย 8 ตัวอักษร"
                        required
                      />
                      <button type="button" className="pw-toggle" aria-label={showNew ? "ซ่อน password ใหม่" : "แสดง password ใหม่"}
                        onClick={() => setShowNew((v) => !v)}><EyeIcon visible={showNew} /></button>
                    </div>
                  </div>
                  <div className="auth-field">
                    <label htmlFor="acct-confirm-pw">ยืนยัน Password ใหม่</label>
                    <div className="pw-wrap">
                      <input
                        id="acct-confirm-pw"
                        className="auth-input"
                        type={showConfirm ? "text" : "password"}
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        required
                      />
                      <button type="button" className="pw-toggle" aria-label={showConfirm ? "ซ่อน password ยืนยัน" : "แสดง password ยืนยัน"}
                        onClick={() => setShowConfirm((v) => !v)}><EyeIcon visible={showConfirm} /></button>
                    </div>
                  </div>
                  {error && <p className="auth-error" role="alert">{error}</p>}
                  {success && <p className="auth-success" role="status">{success}</p>}
                  <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
                    {loading ? "กำลังเปลี่ยน…" : "เปลี่ยน Password"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Username */}
          <div className="acct-section">
            <button type="button" className="acct-section-row" aria-expanded={open === "username"} aria-controls="acct-username-panel" onClick={() => toggleSection("username")}>
              <span className="acct-section-icon acct-icon-at">@</span>
              <span className="acct-section-label">Username</span>
              <span className="acct-section-value">
                {user?.username ? `@${user.username}` : <em style={{ color: "var(--steel)", fontStyle: "normal" }}>ยังไม่ได้ตั้ง</em>}
              </span>
              <span className={`acct-chevron${open === "username" ? " is-open" : ""}`}>›</span>
            </button>
            {open === "username" && (
              <div id="acct-username-panel" className="acct-section-body" role="region" aria-label="ตั้ง username">
                <form onSubmit={handleUsernameSubmit} className="auth-form">
                  <div className="auth-field">
                    <label htmlFor="acct-new-username">Username ใหม่</label>
                    <input
                      id="acct-new-username"
                      className="auth-input"
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
                  </div>
                  <p style={{ fontSize: 11, color: "var(--slate)", margin: "-8px 0 2px" }}>
                    a–z, 0–9, _ · 3–30 ตัวอักษร
                  </p>
                  {error && <p className="auth-error" role="alert">{error}</p>}
                  {success && <p className="auth-success" role="status">{success}</p>}
                  <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
                    {loading ? "กำลังบันทึก…" : "บันทึก Username"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="acct-section">
            <button type="button" className="acct-section-row" aria-expanded={open === "phone"} aria-controls="acct-phone-panel" onClick={() => toggleSection("phone")}>
              <span className="acct-section-icon acct-icon-phone"><PhoneIcon /></span>
              <span className="acct-section-label">เบอร์โทร</span>
              <span className="acct-section-value" style={user?.phone_verified ? { color: "var(--green)" } : undefined}>
                {user?.phone_verified
                  ? user.phone
                  : <em style={{ color: "var(--steel)", fontStyle: "normal" }}>ยังไม่ได้เพิ่ม</em>
                }
              </span>
              <span className={`acct-chevron${open === "phone" ? " is-open" : ""}`}>›</span>
            </button>
            {open === "phone" && (
              <div id="acct-phone-panel" className="acct-section-body" role="region" aria-label="ยืนยันเบอร์โทร">
                {!otpSent ? (
                  <div className="auth-form">
                    <div className="auth-field">
                      <label htmlFor="acct-phone">เบอร์โทร</label>
                      <input
                        id="acct-phone"
                        className="auth-input"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0812345678"
                        autoFocus
                      />
                    </div>
                    {error && <p className="auth-error" role="alert">{error}</p>}
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
                    <div className="auth-field">
                      <label htmlFor="acct-otp">รหัส OTP (6 หลัก)</label>
                      <input
                        id="acct-otp"
                        className="auth-input"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="auth-otp-hint">
                      {countdown > 0 ? `OTP หมดอายุใน ${mm}:${ss}` : "OTP หมดอายุแล้ว"}
                      {countdown === 0 && (
                        <button type="button" className="auth-resend-btn" onClick={handleSendOtp} disabled={loading}>
                          ส่งใหม่
                        </button>
                      )}
                    </div>
                    {error && <p className="auth-error" role="alert">{error}</p>}
                    {success && <p className="auth-success" role="status">{success}</p>}
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
