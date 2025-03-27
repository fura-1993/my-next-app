'use client';

import { useState, useRef, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PdfExportProps {
  currentDate: Date;
  employees: Array<{
    id: number;
    name: string;
    given_name?: string;
  }>;
  getShiftValue: (employeeId: number, date: Date | string) => string;
  title?: string;
}

export function PdfExport({ currentDate, employees, getShiftValue, title = 'シフト表' }: PdfExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // サーバーサイドレンダリング防止
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // PDFを生成する関数 - 最小構成で確実に動作するように
  const generatePdf = async () => {
    if (!isClient || typeof window === 'undefined') {
      toast.error('クライアント環境でのみ使用できます');
      return;
    }
    
    try {
      setIsGenerating(true);
      
      console.log('PDF生成を開始します...');
      
      // 動的にjsPDFをインポート
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;
      
      // 最もシンプルなPDF設定
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      
      // 最低限の情報だけを表示
      doc.setFontSize(16);
      doc.text(`${title} - ${format(currentDate, 'yyyy-MM')}`, 10, 10);
      
      // シンプルなテーブルを手動で描画
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      // テーブルの開始位置と設定
      const startX = 10;
      let startY = 20;
      const cellWidth = 7;
      const cellHeight = 7;
      const headerCellHeight = 7;
      const nameColumnWidth = 40;
      
      // ヘッダー行 - 日付
      doc.setFillColor(220, 220, 220);
      doc.setDrawColor(0);
      doc.setTextColor(0);
      
      // 名前列のヘッダー
      doc.rect(startX, startY, nameColumnWidth, headerCellHeight, 'FD');
      doc.setFontSize(8);
      doc.text('従業員名', startX + 2, startY + 5);
      
      // 日付のヘッダー
      days.forEach((day, index) => {
        const x = startX + nameColumnWidth + (index * cellWidth);
        // セルの背景と枠線
        doc.rect(x, startY, cellWidth, headerCellHeight, 'FD');
        // 日付テキスト
        doc.setFontSize(8);
        doc.text(format(day, 'd'), x + cellWidth/2, startY + 5, { align: 'center' });
      });
      
      // 従業員データ行
      startY += headerCellHeight;
      
      // 最大10人まで表示（パフォーマンス考慮）
      const displayEmployees = employees.slice(0, 10);
      
      // 各従業員の行
      displayEmployees.forEach((employee, rowIndex) => {
        const y = startY + (rowIndex * cellHeight);
        
        // 名前セル
        doc.setFillColor(245, 245, 245);
        doc.rect(startX, y, nameColumnWidth, cellHeight, 'FD');
        doc.setFontSize(8);
        doc.text(employee.name.substring(0, 15), startX + 2, y + 5); // 名前が長すぎる場合は切り詰め
        
        // 各日のシフト
        days.forEach((day, colIndex) => {
          const x = startX + nameColumnWidth + (colIndex * cellWidth);
          
          // セルの背景（週末は少し暗く）
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
          doc.setFillColor(isWeekend ? 240 : 255, isWeekend ? 240 : 255, isWeekend ? 240 : 255);
          
          // セルの描画
          doc.rect(x, y, cellWidth, cellHeight, 'FD');
          
          // シフト値
          try {
            const shift = getShiftValue(employee.id, day);
            if (shift) {
              doc.setFontSize(6);
              doc.text(shift.substring(0, 2), x + cellWidth/2, y + 4, { align: 'center' });
            }
          } catch (e) {
            // エラーは無視して空セルのまま
          }
        });
      });
      
      // 従業員が多い場合は注記
      if (employees.length > 10) {
        const y = startY + (displayEmployees.length * cellHeight) + 5;
        doc.setFontSize(8);
        doc.text(`※ 表示されている従業員は全体の一部です (${displayEmployees.length}/${employees.length}人)`, startX, y);
      }
      
      // 作成日時のフッター
      doc.setFontSize(8);
      doc.text(`作成日時: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, startX, 200);
      
      // PDFのダウンロード
      const filename = `${title.replace(/[^\x00-\x7F]/g, '_')}_${format(currentDate, 'yyyy-MM')}.pdf`;
      doc.save(filename);
      
      toast.success('PDFが正常にエクスポートされました');
    } catch (error) {
      console.error('PDFのエクスポートに失敗しました:', error);
      // エラーを表示
      toast.error('PDF生成に失敗しました。別の方法をお試しください。');
      
      // フォールバック: シンプルなCSVエクスポート
      try {
        console.log('CSVエクスポートを試みます...');
        await exportAsCsv();
      } catch (csvError) {
        console.error('CSVエクスポートも失敗しました:', csvError);
      }
    } finally {
      setIsGenerating(false);
    }
  };
  
  // フォールバック: CSVファイルとしてエクスポート (最も信頼性の高い方法)
  const exportAsCsv = async () => {
    try {
      // ヘッダー行
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      // CSVヘッダー
      let csvContent = "従業員名,";
      csvContent += days.map(day => format(day, 'yyyy-MM-dd')).join(",");
      csvContent += "\n";
      
      // 各従業員の行
      employees.forEach(employee => {
        csvContent += `"${employee.name}",`;
        
        // 各日のシフト
        csvContent += days.map(day => {
          try {
            const shift = getShiftValue(employee.id, day);
            return shift ? `"${shift}"` : "";
          } catch (e) {
            return "";
          }
        }).join(",");
        
        csvContent += "\n";
      });
      
      // BOMを追加してUTF-8としてエンコード
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // ダウンロードリンクを作成
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${title.replace(/[^\x00-\x7F]/g, '_')}_${format(currentDate, 'yyyy-MM')}.csv`;
      link.click();
      
      toast.success('CSVとしてエクスポートしました (PDFが失敗したため)');
    } catch (csvError) {
      console.error('CSVエクスポートに失敗しました:', csvError);
      toast.error('データのエクスポートに失敗しました');
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