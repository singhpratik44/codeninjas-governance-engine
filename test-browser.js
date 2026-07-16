// Real-browser render check for index.html (or index-debug.html with an
// unminified + sourcemapped bundle via TEST_HTML=index-debug.html).
// Playwright isn't a project dependency (would add a Chromium download to
// the CI build); install locally first: npm install --no-save playwright
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

  const filePath = 'file://' + path.join(__dirname, process.env.TEST_HTML || 'index.html');
  console.log('Navigating to', filePath);
  await page.goto(filePath, { waitUntil: 'networkidle' });

  await page.waitForTimeout(1200);

  console.log('\n--- CONSOLE MESSAGES ---');
  consoleMessages.forEach(m => console.log(m));

  console.log('\n--- PAGE ERRORS ---');
  pageErrors.forEach(e => console.log(e));

  // Screenshot 1: default landing (quantum tab, has the embedded map preview)
  await page.screenshot({ path: 'test-screenshot-quantum.png', fullPage: false });

  // "table" (Network Map) lives under the CENTERS group — open the group
  // first, then click the specific view tab.
  const groupClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
    const btn = btns.find(b => (b.getAttribute('aria-label') || '') === 'Section: Centers');
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log('\nClicked Centers group:', groupClicked);
  await page.waitForTimeout(300);
  const tableTabClicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
    const btn = btns.find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('network map'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log('Clicked Network Map tab:', tableTabClicked);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-screenshot-map.png', fullPage: false });

  console.log('\nScreenshots saved.');

  await browser.close();

  if (pageErrors.length > 0) {
    process.exit(1);
  }
})();
