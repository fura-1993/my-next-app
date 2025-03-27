'use client';

import { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
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
      // すでにデータがある場合は再取得しない
      if (shiftTypes.length > 0) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      // ローカルストレージでキャッシュを確認
      const cachedTypes = localStorage.getItem('shift_types');
      if (cachedTypes) {
        try {
          const parsedTypes = JSON.parse(cachedTypes);
          setShiftTypes(parsedTypes);
          setIsLoading(false);
          
          // バックグラウンドで最新データを取得（UIをブロックしない）
          fetchLatestShiftTypes();
          return;
        } catch (e) {
          // キャッシュが壊れている場合は無視
          console.warn('キャッシュデータの解析に失敗しました:', e);
        }
      }
      
      // キャッシュがない場合は通常の読み込み
      await fetchLatestShiftTypes(true);
    };
    
    // 最新のシフトタイプデータを取得
    const fetchLatestShiftTypes = async (updateUI = false) => {
      try {
        if (!supabase) {
          console.warn('Supabaseクライアントが利用できないため、デフォルト値を使用します');
          if (updateUI) {
            setShiftTypes(defaultShiftTypes);
            setIsLoading(false);
          }
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
          // キャッシュを更新
          localStorage.setItem('shift_types', JSON.stringify(data));
          
          if (updateUI) {
            setShiftTypes(data);
            setIsLoading(false);
          }
        } else {
          console.log('シフトタイプデータが存在しないため、デフォルト値を使用します');
          
          // デフォルト値をキャッシュ
          localStorage.setItem('shift_types', JSON.stringify(defaultShiftTypes));
          
          if (updateUI) {
            setShiftTypes(defaultShiftTypes);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Error loading shift types:', err);
        if (updateUI) {
          toast.error('シフトタイプの読み込みに失敗しました。デフォルト値を使用します。');
          // エラー時はデフォルト値を使用
          setShiftTypes(defaultShiftTypes);
          setIsLoading(false);
        }
      }
    };

    loadShiftTypes();
  }, [supabase, shiftTypes.length]);

  const updateShiftType = useCallback((updatedType: ShiftType) => {
    const originalType = shiftTypes.find(t => t.id === updatedType.id || t.code === updatedType.code);
    if (originalType && originalType.code !== updatedType.code) {
      setCodeMap(prev => new Map(prev).set(originalType.code, updatedType.code));
    }

    setShiftTypes(types => {
      const updatedTypes = types.map(type => 
        (type.id === updatedType.id || type.code === originalType?.code)
          ? updatedType 
          : type
      );
      // キャッシュも更新
      localStorage.setItem('shift_types', JSON.stringify(updatedTypes));
      return updatedTypes;
    });
  }, [shiftTypes]);

  const deleteShiftType = useCallback((typeToDelete: ShiftType) => {
    setShiftTypes(prev => {
      const updatedTypes = prev.filter(type => 
        type.id !== typeToDelete.id && type.code !== typeToDelete.code
      );
      // キャッシュも更新
      localStorage.setItem('shift_types', JSON.stringify(updatedTypes));
      return updatedTypes;
    });
  }, []);

  const addShiftType = useCallback((newType: ShiftType) => {
    setShiftTypes(prev => {
      const updatedTypes = [...prev, newType];
      // キャッシュも更新
      localStorage.setItem('shift_types', JSON.stringify(updatedTypes));
      return updatedTypes;
    });
  }, []);

  const getUpdatedShiftCode = useCallback((oldCode: string): string => {
    return codeMap.get(oldCode) || oldCode;
  }, [codeMap]);

  // すべてのシフトタイプをSupabaseに保存
  const saveAllShiftTypes = useCallback(async () => {
    try {
      if (!supabase) {
        toast.error('データベース接続がありません');
        return;
      }
      
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

      // キャッシュも更新
      localStorage.setItem('shift_types', JSON.stringify(shiftTypes));
      toast.success('シフトタイプを保存しました');
      return;
    } catch (err) {
      console.error('Error saving shift types:', err);
      toast.error('シフトタイプの保存に失敗しました');
      throw err;
    }
  }, [shiftTypes, supabase]);

  // コンテキスト値をメモ化して不要な再レンダリングを防止
  const contextValue = useMemo(() => ({
    shiftTypes, 
    updateShiftType, 
    deleteShiftType,
    addShiftType,
    getUpdatedShiftCode,
    saveAllShiftTypes,
    isLoading
  }), [
    shiftTypes, 
    updateShiftType, 
    deleteShiftType, 
    addShiftType, 
    getUpdatedShiftCode, 
    saveAllShiftTypes, 
    isLoading
  ]);

  return (
    <ShiftTypesContext.Provider value={contextValue}>
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