import { resolve } from 'path';
import { defineConfig } from 'vite';

// A Netlify build without the backend address would ship a game that can never connect.
if (process.env.NETLIFY && !process.env.VITE_BACKEND_URL) {
  throw new Error('Set VITE_BACKEND_URL in Netlify (Site settings → Environment variables) to your Render URL.');
}

export default defineConfig({
  root: 'public',
  envDir: resolve('.'),
  publicDir: 'assets',
  // HMR is off because this app shares one TLS server with the game WebSocket.
  server: {
    middlewareMode: true,
    hmr: false,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        game: resolve('public/index.html'),
        controller: resolve('public/controller.html'),
      },
    },
  },
});
