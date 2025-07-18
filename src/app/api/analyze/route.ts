import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// API Route の設定（Vercel対応）
export const maxDuration = 300; // 5分のタイムアウト（Vercel Pro planで利用可能）
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

    // ファイルサイズチェック（Vercelの実際の制限に合わせて50MBに調整）
    const maxSize = 50 * 1024 * 1024; // 50MB（Vercelの安全な制限）
    const estimatedSize = (videoBase64.length * 3) / 4; // Base64から実際のバイト数を推定

    if (estimatedSize > maxSize) {
      return NextResponse.json(
        { error: '動画ファイルのサイズが50MBを超えています。Vercelの制限により、より小さいファイルをご利用ください。' },
        { status: 413 }
      );
    }

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
    maxFileSize: '50MB (Vercel制限)',
    body: {
      videoBase64: 'string (base64 encoded video data)',
    }
  });
}