// 3D skeleton for the body chart (three.js), built bone by bone from primitives: no model file.
// Units are metres, y is up, the patient faces +z, and the patient's RIGHT is -x
// (so in the front view it is on the viewer's left). Each mesh carries the id of its bone
// (see bodyParts.js), so a click names the exact bone, e.g. "T3 thoracic vertebra".
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BONE, BONE_TYPES, REGIONS, boneName, inRegion, parseKey } from './bodyParts';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const TARGET = V(0, 0.9, 0);
const DIST = 4.1;
const C = (hex) => new THREE.Color(hex);

// Male / female proportions. Female: shorter, wider and shallower pelvis with a wider pubic arch,
// wider sacrum, narrower shoulders and rib cage, smaller skull, no brow ridge, smaller jaw and mastoids.
const SEX = {
  Male: { height: 1, shoulder: 1, rib: 1, hip: 1, pelvisH: 1, skull: 1, jaw: 1.06, brow: true, sacrum: 1, pubic: 1, mastoid: 1.35 },
  Female: { height: 0.93, shoulder: 0.92, rib: 0.93, hip: 1.13, pelvisH: 0.88, skull: 0.95, jaw: 0.93, brow: false, sacrum: 1.2, pubic: 1.5, mastoid: 1 },
};

const BASE = { bone: C('#e2d3b1'), cart: C('#b9cbd9'), dark: C('#241d16') };
const STATE = { hover: C('#7ee0d0'), noted: C('#8fb0ff'), active: C('#4f7cff') };
const EMI = { hover: 0x0b4f48, noted: 0x0f1f55, active: 0x14286e };
const XRAY = C('#cfe2ff');
const WHITE = C('#ffffff');
const REGION_COL = Object.fromEntries(REGIONS.map((r) => [r.id, C(r.color)]));
const TYPE_COL = Object.fromEntries(Object.entries(BONE_TYPES).map(([k, t]) => [k, C(t.color)]));

