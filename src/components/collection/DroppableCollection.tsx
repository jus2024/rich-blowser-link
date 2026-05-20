"use client";

import { useDroppable } from "@dnd-kit/core";
import styles from "./DroppableCollection.module.css";

export interface DroppableCollectionProps {
  /** ドロップターゲットとなるコレクションの ID */
  collectionId: string;
  /** コレクション項目の子要素 */
  children: React.ReactNode;
}

/**
 * コレクションサイドバーの各項目をドロップターゲットにするラッパーコンポーネント。
 *
 * - 要件 2.4: ドラッグオーバー時にハイライトスタイルを適用する。
 * - `useDroppable` フックで `isOver` 状態を取得し、視覚的フィードバックを提供する。
 */
export function DroppableCollection({
  collectionId,
  children,
}: DroppableCollectionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `collection-${collectionId}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.droppable} ${isOver ? styles.droppableOver : ""}`}
    >
      {children}
    </div>
  );
}

export default DroppableCollection;
