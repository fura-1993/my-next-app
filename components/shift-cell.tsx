'use client';

import { useState, useRef, useCallback, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useShiftTypes } from '@/contexts/shift-types-context';
import { lightenColor } from '@/lib/utils';
import { Balloon } from './balloon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ShiftCellProps {
  shift: string;
  employeeId: number;
  date: Date;
  rowType: 'even' | 'odd';
  onShiftChange: (employeeId: number, date: Date, shift: string) => void;
}

function ShiftCellComponent({ shift, employeeId, date, rowType, onShiftChange }: ShiftCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { shiftTypes } = useShiftTypes();
  const lastRenderTimeRef = useRef<number>(Date.now());

  // セルスタイルをメモ化
  const { cellStyle, currentType } = useMemo(() => {
    const type = shiftTypes.find(type => type.code === shift);
    return {
      currentType: type,
      cellStyle: type ? {
        backgroundColor: lightenColor(type.color, 0.75),
        color: type.color,
        fontSize: '0.875rem',
        fontWeight: '600'
      } : undefined
    };
  }, [shift, shiftTypes]);

  // バックグラウンドスタイルをメモ化
  const backgroundStyle = useMemo(() => {
    return shift !== '−' 
      ? cellStyle 
      : { backgroundColor: rowType === 'even' ? 'white' : 'rgb(241 245 249)' };
  }, [shift, cellStyle, rowType]);

  const handleCellClick = useCallback(() => {
    // 短時間での連続クリックを防止（300ms以内の連続クリックは無視）
    const now = Date.now();
    if (now - lastRenderTimeRef.current < 300) return;
    
    lastRenderTimeRef.current = now;
    setIsOpen(true);
  }, []);
  
  const handleOptionClick = useCallback((e: React.MouseEvent, value: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // 最小限のレンダリングのために条件チェック
    if (shift !== value) {
      onShiftChange(employeeId, date, value);
    }
    
    setIsOpen(false);
  }, [employeeId, date, onShiftChange, shift]);

  return (
    <div 
      className="w-full h-full cursor-pointer"
      style={backgroundStyle}
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="flex items-center justify-center h-[40px]" onClick={handleCellClick}>
            {shift === '−' ? (
              <div className={rowType === 'even' ? '' : 'opacity-90'}>
                <Balloon onBurst={handleCellClick} isWhite={rowType === 'even'} />
              </div>
            ) : (
              shift
            )}
          </div>
        </PopoverTrigger>
        {isOpen && ( // 条件付きレンダリングで、開いているときだけ内容を生成
          <PopoverContent 
            className="w-[200px] p-2 rounded-xl shadow-[0_20px_70px_-15px_rgba(0,0,0,0.3)] border-white/20 bg-white/95 backdrop-blur-sm"
            align="center"
          >
            <div className="grid grid-cols-2 gap-1">
            {shiftTypes.map((type) => (
              <motion.button
                key={type.code}
                className={cn(
                  "w-full text-center px-2 py-2 rounded-lg",
                  "text-sm transition-transform",
                  "hover:shadow-lg hover:translate-y-[-1px] hover:scale-[1.02]",
                  "border border-white/10",
                  "shadow-[0_2px_10px_-3px_rgba(0,0,0,0.1)]",
                  "transition-all duration-150",
                  shift === type.code && "ring-2 ring-blue-500"
                )}
                style={{
                  backgroundColor: lightenColor(type.color, 0.75),
                  color: type.color
                }}
                onClick={(e) => handleOptionClick(e, type.code)}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="font-semibold text-base">{type.code}</div>
                <div className="text-[10px] truncate">{type.label}</div>
              </motion.button>
            ))}
            </div>
          </PopoverContent>
        )}
      </Popover>
    </div>
  );
}

// Reactのメモ化でコンポーネントの再レンダリングを最適化
export const ShiftCell = memo(ShiftCellComponent, (prevProps, nextProps) => {
  // propsが同じなら再レンダリングしない
  return (
    prevProps.shift === nextProps.shift &&
    prevProps.employeeId === nextProps.employeeId &&
    prevProps.date.getTime() === nextProps.date.getTime() &&
    prevProps.rowType === nextProps.rowType
    // onShiftChangeは関数なので比較しない（恒等性が保証されない）
  );
});