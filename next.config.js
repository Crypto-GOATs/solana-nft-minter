const path = require('path');

module.exports = {
  webpack(config, { isServer }) {
    config.resolve.alias['@'] = path.resolve(__dirname);
    
    // Fix Solana Web3.js bundling issues on server
    if (isServer) {
      config.externals.push({
        '@solana/web3.js': 'commonjs @solana/web3.js',
        '@solana/spl-token': 'commonjs @solana/spl-token',
      });
    }
    
    // Ignore node-specific modules when bundling
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};