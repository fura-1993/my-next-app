'use client';

import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
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

// 変更後、保存までの待機時間（ミリ秒）
const SAVE_DEBOUNCE_DELAY = 2000;

export function ShiftGrid() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 2)); // 2025年3月
  const [shifts, setShifts] = useState<{ [key: string]: string }>({});
  const [employees, setEmployees] = useState(initialEmployees);
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const { getUpdatedShiftCode } = useShiftTypes();
  const supabase = createBrowserClient();

  // 保存待ちの変更を管理するRef
  const pendingChangesRef = useRef<Map<string, PendingChange>>(new Map());
  // 自動保存タイマーのRef
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  // ローカルキャッシュを維持するRef（オプティミスティックUI用）
  const shiftsRef = useRef<{ [key: string]: string }>({});

  // 変更があったときにhasPendingChangesを更新
  useEffect(() => {
    shiftsRef.current = shifts;
    setHasPendingChanges(pendingChangesRef.current.size > 0);
  }, [shifts]);

  // データの読み込み - React 18のuseTransitionでラップして優先度を下げる
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      startSaving(async () => {
        try {
          // shift_cellsテーブルからデータを取得
          const { data, error } = await supabase
            .from('shift_cells')
            .select('*')
            .gte('date', format(startOfMonth(currentDate), 'yyyy-MM-dd'))
            .lte('date', format(endOfMonth(currentDate), 'yyyy-MM-dd'));

          if (error) {
            console.error('Failed to fetch shifts:', error);
            return;
          }

          // シフトデータをローカル形式に変換
          const shiftMap: { [key: string]: string } = {};
          data?.forEach(entry => {
            const key = `${entry.employee_id}-${entry.date}`;
            shiftMap[key] = entry.shift_code;
          });

          setShifts(shiftMap);
        } catch (err) {
          console.error('Error loading shifts:', err);
        } finally {
          setIsLoading(false);
        }
      });
    };

    fetchData();
  }, [currentDate, supabase]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const handlePrevMonth = () => {
    // 保存処理をトリガー
    if (pendingChangesRef.current.size > 0) {
      saveAllPendingChanges();
    }
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    // 保存処理をトリガー
    if (pendingChangesRef.current.size > 0) {
      saveAllPendingChanges();
    }
    setCurrentDate(addMonths(currentDate, 1));
  };

  // 一定期間操作がなければ保存する（デバウンス処理）
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      if (pendingChangesRef.current.size > 0) {
        saveAllPendingChanges();
      }
    }, SAVE_DEBOUNCE_DELAY);
  }, []);

  // 保存処理
  const saveAllPendingChanges = useCallback(async () => {
    if (pendingChangesRef.current.size === 0) return;

    const changes = Array.from(pendingChangesRef.current.values());
    const changesCopy = [...changes]; // 保存用のコピー
    
    startSaving(async () => {
      try {
        // 一括で処理するためのバッチ操作を準備
        const changesById = new Map<number, PendingChange>();
        const changesForInsert: Omit<ShiftEntry, 'id'>[] = [];

        // 既存のデータを検索して、更新と挿入に分類
        const promises = changes.map(async (change) => {
          const { data } = await supabase
            .from('shift_cells')
            .select('id')
            .eq('employee_id', change.employeeId)
            .eq('date', change.date)
            .maybeSingle();

          if (data?.id) {
            changesById.set(data.id, change);
          } else {
            changesForInsert.push({
              employee_id: change.employeeId,
              date: change.date,
              shift_code: change.shift
            });
          }
        });

        await Promise.all(promises);

        // トランザクション的に処理（一括操作）
        const operations = [];

        // 更新処理
        if (changesById.size > 0) {
          // Map.entriesをArray.fromで変換してから反復処理
          Array.from(changesById.entries()).forEach(([id, change]) => {
            operations.push(
              supabase
                .from('shift_cells')
                .update({ shift_code: change.shift })
                .eq('id', id)
            );
          });
        }

        // 挿入処理
        if (changesForInsert.length > 0) {
          operations.push(
            supabase
              .from('shift_cells')
              .insert(changesForInsert)
          );
        }

        // 並列で実行
        const results = await Promise.all(operations);
        
        // エラーチェック
        const hasError = results.some(result => result.error);
        
        if (hasError) {
          throw new Error('Some operations failed');
        }

        // 保存に成功したら、保存待ちの変更をクリア
        changesCopy.forEach(change => {
          const key = `${change.employeeId}-${change.date}`;
          pendingChangesRef.current.delete(key);
        });

        setHasPendingChanges(pendingChangesRef.current.size > 0);
        toast.success('シフトを保存しました');
      } catch (err) {
        console.error('Error saving shifts:', err);
        toast.error('シフトの保存に失敗しました');
      }
    });
  }, [supabase]);

  // シフト変更時のハンドラ
  const handleShiftChange = useCallback((employeeId: number, date: Date, newShift: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${employeeId}-${dateStr}`;
    
    // 楽観的UI更新
    setShifts(prev => ({
      ...prev,
      [key]: newShift
    }));

    // 保存待ちの変更に追加
    pendingChangesRef.current.set(key, {
      employeeId,
      date: dateStr,
      shift: newShift
    });

    // 自動保存をスケジュール
    scheduleSave();
  }, [scheduleSave]);

  const getShiftValue = useCallback((employeeId: number, date: Date) => {
    const key = `${employeeId}-${format(date, 'yyyy-MM-dd')}`;
    const shift = shiftsRef.current[key];
    return shift ? getUpdatedShiftCode(shift) : '−';
  }, [getUpdatedShiftCode]);

  const isWeekend = useCallback((date: Date) => {
    const day = getDay(date);
    return day === 0;
  }, []);

  const isSaturday = useCallback((date: Date) => getDay(date) === 6, []);

  const handleDeleteAllShifts = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // 現在の月のデータを削除
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('shift_cells')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);
        
      if (error) throw error;
      
      // ローカルデータをクリア
      setShifts({});
      // 保存待ちデータもクリア
      pendingChangesRef.current.clear();
      setHasPendingChanges(false);
      
      toast.success('すべてのシフトを削除しました');
    } catch (err) {
      console.error('Error deleting shifts:', err);
      toast.error('シフトの削除に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, supabase]);

  const handleEmployeeUpdate = useCallback((updatedEmployee: { id: number; name: string; givenName?: string }) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === updatedEmployee.id ? updatedEmployee : emp
    ));
  }, []);

  const handleAddEmployee = useCallback((newEmployee: { name: string; givenName?: string }) => {
    const newId = Math.max(...employees.map(e => e.id)) + 1;
    setEmployees(prev => [...prev, { id: newId, ...newEmployee }]);
  }, [employees]);

  // コンポーネントがアンマウントされるときに保存
  useEffect(() => {
    return () => {
      if (pendingChangesRef.current.size > 0) {
        saveAllPendingChanges();
      }
      
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [saveAllPendingChanges]);

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
        {isLoading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2">データを読み込み中...</span>
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
                    onClick={() => setSelectedEmployee(employee)}
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
            className="floating-add inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 h-10 px-4"
            onClick={() => setIsCreatingEmployee(true)}
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
          
          {hasPendingChanges && (
            <button
              onClick={saveAllPendingChanges}
              disabled={isSaving}
              className={cn(
                "inline-flex items-center justify-center rounded-full text-sm font-medium",
                "transition-all duration-200 ease-in-out",
                "bg-green-600 text-white shadow-lg hover:bg-green-700 h-10 px-4",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSaving && "opacity-70 cursor-not-allowed"
              )}
            >
              <Save className="w-4 h-4 mr-1.5" />
              {isSaving ? "保存中..." : "保存"}
              {!isSaving && (
                <span className="ml-1 animate-pulse bg-green-400 text-green-800 text-xs rounded-full px-1.5 py-0.5">
                  {pendingChangesRef.current.size}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
      <div className="fixed bottom-6 right-6">
        <AlertDialog>
          <AlertDialogTrigger 
            className="floating-delete inline-flex items-center justify-center rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90 h-10 px-4"
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
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAllShifts}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
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
          onClose={() => setSelectedEmployee(null)}
          onSave={handleEmployeeUpdate}
        />
      )}
      <EmployeeCreator
        isOpen={isCreatingEmployee}
        onClose={() => setIsCreatingEmployee(false)}
        onSave={handleAddEmployee}
        currentEmployeeCount={employees.length}
      />
    </div>
  );
}