'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export interface ShiftType {
  code: string;
  label: string;
  color: string;
  hours?: string;
}

interface ShiftTypesContextType {
  shiftTypes: ShiftType[];
  updateShiftType: (updatedType: ShiftType) => void;
  deleteShiftType: (typeToDelete: ShiftType) => void;
  addShiftType: (newType: ShiftType) => void;
  getUpdatedShiftCode: (oldCode: string) => string;
}

const ShiftTypesContext = createContext<ShiftTypesContextType | undefined>(undefined);

const defaultShiftTypes: ShiftType[] = [
  { code: '成', label: '成田969', color: '#3B82F6', hours: '8:00-17:00' },
  { code: '富', label: '富里802', color: '#16A34A', hours: '8:30-17:30' },
  { code: 'パ', label: '楽々パーキング', color: '#CA8A04', hours: '9:00-18:00' },
  { code: '植', label: '成田969植栽管理', color: '#DC2626', hours: '7:00-16:00' },
  { code: '稲', label: '稲毛長沼', color: '#7C3AED', hours: '8:00-17:00' },
  { code: '他', label: 'その他', color: '#BE185D', hours: '9:00-18:00' },
];

export function ShiftTypesProvider({ children }: { children: ReactNode }) {
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>(defaultShiftTypes);
  const [codeMap, setCodeMap] = useState<Map<string, string>>(new Map());

  const updateShiftType = (updatedType: ShiftType) => {
    const originalType = shiftTypes.find(t => t.label === updatedType.label);
    if (originalType && originalType.code !== updatedType.code) {
      setCodeMap(prev => new Map(prev).set(originalType.code, updatedType.code));
    }

    setShiftTypes(types =>
      types.map(type => 
        type.code === originalType?.code
          ? updatedType 
          : type
      )
    );
  };

  const deleteShiftType = (typeToDelete: ShiftType) => {
    setShiftTypes(prev => prev.filter(type => type.code !== typeToDelete.code));
  };

  const addShiftType = (newType: ShiftType) => {
    setShiftTypes(prev => [...prev, newType]);
  };

  const getUpdatedShiftCode = (oldCode: string): string => {
    return codeMap.get(oldCode) || oldCode;
  };

  return (
    <ShiftTypesContext.Provider value={{ 
      shiftTypes, 
      updateShiftType, 
      deleteShiftType,
      addShiftType,
      getUpdatedShiftCode 
    }}>
      {children}
    </ShiftTypesContext.Provider>
  );
}

export function useShiftTypes() {
  const context = useContext(ShiftTypesContext);
  if (context === undefined) {
    throw new Error('useShiftTypes must be used within a ShiftTypesProvider');
  }
  return context;
}