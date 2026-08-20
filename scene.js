// Fab 0 as three.js geometry.
//
// This is make_fab0.py rebuilt for the browser: the same footprints, the same
// heights, the same palette, the same machines, and the same two drawing
// conventions — frame and purlin with a low perimeter upstand and no cladding so
// the interior stays visible, and a sunken goods-in dock lane whose access ramp
// is off the west edge of the model and not drawn.
//
// Anything shaped here is shaped there. If you change a machine in one, change
// it in the other; the footprints themselves cannot drift, because both read
// them from plan.py.
//
// Plan coordinates are metres, x east, y north, z up, origin at the south-west
// corner. three.js is y-up, so plan (x, y, z) becomes world (x - 36, z, 18 - y):
// the building is centred on the origin and plan north points at world -z.

import * as THREE from 'three';

const CX = 36.0;
const CY = 18.0;

export const INK = 0x27241e;
export const COPPER = 0xb87333;

// The same hexes make_fab0.py hands preview_stl.py. Dark polished floor,
// near-black steel, galvanised ducting, safety yellow on the guarding, and
// copper kept for the cranes because that is the brand accent.
const PAL = {
  floor: 0x45484b,
  apron: 0x6a6d71,
  shell: 0x6f7276,
  frame: 0x202226,
  roof: 0x272a2e,
  cap: 0x7b7e82,
  duct: 0x9ba1a5,
  rack: 0x6b6f74,
  pallet: 0x8c7d5f,
  machine: 0x83878b,
  product: 0x312f2b,
  people: 0x1b1c20,
  truck: 0x404750,
  mesh: 0x25282c,
  safety: 0xe0b400,
  crane: 0xa2612c,
  light: 0xf7f2db,
};

// Zone accents, desaturated from the plan's own colours so the machines read as
// machines and the zone is still identifiable. The plan colours themselves stay
// in use for the floor tints and the legend, which is what ties the two
// drawings together.
const ZONE_ACCENT = {
  A: 0x9b8e77, B: 0x789289, C: 0x9d7b47, D: 0x8e6a43,
  E: 0x9d7b47, F: 0x78859b, G: 0x98916c, W: 0x6b6f74,
};

const LANE_Z = -1.20;
const YARD_Z = -0.38;
const LIGHT_Z = 7.0;
const DUCT_Z = 8.35;

export function toWorld(x, y, z = 0) {
  return new THREE.Vector3(x - CX, z, CY - y);
}

// One shared unit box, scaled per instance. A factory full of racking is a few
// thousand boxes and allocating a BufferGeometry for each one is wasteful.
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const UNIT_EDGES = new THREE.EdgesGeometry(UNIT, 24);
const EPS = 0.002;

function boxAt(x0, y0, x1, y1, z0, z1, material) {
  const m = new THREE.Mesh(UNIT, material);
  m.scale.set(Math.max(Math.abs(x1 - x0), EPS), Math.max(Math.abs(z1 - z0), EPS),
    Math.max(Math.abs(y1 - y0), EPS));
  m.position.copy(toWorld((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function centredBox(l, w, h, cx, cy, z0, material, spin = 0) {
  const m = new THREE.Mesh(UNIT, material);
  m.scale.set(Math.max(l, EPS), Math.max(h, EPS), Math.max(w, EPS));
  m.position.copy(toWorld(cx, cy, z0 + h / 2));
  m.rotation.y = spin;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cylZ(cx, cy, z0, z1, r, material, segs = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.abs(z1 - z0), segs),
    material);
  m.position.copy(toWorld(cx, cy, (z0 + z1) / 2));
  m.castShadow = true;
  return m;
}

// horizontal cylinders: along plan x, and along plan y
function cylX(cx, cy, z, r, len, material, segs = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), material);
  m.position.copy(toWorld(cx, cy, z));
  m.rotation.z = Math.PI / 2;
  m.castShadow = true;
  return m;
}

function cylY(cx, cy, z, r, len, material, segs = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), material);
  m.position.copy(toWorld(cx, cy, z));
  m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  return m;
}

function outline(mesh, colour = INK, opacity = 0.34) {
  const e = new THREE.LineSegments(
    mesh.geometry === UNIT ? UNIT_EDGES : new THREE.EdgesGeometry(mesh.geometry, 24),
    new THREE.LineBasicMaterial({
      color: colour, transparent: true, opacity, depthWrite: false,
    }));
  e.position.copy(mesh.position);
  e.rotation.copy(mesh.rotation);
  e.scale.copy(mesh.scale);
  return e;
}

function mat(hex, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: opts.roughness ?? 0.88,
    metalness: opts.metalness ?? 0.0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    flatShading: opts.flatShading ?? false,
  });
}

// The shared material set. Station groups clone what they use, so a station can
// fade on its own without taking the rest of the factory with it.
let M = null;

function materials() {
  return {
    floor: mat(PAL.floor, { roughness: 0.42, metalness: 0.06 }),
    apron: mat(PAL.apron, { roughness: 0.98 }),
    shell: mat(PAL.shell, { roughness: 0.92 }),
    frame: mat(PAL.frame, { roughness: 0.55, metalness: 0.35 }),
    roof: mat(PAL.roof, { roughness: 0.55, metalness: 0.35 }),
    cap: mat(PAL.cap, { roughness: 0.94 }),
    duct: mat(PAL.duct, { roughness: 0.36, metalness: 0.55 }),
    rack: mat(PAL.rack, { roughness: 0.62, metalness: 0.28 }),
    pallet: mat(PAL.pallet, { roughness: 0.96 }),
    machine: mat(PAL.machine, { roughness: 0.62, metalness: 0.2 }),
    product: mat(PAL.product, { roughness: 0.7 }),
    people: mat(PAL.people, { roughness: 0.8 }),
    truck: mat(PAL.truck, { roughness: 0.55, metalness: 0.2 }),
    mesh: mat(PAL.mesh, { roughness: 0.7, metalness: 0.2 }),
    safety: mat(PAL.safety, { roughness: 0.7 }),
    crane: mat(PAL.crane, { roughness: 0.55, metalness: 0.3 }),
    light: new THREE.MeshBasicMaterial({ color: PAL.light }),
    // the sheeting is a hint that there is an envelope, not a window to look
    // through. Kept very faint, because three layers of it between the eye and
    // the floor is what turns a dark factory into a pastel one.
    glass: mat(0xaeb6b4, {
      transparent: true, opacity: 0.06, side: THREE.DoubleSide, roughness: 0.4,
    }),
    zone: {},
    ghost: {},
  };
}

function acc(zone) {
  return M.zone[zone] || M.machine;
}

// --------------------------------------------------------------- the shell

function runs(a0, a1, gaps) {
  const out = [];
  let cur = a0;
  for (const [b0, b1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (b0 > cur) out.push([cur, b0]);
    cur = Math.max(cur, b1);
  }
  if (cur < a1) out.push([cur, a1]);
  return out;
}

function buildShell(data, groups) {
  const B = data.building;
  const gaps = (w) => data.doors.filter((d) => d.wall === w).map((d) => [d.a, d.b]);

  const slab = boxAt(-0.5, -1.0, B.length + 1.0, B.width + 1.0, -0.35, 0, M.floor);
  slab.castShadow = false;
  groups.shell.add(slab);

  const apron = new THREE.Mesh(new THREE.PlaneGeometry(260, 220), M.apron);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, YARD_Z - 0.02, 0);
  apron.receiveShadow = true;
  groups.ground.add(apron);

  // perimeter upstand, 1.4 m, opened where the doors are. The east wall has an
  // opening now: that is where the container leaves.
  for (const [a0, a1] of runs(0, B.width, gaps('W'))) {
    groups.shell.add(boxAt(0, a0, 0.24, a1, 0, 1.4, M.shell));
  }
  for (const [a0, a1] of runs(0, B.width, gaps('E'))) {
    groups.shell.add(boxAt(B.length - 0.24, a0, B.length, a1, 0, 1.4, M.shell));
  }
  for (const [a0, a1] of runs(0, B.length, gaps('S'))) {
    groups.shell.add(boxAt(a0, 0, a1, 0.24, 0, 1.4, M.shell));
  }
  for (const [a0, a1] of runs(0, B.length, gaps('N'))) {
    groups.shell.add(boxAt(a0, B.width - 0.24, a1, B.width, 0, 1.4, M.shell));
  }

  // the solvent room: isopropanol flashes at 12 C, so it is fire separated with
  // its own extract. It is a room, so it has a ceiling and a doorway, and it is
  // 3.4 m rather than full height so it does not float as a pair of slabs. It
  // moved east of soft goods, to sit immediately before the lay-up cells, and it
  // moved as a room rather than as a station.
  const [vx0, vy0, vx1, vy1] = B.solventRoom;
  const vh = B.solventRoomH;
  const [vd0, vd1] = B.solventDoor;
  for (const [x0, x1] of [[vx0, vx0 + 0.2], [vx1 - 0.2, vx1]]) {
    const w = boxAt(x0, vy0, x1, vy1, 0, vh, M.shell);
    groups.shell.add(w, outline(w, INK, 0.2));
  }
  groups.shell.add(boxAt(vx0, vy1 - 0.2, vx1, vy1, 0, vh, M.shell));
  for (const [a0, a1] of runs(vx0, vx1, [[vd0, vd1]])) {
    groups.shell.add(boxAt(a0, vy0, a1, vy0 + 0.2, 0, vh, M.shell));
  }
  groups.shell.add(boxAt(vd0, vy0, vd1, vy0 + 0.2, 2.15, vh, M.shell));
  const capMesh = boxAt(vx0, vy0, vx1, vy1, vh, vh + 0.18, M.cap);
  groups.cap.add(capMesh, outline(capMesh, INK, 0.2));

  // soft-goods partition, low so the room reads without blocking the view. East
  // of the press, so membrane and foam never meet press swarf.
  const [sx0, sy0, sx1, sy1] = B.softRoom;
  const sh = B.softRoomH;
  const [sd0, sd1] = B.softDoor;
  for (const [x0, x1] of [[sx0, sx0 + 0.2], [sx1 - 0.2, sx1]]) {
    groups.shell.add(boxAt(x0, sy0, x1, sy1, 0, sh, M.shell));
  }
  for (const [a0, a1] of runs(sx0, sx1, [[sd0, sd1]])) {
    groups.shell.add(boxAt(a0, sy0, a1, sy0 + 0.2, 0, sh, M.shell));
  }
  groups.shell.add(boxAt(sd0, sy0, sd1, sy0 + 0.2, 2.15, sh, M.shell));
  groups.shell.add(boxAt(sd1, sy0 + 0.2, sd1 + 0.2, sy1 - 0.2, 0, sh, M.shell));

  // portal frames at 6 m centres, drawn as trusses: chord, rafter and webs
  const n = Math.round(B.length / B.colPitch);
  for (let i = 0; i <= n; i++) {
    const x = i * B.colPitch;
    for (const [y, h] of [[0, B.eaves], [B.baySplit, B.ridge], [B.width, B.eaves]]) {
      const yy = Math.min(Math.max(y, 0.16), B.width - 0.16);
      groups.frame.add(boxAt(x - 0.16, yy - 0.16, x + 0.16, yy + 0.16, 0, h, M.frame));
      groups.frame.add(boxAt(x - 0.26, yy - 0.26, x + 0.26, yy + 0.26, h - 0.12, h,
        M.frame));
    }
    groups.roof.add(rafter(x, 0, B.eaves, B.baySplit, B.ridge));
    groups.roof.add(rafter(x, B.baySplit, B.ridge, B.width, B.eaves));
    for (const [y0, y1, z0, z1] of [
      [0, B.baySplit, B.eaves, B.ridge], [B.baySplit, B.width, B.ridge, B.eaves],
    ]) {
      groups.roof.add(boxAt(x - 0.10, y0, x + 0.10, y1, B.eaves - 0.20, B.eaves,
        M.roof));
      for (let k = 1; k < 4; k++) {
        const t = k / 4;
        const y = y0 + (y1 - y0) * t;
        const z = z0 + (z1 - z0) * t;
        groups.roof.add(boxAt(x - 0.07, y - 0.07, x + 0.07, y + 0.07,
          B.eaves - 0.20, z, M.roof));
      }
    }
  }
  for (const [y, h] of [[0, B.eaves], [B.baySplit, B.ridge], [B.width, B.eaves]]) {
    const yy = Math.min(Math.max(y, 0.14), B.width - 0.14);
    groups.roof.add(boxAt(0, yy - 0.14, B.length, yy + 0.14, h - 0.34, h, M.roof));
  }
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    for (const [y0, y1, z0, z1] of [
      [0, B.baySplit, B.eaves, B.ridge], [B.width, B.baySplit, B.eaves, B.ridge],
    ]) {
      const y = y0 + (y1 - y0) * t;
      const z = z0 + (z1 - z0) * t;
      groups.roof.add(boxAt(0, y - 0.06, B.length, y + 0.06, z - 0.13, z, M.roof));
    }
  }

  // translucent sheeting, so the envelope reads from outside
  for (const [y0, z0, y1, z1] of [
    [0, B.eaves, B.baySplit, B.ridge], [B.baySplit, B.ridge, B.width, B.eaves],
  ]) {
    const len = Math.hypot(y1 - y0, z1 - z0);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(B.length, len), M.glass);
    p.position.copy(toWorld(B.length / 2, (y0 + y1) / 2, (z0 + z1) / 2));
    p.rotation.x = -Math.PI / 2 + Math.atan2(z1 - z0, -(y1 - y0));
    groups.roof.add(p);
  }
  for (const [x0, y0, x1, y1] of [
    [0, 0, 0, B.width], [B.length, 0, B.length, B.width],
    [0, 0, B.length, 0], [0, B.width, B.length, B.width],
  ]) {
    const w = Math.hypot(x1 - x0, y1 - y0);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, B.eaves - 1.4), M.glass);
    p.position.copy(toWorld((x0 + x1) / 2, (y0 + y1) / 2, 1.4 + (B.eaves - 1.4) / 2));
    p.rotation.y = x0 === x1 ? Math.PI / 2 : 0;
    groups.cladding.add(p);
  }
}

