import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import { Buffer } from 'buffer';
import fs from 'fs';
import path from 'path';

// -------------------------
// 1. 環境変数・Supabase クライアントの初期化
// -------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase の環境変数（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）が設定されていません。');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// -------------------------
// 2. PDF生成 API Route
// -------------------------
export async function GET(req: NextRequest) {
  try {
    // ◆ データ取得：シフトセル、従業員、シフトタイプをそれぞれ取得
    const { data: cells, error: errorCells } = await supabase
      .from('shift_cells')
      .select('*')
      .order('date', { ascending: true });
    if (errorCells) throw new Error(`シフトセル取得エラー: ${errorCells.message}`);

    const { data: employeesData, error: errorEmployees } = await supabase
      .from('employees')
      .select('*');
    if (errorEmployees) throw new Error(`従業員取得エラー: ${errorEmployees.message}`);

    const { data: shiftTypesData, error: errorShiftTypes } = await supabase
      .from('shift_types')
      .select('*');
    if (errorShiftTypes) throw new Error(`シフトタイプ取得エラー: ${errorShiftTypes.message}`);

    // ◆ マッピング作成：ID やコードで簡単に参照できるようにする
    const employeeMap = new Map<number, { name: string; given_name?: string }>();
    employeesData?.forEach(emp => {
      employeeMap.set(emp.id, { name: emp.name, given_name: emp.given_name });
    });
    const shiftTypeMap = new Map<string, { label: string; color: string; hours: string }>();
    shiftTypesData?.forEach(shift => {
      shiftTypeMap.set(shift.code, { label: shift.label, color: shift.color, hours: shift.hours });
    });

    // ◆ PDFDocument の初期化：A4 横、余白、圧縮有効
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 40,
      compress: true,
    });

    // ◆ 日本語対応ゴシック体の登録
    const fontPath = path.join(process.cwd(), 'fonts', 'NotoSansCJKjp-Regular.otf');
    if (!fs.existsSync(fontPath)) {
      // フォントがない場合でもエラーを投げずに続行（ログのみ出力）
      console.warn(`日本語フォントファイルが見つかりません: ${fontPath} - デフォルトフォントを使用します`);
    } else {
      doc.registerFont('NotoSans', fontPath);
      doc.font('NotoSans');
    }

    // ◆ PDF出力用バッファの設定
    const chunks: any[] = [];
    doc.on('data', (chunk: any) => chunks.push(chunk));

    // ◆ PDF生成完了までの Promise 化
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(result);
      });
      doc.on('error', (err: any) => {
        console.error('PDF生成中のエラー:', err);
        reject(err);
      });

      try {
        // ★ PDF ヘッダー：タイトル（中央配置）
        doc.fontSize(24).fillColor('black').text('勤務管理表', { align: 'center' });
        doc.moveDown(1.5);

        // ★ テーブル設定
        const tableTop = doc.y;
        const marginLeft = doc.page.margins.left;
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        // ◆ カラム幅設定（適宜調整）
        const colWidths = {
          date: 100,          // 日付
          employee: 150,      // 従業員名
          shift: 100,         // シフト記号（ラベル）
          hours: 100,         // シフト時間
        };
        // 右側に余った幅（将来的に備考等に利用可能）
        const remainingWidth = pageWidth - (colWidths.date + colWidths.employee + colWidths.shift + colWidths.hours);

        // ★ ヘッダー行描画（背景：薄いグレー）
        doc.rect(marginLeft, tableTop, pageWidth, 25).fill('#eeeeee');
        doc.fillColor('black').fontSize(12);
        let x = marginLeft + 5;
        const headerY = tableTop + 7;
        doc.text('日付', x, headerY, { width: colWidths.date - 10, align: 'center' });
        x += colWidths.date;
        doc.text('従業員', x, headerY, { width: colWidths.employee - 10, align: 'center' });
        x += colWidths.employee;
        doc.text('シフト', x, headerY, { width: colWidths.shift - 10, align: 'center' });
        x += colWidths.shift;
        doc.text('勤務時間', x, headerY, { width: colWidths.hours - 10, align: 'center' });
        if (remainingWidth > 0) {
          x += colWidths.hours;
          doc.text('備考', x, headerY, { width: remainingWidth - 10, align: 'center' });
        }
        doc.moveDown();

        // ★ テーブル本体の描画開始
        let rowY = tableTop + 30;
        doc.fontSize(10);

        // シフトセルがない場合はメッセージを表示
        if (!cells || cells.length === 0) {
          doc.moveDown();
          doc.text('シフトデータが見つかりませんでした。', { align: 'center' });
        } else {
          // 各行（交互に背景色を付与して視認性向上）
          for (const cell of cells) {
            // 安全な値の取得（存在しない場合は 'N/A'）
            const date = cell.date ? new Date(cell.date).toLocaleDateString('ja-JP') : 'N/A';
            const employee = employeeMap.get(cell.employee_id)?.name || 'N/A';
            // シフト情報：shift_types の情報を参照
            const shiftInfo = shiftTypeMap.get(cell.shift_code);
            const shiftLabel = shiftInfo ? shiftInfo.label : cell.shift_code || 'N/A';
            const shiftColor = shiftInfo ? shiftInfo.color : 'black';
            const hours = shiftInfo ? shiftInfo.hours : 'N/A';

            // 行の背景色（偶数行：薄いグレー、奇数行：白）
            const rowIndex = cells.indexOf(cell);
            const bgColor = rowIndex % 2 === 0 ? '#f9f9f9' : 'white';
            doc.rect(marginLeft, rowY - 2, pageWidth, 20).fill(bgColor);
            doc.fillColor('black');

            // 各セルの描画
            let colX = marginLeft + 5;
            const rowHeight = 18;
            // 日付
            doc.text(date, colX, rowY, { width: colWidths.date - 10, align: 'center' });
            colX += colWidths.date;
            // 従業員名
            doc.text(employee, colX, rowY, { width: colWidths.employee - 10, align: 'center' });
            colX += colWidths.employee;
            // シフト（記号）の描画：色を shift_types で設定された色で表示
            doc.fillColor(shiftColor).text(shiftLabel, colX, rowY, { width: colWidths.shift - 10, align: 'center' });
            colX += colWidths.shift;
            // 勤務時間
            doc.fillColor('black').text(hours, colX, rowY, { width: colWidths.hours - 10, align: 'center' });
            colX += colWidths.hours;
            // 備考（ここでは未利用、必要に応じて記述）
            if (remainingWidth > 0) {
              doc.text('', colX, rowY, { width: remainingWidth - 10, align: 'center' });
            }

            rowY += rowHeight;
            // ページ下部に近づいたら自動改ページ
            if (rowY > doc.page.height - doc.page.margins.bottom - 20) {
              doc.addPage({ size: 'A4', layout: 'landscape', margin: 40, compress: true });
              rowY = doc.page.margins.top;
            }
          }
        }

        // ★ PDF の書き込み終了
        doc.end();
      } catch (contentError) {
        console.error('PDFコンテンツ生成中の例外:', contentError);
        reject(contentError);
      }
    });

    // ◆ PDF をレスポンスとして返す（ダウンロード用ヘッダー付き）
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="勤務管理表.pdf"',
      },
    });
  } catch (err: any) {
    console.error('APIルート全体でのエラー:', err);
    return NextResponse.json(
      { error: err.message || '不明なエラーが発生しました。' },
      { status: 500 }
    );
  }
} 