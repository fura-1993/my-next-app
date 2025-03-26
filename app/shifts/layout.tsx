import Link from 'next/link';
import { CalendarCheck, Users, PlusCircle, Database } from 'lucide-react';

export default function ShiftsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* サイドナビゲーション */}
      <div className="w-64 bg-white shadow-md">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">シフト管理</h2>
        </div>
        <nav className="mt-6">
          <Link 
            href="/shifts" 
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
          >
            <CalendarCheck className="h-5 w-5 mr-3" />
            <span>シフト一覧</span>
          </Link>
          <Link 
            href="/shifts/add" 
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
          >
            <PlusCircle className="h-5 w-5 mr-3" />
            <span>シフト登録</span>
          </Link>
          <Link 
            href="/shifts/staff" 
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
          >
            <Users className="h-5 w-5 mr-3" />
            <span>スタッフ管理</span>
          </Link>
          <Link 
            href="/shifts/master" 
            className="flex items-center px-6 py-3 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
          >
            <Database className="h-5 w-5 mr-3" />
            <span>マスタデータ</span>
          </Link>
        </nav>
      </div>
      
      {/* メインコンテンツ */}
      <div className="flex-grow">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
} 