function rafter(x, y0, z0, y1, z1) {
  const len = Math.hypot(y1 - y0, z1 - z0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.34, len), M.roof);
  const a = toWorld(x, y0, z0);
  const b = toWorld(x, y1, z1);
  m.position.copy(a.clone().add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), b.clone().sub(a).normalize());
  m.castShadow = true;
  return m;
}

// ------------------------------------------------------------------- doors

// u runs along the wall, v is distance outward from it, so one body of code
// serves any of the four walls. The container shutter is on the east wall.
function shutter(group, wall, a, b, h, L, W, curtain = 0.6) {
  const put = (u0, v0, u1, v1, z0, z1, material) => {
    if (wall === 'W') group.add(boxAt(v0, u0, v1, u1, z0, z1, material));
    else if (wall === 'E') group.add(boxAt(L - v1, u0, L - v0, u1, z0, z1, material));
    else if (wall === 'N') group.add(boxAt(u0, W - v1, u1, W - v0, z0, z1, material));
    else group.add(boxAt(u0, v0, u1, v1, z0, z1, material));
  };

  put(a - 0.34, -0.30, a, 0.10, 0, h + 0.55, M.shell);
  put(b, -0.30, b + 0.34, 0.10, 0, h + 0.55, M.shell);
  put(a - 0.34, -0.30, b + 0.34, 0.10, h + 0.10, h + 0.55, M.shell);
  for (const u of [a, b - 0.10]) put(u, -0.20, u + 0.10, 0.02, 0, h + 0.10, M.mesh);
  // drawn open, because the whole argument about this door is that a finished
  // container goes out through it
  put(a + 0.08, -0.14, b - 0.08, -0.02, h - curtain, h + 0.08, M.mesh);

  const mid = (a + b) / 2;
  const len = b - a - 0.2;
  if (wall === 'W') group.add(cylY(-0.13, mid, h + 0.34, 0.30, len, M.duct));
  else if (wall === 'E') group.add(cylY(L + 0.13, mid, h + 0.34, 0.30, len, M.duct));
  else if (wall === 'N') group.add(cylX(mid, W + 0.13, h + 0.34, 0.30, len, M.duct));
  else group.add(cylX(mid, -0.13, h + 0.34, 0.30, len, M.duct));
  for (const u of [a - 0.55, b + 0.55]) {
    const at = wall === 'W' ? [0.85, u] : wall === 'E' ? [L - 0.85, u]
      : wall === 'N' ? [u, W - 0.85] : [u, 0.85];
    bollard(group, at[0], at[1]);
  }
}

function dockDoor(group, a, b, h) {
  group.add(boxAt(-0.30, a - 0.30, 0.10, b + 0.30, h, h + 0.45, M.shell));
  for (const u of [a - 0.30, b]) {
    group.add(boxAt(-0.30, u, 0.10, u + 0.30, 0, h + 0.45, M.shell));
  }
  group.add(boxAt(-0.12, a, -0.02, b, h - 0.55, h, M.mesh));
  group.add(cylY(-0.14, (a + b) / 2, h + 0.26, 0.26, b - a - 0.2, M.duct));
  group.add(boxAt(-1.05, a + 0.25, 0.30, b - 0.25, -0.10, 0.02, M.machine));
  for (const u of [a + 0.20, b - 0.55]) {
    group.add(boxAt(-0.62, u, -0.42, u + 0.35, LANE_Z + 0.75, LANE_Z + 1.20,
      M.product));
  }
}

function buildDoors(data, groups) {
  const { length, width } = data.building;
  for (const d of data.doors) {
    if (d.kind === 'dock') {
      const n = d.b - d.a > 4.5 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        dockDoor(groups.shell, d.a + (d.b - d.a) * i / n + 0.25,
          d.a + (d.b - d.a) * (i + 1) / n - 0.25, d.h);
      }
    } else {
      shutter(groups.shell, d.wall, d.a, d.b, d.h, length, width);
    }
  }
}

// ------------------------------------------------------------------ detail

function bollard(group, x, y, h = 1.05) {
  group.add(cylZ(x, y, 0, h, 0.11, M.safety, 12));
  group.add(cylZ(x, y, 0, 0.06, 0.19, M.machine, 12));
}

function stripe(group, x0, y0, x1, y1, w = 0.12) {
  const m = Math.abs(x1 - x0) >= Math.abs(y1 - y0)
    ? boxAt(x0, y0 - w / 2, x1, y0 + w / 2, 0, 0.02, M.safety)
    : boxAt(x0 - w / 2, y0, x0 + w / 2, y1, 0, 0.02, M.safety);
  m.castShadow = false;
  group.add(m);
}

function bayMarking(group, x0, y0, x1, y1, w = 0.14) {
  const leg = Math.min(1.4, (x1 - x0) / 3, (y1 - y0) / 3);
  for (const [sx, x] of [[1, x0], [-1, x1]]) {
    for (const [sy, y] of [[1, y0], [-1, y1]]) {
      stripe(group, x, y, x + leg * sx, y, w);
      stripe(group, x, y, x, y + leg * sy, w);
    }
  }
}

// Guard fence in the reference style: safety-yellow posts on feet, dark mesh
// infill drawn as bands so you can still see the cell inside, and one gate leaf
// standing open.
function fenceLine(group, ax, ay, bx, by, h = 2.15, gate = false, panel = 2.5) {
  const length = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.round(length / panel));
  const step = length / n;
  const ux = (bx - ax) / length;
  const uy = (by - ay) / length;
  const skip = gate ? Math.floor(n / 2) : -1;
  for (let i = 0; i <= n; i++) {
    const px = ax + ux * step * i;
    const py = ay + uy * step * i;
    group.add(boxAt(px - 0.07, py - 0.07, px + 0.07, py + 0.07, 0, h, M.safety));
    group.add(boxAt(px - 0.14, py - 0.14, px + 0.14, py + 0.14, 0, 0.045, M.mesh));
  }
  for (let i = 0; i < n; i++) {
    const pax = ax + ux * step * i;
    const pay = ay + uy * step * i;
    if (i === skip) {
      gateLeaf(group, pax, pay, ux, uy, step - 0.2, h);
      continue;
    }
    meshPanel(group, pax + ux * 0.10, pay + uy * 0.10,
      pax + ux * (step - 0.10), pay + uy * (step - 0.10), h);
  }
}

