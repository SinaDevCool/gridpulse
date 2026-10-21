import { useEffect, useRef, type ReactNode } from "react";
export function ConfigurationPanel({
  open,
  mobile,
  onClose,
  children,
}: {
  open: boolean;
  mobile: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!mobile || !node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (node.open) node.close();
    };
  }, [open, mobile]);
  const content = (
    <>
      <header className="ops-input-header">
        <div>
          <p className="context-label">Configuration</p>
          <h2 id="ops-input-title">Inputs & evidence</h2>
        </div>
        <button type="button" aria-label="Close inputs" onClick={onClose}>
          ×
        </button>
      </header>
      {children}
    </>
  );
  return mobile ? (
    <dialog
      ref={dialog}
      id="operations-inputs"
      className="ops-input-drawer"
      aria-labelledby="ops-input-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {content}
    </dialog>
  ) : (
    <aside
      id="operations-inputs"
      className="ops-input-panel"
      aria-labelledby="ops-input-title"
      hidden={!open}
    >
      {content}
    </aside>
  );
}
