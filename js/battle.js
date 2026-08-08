import { combatPower } from "./state.js";

export function fighterFromSave(save, spriteCanvas) {
  const cp = combatPower(save);
  return {
    name: save.name,
    hp: cp.hp,
    maxHp: cp.hp,
    atk: cp.atk,
    spd: cp.spd,
    mag: cp.mag,
    guarding: false,
    spriteCanvas,
  };
}

export function makeCpuFighter(stage = 0) {
  const mult = 1 + stage * 0.3;
  return {
    name: "訓練假體",
    hp: Math.round(55 * mult),
    maxHp: Math.round(55 * mult),
    atk: Math.round(10 * mult),
    spd: Math.round(9 * mult),
    mag: Math.round(8 * mult),
    guarding: false,
    spriteCanvas: null,
  };
}

function dmg(attacker, move, defender) {
  const guard = defender.guarding ? 0.45 : 1;
  if (move === "guard") return 0;
  if (move === "skill") return Math.max(1, Math.round((attacker.mag * 1.35 + 3) * guard));
  return Math.max(1, Math.round((attacker.atk + 2) * (0.9 + Math.random() * 0.3) * guard));
}

export function resolveTurn(a, aMove, b, bMove) {
  const log = [];
  const order = a.spd >= b.spd ? ["a", "b"] : ["b", "a"];
  a.guarding = aMove === "guard";
  b.guarding = bMove === "guard";
  if (a.guarding) log.push(`${a.name} 防禦！`);
  if (b.guarding) log.push(`${b.name} 防禦！`);

  for (const who of order) {
    if (a.hp <= 0 || b.hp <= 0) break;
    if (who === "a" && aMove !== "guard") {
      const hit = dmg(a, aMove, b);
      b.hp = Math.max(0, b.hp - hit);
      log.push(`${a.name} 用${moveName(aMove)}造成 ${hit} 傷害`);
    }
    if (who === "b" && bMove !== "guard") {
      const hit = dmg(b, bMove, a);
      a.hp = Math.max(0, a.hp - hit);
      log.push(`${b.name} 用${moveName(bMove)}造成 ${hit} 傷害`);
    }
  }

  a.guarding = false;
  b.guarding = false;
  let winner = null;
  if (a.hp <= 0 && b.hp <= 0) winner = "draw";
  else if (b.hp <= 0) winner = "a";
  else if (a.hp <= 0) winner = "b";
  return { a, b, log, winner };
}

function moveName(m) {
  return { attack: "攻擊", skill: "特技", guard: "防禦" }[m] || m;
}

export function cpuMove(cpu, player) {
  if (cpu.hp < cpu.maxHp * 0.3 && Math.random() < 0.45) return "guard";
  if (cpu.mag >= cpu.atk && Math.random() < 0.5) return "skill";
  if (player.guarding && Math.random() < 0.4) return "skill";
  return Math.random() < 0.7 ? "attack" : "skill";
}

export function createNetController({ onStatus, onMessage, onReady }) {
  let peer = null;
  let conn = null;
  let room = null;
  let isHost = false;

  function code() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function bindConn(c) {
    conn = c;
    conn.on("open", () => {
      onStatus(isHost ? `已連線（房 ${room}）` : `已加入 ${room}`);
      onReady?.({ isHost, room });
    });
    conn.on("data", (data) => onMessage?.(data));
    conn.on("close", () => onStatus("連線中斷"));
    conn.on("error", (e) => onStatus(`連線錯誤：${e.type || e.message || e}`));
  }

  async function ensurePeer(id) {
    if (typeof Peer === "undefined") throw new Error("PeerJS 未載入");
    return new Promise((resolve, reject) => {
      peer = id ? new Peer(id) : new Peer();
      peer.on("open", (pid) => resolve(pid));
      peer.on("error", (e) => reject(e));
    });
  }

  return {
    async host() {
      isHost = true;
      room = code();
      onStatus("開房中…");
      const peerId = `icompanion-${room}`;
      await ensurePeer(peerId);
      peer.on("connection", (c) => bindConn(c));
      onStatus(`房碼 ${room}，等待對手…`);
      return room;
    },
    async join(roomCode) {
      isHost = false;
      room = (roomCode || "").trim().toUpperCase();
      if (room.length < 4) throw new Error("房碼太短");
      onStatus(`加入 ${room}…`);
      await ensurePeer();
      const c = peer.connect(`icompanion-${room}`, { reliable: true });
      bindConn(c);
      return room;
    },
    send(data) {
      if (conn && conn.open) conn.send(data);
    },
    get meta() {
      return { isHost, room, connected: !!(conn && conn.open) };
    },
    destroy() {
      try {
        conn?.close();
        peer?.destroy();
      } catch {}
      conn = null;
      peer = null;
    },
  };
}
