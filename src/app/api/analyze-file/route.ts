import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

// 型定義
interface GolfAnalysisRequest {
    file: File;
    fileSize: number;
    fileSizeMB: number;
}

interface GolfAnalysisResponse {
    success: boolean;
    analysis?: string;
    error?: string;
    fileInfo?: {
        originalName: string;
        originalSize: string;
        processingTime: string;
        method: string;
    };
}

interface UploadedFile {
    name?: string;
    uri?: string;
    mimeType?: string;
    state?: string;
    error?: unknown;
}

// 定数
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const GEMINI_BASE64_LIMIT = 20 * 1024 * 1024; // 20MB（Geminiの絶対制限）
const PROCESSING_MAX_ATTEMPTS = 10;
const PROCESSING_DELAY = 5000; // 5秒

// 待機処理のためのヘルパー関数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// プロンプト定義
const GOLF_ANALYSIS_PROMPT = `この動画はゴルフスイングの動画です。以下の観点から詳細に分析し、日本語で回答してください：

1. **スイングフォーム分析**: アドレス、バックスイング、ダウンスイング、インパクト、フォロースルー
2. **テンポとリズム**: スイングのテンポ、切り返しのタイミング
3. **体重移動**: 左右の体重移動の流れ
4. **軸の安定性**: 頭の位置、体の軸のブレ
5. **クラブパス**: スイング軌道の確認
6. **フィニッシュ**: バランスの良いフィニッシュポジション
7. **改善提案**: 具体的な改善点とアドバイス

**重要**: 動画から実際に観察できる内容のみを分析し、推測は避けてください。観察できない部分は「確認できません」と記載してください。`;

export async function POST(request: NextRequest) {
    const tempDir = os.tmpdir();
    let tempFilePath = '';
    let uploadedFileForDeletion: UploadedFile | null = null;
    const startTime = Date.now();

    // API Key validation
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    console.log('🔑 API Key確認:', {
        exists: !!apiKey,
        length: apiKey?.length || 0,
        prefix: apiKey?.substring(0, 10) || 'なし'
    });
    
    if (!apiKey) {
        console.error('❌ API Key未設定');
        return NextResponse.json(
            { error: 'NEXT_PUBLIC_GEMINI_API_KEYが設定されていません。' },
            { status: 500 }
        );
    }

    try {
        console.log('🏌️ ゴルフスイング動画解析リクエスト開始');
        console.log(`⏰ 開始時刻: ${new Date().toLocaleString('ja-JP')}`);

        // ファイル受信と検証
        console.log('🔄 ファイル受信開始');
        const requestData = await validateAndExtractFile(request);
        const { file, fileSize, fileSizeMB } = requestData;

        console.log(`📁 受信ファイル: ${file.name} (${fileSizeMB.toFixed(1)}MB)`);
        console.log(`📊 ファイル詳細:`, {
            size: fileSize,
            type: file.type,
            lastModified: file.lastModified,
            isBase64Route: fileSize <= GEMINI_BASE64_LIMIT
        });

        // 一時ファイル保存
        console.log('🔄 一時ファイル保存開始');
        tempFilePath = await saveTemporaryFile(file, tempDir);
        console.log(`💾 一時ファイル保存完了: ${tempFilePath}`);

        // Gemini API初期化
        const genAI = new GoogleGenerativeAI(apiKey);
        const fileClient = new GoogleGenAI({ apiKey });

        let analysisResult: string;

        if (fileSize <= GEMINI_BASE64_LIMIT) {
            // 20MB以下 → Base64形式で処理
            analysisResult = await processWithBase64(genAI, tempFilePath, file.type);
        } else {
            // 20MB超 → Files API使用
            const uploadedFile = await uploadFileWithFilesAPI(fileClient, tempFilePath, file);
            uploadedFileForDeletion = uploadedFile;
            analysisResult = await processWithFilesAPI(genAI, uploadedFile);
        }

        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('🎉 解析完了！');
        console.log(`⏱️ 総処理時間: ${processingTime}秒`);

        const response: GolfAnalysisResponse = {
            success: true,
            analysis: analysisResult,
            fileInfo: {
                originalName: file.name,
                originalSize: `${fileSizeMB.toFixed(1)}MB`,
                processingTime: `${processingTime}秒`,
                method: fileSize <= GEMINI_BASE64_LIMIT ? 'Base64' : 'Files API'
            }
        };

        return NextResponse.json(response);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorStack = error instanceof Error ? error.stack : 'No stack trace';
        
        console.error('❌ ゴルフスイング解析エラー:', {
            message: errorMessage,
            stack: errorStack,
            error: error
        });

        const errorResponse: GolfAnalysisResponse = {
            success: false,
            error: `解析に失敗しました: ${errorMessage}`
        };

        return NextResponse.json(errorResponse, { status: 500 });

    } finally {
        await cleanup(tempFilePath, uploadedFileForDeletion, apiKey);
    }
}

// ファイル受信と検証
async function validateAndExtractFile(request: NextRequest): Promise<GolfAnalysisRequest> {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
        throw new Error('ファイルが選択されていません。');
    }

    const fileSize = file.size;
    const fileSizeMB = fileSize / 1024 / 1024;

    if (fileSize > MAX_FILE_SIZE) {
        throw new Error(`ファイルサイズが制限(2GB)を超えています: ${fileSizeMB.toFixed(1)}MB`);
    }

    return { file, fileSize, fileSizeMB };
}

// 一時ファイル保存
async function saveTemporaryFile(file: File, tempDir: string): Promise<string> {
    const fileId = crypto.randomUUID();
    const tempFilePath = path.join(tempDir, `${fileId}_${file.name}`);
    const bytes = await file.arrayBuffer();
    await fs.writeFile(tempFilePath, Buffer.from(bytes));
    return tempFilePath;
}

