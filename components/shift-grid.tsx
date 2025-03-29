'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense, lazy } from 'react';
import { addMonths, subMonths, format, getDate, getDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import holidays from '@holiday-jp/holiday_jp';
import { ShiftHeader } from './shift-header';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useShiftTypes } from '@/contexts/shift-types-context';
import { Trash2, UserCog, Save } from 'lucide-react';
import { createBrowserClient, fetchWithCache } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { debounce } from 'lodash';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInView } from 'react-intersection-observer';

// 遅延ロードするコンポーネント
const ShiftLegend = dynamic(() => import('./shift-legend').then(mod => ({ default: mod.ShiftLegend })), {
  ssr: false,
  loading: () => <div className="h-20 bg-gray-100 animate-pulse rounded-lg"></div>
});

const ShiftCell = dynamic(() => import('./shift-cell').then(mod => ({ default: mod.ShiftCell })), {
  ssr: false
});

const EmployeeCreator = dynamic(() => import('./employee-creator').then(mod => ({ default: mod.EmployeeCreator })), {
  ssr: false
});

const EmployeeEditor = dynamic(() => import('./employee-editor').then(mod => ({ default: mod.EmployeeEditor })), {
  ssr: false
});

// 型定義
interface ShiftEntry {
  id?: number;
  employee_id: number;
  date: string;
  shift_code: string;
}

interface Employee {
  id: number;
  name: string;
  given_name?: string;
}

interface ShiftData {
  [key: string]: string;
}

const initialEmployees = [
  { id: 1, name: '橋本' },
  { id: 2, name: '棟方' },
  { id: 3, name: '薄田' },
  { id: 4, name: '小林', given_name: '広睴' },
  { id: 5, name: '梶' },
  { id: 6, name: '寺田' },
  { id: 7, name: '山崎' },
  { id: 8, name: '小林', given_name: '利治' },
];

// パフォーマンスメトリクス
const metrics = {
  renders: 0,
  dataFetches: 0,
  lastRenderTime: 0
};

