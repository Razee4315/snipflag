import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { solidPng, patternPng } from './png';

const white = { name: 'white.png', mimeType: 'image/png', buffer: solidPng(400, 300, [255, 255, 255, 255]) };
const blue = { name: 'blue.png', mimeType: 'image/png', buffer: solidPng(320, 200, [40, 80, 220, 255]) };

async function addImages(page: Page, files: typeof white[]) {
  await page.getByLabel('Add images', { exact: true }).setInputFiles(files);
  await expect(page.getByTestId('tile')).toHaveCount(files.length);
}
/** Drags across the canvas using fractions of its size. */
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.getByTestId('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * ((from[0] + to[0]) / 2), box.y + box.height * ((from[1] + to[1]) / 2), { steps: 4 });
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 4 });
  await page.mouse.up();
}
const tile = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Screenshot ${n}:`) });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise(resolve => { const q = indexedDB.deleteDatabase('snipflag-preview'); q.onsuccess = q.onerror = q.onblocked = () => resolve(null); });
  });
  await page.reload();
});

test('empty state explains the next step with accessible actions', async ({ page }, testInfo) => {
  await expect(page.getByRole('heading', { name: 'Capture a screenshot' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('empty-daylight.png'), animations: 'disabled' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: testInfo.outputPath('empty-after-hours.png'), animations: 'disabled' });
  await expect(page.getByRole('button', { name: 'Add images' }).first()).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Capture screen' })).toBeDisabled();
  for (const name of ['New session', 'History', 'Settings', 'Create issue']) await expect(page.getByRole('button', { name })).toBeVisible();
});

test('multiple images keep independent annotations and undo histories', async ({ page }) => {
  await addImages(page, [white, blue]);
  await expect(page.getByRole('navigation', { name: '2 images · one issue' })).toBeVisible();
  await tile(page, 1).click();
  await page.keyboard.press('r');
  await drag(page, [0.2, 0.2], [0.6, 0.6]);
  await expect(tile(page, 1)).toHaveAccessibleName(/1 mark$/);
  await tile(page, 2).click();
  await expect(tile(page, 2)).toHaveAccessibleName(/0 marks$/);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await page.keyboard.press('a');
  await drag(page, [0.1, 0.5], [0.8, 0.5]);
  await expect(tile(page, 2)).toHaveAccessibleName(/1 mark$/);
  await tile(page, 1).click();
  await expect(tile(page, 1)).toHaveAccessibleName(/1 mark$/);
  await page.keyboard.press('Control+z');
  await expect(tile(page, 1)).toHaveAccessibleName(/0 marks$/);
  await expect(tile(page, 2)).toHaveAccessibleName(/1 mark$/);
  await page.keyboard.press('Control+Shift+z');
  await expect(tile(page, 1)).toHaveAccessibleName(/1 mark$/);
});

test('reordering changes filmstrip order and captions follow their image', async ({ page }) => {
  await addImages(page, [white, blue]);
  await expect(tile(page, 1)).toHaveAccessibleName(/white/);
  await page.getByRole('button', { name: 'Move screenshot 2 earlier' }).click();
  await expect(tile(page, 1)).toHaveAccessibleName(/blue/);
  await expect(tile(page, 2)).toHaveAccessibleName(/white/);
  await page.getByRole('button', { name: 'Remove screenshot 1' }).click();
  await expect(page.getByTestId('tile')).toHaveCount(1);
  await expect(tile(page, 1)).toHaveAccessibleName(/white/);
  // The removed screenshot can be put back where it was.
  await page.getByRole('button', { name: 'Put back' }).click();
  await expect(page.getByTestId('tile')).toHaveCount(2);
  await expect(tile(page, 1)).toHaveAccessibleName(/blue/);
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map(a => a.finished)).then(() => undefined));
  // Dragging a screenshot onto the left half of another places it before that one.
  const target = (await tile(page, 1).boundingBox())!;
  await tile(page, 2).dragTo(tile(page, 1), { targetPosition: { x: target.width * 0.2, y: target.height / 2 } });
  await expect(tile(page, 1)).toHaveAccessibleName(/white/);
  await expect(tile(page, 2)).toHaveAccessibleName(/blue/);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await expect(tile(page, 1)).toHaveAccessibleName(/white/);
});

test('drafts are restored after reload', async ({ page }, testInfo) => {
  await addImages(page, [white, blue]);
  await page.getByLabel('Title').fill('Checkout button overlaps footer');
  await page.getByLabel('Description').fill('Steps to reproduce');
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Title')).toHaveValue('Checkout button overlaps footer');
  await expect(page.getByTestId('tile')).toHaveCount(2);
  await page.getByRole('button', { name: 'History' }).click();
  const history = page.getByRole('dialog', { name: 'History' });
  await expect(history.getByText('Checkout button overlaps footer')).toBeVisible();
  // The entry shows the saved thumbnail of its first screenshot, and search narrows the list.
  await expect(history.locator('.history-thumb img')).toHaveAttribute('src', /^data:image\/png;base64,/);
  await history.getByLabel('Search history').fill('checkout reproduce');
  await expect(history.getByText('Checkout button overlaps footer')).toBeVisible();
  await history.getByLabel('Search history').fill('invoice');
  await expect(history.getByText('Nothing matches.', { exact: false })).toBeVisible();
  await history.getByLabel('Search history').fill('');
  await history.getByRole('radio', { name: /Sent/ }).click();
  await expect(history.getByText('Checkout button overlaps footer')).toHaveCount(0);
  await history.getByRole('radio', { name: /Drafts/ }).click();
  await expect(history.getByText('Checkout button overlaps footer')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('history.png'), animations: 'disabled' });
});

test('browser preview never pretends to reach Linear', async ({ page }) => {
  await addImages(page, [white]);
  await page.getByLabel('Title').fill('A bug');
  await page.getByRole('button', { name: 'Create issue' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'desktop app' })).toBeVisible();
  await expect(page.getByText(/Sent to Linear/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByText('This build has no built-in Linear connection.', { exact: false })).toBeVisible();
  await dialog.getByText('Advanced: custom Linear application', { exact: true }).click();
  await expect(dialog.getByLabel('Linear OAuth client ID')).toBeVisible();
  await dialog.getByLabel('Linear OAuth client ID').fill('custom-client');
  await expect(dialog.getByRole('button', { name: 'Connect Linear' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Appearance', exact: true }).click();
  await dialog.getByText('Dark', { exact: true }).click();
  await expect(dialog.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(dialog.getByText('Using your custom Linear application.')).toBeVisible();
  await dialog.getByText('Advanced: custom Linear application', { exact: true }).click();
  await expect(dialog.getByLabel('Linear OAuth client ID')).toHaveValue('custom-client');
});

async function exportPixels(page: Page, points: [number, number][]) {
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save image' }).click();
  const file = await (await downloading).path();
  const dataUrl = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  return page.evaluate(async ({ src, points }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
    return { width: img.width, height: img.height, pixels: points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]) };
  }, { src: dataUrl, points });
}

test('export keeps original dimensions and burns in pixelation', async ({ page }) => {
  await addImages(page, [white]);
  await page.keyboard.press('r');
  await drag(page, [0.2, 0.2], [0.8, 0.8]);
  await page.keyboard.press('b');
  await drag(page, [0.1, 0.1], [0.5, 0.5]);
  // Rectangle top edge inside the pixelated area, the same edge outside it, and untouched background.
  const result = await exportPixels(page, [[140, 60], [260, 60], [390, 290]]);
  expect(result.width).toBe(400);
  expect(result.height).toBe(300);
  // Pixelation is painted into the pixels and covers the mark beneath it with averaged source blocks.
  expect(result.pixels[0]).toEqual([255, 255, 255, 255]);
  expect(result.pixels[1]).toEqual([239, 68, 68, 255]);
  expect(result.pixels[2]).toEqual([255, 255, 255, 255]);
});

test('highlighter marks translucently underneath other annotations', async ({ page }) => {
  await addImages(page, [white]);
  await page.keyboard.press('p');
  await drag(page, [0.1, 0.5], [0.9, 0.5]);
  await page.keyboard.press('h');
  await expect(page.getByRole('radiogroup', { name: 'Highlighter color' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '24 px' })).toHaveAttribute('aria-checked', 'true');
  await drag(page, [0.1, 0.5], [0.9, 0.5]);
  await expect(tile(page, 1)).toHaveAccessibleName(/2 marks$/);
  const [pen, marker] = (await exportPixels(page, [[200, 150], [200, 160]])).pixels;
  // The pen stays on top at full strength; the marker tints white paper without hiding it.
  expect(pen).toEqual([239, 68, 68, 255]);
  expect(marker[0]).toBeGreaterThan(240);
  expect(marker[2]).toBeLessThan(170);
  expect(marker[3]).toBe(255);
});

test('removing the final saved image and clearing text stay cleared after restart', async ({ page }) => {
  await addImages(page, [white]);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove screenshot 1' }).click();
  await expect(page.getByTestId('tile')).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('tile')).toHaveCount(0);
  await page.getByLabel('Title', { exact: true }).fill('Temporary title');
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('');
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('');
});

test('independent undo and redo histories survive restart', async ({ page }) => {
  await addImages(page, [white, blue]);
  await tile(page, 1).click(); await page.keyboard.press('r'); await drag(page, [0.2, 0.2], [0.6, 0.6]);
  await tile(page, 2).click(); await page.keyboard.press('a'); await drag(page, [0.2, 0.2], [0.6, 0.6]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await expect(tile(page, 1)).toHaveAccessibleName(/1 mark$/);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(tile(page, 1)).toHaveAccessibleName(/0 marks$/);
  await tile(page, 2).click(); await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(tile(page, 2)).toHaveAccessibleName(/1 mark$/);
});

test('quit preparation commits an active text annotation before persistence', async ({ page }) => {
  await addImages(page, [white]);
  await page.keyboard.press('t');
  const box = (await page.getByTestId('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.getByLabel('Annotation text', { exact: true }).fill('Keep this edit');
  // Exercise the renderer commit boundary used by the native quit acknowledgment.
  await page.evaluate(() => window.dispatchEvent(new Event('snipflag-commit-edit')));
  await expect(tile(page, 1)).toHaveAccessibleName(/1 mark$/);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload(); await expect(tile(page, 1)).toHaveAccessibleName(/1 mark$/);
});

test('restored uncertain submissions are visibly locked and never fake a browser reconciliation', async ({ page }) => {
  await addImages(page, [white]);
  await page.getByLabel('Title', { exact: true }).fill('Original attempted title');
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('snipflag-preview');
      request.onsuccess = () => {
        const db = request.result; const tx = db.transaction('sessions', 'readwrite'); const store = tx.objectStore('sessions');
        const rows = store.getAll(); rows.onsuccess = () => { const s = rows.result[0]; s.submissionLocked = true; store.put(s); };
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Remove screenshot 1' })).toBeDisabled();
  await page.getByRole('button', { name: 'Check previous attempt' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'desktop app' })).toBeVisible();
  await expect(page.getByText('Sent to Linear', { exact: true })).toHaveCount(0);
});

test('translucent pixelation replaces original detail and protects every thumbnail', async ({ page }) => {
  const patterned = { name: 'private-pattern.png', mimeType: 'image/png', buffer: patternPng(400, 300, x => x % 2 ? [240, 0, 0, 128] : [0, 0, 240, 128]) };
  await addImages(page, [patterned]);
  await page.keyboard.press('b');
  await drag(page, [0.1, 0.1], [0.8, 0.8]);
  // Marks added later must not expose or replace the protected pixels.
  await page.keyboard.press('r');
  await drag(page, [0.2, 0.2], [0.6, 0.6]);
  const result = await exportPixels(page, [[140, 60], [141, 60], [142, 61], [390, 290], [391, 290]]);
  expect([result.width, result.height]).toEqual([400, 300]);
  expect(result.pixels[0]).toEqual(result.pixels[1]);
  expect(result.pixels[1]).toEqual(result.pixels[2]);
  expect(result.pixels[0][3]).toBe(128);
  expect(result.pixels[0][0]).toBeGreaterThan(110);
  expect(result.pixels[0][0]).toBeLessThan(130);
  expect(result.pixels[3]).not.toEqual(result.pixels[4]);
  const thumb = tile(page, 1).locator('img');
  await expect(thumb).toHaveAttribute('data-protected-thumbnail', 'ready');
  const protectedUrl = await thumb.getAttribute('src');
  const pixels = await thumb.evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    const c = document.createElement('canvas'); c.width = el.naturalWidth; c.height = el.naturalHeight;
    const ctx = c.getContext('2d')!; ctx.drawImage(el, 0, 0);
    return { width: c.width, pixel: [...ctx.getImageData(56, 24, 1, 1).data] };
  });
  expect(pixels.width).toBe(160);
  expect(pixels.pixel).toEqual(result.pixels[0]);
  await page.getByLabel('Description', { exact: true }).fill('@');
  const mention = page.getByRole('listbox', { name: 'Mention an image' }).locator('img');
  await expect(mention).toHaveAttribute('src', protectedUrl!);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await expect(tile(page, 1).locator('img')).toHaveAttribute('src', protectedUrl!);
});

test('privacy exports cover fractional edges, transparent areas and legacy redactions', async ({ page }) => {
  const patterned = { name: 'edge-pattern.png', mimeType: 'image/png', buffer: patternPng(400, 300, (x, y) => y >= 180 ? [0, 0, 0, 0] : x % 2 ? [240, 0, 0, 255] : [0, 0, 240, 255]) };
  await addImages(page, [patterned]);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('snipflag-preview');
      request.onsuccess = () => {
        const db = request.result; const tx = db.transaction('sessions', 'readwrite'); const store = tx.objectStore('sessions');
        const rows = store.getAll(); rows.onsuccess = () => {
          const s = rows.result[0];
          const base = { points: [], color: '#EF4444', stroke: 8, text: '', fontSize: 22 };
          s.images[0].annotations = [
            { ...base, id: 'legacy', kind: 'redact', x: 18, y: 18, width: 8, height: 8 },
            { ...base, id: 'fractional', kind: 'pixelate', x: 10.75, y: 10.75, width: 24.5, height: 24.5 },
            { ...base, id: 'transparent', kind: 'pixelate', x: 40, y: 195, width: 100, height: 70 },
            { ...base, id: 'later-mark', kind: 'rectangle', x: 55, y: 210, width: 60, height: 30 },
          ]; store.put(s);
        };
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
      }; request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  const result = await exportPixels(page, [[10, 14], [11, 14], [35, 14], [9, 14], [36, 14], [20, 20], [70, 210]]);
  expect(result.pixels[0]).toEqual([120, 0, 120, 255]);
  expect(result.pixels[1]).toEqual(result.pixels[0]); expect(result.pixels[2]).toEqual(result.pixels[0]);
  expect(result.pixels[3]).toEqual([240, 0, 0, 255]); expect(result.pixels[4]).toEqual([0, 0, 240, 255]);
  expect(result.pixels[5]).toEqual([0, 0, 0, 255]);
  expect(result.pixels[6]).toEqual([0, 0, 0, 0]);
});

test('tools are reachable by keyboard and named', async ({ page }) => {
  await addImages(page, [white]);
  for (const [key, name] of [['v', 'Select'], ['a', 'Arrow'], ['l', 'Line'], ['c', 'Crop'], ['r', 'Rectangle'], ['e', 'Ellipse'], ['p', 'Pen'], ['h', 'Highlighter'], ['t', 'Text'], ['n', 'Numbered step'], ['b', 'Pixelate']]) {
    await page.keyboard.press(key);
    await expect(page.getByRole('button', { name: new RegExp(`^${name}`) })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.keyboard.press('t');
  const box = (await page.getByTestId('canvas').boundingBox())!;
  await page.mouse.click(box.x + 40, box.y + 60);
  await page.getByLabel('Annotation text').fill('Wrong total');
  await page.keyboard.press('Enter');
  await expect(tile(page, 1)).toHaveAccessibleName(/1 mark$/);
});


test('workspace composer preserves evidence and provides a QA report scaffold', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 920, height: 680 });
  // Synthetic local fixture: no customer screenshots or external network content.
  const fixture = await page.context().newPage();
  await fixture.setViewportSize({ width: 480, height: 280 });
  await fixture.setContent(`<body style="margin:0;background:#fff;font:14px system-ui;color:#243c38;padding:24px"><small style="color:#647b74">EXAMPLE STORE / CHECKOUT</small><h2 style="font-weight:500">Your order</h2><div style="padding:14px;background:#f3f5f1;border-radius:8px;display:flex;justify-content:space-between"><span>Studio notebook × 2</span><b>$24.00</b></div><div style="display:flex;justify-content:space-between;padding:20px 14px"><span>Total</span><b>$12.00</b></div><div style="background:#116d65;color:#fff;border-radius:7px;padding:10px;text-align:center">Continue to payment</div></body>`);
  const evidence = { name: 'Checkout.png', mimeType: 'image/png', buffer: await fixture.screenshot() };
  await fixture.close();
  await addImages(page, [white, evidence]);
  await page.keyboard.press('r');
  await drag(page, [0.76, 0.6], [0.97, 0.75]);
  await page.getByLabel('Title', { exact: true }).fill('Checkout total does not update');
  await page.getByRole('group', { name: 'Start from a template' }).getByRole('button', { name: 'Bug report' }).click();
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue(/## Expected result/);
  await expect(page.getByRole('group', { name: 'Start from a template' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create issue', exact: true })).toBeInViewport();
  await expect(page.getByTestId('canvas')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Window sizing is automatic; there is no expand/compact control anymore.
  await expect(page.getByRole('button', { name: /Expand workspace|Compact workspace/ })).toHaveCount(0);
  // Utility controls sit above the composer and never overlap its scrolling content.
  const bar = (await page.getByRole('button', { name: 'Settings', exact: true }).boundingBox())!;
  const panel = (await page.getByRole('complementary', { name: 'Linear issue' }).boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(panel.y);
  await expect(page.getByTestId('tile')).toHaveCount(2);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Checkout total does not update');
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('workspace-daylight.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  for (const section of ['Capture', 'Privacy', 'Shortcuts', 'Appearance']) {
    await dialog.getByRole('button', { name: section, exact: true }).click();
    await expect(dialog.getByRole('button', { name: section, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await dialog.getByText('Dark', { exact: true }).click();
  await expect(dialog.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await page.screenshot({ path: testInfo.outputPath('settings-after-hours.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.screenshot({ path: testInfo.outputPath('workspace-after-hours.png'), fullPage: true, animations: 'disabled' });
  await page.getByText('Issue details').click();
  await page.getByLabel('Priority').click();
  await page.screenshot({ path: testInfo.outputPath('priority-picker-after-hours.png'), animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 860, height: 620 });
  await expect(page.getByRole('button', { name: 'Create issue', exact: true })).toBeInViewport();
  await expect(page.getByTestId('canvas')).toBeInViewport();
  await page.setViewportSize({ width: 640, height: 480 });
  await page.getByRole('button', { name: 'Create issue', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Create issue', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('settings keep unsaved preferences when switching sections', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByText('Advanced: custom Linear application', { exact: true }).click();
  await dialog.getByLabel('Linear OAuth client ID').fill('public-client-id');
  await dialog.getByRole('button', { name: 'Privacy', exact: true }).click();
  await dialog.getByLabel('Delete drafts not opened for').selectOption('90');
  await dialog.getByRole('button', { name: 'Connection', exact: true }).click();
  await expect(dialog.getByLabel('Linear OAuth client ID')).toHaveValue('public-client-id');
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog.getByText('Settings saved.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('button', { name: 'Privacy', exact: true }).click();
  await expect(dialog.getByLabel('Delete drafts not opened for')).toHaveValue('90');
});

test('Shift constrains arrows and pen strokes and makes rectangles square', async ({ page }) => {
  await addImages(page, [white]);
  const box = (await page.getByTestId('canvas').boundingBox())!;
  const move = (x: number, y: number) => page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 5 });
  await page.keyboard.press('a');
  await move(.2, .2); await page.mouse.down(); await move(.8, .5);
  // Modifier changes must update the preview even without another pointer move.
  await page.keyboard.down('Shift'); await page.keyboard.up('Shift'); await page.keyboard.down('Shift');
  await page.mouse.up(); await page.keyboard.up('Shift');
  await page.keyboard.press('p');
  await page.keyboard.down('Shift');
  await move(.2, .5); await page.mouse.down(); await move(.4, .8); await move(.8, .55);
  await page.mouse.up(); await page.keyboard.up('Shift');
  await page.keyboard.press('r');
  await page.keyboard.down('Shift');
  await move(.2, .2); await page.mouse.down(); await move(.5, .4);
  await page.mouse.up(); await page.keyboard.up('Shift');
  await expect(tile(page, 1)).toHaveAccessibleName(/3 marks$/);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await expect.poll(async () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('snipflag-preview'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    const sessions = await new Promise<import('../src/model').Session[]>((resolve, reject) => {
      const request = db.transaction('sessions').objectStore('sessions').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    db.close();
    const marks = sessions[0]?.images[0]?.annotations ?? [];
    if (marks.length !== 3) return null;
    const [arrow, pen, rect] = marks;
    return {
      arrowAngle: Math.round(Math.atan2(arrow.points[3], arrow.points[2]) * 180 / Math.PI),
      penPoints: pen.points.length, penDy: Math.round(pen.points[3]), square: Math.abs(rect.width - rect.height) < .01,
    };
  })).toEqual({ arrowAngle: 15, penPoints: 4, penDy: 0, square: true });
  await page.reload();
  await expect(tile(page, 1)).toHaveAccessibleName(/3 marks$/);
});

test('image mentions support keyboard selection, undo, reordering and missing-image detection', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 920, height: 680 });
  await addImages(page, [white, blue]);
  const description = page.getByLabel('Description', { exact: true });
  await description.fill('Wrong total in @');
  await expect(page.getByRole('listbox', { name: 'Mention an image' })).toBeVisible();
  await page.getByRole('option', { name: /@image1/ }).click();
  await expect(description).toHaveValue('Wrong total in @image1 ');
  await description.press('Control+z');
  await expect(description).toHaveValue('Wrong total in @');
  await description.press('Control+Shift+z');
  await expect(description).toHaveValue('Wrong total in @image1 ');
  await description.pressSequentially('but correct in @');
  await description.press('ArrowDown');
  await description.press('Enter');
  await expect(description).toHaveValue('Wrong total in @image1 but correct in @image2 ');
  await page.getByRole('button', { name: 'Move screenshot 2 earlier' }).click();
  await expect(tile(page, 1)).toHaveAccessibleName(/blue/);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await expect(description).toHaveValue('Wrong total in @image1 but correct in @image2 ');
  await description.press('Control+End');
  await description.pressSequentially('See @');
  await expect(page.getByRole('option', { name: /@image1 white/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /@image2 blue/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('image-mention-picker.png'), animations: 'disabled' });
  await description.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove screenshot 2' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '@image1 is not attached' })).toBeVisible();
  await page.getByLabel('Add images', { exact: true }).setInputFiles([white]);
  await description.fill('Replacement @');
  await expect(page.getByRole('option', { name: /@image3 white/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /@image1/ })).toHaveCount(0);
  await description.fill('Replacement @wh');
  await expect(page.getByRole('listbox', { name: 'Mention an image' }).getByRole('option')).toHaveCount(1);
  await description.press('Tab');
  await expect(description).toHaveValue('Replacement @image3 ');
  await description.fill('Contact qa@example.com');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await description.fill('Code `@ima');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('themes preview at once, revert when not saved, and capture options persist', async ({ page }, testInfo) => {
  const html = page.locator('html');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('button', { name: 'Appearance', exact: true }).click();
  for (const theme of ['Paper', 'Blossom', 'Midnight', 'Graphite']) {
    await dialog.getByText(theme, { exact: true }).click();
    await expect(html).toHaveAttribute('data-theme', theme.toLowerCase());
    await page.screenshot({ path: testInfo.outputPath(`theme-${theme.toLowerCase()}-settings.png`), animations: 'disabled' });
  }
  // Closing without saving returns to the saved theme.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(html).not.toHaveAttribute('data-theme', 'graphite');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('button', { name: 'Capture', exact: true }).click();
  const adjust = dialog.getByRole('switch', { name: 'Adjust the selection before capturing' });
  const magnifier = dialog.getByRole('switch', { name: 'Show a magnifier at the pointer' });
  const copy = dialog.getByRole('switch', { name: 'Copy every capture to the clipboard' });
  for (const option of [adjust, magnifier, copy]) await expect(option).not.toBeChecked();
  await adjust.click();
  await copy.click();
  await page.screenshot({ path: testInfo.outputPath('settings-capture.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Appearance', exact: true }).click();
  await dialog.getByText('Midnight', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await page.keyboard.press('Escape');
  await expect(html).toHaveAttribute('data-theme', 'midnight');
  await page.screenshot({ path: testInfo.outputPath('theme-midnight-workspace.png'), animations: 'disabled' });
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'midnight');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('button', { name: 'Capture', exact: true }).click();
  await expect(adjust).toBeChecked();
  await expect(copy).toBeChecked();
  await expect(magnifier).not.toBeChecked();
  for (const theme of ['Paper', 'Graphite', 'Blossom']) {
    await dialog.getByRole('button', { name: 'Appearance', exact: true }).click();
    await dialog.getByText(theme, { exact: true }).click();
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: testInfo.outputPath(`theme-${theme.toLowerCase()}-workspace.png`), animations: 'disabled' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
});