function meshPanel(group, ax, ay, bx, by, h) {
  const t = 0.028;
  const loX = Math.min(ax, bx) - t;
  const hiX = Math.max(ax, bx) + t;
  const loY = Math.min(ay, by) - t;
  const hiY = Math.max(ay, by) + t;
  for (const z of [0.17, 0.73, 1.29, 1.85]) {
    if (z + 0.10 > h - 0.16) continue;
    group.add(boxAt(loX, loY, hiX, hiY, z, z + 0.10, M.mesh));
  }
  group.add(boxAt(loX, loY, hiX, hiY, h - 0.19, h - 0.09, M.mesh));
  for (const [sx, sy] of [[ax, ay], [bx, by]]) {
    group.add(boxAt(sx - 0.04, sy - 0.04, sx + 0.04, sy + 0.04, 0.12, h - 0.09,
      M.mesh));
  }
}

function gateLeaf(group, px, py, ux, uy, length, h) {
  const ca = Math.cos(Math.PI * 58 / 180);
  const sa = Math.sin(Math.PI * 58 / 180);
  const ang = Math.atan2(ux * sa + uy * ca, ux * ca - uy * sa);
  // built about the hinge in leaf-local space, then swung open as a group
  const leaf = new THREE.Group();
  const part = (l, t, hh, u, z) => {
    const m = new THREE.Mesh(UNIT, M.mesh);
    m.scale.set(l, hh, t);
    m.position.set(u, z, 0);
    m.castShadow = true;
    leaf.add(m);
  };
  for (const z of [0.17, 0.73, 1.29, 1.85]) {
    if (z + 0.10 > h - 0.16) continue;
    part(length, 0.056, 0.10, length / 2, z + 0.05);
  }
  part(length, 0.056, 0.10, length / 2, h - 0.14);
  for (const u of [0.035, length - 0.035]) {
    part(0.07, 0.09, h - 0.17, u, 0.12 + (h - 0.17) / 2);
  }
  leaf.position.copy(toWorld(px, py, 0));
  leaf.rotation.y = ang;
  group.add(leaf);
}

// ----------------------------------------------------------------- racking

function rackRun(group, x0, y0, x1, y1, h, levels = 3, bay = 2.7, seed = 0,
  load = true) {
  const alongX = (x1 - x0) >= (y1 - y0);
  const [u0, u1, v0, v1] = alongX ? [x0, x1, y0, y1] : [y0, y1, x0, x1];
  const put = (ua, va, ub, vb, z0, z1, material) => group.add(
    alongX ? boxAt(ua, va, ub, vb, z0, z1, material)
      : boxAt(va, ua, vb, ub, z0, z1, material));

  const span = u1 - u0;
  const n = Math.max(1, Math.round(span / bay));
  const step = span / n;
  const post = 0.09;
  for (let i = 0; i <= n; i++) {
    const u = Math.min(u0 + step * i, u1 - post);
    for (const v of [v0, v1 - post]) put(u, v, u + post, v + post, 0, h, M.rack);
    put(u, v0, u + post, v1, h - 0.10, h, M.rack);
  }
  const beams = [];
  for (let k = 1; k < levels; k++) beams.push(h * k / levels);
  beams.push(h - 0.16);
  for (const z of beams) {
    for (const v of [v0 - 0.01, v1 - 0.09]) {
      put(u0, v, u1, v + 0.10, z - 0.13, z, M.rack);
    }
  }
  if (!load) return;
  const lh = Math.min(1.05, h / levels - 0.20);
  const zs = [0.02, ...beams.slice(0, -1)];
  for (let k = 0; k < zs.length; k++) {
    for (let i = 0; i < n; i++) {
      const g = (i * 7 + k * 3 + seed) % 11;
      if (g === 0 || g === 5) continue;
      const ua = u0 + step * i + 0.24;
      const ub = u0 + step * (i + 1) - 0.24;
      if (ub - ua < 0.55) continue;
      put(ua, v0 + 0.07, ub, v1 - 0.07, zs[k], zs[k] + lh, M.pallet);
    }
  }
}

function rackBlock(group, x0, y0, x1, y1, h, levels = 3, depth = 1.1, gang = 2.5,
  inset = 0.35) {
  const alongX = (x1 - x0) >= (y1 - y0);
  const [c0, c1] = alongX ? [y0, y1] : [x0, x1];
  const [a0, a1] = alongX ? [x0 + inset, x1 - inset] : [y0 + inset, y1 - inset];
  const run = (d0, d1, k) => (alongX
    ? rackRun(group, a0, d0, a1, d1, h, levels, 2.7, k)
    : rackRun(group, d0, a0, d1, a1, h, levels, 2.7, k));

  let c = c0 + 0.35;
  let k = 0;
  while (c + depth <= c1 - 0.35) {
    if (c + 2 * depth <= c1 - 0.35) {
      run(c, c + depth, k++);
      run(c + depth, c + 2 * depth, k++);
      c += 2 * depth + gang;
    } else {
      run(c, c + depth, k++);
      c += depth + gang;
    }
  }
}

// ----------------------------------------------------------------- machines

function cabinet(group, zone, x, y, w = 0.9, d = 0.7, h = 2.0) {
  group.add(boxAt(x - w / 2 - 0.04, y - d / 2 - 0.04, x + w / 2 + 0.04,
    y + d / 2 + 0.04, 0, 0.10, M.machine));
  group.add(boxAt(x - w / 2, y - d / 2, x + w / 2, y + d / 2, 0.10, h, acc(zone)));
  group.add(boxAt(x - w / 2 - 0.03, y - d / 2 - 0.03, x + w / 2 + 0.03,
    y + d / 2 + 0.03, h, h + 0.07, M.machine));
}

function bench(group, zone, x0, y0, x1, y1, h = 0.92, rail = true) {
  // the worktop carries the zone colour, because a top-down view sees tops
  group.add(boxAt(x0, y0, x1, y1, h - 0.07, h, acc(zone)));
  group.add(boxAt(x0 + 0.10, y0 + 0.08, x1 - 0.10, y1 - 0.08, 0.26, 0.32, M.rack));
  const longX = (x1 - x0) >= (y1 - y0);
  const [a0, a1] = longX ? [x0, x1] : [y0, y1];
  const n = Math.max(2, Math.floor((a1 - a0) / 1.8) + 1);
  for (let i = 0; i < n; i++) {
    const a = a0 + 0.12 + (a1 - a0 - 0.24) * i / (n - 1);
    for (const b of longX ? [y0 + 0.10, y1 - 0.18] : [x0 + 0.10, x1 - 0.18]) {
      group.add(longX ? boxAt(a, b, a + 0.08, b + 0.08, 0, h - 0.07, M.rack)
        : boxAt(b, a, b + 0.08, a + 0.08, 0, h - 0.07, M.rack));
    }
  }
  if (rail) {
    group.add(longX ? boxAt(x0, y1 - 0.09, x1, y1, h, h + 0.42, M.machine)
      : boxAt(x1 - 0.09, y0, x1, y1, h, h + 0.42, M.machine));
  }
}

function pressFourPost(group, zone, cx, cy, w, d, h) {
  const bed = 0.95;
  group.add(boxAt(cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2, 0, bed, M.machine));
  group.add(boxAt(cx - w / 2 + 0.18, cy - d / 2 + 0.18, cx + w / 2 - 0.18,
    cy + d / 2 - 0.18, bed, bed + 0.28, acc(zone)));
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      group.add(cylZ(cx + sx * (w / 2 - 0.26), cy + sy * (d / 2 - 0.26), bed,
        h - 0.7, 0.17, M.machine, 12));
    }
  }
  const crown = boxAt(cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2, h - 0.7, h,
    acc(zone));
  group.add(crown, outline(crown, INK, 0.28));
  group.add(boxAt(cx - w / 2 + 0.34, cy - d / 2 + 0.34, cx + w / 2 - 0.34,
    cy + d / 2 - 0.34, bed + 0.90, h - 0.72, M.machine));
  group.add(boxAt(cx - w / 2 + 0.34, cy - d / 2 + 0.34, cx + w / 2 - 0.34,
    cy + d / 2 - 0.34, bed + 0.28, bed + 0.72, M.machine));
}

function pressCFrame(group, zone, cx, cy, w, d, h, openTo = -1) {
  const back = cy - openTo * (d / 2 - 0.42);
  group.add(boxAt(cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2, 0, 0.30, M.machine));
  group.add(boxAt(cx - w / 2, Math.min(back, back - openTo * 0.84), cx + w / 2,
    Math.max(back, back - openTo * 0.84), 0, h, M.machine));
  group.add(boxAt(cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2, h - 0.62, h,
    acc(zone)));
  group.add(boxAt(cx - w / 2 + 0.12, cy - d / 2 + 0.10, cx + w / 2 - 0.12,
    cy + d / 2 - 0.10, 0.30, 0.90, acc(zone)));
  group.add(boxAt(cx - w / 2 + 0.30, cy - d / 2 + 0.28, cx + w / 2 - 0.30,
    cy + d / 2 - 0.28, h - 1.34, h - 0.62, M.machine));
}

function bathTank(group, zone, x0, y0, x1, y1, rim = 1.05) {
  const t = 0.09;
  for (const [a, b, c, d] of [[x0, y0, x0 + t, y1], [x1 - t, y0, x1, y1],
    [x0, y0, x1, y0 + t], [x0, y1 - t, x1, y1]]) {
    group.add(boxAt(a, b, c, d, 0.28, rim, M.machine));
  }
  group.add(boxAt(x0, y0, x1, y1, 0.28, 0.40, M.machine));
  group.add(boxAt(x0 + t, y0 + t, x1 - t, y1 - t, rim - 0.22, rim - 0.12, acc(zone)));
  for (const sx of [x0 + 0.12, x1 - 0.20]) {
    for (const sy of [y0 + 0.12, y1 - 0.20]) {
      group.add(boxAt(sx, sy, sx + 0.08, sy + 0.08, 0, 0.28, M.machine));
    }
  }
  group.add(boxAt(x0 - 0.06, y1 - 0.02, x1 + 0.06, y1 + 0.20, rim + 0.02,
    rim + 0.34, M.duct));
}

function tank(group, zone, x, y, r, h, skirt = 0.35) {
  group.add(cylZ(x, y, 0, skirt, r * 0.86, M.machine, 16));
  // a vertical vessel with elliptical dished heads, as a lathe of its profile
  const head = r * 0.5;
  const pts = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 * i / steps;
    pts.push(new THREE.Vector2(Math.max(r * Math.sin(a), 0.001),
      skirt + head * (1 - Math.cos(a))));
  }
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 * i / steps;
    pts.push(new THREE.Vector2(Math.max(r * Math.cos(a), 0.001),
      skirt + h - head + head * Math.sin(a)));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), acc(zone));
  body.position.copy(toWorld(x, y, 0));
  body.castShadow = true;
  group.add(body);
  group.add(cylZ(x, y, skirt + h, skirt + h + 0.26, 0.09, M.machine, 8));
}

