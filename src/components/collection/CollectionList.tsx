"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CollectionNode } from "@/src/types";
import styles from "./CollectionList.module.css";

export interface CollectionListProps {
  collectionTree: CollectionNode[];
  selectedId: string | null | undefined;
  onSelect: (id: string | null | undefined) => void;
  onCreateNew?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Collection の parentId を変更するハンドラ（ドラッグ&ドロップ用） */
  onMove?: (id: string, newParentId: string | null) => Promise<void>;
  counts?: Record<string, number>;
  uncategorizedCount?: number;
  totalCount?: number;
}

function CollectionContextMenu({
  collectionId,
  onEdit,
  onDelete,
}: {
  collectionId: string;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onEdit?.(collectionId);
  }, [collectionId, onEdit]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    onDelete?.(collectionId);
  }, [collectionId, onDelete]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className={styles.contextMenu} ref={menuRef}>
      <button
        type="button"
        className={styles.menuTrigger}
        onClick={handleToggle}
        aria-label="コレクション操作メニュー"
        aria-expanded={isOpen}
      >
        ⋯
      </button>
      {isOpen && (
        <div className={styles.menuDropdown} role="menu">
          {onEdit && (
            <button type="button" className={styles.menuItem} onClick={handleEdit} role="menuitem">
              編集
            </button>
          )}
          {onDelete && (
            <button type="button" className={styles.menuItem} onClick={handleDelete} role="menuitem">
              削除
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** ドラッグ可能 + ドロップターゲットの Collection ノード */
function DraggableCollectionNode({
  node,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  counts,
  hasContextMenu,
  isDraggingId,
}: {
  node: CollectionNode;
  selectedId: string | null | undefined;
  onSelect: (id: string | null | undefined) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  counts?: Record<string, number>;
  hasContextMenu: boolean;
  isDraggingId: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isSelected = selectedId === node.id;
  const count = counts?.[node.id];
  const hasChildren = node.children.length > 0;
  const isBeingDragged = isDraggingId === node.id;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
    data: { type: "collection", node },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${node.id}`,
    data: { type: "collection-drop", targetId: node.id },
    disabled: node.depth >= 2, // 孫には子を追加できない
  });

  // ドラッグ中は半透明
  const opacity = isDragging ? 0.4 : 1;

  return (
    <li className={styles.treeItem} style={{ opacity }}>
      <div
        ref={setDropRef}
        className={[
          styles.nodeRow,
          isOver && !isBeingDragged ? styles.nodeRowOver : "",
        ].filter(Boolean).join(" ")}
        style={{ paddingLeft: `${node.depth * 1.25}rem` }}
      >
        {/* ドラッグハンドル */}
        <span
          ref={setDragRef}
          className={styles.dragHandle}
          {...listeners}
          {...attributes}
          title="ドラッグして移動"
          aria-label="ドラッグして移動"
        >
          ⠿
        </span>

        {hasChildren ? (
          <button
            type="button"
            className={styles.expandButton}
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? "折りたたむ" : "展開する"}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className={styles.expandPlaceholder} />
        )}

        <button
          type="button"
          className={isSelected ? `${styles.item} ${styles.itemSelected}` : styles.item}
          onClick={() => onSelect(node.id)}
          aria-pressed={isSelected}
        >
          <span className={styles.itemName}>{node.name}</span>
          {count !== undefined && (
            <span className={styles.count}>({count})</span>
          )}
        </button>

        {hasContextMenu && (
          <CollectionContextMenu
            collectionId={node.id}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        )}
      </div>

      {hasChildren && isExpanded && (
        <ul className={styles.subList}>
          {node.children.map((child) => (
            <DraggableCollectionNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              counts={counts}
              hasContextMenu={hasContextMenu}
              isDraggingId={isDraggingId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** ルートレベルへのドロップターゲット */
function RootDropZone({ isVisible }: { isVisible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "drop-root",
    data: { type: "collection-drop", targetId: null },
  });

  if (!isVisible) return null;

  return (
    <li>
      <div
        ref={setNodeRef}
        className={[styles.rootDropZone, isOver ? styles.rootDropZoneOver : ""].filter(Boolean).join(" ")}
      >
        ここにドロップしてルートレベルに移動
      </div>
    </li>
  );
}

export function CollectionList({
  collectionTree,
  selectedId,
  onSelect,
  onCreateNew,
  onEdit,
  onDelete,
  onMove,
  counts,
  uncategorizedCount,
  totalCount,
}: CollectionListProps) {
  const isAllSelected = selectedId === undefined;
  const isUncategorizedSelected = selectedId === null;
  const hasContextMenu = onEdit !== undefined || onDelete !== undefined;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingName, setDraggingName] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    setDraggingId(id);
    const node = event.active.data.current?.node as CollectionNode | undefined;
    setDraggingName(node?.name ?? "");
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setDraggingId(null);
    setDraggingName("");

    if (!event.over || !onMove) return;

    const draggedId = String(event.active.id);
    const targetData = event.over.data.current as { type: string; targetId: string | null } | undefined;
    if (targetData?.type !== "collection-drop") return;

    const newParentId = targetData.targetId;

    // 自分自身へのドロップは無視
    if (newParentId === draggedId) return;

    try {
      await onMove(draggedId, newParentId);
    } catch (err) {
      console.error("Collection の移動に失敗しました:", err);
    }
  }, [onMove]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <aside className={styles.sidebar} aria-label="Collection 一覧">
        <div className={styles.header}>
          <h2 className={styles.title}>Collections</h2>
          {onCreateNew !== undefined && (
            <button type="button" className={styles.createButton} onClick={onCreateNew}>
              + 新規作成
            </button>
          )}
        </div>

        <ul className={styles.list}>
          <li>
            <button
              type="button"
              className={isAllSelected ? `${styles.item} ${styles.itemSelected}` : styles.item}
              onClick={() => onSelect(undefined)}
              aria-pressed={isAllSelected}
            >
              <span className={styles.itemName}>すべて</span>
              {totalCount !== undefined && (
                <span className={styles.count}>({totalCount})</span>
              )}
            </button>
          </li>
          <li>
            <button
              type="button"
              className={isUncategorizedSelected ? `${styles.item} ${styles.itemSelected}` : styles.item}
              onClick={() => onSelect(null)}
              aria-pressed={isUncategorizedSelected}
            >
              <span className={styles.itemName}>未分類</span>
              {uncategorizedCount !== undefined && (
                <span className={styles.count}>({uncategorizedCount})</span>
              )}
            </button>
          </li>

          {/* ドラッグ中のみルートドロップゾーンを表示 */}
          <RootDropZone isVisible={draggingId !== null} />

          {collectionTree.map((node) => (
            <DraggableCollectionNode
              key={node.id}
              node={node}
              selectedId={selectedId}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              counts={counts}
              hasContextMenu={hasContextMenu}
              isDraggingId={draggingId}
            />
          ))}
        </ul>
      </aside>

      <DragOverlay>
        {draggingId && (
          <div className={styles.dragOverlay}>
            📁 {draggingName}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default CollectionList;
