// The crew: AgentDeck's mascots, ported from app/src/characters.tsx and
// app/src/Face.tsx so the site's characters look and behave like the app's.
//
// Usage: <span data-mascot="byte" data-mood="working" data-size="44"></span>
// then Crew.mount(root) (done for the whole page on load). The mounted
// element gets `.mascot` (a Mascot) with setMood(mood).
//
// Moods: sleeping | idle | working | waiting | happy
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const INK = "#1b1f27";

  const CHARACTERS = {
    blip: {
      name: "Blip",
      light: "#b7f7dc", color: "#6ee7b7", dark: "#34b98a",
      box: [18, 10, 28, 42], rt: 11, rb: 11,
      eyes: { y: 27, gap: 4.8, rx: 2.3, ry: 3.6 }, armY: 33,
      acc: "",
    },
    byte: {
      name: "Byte",
      light: "#ffd2c2", color: "#ff9f80", dark: "#e0694a",
      box: [13, 22, 38, 30], rt: 14, rb: 14,
      eyes: { y: 36, gap: 6.5, rx: 3, ry: 3 }, armY: 40,
      acc:
        `<g class="acc"><path d="M15.5 31C15.5 12.5 48.5 12.5 48.5 31" fill="none" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>` +
        `<rect x="10" y="26" width="8.5" height="12.5" rx="4.25" fill="${INK}"/><rect x="45.5" y="26" width="8.5" height="12.5" rx="4.25" fill="${INK}"/>` +
        `<rect class="pad" x="12.2" y="28.6" width="3" height="7.3" rx="1.5"/><rect class="pad" x="48.8" y="28.6" width="3" height="7.3" rx="1.5"/></g>`,
    },
    sprout: {
      name: "Sprout",
      light: "#e4dcff", color: "#c4b5fd", dark: "#8f7ae6",
      box: [19, 15, 26, 37], rt: 13, rb: 10,
      eyes: { y: 31, gap: 4.6, rx: 2.6, ry: 3.1 }, armY: 36,
      acc:
        `<g class="acc leaf"><path d="M32 15.5q-.6-4 .8-7" fill="none" stroke="#3fbf6a" stroke-width="1.8" stroke-linecap="round"/>` +
        `<path d="M32.8 8.6q5.2-5.4 9.6-2.2q-4.4 5.4-9.6 2.2z" fill="#4ade80"/><path d="M32.4 10.2q-5-3.8-8.8-.6q4.6 3.6 8.8.6z" fill="#86efac"/></g>`,
    },
    pip: {
      name: "Pip",
      light: "#c9ecff", color: "#7dd3fc", dark: "#3ea6dc",
      box: [15, 19, 34, 33], rt: 15, rb: 14,
      eyes: { y: 34, gap: 5.6, rx: 3.1, ry: 3.1 }, armY: 38,
      acc:
        `<g class="acc"><path d="M32 19.5V10.5" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` +
        `<circle class="bulb" cx="32" cy="8.6" r="3"/><circle cx="31" cy="7.6" r="0.9" fill="#fff" opacity="0.7"/></g>`,
    },
    tofu: {
      name: "Tofu",
      light: "#fff4c4", color: "#fde68a", dark: "#e8bf45",
      box: [16, 17, 32, 35], rt: 11, rb: 10,
      eyes: { y: 35, gap: 5.4, rx: 2.9, ry: 2.9 }, armY: 39,
      acc:
        `<g class="acc"><path d="M15.5 25.5C15.5 10.5 48.5 10.5 48.5 25.5Z" fill="#f87171"/>` +
        `<rect x="14.5" y="22.5" width="35" height="6.5" rx="3.25" fill="#dc4a4a"/>` +
        `<path d="M21 22.5v6.5M26 22.5v6.5M31 22.5v6.5M36 22.5v6.5M41 22.5v6.5" stroke="#b83a3a" stroke-width="1" opacity="0.6"/>` +
        `<circle cx="32" cy="10.5" r="3.4" fill="#fecaca"/></g>`,
    },
    dash: {
      name: "Dash",
      light: "#ffd9ec", color: "#f9a8d4", dark: "#e46aa9",
      box: [19, 12, 26, 40], rt: 13, rb: 13,
      eyes: { y: 29, gap: 4.6, rx: 2.4, ry: 3.3 }, armY: 35,
      acc:
        `<g class="acc"><path d="M40.5 15.5l-5.6-3.6v7.2z" fill="#8b5cf6"/><path d="M40.5 15.5l5.6-3.6v7.2z" fill="#8b5cf6"/>` +
        `<circle cx="40.5" cy="15.5" r="1.8" fill="#a78bfa"/></g>`,
    },
  };

  const MOOD_LABEL = { sleeping: "resting", idle: "idle", working: "working", waiting: "needs you", happy: "done" };

  /** A rounded rectangle with separate top and bottom corner radii. */
  function bodyPath([x, y, w, h], rt, rb) {
    return (
      `M${x + rt} ${y}H${x + w - rt}A${rt} ${rt} 0 0 1 ${x + w} ${y + rt}V${y + h - rb}` +
      `A${rb} ${rb} 0 0 1 ${x + w - rb} ${y + h}H${x + rb}A${rb} ${rb} 0 0 1 ${x} ${y + h - rb}V${y + rt}` +
      `A${rt} ${rt} 0 0 1 ${x + rt} ${y}Z`
    );
  }

  function inner(c, mood, uid) {
    const [bx, by, bw, bh] = c.box;
    const d = bodyPath(c.box, c.rt, c.rb);
    const e = c.eyes;
    const eyeX = [32 - e.gap, 32 + e.gap];
    const grow = mood === "waiting" ? 1.18 : 1;
    const my = e.y + e.ry + 3.6; // mouth line
    const auraOp = mood === "sleeping" ? 0 : mood === "idle" ? 0.22 : 0.4;

    let eyes;
    if (mood === "happy") eyes = eyeX.map((x) => `<path class="lid" d="M${x - 2.8} ${e.y + 1}q2.8 -4.4 5.6 0"/>`).join("");
    else if (mood === "sleeping") eyes = eyeX.map((x) => `<path class="lid" d="M${x - 2.6} ${e.y}q2.6 2.4 5.2 0"/>`).join("");
    else
      eyes = eyeX
        .map(
          (x) =>
            `<g><ellipse class="eye" cx="${x}" cy="${e.y}" rx="${e.rx * grow}" ry="${e.ry * grow}"/>` +
            `<circle class="glint" cx="${x + e.rx * 0.38}" cy="${e.y - e.ry * 0.42}" r="${mood === "waiting" ? 1.1 : 0.8}"/></g>`,
        )
        .join("");

    const mouth =
      mood === "happy"
        ? `<path class="mouth-fill" d="M29 ${my - 0.8}q3 4.4 6 0z"/>`
        : mood === "waiting"
          ? `<ellipse class="mouth-fill" cx="32" cy="${my + 0.4}" rx="1.5" ry="1.8"/>`
          : mood === "working"
            ? `<path class="mouth" d="M30.6 ${my}h2.8"/>`
            : mood === "idle"
              ? `<path class="mouth" d="M30.2 ${my - 0.4}q1.8 1.6 3.6 0"/>`
              : "";

    const cheeks =
      mood === "sleeping"
        ? ""
        : `<ellipse class="cheek" cx="${32 - e.gap - 4.2}" cy="${e.y + e.ry + 1.6}" rx="2.5" ry="1.5"/>` +
          `<ellipse class="cheek" cx="${32 + e.gap + 4.2}" cy="${e.y + e.ry + 1.6}" rx="2.5" ry="1.5"/>`;

    return (
      `<defs><radialGradient id="aura-${uid}"><stop offset="0%" stop-color="currentColor" stop-opacity="${auraOp}"/>` +
      `<stop offset="100%" stop-color="currentColor" stop-opacity="0"/></radialGradient>` +
      `<linearGradient id="skin-${uid}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0%" stop-color="${c.light}"/>` +
      `<stop offset="48%" stop-color="${c.color}"/><stop offset="100%" stop-color="${c.dark}"/></linearGradient></defs>` +
      `<ellipse class="aura" cx="32" cy="32" rx="31" ry="31" fill="url(#aura-${uid})"/>` +
      `<ellipse class="shadow" cx="32" cy="60" rx="${bw * 0.36}" ry="2.2"/>` +
      `<g class="react"><g class="float"><g class="sprite">` +
      `<rect class="limb arm-left" x="${bx - 3}" y="${c.armY}" width="6" height="9.5" rx="3" fill="${c.dark}" style="transform-origin:${bx}px ${c.armY + 2}px"/>` +
      `<rect class="limb arm-right" x="${bx + bw - 3}" y="${c.armY}" width="6" height="9.5" rx="3" fill="${c.dark}" style="transform-origin:${bx + bw}px ${c.armY + 2}px"/>` +
      `<path class="body" d="${d}" fill="url(#skin-${uid})"/>` +
      `<ellipse class="shine" cx="${bx + bw * 0.3}" cy="${by + bh * 0.2}" rx="${bw * 0.1}" ry="${bh * 0.1}"/>` +
      `<circle class="shine" cx="${bx + bw * 0.3}" cy="${by + bh * 0.2 + bh * 0.17}" r="1.1"/>` +
      c.acc +
      cheeks +
      `<g class="gaze"><g class="eyes">${eyes}</g>${mouth}</g>` +
      (mood === "sleeping" ? `<path class="dim" d="${d}"/>` : "") +
      `</g></g></g>` +
      (mood === "sleeping" ? `<text class="zz" x="${Math.min(53, bx + bw + 2)}" y="14">z</text>` : "")
    );
  }

  // ---------- Motion (Face.tsx) ----------

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPRING = "cubic-bezier(0.2, 0.9, 0.3, 1.25)";
  const none = { transform: "none" };

  const REACTION = {
    happy: {
      frames: [
        none,
        { transform: "scale(1.12, 0.86)", offset: 0.18 },
        { transform: "translateY(-8px) scale(0.92, 1.1)", offset: 0.45 },
        { transform: "scale(1.08, 0.92)", offset: 0.72 },
        none,
      ],
      ms: 700,
    },
    waiting: {
      frames: [none, { transform: "translateY(-5px) scale(0.94, 1.1)", offset: 0.3 }, { transform: "scale(1.05, 0.95)", offset: 0.6 }, none],
      ms: 450,
    },
    working: { frames: [none, { transform: "translateY(2px) scale(1.03, 0.97)", offset: 0.4 }, none], ms: 320 },
    sleeping: { frames: [none, { transform: "translateY(1.5px) scale(1.06, 0.9)", offset: 0.5 }, none], ms: 900 },
    idle: { frames: [none, { transform: "scale(1.04, 0.95)", offset: 0.4 }, none], ms: 500 },
  };
  const POP = [{ transform: "scale(0.55)", opacity: 0 }, { transform: "scale(1.08)", opacity: 1, offset: 0.6 }, none];
  const ARM_REST = { transform: "rotate(-22deg)" };
  const WAVE_HELLO = [
    ARM_REST,
    { transform: "rotate(-150deg)", offset: 0.25 },
    { transform: "rotate(-115deg)", offset: 0.5 },
    { transform: "rotate(-150deg)", offset: 0.75 },
    ARM_REST,
  ];
  const SQUISH = [
    none,
    { transform: "scale(1.18, 0.8)", offset: 0.25 },
    { transform: "scale(0.94, 1.08)", offset: 0.6 },
    { transform: "scale(1.02, 0.98)", offset: 0.8 },
    none,
  ];
  const BLINK = [{ transform: "scaleY(1)" }, { transform: "scaleY(0.1)", offset: 0.45 }, { transform: "scaleY(1)" }];
  const LOOK_AROUND = [
    none,
    { transform: "translate(-2.6px, 0.4px)", offset: 0.15 },
    { transform: "translate(-2.6px, 0.4px)", offset: 0.4 },
    { transform: "translate(2.6px, 0.4px)", offset: 0.55 },
    { transform: "translate(2.6px, 0.4px)", offset: 0.8 },
    none,
  ];
  const STRETCH = [
    none,
    { transform: "scale(0.95, 1.1)", offset: 0.35 },
    { transform: "scale(0.95, 1.1)", offset: 0.6 },
    { transform: "scale(1.03, 0.97)", offset: 0.82 },
    none,
  ];
  const HOP_SMALL = [none, { transform: "translateY(-4px)", offset: 0.4 }, none];

  /** The script animation currently owned by each element (at most one). */
  const owned = new WeakMap();
  function play(el, frames, opts) {
    if (!el || reducedMotion) return;
    try {
      owned.get(el)?.cancel();
      const a = el.animate(frames, opts);
      owned.set(el, a);
      a.onfinish = () => owned.get(el) === a && owned.delete(el);
    } catch {
      /* animation unsupported: stay still */
    }
  }

  // ---------- Registry: who is on screen, where the pointer is ----------

  const onScreen = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const m = en.target.__mascot;
        if (!m) continue;
        if (en.isIntersecting) {
          onScreen.add(m);
          m.shown();
        } else onScreen.delete(m);
      }
    },
    { rootMargin: "40px" },
  );

  let pointer = null;
  let raf = 0;
  const lookAll = () => {
    raf = 0;
    for (const m of onScreen) {
      if (!m.svg.isConnected) onScreen.delete(m);
      else m.look(pointer);
    }
  };
  const queueLook = () => {
    if (!raf) raf = requestAnimationFrame(lookAll);
  };
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      pointer = { x: e.clientX, y: e.clientY };
      queueLook();
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => {
    pointer = null;
    queueLook();
  });
  addEventListener("scroll", () => pointer && queueLook(), { passive: true });

  const pageVisible = () => document.visibilityState === "visible";
  let uidSeq = 0;

  class Mascot {
    constructor(host, opts) {
      this.who = CHARACTERS[opts.who] ? opts.who : "blip";
      this.mood = opts.mood || "idle";
      this.size = opts.size || 44;
      this.greet = opts.greet !== false;
      this.aura = opts.aura !== false;
      this.uid = "m" + ++uidSeq;
      this.greeted = false;

      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 64 64");
      svg.setAttribute("width", this.size);
      svg.setAttribute("height", this.size);
      svg.setAttribute("role", "img");
      svg.__mascot = this;
      this.svg = svg;
      svg.addEventListener("pointerdown", () => this.squish());
      this.render();
      host.appendChild(svg);
      host.mascot = this;
      io.observe(svg);
      this.scheduleBlink();
      this.scheduleMoment();
    }

    get alive() {
      return this.svg.isConnected;
    }
    get seen() {
      return onScreen.has(this) && pageVisible();
    }

    one(sel) {
      return this.svg.querySelector(sel);
    }

    render() {
      const c = CHARACTERS[this.who];
      this.svg.setAttribute("class", `mascot ${this.mood} char-${this.who}${this.aura ? "" : " no-aura"}`);
      this.svg.style.setProperty("--c", c.color);
      this.svg.setAttribute("aria-label", `${c.name}, ${MOOD_LABEL[this.mood]}`);
      this.svg.innerHTML = inner(c, this.mood, this.uid);
    }

    setMood(mood) {
      if (mood === this.mood) return;
      this.mood = mood;
      this.render();
      if (!this.greeted) return; // will react when it first appears
      this.blink();
      const r = REACTION[mood];
      play(this.one(".react"), r.frames, { duration: r.ms, iterations: mood === "happy" ? 2 : 1 });
    }

    /** First time on screen: pop in and wave hello (or celebrate). */
    shown() {
      if (this.greeted) return;
      this.greeted = true;
      if (!this.greet) return;
      const react = this.one(".react");
      if (this.mood === "happy") {
        play(react, REACTION.happy.frames, { duration: REACTION.happy.ms, iterations: 2 });
      } else {
        play(react, POP, { duration: 420, easing: SPRING });
        if (this.mood !== "sleeping" && this.mood !== "waiting") {
          play(this.one(".arm-right"), WAVE_HELLO, { duration: 900, delay: 250, easing: "ease-in-out" });
        }
      }
    }

    blink() {
      this.svg.querySelectorAll(".eye, .lid").forEach((e) => play(e, BLINK, { duration: 170, easing: "ease-in-out" }));
    }

    squish() {
      play(this.one(".react"), SQUISH, { duration: 480, easing: "ease-out" });
      this.blink();
    }

    wave() {
      if (this.mood === "sleeping") return;
      play(this.one(".arm-right"), WAVE_HELLO, { duration: 900, easing: "ease-in-out" });
    }

    hop() {
      play(this.one(".react"), REACTION.happy.frames, { duration: REACTION.happy.ms });
    }

    /** Plays the reaction for its current mood, as if it had just changed. */
    react() {
      const r = REACTION[this.mood];
      this.blink();
      play(this.one(".react"), r.frames, { duration: r.ms, iterations: this.mood === "happy" ? 2 : 1 });
    }

    look(p) {
      let gx = 0;
      let gy = 0;
      if (p) {
        const r = this.svg.getBoundingClientRect();
        const dx = p.x - (r.left + r.width / 2);
        const dy = p.y - (r.top + r.height * 0.4);
        const dist = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, dist / Math.max(160, r.width * 1.4));
        gx = (dx / dist) * 2.8 * reach;
        gy = (dy / dist) * 2.2 * reach;
      }
      this.svg.style.setProperty("--gx", `${gx.toFixed(2)}px`);
      this.svg.style.setProperty("--gy", `${gy.toFixed(2)}px`);
    }

    // Natural blinking: irregular, sometimes double; quicker when it needs you.
    scheduleBlink() {
      const wait = (this.mood === "waiting" ? 1800 : 2600) + Math.random() * 3500;
      setTimeout(() => {
        if (!this.alive) return; // removed from the page: stop
        if (this.seen && this.mood !== "sleeping" && this.mood !== "happy") {
          this.blink();
          if (Math.random() < 0.2) setTimeout(() => this.blink(), 260);
        }
        this.scheduleBlink();
      }, wait);
    }

    // Idle moments: look around, stretch, hop (asleep: a slow stretch).
    scheduleMoment() {
      setTimeout(() => {
        if (!this.alive) return;
        if (this.seen && (this.mood === "idle" || this.mood === "sleeping")) {
          const react = this.one(".react");
          if (this.mood === "sleeping") play(react, STRETCH, { duration: 2200, easing: "ease-in-out" });
          else {
            const pick = Math.floor(Math.random() * 3);
            if (pick === 0 && !pointer) play(this.one(".gaze"), LOOK_AROUND, { duration: 2400, easing: "ease-in-out" });
            else if (pick === 1) play(react, STRETCH, { duration: 1200, easing: "ease-in-out" });
            else play(react, HOP_SMALL, { duration: 450, easing: SPRING });
          }
        }
        this.scheduleMoment();
      }, 9000 + Math.random() * 12000);
    }
  }

  /** Mounts every [data-mascot] placeholder inside root that isn't mounted yet. */
  function mount(root = document) {
    const out = [];
    root.querySelectorAll("[data-mascot]").forEach((host) => {
      if (host.mascot) return;
      out.push(
        new Mascot(host, {
          who: host.dataset.mascot,
          mood: host.dataset.mood,
          size: Number(host.dataset.size) || 44,
          greet: host.dataset.greet !== "0",
          aura: host.dataset.aura !== "0",
        }),
      );
    });
    return out;
  }

  /** Markup for a placeholder, for templates. */
  function tag(who, mood, size, extra = "") {
    return `<span class="face" data-mascot="${who}" data-mood="${mood}" data-size="${size}" ${extra}></span>`;
  }

  window.Crew = { CHARACTERS, mount, tag, reducedMotion };
})();
