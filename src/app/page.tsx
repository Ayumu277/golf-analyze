'use client';

import { useState } from 'react';

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      setAnalysisResult(''); // 新しいファイルが選択されたら結果をクリア
    } else {
      alert('動画ファイルを選択してください。');
    }
  };

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

    try {
      // ファイルサイズチェック（500MB制限）
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (selectedFile.size > maxSize) {
        throw new Error('動画ファイルのサイズが500MBを超えています。より小さいファイルを選択してください。');
      }

      // ファイルをBase64に変換
      console.log('動画ファイルをBase64に変換中... (サイズ:', Math.round(selectedFile.size / 1024 / 1024), 'MB)');
      const videoBase64 = await fileToBase64(selectedFile);

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '解析APIでエラーが発生しました');
      }

      const result = await response.json();

      if (result.success) {
        setAnalysisResult(result.analysis + '\n\n📊 解析されたファイルサイズ: ' + result.fileSize);
      } else {
        throw new Error(result.error || '解析結果の取得に失敗しました');
      }

    } catch (error) {
      console.error('解析エラー:', error);

      let errorMessage = '解析中にエラーが発生しました。';

      if (error instanceof Error) {
        if (error.message.includes('API キー')) {
          errorMessage = 'Gemini API キーが設定されていません。.env.localファイルを確認してください。';
        } else if (error.message.includes('500MB')) {
          errorMessage = error.message;
        } else if (error.message.includes('ネットワーク')) {
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
        } else {
          errorMessage = `エラー: ${error.message}`;
        }
      }

      setAnalysisResult(`❌ ${errorMessage}\n\n詳細については開発者コンソールをご確認ください。`);
    } finally {
      setIsAnalyzing(false);
    }
  };

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
                id="video-upload"
              />
              <label
                htmlFor="video-upload"
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
                  MP4, MOV, AVI などの動画ファイル（最大500MB）
                </p>
              </label>

              {selectedFile && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-green-800 font-medium">
                    ✅ 選択済み: {selectedFile.name}
                  </p>
                  <p className="text-green-600 text-sm">
                    サイズ: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {selectedFile.size > 500 * 1024 * 1024 && (
                    <p className="text-red-600 text-sm mt-1">
                      ⚠️ ファイルサイズが500MBを超えています
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
              disabled={!selectedFile || isAnalyzing || (selectedFile && selectedFile.size > 500 * 1024 * 1024)}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
                !selectedFile || isAnalyzing || (selectedFile && selectedFile.size > 500 * 1024 * 1024)
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
              className={`min-h-[200px] p-4 rounded-lg border-2 ${
                analysisResult
                  ? analysisResult.startsWith('❌')
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              {analysisResult ? (
                <pre className="whitespace-pre-wrap text-gray-800 text-sm leading-relaxed font-sans">
                  {analysisResult}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <svg
                      className="mx-auto h-12 w-12 mb-3"
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
                    <p>Gemini AIの解析結果がここに表示されます</p>
                    <p className="text-sm mt-1">
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