/* ---------- skeleton geometry ---------- */
function buildSkeleton(sex) {
  const P = SEX[sex] || SEX.Male;
  const root = new THREE.Group();
  const parts = {}; // id -> { mats: { bone|cart|dark: material }, meshes: [] }
  const entry = (id) => parts[id] || (parts[id] = { mats: {}, meshes: [] });
  const mat = (id, kind) => {
    const e = entry(id);
    if (!e.mats[kind]) {
      e.mats[kind] = new THREE.MeshPhysicalMaterial({
        color: BASE[kind].clone(), roughness: kind === 'dark' ? 0.9 : 0.5, metalness: 0,
        clearcoat: kind === 'dark' ? 0 : 0.2, clearcoatRoughness: 0.5, sheen: kind === 'bone' ? 0.25 : 0, sheenColor: C('#fff6e0'),
      });
    }
    return e.mats[kind];
  };
  const add = (id, geo, { pos, rot, scale, kind = 'bone' } = {}) => {
    const m = new THREE.Mesh(geo, mat(id, kind));
    if (pos) m.position.copy(pos);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = true;
    m.userData.part = id;
    entry(id).meshes.push(m);
    root.add(m);
    return m;
  };
  const sphere = (id, c, r, o = {}) => add(id, new THREE.SphereGeometry(r, 24, 16), { pos: c, ...o });
  const capsule = (id, a, b, r, o = {}) => {
    const m = add(id, new THREE.CapsuleGeometry(r, Math.max(a.distanceTo(b), 0.0001), 6, 16), { pos: a.clone().lerp(b, 0.5), ...o });
    m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    return m;
  };
  const longBone = (id, a, b, r, endA = 1.45, endB = 1.45) => {
    capsule(id, a, b, r);
    if (endA) sphere(id, a, r * endA);
    if (endB) sphere(id, b, r * endB);
  };
  const tube = (id, pts, r, o = {}) => add(id, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 10, false), o);
  const rbox = (id, size, c, o = {}) => add(id, new RoundedBoxGeometry(size[0], size[1], size[2], 3, Math.min(...size) * 0.45), { pos: c, ...o });
  // Move a set of bones into a group scaled about a pivot (used for the male / female proportions).
  const regroup = (ids, pivot, s) => {
    const g = new THREE.Group();
    g.position.copy(pivot);
    g.scale.set(s[0], s[1], s[2]);
    root.add(g);
    for (const id of ids) for (const m of parts[id]?.meshes || []) { m.parent.remove(m); m.position.sub(pivot); g.add(m); }
  };

  /* ---- skull ---- */
  sphere('cranium', V(0, 1.675, -0.005), 0.1, { scale: [0.9, 1, 1.1] });
  for (const s of [-1, 1]) sphere('cranium', V(s * 0.06, 1.598, -0.022), 0.011 * P.mastoid);
  if (P.brow) tube('cranium', [V(-0.054, 1.687, 0.072), V(-0.02, 1.693, 0.088), V(0.02, 1.693, 0.088), V(0.054, 1.687, 0.072)], 0.009);
  rbox('face', [0.11, 0.07, 0.08], V(0, 1.605, 0.045));
  for (const s of [-1, 1]) {
    sphere('face', V(s * 0.052, 1.625, 0.058), 0.022);
    sphere('face', V(s * 0.034, 1.655, 0.08), 0.024, { kind: 'dark' });
  }
  rbox('face', [0.058, 0.016, 0.026], V(0, 1.583, 0.079));
  add('face', new THREE.ConeGeometry(0.012, 0.03, 12), { pos: V(0, 1.618, 0.095), kind: 'dark' });
  tube('mandible', [V(-0.056, 1.628, -0.004), V(-0.052 * P.jaw, 1.566, 0.03), V(0, 1.548, 0.083), V(0.052 * P.jaw, 1.566, 0.03), V(0.056, 1.628, -0.004)], 0.013);
  rbox('mandible', [0.054, 0.014, 0.024], V(0, 1.567, 0.077));
  if (P.brow) rbox('mandible', [0.036, 0.02, 0.016], V(0, 1.548, 0.084));
  else sphere('mandible', V(0, 1.547, 0.086), 0.011);
  regroup(['cranium', 'face', 'mandible'], V(0, 1.56, 0), [P.skull, P.skull, P.skull]);

  /* ---- spine: body, neural arch, spinous and transverse processes; natural S-curve ---- */
  const vertebra = (id, y, r, h, z, sp, tilt) => {
    add(id, new THREE.CylinderGeometry(r, r * 1.04, h, 20), { pos: V(0, y, z) });
    add(id, new THREE.TorusGeometry(r * 0.62, r * 0.17, 8, 18, Math.PI), { pos: V(0, y, z - r * 0.85), rot: [-Math.PI / 2, 0, 0] });
    rbox(id, [r * 0.42, h * 0.75, sp], V(0, y - sp * 0.45 * Math.sin(tilt), z - r * 1.45 - sp * 0.45), { rot: [-tilt, 0, 0] });
    for (const s of [-1, 1]) capsule(id, V(s * r * 0.55, y, z - r * 0.9), V(s * r * 1.85, y + h * 0.15, z - r * 1.15), Math.max(h * 0.2, 0.0035));
  };
  for (let i = 0; i < 7; i++) vertebra(`c${i + 1}`, 1.555 - i * 0.0145, 0.016, 0.0105, -0.018 + 0.008 * Math.sin((Math.PI * i) / 6), 0.022, 0.25);
  for (let i = 0; i < 12; i++) vertebra(`t${i + 1}`, 1.445 - i * 0.0235, 0.018 + (0.0045 * i) / 11, 0.017, -0.036 - 0.014 * Math.sin((Math.PI * i) / 11), 0.04, 0.6);
  for (let i = 0; i < 5; i++) vertebra(`l${i + 1}`, 1.158 - i * 0.037, 0.027, 0.028, -0.026 + 0.012 * Math.sin((Math.PI * i) / 4), 0.034, 0.12);

  // Pelvis-height and hip-width helpers (female pelvis is wider and shallower).
  const px = (x) => x * P.hip;
  const py = (y) => 0.95 + (y - 0.95) * P.pelvisH;
  add('sacrum', new THREE.ConeGeometry(0.052, 0.13, 20), { pos: V(0, py(0.935), -0.05), rot: [Math.PI + 0.35, 0, 0], scale: [P.sacrum, P.pelvisH, 0.5] });
  for (let i = 0; i < 3; i++) sphere('coccyx', V(0, py(0.862) - i * 0.011, -0.03 + i * 0.006), 0.009 - i * 0.002);

  /* ---- sternum and ribs (cartilage in blue-grey) ---- */
  rbox('sternum', [0.05, 0.05, 0.015], V(0, 1.4, 0.098), { rot: [-0.15, 0, 0] });
  rbox('sternum', [0.034, 0.125, 0.013], V(0, 1.31, 0.107), { rot: [-0.15, 0, 0] });
  add('sternum', new THREE.ConeGeometry(0.011, 0.035, 10), { pos: V(0, 1.232, 0.112), rot: [Math.PI, 0, 0] });
  const ribIds = ['sternum'];
  for (const s of [-1, 1]) {
    const sd = s < 0 ? 'r' : 'l';
    for (let i = 0; i < 12; i++) {
      const id = `rib${i + 1}-${sd}`;
      ribIds.push(id);
      const y = 1.43 - i * 0.022;
      const w = 0.06 + 0.078 * Math.sin((Math.PI * (i + 1)) / 13);
      const p3 = V(s * w * 0.86, y - 0.05, 0.06);
      if (i < 10) {
        tube(id, [V(s * 0.022, y, -0.047), V(s * w * 0.7, y - 0.004, -0.074), V(s * w, y - 0.022, -0.012), p3], 0.0062);
        const end = i < 7 ? V(s * 0.03, y - 0.075 - i * 0.004, 0.1) : V(s * (0.07 + 0.008 * (i - 7)), y - 0.075, 0.088);
        tube(id, [p3, p3.clone().lerp(end, 0.5).add(V(0, -0.006, 0.012)), end], 0.0055, { kind: 'cart' });
      } else {
        tube(id, [V(s * 0.022, y, -0.047), V(s * w * 0.7, y - 0.004, -0.074), V(s * w, y - 0.022, -0.012), V(s * w * 0.95, y - 0.045, 0.03)], 0.006);
      }
    }
  }
  regroup(ribIds, V(0, 1.3, 0), [P.rib, 1, P.rib]);

  const armIds = [];
  for (const s of [-1, 1]) {
    const sd = s < 0 ? 'r' : 'l';
    const id = (k) => `${k}-${sd}`;
    armIds.push(...['clavicle', 'scapula', 'shoulder', 'humerus', 'elbow', 'radius', 'ulna', 'carpals', 'metacarpals', 'fingers'].map(id));

    /* ---- shoulder girdle and arm, hanging at the side, palm forward ---- */
    tube(id('clavicle'), [V(s * 0.024, 1.428, 0.098), V(s * 0.08, 1.442, 0.086), V(s * 0.14, 1.447, 0.04), V(s * 0.178, 1.452, 0.0)], 0.0085);
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(s * 0.085, 0.004); sh.lineTo(s * 0.092, -0.035); sh.lineTo(s * 0.03, -0.15); sh.lineTo(s * 0.005, -0.14); sh.closePath();
    const scap = add(id('scapula'), new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 2 }),
      { pos: V(s * 0.05, 1.432, -0.1), rot: [0.08, -s * 0.4, 0] });
    scap.material.side = THREE.DoubleSide;
    tube(id('scapula'), [V(s * 0.06, 1.41, -0.112), V(s * 0.12, 1.428, -0.09), V(s * 0.172, 1.452, -0.03)], 0.006);
    capsule(id('scapula'), V(s * 0.15, 1.418, -0.035), V(s * 0.158, 1.41, 0.025), 0.006);
    sphere(id('shoulder'), V(s * 0.185, 1.415, -0.005), 0.032);
    capsule(id('humerus'), V(s * 0.196, 1.385, -0.012), V(s * 0.226, 1.13, -0.02), 0.0155);
    sphere(id('humerus'), V(s * 0.205, 1.398, 0.008), 0.016);
    sphere(id('elbow'), V(s * 0.229, 1.106, -0.018), 0.021, { scale: [1.45, 0.8, 1] });
    sphere(id('ulna'), V(s * 0.226, 1.098, -0.04), 0.013);
    longBone(id('ulna'), V(s * 0.214, 1.085, -0.03), V(s * 0.249, 0.862, 0.0), 0.0092, 1.5, 1.2);
    longBone(id('radius'), V(s * 0.245, 1.085, -0.004), V(s * 0.27, 0.862, 0.02), 0.0102, 1.2, 1.5);

    /* ---- hand: carpals, metacarpals, phalanges ---- */
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) rbox(id('carpals'), [0.011, 0.011, 0.012], V(s * (0.247 + col * 0.0118), 0.847 - row * 0.0125, 0.014 + row * 0.002));
    }
    for (let k = 0; k < 4; k++) {
      const x = s * (0.282 - k * 0.0155);
      const tip = [0.072, 0.082, 0.077, 0.062][k];
      const base = V(x + s * 0.002 * (1.5 - k), 0.77, 0.02);
      longBone(id('metacarpals'), V(x, 0.828, 0.016), base, 0.0052, 1.3, 1.35);
      let prev = base.clone().add(V(0, -0.008, 0));
      for (const f of [0.45, 0.32, 0.23]) {
        const next = prev.clone().add(V(s * 0.0006 * (1.5 - k), -tip * f, 0.002));
        longBone(id('fingers'), prev, next, 0.0042 * (f > 0.3 ? 1 : 0.85), 1.2, 1.15);
        prev = next.clone().add(V(0, -0.003, 0));
      }
    }
    longBone(id('metacarpals'), V(s * 0.286, 0.836, 0.022), V(s * 0.31, 0.795, 0.032), 0.0058, 1.3, 1.3);
    longBone(id('fingers'), V(s * 0.312, 0.789, 0.034), V(s * 0.318, 0.765, 0.038), 0.0052, 1.15, 1.15);
    longBone(id('fingers'), V(s * 0.319, 0.761, 0.039), V(s * 0.322, 0.745, 0.041), 0.0045, 1.1, 1.05);

    /* ---- pelvis (hip bone) and hip joint ---- */
    sphere(id('hipbone'), V(s * px(0.09), py(0.995), -0.005), 0.078, { scale: [1, 0.82 * P.pelvisH, 0.2], rot: [0.1, s * 0.95, -s * (0.32 + (P.hip - 1) * 1.2)] });
    tube(id('hipbone'), [V(s * px(0.03), py(1.035), -0.06), V(s * px(0.095), py(1.072), -0.04), V(s * px(0.145), py(1.045), 0.02), V(s * px(0.135), py(0.99), 0.055)], 0.0085);
    tube(id('hipbone'), [V(s * px(0.09), py(0.93), 0.01), V(s * px(0.085), py(0.885), 0.035), V(s * px(0.05), py(0.862), 0.062), V(s * 0.012, py(0.872), 0.07)], 0.012);
    tube(id('hipbone'), [V(s * 0.012, py(0.858), 0.064), V(s * 0.04 * P.pubic, py(0.83), 0.04), V(s * px(0.075), py(0.833), 0.0), V(s * px(0.092), py(0.872), -0.012)], 0.011);
    sphere(id('hipbone'), V(s * px(0.075), py(0.83), -0.008), 0.016);
    const H = V(s * px(0.095), py(0.905), 0.016);
    sphere(id('hip'), H, 0.027);
    add(id('hip'), new THREE.TorusGeometry(0.03, 0.006, 8, 22), { pos: H.clone().add(V(-s * 0.006, 0, 0)), rot: [0, Math.PI / 2, 0] });

    /* ---- leg ---- */
    capsule(id('femur'), H, V(s * px(0.132), py(0.884), 0.0), 0.014);
    sphere(id('femur'), V(s * px(0.14), py(0.893), -0.006), 0.02);
    sphere(id('femur'), V(s * px(0.112), py(0.85), -0.018), 0.011);
    capsule(id('femur'), V(s * px(0.13), py(0.875), 0.0), V(s * 0.1, 0.53, -0.002), 0.0165);
    sphere(id('knee'), V(s * 0.083, 0.505, -0.006), 0.024);
    sphere(id('knee'), V(s * 0.117, 0.505, -0.006), 0.024);
    rbox(id('knee'), [0.072, 0.02, 0.056], V(s * 0.1, 0.474, 0.0));
    add(id('knee'), new THREE.TorusGeometry(0.024, 0.004, 8, 24), { pos: V(s * 0.1, 0.486, 0), rot: [Math.PI / 2, 0, 0], kind: 'cart' });
    sphere(id('patella'), V(s * 0.1, 0.505, 0.036), 0.022, { scale: [1, 1.15, 0.45] });
    longBone(id('tibia'), V(s * 0.1, 0.458, 0.005), V(s * 0.095, 0.11, 0.0), 0.0158, 0, 1.2);
    longBone(id('fibula'), V(s * 0.128, 0.448, -0.012), V(s * 0.122, 0.1, -0.01), 0.0072, 1.5, 1.2);
    sphere(id('ankle'), V(s * 0.08, 0.085, 0.0), 0.013);
    sphere(id('ankle'), V(s * 0.126, 0.08, -0.008), 0.012);

    /* ---- foot: tarsals, metatarsals, toes ---- */
    sphere(id('tarsals'), V(s * 0.1, 0.068, 0.006), 0.022);
    capsule(id('tarsals'), V(s * 0.1, 0.035, -0.045), V(s * 0.1, 0.048, 0.02), 0.021);
    rbox(id('tarsals'), [0.022, 0.016, 0.014], V(s * 0.088, 0.05, 0.036));
    rbox(id('tarsals'), [0.02, 0.018, 0.022], V(s * 0.12, 0.04, 0.03));
    for (let j = 0; j < 3; j++) rbox(id('tarsals'), [0.009, 0.016, 0.014], V(s * (0.078 + j * 0.01), 0.046, 0.052));
    for (let j = 0; j < 5; j++) {
      const x = s * (0.078 + j * 0.0115);
      const b = V(x + s * 0.004 * j, 0.018, 0.128 - j * 0.008);
      longBone(id('metatarsals'), V(x, 0.045, 0.06), b, j === 0 ? 0.0085 : 0.0058, 1.2, 1.25);
      let prev = b.clone().add(V(0, -0.002, 0.004));
      for (const len of j === 0 ? [0.022, 0.016] : [0.015, 0.009, 0.007]) {
        const next = prev.clone().add(V(s * 0.0006 * j, -0.002, len));
        longBone(id('toes'), prev, next, j === 0 ? 0.0062 : 0.0042, 1.15, 1.1);
        prev = next.clone().add(V(0, 0, 0.003));
      }
    }
  }
  regroup(armIds, V(0, 1.2, 0), [P.shoulder, 1, 1]);
  root.scale.setScalar(P.height);
  return { root, parts };
}

