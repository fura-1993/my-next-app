import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SupabaseClient } from '@supabase/supabase-js';

// SSRのServer ComponentやAPI Routeで呼び出す
// サーバーサイドではリクエストごとに新しいインスタンスが必要なため
// 完全なシングルトンは実装せず、効率的な方法でインスタンス化する
export const createClient = (): SupabaseClient => {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new Error('Supabase環境変数が設定されていません');
    }
    
    // 新しいサーバークライアントを作成
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get: (name: string) => {
            return cookies().get(name)?.value;
          },
          set: (name: string, value: string, options: { path: string; maxAge: number; domain?: string; sameSite?: string; secure?: boolean }) => {
            // サーバーサイドでは設定できないため警告を表示
            console.warn('サーバーサイドでのクッキー設定は無視されます:', name);
          },
          remove: (name: string, options: { path: string; domain?: string; sameSite?: string; secure?: boolean }) => {
            // サーバーサイドでは削除できないため警告を表示
            console.warn('サーバーサイドでのクッキー削除は無視されます:', name);
          }
        }
      }
    );
  } catch (error) {
    console.error('Supabaseサーバークライアント作成エラー:', error);
    
    // エラーが発生した場合は最もシンプルな方法でクライアントを作成
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            get: (name: string) => cookies().get(name)?.value
          }
        }
      );
    }
    
    throw new Error('Supabaseサーバークライアントを初期化できませんでした');
  }
}; 