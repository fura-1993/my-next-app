'use client';

import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';

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

export function ShiftGrid() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 2)); // 2025年3月
  const [shifts, setShifts] = useState<{ [key: string]: string }>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { getUpdatedShiftCode, saveAllShiftTypes } = useShiftTypes();
  const supabase = createBrowserClient();

  // 従業員データの読み込み
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('*')
          .order('id');

        if (error) throw error;

        if (data && data.length > 0) {
          setEmployees(data);
        } else {
          // データがない場合はデフォルト値を使用
          setEmployees(initialEmployees);
        }
      } catch (err) {
        console.error('Failed to fetch employees:', err);
        toast.error('従業員データの読み込みに失敗しました');
        // エラー時はデフォルト値を使用
        setEmployees(initialEmployees);
      }
    };

    fetchEmployees();
  }, [supabase]);

  // シフトデータの読み込み
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
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
    };

    fetchData();
  }, [currentDate, supabase]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleShiftChange = async (employeeId: number, date: Date, newShift: string) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${employeeId}-${dateStr}`;
    
    // 楽観的UI更新
    setShifts(prev => ({
      ...prev,
      [key]: newShift
    }));

    try {
      // まず既存のデータを確認
      const { data: existingData } = await supabase
        .from('shift_cells')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('date', dateStr)
        .maybeSingle();

      if (existingData) {
        // 既存データを更新
        const { error } = await supabase
          .from('shift_cells')
          .update({ shift_code: newShift })
          .eq('id', existingData.id);

        if (error) throw error;
      } else {
        // 新規データを作成
        const { error } = await supabase
          .from('shift_cells')
          .insert({
            employee_id: employeeId,
            date: dateStr,
            shift_code: newShift
          });

        if (error) throw error;
      }
    } catch (err) {
      console.error('Error saving shift:', err);
      toast.error('シフトの保存に失敗しました');
      
      // エラー時に元の状態に戻す
      setShifts(prev => {
        const newShifts = { ...prev };
        delete newShifts[key];
        return newShifts;
      });
    }
  };

  const getShiftValue = (employeeId: number, date: Date) => {
    const key = `${employeeId}-${format(date, 'yyyy-MM-dd')}`;
    const shift = shifts[key];
    return shift ? getUpdatedShiftCode(shift) : '−';
  };

  const isWeekend = (date: Date) => {
    const day = getDay(date);
    return day === 0;
  };

  const isSaturday = (date: Date) => getDay(date) === 6;

  const handleDeleteAllShifts = async () => {
    try {
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
      toast.success('すべてのシフトを削除しました');
    } catch (err) {
      console.error('Error deleting shifts:', err);
      toast.error('シフトの削除に失敗しました');
    }
  };

  const handleEmployeeUpdate = async (updatedEmployee: Employee) => {
    try {
      // データベース更新
      const { error } = await supabase
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
  };

  const handleAddEmployee = async (newEmployee: { name: string; given_name?: string }) => {
    try {
      // 新しい従業員をデータベースに追加
      const { data, error } = await supabase
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
  };

  // すべてのデータを保存
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // 1. シフトタイプを保存
      await saveAllShiftTypes();

      // 2. 従業員データを保存（既存のデータがあればスキップ）
      if (employees.length > 0) {
        // 現在の従業員データを削除して全て更新
        const { error: deleteError } = await supabase
          .from('employees')
          .delete()
          .neq('id', 0); // ダミー条件（全削除）

        if (deleteError) throw deleteError;

        // 従業員データを再登録
        const { error: insertError } = await supabase
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
  };

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
      
      <div className="overflow-x-auto">
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
            ))}
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