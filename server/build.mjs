import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.resolve(__dirname, 'src/server.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: path.resolve(__dirname, 'dist/server.js'),
  packages: 'external',
  alias: {
    '@engine': path.resolve(__dirname, '../src/engine'),
  },
  sourcemap: true,
});
console.log('Server bundle build complete: dist/server.js');
