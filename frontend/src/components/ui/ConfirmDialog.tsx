interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmDialog({ title, message, confirmLabel = "ยืนยัน", onConfirm, onCancel, danger = true }: Props) {
  return (
    <div
      className="modal-overlay"
      onClick={onCancel}
      style={{ alignItems: "center" }}
    >
      <div
        className="modal modal-plain"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: "24px 24px 20px" }}
      >
        {title && (
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
            {title}
          </div>
        )}
        <p style={{ fontSize: 14, color: "var(--slate)", lineHeight: 1.6, whiteSpace: "pre-line", marginBottom: 20 }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
          <button
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            style={danger ? { background: "var(--red)", color: "#fff", borderColor: "var(--red)" } : {}}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