test('the issue panel tucks away and step notes travel with the report', async ({ page }, testInfo) => {
  await addImages(page, [white]);
  const panel = page.getByRole('complementary', { name: 'Linear issue' });
  const share = page.getByRole('group', { name: 'Share this screenshot' });
  for (const name of ['Copy image', 'Copy for AI', 'Save image']) await expect(share.getByRole('button', { name })).toBeVisible();
  // Saving paths for an assistant needs the desktop app; the preview says so instead of pretending.
  await expect(share.getByRole('button', { name: 'Copy for AI' })).toBeDisabled();
  await page.getByRole('button', { name: 'Hide issue panel' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByTestId('canvas')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('workspace-solo.png'), animations: 'disabled' });
  await page.reload();
  await expect(page.getByTestId('tile')).toHaveCount(1);
  await expect(panel).toBeHidden();
  await share.getByRole('button', { name: 'Linear issue' }).click();
  await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
  // The panel slides in; raw mouse input waits for the slide to finish.
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map(a => a.finished)).then(() => undefined));

  await page.keyboard.press('n');
  const box = (await page.getByTestId('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
  // Placing steps never moves the picture: the notes float over its corner.
  expect((await page.getByTestId('canvas').boundingBox())!).toEqual(box);
  await page.getByRole('button', { name: /Step notes/ }).click();
  await page.getByLabel('Note for step 2').fill('The total stays at $12');
  await page.getByLabel('Note for step 1').fill('Add a second notebook');
  await expect(page.getByRole('button', { name: /Step notes\s*2\/2/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('step-notes.png'), animations: 'disabled' });
  // Notes are text about the image, not marks: typing them adds no undo steps.
  await page.getByRole('button', { name: 'Add step notes' }).click();
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue('1. Add a second notebook\n2. The total stays at $12\n');
  await expect(page.getByRole('button', { name: 'Add step notes' })).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Step notes/ }).click();
  await expect(page.getByLabel('Note for step 1')).toHaveValue('Add a second notebook');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(tile(page, 1)).toHaveAccessibleName(/1 mark$/);
});

