import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';

// シングルトンインスタンスを保持する変数
let clientInstance: SupabaseClient | null = null;

// クライアントコンポーネントで呼び出す
export const createBrowserClient = () => {
  // すでにインスタンスが存在する場合は再利用
  if (clientInstance) {
    return clientInstance;
  }

  try {
    // 環境変数が存在する場合は直接createClientを使用
    if (typeof window !== 'undefined' && 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      clientInstance = createSupabaseClient(
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
      return clientInstance;
    }
    
    // 従来の方法
    clientInstance = createClientComponentClient();
    return clientInstance;
  } catch (error) {
    console.error('Supabaseクライアント作成エラー:', error);
    // フォールバック - エラーが発生してもインスタンス生成
    if (!clientInstance) {
      clientInstance = createClientComponentClient();
    }
    return clientInstance;
  }
}; 