function robot(group, x, y, spin = 0, reach = 1.55) {
  const rot = (dx, dy) => [dx * Math.cos(spin) - dy * Math.sin(spin),
    dx * Math.sin(spin) + dy * Math.cos(spin)];
  group.add(cylZ(x, y, 0, 0.36, 0.36, M.machine, 16));
  group.add(cylZ(x, y, 0.36, 0.84, 0.28, M.machine, 14));
  group.add(centredBox(0.52, 0.60, 0.48, x, y, 0.78, acc('D'), spin));

  const t1 = Math.PI * 34 / 180;
  const upper = new THREE.Mesh(UNIT, acc('D'));
  upper.scale.set(0.28, reach, 0.28);
  const [mx, my] = rot(0, reach / 2 * Math.sin(t1));
  upper.position.copy(toWorld(x + mx, y + my, 1.02 + reach / 2 * Math.cos(t1)));
  upper.rotation.y = spin;
  upper.rotateX(t1);
  upper.castShadow = true;
  group.add(upper);

  const [ex, ey] = rot(0, reach * Math.sin(t1));
  const ez = 1.02 + reach * Math.cos(t1);
  group.add(cylZ(x + ex, y + ey, ez - 0.15, ez + 0.15, 0.19, M.machine, 12));

  const t2 = Math.PI * 116 / 180;
  const fl = reach * 0.80;
  const fore = new THREE.Mesh(UNIT, M.machine);
  fore.scale.set(0.22, fl, 0.22);
  const [fx, fy] = rot(0, fl / 2 * Math.sin(t2));
  fore.position.copy(toWorld(x + ex + fx, y + ey + fy, ez + fl / 2 * Math.cos(t2)));
  fore.rotation.y = spin;
  fore.rotateX(t2);
  fore.castShadow = true;
  group.add(fore);

  const [wx, wy] = rot(0, fl * Math.sin(t2));
  const px = x + ex + wx;
  const py = y + ey + wy;
  const wz = ez + fl * Math.cos(t2);
  group.add(cylZ(px, py, wz - 0.14, wz, 0.13, M.machine, 10));
  // the vacuum array that actually picks a plate
  group.add(centredBox(0.88, 0.60, 0.08, px, py, wz - 0.30, acc('D'), spin));
  for (const sx of [-0.34, 0, 0.34]) {
    for (const sy of [-0.20, 0.20]) {
      const [cx2, cy2] = rot(sx, sy);
      group.add(cylZ(px + cx2, py + cy2, wz - 0.34, wz - 0.30, 0.055, M.machine, 8));
    }
  }
}

function stackBody(group, x, y, spin = 0, z = 0, stand = true) {
  const L = 1.30, W = 0.72, H = 0.62;
  if (stand) {
    group.add(centredBox(L + 0.2, W + 0.2, 0.55, x, y, z, M.machine, spin));
    z += 0.55;
  }
  group.add(centredBox(L, W, H, x, y, z, M.product, spin));
  for (const s of [-1, 1]) {
    const off = s * (L / 2 + 0.045);
    const m = centredBox(0.09, W, H, x, y, z, acc('D'), spin);
    m.position.x += Math.cos(spin) * off;
    m.position.z -= Math.sin(spin) * off;
    group.add(m);
  }
}

function containerUnit(group, cx, cy, dims, spin, frameOnly, material, z = 0) {
  const [L, W, H] = dims;
  if (!frameOnly) {
    const m = centredBox(L, W, H, cx, cy, z, material, spin);
    group.add(m, outline(m, INK, 0.3));
    for (const sx of [-1, 1]) {
      const e = centredBox(0.06, W + 0.04, H, cx, cy, z, M.machine, spin);
      e.position.x += Math.cos(spin) * sx * (L / 2 + 0.03);
      e.position.z -= Math.sin(spin) * sx * (L / 2 + 0.03);
      group.add(e);
    }
    return;
  }
  const t = 0.16;
  const parts = [];
  for (const zz of [0, H - t]) {
    parts.push([L, t, t, 0, -(W / 2 - t / 2), zz], [L, t, t, 0, W / 2 - t / 2, zz],
      [t, W, t, -(L / 2 - t / 2), 0, zz], [t, W, t, L / 2 - t / 2, 0, zz]);
  }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      parts.push([t, t, H, sx * (L / 2 - t / 2), sy * (W / 2 - t / 2), 0]);
    }
  }
  for (const [l, w, h, dx, dy, zz] of parts) {
    const m = centredBox(l, w, h, cx, cy, z + zz, material, spin);
    m.position.x += dx;
    m.position.z -= dy;
    group.add(m);
  }
}

function person(group, x, y, spin, z = 0) {
  group.add(centredBox(0.34, 0.24, 0.86, x, y, z, M.people, spin));
  group.add(centredBox(0.46, 0.30, 0.64, x, y, z + 0.86, M.people, spin));
  group.add(cylZ(x, y, z + 1.52, z + 1.73, 0.115, M.people, 12));
  group.add(cylZ(x, y, z + 1.73, z + 1.80, 0.125, M.safety, 12));
}

// ---------------------------------------------------- one builder per station
// Keyed on the label plan.py already carries, because two stations can share a
// code. Anything without a builder falls back to massing at its height.
//
// The match is case- and space-insensitive. It used to be exact, and restyling
// the drawing sheets to sentence case on 19 August 2026 detached most of these
// builders at once: every miss fell through to the massing box and the viewer
// quietly lost its machines. buildFactory() now warns if a builder here matches
// no station, which is the only symptom that failure has.
const key = (s) => String(s).split(/\s+/).filter(Boolean).join(' ').toLowerCase();

// Stations whose equipment is longer than it is deep but whose footprint in the
// straight-through layout is deeper than it is long: build them in a landscape
// frame and turn the result a quarter turn, exactly as make_fab0.py does.
const TURNED = new Set(['Gasket cell', 'Parts cleaning', 'Piping spool prefab',
  'Wall panel prefab', 'Sub-skid build and test'].map(key));

function turnedFrame(g, x0, y0, x1, y1) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const c = toWorld(cx, cy, 0);
  const pivot = new THREE.Group();
  pivot.position.copy(c);
  pivot.rotation.y = Math.PI / 2;
  const inner = new THREE.Group();
  inner.position.set(-c.x, -c.y, -c.z);
  pivot.add(inner);
  g.add(pivot);
  const long = y1 - y0;
  const short = x1 - x0;
  return [inner, cx - long / 2, cy - short / 2, cx + long / 2, cy + short / 2];
}

