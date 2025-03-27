import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // このAPIルートはもう使用しません。クライアントサイドでPDF生成を行います。
    return NextResponse.json(
      { 
        message: 'PDF生成はクライアントサイドで行われます。このAPIルートは使用されません。',
        success: false
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('PDF生成エラー:', error);
    return NextResponse.json({ error: 'PDF生成中にエラーが発生しました' }, { status: 500 });
  }
} 