// Blip in 3D: AgentDeck's mascot as a little vinyl toy that keeps you company
// down the page. Drawn by one small WebGL shader (signed distance fields, no
// library, nothing loaded from elsewhere), so it stays a few KB.
//
// What it does:
// - follows you: it flies to a perch next to what each section is about
//   (beside the hero's buttons, on the demo window, at the end of the crew's
//   row, next to the Download button) and floats in the corner in between,
//   trailing behind as you scroll; it reacts to the section (waves on the
//   hero, types during the demo, gets alert on safety, closes its eyes on
//   privacy, cheers at the download);
// - its rim light is its status color, like the colored outline in the app;
// - head and eyes follow your cursor; it leans when you scroll fast;
// - click it: squish, jump, spin; hover a Download button: it gets excited;
// - leave the page alone and it falls asleep (violet), until you move;
// - the demos talk to it (`ad:*` events from stage.js / main.js): it points
//   at an approval card, cheers or shrugs at your answer, and covers its eyes
//   while you hold "Hold to allow" (thumbs up when you get there);
// - now and then a friend from the crew flies by to say hi;
// - select some text and it hops onto your selection;
// - secret: type "blip" or click it 5 times.
// Honors "reduce motion" (holds still), hides with ×, falls back to the 2D
// Blip without WebGL. Renders only while visible.
(function () {
  const KEY = "agentdeck.buddy";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SLEEP_AFTER = 30000;

  const COLORS = {
    idle: [0.43, 0.91, 0.72],
    working: [0.04, 0.52, 1.0],
    waiting: [1.0, 0.62, 0.04],
    happy: [0.19, 0.82, 0.35],
    sleeping: [0.75, 0.35, 0.95],
  };

  // Where you are → how Blip feels, what it says (once per visit and section)
  // and where it perches: `beside` an element (standing on its baseline),
  // `after-text` (beside the text itself, for centered lines in wide boxes) or
  // `on` its top edge, near the right corner; the first spot that fits on
  // screen wins. None fits: the corner.
  const SECTIONS = {
    top: { mood: "idle", wave: true, line: "Hi! I'm Blip. I'll tag along.", perch: [[".hero .hero-ctas > :last-child", "beside"]] },
    how: { mood: "working", line: "That island up there is live. Hover it!", perch: [["#stage", "on"]] },
    story: { mood: "waiting", line: "Which terminal was it again…?" },
    // At the crew it stands by the mood picker and copies the mood you pick.
    crew: { mood: "happy", line: "Those are my friends! Pick a mood, I'll do it too.", mirror: ".moods", perch: [[".crew-sec .moods", "beside"], [".crew-sec .psst", "after-text"]] },
    features: { mood: "working", line: "Approve, answer, reply. All from up top." },
    safety: { mood: "waiting", line: "Risky commands? I flag them.", perch: [[".riskdemo", "on"]] },
    privacy: { mood: "idle", shy: true, line: "I'm not looking. Nothing leaves your PC." },
    setup: { mood: "working", line: "One minute, promise." },
    faq: { mood: "idle", line: "Ask away." },
    get: { mood: "happy", wave: true, line: "Ready? Take me home!", perch: [["#get .hero-ctas > :last-child", "beside"]] },
  };
  /** Feet height inside the canvas, as a share of its height (from the shader's camera). */
  const FEET = 0.06;
  /** Narrower than this, Blip stays in the corner (no room beside things). */
  const PERCH_MIN_WIDTH = 900;
  const SELECT_LINES = ["Ooh, good part.", "Noted!", "I'll sit right here.", "Reading along…"];
  const CHEER_LINES = ["Nice!", "Approved. Back to work, agent.", "Good call."];
  const CLICK_LINES = ["Boing!", "Hey, that tickles.", "I run on hooks and good vibes.", "Psst: there's a 2D me in the app.", "Wheee!"];

  // ---------- DOM ----------
  const root = document.createElement("div");
  root.className = "buddy";
  root.innerHTML =
    '<div class="buddy-bubble" aria-hidden="true"></div>' +
    '<div class="buddy-stage"><canvas class="buddy-canvas" role="img" aria-label="Blip, AgentDeck\'s mascot, keeping you company"></canvas>' +
    '<div class="buddy-shadow" aria-hidden="true"></div></div>' +
    '<button class="buddy-close" type="button" aria-label="Hide Blip">×</button>';
  const back = document.createElement("button");
  back.className = "buddy-back";
  back.type = "button";
  back.innerHTML = '<span data-mascot="blip" data-mood="happy" data-size="22" data-aura="0" data-greet="0"></span>Blip';
  back.setAttribute("aria-label", "Bring Blip back");

  const canvas = root.querySelector("canvas");
  const bubble = root.querySelector(".buddy-bubble");
  const shadow = root.querySelector(".buddy-shadow");

  let hidden = false;
  try {
    hidden = localStorage.getItem(KEY) === "off";
  } catch {
    /* shown */
  }

  function setHidden(h) {
    hidden = h;
    try {
      localStorage.setItem(KEY, h ? "off" : "on");
    } catch {
      /* this visit only */
    }
    root.classList.toggle("gone", h);
    back.classList.toggle("shown", h);
    if (!h) {
      hop(1);
      say("I'm back!");
      kick();
    }
  }
  root.querySelector(".buddy-close").addEventListener("click", () => setHidden(true));
  back.addEventListener("click", () => setHidden(false));

  // ---------- speech ----------
  let bubbleTimer = 0;
  function say(text, ms = 3600) {
    bubble.textContent = text;
    bubble.classList.add("on");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("on"), ms);
  }

  // ---------- state ----------
  const s = {
    mood: "idle",
    shy: false,
    glow: COLORS.idle.slice(),
    yaw: 0, pitch: 0, roll: 0, spin: 0,
    lookX: 0, lookY: 0,
    y: 0, vy: 0, squash: 1, squashV: 0,
    eye: 1, blinkUntil: 0, nextBlink: 2000,
    armL: 0.35, armR: 0.35, wave: 0,
    excitedUntil: 0,
    // A short scripted reaction: { pose, until, at } (see react()).
    act: null,
    danceUntil: 0,
  };
  /** Plays a pose for `ms` (pose: point, cover, peek, cheer, thumbs, shrug); `at` = what to look at. */
  function react(pose, ms, at = null) {
    s.act = { pose, until: performance.now() + ms, at };
    kick();
  }
  /** Says a line only the first time this visit (demos loop; Blip shouldn't repeat itself). */
  const spoken = new Set();
  function sayOnce(key, text, ms) {
    if (spoken.has(key)) return;
    spoken.add(key);
    say(text, ms);
  }
  const onScreen = (el) => {
    if (!el?.isConnected) return false;
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  const target = { yaw: 0, pitch: 0, roll: 0 };
  // Where Blip is on screen (top-left of its box) and how fast it's flying.
  const pos = { x: -1, y: -1, vx: 0, vy: 0, flying: false };
  let lastInput = performance.now();
  let asleep = false;
  let sectionMood = SECTIONS.top;

  /** The mood picked in a section's mood picker (the crew's), if it has one. */
  const mirrored = (sec) => (sec.mirror && document.querySelector(`${sec.mirror} [aria-checked="true"]`)?.dataset.mood) || null;

  function setMood(sec) {
    sectionMood = sec;
    if (!asleep) {
      s.mood = mirrored(sec) || sec.mood;
      s.shy = !!sec.shy;
    }
    // Without WebGL: the 2D Blip shows the mood.
    root.querySelector(".buddy-flat")?.mascot?.setMood(sec.mood);
    kick();
  }
  function hop(power = 1) {
    if (reduced) return;
    if (s.y <= 0.001) s.vy = 2.1 * power;
  }

  // ---------- 2D fallback ----------
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) {
    root.classList.add("flat");
    canvas.remove();
    const face = document.createElement("span");
    face.className = "buddy-flat";
    face.dataset.mascot = "blip";
    face.dataset.mood = "idle";
    face.dataset.size = "120";
    root.querySelector(".buddy-stage").prepend(face);
  }

  // ---------- shader ----------
  const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform mat3 uRot;
uniform vec3 uPos;
uniform float uSquash, uEye, uEyeBig, uMouth, uArmL, uArmR, uGlowAmt;
uniform vec2 uLook;
uniform vec3 uGlow;

const float FEET = -0.62;
const float FOCAL = 1.9;

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}
float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// World to Blip's own space: moved, turned, squashed from the feet.
vec3 local(vec3 p) {
  p = uRot * (p - uPos);
  p.y = (p.y - FEET) / uSquash + FEET;
  p.xz *= sqrt(uSquash);
  return p;
}

