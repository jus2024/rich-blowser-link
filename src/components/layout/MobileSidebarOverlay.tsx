import styles from "./MobileSidebarOverlay.module.css";

interface MobileSidebarOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileSidebarOverlay({
  isOpen,
  onClose,
  children,
}: MobileSidebarOverlayProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={styles.panel} role="navigation" aria-label="サイドバー">
        {children}
      </aside>
    </>
  );
}
