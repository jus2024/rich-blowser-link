import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AmplifyProvider from "@/src/lib/amplify/AmplifyProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rich Browser Link",
  description: "リッチなリンク管理 Web アプリケーション",
};

/**
 * ルートレイアウト
 *
 * AmplifyProvider で Amplify 初期化 + Authenticator によるログインゲートを提供する。
 * - Amplify 設定済み: 未認証ユーザーにはログイン画面を表示（Requirement 8.1）
 * - トークン無効/期限切れ時: 自動的にログイン画面にリダイレクト（Requirement 8.5）
 * - Amplify 未設定（sandbox 未起動）: 認証なしで子要素を表示
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <AmplifyProvider>{children}</AmplifyProvider>
      </body>
    </html>
  );
}
