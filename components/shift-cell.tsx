'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
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

// 風船エフェクト用コンポーネント
const CellBalloon = ({ isPopped, onFinish, onClick, isBlank }: { 
  isPopped: boolean; 
  onFinish: () => void;
  onClick: () => void;
  isBlank: boolean;
}) => {
  const balloonRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isPopped) return;
    
    const timer = setTimeout(() => {
      if (balloonRef.current) {
        balloonRef.current.style.display = 'none';
      }
      onFinish();
    }, 400);
    
    return () => clearTimeout(timer);
  }, [isPopped, onFinish]);
  
  if (!isBlank || isPopped) return null;
  
  return (
    <div 
      ref={balloonRef}
      className={cn(
        "balloon-container absolute inset-0 z-10 cursor-pointer",
        isPopped && "popped"
      )}
      onClick={onClick}
    >
      <div className="balloon">
        <div className="balloon-body-white" />
        <div className="balloon-highlight" />
        <div className="balloon-highlight-secondary" />
        <div className="balloon-tie-white" />
      </div>
      
      {isPopped && (
        <>
          <div className="burst-ring" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div 
              key={i}
              className="burst-particle"
              style={{
                '--angle': `${i * 60}deg`,
                '--delay': `${i * 0.02}s`
              } as React.CSSProperties}
            />
          ))}
        </>
      )}
    </div>
  );
};

// 破裂エフェクト用コンポーネント（値入力時のフィードバック）
const BurstEffect = ({ isActive, onFinish }: { isActive: boolean; onFinish: () => void }) => {
  const effectRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isActive) return;
    
    const timer = setTimeout(() => {
      onFinish();
    }, 400);
    
    return () => clearTimeout(timer);
  }, [isActive, onFinish]);
  
  if (!isActive) return null;
  
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div className="burst-ring" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div 
          key={i}
          className="burst-particle"
          style={{
            '--angle': `${i * 60}deg`,
            '--delay': `${i * 0.02}s`
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

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
  const [showBurstEffect, setShowBurstEffect] = useState(false);
  const [isPopped, setIsPopped] = useState(false);
  
  const { shiftTypes } = useShiftTypes();
  
  // 値が未設定（風船表示）か判定
  const isBlankValue = value === '−' || value === '-';
  
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
        [colorClass]: !isBlankValue && colorClass,
      },
      "text-center align-middle px-1 py-1 font-medium text-base",
      rowIndex === rowsLength - 1 ? "border-b-2" : "",
      "hover:bg-opacity-80"
    );
  }, [value, dayNumber, rowIndex, rowsLength, shiftTypes, isBlankValue]);
  
  // シフト変更ハンドラー - クリックスロットリング (300ms) 付き
  const handleClick = useCallback(() => {
    const now = Date.now();
    
    // クリックスロットリングで高速連打を防止 (300ms)
    if (now - lastClickTime < 300) return;
    
    setLastClickTime(now);
    
    // 空セルの場合は風船をポップ
    if (isBlankValue) {
      setIsPopped(true);
      setTimeout(() => {
        setIsOpen(true);
      }, 300);
    } else {
      setIsOpen(true);
    }
  }, [lastClickTime, isBlankValue]);
  
  const handleSelect = useCallback((shift: string) => {
    setIsOpen(false);
    
    // 値が変わる場合のみエフェクト表示
    if (value !== shift) {
      setShowBurstEffect(true);
    }
    
    // 即座に値を更新
    onShiftChange(employeeId, date, shift);
  }, [employeeId, date, onShiftChange, value]);
  
  const handleEffectFinished = useCallback(() => {
    setShowBurstEffect(false);
    setIsPopped(false);
  }, []);
  
  const handleBalloonClick = useCallback(() => {
    setIsPopped(true);
    setTimeout(() => {
      setIsOpen(true);
    }, 300);
  }, []);
  
  return (
    <td className={cn(cellStyle, "overflow-hidden")}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={handleClick}
            className={cn(
              "w-full h-full flex items-center justify-center focus:outline-none",
              isBlankValue && "opacity-0"
            )}
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
      
      {/* 風船表示（空セルの場合） */}
      <CellBalloon 
        isPopped={isPopped}
        onFinish={handleEffectFinished}
        onClick={handleBalloonClick}
        isBlank={isBlankValue}
      />
      
      {/* 値入力時のバーストエフェクト */}
      <BurstEffect 
        isActive={showBurstEffect} 
        onFinish={handleEffectFinished} 
      />
    </td>
  );
});