const BUILDERS_BY_LABEL = {
  'Goods in': (g, z, x0, y0, x1, y1) => {
    // the apron behind the dock doors: leveller aprons, the incoming inspection
    // bench, a surface plate, pallets waiting to be booked in, and a truck
    bench(g, z, x0 + 0.5, 14.4, x1 - 0.4, 17.0, 0.94);
    g.add(boxAt(x0 + 0.7, 15.0, x0 + 2.0, 16.4, 0.94, 1.04, acc(z)));
    cabinet(g, z, x1 - 0.9, 18.9, 0.8, 0.6, 1.6);
    for (const cy of [4.4, 7.4, 12.0, 21.6, 24.6, 27.6, 31.0]) {
      for (let k = 0; k < 2; k++) {
        const zz = k * 1.02;
        g.add(boxAt(x0 + 1.25, cy - 0.62, x0 + 2.55, cy + 0.62, zz, zz + 0.14, M.rack));
        g.add(boxAt(x0 + 1.3, cy - 0.6, x0 + 2.5, cy + 0.6, zz + 0.14, zz + 0.98,
          M.pallet));
      }
    }
    g.add(boxAt(x0 + 2.9, 9.6, x0 + 3.7, 11.4, 0.25, 1.35, M.machine));
    g.add(boxAt(x0 + 2.6, 9.9, x0 + 2.8, 11.1, 0, 2.9, acc(z)));
    for (const [sx, sy] of [[3.0, 9.8], [3.0, 11.2], [3.6, 9.9], [3.6, 11.1]]) {
      g.add(cylY(x0 + sx, sy, 0.22, 0.22, 0.18, M.machine));
    }
    for (const cy of [2.9, 18.9, 33.6]) bollard(g, x1 - 0.3, cy, 1.0);
  },

  'Warehouse — bulk racking': (g, z, x0, y0, x1, y1) => {
    // one block at the dock end, where four scattered stores used to be
    rackBlock(g, x0, y0, x1 - 5.0, y1, 4.0, 3, 1.1, 2.4);
    const bx = x1 - 4.2;
    for (let i = 0; i < 2; i++) tank(g, z, bx, y0 + 1.7 + i * 3.0, 0.85, 2.5);
    g.add(boxAt(bx + 1.4, y0 + 0.9, bx + 2.8, y0 + 3.1, 0, 2.2, M.machine));
    g.add(boxAt(bx + 1.3, y0 + 1.0, bx + 1.4, y0 + 3.0, 0.2, 2.0, acc(z)));
    for (let i = 0; i < 2; i++) {
      const cx = bx + 2.1;
      const cy = y1 - 1.9 - i * 3.0;
      g.add(boxAt(cx - 1.6, cy - 1.1, cx + 1.6, cy - 0.95, 0, 1.6, M.rack));
      g.add(boxAt(cx - 1.6, cy + 0.95, cx + 1.6, cy + 1.1, 0, 1.6, M.rack));
      g.add(boxAt(cx - 1.5, cy - 1.0, cx + 1.5, cy + 1.0, 0.30, 0.55, acc(z)));
    }
    for (let i = 0; i < 2; i++) {
      const cx = bx + 0.1 + i * 2.0;
      const cy = (y0 + y1) / 2 + 0.4;
      for (const sy of [-1, 1]) {
        g.add(boxAt(cx - 0.75, cy + sy * 0.62 - 0.09, cx + 0.75,
          cy + sy * 0.62 + 0.09, 0, 0.55, M.machine));
      }
      g.add(cylX(cx, cy, 1.10, 0.62, 0.88, acc(z), 16));
    }
  },

  'Light goods': (g, z, x0, y0, x1, y1) => {
    rackRun(g, x0 + 0.3, y0 + 0.3, x1 - 0.3, y0 + 1.4, 4.0, 4, 2.7, 4);
    rackRun(g, x0 + 0.3, y1 - 1.4, x1 - 0.3, y1 - 0.3, 4.0, 4, 2.7, 6);
    for (let i = 0; i < 3; i++) {
      g.add(cylX((x0 + x1) / 2, y0 + 4.4 + i * 2.2, 0.62, 0.52, 2.8, acc(z), 14));
      for (const sx of [-1.3, 1.3]) {
        g.add(boxAt((x0 + x1) / 2 + sx - 0.09, y0 + 3.6 + i * 2.2,
          (x0 + x1) / 2 + sx + 0.09, y0 + 5.2 + i * 2.2, 0, 0.62, M.rack));
      }
    }
  },

  'Blank': (g, z, x0, y0, x1, y1) => {
    // coil at the north end, straightener, blanking press on the aisle, cut
    // blanks stacked between: the station runs down the bay, not across it
    g.add(boxAt(x0 + 0.5, y1 - 2.6, x0 + 0.9, y1 - 0.7, 0, 1.5, M.machine));
    g.add(cylX(x0 + 1.7, y1 - 1.6, 1.15, 0.72, 0.84, acc(z), 16));
    g.add(cylX(x0 + 1.7, y1 - 1.6, 1.15, 0.20, 1.24, M.machine, 10));
    bench(g, z, x0 + 0.6, y1 - 4.5, x1 - 0.5, y1 - 3.4, 1.05);
    const sy = y1 - 6.2;
    for (let i = 0; i < 4; i++) {
      g.add(cylX((x0 + x1) / 2, sy + 0.35 + i * 0.42, 1.02, 0.13,
        x1 - x0 - 1.8, M.machine));
    }
    for (const sx of [x0 + 0.5, x1 - 0.7]) {
      g.add(boxAt(sx, sy, sx + 0.2, sy + 2.0, 0, 1.7, M.machine));
    }
    for (let i = 0; i < 2; i++) {
      const py = y0 + 5.6 + i * 1.9;
      g.add(boxAt(x0 + 0.8, py, x1 - 0.8, py + 1.2, 0, 0.14, M.rack));
      g.add(boxAt(x0 + 0.9, py + 0.1, x1 - 0.9, py + 1.1, 0.14, 0.66, acc(z)));
    }
    pressCFrame(g, z, (x0 + x1) / 2, y0 + 1.9, x1 - x0 - 1.0, 2.6, 2.0);
    cabinet(g, z, x1 - 0.7, y0 + 4.4, 0.8, 0.6, 1.9);
  },

  'Form + trim press': (g, z, x0, y0, x1, y1) => {
    const cy = (y0 + y1) / 2 + 0.4;
    pressFourPost(g, z, x0 + 4.4, cy, 5.4, 4.6, 4.2);
    for (let i = 0; i < 3; i++) {
      g.add(cylY(x0 + 0.5 + i * 0.55, cy, 1.05, 0.14, 3.0, M.machine));
    }
    g.add(boxAt(x0 + 0.2, cy - 1.4, x0 + 1.9, cy + 2.2, 0.72, 0.86, M.rack));
    g.add(boxAt(x0 + 7.2, y0 + 1.4, x1 - 0.3, y0 + 2.6, 0.80, 0.94, M.rack));
    g.add(boxAt(x1 - 1.6, y0 + 1.5, x1 - 0.6, y0 + 2.5, 0.94, 1.9, acc(z)));
    g.add(boxAt(x0 + 6.9, y1 - 2.0, x1 - 0.4, y1 - 0.4, 0, 1.1, M.machine));
    cabinet(g, z, x1 - 1.0, cy - 0.4, 1.0, 0.7, 2.1);
    cabinet(g, z, x1 - 1.0, cy + 0.8, 1.0, 0.7, 2.1);
    g.add(boxAt(x0 + 2.0, y0 + 0.4, x0 + 3.6, y0 + 1.6, 0, 1.05, M.machine));
    g.add(boxAt(x0 + 2.0, y0 + 0.4, x0 + 3.6, y0 + 1.6, 1.05, 2.0, M.mesh));
    // die storage: a die change is a twelve to twenty week event, so the spare
    // set lives beside the press it belongs to
    for (let i = 0; i < 2; i++) {
      const dx = x0 + 0.8 + i * 3.4;
      g.add(boxAt(dx, y1 - 3.0, dx + 3.0, y1 - 0.7, 0, 0.42, M.rack));
      g.add(boxAt(dx + 0.25, y1 - 2.7, dx + 2.75, y1 - 1.0, 0.42, 1.32, acc(z)));
    }
    for (let i = 0; i < 2; i++) {
      const py = y0 + 4.2 + i * 1.9;
      g.add(boxAt(x1 - 3.4, py, x1 - 0.5, py + 1.2, 0, 0.14, M.rack));
      g.add(boxAt(x1 - 3.3, py + 0.1, x1 - 0.6, py + 1.1, 0.14, 0.78, acc(z)));
    }
  },

  'Plate magazine': (g, z, x0, y0, x1, y1) => {
    rackBlock(g, x0, y0, x1, y1, 3.4, 3, 1.05, 2.0);
  },

  'WIP magazine': (g, z, x0, y0, x1, y1) => {
    rackBlock(g, x0, y0, x1, y1, 3.4, 3, 1.05, 2.0);
  },

  'Parts cleaning': (g, z, x0, y0, x1, y1) => {
    bathTank(g, z, x0 + 0.5, y0 + 2.6, x0 + 2.9, y1 - 0.7);
    bathTank(g, z, x0 + 3.2, y0 + 2.6, x0 + 5.6, y1 - 0.7);
    for (const zz of [0.55, 1.05, 1.55]) {
      g.add(boxAt(x1 - 1.6, y0 + 2.6, x1 - 0.4, y1 - 0.7, zz, zz + 0.06, M.rack));
    }
    for (const sx of [x1 - 1.58, x1 - 0.5]) {
      for (const sy of [y0 + 2.62, y1 - 0.8]) {
        g.add(boxAt(sx, sy, sx + 0.08, sy + 0.08, 0, 1.75, M.rack));
      }
    }
    g.add(boxAt(x0 + 0.4, y1 - 1.15, x1 - 0.3, y1 - 0.95, 2.30, 2.55, M.crane));
    for (const sx of [x0 + 0.4, x1 - 0.5]) {
      g.add(boxAt(sx, y1 - 1.18, sx + 0.14, y1 - 0.92, 0, 2.30, M.machine));
    }
    g.add(boxAt(x0 + 3.6, y1 - 1.28, x0 + 4.3, y1 - 0.82, 2.05, 2.32, M.machine));
    for (const [a, b, c, d] of [
      [x0 + 0.2, y0 + 2.3, x0 + 0.35, y1 - 0.4],
      [x0 + 5.9, y0 + 2.3, x0 + 6.05, y1 - 0.4],
      [x0 + 0.2, y0 + 2.3, x0 + 6.05, y0 + 2.45],
      [x0 + 0.2, y1 - 0.55, x0 + 6.05, y1 - 0.4]]) {
      g.add(boxAt(a, b, c, d, 0, 0.22, acc(z)));
    }
    tank(g, z, x0 + 1.1, y0 + 1.1, 0.55, 1.7);
    tank(g, z, x0 + 2.6, y0 + 1.1, 0.55, 1.7);
    cabinet(g, z, x1 - 0.8, y0 + 0.9, 0.9, 0.7, 1.9);
  },

  'Gasket cell': (g, z, x0, y0, x1, y1) => {
    g.add(boxAt(x0 + 0.7, y1 - 1.5, x0 + 0.9, y1 - 0.5, 0, 1.4, M.machine));
    g.add(cylX(x0 + 1.5, y1 - 1.0, 1.05, 0.62, 0.32, acc(z), 14));
    bench(g, z, x0 + 0.5, y0 + 2.4, x1 - 0.6, y0 + 3.6);
    g.add(boxAt(x0 + 2.2, y0 + 2.5, x0 + 3.0, y0 + 3.5, 0.92, 1.75, M.machine));
    pressCFrame(g, z, x0 + 1.6, y0 + 1.0, 1.5, 1.4, 1.85);
    bench(g, z, x0 + 3.4, y0 + 0.4, x1 - 0.5, y0 + 1.6);
    cabinet(g, z, x1 - 0.8, y1 - 1.0, 0.8, 0.6, 1.8);
  },

  'Membrane cut': (g, z, x0, y0, x1, y1) => {
    for (const sx of [x0 + 0.6, x0 + 2.4]) {
      g.add(boxAt(sx, y1 - 1.6, sx + 0.18, y1 - 0.5, 0, 1.35, M.machine));
    }
    g.add(cylX(x0 + 1.6, y1 - 1.05, 1.05, 0.40, 1.7, acc(z), 14));
    g.add(boxAt(x0 + 0.5, y0 + 1.0, x1 - 0.6, y0 + 3.2, 0, 0.88, M.machine));
    g.add(boxAt(x0 + 0.4, y0 + 0.9, x1 - 0.5, y0 + 3.3, 0.88, 0.98, M.machine));
    for (const sx of [x0 + 0.6, x1 - 0.85]) {
      g.add(boxAt(sx, y0 + 1.1, sx + 0.25, y0 + 3.0, 0.98, 1.9, M.machine));
    }
    g.add(boxAt(x0 + 0.6, y0 + 1.2, x1 - 0.6, y0 + 2.9, 1.55, 1.9, acc(z)));
    g.add(boxAt(x0 + 1.1, y0 + 1.4, x1 - 1.1, y0 + 2.7, 1.20, 1.55, M.machine));
    cabinet(g, z, x1 - 0.8, y0 + 4.6, 0.8, 0.6, 1.8);
  },

  'Foam cut': (g, z, x0, y0, x1, y1) => {
    const cy = (y0 + y1) / 2;
    g.add(boxAt(x0 + 0.5, y0 + 0.6, x0 + 2.6, y1 - 0.6, 0, 0.95, M.machine));
    g.add(boxAt(x0 + 0.4, y0 + 0.5, x0 + 2.7, y1 - 0.5, 0.95, 1.05, acc(z)));
    g.add(cylZ(x0 + 2.4, cy, 1.05, 1.70, 0.16, M.machine, 12));
    g.add(boxAt(x0 + 0.7, cy - 0.55, x0 + 2.5, cy + 0.55, 1.42, 1.70, M.machine));
    bench(g, z, x0 + 3.1, y0 + 0.6, x1 - 0.4, y1 - 0.6);
  },

  'Lay-up cell': (g, z, x0, y0, x1, y1) => {
    // the cell that used to be a jumble: fence on the perimeter with the gate
    // onto the aisle, robot west, build fixture east of it, magazine north
    fenceLine(g, x0, y0, x1, y0, 2.15, true);
    fenceLine(g, x1, y0, x1, y1, 2.15, false);
    fenceLine(g, x1, y1, x0, y1, 2.15, false);
    fenceLine(g, x0, y1, x0, y0, 2.15, false);
    robot(g, x0 + 2.2, (y0 + y1) / 2 - 0.6, -Math.PI / 2);
    const fx = x1 - 2.6;
    const fy = (y0 + y1) / 2 - 0.9;
    g.add(boxAt(fx - 1.35, fy - 0.95, fx + 1.35, fy + 0.95, 0, 0.62, M.machine));
    g.add(boxAt(fx - 1.15, fy - 0.75, fx + 1.15, fy + 0.75, 0.62, 0.78, acc(z)));
    for (const sx of [-1, 1]) {
      for (const sy of [-0.6, 0.6]) {
        g.add(cylZ(fx + sx, fy + sy, 0.78, 2.05, 0.045, M.machine, 8));
      }
    }
    g.add(boxAt(fx - 1.05, fy - 0.65, fx + 1.05, fy + 0.65, 0.78, 1.34, M.product));
    rackRun(g, x0 + 0.9, y1 - 1.5, x1 - 0.9, y1 - 0.5, 2.4, 2, 2.7, 5);
    cabinet(g, z, x0 + 0.8, y0 + 0.9, 0.9, 0.7, 2.0);
    bayMarking(g, fx - 1.7, fy - 1.3, fx + 1.7, fy + 1.3);
  },

  'Close, compress, torque, test': (g, z, x0, y0, x1, y1) => {
    const cy = (y0 + y1) / 2;
    pressFourPost(g, z, x0 + 2.5, cy, 4.2, 3.0, 3.4);
    stackBody(g, x0 + 2.5, cy, 0, 0.55, false);
    bench(g, z, x0 + 5.6, y0 + 0.5, x0 + 9.2, y1 - 0.5, 0.75);
    g.add(cylZ(x0 + 5.9, y1 - 0.9, 0, 2.6, 0.13, M.machine, 12));
    g.add(boxAt(x0 + 5.9, y1 - 1.0, x0 + 8.6, y1 - 0.8, 2.35, 2.55, M.machine));
    g.add(boxAt(x0 + 8.4, y1 - 1.0, x0 + 8.6, y1 - 0.8, 1.55, 2.35, M.machine));
    stackBody(g, x0 + 7.4, cy, 0);
    cabinet(g, z, x0 + 10.6, y0 + 1.0, 1.1, 0.8, 2.1);
    cabinet(g, z, x0 + 10.6, y1 - 1.0, 1.1, 0.8, 2.1);
    fenceLine(g, x0 - 0.1, y0 - 0.1, x0 + 5.1, y0 - 0.1, 2.0, false);
    fenceLine(g, x0 + 5.1, y0 - 0.1, x0 + 5.1, y1 + 0.1, 2.0, true);
    fenceLine(g, x0 + 5.1, y1 + 0.1, x0 - 0.1, y1 + 0.1, 2.0, false);
    // the east half of the run is the tested-stack buffer that feeds the
    // container bay directly opposite it, on stands rather than on racking
    for (let i = 0; i < 4; i++) stackBody(g, x0 + 13.2 + i * 1.8, cy, 0);
    bayMarking(g, x0 + 12.2, y0 + 0.4, x1 - 0.3, y1 - 0.4);
  },

  'Sub-skid build and test': (g, z, x0, y0, x1, y1) => {
    for (let i = 0; i < 3; i++) {
      const cy = y0 + 1.4 + i * 2.3;
      bench(g, z, x0 + 0.6, cy - 0.85, x0 + 7.0, cy + 0.85, 0.80, false);
      g.add(boxAt(x0 + 1.1, cy - 0.7, x0 + 6.4, cy + 0.7, 0.80, 0.95, M.machine));
      g.add(boxAt(x0 + 1.5, cy - 0.55, x0 + 4.2, cy + 0.55, 0.95, 1.55, acc(z)));
      g.add(cylZ(x0 + 5.2, cy, 0.95, 1.45, 0.28, M.machine, 12));
    }
    rackRun(g, x1 - 3.4, y0 + 0.4, x1 - 0.4, y1 - 0.4, 3.0, 3, 2.7, 7);
    cabinet(g, z, x1 - 4.4, y0 + 1.2, 1.2, 0.8, 2.1);
  },

  'Piping spool prefab': (g, z, x0, y0, x1, y1) => {
    for (let i = 0; i < 2; i++) {
      const cy = y0 + (i + 0.5) * (y1 - y0) / 2;
      for (let k = 0; k < 5; k++) {
        const sx = x0 + 0.8 + k * 1.45;
        g.add(boxAt(sx, cy - 0.55, sx + 0.10, cy + 0.55, 0, 0.85, M.rack));
      }
      g.add(boxAt(x0 + 0.6, cy - 0.62, x0 + 6.8, cy + 0.62, 0.85, 0.95, M.rack));
      // the spool: a run of socket-fused pipe with two branches
      g.add(cylX((x0 + 0.9 + x0 + 6.5) / 2, cy, 1.20, 0.11, 5.6, acc(z), 10));
      for (const k of [1, 3]) {
        const bx = x0 + 0.9 + k * 1.45;
        g.add(cylY(bx, cy + 0.22, 1.20, 0.07, 0.45, acc(z), 8));
        g.add(cylZ(bx, cy + 0.45, 1.20, 1.62, 0.07, acc(z), 8));
      }
      for (let k = 0; k < 6; k++) {
        const sx = x0 + 0.95 + k * 1.14;
        g.add(boxAt(sx, cy - 0.10, sx + 0.09, cy + 0.10, 0.95, 1.20, M.machine));
      }
    }
    bench(g, z, x1 - 3.6, y1 - 1.5, x1 - 0.5, y1 - 0.4, 0.90);
    g.add(boxAt(x1 - 2.6, y1 - 1.35, x1 - 1.7, y1 - 0.6, 0.90, 1.55, M.machine));
    for (const zz of [0.7, 1.35, 2.0]) {
      g.add(boxAt(x1 - 1.4, y0 + 0.4, x1 - 0.4, y0 + 3.0, zz, zz + 0.08, M.rack));
      for (let j = 0; j < 3; j++) {
        g.add(cylY(x1 - 1.15 + j * 0.32, y0 + 1.7, zz + 0.20, 0.13, 2.6, acc(z), 10));
      }
    }
    for (const sx of [x1 - 1.42, x1 - 0.52]) {
      g.add(boxAt(sx, y0 + 0.4, sx + 0.10, y0 + 0.5, 0, 2.3, M.rack));
      g.add(boxAt(sx, y0 + 2.9, sx + 0.10, y0 + 3.0, 0, 2.3, M.rack));
    }
  },

  'Wall panel prefab': (g, z, x0, y0, x1, y1) => {
    for (let i = 0; i < 2; i++) {
      const cy = y0 + (i + 0.5) * (y1 - y0) / 2;
      for (let k = 0; k < 4; k++) {
        const sx = x0 + 0.9 + k * 1.9;
        for (const [dy, tilt] of [[-0.35, 12], [0.35, -12]]) {
          const p = centredBox(0.14, 0.14, 2.6, sx, cy + dy, 0, M.rack);
          p.rotateX(Math.PI * tilt / 180);
          p.position.y = 1.3 * Math.cos(Math.PI * tilt / 180);
          g.add(p);
        }
      }
      g.add(boxAt(x0 + 0.7, cy - 0.55, x0 + 7.4, cy + 0.55, 0, 0.20, M.rack));
      for (const [dy, tilt] of [[-0.5, 12], [0.5, -12]]) {
        const p = centredBox(6.0, 0.12, 2.45, x0 + 4.0, cy + dy, 0.22, acc(z));
        p.rotateX(Math.PI * tilt / 180);
        g.add(p);
      }
    }
    bench(g, z, x1 - 4.2, y1 - 1.4, x1 - 0.5, y1 - 0.4);
    rackRun(g, x1 - 4.2, y0 + 0.5, x1 - 0.5, y0 + 1.5, 2.4, 2, 2.7, 3);
  },

  'BoP kitting': (g, z, x0, y0, x1, y1) => {
    bench(g, z, x0 + 0.5, y1 - 1.6, x1 - 0.5, y1 - 0.5);
    bench(g, z, x0 + 0.5, y0 + 0.5, x1 - 2.4, y0 + 1.6);
    rackRun(g, x0 + 0.5, y0 + 3.0, x1 - 0.5, y0 + 4.0, 2.6, 2, 2.7, 1);
    for (let i = 0; i < 3; i++) {
      const cx = x0 + 1.1 + i * 1.9;
      g.add(boxAt(cx - 0.6, y0 + 5.0, cx + 0.6, y0 + 6.0, 0.30, 0.42, M.rack));
      g.add(boxAt(cx - 0.55, y0 + 5.1, cx + 0.55, y0 + 5.9, 0.42, 1.0, acc(z)));
      for (const sx of [-0.5, 0.5]) {
        for (const sy of [5.15, 5.85]) {
          g.add(cylZ(cx + sx, y0 + sy, 0, 0.14, 0.07, M.machine, 8));
        }
      }
    }
  },

};

