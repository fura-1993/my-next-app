'use client';

import { useState, useEffect } from 'react';
import { Shift, getShifts, getStaff, getSymbols, getLocations, Staff, Symbol, Location } from '@/utils/localStorage';

interface ShiftWithDetails extends Shift {
  staff?: Staff;
  symbol?: Symbol;
  location?: Location;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<ShiftWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // データ取得処理
    const loadData = () => {
      try {
        const shiftsData = getShifts();
        const staffData = getStaff();
        const symbolsData = getSymbols();
        const locationsData = getLocations();

        // シフトデータに詳細情報を付与
        const shiftsWithDetails = shiftsData.map(shift => {
          const staff = staffData.find(s => s.id === shift.staff_id);
          const symbol = shift.symbol_id ? symbolsData.find(s => s.id === shift.symbol_id) : undefined;
          const location = shift.location_id ? locationsData.find(l => l.id === shift.location_id) : undefined;

          return {
            ...shift,
            staff,
            symbol,
            location
          };
        });

        setShifts(shiftsWithDetails);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">シフト一覧</h1>
      
      {!shifts || shifts.length === 0 ? (
        <p>表示するシフトがありません</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="py-2 px-4 border">日付</th>
                <th className="py-2 px-4 border">スタッフ</th>
                <th className="py-2 px-4 border">シンボル</th>
                <th className="py-2 px-4 border">勤務地</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id}>
                  <td className="py-2 px-4 border">{new Date(shift.shift_date).toLocaleDateString('ja-JP')}</td>
                  <td className="py-2 px-4 border">{shift.staff?.staff_name || '未設定'}</td>
                  <td className="py-2 px-4 border">
                    {shift.symbol ? (
                      <span 
                        className="px-2 py-1 rounded" 
                        style={{ 
                          backgroundColor: `${shift.symbol.symbol_color}20`,
                          color: shift.symbol.symbol_color
                        }}
                      >
                        {shift.symbol.symbol_name}
                      </span>
                    ) : '未設定'}
                  </td>
                  <td className="py-2 px-4 border">{shift.location?.location_name || '未設定'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 