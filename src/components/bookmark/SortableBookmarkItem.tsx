"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface SortableBookmarkItemProps {
  /** ソート対象アイテムの一意識別子（Bookmark ID） */
  id: string;
  /**
   * ラップ対象の子要素。
   * dragHandleProps を受け取れる関数形式も受け付ける。
   * 関数の場合はドラッグハンドル用の props が渡され、子コンポーネント側で
   * 専用のハンドル要素に適用することでカード全体のクリックを阻害しない。
   */
  children:
    | React.ReactNode
    | ((dragHandleProps: React.HTMLAttributes<HTMLElement>) => React.ReactNode);
}

/**
 * 個々のブックマークカードをソート可能にするラッパーコンポーネント。
 *
 * `@dnd-kit/sortable` の `useSortable` を使用し、ドラッグハンドルと
 * トランスフォームスタイルを適用する。
 *
 * listeners はラッパー div 全体ではなく、children に渡した dragHandleProps
 * 経由で専用のハンドル要素にのみ適用する。これによりカード内のボタンクリックが
 * ドラッグ開始として横取りされる問題を防ぐ。
 *
 * - Requirements 3.2: リスト表示モードでのドラッグ&ドロップ並び替えを有効化
 */
export function SortableBookmarkItem({
  id,
  children,
}: SortableBookmarkItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
  };

  // listeners をドラッグハンドル専用 props としてまとめる
  const dragHandleProps: React.HTMLAttributes<HTMLElement> = {
    ...listeners,
    ...attributes,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {typeof children === "function" ? children(dragHandleProps) : children}
    </div>
  );
}
