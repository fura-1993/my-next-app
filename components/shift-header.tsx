'use client';

import { ChevronLeft, ChevronRight, FileText, Mail, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import { generatePDF } from '@/lib/generate-pdf';
import { useShiftTypes } from '@/contexts/shift-types-context';

interface ShiftHeaderProps {
  currentDate: Date;
  shifts: { [key: string]: string };
  employees: Array<{ id: number; name: string; givenName?: string; }>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export function ShiftHeader({ currentDate, shifts, employees, onPrevMonth, onNextMonth }: ShiftHeaderProps) {
  const { shiftTypes } = useShiftTypes();

  const handlePDFDownload = async () => {
    const days = eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate),
    });

    const pdf = await generatePDF({
      currentDate,
      employees,
      shifts,
      shiftTypes,
      days,
    });

    pdf.download(`シフト表_${format(currentDate, 'yyyy年M月')}.pdf`);
  };

  return (
    <div>
      <div className="fixed top-0.5 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center gap-1.5">
          <Button
            onClick={handlePDFDownload}
            className="button-3d bg-gradient-to-b from-red-500 via-red-600 to-red-700 hover:from-red-600 hover:via-red-700 hover:to-red-800 text-white border-none shadow-[0_4px_10px_-2px_rgba(239,68,68,0.5)]"
            size="sm"
          >
            <span className="icon-wrapper">
              <FileText className="h-4 w-4 mr-1.5" />
            </span>
            <span>PDFで共有</span>
            <span className="icon-wrapper">
              <Share2 className="h-3 w-3 ml-1.5" />
            </span>
          </Button>
          <Button
            className="button-3d bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700 hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 text-white border-none shadow-[0_4px_10px_-2px_rgba(59,130,246,0.5)]"
            size="sm"
          >
            <span className="icon-wrapper">
              <Mail className="h-4 w-4 mr-1.5" />
            </span>
            <span>メール作成</span>
          </Button>
      </div>
      <div className="pt-10 pb-0.5 px-4 flex items-center justify-between">
        <div className="flex items-center gap-1 mx-auto">
          <Button
            variant="ghost"
            onClick={onPrevMonth}
            className="relative w-8 h-8 p-0 rounded-full transform-gpu transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              background: 'white',
              boxShadow: [
                // Base shadow
                '0 2px 4px rgba(0,0,0,0.1)',
                '0 4px 8px -2px rgba(0,0,0,0.1)',
                // Inner shadow
                'inset 0 1px 1px rgba(255,255,255,0.6)',
                'inset 0 -1px 1px rgba(0,0,0,0.1)',
                // Black outline
                '0 0 0 1.5px rgba(0,0,0,0.8)'
              ].join(','),
              transform: 'perspective(1000px) translateZ(0)'
            }}
          >
            <ChevronLeft 
              className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                color: '#000',
                filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.5))'
              }}
            />
          </Button>
          <h2
            className="relative text-sm font-black tracking-tight px-1"
            style={{
              color: '#ffffff',
              textShadow: [
                // White core
                '0 0 1px #fff',
                // Black outline
                '-1px -1px 0 #000',
                '1px -1px 0 #000',
                '-1px 1px 0 #000',
                '1px 1px 0 #000',
                // 3D layers
                '2px 2px 0 rgba(0,0,0,0.8)',
                '3px 3px 0 rgba(0,0,0,0.6)',
                '4px 4px 0 rgba(0,0,0,0.4)',
                // Ambient shadow
                '0 3px 5px rgba(0,0,0,0.4)'
              ].join(','),
              transform: [
                'perspective(1000px)',
                'translateZ(10px)',
                'rotateX(10deg)',
                'scale(0.95)'
              ].join(' '),
              transformStyle: 'preserve-3d',
              transformOrigin: 'center center'
            }}
          >
            {format(currentDate, 'yyyy年 M月 シフト表', { locale: ja })}
          </h2>
          <Button
            variant="ghost"
            onClick={onNextMonth}
            className="relative w-8 h-8 p-0 rounded-full transform-gpu transition-all duration-300 hover:scale-110 active:scale-95"
            style={{
              background: 'white',
              boxShadow: [
                // Base shadow
                '0 2px 4px rgba(0,0,0,0.1)',
                '0 4px 8px -2px rgba(0,0,0,0.1)',
                // Inner shadow
                'inset 0 1px 1px rgba(255,255,255,0.6)',
                'inset 0 -1px 1px rgba(0,0,0,0.1)',
                // Black outline
                '0 0 0 1.5px rgba(0,0,0,0.8)'
              ].join(','),
              transform: 'perspective(1000px) translateZ(0)'
            }}
          >
            <ChevronRight 
              className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                color: '#000',
                filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.5))'
              }}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}