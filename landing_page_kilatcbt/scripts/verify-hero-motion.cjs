const { chromium } = require("playwright-core");

const overlap = (a, b) => {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0.5 && h > 0.5 ? { w: Math.round(w), h: Math.round(h) } : null;
};

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const widths = [320, 360, 390, 414, 480, 640, 768, 834, 900, 1024, 1100, 1180, 1280, 1440, 1920];
  let fails = 0;

  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(2600);

    const data = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return null;
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      // rect dari glyph sebenarnya (per text node), bukan line-box
      const ink = (sel) => {
        const root = document.querySelector(sel);
        if (!root) return [];
        const out = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (!n.nodeValue || !n.nodeValue.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) {
            if (r.width > 0 && r.height > 0) out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
          }
        }
        return out;
      };
      return {
        vw: window.innerWidth,
        bubble: box(".lp-bubble-body"),
        bubbleText: document.querySelector(".lp-bubble-text")?.textContent ?? null,
        mascot: box(".lp-hero-logo"),
        aily: box(".lp-hero-aily"),
        titleInk: ink(".lp-hero-title"),
        leadInk: ink(".lp-lead"),
        form: box(".lp-code-field"),
        formHintInk: ink(".lp-hero-form"),
        chipDays: box(".lp-float--days .lp-float-card"),
        chipBetul: box(".lp-float--betul .lp-float-card"),
        nav: box(".lp-nav"),
      };
    });

    const issues = [];
    const { bubble } = data;

    if (bubble) {
      if (bubble.left < 0.5) issues.push(`keluar kiri (${Math.round(bubble.left)})`);
      if (bubble.right > data.vw + 0.5) issues.push(`keluar kanan (${Math.round(bubble.right)}>${data.vw})`);
      const targets = [
        ["judul", data.titleInk],
        ["lead", data.leadInk],
        ["form", [data.form]],
        ["hint", data.formHintInk],
        ["nav", [data.nav]],
        ["chip 7hari", [data.chipDays]],
        ["chip Betul", [data.chipBetul]],
      ];
      for (const [name, rects] of targets) {
        for (const r of rects) {
          if (!r) continue;
          const o = overlap(bubble, r);
          if (o) issues.push(`menimpa ${name} (${o.w}x${o.h})`);
        }
      }
    } else {
      issues.push("bubble tidak ada");
    }

    if (issues.length) fails++;
    const b = bubble
      ? `${Math.round(bubble.left)},${Math.round(bubble.top)} ${Math.round(bubble.right - bubble.left)}x${Math.round(bubble.bottom - bubble.top)}`
      : "-";
    console.log(`${String(w).padStart(4)}px ${issues.length ? "FAIL" : "OK  "} bubble[${b}] ${issues.join("; ")}`);
    await page.close();
  }

  console.log(fails ? `\n${fails} viewport bermasalah` : "\nSemua viewport OK");
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
