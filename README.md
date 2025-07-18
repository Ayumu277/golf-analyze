# Golf Analyze 🏌️

AIでゴルフスイングを解析して上達をサポートするウェブアプリケーションです。

## 技術スタック

- **Next.js 14** - App Router使用
- **TypeScript** - 型安全性
- **Tailwind CSS** - スタイリング
- **PWA対応** - オフライン使用可能
- **Playwright MCP** - 自動デモ対応
- **Google Gemini AI** - 動画解析エンジン
- **Vercel** - ホスティング・デプロイ

## 特徴

- 📱 **PWA対応**: モバイルデバイスにインストール可能
- 🎥 **動画アップロード**: ゴルフスイング動画をドラッグ&ドロップ（最大50MB推奨）
- 📺 **動画プレビュー**: アップロード後、その場で動画内容を確認可能
- 🤖 **AI解析**: Gemini AIによる詳細なスイング分析とアドバイス
- 📊 **結果表示**: わかりやすい解析結果
- 🎯 **Playwright MCP対応**: 自動デモ機能
- ☁️ **Vercel対応**: 本番環境での安定動作

## Playwright MCP 自動デモ要素

以下のIDとセレクターが自動デモで使用可能です：

- `#upload` - 動画ファイルアップロード (input[type="file"])
- `#analyze-button` - 解析開始ボタン
- `#result` - AI解析結果表示エリア

### MCP操作例
```javascript
// ファイルアップロード
await browser_upload('#upload', 'sample-golf-video.mp4');

// 解析開始
await browser_click('#analyze-button');

// 結果読み取り（最大5分待機）
await page.waitForSelector('#result .bg-white', { timeout: 300000 });
const result = await browser_read('#result');
console.log('解析結果:', result);
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

#### ローカル開発用
プロジェクトルートに `.env.local` ファイルを作成し、Gemini API キーを設定：

```bash
# .env.local
GEMINI_API_KEY=your_gemini_api_key_here
```

#### Vercelデプロイ用
Vercelダッシュボードで環境変数を設定：

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. プロジェクトを選択
3. Settings → Environment Variables
4. `GEMINI_API_KEY` を追加し、値を設定

**Gemini API キーの取得方法:**
1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. Googleアカウントでログイン
3. 「Create API Key」をクリック
4. 生成されたキーを環境変数に設定

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてアプリケーションにアクセスします。

### 4. プロダクションビルド

```bash
npm run build
npm start
```

## Vercelデプロイ

### 自動デプロイ（推奨）

1. **GitHubリポジトリにプッシュ**
```bash
git add .
git commit -m "Add Vercel deployment configuration"
git push origin main
```

2. **Vercelでプロジェクトをインポート**
   - [Vercel Dashboard](https://vercel.com/new) にアクセス
   - GitHubリポジトリを選択してインポート
   - 環境変数 `GEMINI_API_KEY` を設定
   - デプロイ開始

### 手動デプロイ

```bash
# Vercel CLIをインストール
npm i -g vercel

# デプロイ
vercel

# 本番環境デプロイ
vercel --prod
```

## PWA機能

### インストール
- Chrome/Edge: アドレスバーのインストールアイコンをクリック
- Safari: 共有 → ホーム画面に追加

### オフライン使用
- 一度訪問したページはオフラインでも使用可能
- Service Workerによるキャッシュ機能

## 使用方法

1. **動画アップロード**
   - 「動画をアップロード」セクションでファイルを選択
   - MP4, MOV, AVI などの動画ファイルに対応（最大50MB推奨）
   - アップロード後、動画プレビューで内容を確認

2. **解析実行**
   - 「🚀 スイング解析を開始」ボタンをクリック
   - Gemini AIが動画を解析します（通常1-5分、ファイルサイズに依存）

3. **結果確認**
   - 解析結果エリアに詳細なAIアドバイスが表示
   - フォームの良し悪し、改善点、評価などを確認

## API エンドポイント

### POST /api/analyze

ゴルフスイング動画を解析するAPIエンドポイント

**リクエスト:**
```json
{
  "videoBase64": "base64でエンコードされた動画データ"
}
```

**レスポンス:**
```json
{
  "success": true,
  "analysis": "AIによる解析結果テキスト",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "fileSize": "123MB"
}
```

**制限事項:**
- 最大ファイルサイズ: 50MB（Vercel制限）
- タイムアウト: 5分（Vercel Pro plan）
- 対応フォーマット: MP4, MOV, AVI 等

## Vercel制限と対応

### ファイルサイズ制限
- **Hobby Plan**: 4.5MB
- **Pro Plan**: 理論上100MB、実際は50MB推奨 ✅ （本アプリ対応）
- **Enterprise**: カスタム

### タイムアウト制限
- **Hobby Plan**: 10秒
- **Pro Plan**: 300秒 ✅ （本アプリ対応）
- **Enterprise**: カスタム

### 推奨事項
- **Vercel Pro plan必須**: Hobby planでは制限が厳しすぎます
- **ファイルサイズ**: 50MB以下を強く推奨（解析速度・安定性向上）
- **動画圧縮**: 高品質を保ちながらファイルサイズを最小化
- **短い動画**: 30秒〜2分程度を推奨

### エラー対処法
1. **413 エラー（ファイルサイズ制限）**
   - 50MB以下の動画を使用
   - 動画圧縮ツールでサイズを削減

2. **500 エラー（サーバーエラー）**
   - Gemini API キーの確認
   - しばらく待ってから再試行

3. **JSONパースエラー**
   - アプリケーションが自動的に処理
   - HTTPステータスコードに応じた適切なエラーメッセージを表示

## Playwright MCP デモスクリプト例

```javascript
// ファイルアップロード（MCPコマンド）
await browser_upload('#upload', 'sample-golf-video.mp4');

