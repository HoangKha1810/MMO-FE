const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  async rewrites() {
    const aiPrefix = process.env.INTEGRATED_AI_ROUTE_PREFIX || '/ai';
    const vpsPrefix = process.env.INTEGRATED_VPS_ROUTE_PREFIX || '/vps';
    const aiTarget = (process.env.INTEGRATED_AI_FE_TARGET || '').replace(/\/+$/, '');
    const vpsTarget = (process.env.INTEGRATED_VPS_FE_TARGET || '').replace(/\/+$/, '');
    const rules = [];

    if (aiTarget) {
      rules.push(
        { source: `${aiPrefix}`, destination: `${aiTarget}${aiPrefix}` },
        { source: `${aiPrefix}/:path*`, destination: `${aiTarget}${aiPrefix}/:path*` }
      );
    }

    if (vpsTarget) {
      rules.push(
        { source: `${vpsPrefix}`, destination: `${vpsTarget}${vpsPrefix}` },
        { source: `${vpsPrefix}/:path*`, destination: `${vpsTarget}${vpsPrefix}/:path*` }
      );
    }

    return rules;
  },
};

module.exports = nextConfig;
