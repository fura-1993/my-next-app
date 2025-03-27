'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getStaff, getSymbols, getLocations, saveShift,
  Staff, Symbol, Location
} from '@/utils/localStorage';

export default function AddShiftPage() {
  const [date, setDate] = useState<string>('');
  const [staffId, setStaffId] = useState<number | null>(null);
  const [symbolId, setSymbolId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // マスターデータの状態
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [symbolList, setSymbolList] = useState<Symbol[]>([]);
  const [locationList, setLocationList] = useState<Location[]>([]);
  
  const router = useRouter();

  // マスターデータのロード
  useEffect(() => {
    function loadMasterData() {
      try {
        // ローカルストレージからデータ取得
        const staffData = getStaff();
        const symbolData = getSymbols();
        const locationData = getLocations();
        
        setStaffList(staffData || []);
        setSymbolList(symbolData || []);
        setLocationList(locationData || []);
      } catch (err) {
        console.error('Error loading master data:', err);
        setError('マスターデータの読み込みに失敗しました');
      }
    }
    
    loadMasterData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date || !staffId) {
      setError('日付とスタッフは必須です');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // ローカルストレージにシフトデータを保存
      saveShift({
        shift_date: date,
        staff_id: staffId,
        symbol_id: symbolId,
        location_id: locationId
      });
      
      setSuccess(true);
      
      // フォームリセット
      setDate('');
      setStaffId(null);
      setSymbolId(null);
      setLocationId(null);
      
      // 3秒後に成功メッセージをクリア
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Error adding shift:', err);
      setError('シフトの追加に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">シフト登録</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
          <p>{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4" role="alert">
          <p>シフトを登録しました！</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="date">
            日付 *
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="staff">
            スタッフ *
          </label>
          <select
            id="staff"
            value={staffId || ''}
            onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : null)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            required
          >
            <option value="">選択してください</option>
            {staffList.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.staff_name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="symbol">
            シンボル
          </label>
          <select
            id="symbol"
            value={symbolId || ''}
            onChange={(e) => setSymbolId(e.target.value ? Number(e.target.value) : null)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">選択してください</option>
            {symbolList.map((symbol) => (
              <option 
                key={symbol.id} 
                value={symbol.id}
                style={{ color: symbol.symbol_color }}
              >
                {symbol.symbol_name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="location">
            勤務地
          </label>
          <select
            id="location"
            value={locationId || ''}
            onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : null)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">選択してください</option>
            {locationList.map((location) => (
              <option key={location.id} value={location.id}>
                {location.location_name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center justify-between">
          <button
            type="submit"
            className={`bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? '保存中...' : 'シフトを登録'}
          </button>
          
          <button
            type="button"
            onClick={() => router.push('/shifts')}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            戻る
          </button>
        </div>
      </form>
    </div>
  );
} 