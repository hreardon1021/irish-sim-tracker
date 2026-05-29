import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { join } from 'path';

// On GitHub Actions the base is the repo sub-path; locally it's just '/'
const base = process.env.GITHUB_ACTIONS ? '/irish-sim-tracker/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: 'serve-data',
      configureServer(server) {
        server.middlewares.use('/data', (req, res, next) => {
          const dataDir = join(process.cwd(), '..', '..', 'data');
          const filePath = join(dataDir, req.url.replace(/^\//, ''));
          try {
            const content = readFileSync(filePath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(content);
          } catch {
            next();
          }
        });
      },
    },
  ],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
});
