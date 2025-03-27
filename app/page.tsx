'use client';

import { ShiftGrid } from '@/components/shift-grid';
import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <div className="fixed top-14 right-4 z-50">
        <Link 
          href="/shifts" 
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow hover:bg-blue-700 transition-colors"
        >
          Supabaseシフト管理
        </Link>
      </div>
      <ShiftGrid />
    </main>
  );
}