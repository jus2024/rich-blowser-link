# Design Document: mobile-responsive

## Architecture Overview

モバイルレスポンシブ対応は、既存の3カラムレイアウト（左サイドバー + メインコンテンツ + 右チャットパネル）をモバイルデバイス（768px以下）で最適化する。CSS Modules によるスタイル制御と、React カスタムフック（`useMediaQuery`）によるロジック制御を組み合わせる。

### 設計方針

- **CSS-first**: 可能な限り CSS メディアクエリで対応し、JavaScript による制御は最小限にする
- **既存コンポーネント活用**: `ResizableSidebar` や `useDisplayMode` など既存の仕組みを拡張する
- **状態の一元管理**: モバイル判定は `useMediaQuery` フックに集約し、各コンポーネントで再利用する

## Components

### 1. `useMediaQuery` フック

**ファイル**: `src/hooks/useMediaQuery.ts`

汎用的なメディアクエリ判定フック。`window.matchMedia` API を使用し、ビューポート変更時にリアクティブに値を更新する。

```typescript
import { useEffect, useState } from "react";

/**
 * CSS メディアクエリの一致状態をリアクティブに返すカスタムフック。
 *
 * @param query - CSS メディアクエリ文字列（例: "(max-width: 768px)"）
 * @returns メディアクエリが一致しているかどうかの boolean
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQueryList.addEventListener("change", handler);
    return () => {
      mediaQueryList.removeEventListener("change", handler);
    };
  }, [query]);

  return matches;
}
```

### 2. モバイルヘッダー拡張

**ファイル**: `src/app/page.tsx`（既存）、`src/app/page.module.css`（既存）

ヘッダーにハンバーガーメニューボタンを追加し、モバイル時のみ表示する。

```typescript
// page.tsx 内での使用
const isMobile = useMediaQuery("(max-width: 768px)");

// ヘッダー内
<header className={styles.header}>
  {isMobile && (
    <button
      type="button"
      className={styles.hamburgerButton}
      onClick={() => setIsMobileMenuOpen(true)}
      aria-label="メニューを開く"
    >
      ☰
    </button>
  )}
  <h1 className={styles.title}>Rich Browser Link</h1>
  {/* ... */}
</header>
```

### 3. サイドバーオーバーレイ

**ファイル**: `src/components/layout/MobileSidebarOverlay.tsx`（新規）、`src/components/layout/MobileSidebarOverlay.module.css`（新規）

モバイル時に左サイドバーの内容をオーバーレイパネルとして表示するコンポーネント。

```typescript
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
```

### 4. レイアウト制御ロジック（page.tsx 拡張）

`page.tsx` に以下のモバイル対応ロジックを追加する:

```typescript
const isMobile = useMediaQuery("(max-width: 768px)");
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

// 右サイドバー: モバイル時は強制的に非表示
const previousChatCollapsed = useRef(isChatCollapsed);
useEffect(() => {
  if (isMobile) {
    previousChatCollapsed.current = isChatCollapsed;
    setIsChatCollapsed(true);
  } else {
    setIsChatCollapsed(previousChatCollapsed.current);
  }
}, [isMobile]);

// 左サイドバー: モバイル時はオーバーレイ経由
useEffect(() => {
  if (isMobile) {
    setIsSidebarCollapsed(true);
  }
}, [isMobile]);

// オーバーレイ開閉と isSidebarCollapsed の同期
useEffect(() => {
  setIsSidebarCollapsed(!isMobileMenuOpen);
}, [isMobileMenuOpen]);

// 表示モード: モバイル時は "list" 固定
const effectiveDisplayMode = isMobile ? "list" : displayMode;
```

## Interfaces

### useMediaQuery

```typescript
function useMediaQuery(query: string): boolean;
```

| パラメータ | 型 | 説明 |
|---|---|---|
| `query` | `string` | CSS メディアクエリ文字列 |
| 戻り値 | `boolean` | クエリが一致しているかどうか |

### MobileSidebarOverlay Props

```typescript
interface MobileSidebarOverlayProps {
  /** オーバーレイの表示状態 */
  isOpen: boolean;
  /** 閉じるコールバック */
  onClose: () => void;
  /** サイドバーの内容 */
  children: React.ReactNode;
}
```

