'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { FileDown, Printer, X, Settings, ChevronDown, Loader2 } from 'lucide-react';
import { createBrowserClient } from '@/utils/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

interface PdfExportProps {
  currentDate: Date;
  title?: string;
}

type PdfTemplate = 'simple' | 'detailed';

/**
 * 新世代PDFエクスポートコンポーネント
 * 複数のテンプレートから選択可能な高度なPDF生成ツール
 */
export function PdfExport({ currentDate, title = 'シフト表' }: PdfExportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PdfTemplate>('simple');
  const menuRef = useRef<HTMLDivElement>(null);
  
  // サーバーサイドレンダリング防止
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // メニュー外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // PDFを生成する関数
  const generatePdf = async (template: PdfTemplate = selectedTemplate) => {
    if (!isClient || typeof window === 'undefined') {
      toast.error('クライアント環境でのみ使用できます');
      return;
    }
    
    try {
      setIsGenerating(true);
      setIsMenuOpen(false);
      toast.info(`${template === 'simple' ? 'シンプル' : '詳細'}PDFを生成しています...`);
      
      // jsPDFを動的にインポート
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      // データ取得をキャッシュ付きで最適化
      const supabase = createBrowserClient();
      const startTime = performance.now();
      
      // 並列でデータ取得
      const [cellsResponse, employeesResponse, shiftTypesResponse] = await Promise.all([
        supabase.from('shift_cells').select('*').order('date', { ascending: true }),
        supabase.from('employees').select('*'),
        supabase.from('shift_types').select('*')
      ]);
      
      console.log(`データ取得完了: ${Math.round(performance.now() - startTime)}ms`);
      
      // エラーチェック
      if (cellsResponse.error) throw new Error(`シフトデータの取得に失敗: ${cellsResponse.error.message}`);
      if (employeesResponse.error) throw new Error(`従業員データの取得に失敗: ${employeesResponse.error.message}`);
      if (shiftTypesResponse.error) throw new Error(`シフトタイプの取得に失敗: ${shiftTypesResponse.error.message}`);
      
      const cells = cellsResponse.data;
      const employees = employeesResponse.data;
      const shiftTypes = shiftTypesResponse.data;
      
      // データマッピング
      const employeeMap = new Map();
      employees.forEach(emp => employeeMap.set(emp.id, {
        name: emp.name,
        givenName: emp.given_name || '',
        department: emp.department || '未設定'
      }));
      
      const shiftTypeMap = new Map();
      shiftTypes.forEach(type => shiftTypeMap.set(type.code, { 
        label: type.label, 
        color: type.color,
        hours: type.hours
      }));
      
      // テンプレートに応じたPDF生成
      if (template === 'simple') {
        await generateSimplePdf(jsPDF, autoTable, cells, employeeMap, shiftTypeMap);
      } else {
        await generateDetailedPdf(jsPDF, autoTable, cells, employeeMap, shiftTypeMap);
      }
      
      toast.success('PDFが正常にエクスポートされました');
    } catch (error) {
      console.error('PDFのエクスポートに失敗しました:', error);
      toast.error(`PDF生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // シンプルPDF生成
  const generateSimplePdf = async (jsPDF: any, autoTable: any, cells: any[], employeeMap: Map<any, any>, shiftTypeMap: Map<any, any>) => {
    // PDF初期化 - 横向き
    const doc = new jsPDF({
      orientation: 'landscape', 
      unit: 'mm',
      format: 'a4'
    });
    
    // ヘッダー
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text('シフト管理表', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    // サブヘッダー
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`作成日: ${new Date().toLocaleDateString('ja-JP')}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });
    
    // テーブルデータの準備
    const tableData = cells.map(cell => {
      const date = cell.date ? new Date(cell.date).toLocaleDateString('ja-JP') : 'N/A';
      const employee = employeeMap.get(cell.employee_id)?.name || '不明';
      const shiftInfo = shiftTypeMap.get(cell.shift_code) || { label: cell.shift_code || 'N/A', hours: 'N/A' };
      
      return [date, employee, shiftInfo.label, shiftInfo.hours];
    });
    
    // テーブル生成
    autoTable(doc, {
      head: [['日付', '従業員', 'シフト', '勤務時間']],
      body: tableData,
      startY: 30,
      styles: {
        fontSize: 9,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [240, 240, 240],
      },
      didDrawPage: (data: any) => {
        // フッター
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `${title} - ページ ${doc.getNumberOfPages()}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
    });
    
    // PDF保存
    doc.save(`シフト管理表_シンプル_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.pdf`);
  };
  
  // 詳細PDF生成
  const generateDetailedPdf = async (jsPDF: any, autoTable: any, cells: any[], employeeMap: Map<any, any>, shiftTypeMap: Map<any, any>) => {
    // PDF初期化 - 横向き
    const doc = new jsPDF({
      orientation: 'landscape', 
      unit: 'mm',
      format: 'a4'
    });
    
    // ロゴ（代替としてタイトル）
    doc.setFontSize(24);
    doc.setTextColor(41, 128, 185);
    doc.text('勤務管理システム', doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    
    doc.setDrawColor(41, 128, 185);
    doc.setLineWidth(0.5);
    doc.line(40, 20, doc.internal.pageSize.getWidth() - 40, 20);
    
    // サブヘッダー
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`詳細シフト表`, 40, 30);
    doc.text(`期間: ${currentDate.toLocaleDateString('ja-JP')} 現在`, 40, 37);
    doc.text(`作成日: ${new Date().toLocaleDateString('ja-JP')}`, doc.internal.pageSize.getWidth() - 40, 30, { align: 'right' });
    
    // データを日付ごとにグループ化
    const groupedByDate = cells.reduce((acc: any, cell: any) => {
      const date = cell.date ? new Date(cell.date).toLocaleDateString('ja-JP') : 'N/A';
      if (!acc[date]) acc[date] = [];
      acc[date].push(cell);
      return acc;
    }, {});
    
    // 日付ごとのテーブル作成
    let yPosition = 45;
    const dates = Object.keys(groupedByDate).sort((a, b) => {
      // 日付順にソート
      const dateA = new Date(a.split('/').reverse().join('-'));
      const dateB = new Date(b.split('/').reverse().join('-'));
      return dateA.getTime() - dateB.getTime();
    });
    
    for (const date of dates) {
      // ページチェック
      if (yPosition > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        yPosition = 20;
      }
      
      // 日付ヘッダー
      doc.setFontSize(14);
      doc.setTextColor(44, 62, 80);
      doc.text(`${date} のシフト`, 40, yPosition);
      yPosition += 10;
      
      // テーブルデータ準備
      const tableData = groupedByDate[date].map((cell: any) => {
        const employee = employeeMap.get(cell.employee_id);
        const employeeName = employee?.name || '不明';
        const department = employee?.department || '未設定';
        const shiftInfo = shiftTypeMap.get(cell.shift_code) || { label: cell.shift_code || 'N/A', hours: 'N/A' };
        
        return [employeeName, department, shiftInfo.label, shiftInfo.hours, cell.notes || ''];
      });
      
      // テーブル生成
      autoTable(doc, {
        head: [['従業員名', '部門', 'シフト', '勤務時間', '備考']],
        body: tableData,
        startY: yPosition,
        styles: {
          fontSize: 10,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 50 },
          1: { cellWidth: 40 },
          2: { cellWidth: 30 },
          3: { cellWidth: 30 },
          4: { cellWidth: 'auto' }
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240],
        },
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }
    
    // 統計情報
    doc.addPage();
    doc.setFontSize(18);
    doc.setTextColor(44, 62, 80);
    doc.text('勤務統計情報', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    // 従業員別シフト集計
    const employeeStats: any = {};
    cells.forEach((cell: any) => {
      const employeeId = cell.employee_id;
      const shiftCode = cell.shift_code;
      
      if (!employeeStats[employeeId]) {
        employeeStats[employeeId] = {
          name: employeeMap.get(employeeId)?.name || '不明',
          shifts: {}
        };
      }
      
      if (!employeeStats[employeeId].shifts[shiftCode]) {
        employeeStats[employeeId].shifts[shiftCode] = 0;
      }
      
      employeeStats[employeeId].shifts[shiftCode]++;
    });
    
    // 従業員別統計テーブル
    const statsData = Object.values(employeeStats).map((stat: any) => {
      const shiftsText = Object.entries(stat.shifts)
        .map(([code, count]) => `${code}: ${count}回`)
        .join(', ');
      
      const totalShifts = Object.values(stat.shifts).reduce((sum: any, count: any) => sum + count, 0);
      
      return [stat.name, shiftsText, totalShifts];
    });
    
    autoTable(doc, {
      head: [['従業員名', 'シフト内訳', '合計シフト数']],
      body: statsData,
      startY: 30,
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
      },
    });
    
    // フッター（全ページ）
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `詳細シフト管理表 - ページ ${i} / ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    // PDF保存
    doc.save(`シフト管理表_詳細_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.pdf`);
  };
  
  if (!isClient) {
    return null;
  }
  
  return (
    <div className="relative" ref={menuRef}>
      {/* メインボタン */}
      <motion.button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        disabled={isGenerating}
        className="relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full text-white font-medium 
        bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 
        shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 
        disabled:opacity-70 disabled:cursor-not-allowed"
        aria-label="PDF出力オプション"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>生成中...</span>
          </>
        ) : (
          <>
            <FileDown className="h-5 w-5" />
            <span>PDF出力</span>
            <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </motion.button>
      
      {/* ドロップダウンメニュー */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-50 overflow-hidden border border-gray-100"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            <div className="p-2 border-b border-gray-100 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">エクスポート形式</span>
              <motion.button 
                onClick={() => setIsMenuOpen(false)}
                className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
            <div className="p-2">
              <motion.button
                onClick={() => generatePdf('simple')}
                className="w-full text-left px-4 py-2.5 rounded-md flex items-center gap-3 
                  hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition-colors"
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <FileDown className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-medium">シンプル版</div>
                  <div className="text-xs text-gray-500">基本的なシフト一覧表</div>
                </div>
              </motion.button>
              
              <motion.button
                onClick={() => generatePdf('detailed')}
                className="w-full text-left px-4 py-2.5 rounded-md flex items-center gap-3 
                  hover:bg-blue-50 text-gray-700 hover:text-blue-700 transition-colors mt-1"
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Printer className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-medium">詳細版</div>
                  <div className="text-xs text-gray-500">日付ごとのグループ化と統計情報付き</div>
                </div>
              </motion.button>
              
              <motion.button
                onClick={() => {
                  setIsMenuOpen(false);
                  toast.info('設定画面は開発中です');
                }}
                className="w-full text-left px-4 py-2.5 rounded-md flex items-center gap-3 
                  hover:bg-gray-100 text-gray-700 transition-colors mt-1 border-t border-gray-100 pt-3"
                whileHover={{ x: 5 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Settings className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-medium text-sm">PDF設定</div>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 