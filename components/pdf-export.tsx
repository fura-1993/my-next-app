'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';
import { createBrowserClient } from '@/utils/supabase/client';

interface PdfExportProps {
  currentDate: Date;
  title?: string;
}

/**
 * PDF出力ボタンコンポーネント - クライアントサイドで直接PDF生成を行う
 * サーバーサイドのAPIに依存せず、ブラウザで直接PDFを生成する
 */
export function PdfExport({ currentDate, title = 'シフト表' }: PdfExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // サーバーサイドレンダリング防止
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // クライアントサイドでPDFを生成する関数
  const generatePdf = async () => {
    if (!isClient || typeof window === 'undefined') {
      toast.error('クライアント環境でのみ使用できます');
      return;
    }
    
    try {
      setIsGenerating(true);
      toast.info('PDFを生成しています...');
      
      // jsPDFを動的にインポート（サーバーサイドでのエラー回避）
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      // Supabaseクライアントを取得
      const supabase = createBrowserClient();
      
      // データを取得
      const { data: cells, error: errorCells } = await supabase
        .from('shift_cells')
        .select('*')
        .order('date', { ascending: true });
        
      if (errorCells) throw new Error(`シフトデータの取得に失敗しました: ${errorCells.message}`);
      
      const { data: employees, error: errorEmployees } = await supabase
        .from('employees')
        .select('*');
        
      if (errorEmployees) throw new Error(`従業員データの取得に失敗しました: ${errorEmployees.message}`);
      
      const { data: shiftTypes, error: errorShiftTypes } = await supabase
        .from('shift_types')
        .select('*');
        
      if (errorShiftTypes) throw new Error(`シフトタイプの取得に失敗しました: ${errorShiftTypes.message}`);
      
      // データマッピングの作成
      const employeeMap = new Map();
      employees?.forEach(emp => employeeMap.set(emp.id, emp.name));
      
      const shiftTypeMap = new Map();
      shiftTypes?.forEach(type => shiftTypeMap.set(type.code, { 
        label: type.label, 
        color: type.color,
        hours: type.hours
      }));
      
      // PDF生成
      const doc = new jsPDF({
        orientation: 'landscape', 
        unit: 'mm',
        format: 'a4'
      });
      
      // タイトル
      doc.setFontSize(18);
      doc.text('勤務管理表', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`作成日: ${new Date().toLocaleDateString('ja-JP')}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
      
      // テーブルデータの準備
      const tableData = cells?.map(cell => {
        const date = cell.date ? new Date(cell.date).toLocaleDateString('ja-JP') : 'N/A';
        const employee = employeeMap.get(cell.employee_id) || 'Unknown';
        const shiftInfo = shiftTypeMap.get(cell.shift_code) || { label: cell.shift_code || 'N/A', hours: 'N/A' };
        
        return [date, employee, shiftInfo.label, shiftInfo.hours];
      }) || [];
      
      // テーブルの生成
      autoTable(doc, {
        head: [['日付', '従業員', 'シフト', '勤務時間']],
        body: tableData,
        startY: 30,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240],
        },
      });
      
      // PDFの保存
      doc.save(`勤務管理表_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.pdf`);
      
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