// 解析開始（MCPコマンド）
await browser_click('#analyze-button');

// 結果待機と読み取り（最大5分）
await page.waitForSelector('#result .bg-white', { timeout: 300000 });
const result = await browser_read('#result');
console.log('解析結果:', result);

// 従来のPlaywrightコマンド（参考）
await page.setInputFiles('#upload', 'sample-golf-video.mp4');
await page.click('#analyze-button');
const resultText = await page.textContent('#result');
```

## ディレクトリ構造

```
golf_Analyze/
├── src/
│   └── app/                 # App Router
│       ├── api/
│       │   └── analyze/     # Gemini API連携
│       │       └── route.ts
│       ├── layout.tsx       # ルートレイアウト
│       ├── page.tsx         # メインページ
│       ├── globals.css      # グローバルスタイル
│       └── fonts/          # フォントファイル
├── public/
│   ├── manifest.json       # PWAマニフェスト
│   ├── icon-192x192.png    # PWAアイコン
│   └── icon-512x512.png    # PWAアイコン
├── vercel.json             # Vercel設定
├── next.config.mjs         # Next.js + PWA設定
└── package.json           # 依存関係
```

## 開発ポイント

- **PWA設定**: `next.config.mjs`でnext-pwaを設定済み
- **TypeScript**: 型安全性のため全ファイルで使用
- **Tailwind CSS**: レスポンシブデザイン対応
- **App Router**: Next.js 14の最新ルーティング
- **Gemini AI**: 動画解析にGoogle Gemini 1.5 Flashを使用
- **Vercel最適化**: ファイルサイズとタイムアウト制限に対応
- **動画プレビュー**: アップロード後の確認機能
- **MCP対応**: Playwright MCPでの自動操作に完全対応

## トラブルシューティング

### よくある問題

1. **「Gemini API キーが設定されていません」エラー**
   - Vercel: Environment Variablesで`GEMINI_API_KEY`を設定
   - ローカル: `.env.local` ファイルが正しく作成されているか確認
   - 開発サーバーを再起動

2. **「動画ファイルのサイズが50MBを超えています」エラー**
   - Vercelの制限により50MB以下のファイルを使用
   - 動画圧縮ツールを使用してファイルサイズを削減
   - 動画時間を短くする（30秒〜2分推奨）

3. **解析が遅い・タイムアウトする**
   - 大きなファイル（30MB以上）は解析に数分かかる場合があります
   - ネットワーク接続を確認
   - ファイルサイズを可能な限り小さくする（推奨: 20MB以下）

4. **Vercel デプロイエラー**
   - 環境変数が正しく設定されているか確認
   - ビルドログでエラー詳細を確認
   - Pro planでの利用を確認（Hobby planは制限あり）

5. **動画プレビューが表示されない**
   - ブラウザが動画形式をサポートしているか確認
   - ファイルが破損していないか確認

## パフォーマンス最適化

### 推奨事項
- **ファイルサイズ**: 20MB以下を推奨（解析速度・Vercel制限考慮）
- **動画時間**: 30秒〜2分程度を推奨
- **解像度**: 1080p以下を推奨
- **フォーマット**: MP4形式を推奨（圧縮率が高い）
- **フレームレート**: 30fps以下を推奨

### 動画圧縮のコツ
1. **解像度調整**: 1920x1080 → 1280x720 で大幅にサイズ削減
2. **ビットレート調整**: 動画の品質を保ちながらサイズを削減
3. **フレームレート**: 60fps → 30fps で約半分のサイズに

## ライセンス

MIT License

## 作成者

AI-powered golf improvement application
