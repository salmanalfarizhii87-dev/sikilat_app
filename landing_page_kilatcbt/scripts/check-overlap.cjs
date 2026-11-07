const { chromium } = require("playwright-core");

const ov = (a, b) => {
  const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
  const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
  return w > 0.5 && h > 0.5 ? `${Math.round(w)}x${Math.round(h)}` : null;
};

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const widths = [320, 360, 390, 414, 480, 560, 640, 700, 767, 768, 834, 900, 960, 1023, 1024, 1060, 1100, 1180, 1220, 1280, 1366, 1440, 1600, 1920];
  let bad = 0;

  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 1000 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    const d = await page.evaluate(() => {
      document.getAnimations().forEach((a) => {
        try { a.pause(); } catch {}
      });
      const ink = (sel) => {
        const root = document.querySelector(sel);
        if (!root) return [];
        const out = [];
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = tw.nextNode())) {
          if (!n.nodeValue || !n.nodeValue.trim()) continue;
          const rg = document.createRange();
          rg.selectNodeContents(n);
          for (const r of rg.getClientRects())
            if (r.width > 0.5 && r.height > 0.5) out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
        }
        return out;
      };
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return null;
        return { l: r.left, t: r.top, r: r.right, b: r.bottom };
      };
      return {
        vw: window.innerWidth,
        eyebrow: ink(".lp-eyebrow"),
        title: ink(".lp-hero-title"),
        lead: ink(".lp-lead"),
        field: box(".lp-code-field"),
        hint: ink(".lp-hero-form p"),
        bubble: box(".lp-bubble-body"),
        logo: box(".lp-hero-logo"),
        modes: box(".lp-mode-grid"),
        nav: box(".lp-nav"),
        hero: box(".lp-hero"),
      };
    });

    const issues = [];
    const lower = [...d.lead, ...(d.field ? [d.field] : []), ...d.hint];
    const upper = [...d.eyebrow, ...d.title];

    for (const t of [...upper, ...lower]) {
      if (d.modes && ov(t, d.modes)) issues.push(`teks x modes ${ov(t, d.modes)}`);
      if (d.nav && ov(t, d.nav)) issues.push(`teks x nav ${ov(t, d.nav)}`);
      if (d.logo && ov(t, d.logo)) issues.push(`teks x maskot ${ov(t, d.logo)}`);
    }

    const titleB = Math.max(...d.title.map((r) => r.b));
    const leadT = Math.min(...d.lead.map((r) => r.t));
    if (leadT - titleB < 4) issues.push(`lead terlalu rapat ke judul (${Math.round(leadT - titleB)}px)`);

    const hintB = Math.max(...d.hint.map((r) => r.b));
    // 5px adalah jarak yang memang sudah ada di desain sebelumnya (bukan regresi)
    if (d.modes && d.modes.t - hintB < 4) issues.push(`hint terlalu rapat ke kartu (${Math.round(d.modes.t - hintB)}px)`);

    if (d.bubble) {
      for (const t of [...upper, ...lower]) {
        const o = ov(d.bubble, t);
        if (o) issues.push(`bubble x teks ${o}`);
      }
      if (d.bubble.l < 0.5 || d.bubble.r > d.vw - 0.5) issues.push("bubble keluar layar");
    }
    for (const t of lower) {
      if (d.hero && t.b > d.hero.b) issues.push("blok terpotong hero");
    }

    const uniq = [...new Set(issues)];
    if (uniq.length) bad++;
    console.log(`${String(w).padStart(5)}px ${uniq.length ? "FAIL " + uniq.join("; ") : "OK"}`);
    await page.close();
  }
  console.log(bad ? `\n${bad} viewport bermasalah` : "\nSemua viewport OK");
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
