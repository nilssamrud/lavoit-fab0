// Fab 0 viewer: pick a number, read the station, walk to the next one.
//
// The seventeen numbers are the process order out of flow.py. Everything the
// panel shows is exported from line_model.py and plan.py by export_site.py, so
// if a cycle time changes in the model it changes here without anyone editing
// this file.

import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { buildFactory, toWorld, COPPER } from './scene.js';

const $ = (s) => document.querySelector(s);

const state = {
  data: null,
  steps: [],
  byCode: new Map(),
  selected: null,
  markers: new Map(),
  roofTouched: false,
  tween: null,
  dots: [],
  activeEdges: [],
};

// ------------------------------------------------------------------ three.js

const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xf6f6f4);
// a dark floor and a near-black frame need the highlight rolled off rather than
// clipped, or the steel comes back as mid grey
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xf6f6f4, 220, 460);

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 6;
controls.maxDistance = 240;
controls.maxPolarAngle = Math.PI * 0.495;

// Lit for the dark palette scene.js now uses. The old intensities were set for
// pastel massing and burn a near-black steel frame out to grey.
function lights() {
  scene.add(new THREE.HemisphereLight(0xe8eef4, 0x35383c, 0.80));
  const key = new THREE.DirectionalLight(0xfff4e4, 1.55);
  key.position.set(52, 78, 66);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0008;
  key.shadow.normalBias = 0.03;
  const c = key.shadow.camera;
  c.left = -62; c.right = 62; c.top = 52; c.bottom = -52; c.near = 10; c.far = 220;
  c.updateProjectionMatrix();
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe6ee, 0.30);
  fill.position.set(-70, 40, -50);
  scene.add(fill);
}

// ------------------------------------------------------------------- camera

function dirOf(azDeg, elDeg) {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
}

