import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// クライアントコンポーネントで呼び出す
export const createBrowserClient = () => {
  try {
    // 環境変数が存在する場合は直接createClientを使用
    if (typeof window !== 'undefined' && 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        }
      );
    }
    
    // 従来の方法
    return createClientComponentClient();
  } catch (error) {
    console.error('Supabaseクライアント作成エラー:', error);
    // フォールバック
    return createClientComponentClient();
  }
}; 