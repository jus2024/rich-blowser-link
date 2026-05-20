# Design Document: ブックマーク新規作成・編集フォームのダイアログ化

## Architecture Overview

`BookmarkFormDialog` は、既存の `BookmarkForm` コンポーネントを変更せずにモーダルダイアログとして表示するためのラッパーコンポーネントである。`ImportDialog` と同じ overlay + card パターンを踏襲し、CSS Modules でスタイルを定義する。

```
┌─────────────────────────────────────────────┐
│ page.tsx                                    │
│                                             │
│  isFormVisible / editingBookmark state      │
│         │                                   │
│         ▼                                   │
│  ┌─────────────────────────────────────┐    │
│  │ BookmarkFormDialog                  │    │
│  │  ┌───────────────────────────────┐  │    │
│  │  │ Overlay (fixed, inset: 0)     │  │    │
│  │  │  ┌─────────────────────────┐  │  │    │
│  │  │  │ Card (max-width: 720px) │  │  │    │
│  │  │  │  ┌───────────────────┐  │  │  │    │
│  │  │  │  │ BookmarkForm      │  │  │  │    │
│  │  │  │  │ (既存・変更なし)   │  │  │  │    │
│  │  │  │  └───────────────────┘  │  │  │    │
│  │  │  └─────────────────────────┘  │  │    │
│  │  └───────────────────────────────┘  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Components

### BookmarkFormDialog

**ファイルパス:** `src/components/bookmark/BookmarkFormDialog.tsx`

**責務:** BookmarkForm をモーダルダイアログとして表示し、開閉制御・キーボード操作・アクセシビリティを担当する。

```typescript
export interface BookmarkFormDialogProps {
  /** ダイアログの表示状態 */
  isOpen: boolean;
  /** ダイアログを閉じるコールバック */
  onClose: () => void;
  /** 編集対象の Bookmark（省略時は新規作成モード） */
  bookmark?: Bookmark;
  /** フォーム送信ハンドラ（BookmarkForm に透過的に渡す） */
  onSubmit: (data: BookmarkInput, tags: string[]) => Promise<void>;
  /** 編集モード時の初期 Tag 名配列 */
  initialTags?: string[];
}
```

**内部動作:**

1. `isOpen === false` の場合は `null` を返す（何も描画しない）
2. `isOpen === true` の場合は overlay + card 構造を描画し、内部に `BookmarkForm` を配置する
3. ESC キーのイベントリスナーを登録し、押下時に `onClose` を呼び出す
4. Overlay のクリックイベントは無視する（誤操作によるデータ消失を防止）
5. ダイアログ表示時にフォーカスを card 内部に移動する
6. `BookmarkForm` の `onCancel` を `onClose` にマッピングする
7. `BookmarkForm` の `onSubmit` 完了後に `onClose` を呼び出す

```typescript
"use client";

import { useCallback, useEffect, useRef } from "react";
import { BookmarkForm } from "./BookmarkForm";
import type { Bookmark, BookmarkInput } from "@/src/types";
import styles from "./BookmarkFormDialog.module.css";

export function BookmarkFormDialog({
  isOpen,
  onClose,
  bookmark,
  onSubmit,
  initialTags,
}: BookmarkFormDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // ESC キーで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ダイアログ表示時にフォーカスを移動
  useEffect(() => {
    if (isOpen && cardRef.current) {
      cardRef.current.focus();
    }
  }, [isOpen]);

  // onSubmit ラッパー: 成功時にダイアログを閉じる
  const handleSubmit = useCallback(
    async (data: BookmarkInput, tags: string[]) => {
      await onSubmit(data, tags);
      onClose();
    },
    [onSubmit, onClose],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} role="presentation">
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={bookmark ? "Bookmark を編集" : "Bookmark を作成"}
        tabIndex={-1}
      >
        <BookmarkForm
          bookmark={bookmark}
          onSubmit={handleSubmit}
          onCancel={onClose}
          initialTags={initialTags}
        />
      </div>
    </div>
  );
}
```

### BookmarkFormDialog.module.css

**ファイルパス:** `src/components/bookmark/BookmarkFormDialog.module.css`

ImportDialog.module.css の overlay + card パターンを踏襲し、`max-width` のみ 720px に変更する。

```css
.overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.card {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  width: 100%;
  max-width: 720px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  color: var(--color-text);
  outline: none;
}
```

## Integration with page.tsx

`page.tsx` の変更は最小限に留める:

1. `BookmarkFormDialog` を import する
2. インラインの `BookmarkForm` 表示部分を `BookmarkFormDialog` に置き換える
3. 既存の `isFormVisible` / `editingBookmark` state をそのまま使用する

**変更前:**
```typescript
{isFormVisible && (
  <BookmarkForm
    bookmark={editingBookmark ?? undefined}
    onSubmit={handleFormSubmit}
    onCancel={handleFormCancel}
  />
)}
```

**変更後:**
```typescript
<BookmarkFormDialog
  isOpen={isFormVisible}
  onClose={handleFormCancel}
  bookmark={editingBookmark ?? undefined}
  onSubmit={handleFormSubmit}
