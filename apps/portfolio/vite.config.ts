import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Serves the Marzipano tour at /p/modern-museum during `vite dev` and
 * `vite preview`, mirroring the rewrite that vercel.json performs in
 * production. Without it the SPA fallback would swallow the route locally and
 * local behaviour would diverge from the deployed site.
 */
function marzipanoTourRoute(): Plugin {
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(
      (req: IncomingMessage, _res: ServerResponse, next: (err?: unknown) => void) => {
        const path = (req.url ?? '').split('?')[0];
        if (path === '/p/modern-museum' || path === '/p/modern-museum/') {
          req.url = '/tour/modern-museum/index.html';
        }
        next();
      },
    );
  };
  return {
    name: 'marzipano-tour-route',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

// Path alias mirrors tsconfig "paths" — absolute imports via "@/..." (M0.0).
export default defineConfig({
  plugins: [react(), marzipanoTourRoute()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
