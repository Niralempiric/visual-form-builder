import { fileURLToPath } from 'node:url';

const rawPort = process.env.API_PORT ?? '4000';
const port = Number(rawPort);
if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.');
}

/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) },
  async rewrites() {
    return [
      { source: '/health/:path*', destination: `http://127.0.0.1:${port}/health/:path*` },
      { source: '/api/v1/:path*', destination: `http://127.0.0.1:${port}/api/v1/:path*` },
    ];
  },
};

export default config;
