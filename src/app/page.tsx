'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [showResult, setShowResult] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setAnalysisResult(''); // 新しいファイルが選択されたら結果をクリア
      setShowResult(false);

      // 動画プレビューURLを作成
      const url = URL.createObjectURL(file);
      setVideoPreviewUrl(url);
    } else {
      alert('動画ファイルを選択してください。');
    }
  };

  // コンポーネントのクリーンアップ時にURLを解放
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // ファイルをBase64に変換する関数
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // data:video/mp4;base64, の部分を除去
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('ファイルの読み込みに失敗しました'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      alert('まず動画ファイルを選択してください。');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult('');
    setShowResult(false);

    try {
      // ファイルサイズチェック（Vercelの実際の制限に合わせて30MBに調整）
      const maxSize = 30 * 1024 * 1024; // 30MB（Vercelの安全な制限）
      if (selectedFile.size > maxSize) {
        throw new Error(`動画ファイルのサイズが30MBを超えています（現在: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB）。Vercelの制限により、より小さいファイルを選択してください。`);
      }

      // Base64エンコード後のサイズを事前に計算
      const estimatedBase64Size = Math.ceil(selectedFile.size * 4 / 3);
      const maxBase64Size = 40 * 1024 * 1024; // 40MB（Base64エンコード後の制限）

      if (estimatedBase64Size > maxBase64Size) {
        throw new Error(`Base64エンコード後のサイズが大きすぎます（推定: ${(estimatedBase64Size / 1024 / 1024).toFixed(2)}MB）。より小さい動画ファイルを選択してください。`);
      }

      // ファイルをBase64に変換
      console.log('動画ファイルをBase64に変換中... (サイズ:', Math.round(selectedFile.size / 1024 / 1024), 'MB)');
      const videoBase64 = await fileToBase64(selectedFile);

      console.log('Base64エンコード完了 (エンコード後サイズ:', Math.round(videoBase64.length / 1024 / 1024), 'MB)');

      // Gemini APIに送信
      console.log('Gemini APIに解析リクエストを送信中...');
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoBase64,
        }),
      });

      // HTTPステータスコードを先にチェック
      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('リクエストサイズが大きすぎます。動画ファイルをより小さく圧縮してください（推奨: 20MB以下）。');
        } else if (response.status === 500) {
          throw new Error('サーバーエラーが発生しました。しばらく待ってから再試行してください。');
        } else if (response.status === 400) {
          throw new Error('リクエストが無効です。ファイル形式を確認してください。');
        } else if (response.status === 504) {
          throw new Error('タイムアウトエラーが発生しました。より小さいファイルで再試行してください。');
        } else {
          throw new Error(`HTTPエラー: ${response.status} - サーバーで問題が発生しました。`);
        }
      }

      // レスポンスのContent-Typeを確認
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('サーバーから無効なレスポンスが返されました。');
      }

      const result = await response.json();

      if (result.success) {
        setAnalysisResult(result.analysis + '\n\n📊 解析されたファイルサイズ: ' + result.fileSize);
        // 結果設定後、少し遅延してアニメーション開始
        setTimeout(() => {
          setShowResult(true);
        }, 100);
      } else {
        throw new Error(result.error || '解析結果の取得に失敗しました');
      }

    } catch (error) {
      console.error('解析エラー:', error);

      let errorMessage = '解析中にエラーが発生しました。';

      if (error instanceof Error) {
        if (error.message.includes('API キー')) {
          errorMessage = 'Gemini API キーが設定されていません。環境変数を確認してください。';
        } else if (error.message.includes('30MB') || error.message.includes('ファイルサイズ') || error.message.includes('Base64')) {
          errorMessage = error.message;
        } else if (error.message.includes('リクエストサイズ')) {
          errorMessage = error.message;
        } else if (error.message.includes('タイムアウト')) {
          errorMessage = error.message;
        } else if (error.message.includes('ネットワーク')) {
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
        } else if (error.message.includes('HTTPエラー')) {
          errorMessage = error.message;
        } else if (error.message.includes('無効なレスポンス')) {
          errorMessage = 'サーバーから予期しないレスポンスが返されました。管理者にお問い合わせください。';
        } else {
          errorMessage = `エラー: ${error.message}`;
        }
      }

      setAnalysisResult(`❌ ${errorMessage}\n\n詳細については開発者コンソールをご確認ください。`);
      setTimeout(() => {
        setShowResult(true);
      }, 100);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 結果表示のアニメーション効果
  useEffect(() => {
    if (analysisResult && showResult) {
      const resultElement = document.getElementById('result');
      if (resultElement) {
        resultElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [showResult, analysisResult]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <header className="text-center py-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🏌️ Golf Analyze
          </h1>
          <p className="text-gray-600 text-lg">
            AIでゴルフスイングを解析して上達をサポート
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Powered by Google Gemini AI
          </p>
        </header>

        {/* メインコンテンツ */}
        <main className="space-y-8">
          {/* ファイルアップロードセクション */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              📹 動画をアップロード
            </h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                id="upload"
              />

              {!videoPreviewUrl ? (
                // 動画がない場合のアップロードUI
                <label
                  htmlFor="upload"
                  className="cursor-pointer block"
                >
                  <div className="mb-4">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <p className="text-lg text-gray-600 mb-2">
                    クリックして動画ファイルを選択
                  </p>
                  <p className="text-sm text-gray-500">
                    MP4, MOV, AVI などの動画ファイル（最大30MB推奨）
                  </p>
                </label>
              ) : (
                // 動画がある場合のプレビューUI
                <div className="space-y-4">
                  {/* 動画プレイヤー */}
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <video
                      src={videoPreviewUrl}
                      controls
                      className="w-full max-h-96 object-contain"
                      preload="metadata"
                    >
                      お使いのブラウザは動画の再生をサポートしていません。
                    </video>
                  </div>

                  {/* ファイル情報と再選択ボタン */}
                  <div className="text-center space-y-2">
                    <p className="text-sm text-gray-600">
                      この動画が解析されます。再生して内容を確認してください。
                    </p>
                    <label
                      htmlFor="upload"
                      className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-sm"
                    >
                      📁 別の動画を選択
                    </label>
                  </div>
                </div>
              )}

              {selectedFile && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-green-800 font-medium">
                    ✅ 選択済み: {selectedFile.name}
                  </p>
                  <p className="text-green-600 text-sm">
                    サイズ: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-blue-600 text-xs">
                    推定エンコード後サイズ: {Math.ceil(selectedFile.size * 4 / 3 / 1024 / 1024)} MB
                  </p>
                  {selectedFile.size > 30 * 1024 * 1024 && (
                    <p className="text-red-600 text-sm mt-1">
                      ⚠️ ファイルサイズが30MBを超えています（Vercel制限）
                    </p>
                  )}
                  {Math.ceil(selectedFile.size * 4 / 3) > 40 * 1024 * 1024 && (
                    <p className="text-red-600 text-sm mt-1">
                      ⚠️ エンコード後サイズが40MBを超えています
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 解析ボタンセクション */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              🤖 AI解析
            </h2>
            <button
              id="analyze-button"
              onClick={handleAnalyze}
              disabled={!selectedFile || isAnalyzing || (selectedFile && (selectedFile.size > 30 * 1024 * 1024 || Math.ceil(selectedFile.size * 4 / 3) > 40 * 1024 * 1024))}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
                !selectedFile || isAnalyzing || (selectedFile && (selectedFile.size > 30 * 1024 * 1024 || Math.ceil(selectedFile.size * 4 / 3) > 40 * 1024 * 1024))
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {isAnalyzing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  Gemini AIで解析中...
                </div>
              ) : (
                '🚀 スイング解析を開始'
              )}
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              ※ ファイルサイズが大きい場合、解析に数分かかることがあります
            </p>
          </div>

          {/* 結果表示セクション */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              📊 解析結果
            </h2>
            <div
              id="result"
              className={`min-h-[200px] p-4 rounded-lg border-2 transition-all duration-700 ease-in-out ${
                analysisResult
                  ? analysisResult.startsWith('❌')
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              {isAnalyzing ? (
                /* ローディング表示 */
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-blue-600">
                  <div className="relative">
                    {/* メインローディングスピナー */}
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mb-4"></div>

                    {/* パルス効果 */}
                    <div className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-20"></div>
                  </div>

                  <div className="text-center">
                    <p className="text-lg font-semibold text-blue-700 mb-2">
                      🤖 Gemini AIが動画を解析中...
                    </p>
                    <p className="text-sm text-blue-600 animate-pulse">
                      スイングの詳細な分析を行っています
                    </p>

                    {/* プログレスバー風アニメーション */}
                    <div className="w-64 bg-blue-100 rounded-full h-2 mt-4 mx-auto">
                      <div className="bg-blue-600 h-2 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ) : analysisResult ? (
                /* 結果表示（アニメーション付き） */
                <div
                  className={`transform transition-all duration-700 ease-out ${
                    showResult
                      ? 'translate-y-0 opacity-100 scale-100'
                      : 'translate-y-4 opacity-0 scale-95'
                  }`}
                >
                  <div className="flex items-start space-x-3 mb-3">
                    <div className="flex-shrink-0">
                      {analysisResult.startsWith('❌') ? (
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-red-600 text-lg">❌</span>
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-600 text-lg">✅</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-800 mb-2">
                        {analysisResult.startsWith('❌') ? '解析エラー' : '解析完了！'}
                      </h3>
                    </div>
                  </div>

                  <div className="bg-white bg-opacity-70 rounded-lg p-4 border border-gray-200">
                    <pre className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed font-sans">
                      {analysisResult}
                    </pre>
                  </div>

                  {!analysisResult.startsWith('❌') && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => {
                          setAnalysisResult('');
                          setShowResult(false);
                          setSelectedFile(null);
                          setVideoPreviewUrl(null);
                        }}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        🔄 新しい動画を解析
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* 初期状態 */
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <svg
                      className="mx-auto h-12 w-12 mb-3 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                    <p className="text-lg font-medium text-gray-600">Gemini AIの解析結果がここに表示されます</p>
                    <p className="text-sm mt-1 text-gray-500">
                      動画をアップロードして解析を開始してください
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* フッター */}
        <footer className="text-center py-8 text-gray-500">
          <p>&copy; 2024 Golf Analyze. AI-powered golf improvement.</p>
        </footer>
      </div>
    </div>
  );
}
