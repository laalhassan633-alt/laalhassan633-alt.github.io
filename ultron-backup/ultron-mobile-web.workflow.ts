import { workflow, trigger, node } from '@n8n/workflow-sdk';

const serve_Mobile_Page = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2,
  config: { id: '66e4ac5a-9202-41b8-9947-cd4f4778fb43', name: 'Serve Mobile Page', parameters: { httpMethod: 'GET', path: 'ultron-app', responseMode: 'responseNode', options: {} }, webhookId: 'fb32f5f9-816b-464c-aaf8-014e45bdfa67' }
});

const serve_Page = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    id: 'fe02f7b8-910f-4faf-8754-43ddd48d295b',
    name: 'Serve Page',
    parameters: {
      respondWith: 'text',
      responseBody: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="mobile-web-app-capable" content="yes">
<title>U.L.T.R.O.N.</title>
<link rel="manifest" href="https://alirff.app.n8n.cloud/webhook/ultron-app-manifest">
<style>
#splash {
  position: fixed; inset: 0; z-index: 9999;
  background: #000;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
  transition: opacity .5s ease;
}
#splash.hide { opacity: 0; pointer-events: none; }
#splash .logo {
  width: 120px; height: 120px; border-radius: 50%;
  border: 2px solid #ffae2b;
  box-shadow: 0 0 40px rgba(255,174,43,.5), inset 0 0 30px rgba(255,174,43,.15);
  display: grid; place-items: center;
  animation: splashPulse 1.6s ease-in-out infinite;
  position: relative;
}
#splash .logo::before { content: ""; position: absolute; inset: 14px; border: 1.5px solid #ff9f20; border-radius: 50%; }
#splash .logo::after { content: ""; position: absolute; inset: 38px; background: #ff9f20; border-radius: 50%; box-shadow: 0 0 24px #ff9f20; }
#splash .logo span { position: absolute; width: 150px; height: 1.5px; background: #ff9f20; opacity: .6; left: -16px; }
#splash .brand-text { color: #ffae2b; font-size: 22px; letter-spacing: .35em; text-shadow: 0 0 16px rgba(255,174,43,.7); font-family: "Courier New", monospace; font-weight: 700; margin-right: -.35em; }
#splash .brand-sub { color: #666; font-size: 9px; letter-spacing: .25em; font-family: "Courier New", monospace; }
@keyframes splashPulse { 0%,100% { transform: scale(1); box-shadow: 0 0 30px rgba(255,174,43,.4), inset 0 0 30px rgba(255,174,43,.1); } 50% { transform: scale(1.05); box-shadow: 0 0 60px rgba(255,174,43,.7), inset 0 0 40px rgba(255,174,43,.2); } }
</style>
<style>
  :root {
    --accent: #ffae2b;
    --accent-soft: rgba(255,174,43,.3);
    --bg-from: #000000;
    --bg-to: #000000;
    --panel: rgba(10,8,4,.72);
    --panel-border: rgba(255,174,43,.5);
    --text: #e8e8e8;
    --muted: #8b8b8b;
    --user: #ffae2b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html, body { height: 100%; overflow: hidden; }
  body {
    font-family: "Courier New", ui-monospace, monospace;
    background: linear-gradient(160deg, var(--bg-from), var(--bg-to));
    color: var(--text);
    display: flex; flex-direction: column;
    height: 100dvh;
  }

  /* ---------- background fx ---------- */
  .fx { position: fixed; inset: 0; pointer-events: none; }
  .fx-vignette { z-index: 2; background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%); }
  .fx-scan { z-index: 3; opacity: .18; background: repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0,0,0,.25) 2px 4px); }
  .fx-grid { z-index: 1; opacity: .1; background-image: linear-gradient(var(--accent-soft) 1px, transparent 1px), linear-gradient(90deg, var(--accent-soft) 1px, transparent 1px); background-size: 70px 70px; mask-image: radial-gradient(circle at center, transparent 25%, black 75%); }

  /* ---------- header ---------- */
  header {
    position: relative; z-index: 10;
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--panel-border);
    background: rgba(0,0,0,.5); backdrop-filter: blur(6px);
  }
  .gear {
    width: 38px; height: 38px; border-radius: 50%;
    border: 1px solid var(--accent); background: rgba(0,0,0,.5);
    color: var(--accent); font-size: 17px; display: grid; place-items: center;
    cursor: pointer; box-shadow: 0 0 12px var(--accent-soft);
  }
  .brand { font-size: 17px; letter-spacing: .22em; color: var(--accent); text-shadow: 0 0 10px var(--accent-soft); font-weight: 700; }
  .brand small { display: block; font-size: 8px; letter-spacing: .14em; color: var(--muted); margin-top: 2px; }
  #pselect {
    margin-left: auto; background: rgba(0,0,0,.5); border: 1px solid var(--panel-border);
    color: var(--accent); border-radius: 8px; padding: 6px 8px; font-size: 11px; letter-spacing: .08em; font-family: inherit;
  }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: #6b7688; }
  .dot.on { background: #30f5b0; box-shadow: 0 0 8px #30f5b0; }

  /* ---------- orb stage (centered) ---------- */
  #orbStage {
    position: relative; z-index: 5;
    flex: 1; min-height: 0;
    display: grid; place-items: center; overflow: hidden;
  }
  #orbCanvas { width: 100%; height: 100%; display: block; }
  #orbLabel {
    position: absolute; bottom: 76px; left: 50%; transform: translateX(-50%);
    font-size: 11px; letter-spacing: .3em; color: var(--accent);
    text-shadow: 0 0 10px var(--accent-soft); pointer-events: none;
  }
  #orbState { position: absolute; bottom: 58px; left: 50%; transform: translateX(-50%); font-size: 8px; letter-spacing: .2em; color: var(--muted); pointer-events: none; }

  /* mic button under the orb */
  #orbMic {
    position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
    width: 52px; height: 52px; border-radius: 50%;
    background: rgba(0,0,0,.55); border: 1.5px solid var(--accent);
    color: var(--accent); font-size: 20px;
    display: grid; place-items: center; cursor: pointer;
    box-shadow: 0 0 20px var(--accent-soft), inset 0 0 14px var(--accent-soft);
    z-index: 8;
  }
  #orbMic.rec { background: #dc2626; border-color: #dc2626; color: #fff; animation: pulse 1s infinite; }
  #orbMic.hidden { display: none; }

  /* ---------- chat ---------- */
  #chat {
    position: relative; z-index: 5;
    flex: 0 0 auto; max-height: 32dvh; overflow-y: auto; padding: 14px;
    display: flex; flex-direction: column; gap: 10px;
    -webkit-overflow-scrolling: touch;
  }
  .msg {
    max-width: 84%; padding: 10px 13px; border-radius: 12px;
    font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 15px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;
    clip-path: polygon(0 0, 96% 0, 100% 18%, 100% 100%, 4% 100%, 0 82%);
  }
  .user { align-self: flex-end; background: linear-gradient(135deg, var(--accent), rgba(0,0,0,.35)); color: #0a0800; font-weight: 600; }
  .ultron { align-self: flex-start; background: var(--panel); border: 1px solid var(--panel-border); }
  .meta { font-size: 9px; color: var(--muted); margin-top: 5px; letter-spacing: .08em; }
  .sys { align-self: center; font-size: 11px; color: var(--muted); font-style: italic; text-align: center; }
  .typing { color: var(--muted); font-style: italic; }

  /* ---------- keybox ---------- */
  #keybox { position: relative; z-index: 6; margin: 12px 14px; padding: 14px; background: var(--panel); border: 1px solid var(--panel-border); }
  #keybox .hint { font-size: 12px; color: var(--muted); margin-bottom: 8px; }
  #keybox input { width: 100%; background: rgba(0,0,0,.5); border: 1px solid var(--panel-border); color: var(--text); border-radius: 10px; padding: 11px 12px; font-size: 14px; outline: none; }
  #keybox button { width: 100%; margin-top: 10px; padding: 12px 0; border: 0; border-radius: 10px; font-size: 14px; font-weight: 700; background: var(--accent); color: #0a0800; letter-spacing: .1em; }

  /* ---------- input bar ---------- */
  #bar {
    position: relative; z-index: 10;
    display: flex; gap: 8px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    background: rgba(0,0,0,.6); border-top: 1px solid var(--panel-border); backdrop-filter: blur(6px);
  }
  #in { flex: 1; background: rgba(0,0,0,.5); border: 1px solid var(--panel-border); color: var(--text); border-radius: 20px; padding: 12px 16px; font-size: 15px; outline: none; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
  #in:focus { border-color: var(--accent); }
  #bar button { border: 0; border-radius: 20px; padding: 0 18px; font-size: 14px; font-weight: 700; background: var(--accent); color: #0a0800; cursor: pointer; }
  #bar button:disabled { opacity: .5; }

  @keyframes pulse { 50% { opacity: .6; } }

  /* ---------- settings ---------- */
  #settingsOverlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.7); backdrop-filter: blur(4px); display: none; }
  #settingsOverlay.open { display: block; }
  #settingsPanel {
    position: absolute; left: 12px; top: 64px; bottom: 12px; width: min(340px, calc(100vw - 24px));
    background: rgba(6,8,14,.95); border: 1px solid var(--accent);
    box-shadow: 0 0 30px var(--accent-soft);
    padding: 16px; overflow-y: auto;
    clip-path: polygon(0 0, 94% 0, 100% 4%, 100% 100%, 6% 100%, 0 96%);
  }
  .sp-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
  .sp-head b { color: var(--accent); letter-spacing: .12em; font-size: 14px; }
  .sp-head small { display: block; color: var(--muted); font-size: 9px; margin-top: 3px; }
  .sp-x { background: none; border: 0; color: #aaa; font-size: 24px; cursor: pointer; line-height: 1; }
  .sp-label { color: var(--accent); font-size: 10px; letter-spacing: .14em; margin: 14px 0 8px; }
  .swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
  .sw { display: flex; flex-direction: column; align-items: center; gap: 5px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1); padding: 8px 3px; cursor: pointer; color: #999; font-size: 8px; }
  .sw i { width: 20px; height: 20px; border-radius: 50%; background: var(--sw); box-shadow: 0 0 10px var(--sw); }
  .sw.active { border-color: var(--accent); color: #fff; background: rgba(255,255,255,.08); box-shadow: 0 0 10px var(--accent-soft); }
  .bgs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
  .bgs button { height: 42px; border: 1px solid rgba(255,255,255,.12); color: #ccc; font-size: 8px; cursor: pointer; text-shadow: 0 1px 2px #000; }
  .bgs button.active { border-color: var(--accent); box-shadow: 0 0 10px var(--accent-soft); color: #fff; }
  .sp-slider { width: 100%; accent-color: var(--accent); }
  .sp-toggles { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .sp-toggle { display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #bbb; letter-spacing: .08em; background: rgba(255,255,255,.04); padding: 8px 9px; border: 1px solid rgba(255,255,255,.08); cursor: pointer; }
  .sp-toggle input { accent-color: var(--accent); }
  #spReset { width: 100%; margin-top: 16px; padding: 11px; background: transparent; border: 1px solid var(--accent); color: var(--accent); letter-spacing: .12em; font-size: 10px; cursor: pointer; }
</style>
</head>
<body>

<div id="splash">
  <div class="logo"><span></span></div>
  <div class="brand-text">U.L.T.R.O.N.</div>
  <div class="brand-sub">N8 CORE ONLINE</div>
</div>
<script>
window.addEventListener('load', function () {
  setTimeout(function () { document.getElementById('splash').classList.add('hide'); }, 1400);
  setTimeout(function () { var s = document.getElementById('splash'); if (s) s.remove(); }, 2100);
});
</script>

<div class="fx fx-grid"></div>
<div class="fx fx-vignette"></div>
<div class="fx fx-scan"></div>

<header>
  <button class="gear" id="gearBtn">⚙</button>
  <div class="brand">U.L.T.R.O.N.<small>N8 CORE · VOICE · VISION · ACTION</small></div>
  <select id="pselect">
    <option value="ULTRON">ULTRON</option>
    <option value="NOVA">NOVA</option>
  </select>
  <div class="dot" id="dot"></div>
</header>

<div id="orbStage">
  <canvas id="orbCanvas"></canvas>
  <div id="orbState">STANDBY</div>
  <div id="orbLabel">ULTRON</div>
  <button type="button" id="orbMic" title="Voice input">&#127908;</button>
</div>

<div id="chat"></div>

<div id="keybox">
  <div class="hint">Enter your ULTRON mobile API key to connect:</div>
  <input id="keyfield" type="password" placeholder="API key" autocomplete="off"/>
  <button id="keybtn">CONNECT</button>
</div>

<form id="bar">
  <input id="in" autocomplete="off" placeholder="Message ULTRON..." />
  <button type="submit" id="send">↗</button>
</form>

<div id="settingsOverlay">
  <div id="settingsPanel">
    <div class="sp-head">
      <div><b>SETTINGS</b><small>Orb · Background · Interface</small></div>
      <button class="sp-x" id="spClose">×</button>
    </div>

    <div class="sp-label">CORE COLOR</div>
    <div class="swatches" id="coreSwatches"></div>

    <div class="sp-label">BACKGROUND</div>
    <div class="bgs" id="bgSwatches"></div>

    <div class="sp-label">ORB GLOW <span id="glowVal">100%</span></div>
    <input class="sp-slider" id="glowSlider" type="range" min="0" max="2.5" step="0.1" value="1">

    <div class="sp-label">INTERFACE</div>
    <div class="sp-toggles">
      <label class="sp-toggle">SCANLINES <input type="checkbox" id="tglScan" checked></label>
      <label class="sp-toggle">VIGNETTE <input type="checkbox" id="tglVig" checked></label>
      <label class="sp-toggle">HUD GRID <input type="checkbox" id="tglGrid" checked></label>
      <label class="sp-toggle">AUTO-SPEAK <input type="checkbox" id="tglSpeak" checked></label>
    </div>

    <button id="spReset">RESET TO DEFAULTS</button>
  </div>
</div>

<script>
/* ============================================================
   SETTINGS
============================================================ */
var THEMES = [
  ["amber","#ffae2b"],["cyan","#35d8ff"],["azure","#3f8cff"],["violet","#b86cff"],
  ["magenta","#ff4fd8"],["crimson","#ff4168"],["ruby","#ff2e2e"],["emerald","#31f5a5"],
  ["lime","#a8ff3e"],["gold","#ffd23e"],["ice","#b8ddff"],["arctic","#7ff5ff"],
  ["rose","#ff8fb8"],["tangerine","#ff7a1a"],["solar","#ffbf00"],["nebula","#8f6bff"]
];
var BGS = [
  ["void","#000000","#000000"],["midnight","#12234f","#04060f"],["deep-sea","#063046","#01090e"],
  ["forest","#0b3524","#02100a"],["wine","#3d0f2e","#12020c"],["ember","#42210a","#140701"],
  ["royal","#231a4d","#0a0518"],["slate","#24344d","#0a0f16"],["aurora","#073b45","#1c0838"],
  ["sunset","#4a1e0a","#2c0a3a"],["charcoal","#2a2d34","#0d0e11"],["graphite","#3a3e46","#0c0d10"]
];
var S = { accent: "#ffae2b", bgFrom: "#000000", bgTo: "#000000", glow: 1, scan: true, vig: true, grid: true, speak: true };
try { Object.assign(S, JSON.parse(localStorage.getItem("ultron_mobile_settings") || "{}")); } catch (e) {}
function saveSettings() { try { localStorage.setItem("ultron_mobile_settings", JSON.stringify(S)); } catch (e) {} }
function applySettings() {
  var r = document.documentElement.style;
  r.setProperty("--accent", S.accent);
  r.setProperty("--accent-soft", S.accent + "55");
  r.setProperty("--bg-from", S.bgFrom);
  r.setProperty("--bg-to", S.bgTo);
  r.setProperty("--user", S.accent);
  r.setProperty("--panel-border", S.accent + "80");
  document.querySelector(".fx-scan").style.display = S.scan ? "" : "none";
  document.querySelector(".fx-vignette").style.display = S.vig ? "" : "none";
  document.querySelector(".fx-grid").style.display = S.grid ? "" : "none";
  saveSettings();
}

/* build swatches */
var cs = document.getElementById("coreSwatches");
THEMES.forEach(function (t) {
  var b = document.createElement("button");
  b.className = "sw" + (S.accent === t[1] ? " active" : "");
  b.style.setProperty("--sw", t[1]);
  b.innerHTML = "<i></i><span>" + t[0] + "</span>";
  b.addEventListener("click", function () {
    S.accent = t[1];
    cs.querySelectorAll(".sw").forEach(function (x) { x.classList.remove("active"); });
    b.classList.add("active");
    applySettings();
  });
  cs.appendChild(b);
});
var bgs = document.getElementById("bgSwatches");
BGS.forEach(function (t) {
  var b = document.createElement("button");
  b.textContent = t[0];
  b.style.background = "linear-gradient(135deg," + t[1] + "," + t[2] + ")";
  if (S.bgFrom === t[1]) b.classList.add("active");
  b.addEventListener("click", function () {
    S.bgFrom = t[1]; S.bgTo = t[2];
    bgs.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
    b.classList.add("active");
    applySettings();
  });
  bgs.appendChild(b);
});
document.getElementById("glowSlider").value = S.glow;
document.getElementById("glowVal").textContent = Math.round(S.glow * 100) + "%";
document.getElementById("glowSlider").addEventListener("input", function (e) {
  S.glow = Number(e.target.value);
  document.getElementById("glowVal").textContent = Math.round(S.glow * 100) + "%";
  saveSettings();
});
document.getElementById("tglScan").checked = S.scan;
document.getElementById("tglVig").checked = S.vig;
document.getElementById("tglGrid").checked = S.grid;
document.getElementById("tglSpeak").checked = S.speak;
document.getElementById("tglScan").addEventListener("change", function (e) { S.scan = e.target.checked; applySettings(); });
document.getElementById("tglVig").addEventListener("change", function (e) { S.vig = e.target.checked; applySettings(); });
document.getElementById("tglGrid").addEventListener("change", function (e) { S.grid = e.target.checked; applySettings(); });
document.getElementById("tglSpeak").addEventListener("change", function (e) { S.speak = e.target.checked; saveSettings(); });
document.getElementById("spReset").addEventListener("click", function () {
  localStorage.removeItem("ultron_mobile_settings");
  location.reload();
});
document.getElementById("gearBtn").addEventListener("click", function () { document.getElementById("settingsOverlay").classList.add("open"); });
document.getElementById("spClose").addEventListener("click", function () { document.getElementById("settingsOverlay").classList.remove("open"); });
document.getElementById("settingsOverlay").addEventListener("click", function (e) { if (e.target === this) this.classList.remove("open"); });

/* ============================================================
   MINI ORB (canvas hologram)
============================================================ */
var oc = document.getElementById("orbCanvas");
var octx = oc.getContext("2d");
var orbState = "idle";
function setOrbState(s) {
  orbState = s;
  document.getElementById("orbState").textContent = s.toUpperCase();
}
function resizeOrb() {
  var st = document.getElementById("orbStage");
  oc.width = st.clientWidth * devicePixelRatio;
  oc.height = st.clientHeight * devicePixelRatio;
}
window.addEventListener("resize", resizeOrb);
resizeOrb();

var particles = [];
for (var i = 0; i < 90; i++) {
  particles.push({ a: Math.random() * Math.PI * 2, r: 0.55 + Math.random() * 0.75, s: (Math.random() * 0.4 + 0.08) * (Math.random() < 0.5 ? 1 : -1), z: Math.random() * 0.6 + 0.4 });
}

function hexToRgb(h) {
  var n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawOrb(t) {
  var w = oc.width, h = oc.height;
  octx.clearRect(0, 0, w, h);
  var cx = w / 2, cy = h / 2;
  var R = Math.min(w, h) * 0.34;
  var rgb = hexToRgb(S.accent);
  var glow = S.glow;
  var speed = orbState === "thinking" ? 2.4 : orbState === "speaking" ? 1.7 : orbState === "listening" ? 1.9 : 1;
  var pulse = 1 + Math.sin(t * 0.0022) * 0.03 * glow + (orbState !== "idle" ? 0.03 : 0);

  /* outer rings */
  for (var ring = 0; ring < 3; ring++) {
    octx.beginPath();
    var rr = R * (1 + ring * 0.16) * pulse;
    octx.arc(cx, cy, rr, 0, Math.PI * 2);
    octx.strokeStyle = "rgba(" + rgb + "," + (0.10 + 0.05 * ring) + ")";
    octx.lineWidth = 1 * devicePixelRatio;
    octx.stroke();
  }

  /* rotating arcs */
  for (var a = 0; a < 4; a++) {
    var ang = t * 0.0004 * speed * (a % 2 ? 1 : -1) + a * 1.7;
    octx.beginPath();
    octx.arc(cx, cy, R * (1.05 + a * 0.05) * pulse, ang, ang + Math.PI / 2.6);
    octx.strokeStyle = "rgba(" + rgb + "," + (0.45 - a * 0.08) + ")";
    octx.lineWidth = 1.6 * devicePixelRatio;
    octx.stroke();
  }

  /* nucleus */
  var grad = octx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5 * pulse);
  grad.addColorStop(0, "rgba(" + rgb + "," + Math.min(1, 0.85 * glow) + ")");
  grad.addColorStop(0.55, "rgba(" + rgb + "," + 0.25 * glow + ")");
  grad.addColorStop(1, "rgba(" + rgb + ",0)");
  octx.fillStyle = grad;
  octx.beginPath();
  octx.arc(cx, cy, R * 0.5 * pulse, 0, Math.PI * 2);
  octx.fill();

  /* wire sphere (latitude rings) */
  for (var l = -3; l <= 3; l++) {
    var lat = l / 3;
    var ry = R * 0.72 * Math.cos(lat * 0.9) * pulse;
    var y = cy + R * 0.72 * Math.sin(lat * 0.9) * pulse;
    octx.beginPath();
    octx.ellipse(cx, y, ry, ry * 0.22, 0, 0, Math.PI * 2);
    octx.strokeStyle = "rgba(" + rgb + "," + (l === 0 ? 0.5 : 0.16) + ")";
    octx.lineWidth = 1 * devicePixelRatio;
    octx.stroke();
  }

  /* particles */
  for (var p = 0; p < particles.length; p++) {
    var pt = particles[p];
    pt.a += pt.s * 0.004 * speed;
    var px = cx + Math.cos(pt.a) * R * pt.r * 1.35;
    var py = cy + Math.sin(pt.a) * R * pt.r * 1.35 * pt.z;
    octx.beginPath();
    octx.arc(px, py, 1.3 * devicePixelRatio, 0, Math.PI * 2);
    octx.fillStyle = "rgba(" + rgb + "," + 0.55 * pt.z * glow + ")";
    octx.fill();
  }

  requestAnimationFrame(drawOrb);
}
requestAnimationFrame(drawOrb);

/* ============================================================
   CHAT + BACKEND (unchanged logic)
============================================================ */
var CORE = "https://alirff.app.n8n.cloud/webhook/ultron-core";
var TTS = "https://alirff.app.n8n.cloud/webhook/ultron-voice-output";
var chat = document.getElementById("chat");
var dot = document.getElementById("dot");
var keybox = document.getElementById("keybox");
var pselect = document.getElementById("pselect");
var apiKey = "";
var sessionId = "mob-" + Math.random().toString(36).slice(2, 10);
var personality = "ULTRON";
var audio = null;
try {
  apiKey = localStorage.getItem("ultron_key") || "";
  var s = localStorage.getItem("ultron_session"); if (s) sessionId = s;
  var p = localStorage.getItem("ultron_personality"); if (p) { personality = p; pselect.value = p; }
} catch (e) {}
(function () {
  try {
    var m = location.search.match(/[?&]key=([^&]+)/);
    if (m && m[1]) { apiKey = decodeURIComponent(m[1]); localStorage.setItem("ultron_key", apiKey); localStorage.setItem("ultron_session", sessionId); }
  } catch (e) {}
})();

function setOnline(on) { dot.classList.toggle("on", on); }
function addMsg(cls, text, meta) {
  var d = document.createElement("div");
  d.className = "msg " + cls; d.textContent = text;
  if (meta) { var m = document.createElement("div"); m.className = "meta"; m.textContent = meta; d.appendChild(m); }
  chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
}
function sys(text) { var d = document.createElement("div"); d.className = "sys"; d.textContent = text; chat.appendChild(d); chat.scrollTop = chat.scrollHeight; }
function saveState() { try { localStorage.setItem("ultron_key", apiKey); localStorage.setItem("ultron_session", sessionId); localStorage.setItem("ultron_personality", personality); } catch (e) {} }

pselect.addEventListener("change", function () { personality = pselect.value; saveState(); sys("Personality set to " + personality + "."); });

document.getElementById("keybtn").addEventListener("click", function () {
  var k = document.getElementById("keyfield").value.trim();
  if (!k) return;
  apiKey = k; saveState();
  keybox.style.display = "none";
  setOnline(true);
  sys("Connected to " + personality + ". Say something.");
  document.getElementById("in").focus();
});

async function speak(text, persona) {
  if (!S.speak) return;
  try {
    if (audio) { audio.pause(); audio = null; }
    var res = await fetch(TTS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: text, personality: persona })
    });
    if (!res.ok) return;
    var blob = await res.blob();
    if (!blob || blob.size < 100) return;
    audio = new Audio(URL.createObjectURL(blob));
    setOrbState("speaking");
    audio.onended = function () { setOrbState("idle"); };
    audio.play().catch(function(){ setOrbState("idle"); });
  } catch (e) { setOrbState("idle"); }
}

async function send(text) {
  addMsg("user", text);
  var typing = document.createElement("div");
  typing.className = "msg ultron typing"; typing.textContent = "...";
  chat.appendChild(typing); chat.scrollTop = chat.scrollHeight;
  document.getElementById("send").disabled = true;
  setOrbState("thinking");
  try {
    var res = await fetch(CORE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
      body: JSON.stringify({ session_id: sessionId, request_id: "req-" + Date.now(), source: "mobile", input_type: "text", personality: personality, user_text: text })
    });
    var data = await res.json().catch(function () { return { success: false, response: "Invalid response." }; });
    typing.remove();
    var err = String(data.error || "").toLowerCase();
    if (data.success === false && (err.indexOf("api_key") >= 0 || err.indexOf("auth") >= 0)) {
      addMsg("ultron", data.response || data.error || "Authentication failed.");
      apiKey = ""; setOnline(false); keybox.style.display = "block";
      sys("API key rejected. Enter it again.");
      setOrbState("idle");
    } else if (data.success === false) {
      addMsg("ultron", data.response || data.error || "Request failed.");
      setOrbState("idle");
    } else {
      var meta = data.status && data.status !== "completed" ? data.status : (data.personality || "");
      addMsg("ultron", data.response || "(no response)", meta);
      if (data.response) speak(data.response, data.personality || personality); else setOrbState("idle");
      if (data.status === "confirmation_required") sys(personality + " needs your confirmation. Reply to confirm.");
      if (data.status === "clarification_required") sys(personality + " needs clarification. Reply with more detail.");
    }
  } catch (e) {
    typing.remove();
    addMsg("ultron", "Connection error. Check your internet and that ULTRON Core is online.");
    setOrbState("idle");
  }
  document.getElementById("send").disabled = false;
  document.getElementById("in").focus();
}

document.getElementById("bar").addEventListener("submit", function (e) {
  e.preventDefault();
  var v = document.getElementById("in").value.trim();
  if (!v) return;
  document.getElementById("in").value = "";
  if (!apiKey) { keybox.style.display = "block"; return; }
  send(v);
});

/* ---------- Continuous voice: mic ON = listen in chunks, transcribe, reply, keep listening ---------- */
var VOICE_URL = "https://alirff.app.n8n.cloud/webhook/ultron-voice";
var CHAT_URL = "https://alirff.app.n8n.cloud/webhook/ultron-core";
var micOn = false;
var mediaRecorder = null;
var audioChunks = [];
var micStream = null;
var processingChunk = false;
var CHUNK_MS = 5000; // transcribe every 5s of speech

function micUI(on) {
  var b = document.getElementById("orbMic");
  b.classList.toggle("rec", on);
}

async function sendVoice(blob) {
  setOrbState("thinking");
  try {
    var fd = new FormData();
    fd.append("data", blob, "voice.webm");
    fd.append("session_id", sessionId);
    fd.append("personality", personality);
    var res = await fetch(VOICE_URL, {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey },
      body: fd
    });
    var ctype = res.headers.get("content-type") || "";
    if (res.ok && ctype.indexOf("audio") >= 0) {
      var ablob = await res.blob();
      if (ablob.size > 100) {
        var au = new Audio(URL.createObjectURL(ablob));
        setOrbState("speaking");
        au.onended = function () { if (micOn) setOrbState("listening"); else setOrbState("idle"); };
        au.play().catch(function(){ if (micOn) setOrbState("listening"); else setOrbState("idle"); });
        return;
      }
    }
    var data = await res.json().catch(function () { return {}; });
    var text = data.response || data.error || data.text || "";
    if (text) {
      addMsg("ultron", text, data.personality || personality);
      if (S.speak) {
        speak(text, data.personality || personality);
      } else {
        if (micOn) setOrbState("listening"); else setOrbState("idle");
      }
    } else {
      if (micOn) setOrbState("listening"); else setOrbState("idle");
    }
  } catch (e) {
    sys("Voice upload failed. Check connection.");
    if (micOn) setOrbState("listening"); else setOrbState("idle");
  }
}

function startChunk() {
  if (!micOn || !micStream) return;
  try {
    audioChunks = [];
    var mime = "";
    if (window.MediaRecorder) {
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) mime = "audio/webm;codecs=opus";
      else if (MediaRecorder.isTypeSupported("audio/webm")) mime = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) mime = "audio/mp4";
      else if (MediaRecorder.isTypeSupported("audio/ogg")) mime = "audio/ogg";
    }
    if (!window.MediaRecorder || !mime) { sys("Audio recording not supported in this browser."); micTurnOff(); return; }
    mediaRecorder = new MediaRecorder(micStream, { mimeType: mime });
    mediaRecorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = function () {
      var blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
      if (blob.size > 300) {
        processingChunk = true;
        sendVoice(blob).finally(function () {
          processingChunk = false;
          if (micOn) startChunk(); // keep listening
        });
      } else {
        // nothing meaningful said — immediately listen again
        if (micOn) startChunk();
      }
    };
    mediaRecorder.start();
    setTimeout(function () {
      if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    }, CHUNK_MS);
  } catch (e) { sys("Recording error: " + ((e && e.message) || "unknown")); if (micOn) setTimeout(startChunk, 1200); }
}

