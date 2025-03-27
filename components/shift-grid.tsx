'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { addMonths, subMonths, format, getDate, getDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import holidays from '@holiday-jp/holiday_jp';
import { ShiftHeader } from './shift-header';
import { ShiftLegend } from './shift-legend';
import { ShiftCell } from './shift-cell';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useShiftTypes } from '@/contexts/shift-types-context';
import { Trash2, UserCog, Save, RotateCcw, Download } from 'lucide-react';
import { EmployeeCreator } from './employee-creator';
import { EmployeeEditor } from './employee-editor';
import { toast } from 'sonner';
import { getFromStorage, saveToStorage } from '@/utils/localStorage';

// 型定義
interface ShiftEntry {
  id: number;
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

interface Employee {
  id: number;
  name: string;
  givenName?: string;
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

// ローカルストレージキー
const SHIFTS_STORAGE_KEY = 'jatrack_shift_grid';
const EMPLOYEES_STORAGE_KEY = 'jatrack_employees';

// キャッシュ有効期限 (2週間)
const CACHE_TTL = 14 * 24 * 60 * 60 * 1000;
// データ操作の最小ブロック時間 (ms) - UIちらつき防止
const MIN_DB_OPERATION_TIME = 500;

// 従業員行コンポーネント（メモ化）
const EmployeeRow = React.memo(({ 
  employee, 
  days, 
  getShiftValue, 
  handleShiftChange,
  index,
  rowsLength
}: { 
  employee: Employee, 
  days: Date[], 
  getShiftValue: (employeeId: number, date: Date) => string,
  handleShiftChange: (employeeId: number, date: Date, newShift: string) => void,
  index: number,
  rowsLength: number
}) => {
  const openEmployeeEditor = () => {
    // カスタムイベントとして発火
    window.dispatchEvent(new CustomEvent('edit-employee', { detail: employee }));
  };

  return (
    <tr 
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
          onClick={openEmployeeEditor}
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
              index === rowsLength - 1 && date === days[0] && "rounded-bl-2xl",
              index === rowsLength - 1 && date === days[days.length - 1] && "rounded-br-2xl",
              index % 2 === 0 ? 'bg-white' : 'bg-slate-100'
            )}
          >
            <ShiftCell
              value={shift}
              employeeId={employee.id}
              date={date}
              rowIndex={index}
              rowsLength={rowsLength}
              onShiftChange={handleShiftChange}
            />
          </td>
        );
      })}
    </tr>
  );
}, 
(prevProps, nextProps) => {
  // カスタム比較関数 - 必要なときだけ再レンダリング
  if (prevProps.employee.id !== nextProps.employee.id) return false;
  if (prevProps.days !== nextProps.days) return false;
  if (prevProps.index !== nextProps.index) return false;
  if (prevProps.rowsLength !== nextProps.rowsLength) return false;
  
  // 比較コストが高いため、参照の比較のみで最適化
  return true;
});

// メイン日付ヘッダーコンポーネント（メモ化）
const DateHeader = React.memo(({ days }: { days: Date[] }) => {
  const isWeekend = useCallback((date: Date) => getDay(date) === 0, []);
  const isSaturday = useCallback((date: Date) => getDay(date) === 6, []);

  return (
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
  );
});

// バックグラウンドワーカーの代替：WebWorkerのないケースで使用する非同期処理キューマネージャー
class TaskQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;

  add(task: () => Promise<any>) {
    this.queue.push(task);
    
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const task = this.queue.shift();
    
    try {
      await task?.();
    } catch (error) {
      console.error('Task error:', error);
    }
    
    // 非同期で次のタスクを処理（メインスレッドをブロックしない）
    setTimeout(() => this.processQueue(), 0);
  }
}

