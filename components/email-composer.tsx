'use client';

import React, { useState, useEffect } from 'react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Check, Copy, Mail, Send, X, AlertCircle } from "lucide-react";
import { cn } from '@/lib/utils';

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDate: Date;
  shifts: { [key: string]: string };
  employees: Array<{ id: number; name: string; givenName?: string }>;
}

export function EmailComposer({ open, onOpenChange, currentDate, shifts, employees }: EmailComposerProps) {
  const [to, setTo] = useState<string>('');
  const [cc, setCc] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [includeAll, setIncludeAll] = useState<boolean>(true);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showCc, setShowCc] = useState<boolean>(false);

  // 初期化
  useEffect(() => {
    if (open) {
      // メールタイトルを自動生成
      setSubject(`${format(currentDate, 'yyyy年M月', { locale: ja })}のシフト表`);
      
      // 全員選択状態にする
      setSelectedEmployees(employees.map(emp => emp.id));
      
      // メール本文の初期化
      setTimeout(() => {
        generateEmailBody();
      }, 10);
    }
  }, [open, currentDate, employees]);

  // 選択中の従業員やフラグが変わったら本文を更新
  useEffect(() => {
    if (open) {
      generateEmailBody();
    }
  }, [includeAll, selectedEmployees]);

  const generateEmailBody = () => {
    const monthStr = format(currentDate, 'yyyy年M月', { locale: ja });
    let bodyContent = `皆様

${monthStr}のシフト表をお送りします。
ご確認ください。

-------------------------------------
${monthStr} シフト表
-------------------------------------

`;
    
    // シフト情報を追加
    const displayEmployees = includeAll 
      ? employees 
      : employees.filter(emp => selectedEmployees.includes(emp.id));
    
    if (displayEmployees.length > 0) {
      // 月の日数を取得
      const daysInMonth = eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      });
      
      // 各従業員のシフト情報
      displayEmployees.forEach(employee => {
        bodyContent += `■ ${employee.name}${employee.givenName ? ` ${employee.givenName}` : ''}\n`;
        
        // 日ごとのシフト情報
        const employeeShifts = daysInMonth.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const key = `${employee.id}-${dateStr}`;
          const shift = shifts[key] || '−';
          return { day, shift };
        });
        
        // シフト情報の整形（簡略表示）
        const weekChunks = [];
        for (let i = 0; i < employeeShifts.length; i += 7) {
          weekChunks.push(employeeShifts.slice(i, i + 7));
        }
        
        weekChunks.forEach((week, weekIndex) => {
          const weekStart = week[0].day;
          const weekEnd = week[week.length - 1].day;
          bodyContent += `${format(weekStart, 'M/d')}〜${format(weekEnd, 'M/d')}: `;
          bodyContent += week.map(({ day, shift }) => 
            `${format(day, 'd')}(${format(day, 'E', { locale: ja })})${shift}`
          ).join(' ');
          bodyContent += '\n';
        });
        
        bodyContent += '\n';
      });
    } else {
      bodyContent += '※ 表示する従業員が選択されていません\n\n';
    }
    
    bodyContent += `-------------------------------------
ご不明点があればご連絡ください。

`;
    
    setBody(bodyContent);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setIsCopied(true);
      toast.success("メール内容をコピーしました");
      
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      toast.error("コピーに失敗しました");
    }
  };

  const handleSendEmail = () => {
    if (!to) {
      toast.error("宛先を入力してください");
      return;
    }
    
    setIsSending(true);
    
    // メーラーを開く
    const mailtoLink = `mailto:${to}${showCc && cc ? `?cc=${cc}` : ''}${encodeURIComponent(subject) ? `&subject=${encodeURIComponent(subject)}` : ''}${encodeURIComponent(body) ? `&body=${encodeURIComponent(body)}` : ''}`;
    
    try {
      window.open(mailtoLink);
      
      // 少し待ってからモーダルを閉じる
      setTimeout(() => {
        onOpenChange(false);
        setIsSending(false);
        toast.success("メーラーを開きました");
      }, 1000);
    } catch (err) {
      console.error("メーラーを開けませんでした", err);
      toast.error("メーラーを開けませんでした");
      setIsSending(false);
    }
  };

  const toggleEmployeeSelection = (id: number) => {
    setSelectedEmployees(prev => {
      if (prev.includes(id)) {
        return prev.filter(empId => empId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white rounded-2xl">
        <DialogHeader className="px-4 py-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              メール作成
            </DialogTitle>
            <DialogClose className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/50 transition">
              <X className="w-4 h-4 text-white" />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="px-4 pt-3 pb-4 divide-y divide-gray-100 max-h-[calc(90vh-120px)] overflow-y-auto">
          <div className="space-y-3 mb-4">
            <div className="space-y-2">
              <Label htmlFor="to" className="text-sm font-medium flex items-center justify-between">
                <span>宛先</span>
                {!showCc && (
                  <button 
                    onClick={() => setShowCc(true)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    + CCを追加
                  </button>
                )}
              </Label>
              <Input 
                id="to" 
                placeholder="メールアドレスを入力" 
                value={to} 
                onChange={(e) => setTo(e.target.value)} 
                className="h-9"
              />
            </div>

            {showCc && (
              <div className="space-y-2">
                <Label htmlFor="cc" className="text-sm font-medium flex items-center justify-between">
                  <span>CC</span>
                  <button 
                    onClick={() => setShowCc(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    - 非表示
                  </button>
                </Label>
                <Input 
                  id="cc" 
                  placeholder="CCアドレスを入力" 
                  value={cc} 
                  onChange={(e) => setCc(e.target.value)} 
                  className="h-9"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subject" className="text-sm font-medium">件名</Label>
              <Input 
                id="subject" 
                value={subject} 
                onChange={(e) => setSubject(e.target.value)}
                className="h-9" 
              />
            </div>
          </div>

          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="includeAll" className="text-sm font-medium">全員のシフトを含める</Label>
              <Switch 
                id="includeAll" 
                checked={includeAll} 
                onCheckedChange={setIncludeAll}
              />
            </div>

            {!includeAll && (
              <div className="mt-2 space-y-1">
                <Label className="text-sm font-medium mb-1 block">含める担当者を選択</Label>
                <div className="flex flex-wrap gap-2 mb-2 bg-gray-50 p-2 rounded-md max-h-32 overflow-y-auto">
                  {employees.map(emp => (
                    <div 
                      key={emp.id} 
                      onClick={() => toggleEmployeeSelection(emp.id)}
                      className={cn(
                        "cursor-pointer px-2 py-1 rounded-full text-xs font-medium transition-colors",
                        selectedEmployees.includes(emp.id) 
                          ? "bg-blue-100 text-blue-700 border border-blue-300" 
                          : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
                      )}
                    >
                      {emp.name}{emp.givenName ? ` ${emp.givenName}` : ''}
                      {selectedEmployees.includes(emp.id) && (
                        <Check className="w-3 h-3 ml-1 inline-block" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label 
                htmlFor="body" 
                className="text-sm font-medium flex items-center justify-between"
              >
                <span>本文</span>
                <button 
                  onClick={handleCopyToClipboard} 
                  className="text-xs text-blue-500 hover:text-blue-700 flex items-center"
                  disabled={isCopied}
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      コピー済み
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      内容をコピー
                    </>
                  )}
                </button>
              </Label>
              <Textarea 
                id="body" 
                value={body} 
                onChange={(e) => setBody(e.target.value)} 
                rows={8}
                className="resize-none font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 bg-gray-50 sticky bottom-0 z-10">
          <div className="w-full flex gap-2 justify-end">
            <DialogClose asChild>
              <Button 
                variant="outline"
                size="sm" 
                className="h-9 px-3"
              >
                キャンセル
              </Button>
            </DialogClose>
            <Button 
              onClick={handleSendEmail}
              size="sm"
              disabled={!to || isSending}
              className={cn(
                "h-9 px-4 flex items-center", 
                !to ? "opacity-70" : "", 
                "bg-blue-600 hover:bg-blue-700"
              )}
            >
              <Send className="w-4 h-4 mr-1.5" />
              {isSending ? "送信中..." : "メーラーで開く"}
            </Button>
          </div>
          <div className="w-full pt-1.5">
            <p className="text-xs text-gray-500 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              デフォルトメールアプリが開きます
            </p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 