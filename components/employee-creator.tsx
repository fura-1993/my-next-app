'use client';

import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface EmployeeCreatorProps {
  onClose: () => void;
  onAdd: (employee: { name: string; given_name?: string }) => void;
}

export function EmployeeCreator({ onClose, onAdd }: EmployeeCreatorProps) {
  const [name, setName] = useState('');
  const [givenName, setGivenName] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    
    onAdd({
      name: name.trim(),
      given_name: givenName.trim() || undefined
    });
    
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>新規従業員の追加</DialogTitle>
          <DialogDescription>
            新しい従業員の情報を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              氏
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="given-name" className="text-right">
              名
            </Label>
            <Input
              id="given-name"
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
              className="col-span-3"
              placeholder="(任意)"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">キャンセル</Button>
          </DialogClose>
          <Button type="submit" onClick={handleSave} disabled={!name.trim()}>追加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}