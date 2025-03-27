/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { 
    unoptimized: false,
    minimumCacheTTL: 604800,
    formats: ['image/avif', 'image/webp']
  },
  experimental: {
    serverComponentsExternalPackages: [],
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'framer-motion',
      'date-fns',
      'sonner',
      'lodash'
    ],
    optimizeCss: true,
    turbotrace: {
      logLevel: 'error',
      contextDirectory: __dirname
    }
  },
  staticPageGenerationTimeout: 300,
  compress: true,
  swcMinify: true,
  poweredByHeader: false,
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      encoding: false
    };
    
    return config;
  }
};

module.exports = nextConfig;