// Two lay-up cells, both built, so they share one builder. The base entry is
// removed once the two real labels point at it, or the orphan check below would
// report a station called 'Lay-up cell' that plan.py has never had.
BUILDERS_BY_LABEL['Lay-up cell 1'] = BUILDERS_BY_LABEL['Lay-up cell'];
BUILDERS_BY_LABEL['Lay-up cell 2'] = BUILDERS_BY_LABEL['Lay-up cell'];
delete BUILDERS_BY_LABEL['Lay-up cell'];

const BUILDERS = Object.fromEntries(
  Object.entries(BUILDERS_BY_LABEL).map(([k, v]) => [key(k), v]));

// -------------------------------------------------------------------- areas

function buildAreas(data, groups, registry) {
  const B = data.building;
  for (const [k, zn] of Object.entries(data.zones)) {
    M.zone[k] = mat(ZONE_ACCENT[k] ?? zn.colour, { roughness: 0.78 });
    M.ghost[k] = mat(zn.colour, { transparent: true, opacity: 0.16, roughness: 0.9 });
  }
  const stepCodes = new Set(data.steps.map((s) => s.code));

  for (const a of data.areas) {
    const [x0, y0, x1, y1] = a.box;
    const g = new THREE.Group();
    g.name = a.code || a.label;
    const phase2 = a.phase !== 1;

    if (phase2) {
      // reserved floor is empty floor, marked out so a reader can see that it is
      // bought and serviced rather than forgotten
      bayMarking(g, x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3);
      const ghost = boxAt(x0, y0, x1, y1, 0, Math.max(a.h, 1.0), M.ghost[a.zone]);
      ghost.castShadow = false;
      g.add(ghost);
    } else if (a.kind === 'pad') {
      // an outdoor hot-test pad: a slab, a supply pillar, and the unit under
      // test running on its own rectifier for three hours
      const slabM = boxAt(x0, y0, x1, y1, YARD_Z, 0.02, M.shell);
      g.add(slabM, outline(slabM, INK, 0.22));
      containerUnit(g, (x0 + x1) / 2, (y0 + y1) / 2, B.container, 0, false,
        M.product);
      g.add(boxAt(x1 + 0.4, (y0 + y1) / 2 + 2.4, x1 + 1.0, (y0 + y1) / 2 + 3.0,
        0, 2.2, M.machine));
      g.add(boxAt(x1 + 0.35, (y0 + y1) / 2 + 2.45, x1 + 0.45,
        (y0 + y1) / 2 + 2.95, 1.2, 2.05, M.zone.E));
      bayMarking(g, x0 + 1.9, (y0 + y1) / 2 - 2.0, x1 - 1.9, (y0 + y1) / 2 + 2.0);
    } else if (a.code === 'G1') {
      buildContainerBay(g, a, B);
    } else if (BUILDERS[key(a.label)] && TURNED.has(key(a.label))) {
      const [inner, lx0, ly0, lx1, ly1] = turnedFrame(g, x0, y0, x1, y1);
      BUILDERS[key(a.label)](inner, a.zone, lx0, ly0, lx1, ly1);
    } else if (BUILDERS[key(a.label)]) {
      BUILDERS[key(a.label)](g, a.zone, x0, y0, x1, y1);
    } else {
      g.add(boxAt(x0, y0, x1, y1, 0, 0.14, M.machine));
      const m = boxAt(x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 0.14, a.h,
        M.zone[a.zone]);
      g.add(m, outline(m, INK, 0.4));
    }

    // an invisible slab over the whole footprint, so a click anywhere on the
    // station picks it even where the massing is a fence or an open frame
    const hit = boxAt(x0, y0, x1, y1, 0, Math.max(a.h, 2.4),
      new THREE.MeshBasicMaterial({ visible: false }));
    hit.castShadow = false;
    hit.receiveShadow = false;
    hit.userData.code = a.code;
    hit.userData.pickable = stepCodes.has(a.code);
    g.add(hit);

    const target = groups[a.kind === 'pad' ? 'ground'
      : a.kind === 'store' ? 'stores' : 'stations'];
    target.add(g);
    if (a.code) {
      registry.set(a.code, {
        group: g, area: a, hit, phase2,
        mats: ownMaterials(g),
        centre: [(x0 + x1) / 2, (y0 + y1) / 2],
      });
    }
  }

  // All the racking belongs to a station now that the stores are one block, so
  // the rooms contribute only a floor tint.
  for (const r of data.rooms) {
    const [x0, y0, x1, y1] = r.box;
    // floor tint per zone room, so the plan legend still reads on the model
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, y1 - y0),
      mat(data.zones[r.zone].colour, {
        transparent: true, opacity: 0.14, side: THREE.DoubleSide, roughness: 1,
      }));
    p.rotation.x = -Math.PI / 2;
    p.position.copy(toWorld((x0 + x1) / 2, (y0 + y1) / 2, 0.012));
    groups.floor.add(p);
  }

  buildMarkings(data, groups.floor);

  for (const [i, [x, y]] of data.crew.entries()) {
    person(groups.people, x, y, (i % 5) * 0.63);
  }
  person(groups.people, -1.6, data.building.dock.trucks[0], 1.2, LANE_Z + 1.15);
}

