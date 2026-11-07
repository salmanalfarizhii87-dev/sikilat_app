const { chromium } = require("playwright-core");

const results = [];
const log = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });

  /* ---------- 1. struktur & atribut aksesibilitas ---------- */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    const a = await page.evaluate(() => ({
      bubbleAria: document.querySelector(".lp-bubble")?.getAttribute("aria-hidden"),
      daysAria: document.querySelector(".lp-float--days")?.getAttribute("aria-hidden"),
      betulAria: document.querySelector(".lp-float--betul")?.getAttribute("aria-hidden"),
      mascotAlt: document.querySelector(".lp-hero-logo")?.getAttribute("alt"),
      bubblePointer: getComputedStyle(document.querySelector(".lp-bubble")).pointerEvents,
      mascotLayers: document.querySelectorAll(".lp-mascot .lp-mascot-pop > .lp-mascot-float > .lp-mascot-hop").length,
    }));

    log("chip 7 hari aria-hidden=true", a.daysAria === "true", a.daysAria);
    log("chip Betul! aria-hidden=true", a.betulAria === "true", a.betulAria);
    log("bubble aria-hidden=true", a.bubbleAria === "true", a.bubbleAria);
    log("bubble tidak menangkap pointer", a.bubblePointer === "none", a.bubblePointer);
    log("maskot dekoratif (alt kosong)", a.mascotAlt === "", JSON.stringify(a.mascotAlt));
    log("maskot punya 3 lapis transform", a.mascotLayers === 1, String(a.mascotLayers));
    await page.close();
  }

  /* ---------- 2. loop berjalan & hanya transform/opacity ---------- */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const anims = await page.evaluate(() => {
      const get = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        return el.getAnimations().map((a) => ({
          name: a.animationName,
          dur: a.effect.getTiming().duration,
          iter: a.effect.getTiming().iterations,
          play: a.playState,
          props: a.effect.getKeyframes().flatMap((k) => Object.keys(k)),
        }));
      };
      return {
        mascot: get(".lp-mascot-float"),
        days: get(".lp-float-drift"),
        flame: get(".lp-flame"),
        betul: get(".lp-betul"),
        check: get(".lp-check-draw path"),
      };
    });

    const mascot = anims.mascot?.[0];
    log("maskot float loop tak berhenti", !!mascot && mascot.iter === Infinity, mascot ? `${mascot.name} ${mascot.dur}ms` : "tidak ada");
    log("maskot float durasi 4s", mascot?.dur === 4000, String(mascot?.dur));
    log("chip 7 hari float sendiri (delay beda)", !!anims.days?.[0], anims.days?.[0]?.name);
    log("ikon api berdenyut", !!anims.flame?.[0], anims.flame?.[0]?.name);
    log("chip Betul! siklus loop", anims.betul?.[0]?.iter === Infinity, anims.betul?.[0]?.name);
    log("centang stroke draw", !!anims.check?.[0], anims.check?.[0]?.name);

    /* "computedOffset" adalah metadata keyframe WAAPI, bukan properti CSS. */
    const allowed = new Set(["transform", "opacity", "computedOffset", "offset", "composite", "easing"]);
    /* Animasi stroke-draw memang menganimasikan stroke-dashoffset — itu
       properti paint, hanya dipakai pada satu path SVG kecil (bukan layout),
       dan hanya berjalan saat chip "Betul!" tampil. */
    const strokeAnims = new Set(["lp-mo-check-draw"]);
    const allProps = Object.entries(anims)
      .flatMap(([, list]) => list ?? [])
      .filter((a) => !strokeAnims.has(a.name))
      .flatMap((a) => a.props)
      .filter((p) => !allowed.has(p));
    log("hanya transform/opacity yang dianimasikan (selain stroke-draw)", allProps.length === 0, [...new Set(allProps)].join(",") || "bersih");

    /* gerak maskot benar-benar berubah */
    const y1 = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".lp-mascot-float")).transform).f);
    await page.waitForTimeout(1000);
    const y2 = await page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".lp-mascot-float")).transform).f);
    log("maskot benar-benar bergerak", Math.abs(y1 - y2) > 0.5, `y ${y1.toFixed(1)} → ${y2.toFixed(1)}`);
    await page.close();
  }

  /* ---------- 3. teks bubble berganti + indikator mengetik ---------- */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

    const seen = new Set();
    let sawDots = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 22000) {
      const s = await page.evaluate(() => ({
        text: document.querySelector(".lp-bubble-text")?.textContent ?? null,
        dots: !!document.querySelector(".lp-bubble-dots"),
      }));
      if (s.dots) sawDots = true;
      if (s.text) seen.add(s.text);
      await page.waitForTimeout(120);
    }

    log("indikator mengetik muncul", sawDots);
    log("bubble menampilkan ≥3 pesan berbeda", seen.size >= 3, `${seen.size}: ${[...seen].join(" | ")}`);
    const expected = ["Hai! Aku Kilat.", "Masukkan kode ujian dari gurumu.", "Tanpa akun, langsung mulai.", "Siap ujian hari ini?"];
    log("teks sesuai daftar", [...seen].every((t) => expected.includes(t)), [...seen].join(" | "));
    await page.close();
  }

  /* ---------- 4. pause saat tab tersembunyi ---------- */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);

    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(300);
    const paused = await page.evaluate(() => document.querySelector(".lp-hero").dataset.motion);
    const states = await page.evaluate(() =>
      [...document.querySelectorAll(".lp-hero .lp-mo")].map((el) => el.getAnimations().map((a) => a.playState)).flat(),
    );
    log("data-motion=paused saat tab disembunyikan", paused === "paused", String(paused));
    log("semua animasi loop ter-pause", states.length > 0 && states.every((s) => s === "paused"), `${states.length} animasi`);
    await page.close();
  }

  /* ---------- 5. pause saat section keluar layar ---------- */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
    const paused = await page.evaluate(() => document.querySelector(".lp-hero").dataset.motion);
    log("data-motion=paused saat hero keluar layar", paused === "paused", String(paused));
    await page.close();
  }

  /* ---------- 6. hover memicu lompatan ---------- */
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await page.hover(".lp-mascot");
    await page.waitForTimeout(120);
    const hopOn = await page.evaluate(() => {
      const el = document.querySelector(".lp-mascot");
      const inner = document.querySelector(".lp-mascot-hop");
      return {
        attr: el.hasAttribute("data-hop"),
        anims: inner.getAnimations().map((a) => a.animationName),
      };
    });
    log("hover memicu animasi lompat", hopOn.attr && hopOn.anims.includes("lp-mo-mascot-hop"), hopOn.anims.join(","));
    await page.waitForTimeout(900);
    const hopOff = await page.evaluate(() => document.querySelector(".lp-mascot").hasAttribute("data-hop"));
    log("lompatan selesai & kembali idle", hopOff === false, String(hopOff));
    await page.close();
  }

  /* ---------- 7. prefers-reduced-motion ---------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    const r = await page.evaluate(() => {
      const running = [...document.querySelectorAll(".lp-hero *")]
        .flatMap((el) => el.getAnimations())
        .filter((a) => a.playState === "running" && a.effect?.getTiming?.().iterations === Infinity);
      return {
        runningLoops: running.length,
        bubbleText: document.querySelector(".lp-bubble-text")?.textContent ?? null,
        dots: !!document.querySelector(".lp-bubble-dots"),
        mascotOpacity: getComputedStyle(document.querySelector(".lp-mascot-pop")).opacity,
        betulOpacity: getComputedStyle(document.querySelector(".lp-betul")).opacity,
        checkOffset: getComputedStyle(document.querySelector(".lp-check-draw path")).strokeDashoffset,
      };
    });
    log("reduced-motion: tidak ada loop berjalan", r.runningLoops === 0, `${r.runningLoops} loop`);
    log("reduced-motion: bubble tampil statis", !!r.bubbleText && !r.dots, String(r.bubbleText));
    log("reduced-motion: maskot & chip terlihat penuh", r.mascotOpacity === "1" && r.betulOpacity === "1", `${r.mascotOpacity}/${r.betulOpacity}`);
    log("reduced-motion: centang tergambar penuh", parseFloat(r.checkOffset) === 0, r.checkOffset);
    await page.screenshot({ path: "scripts/reduced.png", clip: { x: 0, y: 0, width: 1280, height: 440 } });
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} cek lolos`);
  if (failed.length) console.log("GAGAL: " + failed.map((f) => f.name).join(", "));
  process.exit(failed.length ? 1 : 0);
})();
