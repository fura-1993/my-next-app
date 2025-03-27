'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useShiftTypes } from '@/contexts/shift-types-context';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';

interface ShiftCellProps {
  employeeId: number;
  date: Date;
  value: string;
  onShiftChange: (employeeId: number, date: Date, shift: string) => void;
  rowIndex: number;
  rowsLength: number;
}

// シフトタイプに応じたカラークラスを取得する関数
const getColorClass = (shiftCode: string, shiftTypes: any[]) => {
  const type = shiftTypes.find(t => t.code === shiftCode);
  if (!type) return '';
  
  // 色に基づいてTailwindクラスを返す
  switch (type.code) {
    case '日': return 'bg-red-100 text-red-800';
    case '夜': return 'bg-indigo-100 text-indigo-800';
    case '休': return 'bg-gray-100 text-gray-800';
    case '有': return 'bg-emerald-100 text-emerald-800';
    case '振': return 'bg-amber-100 text-amber-800';
    default: return 'bg-white';
  }
};

// シフトセルのメモ化コンポーネント - パフォーマンス最適化
export const ShiftCell = React.memo(function ShiftCellComponent({
  employeeId,
  date,
  value,
  onShiftChange,
  rowIndex,
  rowsLength
}: ShiftCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  
  const { shiftTypes } = useShiftTypes();
  
  // 日本語の曜日名を取得
  const dayName = format(date, 'E', { locale: ja });
  const dayNumber = date.getDay();
  const isWeekend = dayNumber === 0 || dayNumber === 6;
  
  // メモ化されたセルスタイル
  const cellStyle = useMemo(() => {
    const colorClass = getColorClass(value, shiftTypes);
    
    return cn(
      "cell relative text-center h-10 w-10 select-none transition-all",
      "sm:h-9 sm:w-9 md:h-8 md:w-8",
      {
        "bg-red-50": dayNumber === 0,
        "bg-blue-50": dayNumber === 6,
        [colorClass]: colorClass,
      },
      "text-center align-middle px-1 py-1 font-medium text-base",
      rowIndex === rowsLength - 1 ? "border-b-2" : "",
      "hover:bg-opacity-80"
    );
  }, [value, dayNumber, rowIndex, rowsLength, shiftTypes]);
  
  // シフト変更ハンドラー - クリックスロットリング (300ms) 付き
  const handleClick = useCallback(() => {
    const now = Date.now();
    
    // クリックスロットリングで高速連打を防止 (300ms)
    if (now - lastClickTime < 300) return;
    
    setLastClickTime(now);
    setIsOpen(true);
  }, [lastClickTime]);
  
  const handleSelect = useCallback((shift: string) => {
    setIsOpen(false);
    
    // 連続クリック防止 (50ms)
    setTimeout(() => {
      onShiftChange(employeeId, date, shift);
    }, 50);
  }, [employeeId, date, onShiftChange]);
  
  return (
    <td className={cellStyle}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={handleClick}
            className="w-full h-full flex items-center justify-center focus:outline-none"
          >
            {value}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 min-w-max" align="center">
          <div className="grid grid-cols-5 gap-1">
            {shiftTypes.map((type) => (
              <button
                key={type.code}
                onClick={() => handleSelect(type.code)}
                className={cn(
                  "w-8 h-8 rounded flex items-center justify-center",
                  "hover:opacity-90 active:opacity-100 transition-opacity",
                  getColorClass(type.code, shiftTypes),
                  "text-sm font-medium"
                )}
              >
                {type.code}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </td>
  );
});