// 一次性浏览器检查脚本（前端手册 21.4）：用本机 Chrome 打开正式前端，
// 在 390 / 768 / 1280 / 1440 四个宽度截图，并收集 Console 错误与失败请求。
// 用法：先启动后端(8000)与前端(3000)，再：node scripts/browser-check.mjs
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE_URL = "http://127.0.0.1:3000/";
const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../docs/evidence/阶段3-1",
);

const WIDTHS = [390, 768, 1280, 1440];
const consoleErrors = [];
const failedRequests = [];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  for (const width of WIDTHS) {
    const page = await browser.newPage();
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[${width}px] ${msg.text()}`);
    });
    page.on("requestfailed", (req) => {
      failedRequests.push(`[${width}px] ${req.url()} -> ${req.failure()?.errorText ?? "unknown"}`);
    });

    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });

    // 等任务列表（article）或空状态出现；两者都没有说明页面没跑通。
    await page
      .waitForSelector("article, [data-testid='workbench-empty']", { timeout: 10000 })
      .catch(() => {});

    await page.screenshot({ path: resolve(OUT_DIR, `工作台-${width}px.png`) });
    await page.close();
  }

  // 额外：390px 打开移动端抽屉，验证侧栏收起为抽屉、无残留遮挡。
  const mobile = await browser.newPage();
  await mobile.setViewport({ width: 390, height: 900, deviceScaleFactor: 1 });
  await mobile.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await mobile.waitForSelector("article, [data-testid='workbench-empty']", { timeout: 10000 }).catch(() => {});
  await mobile.click("button[aria-label='打开导航']");
  await new Promise((r) => setTimeout(r, 300));
  await mobile.screenshot({ path: resolve(OUT_DIR, "工作台-390px-抽屉.png") });
  await mobile.close();
} finally {
  await browser.close();
}

console.log(`截图已写入：${OUT_DIR}`);
console.log(`Console 错误 ${consoleErrors.length} 条`);
if (consoleErrors.length) console.log(consoleErrors.join("\n"));
console.log(`失败请求 ${failedRequests.length} 条`);
if (failedRequests.length) console.log(failedRequests.join("\n"));

if (consoleErrors.length > 0 || failedRequests.length > 0) {
  process.exit(1);
}
