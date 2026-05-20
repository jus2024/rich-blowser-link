"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { useImport } from "@/src/hooks/useImport";
import type { ImportCollectionMode } from "@/src/lib/ai/types";
import type {
  DuplicateCheckResult,
  DuplicateStrategy,
  ImportResult,
  ParseResult,
} from "@/src/lib/import/types";

import { ImportProgress } from "./ImportProgress";
import { ImportResultSummary } from "./ImportResultSummary";
import styles from "./ImportDialog.module.css";

/**
 * Chrome ブックマークインポートダイアログ。
 *
 * 状態遷移は design.md の「ImportDialog コンポーネント設計」を参照:
 *   FileSelect → Parsing → Preview → DuplicateCheck → DuplicateChoice → Importing → Completed
 *
 * Validates: Requirements 10.1, 10.2, 10.7, 10.8, 10.9
 */
export interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** インポート完了時（成否を問わず完了状態になったとき）に 1 度だけ呼ばれる。collectionMode を引数で通知する */
  onImportComplete?: (collectionMode: ImportCollectionMode) => void;
}

type DialogStage =
  | "fileSelect"
  | "parsing"
  | "preview"
  | "duplicateCheck"
  | "duplicateChoice"
  | "importing"
  | "completed";

/** クライアント側で事前に弾くファイルサイズ上限（Requirement 10.1）。 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_SIZE_LABEL = "10MB";

/** プレビューに表示するフォルダの最大件数（長大なツリーを避けるため省略表示する）。 */
const PREVIEW_FOLDER_LIMIT = 50;