## Data Models

本機能では新規のデータモデルは追加しない。既存の state を活用する:

- `isSidebarCollapsed: boolean` — 左サイドバーの開閉状態
- `isChatCollapsed: boolean` — 右チャットパネルの開閉状態
- `displayMode: DisplayMode` — 表示モード（"list" | "grid" | "compact"）
- `isMobileMenuOpen: boolean` — モバイルメニューオーバーレイの開閉状態（新規 state）

## CSS Strategy

### page.module.css の拡張

```css
/* モバイル: 768px 以下 */
@media (max-width: 768px) {
  .header {
    padding: 0.5rem 0.75rem;
  }

  .title {
    font-size: 1rem;
  }

  .content {
    max-height: none;
    overflow-y: visible;
    padding: 0.75rem;
    width: 100%;
  }

  .hamburgerButton {
    display: flex;
  }

  .displayModeSwitcher {
    display: none;
  }
}

/* デスクトップ: ハンバーガー非表示 */
.hamburgerButton {
  display: none;
}
```

### MobileSidebarOverlay.module.css

```css
.backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 40;
}

.panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  max-width: 80vw;
  background-color: var(--color-surface, #ffffff);
  z-index: 50;
  overflow-y: auto;
  padding: 1rem;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.15);
}
```

## Error Handling

- **SSR 対応**: `useMediaQuery` は `typeof window === "undefined"` チェックにより、サーバーサイドレンダリング時に `false` を返す（ハイドレーションミスマッチを防ぐため初期値は `false`）
- **リスナー解除**: `useEffect` のクリーンアップで `removeEventListener` を確実に呼び出し、メモリリークを防止する
- **状態復元**: デスクトップ復帰時に `useRef` で保持した前回の状態を復元し、ユーザーの設定が失われないようにする

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: useMediaQuery は matchMedia の結果と一致する

*For any* 有効な CSS メディアクエリ文字列に対して、`useMediaQuery` フックの返り値は `window.matchMedia(query).matches` の値と常に一致する

**Validates: Requirements 1.1, 1.2**

### Property 2: ハンバーガーメニューの表示はモバイル状態と一致する

*For any* ビューポート幅に対して、ハンバーガーメニューボタンの表示状態は「ビューポート幅 ≤ 768px」と一致する（モバイルなら表示、デスクトップなら非表示）

**Validates: Requirements 2.2, 2.4**

### Property 3: モバイル時に左サイドバーはデフォルトレイアウトから除外される

*For any* ビューポート幅 ≤ 768px の状態において、左サイドバーはメインレイアウトのフロー内に表示されない（オーバーレイ経由でのみアクセス可能）

**Validates: Requirements 3.1**

### Property 4: サイドバーオーバーレイの開閉と isSidebarCollapsed の同期

*For any* モバイルビューの状態において、サイドバーオーバーレイが開いているとき `isSidebarCollapsed` は `false` であり、閉じているとき `isSidebarCollapsed` は `true` である

**Validates: Requirements 3.5, 3.6**

### Property 5: モバイル時に右サイドバーは非表示かつ isChatCollapsed が true

*For any* ビューポート幅 ≤ 768px の状態において、右サイドバー（リサイズハンドル含む）は非表示であり、`isChatCollapsed` は `true` である

**Validates: Requirements 4.1, 4.2**

### Property 6: モバイル時の表示モードは常に "list"

*For any* localStorage に保存された表示モード設定（"list" | "grid" | "compact"）に関わらず、ビューポート幅 ≤ 768px の状態では実効的な表示モードは常に "list" である

**Validates: Requirements 5.1, 5.2**

### Property 7: モバイル時に Quick_Add コンポーネントが表示される

*For any* ビューポート幅 ≤ 768px の状態において、Quick_Add コンポーネントはメインコンテンツエリア内に表示され、利用可能である

**Validates: Requirements 6.1**

### Property 8: モバイル時にメインコンテンツはフルビューポート幅を占有する

*For any* ビューポート幅 ≤ 768px の状態において、メインコンテンツエリアはビューポートの全幅を使用して表示される

**Validates: Requirements 7.1**
