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
  const page = await browser.newPage();

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

  await page.waitForTimeout(1500);

  console.log('\n--- CONSOLE MESSAGES ---');
  consoleMessages.forEach(m => console.log(m));

  console.log('\n--- PAGE ERRORS ---');
  pageErrors.forEach(e => console.log(e));

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  console.log('\n--- BODY TEXT (first 2000 chars) ---');
  console.log(bodyText);

  await page.screenshot({ path: 'test-screenshot.png', fullPage: true });
  console.log('\nScreenshot saved to test-screenshot.png');

  await browser.close();

  if (pageErrors.length > 0) {
    process.exit(1);
  }
})();
