import { test, expect } from '@playwright/test';

/**
 * Container formats (E57, X3A) fan out into many scans that load independently,
 * so nothing reported how long the whole file took — the extension's `/ext` line
 * stops at read+parse, and the webview only logged individual scans. The
 * accumulator emits one total once the last scan reports in.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/3d-visualizer/');
  await page.waitForFunction(() => (window as any).__plyContainerPerf !== undefined, {
    timeout: 30000,
  });
});

/** Drive N scan completions of a 3-scan container and collect the PERF lines. */
async function reportScans(page: import('@playwright/test').Page, scansToReport: number) {
  return page.evaluate((n: number) => {
    const { noteContainerScanLoaded, resetContainerPerf } = (window as any).__plyContainerPerf;
    resetContainerPerf();

    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(String(args[0]));
    };

    const container = {
      id: 'test-container',
      kind: 'e57',
      name: 'scan.e57',
      scanCount: 3,
      startedAt: Date.now() - 5000,
    };
    try {
      for (let i = 0; i < n; i++) {
        noteContainerScanLoaded(container, 1_000_000);
      }
    } finally {
      console.log = original;
    }
    return lines.filter(line => line.includes('/all'));
  }, scansToReport);
}

test('no total until every scan of the container has reported', async ({ page }) => {
  const lines = await reportScans(page, 2);
  expect(lines).toHaveLength(0);
});

test('the last scan emits one total for the whole container', async ({ page }) => {
  const lines = await reportScans(page, 3);

  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain('PERF[e57/all scan.e57]');
  expect(lines[0]).toContain('3 scans');
  // Points are summed across scans, not reported per scan.
  expect(lines[0]).toContain('3,000,000 pts');
  // Total is anchored to the extension's epoch (5s ago), not the last scan.
  const totalMs = Number(/total ([\d.]+)ms/.exec(lines[0])![1]);
  expect(totalMs).toBeGreaterThanOrEqual(5000);
  expect(totalMs).toBeLessThan(7000);
});

test('non-container loads are ignored', async ({ page }) => {
  const lines = await page.evaluate(() => {
    const { noteContainerScanLoaded, resetContainerPerf } = (window as any).__plyContainerPerf;
    resetContainerPerf();

    const captured: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      captured.push(String(args[0]));
    };
    try {
      noteContainerScanLoaded(undefined, 100);
      noteContainerScanLoaded({ id: 'x' }, 100); // malformed: no scanCount/startedAt
    } finally {
      console.log = original;
    }
    return captured.filter(line => line.includes('/all'));
  });

  expect(lines).toHaveLength(0);
});
