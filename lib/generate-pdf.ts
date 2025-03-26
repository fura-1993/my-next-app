import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ShiftType } from '@/contexts/shift-types-context';

interface Employee {
  id: number;
  name: string;
  givenName?: string;
}

interface GeneratePDFProps {
  currentDate: Date;
  employees: Employee[];
  shifts: { [key: string]: string };
  shiftTypes: ShiftType[];
  days: Date[];
}

export async function generatePDF({
  currentDate,
  employees,
  shifts,
  shiftTypes,
  days,
}: GeneratePDFProps) {
  // Dynamically import pdfmake and fonts
  const [pdfMakeModule, pdfFontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts')
  ]);
  
  const pdfMake = pdfMakeModule.default;
  
  // Initialize virtual file system
  if (pdfFontsModule.pdfMake && pdfFontsModule.pdfMake.vfs) {
    pdfMake.vfs = pdfFontsModule.pdfMake.vfs;
  } else if (pdfFontsModule.default && pdfFontsModule.default.pdfMake) {
    pdfMake.vfs = pdfFontsModule.default.pdfMake.vfs;
  }

  pdfMake.fonts = {
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
    }
  };

  const getShiftValue = (employeeId: number, date: Date): string => {
    const key = `${employeeId}-${format(date, 'yyyy-MM-dd')}`;
    return shifts[key] || '−';
  }

  const getShiftColor = (code: string): string => {
    const shiftType = shiftTypes.find(type => type.code === code);
    return shiftType?.color || '#000000';
  };

  // Create table header
  const tableHeader = [
    { text: '担当者', style: 'tableHeader', alignment: 'center' },
    ...days.map(date => ({
      stack: [
        { text: format(date, 'd'), style: 'tableHeader' },
        { text: `(${format(date, 'E', { locale: ja })})`, style: 'dayOfWeek' },
      ],
      alignment: 'center',
    }))
  ];

  // Create table body
  const tableBody = employees.map(employee => [
    {
      text: employee.givenName 
        ? `${employee.name} ${employee.givenName[0]}`
        : employee.name,
      style: 'employeeName',
    },
    ...days.map(date => {
      const shift = getShiftValue(employee.id, date);
      const color = getShiftColor(shift);
      return {
        text: shift,
        alignment: 'center',
        color: color,
        fillColor: shift !== '−' ? `${color}10` : null,
      };
    })
  ]);

  // Create shift type legend
  const legendItems = shiftTypes.map(type => ({
    columns: [
      {
        width: 20,
        text: type.code,
        color: type.color,
        alignment: 'center',
        margin: [0, 2],
      },
      {
        text: type.label,
        color: type.color,
        margin: [5, 2],
      },
      {
        text: type.hours || '',
        color: '#666666',
        fontSize: 8,
        margin: [5, 3],
      }
    ]
  }));

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    header: {
      text: format(currentDate, 'yyyy年 M月度 シフト表', { locale: ja }),
      alignment: 'center',
      margin: [0, 20],
      fontSize: 18,
      bold: true,
    },
    footer: {
      text: `作成日: ${format(new Date(), 'yyyy/MM/dd HH:mm')}`,
      alignment: 'right',
      margin: [0, 0, 40, 20],
      fontSize: 8,
      color: '#666666',
    },
    content: [
      {
        layout: 'lightHorizontalLines',
        table: {
          headerRows: 1,
          widths: [
            80,
            ...Array(days.length).fill('*')
          ],
          body: [tableHeader, ...tableBody],
        },
      },
      {
        text: '勤務地一覧',
        fontSize: 12,
        bold: true,
        margin: [0, 20, 0, 10],
      },
      {
        columns: [
          {
            width: '50%',
            stack: legendItems.slice(0, Math.ceil(legendItems.length / 2)),
          },
          {
            width: '50%',
            stack: legendItems.slice(Math.ceil(legendItems.length / 2)),
          }
        ],
      }
    ],
    styles: {
      tableHeader: {
        fontSize: 10,
        bold: true,
        margin: [0, 5],
      },
      dayOfWeek: {
        fontSize: 8,
        color: '#666666',
      },
      employeeName: {
        fontSize: 10,
        margin: [5, 0],
      },
    },
  };

  return pdfMake.createPdf(docDefinition);
}