export function ShiftGrid() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 2)); // 2025年3月
  const [shifts, setShifts] = useState<{ [key: string]: string }>({});
  const [employees, setEmployees] = useState(initialEmployees);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { getUpdatedShiftCode } = useShiftTypes();
  
  // WebWorkerの代わりにTaskQueueを使用
  const taskQueueRef = useRef(new TaskQueue());
  
  // 処理ブロックのフラグ
  const isProcessingRef = useRef(false);
  // 保存待ちの変更を管理するRef
  const pendingChangesRef = useRef<Map<string, PendingChange>>(new Map());
  // ローカルキャッシュ（レンダリング最適化用）
  const shiftsRef = useRef<{ [key: string]: string }>({});
  // シフトデータキャッシュ（月ごと）
  const shiftsCache = useRef<{
    [monthKey: string]: {
      data: { [key: string]: string };
      timestamp: number;
    }
  }>({});
  // 初期ロード完了フラグ
  const initialLoadDoneRef = useRef<{[key: string]: boolean}>({});
  // 指定された月のデータロード中フラグ
  const isLoadingMonthRef = useRef<{[key: string]: boolean}>({});

  // 初期ロード: 従業員データをローカルストレージから読み込む
  useEffect(() => {
    const storedEmployees = getFromStorage<Employee[]>(EMPLOYEES_STORAGE_KEY, initialEmployees);
    setEmployees(storedEmployees);
  }, []);

  // 従業員データが変更されたらローカルストレージに保存
  useEffect(() => {
    saveToStorage(EMPLOYEES_STORAGE_KEY, employees);
  }, [employees]);

  // カスタムイベントリスナーをセットアップ
  useEffect(() => {
    const handleEditEmployee = (e: Event) => {
      const customEvent = e as CustomEvent<Employee>;
      setSelectedEmployee(customEvent.detail);
    };
    
    window.addEventListener('edit-employee', handleEditEmployee);
    
    return () => {
      window.removeEventListener('edit-employee', handleEditEmployee);
    };
  }, []);

  // 現在の月のキーを取得（メモ化して再計算を防止）
  const currentMonthKey = useMemo(() => 
    format(currentDate, 'yyyy-MM'), 
  [currentDate]);

  // 処理ブロックを設定・解除する関数（応答性向上のためブロック時間を短縮）
  const setProcessLock = useCallback((isLocked: boolean) => {
    if (isLocked) {
      isProcessingRef.current = true;
    } else {
      // 処理ブロック解除
      isProcessingRef.current = false;
    }
  }, []);

  // 変更があった場合のみ保存状態を更新（無駄なレンダリングを防止）
  useEffect(() => {
    shiftsRef.current = shifts;
    const hasChanges = pendingChangesRef.current.size > 0;
    if (hasPendingChanges !== hasChanges) {
      setHasPendingChanges(hasChanges);
    }
  }, [shifts, hasPendingChanges]);

  // データ読み込み - 完全に手動操作のみ（初回読み込みは除く）
  const fetchData = useCallback(async (date: Date, forceReload = false) => {
    // データ操作中は何もしない（UIブロック回避）
    if (isSaving || isLoading) return;
    
    const monthKey = format(date, 'yyyy-MM');
    
    // 既に初回ロード済みで強制リロードでなければ何もしない
    if (initialLoadDoneRef.current[monthKey] && !forceReload) {
      return;
    }
    
    // 同じ月のデータをロード中なら何もしない（二重ロード防止）
    if (isLoadingMonthRef.current[monthKey]) {
      return;
    }
    
    // キャッシュがあり有効期限内なら使用（強制リロードでない場合）
    const cachedData = shiftsCache.current[monthKey];
    if (!forceReload && cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
      // 即時UI更新のための最小限のデータのみセット
      setShifts(cachedData.data);
      initialLoadDoneRef.current[monthKey] = true;
      return;
    }
    
    try {
      // データ操作中フラグON
      setIsLoading(true);
      isLoadingMonthRef.current[monthKey] = true;
      
      // 最低限の処理時間を確保して応答感向上
      const startTime = Date.now();
      
      // ローカルストレージからデータを取得
      const storageKey = `${SHIFTS_STORAGE_KEY}_${monthKey}`;
      const storedData = getFromStorage<ShiftEntry[]>(storageKey, []);

      // ブロッキング時間を最低限確保（UXのため）
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < MIN_DB_OPERATION_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_DB_OPERATION_TIME - elapsedTime));
      }

      // 高速化したデータ変換（プリアロケーション）
      const shiftMap: { [key: string]: string } = {};
      
      // データが多い場合は即座に空のマップをセット
      if (storedData.length > 200) {
        setShifts({});
      }
      
      // バックグラウンドでの非同期データ変換
      taskQueueRef.current.add(async () => {
        for (let i = 0; i < storedData.length; i++) {
          const entry = storedData[i];
          const key = `${entry.employee_id}-${entry.date}`;
          shiftMap[key] = entry.shift_code;
        }
        
        // キャッシュに保存
        shiftsCache.current[monthKey] = {
          data: { ...shiftMap },
          timestamp: Date.now()
        };
        
        // レンダリング最適化：必要な場合のみ更新
        setShifts(prev => {
          const isEqual = Object.keys(prev).length === Object.keys(shiftMap).length && 
            Object.keys(prev).every(key => prev[key] === shiftMap[key]);
          
          return isEqual ? prev : shiftMap;
        });
      });
      
      initialLoadDoneRef.current[monthKey] = true;
    } catch (err) {
      console.error('Error loading shifts:', err);
      toast.error('データの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
      isLoadingMonthRef.current[monthKey] = false;
    }
  }, [isSaving, isLoading]);

  // 初回レンダリング時のみデータを読み込む
  useEffect(() => {
    const monthKey = format(currentDate, 'yyyy-MM');
    if (!initialLoadDoneRef.current[monthKey]) {
      // 初回ロードのみデータを取得
      fetchData(currentDate);
    }
  }, [currentDate, fetchData]);

  // 日付配列のメモ化（月が変わるたびに再計算）
  const days = useMemo(() => 
    eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    }), 
  [currentDate]);

  // 月切り替え処理（手動操作のみ、自動データ取得なし）
  const handlePrevMonth = useCallback(() => {
    // UI操作は常に許可
    setCurrentDate(prev => {
      const newDate = subMonths(prev, 1);
      return newDate;
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    // UI操作は常に許可
    setCurrentDate(prev => {
      const newDate = addMonths(prev, 1);
      return newDate;
    });
  }, []);

  // データの手動更新（ボタンクリック時のみ実行）
  const handleRefreshData = useCallback(() => {
    // データ操作中は何もしない
    if (isLoading || isSaving) return;
    
    // 未保存の変更がある場合は確認
    if (pendingChangesRef.current.size > 0) {
      if (!confirm('未保存の変更があります。データを更新すると変更が失われますが、続行しますか？')) {
        return;
      }
    }
    
    // 強制的にリロード
    fetchData(currentDate, true);
    toast.info('データを最新の状態に更新しています...');
  }, [currentDate, fetchData, isLoading, isSaving]);

  // 保存処理（すべての変更を保存 - ボタンクリック時のみ実行）
  const saveAllChanges = useCallback(async () => {
    // 保存するデータがない場合やデータ操作中は何もしない
    if (pendingChangesRef.current.size === 0 || isLoading || isSaving) return;
    
    try {
      setIsSaving(true);
      
      const startTime = Date.now();
      const changes = Array.from(pendingChangesRef.current.values());
      
      // 月ごとにグループ化
      const changesByMonth: { [monthKey: string]: ShiftEntry[] } = {};
      
      // 既存データをローカルストレージから取得
      for (const change of changes) {
        const date = new Date(change.date);
        const monthKey = format(date, 'yyyy-MM');
        const storageKey = `${SHIFTS_STORAGE_KEY}_${monthKey}`;
        
        // 月ごとのデータを初期化
        if (!changesByMonth[monthKey]) {
          const existingData = getFromStorage<ShiftEntry[]>(storageKey, []);
          changesByMonth[monthKey] = existingData;
        }
        
        // 該当データが既に存在するか確認
        const existingEntryIndex = changesByMonth[monthKey].findIndex(
          entry => entry.employee_id === change.employeeId && entry.date === change.date
        );
        
        // 存在すれば更新、なければ追加
        if (existingEntryIndex >= 0) {
          changesByMonth[monthKey][existingEntryIndex].shift_code = change.shift;
        } else {
          const newId = changesByMonth[monthKey].length > 0 
            ? Math.max(...changesByMonth[monthKey].map(item => item.id)) + 1 
            : 1;
            
          changesByMonth[monthKey].push({
            id: newId,
            employee_id: change.employeeId,
            date: change.date,
            shift_code: change.shift
          });
        }
      }
      
      // 各月のデータを保存
      Object.entries(changesByMonth).forEach(([monthKey, data]) => {
        const storageKey = `${SHIFTS_STORAGE_KEY}_${monthKey}`;
        saveToStorage(storageKey, data);
      });
      
      // ブロッキング時間確保（UX改善）
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < MIN_DB_OPERATION_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_DB_OPERATION_TIME - elapsedTime));
      }
      
      // 非同期でキャッシュを更新（UIブロックを防止）
      taskQueueRef.current.add(async () => {
        // キャッシュを更新（メモリ内のみ）
        const updatedShifts = { ...shiftsRef.current };
        changes.forEach(change => {
          const key = `${change.employeeId}-${change.date}`;
          updatedShifts[key] = change.shift;
        });
        
        // キャッシュを更新
        shiftsCache.current[currentMonthKey] = {
          data: updatedShifts,
          timestamp: Date.now()
        };
      });
      
      // 保存成功後、待機変更をクリア
      pendingChangesRef.current.clear();
      setHasPendingChanges(false);
      
      toast.success('シフトを保存しました');
    } catch (err) {
      console.error('Error saving shifts:', err);
      toast.error('シフトの保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [currentMonthKey, isLoading, isSaving]);

  // シフト変更時のハンドラ - ローカル状態のみ変更
  const handleShiftChange = useCallback((employeeId: number, date: Date, newShift: string) => {
    // UIの入力は常に許可
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${employeeId}-${dateStr}`;
    
    // 同じ値なら何もしない（無駄な処理を回避）
    if (shiftsRef.current[key] === newShift) return;
    
    // UIの即時更新（直接変更で高速化）
    setShifts(prev => {
      const updated = { ...prev, [key]: newShift };
      return updated;
    });

    // 保存待ちリストに追加（ローカルのみ）
    pendingChangesRef.current.set(key, {
      employeeId,
      date: dateStr,
      shift: newShift
    });
  }, []);

  // メモ化されたシフト値取得関数
  const getShiftValue = useCallback((employeeId: number, date: Date) => {
    const key = `${employeeId}-${format(date, 'yyyy-MM-dd')}`;
    const shift = shiftsRef.current[key];
    return shift ? getUpdatedShiftCode(shift) : '−';
  }, [getUpdatedShiftCode]);

  // 全削除処理（ボタンクリック時のみ実行）
  const handleDeleteAllShifts = useCallback(async () => {
    if (isLoading || isSaving) return;
    
    try {
      setIsLoading(true);
      
      const startTime = Date.now();
      
      // 現在の月のデータを削除
      const monthKey = format(currentDate, 'yyyy-MM');
      const storageKey = `${SHIFTS_STORAGE_KEY}_${monthKey}`;
      
      // ローカルストレージから削除
      saveToStorage(storageKey, []);
      
      // ブロッキング時間確保（UX改善）
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < MIN_DB_OPERATION_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_DB_OPERATION_TIME - elapsedTime));
      }
      
      // キャッシュから削除（非同期）
      taskQueueRef.current.add(async () => {
        delete shiftsCache.current[currentMonthKey];
      });
      
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
    }
  }, [currentDate, currentMonthKey, isLoading, isSaving]);

  // 従業員関連の処理
  const handleEmployeeUpdate = useCallback((updatedEmployee: Employee) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === updatedEmployee.id ? updatedEmployee : emp
    ));
  }, []);

  const handleAddEmployee = useCallback((newEmployee: { name: string; givenName?: string }) => {
    setEmployees(prev => {
      const newId = Math.max(...prev.map(e => e.id)) + 1;
      return [...prev, { id: newId, ...newEmployee }];
    });
  }, []);

  // 状態表示のメモ化
  const displayStatus = useMemo(() => {
    if (isSaving) return `保存中... (${pendingChangesRef.current.size}件)`;
    if (isLoading) return "データを読み込み中...";
    return null;
  }, [isSaving, isLoading]);

  // 保存ボタンテキストのメモ化
  const saveButtonText = useMemo(() => {
    if (isSaving) return "保存中...";
    
    const pendingCount = pendingChangesRef.current.size;
    if (pendingCount === 0) return "保存";
    
    return `保存 (${pendingCount}件)`;
  }, [isSaving]);

  // 変更があるときの警告メッセージ
  const pendingChangesWarning = useMemo(() => {
    if (!hasPendingChanges || isSaving) return null;
    return "未保存の変更があります。「保存」ボタンを押して変更を確定してください。";
  }, [hasPendingChanges, isSaving]);

  // ボタン無効化状態のメモ化
  const isButtonDisabled = useMemo(() => 
    isLoading || isSaving,
  [isLoading, isSaving]);

  // 保存ボタン無効化状態のメモ化
  const isSaveButtonDisabled = useMemo(() => 
    isButtonDisabled || pendingChangesRef.current.size === 0,
  [isButtonDisabled]);

  // ヘッダーメモ化
  const headerComponent = useMemo(() => (
    <ShiftHeader
      currentDate={currentDate}
      shifts={shifts}
      employees={employees}
      onPrevMonth={handlePrevMonth}
      onNextMonth={handleNextMonth}
    />
  ), [currentDate, shifts, employees, handlePrevMonth, handleNextMonth]);

  // レジェンドメモ化
  const legendComponent = useMemo(() => <ShiftLegend />, []);

  return (
    <div className="min-h-screen pb-20">
      {headerComponent}
      {legendComponent}
      <div className="overflow-x-auto">
        {displayStatus && (
          <div className="flex justify-center items-center py-4 mb-4 bg-blue-50 rounded-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700 mr-2"></div>
            <span className="text-blue-700 font-medium">{displayStatus}</span>
          </div>
        )}
        
        {pendingChangesWarning && (
          <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200 text-sm">
            ⚠️ {pendingChangesWarning}
          </div>
        )}
        
        <table className="w-full border-collapse [&_td]:border-black/60 [&_th]:border-black/60 [&_td]:border-[1px] [&_th]:border-[1px] rounded-2xl overflow-hidden">
          <thead>
            <DateHeader days={days} />
          </thead>
          <tbody>
            {employees.map((employee, index) => (
              <EmployeeRow
                key={employee.id}
                employee={employee}
                days={days}
                getShiftValue={getShiftValue}
                handleShiftChange={handleShiftChange}
                index={index}
                rowsLength={employees.length}
              />
            ))}
          </tbody>
        </table>
        
        <div className="mt-4 pl-4 flex items-center gap-3 flex-wrap">
          <button
            className={cn(
              "inline-flex items-center justify-center rounded-full text-sm font-medium",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 h-10 px-4",
              isButtonDisabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => {
              setIsCreatingEmployee(true);
            }}
            disabled={isButtonDisabled}
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
            disabled={isSaveButtonDisabled}
            className={cn(
              "inline-flex items-center justify-center rounded-full text-sm font-medium",
              "transition-all duration-200 ease-in-out",
              "bg-green-600 text-white shadow-lg hover:bg-green-700 h-10 px-4",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSaveButtonDisabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saveButtonText}
          </button>
          
          <button
            onClick={handleRefreshData}
            disabled={isButtonDisabled}
            className={cn(
              "inline-flex items-center justify-center rounded-full text-sm font-medium",
              "transition-all duration-200 ease-in-out",
              "bg-blue-500 text-white shadow-lg hover:bg-blue-600 h-10 px-4",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isButtonDisabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            データ更新
          </button>
        </div>
      </div>
      
      <div className="fixed bottom-6 right-6">
        <AlertDialog>
          <AlertDialogTrigger 
            className={cn(
              "floating-delete inline-flex items-center justify-center rounded-full text-xs font-medium",
              "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "bg-destructive text-destructive-foreground shadow-lg hover:bg-destructive/90 h-10 px-4",
              isButtonDisabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={isButtonDisabled}
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
                disabled={isButtonDisabled}
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
            setSelectedEmployee(null);
          }}
          onSave={handleEmployeeUpdate}
        />
      )}
      
      <EmployeeCreator
        isOpen={isCreatingEmployee}
        onClose={() => {
          setIsCreatingEmployee(false);
        }}
        onSave={handleAddEmployee}
        currentEmployeeCount={employees.length}
      />
    </div>
  );
}