// Fit a plan-coordinate box on screen from a given azimuth and elevation. The
// eight corners are projected onto the camera's own axes rather than wrapped in
// a bounding sphere, so a long thin building fills a wide window instead of
// sitting in the middle of it.
function frameBox(box, az, el, pad = 1.12, instant = false) {
  const [x0, y0, z0, x1, y1, z1] = box;
  const target = toWorld((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const dir = dirOf(az, el);
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();

  let ex = 0, ey = 0, ez = 0;
  for (const x of [x0, x1]) {
    for (const y of [y0, y1]) {
      for (const z of [z0, z1]) {
        const v = toWorld(x, y, z).sub(target);
        ex = Math.max(ex, Math.abs(v.dot(right)));
        ey = Math.max(ey, Math.abs(v.dot(up)));
        ez = Math.max(ez, Math.abs(v.dot(dir)));
      }
    }
  }
  const vfov = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hfov = Math.atan(Math.tan(vfov) * camera.aspect);
  // only part of the depth half-extent is added back: the full amount is the
  // safe answer for a cube seen corner-on and leaves a long building floating
  // in the middle of the window
  const dist = Math.max(ey / Math.tan(vfov), ex / Math.tan(hfov)) * pad + ez * 0.4;

  const pos = target.clone().add(dir.multiplyScalar(Math.max(dist, 8)));
  if (instant) {
    camera.position.copy(pos);
    controls.target.copy(target);
    controls.update();
    state.tween = null;
    return;
  }
  state.tween = {
    t: 0,
    ms: 880,
    fromPos: camera.position.clone(),
    toPos: pos,
    fromTgt: controls.target.clone(),
    toTgt: target.clone(),
  };
}

// reaches west of the shed for the dock lane and the trailers standing in it, and
// east of it for the hot test pad; the plant now has traffic at both ends
const WHOLE = [-20, -2, -1.3, 90, 38, 11.5];

const VIEWS = {
  iso: (i) => frameBox(WHOLE, 36, 26, 1.04, i),
  plan: (i) => frameBox(WHOLE, 3, 72, 1.02, i),
  north: (i) => frameBox([9, 18, 0, 72, 36, 4.5], 14, 27, 1.02, i),
  south: (i) => frameBox([17, 0, 0, 72, 18, 4.5], 6, 27, 1.02, i),
  // the pad is east of the shutter now, so the camera stands south-west of it
  // and the building it came out of is the backdrop
  pads: (i) => frameBox([64, 0, 0, 90, 15, 4], 320, 22, 1.06, i),
  dock: (i) => frameBox([-20, 0, -1.3, 20, 22, 5], 40, 20, 1.06, i),
};

function flyToStation(step) {
  const [x0, y0, x1, y1] = step.box;
  const m = 5.5;                   // enough context to see what it sits next to
  frameBox([x0 - m, y0 - m, 0, x1 + m, y1 + m, Math.max(step.h, 3) + 1.5],
    20, 33, 1.0);
}

// -------------------------------------------------------------------- focus

// The building, the cranes and the yard are context. They stay on when you step
// into a station, but they get out of the way: a 12.5 t runway at 9.4 m crosses
// a close-up of the lay-up cell right where you want to be looking.
function collectAmbient() {
  const seen = new Map();
  for (const k of ['shell', 'frame', 'roof', 'cap', 'cladding', 'services',
    'crane', 'product', 'floor']) {
    state.factory.groups[k].traverse((o) => {
      const m = o.material;
      if (!m || m.visible === false || seen.has(m)) return;
      seen.set(m, { m, opacity: m.opacity, transparent: m.transparent });
    });
  }
  state.ambient = [...seen.values()];
}

function setFocus(code) {
  const on = Boolean(code);
  for (const rec of state.ambient) {
    rec.m.transparent = on ? true : rec.transparent;
    rec.m.opacity = on ? rec.opacity * 0.2 : rec.opacity;
    rec.m.depthWrite = !on;
    rec.m.needsUpdate = true;
  }
  for (const [c, entry] of state.factory.registry) {
    const lit = !on || c === code;
    for (const rec of entry.mats) {
      rec.m.transparent = on ? true : rec.transparent;
      rec.m.opacity = lit ? rec.opacity : rec.opacity * 0.22;
      rec.m.depthWrite = lit;
      rec.m.needsUpdate = true;
    }
  }
  // the crew stay lit: a 1.75 m figure beside a station is the fastest thing
  // there is for telling a reader how big it actually is
  state.factory.groups.people.visible = $('#t-people').checked;

  for (const { line, head } of state.factory.flowLines.values()) {
    line.material.opacity = 0;
    head.material.opacity = 0;
  }
  for (const d of state.dots) d.visible = false;
  state.activeEdges = [];

  if (!on) return;
  const step = state.byCode.get(code);
  const edges = [
    ...step.from.map((f) => `${f}>${code}`),
    ...step.to.map((t) => `${code}>${t}`),
  ];
  for (const key of edges) {
    const e = state.factory.flowLines.get(key);
    if (!e) continue;
    e.line.material.opacity = 0.85;
    e.head.material.opacity = 0.9;
    state.activeEdges.push(e);
  }
}

// ------------------------------------------------------------------ markers

function buildMarkers() {
  const host = $('#markers');
  for (const step of state.steps) {
    const el = document.createElement('div');
    el.className = 'marker';
    el.innerHTML = `<b>${step.n}</b>`;
    el.title = `${step.code} · ${step.name}`;
    el.addEventListener('click', (ev) => { ev.stopPropagation(); select(step.code); });
    host.appendChild(el);
    const [x0, y0, x1, y1] = step.box;
    // neighbouring stations sit almost in line with the default camera, so the
    // markers are staggered in height to stop them landing on top of each other
    const lift = step.h + 1.9 + (step.n % 2 ? 0 : 1.5);
    state.markers.set(step.code, {
      el,
      anchor: toWorld((x0 + x1) / 2, (y0 + y1) / 2, lift),
    });
  }
}

const proj = new THREE.Vector3();

function updateMarkers() {
  const show = $('#t-nums').checked;
  const host = $('#markers');
  const w = host.clientWidth;
  const h = host.clientHeight;
  for (const [code, m] of state.markers) {
    if (!show) { m.el.classList.add('hidden'); continue; }
    proj.copy(m.anchor).project(camera);
    const behind = proj.z > 1;
    m.el.classList.toggle('hidden', behind);
    if (behind) continue;
    m.el.style.left = `${(proj.x * 0.5 + 0.5) * w}px`;
    m.el.style.top = `${(-proj.y * 0.5 + 0.5) * h}px`;
    m.el.style.zIndex = String(Math.round((2 - proj.z) * 1000));
    m.el.classList.toggle('on', state.selected === code);
    m.el.classList.toggle('dim', Boolean(state.selected) && state.selected !== code);
  }
}

// ---------------------------------------------------------------- selection

function select(code, { fly = true } = {}) {
  if (code && !state.byCode.has(code)) return;
  state.selected = code || null;
  setFocus(state.selected);
  renderPanel();
  renderRail();
  if (code && fly) flyToStation(state.byCode.get(code));
  if (!code) VIEWS.iso();
  for (const b of document.querySelectorAll('.views button')) {
    b.classList.toggle('on', !code && b.dataset.view === 'iso');
  }

  // the roof comes off when you step inside, and goes back on when you leave
  if (!state.roofTouched) {
    const want = !code;
    $('#t-roof').checked = want;
    applyLayers();
  }
  history.replaceState(null, '', code ? `#${code}` : ' ');
}

function step(delta) {
  const cur = state.selected ? state.byCode.get(state.selected).n : 0;
  const n = cur + delta;
  if (n < 1 || n > state.steps.length) return;
  select(state.steps[n - 1].code);
}

// -------------------------------------------------------------- formatting

const fmt = new Intl.NumberFormat('en-GB');

function secs(s) {
  if (s < 60) return `${s % 1 ? s.toFixed(1) : s} s`;
  if (s < 3600) return `${fmt.format(s)} s · ${+(s / 60).toFixed(1)} min`;
  return `${fmt.format(s)} s · ${+(s / 3600).toFixed(1)} h`;
}

// line_model.py works in euros because that is how the equipment was sourced;
// every Lavoit-facing figure is published in dollars, converted once, the same
// way flow.py and plan.py do it.
const USD_PER_EUR = 1.10;

function usd(v) {
  const d = v * USD_PER_EUR;
  return d >= 1e6 ? `$${(d / 1e6).toFixed(2)}m` : `$${Math.round(d / 1000)}k`;
}

const BASIS = {
  est: 'engineering estimate, no source',
  der: 'derived from a cited figure',
  ref: 'published benchmark or vendor figure',
};

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function markSource(s) {
  return esc(s).replace(/\[F\]/g, '<em>[F]</em>');
}

function rows(pairs) {
  return `<dl>${pairs.map(([k, v]) =>
    `<div class="kv"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

function utilBar(label, o) {
  const pct = Math.round(o.util * 100);
  return `<div class="util">
    <div class="top"><span>${label}</span><span><b>×${o.buy}</b> · ${pct}% used</span></div>
    <div class="bar-track"><div class="bar-fill${pct < 25 ? ' cool' : ''}"
      style="width:${Math.max(pct, 1.5)}%"></div></div>
  </div>`;
}

// -------------------------------------------------------------------- panel

function renderPanel() {
  const overview = $('#overview');
  const detail = $('#detail');
  if (!state.selected) {
    overview.hidden = false;
    detail.hidden = true;
    return;
  }
  overview.hidden = true;
  detail.hidden = false;

  const s = state.byCode.get(state.selected);
  const z = state.data.zones[s.zone];
  const link = (code) => {
    const t = state.byCode.get(code);
    return t
      ? `<button class="chip act" data-goto="${code}">${t.n} · ${esc(t.name)}</button>`
      : `<span class="chip">${esc(code)}</span>`;
  };

  const warns = [];
  if (s.stage === 2) {
    warns.push(['Deferred', 'Drawn and serviced on the general arrangement, but '
      + 'not bought at first commissioning. Until roughly the tenth container '
      + 'the stacks are tested inside the system at FAT instead.']);
  }
  if (s.basis === 'est') {
    warns.push(['Unmeasured', 'This cycle time is an engineering estimate. No '
      + 'station in this factory has ever been run, so there is nothing to '
      + 'calibrate it against. It is deliberately slow, so the machine count '
      + 'errs high.']);
  }

  detail.innerHTML = `
    <div class="backrow">
      <button data-goto="">← All stations</button>
      <button data-nav="-1" ${s.n === 1 ? 'disabled' : ''}>← ${s.n - 1 || ''}</button>
      <button data-nav="1" ${s.n === state.steps.length ? 'disabled' : ''}>Next station →</button>
    </div>

    <div class="head">
      <div class="num">${s.n}</div>
      <div>
        <h3>${esc(s.name)}</h3>
        <div class="meta">${esc(s.code)} · ${esc(s.band)}</div>
      </div>
    </div>
    <div class="chips">
      <span class="chip"><i style="background:${z.colour}"></i>${esc(s.zoneName)}</span>
      <span class="chip">${esc(s.sub || s.per)}</span>
      <span class="chip">${s.footprint_m2} m² on plan</span>
    </div>

    <h2 class="sec">What happens here</h2>
    <p class="lede">${esc(s.headline[0].toUpperCase() + s.headline.slice(1))}.</p>
    <p class="note">${markSource(s.note)}</p>

    <h2 class="sec">Cycle</h2>
    ${rows([
      ['Time per unit', secs(s.cycle_s)],
      ['Unit', `one ${esc(s.per)}`],
      ['Basis', BASIS[s.basis]],
      ['Crew per shift', s.operators === 0 ? 'unmanned' : s.operators.toFixed(2)],
      ['Station area, model', `${s.area_m2} m²`],
      ['Cost of one', usd(s.capex_eur)],
    ])}

    <h2 class="sec">How many you buy</h2>
    ${utilBar('Design point · 1 GW/yr, 2 shifts', s.phase1)}
    ${utilBar('Stretch · 1.2 GW/yr, 3 shifts', s.nameplate)}
    <p class="note">${s.nameplate.buy > s.phase1.buy
      ? 'Bought twice past the design point. The phase 2 floor is reserved for it.'
      : 'One machine covers the whole range. At the design point it runs at '
        + Math.round(s.phase1.util * 100)
        + '% — and a station that is idle at a gigawatt is the point, not a mistake.'}</p>

    <h2 class="sec">Flow</h2>
    <div class="flowgrp">
      <span class="lbl">Fed by</span>
      <div class="chips">${s.from.length
        ? s.from.map(link).join('')
        : '<span class="chip">raw stock, off the loading dock</span>'}
        ${s.boughtIn.map((b) => `<span class="chip">bought in · ${esc(b)}</span>`).join('')}
      </div>
    </div>
    <div class="flowgrp">
      <span class="lbl">Hands on</span>
      <div class="chips">${s.to.length
        ? s.to.map((t) => link(t) + (s.carries[t]
          ? `<span class="chip">${esc(s.carries[t])}</span>` : '')).join('')
        : '<span class="chip">shipping</span>'}
      </div>
    </div>

    ${warns.map(([t, b]) => `<div class="warn"><b>${t}</b>${b}</div>`).join('')}
  `;
  detail.scrollTop = 0;
  $('#panel').scrollTop = 0;
}

function renderOverview() {
  const d = state.data;
  const p = d.summary.phase1;
  const n = d.summary.nameplate;
  const c = d.summary.commissioning;
  $('#overview').innerHTML = `
    <h2 class="sec">Fab 0</h2>
    <p class="lede">${d.steps.length} stations and ${p.crew} direct crew building a gigawatt of
      ${d.summary.product.container_mw} MW containers a year on two shifts. The flow is
      straight through, west to east: dock and warehouse at one end, the line through
      the middle in both bays, and the finished container out of the east shutter onto
      the pad immediately outside it for its only performance test.</p>
    <p class="lede">Click any number on the model, or a station on the rail below,
      to walk the line one station at a time.</p>

    <h2 class="sec">Building</h2>
    ${rows([
      ['Footprint', `${d.building.length} × ${d.building.width} m = ${fmt.format(d.building.footprint_m2)} m²`],
      ['Stations', `${fmt.format(p.station_area_m2)} m²`],
      ['Storage and aisles', `${fmt.format(p.storage_m2)} m²`],
      ['Spare', `${fmt.format(p.spare_m2)} m²`],
      ['Structure', `portal, ${d.building.colPitch} m centres, 2 × ${d.building.width / 2} m`],
      ['Eaves', `${d.building.eaves} m, set by the container lift`],
      ['Cranes', d.cranes.map((x) => x.spec.split(' · ')[0]).join(' and ')],
      ['Incoming power', '10 MVA available'],
      ['Hazardous areas', 'solvent room, and the outdoor test pads'],
    ])}

    <h2 class="sec">Throughput</h2>
    ${rows([
      ['Design point', `${fmt.format(p.mw)} MW/yr · 2 shifts`],
      ['Cell takt', `${Math.round(p.takt_s)} s`],
      ['Stacks · containers', `${fmt.format(p.stacks)} · ${fmt.format(p.containers)} per year`],
      ['Stretch', `${fmt.format(n.mw)} MW/yr · 3 shifts`],
      ['Cell takt, stretch', `${Math.round(n.takt_s)} s`],
      ['Direct crew', `${p.crew} → ${n.crew}`],
    ])}

    <h2 class="sec">Commissioning</h2>
    ${rows([
      ['Process equipment', usd(c.equipment_eur)],
      ['Facility fit-out', usd(c.facility_eur)],
      ['Cranes', usd(c.cranes_eur)],
      ['Contingency', `${Math.round(c.contingency_pct * 100)}%`],
      ['Total', `<b>${usd(c.total_eur)}</b>`],
    ])}
  `;
}

// --------------------------------------------------------------------- rail

function renderRail() {
  const host = $('#bands');
  if (!host.dataset.built) {
    const bands = [];
    for (const s of state.steps) {
      if (!bands.length || bands.at(-1).title !== s.band) {
        bands.push({ title: s.band, items: [] });
      }
      bands.at(-1).items.push(s);
    }
    host.innerHTML = bands.map((b) => `
      <div class="band">
        <span>${esc(b.title)}</span>
        <div class="row">${b.items.map((s, i) => `
          ${i ? '<span class="arrow">→</span>' : ''}
          <button class="node" data-goto="${s.code}">
            <span class="n">${s.n}</span>
            <span class="t"><b>${esc(s.name)}</b><span>${esc(s.code)} · ${secs(s.cycle_s).split(' · ')[0]}</span></span>
          </button>`).join('')}
        </div>
      </div>`).join('') + `
      <div class="band"><span>&nbsp;</span>
        <div class="row"><span class="terminal">Ship · ${state.data.summary.phase1.containers}/yr</span></div>
      </div>`;
    host.dataset.built = '1';
  }
  for (const el of host.querySelectorAll('.node')) {
    const on = el.dataset.goto === state.selected;
    el.classList.toggle('on', on);
    if (on) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }
  $('#prev').disabled = !state.selected || state.byCode.get(state.selected).n === 1;
  $('#next').disabled = state.selected
    && state.byCode.get(state.selected).n === state.steps.length;
}

function renderLegend() {
  $('#legend').innerHTML = Object.entries(state.data.zones)
    .filter(([k]) => k !== 'W')
    .map(([, z]) => `<div><i style="background:${z.colour}"></i>${esc(z.label)}</div>`)
    .join('');
}

// ------------------------------------------------------------------- layers

function applyLayers() {
  const g = state.factory.groups;
  g.roof.visible = $('#t-roof').checked;
  g.cladding.visible = $('#t-roof').checked;
  g.crane.visible = $('#t-crane').checked;
  g.people.visible = $('#t-people').checked;
  g.frame.visible = $('#t-roof').checked;
  // the ducting, the luminaires and the solvent-room ceiling are all overhead,
  // so they come off with the roof
  g.services.visible = $('#t-roof').checked;
  g.cap.visible = $('#t-roof').checked;
}

// -------------------------------------------------------------------- picks

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let downAt = null;

canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
  downAt = null;
  if (moved > 5) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(state.factory.pickable, false);
  select(hits.length ? hits[0].object.userData.code : null);
});

canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  canvas.style.cursor = ray.intersectObjects(state.factory.pickable, false).length
    ? 'pointer' : 'grab';
});

