import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// クライアントコンポーネントで呼び出す
export const createBrowserClient = () => {
  // 環境変数が存在する場合は直接createClientを使用
  if (typeof window !== 'undefined' && 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  
  // 従来の方法
  return createClientComponentClient();
}; 