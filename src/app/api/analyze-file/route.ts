import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

// Geminiの制限に従った設定
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const GEMINI_BASE64_LIMIT = 20 * 1024 * 1024; // 20MB（Geminiの絶対制限）

// 待機処理のためのヘルパー関数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
    const tempDir = os.tmpdir();
    let tempFilePath = '';
    let uploadedFileForDeletion: { name?: string } | null = null;

    // ★修正1: apiKeyを関数のトップレベルで宣言
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('NEXT_PUBLIC_GEMINI_API_KEYが設定されていません。');
    }

    try {
        console.log('🏌️ ゴルフスイング動画解析リクエスト開始');
        console.log(`⏰ 開始時刻: ${new Date().toLocaleString('ja-JP')}`);

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'ファイルが提供されていません' }, { status: 400 });
        }

        const fileSize = file.size;
        const fileSizeMB = fileSize / (1024 * 1024);
        console.log(`📁 ファイル受信: ${file.name}, サイズ: ${fileSizeMB.toFixed(1)}MB, タイプ: ${file.type}`);

        if (fileSize > MAX_FILE_SIZE) {
            return NextResponse.json({ error: `ファイルサイズが制限を超えています（最大2GB）` }, { status: 413 });
        }

        const fileId = crypto.randomUUID();
        tempFilePath = path.join(tempDir, `${fileId}_${file.name}`);
        const bytes = await file.arrayBuffer();
        await fs.writeFile(tempFilePath, Buffer.from(bytes));
        console.log(`💾 一時ファイル保存完了: ${tempFilePath}`);

        const genAI = new GoogleGenerativeAI(apiKey);
        const fileClient = new GoogleGenAI({ apiKey });

        const prompt = `この動画はゴルフスイングの動画です。以下の観点から詳細に分析し、日本語で回答してください：
1. **スイングフォーム分析**: アドレス、バックスイング、ダウンスイング、インパクト、フォロースルー
2. **改善ポイント**: 発見された問題点と具体的な改善提案
3. **技術的評価**: スイングプレーン、体重移動、クラブヘッドの軌道
4. **総合評価**: スイングの良い点と優先的に改善すべき点`;

        let result;

        if (fileSize <= GEMINI_BASE64_LIMIT) {
            console.log('📊 20MB以下 → Base64形式で処理');
            const processedBuffer = await fs.readFile(tempFilePath);
            const base64Data = processedBuffer.toString('base64');
            const mimeType = file.type || 'video/quicktime';
            console.log(`✅ Base64準備完了: ${mimeType}`);

            result = await executeGeminiAnalysis(genAI, [
                { text: prompt },
                { inlineData: { mimeType, data: base64Data } }
            ], 'Base64');
        } else {
            console.log('🎬 20MB超え → Files API使用');

            let uploadedFile = await fileClient.files.upload({
                file: tempFilePath,
                config: { mimeType: file.type || 'video/quicktime' }
            });
            console.log(`✅ Files APIアップロード完了: ${uploadedFile.uri}`);
            uploadedFileForDeletion = uploadedFile;

            if (!uploadedFile.name) {
                throw new Error('アップロードされたファイルの名前が取得できませんでした。');
            }

            console.log('⏳ ファイルの処理待機中...');
            let attempts = 0;
            while (uploadedFile.state === 'PROCESSING' && attempts < 10) {
                await delay(5000);
                // ★修正2: ループ内でnameが存在することを保証
                if (!uploadedFile.name) {
                    throw new Error('処理中にファイル名が失われました。');
                }
                uploadedFile = await fileClient.files.get({ name: uploadedFile.name });
                console.log(`   ...現在の状態: ${uploadedFile.state}`);
                attempts++;
            }

            if (uploadedFile.state !== 'ACTIVE') {
                console.error('File processing failed with error:', uploadedFile.error);
                throw new Error(`ファイルの処理が完了しませんでした。状態: ${uploadedFile.state}`);
            }
            console.log('✅ ファイルがACTIVEになりました！');

            if (!uploadedFile.mimeType || !uploadedFile.uri) {
                throw new Error('処理済みファイルのMIMEタイプまたはURIが取得できませんでした。');
            }

            result = await executeGeminiAnalysis(genAI, [
                { text: prompt },
                { fileData: { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.uri } }
            ], 'Files API');
        }

        return NextResponse.json({
            success: true,
            analysis: result,
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error) || '不明なエラー';
        console.error('❌ ゴルフスイング解析エラー:', errorMessage);
        return NextResponse.json({ error: `解析に失敗しました: ${errorMessage}` }, { status: 500 });

    } finally {
        try {
            if (uploadedFileForDeletion?.name) {
                const fileClient = new GoogleGenAI({ apiKey });
                await fileClient.files.delete({ name: uploadedFileForDeletion.name });
                console.log('🗑️ Files API: アップロードファイル削除完了');
            }
            if (tempFilePath && await fs.stat(tempFilePath).catch(() => false)) {
                await fs.unlink(tempFilePath);
                console.log(`🗑️ 一時ファイル削除: ${path.basename(tempFilePath)}`);
            }
            console.log('✅ クリーンアップ完了');
        } catch (cleanupError) {
            console.error('❌ クリーンアップエラー:', cleanupError);
        }
    }
}

async function executeGeminiAnalysis(genAI: GoogleGenerativeAI, parts: Part[], method: string): Promise<string> {
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
    });

    try {
        console.log(`🚀 Gemini AI ${model.model}で解析開始... (${method})`);
        const result = await model.generateContent({ contents: [{ role: "user", parts }] });
        return result.response.text();
    } catch (error) {
        console.warn(`❌ ${model.model}モデル失敗:`, error);

        const proModel = genAI.getGenerativeModel({
            model: "gemini-1.5-pro",
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
        });
        console.log(`🔄 Pro モデル試行...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const result = await proModel.generateContent({ contents: [{ role: "user", parts }] });
            return result.response.text();
        } catch(proError) {
            console.error('❌ Proモデルも失敗:', proError);
            throw proError;
        }
    }
}