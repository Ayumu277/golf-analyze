# Golf Analyze 🏌️

AIでゴルフスイングを解析して上達をサポートするウェブアプリケーションです。

## 技術スタック

- **Next.js 14** - App Router使用
- **TypeScript** - 型安全性
- **Tailwind CSS** - スタイリング
- **PWA対応** - オフライン使用可能
- **Playwright MCP** - 自動デモ対応
- **Google Gemini AI** - 動画解析エンジン

## 特徴

- 📱 **PWA対応**: モバイルデバイスにインストール可能
- 🎥 **動画アップロード**: ゴルフスイング動画をドラッグ&ドロップ（最大500MB）
- 🤖 **AI解析**: Gemini AIによる詳細なスイング分析とアドバイス
- 📊 **結果表示**: わかりやすい解析結果
- 🎯 **Playwright MCP対応**: 自動デモ機能

## Playwright MCP 自動デモ要素

以下のIDとセレクターが自動デモで使用可能です：

- `input[type="file"]` - 動画ファイルアップロード
- `#analyze-button` - 解析開始ボタン
- `#result` - AI解析結果表示エリア

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

プロジェクトルートに `.env.local` ファイルを作成し、Gemini API キーを設定：

```bash
# .env.local
GEMINI_API_KEY=your_gemini_api_key_here
```

**Gemini API キーの取得方法:**
1. [Google AI Studio](https://makersuite.google.com/app/apikey) にアクセス
2. Googleアカウントでログイン
3. 「Create API Key」をクリック
4. 生成されたキーを `.env.local` に設定

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
   - MP4, MOV, AVI などの動画ファイルに対応（最大500MB）

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
- 最大ファイルサイズ: 500MB
- タイムアウト: 5分
- 対応フォーマット: MP4, MOV, AVI 等

## Playwright MCP デモスクリプト例

```javascript
// ファイルアップロード
await page.setInputFiles('input[type="file"]', 'sample-golf-video.mp4');

// 解析開始
await page.click('#analyze-button');

// 結果待機（最大5分）
await page.waitForSelector('#result:not(:empty)', { timeout: 300000 });

// 結果内容確認
const result = await page.textContent('#result');
console.log('解析結果:', result);
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
├── next.config.mjs         # Next.js + PWA設定
└── package.json           # 依存関係
```

## 開発ポイント

- **PWA設定**: `next.config.mjs`でnext-pwaを設定済み
- **TypeScript**: 型安全性のため全ファイルで使用
- **Tailwind CSS**: レスポンシブデザイン対応
- **App Router**: Next.js 14の最新ルーティング
- **Gemini AI**: 動画解析にGoogle Gemini 1.5 Flashを使用
- **大容量ファイル対応**: 最大500MBまでの動画ファイルに対応

## トラブルシューティング

### よくある問題

1. **「Gemini API キーが設定されていません」エラー**
   - `.env.local` ファイルが正しく作成されているか確認
   - API キーが正しく設定されているか確認
   - 開発サーバーを再起動

2. **「動画ファイルのサイズが500MBを超えています」エラー**
   - より小さい動画ファイルを使用
   - 動画圧縮ツールを使用してファイルサイズを削減

3. **解析が遅い・タイムアウトする**
   - 大きなファイル（100MB以上）は解析に数分かかる場合があります
   - ネットワーク接続を確認
   - ファイルサイズを可能な限り小さくする（推奨: 50MB以下）

4. **メモリ不足エラー**
   - 非常に大きなファイル（300MB以上）はメモリ不足を起こす可能性があります
   - ブラウザを再起動してメモリをクリア
   - より小さいファイルサイズを使用

## パフォーマンス最適化

### 推奨事項
- **ファイルサイズ**: 50MB以下を推奨（解析速度向上のため）
- **動画時間**: 30秒〜2分程度を推奨
- **解像度**: 1080p以下を推奨
- **フォーマット**: MP4形式を推奨（圧縮率が高い）

## ライセンス

MIT License

## 作成者

AI-powered golf improvement application
