import { clamp } from "./pixel.js";
import { STAGES, combatPower } from "./state.js";

const CARE_LABEL = {
  feed: "餵食",
  play: "玩耍",
  train: "訓練",
  clean: "清潔",
  sleep: "休息",
  explore: "探險",
};

/** Apply offline / idle decay based on elapsed minutes. */
export function tickRaise(save, now = Date.now()) {
  const elapsedMin = Math.max(0, Math.floor((now - save.lastTickAt) / 60000));
  if (elapsedMin <= 0) return { save, events: [] };
  const events = [];
  const s = save.stats;
  const steps = Math.min(elapsedMin, 24 * 60); // cap 1 day catch-up
  save.ageMinutes += steps;

  for (let i = 0; i < steps; i++) {
    if (s.sleeping) {
      s.energy = clamp(s.energy + 0.35);
      s.stress = clamp(s.stress - 0.2);
      if (s.energy > 92) s.sleeping = false;
    } else {
      s.hunger = clamp(s.hunger - 0.12);
      s.mood = clamp(s.mood - 0.05);
      s.energy = clamp(s.energy - 0.04);
      s.hygiene = clamp(s.hygiene - 0.03);
    }

    if (i > 0 && i % 45 === 0 && s.hunger < 55 && !s.sleeping) {
      s.poop = clamp(s.poop + 1, 0, 3);
    }
  }

  if (s.hunger < 15) {
    s.careMistakes += 1;
    s.mood = clamp(s.mood - 8);
    events.push("餓太耐，照顧失誤 +1");
  }
  if (s.poop >= 2) {
    s.hygiene = clamp(s.hygiene - 10);
    s.mood = clamp(s.mood - 6);
    if (s.poop >= 3) {
      s.sick = true;
      s.careMistakes += 1;
      events.push("便便堆滿，生病了");
    }
  }
  if (s.hygiene < 20) s.sick = true;

  save.lastTickAt = now;
  return { save, events };
}

export function care(save, type) {
  const s = save.stats;
  const events = [];
  if (s.sleeping && type !== "sleep") {
    s.sleeping = false;
    events.push("被吵醒了");
  }

  s.actionCount += 1;
  s.hunger = clamp(s.hunger - 3);
  s.energy = clamp(s.energy - 2);

  if (type === "feed") {
    if (s.hunger > 88) {
      s.careMistakes += 1;
      s.stress = clamp(s.stress + 6);
      events.push("餵得太撐，失誤 +1");
    }
    s.hunger = clamp(s.hunger + 28);
    s.bond = clamp(s.bond + 3);
    s.poop = clamp(s.poop + (Math.random() < 0.35 ? 1 : 0), 0, 3);
  } else if (type === "play") {
    s.mood = clamp(s.mood + 22);
    s.bond = clamp(s.bond + 6);
    s.speed = clamp(s.speed + 2);
    s.energy = clamp(s.energy - 6);
  } else if (type === "train") {
    if (s.energy < 25 || s.sick) {
      s.careMistakes += 1;
      s.stress = clamp(s.stress + 10);
      events.push("硬練受傷，失誤 +1");
    }
    const focus = pickTrainFocus(s);
    if (focus === "power") {
      s.power = clamp(s.power + 5);
      s.trainPower += 1;
    } else if (focus === "speed") {
      s.speed = clamp(s.speed + 5);
      s.trainSpeed += 1;
    } else {
      s.mind = clamp(s.mind + 5);
      s.trainMind += 1;
    }
    s.stress = clamp(s.stress + 5);
    s.energy = clamp(s.energy - 10);
    events.push(`訓練偏向：${focus}`);
  } else if (type === "clean") {
    s.poop = 0;
    s.hygiene = clamp(s.hygiene + 35);
    s.stress = clamp(s.stress - 8);
    if (s.sick && s.hygiene > 55) {
      s.sick = false;
      events.push("病好了！");
    }
  } else if (type === "sleep") {
    s.sleeping = true;
    s.energy = clamp(s.energy + 18);
    s.stress = clamp(s.stress - 10);
  } else if (type === "explore") {
    s.mind = clamp(s.mind + 3);
    s.trainMind += 0.5;
    s.wildish = true;
    s.energy = clamp(s.energy - 12);
    s.mood = clamp(s.mood + 8);
    if (Math.random() < 0.2) {
      s.poop = clamp(s.poop + 1, 0, 3);
      events.push("探險帶回泥巴…");
    }
  }

  if (s.mood < 20) s.careMistakes += 0; // already tracked elsewhere
  events.unshift(`完成${CARE_LABEL[type]}`);
  return { save, events, thought: thoughtFor(type), mood: moodFor(type) };
}

