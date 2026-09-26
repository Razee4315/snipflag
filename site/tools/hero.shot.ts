/**
 * Captures the website hero screenshots from the real Snipflag UI (browser preview build).
 * Runs only in the "Website screenshots" workflow on GitHub Actions:
 *   npx playwright test -c site/tools/playwright.hero.config.ts
 * Content is synthetic. The browser-preview connection banner is hidden because the desktop
 * app shows the Linear connection there instead; nothing else in the UI is altered.
 */
import { expect, test, type Page } from '@playwright/test';

const W = 640, H = 400;

const billing = `<body style="margin:0;background:#fff;font:15px/1.4 system-ui,sans-serif;color:#1f2d2a">
<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 24px;border-bottom:1px solid #eceee9">
  <b style="font-size:15px">Acme</b><span style="color:#6b7a75;font-size:13px">Account · Billing</span></div>
<div style="padding:22px 24px">
  <div style="font-size:22px;font-weight:600;margin-bottom:14px">Billing</div>
  <div style="display:flex;justify-content:space-between;padding:12px 14px;background:#f5f6f3;border-radius:8px;margin-bottom:10px"><span style="color:#6b7a75">Email</span><span>jane.doe@example.com</span></div>
  <div style="display:flex;justify-content:space-between;padding:12px 14px;background:#f5f6f3;border-radius:8px;margin-bottom:10px"><span style="color:#6b7a75">Plan</span><span>Team · 5 seats</span></div>
  <div style="display:flex;justify-content:space-between;padding:14px;font-size:17px"><span>Total due</span><b>$0.00</b></div>
  <div style="background:#0f6b62;color:#fff;border-radius:8px;padding:12px;text-align:center;font-weight:600">Pay now</div>
</div></body>`;

const invoice = `<body style="margin:0;background:#fff;font:15px/1.4 system-ui,sans-serif;color:#1f2d2a;padding:28px">
<div style="font-size:13px;color:#6b7a75">INVOICE #1042</div>
<div style="font-size:22px;font-weight:600;margin:6px 0 18px">Team plan</div>
<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eceee9"><span>5 seats × $12</span><span>$60.00</span></div>
<div style="display:flex;justify-content:space-between;padding:14px 0;font-size:17px"><b>Total</b><b>$60.00</b></div>
</body>`;

async function fixture(page: Page, html: string, name: string) {
  const p = await page.context().newPage();
  await p.setViewportSize({ width: W, height: H });
  await p.setContent(html);
  const buffer = await p.screenshot({ scale: 'css' });
  await p.close();
  return { name, mimeType: 'image/png', buffer };
}

/** Converts image pixel coordinates to page coordinates, assuming the image is centered in the canvas. */
async function toPage(page: Page, x: number, y: number) {
  const box = (await page.getByTestId('canvas').boundingBox())!;
  const zoomText = (await page.getByText(/^\d+%$/).first().textContent()) ?? '100%';
  const s = parseInt(zoomText, 10) / 100;
  return { x: box.x + box.width / 2 + (x - W / 2) * s, y: box.y + box.height / 2 + (y - H / 2) * s };
}
async function dragImg(page: Page, a: [number, number], b: [number, number]) {
  const p1 = await toPage(page, ...a), p2 = await toPage(page, ...b);
  await page.mouse.move(p1.x, p1.y);
  await page.mouse.down();
  await page.mouse.move((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, { steps: 5 });
  await page.mouse.move(p2.x, p2.y, { steps: 5 });
  await page.mouse.up();
}

for (const theme of ['Dark', 'Light'] as const) {
  test(`hero ${theme.toLowerCase()}`, async ({ page }, testInfo) => {
    await page.goto('/');
    await page.evaluate(async () => {
      localStorage.clear();
      await new Promise(r => { const q = indexedDB.deleteDatabase('snipflag-preview'); q.onsuccess = q.onerror = q.onblocked = () => r(null); });
    });
    await page.reload();

    const second = await fixture(page, invoice, 'Invoice.png');
    const main = await fixture(page, billing, 'Billing.png');
    await page.getByLabel('Add images', { exact: true }).setInputFiles([second, main]);
    await expect(page.getByTestId('tile')).toHaveCount(2);

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog.getByRole('button', { name: 'Appearance', exact: true }).click();
    await dialog.getByText(theme, { exact: true }).click();
    await dialog.getByRole('button', { name: 'Save settings' }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await page.addStyleTag({ content: '.connection:has(.workspace-chip.preview) { display: none !important; } *, *::before, *::after { caret-color: transparent !important; }' });

    await page.keyboard.press('b');
    await dragImg(page, [400, 118], [622, 150]);   // pixelate the email
    await page.keyboard.press('r');
    await dragImg(page, [516, 234], [628, 280]);   // box the wrong total
    await page.keyboard.press('v');
    await page.keyboard.press('Escape');

    await page.getByLabel('Title', { exact: true }).fill('Billing shows $0.00 for a paid team plan');
    await page.getByLabel('Description', { exact: true }).fill('Total due is $0.00 in @image2, but the invoice in @image1 says $60.00.');
    await page.getByLabel('Title', { exact: true }).blur();
    await page.getByLabel('Description', { exact: true }).blur();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);
    await page.screenshot({ path: testInfo.outputPath(`hero-${theme.toLowerCase()}.png`), animations: 'disabled' });
  });
}
