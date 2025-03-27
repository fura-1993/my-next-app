'use client';

import { useState, useRef, useEffect } from 'react';
import { format, getDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
// PDF関連のライブラリはクライアントサイドでのみ動的にインポート

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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Image, Download, FileCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

// 動的なインポートのためのダミーの型定義
// 実際のimport処理はコンポーネント内で実行
type JsPDFType = any;
type AutoTableType = any;
type HtmlToImageType = any;

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
  const [isClient, setIsClient] = useState(false);
  
  // サーバーサイドレンダリング防止
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // プレビュー用の要素参照
  const previewRef = useRef<HTMLDivElement>(null);
  
  // 画像としてエクスポート
  const exportAsImage = async () => {
    if (!previewRef.current || !isClient || typeof window === 'undefined') {
      toast.error('クライアント環境でのみ使用できます');
      return;
    }
    
    try {
      setIsGenerating(true);
      
      // 動的にライブラリをインポート
      const htmlToImage = await import('html-to-image');
      
      const dataUrl = await htmlToImage.toPng(previewRef.current, { 
        quality: 1,
        backgroundColor: '#ffffff',
        canvasWidth: paperSize === 'a3' ? 2480 : paperSize === 'a4' ? 1754 : 1240,
        canvasHeight: paperSize === 'a3' ? 3508 : paperSize === 'a4' ? 2480 : 1754,
        style: {
          transform: orientation === 'landscape' ? 'rotate(90deg)' : 'none',
        }
      });
      
      // ダウンロードリンクを作成
      const link = document.createElement('a');
      link.download = `${customTitle || title}_${format(currentDate, 'yyyy年MM月')}.png`;
      link.href = dataUrl;
      link.click();
      
      toast.success('画像が正常にエクスポートされました');
    } catch (error) {
      console.error('画像のエクスポートに失敗しました:', error);
      toast.error('エクスポートに失敗しました: ' + (error instanceof Error ? error.message : '未知のエラー'));
    } finally {
      setIsGenerating(false);
      setIsOpen(false);
    }
  };
  
  // PDFとしてエクスポート
  const exportAsPdf = async () => {
    if (!isClient || typeof window === 'undefined') {
      toast.error('クライアント環境でのみ使用できます');
      return;
    }
    
    try {
      setIsGenerating(true);
      
      // デバッグ情報
      console.log('PDF生成を開始します...');
      console.log('ブラウザ環境:', navigator.userAgent);
      
      // 動的にライブラリをインポート
      console.log('jsPDFをインポート中...');
      let jsPDFModule;
      try {
        jsPDFModule = await import('jspdf');
        console.log('jsPDFのインポートに成功しました');
      } catch (importError) {
        console.error('jsPDFのインポートに失敗しました:', importError);
        throw new Error(`jsPDFのインポートエラー: ${importError instanceof Error ? importError.message : '不明なエラー'}`);
      }
      
      const jsPDF = jsPDFModule.default;
      
      // AutoTable
      console.log('jspdf-autotableをインポート中...');
      let autoTableModule;
      try {
        autoTableModule = await import('jspdf-autotable');
        console.log('jspdf-autotableのインポートに成功しました');
      } catch (importError) {
        console.error('jspdf-autotableのインポートに失敗しました:', importError);
        throw new Error(`jspdf-autotableのインポートエラー: ${importError instanceof Error ? importError.message : '不明なエラー'}`);
      }
      
      const autoTable = autoTableModule.default;
      
      // PDF設定
      console.log('PDF設定を構成中...');
      const unit = 'mm';
      const sizes = {
        a3: orientation === 'portrait' ? [297, 420] : [420, 297],
        a4: orientation === 'portrait' ? [210, 297] : [297, 210],
        a5: orientation === 'portrait' ? [148, 210] : [210, 148],
      };
      
      const size = sizes[paperSize];
      
      // PDFドキュメント初期化 - エラーハンドリング強化
      console.log('PDFドキュメントを初期化中...');
      let doc;
      try {
        doc = new jsPDF({
          orientation: orientation,
          unit: unit,
          format: paperSize,
          hotfixes: ["px_scaling"], // 一般的な問題のホットフィックス
        });
        console.log('PDFドキュメントの初期化に成功しました');
      } catch (docError) {
        console.error('PDFドキュメントの初期化に失敗しました:', docError);
        throw new Error(`PDFドキュメント初期化エラー: ${docError instanceof Error ? docError.message : '不明なエラー'}`);
      }
      
      // フォント設定
      console.log('フォントを設定中...');
      try {
        doc.setFont('helvetica');
        console.log('フォント設定に成功しました');
      } catch (fontError) {
        console.error('フォント設定に失敗しました:', fontError);
        // フォントエラーは致命的ではないので続行
      }
      
      // テキスト安全化関数 - 日本語テキストの問題を回避
      const safeText = (text: string | undefined | null): string => {
        if (!text) return '';
        // 問題が発生しやすい文字を処理
        return String(text).replace(/[^\x00-\x7F]/g, (char) => {
          // 日本語文字を英数字に安全に置き換え
          return '_';
        });
      };
      
      // タイトル
      console.log('タイトルを追加中...');
      if (includeHeader) {
        try {
          const titleText = safeText(customTitle || title);
          const dateText = format(currentDate, 'yyyy-MM', { locale: ja }); // 日付は英数字形式に
          
          doc.setFontSize(18);
          doc.text(titleText, size[0] / 2, 15, { align: 'center' });
          doc.setFontSize(12);
          doc.text(dateText, size[0] / 2, 22, { align: 'center' });
          
          if (companyName) {
            doc.setFontSize(10);
            doc.text(safeText(companyName), size[0] / 2, 28, { align: 'center' });
          }
          console.log('タイトルの追加に成功しました');
        } catch (titleError) {
          console.error('タイトル追加中にエラーが発生しました:', titleError);
          // タイトルエラーは致命的ではないので続行
        }
      }
      
      // シフトデータの設定
      console.log('シフトデータを準備中...');
      try {
        const startDate = startOfMonth(currentDate);
        const endDate = endOfMonth(currentDate);
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        
        // テーブルヘッダー
        const header = ['Employee'];
        days.forEach(day => {
          header.push(format(day, 'd'));
        });
        
        // テーブルデータ
        console.log('従業員データを処理中...');
        const data = employees.map(employee => {
          const row = [safeText(employee.name)];
          days.forEach(day => {
            try {
              const shift = getShiftValue(employee.id, day);
              row.push(safeText(shift || ''));
            } catch (shiftError) {
              console.error(`従業員ID ${employee.id} の日付 ${format(day, 'yyyy-MM-dd')} のシフト取得中にエラーが発生しました:`, shiftError);
              row.push('');
            }
          });
          return row;
        });
        
        // テーブル設定
        console.log('テーブルを生成中...');
        const marginTop = includeHeader ? 35 : 15;
        try {
          autoTable(doc, {
            head: [header],
            body: data,
            startY: marginTop,
            theme: 'grid',
            styles: {
              fontSize: 9,
              cellPadding: 2,
            },
            headStyles: {
              fillColor: [220, 220, 220],
              textColor: [0, 0, 0],
              fontStyle: 'bold',
            },
            columnStyles: {
              0: { cellWidth: 30 },
            },
          });
          console.log('テーブル生成に成功しました');
        } catch (tableError) {
          console.error('テーブル生成中にエラーが発生しました:', tableError);
          throw new Error(`テーブル生成エラー: ${tableError instanceof Error ? tableError.message : '不明なエラー'}`);
        }
      } catch (dataError) {
        console.error('シフトデータ準備中にエラーが発生しました:', dataError);
        throw new Error(`シフトデータエラー: ${dataError instanceof Error ? dataError.message : '不明なエラー'}`);
      }
      
      // フッター
      console.log('フッターを追加中...');
      if (includeFooter) {
        try {
          const pageCount = doc.getNumberOfPages();
          for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(
              `Page ${i} / ${pageCount} - Created: ${format(new Date(), 'yyyy/MM/dd HH:mm')}`,
              size[0] / 2,
              size[1] - 10,
              { align: 'center' }
            );
          }
          console.log('フッター追加に成功しました');
        } catch (footerError) {
          console.error('フッター追加中にエラーが発生しました:', footerError);
          // フッターエラーは致命的ではないので続行
        }
      }
      
      // PDFをダウンロード
      console.log('PDFを保存中...');
      try {
        const filename = `${safeText(customTitle || title)}_${format(currentDate, 'yyyy-MM')}.pdf`;
        doc.save(filename);
        console.log('PDF保存に成功しました:', filename);
        toast.success('PDFが正常にエクスポートされました');
      } catch (saveError) {
        console.error('PDF保存中にエラーが発生しました:', saveError);
        throw new Error(`PDF保存エラー: ${saveError instanceof Error ? saveError.message : '不明なエラー'}`);
      }
    } catch (error) {
      console.error('PDFのエクスポートに失敗しました:', error);
      // エラーメッセージをより詳細に
      let errorMessage = 'PDF生成に失敗しました';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
        if (error.stack) {
          console.error('エラースタック:', error.stack);
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
      setIsOpen(false);
    }
  };
  
  // エクスポート実行
  const handleExport = () => {
    if (exportFormat === 'pdf') {
      exportAsPdf();
    } else {
      exportAsImage();
    }
  };
  
  return (
    <>
      {isClient ? (
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
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>シフト表エクスポート</DialogTitle>
                <DialogDescription>
                  シフト表をエクスポートする形式や設定を選択してください。
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="format" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="format">出力形式</TabsTrigger>
                  <TabsTrigger value="options">オプション</TabsTrigger>
                  <TabsTrigger value="preview">プレビュー</TabsTrigger>
                </TabsList>
                
                <TabsContent value="format" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="export-format">出力形式</Label>
                    <Select
                      value={exportFormat}
                      onValueChange={(value) => setExportFormat(value as 'pdf' | 'png')}
                    >
                      <SelectTrigger id="export-format">
                        <SelectValue placeholder="出力形式を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF文書</SelectItem>
                        <SelectItem value="png">PNG画像</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="paper-size">用紙サイズ</Label>
                    <Select
                      value={paperSize}
                      onValueChange={(value) => setPaperSize(value as 'a4' | 'a3' | 'a5')}
                    >
                      <SelectTrigger id="paper-size">
                        <SelectValue placeholder="用紙サイズを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a3">A3</SelectItem>
                        <SelectItem value="a4">A4</SelectItem>
                        <SelectItem value="a5">A5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="orientation">向き</Label>
                    <Select
                      value={orientation}
                      onValueChange={(value) => setOrientation(value as 'portrait' | 'landscape')}
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
                </TabsContent>
                
                <TabsContent value="options" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="custom-title">タイトル</Label>
                    <Input
                      id="custom-title"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder={title}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="include-header"
                      checked={includeHeader}
                      onCheckedChange={setIncludeHeader}
                    />
                    <Label htmlFor="include-header">ヘッダーを含める</Label>
                  </div>
                  
                  {includeHeader && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="include-logo"
                          checked={includeLogo}
                          onCheckedChange={setIncludeLogo}
                        />
                        <Label htmlFor="include-logo">ロゴを含める</Label>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="company-name">会社名</Label>
                        <Input
                          id="company-name"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="会社名（任意）"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="include-footer"
                      checked={includeFooter}
                      onCheckedChange={setIncludeFooter}
                    />
                    <Label htmlFor="include-footer">フッターを含める</Label>
                  </div>
                </TabsContent>
                
                <TabsContent value="preview" className="pt-4">
                  <div
                    ref={previewRef}
                    className="border rounded p-4 bg-white"
                    style={{
                      maxHeight: '400px',
                      overflow: 'auto',
                    }}
                  >
                    <h2 className="text-center text-xl font-bold">{customTitle || title}</h2>
                    <p className="text-center text-sm mb-4">
                      {format(currentDate, 'yyyy年MM月', { locale: ja })}
                    </p>
                    {companyName && (
                      <p className="text-center text-xs mb-4">{companyName}</p>
                    )}
                    
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="border bg-gray-100 p-1 text-sm">従業員</th>
                            {eachDayOfInterval({
                              start: startOfMonth(currentDate),
                              end: endOfMonth(currentDate),
                            }).map((day, index) => {
                              const dayOfWeek = getDay(day);
                              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                              return (
                                <th
                                  key={index}
                                  className={cn(
                                    'border p-1 text-xs',
                                    isWeekend ? 'bg-gray-200' : 'bg-gray-100'
                                  )}
                                >
                                  {format(day, 'd')}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {employees.slice(0, 5).map((employee, empIndex) => (
                            <tr key={employee.id}>
                              <td className="border p-1 text-sm font-medium">
                                {employee.name}
                              </td>
                              {eachDayOfInterval({
                                start: startOfMonth(currentDate),
                                end: endOfMonth(currentDate),
                              }).map((day, dayIndex) => {
                                const shift = getShiftValue(employee.id, day);
                                return (
                                  <td
                                    key={dayIndex}
                                    className="border p-1 text-xs text-center"
                                  >
                                    {shift || ''}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          {employees.length > 5 && (
                            <tr>
                              <td
                                colSpan={1 + eachDayOfInterval({
                                  start: startOfMonth(currentDate),
                                  end: endOfMonth(currentDate),
                                }).length}
                                className="border p-1 text-xs text-center"
                              >
                                ... その他 {employees.length - 5} 人の従業員
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    
                    {includeFooter && (
                      <p className="text-center text-xs mt-4">
                        作成日: {format(new Date(), 'yyyy/MM/dd HH:mm')}
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  disabled={isGenerating}
                >
                  キャンセル
                </Button>
                <Button
                  type="button"
                  onClick={handleExport}
                  disabled={isGenerating}
                  className="flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>生成中...</span>
                    </>
                  ) : exportFormat === 'pdf' ? (
                    <>
                      <FileCheck className="h-4 w-4" />
                      <span>PDFを生成</span>
                    </>
                  ) : (
                    <>
                      <Image className="h-4 w-4" />
                      <span>画像を生成</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
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