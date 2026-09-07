import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java') : 'java';
const classpath = [path.join(root, 'build/classes/java/main'), path.join(root, 'build/resources/main')].join(path.delimiter);
const samples = process.argv.slice(2);
if (!samples.length) throw new Error('Pass one or more representative 3D sample paths');
const browser = await chromium.launch();
try {
  for (const sample of samples) {
    const host = spawn(java, ['-cp', classpath, path.join(root, 'scripts/smoke-server.java'), path.resolve(sample), 'ply'], { stdio: ['pipe', 'pipe', 'inherit'] });
    try {
      const url = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Java host startup timed out')), 30000);
        host.stdout.once('data', data => { clearTimeout(timeout); resolve(data.toString().trim()); });
        host.once('error', error => { clearTimeout(timeout); reject(error); });
        host.once('exit', code => { clearTimeout(timeout); reject(new Error(`Java host exited: ${code}`)); });
      });
      for (let open = 0; open < 2; open++) {
        const page = await browser.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url);
        await page.waitForFunction(() => document.documentElement.dataset.jetbrainsFileDelivered === 'true');
        await page.waitForFunction(() => window.visualizer?.meshes?.length > 0);
        if (await page.locator('.bottom-right-nav').count()) throw new Error('Website footer leaked into IDE');
        if (await page.locator('[role="alert"]').count()) throw new Error('File delivery failed');
        if (errors.length) throw new Error(errors.join('\n'));
        await page.close();
      }
      console.log(`${path.basename(sample)}: decoded on first open and reopen through the standalone Java host`);
    } finally { host.stdin.end('\n'); host.kill(); }
  }
} finally { await browser.close(); }
