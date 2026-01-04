import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: 
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-eval' 'unsafe-inline' https:; " +
                "style-src 'self' 'unsafe-inline' https:; " +
                "img-src 'self' data: https:; " +
                "font-src 'self' data: https:; " +
                "connect-src 'self' https: wss:;"
            }
          ]
        }
      ];
    }
    return [];
  }
};

export default nextConfig;
