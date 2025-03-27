import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export async function POST(req: NextRequest) {
  try {
    const { currentDate, employees, shifts, shiftTypes, days } = await req.json();

    const browser = await puppeteer.launch({
      headless: true,
    });
    
    const page = await browser.newPage();
    
    // HTMLテンプレートを生成
    const html = generateHTML(currentDate, employees, shifts, shiftTypes, days);
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // PDF生成
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px',
      },
    });
    
    await browser.close();
    
    // PDFをバイナリとして返す
    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=シフト表_${format(new Date(currentDate), 'yyyy年M月')}.pdf`,
      },
    });
  } catch (error) {
    console.error('PDF生成エラー:', error);
    return NextResponse.json({ error: 'PDF生成中にエラーが発生しました' }, { status: 500 });
  }
}

// HTMLテンプレート生成関数
function generateHTML(currentDate: string, employees: any[], shifts: any, shiftTypes: any[], days: any[]) {
  // 日付フォーマット
  const yearMonth = format(new Date(currentDate), 'yyyy年M月', { locale: ja });
  
  // 従業員とシフトのHTMLを生成
  const employeeRows = employees.map(employee => {
    const employeeShifts = days.map(day => {
      const key = `${employee.id}-${day}`;
      const shift = shifts[key] || '';
      
      // シフトタイプの情報を取得
      const shiftType = shift ? shiftTypes.find(type => type.code === shift) : null;
      const backgroundColor = shiftType ? `${shiftType.color}20` : 'white';
      const textColor = shiftType ? shiftType.color : 'black';
      
      return `
        <td class="border" style="background-color: ${backgroundColor}; color: ${textColor}">
          ${shift}
        </td>
      `;
    }).join('');
    
    return `
      <tr>
        <td class="border bg-gray-100 font-medium">${employee.name}</td>
        ${employeeShifts}
      </tr>
    `;
  }).join('');
  
  // 日付ヘッダー行を生成
  const dateHeaders = days.map(day => {
    const date = new Date(currentDate);
    date.setDate(day);
    
    const dayOfWeek = format(date, 'E', { locale: ja });
    const isWeekend = dayOfWeek === '土' || dayOfWeek === '日';
    const dayColor = isWeekend ? (dayOfWeek === '土' ? 'text-blue-600' : 'text-red-600') : '';
    
    return `
      <th class="border bg-gray-100 ${dayColor}">
        ${day}日<br>${dayOfWeek}
      </th>
    `;
  }).join('');
  
  // 完全なHTMLを返す
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>シフト表 ${yearMonth}</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif;
          margin: 0;
          padding: 20px;
        }
        .title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 16px;
          text-align: center;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: center;
        }
        th {
          background-color: #f8fafc;
          font-weight: bold;
        }
        .border {
          border: 1px solid #ddd;
        }
        .bg-gray-100 {
          background-color: #f8fafc;
        }
        .font-medium {
          font-weight: 500;
        }
        .text-blue-600 {
          color: #2563eb;
        }
        .text-red-600 {
          color: #dc2626;
        }
      </style>
    </head>
    <body>
      <div class="title">シフト表 ${yearMonth}</div>
      
      <table>
        <thead>
          <tr>
            <th class="border bg-gray-100">従業員</th>
            ${dateHeaders}
          </tr>
        </thead>
        <tbody>
          ${employeeRows}
        </tbody>
      </table>
    </body>
    </html>
  `;
} 