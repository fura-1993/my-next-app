import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// SSRのServer ComponentやAPI Routeで呼び出す
// サーバーサイドではリクエストごとに新しいインスタンスが必要なため
// 完全なシングルトンは実装せず、効率的な方法でインスタンス化する
export const createClient = () => {
  try {
    // 環境変数が存在する場合は直接createClientを使用
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          },
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
    }
    
    // 従来の方法でCookiesを使用
    return createServerComponentClient({
      cookies,
    });
  } catch (error) {
    console.error('Supabaseサーバークライアント作成エラー:', error);
    // フォールバック
    return createServerComponentClient({
      cookies,
    });
  }
}; 