export function ImportDialog({
  isOpen,
  onClose,
  onImportComplete,
}: ImportDialogProps) {
  const {
    parseFile,
    checkDuplicates,
    startImport,
    cancelImport,
    progress,
    error: hookError,
  } = useImport();

  const [stage, setStage] = useState<DialogStage>("fileSelect");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [duplicateResult, setDuplicateResult] =
    useState<DuplicateCheckResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] =
    useState<DuplicateStrategy>("skip");
  const [collectionMode, setCollectionMode] =
    useState<ImportCollectionMode>("folder-inherit");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /** ダイアログ内部の一時状態をリセットする（ファイル再選択 / 閉じるときに使用）。 */
  const resetLocalState = useCallback(() => {
    setStage("fileSelect");
    setParseResult(null);
    setDuplicateResult(null);
    setDuplicateStrategy("skip");
    setCollectionMode("folder-inherit");
    setImportResult(null);
    setErrorMessage(null);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  /** 閉じる操作: 進行中のインポートがあれば中断し、ローカル状態をリセットする。 */
  const handleClose = useCallback(() => {
    if (stage === "importing") {
      cancelImport();
    }
    resetLocalState();
    onClose();
  }, [cancelImport, onClose, resetLocalState, stage]);

  // ESC キーで閉じる（ただしインポート実行中はキャンセル扱い）
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose, isOpen]);

  // ダイアログが閉じられたときに内部状態を初期化する（次回再オープン時のために）。
  useEffect(() => {
    if (!isOpen) {
      resetLocalState();
    }
  }, [isOpen, resetLocalState]);

  // ファイル選択後の共通処理: サイズ検証 → パース → プレビュー。
  const handleFile = useCallback(
    async (file: File) => {
      setErrorMessage(null);

      if (!file.name.toLowerCase().endsWith(".html")) {
        setErrorMessage(
          "HTML ファイル (.html) を選択してください。Chrome のブックマークエクスポートファイルのみ対応しています。",
        );
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setErrorMessage(
          `ファイルサイズが上限 (${MAX_FILE_SIZE_LABEL}) を超えています。別のファイルを選択してください。`,
        );
        return;
      }

      setStage("parsing");
      try {
        const result = await parseFile(file);
        setParseResult(result);
        setStage("preview");
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "ブックマークファイルの解析に失敗しました。";
        setErrorMessage(message);
        setStage("fileSelect");
      }
    },
    [parseFile],
  );

  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    // ドロップゾーン外に出たときだけ解除する（子要素間のイベントで false にならないように判定）
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }
    setIsDragging(false);
  }, []);

  // 実インポート実行の共通処理。
  const runImport = useCallback(
    async (strategy: DuplicateStrategy, source: ParseResult) => {
      setStage("importing");
      try {
        const result = await startImport(source, strategy, collectionMode);
        setImportResult(result);
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "インポート中にエラーが発生しました。";
        setErrorMessage(message);
      } finally {
        setStage("completed");
        onImportComplete?.(collectionMode);
      }
    },
    [collectionMode, onImportComplete, startImport],
  );

  // Preview → DuplicateCheck の遷移。重複ゼロなら Importing に直行する（Requirement 10.7）。
  const handleStartImport = useCallback(async () => {
    if (!parseResult) return;

    setStage("duplicateCheck");
    setErrorMessage(null);

    try {
      const dup = await checkDuplicates(parseResult.bookmarks);
      setDuplicateResult(dup);
      if (dup.duplicateCount === 0) {
        await runImport("skip", parseResult);
      } else {
        setStage("duplicateChoice");
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "重複チェックに失敗しました。";
      setErrorMessage(message);
      setStage("preview");
    }
  }, [checkDuplicates, parseResult, runImport]);

  const handleConfirmDuplicateChoice = useCallback(() => {
    if (!parseResult) return;
    void runImport(duplicateStrategy, parseResult);
  }, [duplicateStrategy, parseResult, runImport]);

  const handleCancelImporting = useCallback(() => {
    cancelImport();
    // startImport の promise は cancelImport で完了扱いになるため、ここで stage を進めない。
  }, [cancelImport]);

  // プレビューに表示するフォルダ一覧（長大な場合は先頭 N 件 + 省略表示）。
  const folderPreview = useMemo(() => {
    if (!parseResult) return { shown: [], omitted: 0 };
    const shown = parseResult.folders.slice(0, PREVIEW_FOLDER_LIMIT);
    const omitted = Math.max(
      0,
      parseResult.folders.length - PREVIEW_FOLDER_LIMIT,
    );
    return { shown, omitted };
  }, [parseResult]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          // 実行中のインポートは誤爆防止のためオーバーレイクリックで閉じない。
          if (stage === "importing" || stage === "duplicateCheck") return;
          handleClose();
        }
      }}
    >
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label="Chrome ブックマークインポート"
      >
        <header className={styles.header}>
          <h2 className={styles.title}>Chrome ブックマークインポート</h2>
          <button
            type="button"
            className={styles.closeIconButton}
            onClick={handleClose}
            aria-label="閉じる"
            disabled={stage === "duplicateCheck"}
          >
            ×
          </button>
        </header>

        {stage === "fileSelect" && (
          <FileSelectView
            isDragging={isDragging}
            fileInputRef={fileInputRef}
            onFileChange={handleFileInputChange}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            errorMessage={errorMessage}
          />
        )}

        {stage === "parsing" && <ParsingView />}

        {stage === "preview" && parseResult && (
          <PreviewView
            parseResult={parseResult}
            folderPreview={folderPreview}
            collectionMode={collectionMode}
            onCollectionModeChange={setCollectionMode}
            errorMessage={errorMessage}
            onStart={() => void handleStartImport()}
            onBack={resetLocalState}
          />
        )}

        {stage === "duplicateCheck" && <DuplicateCheckingView />}

        {stage === "duplicateChoice" && duplicateResult && (
          <DuplicateChoiceView
            duplicateResult={duplicateResult}
            strategy={duplicateStrategy}
            onStrategyChange={setDuplicateStrategy}
            onContinue={handleConfirmDuplicateChoice}
            onCancel={resetLocalState}
          />
        )}

        {stage === "importing" && (
          <ImportProgress
            progress={progress}
            onCancel={handleCancelImporting}
          />
        )}

        {stage === "completed" && importResult && (
          <ImportResultSummary result={importResult} onClose={handleClose} />
        )}

        {stage === "completed" && !importResult && (
          <CompletedErrorView
            message={errorMessage ?? hookError ?? "インポートが完了しませんでした。"}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}

export default ImportDialog;

// ---------------------------------------------------------------------------
// 下位ビュー（同ファイル内で完結させて可読性を優先）
// ---------------------------------------------------------------------------

interface FileSelectViewProps {
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  errorMessage: string | null;
}

function FileSelectView({
  isDragging,
  fileInputRef,
  onFileChange,
  onDrop,
  onDragOver,
  onDragLeave,
  errorMessage,
}: FileSelectViewProps) {
  const dropZoneClassName = [
    styles.dropZone,
    isDragging ? styles.dropZoneActive : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.body}>
      <p className={styles.description}>
        Chrome からエクスポートした HTML 形式のブックマークファイル (.html、最大
        {" "}
        {MAX_FILE_SIZE_LABEL}) を選択してください。
      </p>

      <div
        className={dropZoneClassName}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <p className={styles.dropZoneLabel}>ここにファイルをドラッグ&ドロップ</p>
        <p className={styles.dropZoneDivider}>または</p>
        <label className={styles.fileSelectButton}>
          ファイルを選択
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,text/html"
            className={styles.fileInput}
            onChange={onFileChange}
          />
        </label>
      </div>

      {errorMessage && (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

function ParsingView() {
  return (
    <div className={styles.body} aria-live="polite" aria-busy="true">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.loadingLabel}>ブックマークを解析しています…</p>
    </div>
  );
}

interface PreviewViewProps {
  parseResult: ParseResult;
  folderPreview: {
    shown: ParseResult["folders"];
    omitted: number;
  };
  collectionMode: ImportCollectionMode;
  onCollectionModeChange: (mode: ImportCollectionMode) => void;
  errorMessage: string | null;
  onStart: () => void;
  onBack: () => void;
}

function PreviewView({
  parseResult,
  folderPreview,
  collectionMode,
  onCollectionModeChange,
  errorMessage,
  onStart,
  onBack,
}: PreviewViewProps) {
  return (
    <div className={styles.body}>
      <div className={styles.preview}>
        <div className={styles.previewStats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>インポート対象</span>
            <span className={styles.statValue}>{parseResult.validCount}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>スキップ</span>
            <span className={styles.statValue}>{parseResult.skippedCount}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>フォルダ</span>
            <span className={styles.statValue}>
              {parseResult.folders.length}
            </span>
          </div>
        </div>

        <fieldset className={styles.collectionModeGroup}>
          <legend className={styles.sectionTitle}>Collection の取り扱い</legend>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="collectionMode"
              value="folder-inherit"
              checked={collectionMode === "folder-inherit"}
              onChange={() => onCollectionModeChange("folder-inherit")}
            />
            <span>フォルダ構成を引き継ぐ</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="collectionMode"
              value="flat"
              checked={collectionMode === "flat"}
              onChange={() => onCollectionModeChange("flat")}
            />
            <span>フラットに取り込む（AI が Collection を提案）</span>
          </label>
        </fieldset>

        {collectionMode === "folder-inherit" && parseResult.folders.length > 0 && (
          <>
            <h3 className={styles.sectionTitle}>フォルダ構造</h3>
            <ul className={styles.folderTree}>
              {folderPreview.shown.map((folder, index) => {
                const fullPath = [...folder.path, folder.name].join(" / ");
                const key = `${fullPath}-${index}`;
                return (
                  <li key={key} className={styles.folderItem}>
                    <span className={styles.folderPath}>{fullPath}</span>
                    <span className={styles.folderCount}>
                      {folder.bookmarkCount} 件
                    </span>
                  </li>
                );
              })}
            </ul>
            {folderPreview.omitted > 0 && (
              <p className={styles.folderOmitted}>
                他 {folderPreview.omitted} 件のフォルダは省略表示されています
              </p>
            )}
          </>
        )}

        {collectionMode === "flat" && (
          <p className={styles.flatModeMessage}>
            全てのブックマークを Collection なしでインポートします。AI 補完が有効な場合、既存の Collection から適切なものが自動的に割り当てられます。
          </p>
        )}
      </div>

      {errorMessage && (
        <div className={styles.error} role="alert">
          {errorMessage}
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onBack}
        >
          戻る
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onStart}
          disabled={parseResult.validCount === 0}
        >
          インポート開始
        </button>
      </div>
    </div>
  );
}

function DuplicateCheckingView() {
  return (
    <div className={styles.body} aria-live="polite" aria-busy="true">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.loadingLabel}>重複 URL をチェックしています…</p>
    </div>
  );
}

interface DuplicateChoiceViewProps {
  duplicateResult: DuplicateCheckResult;
  strategy: DuplicateStrategy;
  onStrategyChange: (strategy: DuplicateStrategy) => void;
  onContinue: () => void;
  onCancel: () => void;
}

function DuplicateChoiceView({
  duplicateResult,
  strategy,
  onStrategyChange,
  onContinue,
  onCancel,
}: DuplicateChoiceViewProps) {
  return (
    <div className={styles.body}>
      <div className={styles.duplicateChoice}>
        <p className={styles.description}>
          既存の Bookmark と URL が一致する{" "}
          <strong>{duplicateResult.duplicateCount} 件</strong> を検出しました。
          新規は <strong>{duplicateResult.newCount} 件</strong> です。
        </p>

        <fieldset className={styles.radioGroup}>
          <legend className={styles.sectionTitle}>重複 URL の処理方法</legend>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="duplicate-strategy"
              value="skip"
              checked={strategy === "skip"}
              onChange={() => onStrategyChange("skip")}
            />
            <span>
              <strong>スキップ</strong>
              <span className={styles.radioDescription}>
                重複 URL の既存 Bookmark は変更せず、新規のみ追加します。
              </span>
            </span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="duplicate-strategy"
              value="merge"
              checked={strategy === "merge"}
              onChange={() => onStrategyChange("merge")}
            />
            <span>
              <strong>マージ</strong>
              <span className={styles.radioDescription}>
                既存 Bookmark のタイトルをインポート元で上書きし、Collection
                への紐付けを追加します。
              </span>
            </span>
          </label>
        </fieldset>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
        >
          キャンセル
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onContinue}
        >
          続行
        </button>
      </div>
    </div>
  );
}

interface CompletedErrorViewProps {
  message: string;
  onClose: () => void;
}

function CompletedErrorView({ message, onClose }: CompletedErrorViewProps) {
  return (
    <div className={styles.body}>
      <div className={styles.error} role="alert">
        {message}
      </div>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onClose}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
