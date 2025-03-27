'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

interface PdfExportProps {
  currentDate: Date;
  title?: string;
}

/**
 * 新しいPDF出力ボタンコンポーネント
 * サーバーサイドで生成するAPIを呼び出す
 */
export function PdfExport({ currentDate, title = 'シフト表' }: PdfExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // サーバーサイドレンダリング防止
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // APIからPDFを生成する関数 - 確実に動作するように
  const generatePdf = async () => {
    if (!isClient || typeof window === 'undefined') {
      toast.error('クライアント環境でのみ使用できます');
      return;
    }
    
    try {
      setIsGenerating(true);
      toast.info('PDFを生成しています...');
      
      // APIにリクエストを送信してPDFを生成
      const response = await fetch('/api/generate-pdf');
      
      if (!response.ok) {
        // エラーレスポンスの場合はJSONとして解析してエラーメッセージを表示
        const errorData = await response.json();
        throw new Error(errorData.error || '予期せぬエラーが発生しました');
      }
      
      // レスポンスの本文をBlobとして取得
      const blob = await response.blob();
      
      // BlobからURLを作成
      const url = window.URL.createObjectURL(blob);
      
      // ダウンロードリンクを作成して自動クリック
      const a = document.createElement('a');
      a.href = url;
      a.download = `勤務管理表_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // クリーンアップ
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('PDFが正常にエクスポートされました');
    } catch (error) {
      console.error('PDFのエクスポートに失敗しました:', error);
      toast.error(`PDF生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <>
      {isClient ? (
        <Button
          onClick={generatePdf}
          variant="outline"
          className="flex items-center gap-2 bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors"
          size="sm"
          disabled={isGenerating}
        >
          <FileText className="h-4 w-4" />
          {isGenerating ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-1" />
              <span>生成中...</span>
            </>
          ) : (
            <span>PDF出力</span>
          )}
        </Button>
      ) : (
        // サーバーサイドレンダリング時はボタンだけ表示
        <Button
          variant="outline"
          className="flex items-center gap-2 bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors"
          size="sm"
          disabled
        >
          <FileText className="h-4 w-4" />
          <span>PDF出力</span>
        </Button>
      )}
    </>
  );
} 