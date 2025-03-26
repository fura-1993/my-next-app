'use client';

import { useState } from 'react';
import { addMonths, subMonths, format, getDate, getDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import holidays from '@holiday-jp/holiday_jp';
import { ShiftHeader } from './shift-header';
import { ShiftLegend } from './shift-legend';
import { ShiftCell } from './shift-cell';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useShiftTypes } from '@/contexts/shift-types-context';
import { Trash2, UserCog } from 'lucide-react';
import { EmployeeCreator } from './employee-creator';
import { EmployeeEditor } from './employee-editor';

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

const shiftData: { [key: string]: string } = {};

export function ShiftGrid() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 2)); // 2025年3月
  const [shifts, setShifts] = useState(shiftData);
  const [employees, setEmployees] = useState(initialEmployees);
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null);
  const [isCreatingEmployee, setIsCreatingEmployee] = useState(false);
  const { getUpdatedShiftCode } = useShiftTypes();

  const days = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleShiftChange = (employeeId: number, date: Date, newShift: string) => {
    const key = `${employeeId}-${format(date, 'yyyy-MM-dd')}`;
    setShifts(prev => ({
      ...prev,
      [key]: newShift
    }));
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

  const handleDeleteAllShifts = () => {
    setShifts({});
  };

  const handleEmployeeUpdate = (updatedEmployee: typeof employees[0]) => {
    setEmployees(prev => prev.map(emp => 
      emp.id === updatedEmployee.id ? updatedEmployee : emp
    ));
  };

  const handleAddEmployee = (newEmployee: { name: string; givenName?: string }) => {
    const newId = Math.max(...employees.map(e => e.id)) + 1;
    setEmployees(prev => [...prev, { id: newId, ...newEmployee }]);
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
        <div className="mt-4 pl-4">
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