/>
```

`handleFormSubmit` 内の `setIsFormVisible(false)` は `BookmarkFormDialog` 側で `onClose` を呼ぶため不要になるが、`handleFormSubmit` 自体は重複ダイアログ表示のロジックを含むため、submit 成功時の `setIsFormVisible(false)` を削除し、代わりに `BookmarkFormDialog` の `handleSubmit` ラッパーが `onClose` を呼ぶ設計とする。

## Data Flow

```
ユーザー操作
    │
    ├─ 「+ 新規作成」クリック
    │   → setEditingBookmark(null) + setIsFormVisible(true)
    │   → BookmarkFormDialog(isOpen=true, bookmark=undefined)
    │
    ├─ 編集操作
    │   → setEditingBookmark(bookmark) + setIsFormVisible(true)
    │   → BookmarkFormDialog(isOpen=true, bookmark=bookmark)
    │
    ├─ ESC キー押下
    │   → BookmarkFormDialog 内部で onClose() 呼び出し
    │   → handleFormCancel() → setIsFormVisible(false) + setEditingBookmark(null)
    │
    ├─ キャンセルボタン
    │   → BookmarkForm.onCancel → onClose()
    │   → handleFormCancel() → setIsFormVisible(false) + setEditingBookmark(null)
    │
    └─ フォーム送信成功
        → BookmarkFormDialog.handleSubmit → onSubmit() → onClose()
        → handleFormCancel() → setIsFormVisible(false) + setEditingBookmark(null)
```

## Error Handling

| シナリオ | 対応 |
|---------|------|
| `onSubmit` が例外をスロー | `BookmarkForm` 内部でエラー表示。ダイアログは閉じない |
| ESC キー連打 | `isOpen=false` 時はイベントリスナー未登録のため無害 |
| Overlay クリック | イベントを無視（データ消失防止） |

## Accessibility

- `role="dialog"` + `aria-modal="true"` でスクリーンリーダーにモーダルを通知
- `aria-label` で新規作成/編集モードを区別してアナウンス
- ダイアログ表示時に `tabIndex={-1}` の card 要素にフォーカスを移動
- ESC キーでの閉じる操作をサポート

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: ダイアログ構造の整合性

*For any* valid `BookmarkFormDialogProps` with `isOpen=true`, the rendered output SHALL contain an overlay element wrapping a card element which contains a `BookmarkForm` component.

**Validates: Requirements 1.1**

### Property 2: アクセシビリティ属性の完全性

*For any* valid `BookmarkFormDialogProps` with `isOpen=true`, the card element SHALL have `role="dialog"`, `aria-modal="true"`, and a non-empty `aria-label` attribute.

**Validates: Requirements 1.4, 5.1**

### Property 3: ESC キーによるダイアログ閉じ

*For any* open state of `BookmarkFormDialog`, dispatching a keyboard event with `key="Escape"` SHALL invoke the `onClose` callback exactly once.

**Validates: Requirements 2.1**

### Property 4: Overlay クリックの無視

*For any* open state of `BookmarkFormDialog`, clicking the overlay element SHALL NOT invoke the `onClose` callback.

**Validates: Requirements 2.2**

### Property 5: 非表示時の空レンダリング

*For any* valid `BookmarkFormDialogProps` with `isOpen=false`, the component SHALL render nothing (return null).

**Validates: Requirements 2.3**

### Property 6: Props の透過的転送

*For any* valid `bookmark` and `initialTags` props passed to `BookmarkFormDialog`, the inner `BookmarkForm` SHALL receive the same `bookmark` and `initialTags` values unchanged.

**Validates: Requirements 4.1**
