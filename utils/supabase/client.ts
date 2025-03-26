import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// クライアントコンポーネントで呼び出す
export const createBrowserClient = () => {
  return createClientComponentClient();
}; 