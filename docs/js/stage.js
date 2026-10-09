// The hero demo: a desktop with three agents at work and the island on top.
// A timeline plays five chapters (peek, approve, reply, stay safe, limit) with a
// scripted cursor; visitors can take over at any point: hover the island,
// click its buttons, hold to allow, type a reply.
(function () {
  const AD = (window.AD = window.AD || {});

  /** Tells the page (Blip, buddy.js) what the demos are doing: `ad:<name>` events. */
  AD.emit = (name, detail) => dispatchEvent(new CustomEvent(`ad:${name}`, { detail }));

  /** Hold-to-allow (app: Approval.tsx): a fill grows while held; letting go cancels. */
  AD.holdButton = function holdButton(btn, ms, onDone) {
    btn.style.setProperty("--hold-ms", ms + "ms");
    let timer = 0;
    const isKey = (e) => e.key === " " || e.key === "Enter";
    const start = (e) => {
      if (btn.disabled) return;
      if (e.type === "pointerdown" && e.button !== 0) return;
      if (e.type === "keydown") {
        if (!isKey(e)) return;
        e.preventDefault();
        if (e.repeat) return;
      }
      btn.classList.add("holding");
      AD.emit("hold", { phase: "start", el: btn });
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.classList.remove("holding");
        AD.emit("hold", { phase: "done", el: btn });
        onDone();
      }, ms);
    };
    const stop = (e) => {
      if (e && e.type === "keyup" && !isKey(e)) return;
      clearTimeout(timer);
      if (btn.classList.contains("holding")) AD.emit("hold", { phase: "cancel", el: btn });
      btn.classList.remove("holding");
    };
    btn.addEventListener("pointerdown", start);
    ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((t) => btn.addEventListener(t, stop));
    btn.addEventListener("keydown", start);
    btn.addEventListener("keyup", stop);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  };

  AD.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  const wrap = document.getElementById("stage");
  if (!wrap || !window.Crew) return;

  const esc = AD.esc;
  const stage = wrap.querySelector(".stage");
  const isl = document.getElementById("isl");
  const beam = isl.querySelector(".beam");
  const cursor = wrap.querySelector(".fcursor");
  const chips = Array.from(document.querySelectorAll(".chapter"));
  const caption = document.getElementById("chapterCaption");
  const reduced = Crew.reducedMotion;
  const T = {};
  const tabPip = {};
  for (const k of ["a", "b", "c"]) {
    T[k] = document.querySelector(`#term-${k} .win-body`);
    tabPip[k] = document.querySelector(`#term-${k} .win-tab .pip`);
  }

  // ---------- Fit the 1120x640 desktop into the space we get ----------

  const narrow = () => wrap.clientWidth < 600;
  function fit() {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    const s = Math.max(w / 1120, h / 640);
    stage.style.transform = `translate(${((w - 1120 * s) / 2).toFixed(1)}px, 0) scale(${s.toFixed(4)})`;
    const is = Math.min(1, Math.max(0.56, (w - 24) / (narrow() ? 470 : 590)));
    wrap.style.setProperty("--is", is.toFixed(3));
  }
  fit();
  new ResizeObserver(fit).observe(wrap);

  // ---------- The screen leans back, and straightens as you scroll to it ----------

  const tilt = document.getElementById("tilt");
  const demo = tilt?.parentElement;
  let flat = reduced || !tilt;
  function updateTilt() {
    if (reduced || !tilt) return;
    const vh = innerHeight;
    const top = demo.getBoundingClientRect().top; // the untransformed parent: no feedback loop
    const p = Math.min(1, Math.max(0, (vh * 0.98 - top) / (vh * 0.78)));
    const e = 1 - (1 - p) * (1 - p);
    const max = narrow() ? 10 : 22;
    flat = p >= 1;
    tilt.style.transform = flat
      ? "none"
      : `perspective(1400px) rotateX(${((1 - e) * max).toFixed(2)}deg) scale(${(0.9 + 0.1 * e).toFixed(4)})`;
  }
  let tiltQueued = false;
  addEventListener(
    "scroll",
    () => {
      if (tiltQueued) return;
      tiltQueued = true;
      requestAnimationFrame(() => {
        tiltQueued = false;
        updateTilt();
      });
    },
    { passive: true },
  );
  addEventListener("resize", updateTilt);
  updateTilt();

  // ---------- Time that only runs while the demo is on screen (and upright) ----------

  const CANCEL = new Error("cancelled");
  let run = 0;
  let onScreen = false;
  new IntersectionObserver(([e]) => (onScreen = e.isIntersecting), { threshold: 0.2 }).observe(wrap);
  const active = () => onScreen && flat && document.visibilityState === "visible";

  // The active chapter tab fills up as its chapter plays (estimated lengths, ms).
  const LENGTH = [7600, 9400, 11800, 10200, 15600];
  let chapterAt = 0;
  let chapterSpent = 0;
  function spend(dt) {
    chapterSpent += dt;
    chips[chapterAt]?.querySelector(".fill")?.style.setProperty("--p", Math.min(0.97, chapterSpent / LENGTH[chapterAt]).toFixed(3));
  }

  function wait(ms) {
    const id = run;
    return new Promise((res, rej) => {
      let left = ms;
      let last = performance.now();
      const tick = () => {
        if (id !== run) return rej(CANCEL);
        const now = performance.now();
        if (active()) {
          left -= now - last;
          spend(now - last);
        }
        last = now;
        if (left <= 0) res();
        else setTimeout(tick, Math.min(left, 120));
      };
      tick();
    });
  }

  // ---------- Who's on the desktop ----------

  const S = {
    a: { who: "blip", name: "portfolio-v2", title: "Make the hero responsive", doing: "Bash: npm run build", age: "12m" },
    b: { who: "byte", name: "api-server", title: "Rate-limit the login endpoint", doing: "Edited src/routes/auth.ts", age: "7m" },
    c: { who: "pip", name: "agentdeck", title: "Fix the Codex adapter tests", doing: "Bash: cargo test -p adapters", age: "4m" },
  };

  // Terminal lines: [class, html]. Claude-style (●, ⎿) and Codex-style (•, └).
  const u = (t) => ["you", `<span class="pr">&gt;</span> ${esc(t)}`];
  const t = (name, arg) => ["", `<span class="bul">●</span> <span class="tool">${name}</span>(${esc(arg)})`];
  const r = (html) => ["res", `  ⎿  ${html}`];
  const s = (html) => ["say", `<span class="bul">●</span> ${html}`];
  const cu = (txt) => ["you", `<span class="pr">›</span> ${esc(txt)}`];
  const ct = (html) => ["", `<span class="bul cx">•</span> ${html}`];
  const cr = (html) => ["res", `  └ ${html}`];
  const WAITING = `<span class="wt">⧗ Waiting for approval on AgentDeck…</span>`;
  const ALLOWED = `<span class="ok">✓ Allowed on AgentDeck</span>`;
  const DENIED = `<span class="no">✗ Denied on AgentDeck</span>`;

  const A0 = [
    u("make the hero responsive and add a dark-mode toggle"),
    t("Read", "src/components/Hero.tsx"),
    r("Read 142 lines"),
    t("Edit", "src/components/Hero.tsx"),
    r(`Updated with <span class="add">24 additions</span> and <span class="del">6 removals</span>`),
    t("Edit", "src/styles/theme.css"),
    r(`Updated with <span class="add">41 additions</span>`),
    t("Bash", "npm run build"),
    r(`<span class="ok">✓</span> built in 2.41s`),
    s("Dark mode now follows the system and remembers your choice."),
  ];
  const B0 = [
    cu("add rate limiting to /login, with tests"),
    ct(`<span class="tool">Explored</span>`),
    cr("Read src/routes/auth.ts, src/app.ts"),
    ct(`<span class="tool">Edited</span> src/middleware/rateLimit.ts <span class="add">(+38 -0)</span>`),
    ct(`<span class="tool">Edited</span> src/routes/auth.ts <span class="add">(+4</span> <span class="del">-1)</span>`),
    ct("I'll add vitest to cover the limiter."),
  ];
  const B1 = [
    ct(`<span class="tool">Run</span> npm install --save-dev vitest`),
    cr(ALLOWED),
    cr("added 42 packages in 3s"),
    ct(`<span class="tool">Wrote</span> tests/rateLimit.test.ts <span class="add">(+57)</span>`),
  ];
  const C0 = [
    u("fix the failing Codex adapter tests"),
    t("Read", "adapters/src/codex/rollout.rs"),
    r("Read 318 lines"),
    t("Edit", "adapters/src/codex/rollout.rs"),
    r(`Updated with <span class="add">12 additions</span> and <span class="del">3 removals</span>`),
    t("Bash", "cargo test -p adapters"),
    r("running 8 tests"),
  ];
  const REPLY = "Great, now bump the version to 0.14.3";
  const C2 = [
    r(`test result: <span class="ok">ok</span>. 8 passed; 0 failed`),
    s("All 8 Codex adapter tests pass."),
    u(REPLY),
    t("Edit", "Cargo.toml"),
    r(`Updated with <span class="add">1 addition</span> and <span class="del">1 removal</span>`),
  ];
  // What each terminal shows when a chapter starts.
  const SNAP = {
    a: [A0, A0, A0, A0, A0],
    b: [B0, B0, B0.concat(B1), B0.concat(B1), B0.concat(B1)],
    c: [C0, C0, C0, C0.concat(C2), C0.concat(C2)],
  };
  const TAB = {
    a: ["working", "working", "working", "working", "working"],
    b: ["working", "working", "working", "working", "working"],
    c: ["working", "working", "working", "working", "working"],
  };

  const line = ([cls, html], fresh) => {
    const d = document.createElement("div");
    d.className = `ln ${cls}${fresh ? " new" : ""}`;
    d.innerHTML = html;
    return d;
  };
  function resetTerms(ch) {
    for (const k of ["a", "b", "c"]) {
      T[k].replaceChildren(...SNAP[k][ch].map((l) => line(l, false)));
      tab(k, TAB[k][ch]);
    }
  }
  function push(k, l) {
    const d = line(l, true);
    T[k].appendChild(d);
    while (T[k].children.length > 40) T[k].firstChild.remove();
    return d;
  }
  function tab(k, state) {
    tabPip[k].className = `pip ${state}`;
  }

  // ---------- The island ----------

  const clock = `<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.6"/><path d="M6 3.6V6l1.6 1"/></svg>`;
  const ICON = {
    ok: `<svg viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7"/></svg>`,
    no: `<svg viewBox="0 0 16 16"><path d="m4.5 4.5 7 7m0-7-7 7"/></svg>`,
    send: `<svg viewBox="0 0 16 16"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg>`,
  };
  const W = {
    peek: () => (narrow() ? 400 : 470),
    ask: () => (narrow() ? 440 : 560),
    done: () => (narrow() ? 430 : 520),
  };
  const RING = { waiting: "rgba(255,159,10,.35)", happy: "rgba(48,209,88,.4)", working: "rgba(10,132,255,.25)" };

  const face = (who, mood, size, extra = "") => Crew.tag(who, mood, size, `data-aura="0" ${extra}`);
  const ringed = (who, mood, size, beamColor) =>
    `<span class="ring" style="--ring:${RING[mood]}">${beamColor ? `<span class="beam" style="--beam-color:${beamColor}"></span>` : ""}${face(who, mood, size)}</span>`;

  // While a usage limit counts down (app: the violet "Claude limit · 2h 31m" pill).
  let limitLeft = "";
  function compactHTML(m) {
    const faces = ["a", "b", "c"].map((k) => face(S[k].who, m[k], 26, 'data-greet="0"')).join("");
    const n = (mood) => Object.values(m).filter((x) => x === mood).length;
    const parts = [];
    if (n("sleeping")) parts.push(`<span style="color:var(--limited)">Claude limit · <span class="i-left">${limitLeft}</span></span>`);
    if (n("waiting")) parts.push(`<span style="color:#ffb340">${n("waiting")} needs you</span>`);
    if (n("happy")) parts.push(`<span style="color:#4ade80">${n("happy")} done</span>`);
    if (n("working")) parts.push(`${n("working")} working`);
    const pip = n("waiting") ? "waiting" : n("working") ? "working" : "sleeping";
    return `<div class="i-compact"><span class="i-faces">${faces}</span><span>${parts.join(" · ")}</span><i class="pip ${pip}"></i></div>`;
  }
  function peekHTML(k, mood = "working") {
    const x = S[k];
    const chip =
      mood === "waiting"
        ? `<span class="chip waiting">Needs you</span>`
        : mood === "happy"
          ? `<span class="chip done">Done · now</span>`
          : mood === "sleeping"
            ? `<span class="chip limited">Limit · ${limitLeft}</span>`
            : `<span class="chip working">Working · ${x.age}</span>`;
    return noticeHTML(k, mood, x.title, x.doing, chip);
  }
  function noticeHTML(k, mood, title, sub, chip) {
    return `<div class="i-peek">${face(S[k].who, mood, 44)}<span class="i-t"><b>${esc(title)}</b><small>${esc(sub)}</small></span>${chip}</div>`;
  }
  function askHTML(k, cmd, risk, reason) {
    const x = S[k];
    const hot = risk === "high" || risk === "critical";
    const hold = hot ? (risk === "critical" ? 1500 : 800) : 0;
    return (
      `<div class="i-ask">` +
      `<div class="i-head">${ringed(x.who, "waiting", 44, risk === "critical" ? "var(--failed)" : "var(--waiting)")}` +
      `<span class="i-t"><b><strong>${x.title}</strong> wants to run a command</b>` +
      `<span class="i-meta"><span>${x.name}</span><span>${clock} waiting now</span></span></span>` +
      `<span class="risk ${risk}">${risk.toUpperCase()}</span></div>` +
      (hot ? `<div class="risk-line ${risk}"><span class="risk-why">${esc(reason)}</span></div>` : "") +
      `<pre class="cmd">${esc(cmd)}</pre>` +
      `<div class="drain ${risk === "critical" ? "critical" : ""}"><i></i></div>` +
      `<div class="i-actions"><button class="b deny" data-act="deny">Deny</button><span class="sp"></span>` +
      (risk === "critical" ? "" : `<button class="b" data-act="always">Always</button>`) +
      (hold
        ? `<button class="b allow hold" data-act="allow" data-hold="${hold}">Hold to allow</button>`
        : `<button class="b allow" data-act="allow">Allow</button>`) +
      `</div></div>`
    );
  }
  function doneHTML(k, msg) {
    const x = S[k];
    return (
      `<div class="i-done"><div class="i-head">${ringed(x.who, "happy", 44, "var(--done)")}` +
      `<span class="i-t"><b><strong>${x.name} is done</strong></b><small>${esc(msg)}</small></span>` +
      `<span class="chip done">Done · now</span></div>` +
      `<form class="i-reply" autocomplete="off"><input type="text" maxlength="70" placeholder="Reply to ${x.name}…" aria-label="Reply to ${x.name}" />` +
      `<button type="submit" aria-label="Send">${ICON.send}</button></form></div>`
    );
  }
  const resultHTML = (kind, title, sub) =>
    `<div class="i-result"><span class="ic ${kind}">${ICON[kind]}</span><span>${title}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;

  let phase = "compact";
  let moods = { a: "working", b: "working", c: "working" };

  function setIsland(mode, html, { beamColor = null, width = null } = {}) {
    phase = mode;
    isl.querySelectorAll(".isl-c:not(.out)").forEach((o) => {
      o.classList.add("out");
      setTimeout(() => o.remove(), 180);
    });
    const c = document.createElement("div");
    c.className = "isl-c";
    c.style.width = width ? width + "px" : "max-content";
    c.innerHTML = html;
    isl.appendChild(c);
    Crew.mount(c);
    isl.dataset.mode = mode;
    AD.emit("island", { mode, el: isl });
    // The content is positioned on its own, so its size doesn't depend on the island's.
    isl.style.width = Math.ceil(c.offsetWidth) + "px";
    isl.style.height = Math.ceil(c.offsetHeight) + "px";
    isl.classList.toggle("beam-on", !!beamColor);
    if (beamColor) beam.style.setProperty("--beam-color", beamColor);
    return c;
  }
  function compact(m = moods) {
    moods = { ...m };
    setIsland("compact", compactHTML(moods));
  }
  function nudge() {
    if (reduced) return;
    isl.classList.remove("nudge");
    void isl.offsetWidth;
    isl.classList.add("nudge");
    setTimeout(() => isl.classList.remove("nudge"), 750);
  }

  // Visitors can peek too.
  let userHere = false;
  wrap.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    userHere = true;
    cursor.classList.add("hide");
  });
  wrap.addEventListener("pointerleave", () => {
    userHere = false;
    cursor.classList.remove("hide");
    if (phase === "userpeek") compact();
  });
  isl.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse" || phase !== "compact") return;
    const k = ["waiting", "happy", "sleeping"].map((m) => Object.keys(moods).find((x) => moods[x] === m)).find(Boolean) || "a";
    setIsland("peek", peekHTML(k, moods[k]), { width: W.peek() });
    phase = "userpeek";
  });
  isl.addEventListener("pointerleave", () => {
    if (phase === "userpeek") compact();
  });

  // ---------- The scripted cursor ----------

  function cursorAt(x, y) {
    cursor.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
  }
  function park() {
    cursorAt(wrap.clientWidth * 0.66, wrap.clientHeight * 0.74);
  }
  function cursorTo(el, fx = 0.5, fy = 0.55) {
    const r = el.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    cursorAt(r.left - wr.left + r.width * fx, r.top - wr.top + r.height * fy);
    return wait(reduced ? 200 : 1000);
  }
  async function clickOn(el) {
    cursor.classList.remove("click");
    void cursor.offsetWidth;
    cursor.classList.add("click");
    el.classList.add("pressed");
    await wait(170);
    el.classList.remove("pressed");
    await wait(120);
  }
  /** While a visitor is hovering the demo, give them time to act (up to max ms). */
  async function userAway(max) {
    for (let t = 0; userHere && t < max; t += 250) await wait(250);
  }

  /** Resolves with the visitor's choice, or the scripted one. */
  function decide(card, auto) {
    return new Promise((res, rej) => {
      let done = false;
      const finish = (act) => {
        if (done) return;
        done = true;
        AD.emit("decision", { act, el: card });
        res(act);
      };
      // Click guard (app: 400 ms after a card appears).
      card.classList.add("guard");
      setTimeout(() => card.classList.remove("guard"), 400);
      card.querySelectorAll("[data-act]").forEach((b) => {
        if (b.dataset.hold) AD.holdButton(b, Number(b.dataset.hold), () => finish(b.dataset.act));
        else b.addEventListener("click", () => finish(b.dataset.act));
      });
      (async () => {
        try {
          await wait(1600);
          await userAway(14000);
          if (done) return;
          const target = card.querySelector(`[data-act="${auto}"]`);
          await cursorTo(target);
          await userAway(14000);
          if (done) return;
          await clickOn(target);
          finish(auto);
        } catch (e) {
          if (!done) {
            done = true;
            rej(e);
          }
        }
      })();
    });
  }

  /** Resolves with the reply: typed by the visitor, or by the script. */
  function replyFlow(card, text) {
    return new Promise((res, rej) => {
      const form = card.querySelector("form");
      const input = form.querySelector("input");
      const btn = form.querySelector("button");
      let done = false;
      let user = false;
      let lastKey = 0;
      const finish = (v) => {
        if (done) return;
        done = true;
        input.blur();
        res(v);
      };
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (v) finish(v);
        else input.focus();
      });
      const mine = () => {
        user = true;
        lastKey = performance.now();
      };
      input.addEventListener("pointerdown", mine);
      input.addEventListener("keydown", mine);
      (async () => {
        try {
          await wait(1500);
          await userAway(14000);
          if (!done && !user) {
            await cursorTo(input, 0.25, 0.55);
            for (const ch of text) {
              if (done || user) break;
              input.value += ch;
              await wait(reduced ? 0 : 34 + Math.random() * 46);
            }
            if (!done && !user) {
              await wait(450);
              await cursorTo(btn);
              if (!done && !user) {
                await clickOn(btn);
                finish(input.value.trim());
              }
            }
          }
          // The visitor took over: wait for them, but not forever.
          while (!done) {
            await wait(500);
            if (performance.now() - lastKey > 25000) finish(input.value.trim() || text);
          }
        } catch (e) {
          if (!done) {
            done = true;
            rej(e);
          }
        }
      })();
    });
  }

  // ---------- The chapters ----------

  const CAPTIONS = [
    "Hover the top of your screen to peek at what an agent is doing, without switching windows.",
    "An agent asks permission and the island drops down. Allow, deny, or make it a rule, from wherever you are.",
    "An agent finishes. Tell it what's next right on the island, and it keeps going.",
    "Risky requests are flagged with a reason. Critical ones need a deliberate hold to allow.",
    "An agent hits its usage limit. The island says when it resets, counts down (sped up here), and tells you the moment you can continue.",
  ];
  function setChapter(i) {
    chips.forEach((c, j) => {
      c.setAttribute("aria-selected", String(i === j));
      c.tabIndex = i === j ? 0 : -1;
      if (j !== i) c.querySelector(".fill")?.style.setProperty("--p", "0");
    });
    chapterAt = i;
    chapterSpent = 0;
    if (caption.dataset.i === String(i)) return;
    caption.dataset.i = String(i);
    caption.classList.add("swap");
    setTimeout(() => {
      caption.textContent = CAPTIONS[i];
      caption.classList.remove("swap");
    }, 230);
  }

  async function peek() {
    setChapter(0);
    compact({ a: "working", b: "working", c: "working" });
    await wait(1800);
    await userAway(6000);
    await cursorTo(isl, 0.5, 0.6);
    if (phase === "compact") setIsland("peek", peekHTML("a"), { width: W.peek() });
    await wait(2800);
    park();
    await wait(500);
    if (phase === "peek") compact();
    await wait(1400);
  }

  async function approve() {
    setChapter(1);
    await wait(700);
    push("b", ct(`<span class="tool">Run</span> npm install --save-dev vitest`));
    const w = push("b", cr(WAITING));
    tab("b", "waiting");
    S.b.doing = "Wants to run npm install --save-dev vitest";
    await wait(600);
    moods.b = "waiting";
    const card = setIsland("ask", askHTML("b", "npm install --save-dev vitest", "medium"), {
      beamColor: "var(--waiting)",
      width: W.ask(),
    });
    nudge();
    const act = await decide(card, "allow");
    moods.b = "working";
    tab("b", "working");
    S.b.doing = "Wrote tests/rateLimit.test.ts";
    if (act === "deny") {
      w.innerHTML = cr(DENIED)[1];
      setIsland("result", resultHTML("no", "Denied", "api-server will find another way"));
      await wait(900);
      push("b", ct("OK, I'll use Node's built-in test runner instead."));
    } else {
      w.innerHTML = cr(act === "always" ? `${ALLOWED.slice(0, -7)} · rule saved</span>` : ALLOWED)[1];
      setIsland("result", resultHTML("ok", act === "always" ? "Always allowed" : "Allowed", act === "always" ? "npm install in api-server" : "npm install --save-dev vitest"));
      await wait(800);
      push("b", cr("added 42 packages in 3s"));
      await wait(700);
      push("b", ct(`<span class="tool">Wrote</span> tests/rateLimit.test.ts <span class="add">(+57)</span>`));
    }
    await wait(900);
    compact();
    await wait(1600);
  }

  async function reply() {
    setChapter(2);
    await wait(700);
    push("c", r(`test result: <span class="ok">ok</span>. 8 passed; 0 failed`));
    await wait(600);
    push("c", s("All 8 Codex adapter tests pass."));
    tab("c", "done");
    moods.c = "happy";
    S.c.doing = "All 8 Codex adapter tests pass.";
    await wait(500);
    const card = setIsland("done", doneHTML("c", "All 8 Codex adapter tests pass."), { beamColor: "var(--done)", width: W.done() });
    nudge();
    const text = await replyFlow(card, REPLY);
    setIsland("result", resultHTML("send", `Sent to ${S.c.name}`, text.length > 34 ? text.slice(0, 33) + "…" : text));
    push("c", u(text));
    tab("c", "working");
    moods.c = "working";
    S.c.doing = "Edit Cargo.toml";
    await wait(1000);
    push("c", t("Edit", "Cargo.toml"));
    await wait(600);
    push("c", r(`Updated with <span class="add">1 addition</span> and <span class="del">1 removal</span>`));
    compact();
    await wait(1800);
  }

  async function safe() {
    setChapter(3);
    await wait(700);
    push("a", s("Pushing so you can review it."));
    await wait(600);
    push("a", t("Bash", "git push --force origin main"));
    const w = push("a", r(WAITING));
    tab("a", "waiting");
    S.a.doing = "Wants to run git push --force origin main";
    await wait(600);
    moods.a = "waiting";
    const card = setIsland(
      "ask",
      askHTML("a", "git push --force origin main", "critical", "Force-pushes to main (rewrites shared history)"),
      { beamColor: "var(--failed)", width: W.ask() },
    );
    nudge();
    const act = await decide(card, "deny");
    moods.a = "working";
    tab("a", "working");
    if (act === "allow") {
      w.innerHTML = r(`<span class="ok">✓ Allowed once on AgentDeck</span>`)[1];
      setIsland("result", resultHTML("ok", "Allowed once", "saved in your History"));
      await wait(800);
      push("a", r("+ 3f9c2e1...a41b7d0 main -> main (forced update)"));
      S.a.doing = "Pushed to main";
    } else {
      w.innerHTML = r(DENIED)[1];
      setIsland("result", resultHTML("no", "Denied", "git push --force origin main"));
      await wait(900);
      push("a", s("Understood. I'll push a branch and open a pull request instead."));
      await wait(700);
      push("a", t("Bash", "git push -u origin feat/dark-mode"));
      S.a.doing = "Bash: git push -u origin feat/dark-mode";
    }
    await wait(1000);
    compact();
    await wait(2600);
  }

  async function limit() {
    setChapter(4);
    await wait(700);
    push("c", t("Bash", "cargo test --workspace"));
    await wait(800);
    push("c", r(`<span class="lim">5-hour limit reached ∙ resets 2pm</span>`));
    tab("c", "sleeping");
    moods.c = "sleeping";
    limitLeft = "2h 31m";
    S.c.doing = "Resets 2:00 PM · in 2h 31m";
    await wait(500);
    setIsland("peek", noticeHTML("c", "sleeping", "Claude usage limit reached", S.c.doing, `<span class="chip limited">Limit · 2h 31m</span>`), {
      width: W.peek(),
    });
    phase = "notice";
    nudge();
    await wait(3600);
    compact();
    await wait(1600);
    // Time-lapse to the reset, ticking in place (no re-render, no flicker).
    for (const left of ["1h 48m", "1h 02m", "24m", "6m", "1m"]) {
      limitLeft = left;
      S.c.doing = `Resets 2:00 PM · in ${left}`;
      const el = isl.querySelector(".isl-c:not(.out) .i-left");
      if (el) el.textContent = left;
      await wait(reduced ? 300 : 560);
    }
    limitLeft = "";
    moods.c = "happy";
    tab("c", "done");
    S.c.doing = "Limit reset";
    setIsland(
      "peek",
      noticeHTML("c", "happy", "Limit reset · you can continue", "Your Claude sessions can work again", `<span class="chip done">Done · now</span>`),
      { width: W.peek() },
    );
    phase = "notice";
    await wait(3200);
    push("c", u("continue"));
    moods.c = "working";
    tab("c", "working");
    S.c.doing = "Bash: cargo test --workspace";
    await wait(600);
    push("c", t("Bash", "cargo test --workspace"));
    compact();
    await wait(2200);
  }

  const CHAPTERS = [peek, approve, reply, safe, limit];

  function resetStory(ch) {
    limitLeft = "";
    S.a.doing = "Bash: npm run build";
    S.b.doing = ch >= 2 ? "Wrote tests/rateLimit.test.ts" : "Edited src/routes/auth.ts";
    S.c.doing = ch >= 3 ? "Edit Cargo.toml" : "Bash: cargo test -p adapters";
    moods = { a: "working", b: "working", c: "working" };
    resetTerms(ch);
  }

  async function play(from) {
    const id = ++run;
    resetStory(from);
    park();
    try {
      for (let i = from, first = true; id === run; i = (i + 1) % CHAPTERS.length, first = false) {
        if (i === 0 && !first) resetStory(0); // the story starts over
        await CHAPTERS[i]();
      }
    } catch (e) {
      if (e !== CANCEL) console.error(e);
    }
  }

  chips.forEach((c) => c.addEventListener("click", () => play(Number(c.dataset.ch))));
  // Arrow keys move between chapters (tabs pattern).
  document.querySelector(".chapters")?.addEventListener("keydown", (e) => {
    const i = chips.indexOf(document.activeElement);
    if (i < 0 || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    const j = (i + (e.key === "ArrowRight" ? 1 : chips.length - 1)) % chips.length;
    chips[j].focus();
    chips[j].click();
  });

  play(0);
})();