function pickTrainFocus(s) {
  // Bias toward the currently lowest combat train track to keep choices meaningful,
  // but still random enough for Digimon-like branching.
  const arr = [
    ["power", s.trainPower],
    ["speed", s.trainSpeed],
    ["mind", s.trainMind],
  ].sort((a, b) => a[1] - b[1]);
  return Math.random() < 0.55 ? arr[0][0] : arr[Math.floor(Math.random() * 3)][0];
}

function thoughtFor(type) {
  return { feed: "🍖", play: "💖", train: "⚔️", clean: "✨", sleep: "Zzz", explore: "🧭" }[type] || "…";
}

function moodFor(type) {
  return { feed: "happy", play: "happy", train: "angry", clean: "happy", sleep: "sleep", explore: "hungry" }[type] || "neutral";
}

export function statusLines(save) {
  const s = save.stats;
  const lines = [];
  if (s.sick) lines.push("生病中，先清潔／休息");
  if (s.sleeping) lines.push("睡覺中…");
  if (s.poop > 0) lines.push(`便便 ×${s.poop}`);
  if (s.hunger < 30) lines.push("好餓");
  if (s.mood < 30) lines.push("心情差");
  if (s.energy < 25) lines.push("好累");
  return lines;
}

export function evolutionReady(save) {
  if (save.stage >= 3) return { ok: false, reason: "已係完全體" };
  const needAge = [20, 90, 240][save.stage]; // minutes
  const needActions = [6, 14, 24][save.stage];
  const maxMistakes = [6, 8, 10][save.stage];
  if (save.ageMinutes < needAge)
    return { ok: false, reason: `仲要大 ${needAge - save.ageMinutes} 分鐘` };
  if (save.stats.actionCount < needActions)
    return { ok: false, reason: `仲要 ${needActions - save.stats.actionCount} 次照顧` };
  if (save.stats.careMistakes > maxMistakes)
    return { ok: false, reason: `失誤太多（${save.stats.careMistakes}/${maxMistakes}）` };
  if (save.stats.sick) return { ok: false, reason: "病緊唔可以進化" };
  return { ok: true, reason: "可以進化！" };
}

export function evolutionBranches(save) {
  const s = save.stats;
  const tracks = [
    { id: "power", label: "力量型", score: s.trainPower * 2 + s.power + s.battlesWon },
    { id: "speed", label: "速度型", score: s.trainSpeed * 2 + s.speed + s.battlesWon * 0.5 },
    { id: "mind", label: "智慧型", score: s.trainMind * 2 + s.mind },
  ].sort((a, b) => b.score - a.score);

  // Always offer top track + stable + wild card
  return [
    { id: tracks[0].id, label: tracks[0].label, blurb: "跟住你嘅訓練傾向" },
    { id: "stable", label: "安定型", blurb: "均衡、失誤少會更強" },
    {
      id: s.battlesWon > s.battlesLost ? "power" : "mind",
      label: s.battlesWon > s.battlesLost ? "鬥士型" : "異變型",
      blurb: s.battlesWon > s.battlesLost ? "勝場推高攻擊" : "少戰偏異變",
    },
  ];
}

export function applyEvolutionMeta(save, branchId) {
  save.stage = Math.min(3, save.stage + 1);
  save.stats.actionCount = 0;
  save.stats.energy = clamp(save.stats.energy + 15);
  save.stats.mood = clamp(save.stats.mood + 15);
  if (branchId === "power") save.stats.power = clamp(save.stats.power + 10);
  if (branchId === "speed") save.stats.speed = clamp(save.stats.speed + 10);
  if (branchId === "mind") save.stats.mind = clamp(save.stats.mind + 10);
  if (branchId === "stable") {
    save.stats.power = clamp(save.stats.power + 4);
    save.stats.speed = clamp(save.stats.speed + 4);
    save.stats.mind = clamp(save.stats.mind + 4);
  }
  return save;
}

export function raiseSummary(save) {
  const ready = evolutionReady(save);
  const cp = combatPower(save);
  return {
    stageName: STAGES[save.stage] || "？",
    ready,
    cp,
    lines: [
      ["階段", STAGES[save.stage]],
      ["年齡", `${Math.floor(save.ageMinutes / 60)}h ${save.ageMinutes % 60}m`],
      ["羈絆", Math.round(save.stats.bond)],
      ["力量", Math.round(save.stats.power)],
      ["速度", Math.round(save.stats.speed)],
      ["智慧", Math.round(save.stats.mind)],
      ["訓練", `力${Math.floor(save.stats.trainPower)} / 速${Math.floor(save.stats.trainSpeed)} / 智${Math.floor(save.stats.trainMind)}`],
      ["戰績", `${save.stats.battlesWon}勝 ${save.stats.battlesLost}負`],
      ["失誤", save.stats.careMistakes],
      ["衛生", Math.round(save.stats.hygiene)],
      ["戰力概算", `HP${cp.hp} ATK${cp.atk} SPD${cp.spd} MAG${cp.mag}`],
      ["進化", ready.reason],
    ],
  };
}
