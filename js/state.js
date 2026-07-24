const KEY = "icompanion.save.v10";

export const STAGES = ["幼體", "成長期", "成熟期", "完全體"];

export function defaultFace() {
  return {
    enabled: true,
    eyes: true,
    mouth: true,
    handles: false,
    eyeStyle: "round",
    mouthStyle: "smile",
    color: "#ffffff",
    eyeSize: 2,
    mouthSize: 4,
    eyeLX: 28,
    eyeLY: 24,
    eyeRX: 36,
    eyeRY: 24,
    mouthX: 32,
    mouthY: 32,
  };
}

export function defaultStats() {
  return {
    hunger: 70,
    mood: 70,
    energy: 75,
    hygiene: 80,
    bond: 10,
    power: 12,
    speed: 12,
    mind: 12,
    stress: 8,
    careMistakes: 0,
    battlesWon: 0,
    battlesLost: 0,
    trainPower: 0,
    trainSpeed: 0,
    trainMind: 0,
    actionCount: 0,
    poop: 0,
    sick: false,
    sleeping: false,
  };
}

export function createEmptySave() {
  return {
    version: 10,
    hatched: false,
    name: "未命名獸",
    stage: 0,
    template: "humanoid",
    move: "auto",
    palette: ["#ff6b6b", "#ffd166", "#58c7ff", "#ffffff", "#1a1d2d", "#4be38f"],
    material: "未抽取",
    element: "火",
    sprite: null,
    face: defaultFace(),
    stats: defaultStats(),
    bornAt: Date.now(),
    lastTickAt: Date.now(),
    ageMinutes: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createEmptySave();
    const data = JSON.parse(raw);
    return {
      ...createEmptySave(),
      ...data,
      face: { ...defaultFace(), ...(data.face || {}) },
      stats: { ...defaultStats(), ...(data.stats || {}) },
    };
  } catch {
    return createEmptySave();
  }
}

export function persistSave(save) {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function combatPower(save) {
  const s = save.stats;
  const stageBonus = 1 + save.stage * 0.35;
  return {
    hp: Math.round((60 + s.bond * 0.4 + s.power * 1.2) * stageBonus),
    atk: Math.round((8 + s.power * 0.55 + s.trainPower * 0.8) * stageBonus),
    spd: Math.round((8 + s.speed * 0.55 + s.trainSpeed * 0.8) * stageBonus),
    mag: Math.round((8 + s.mind * 0.55 + s.trainMind * 0.8) * stageBonus),
  };
}

export function ageHours(save) {
  return Math.floor(save.ageMinutes / 60);
}
