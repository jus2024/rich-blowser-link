"use client";

import { useCallback, useRef, useState } from "react";

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

/**
 * 左端にドラッグハンドルを持つリサイズ可能なパネル。
 * 左方向にドラッグすると幅が広がる。
 */
export default function ResizablePanel({
  children,
  defaultWidth = 420,
  minWidth = 300,
  maxWidth = 800,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDragging.current) return;
        // 左にドラッグ = 幅が広がる
        const delta = startX.current - moveEvent.clientX;
        const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
        setWidth(newWidth);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [width, minWidth, maxWidth],
  );

  return (
    <div style={{ width: `${width}px`, position: "relative", display: "flex" }}>
      {/* ドラッグハンドル */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: "5px",
          cursor: "col-resize",
          backgroundColor: "transparent",
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor = "#d1d5db";
        }}
        onMouseLeave={(e) => {
          if (!isDragging.current) {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
          }
        }}
        title="ドラッグして幅を変更"
      />
      {/* コンテンツ */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
