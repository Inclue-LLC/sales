import { useEffect, type ReactNode } from "react";

export function Modal(props: { title: ReactNode; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="modal" style={{ maxWidth: props.width ?? 720 }} role="dialog" aria-modal="true">
        <div className="modal-title">
          <h2>{props.title}</h2>
          <button type="button" className="icon-btn" onClick={props.onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}