document.addEventListener('click', (e) => {
  const goto = e.target.closest('[data-goto]');
  if (goto) { select(goto.dataset.goto || null); return; }
  const nav = e.target.closest('[data-nav]');
  if (nav) step(Number(nav.dataset.nav));
});

addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'Escape') select(null);
});

$('#prev').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));

for (const b of document.querySelectorAll('.views button')) {
  b.addEventListener('click', () => {
    for (const o of document.querySelectorAll('.views button')) o.classList.toggle('on', o === b);
    VIEWS[b.dataset.view]();
  });
}

for (const id of ['t-roof', 't-crane', 't-people', 't-nums']) {
  $(`#${id}`).addEventListener('change', () => {
    if (id === 't-roof') state.roofTouched = true;
    applyLayers();
  });
}

// --------------------------------------------------------------------- loop

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
let last = performance.now();

function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (state.tween) {
    state.tween.t += (dt * 1000) / state.tween.ms;
    const k = ease(Math.min(state.tween.t, 1));
    camera.position.lerpVectors(state.tween.fromPos, state.tween.toPos, k);
    controls.target.lerpVectors(state.tween.fromTgt, state.tween.toTgt, k);
    if (state.tween.t >= 1) state.tween = null;
  }

  // material travelling down the active routes
  const phase = (now / 2600) % 1;
  state.dots.forEach((d, i) => {
    const e = state.activeEdges[i];
    d.visible = Boolean(e);
    if (e) d.position.copy(e.walk((phase + i * 0.11) % 1));
  });

  controls.update();
  resize();
  renderer.render(scene, camera);
  updateMarkers();
  requestAnimationFrame(loop);
}

