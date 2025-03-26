'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { useState } from 'react';

interface EmployeeCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (employee: { name: string; givenName?: string }) => void;
  currentEmployeeCount: number;
}

export function EmployeeCreator({ isOpen, onClose, onSave, currentEmployeeCount }: EmployeeCreatorProps) {
  const [newEmployee, setNewEmployee] = useState({ name: '', givenName: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: newEmployee.name,
      givenName: newEmployee.givenName || undefined
    });
    setNewEmployee({ name: '', givenName: '' });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[280px] shadow-[0_20px_70px_-15px_rgba(0,0,0,0.3)] border-white/20 bg-white/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">新規担当者追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="name" className="text-xs">姓</Label>
            <Input
              id="name"
              value={newEmployee.name}
              onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
              className="h-8 text-sm"
              required
              maxLength={10}
              placeholder="例: 山田"
            />
          </div>
          <div>
            <Label htmlFor="givenName" className="text-xs">名 (省略可)</Label>
            <Input
              id="givenName"
              value={newEmployee.givenName}
              onChange={(e) => setNewEmployee({ ...newEmployee, givenName: e.target.value })}
              className="h-8 text-sm"
              maxLength={10}
              placeholder="例: 太郎"
            />
          </div>
          <div className="flex justify-end gap-1.5 pt-1">
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
              追加
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}