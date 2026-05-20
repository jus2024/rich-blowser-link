"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ResizableSidebar.module.css";

interface ResizableSidebarProps {
  /** サイドバーの内容 */
  children: React.ReactNode;
  /** ハンドルの位置: left = 右端にハンドル（左サイドバー用）, right = 左端にハンドル（右サイドバー用） */
  side: "left" | "right";
  /** デフォルト幅 (px) */
  defaultWidth?: number;
  /** 最小幅 (px) */
  minWidth?: number;
  /** 最大幅 (px) */
  maxWidth?: number;
  /** この幅以下になったら自動的に閉じる (px) */
  collapseThreshold?: number;
  /** 閉じた状態かどうか（外部から制御） */
  collapsed?: boolean;
  /** 開閉状態が変わったときのコールバック */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** サイドバーのクラス名 */
  className?: string;
}

/**
 * ドラッグでリサイズ・開閉できるサイドバーコンポーネント。
 *
 * - ボーダー上にドラッグハンドルを配置し、ドラッグで幅を変更できる
 * - 幅が collapseThreshold 以下になると自動的に閉じる
 * - 閉じた状態でハンドルをクリックすると開く
 * - side="left": 右端にハンドル（左サイドバー用）
 * - side="right": 左端にハンドル（右サイドバー用）
 */
export function ResizableSidebar({
  children,
  side,
  defaultWidth = 240,
  minWidth = 160,
  maxWidth = 480,
  collapseThreshold = 80,
  collapsed: externalCollapsed,
  onCollapsedChange,
  className,
}: ResizableSidebarProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const handleRef = useRef<HTMLDivElement>(null);
  const lastOpenWidth = useRef(defaultWidth);

  // 外部制御と内部状態を統合
  const collapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

  const setCollapsed = useCallback((value: boolean) => {
    setInternalCollapsed(value);
    onCollapsedChange?.(value);
  }, [onCollapsedChange]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      // 閉じた状態でクリック → 開く
      if (collapsed) {
        setCollapsed(false);
        setWidth(lastOpenWidth.current);
        return;
      }

      isDragging.current = false;
      startX.current = e.clientX;
      startWidth.current = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = Math.abs(moveEvent.clientX - startX.current);
        // 4px 以上動いたらドラッグ開始
        if (!isDragging.current && delta > 4) {
          isDragging.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
          if (handleRef.current) {
            handleRef.current.style.backgroundColor = "rgba(59,130,246,0.15)";
          }
        }

        if (!isDragging.current) return;

        const diff = side === "left"
          ? moveEvent.clientX - startX.current
          : startX.current - moveEvent.clientX;

        const newWidth = Math.min(maxWidth, Math.max(0, startWidth.current + diff));
        setWidth(newWidth);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        if (handleRef.current) {
          handleRef.current.style.backgroundColor = "";
        }

        const moved = Math.abs(upEvent.clientX - startX.current);

        if (!isDragging.current || moved <= 4) {
          // クリック扱い → 開閉トグル
          if (collapsed) {
            setWidth(lastOpenWidth.current);
            setCollapsed(false);
          } else {
            setCollapsed(true);
          }
          isDragging.current = false;
          return;
        }

        isDragging.current = false;

        // ドラッグ終了: 閾値以下なら閉じる
        setWidth((currentWidth) => {
          if (currentWidth <= collapseThreshold) {
            setCollapsed(true);
            return lastOpenWidth.current;
          }
          lastOpenWidth.current = currentWidth;
          return currentWidth;
        });
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [collapsed, width, side, maxWidth, collapseThreshold, setCollapsed],
  );

  // 外部から collapsed が変わったとき幅を復元
  useEffect(() => {
    if (externalCollapsed === false) {
      setWidth(lastOpenWidth.current);
    }
  }, [externalCollapsed]);

  const currentWidth = collapsed ? 0 : width;

  return (
    <div
      className={[
        styles.container,
        side === "left" ? styles.left : styles.right,
        collapsed ? styles.collapsed : "",
        className ?? "",
      ].filter(Boolean).join(" ")}
      style={{ width: collapsed ? 0 : `${currentWidth}px` }}
    >
      {/* コンテンツ */}
      {!collapsed && (
        <div className={styles.content}>
          {children}
        </div>
      )}

      {/* ドラッグハンドル（縦線） */}
      <div
        ref={handleRef}
        className={[styles.handle, side === "left" ? styles.handleRight : styles.handleLeft].join(" ")}
        onMouseDown={handleMouseDown}
        title={collapsed ? "クリックまたはドラッグして開く" : "ドラッグしてリサイズ、端まで引くと閉じる"}
        role="separator"
        aria-orientation="vertical"
        aria-label={collapsed ? "サイドバーを開く" : "サイドバーをリサイズ"}
      >
        {/* 中央のグリップアイコン */}
        <div className={styles.grip}>
          {collapsed
            ? (side === "left" ? "›" : "‹")
            : (side === "left" ? "‹" : "›")
          }
        </div>
      </div>
    </div>
  );
}

export default ResizableSidebar;