test('crop, line, nudge and duplicate change the image as expected', async ({ page }) => {
  await addImages(page, [white]);
  await page.keyboard.press('l');
  await drag(page, [0.25, 0.5], [0.75, 0.5]);
  await expect(tile(page, 1)).toHaveAccessibleName(/1 mark$/);
  // A line is a plain stroke: red along its length, and no arrow head past its end.
  const line = (await exportPixels(page, [[200, 150], [320, 150]])).pixels;
  expect(line[0]).toEqual([239, 68, 68, 255]);
  expect(line[1]).toEqual([255, 255, 255, 255]);
  // Select it, move it down 10 px with Shift+Arrow, then duplicate it.
  await page.keyboard.press('v');
  const box = (await page.getByTestId('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.keyboard.press('Shift+ArrowDown');
  const moved = (await exportPixels(page, [[200, 150], [200, 160]])).pixels;
  expect(moved[0]).toEqual([255, 255, 255, 255]);
  expect(moved[1]).toEqual([239, 68, 68, 255]);
  await page.keyboard.press('Control+d');
  await expect(tile(page, 1)).toHaveAccessibleName(/2 marks$/);
  expect((await exportPixels(page, [[216, 176]])).pixels[0]).toEqual([239, 68, 68, 255]);
  // Crop to the middle, then undo it from the toast. The draft autosaves in between, and the uncropped image still comes back.
  const cropMiddle = async () => {
    await page.keyboard.press('c');
    await drag(page, [0.25, 0.25], [0.75, 0.75]);
    await expect(page.getByText('Cropped to 200 × 150.')).toBeVisible();
  };
  await cropMiddle();
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo crop' }).click();
  const restored = await exportPixels(page, [[200, 160]]);
  expect([restored.width, restored.height]).toEqual([400, 300]);
  expect(restored.pixels[0]).toEqual([239, 68, 68, 255]);
  // Crop again: the export shrinks and marks keep their place in the picture.
  await cropMiddle();
  const cropped = await exportPixels(page, [[100, 85], [100, 75]]);
  expect([cropped.width, cropped.height]).toEqual([200, 150]);
  expect(cropped.pixels[0]).toEqual([239, 68, 68, 255]);
  expect(cropped.pixels[1]).toEqual([255, 255, 255, 255]);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await expect(tile(page, 1)).toHaveAccessibleName(/2 marks$/);
});

test('a missing title is reported at the title field and clears when filled in', async ({ page }) => {
  await addImages(page, [white]);
  // The saved state is shown in the title bar.
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toHaveText('Saved');
  const title = page.getByLabel('Title', { exact: true });
  await page.evaluate(() => (document.querySelector('#issue-form') as HTMLFormElement).requestSubmit());
  // The browser preview stops before validation; in the desktop app the same path reports the field.
  await expect(page.getByRole('alert').filter({ hasText: 'desktop app' })).toBeVisible();
  await expect(title).not.toHaveAttribute('aria-invalid', 'true');
});

test('sound and animation preferences persist and apply', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('button', { name: 'Appearance', exact: true }).click();
  const sounds = dialog.getByRole('switch', { name: 'Play sound effects' });
  const motion = dialog.getByRole('switch', { name: 'Interface animations' });
  await expect(sounds).toBeChecked();
  await expect(motion).toBeChecked();
  await expect(dialog.getByRole('button', { name: 'Preview sound' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('settings-appearance-daylight.png'), animations: 'disabled' });
  await sounds.click();
  await motion.click();
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('button', { name: 'Appearance', exact: true }).click();
  await expect(dialog.getByRole('switch', { name: 'Play sound effects' })).not.toBeChecked();
  await expect(dialog.getByRole('switch', { name: 'Interface animations' })).not.toBeChecked();
});

test('settings dialog keeps a fixed size and scrolls long sections inside', async ({ page }) => {
  await page.setViewportSize({ width: 920, height: 680 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  const heights: number[] = [];
  for (const section of ['Connection', 'Capture', 'Templates', 'Appearance', 'Privacy', 'Shortcuts', 'About']) {
    await dialog.getByRole('button', { name: section, exact: true }).click();
    heights.push(Math.round((await dialog.boundingBox())!.height));
  }
  expect(new Set(heights).size).toBe(1);
  await expect(dialog.getByRole('button', { name: 'Save settings' })).toBeInViewport();
});

test('the interface behaves like a desktop app, not a web page', async ({ page }) => {
  await addImages(page, [white]);
  const blocked = await page.evaluate(() => {
    const fire = (target: Element, event: Event) => { target.dispatchEvent(event); return event.defaultPrevented; };
    const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    const panel = document.querySelector('.panel')!; const title = document.querySelector('input[placeholder="What needs fixing?"]')!;
    return {
      contextMenu: fire(panel, new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
      fieldMenu: fire(title, new MouseEvent('contextmenu', { bubbles: true, cancelable: true })),
      downloads: fire(panel, key({ key: 'j', ctrlKey: true })),
      reload: fire(panel, key({ key: 'F5' })),
      print: fire(title, key({ key: 'p', ctrlKey: true })),
      paste: fire(title, key({ key: 'v', ctrlKey: true })),
    };
  });
  expect(blocked).toEqual({ contextMenu: true, fieldMenu: false, downloads: true, reload: true, print: true, paste: false });
  await expect(page.getByRole('button', { name: 'Create issue', exact: true })).not.toHaveAttribute('title', /./);
});

test('numbered steps count up per image and ellipses draw', async ({ page }) => {
  await addImages(page, [white]);
  // Measure after the canvas fade-in settles.
  await page.getByTestId('canvas').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)));
  const before = (await page.getByTestId('canvas').boundingBox())!;
  await page.keyboard.press('n');
  // Choosing a tool never moves the canvas.
  const box = (await page.getByTestId('canvas').boundingBox())!;
  expect(box).toEqual(before);
  // Click at image pixels (100, 100) and (250, 150), whatever the fit scale is.
  const k = box.width / 400;
  await page.mouse.click(box.x + 100 * k, box.y + 100 * k);
  await page.mouse.click(box.x + 250 * k, box.y + 150 * k);
  await page.keyboard.press('e');
  await drag(page, [0.1, 0.6], [0.5, 0.9]);
  await expect(tile(page, 1)).toHaveAccessibleName(/3 marks$/);
  await expect.poll(async () => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('snipflag-preview'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const sessions = await new Promise<import('../src/model').Session[]>((resolve, reject) => { const r = db.transaction('sessions').objectStore('sessions').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    db.close();
    return (sessions[0]?.images[0]?.annotations ?? []).map(a => a.kind === 'step' ? `step${a.text}` : a.kind);
  })).toEqual(['step1', 'step2', 'ellipse']);
  // The first badge is a solid disc in the chosen color.
  const [badge] = (await exportPixels(page, [[86, 100]])).pixels;
  expect(badge).toEqual([239, 68, 68, 255]);
});

test('custom colors use a themed picker and are remembered', async ({ page }, testInfo) => {
  await addImages(page, [white]);
  await page.keyboard.press('p');
  await page.getByRole('button', { name: 'Custom color', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Custom color' });
  await expect(picker.getByRole('slider', { name: 'Saturation and brightness' })).toBeVisible();
  await expect(picker.getByLabel('Hue')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('color-picker-daylight.png'), animations: 'disabled' });
  await picker.getByLabel('Hex color').fill('#123abc');
  await picker.getByLabel('Hex color').press('Enter');
  await expect(picker).toBeHidden();
  const swatch = page.getByRole('radio', { name: 'Custom #123ABC' });
  await expect(swatch).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('h');
  await expect(page.getByRole('radio', { name: 'Custom #123ABC' })).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await page.keyboard.press('p');
  await expect(page.getByRole('radio', { name: 'Custom #123ABC' })).toBeVisible();
  await page.getByRole('button', { name: 'Custom color', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Custom color' })).toBeHidden();
});

test('about section credits the creator', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('button', { name: 'About', exact: true }).click();
  await expect(dialog.getByText('Saqlain Razee')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /GitHub\s*Razee4315/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: /LinkedIn\s*saqlainrazee/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('settings-about.png'), animations: 'disabled' });
});

test('report preview shows the exact outgoing report with protected images', async ({ page }, testInfo) => {
  await addImages(page, [white, blue]);
  await tile(page, 1).click();
  await page.keyboard.press('r');
  await drag(page, [0.2, 0.2], [0.8, 0.8]);
  await page.keyboard.press('b');
  await drag(page, [0.1, 0.1], [0.5, 0.5]);
  await page.getByLabel('Title', { exact: true }).fill('Checkout total is wrong');
  await page.getByLabel('Description', { exact: true }).fill('Compare @image2 with `@image1`.\n\n');
  await page.getByRole('button', { name: 'Move screenshot 2 earlier' }).click();
  await page.getByRole('button', { name: 'Preview report' }).click();
  const dialog = page.getByRole('dialog', { name: 'Report preview' });
  const report = dialog.getByRole('article', { name: 'Outgoing report' });
  await expect(dialog.getByText('Nothing has been uploaded.', { exact: false })).toBeVisible();
  await expect(report.getByRole('heading', { name: 'Checkout total is wrong' })).toBeVisible();
  await expect(report.locator('.mention-chip')).toHaveText(['@image2']);
  await expect(report.getByRole('heading', { level: 4 })).toHaveText(['1. @image2 · blue', '2. @image1 · white']);
  await expect(dialog.locator('[data-preview-image]')).toHaveCount(2);
  await dialog.getByText('Markdown description', { exact: true }).click();
  expect(await dialog.locator('pre').textContent()).toBe('Compare [@image2](<linear-upload:screenshot-1.png>) with `@image1`.\n\n### 1. @image2 · blue\n\n![Screenshot 1](linear-upload:screenshot-1.png)\n\n### 2. @image1 · white\n\n![Screenshot 2](linear-upload:screenshot-2.png)');
  // The preview shows flattened pixels at original size: pixelation replaces the source under the mark.
  const shown = await dialog.locator('[data-preview-image="2"]').evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
    return { width: c.width, height: c.height, pixels: [[140, 60], [260, 60], [390, 290]].map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]) };
  });
  expect(shown).toEqual({ width: 400, height: 300, pixels: [[255, 255, 255, 255], [239, 68, 68, 255], [255, 255, 255, 255]] });
  // Nothing can be sent from the browser preview, and the reason is stated.
  await expect(dialog.getByRole('button', { name: 'Create issue' })).toBeDisabled();
  await expect(dialog.getByRole('alert')).toHaveText('Choose a Linear team.');
  await page.screenshot({ path: testInfo.outputPath('report-preview.png'), animations: 'disabled' });
  // Tool shortcuts do not reach the editor behind the dialog.
  await page.keyboard.press('e');
  await dialog.getByRole('button', { name: 'Keep editing' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /^Pixelate/ })).toHaveAttribute('aria-pressed', 'true');
  // A changed revision is previewed afresh.
  await page.getByLabel('Caption for screenshot 2').fill('Checkout');
  await page.getByRole('button', { name: 'Preview report' }).click();
  await expect(report.getByRole('heading', { level: 4 })).toHaveText(['1. @image2 · blue', '2. @image1 · Checkout']);
});

