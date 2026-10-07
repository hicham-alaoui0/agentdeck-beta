// Blip in 3D: AgentDeck's mascot as a little vinyl toy that keeps you company
// down the page. Drawn by one small WebGL shader (signed distance fields, no
// library, nothing loaded from elsewhere), so it stays a few KB.
//
// What it does:
// - follows you: it sits in the corner and reacts to the section you're in
//   (waves on the hero, types during the demo, gets alert on safety, closes
//   its eyes on privacy, cheers at the download);
// - its rim light is its status color, like the colored outline in the app;
// - head and eyes follow your cursor; it leans when you scroll fast;
// - click it: squish, jump, spin; hover a Download button: it gets excited;
// - leave the page alone and it falls asleep (violet), until you move.
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

  // Where you are → how Blip feels and what it says (once per visit and section).
  const SECTIONS = {
    top: { mood: "idle", wave: true, line: "Hi! I'm Blip. I'll tag along." },
    how: { mood: "working", line: "That island up there is live. Hover it!" },
    story: { mood: "waiting", line: "Which terminal was it again…?" },
    crew: { mood: "happy", line: "Those are my friends!" },
    features: { mood: "working", line: "Approve, answer, reply. All from up top." },
    safety: { mood: "waiting", line: "Risky commands? I flag them." },
    privacy: { mood: "idle", shy: true, line: "I'm not looking. Nothing leaves your PC." },
    setup: { mood: "working", line: "One minute, promise." },
    faq: { mood: "idle", line: "Ask away." },
    get: { mood: "happy", wave: true, line: "Ready? Take me home!" },
  };
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
  };
  const target = { yaw: 0, pitch: 0, roll: 0 };
  let lastInput = performance.now();
  let asleep = false;
  let sectionMood = SECTIONS.top;

  function setMood(sec) {
    sectionMood = sec;
    if (!asleep) {
      s.mood = sec.mood;
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
      s.mood = sectionMood.mood;
      s.shy = !!sectionMood.shy;
      hop(1.2);
      say("Huh? I'm up, I'm up!");
    }
    kick();
  }

  canvas.addEventListener("click", () => {
    hop(1.3);
    s.squash = 0.72;
    if (!reduced) s.spin = Math.PI * 2;
    say(CLICK_LINES[Math.floor(Math.random() * CLICK_LINES.length)], 2600);
    kick();
  });
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

  // Sections: the one crossing the middle of the screen sets the mood.
  const said = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const sec = SECTIONS[e.target.id];
        if (!sec) continue;
        setMood(sec);
        if (sec.wave) s.wave = 1.8;
        if (!said.has(e.target.id) && !hidden) {
          said.add(e.target.id);
          if (e.target.id !== "top" || scrollY < 40) say(sec.line);
          hop(0.7);
        }
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

    // Look at the cursor (the head turns, the eyes lead).
    const r = canvas.getBoundingClientRect();
    if (pointer && !asleep && !reduced) {
      const dx = (pointer.x - (r.left + r.width / 2)) / 500;
      const dy = (pointer.y - (r.top + r.height * 0.4)) / 500;
      target.yaw = Math.max(-1, Math.min(1, dx)) * 0.6;
      target.pitch = Math.max(-1, Math.min(1, dy)) * 0.35;
    } else {
      target.yaw = Math.sin(time * 0.4) * 0.15;
      target.pitch = asleep ? 0.25 : 0;
    }
    // Lean into fast scrolling.
    scrollV *= Math.exp(-6 * dt);
    target.roll = reduced ? 0 : Math.max(-0.3, Math.min(0.3, -scrollV * 0.004));
    s.yaw = approach(s.yaw, target.yaw, 6, dt);
    s.pitch = approach(s.pitch, target.pitch, 6, dt);
    s.roll = approach(s.roll, target.roll, 8, dt);
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
    s.eye = approach(s.eye, eye, 30, dt);

    const glowT = COLORS[mood];
    for (let i = 0; i < 3; i++) s.glow[i] = approach(s.glow[i], glowT[i], 4, dt);

    resize();
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniformMatrix3fv(U.uRot, false, rotation(s.yaw + s.spin, s.pitch, s.roll));
    gl.uniform3f(U.uPos, 0, s.y * 0.35 + bob, 0);
    gl.uniform1f(U.uSquash, s.squash * (1 + breathe * 0.025));
    gl.uniform1f(U.uEye, s.eye);
    gl.uniform1f(U.uEyeBig, eyeBig);
    gl.uniform1f(U.uMouth, mood === "happy" || s.excitedUntil > now ? 1 : mouth);
    gl.uniform1f(U.uArmL, s.armL);
    gl.uniform1f(U.uArmR, s.armR);
    gl.uniform2f(U.uLook, s.lookX, s.lookY);
    gl.uniform3f(U.uGlow, s.glow[0], s.glow[1], s.glow[2]);
    gl.uniform1f(U.uGlowAmt, mood === "idle" ? 0.15 : 1);
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
    document.body.append(root, back);
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