vec3 eyeAt(float side) {
  return vec3(side * 0.15 + uLook.x * 0.035, 0.17 + uLook.y * 0.03, 0.355);
}

// x: distance, y: material (1 body, 2 arm, 3 eye, 4 glint)
vec2 map(vec3 q) {
  vec3 p = local(q);
  float d = sdCapsule(p, vec3(0.0, -0.2, 0.0), vec3(0.0, 0.2, 0.0), 0.42);
  vec2 res = vec2(d, 1.0);
  vec3 sl = vec3(-0.39, -0.02, 0.0), sr = vec3(0.39, -0.02, 0.0);
  float al = sdCapsule(p, sl, sl + 0.21 * vec3(-sin(uArmL), -cos(uArmL), 0.08), 0.075);
  float ar = sdCapsule(p, sr, sr + 0.21 * vec3(sin(uArmR), -cos(uArmR), 0.08), 0.075);
  float arms = min(al, ar);
  float blended = smin(res.x, arms, 0.06);
  res = vec2(blended, arms < d ? 2.0 : 1.0);
  vec3 er = vec3(0.062, 0.095 * uEye, 0.055) * uEyeBig;
  float eyes = min(sdEllipsoid(p - eyeAt(-1.0), er), sdEllipsoid(p - eyeAt(1.0), er));
  if (eyes < res.x) res = vec2(eyes, 3.0);
  if (uEye > 0.5) {
    vec3 g = vec3(0.022, 0.034, 0.05) * uEyeBig;
    float glint = min(length(p - eyeAt(-1.0) - g), length(p - eyeAt(1.0) - g)) - 0.019 * uEyeBig;
    if (glint < res.x) res = vec2(glint, 4.0);
  }
  return res;
}

vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x));
}

vec3 shade(vec3 p, vec3 rd, float m) {
  vec3 n = normalAt(p);
  vec3 lp = local(p);
  vec3 L = normalize(vec3(-0.55, 0.8, 0.7));
  float wrap = pow(clamp(dot(n, L) * 0.5 + 0.5, 0.0, 1.0), 1.4);
  float spec = pow(max(dot(reflect(-L, n), -rd), 0.0), 70.0);
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.6);
  vec3 light = vec3(0.72, 0.97, 0.86), base = vec3(0.43, 0.91, 0.72), dark = vec3(0.2, 0.62, 0.48);
  vec3 col;
  if (m > 3.5) return vec3(1.0);
  if (m > 2.5) {
    col = vec3(0.07, 0.08, 0.1) + spec * 0.9;
  } else {
    float g = clamp(lp.y * 0.9 + 0.55 - lp.x * 0.25, 0.0, 1.0);
    col = mix(dark, mix(base, light, smoothstep(0.55, 1.0, g)), smoothstep(0.0, 0.6, g));
    if (m > 1.5) col *= 0.82;
    float blush = 0.0;
    if (lp.z > 0.2 && m < 1.5) {
      // Cheeks (blended in after the lighting, so they stay pink).
      float ck = min(length(lp.xy - vec2(-0.255, 0.04)), length(lp.xy - vec2(0.255, 0.04)));
      blush = (1.0 - smoothstep(0.03, 0.075, ck)) * 0.55;
      // Mouth: 0 smile, 1 open grin, 2 "o", 3 none.
      vec2 mp = lp.xy - vec2(0.0, 0.04);
      float ink = 0.0;
      if (uMouth < 0.5) ink = (1.0 - smoothstep(0.008, 0.014, abs(length(mp - vec2(0.0, 0.06)) - 0.06))) * step(mp.y, 0.03);
      else if (uMouth < 1.5) ink = (1.0 - smoothstep(0.065, 0.072, length(mp - vec2(0.0, 0.03)))) * step(mp.y, 0.03);
      else if (uMouth < 2.5) ink = 1.0 - smoothstep(0.026, 0.032, length((mp - vec2(0.0, -0.005)) * vec2(1.0, 0.8)));
      col = mix(col, vec3(0.07, 0.08, 0.1), ink);
    }
    col *= 0.35 + 0.75 * wrap;
    col = mix(col, vec3(1.0, 0.42, 0.62) * (0.6 + 0.4 * wrap), blush);
    col += spec * 0.55;
  }
  // Status rim: the status color takes over the edge (not added, so orange stays orange on mint).
  float rim = clamp(fres * (0.45 + 1.25 * uGlowAmt), 0.0, 0.92);
  col = mix(col, uGlow * 1.15, rim) + uGlow * fres * 0.25;
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 ro = vec3(0.0, 0.13, 3.2);
  vec3 rd = normalize(vec3(uv, -FOCAL));
  float px = 1.0 / (uRes.y * FOCAL);
  float t = 2.2, best = 1e9, bestT = t;
  float hit = -1.0;
  for (int i = 0; i < 72; i++) {
    vec2 h = map(ro + rd * t);
    float ratio = h.x / (t * px);
    if (ratio < best) { best = ratio; bestT = t; }
    if (h.x < 0.0012) { hit = h.y; break; }
    t += h.x * 0.85;
    if (t > 4.6) break;
  }
  if (hit > 0.0) {
    gl_FragColor = vec4(shade(ro + rd * t, rd, hit), 1.0);
    return;
  }
  // Anti-aliased silhouette: rays that only grazed Blip get partial coverage.
  float a = clamp(1.0 - best, 0.0, 1.0);
  if (a <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 p = ro + rd * bestT;
  vec3 c = shade(p, rd, map(p).y);
  gl_FragColor = vec4(c * a, a);
}`;

  let prog, U = {};
  if (gl) {
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ["uRes", "uRot", "uPos", "uSquash", "uEye", "uEyeBig", "uMouth", "uArmL", "uArmR", "uGlowAmt", "uLook", "uGlow"])
      U[n] = gl.getUniformLocation(prog, n);
    gl.clearColor(0, 0, 0, 0);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }

  /** World → Blip: rotation by yaw (y), pitch (x), roll (z), inverted, column-major. */
  function rotation(yaw, pitch, roll) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    // R = Rz(roll) * Ry(yaw) * Rx(pitch); we need R^T, which in column-major is R's rows.
    const R = [
      [cr * cy, cr * sy * sp - sr * cp, cr * sy * cp + sr * sp],
      [sr * cy, sr * sy * sp + cr * cp, sr * sy * cp - cr * sp],
      [-sy, cy * sp, cy * cp],
    ];
    return new Float32Array([R[0][0], R[0][1], R[0][2], R[1][0], R[1][1], R[1][2], R[2][0], R[2][1], R[2][2]]);
  }

  // ---------- input ----------
  let pointer = null;
  let scrollV = 0;
  let lastScroll = scrollY;
  addEventListener("pointermove", (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    wake();
  }, { passive: true });
  addEventListener("scroll", () => {
    scrollV += scrollY - lastScroll;
    lastScroll = scrollY;
    wake();
  }, { passive: true });
  addEventListener("keydown", wake);

  function wake() {
    lastInput = performance.now();
    if (asleep) {
      asleep = false;
      s.mood = mirrored(sectionMood) || sectionMood.mood;
      s.shy = !!sectionMood.shy;
      hop(1.2);
      say("Huh? I'm up, I'm up!");
    }
    kick();
  }

  let clicks = [];
  canvas.addEventListener("click", () => {
    const now = performance.now();
    clicks = clicks.filter((t) => now - t < 2500).concat(now);
    if (clicks.length >= 5) {
      clicks = [];
      return dance();
    }
    hop(1.3);
    s.squash = 0.72;
    if (!reduced) s.spin = Math.PI * 2;
    say(CLICK_LINES[Math.floor(Math.random() * CLICK_LINES.length)], 2600);
    kick();
  });

  // ---------- secret: type "blip" (or click it 5 times) ----------
  let typed = "";
  addEventListener("keydown", (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t?.isContentEditable || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-4);
    if (typed === "blip") dance();
  });
  function dance() {
    if (hidden) return;
    s.danceUntil = performance.now() + 4200;
    say("♪ Blip, blip, blip! ♪", 3800);
    hop(1.2);
    kick();
  }

  // ---------- the demos ----------
  // The live demo's island asks for permission: look and point at it.
  addEventListener("ad:island", (e) => {
    if (e.detail.mode !== "ask" || !onScreen(e.detail.el) || asleep) return;
    react("point", 3800, e.detail.el);
    sayOnce("ask", "Psst, it's asking you!", 2600);
  });
  // An answer, in either demo: cheer at a yes, shrug at a no.
  addEventListener("ad:decision", (e) => {
    if (!onScreen(e.detail.el) || asleep) return;
    if (s.act?.pose === "thumbs" && performance.now() < s.act.until) return; // the hold already got its cheer
    if (e.detail.act === "deny") {
      react("shrug", 2200, e.detail.el);
      sayOnce("deny", "Denied. Safety first.", 2400);
    } else {
      react("cheer", 2000, e.detail.el);
      hop(0.9);
      sayOnce("allow", CHEER_LINES[Math.floor(Math.random() * CHEER_LINES.length)], 2200);
    }
  });
  // Hold to allow: it can't watch… then a thumbs up when you get there.
  addEventListener("ad:hold", (e) => {
    if (!onScreen(e.detail.el) || asleep || hidden) return;
    const phase = e.detail.phase;
    if (phase === "start") {
      react("cover", 6000, e.detail.el);
      say("I can't look…", 1800);
    } else if (phase === "cancel") {
      react("peek", 1200, e.detail.el);
      say("Phew. Changed your mind?", 2000);
    } else {
      react("thumbs", 2400, e.detail.el);
      hop(1);
      say("A deliberate yes. Nice.", 2400);
    }
  });

  // ---------- your text selection: it hops onto it ----------
  let selRange = null;
  let selTimer = 0;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      const sel = getSelection();
      const text = sel && !sel.isCollapsed ? sel.toString().trim() : "";
      const node = sel?.anchorNode?.parentElement;
      if (text.length < 3 || !node || node.closest(".buddy, input, textarea") || innerWidth < 640) {
        selRange = null;
        return kick();
      }
      selRange = sel.getRangeAt(0).cloneRange();
      say(SELECT_LINES[Math.floor(Math.random() * SELECT_LINES.length)], 1800);
      kick();
    }, 450);
  });
  /** Where to stand on the selection: on top of its last line, near its end. */
  function selectionPerch(w, h) {
    if (!selRange) return null;
    const rects = selRange.getClientRects();
    const r = rects[rects.length - 1];
    if (!r || r.bottom < 70 || r.top > innerHeight) return null;
    const x = Math.max(8, Math.min(innerWidth - w - 8, r.right - w * 0.5));
    const y = r.top - h + h * FEET + 2;
    return y >= 64 ? { x, y } : null;
  }

  // ---------- friends from the crew drop by ----------
  const visitor = document.createElement("div");
  visitor.className = "buddy-visitor";
  visitor.setAttribute("aria-hidden", "true");
  let visiting = null; // { name } while a friend is on screen
  function scheduleVisit(first) {
    setTimeout(visit, (first ? 25000 : 60000) + Math.random() * 45000);
  }
  function visit() {
    scheduleVisit(false);
    if (hidden || asleep || document.hidden || reduced || innerWidth < 700 || !window.Crew) return;
    const ids = Object.keys(Crew.CHARACTERS).filter((id) => id !== "blip");
    const id = ids[Math.floor(Math.random() * ids.length)];
    const name = Crew.CHARACTERS[id].name;
    const box = root.getBoundingClientRect();
    const side = box.left + box.width / 2 > innerWidth / 2 ? "left" : "right";
    visitor.className = `buddy-visitor from-${side}`;
    visitor.style.top = `${Math.max(90, Math.min(innerHeight - 140, box.top + 10))}px`;
    visitor.innerHTML = `<span data-mascot="${id}" data-mood="happy" data-size="64"></span><b>Hi Blip!</b>`;
    Crew.mount(visitor);
    requestAnimationFrame(() => requestAnimationFrame(() => visitor.classList.add("in")));
    visiting = { name };
    setTimeout(() => {
      s.wave = 2;
      say(`Oh hey, ${name}!`, 2200);
      kick();
    }, 900);
    setTimeout(() => {
      visitor.classList.remove("in");
      visiting = null;
    }, 3800);
  }
  /** Dev aid: `AD.visit()` in the console brings a friend right away. */
  (window.AD = window.AD || {}).visit = visit;
  canvas.addEventListener("pointerenter", () => {
    s.wave = 1.6;
    kick();
  });
  document.querySelectorAll("[data-download]").forEach((a) =>
    a.addEventListener("pointerenter", () => {
      s.excitedUntil = performance.now() + 2500;
      hop(1.1);
      say("That's the one!", 2200);
      kick();
    }),
  );

  // Picking a mood for the crew: Blip joins in.
  document.querySelectorAll(".moods").forEach((picker) =>
    new MutationObserver(() => {
      if (sectionMood.mirror && !asleep) setMood(sectionMood);
    }).observe(picker, { subtree: true, attributes: true, attributeFilter: ["aria-checked"] }),
  );

  // Sections: the one crossing the middle of the screen sets the mood.
  // Sections can nest (the demo is inside the hero), so it keeps every section
  // in the middle band and picks the innermost one.
  const said = new Set();
  const inBand = new Set();
  let current = null;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) inBand.add(e.target);
        else inBand.delete(e.target);
      }
      const inner = [...inBand].find((el) => ![...inBand].some((other) => other !== el && el.contains(other)));
      if (!inner || inner.id === current) return;
      current = inner.id;
      const sec = SECTIONS[current];
      setMood(sec);
      if (sec.wave) s.wave = 1.8;
      if (!said.has(current) && !hidden) {
        said.add(current);
        if (current !== "top" || scrollY < 40) say(sec.line);
        hop(0.7);
      }
    },
    { rootMargin: "-45% 0px -45% 0px" },
  );
  Object.keys(SECTIONS).forEach((id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });

  // ---------- animation ----------
  let raf = 0;
  let last = performance.now();
  function kick() {
    if (!raf && !hidden && !document.hidden && gl) raf = requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", kick);

  const approach = (v, t, k, dt) => v + (t - v) * (1 - Math.exp(-k * dt));

  /** Where Blip wants to be now: its section's perch if it's on screen, else the corner. */
  function perchTarget(w, h) {
    const vw = innerWidth, vh = innerHeight;
    const corner = { x: vw - w - 12, y: vh - h + h * FEET - 10 };
    const onSelection = selectionPerch(w, h);
    if (onSelection) return onSelection;
    if (!sectionMood.perch || vw < PERCH_MIN_WIDTH || asleep) return corner;
    for (const [sel, mode] of sectionMood.perch) {
      const el = document.querySelector(sel);
      if (!el) continue;
      let r = el.getBoundingClientRect();
      if (mode === "after-text") {
        const range = document.createRange();
        range.selectNodeContents(el);
        r = range.getBoundingClientRect();
      }
      const x = mode === "on" ? r.right - w - 18 : r.right + 10;
      const floor = mode === "on" ? r.top + 2 : r.bottom + 4;
      const y = floor - h + h * FEET;
      // Only where Blip fits on screen (below the nav).
      if (x >= 8 && x <= vw - w - 8 && y >= 64 && y <= vh - h - 4) return { x, y };
    }
    return corner;
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const time = now / 1000;

    if (!asleep && now - lastInput > SLEEP_AFTER) {
      asleep = true;
      s.mood = "sleeping";
      s.shy = false;
      say("z z z", 2500);
    }
    const mood = s.excitedUntil > now ? "happy" : s.mood;

    if (s.act && now > s.act.until) s.act = null;
    const dancing = now < s.danceUntil;

    // Look at the cursor, or at what it's reacting to, or at a visiting friend.
    const r = canvas.getBoundingClientRect();
    const focus =
      (s.act?.at?.isConnected && center(s.act.at)) || (visiting && center(visitor)) || (pointer && !asleep ? pointer : null);
    if (focus && !reduced) {
      const dx = (focus.x - (r.left + r.width / 2)) / 500;
      const dy = (focus.y - (r.top + r.height * 0.4)) / 500;
      target.yaw = Math.max(-1, Math.min(1, dx)) * 0.6;
      target.pitch = Math.max(-1, Math.min(1, dy)) * 0.35;
    } else {
      target.yaw = Math.sin(time * 0.4) * 0.15;
      target.pitch = asleep ? 0.25 : 0;
    }
    if (dancing && !reduced) target.yaw = Math.sin(time * 5) * 0.8;
    // Lean into fast scrolling.
    scrollV *= Math.exp(-6 * dt);
    target.roll = reduced ? 0 : Math.max(-0.3, Math.min(0.3, -scrollV * 0.004));
    s.yaw = approach(s.yaw, target.yaw, 6, dt);
    s.pitch = approach(s.pitch, target.pitch, 6, dt);
    s.lookX = approach(s.lookX, target.yaw / 0.6, 12, dt);
    s.lookY = approach(s.lookY, -target.pitch / 0.35, 12, dt);
    s.spin = approach(s.spin, 0, 5, dt);

    // Jump with gravity, squash on landing, spring back.
    if (!reduced) {
      s.vy -= 9 * dt;
      s.y += s.vy * dt;
      if (s.y < 0) {
        if (s.vy < -1.2) s.squash = Math.min(s.squash, 0.82);
        s.y = 0;
        s.vy = 0;
      }
    }
    s.squashV += ((1 - s.squash) * 180 - s.squashV * 14) * dt;
    s.squash += s.squashV * dt;

    // Fly toward the perch: a spring, so it trails behind while you scroll.
    const box = root.getBoundingClientRect();
    const goal = perchTarget(box.width, box.height);
    if (pos.x < 0 || reduced) {
      pos.x = goal.x;
      pos.y = goal.y;
    } else {
      const k = 55, damp = 2 * Math.sqrt(k);
      pos.vx += ((goal.x - pos.x) * k - pos.vx * damp) * dt;
      pos.vy += ((goal.y - pos.y) * k - pos.vy * damp) * dt;
      pos.x += pos.vx * dt;
      pos.y += pos.vy * dt;
    }
    const speed = Math.hypot(pos.vx, pos.vy);
    if (speed > 260) pos.flying = true;
    else if (pos.flying && speed < 60) {
      pos.flying = false;
      s.squash = Math.min(s.squash, 0.8); // landed
    }
    root.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`;
    root.classList.toggle("left", pos.x + box.width / 2 < 260);
    if (!reduced) target.roll += Math.max(-0.35, Math.min(0.35, -pos.vx * 0.0009));
    s.roll = approach(s.roll, target.roll, 8, dt);

    // Mood-driven pose.
    let bob = 0, armL = 0.35, armR = 0.35, eyeBig = 1, mouth = 0, breathe = 0;
    if (!reduced) bob = Math.sin(time * 2.2) * 0.022;
    if (mood === "working") {
      const tap = Math.sin(time * 14);
      armL = 0.9 + tap * 0.25;
      armR = 0.9 - tap * 0.25;
      if (!reduced) bob = Math.abs(Math.sin(time * 7)) * 0.02;
    } else if (mood === "waiting") {
      eyeBig = 1.15;
      mouth = 2;
      armR = 2.5 + Math.sin(time * 9) * 0.35;
    } else if (mood === "happy") {
      mouth = 1;
      armL = armR = 2.3 + Math.sin(time * 8) * 0.3;
      if (!reduced && s.y === 0 && Math.sin(time * 4.5) > 0.97) hop(0.6);
    } else if (mood === "sleeping") {
      mouth = 3;
      breathe = Math.sin(time * 1.6);
      bob = -0.03;
    }
    if (s.wave > 0) {
      s.wave -= dt;
      armR = 2.4 + Math.sin(time * 12) * 0.45;
    }
    if (s.shy) {
      // Privacy: hands up, eyes shut.
      armL = armR = 2.75;
    }
    if (pos.flying) {
      // Arms out like wings while it flies over.
      armL = armR = 1.75 + Math.sin(time * 16) * 0.35;
    }
    // Reactions to the demos (they win over the mood pose for a moment).
    let eyeOverride = null;
    const pose = s.act?.pose;
    if (pose === "point" && s.act.at?.isConnected) {
      // Raise the arm on the card's side, aimed at it.
      const c = center(s.act.at);
      const dx = c.x - (r.left + r.width / 2), dy = c.y - (r.top + r.height * 0.45);
      const aim = Math.atan2(Math.abs(dx), dy);
      if (dx < 0) armL = aim;
      else armR = aim;
      eyeBig = 1.1;
      mouth = 2;
    } else if (pose === "cover") {
      armL = armR = 2.75;
      eyeOverride = 0.1;
      mouth = 3;
    } else if (pose === "peek") {
      armL = 2.75;
      armR = 1.2;
      eyeBig = 1.15;
    } else if (pose === "cheer") {
      armL = armR = 2.4 + Math.sin(time * 10) * 0.3;
      mouth = 1;
      eyeOverride = 0.35;
    } else if (pose === "thumbs") {
      armR = 2.95 + Math.sin(time * 9) * 0.12;
      armL = 0.5;
      mouth = 1;
      eyeOverride = 0.35;
    } else if (pose === "shrug") {
      armL = armR = 1.25;
      mouth = 3;
      eyeOverride = 0.6;
    }
    if (dancing) {
      // Arms in turn, hops on the beat, a wiggle, and every color it knows.
      const beat = Math.sin(time * 9);
      armL = 1.6 + beat * 1.1;
      armR = 1.6 - beat * 1.1;
      mouth = 1;
      eyeOverride = 0.35;
      if (!reduced && s.y === 0 && Math.sin(time * 6.3) > 0.9) hop(0.55);
    }
    s.armL = approach(s.armL, armL, 14, dt);
    s.armR = approach(s.armR, armR, 14, dt);

    // Blinks (eyes shut while asleep, shy or grinning).
    let eye = 1;
    if (mood === "sleeping" || s.shy) eye = 0.12;
    else if (mood === "happy") eye = 0.35;
    if (now > s.nextBlink && !reduced) {
      s.blinkUntil = now + 130;
      s.nextBlink = now + 2200 + Math.random() * 4000;
    }
    if (now < s.blinkUntil) eye = 0.1;
    if (eyeOverride !== null) eye = eyeOverride;
    s.eye = approach(s.eye, eye, 30, dt);

    const reacting = pose === "cheer" || pose === "thumbs" ? "happy" : pose === "point" || pose === "cover" || pose === "peek" ? "waiting" : null;
    let glowT = COLORS[reacting || mood];
    if (dancing) {
      const hue = (time * 0.6) % 1;
      glowT = [0, 1, 2].map((i) => 0.5 + 0.5 * Math.cos(6.283 * (hue + i / 3)));
    }
    for (let i = 0; i < 3; i++) s.glow[i] = approach(s.glow[i], glowT[i], 4, dt);

    resize();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniformMatrix3fv(U.uRot, false, rotation(s.yaw + s.spin, s.pitch, s.roll));
    gl.uniform3f(U.uPos, 0, s.y * 0.35 + bob, 0);
    gl.uniform1f(U.uSquash, s.squash * (1 + breathe * 0.025));
    gl.uniform1f(U.uEye, s.eye);
    gl.uniform1f(U.uEyeBig, eyeBig);
    gl.uniform1f(U.uMouth, pose || dancing ? mouth : mood === "happy" || s.excitedUntil > now ? 1 : mouth);
    gl.uniform1f(U.uArmL, s.armL);
    gl.uniform1f(U.uArmR, s.armR);
    gl.uniform2f(U.uLook, s.lookX, s.lookY);
    gl.uniform3f(U.uGlow, s.glow[0], s.glow[1], s.glow[2]);
    gl.uniform1f(U.uGlowAmt, mood === "idle" && !reacting && !dancing ? 0.15 : 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // The shadow shrinks as Blip jumps.
    const lift = s.y * 0.35;
    shadow.style.transform = `translateX(-50%) scale(${(1 - lift * 1.2).toFixed(3)})`;
    shadow.style.opacity = (0.55 - lift).toFixed(3);
    root.dataset.mood = mood;

    // Keep going while visible (still for reduced motion once settled).
    const busy = !reduced || Math.abs(s.squash - 1) > 0.001 || Math.abs(s.eye - eye) > 0.01;
    if (busy && !hidden && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function start() {
    document.body.append(root, back, visitor);
    scheduleVisit(true);
    if (window.Crew) Crew.mount(back);
    if (!gl && window.Crew) Crew.mount(root);
    root.classList.toggle("gone", hidden);
    back.classList.toggle("shown", hidden);
    if (!gl) return;
    try {
      resize();
      kick();
    } catch {
      root.remove();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
