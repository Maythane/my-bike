const WarningIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

interface Props {
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "ยืนยัน",
  onConfirm,
  onCancel,
  danger = true,
}: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel} style={{ alignItems: "center" }}>
      <div className="modal modal-plain confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-dialog-body">
          {danger && (
            <div className="confirm-dialog-icon">
              <WarningIcon />
            </div>
          )}
          <div className="confirm-dialog-text">
            {title && <div className="confirm-dialog-title">{title}</div>}
            <p className="confirm-dialog-message">{message}</p>
          </div>
        </div>
        <div className="confirm-dialog-footer">
          <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
          <button
            className={danger ? "btn btn-danger" : "btn btn-primary"}
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
