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

test('empty state explains the next step with accessible actions', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'A clearer issue starts here.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add images' }).first()).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Capture screen' })).toBeDisabled();
  for (const name of ['New session', 'History', 'Settings', 'Create issue']) await expect(page.getByRole('button', { name })).toBeVisible();
});

test('multiple images keep independent annotations and undo histories', async ({ page }) => {
  await addImages(page, [white, blue]);
  await expect(page.getByText('2 images · one issue')).toBeVisible();
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
  await expect(page.getByText('Saved on this computer')).toBeVisible();
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
  await dialog.getByLabel('Theme').selectOption('dark');
  await dialog.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('export keeps original dimensions and burns in opaque redaction', async ({ page }) => {
  await addImages(page, [white]);
  await page.keyboard.press('r');
  await drag(page, [0.2, 0.2], [0.8, 0.8]);
  await page.keyboard.press('x');
  await drag(page, [0.25, 0.25], [0.75, 0.75]);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save image' }).click();
  const file = await (await downloading).path();
  const dataUrl = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  const result = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0);
    const px = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    return { width: img.width, height: img.height, center: px(200, 150), edge: px(105, 80), outside: px(390, 290) };
  }, dataUrl);
  expect(result.width).toBe(400);
  expect(result.height).toBe(300);
  // The redaction covers the rectangle drawn before it and is fully opaque.
  expect(result.center).toEqual([0, 0, 0, 255]);
  expect(result.edge).toEqual([0, 0, 0, 255]);
  expect(result.outside).toEqual([255, 255, 255, 255]);
});

test('tools are reachable by keyboard and named', async ({ page }) => {
  await addImages(page, [white]);
  for (const [key, name] of [['v', 'Select'], ['a', 'Arrow'], ['r', 'Rectangle'], ['p', 'Pen'], ['t', 'Text'], ['b', 'Pixelate'], ['x', 'Redact']]) {
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
