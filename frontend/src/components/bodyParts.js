// Body chart catalogue: every pickable bone / joint, its type and region, head to toe.
// Ids ending in -r / -l are the PATIENT's right / left.

export const REGIONS = [
  { id: 'all', name: 'Whole body', color: '#e2d3b1' },
  { id: 'skull', name: 'Skull', color: '#f472b6' },
  { id: 'spine', name: 'Spine', color: '#f59e0b' },
  { id: 'ribcage', name: 'Rib cage', color: '#60a5fa' },
  { id: 'arm', name: 'Arm', color: '#2dd4bf' },
  { id: 'hand', name: 'Hand', color: '#a3e635' },
  { id: 'pelvis', name: 'Pelvis', color: '#a78bfa' },
  { id: 'leg', name: 'Leg', color: '#38bdf8' },
  { id: 'foot', name: 'Foot', color: '#fb923c' },
];
export const REGION = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

export const BONE_TYPES = {
  long: { name: 'Long bone', color: '#60a5fa' },
  short: { name: 'Short bone', color: '#34d399' },
  flat: { name: 'Flat bone', color: '#f472b6' },
  irregular: { name: 'Irregular bone', color: '#fbbf24' },
  sesamoid: { name: 'Sesamoid bone', color: '#a78bfa' },
  joint: { name: 'Joint', color: '#f87171' },
};

const B = (id, name, type, region) => ({ id, name, type, region });
const sided = (key, name, type, region) => [B(`${key}-r`, `Right ${name}`, type, region), B(`${key}-l`, `Left ${name}`, type, region)];
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

export const BONES = [
  B('cranium', 'Skull (cranium)', 'flat', 'skull'),
  B('face', 'Facial bones (maxilla / zygomatic)', 'irregular', 'skull'),
  B('mandible', 'Mandible (lower jaw)', 'irregular', 'skull'),
  ...range(7).map((n) => B(`c${n}`, n === 1 ? 'C1 cervical vertebra (atlas)' : n === 2 ? 'C2 cervical vertebra (axis)' : `C${n} cervical vertebra`, 'irregular', 'spine')),
  ...range(12).map((n) => B(`t${n}`, `T${n} thoracic vertebra`, 'irregular', 'spine')),
  ...range(5).map((n) => B(`l${n}`, `L${n} lumbar vertebra`, 'irregular', 'spine')),
  { ...B('sacrum', 'Sacrum', 'irregular', 'spine'), also: ['pelvis'] },
  { ...B('coccyx', 'Coccyx (tailbone)', 'irregular', 'spine'), also: ['pelvis'] },
  B('sternum', 'Sternum (breastbone)', 'flat', 'ribcage'),
  ...range(12).flatMap((n) => sided(`rib${n}`, `rib ${n}`, 'flat', 'ribcage')),
  ...sided('clavicle', 'clavicle (collarbone)', 'long', 'arm'),
  ...sided('scapula', 'scapula (shoulder blade)', 'flat', 'arm'),
  ...sided('shoulder', 'shoulder joint', 'joint', 'arm'),
  ...sided('humerus', 'humerus (upper arm)', 'long', 'arm'),
  ...sided('elbow', 'elbow joint', 'joint', 'arm'),
  ...sided('radius', 'radius (forearm)', 'long', 'arm'),
  ...sided('ulna', 'ulna (forearm)', 'long', 'arm'),
  ...sided('carpals', 'carpal bones (wrist)', 'short', 'hand'),
  ...sided('metacarpals', 'metacarpals (palm)', 'long', 'hand'),
  ...sided('fingers', 'phalanges (fingers / thumb)', 'long', 'hand'),
  ...sided('hipbone', 'hip bone (ilium / ischium / pubis)', 'irregular', 'pelvis'),
  ...sided('hip', 'hip joint', 'joint', 'pelvis'),
  ...sided('femur', 'femur (thigh bone)', 'long', 'leg'),
  ...sided('knee', 'knee joint', 'joint', 'leg'),
  ...sided('patella', 'patella (kneecap)', 'sesamoid', 'leg'),
  ...sided('tibia', 'tibia (shin bone)', 'long', 'leg'),
  ...sided('fibula', 'fibula', 'long', 'leg'),
  ...sided('ankle', 'ankle joint', 'joint', 'foot'),
  ...sided('tarsals', 'tarsal bones (heel / midfoot)', 'short', 'foot'),
  ...sided('metatarsals', 'metatarsals', 'long', 'foot'),
  ...sided('toes', 'phalanges (toes)', 'long', 'foot'),
];
export const BONE = Object.fromEntries(BONES.map((b) => [b.id, b]));
// Whether a bone is shown when a region is focused (the sacrum belongs to both spine and pelvis).
export const inRegion = (id, region) => region === 'all' || BONE[id]?.region === region || !!BONE[id]?.also?.includes(region);
export const boneName = (id) => BONE[id]?.name || id;
export const boneType = (id) => BONE_TYPES[BONE[id]?.type]?.name || '';

// The area the 3D skeleton occupies (metres): the scroll bars shown when zoomed in cover this.
export const BOUNDS = { yMin: -0.02, yMax: 1.84, xMin: -0.42, xMax: 0.42 };

export const VIEWS = ['Front', 'Back'];

// A finding is keyed by bone and the side of the body it was marked on: "femur-r@Back".
export const keyOf = (id, view) => `${id}@${view}`;
export const parseKey = (key) => { const [id, view] = key.split('@'); return { id, view }; };
export const keyLabel = (key) => { const { id, view } = parseKey(key); return `${boneName(id)} — ${(view || 'Front').toLowerCase()}`; };

const ORDER = Object.fromEntries(BONES.map((b, i) => [b.id, i]));
export const sortKeys = (keys) => [...keys].sort((a, b) => {
  const A = parseKey(a), Bk = parseKey(b);
  return (ORDER[A.id] ?? 999) - (ORDER[Bk.id] ?? 999) || VIEWS.indexOf(A.view) - VIEWS.indexOf(Bk.view);
});
