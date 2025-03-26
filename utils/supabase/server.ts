import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// SSRのServer ComponentやAPI Routeで呼び出す
export const createClient = () => {
  // next/headersのcookies()を使い、クッキーの読み書きが可能
  return createServerComponentClient({
    cookies,
  });
}; 