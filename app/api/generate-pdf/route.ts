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

function generateHTML(currentDate: string, employees: any[], shifts: Record<string, string>, shiftTypes: any[], days: string[]) {
  // 日付オブジェクトに変換
  const dateObj = new Date(currentDate);
  const formattedDays = days.map(day => new Date(day));
  
  // シフトの値を取得する関数
  const getShiftValue = (employeeId: number, date: Date) => {
    const key = `${employeeId}-${format(date, 'yyyy-MM-dd')}`;
    const shift = shifts[key];
    return shift || '−';
  };
  
  // シフトの色を取得する関数
  const getShiftColor = (code: string) => {
    const shiftType = shiftTypes.find(type => type.code === code);
    return shiftType?.color || '#000000';
  };

  // シフトの背景色を取得する関数（薄く）
  const getShiftBgColor = (code: string) => {
    const color = getShiftColor(code);
    // 背景色を薄くする（透明度を下げる）
    return code !== '−' ? `${color}20` : 'transparent';
  };

  // 曜日の日本語名を取得
  const getDayOfWeekClass = (date: Date) => {
    const day = date.getDay();
    if (day === 0) return 'sunday';
    if (day === 6) return 'saturday';
    return '';
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>シフト表</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
        
        body {
          font-family: 'Noto Sans JP', sans-serif;
          margin: 0;
          padding: 20px;
          background-color: white;
        }
        
        .container {
          width: 100%;
        }
        
        h1 {
          text-align: center;
          font-size: 24px;
          margin-bottom: 20px;
          font-weight: 700;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: center;
        }
        
        th {
          background-color: #f8f9fa;
          font-weight: 500;
          position: relative;
        }
        
        .employee-name {
          font-weight: 700;
          text-align: left;
          padding-left: 15px;
          background-color: #f8f9fa;
        }
        
        .sunday {
          color: #e53e3e;
        }
        
        .saturday {
          color: #3182ce;
        }
        
        .day-number {
          font-size: 14px;
          font-weight: 700;
        }
        
        .day-of-week {
          font-size: 10px;
          color: #666;
        }
        
        .shift-cell {
          font-weight: 600;
          font-size: 14px;
        }
        
        .legend {
          margin-top: 30px;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
        }
        
        .legend-item {
          display: flex;
          align-items: center;
          margin: 5px 15px;
        }
        
        .legend-color {
          width: 20px;
          height: 20px;
          margin-right: 10px;
          border-radius: 4px;
          border: 1px solid #ddd;
        }
        
        .legend-text {
          font-size: 12px;
        }
        
        .legend-hours {
          font-size: 10px;
          color: #666;
          margin-left: 5px;
        }
        
        .footer {
          margin-top: 20px;
          text-align: right;
          font-size: 10px;
          color: #666;
        }
        
        tr:nth-child(even) td:not(.employee-name) {
          background-color: #f8fafc;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${format(dateObj, 'yyyy年 M月度 シフト表', { locale: ja })}</h1>
        <table>
          <thead>
            <tr>
              <th>担当者</th>
              ${formattedDays.map(day => `
                <th class="${getDayOfWeekClass(day)}">
                  <div class="day-number">${format(day, 'd')}</div>
                  <div class="day-of-week">(${format(day, 'E', { locale: ja })})</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${employees.map((employee, index) => `
              <tr>
                <td class="employee-name">
                  ${employee.name}${employee.givenName ? ` ${employee.givenName[0]}` : ''}
                </td>
                ${formattedDays.map(day => {
                  const shift = getShiftValue(employee.id, day);
                  const color = getShiftColor(shift);
                  const bgColor = getShiftBgColor(shift);
                  return `
                    <td class="shift-cell" style="color: ${color}; background-color: ${bgColor};">
                      ${shift}
                    </td>
                  `;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="legend">
          <h2>勤務地一覧</h2>
          <div style="display: flex; flex-wrap: wrap; width: 100%;">
            ${shiftTypes.map(type => `
              <div class="legend-item">
                <div class="legend-color" style="background-color: ${type.color}20; border: 1px solid ${type.color};"></div>
                <span class="legend-text" style="color: ${type.color};">${type.code} - ${type.label}</span>
                ${type.hours ? `<span class="legend-hours">(${type.hours})</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="footer">
          作成日: ${format(new Date(), 'yyyy/MM/dd HH:mm')}
        </div>
      </div>
    </body>
    </html>
  `;
} 