import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchUpdateEmail, fetchUpdatePassword } from "../../api/auth";

type Tab = "email" | "password";

export default function AccountModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("email");

  const [newEmail, setNewEmail] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setError(null);
    setSuccess(null);
    setNewEmail("");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await fetchUpdateEmail(newEmail);
      setSuccess("อัปเดต email แล้ว");
      qc.invalidateQueries({ queryKey: ["me"] });
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPw !== confirmPw) {
      setError("Password ใหม่ไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      await fetchUpdatePassword(currentPw, newPw);
      setSuccess("เปลี่ยน password แล้ว");
      setTimeout(onClose, 1200);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">👤 Manage Account</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="auth-tabs">
          <div
            className={`auth-tab${tab === "email" ? " active" : ""}`}
            onClick={() => { setTab("email"); reset(); }}
          >
            Email
          </div>
          <div
            className={`auth-tab${tab === "password" ? " active" : ""}`}
            onClick={() => { setTab("password"); reset(); }}
          >
            Password
          </div>
        </div>

        {tab === "email" && (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <label>
              New Email
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
              />
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
              <input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={8}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                required
              />
            </label>
            <label>
              Confirm New Password
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">✓ {success}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "กำลังเปลี่ยน…" : "Change Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
