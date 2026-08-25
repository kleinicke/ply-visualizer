import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * The align control beside "+ Add Point Cloud".
 *
 * Aligning used to be reachable only from inside one file's expanded panel,
 * which hid the operation that is about the whole scene. What is easy to get
 * silently wrong here is the gating — a control that shows up with one cloud
 * loaded, or a recolour button offered on the website where the archive is not
 * open — so that is what this pins down, along with the anchor the run uses.
 */
test.describe('Global align menu', () => {
  const smallPly = path.resolve('../testfiles/ply/test_small_mesh.ply');
  const binaryPly = path.resolve('../testfiles/ply/test_small_mesh_binary.ply');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#three-canvas');
    await page.waitForTimeout(500);
  });

  test('stays hidden until a second cloud is loaded', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles([smallPly]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);
    await expect(page.locator('#global-align-toggle')).toHaveCount(0);

    await page.locator('#hiddenFileInput').setInputFiles([binaryPly]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    await expect(page.locator('#global-align-toggle')).toBeVisible();
  });

  test('opens a menu listing every loaded cloud as a possible anchor', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles([smallPly, binaryPly]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    await expect(page.locator('#global-align-menu')).toHaveCount(0);
    await page.locator('#global-align-toggle').click();
    await expect(page.locator('#global-align-menu')).toBeVisible();

    const anchor = page.locator('#global-align-anchor');
    await expect(anchor.locator('option')).toHaveCount(2);
    // The first loaded cloud is the default anchor: that is what someone who
    // just opened a multi-scan capture almost always means by "align all".
    await expect(anchor).toHaveValue('0');

    await expect(page.locator('.global-align-run')).toBeVisible();
    await expect(page.locator('.global-align-refine')).toBeVisible();
    // Undo has nothing to undo before a run.
    await expect(page.locator('.global-align-undo')).toBeDisabled();
    // No run yet, so no progress list and no bar pretending to be at zero.
    await expect(page.locator('#global-align-menu .align-bar')).toHaveCount(0);
    await expect(page.locator('.align-row')).toHaveCount(0);
  });

  test('shares the row with a narrower add button', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles([smallPly]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(1);
    const soloWidth = (await page.locator('#add-file').boundingBox())!.width;

    await page.locator('#hiddenFileInput').setInputFiles([binaryPly]);
    await expect(page.locator('#global-align-toggle')).toBeVisible();
    const sharedWidth = (await page.locator('#add-file').boundingBox())!.width;
    const alignBox = (await page.locator('#global-align-toggle').boundingBox())!;

    expect(sharedWidth).toBeLessThan(soloWidth);
    expect(alignBox.width).toBeGreaterThan(0);
    // Same row, not stacked.
    const addBox = (await page.locator('#add-file').boundingBox())!;
    expect(Math.abs(alignBox.y - addBox.y)).toBeLessThan(4);
  });

  test('aligns every other cloud onto the selected anchor', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles([smallPly, binaryPly]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    // Move cloud 1 away so a successful run has something to undo.
    await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      const matrix = visualizer.transformationMatrices[1].clone();
      matrix.elements[12] = 3;
      visualizer.setTransformationMatrix(1, matrix);
    });

    await page.locator('#global-align-toggle').click();
    await page.locator('#global-align-anchor').selectOption('0');
    await page.locator('.global-align-run').click();

    // Whatever the solver decides, the anchor must not move and the run must
    // report per-cloud rather than fail silently. Every moving cloud gets a row
    // from the start — the checklist is seeded, not grown.
    // The checklist is seeded before the first solve, so a row existing proves
    // nothing about the run being over: wait for the row to reach a terminal
    // state, which is also what the progress bar reports.
    await expect(page.locator('.global-align-results li')).toHaveCount(1);
    await expect(page.locator('.align-row-queued, .align-row-running')).toHaveCount(0, {
      timeout: 60_000,
    });
    await expect(page.locator('#global-align-menu .align-bar')).toHaveAttribute(
      'aria-valuenow',
      '100'
    );

    // The result is the point of the row, so it must never be cut off — it
    // wraps under the name instead. A scan name plus "RMS 0.022 · overlap 37%"
    // is wider than the sidebar at any realistic width.
    const clipped = await page
      .locator('.align-detail')
      .first()
      .evaluate(element => ({
        overflowing: element.scrollWidth > element.clientWidth + 1,
        text: element.textContent ?? '',
      }));
    expect(clipped.overflowing).toBe(false);
    expect(clipped.text.length).toBeGreaterThan(0);
    const anchorMoved = await page.evaluate(() => {
      const elements = (window as any).visualizer.transformationMatrices[0].elements;
      return elements.some((value: number, index: number) => {
        const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        return Math.abs(value - identity[index]) > 1e-6;
      });
    });
    expect(anchorMoved).toBe(false);
  });

  test('offers recolouring only for an archive inside the extension', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles([smallPly, binaryPly]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);

    await page.locator('#global-align-toggle').click();
    // Two ordinary PLYs: no archive, no colouring.
    await expect(page.locator('.global-align-recolor')).toHaveCount(0);

    // An archive scan, but on the website — the process that holds the file is
    // not there, so still nothing.
    await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      visualizer.spatialFiles[0].metadata = {
        ...(visualizer.spatialFiles[0].metadata ?? {}),
        containerFileName: 'Abschnitt_A.x3a',
        embeddedScanName: 'Abschnitt_A_0001.x3r',
      };
      visualizer.updateFileList();
    });
    await expect(page.locator('.global-align-recolor')).toHaveCount(0);

    await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      visualizer.runningInVSCode = true;
      const sent: any[] = [];
      visualizer.vscode.postMessage = (message: any) => sent.push(message);
      (window as any).__sent = sent;
      visualizer.updateFileList();
    });
    await expect(page.locator('.global-align-recolor')).toBeVisible();

    await page.locator('.global-align-recolor').click();
    const sent = await page.evaluate(() => (window as any).__sent);
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('stationPipeline');
    expect(sent[0].options).toMatchObject({ register: false, colorUncolored: true });
    expect(sent[0].options.scopeScanStems).toEqual(['Abschnitt_A_0001']);

    // Pressing it seeds the progress list from the scope, so the run is legible
    // before the host has published anything back.
    await expect(page.locator('.align-scan-list .align-row')).toHaveCount(1);
    await expect(page.locator('.align-scan-list .align-row-aligned')).toHaveCount(0);

    // The host publishes each scan as it finishes; the row ticks over then.
    await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      const points = visualizer.spatialFiles[0].vertexCount;
      (window as any).stationPipelineFeature.handleStationPipelineResult(visualizer, {
        partial: true,
        updates: [
          {
            scanName: 'Abschnitt_A_0001.x3r',
            transform: null,
            partial: true,
            rawColors: new Uint8Array(points * 3).fill(200),
            frameIndices: new Uint16Array(points),
          },
        ],
      });
    });
    await expect(page.locator('.align-scan-list .align-row-aligned')).toHaveCount(1);
  });

  /**
   * A run that cannot finish should say what would finish it.
   *
   * The value is not the warning, it is the specific pair: the solver already
   * knows which two clouds are the most promising bridge, and making the user
   * hunt for that pair is most of the work. Driven through injected state so
   * the assertion is about the guidance, not about constructing a scene that
   * happens to fail.
   */
  test('names the clouds that stayed separate and opens the pair that would join them', async ({
    page,
  }) => {
    await page.locator('#hiddenFileInput').setInputFiles([smallPly, binaryPly]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    await page.locator('#global-align-toggle').click();

    // No run has failed, so nothing is offered.
    await expect(page.locator('.align-gap')).toHaveCount(0);

    await page.evaluate(() => {
      const state = (window as any).__plyRegistrationState;
      state.alignEntries = [{ index: 1, name: 'far corner', state: 'failed', detail: 'no match' }];
      state.alignDone = 1;
      state.unattachedGroups = [
        {
          indices: [1],
          names: ['far corner'],
          suggestion: {
            movingIndex: 1,
            fixedIndex: 0,
            movingName: 'far corner',
            fixedName: 'main room',
            overlapPercent: 18,
          },
        },
      ];
    });

    const gap = page.locator('.align-gap');
    await expect(gap).toBeVisible();
    await expect(gap).toContainText('far corner');
    await expect(gap).toContainText('main room');
    await expect(gap).toContainText('18%');
    await expect(page.locator('.global-align-link')).toContainText('Place this group by hand');

    // The button opens the single-pair workspace already pointed at that pair,
    // in the three-point route, so the next thing the user does is pick a point.
    await page.locator('.global-align-link').click();
    // The whole group moves, and the whole placed scene is held still.
    await expect
      .poll(() => page.evaluate(() => (window as any).__plyRegistrationState?.sourceIndex))
      .toBe(1);
    await expect
      .poll(() => page.evaluate(() => (window as any).__plyRegistrationState?.workflow))
      .toBe('coarse-fixed');
    await expect
      .poll(() => page.evaluate(() => (window as any).__plyRegistrationState?.targetIndex))
      .toBe(0);
  });

  /**
   * All three toggles ship off, and the white-balance one only exists where the
   * gains it reads do: they come from each camera band's reference patch, so a
   * scene with no camera profiles has nothing to apply.
   */
  test('offers nested, complex and band white balance, all off by default', async ({ page }) => {
    await page.locator('#hiddenFileInput').setInputFiles([smallPly, binaryPly]);
    await expect(page.locator('#file-list .file-item')).toHaveCount(2);
    await page.locator('#global-align-toggle').click();

    await expect(page.locator('.global-align-nested')).not.toBeChecked();
    await expect(page.locator('.global-align-complex')).not.toBeChecked();

    // They are two amounts of work for the same walk, so choosing one has to
    // release the other rather than leaving both claimed.
    await page.locator('.global-align-complex').check();
    await expect(page.locator('.global-align-nested')).not.toBeChecked();
    await page.locator('.global-align-nested').check();
    await expect(page.locator('.global-align-complex')).not.toBeChecked();
    await page.locator('.global-align-nested').uncheck();

    await page.locator('.align-options-toggle').click();
    // Plain PLYs carry no camera profile, so the toggle is absent rather than
    // present and inert.
    await expect(page.locator('.global-band-white-balance')).toHaveCount(0);

    await page.evaluate(() => {
      const visualizer = (window as any).visualizer;
      visualizer.cameraGroups = [{ userData: { profileName: 'Site', colorCorrection: undefined } }];
      visualizer.updateFileList();
    });
    const toggle = page.locator('.global-band-white-balance');
    await expect(toggle).toBeVisible();
    await expect(toggle).not.toBeChecked();
  });
});
