
(function(){
"use strict";

var __knActive = true;
var __knIntervals = new Set();
var __knTimeouts = new Set();
var __knFrames = new Set();
var __knAbort = new AbortController();
var __knNativeSetInterval = window.setInterval;
var __knNativeSetTimeout = window.setTimeout;
var __knNativeRequestAnimationFrame = window.requestAnimationFrame;
var __knNativeClearInterval = window.clearInterval;
var __knNativeClearTimeout = window.clearTimeout;
var __knNativeCancelAnimationFrame = window.cancelAnimationFrame;
var __knOriginalAddEventListener = EventTarget.prototype.addEventListener;
window.setInterval = function(callback, delay, ...args) {
  var id = __knNativeSetInterval.call(window, function() {
    if (__knActive) callback.apply(window, args);
  }, delay);
  __knIntervals.add(id);
  return id;
};
window.setTimeout = function(callback, delay, ...args) {
  var id;
  id = __knNativeSetTimeout.call(window, function() {
    __knTimeouts.delete(id);
    if (__knActive) callback.apply(window, args);
  }, delay);
  __knTimeouts.add(id);
  return id;
};
window.requestAnimationFrame = function(callback) {
  if (!__knActive) return 0;
  var id;
  id = __knNativeRequestAnimationFrame.call(window, function(timestamp) {
    __knFrames.delete(id);
    if (__knActive) callback(timestamp);
  });
  __knFrames.add(id);
  return id;
};
EventTarget.prototype.addEventListener = function(type, listener, options) {
  var normalized = typeof options === "boolean" ? { capture: options } : Object.assign({}, options || {});
  if (!normalized.signal) normalized.signal = __knAbort.signal;
  return __knOriginalAddEventListener.call(this, type, listener, normalized);
};

var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- header + mobile menu ---------- */
var header = document.getElementById("siteHeader");
window.addEventListener("scroll", function(){ header.classList.toggle("scrolled", window.scrollY > 8); }, {passive:true});
var menuBtn = document.getElementById("menuBtn"), mobileMenu = document.getElementById("mobileMenu");
menuBtn.addEventListener("click", function(){
  var open = mobileMenu.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  menuBtn.textContent = open ? "✕" : "☰";
});
mobileMenu.querySelectorAll("a").forEach(function(a){ a.addEventListener("click", function(){ mobileMenu.classList.remove("open"); menuBtn.textContent = "☰"; }); });

/* ---------- theme selector: Dark / System / Custom (this visit only, nothing stored) ---------- */
var themeBtns = document.querySelectorAll("[data-theme-choice]");
function applyTheme(name){
  document.documentElement.setAttribute("data-theme", name);
  var pageRoot = document.querySelector(".kashnode-reference-landing");
  if (pageRoot) pageRoot.setAttribute("data-theme", name);
  themeBtns.forEach(function(b){
    var on = b.getAttribute("data-theme-choice") === name;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}
themeBtns.forEach(function(b){
  b.addEventListener("click", function(){ applyTheme(b.getAttribute("data-theme-choice")); });
});
applyTheme("dark");

/* ---------- particle network canvas ---------- */
var canvas = document.getElementById("netCanvas"), ctx = canvas.getContext("2d");
var pts = [], W = 0, H = 0;
function sizeCanvas(){
  var hero = canvas.parentElement;
  W = canvas.width = hero.offsetWidth; H = canvas.height = hero.offsetHeight;
  var n = Math.min(70, Math.floor(W / 18));
  pts = [];
  for (var i = 0; i < n; i++) pts.push({ x: Math.random()*W, y: Math.random()*H*.62, vx: (Math.random()-.5)*.35, vy: (Math.random()-.5)*.35, r: Math.random()*1.6+.6 });
}
function drawNet(){
  ctx.clearRect(0,0,W,H);
  for (var i = 0; i < pts.length; i++){
    var p = pts[i];
    p.x += p.vx; p.y += p.vy;
    if (p.x < 0 || p.x > W) p.vx *= -1;
    if (p.y < 0 || p.y > H) p.vy *= -1;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
    ctx.fillStyle = "rgba(34,211,238,.55)"; ctx.fill();
    for (var j = i+1; j < pts.length; j++){
      var q = pts[j], dx = p.x-q.x, dy = p.y-q.y, d = dx*dx+dy*dy;
      if (d < 130*130){ ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.strokeStyle = "rgba(34,211,238," + (0.13*(1-d/16900)) + ")"; ctx.lineWidth = 1; ctx.stroke(); }
    }
  }
  if (!reduced) requestAnimationFrame(drawNet);
}
sizeCanvas(); drawNet();
var rzT; window.addEventListener("resize", function(){ clearTimeout(rzT); rzT = setTimeout(function(){ sizeCanvas(); if (reduced) drawNet(); }, 200); });

/* ---------- 3D tilt on the deck ---------- */
var zone = document.getElementById("stageZone"), deck = document.getElementById("tiltDeck");
var heroSec = document.querySelector(".hero");
if (!reduced && window.matchMedia("(pointer: fine)").matches){
  heroSec.addEventListener("mousemove", function(e){
    var r = heroSec.getBoundingClientRect();
    heroSec.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100) + "%");
    heroSec.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100) + "%");
    heroSec.style.setProperty("--px", ((e.clientX - r.left) / r.width - .5).toFixed(3));
    heroSec.style.setProperty("--py", ((e.clientY - r.top) / r.height - .5).toFixed(3));
  });
}
if (!reduced && window.matchMedia("(pointer: fine)").matches){
  zone.addEventListener("mousemove", function(e){
    var r = deck.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    deck.style.transform = "rotateY(" + (x*9).toFixed(2) + "deg) rotateX(" + (-y*8).toFixed(2) + "deg)";
  });
  zone.addEventListener("mouseleave", function(){ deck.style.transform = "rotateY(0deg) rotateX(0deg)"; });
}