export function ShiftGrid() {
  metrics.renders++;
  const renderStart = performance.now();

  const [currentDate, setCurrentDate] = useState(new Date(2025, 2)); // 2025年3月
  const [shifts, setShifts] = useState<ShiftData>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { getUpdatedShiftCode, saveAllShiftTypes } = useShiftTypes();
  const supabaseRef = useRef<any>(null);
  const pendingShiftUpdates = useRef<Map<string, ShiftEntry>>(new Map());
  const debouncedSaveShifts = useRef<ReturnType<typeof debounce>>();
  const tableRef = useRef<HTMLDivElement | null>(null);
  
  // ビューポート検出
  const { ref: tableInViewRef, inView: tableInView } = useInView({
    threshold: 0.1,
    triggerOnce: false
  });

  // Supabaseクライアントの初期化 - コンポーネントのレンダリングをブロックしない
  useEffect(() => {
    const initSupabase = async () => {
      const client = await createBrowserClient();
      supabaseRef.current = client;
    };
    
    initSupabase();
  }, []);

  // 初期化時にデータ保存のdebounce関数を作成
  useEffect(() => {
    debouncedSaveShifts.current = debounce(async () => {
      if (!pendingShiftUpdates.current.size || !supabaseRef.current) return;
      
      try {
        // 更新が必要なデータを配列に変換
        const updates = Array.from(pendingShiftUpdates.current.values());
        
        // バルク更新処理
        const { error } = await supabaseRef.current
          .from('shift_cells')
          .upsert(updates, { onConflict: 'employee_id,date' });
        
        if (error) throw error;
        
        // 成功したら保留中のアップデートをクリア
        pendingShiftUpdates.current.clear();
      } catch (err) {
        console.error('Error bulk saving shifts:', err);
        toast.error('一部のシフトの保存に失敗しました');
      }
    }, 2000); // 2秒間の操作停止後に保存実行
    
    return () => {
      if (debouncedSaveShifts.current) {
        debouncedSaveShifts.current.cancel();
      }
    };
  }, []);
  
  // 従業員データの読み込み
  useEffect(() => {
    const fetchEmployees = async () => {
      // メモリキャッシュがあれば再利用
      if (employees.length > 0) return;
      
      try {
        if (!supabaseRef.current) {
          console.warn('Supabaseクライアントが利用できないため、デフォルト従業員データを使用します');
          setEmployees(initialEmployees);
          return;
        }
        
        metrics.dataFetches++;
        // キャッシュを利用したデータ取得
        const result = await fetchWithCache<Employee[]>(
          'employees',
          () => supabaseRef.current
            .from('employees')
            .select('*')
            .order('id'),
          300000 // 5分間キャッシュ
        );
        
        const { data, error } = result;

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          setEmployees(data);
        } else {
          console.log('従業員データが存在しないため、デフォルト値を使用します');
          setEmployees(initialEmployees);
          
          // データがない場合は初期値を保存しておく
          try {
            await supabaseRef.current.from('employees').insert(initialEmployees);
            console.log('初期従業員データを保存しました');
          } catch (insertErr) {
            console.error('初期従業員データの保存に失敗しました:', insertErr);
          }
        }
      } catch (err) {
        console.error('Failed to fetch employees:', err);
        toast.error('従業員データの読み込みに失敗しました。デフォルト値を使用します。');
        // エラー時はデフォルト値を使用
        setEmployees(initialEmployees);
      }
    };

    fetchEmployees();
  }, [employees.length]);

  // シフトデータの読み込み
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (!supabaseRef.current) {
          console.warn('Supabaseクライアントが利用できないため、シフトデータを読み込めません');
          setIsLoading(false);
          return;
        }

        // 月が変わったときのみデータ取得
        const currentMonthKey = format(currentDate, 'yyyy-MM');
        const cacheKey = `shifts_${currentMonthKey}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        
        if (cachedData) {
          setShifts(JSON.parse(cachedData));
          setIsLoading(false);
          return;
        }
        
        metrics.dataFetches++;
        // キャッシュがない場合はAPIから取得
        const startMonth = format(startOfMonth(currentDate), 'yyyy-MM-dd');
        const endMonth = format(endOfMonth(currentDate), 'yyyy-MM-dd');
        
        const cacheKeyApi = `shifts_api_${startMonth}_${endMonth}`;
        const result = await fetchWithCache(
          cacheKeyApi,
          () => supabaseRef.current
            .from('shift_cells')
            .select('*')
            .gte('date', startMonth)
            .lte('date', endMonth)
        );
        
        const { data, error } = result;

        if (error) {
          console.error('Failed to fetch shifts:', error);
          setIsLoading(false);
          return;
        }

        // シフトデータをローカル形式に変換
        const shiftMap: ShiftData = {};
        if (data && Array.isArray(data)) {
          data.forEach((entry: any) => {
            const key = `${entry.employee_id}-${entry.date}`;
            shiftMap[key] = entry.shift_code;
          });
        }

        // セッションストレージにキャッシュ
        sessionStorage.setItem(cacheKey, JSON.stringify(shiftMap));
        setShifts(shiftMap);
      } catch (err) {
        console.error('Error loading shifts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentDate]);

  // 次/前月のデータをバックグラウンドでプリフェッチ
  useEffect(() => {
    if (!tableInView || !supabaseRef.current) return;
    
    const prefetchNextMonth = async () => {
      const nextMonth = addMonths(currentDate, 1);
      const nextMonthStart = format(startOfMonth(nextMonth), 'yyyy-MM-dd');
      const nextMonthEnd = format(endOfMonth(nextMonth), 'yyyy-MM-dd');
      
      const cacheKey = `shifts_api_${nextMonthStart}_${nextMonthEnd}`;
      
      // すでにキャッシュされていれば何もしない
      if (sessionStorage.getItem(`shifts_${format(nextMonth, 'yyyy-MM')}`)) {
        return;
      }
      
      // バックグラウンドでフェッチしてキャッシュする
      fetchWithCache(
        cacheKey,
        () => supabaseRef.current
          .from('shift_cells')
          .select('*')
          .gte('date', nextMonthStart)
          .lte('date', nextMonthEnd)
      ).then(() => {
        console.log('次月のデータをプリフェッチしました');
      });
    };
    
    const prefetchPrevMonth = async () => {
      const prevMonth = subMonths(currentDate, 1);
      const prevMonthStart = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
      const prevMonthEnd = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
      
      const cacheKey = `shifts_api_${prevMonthStart}_${prevMonthEnd}`;
      
      // すでにキャッシュされていれば何もしない
      if (sessionStorage.getItem(`shifts_${format(prevMonth, 'yyyy-MM')}`)) {
        return;
      }
      
      // バックグラウンドでフェッチしてキャッシュする
      fetchWithCache(
        cacheKey,
        () => supabaseRef.current
          .from('shift_cells')
          .select('*')
          .gte('date', prevMonthStart)
          .lte('date', prevMonthEnd)
      ).then(() => {
        console.log('前月のデータをプリフェッチしました');
      });
    };
    
    // テーブルが表示されている時のみプリフェッチ
    const prefetchTimeout = setTimeout(() => {
      prefetchNextMonth();
      prefetchPrevMonth();
    }, 2000);
    
    return () => clearTimeout(prefetchTimeout);
  }, [currentDate, tableInView]);

  // 日付の計算をメモ化
  const days = useMemo(() => eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  }), [currentDate]);

  const handlePrevMonth = useCallback(() => {
    // 月が変わる前に保留中の変更をすべて保存
    if (debouncedSaveShifts.current) {
      debouncedSaveShifts.current.flush();
    }
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);
  
  const handleNextMonth = useCallback(() => {
    // 月が変わる前に保留中の変更をすべて保存
    if (debouncedSaveShifts.current) {
      debouncedSaveShifts.current.flush();
    }
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const handleShiftChange = useCallback((employeeId: number, date: Date, newShift: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${employeeId}-${dateStr}`;
    
    // 楽観的UI更新
    setShifts(prev => ({
      ...prev,
      [key]: newShift
    }));

    // 現在の月のキャッシュを更新
    const currentMonthKey = format(date, 'yyyy-MM');
    const cacheKey = `shifts_${currentMonthKey}`;
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) {
      const updatedCache = {
        ...JSON.parse(cachedData),
        [key]: newShift
      };
      sessionStorage.setItem(cacheKey, JSON.stringify(updatedCache));
    }

    // 保留中の更新データに追加
    pendingShiftUpdates.current.set(key, {
      employee_id: employeeId,
      date: dateStr,
      shift_code: newShift
    });
    
    // 遅延保存を実行
    if (debouncedSaveShifts.current) {
      debouncedSaveShifts.current();
    }
  }, []);

  const getShiftValue = useCallback((employeeId: number, date: Date) => {
    const key = `${employeeId}-${format(date, 'yyyy-MM-dd')}`;
    const shift = shifts[key];
    return shift ? getUpdatedShiftCode(shift) : '−';
  }, [shifts, getUpdatedShiftCode]);

  // ユーティリティ関数をメモ化
  const isWeekend = useCallback((date: Date) => {
    const day = getDay(date);
    return day === 0;
  }, []);

  const isSaturday = useCallback((date: Date) => getDay(date) === 6, []);

  const handleDeleteAllShifts = useCallback(async () => {
    try {
      if (!supabaseRef.current) {
        toast.error('データベース接続がありません');
        return;
      }
      
      // 現在の月のデータを削除
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');
      
      const { error } = await supabaseRef.current
        .from('shift_cells')
        .delete()
        .gte('date', startDate)
        .lte('date', endDate);
        
      if (error) throw error;
      
      // ローカルデータをクリア
      setShifts({});
      
      // キャッシュをクリア
      const currentMonthKey = format(currentDate, 'yyyy-MM');
      sessionStorage.removeItem(`shifts_${currentMonthKey}`);
      
      // 保留中の更新もクリア
      pendingShiftUpdates.current.clear();
      
      toast.success('すべてのシフトを削除しました');
    } catch (err) {
      console.error('Error deleting shifts:', err);
      toast.error('シフトの削除に失敗しました');
    }
  }, [currentDate]);

  const handleEmployeeUpdate = useCallback(async (updatedEmployee: Employee) => {
    try {
      if (!supabaseRef.current) {
        toast.error('データベース接続がありません');
        return;
      }
      
      // データベース更新
      const { error } = await supabaseRef.current
        .from('employees')
        .update({ 
          name: updatedEmployee.name,
          given_name: updatedEmployee.given_name 
        })
        .eq('id', updatedEmployee.id);

      if (error) throw error;

      // UI更新
      setEmployees(prev => prev.map(emp => 
        emp.id === updatedEmployee.id ? updatedEmployee : emp
      ));

      toast.success('従業員情報を更新しました');
    } catch (err) {
      console.error('Error updating employee:', err);
      toast.error('従業員情報の更新に失敗しました');
    }
  }, []);

  const handleAddEmployee = useCallback(async (newEmployee: { name: string; given_name?: string }) => {
    try {
      if (!supabaseRef.current) {
        toast.error('データベース接続がありません');
        return;
      }
      
      // 新しい従業員をデータベースに追加
      const { data, error } = await supabaseRef.current
        .from('employees')
        .insert({
          name: newEmployee.name,
          given_name: newEmployee.given_name
        })
        .select();

      if (error) throw error;

      if (data && data[0]) {
        // UI更新
        setEmployees(prev => [...prev, data[0]]);
        toast.success('従業員を追加しました');
      }
    } catch (err) {
      console.error('Error adding employee:', err);
      toast.error('従業員の追加に失敗しました');
    }
  }, []);

  // すべてのデータを保存
  const handleSaveAll = useCallback(async () => {
    setIsSaving(true);
    try {
      if (!supabaseRef.current) {
        toast.error('データベース接続がありません');
        setIsSaving(false);
        return;
      }
      
      // 保留中の変更をすべて保存
      if (debouncedSaveShifts.current) {
        debouncedSaveShifts.current.flush();
      }
      
      // 1. シフトタイプを保存
      await saveAllShiftTypes();

      // 2. 従業員データを保存（既存のデータがあればスキップ）
      if (employees.length > 0) {
        // 現在の従業員データを削除して全て更新
        const { error: deleteError } = await supabaseRef.current
          .from('employees')
          .delete()
          .neq('id', 0); // ダミー条件（全削除）

        if (deleteError) throw deleteError;

        // 従業員データを再登録
        const { error: insertError } = await supabaseRef.current
          .from('employees')
          .insert(employees);

        if (insertError) throw insertError;
      }

      toast.success('すべてのデータを保存しました');
    } catch (err) {
      console.error('Error saving data:', err);
      toast.error('データの保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [employees, saveAllShiftTypes]);

  // 仮想スクロール用の設定
  const rowVirtualizer = useVirtualizer({
    count: employees.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 40, // 行の高さ
    overscan: 5, // 表示範囲外の余分に描画する行数
  });

  // パフォーマンスメトリクス計測
  useEffect(() => {
    metrics.lastRenderTime = performance.now() - renderStart;
    console.log(`ShiftGrid レンダリング #${metrics.renders}: ${Math.round(metrics.lastRenderTime)}ms, データフェッチ: ${metrics.dataFetches}回`);
  });

  // 段階的レンダリングのために分割
  const renderShiftHeader = useMemo(() => (
    <div>
      <div className="flex justify-between items-center mb-4">
        <ShiftHeader
          currentDate={currentDate}
          shifts={shifts}
          employees={employees}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />
      </div>
    </div>
  ), [currentDate, shifts, employees, handlePrevMonth, handleNextMonth]);

  // 曜日ヘッダー行のレンダリング
  const renderTableHeader = useMemo(() => (
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
  ), [days, isWeekend, isSaturday]);

  return (
    <div className="min-h-screen pb-20">
      {renderShiftHeader}
      
      <Suspense fallback={<div className="h-20 bg-gray-100 animate-pulse rounded-lg"></div>}>
        <ShiftLegend />
      </Suspense>
      
      {/* 保存ボタン */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="button-3d bg-gradient-to-b from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white border-none shadow-[0_4px_10px_-2px_rgba(22,163,74,0.5)]"
          size="lg"
        >
          <span className="icon-wrapper">
            <Save className="h-5 w-5 mr-2" />
          </span>
          <span>{isSaving ? '保存中...' : 'すべて保存'}</span>
        </Button>
      </div>
      
      <div 
        className="overflow-x-auto max-h-[75vh]" 
        ref={(el) => {
          tableRef.current = el;
          tableInViewRef(el);
        }} 
        style={{ 
          contain: 'strict', // コンテンツのコンテインメントヒント
          willChange: 'transform' // GPUアクセラレーションのヒント
        }}
      >
        <table className="w-full border-collapse [&_td]:border-black/60 [&_th]:border-black/60 [&_td]:border-[1px] [&_th]:border-[1px] rounded-2xl overflow-hidden">
          {renderTableHeader}
          <tbody
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
              width: '100%',
            }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const employee = employees[virtualRow.index];
              const index = virtualRow.index;
              
              return (
                <tr 
                  key={employee.id}
                  className={index % 2 === 0 ? 'bg-white' : 'bg-slate-100'}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
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
                          'transition-all duration-300'
                        ],
                        index % 2 !== 0 && [
                          'bg-gradient-to-b from-slate-100 to-slate-200/90',
                          'border border-black/10',
                          'shadow-[0_1px_3px_rgba(0,0,0,0.03),0_2px_6px_-1px_rgba(0,0,0,0.06)]',
                          'hover:shadow-[0_2px_5px_rgba(0,0,0,0.06),0_4px_10px_-3px_rgba(0,0,0,0.1)]',
                          'hover:border-black/15',
                          'transform-gpu hover:translate-y-[-1px] hover:scale-[1.01]',
                          'transition-all duration-300'
                        ]
                      )}
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <span className="text-sm">
                        {employee.name}{employee.given_name ? `・${employee.given_name}` : ''}
                      </span>
                      <UserCog className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 ml-1 transition-opacity duration-300" />
                    </div>
                  </td>

                  {days.map(date => {
                    const rowType = index % 2 === 0 ? 'even' : 'odd';
                    return (
                      <td 
                        key={date.toString()} 
                        className="p-0 text-center w-[40px] h-[40px]"
                      >
                        <ShiftCell
                          shift={getShiftValue(employee.id, date)}
                          employeeId={employee.id}
                          date={date}
                          rowType={rowType}
                          onShiftChange={handleShiftChange}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end p-4 gap-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
              <Trash2 className="h-4 w-4 mr-2" />
              現在の月のシフトを全削除
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>シフトの全削除</AlertDialogTitle>
              <AlertDialogDescription>
                {format(currentDate, 'yyyy年M月', { locale: ja })}のシフトをすべて削除します。
                この操作は元に戻せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAllShifts} className="bg-red-600 hover:bg-red-700">
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button variant="outline" size="sm" onClick={() => setIsCreatingEmployee(true)}>
          新規スタッフ追加
        </Button>
      </div>

      {selectedEmployee && (
        <EmployeeEditor
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onUpdate={handleEmployeeUpdate}
        />
      )}

      {isCreatingEmployee && (
        <EmployeeCreator
          onClose={() => setIsCreatingEmployee(false)}
          onAdd={handleAddEmployee}
        />
      )}
    </div>
  );
}