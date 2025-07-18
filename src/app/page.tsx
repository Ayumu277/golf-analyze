'use client';

import { useState, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
      // API キーの確認
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API キーが設定されていません。環境変数 NEXT_PUBLIC_GEMINI_API_KEY を確認してください。');
      }

      // ファイルサイズチェック
      const maxSize = 30 * 1024 * 1024; // 30MB
      if (selectedFile.size > maxSize) {
        throw new Error(`動画ファイルのサイズが30MBを超えています（現在: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB）。より小さいファイルを選択してください。`);
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

      // Gemini AI クライアントの初期化
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // プロンプトの定義
      const prompt = `以下のゴルフスイング動画を見て、プレイヤーが今後より良いゴルフをするための、建設的で具体的なアドバイスを日本語で出力してください。

---
【スイング分析】
このスイングの特徴と改善すべき点を、身体の使い方・クラブの動き・タイミングなどの観点から具体的に述べてください。ボールの方向性や飛距離に加えて、安定性・再現性・テンポなども含めてください。

【改善アドバイス】
プレイヤーが意識すべき重要な3〜5点を挙げ、それぞれ「なぜそれが重要なのか」「どうすれば改善できるのか」をシンプルに説明してください。抽象的な表現は避け、本人が実践できるような行動ベースのアドバイスを重視してください。

【補足】
すべての表現は前向きかつ尊重のあるトーンで書いてください。相手はゴルフをもっと上達させたいと願うプレイヤーであり、改善へのモチベーションを高められるような温かく誠実なフィードバックを心がけてください。`;

      // 動画データの準備
      const videoPart = {
        inlineData: {
          data: videoBase64,
          mimeType: getVideoMimeType(selectedFile),
        },
      };

      // 5分間のタイムアウト設定付きでGemini APIに送信
      console.log('Gemini APIに解析リクエストを送信中...');
      const startTime = Date.now();

      // タイムアウト処理のPromiseを作成（5分 = 300秒）
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT_5_MINUTES'));
        }, 300000); // 5分 = 300,000ms
      });

      // Gemini API呼び出しのPromiseとタイムアウトをレース
      const result = await Promise.race([
        model.generateContent([prompt, videoPart]),
        timeoutPromise
      ]);

      const response = await result.response;
      const analysisText = response.text();
      const endTime = Date.now();

      console.log(`解析完了 (処理時間: ${(endTime - startTime) / 1000}s)`);

      // 結果を表示
      const processingTime = `${(endTime - startTime) / 1000}s`;
      const fileSize = `${Math.round(selectedFile.size / 1024 / 1024)}MB`;

      setAnalysisResult(analysisText + `\n\n📊 解析されたファイルサイズ: ${fileSize}\n⏱️ 処理時間: ${processingTime}`);

      // 結果設定後、少し遅延してアニメーション開始
      setTimeout(() => {
        setShowResult(true);
      }, 100);

    } catch (error) {
      console.error('解析エラー:', error);

      let errorMessage = '解析中にエラーが発生しました。';

      if (error instanceof Error) {
        if (error.message === 'TIMEOUT_5_MINUTES') {
          errorMessage = '解析がタイムアウトしました（5分経過）。\n\n以下をお試しください：\n• より小さいファイルサイズの動画を使用\n• 動画の長さを短くする（30秒以内推奨）\n• しばらく時間をおいてから再試行';
        } else if (error.message.includes('API キー') || error.message.includes('NEXT_PUBLIC_GEMINI_API_KEY')) {
          errorMessage = 'Gemini API キーが設定されていません。環境変数 NEXT_PUBLIC_GEMINI_API_KEY を確認してください。';
        } else if (error.message.includes('30MB') || error.message.includes('ファイルサイズ') || error.message.includes('Base64')) {
          errorMessage = error.message;
        } else if (error.message.includes('CORS')) {
          errorMessage = 'CORS エラーが発生しました。ブラウザのセキュリティ設定またはネットワーク環境を確認してください。';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'ネットワークタイムアウトエラーが発生しました。より小さいファイルで再試行してください。';
        } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
          errorMessage = 'API使用量制限に達しました。しばらく待ってから再試行してください。';
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
                    最大30MB推奨・iPhone MOVファイル対応
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
                    推定エンコード後サイズ: {Math.ceil(selectedFile.size * 4 / 3 / 1024 / 1024)} MB
                  </p>
                  {selectedFile.size > 30 * 1024 * 1024 && (
                    <p className="text-red-600 text-sm mt-1">
                      ⚠️ ファイルサイズが30MBを超えています
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
              ※ ファイルサイズが大きい場合、解析に数分かかることがあります（最大5分でタイムアウト）
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
                    <p className="text-xs text-blue-500 mt-2">
                      最大5分間のタイムアウト設定済み
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