function buildContainerBay(g, a, B) {
  // on the shutter centreline, so the unit is built pointing at the door it
  // leaves through. North of it is the staging strip the sub-skids and panels
  // wait on, which is the floor the second bay used to be reserved on.
  const [x0, y0, x1, y1] = a.box;
  const cx = (x0 + x1) / 2;
  const cy = 7.15;
  for (const sx of [-1, 1]) {
    g.add(boxAt(cx + sx * 2.4 - 0.35, cy - B.container[1] / 2 - 0.1,
      cx + sx * 2.4 + 0.35, cy + B.container[1] / 2 + 0.1, 0, 0.45, M.machine));
  }
  containerUnit(g, cx, cy, B.container, 0, true, M.product, 0.45);
  g.add(boxAt(cx - 2.6, cy - 1.0, cx - 0.4, cy + 1.0, 0.61, 1.35, M.zone.G));
  g.add(boxAt(x0 + 0.6, y0 + 0.5, x0 + 3.2, y0 + 2.1, 0, 0.55, M.machine));
  g.add(boxAt(x0 + 0.8, y0 + 0.65, x0 + 3.0, y0 + 1.95, 0.55, 1.25, M.zone.F));
  bayMarking(g, cx - 3.6, cy - 1.8, cx + 3.6, cy + 1.8);
  const ry = y1 - 1.6;
  for (let i = 0; i < 2; i++) {
    const sx = x0 + 2.4 + i * 6.4;
    g.add(boxAt(sx, ry - 0.55, sx + 6.2, ry + 0.55, 0, 0.20, M.rack));
    for (let k = 0; k < 4; k++) {
      const p = centredBox(0.14, 0.14, 2.4, sx + 0.8 + k * 1.8, ry - 0.35, 0, M.rack);
      p.rotateX(Math.PI * 11 / 180);
      g.add(p);
    }
    const pan = centredBox(5.8, 0.12, 2.3, sx + 3.1, ry - 0.5, 0.22, M.zone.F);
    pan.rotateX(Math.PI * 11 / 180);
    g.add(pan);
  }
  for (const sy of [y0 + 0.6, y1 - 0.6]) bollard(g, x0 + 0.6, sy, 0.95);
  // a run of mesh fence down the aisle side, because this is an open frame being
  // loaded from above by a 12.5 t crane and the aisle runs past it
  fenceLine(g, x0 - 0.2, y1 + 0.35, x1 + 0.2, y1 + 0.35, 2.15, true);
}

function buildMarkings(data, group) {
  // container out: bay G1 -> the east shutter -> the pad, one straight line that
  // does not cross the dock apron at any point
  const B = data.building;
  const pad = data.yard[0].box;
  const cy = (pad[1] + pad[3]) / 2;
  const xEnd = pad[2] - 1.0;
  for (const y of [cy - 2.8, cy + 2.8]) stripe(group, 55.0, y, xEnd, y, 0.18);
  for (const x of [55.0, B.length, pad[0], xEnd]) {
    stripe(group, x, cy - 2.8, x, cy + 2.8, 0.10);
  }
  for (const y of [B.aisleN - 1.3, B.aisleN + 1.3]) stripe(group, 5.4, y, 71.0, y);
  for (const y of [B.aisleS - 1.3, B.aisleS + 1.3]) stripe(group, 1.0, y, 71.0, y);
  for (const d of data.doors) {
    if (d.kind !== 'dock') continue;
    const n = Math.floor((d.b - d.a) / 0.55);
    for (let i = 0; i < n; i++) {
      const u = d.a + 0.2 + i * 0.55;
      const m = boxAt(0.55, u, 1.85, u + 0.22, 0, 0.02, M.safety);
      m.castShadow = false;
      group.add(m);
    }
  }
}

// --------------------------------------------------------- services and yard

function buildServices(data, groups) {
  const B = data.building;
  // (x from, x to, y, radius, local-exhaust drops, supply diffusers)
  // the two hoods are the press and the solvent room, and both moved west when
  // the layout straightened out
  const trunks = [
    [10.0, 70.0, 29.4, 0.42, [20.2, 42.0], [50.0, 58.0, 66.0]],
    [18.0, 70.0, 12.0, 0.36, [], [22.0, 33.0, 44.0, 56.0, 66.0]],
  ];
  for (const [xa, xb, y, r, hoods, diffusers] of trunks) {
    groups.services.add(cylX((xa + xb) / 2, y, DUCT_Z, r, xb - xa, M.duct, 16));
    groups.services.add(cylZ(xb, y, DUCT_Z, DUCT_Z + 1.1, r, M.duct, 16));
    for (const dx of hoods) {
      const low = Math.abs(dx - 42.0) < 0.5 ? 3.9 : 5.0;
      groups.services.add(cylZ(dx, y, low, DUCT_Z, r * 0.62, M.duct, 12));
      const hood = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.62, 0.88, 0.55, 4), M.duct);
      hood.position.copy(toWorld(dx, y, low - 0.275));
      hood.rotation.y = Math.PI / 4;
      groups.services.add(hood);
    }
    for (const dx of diffusers) {
      groups.services.add(cylZ(dx, y, DUCT_Z - 1.15, DUCT_Z, r * 0.5, M.duct, 12));
      groups.services.add(cylZ(dx, y, DUCT_Z - 1.28, DUCT_Z - 1.15, r * 1.05,
        M.duct, 14));
    }
    groups.services.add(boxAt(xb - 0.9, y - 0.9, xb + 0.9, y + 0.9, DUCT_Z + 1.1,
      DUCT_Z + 2.0, M.machine));
  }

  // a line of suspended linear luminaires per aisle, as in the reference; six
  // rows on a 36 m width, one over each half of the central spine
  for (const y of [4.6, 11.8, 16.2, 21.6, 26.4, 32.4]) {
    const n = Math.floor((B.length - 6.0) / 4.5);
    for (let i = 0; i <= n; i++) {
      const x = 3.0 + i * (B.length - 6.0) / n;
      groups.services.add(boxAt(x - 0.78, y - 0.09, x + 0.78, y + 0.09, LIGHT_Z,
        LIGHT_Z + 0.10, M.light));
      groups.services.add(boxAt(x - 0.80, y - 0.11, x + 0.80, y + 0.11,
        LIGHT_Z + 0.10, LIGHT_Z + 0.17, M.roof));
      for (const sx of [-0.6, 0.6]) {
        groups.services.add(boxAt(x + sx - 0.025, y - 0.025, x + sx + 0.025,
          y + 0.025, LIGHT_Z + 0.17, B.eaves - 0.2, M.roof));
      }
    }
  }
}

