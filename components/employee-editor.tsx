'use client';

import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface Employee {
  id: number;
  name: string;
  given_name?: string;
}

interface EmployeeEditorProps {
  employee: Employee;
  onClose: () => void;
  onUpdate: (employee: Employee) => void;
}

export function EmployeeEditor({ employee, onClose, onUpdate }: EmployeeEditorProps) {
  const [name, setName] = useState(employee.name);
  const [givenName, setGivenName] = useState(employee.given_name || '');

  const handleSave = () => {
    onUpdate({
      ...employee,
      name,
      given_name: givenName || undefined
    });
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>従業員情報の編集</DialogTitle>
          <DialogDescription>
            従業員情報を編集して保存ボタンをクリックしてください。
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
          <Button type="submit" onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}