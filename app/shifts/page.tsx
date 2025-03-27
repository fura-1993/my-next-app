import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// 型定義
interface Staff {
  staff_name: string;
}

interface Symbol {
  symbol_name: string;
  symbol_color: string;
}

interface Location {
  location_name: string;
}

interface Shift {
  id: number;
  shift_date: string;
  staff_id: number;
  staff?: Staff;
  symbol_id: number;
  symbols?: Symbol;
  location_id: number;
  locations?: Location;
}

export default async function ShiftsPage() {
  // サーバーサイドでSupabaseクライアントを作成
  const supabase = createClient();

  // shiftsテーブルからデータを取得
  const { data: shifts, error } = await supabase
    .from('shifts')
    .select(`
      id,
      shift_date,
      staff_id,
      staff(staff_name),
      symbol_id,
      symbols(symbol_name, symbol_color),
      location_id,
      locations(location_name)
    `)
    .order('shift_date');

  if (error) {
    console.error('Failed to fetch shifts:', error);
    return <div>Failed to load shifts</div>;
  }

  // 型アサーション
  const typedShifts = shifts as unknown as Shift[];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">シフト一覧</h1>
      
      {!typedShifts || typedShifts.length === 0 ? (
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
              {typedShifts.map((shift) => (
                <tr key={shift.id}>
                  <td className="py-2 px-4 border">{new Date(shift.shift_date).toLocaleDateString('ja-JP')}</td>
                  <td className="py-2 px-4 border">{shift.staff?.staff_name || '未設定'}</td>
                  <td className="py-2 px-4 border">
                    {shift.symbols ? (
                      <span 
                        className="px-2 py-1 rounded" 
                        style={{ 
                          backgroundColor: `${shift.symbols.symbol_color}20`,
                          color: shift.symbols.symbol_color
                        }}
                      >
                        {shift.symbols.symbol_name}
                      </span>
                    ) : '未設定'}
                  </td>
                  <td className="py-2 px-4 border">{shift.locations?.location_name || '未設定'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 