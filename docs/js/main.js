// AgentDeck website: everything except the hero demo (stage.js) and the
// mascots (crew.js).
(function () {
  // Where the "Download" buttons go. Each release in the public repo carries the
  // installer as AgentDeck_x64-setup.exe, so this always fetches the newest one.
  // Left empty, the buttons scroll to the download section, which then says the
  // beta is by invitation.
  const DOWNLOAD_URL = "https://github.com/hicham-alaoui0/agentdeck-beta/releases/latest/download/AgentDeck_x64-setup.exe";
  const VERSION = "0.14.3";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.Crew ? Crew.reducedMotion : false;
  const esc = window.AD?.esc || ((s) => s);

  Crew.mount(document);

  // ---------- Hero headline: word by word, out of the blur ----------

  (function splitTitle() {
    const title = $("#heroTitle");
    if (!title) return;
    let i = 0;
    title.querySelectorAll(".metal, .lux").forEach((part) => {
      if (part.classList.contains("lux")) {
        // Animate (and glow) the wrapper, never the clipped text itself.
        const host = part.closest(".lux-glow") || part;
        host.classList.add("w");
        host.style.setProperty("--i", i++);
        return;
      }
      const words = part.textContent.trim().split(/\s+/);
      const frag = document.createDocumentFragment();
      words.forEach((word, j) => {
        const s = document.createElement("span");
        s.className = "w metal";
        s.textContent = word;
        s.style.setProperty("--i", i++);
        frag.append(s);
        if (j < words.length - 1) frag.append(" ");
      });
      part.replaceWith(frag);
    });
  })();

  // ---------- Cards: a spotlight follows the cursor ----------

  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$(".spot").forEach((el) => {
      el.addEventListener("pointerenter", () => el.classList.add("lit"));
      el.addEventListener("pointerleave", () => el.classList.remove("lit"));
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
        el.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
      });
    });
  }

  // ---------- Dust drifting up through the light ----------

  (function dust() {
    const canvas = $("#dust");
    if (!canvas || reduced) return;
    const ctx = canvas.getContext("2d");
    let W = 0;
    let H = 0;
    let parts = [];
    let raf = 0;
    const spawn = (anywhere) => {
      const y = anywhere ? Math.random() * H : H * (0.45 + Math.random() * 0.55);
      const spread = Math.tan((26 * Math.PI) / 180) * y; // stay inside the cone
      return {
        x: W / 2 + (Math.random() * 2 - 1) * spread * 0.85,
        y,
        r: Math.random() * 1.1 + 0.35,
        vx: (Math.random() - 0.5) * 0.05,
        vy: -(Math.random() * 0.1 + 0.03),
        a: Math.random() * 0.45 + 0.15,
        t: Math.random() * Math.PI * 2,
      };
    };
    function size() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      parts = Array.from({ length: W < 700 ? 34 : 72 }, () => spawn(true));
    }
    function frame() {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.x += p.vx + Math.sin(p.t) * 0.04;
        p.y += p.vy;
        p.t += 0.012;
        if (p.y < 4) Object.assign(p, spawn(false));
        const fade = Math.min(1, p.y / (H * 0.12)) * Math.max(0, 1 - p.y / H);
        const alpha = p.a * (0.55 + 0.45 * Math.sin(p.t * 2.3)) * fade;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(215,228,255,${alpha.toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    size();
    addEventListener("resize", size);
    whileVisible(
      $(".hero"),
      () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      },
      () => cancelAnimationFrame(raf),
    );
  })();

  // ---------- Download links ----------

  $$("[data-version]").forEach((el) => (el.textContent = VERSION));
  if (DOWNLOAD_URL) {
    $$("[data-download]").forEach((a) => (a.href = DOWNLOAD_URL));
  } else {
    $("#betaNote").hidden = false;
  }

  /** Runs fn while el is on screen (and the tab is visible). */
  function whileVisible(el, onShow, onHide) {
    let on = false;
    new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !on) {
          on = true;
          onShow?.();
        } else if (!e.isIntersecting && on) {
          on = false;
          onHide?.();
        }
      },
      { threshold: 0.25 },
    ).observe(el);
    return () => on && document.visibilityState === "visible";
  }

  /** Blur-crossfade a text change (Emil: blur masks the swap). */
  function swapText(el, text) {
    if (el.textContent === text) return;
    el.classList.add("swap");
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove("swap");
    }, 180);
  }

  // ---------- Reveal on scroll ----------

  const revealer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("in");
        revealer.unobserve(e.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
  );
  $$(".reveal").forEach((el) => revealer.observe(el));

  // =====================================================================
  // Nav island: compacts while you scroll down; its mascot shows the mood
  // of the section you're in.
  // =====================================================================

  const nav = $("#nav");
  const navFace = $(".nav-face").mascot;
  const navLabel = $("#navLabel");
  const navPip = $("#navPip");
  const menuBtn = $("#navMenu");
  const links = $$(".nav-links a");

  const TRACK = [
    ["top", "AgentDeck", "idle"],
    ["how", "Watching 3 agents", "working"],
    ["story", "1 needs you", "waiting"],
    ["crew", "Meet the crew", "happy"],
    ["features", "Features", "working"],
    ["safety", "Needs you", "waiting"],
    ["privacy", "Private by design", "idle"],
    ["setup", "Setting up", "working"],
    ["faq", "Questions", "idle"],
    ["get", "Ready when you are", "happy"],
  ].map(([id, label, mood]) => ({ el: document.getElementById(id), id, label, mood }));

  // The label's width animates: measure the next text with an invisible twin.
  const twin = document.createElement("span");
  twin.className = "nav-label";
  twin.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none";
  $(".nav-status").appendChild(twin);
  navLabel.style.display = "inline-block";
  navLabel.style.whiteSpace = "nowrap";
  navLabel.style.overflow = "hidden";
  navLabel.style.transition = "width .4s var(--ease), opacity .2s ease, filter .2s ease";
  function setLabel(text) {
    twin.textContent = text;
    navLabel.style.width = twin.offsetWidth + "px";
    swapText(navLabel, text);
  }

  let current = null;
  function track() {
    const mid = innerHeight * 0.42;
    let hit = TRACK[0];
    for (const t of TRACK) if (t.el && t.el.getBoundingClientRect().top <= mid) hit = t;
    if (hit === current) return;
    current = hit;
    setLabel(hit.label);
    navFace?.setMood(hit.mood);
    navPip.className = `pip ${hit.mood === "happy" ? "done" : hit.mood}`;
    links.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + hit.id));
  }

  let lastY = scrollY;
  let travel = 0;
  let hovering = false;
  const isOpen = () => nav.classList.contains("open");
  function compactness() {
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
    const keepOpen = hovering || isOpen() || nav.contains(document.activeElement);
    if (y < 140 || keepOpen) nav.classList.remove("compact");
    else if (travel > 24) nav.classList.add("compact");
    else if (travel < -60) nav.classList.remove("compact");
  }
  // A thin line along the island's bottom edge: how far down the page you are.
  const navProgress = $(".nav-progress");
  function progress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    navProgress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0})`;
  }

  // ---------- The story: words light up as you scroll through it ----------

  const story = $("#story");
  const storyText = $("#storyText");
  const storyEnd = $("#storyEnd");
  const units = [];
  Array.from(storyText.childNodes).forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach((w) => {
        if (!w) return;
        if (/^\s+$/.test(w)) return frag.append(" ");
        const s = document.createElement("span");
        s.className = "sword";
        s.textContent = w;
        frag.append(s);
        units.push(s);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === Node.ELEMENT_NODE && n.classList.contains("inl")) {
      units.push(n);
    }
  });
  function storyProgress() {
    if (reduced) return;
    const r = story.getBoundingClientRect();
    const span = (r.height - innerHeight) * 0.78; // done a little before the pin lets go
    const p = Math.min(1, Math.max(0, -r.top / span));
    const n = Math.round(p * (units.length + 3));
    units.forEach((u, i) => {
      const lit = i < n;
      if (u.classList.contains("lit") === lit) return;
      u.classList.toggle("lit", lit);
      if (lit) u.mascot?.react(); // its words lit up: it reacts
    });
    storyEnd.classList.toggle("lit", n >= units.length + 2);
  }
  if (reduced) {
    units.forEach((u) => u.classList.add("lit"));
    storyEnd.classList.add("lit");
  }

  let ticking = false;
  addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        compactness();
        track();
        progress();
        storyProgress();
      });
    },
    { passive: true },
  );
  progress();
  storyProgress();
  const navIsl = $("#navIsl");
  navIsl.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    hovering = true;
    nav.classList.remove("compact");
  });
  navIsl.addEventListener("pointerleave", () => {
    hovering = false;
  });
  nav.addEventListener("focusin", () => nav.classList.remove("compact"));
  // Tapping the compact island on a phone opens it back up.
  navIsl.addEventListener("click", (e) => {
    if (nav.classList.contains("compact") && !e.target.closest("button")) {
      e.preventDefault();
      nav.classList.remove("compact");
      travel = 0;
    }
  });

  function setMenu(open) {
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) nav.classList.remove("compact");
  }
  menuBtn.addEventListener("click", () => setMenu(!isOpen()));
  $$(".nav-panel a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => e.key === "Escape" && isOpen() && setMenu(false));
  document.addEventListener("pointerdown", (e) => isOpen() && !nav.contains(e.target) && setMenu(false));

  track();
  document.fonts?.ready.then(() => setLabel(current.label));

  // =====================================================================
  // Crew: one mood for the whole shelf
  // =====================================================================

  const moods = $(".moods");
  const thumb = $(".moods-thumb");
  const moodBtns = $$(".moods button");
  const moodDesc = $("#moodDesc");
  const shelf = $$(".shelf .face").map((el) => el.mascot);
  const DESC = {
    working: "Eyes dart, and it bobs like it's typing. Blue means busy.",
    waiting: "A startled hop, wide eyes, and a wave until you answer.",
    happy: "A squash, a jump and a landing. Time to reply.",
    idle: "Floats and blinks, like the terminal cursor it grew up as.",
    sleeping: "Resting at a usage limit: it naps until your limit resets.",
  };
  function placeThumb(btn) {
    thumb.style.width = btn.offsetWidth + "px";
    thumb.style.translate = `${btn.offsetLeft}px ${btn.offsetTop}px`;
  }
  function pickMood(btn, fromUser) {
    moodBtns.forEach((b) => {
      b.setAttribute("aria-checked", String(b === btn));
      b.tabIndex = b === btn ? 0 : -1;
    });
    placeThumb(btn);
    const m = btn.dataset.mood;
    swapText(moodDesc, DESC[m]);
    shelf.forEach((x, i) => setTimeout(() => x?.setMood(m), reduced ? 0 : i * 70));
    if (fromUser) stopCycle();
  }
  moodBtns.forEach((b) => b.addEventListener("click", () => pickMood(b, true)));
  moods.addEventListener("keydown", (e) => {
    const i = moodBtns.findIndex((b) => b.getAttribute("aria-checked") === "true");
    let j = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % moodBtns.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + moodBtns.length) % moodBtns.length;
    else return;
    e.preventDefault();
    moodBtns[j].focus();
    pickMood(moodBtns[j], true);
  });
  const placeCurrent = () => placeThumb(moodBtns.find((b) => b.getAttribute("aria-checked") === "true"));
  placeCurrent();
  document.fonts?.ready.then(placeCurrent);
  addEventListener("resize", placeCurrent);

  // Until someone picks a mood, the crew cycles through them on its own.
  let cycleTimer = 0;
  let cycling = !reduced;
  const crewSeen = whileVisible(
    $(".shelf"),
    () => cycling && scheduleCycle(),
    () => clearTimeout(cycleTimer),
  );
  function scheduleCycle() {
    clearTimeout(cycleTimer);
    cycleTimer = setTimeout(() => {
      if (!cycling) return;
      if (crewSeen()) {
        const i = moodBtns.findIndex((b) => b.getAttribute("aria-checked") === "true");
        pickMood(moodBtns[(i + 1) % moodBtns.length], false);
      }
      scheduleCycle();
    }, 3800);
  }
  function stopCycle() {
    cycling = false;
    clearTimeout(cycleTimer);
  }
  $(".shelf").addEventListener("pointerdown", stopCycle);

  // =====================================================================
  // Features
  // =====================================================================

  // ---------- Sessions: a tiny app window ----------

  const SESS = [
    {
      who: "blip", mood: "working", title: "Make the hero responsive", meta: "portfolio-v2 · claude",
      chip: ["working", "Working · 12m"],
      bubble: "Building the dark-mode toggle. The theme now follows the system setting.",
      tl: [["spin", "Bash", "npm run build", "now"], ["ok", "Edit", "src/styles/theme.css", "5s"], ["ok", "Edit", "src/components/Hero.tsx", "14s"], ["ok", "Read", "src/components/Hero.tsx", "20s"]],
    },
    {
      who: "byte", mood: "waiting", title: "Rate-limit the login endpoint", meta: "api-server · codex",
      chip: ["waiting", "Needs you"],
      bubble: "Wants to run <code>npm install --save-dev vitest</code>",
      tl: [["ask", "Run", "npm install --save-dev vitest", "now"], ["ok", "Edited", "src/routes/auth.ts", "1m"], ["ok", "Edited", "src/middleware/rateLimit.ts", "2m"], ["ok", "Explored", "src/routes/auth.ts", "3m"]],
    },
    {
      who: "sprout", mood: "happy", title: "Publish the changelog page", meta: "docs-site · claude",
      chip: ["done", "Done · 2m"],
      bubble: "Published the changelog page and linked it from the footer.",
      tl: [["ok", "Bash", "npm run deploy", "2m"], ["ok", "Edit", "src/components/Footer.astro", "3m"], ["ok", "Write", "src/pages/changelog.md", "4m"]],
    },
    {
      who: "pip", mood: "working", title: "Fix the Codex adapter tests", meta: "agentdeck · claude",
      chip: ["working", "Working · 4m"],
      bubble: "Running the adapter tests after fixing the rollout parser.",
      tl: [["spin", "Bash", "cargo test -p adapters", "now"], ["ok", "Edit", "adapters/src/codex/rollout.rs", "40s"], ["ok", "Read", "adapters/src/codex/rollout.rs", "1m"]],
    },
    {
      who: "tofu", mood: "sleeping", title: "End-to-end test sweep", meta: "e2e-tests · claude",
      chip: ["limited", "Limit · 14:00"],
      bubble: "Usage limit reached. It picks up again when your limit resets at 14:00.",
      tl: [["ok", "Bash", "npx playwright test", "32m"], ["ok", "Edit", "tests/checkout.spec.ts", "35m"]],
    },
  ];
  const miniDetail = $("#miniDetail");
  const miniRows = $$(".mini-list li");
  const tlIcon = { spin: `<span class="spinner"></span>`, ok: `<span class="ok">✓</span>`, ask: `<span class="ask">●</span>` };
  function showSession(i) {
    const x = SESS[i];
    miniRows.forEach((r, j) => {
      r.setAttribute("aria-selected", String(i === j));
      r.tabIndex = i === j ? 0 : -1;
    });
    miniDetail.innerHTML =
      `<div class="md-in"><div class="md-head">${Crew.tag(x.who, x.mood, 44, 'data-aura="0"')}` +
      `<span class="i-t"><b>${x.title}</b><small>${x.meta}</small></span><span class="chip ${x.chip[0]}">${x.chip[1]}</span></div>` +
      `<div class="md-bubble">${x.bubble}</div><div class="md-label">ACTIVITY</div><ul class="md-tl">` +
      x.tl.map(([k, tool, arg, at]) => `<li>${tlIcon[k]}<b>${tool}</b><code>${esc(arg)}</code><time>${at}</time></li>`).join("") +
      `</ul></div>`;
    Crew.mount(miniDetail);
  }
  miniRows.forEach((r, i) => {
    r.addEventListener("click", () => showSession(i));
    r.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        showSession(i);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const j = (i + (e.key === "ArrowDown" ? 1 : miniRows.length - 1)) % miniRows.length;
        miniRows[j].focus();
        showSession(j);
      }
    });
  });
  showSession(0);

  // ---------- Question ----------

  const qcard = $("#qcard");
  const qFace = $(".face", qcard).mascot;
  const qDone = $(".q-done", qcard);
  let qTimer = 0;
  $$(".q-opts button", qcard).forEach((b) =>
    b.addEventListener("click", () => {
      qcard.classList.add("answered");
      b.classList.add("picked");
      qFace.setMood("working");
      qDone.textContent = `✓ Sent to api-server: ${b.dataset.opt}. It's back at work.`;
      clearTimeout(qTimer);
      qTimer = setTimeout(() => {
        qcard.classList.remove("answered");
        b.classList.remove("picked");
        qFace.setMood("waiting");
        qDone.textContent = "";
      }, 4200);
    }),
  );

  // ---------- Reply ----------

  const rcard = $("#rcard");
  const rFace = $(".face", rcard).mascot;
  const rChip = $(".chip", rcard);
  const rSent = $(".r-sent", rcard);
  const rInput = $("input", rcard);
  let rTimer = 0;
  rcard.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = rInput.value.trim();
    if (!v) return rInput.focus();
    rInput.value = "";
    rFace.setMood("working");
    rChip.className = "chip working";
    rChip.textContent = "Working · now";
    rSent.textContent = `↩ Sent: “${v.length > 46 ? v.slice(0, 45) + "…" : v}”. docs-site keeps going.`;
    clearTimeout(rTimer);
    rTimer = setTimeout(() => {
      rFace.setMood("happy");
      rChip.className = "chip done";
      rChip.textContent = "Done · now";
      rSent.textContent = "";
    }, 5000);
  });

  // ---------- Long commands ----------

  const lc = $("#longcmd");
  const lcTime = $("#lcTime");
  const lcFace = $(".lc-notice .face", lc).mascot;
  const lcBtns = $$(".lc-set button", lc);
  const THRESH = [0, 30, 60, 120, 300];
  let threshold = 60;
  lcBtns.forEach((b, i) =>
    b.addEventListener("click", () => {
      lcBtns.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      threshold = THRESH[i];
    }),
  );
  const lcSeen = whileVisible(lc, () => lcLoop());
  let lcRunning = false;
  async function lcLoop() {
    if (lcRunning) return;
    lcRunning = true;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    while (lcSeen()) {
      lc.classList.remove("finished");
      lcFace?.setMood("working");
      for (let sec = 174; sec <= 192; sec++) {
        lcTime.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
        await sleep(reduced ? 120 : 260);
      }
      // Only commands longer than your threshold are worth a notice.
      if (threshold && 192 >= threshold) {
        lc.classList.add("finished");
        lcFace?.setMood("happy");
      } else {
        lcTime.textContent = "done";
      }
      await sleep(4200);
    }
    lcRunning = false;
  }

  // ---------- CI ----------

  const ci = $("#ci");
  const ciFace = $(".ci-face .face", ci).mascot;
  const ciState = $(".ci-state", ci);
  const ciTime = $(".ci-run time", ci);
  const ciSwitch = $(".switch input", ci);
  let ciOn = true;
  ciSwitch.addEventListener("change", () => {
    ciOn = ciSwitch.checked;
    if (!ciOn) {
      ci.dataset.state = "off";
      ciState.textContent = "off";
      ciTime.textContent = "";
      ciFace?.setMood("idle");
    } else ciLoop();
  });
  const ciSeen = whileVisible(ci, () => ciLoop());
  let ciRunning = false;
  async function ciLoop() {
    if (ciRunning) return;
    ciRunning = true;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    while (ciSeen() && ciOn) {
      ci.dataset.state = "running";
      ciState.textContent = "running";
      ciFace?.setMood("working");
      for (let sec = 141; sec <= 161 && ciOn; sec++) {
        ciTime.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
        await sleep(reduced ? 80 : 170);
      }
      if (!ciOn) break;
      ci.dataset.state = "passed";
      ciState.textContent = "passed";
      ciTime.textContent = "2m 41s";
      ciFace?.setMood("happy");
      await sleep(4000);
    }
    ciRunning = false;
  }

  // =====================================================================
  // Safety: a simplified, in-browser version of AgentDeck's risk scoring
  // (core/src/risk.rs). Reasons use the app's own wording.
  // =====================================================================

  const RANK = { low: 0, medium: 1, high: 2, critical: 3 };
  const A = (risk, reason) => ({ risk, reason });
  const worse = (a, b) => (!a ? b : !b ? a : RANK[b.risk] > RANK[a.risk] ? b : a);
  let ctx = { cwd: null };

  function tokens(s) {
    const out = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(s))) out.push(m[1] ?? m[2] ?? m[3]);
    return out;
  }
  /** Splits `a && b; c | d` into commands, leaving quoted text alone. */
  function splitChain(s) {
    const parts = [];
    let cur = "";
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) {
        cur += ch;
        if (ch === q) q = null;
      } else if (ch === '"' || ch === "'") {
        q = ch;
        cur += ch;
      } else if (ch === ";" || ch === "|" || (ch === "&" && s[i - 1] !== ">")) {
        if (cur.trim()) parts.push(cur.trim());
        cur = "";
        if (s[i + 1] === ch) i++;
      } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  function sensitive(p) {
    const l = p.replace(/\\/g, "/").toLowerCase();
    const name = l.split("/").pop();
    if (/(^|\/)\.ssh(\/|$)/.test(l)) return { risk: "critical", what: "SSH keys" };
    if (/^id_(rsa|ed25519|ecdsa|dsa)/.test(name) || /\.(pem|key|pfx|p12|ppk|jks|keystore)$/.test(name)) return { risk: "critical", what: "a private key" };
    if (/\.claude\/\.credentials\.json$|\.codex\/auth\.json$/.test(l)) return { risk: "critical", what: "the agent's login token" };
    if (/(\.aws\/credentials|\.git-credentials|\.netrc|_netrc|\.pypirc|\.kube\/config|\.docker\/config\.json)$/.test(l)) return { risk: "critical", what: "stored credentials" };
    if (/(\.claude\/settings(\.local)?\.json|\.codex\/config\.toml|\.codex\/hooks\.json|\.claude\.json)$/.test(l)) return { risk: "high", what: "the agent's own settings (permissions and hooks)" };
    const env = name === ".env" || (name.startsWith(".env.") && !/\.(example|sample|template|dist)$/.test(name));
    if (env || ["secrets.json", "secrets.yaml", "secrets.yml", "credentials.json", ".npmrc", ".yarnrc.yml"].includes(name)) return { risk: "high", what: "a secrets file" };
    return null;
  }
  function secretIn(line) {
    for (const tk of tokens(line)) {
      const path = tk.replace(/^.*@/, "");
      const s = sensitive(path);
      if (s) return { ...s, path };
    }
    return null;
  }

  function sql(text) {
    const l = text.toLowerCase();
    if (/\bdrop\s+(database|schema)\b/.test(l)) return A("critical", "Drops a whole database");
    if (/\bdrop\s+table\b/.test(l)) return A("high", "Drops a database table");
    if (/\btruncate\s+(table\s+)?\w/.test(l)) return A("high", "Empties a database table (TRUNCATE)");
    if (/\bdelete\s+from\s+[\w."]+/.test(l) && !/\bwhere\b/.test(l)) return A("high", "Deletes every row (DELETE without WHERE)");
    if (/\bupdate\s+[\w."]+\s+set\b/.test(l) && !/\bwhere\b/.test(l)) return A("high", "Changes every row (UPDATE without WHERE)");
    return null;
  }

  const isRootPath = (n) => /^(\/|\/\*|[a-z]:|[a-z]:\/\*|\/[a-z])$/i.test(n);
  const isAbs = (n) => /^([\/~]|[a-z]:)/i.test(n);

  function deletion(targets, recursive, filtered) {
    const verb = recursive ? "Recursively deletes" : "Deletes";
    if (!targets.length) return A("high", "Deletes files it can't name up front");
    let w = null;
    for (const t of targets) {
      const n = t.replace(/\\/g, "/").replace(/(.)\/+$/, "$1");
      let a;
      const cwd = ctx.cwd && ctx.cwd.replace(/\\/g, "/").replace(/(.)\/+$/, "$1");
      if (cwd && !isAbs(n) && !/^[$%]/.test(n)) {
        if (isRootPath(cwd)) a = A("critical", `${verb} ${t} (a whole drive)`);
        else if (/^(\/tmp|\$env:temp)/i.test(cwd)) a = A("medium", `${verb} temporary files: ${t}`);
        else if (cwd === ".." || cwd.startsWith("../") || isAbs(cwd)) a = A("high", `${verb} outside the project: ${t}`);
      }
      if (!a) {
        if (/^(~|\$home|\$env:userprofile|%userprofile%|[a-z]:\/users\/[^/]+)$/i.test(n)) a = A("critical", `${verb} ${t} (your home folder)`);
        else if (isRootPath(n)) a = A("critical", `${verb} ${t} (a whole drive)`);
        else if (n === ".." || n === "../*" || /^(\.\.\/)+\.\.$/.test(n)) a = A("critical", `${verb} ${t} (a folder that contains the project)`);
        else if (/^(\/c\/windows|[a-z]:\/windows|[a-z]:\/program files|\/c\/program files|\/(usr|bin|etc|sbin|lib|boot|system)(\/|$))/i.test(n)) a = A("critical", `${verb} system files: ${t}`);
        else if (/^(\/tmp|\$env:temp|%temp%)/i.test(n)) a = A("medium", `${verb} temporary files: ${t}`);
        else if (n.startsWith("../")) a = A("high", `${verb} outside the project: ${t}`);
        else if (/[$%]/.test(n)) a = A("high", `${verb} a path it can't resolve: ${t}`);
        else if ((n === "." || n === "./") && filtered) a = A("medium", `${verb} ${t} inside the project`);
        else if (n === "." || n === "./") a = A("high", "Deletes the whole project folder");
        else if (n === "*" || n === "./*" || n === "*.*") a = A("high", "Deletes everything in the project folder");
        else if (isAbs(n)) a = A("high", `${verb} outside the project: ${t}`);
        else a = A("medium", `${verb} ${t} inside the project`);
      }
      const sec = sensitive(n);
      if (sec) a = worse(a, A(sec.risk, `Deletes ${sec.what}: ${t}`));
      w = worse(w, a);
    }
    return w;
  }

  function del(args) {
    const flags = args.filter((x) => x.startsWith("-") || /^\/[a-z?]$/i.test(x));
    const targets = args.filter((x) => !flags.includes(x));
    const recursive = flags.some(
      (f) => /^--recursive$/i.test(f) || /^-recurse$/i.test(f) || (/^-[a-z]{1,3}$/i.test(f) && /r/i.test(f)) || /^\/s$/i.test(f),
    );
    return deletion(targets, recursive, false);
  }

  function git(args) {
    let i = 0;
    while (args[i] && args[i].startsWith("-")) i += args[i] === "-C" || args[i] === "-c" ? 2 : 1;
    const sub = (args[i] || "").toLowerCase();
    const rest = args.slice(i + 1);
    const has = (f) => rest.includes(f);
    switch (sub) {
      case "push": {
        if (has("--mirror")) return A("critical", "Mirror push overwrites the whole remote");
        const lease = rest.some((x) => x.startsWith("--force-with-lease"));
        const force = has("--force") || has("-f") || rest.some((x) => /^\+/.test(x));
        const del = has("--delete") || has("-d") || rest.some((x) => /^:/.test(x));
        const branch = rest
          .filter((x) => !x.startsWith("-"))
          .map((x) => x.replace(/^\+/, "").split(":").pop())
          .find((b) => /^(main|master)$/.test(b));
        if (force && !lease && branch) return A("critical", `Force-pushes to ${branch} (rewrites shared history)`);
        if (force || lease) return A("high", "Force-push rewrites the remote's history");
        if (del) return A("high", "Deletes a remote branch");
        return A("medium", "Pushes to a remote");
      }
      case "reset":
        return has("--hard") ? A("high", "Throws away uncommitted changes (git reset --hard)") : A("medium", "Runs a command");
      case "clean":
        return rest.some((x) => /^-\w*x/i.test(x)) ? A("high", "Deletes untracked and ignored files (git clean -x)") : A("high", "Deletes untracked files (git clean)");
      case "branch":
        if (has("-D")) return A("high", "Force-deletes a branch (unmerged work is lost)");
        if (has("-d") || has("--delete")) return A("medium", "Deletes a branch");
        return A("low", "Read-only command");
      case "checkout":
        return has("--") || has(".") ? A("high", "Throws away uncommitted changes (git checkout)") : A("medium", "Runs a command");
      case "restore":
        return has("--staged") && !has("--worktree") ? A("medium", "Runs a command") : A("high", "Throws away uncommitted changes (git restore)");
      case "stash":
        return has("clear") || has("drop") ? A("high", "Deletes stashed changes") : A("medium", "Runs a command");
      case "filter-branch":
      case "filter-repo":
        return A("high", "Rewrites the repository's whole history");
      case "config":
        return has("--global") || has("--system") ? A("medium", "Changes global git settings") : A("medium", "Runs a command");
      case "status":
      case "log":
      case "diff":
      case "show":
      case "blame":
      case "remote":
      case "rev-parse":
      case "describe":
      case "shortlog":
      case "ls-files":
        return A("low", "Read-only command");
    }
    return A("medium", "Runs a command");
  }

  function net(args) {
    const all = args.join(" ");
    const url = args.find((x) => /^https?:\/\//i.test(x)) || "";
    const host = url.replace(/^https?:\/\//i, "").split(/[/:?#]/)[0] || null;
    const upload =
      args.some((x) => /^(-d|--data.*|-F|--form|-T|--upload-file)$/i.test(x)) ||
      /-X\s*(POST|PUT|PATCH)/i.test(all) ||
      /-method\s+(post|put|patch)|-infile|-body\b/i.test(all);
    if (upload) return A("high", host ? `Uploads data to ${host}` : "Uploads data over the network");
    return A("high", host ? `Network access: ${host}` : "Network access");
  }

  const READONLY = new Set(
    "ls dir pwd cat type head tail less more grep rg wc which where echo tree get-childitem gci get-content gc select-string get-location whoami date du df stat file sort uniq cut diff".split(" "),
  );

  function one(p) {
    let tk = tokens(p);
    if (!tk.length) return null;
    let a = null;
    if (tk[0] === "sudo") {
      a = A("high", "Runs as administrator (sudo)");
      tk = tk.slice(1);
      if (!tk.length) return a;
    }
    const prog = tk[0].toLowerCase().replace(/\.exe$/, "");
    const args = tk.slice(1);
    const has = (f) => args.some((x) => x.toLowerCase() === f);
    const rest = args.join(" ");

    // Shell wrappers: judge what they run.
    const wrapIdx = args.findIndex((x) => /^(-c|\/c|\/k|-command)$/i.test(x));
    if (wrapIdx >= 0 && ["bash", "sh", "zsh", "cmd", "powershell", "pwsh"].includes(prog)) {
      const shell = prog === "cmd" ? "cmd" : prog === "bash" || prog === "sh" || prog === "zsh" ? prog : "PowerShell";
      return worse(a, worse(A("medium", `Runs a command through ${shell}`), classify(args.slice(wrapIdx + 1).join(" "), true)));
    }

    switch (prog) {
      case "git":
        return worse(a, git(args));
      case "rm":
      case "rmdir":
      case "rd":
      case "del":
      case "erase":
      case "remove-item":
      case "ri":
      case "unlink":
        return worse(a, del(args));
      case "find":
        if (has("-delete") || (has("-exec") && /\brm\b/.test(rest))) {
          const root = args[0] && !args[0].startsWith("-") ? args[0] : ".";
          return worse(a, deletion([root], true, true));
        }
        return worse(a, A("low", "Read-only command"));
      case "xargs":
        if (/\b(rm|del|remove-item|ri|rd|rmdir)\b/i.test(rest)) return worse(a, A("high", "Deletes files it can't name up front"));
        break;
      case "format":
        if (/^[a-z]:$/i.test(args[0] || "")) return A("critical", "Formats a drive");
        break;
      case "curl":
      case "wget":
      case "iwr":
      case "irm":
      case "invoke-webrequest":
      case "invoke-restmethod":
        return worse(a, net(args));
      case "ssh":
        return worse(a, A("high", "Runs commands on another machine (ssh)"));
      case "scp":
      case "rsync":
        return worse(a, A("high", "Copies files to or from another machine"));
      case "npm":
      case "pnpm":
      case "yarn":
        if (has("unpublish")) return worse(a, A("high", "Removes a published package"));
        if (has("publish")) return worse(a, A("high", "Publishes a package publicly"));
        break;
      case "cargo":
        if (has("publish") || has("yank")) return worse(a, A("high", "Publishes a crate publicly"));
        break;
      case "docker":
      case "podman":
        if (has("push")) return worse(a, A("high", "Pushes an image to a registry"));
        break;
      case "gh": {
        const [x, y] = args.map((s) => s.toLowerCase());
        if (x === "auth" && y === "token") return A("critical", "Prints your GitHub token");
        if (x === "repo" && y === "delete") return A("critical", "Deletes a GitHub repository");
        if (x === "release" && y === "create") return worse(a, A("high", "Publishes a GitHub release"));
        break;
      }
      case "psql":
      case "mysql":
      case "sqlite3":
      case "sqlcmd":
        return worse(a, sql(rest) || A("medium", "Runs a command"));
      case "set-mppreference":
        if (/-disable/i.test(rest)) return A("critical", "Weakens Windows Defender");
        break;
      case "netsh":
        if (/firewall/i.test(rest)) return /state\s+off/i.test(rest) ? A("critical", "Turns off the firewall") : A("high", "Changes firewall rules");
        break;
      case "reg": {
        const sub = (args[0] || "").toLowerCase();
        if (sub === "delete") return A("critical", "Deletes registry keys");
        if (sub === "add" && /\\run\b/i.test(rest)) return A("critical", "Adds a program that starts with Windows");
        if (["add", "import", "restore", "load", "copy", "unload"].includes(sub)) return A("high", "Changes the Windows registry");
        return A("medium", "Reads the Windows registry");
      }
      case "set-executionpolicy":
        return A("high", "Lowers PowerShell's script protection");
      case "shutdown":
      case "restart-computer":
      case "stop-computer":
        return A("high", "Shuts down or restarts the computer");
      case "taskkill":
      case "kill":
      case "pkill":
      case "killall":
      case "stop-process":
        return worse(a, A("high", "Kills processes"));
      case "chmod":
        return worse(a, /777|[ao]\+w/.test(rest) || has("-r") ? A("high", "Opens up file permissions") : A("medium", "Changes file permissions"));
      case "bcdedit":
        return A("critical", "Changes how Windows boots");
      case "diskpart":
        return A("critical", "Erases or repartitions a disk");
      case "node":
      case "python":
      case "python3":
      case "py":
      case "ruby":
      case "perl":
        if (has("-e") || has("-c")) return worse(a, A("high", `Runs inline ${prog.startsWith("py") ? "python" : prog} code`));
        break;
      case "eval":
      case "iex":
      case "invoke-expression":
        return A("high", "Runs code built at run time");
    }

    if (/\b(remove-item|rm|del|ri)\b/i.test(p) && /\$_|\$\(/.test(p)) a = worse(a, A("high", "Deletes files it can't name up front"));
    const sec = secretIn(p);
    if (sec) a = worse(a, A(sec.risk, `Touches ${sec.what}: ${sec.path}`));
    const q = sql(p);
    if (q) a = worse(a, q);
    if (READONLY.has(prog) && !/>/.test(p)) return worse(a, A("low", "Read-only command"));
    const red = p.match(/>>?\s*("?)([^\s"]+)\1/);
    if (red) {
      const tgt = red[2];
      if (!/^(&|\/dev\/null$|nul$|\$null$)/i.test(tgt))
        return worse(a, isAbs(tgt) || tgt.startsWith("../") ? A("high", `Writes outside the project: ${tgt}`) : A("medium", "Changes a file in the project"));
    }
    return worse(a, A("medium", "Runs a command"));
  }

  function classify(raw, nested = false) {
    const cmd = raw.trim();
    if (!cmd) return null;
    if (!nested) ctx = { cwd: null };
    const lc = cmd.toLowerCase();
    let out = null;
    if (
      /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(lc) ||
      /\b(iwr|irm|invoke-webrequest|invoke-restmethod|curl|wget)\b.*\|\s*(iex|invoke-expression)\b/.test(lc) ||
      /\b(iex|invoke-expression)\b.*\b(iwr|irm|invoke-webrequest|invoke-restmethod|downloadstring)\b/.test(lc)
    )
      out = A("critical", "Downloads code from the internet and runs it");
    const sec = secretIn(cmd);
    if (sec && /\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod|nc|scp|ftp)\b/.test(lc))
      out = worse(out, A("critical", `Reads ${sec.what} and uses the network`));
    if (/\b(powershell|pwsh)\b/.test(lc) && /\s-(e|ec|enc|encodedcommand)\s+[a-z0-9+/=]{8,}/i.test(cmd))
      out = worse(out, A("critical", "Runs hidden (encoded) PowerShell code"));
    for (const p of splitChain(cmd)) {
      const tk = tokens(p);
      if (/^(cd|set-location|sl|pushd|chdir)$/i.test(tk[0] || "")) {
        ctx.cwd = tk[1] || "~";
        continue;
      }
      out = worse(out, one(p));
    }
    return out || A("medium", "Runs a command");
  }
  window.AD = Object.assign(window.AD || {}, { classify });

  // ---------- The demo card ----------

  const rdInput = $("#rdInput");
  const rdIsl = $("#rdIsl");
  const rdCard = $("#rdCard");
  const rdPresets = $$("#rdPresets button");
  const rdBeam = $(".beam", rdIsl);
  const HOLD = { high: 800, critical: 1500 };
  const clock = `<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.6"/><path d="M6 3.6V6l1.6 1"/></svg>`;
  const ICON = {
    ok: `<svg viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7"/></svg>`,
    no: `<svg viewBox="0 0 16 16"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg>`,
  };
  let parts = null;
  let shown = "";
  let outTimer = 0;

  function buildCard() {
    rdCard.innerHTML =
      `<div class="i-ask">` +
      `<div class="i-head"><span class="ring" style="--ring:rgba(255,159,10,.35)"><span class="beam" style="--beam-color:var(--waiting)"></span>` +
      Crew.tag("byte", "waiting", 44, 'data-aura="0"') +
      `</span><span class="i-t"><b><strong>Rate-limit the login endpoint</strong> wants to run a command</b>` +
      `<span class="i-meta"><span>api-server</span><span>${clock} waiting now</span></span></span><span class="risk" data-r></span></div>` +
      `<div class="risk-line" data-why><span class="risk-why"></span></div>` +
      `<pre class="cmd" data-cmd></pre><div class="drain"><i></i></div><div class="i-actions" data-actions></div></div>`;
    Crew.mount(rdCard);
    parts = {
      pill: $("[data-r]", rdCard),
      why: $("[data-why]", rdCard),
      whyText: $(".risk-why", rdCard),
      cmd: $("[data-cmd]", rdCard),
      drain: $(".drain", rdCard),
      actions: $("[data-actions]", rdCard),
      ringBeam: $(".ring .beam", rdCard),
    };
    shown = "";
  }

  function scoreNow() {
    const cmd = rdInput.value;
    rdPresets.forEach((b) => b.classList.toggle("on", b.textContent === cmd.trim()));
    const a = classify(cmd);
    if (!parts) buildCard();
    if (!a) {
      parts.pill.className = "risk";
      parts.pill.textContent = "…";
      parts.whyText.textContent = "Type a command to see how it would be scored.";
      parts.why.className = "risk-line";
      parts.cmd.textContent = " ";
      parts.actions.innerHTML = "";
      rdIsl.classList.remove("critical", "beam-on");
      shown = "";
      return;
    }
    parts.cmd.textContent = cmd.trim();
    parts.pill.className = `risk ${a.risk}`;
    parts.pill.textContent = a.risk.toUpperCase();
    parts.why.className = `risk-line ${a.risk}`;
    parts.whyText.textContent = a.reason;
    parts.drain.className = `drain ${a.risk === "critical" ? "critical" : ""}`;
    rdIsl.classList.toggle("critical", a.risk === "critical");
    const hot = a.risk === "high" || a.risk === "critical";
    rdIsl.classList.toggle("beam-on", hot);
    rdBeam.style.setProperty("--beam-color", "var(--failed)");
    parts.ringBeam.style.setProperty("--beam-color", hot ? "var(--failed)" : "var(--waiting)");
    // Only rebuild the buttons when they'd change (and re-arm the click guard).
    if (shown === a.risk) return;
    shown = a.risk;
    const hold = HOLD[a.risk];
    parts.actions.innerHTML =
      `<button class="b deny" data-act="deny">Deny</button><span class="sp"></span>` +
      (a.risk === "critical" ? "" : `<button class="b" data-act="always">Always</button>`) +
      (hold
        ? `<button class="b allow hold" data-act="allow">Hold to allow</button>`
        : `<button class="b allow" data-act="allow">Allow</button>`);
    rdCard.classList.add("guard");
    setTimeout(() => rdCard.classList.remove("guard"), 400);
    $$("[data-act]", parts.actions).forEach((b) => {
      const go = () => decided(b.dataset.act, classify(rdInput.value));
      if (b.dataset.act === "allow" && hold) AD.holdButton(b, hold, go);
      else b.addEventListener("click", go);
    });
  }

  function decided(act, a) {
    if (!a) return;
    const msg = {
      deny: ["no", "Denied", "The agent is told no, and it's in your audit log."],
      allow:
        a.risk === "critical"
          ? ["ok", "Allowed once", "Critical requests can never become a rule. Held for 1.5 s, so it was on purpose."]
          : a.risk === "high"
            ? ["ok", "Allowed once", "You held for 0.8 s: a deliberate yes, not a reflex."]
            : ["ok", "Allowed once", "Logged in your audit log."],
      always:
        a.risk === "high"
          ? ["ok", "Allowed, and a rule saved", "Rules skip high-risk requests unless you raise their limit in Rules."]
          : ["ok", "Always allowed", "A rule now allows this kind of request in this project."],
    }[act];
    rdIsl.classList.remove("critical", "beam-on");
    rdCard.innerHTML = `<div class="rd-out"><span class="ic ${msg[0]}">${ICON[msg[0]]}</span>${msg[1]}<small>${msg[2]}</small></div>`;
    parts = null;
    clearTimeout(outTimer);
    outTimer = setTimeout(() => {
      buildCard();
      scoreNow();
    }, 2600);
  }

  let typeTimer = 0;
  rdInput.addEventListener("input", () => {
    clearTimeout(typeTimer);
    clearTimeout(outTimer);
    typeTimer = setTimeout(() => {
      if (!parts) buildCard();
      scoreNow();
    }, 120);
  });
  rdPresets.forEach((b) =>
    b.addEventListener("click", () => {
      rdInput.value = b.textContent;
      clearTimeout(outTimer);
      if (!parts) buildCard();
      scoreNow();
    }),
  );
  buildCard();
  scoreNow();

  // =====================================================================
  // Setup
  // =====================================================================

  $$(".h-btn").forEach((b) => {
    const small = b.parentElement.querySelector("small");
    const before = small.innerHTML;
    const isCodex = /Codex/.test(b.parentElement.textContent);
    b.addEventListener("click", () => {
      const on = !b.classList.contains("on");
      b.classList.toggle("on", on);
      b.textContent = on ? "✓ On" : "Turn on";
      small.innerHTML = on ? (isCodex ? "Backup saved · now trust them with <code>/hooks</code>" : "Backup saved · restart running sessions") : before;
      small.style.color = on ? "#4ade80" : "";
    });
  });

  const edge = $("#edge");
  let edgeHover = false;
  edge.addEventListener("pointerenter", () => {
    edgeHover = true;
    edge.classList.add("peek");
  });
  edge.addEventListener("pointerleave", () => {
    edgeHover = false;
    edge.classList.remove("peek");
  });
  const edgeSeen = whileVisible(edge);
  setInterval(() => {
    if (!edgeHover && edgeSeen() && !reduced) edge.classList.toggle("peek");
  }, 2400);

  // ---------- Stats count up ----------

  const counter = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        counter.unobserve(e.target);
        const el = e.target;
        const to = parseFloat(el.dataset.count);
        const dec = Number(el.dataset.dec || 0);
        if (!to || reduced) continue;
        const t0 = performance.now();
        const dur = 1300;
        const step = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 4);
          el.textContent = (to * eased).toFixed(dec);
          if (p < 1) requestAnimationFrame(step);
        };
        el.textContent = (0).toFixed(dec);
        requestAnimationFrame(step);
        // If frames stop (tab hidden mid-count), still end on the right number.
        setTimeout(() => (el.textContent = to.toFixed(dec)), dur + 200);
      }
    },
    { threshold: 0.6 },
  );
  $$("[data-count]").forEach((el) => counter.observe(el));
})();