function buildYard(data, groups) {
  const [lx0, ly0, lx1, ly1] = data.building.dock.lane;
  const zf = data.building.dock.floor;
  groups.shell.add(boxAt(lx0, ly0, lx1, ly1, zf - 0.07, zf, M.floor));
  for (const y of [ly0, ly1 - 0.25]) {
    groups.shell.add(boxAt(lx0 - 0.3, y, lx1, y + 0.25, zf - 0.07, YARD_Z, M.shell));
  }
  groups.shell.add(boxAt(lx0 - 0.3, ly0, lx0, ly1, zf - 0.07, YARD_Z, M.shell));
  // the dock face: the slab edge a trailer backs onto
  groups.shell.add(boxAt(lx1, ly0, lx1 + 0.45, ly1, zf - 0.07, 0, M.shell));
  stripe(groups.floor, 0.0, ly0 + 0.3, 0.0, ly1 - 0.3, 0.18);
  for (const cy of data.building.dock.trucks) truck(groups.product, -0.7, cy, zf);
}

// A tractor and semi-trailer backed onto the dock, for scale.
function truck(group, rearX, cy, zf) {
  const deck = zf + 1.15;
  const tl = 12.4;
  group.add(boxAt(rearX - tl, cy - 1.28, rearX, cy + 1.28, deck, deck + 2.72,
    M.truck));
  group.add(boxAt(rearX - tl, cy - 1.12, rearX, cy + 1.12, deck - 0.32, deck,
    M.product));
  group.add(boxAt(rearX - 0.06, cy - 1.24, rearX + 0.04, cy + 1.24, deck,
    deck + 2.68, M.product));
  for (const dx of [1.7, 3.05, 4.4]) {
    for (const sy of [-1.12, 1.12]) {
      group.add(cylY(rearX - dx, cy + sy, zf + 0.52, 0.52, 0.38, M.product));
    }
  }
  for (const sy of [-0.95, 0.95]) {
    group.add(boxAt(rearX - 9.4, cy + sy - 0.09, rearX - 9.2, cy + sy + 0.09, zf,
      deck - 0.32, M.machine));
  }
  const nose = rearX - 18.4;
  group.add(boxAt(nose + 0.4, cy - 1.05, rearX - tl + 1.1, cy + 1.05, zf + 0.78,
    zf + 1.02, M.product));
  group.add(boxAt(nose + 0.2, cy - 1.26, nose + 2.9, cy + 1.26, zf + 1.02,
    zf + 3.55, M.truck));
  group.add(boxAt(nose + 0.14, cy - 1.15, nose + 0.24, cy + 1.15, zf + 2.35,
    zf + 3.35, M.machine));
  group.add(boxAt(nose + 0.3, cy - 1.20, nose + 2.6, cy + 1.20, zf + 3.55,
    zf + 3.95, M.truck));
  for (const dx of [1.5, 5.0, 6.35]) {
    for (const sy of [-1.08, 1.08]) {
      group.add(cylY(nose + dx, cy + sy, zf + 0.55, 0.55, 0.40, M.product));
    }
  }
}

function buildCranes(data, groups) {
  // parked where they do not sit on a station
  const park = { 'CRANE 1': [0.85, 7.15, 4.4], 'CRANE 2': [0.42, 29.4, 6.5] };
  for (const c of data.cranes) {
    const [x0, x1] = c.x;
    const [y0, y1] = c.y;
    const rail = c.hook + 1.35;
    const [frac, cy, hook] = park[c.name] || [0.36, (y0 + y1) / 2, c.hook];
    for (const y of [y0, y1]) {
      groups.crane.add(boxAt(x0, y - 0.12, x1, y + 0.12, rail, rail + 0.5, M.crane));
      // the runway needs holding up, and saying so justifies the eaves
      for (let bx2 = x0; bx2 <= x1; bx2 += data.building.colPitch) {
        groups.crane.add(boxAt(bx2 - 0.14, y - 0.30, bx2 + 0.14, y + 0.30,
          rail - 0.45, rail, M.crane));
      }
    }
    const bx = x0 + (x1 - x0) * frac;
    groups.crane.add(
      boxAt(bx - 0.45, y0, bx + 0.45, y1, rail + 0.5, rail + 1.25, M.crane),
      boxAt(bx - 0.6, cy - 0.55, bx + 0.6, cy + 0.55, rail + 0.05, rail + 0.5,
        M.crane),
      boxAt(bx - 0.05, cy - 0.05, bx + 0.05, cy + 0.05, hook + 0.4, rail, M.crane),
      boxAt(bx - 0.28, cy - 0.22, bx + 0.28, cy + 0.22, hook, hook + 0.4, M.crane));
    if (c.name === 'Crane 1') {
      // a stack on slings, going into the open frame below it
      for (const sx of [-0.55, 0.55]) {
        groups.crane.add(boxAt(bx + sx - 0.03, cy - 0.03, bx + sx + 0.03,
          cy + 0.03, hook - 1.05, hook, M.crane));
      }
      stackBody(groups.product, bx, cy, 0, hook - 1.65, false);
    }
  }
}

// ----------------------------------------------------------------- stations

// Zone materials are shared, so a station that wants to fade on its own needs
// its own copies. Returns them with their base opacity recorded, which is what
// the viewer restores to when it stops focusing on one station.
function ownMaterials(group) {
  const seen = new Map();
  group.traverse((o) => {
    const m = o.material;
    if (!m || m.visible === false) return;
    let c = seen.get(m);
    if (!c) { c = m.clone(); seen.set(m, c); }
    o.material = c;
  });
  return [...seen.values()].map((m) => ({
    m, opacity: m.opacity, transparent: m.transparent,
  }));
}

// --------------------------------------------------------------------- flow

function buildFlow(data, registry, groups) {
  const lines = new Map();
  const boxOf = (code) => registry.get(code).area.box;
  // plan.py overrides the x of a vertical leg where the material leaves or
  // enters through a door rather than through the middle of a face
  const via = new Map(data.routes.map((r) => [`${r.from}>${r.to}`, r]));

  for (const s of data.steps) {
    for (const to of s.to) {
      if (!registry.has(to)) continue;
      const [ax0, ay0, ax1, ay1] = boxOf(s.code);
      const [bx0, by0, bx1, by1] = boxOf(to);
      const route = via.get(`${s.code}>${to}`);
      const acx = route?.exitX ?? (ax0 + ax1) / 2;
      const acy = (ay0 + ay1) / 2;
      const bcx = route?.entryX ?? (bx0 + bx1) / 2;
      const bcy = (by0 + by1) / 2;

      // short hops within a zone go straight; longer moves use an aisle
      const sameBay = (acy > data.building.baySplit) === (bcy > data.building.baySplit);
      const near = Math.abs(acx - bcx) < 16 && Math.abs(acy - bcy) < 8;
      let pts;
      if (sameBay && near) {
        pts = [[acx, acy], [bcx, bcy]];
      } else {
        const ch = acy > data.building.baySplit && bcy > data.building.baySplit
          ? data.building.aisleN
          : (acy < data.building.baySplit && bcy < data.building.baySplit
            ? data.building.aisleS
            : (acy > data.building.baySplit ? data.building.aisleN : data.building.aisleS));
        pts = [[acx, acy], [acx, ch], [bcx, ch], [bcx, bcy]];
      }
      const v = pts.map(([x, y]) => toWorld(x, y, 0.9));
      const geo = new THREE.BufferGeometry().setFromPoints(v);
      const line = new THREE.Line(geo, new THREE.LineDashedMaterial({
        color: COPPER, dashSize: 0.7, gapSize: 0.45,
        transparent: true, opacity: 0.0, depthTest: false,
      }));
      line.computeLineDistances();
      line.renderOrder = 5;
      groups.flow.add(line);

      const head = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 1.1, 12),
        new THREE.MeshBasicMaterial({
          color: COPPER, transparent: true, opacity: 0, depthTest: false,
        }));
      const a = v[v.length - 2], b = v[v.length - 1];
      head.position.copy(b);
      head.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      head.renderOrder = 5;
      groups.flow.add(head);

      lines.set(`${s.code}>${to}`, { line, head, pts: v, walk: walker(v) });
    }
  }
  return lines;
}

// A position along a polyline at 0..1, so a dot can be sent down the route to
// show which way the material actually goes.
function walker(pts) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].distanceTo(pts[i - 1]);
    seg.push(d);
    total += d;
  }
  return (t) => {
    let d = Math.max(0, Math.min(1, t)) * total;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        return pts[i].clone().lerp(pts[i + 1], seg[i] ? d / seg[i] : 0);
      }
      d -= seg[i];
    }
    return pts[pts.length - 1].clone();
  };
}

// -------------------------------------------------------------------- build

export function buildFactory(data) {
  M = materials();
  const root = new THREE.Group();
  const groups = {};
  for (const k of ['ground', 'floor', 'shell', 'frame', 'roof', 'cap', 'cladding',
    'services', 'stores', 'stations', 'crane', 'people', 'product', 'flow']) {
    groups[k] = new THREE.Group();
    groups[k].name = k;
    root.add(groups[k]);
  }

  const registry = new Map();
  buildShell(data, groups);
  buildDoors(data, groups);
  buildAreas(data, groups, registry);
  buildYard(data, groups);
  buildServices(data, groups);
  buildCranes(data, groups);
  const flowLines = buildFlow(data, registry, groups);

  const pickable = [];
  root.traverse((o) => { if (o.userData.pickable) pickable.push(o); });

  // A builder that matches no station is how the machines disappear: the lookup
  // misses, the station falls through to a massing box, and nothing throws.
  const labels = new Set(data.areas.map((a) => key(a.label)));
  const orphans = Object.keys(BUILDERS).filter((k) => !labels.has(k));
  if (orphans.length) {
    console.warn(`scene.js: no station matches ${orphans.join(', ')} — `
      + 'those stations are being drawn as plain boxes. A label was renamed in '
      + 'plan.py without renaming the key here.');
  }

  return { root, groups, registry, flowLines, pickable, orphans };
}
