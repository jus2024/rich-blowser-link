import styles from "./MobileChatOverlay.module.css";

interface MobileChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileChatOverlay({
  isOpen,
  onClose,
  children,
}: MobileChatOverlayProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className={styles.backdrop}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={styles.panel}
        role="dialog"
        aria-label="AI チャット"
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="閉じる"
        >
          ✕
        </button>
        <div className={styles.content}>{children}</div>
      </div>
    </>
  );
}
