// Real-browser render check — Playwright Chromium
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message + '\n' + (err.stack || ''));
  });

  const filePath = 'file://' + path.join(__dirname, 'index.html');
  console.log('Navigating to', filePath);
  await page.goto(filePath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  console.log('\n--- CONSOLE MESSAGES ---');
  consoleMessages.forEach(m => console.log(m));

  console.log('\n--- PAGE ERRORS ---');
  pageErrors.forEach(e => console.log(e));

  await page.screenshot({ path: 'test-screenshot.png', fullPage: false });
  console.log('\nScreenshot saved.');
  await browser.close();

  if (pageErrors.length > 0) {
    process.exit(1);
  }
})();
