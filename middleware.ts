import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    /*
     * ここでマッチするパスを指定
     * - `/_next/` と `/api/` はシステムパスなのでマッチングから除外
     * - 静的ファイル (.css, .js, .png など) も除外
     */
    '/((?!_next|api|.*\\..*|favicon.ico).*)',
  ],
};

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const response = NextResponse.next();

  // パフォーマンスヘッダーの設定
  const headers = new Headers(response.headers);
  
  // セキュリティヘッダー
  headers.set('X-DNS-Prefetch-Control', 'on');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('X-Content-Type-Options', 'nosniff');
  
  // 重要なリソースの早期ヒント (Early Hints) - 103 Early Hints のサポート
  headers.set('Link', '</fonts/inter.woff2>; rel=preload; as=font; crossorigin=anonymous');
  
  // CDNキャッシュ設定
  if (process.env.NODE_ENV === 'production') {
    // 静的アセットのキャッシュ - Vercel Pro の CDN を活用
    headers.set('Cache-Control', 's-maxage=31536000, stale-while-revalidate=59');
  }

  // バイパスリストにあるパスのミドルウェア処理をスキップ
  const bypassList = ['/api/health'];
  if (bypassList.some(path => url.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // クライアント情報の収集（デバイスタイプなど）- 必要に応じたコンテンツ最適化に使用
  const userAgent = req.headers.get('user-agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
  
  // モバイルユーザーには最適化されたビューを提供（必要な場合）
  if (isMobile) {
    headers.set('Viewport-Width', 'width=device-width');
  }

  return NextResponse.next({
    request: {
      headers: req.headers,
    },
    headers,
  });
} 