// Base64形式での処理
async function processWithBase64(genAI: GoogleGenerativeAI, tempFilePath: string, fileType?: string): Promise<string> {
    console.log('📊 20MB以下 → Base64形式で処理');

    try {
        console.log('🔄 ファイル読み込み開始');
        const processedBuffer = await fs.readFile(tempFilePath);
        console.log(`📏 ファイルバッファサイズ: ${processedBuffer.length} bytes`);
        
        console.log('🔄 Base64変換開始');
        const base64Data = processedBuffer.toString('base64');
        console.log(`📏 Base64データサイズ: ${base64Data.length} chars`);
        
        const mimeType = fileType || 'video/quicktime';
        console.log(`✅ Base64準備完了: ${mimeType}`);

        console.log('🔄 Gemini API呼び出し開始');
        return await executeGeminiAnalysis(genAI, [
            { text: GOLF_ANALYSIS_PROMPT },
            { inlineData: { mimeType, data: base64Data } }
        ], 'Base64');
        
    } catch (error) {
        console.error('❌ Base64処理エラー:', error);
        throw error;
    }
}

// Files API使用でのファイルアップロード
async function uploadFileWithFilesAPI(fileClient: GoogleGenAI, tempFilePath: string, file: File): Promise<UploadedFile> {
    console.log('🎬 20MB超 → Files API使用');

    const uploadedFile = await fileClient.files.upload({
        file: tempFilePath,
        config: { mimeType: file.type || 'video/quicktime' }
    });

    console.log(`✅ Files APIアップロード完了: ${uploadedFile.uri}`);

    if (!uploadedFile.name) {
        throw new Error('アップロードされたファイルの名前が取得できませんでした。');
    }

    // ファイル処理完了まで待機
    await waitForFileProcessing(fileClient, uploadedFile);

    return uploadedFile;
}

// ファイル処理完了待機
async function waitForFileProcessing(fileClient: GoogleGenAI, uploadedFile: UploadedFile): Promise<void> {
    console.log('⏳ ファイルの処理待機中...');

    let attempts = 0;
    let currentFile = uploadedFile;

    while (currentFile.state === 'PROCESSING' && attempts < PROCESSING_MAX_ATTEMPTS) {
        await delay(PROCESSING_DELAY);

        if (!currentFile.name) {
            throw new Error('処理中にファイル名が失われました。');
        }

        currentFile = await fileClient.files.get({ name: currentFile.name });
        console.log(`   ...現在の状態: ${currentFile.state}`);
        attempts++;

        // uploadedFileオブジェクトを更新
        Object.assign(uploadedFile, currentFile);
    }

    if (currentFile.state !== 'ACTIVE') {
        console.error('File processing failed with error:', currentFile.error);
        throw new Error(`ファイルの処理が完了しませんでした。状態: ${currentFile.state}`);
    }

    console.log('✅ ファイルがACTIVEになりました！');
}

// Files API使用での解析
async function processWithFilesAPI(genAI: GoogleGenerativeAI, uploadedFile: UploadedFile): Promise<string> {
    if (!uploadedFile.mimeType || !uploadedFile.uri) {
        throw new Error('処理済みファイルのMIMEタイプまたはURIが取得できませんでした。');
    }

    return await executeGeminiAnalysis(genAI, [
        { text: GOLF_ANALYSIS_PROMPT },
        { fileData: { mimeType: uploadedFile.mimeType, fileUri: uploadedFile.uri } }
    ], 'Files API');
}

// Gemini解析実行関数（フォールバック付き）
async function executeGeminiAnalysis(genAI: GoogleGenerativeAI, parts: Part[], method: string): Promise<string> {
    console.log(`🔄 Gemini解析準備 (${method}):`, {
        partsCount: parts.length,
        hasTextPart: parts.some(p => 'text' in p),
        hasMediaPart: parts.some(p => 'inlineData' in p || 'fileData' in p)
    });

    // Flash モデル試行
    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
        });

        console.log(`🚀 Gemini AI Flash で解析開始... (${method})`);
        const result = await model.generateContent({ contents: [{ role: "user", parts }] });
        console.log('✅ Flash解析成功！');
        return result.response.text();

    } catch (flashError) {
        console.warn(`❌ Flashモデル失敗:`, flashError);

        // Pro モデルフォールバック
        try {
            const proModel = genAI.getGenerativeModel({
                model: "gemini-1.5-pro",
                generationConfig: { maxOutputTokens: 8192, temperature: 0.7 }
            });

            console.log(`🔄 Pro モデル試行...`);
            await delay(2000); // レート制限対策

            const result = await proModel.generateContent({ contents: [{ role: "user", parts }] });
            console.log('✅ Pro解析成功！');
            return result.response.text();

        } catch (proError) {
            console.error('❌ Proモデルも失敗:', proError);
            throw proError;
        }
    }
}

// クリーンアップ処理
async function cleanup(tempFilePath: string, uploadedFile: UploadedFile | null, apiKey: string): Promise<void> {
    try {
        // Files APIアップロードファイル削除
        if (uploadedFile?.name) {
            const fileClient = new GoogleGenAI({ apiKey });
            await fileClient.files.delete({ name: uploadedFile.name });
            console.log('🗑️ Files API: アップロードファイル削除完了');
        }

        // 一時ファイル削除
        if (tempFilePath && await fs.stat(tempFilePath).catch(() => false)) {
            await fs.unlink(tempFilePath);
            console.log(`🗑️ 一時ファイル削除: ${path.basename(tempFilePath)}`);
        }

        console.log('✅ クリーンアップ完了');
    } catch (cleanupError) {
        console.error('❌ クリーンアップエラー:', cleanupError);
    }
}