/* ---------- waveforms ---------- */
function buildWave(el, bars){
  for (var i = 0; i < bars; i++){ var b = document.createElement("i"); el.appendChild(b); }
  return el.querySelectorAll("i");
}
var miniBars = buildWave(document.getElementById("miniWave"), 22);
var bigBars = buildWave(document.getElementById("bigWave"), 42);
var wt = 0;
function animWave(){
  wt += .14;
  miniBars.forEach(function(b, i){ b.style.height = (26 + Math.abs(Math.sin(wt + i*.55)) * 68) + "%"; });
  bigBars.forEach(function(b, i){ b.style.height = (14 + Math.abs(Math.sin(wt*.9 + i*.34)) * 82) + "%"; });
  if (!reduced) requestAnimationFrame(animWave);
}
animWave();

/* ---------- terminal typing ---------- */
var termLines = [
  '<span class="tp">$</span> kashnode deploy --store mystore.com',
  '<span class="dim">→ plugin connected · store orders syncing</span>',
  '<span class="dim">→ kashnode-box-01 linked · business SIM inside · signal 5/5</span>',
  '<span class="ok">✓ service kashnode-central is live</span>',
  '',
  '<span class="tp">[10:41:52]</span> COD order <b>#CN-2840</b> · customer tapped Order Now',
  '<span class="tp">[10:41:53]</span> Verification SMS sent from owner SIM → customer entered code <span class="ok">✓ REAL CUSTOMER</span>',
  '<span class="tp">[10:42:07]</span> SMS received · bKash TrxID <span class="pk">9HX72K42</span> · ৳1,850',
  '<span class="tp">[10:42:08]</span> Kash matched TrxID → order <b>#CN-2841</b> <span class="ok">✓ VERIFIED</span>',
  '<span class="tp">[10:42:09]</span> Steadfast booking created · Rider PIN <span class="pk">4821</span>',
  '<span class="tp">[10:43:31]</span> Customer called business SIM → forwarded to server → Kash AI answered · order confirmed',
  '<span class="ok">✓ 0 human touches · 2 package minutes used</span>'
];
var termBody = document.getElementById("termBody");
if (reduced){
  termBody.innerHTML = termLines.join("\n");
} else {
  var li = 0, ci = 0, current = "";
  var plain = termLines.map(function(h){ var d = document.createElement("div"); d.innerHTML = h; return d.textContent; });
  function typeStep(){
    if (li >= termLines.length){
      setTimeout(function(){ li = 0; ci = 0; current = ""; typeStep(); }, 7000);
      return;
    }
    var full = plain[li];
    ci++;
    var shown = full.slice(0, ci);
    /* render finished lines as HTML, current line as plain text */
    var done = termLines.slice(0, li).join("\n");
    termBody.innerHTML = (done ? done + "\n" : "") + escapeHtml(shown) + '<span class="cursor-blink"></span>';
    if (ci >= full.length){ li++; ci = 0; setTimeout(typeStep, full.length === 0 ? 60 : 420); }
    else setTimeout(typeStep, 16);
  }
  function escapeHtml(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  typeStep();
}

/* ---------- live demo counters ---------- */
var verified = 48290, calls = 37, parcels = 29, minutesBal = 184, sms = 112;
function fmt(n){ return n.toLocaleString("en-US"); }
function renderMinutes(){
  document.getElementById("walletVal").textContent = fmt(minutesBal);
  var am = document.getElementById("appMinutes"); if (am) am.textContent = fmt(minutesBal);
  var ac = document.getElementById("appMinutesCost"); if (ac) ac.textContent = fmt(Math.round(minutesBal * 7));
}
setInterval(function(){
  verified += [450, 850, 1200, 1850, 2400][Math.floor(Math.random()*5)];
  document.getElementById("kpiVerified").textContent = "৳ " + fmt(verified);
  sms += 1; document.getElementById("smsCount").textContent = sms;
  document.getElementById("pingVal").textContent = 30 + Math.floor(Math.random()*22);
  if (Math.random() > .55){ calls += 1; document.getElementById("kpiCalls").textContent = calls; }
  if (Math.random() > .5){ parcels += 1; document.getElementById("kpiParcels").textContent = parcels; minutesBal = Math.max(0, minutesBal - 2); renderMinutes(); }
}, 5200);

/* ---------- owner app preview: voice switch + minute recharge ---------- */
document.querySelectorAll(".voice-btn").forEach(function(btn){
  btn.addEventListener("click", function(){
    document.querySelectorAll(".voice-btn").forEach(function(b){ b.classList.remove("on"); });
    btn.classList.add("on");
    document.getElementById("appMsg").textContent = "✓ AI voice set to " + btn.getAttribute("data-voice") + " — it applies from the next call.";
  });
});
document.querySelectorAll(".pack").forEach(function(btn){
  btn.addEventListener("click", function(){
    var add = parseInt(btn.getAttribute("data-min"), 10) || 0;
    minutesBal += add;
    renderMinutes();
    document.getElementById("appMsg").textContent = "✓ " + add + " minutes added — new balance " + fmt(minutesBal) + " min.";
  });
});

/* rotating order feed */
var feedData = [
  { id:"#CN-2842", name:"Pathao · PIN 7730", chip:"shipped", label:"▣ SHIPPED", amt:"৳ 1,250" },
  { id:"#CN-2843", name:"bKash · TrxID 8KD…M17", chip:"verified", label:"✓ VERIFIED", amt:"৳ 3,150" },
  { id:"#CN-2844", name:"Kash confirmed COD order", chip:"calling", label:"◉ CONFIRMED", amt:"৳ 780" },
  { id:"#CN-2845", name:"bKash · TrxID 7QT…P93", chip:"paid", label:"♥ PAID", amt:"৳ 2,050" },
  { id:"#CN-2846", name:"Steadfast · PIN 2214", chip:"shipped", label:"▣ SHIPPED", amt:"৳ 1,499" }
];
var feedEl = document.getElementById("orderFeed"), feedIdx = 0;
setInterval(function(){
  var d = feedData[feedIdx % feedData.length]; feedIdx++;
  var row = document.createElement("div");
  row.className = "orow"; row.style.opacity = "0"; row.style.transform = "translateY(-6px)"; row.style.transition = "opacity .5s, transform .5s";
  row.innerHTML = '<span class="o-id"></span><span class="o-name"></span><span class="chip"></span><span class="o-amt"></span>';
  row.querySelector(".o-id").textContent = d.id;
  row.querySelector(".o-name").textContent = d.name;
  var c = row.querySelector(".chip"); c.className = "chip " + d.chip; c.textContent = d.label;
  row.querySelector(".o-amt").textContent = d.amt;
  feedEl.insertBefore(row, feedEl.firstChild);
  requestAnimationFrame(function(){ row.style.opacity = "1"; row.style.transform = "none"; });
  while (feedEl.children.length > 3) feedEl.removeChild(feedEl.lastChild);
}, 6000);

/* ---------- call timer ---------- */
var secs = 0, timerEl = document.getElementById("callTimer");
setInterval(function(){
  secs = (secs + 1) % 600;
  timerEl.textContent = String(Math.floor(secs/60)).padStart(2,"0") + ":" + String(secs%60).padStart(2,"0");
}, 1000);

/* ---------- scroll reveal (rect-based, with fallbacks so content is never stuck hidden) ---------- */
var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
function revealCheck(){
  var limit = window.innerHeight * 1.12;
  revealEls = revealEls.filter(function(el){
    if (el.getBoundingClientRect().top < limit){ el.classList.add("in"); return false; }
    return true;
  });
}
revealCheck();
window.addEventListener("scroll", revealCheck, { passive: true });
window.addEventListener("resize", revealCheck);
var revealPolls = 0;
var revealTimer = setInterval(function(){
  revealCheck();
  if (++revealPolls >= 8 || revealEls.length === 0) clearInterval(revealTimer);
}, 700);

/* ---------- FAQ accordion ---------- */
document.querySelectorAll(".faq-item").forEach(function(item){
  var q = item.querySelector(".faq-q"), a = item.querySelector(".faq-a");
  q.addEventListener("click", function(){
    var open = item.classList.toggle("open");
    q.setAttribute("aria-expanded", open ? "true" : "false");
    a.style.maxHeight = open ? a.scrollHeight + "px" : "0px";
  });
});

/* ---------- waitlist (client-side only, honest) ---------- */
document.getElementById("waitlistForm").addEventListener("submit", function(e){
  e.preventDefault();
  var email = document.getElementById("wlEmail").value.trim();
  var msg = document.getElementById("wlMsg");
  if (!email || email.indexOf("@") < 1 || email.indexOf(".") < 0){
    msg.style.color = "var(--amber)";
    msg.textContent = "Please enter a valid email address.";
    return;
  }
  msg.style.color = "var(--lime)";
  msg.innerHTML = "";
  msg.textContent = "✓ You're on the list — we'll write to " + email + " when onboarding opens.";
  document.getElementById("wlEmail").value = "";
});

window.setInterval = __knNativeSetInterval;
window.setTimeout = __knNativeSetTimeout;
window.requestAnimationFrame = __knNativeRequestAnimationFrame;
EventTarget.prototype.addEventListener = __knOriginalAddEventListener;
window.__kashnodeLandingCleanup = function() {
  if (!__knActive) return;
  __knActive = false;
  __knIntervals.forEach(id => __knNativeClearInterval.call(window, id));
  __knTimeouts.forEach(id => __knNativeClearTimeout.call(window, id));
  __knFrames.forEach(id => __knNativeCancelAnimationFrame.call(window, id));
  __knIntervals.clear();
  __knTimeouts.clear();
  __knFrames.clear();
  __knAbort.abort();
};

})();