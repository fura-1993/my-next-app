'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { ChromePicker } from 'react-color';
import { Palette, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useShiftTypes } from '@/contexts/shift-types-context';
import type { ShiftType } from '@/contexts/shift-types-context';

interface ShiftTypeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  shiftType: ShiftType;
  onSave: (updatedShiftType: ShiftType) => void;
  isCreating?: boolean;
}

export function ShiftTypeEditor({ isOpen, onClose, shiftType, onSave, isCreating = false }: ShiftTypeEditorProps) {
  const { deleteShiftType } = useShiftTypes();
  const [editedType, setEditedType] = useState<ShiftType>(shiftType);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [timeRange, setTimeRange] = useState(() => {
    const [start, end] = (editedType.hours || '9:00-18:00').split('-').map(time => {
      const [hours] = time.split(':').map(Number);
      return hours;
    });
    return [start, end];
  });

  const formatTimeValue = (value: number) => {
    return `${value.toString().padStart(2, '0')}:00`;
  };

  const handleTimeRangeChange = (values: number[]) => {
    setTimeRange(values);
    setEditedType({
      ...editedType,
      hours: `${formatTimeValue(values[0])}-${formatTimeValue(values[1])}`
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editedType);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[240px] shadow-[0_20px_70px_-15px_rgba(0,0,0,0.3)] border-white/20 bg-white/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">勤務地{isCreating ? '追加' : '編集'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="grid grid-cols-[auto,1fr] gap-3 items-end">
            <div>
              <Label className="mb-1 block text-xs">色</Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded cursor-pointer border"
                  style={{ backgroundColor: editedType.color }}
                  onClick={() => setShowColorPicker(!showColorPicker)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowColorPicker(!showColorPicker)}
                >
                  <Palette className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="code" className="mb-1 block text-xs">記号</Label>
              <Input
                id="code"
                value={editedType.code}
                className="h-8"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 2) {
                    setEditedType({ ...editedType, code: value });
                  }
                }}
                maxLength={2}
                required
              />
            </div>
          </div>
            {showColorPicker && (
              <div className="absolute z-50">
                <div
                  className="fixed inset-0"
                  onClick={() => setShowColorPicker(false)}
                />
                <ChromePicker
                  color={editedType.color}
                  onChange={(color) => setEditedType({ ...editedType, color: color.hex })}
                />
              </div>
            )}
          
          <div>
            <Label htmlFor="label" className="text-xs">勤務地名</Label>
            <Input
              id="label"
              value={editedType.label}
              className="h-8 text-sm"
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 8) {
                  setEditedType({ ...editedType, label: value });
                }
              }}
              maxLength={8}
              required
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs">勤務時間</Label>
            <div className="pt-2 px-2">
              <Slider
                min={0}
                max={23}
                step={1}
                value={timeRange}
                onValueChange={handleTimeRangeChange}
                className="my-2"
              />
              <div className="flex justify-between text-sm text-gray-500 mt-1">
                <div>{formatTimeValue(timeRange[0])}</div>
                <div>{formatTimeValue(timeRange[1])}</div>
              </div>
            </div>
          </div>
          <div className="flex justify-between gap-1.5 pt-1">
            {!isCreating && (
              <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>勤務地の削除</AlertDialogTitle>
                    <AlertDialogDescription>
                      この勤務地を削除してもよろしいですか？
                      <br />
                      この操作は取り消せません。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        deleteShiftType(shiftType);
                        onClose();
                      }}
                    >
                      削除する
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <div className="flex gap-1.5 ml-auto">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                size="sm"
                className="h-7 px-2.5 text-xs"
              >
                キャンセル
              </Button>
              <Button 
                type="submit" 
                size="sm"
                className="h-7 px-2.5 text-xs bg-gradient-to-b from-primary/90 to-primary shadow-lg"
              >
                {isCreating ? '追加' : '保存'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}