// --------------------------------------------------------------------- boot

async function boot() {
  const res = await fetch('./data/fab0.json');
  if (!res.ok) throw new Error(`fab0.json: ${res.status}`);
  state.data = await res.json();
  state.steps = state.data.steps;
  for (const s of state.steps) state.byCode.set(s.code, s);

  lights();
  state.factory = buildFactory(state.data);
  scene.add(state.factory.root);

  const dotGeo = new THREE.SphereGeometry(0.34, 14, 10);
  const dotMat = new THREE.MeshBasicMaterial({ color: COPPER, depthTest: false });
  for (let i = 0; i < 6; i++) {
    const d = new THREE.Mesh(dotGeo, dotMat);
    d.visible = false;
    d.renderOrder = 6;
    state.dots.push(d);
    state.factory.groups.flow.add(d);
  }

  collectAmbient();
  buildMarkers();
  renderOverview();
  renderLegend();
  renderRail();
  applyLayers();
  resize();
  VIEWS.iso(true);

  const hash = location.hash.slice(1);
  if (hash && state.byCode.has(hash)) select(hash);

  requestAnimationFrame(loop);
  requestAnimationFrame(() => $('#loading').classList.add('gone'));
}

boot().catch((err) => {
  $('#loading').innerHTML =
    `<span>${esc(err.message)}<br><br>Serve this folder over HTTP: <code>./serve.sh</code></span>`;
  console.error(err);
});
