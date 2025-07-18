import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// API Route の設定（500MBまでのリクエストボディを許可）
export const maxDuration = 300; // 5分のタイムアウト（大きなファイル処理のため）
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // APIキーの確認
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API キーが設定されていません' },
        { status: 500 }
      );
    }

    // リクエストボディの取得
    const body = await request.json();
    const { videoBase64 } = body;

    if (!videoBase64) {
      return NextResponse.json(
        { error: '動画データが提供されていません' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック（Base64データから推定）
    const maxSize = 500 * 1024 * 1024; // 500MB
    const estimatedSize = (videoBase64.length * 3) / 4; // Base64から実際のバイト数を推定

    if (estimatedSize > maxSize) {
      return NextResponse.json(
        { error: '動画ファイルのサイズが500MBを超えています' },
        { status: 413 }
      );
    }

    // Gemini AI クライアントの初期化
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // プロンプトの定義
    const prompt = 'このゴルフスイングを見て、フォームの良し悪し・改善点・評価を日本語で簡潔にアドバイスしてください。';

    // 動画データの準備
    const videoPart = {
      inlineData: {
        data: videoBase64,
        mimeType: 'video/mp4', // 必要に応じて動的に設定
      },
    };

    // Gemini APIに送信
    console.log('Gemini APIに動画解析を送信中... (推定サイズ:', Math.round(estimatedSize / 1024 / 1024), 'MB)');
    const result = await model.generateContent([prompt, videoPart]);
    const response = await result.response;
    const analysisText = response.text();

    console.log('解析完了:', analysisText.substring(0, 100) + '...');

    // 結果をJSONで返却
    return NextResponse.json({
      success: true,
      analysis: analysisText,
      timestamp: new Date().toISOString(),
      fileSize: Math.round(estimatedSize / 1024 / 1024) + 'MB',
    });

  } catch (error) {
    console.error('Gemini API エラー:', error);

    // エラーの詳細をログに出力
    if (error instanceof Error) {
      console.error('エラーメッセージ:', error.message);
      console.error('スタックトレース:', error.stack);
    }

    return NextResponse.json(
      {
        error: '動画解析中にエラーが発生しました',
        details: error instanceof Error ? error.message : '不明なエラー'
      },
      { status: 500 }
    );
  }
}

// GETリクエストへの対応（オプション）
export async function GET() {
  return NextResponse.json({
    message: 'Golf Analyze API - POST /api/analyze にbase64動画を送信してください',
    endpoint: '/api/analyze',
    method: 'POST',
    maxFileSize: '500MB',
    body: {
      videoBase64: 'string (base64 encoded video data)',
    }
  });
}