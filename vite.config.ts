import type {IncomingMessage, ServerResponse} from 'http';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {forwardRegistration} from './register-proxy.mjs';

const MAX_BODY_BYTES = 64 * 1024;

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error('Request payload too large.');
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function registerProxyMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = req.url?.split('?')[0];
    if (pathname !== '/api/register') {
      next();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, {ok: false, error: 'Method not allowed'});
      return;
    }

    try {
      const body = await readRequestBody(req);
      const result = await forwardRegistration(body);
      sendJson(res, result.status, result.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 413, {ok: false, error: message});
    }
  };
}

function googleSheetsProxyPlugin(): Plugin {
  return {
    name: 'google-sheets-register-proxy',
    configureServer(server) {
      server.middlewares.use(registerProxyMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(registerProxyMiddleware());
    },
  };
}

const rootDir = import.meta.dirname;

const htmlInputs = {
  main: path.resolve(rootDir, 'index.html'),
  curriculum: path.resolve(rootDir, 'curriculum.html'),
  schedule: path.resolve(rootDir, 'schedule.html'),
  benefits: path.resolve(rootDir, 'benefits.html'),
  faq: path.resolve(rootDir, 'faq.html'),
  register: path.resolve(rootDir, 'register.html'),
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), googleSheetsProxyPlugin()],
    build: {
      rollupOptions: {
        input: htmlInputs,
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
