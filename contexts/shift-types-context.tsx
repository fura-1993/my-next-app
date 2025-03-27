'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { createBrowserClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export interface ShiftType {
  id?: number;
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
  saveAllShiftTypes: () => Promise<void>;
  isLoading: boolean;
}

const ShiftTypesContext = createContext<ShiftTypesContextType | undefined>(undefined);

const defaultShiftTypes: ShiftType[] = [
  { code: '成', label: '成田969', color: '#3B82F6', hours: '12:00-17:00' },
  { code: '富', label: '富里802', color: '#16A34A', hours: '9:00-17:30' },
  { code: '楽', label: '楽々パーキング', color: '#CA8A04', hours: '8:00-12:00' },
  { code: '植', label: '成田969植栽管理', color: '#DC2626', hours: '13:00-18:00' },
  { code: '長', label: '稲毛長沼', color: '#7C3AED', hours: '9:00-17:00' },
  { code: '他', label: 'その他', color: '#BE185D', hours: '9:00-18:00' },
];

export function ShiftTypesProvider({ children }: { children: ReactNode }) {
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [codeMap, setCodeMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createBrowserClient();

  // 初回ロード時にSupabaseからシフトタイプを取得
  useEffect(() => {
    const loadShiftTypes = async () => {
      setIsLoading(true);
      try {
        if (!supabase) {
          console.warn('Supabaseクライアントが利用できないため、デフォルト値を使用します');
          setShiftTypes(defaultShiftTypes);
          return;
        }

        const { data, error } = await supabase
          .from('shift_types')
          .select('*')
          .order('id');

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          setShiftTypes(data);
        } else {
          console.log('シフトタイプデータが存在しないため、デフォルト値を使用します');
          setShiftTypes(defaultShiftTypes);
        }
      } catch (err) {
        console.error('Error loading shift types:', err);
        toast.error('シフトタイプの読み込みに失敗しました。デフォルト値を使用します。');
        // エラー時はデフォルト値を使用
        setShiftTypes(defaultShiftTypes);
      } finally {
        setIsLoading(false);
      }
    };

    loadShiftTypes();
  }, [supabase]);

  const updateShiftType = (updatedType: ShiftType) => {
    const originalType = shiftTypes.find(t => t.id === updatedType.id || t.code === updatedType.code);
    if (originalType && originalType.code !== updatedType.code) {
      setCodeMap(prev => new Map(prev).set(originalType.code, updatedType.code));
    }

    setShiftTypes(types =>
      types.map(type => 
        (type.id === updatedType.id || type.code === originalType?.code)
          ? updatedType 
          : type
      )
    );
  };

  const deleteShiftType = (typeToDelete: ShiftType) => {
    setShiftTypes(prev => prev.filter(type => type.id !== typeToDelete.id && type.code !== typeToDelete.code));
  };

  const addShiftType = (newType: ShiftType) => {
    setShiftTypes(prev => [...prev, newType]);
  };

  const getUpdatedShiftCode = (oldCode: string): string => {
    return codeMap.get(oldCode) || oldCode;
  };

  // すべてのシフトタイプをSupabaseに保存
  const saveAllShiftTypes = async () => {
    try {
      // 古いデータを削除
      const { error: deleteError } = await supabase
        .from('shift_types')
        .delete()
        .neq('id', 0); // ダミー条件（全削除）

      if (deleteError) throw deleteError;

      // 新しいデータを挿入
      if (shiftTypes.length > 0) {
        const { error: insertError } = await supabase
          .from('shift_types')
          .insert(shiftTypes.map(type => ({
            code: type.code,
            label: type.label,
            color: type.color,
            hours: type.hours
          })));

        if (insertError) throw insertError;
      }

      toast.success('シフトタイプを保存しました');
      return;
    } catch (err) {
      console.error('Error saving shift types:', err);
      toast.error('シフトタイプの保存に失敗しました');
      throw err;
    }
  };

  return (
    <ShiftTypesContext.Provider value={{ 
      shiftTypes, 
      updateShiftType, 
      deleteShiftType,
      addShiftType,
      getUpdatedShiftCode,
      saveAllShiftTypes,
      isLoading
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