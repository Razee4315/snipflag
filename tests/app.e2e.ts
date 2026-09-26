import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { solidPng } from './png';

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
});

test('drafts are restored after reload', async ({ page }) => {
  await addImages(page, [white, blue]);
  await page.getByLabel('Title').fill('Checkout button overlaps footer');
  await page.getByLabel('Description').fill('Steps to reproduce');
  await expect(page.getByRole('status', { name: 'Saved on this computer' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Title')).toHaveValue('Checkout button overlaps footer');
  await expect(page.getByTestId('tile')).toHaveCount(2);
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('dialog', { name: 'History' }).getByText('Checkout button overlaps footer')).toBeVisible();
});

test('browser preview never pretends to reach Linear', async ({ page }) => {
  await addImages(page, [white]);
  await page.getByLabel('Title').fill('A bug');
  await page.getByRole('button', { name: 'Create issue' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'desktop app' })).toBeVisible();
  await expect(page.getByText(/Sent to Linear/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  await expect(dialog.getByLabel('Linear OAuth client ID')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Connect Linear' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Appearance', exact: true }).click();
  await dialog.getByText('Dark', { exact: true }).click();
  await expect(dialog.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
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

test('tools are reachable by keyboard and named', async ({ page }) => {
  await addImages(page, [white]);
  for (const [key, name] of [['v', 'Select'], ['a', 'Arrow'], ['r', 'Rectangle'], ['e', 'Ellipse'], ['p', 'Pen'], ['h', 'Highlighter'], ['t', 'Text'], ['n', 'Numbered step'], ['b', 'Pixelate']]) {
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
  await page.getByRole('button', { name: 'Add reproduction steps' }).click();
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue(/## Expected result/);
  await expect(page.getByRole('button', { name: 'Add reproduction steps' })).toHaveCount(0);
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
  for (const section of ['Connection', 'Capture', 'Appearance', 'Privacy', 'Shortcuts', 'About']) {
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