function disposeSkeleton(skel) {
  skel.root.traverse((o) => o.geometry?.dispose?.());
  Object.values(skel.parts).forEach((p) => Object.values(p.mats).forEach((m) => m.dispose()));
}

/* ---------- the viewer ---------- */
const Skeleton3D = forwardRef(function Skeleton3D({ notes, activeKey, sex = 'Male', region = 'all', colorMode = 'bone', autoRotate = false, onPick, onHover, onViewChange }, ref) {
  const host = useRef(null);
  const api = useRef(null);
  const cb = useRef({ onPick, onHover, onViewChange });
  cb.current = { onPick, onHover, onViewChange };
  const initialSex = useRef(sex);

  useEffect(() => {
    const el = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      el.innerHTML = '<div style="padding:2rem;text-align:center;color:#aeb6c4">3D view is not available in this browser (WebGL is turned off).</div>';
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.8;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    camera.position.set(0, 0.95, DIST);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3226, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(0.9, 3.0, 2.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -0.8, right: 0.8, top: 1.9, bottom: -0.2, near: 0.5, far: 6 });
    key.shadow.bias = -0.0005;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc9dbff, 1.1);
    rim.position.set(-1.8, 1.6, -2.4);
    scene.add(rim);
    const backFill = new THREE.DirectionalLight(0xfff4e6, 0.9);
    backFill.position.set(0.8, 2.4, -2.6);
    scene.add(backFill);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(0.7, 48), new THREE.ShadowMaterial({ opacity: 0.35 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const pins = new THREE.Group();
    const pinGeo = new THREE.SphereGeometry(0.008, 16, 12);
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, emissive: 0x5a0018, roughness: 0.4 });
    const pinActiveMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x6b4a00, roughness: 0.4 });

    /* state shared by painting, picking and the callout */
    const st = { hover: null, active: null, noted: new Set(), mode: 'bone', region: 'all', callout: null, pins: [] };
    let skel = null;
    let pickables = [];
    const ghosted = (id) => !inRegion(id, st.region);

    const paint = () => {
      if (!skel) return;
      const xr = st.mode === 'xray';
      ground.visible = !xr;
      for (const [id, e] of Object.entries(skel.parts)) {
        const info = BONE[id];
        const ghost = ghosted(id);
        const sx = ghost ? null : id === st.active ? 'active' : id === st.hover ? 'hover' : st.noted.has(id) ? 'noted' : null;
        for (const [kind, m] of Object.entries(e.mats)) {
          if (kind === 'dark') m.color.copy(xr ? XRAY : BASE.dark);
          else if (sx) m.color.copy(STATE[sx]);
          else if (xr) m.color.copy(XRAY);
          else if (st.mode === 'region') m.color.copy(REGION_COL[info?.region] || BASE.bone);
          else if (st.mode === 'type') m.color.copy(TYPE_COL[info?.type] || BASE.bone);
          else m.color.copy(BASE[kind]);
          if (kind === 'cart' && !sx && !xr && st.mode !== 'bone') m.color.lerp(WHITE, 0.45);
          m.emissive.setHex(sx ? EMI[sx] : xr ? 0x1a2c48 : 0x000000);
          const transparent = ghost || xr;
          const blending = xr ? THREE.AdditiveBlending : THREE.NormalBlending;
          if (m.transparent !== transparent || m.blending !== blending) { m.transparent = transparent; m.blending = blending; m.needsUpdate = true; }
          m.opacity = ghost ? (xr ? 0.03 : 0.07) : xr ? (sx ? 0.8 : 0.3) : 1;
          m.depthWrite = !transparent;
        }
        for (const mesh of e.meshes) mesh.castShadow = !ghost && !xr;
      }
      pins.clear();
      for (const { p, isActive, id } of st.pins) {
        if (ghosted(id)) continue;
        const m = new THREE.Mesh(pinGeo, isActive ? pinActiveMat : pinMat);
        m.position.fromArray(p);
        if (isActive) m.scale.setScalar(1.5);
        pins.add(m);
      }
    };

    const setSkeleton = (sex) => {
      if (skel) { scene.remove(skel.root); disposeSkeleton(skel); }
      skel = buildSkeleton(sex);
      skel.root.add(pins);
      scene.add(skel.root);
      pickables = Object.values(skel.parts).flatMap((p) => p.meshes);
      paint();
    };
    setSkeleton(initialSex.current);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(TARGET);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.3;
    controls.maxDistance = 6;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI - 0.25;
    controls.zoomToCursor = true;
    controls.autoRotateSpeed = 2.2;
    controls.update();

    /* camera tweening for the view / zoom / region buttons */
    let tween = null;
    // While a move is animating, new moves build on where it will end, not where it is now.
    const endPos = () => (tween ? tween.p1 : camera.position).clone();
    const endTarget = () => (tween ? tween.c1 : controls.target).clone();
    const flyTo = (pos, target = endTarget()) => {
      tween = { t0: performance.now(), dur: 500, p0: camera.position.clone(), p1: pos, c0: controls.target.clone(), c1: target };
    };
    const sph = () => new THREE.Spherical().setFromVector3(endPos().sub(endTarget()));
    const fromSph = (s, target = endTarget()) => new THREE.Vector3().setFromSpherical(s).add(target);
    // Frame a region: keep the viewing direction, centre and fit its bones.
    const focus = (regionId) => {
      if (!skel) return;
      if (regionId === 'all') { flyTo(V(0, 0.95, DIST), TARGET.clone()); return; }
      const box = new THREE.Box3();
      for (const [id, e] of Object.entries(skel.parts)) if (inRegion(id, regionId)) e.meshes.forEach((m) => box.expandByObject(m));
      if (box.isEmpty()) return;
      const c = box.getCenter(V(0, 0, 0)), size = box.getSize(V(0, 0, 0));
      const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      // Generous margin so the region stays clear of the side panels.
      const d = Math.max(size.y / (2 * t), Math.max(size.x, size.z) / (2 * t * camera.aspect)) * 1.75 + Math.max(size.x, size.z) / 2;
      const dir = endPos().sub(endTarget()).normalize();
      flyTo(c.clone().add(dir.multiplyScalar(Math.max(d, 0.35))), c);
    };

    /* picking */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(pickables, false).find((h) => !ghosted(h.object.userData.part)) || null;
    };
    // Front or back: by the surface that was clicked, or, on the sides, by where the camera is.
    const viewOf = (h) => {
      const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : V(0, 0, 0);
      if (n.z > 0.2) return 'Front';
      if (n.z < -0.2) return 'Back';
      return camera.position.z - controls.target.z >= 0 ? 'Front' : 'Back';
    };

    let down = null, dragging = false;
    const onDown = (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; dragging = false; };
    const onMove = (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) dragging = true;
      if (dragging || e.pointerType === 'touch') return;
      const h = hit(e);
      const id = h?.object.userData.part || null;
      if (id !== st.hover) { st.hover = id; paint(); }
      renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      const r = renderer.domElement.getBoundingClientRect();
      cb.current.onHover?.(id ? { id, view: viewOf(h), x: e.clientX - r.left, y: e.clientY - r.top } : null);
    };
    const onUp = (e) => {
      const wasClick = down && !dragging && performance.now() - down.t < 600;
      down = null;
      if (!wasClick) return;
      const h = hit(e);
      if (!h) return;
      const local = skel.root.worldToLocal(h.point.clone());
      cb.current.onPick?.(h.object.userData.part, viewOf(h), local.toArray().map((v) => +v.toFixed(4)));
    };
    const onLeave = () => { if (st.hover) { st.hover = null; paint(); } cb.current.onHover?.(null); };
    const cvs = renderer.domElement;
    cvs.addEventListener('pointerdown', onDown);
    cvs.addEventListener('pointermove', onMove);
    cvs.addEventListener('pointerup', onUp);
    cvs.addEventListener('pointerleave', onLeave);

    /* callout label on the selected bone (positioned every frame) */
    const callout = document.createElement('div');
    callout.className = 'pointer-events-none absolute left-0 top-0 z-[5] hidden';
    callout.innerHTML = '<div data-row class="flex items-center gap-2" style="transform:translate(-7px,-50%)">'
      + '<span class="block h-3.5 w-3.5 rounded-full border-2 border-amber-300 bg-amber-400/30 shadow"></span>'
      + '<span class="h-px w-6 bg-amber-200/80"></span>'
      + '<span data-t class="whitespace-nowrap rounded-md border border-amber-200/60 bg-ink-900/85 px-2 py-0.5 text-xs font-semibold text-amber-50 shadow-lg"></span></div>';
    el.appendChild(callout);
    const calloutText = callout.querySelector('[data-t]');
    const calloutRow = callout.querySelector('[data-row]');
    let calloutLeft = null;
    const tmp = new THREE.Vector3();
    const placeCallout = () => {
      if (!st.callout || !skel || ghosted(st.callout.id)) { callout.classList.add('hidden'); return; }
      skel.root.localToWorld(tmp.fromArray(st.callout.p)).project(camera);
      if (tmp.z > 1) { callout.classList.add('hidden'); return; }
      callout.classList.remove('hidden');
      const x = ((tmp.x + 1) / 2) * el.clientWidth;
      // Label goes on whichever side of the bone has more room.
      const left = x > el.clientWidth * 0.55;
      if (left !== calloutLeft) {
        calloutLeft = left;
        calloutRow.classList.toggle('flex-row-reverse', left);
        calloutRow.style.transform = left ? 'translate(calc(-100% + 7px),-50%)' : 'translate(-7px,-50%)';
      }
      callout.style.transform = `translate(${x}px, ${((1 - tmp.y) / 2) * el.clientHeight}px)`;
      if (calloutText.textContent !== st.callout.text) calloutText.textContent = st.callout.text;
    };

    /* what part of the skeleton is in view: for the scroll bars */
    const rightDir = () => {
      const r = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      r.y = 0;
      return r.lengthSq() < 1e-6 ? V(1, 0, 0) : r.normalize();
    };
    let lastView = '';
    const reportView = () => {
      const d = camera.position.distanceTo(controls.target);
      const visH = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const v = { visH, visW: visH * camera.aspect, x: controls.target.dot(rightDir()), y: controls.target.y };
      const sig = [v.visH, v.visW, v.x, v.y].map((n) => n.toFixed(3)).join();
      if (sig !== lastView) { lastView = sig; cb.current.onViewChange?.(v); }
    };
    const panTo = (x, y) => {
      tween = null;
      const r = rightDir();
      const delta = V(r.x * x, y, r.z * x).sub(controls.target);
      controls.target.add(delta);
      camera.position.add(delta);
    };

    /* size + render loop */
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let raf = 0;
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (tween) {
        const k = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - (1 - k) ** 3;
        camera.position.lerpVectors(tween.p0, tween.p1, e);
        controls.target.lerpVectors(tween.c0, tween.c1, e);
        if (k >= 1) tween = null;
      }
      controls.update();
      renderer.render(scene, camera);
      placeCallout();
      reportView();
    };
    raf = requestAnimationFrame(loop);

    api.current = {
      setState({ noted, active, pins: pinList, mode, region: reg, callout: co }) {
        Object.assign(st, { noted, active, pins: pinList, mode, region: reg, callout: co });
        paint();
      },
      setSex: setSkeleton,
      focus,
      setAutoRotate(v) { controls.autoRotate = !!v; },
      view(name) {
        const az = { Front: 0, Back: Math.PI, Right: -Math.PI / 2, Left: Math.PI / 2 }[name];
        const s = sph();
        flyTo(fromSph(new THREE.Spherical(s.radius, Math.PI / 2 - 0.03, az)));
      },
      rotate(deg) { const s = sph(); s.theta += (deg * Math.PI) / 180; flyTo(fromSph(s)); },
      zoom(f) { const s = sph(); s.radius = THREE.MathUtils.clamp(s.radius * f, controls.minDistance, controls.maxDistance); flyTo(fromSph(s)); },
      reset() { flyTo(V(0, 0.95, DIST), TARGET.clone()); },
      facing() { return camera.position.z - controls.target.z >= 0 ? 'Front' : 'Back'; },
      panTo,
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      cvs.removeEventListener('pointerdown', onDown);
      cvs.removeEventListener('pointermove', onMove);
      cvs.removeEventListener('pointerup', onUp);
      cvs.removeEventListener('pointerleave', onLeave);
      controls.dispose();
      if (skel) disposeSkeleton(skel);
      [pinMat, pinActiveMat, pinGeo, ground.geometry, ground.material].forEach((x) => x.dispose());
      envTex.dispose(); pmrem.dispose();
      renderer.dispose();
      cvs.remove();
      callout.remove();
      api.current = null;
    };
  }, []);

  // Push notes / selection / colour mode / region into the scene.
  useEffect(() => {
    const keys = Object.keys(notes);
    const activeId = activeKey ? parseKey(activeKey).id : null;
    const activeP = activeKey ? notes[activeKey]?.p : null;
    api.current?.setState({
      noted: new Set(keys.map((k) => parseKey(k).id)),
      active: activeId,
      pins: keys.filter((k) => notes[k]?.p).map((k) => ({ p: notes[k].p, id: parseKey(k).id, isActive: k === activeKey })),
      mode: colorMode,
      region,
      callout: activeId && activeP ? { id: activeId, p: activeP, text: boneName(activeId) } : null,
    });
  }, [notes, activeKey, colorMode, region]);

  const firstSex = useRef(true);
  useEffect(() => { if (firstSex.current) { firstSex.current = false; return; } api.current?.setSex(sex); }, [sex]);
  const firstRegion = useRef(true);
  useEffect(() => { if (firstRegion.current) { firstRegion.current = false; return; } api.current?.focus(region); }, [region]);
  useEffect(() => { api.current?.setAutoRotate(autoRotate); }, [autoRotate]);

  useImperativeHandle(ref, () => ({
    view: (n) => api.current?.view(n),
    rotate: (d) => api.current?.rotate(d),
    zoom: (f) => api.current?.zoom(f),
    reset: () => api.current?.reset(),
    facing: () => api.current?.facing() || 'Front',
    panTo: (x, y) => api.current?.panTo(x, y),
  }), []);

  return <div ref={host} className="absolute inset-0" />;
});

export default Skeleton3D;
