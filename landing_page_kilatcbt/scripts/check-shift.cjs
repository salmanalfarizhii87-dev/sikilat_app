const { chromium } = require("playwright-core");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const widths = [320, 390, 480, 640, 768, 900, 1024, 1060, 1180, 1280, 1440, 1920];

  const snap = (page) =>
    page.evaluate(() => {
      document.getAnimations().forEach((a) => {
        try { a.pause(); } catch {}
      });
      const b = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return null;
        return { t: Math.round(r.top), b: Math.round(r.bottom) };
      };
      return {
        title: b(".lp-hero-title"),
        lead: b(".lp-lead"),
        field: b(".lp-code-field"),
        hint: b(".lp-hero-form p"),
        logo: b(".lp-hero-logo"),
        bubble: b(".lp-bubble-body"),
        chip7: b(".lp-float--days .lp-float-card"),
        chipBetul: b(".lp-float--betul .lp-float-card"),
        modes: b(".lp-mode-grid"),
        foot: b(".lp-hero-foot"),
        hero: b(".lp-hero"),
        next: b(".lp-section") || b("#cara-kerja"),
      };
    });

  let bad = 0;
  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 1000 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    await page.evaluate(() => {
      document.documentElement.style.setProperty("--lp-hero-copy-shift", "0px");
      document.documentElement.style.setProperty("--lp-hero-lead-shift", "0px");
    });
    await page.waitForTimeout(200);
    const before = await snap(page);

    await page.evaluate(() => {
      document.documentElement.style.removeProperty("--lp-hero-copy-shift");
      document.documentElement.style.removeProperty("--lp-hero-lead-shift");
    });
    await page.waitForTimeout(200);
    const after = await snap(page);

    const copy = w >= 1060 ? 32 : w >= 1024 ? 26 : 16;
    const lead = w >= 1060 ? 14 : w >= 1024 ? 12 : w >= 768 ? 10 : 8;

    const p = [];
    const chk = (k, exp) => {
      if (!before[k] || !after[k]) return;
      const d = after[k].t - before[k].t;
      if (d !== exp) p.push(`${k} Δ${d}≠${exp}`);
    };
    chk("title", copy);
    chk("lead", copy + lead);
    chk("field", copy + lead);
    chk("hint", copy + lead);
    for (const k of ["logo", "bubble", "chip7", "chipBetul", "hero", "next"]) {
      if (!before[k] || !after[k]) continue;
      const d = after[k].t - before[k].t;
      if (Math.abs(d) > 1) p.push(`${k} bergeser Δ${d}`);
    }
    // kartu mode tidak boleh bergeser di semua lebar
    const dm = after.modes.t - before.modes.t;
    if (Math.abs(dm) > 1) p.push(`modes bergeser Δ${dm}`);

    const g = (s, k1, k2) => s[k1].t - s[k2].b;
    if (g(before, "field", "lead") !== g(after, "field", "lead")) p.push("jarak lead→input berubah");
    if (g(before, "hint", "field") !== g(after, "hint", "field")) p.push("jarak input→hint berubah");

    console.log(
      `${String(w).padStart(5)}px ${p.length ? "FAIL " + p.join("; ") : "OK"}` +
        `  modesΔ=${after.modes.t - before.modes.t} footΔ=${after.foot.t - before.foot.t}`,
    );
    if (p.length) bad++;
    await page.close();
  }
  console.log(bad ? `\n${bad} viewport bermasalah` : "\nSemua viewport OK");
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
