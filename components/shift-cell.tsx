'use client';

import { useState, useCallback, memo } from 'react';
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

// メモ化されたシフトセルコンポーネント
const ShiftCell = memo(function ShiftCell({ shift, employeeId, date, rowType, onShiftChange }: ShiftCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { shiftTypes } = useShiftTypes();

  // currentTypeの計算を最適化
  const currentType = shift !== '−' ? shiftTypes.find(type => type.code === shift) : null;
  
  // スタイル計算を条件付きで行う
  const cellStyle = currentType ? {
    backgroundColor: lightenColor(currentType.color, 0.75),
    color: currentType.color,
    fontSize: '0.875rem',
    fontWeight: '600'
  } : { 
    backgroundColor: rowType === 'even' ? 'white' : 'rgb(241 245 249)' 
  };

  const handleCellClick = useCallback(() => {
    setIsOpen(true);
  }, []);
  
  const handleOptionClick = useCallback((e: React.MouseEvent, value: string) => {
    e.preventDefault();
    e.stopPropagation();
    onShiftChange(employeeId, date, value);
    setIsOpen(false);
  }, [employeeId, date, onShiftChange]);

  // シフトタイプのメニューオプションを事前にメモ化
  const shiftTypeOptions = useCallback(() => (
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
            "transition-all duration-150"
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
  ), [shiftTypes, handleOptionClick]);

  // ポップオーバーのコンテンツは必要な時だけレンダリング
  const renderPopoverContent = () => {
    if (!isOpen) return null;
    
    return (
      <PopoverContent 
        className="w-[200px] p-2 rounded-xl shadow-[0_20px_70px_-15px_rgba(0,0,0,0.3)] border-white/20 bg-white/95 backdrop-blur-sm"
        align="center"
      >
        {shiftTypeOptions()}
      </PopoverContent>
    );
  };

  return (
    <div 
      className="w-full h-full cursor-pointer"
      style={cellStyle}
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
        {renderPopoverContent()}
      </Popover>
    </div>
  );
});

export { ShiftCell };