import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import { localDemoAuthPlugin } from './dev/local-demo-auth.mjs';

function proxyTo(target) {
  return {
    target,
    changeOrigin: true,
    secure: false,
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:3000';
  const authTarget = env.VITE_DEV_AUTH_TARGET || apiTarget;

  return {
    plugins: [tailwindcss(), localDemoAuthPlugin({ env, apiTarget })],
    base: '/',
    envPrefix: 'VITE_',
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      open: false,
      proxy: {
        '/api/v1/billing': proxyTo(env.VITE_DEV_BILLING_TARGET || 'http://localhost:3001'),
        '/api/v1/production': proxyTo(env.VITE_DEV_PRODUCTION_TARGET || 'http://localhost:3002'),
        '/auth/token': proxyTo(authTarget),
        '/api': proxyTo(apiTarget),
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      strictPort: true,
    },
    build: {
      target: 'es2022',
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
    },
  };
});
