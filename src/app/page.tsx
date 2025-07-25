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
    if (file && isValidVideoFile(file)) {
      setSelectedFile(file);
      setAnalysisResult(''); // 新しいファイルが選択されたら結果をクリア
      setShowResult(false);

      // 動画プレビューURLを作成
      const url = URL.createObjectURL(file);
      setVideoPreviewUrl(url);

      // ファイル形式情報をコンソールに出力
      console.log('選択された動画ファイル:', {
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
        type: file.type,
        detectedMimeType: getVideoMimeType(file)
      });
    } else {
      alert('対応していない動画ファイル形式です。\n\n対応形式：\nMP4, MOV, AVI, MKV, WebM, WMV, FLV, 3GP, M4V, OGV');
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



  // 動画ファイル形式をGemini API対応のmimeTypeに変換する関数
  const getVideoMimeType = (file: File): string => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    // ファイル拡張子から判定
    if (fileName.endsWith('.mp4')) {
      return 'video/mp4';
    } else if (fileName.endsWith('.mov') || fileName.endsWith('.qt')) {
      return 'video/mp4'; // MOVをMP4として送信（Gemini APIの互換性向上）
    } else if (fileName.endsWith('.avi')) {
      return 'video/mp4'; // AVIもMP4として送信
    } else if (fileName.endsWith('.mkv')) {
      return 'video/mp4'; // MKVもMP4として送信
    } else if (fileName.endsWith('.webm')) {
      return 'video/webm'; // WebMはサポートされている場合が多い
    } else if (fileName.endsWith('.wmv')) {
      return 'video/mp4'; // WMVもMP4として送信
    } else if (fileName.endsWith('.flv')) {
      return 'video/mp4'; // FLVもMP4として送信
    } else if (fileName.endsWith('.3gp') || fileName.endsWith('.3gpp')) {
      return 'video/3gpp'; // 3GPPはサポートされている場合がある
    } else if (fileName.endsWith('.m4v')) {
      return 'video/mp4'; // M4VはMP4として送信
    } else if (fileName.endsWith('.ogv')) {
      return 'video/mp4'; // OGVもMP4として送信
    }

    // MIMEタイプから判定
    if (fileType.includes('mp4')) {
      return 'video/mp4';
    } else if (fileType.includes('quicktime') || fileType.includes('mov')) {
      return 'video/mp4'; // QuickTime MOVをMP4として送信
    } else if (fileType.includes('webm')) {
      return 'video/webm';
    } else if (fileType.includes('3gpp')) {
      return 'video/3gpp';
    }

    // デフォルトはMP4（最も互換性が高い）
    return 'video/mp4';
  };

  // 動画ファイル形式をチェックする関数
  const isValidVideoFile = (file: File): boolean => {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    // 対応している拡張子
    const supportedExtensions = [
      '.mp4', '.mov', '.qt', '.avi', '.mkv', '.webm',
      '.wmv', '.flv', '.3gp', '.3gpp', '.m4v', '.ogv'
    ];

    // 対応しているMIMEタイプ
    const supportedMimeTypes = [
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'video/x-matroska', 'video/webm', 'video/x-ms-wmv',
      'video/x-flv', 'video/3gpp', 'video/x-m4v'
    ];

    // 拡張子チェック
    const hasValidExtension = supportedExtensions.some(ext => fileName.endsWith(ext));

    // MIMEタイプチェック（ブラウザが認識した場合）
    const hasValidMimeType = fileType.startsWith('video/') ||
                            supportedMimeTypes.some(mime => fileType.includes(mime));

    return hasValidExtension || hasValidMimeType;
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
      // FormDataを作成してファイルを送信
      const formData = new FormData();
      formData.append('file', selectedFile);

      console.log('🚀 解析開始:', {
        name: selectedFile.name,
        size: `${(selectedFile.size / 1024 / 1024).toFixed(2)}MB`,
        type: selectedFile.type
      });

      const response = await fetch('/api/analyze-file', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `サーバーエラー: ${response.status}`);
      }

      if (data.success) {
        setAnalysisResult(data.analysis);
        setShowResult(true);
        console.log('✅ 解析完了:', data.fileInfo);
      } else {
        throw new Error(data.error || '解析に失敗しました');
      }

    } catch (error) {
      console.error('解析エラー:', error);

      const errorMessage = error instanceof Error ? error.message : '解析中にエラーが発生しました。';
      setAnalysisResult(`❌ ${errorMessage}`);
      setShowResult(true);
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
                accept="video/*,.mp4,.mov,.qt,.avi,.mkv,.webm,.wmv,.flv,.3gp,.3gpp,.m4v,.ogv"
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
                    対応形式：MP4, MOV, AVI, MKV, WebM, WMV, FLV, 3GP, M4V, OGV
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    最大2GB対応・iPhone MOVファイル対応
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
                  <p className="text-purple-600 text-xs">
                    ファイル形式: {selectedFile.type || '不明'} → {getVideoMimeType(selectedFile)}
                  </p>
                  <p className="text-blue-600 text-xs">
                    処理方法: {selectedFile.size <= 20 * 1024 * 1024 ? 'Base64形式（20MB以下）' : 'Files API（20MB超）'}
                  </p>
                  {selectedFile.size > 2 * 1024 * 1024 * 1024 && (
                    <p className="text-red-600 text-sm mt-1">
                      ⚠️ ファイルサイズが2GBを超えています
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
              disabled={!selectedFile || isAnalyzing || (selectedFile && selectedFile.size > 2 * 1024 * 1024 * 1024)}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all ${
                !selectedFile || isAnalyzing || (selectedFile && selectedFile.size > 2 * 1024 * 1024 * 1024)
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
