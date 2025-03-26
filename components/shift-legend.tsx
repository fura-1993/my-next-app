'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ShiftTypeEditor } from './shift-type-editor';
import { useShiftTypes, type ShiftType } from '@/contexts/shift-types-context';

export function ShiftLegend() {
  const { shiftTypes, updateShiftType, addShiftType } = useShiftTypes();
  const [selectedType, setSelectedType] = useState<ShiftType | null>(null);
  const [isCreatingType, setIsCreatingType] = useState(false);

  const gridCols = shiftTypes.length >= 7 ? 3 : 2;

  const handleAddClick = () => {
    setSelectedType({
      code: '',
      label: '',
      color: '#6366F1',
      hours: '9:00-18:00'
    });
    setIsCreatingType(true);
  };

  const handleSave = (shiftType: ShiftType) => {
    if (isCreatingType) {
      addShiftType(shiftType);
      setIsCreatingType(false);
    } else {
      updateShiftType(shiftType);
    }
    setSelectedType(null);
  };

  const handleShiftTypeClick = (shiftType: ShiftType) => {
    setIsCreatingType(false);
    setSelectedType(shiftType);
  };

  return (
    <div className="mb-4 px-4 metallic-plate mx-4 p-6">
      <div className="flex flex-col gap-4">
        <div className={cn(
          "grid gap-2",
          gridCols === 2 ? "grid-cols-2" : "grid-cols-3"
        )}>
          {shiftTypes.map((shift) => (
            <div
              key={shift.code}
              className="flex items-center gap-2 p-3 rounded-2xl border bg-white/95 backdrop-blur-sm cursor-pointer hover:bg-white/100 transition-all hover:shadow-xl hover:-translate-y-2 hover:scale-[1.03]"
              onClick={() => handleShiftTypeClick(shift)}
            >
              <div 
                className="shift-type-icon relative w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-base overflow-hidden"
                style={{ backgroundColor: shift.color }}
                title={shift.code}
              >
                <div className="shift-type-icon-glow" style={{ backgroundColor: shift.color }} />
                {shift.code}
              </div>
              <div>
                <div className="font-medium text-sm tracking-tight">
                  {gridCols === 3 && shift.label.length > 5 
                    ? `${shift.label.slice(0, 5)}...` 
                    : shift.label}
                </div>
                {shift.hours && (
                  <div className="text-gray-500 text-[10px] leading-tight font-medium tracking-wide">
                    {shift.hours}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button
          onClick={handleAddClick}
          className="w-full h-12 rounded-xl bg-gradient-to-b from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-600 hover:via-indigo-700 hover:to-indigo-800 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
        >
          <Plus className="w-5 h-5 mr-2" />
          勤務地を追加
        </Button>
      </div>
      {selectedType && !isCreatingType && (
        <ShiftTypeEditor
          isOpen={true}
          onClose={() => setSelectedType(null)}
          shiftType={selectedType}
          onSave={handleSave}
        />
      )}
      {isCreatingType && selectedType && (
        <ShiftTypeEditor
          isOpen={true}
          onClose={() => {
            setSelectedType(null);
            setIsCreatingType(false);
          }}
          shiftType={selectedType}
          isCreating={true}
          onSave={handleSave}
        />
      )}
    </div>
  );
}