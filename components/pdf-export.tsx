'use client';

import { useState, useRef, useEffect } from 'react';
import { format, getDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { FileText, Image, Download, FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// PDF出力のスタイル設定
const PDF_STYLES = {
  fontSize: 10,
  headerFontSize: 12,
  titleFontSize: 16,
  primary: '#3b82f6', // ブルー
  secondary: '#f97316', // オレンジ
  headerBg: '#f1f5f9',
  borderColor: '#cbd5e1',
  evenRowBg: '#f8fafc',
  oddRowBg: '#ffffff',
  holidayColor: '#ef4444', // 赤色
  saturdayColor: '#3b82f6', // 青色
};

interface PdfExportProps {
  currentDate: Date;
  employees: Array<{ id: number; name: string; given_name?: string }>;
  getShiftValue: (employeeId: number, date: Date) => string;
  title?: string;
}

export function PdfExport({ currentDate, employees, getShiftValue, title = 'シフト表' }: PdfExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'png'>('pdf');
  const [paperSize, setPaperSize] = useState<'a4' | 'a3' | 'a5'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [includeLogo, setIncludeLogo] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [includeFooter, setIncludeFooter] = useState(true);
  const [customTitle, setCustomTitle] = useState(title);
  
  // プレビュー用の要素参照
  const previewRef = useRef<HTMLDivElement>(null);
  
  // 月の日付を取得
  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });
  
  // 土日祝日判定関数
  const isWeekend = (date: Date) => getDay(date) === 0;
  const isSaturday = (date: Date) => getDay(date) === 6;
  
  // 画像としてエクスポート
  const exportAsImage = async () => {
    if (!previewRef.current) return;
    
    try {
      setIsGenerating(true);
      
      // ブラウザ環境チェック
      if (typeof window === 'undefined') {
        throw new Error('ブラウザ環境でのみ使用できます');
      }
      
      const dataUrl = await toPng(previewRef.current, { 
        quality: 1,
        backgroundColor: '#ffffff',
        canvasWidth: paperSize === 'a3' ? 2480 : paperSize === 'a4' ? 1754 : 1240,
        canvasHeight: paperSize === 'a3' ? 3508 : paperSize === 'a4' ? 2480 : 1754,
        style: {
          transform: orientation === 'landscape' ? 'rotate(90deg)' : 'none',
        }
      });
      
      // ダウンロード用のリンク作成
      const link = document.createElement('a');
      link.download = `${customTitle || 'シフト表'}_${format(currentDate, 'yyyy年M月')}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('画像として保存しました');
    } catch (error) {
      console.error('画像のエクスポートに失敗しました:', error);
      toast.error('エクスポートに失敗しました: ' + (error instanceof Error ? error.message : '未知のエラー'));
    } finally {
      setIsGenerating(false);
      setIsOpen(false);
    }
  };
  
  // PDFとしてエクスポート
  const exportAsPdf = () => {
    try {
      setIsGenerating(true);
      
      // ブラウザ環境チェック
      if (typeof window === 'undefined') {
        throw new Error('ブラウザ環境でのみ使用できます');
      }
      
      // PDF設定
      const unit = 'mm';
      const sizes = {
        a3: orientation === 'portrait' ? [297, 420] : [420, 297],
        a4: orientation === 'portrait' ? [210, 297] : [297, 210],
        a5: orientation === 'portrait' ? [148, 210] : [210, 148],
      };
      
      // PDFドキュメント生成 - jsPDF v2.5.1のコンストラクタ形式に合わせる
      const doc = new jsPDF({
        orientation: orientation,
        unit: unit,
        format: paperSize,
      });
      
      // 日本語対応のためのワークアラウンド
      // 実際のプロダクション環境では適切な日本語フォントを組み込む必要があります
      const encodeJapanese = (text: string) => {
        // 日本語文字を「？」に置き換える簡易的な対応
        // 本番環境では適切な日本語フォント設定が必要
        return text.replace(/[^\x00-\x7F]/g, '?');
      };
      
      // ヘッダー
      if (includeHeader) {
        const pageWidth = sizes[paperSize][orientation === 'portrait' ? 0 : 1];
        const headerHeight = 20;
        
        // ロゴ（オプション）
        if (includeLogo) {
          // ロゴの描画（サンプル）
          doc.setFillColor(PDF_STYLES.primary);
          doc.rect(10, 10, 20, 10, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(PDF_STYLES.headerFontSize);
          doc.text('LOGO', 15, 17);
        }
        
        // タイトルと日付
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(PDF_STYLES.titleFontSize);
        
        // タイトルの英語表記（日本語非対応のため）
        const monthText = format(currentDate, 'yyyy-MM');
        doc.text(
          `${encodeJapanese(customTitle)} - ${monthText}`,
          includeLogo ? 40 : 10,
          15
        );
        
        // 会社名（オプション）
        if (companyName) {
          doc.setFontSize(PDF_STYLES.headerFontSize);
          doc.text(encodeJapanese(companyName), pageWidth - 10, 15, { align: 'right' });
        }
        
        doc.setLineWidth(0.3);
        doc.setDrawColor(PDF_STYLES.borderColor);
        doc.line(10, headerHeight, pageWidth - 10, headerHeight);
      }
      
      // テーブルヘッダー行
      const headers = [
        [
          { content: 'Staff', styles: { halign: 'center' as 'center', fillColor: PDF_STYLES.headerBg } },
          ...days.map((day) => ({
            content: `${format(day, 'd')}(${format(day, 'E')})`,
            styles: {
              halign: 'center' as 'center',
              fillColor: PDF_STYLES.headerBg,
              textColor: isWeekend(day) 
                ? PDF_STYLES.holidayColor 
                : isSaturday(day) 
                  ? PDF_STYLES.saturdayColor 
                  : '#000000',
            },
          })),
        ],
      ];
      
      // テーブルデータ行
      const body = employees.map((employee, index) => {
        return [
          // 従業員名
          {
            content: encodeJapanese(`${employee.name}${employee.given_name ? ` ${employee.given_name}` : ''}`),
            styles: { 
              fontStyle: 'bold' as 'bold',
              fillColor: index % 2 === 0 ? PDF_STYLES.evenRowBg : PDF_STYLES.oddRowBg
            },
          },
          // 各日のシフト
          ...days.map((day) => ({
            content: getShiftValue(employee.id, day),
            styles: { 
              halign: 'center' as 'center',
              fillColor: index % 2 === 0 ? PDF_STYLES.evenRowBg : PDF_STYLES.oddRowBg
            },
          })),
        ];
      });
      
      // テーブル生成 - autoTableのシンタックスを確認
      autoTable(doc, {
        head: headers,
        body: body,
        startY: includeHeader ? 25 : 10,
        styles: {
          fontSize: PDF_STYLES.fontSize,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: PDF_STYLES.headerBg,
          textColor: '#000000',
          lineWidth: 0.1,
          lineColor: [203, 213, 225],
        },
        bodyStyles: {
          lineWidth: 0.1,
          lineColor: [203, 213, 225],
        },
        theme: 'grid',
        tableWidth: 'auto',
        margin: { left: 10, right: 10 },
      });
      
      // フッター
      if (includeFooter) {
        const pageWidth = sizes[paperSize][orientation === 'portrait' ? 0 : 1];
        const pageHeight = sizes[paperSize][orientation === 'portrait' ? 1 : 0];
        
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        
        // 現在の日時
        const now = new Date();
        const dateStr = format(now, 'yyyy-MM-dd HH:mm');
        doc.text(`Created: ${dateStr}`, 10, pageHeight - 10);
        
        // ページ番号
        doc.text('1 / 1', pageWidth - 10, pageHeight - 10, { align: 'right' });
      }
      
      // PDFダウンロード
      doc.save(`${customTitle || 'shift-schedule'}_${format(currentDate, 'yyyy-MM')}.pdf`);
      
      toast.success('PDFとして保存しました');
    } catch (error) {
      console.error('PDFのエクスポートに失敗しました:', error);
      toast.error('PDF生成に失敗しました: ' + (error instanceof Error ? error.message : '未知のエラー'));
    } finally {
      setIsGenerating(false);
      setIsOpen(false);
    }
  };
  
  // エクスポート処理
  const handleExport = () => {
    if (exportFormat === 'pdf') {
      exportAsPdf();
    } else {
      exportAsImage();
    }
  };
  
  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="flex items-center gap-2 bg-white hover:bg-blue-50 hover:text-blue-600 transition-colors"
        size="sm"
      >
        <FileText className="h-4 w-4" />
        <span>PDF出力</span>
      </Button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5 text-blue-500" />
              シフト表のエクスポート
            </DialogTitle>
            <DialogDescription>
              シフト表をPDFまたは画像として保存できます。必要な設定を選択してください。
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="settings" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                出力設定
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                プレビュー
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="settings" className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="exportFormat">エクスポート形式</Label>
                    <Select
                      value={exportFormat}
                      onValueChange={(value: 'pdf' | 'png') => setExportFormat(value)}
                    >
                      <SelectTrigger id="exportFormat">
                        <SelectValue placeholder="形式を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf" className="flex items-center gap-2">
                          <FileText className="h-4 w-4 inline-block" />
                          PDF形式
                        </SelectItem>
                        <SelectItem value="png" className="flex items-center gap-2">
                          <Image className="h-4 w-4 inline-block" />
                          画像形式 (PNG)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="paperSize">用紙サイズ</Label>
                    <Select
                      value={paperSize}
                      onValueChange={(value: 'a4' | 'a3' | 'a5') => setPaperSize(value)}
                    >
                      <SelectTrigger id="paperSize">
                        <SelectValue placeholder="サイズを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a3">A3サイズ</SelectItem>
                        <SelectItem value="a4">A4サイズ</SelectItem>
                        <SelectItem value="a5">A5サイズ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="orientation">向き</Label>
                    <Select
                      value={orientation}
                      onValueChange={(value: 'portrait' | 'landscape') => setOrientation(value)}
                    >
                      <SelectTrigger id="orientation">
                        <SelectValue placeholder="向きを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portrait">縦向き</SelectItem>
                        <SelectItem value="landscape">横向き</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">タイトル</Label>
                    <Input
                      id="title"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="タイトルを入力"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="companyName">会社名（オプション）</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="会社名を入力"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="includeHeader" className="cursor-pointer">ヘッダーを含める</Label>
                    <Switch
                      id="includeHeader"
                      checked={includeHeader}
                      onCheckedChange={setIncludeHeader}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="includeLogo" className="cursor-pointer">ロゴを含める</Label>
                    <Switch
                      id="includeLogo"
                      checked={includeLogo}
                      onCheckedChange={setIncludeLogo}
                      disabled={!includeHeader}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="includeFooter" className="cursor-pointer">フッターを含める</Label>
                    <Switch
                      id="includeFooter"
                      checked={includeFooter}
                      onCheckedChange={setIncludeFooter}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="preview" className="py-4">
              <div className="flex justify-center">
                <div
                  ref={previewRef}
                  className={cn(
                    "border rounded-md p-4 bg-white",
                    orientation === 'landscape' ? 'w-[420px] h-[297px]' : 'w-[297px] h-[420px]',
                    paperSize === 'a3' ? 'scale-100' : paperSize === 'a5' ? 'scale-75' : 'scale-90'
                  )}
                  style={{
                    transformOrigin: 'top left',
                    overflow: 'auto',
                  }}
                >
                  {/* プレビューコンテンツ */}
                  {includeHeader && (
                    <div className="mb-4 pb-2 border-b">
                      <div className="flex justify-between items-start">
                        {includeLogo && (
                          <div className="bg-blue-500 text-white h-8 w-16 flex items-center justify-center rounded">
                            LOGO
                          </div>
                        )}
                        <div className={cn("flex-1", includeLogo && "ml-4")}>
                          <h2 className="text-lg font-bold">
                            {customTitle || 'シフト表'} - {format(currentDate, 'yyyy年M月', { locale: ja })}
                          </h2>
                        </div>
                        {companyName && (
                          <div className="text-sm text-right">
                            {companyName}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse border border-slate-300 text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-300 p-1 text-center font-medium">担当者</th>
                          {days.map((day) => (
                            <th
                              key={day.toString()}
                              className={cn(
                                "border border-slate-300 p-1 text-center font-medium text-xs",
                                isWeekend(day) && "text-red-500",
                                isSaturday(day) && "text-blue-500"
                              )}
                            >
                              {format(day, 'd')}({format(day, 'E', { locale: ja })})
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {employees.slice(0, 5).map((employee, index) => (
                          <tr key={employee.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="border border-slate-300 p-1 font-medium text-left whitespace-nowrap">
                              {employee.name}{employee.given_name ? `・${employee.given_name}` : ''}
                            </td>
                            {days.map((day) => (
                              <td key={day.toString()} className="border border-slate-300 p-1 text-center">
                                {getShiftValue(employee.id, day)}
                              </td>
                            ))}
                          </tr>
                        ))}
                        {employees.length > 5 && (
                          <tr>
                            <td colSpan={days.length + 1} className="border border-slate-300 p-1 text-center">
                              ...他 {employees.length - 5} 名
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {includeFooter && (
                    <div className="mt-4 pt-2 text-xs text-slate-500 flex justify-between">
                      <span>作成日時: {format(new Date(), 'yyyy年MM月dd日 HH:mm', { locale: ja })}</span>
                      <span>1 / 1</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={handleExport} 
              disabled={isGenerating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  処理中...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {exportFormat === 'pdf' ? 'PDFをダウンロード' : '画像をダウンロード'}
                </span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 