async function micTurnOn() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    sys("Voice recording not supported in this browser.");
    return;
  }
  if (!apiKey) { keybox.style.display = "block"; sys("Enter your API key first."); return; }
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micOn = true;
    micUI(true);
    setOrbState("listening");
    sys("Mic ON — speak naturally. Tap mic to stop.");
    // Greeting first, then start listening
    var greeting = personality === "NOVA"
      ? "Welcome back! How can I help you today?"
      : "Welcome back sir, how can I assist you?";
    setOrbState("speaking");
    try {
      var res = await fetch(TTS, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: greeting, personality: personality })
      });
      if (res.ok) {
        var blob = await res.blob();
        if (blob.size > 100) {
          var au = new Audio(URL.createObjectURL(blob));
          au.onended = function () { if (micOn) { setOrbState("listening"); startChunk(); } };
          au.onerror = function () { if (micOn) { setOrbState("listening"); startChunk(); } };
          await au.play().catch(function () { if (micOn) { setOrbState("listening"); startChunk(); } });
          return;
        }
      }
    } catch (e) { /* fall through to start listening anyway */ }
    if (micOn) { setOrbState("listening"); startChunk(); }
  } catch (e) {
    var name = (e && e.name) || "Error";
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      sys("Microphone blocked. Allow mic for Chrome in Android Settings.");
    } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      sys("No microphone found on this device.");
    } else if (name === "NotReadableError" || name === "TrackStartError") {
      sys("Mic is busy in another app. Close recorder/call apps and retry.");
    } else {
      sys("Mic error: " + name + ". Try again.");
    }
    setOrbState("idle");
  }
}

function micTurnOff() {
  micOn = false;
  micUI(false);
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    try { mediaRecorder.onstop = null; mediaRecorder.stop(); } catch (e) {}
  }
  if (micStream) { micStream.getTracks().forEach(function (t) { t.stop(); }); micStream = null; }
  setOrbState("idle");
  sys("Mic OFF.");
}

(function () {
  var micBtn = document.getElementById("orbMic");
  micBtn.classList.remove("hidden");
  micBtn.addEventListener("click", function () {
    if (micOn) micTurnOff(); else micTurnOn();
  });
})();

applySettings();
if (apiKey) { keybox.style.display = "none"; setOnline(true); sys("Connected to " + personality + ". Say something."); }
else { keybox.style.display = "block"; document.getElementById("keyfield").focus(); }
</script>
</body>
</html>`,
      options: { responseContentType: 'text/html', responseHeaders: { entries: [{ name: 'Permissions-Policy', value: 'microphone=(self)' }, { name: 'Feature-Policy', value: 'microphone \'self\'' }] } }
    }
  }
});

const wf = workflow('VACphatO72345ruS', 'ULTRON - Mobile Web', { executionOrder: 'v1' });

export default wf
  .add(serve_Mobile_Page)
  .to(serve_Page)