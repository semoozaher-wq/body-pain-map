const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const resultsDir = path.join(root, 'test-results');
fs.mkdirSync(resultsDir, { recursive: true });
const server = spawn('python3', ['-m', 'http.server', '4182', '--directory', path.join(root, 'dist')], { stdio: 'ignore' });
let browser;
(async () => {
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { const response = await fetch('http://127.0.0.1:4182/'); if (response.ok) { ready = true; break; } } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'built web app server did not start');
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://127.0.0.1:4182/', { waitUntil: 'networkidle', timeout: 60000 });
    assert.match(await page.locator('body').innerText(), /317/);
    await page.screenshot({ path: path.join(resultsDir, 'home.png'), fullPage: true });

    await page.getByText('ابدأ تسجيل سريع', { exact: true }).click();
    await page.getByRole('checkbox', { name: 'حساسية للمس' }).click();
    await page.getByRole('checkbox', { name: 'ضغط/ألم بالصدر' }).click();
    await page.getByPlaceholder('ملاحظات (اختياري)').fill('اختبار تجربة استخدام');
    await page.getByText('حفظ التسجيل السريع', { exact: true }).click();
    assert.match(await page.locator('body').innerText(), /تم تسجيل المتابعة/);

    await page.getByText('افتح خريطة الجسم', { exact: true }).click();
    // The web app defaults to the interactive 317-part map; switch to the
    // image atlas before checking gender-specific image assets.
    await page.getByText('صورة تشريحية', { exact: true }).click();
    await page.getByText('أنثى', { exact: true }).click();
    await page.waitForTimeout(250);
    const muscleSources = await page.locator('img').evaluateAll((images) => images.map((image) => image.getAttribute('src') || ''));
    assert.ok(muscleSources.some((src) => src.includes('muscle-front-atlas-female')), 'female front muscle atlas selected');
    await page.getByText('الأعضاء الداخلية', { exact: true }).click();
    await page.waitForTimeout(500);
    const organImg = page.locator('img').first();
    assert.ok(await organImg.count(), 'female organ atlas is visible');
    await page.screenshot({ path: path.join(resultsDir, 'female-organs.png'), fullPage: true });
    await page.getByRole('button', { name: 'الرحم', exact: true }).first().click();
    assert.match(await page.locator('body').innerText(), /الرحم/);
    await page.getByRole('button', { name: 'رجوع' }).click().catch(() => undefined);

    await page.getByRole('tab', { name: 'السجل' }).click();
    await page.waitForTimeout(300);
    const history = await page.locator('body').innerText();
    assert.match(history, /اتجاهات الألم/);
    assert.match(history, /تقرير قابل للتخصيص/);
    assert.match(history, /علامات إنذار/);
    await page.screenshot({ path: path.join(resultsDir, 'history.png'), fullPage: true });
    const reportButton = page.getByRole('button', { name: /إنشاء تقرير للطبيب/ });
    await Promise.all([page.waitForEvent('popup'), reportButton.click()]).then(async ([reportPage]) => {
      await reportPage.waitForLoadState('domcontentloaded');
      assert.match(await reportPage.locator('body').innerText(), /ملخص سجل الألم للطبيب/);
      assert.ok(await reportPage.locator('.chart').count(), 'PDF/print report includes chart');
      assert.match(await reportPage.locator('body').innerText(), /اختبار تجربة استخدام/);
      await reportPage.screenshot({ path: path.join(resultsDir, 'clinician-report.png'), fullPage: true });
      await reportPage.close();
    });
    assert.deepEqual(errors, [], `browser errors: ${errors.join('; ')}`);
    console.log(JSON.stringify({ smoke: 'passed', femaleMuscleAtlasVisible: true, femaleOrganAtlasVisible: true, reproductiveOrganSelectable: true, quickLogWithSymptomsAndUrgentFlag: true, trendDashboard: true, customReportContainsChartAndRecord: true, browserErrors: errors }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
})();