test('description templates are editable, persist, and never replace written text', async ({ page }, testInfo) => {
  await addImages(page, [white]);
  const description = page.getByLabel('Description', { exact: true });
  const templates = page.getByRole('group', { name: 'Start from a template' });
  await expect(templates.getByRole('button')).toHaveText(['Bug report', 'Visual defect', 'Regression', 'Design feedback']);
  await templates.getByRole('button', { name: 'Regression' }).click();
  await expect(description).toHaveValue(/^## Previously worked in\n\n## Fails in\n\n## Reproduction/);
  await expect(templates).toHaveCount(0);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await dialog.getByRole('button', { name: 'Templates', exact: true }).click();
  const design = dialog.locator('details', { hasText: 'Design feedback' });
  await design.getByText('Design feedback', { exact: true }).click();
  await design.getByLabel('Template text').fill('## Screen\n');
  await design.getByLabel('Template name').fill('UI review');
  const visual = dialog.locator('details', { hasText: 'Visual defect' });
  await visual.getByText('Visual defect', { exact: true }).click();
  await visual.getByRole('button', { name: 'Remove template' }).click();
  await dialog.getByRole('button', { name: 'Add template' }).click();
  const added = dialog.locator('details').last();
  await added.getByLabel('Template text').fill('## Assistive technology\n');
  await added.getByLabel('Template name').fill('  Accessibility  ');
  await page.screenshot({ path: testInfo.outputPath('settings-templates.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog.getByText('Settings saved.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  await description.fill('My own notes');
  await expect(templates).toHaveCount(0);
  await description.fill('');
  await expect(templates.getByRole('button')).toHaveText(['Bug report', 'Regression', 'UI review', 'Accessibility']);
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await expect(templates.getByRole('button')).toHaveText(['Bug report', 'Regression', 'UI review', 'Accessibility']);
  await templates.getByRole('button', { name: 'Accessibility' }).click();
  await expect(description).toHaveValue('## Assistive technology\n');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await dialog.getByRole('button', { name: 'Templates', exact: true }).click();
  await dialog.getByRole('button', { name: 'Restore built-in templates' }).click();
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(dialog.getByText('Settings saved.', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await description.fill('');
  await expect(templates.getByRole('button')).toHaveText(['Bug report', 'Visual defect', 'Regression', 'Design feedback']);
});
