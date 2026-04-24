#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer, version as viteVersion } from 'vite';

const startedAt = Date.now();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const infoPath = path.join(process.cwd(), 'CloudNav', '.dev-server-info.json');

const getNetworkUrls = () => Object.values(os.networkInterfaces())
  .flat()
  .filter(Boolean)
  .filter((item) => item.family === 'IPv4' && !item.internal)
  .map((item) => `http://${item.address}:${port}/`);

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const cyan = (text) => `\x1b[36m${text}\x1b[0m`;
const dim = (text) => `\x1b[2m${text}\x1b[0m`;

let server;

try {
  server = await createServer({
    server: {
      host,
      port,
      strictPort: true,
    },
  });
  await server.listen();
} catch (error) {
  if (error?.code === 'EADDRINUSE') {
    console.error(`\n${green('✖')} Port ${port} is already in use. Stop the existing dev server before starting a new one.\n`);
    process.exit(1);
  }
  throw error;
}

const localUrl = `http://localhost:${port}/`;
const networkUrls = getNetworkUrls();

await mkdir(path.dirname(infoPath), { recursive: true });
await writeFile(infoPath, JSON.stringify({
  port,
  host,
  local: localUrl,
  network: networkUrls,
  pid: process.pid,
  startedAt: new Date(startedAt).toISOString(),
}, null, 2));

console.log(`${green('✅')} Dev server info written to ${cyan('CloudNav/.dev-server-info.json')}`);
console.log(`   Local:   ${cyan(localUrl)}`);
for (const url of networkUrls) {
  console.log(`   Network: ${cyan(url)}`);
}

console.log(`\n  ${green('VITE')} v${viteVersion}  ${dim(`ready in ${Date.now() - startedAt} ms`)}\n`);
server.printUrls();
server.bindCLIShortcuts({ print: true });

const close = async () => {
  await server.close();
  process.exit(0);
};

process.on('SIGINT', close);
process.on('SIGTERM', close);
