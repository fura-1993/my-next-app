import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // レスポンスの取得
  const response = NextResponse.next();
  
  // HTTP/2 プッシュヒントを追加
  response.headers.set('Link', '</fonts/inter.woff2>; rel=preload; as=font; crossorigin=anonymous');
  
  // キャッシュ最適化
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    // 静的アセットは長期キャッシュ
    if (request.nextUrl.pathname.match(/\.(js|css|woff2|jpg|png|svg|ico)$/)) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // HTML・JSONは短期キャッシュ（ステール・ワイル・リバリデート方式）
      response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    }
  } else {
    // APIルートは個別に制御 (デフォルトは無効)
    response.headers.set('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
  }
  
  // 圧縮をブラウザに任せる (Edgeでのプリ圧縮より効率的な場合)
  response.headers.delete('Content-Encoding');
  
  // CORS設定
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // セキュリティヘッダー
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Timing-Allow-Origin はパフォーマンス測定用
  response.headers.set('Timing-Allow-Origin', '*');
  
  return response;
}

// ミドルウェアを適用するパスを指定
export const config = {
  matcher: [
    // すべてのルートに適用
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 