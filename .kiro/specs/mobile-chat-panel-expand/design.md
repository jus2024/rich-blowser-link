# Design Document: Mobile Chat Panel Expand

## Overview

モバイルビュー（768px以下）で右側 AI チャットパネル（AgentChatSection）をフルスクリーンオーバーレイとして展開可能にする。既存の MobileSidebarOverlay パターンを踏襲し、新規コンポーネント `MobileChatOverlay` を作成する。左サイドバーとチャットパネルの排他制御は page.tsx の状態管理で実現する。

## Architecture

### コンポーネント構成

```
page.tsx (状態管理: isMobileMenuOpen, isMobileChatOpen)
├── Header
│   ├── hamburgerButton (左: サイドバー開閉)
│   └── chatToggleButton (右: チャット開閉) ← 新規追加
├── MobileSidebarOverlay (既存)
├── MobileChatOverlay ← 新規コンポーネント
│   ├── backdrop
│   └── panel
│       ├── closeButton
│       └── AgentChatSection
├── ResizableSidebar[left] (デスクトップのみ)
├── content
└── ResizableSidebar[right] (デスクトップのみ)
```

### 状態管理フロー

```
isMobileMenuOpen: boolean  (既存: 左サイドバーオーバーレイ)
isMobileChatOpen: boolean  (新規: チャットオーバーレイ)

排他制御:
- openChat()  → setIsMobileChatOpen(true), setIsMobileMenuOpen(false)
- openSidebar() → setIsMobileMenuOpen(true), setIsMobileChatOpen(false)
```

## Components and Interfaces

### MobileChatOverlay

新規コンポーネント。MobileSidebarOverlay と同じ構造パターンを採用するが、右側からスライドイン・フルスクリーン幅で表示する。

**ファイルパス:** `src/components/layout/MobileChatOverlay.tsx`

```typescript
interface MobileChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}
```

**実装方針:**
- `isOpen` が false の場合は null を返す（MobileSidebarOverlay と同じ）
- backdrop: `position: fixed; inset: 0` で画面全体を覆う半透明背景
- panel: `position: fixed; top: 0; right: 0; bottom: 0; width: 100%` でフルスクリーン
- 閉じるボタン: パネル内左上に配置
- ARIA: panel に `role="dialog"` と `aria-label="AI チャット"` を付与
- backdrop に `aria-hidden="true"` を付与

### MobileChatOverlay.module.css

**ファイルパス:** `src/components/layout/MobileChatOverlay.module.css`

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
  right: 0;
  bottom: 0;
  width: 100%;
  background-color: var(--color-surface, #ffffff);
  z-index: 50;
  overflow-y: auto;
  padding: 1rem;
  box-shadow: -4px 0 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.closeButton {
  align-self: flex-start;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  margin-bottom: 0.5rem;
  color: var(--color-text-secondary, #6b7280);
}

.closeButton:hover {
  color: var(--color-text, #111827);
}

.content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

### Chat Toggle Button（page.tsx 内 Header に追加）

ヘッダー右側に配置するチャット展開ボタン。モバイルビューでのみ表示。

```typescript
{isMobile && (
  <button
    type="button"
    className={styles.chatToggleButton}
    onClick={() => {
      setIsMobileChatOpen(true);
      setIsMobileMenuOpen(false);
    }}
    aria-label="チャットを開く"
  >
    💬
  </button>
)}
```

**CSS（page.module.css に追加）:**

```css
.chatToggleButton {
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: none;
  border: none;
  font-size: 1.5rem;
  padding: 0.25rem;
}

@media (max-width: 768px) {
  .chatToggleButton {
    display: flex;
  }
}
```

### MobileChatOverlay Props

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | オーバーレイの表示状態 |
| `onClose` | `() => void` | 閉じるアクション（backdrop クリック or 閉じるボタン） |
| `children` | `React.ReactNode` | パネル内に表示するコンテンツ（AgentChatSection） |

### page.tsx 状態変更

| State | Type | Description |
|-------|------|-------------|
| `isMobileChatOpen` | `boolean` | チャットオーバーレイの開閉状態（新規追加） |

## Data Models

この機能はデータモデルの変更を伴わない。UI 状態のみの変更。

## Error Handling

| シナリオ | 対応 |
|----------|------|
| AgentChatSection 内の通信エラー | 既存のエラーハンドリング（error state 表示）がそのまま動作 |
| Runtime ARN 未設定 | 既存の「Runtime 未設定」メッセージがオーバーレイ内に表示される |
| 未認証状態 | 既存の「ログインが必要」メッセージがオーバーレイ内に表示される |

AgentChatSection は既にエラー状態を自己完結的に処理するため、MobileChatOverlay 側での追加エラーハンドリングは不要。

## Implementation Notes

### page.tsx の変更箇所

1. **State 追加:** `const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);`
2. **ハンバーガーメニュー onClick 変更:** `setIsMobileChatOpen(false)` を追加
3. **Header 内にチャットトグルボタン追加:** ヘッダー右側（headerActions の前）
4. **MobileChatOverlay 追加:** layout div 内に配置
5. **排他制御:** 各 open 関数で他方を close

### 既存コードへの影響

- `MobileSidebarOverlay`: 変更なし
- `AgentChatSection`: 変更なし（props そのまま）
- `ResizableSidebar[right]`: 変更なし（`!isMobile` 条件は維持）
- `page.module.css`: chatToggleButton スタイル追加のみ

## Testing Strategy

- **Unit tests (example-based):** アクセシビリティ属性の存在確認（aria-label, role, aria-hidden）、閉じるボタンの存在確認、AgentChatSection がオーバーレイ内に含まれることの確認
- **Property tests:** 排他制御の不変条件、トグルボタンの表示/非表示条件、オーバーレイの開閉状態遷移
- **Lint/型チェック:** TypeScript コンパイルエラーがないこと、CSS Module の未使用クラス警告がないこと

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: チャットトグルボタンの表示はモバイル状態に依存する

*For any* viewport state, the chat toggle button SHALL be rendered if and only if the viewport width is 768px or less (mobile view).

**Validates: Requirements 1.1, 1.4**

### Property 2: 閉じるアクションはオーバーレイを閉じる

*For any* state where the Mobile_Chat_Overlay is open, clicking either the backdrop or the close button SHALL result in the overlay being closed (isMobileChatOpen becomes false).

**Validates: Requirements 3.1, 3.3**

### Property 3: 排他制御 — 同時に開けるオーバーレイは最大1つ

*For any* sequence of user interactions (hamburger menu click, chat toggle click), at most one of isMobileMenuOpen and isMobileChatOpen SHALL be true at any given time. Opening one SHALL close the other.

**Validates: Requirements 4.1, 4.2**

### Property 4: モバイルビューでの AgentChatSection アクセス経路

*For any* mobile view state, AgentChatSection SHALL be rendered exclusively within the MobileChatOverlay component, and never within the ResizableSidebar.

**Validates: Requirements 5.2, 5.3**
