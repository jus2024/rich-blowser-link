"use client";

import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Bookmark } from "@/src/types";

export interface DndProviderProps {
  /** 子コンポーネント */
  children: React.ReactNode;
  /** ドラッグ開始時のハンドラ */
  onDragStart: (event: DragStartEvent) => void;
  /** ドラッグオーバー時のハンドラ */
  onDragOver: (event: DragOverEvent) => void;
  /** ドロップ時のハンドラ */
  onDragEnd: (event: DragEndEvent) => void;
  /** ドラッグキャンセル時のハンドラ */
  onDragCancel: () => void;
  /** 現在ドラッグ中の Bookmark ID（null = ドラッグ中でない） */
  activeId?: string | null;
  /** DragOverlay に表示する Bookmark データ */
  activeBookmark?: Bookmark | null;
}

/**
 * ドラッグ&ドロップのコンテキストを提供するラッパーコンポーネント。
 *
 * @dnd-kit/core の DndContext でアプリケーションをラップし、
 * DragOverlay でドラッグ中のプレビューを表示する。
 */
export function DndProvider({
  children,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  activeId = null,
  activeBookmark = null,
}: DndProviderProps) {
  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {children}
      <DragOverlay>
        {activeId && activeBookmark ? (
          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "var(--color-surface, #ffffff)",
              border: "1px solid var(--color-border, #e0e0e0)",
              borderRadius: "0.5rem",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
              fontSize: "0.875rem",
              maxWidth: "300px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              opacity: 0.9,
            }}
          >
            {activeBookmark.title || activeBookmark.url}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
