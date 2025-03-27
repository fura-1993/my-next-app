'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { addMonths, subMonths, format, getDate, getDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import holidays from '@holiday-jp/holiday_jp';
import { ShiftHeader } from './shift-header';
import { ShiftLegend } from './shift-legend';
import { ShiftCell } from './shift-cell';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useShiftTypes } from '@/contexts/shift-types-context';
import { Trash2, UserCog, Save } from 'lucide-react';
import { EmployeeCreator } from './employee-creator';
import { EmployeeEditor } from './employee-editor';
import { createBrowserClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

// 型定義
interface ShiftEntry {
  id?: number;
  employee_id: number;
  date: string;
  shift_code: string;
}

// 保存待ちの変更を追跡する型
interface PendingChange {
  employeeId: number;
  date: string;
  shift: string;
}

const initialEmployees = [
  { id: 1, name: '橋本' },
  { id: 2, name: '棟方' },
  { id: 3, name: '薄田' },
  { id: 4, name: '小林', givenName: '広睴' },
  { id: 5, name: '梶' },
  { id: 6, name: '寺田' },
  { id: 7, name: '山崎' },
  { id: 8, name: '小林', givenName: '利治' },
];

// 操作がない時に自動保存するまでの時間 (30秒)
const AUTO_SAVE_DELAY = 30000;
// ロック解除までの最短時間 (100ms)
const LOCK_DURATION = 100;
// キャッシュ有効期限 (1時間)
const CACHE_TTL = 60 * 60 * 1000;

export function ShiftGrid() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 2)); // 2025年3月
  const [shifts, setShifts] = useState<{ [key: string]: string }>({});
  const [employees, setEmployees] = useState(initialEmployees);
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { getUpdatedShiftCode } = useShiftTypes();
  
  // メモ化したSupabaseクライアント
  const supabase = useMemo(() => createBrowserClient(), []);

  // 処理ロックのRef
  const isProcessingRef = useRef(false);
  // 保存待ちの変更を管理するRef
  const pendingChangesRef = useRef<Map<string, PendingChange>>(new Map());
  // 自動保存タイマーのRef
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  // 最後のユーザー操作時間
  const lastUserActivityRef = useRef(Date.now());
  // シフトデータキャッシュ
  const shiftsCache = useRef<{
    [monthKey: string]: {
      data: { [key: string]: string };
      timestamp: number;
    }
  }>({});
  // ローカルキャッシュ（レンダリング最適化用）
  const shiftsRef = useRef<{ [key: string]: string }>({});

  // 現在の月のキーを取得
  const currentMonthKey = useMemo(() => 
    format(currentDate, 'yyyy-MM'), 
  [currentDate]);

  // 変更がある場合のみhasPendingChangesを更新
  useEffect(() => {
    shiftsRef.current = shifts;
    const hasChanges = pendingChangesRef.current.size > 0;
    if (hasPendingChanges !== hasChanges) {
      setHasPendingChanges(hasChanges);
    }
  }, [shifts, hasPendingChanges]);

  // ユーザー操作時間の記録と非アクティブタイマーのリセット
  const recordUserActivity = useCallback(() => {
    lastUserActivityRef.current = Date.now();
    
    // 既存のタイマーをクリア
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    // 新しい非アクティブタイマーをセット（30秒間操作がなければ自動保存）
    inactivityTimerRef.current = setTimeout(() => {
      if (pendingChangesRef.current.size > 0 && !isProcessingRef.current) {
        saveAllChanges();
      }
    }, AUTO_SAVE_DELAY);
  }, []);

  // 処理ロックを設定・解除する関数
  const setProcessingLock = useCallback((isLocked: boolean) => {
    isProcessingRef.current = isLocked;
    
    if (isLocked) {
      // 最低限のロック時間を設定（UIのちらつき防止）
      setTimeout(() => {
        if (!isProcessingRef.current) return;
        isProcessingRef.current = false;
      }, LOCK_DURATION);
    }
  }, []);

  // データの読み込み - キャッシュを優先利用
  const fetchData = useCallback(async (date: Date) => {
    if (isProcessingRef.current) return;
    
    const monthKey = format(date, 'yyyy-MM');
    const cachedData = shiftsCache.current[monthKey];
    
    // キャッシュがあり、有効期限内なら使用
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
      setShifts(cachedData.data);
      return;
    }
    
    try {
      setProcessingLock(true);
      setIsLoading(true);
      
      // データ取得（バッチサイズを大きくして効率化）
      const { data, error } = await supabase
        .from('shift_cells')
        .select('*')
        .gte('date', format(startOfMonth(date), 'yyyy-MM-dd'))
        .lte('date', format(endOfMonth(date), 'yyyy-MM-dd'));

      if (error) {
        console.error('Failed to fetch shifts:', error);
        return;
      }

      // データの変換（一度にまとめて処理）
      const shiftMap: { [key: string]: string } = {};
      if (data) {
        for (let i = 0; i < data.length; i++) {
          const entry = data[i];
          const key = `${entry.employee_id}-${entry.date}`;
          shiftMap[key] = entry.shift_code;
        }
      }

      // キャッシュに保存
      shiftsCache.current[monthKey] = {
        data: shiftMap,
        timestamp: Date.now()
      };

      // 状態更新
      setShifts(shiftMap);
    } catch (err) {
      console.error('Error loading shifts:', err);
    } finally {
      setIsLoading(false);
      setProcessingLock(false);
    }
  }, [supabase, setProcessingLock]);

  // 月が変わったときにデータを取得
  useEffect(() => {
    fetchData(currentDate);
    recordUserActivity();
  }, [currentDate, fetchData, recordUserActivity]);

  // 日付配列のメモ化
  const days = useMemo(() => 
    eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    }), 
  [currentDate]);

  // 月切り替え処理
  const handlePrevMonth = useCallback(() => {
    if (isProcessingRef.current) return;
    
    recordUserActivity();
    
    // 保存処理をトリガー（月切り替え前に保存）
    if (pendingChangesRef.current.size > 0) {
      saveAllChanges();
    }
    
    setCurrentDate(prev => subMonths(prev, 1));
  }, [recordUserActivity]);

  const handleNextMonth = useCallback(() => {
    if (isProcessingRef.current) return;
    
    recordUserActivity();
    
    // 保存処理をトリガー（月切り替え前に保存）
    if (pendingChangesRef.current.size > 0) {
      saveAllChanges();
    }
    
    setCurrentDate(prev => addMonths(prev, 1));
  }, [recordUserActivity]);

  // 保存処理（すべての変更を保存）
  const saveAllChanges = useCallback(async () => {
    if (pendingChangesRef.current.size === 0 || isProcessingRef.current) return;
    
    try {
      setProcessingLock(true);
      setIsSaving(true);
      
      const changes = Array.from(pendingChangesRef.current.values());
      
      // バッチ処理のための準備
      const updateBatch: { id: number; shift_code: string }[] = [];
      const insertBatch: Omit<ShiftEntry, 'id'>[] = [];
      const processingPromises = [];
      
      // 既存データの検索 (一括クエリ)
      for (const change of changes) {
        processingPromises.push(
          supabase
            .from('shift_cells')
            .select('id')
            .eq('employee_id', change.employeeId)
            .eq('date', change.date)
            .single()
            .then(({ data, error }) => {
              if (!error && data) {
                updateBatch.push({ 
                  id: data.id, 
                  shift_code: change.shift 
                });
              } else {
                insertBatch.push({
                  employee_id: change.employeeId,
                  date: change.date,
                  shift_code: change.shift
                });
              }
            })
            .catch(() => {
              // エラーの場合は挿入処理へ
              insertBatch.push({
                employee_id: change.employeeId,
                date: change.date,
                shift_code: change.shift
              });
            })
        );
      }
      
      // すべての検索処理を完了
      await Promise.all(processingPromises);
      
      // 更新処理のバッチ実行（小分けにして並列処理）
      const BATCH_SIZE = 50;
      const updatePromises = [];
      
      for (let i = 0; i < updateBatch.length; i += BATCH_SIZE) {
        const batch = updateBatch.slice(i, i + BATCH_SIZE);
        
        // 個別のUPDATE文を一括で実行（ネットワーク効率化）
        const batchPromises = batch.map(item => 
          supabase
            .from('shift_cells')
            .update({ shift_code: item.shift_code })
            .eq('id', item.id)
        );
        
        updatePromises.push(Promise.all(batchPromises));
      }
      
      // 挿入処理（一括実行）
      if (insertBatch.length > 0) {
        // 小さなバッチに分割して挿入
        for (let i = 0; i < insertBatch.length; i += BATCH_SIZE) {
          const batch = insertBatch.slice(i, i + BATCH_SIZE);
          updatePromises.push(
            supabase
              .from('shift_cells')
              .insert(batch)
          );
        }
      }
      
      // すべての更新と挿入を完了
      await Promise.all(updatePromises);
      
      // キャッシュを更新
      const updatedShifts = { ...shiftsRef.current };
      changes.forEach(change => {
        const key = `${change.employeeId}-${change.date}`;
        updatedShifts[key] = change.shift;
      });
      
      shiftsCache.current[currentMonthKey] = {
        data: updatedShifts,
        timestamp: Date.now()
      };
      
      // 保存成功後、待機変更をクリア
      pendingChangesRef.current.clear();
      setHasPendingChanges(false);
      
      toast.success('シフトを保存しました');
    } catch (err) {
      console.error('Error saving shifts:', err);
      toast.error('シフトの保存に失敗しました');
    } finally {
      setIsSaving(false);
      setProcessingLock(false);
    }
  }, [supabase, currentMonthKey, setProcessingLock]);

  // シフト変更時のハンドラ - 保存せずにローカル変更のみ
  const handleShiftChange = useCallback((employeeId: number, date: Date, newShift: string) => {
    if (isProcessingRef.current) return;
    
    recordUserActivity();
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${employeeId}-${dateStr}`;
    
    // UIの即時更新（メモリ上のみ）- 保存はしない
    setShifts(prev => {
      // 値が同じなら再レンダリング不要
      if (prev[key] === newShift) return prev;
      return { ...prev, [key]: newShift };
    });

    // 保存待ちリストに追加
    pendingChangesRef.current.set(key, {
      employeeId,
      date: dateStr,
      shift: newShift
    });
  }, [recordUserActivity]);

  // メモ化されたシフト値取得関数
  const getShiftValue = useCallback((employeeId: number, date: Date) => {
    const key = `${employeeId}-${format(date, 'yyyy-MM-dd')}`;
    const shift = shiftsRef.current[key];
    return shift ? getUpdatedShiftCode(shift) : '−';
  }, [getUpdatedShiftCode]);

  // メモ化された日付判定関数
  const isWeekend = useCallback((date: Date) => getDay(date) === 0, []);
  const isSaturday = useCallback((date: Date) => getDay(date) === 6, []);

  // 全削除処理
  const handleDeleteAllShifts = useCallback(async () => {
    if (isProcessingRef.current) return;
    
    try {
      setProcessingLock(true);
      setIsLoading(true);
      recordUserActivity();
      
      // 現在の月のデータを削除
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      
      await supabase
        .from('shift_cells')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);
      
      // キャッシュから削除
      delete shiftsCache.current[currentMonthKey];
      
      // ローカルデータをクリア
      setShifts({});
      pendingChangesRef.current.clear();
      setHasPendingChanges(false);
      
      toast.success('すべてのシフトを削除しました');
    } catch (err) {
      console.error('Error deleting shifts:', err);
      toast.error('シフトの削除に失敗しました');
    } finally {
      setIsLoading(false);
      setProcessingLock(false);
    }
  }, [currentDate, supabase, currentMonthKey, recordUserActivity, setProcessingLock]);

  // 従業員関連の処理（メモ化）
  const handleEmployeeUpdate = useCallback((updatedEmployee: { id: number; name: string; givenName?: string }) => {
    recordUserActivity();
    setEmployees(prev => prev.map(emp => 
      emp.id === updatedEmployee.id ? updatedEmployee : emp
    ));
  }, [recordUserActivity]);

  const handleAddEmployee = useCallback((newEmployee: { name: string; givenName?: string }) => {
    recordUserActivity();
    setEmployees(prev => {
      const newId = Math.max(...prev.map(e => e.id)) + 1;
      return [...prev, { id: newId, ...newEmployee }];
    });
  }, [recordUserActivity]);

  // コンポーネントのアンマウント時にタイマーとリスナーをクリーンアップ
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      
      // 保存されていない変更がある場合は保存
      if (pendingChangesRef.current.size > 0) {
        saveAllChanges();
      }
    };
  }, [saveAllChanges]);

  // 最適化されたステータス表示
  const displayStatus = useMemo(() => {
    if (isSaving) return `保存中... (${pendingChangesRef.current.size}件)`;
    if (isLoading) return "データを読み込み中...";
    return null;
  }, [isSaving, isLoading]);

  // 保存ボタンと待機時間のレンダリング
  const saveButtonText = useMemo(() => {
    if (isSaving) return "保存中...";
    
    const pendingCount = pendingChangesRef.current.size;
    if (pendingCount === 0) return "保存";
    
    return `保存 (${pendingCount}件)`;
  }, [isSaving]);

  return (
    <div className="min-h-screen pb-20">
      <ShiftHeader
        currentDate={currentDate}
        shifts={shifts}
        employees={employees}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />
      <ShiftLegend />
      <div className="overflow-x-auto">
        {displayStatus && (
          <div className="flex justify-center items-center py-4 mb-4 bg-blue-50 rounded-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 mr-2"></div>
            <span className="text-blue-700 font-medium">{displayStatus}</span>
          </div>
        )}
        <table className="w-full border-collapse [&_td]:border-black/60 [&_th]:border-black/60 [&_td]:border-[1px] [&_th]:border-[1px] rounded-2xl overflow-hidden">
          <thead>
            <tr className="bg-gradient-to-b from-gray-50/95 to-gray-50/90">
              <th className="px-2 py-3 sticky left-0 bg-gradient-to-b from-gray-50/95 to-gray-50/90 z-10 w-[50px] min-w-[50px] first:rounded-tl-2xl">
                担当
              </th>
              {days.map((date, index) => (
                <th
                  key={date.toString()}
                  className={cn(
                    "p-2 min-w-[40px] relative",
                    index === days.length - 1 && "rounded-tr-2xl",
                    holidays.isHoliday(date) ? "text-red-500" : "",
                    isSaturday(date) ? "text-blue-500" : "",
                    isWeekend(date) ? "text-red-500" : "",
                  )}
                >
                  <div className="text-sm">{format(date, 'd')}</div>
                  <div className="text-xs">({format(date, 'E', { locale: ja })})</div>
                  {holidays.isHoliday(date) && (
                    <div className="text-[8px] text-red-500 leading-tight mt-0.5">
                      {holidays.between(date, date)[0]?.name}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, index) => (
              <tr 
                key={employee.id}
                className={index % 2 === 0 ? 'bg-white' : 'bg-slate-100'}
              >
                <td 
                  className={cn(
                    "sticky left-0 z-10 font-medium text-sm whitespace-nowrap p-0",
                    index % 2 === 0 ? 'bg-white' : 'bg-slate-100'
                  )}
                >
                  <div 
                    className={cn(
                      "employee-icon group flex items-center justify-center h-[36px] mx-auto cursor-pointer rounded-2xl w-[62px] whitespace-nowrap overflow-hidden",
                      index % 2 === 0 && [
                        'bg-gradient-to-b from-white to-gray-50',
                        'border border-black/15',
                        'shadow-[0_2px_4px_rgba(0,0,0,0.05),0_4px_8px_-2px_rgba(0,0,0,0.1)]',
                        'hover:shadow-[0_4px_8px_rgba(0,0,0,0.1),0_8px_16px_-4px_rgba(0,0,0,0.15)]',
                        'hover:border-black/20',
                        'transform-gpu hover:translate-y-[-2px] hover:scale-[1.02]',
                        'transition-all duration-300 ease-out'
                      ],
                      index % 2 !== 0 && [
                        'bg-gradient-to-b from-gray-900 to-black',
                        'shadow-[0_2px_4px_rgba(0,0,0,0.2)]',
                        'hover:shadow-[0_4px_8px_rgba(0,0,0,0.25)]',
                        'transform-gpu hover:translate-y-[-2px] hover:scale-[1.02]',
                        'transition-all duration-300 ease-out'
                      ]
                    )}
                    onClick={() => {
                      recordUserActivity();
                      setSelectedEmployee(employee);
                    }}
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span 
                        className={cn(
                          "font-extrabold tracking-tight text-[15px] whitespace-nowrap",
                          index % 2 === 0 ? 'text-black' : 'text-white'
                        )}
                        data-text={employee.name}
                      >
                        {employee.name}
                      </span>
                      {employee.givenName && (
                        <span className={cn(
                          "text-[11px] font-extrabold tracking-wide whitespace-nowrap",
                          index % 2 === 0 ? 'text-black/70' : 'text-white/70'
                        )}>
                          {employee.givenName[0]}
                        </span>
                      )}
                      <UserCog 
                        className={cn(
                          "w-3.5 h-3.5 ml-0.5 opacity-0 transition-all duration-300 group-hover:opacity-100 transform group-hover:scale-110",
                          index % 2 === 0 ? 'text-black/60' : 'text-white/70'
                        )}
                      />
                    </div>
                  </div>
                </td>
                {days.map((date) => {
                  const shift = getShiftValue(employee.id, date);
                  return (
                    <td 
                      key={date.toString()} 
                      className={cn(
                        "p-0",
                        index === employees.length - 1 && date === days[0] && "rounded-bl-2xl",
                        index === employees.length - 1 && date === days[days.length - 1] && "rounded-br-2xl",
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-100'
                      )}
                    >
                      <ShiftCell
                        shift={shift}
                        employeeId={employee.id}
                        date={date}
                        rowType={index % 2 === 0 ? 'even' : 'odd'}
                        onShiftChange={handleShiftChange}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-4 pl-4 flex items-center gap-3">
          <button
            className={cn(
              "floating-add inline-flex items-center justify-center rounded-full text-sm font-medium",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 h-10 px-4",
              (isLoading || isSaving) && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => {
              recordUserActivity();
              setIsCreatingEmployee(true);
            }}
            disabled={isLoading || isSaving}
          >
            <div className="icon-wrapper">
              <svg
                className="w-4 h-4 mr-1.5"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            担当者を追加
          </button>
          
          <button
            onClick={saveAllChanges}
            disabled={isLoading || isSaving || pendingChangesRef.current.size === 0}
            className={cn(
              "inline-flex items-center justify-center rounded-full text-sm font-medium",
              "transition-all duration-200 ease-in-out",
              "bg-green-600 text-white shadow-lg hover:bg-green-700 h-10 px-4",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              (isLoading || isSaving || pendingChangesRef.current.size === 0) && "opacity-50 cursor-not-allowed"
            )}
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saveButtonText}
          </button>
          
          {hasPendingChanges && !isSaving && (
            <div className="text-xs text-gray-500 ml-2">
              30秒間操作がない場合、自動保存されます
            </div>
          )}
        </div>
      </div>
      
      <div className="fixed bottom-6 right-6">
        <AlertDialog>
          <AlertDialogTrigger 
            className={cn(
              "floating-delete inline-flex items-center justify-center rounded-full text-xs font-medium",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90 h-10 px-4",
              (isLoading || isSaving) && "opacity-50 cursor-not-allowed"
            )}
            disabled={isLoading || isSaving}
            onClick={recordUserActivity}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            全削除
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>スケジュール削除の確認</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>{format(currentDate, 'yyyy年M月', { locale: ja })}のすべてのスケジュールを削除し、風船に戻します。</p>
                <p className="text-destructive">この操作は取り消せません。</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={recordUserActivity}>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAllShifts}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                disabled={isLoading || isSaving}
              >
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      
      {selectedEmployee && (
        <EmployeeEditor
          employee={selectedEmployee}
          isOpen={true}
          onClose={() => {
            recordUserActivity();
            setSelectedEmployee(null);
          }}
          onSave={handleEmployeeUpdate}
        />
      )}
      
      <EmployeeCreator
        isOpen={isCreatingEmployee}
        onClose={() => {
          recordUserActivity();
          setIsCreatingEmployee(false);
        }}
        onSave={handleAddEmployee}
        currentEmployeeCount={employees.length}
      />
    </div>
  );
}