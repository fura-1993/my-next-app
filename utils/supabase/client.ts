import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';

// データプリフェッチ用のキャッシュ
interface DataCache {
  [key: string]: {
    data: any;
    timestamp: number;
    expires: number;
  };
}

// グローバルキャッシュオブジェクト
const dataCache: DataCache = {};
const CACHE_TTL = 60000; // 1分のキャッシュ有効期間（ミリ秒）

// シングルトンインスタンスを保持する変数
let clientInstance: SupabaseClient | null = null;
let isInitializing = false;
let initPromise: Promise<SupabaseClient> | null = null;

// パフォーマンスメトリクス
let requestCount = 0;
const requestTimings: number[] = [];

// 最適化されたクライアント生成関数
export const createBrowserClient = async (): Promise<SupabaseClient> => {
  // すでにインスタンスが存在する場合は再利用
  if (clientInstance) {
    return clientInstance;
  }

  // すでに初期化中の場合は、その結果を待つ
  if (isInitializing && initPromise) {
    return initPromise;
  }

  // 初期化プロセスを開始
  isInitializing = true;
  
  initPromise = new Promise<SupabaseClient>(async (resolve) => {
    try {
      console.log('Supabaseクライアントを初期化中...');
      const startTime = performance.now();
      
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
            },
            global: {
              // ネットワーク接続の最適化
              fetch: (...args) => {
                requestCount++;
                const startFetch = performance.now();
                
                return fetch(...args).then(res => {
                  const endFetch = performance.now();
                  requestTimings.push(endFetch - startFetch);
                  return res;
                });
              }
            },
            auth: {
              autoRefreshToken: true,
              persistSession: true,
              detectSessionInUrl: false,
            },
            // プリフェッチデータをキャッシュ
            db: {
              schema: 'public',
            }
          }
        );
      } else {
        // 従来の方法
        clientInstance = createClientComponentClient();
      }
      
      // クライアント初期化のパフォーマンスログ
      const endTime = performance.now();
      console.log(`Supabaseクライアント初期化完了: ${Math.round(endTime - startTime)}ms`);
      
      isInitializing = false;
      resolve(clientInstance);
    } catch (error) {
      console.error('Supabaseクライアント作成エラー:', error);
      
      // フォールバック - エラーが発生してもインスタンス生成
      if (!clientInstance) {
        clientInstance = createClientComponentClient();
      }
      
      isInitializing = false;
      resolve(clientInstance);
    }
  });
  
  return initPromise;
};

// 拡張されたSupabaseクエリ関数 - キャッシュ機能付き
export const fetchWithCache = async <T>(
  cacheKey: string,
  fetcher: () => Promise<{ data: T | null; error: any }>,
  ttl: number = CACHE_TTL
): Promise<{ data: T | null; error: any }> => {
  // キャッシュの存在チェック
  const cached = dataCache[cacheKey];
  const now = Date.now();
  
  if (cached && now < cached.expires) {
    // キャッシュヒット
    console.log(`[Supabase] キャッシュヒット: ${cacheKey}`);
    return { data: cached.data, error: null };
  }
  
  // キャッシュミス - データフェッチ
  console.log(`[Supabase] キャッシュミス: ${cacheKey}`);
  const start = performance.now();
  const result = await fetcher();
  const end = performance.now();
  
  console.log(`[Supabase] クエリ実行時間: ${Math.round(end - start)}ms`);
  
  if (!result.error && result.data) {
    // 新しい結果をキャッシュに保存
    dataCache[cacheKey] = {
      data: result.data,
      timestamp: now,
      expires: now + ttl
    };
  }
  
  return result;
};

// パフォーマンスデータを収集
export const getPerformanceMetrics = () => {
  const avgTime = requestTimings.length > 0 
    ? requestTimings.reduce((sum, time) => sum + time, 0) / requestTimings.length
    : 0;
    
  return {
    requestCount,
    averageRequestTime: Math.round(avgTime),
    cacheEntries: Object.keys(dataCache).length
  };
};

// キャッシュをクリア
export const clearCache = (keyPattern?: string) => {
  if (keyPattern) {
    const pattern = new RegExp(keyPattern);
    Object.keys(dataCache).forEach(key => {
      if (pattern.test(key)) {
        delete dataCache[key];
      }
    });
  } else {
    Object.keys(dataCache).forEach(key => delete dataCache[key]);
  }
}; 