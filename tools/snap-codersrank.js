const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const PROFILE_URL = process.env.CODERSRANK_URL || "https://profile.codersrank.io/user/theafolayan/";

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

(async () => {
  const outDir = path.join(process.cwd(), "assets");
  await ensureDir(outDir);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    );
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });

    // Go to profile
    await page.goto(PROFILE_URL, { waitUntil: "networkidle2", timeout: 120000 });

    // Handle cookie banners if present
    try {
      await page.waitForSelector('button, .cookie, .consent', { timeout: 5000 });
      // Click a likely accept button if visible
      const buttons = await page.$$('button');
      for (const b of buttons) {
        const txt = (await page.evaluate(el => el.textContent || "", b)).trim().toLowerCase();
        if (/(accept|agree|allow|ok|got it)/.test(txt)) {
          await b.click().catch(() => {});
          break;
        }
      }
    } catch (_) {}

    // Wait until the profile main content is there
    await page.waitForSelector("main, .profile-page, .profile-block", { timeout: 60000 });

    // Wait for the Scores & Badges section to populate
    // The section typically has classes like: section.profile-block.profile-section.profile-scores
    await page.waitForFunction(() => {
      const sec = document.querySelector("section.profile-block.profile-section.profile-scores");
      if (!sec) return false;
      // Confirm there is some numeric score or badges loaded
      return /\d/.test(sec.innerText) || sec.querySelector(".ranking-badge, .profile-scores-ranks-value");
    }, { timeout: 90000 });

    // Small extra wait for images/icons to load
    await page.waitForTimeout(2500);

    // Try to grab the specific Scores & Badges section
    const section = await page.$("section.profile-block.profile-section.profile-scores");

    if (section) {
      await section.screenshot({
        path: path.join(outDir, "codersrank-scores-badges.png")
      });
      console.log("Saved assets/codersrank-scores-badges.png");
    } else {
      // Fallback full-page screenshot
      await page.screenshot({
        path: path.join(outDir, "codersrank-fullpage.png"),
        fullPage: true
      });
      console.log("Section not found. Saved assets/codersrank-fullpage.png");
    }

    // Optional: also capture the summary block if you want another image
    // You can tweak selectors below after inspecting the DOM
    const summaryBlock = await page.$("section.profile-block.profile-section.profile-summary");
    if (summaryBlock) {
      await summaryBlock.screenshot({
        path: path.join(outDir, "codersrank-summary.png")
      });
      console.log("Saved assets/codersrank-summary.png");
    }

  } catch (err) {
    console.error("Error rendering CodersRank:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
