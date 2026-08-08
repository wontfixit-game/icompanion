import { createSpriteEngine } from "./engine.js";
import { loadSave, persistSave, createEmptySave, STAGES, ageHours } from "./state.js";
import {
  tickRaise,
  care,
  statusLines,
  evolutionReady,
  evolutionBranches,
  applyEvolutionMeta,
  raiseSummary,
} from "./raise.js";
import {
  fighterFromSave,
  makeCpuFighter,
  resolveTurn,
  cpuMove,
  createNetController,
} from "./battle.js";

const engine = createSpriteEngine();
let save = loadSave();
let createStep = 1;
let battle = null;
let net = null;
let netRole = null; // host | guest
let awaitingNetMove = false;

const $ = (id) => document.getElementById(id);

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.dataset.screen === name));
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.nav === name));
  if (name === "battle") syncBattleSprites();
  if (name === "home") renderHome();
}

function setCreateStep(n) {
  createStep = n;
  document.querySelectorAll(".create-step").forEach((s) =>
    s.classList.toggle("active", Number(s.dataset.createStep) === n),
  );
  document.querySelectorAll("#createStepper span").forEach((s) =>
    s.classList.toggle("on", Number(s.dataset.step) <= n),
  );
  if (n === 3) engine.renderEditor();
}

function setBar(id, value) {
  const el = $(id);
  el.style.width = `${Math.max(0, Math.min(100, value))}%`;
  el.classList.toggle("bad", value < 30);
  el.classList.toggle("warn", value >= 30 && value < 55);
}

function renderHome() {
  const summary = raiseSummary(save);
  $("homeName").textContent = save.name;
  $("homeStage").textContent = summary.stageName;
  $("homeAge").textContent = `${ageHours(save)}h`;
  setBar("barHunger", save.stats.hunger);
  setBar("barMood", save.stats.mood);
  setBar("barEnergy", save.stats.energy);
  engine.roomState.poop = save.stats.poop;
  engine.roomState.frozen = !!save.stats.sleeping;

  const lines = statusLines(save);
  const banner = $("statusBanner");
  if (lines.length) {
    banner.textContent = lines.join(" · ");
    banner.classList.remove("hidden");
  } else banner.classList.add("hidden");

  $("evoHint").textContent = summary.ready.ok
    ? "✅ 條件達成：打開下方詳情進化"
    : summary.ready.reason;

  $("detailStats").innerHTML = summary.lines
    .map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`)
    .join("");

  const ready = evolutionReady(save);
  $("evolveBtn").disabled = !ready.ok;
  if (!ready.ok) $("evoChoices").innerHTML = "";
}

function persist() {
  persistSave(save);
}

async function boot() {
  if (location.hash === "#demo") {
    save = createEmptySave();
    save.hatched = true;
    save.name = "測試獸";
    save.stage = 1;
    save.ageMinutes = 90;
    save.stats.actionCount = 10;
    save.stats.trainPower = 3;
    save.stats.poop = 1;
    save.sprite = null;
    persist();
    history.replaceState(null, "", location.pathname);
  }
  const ticked = tickRaise(save);
  save = ticked.save;
  if (save.hatched) {
    await engine.loadFromSave(save);
    showScreen(location.hash === "#battle" ? "battle" : "home");
  } else {
    showScreen("create");
    setCreateStep(1);
  }
  renderHome();
  if (ticked.events.length) {
    $("statusBanner").textContent = ticked.events.join(" · ");
    $("statusBanner").classList.remove("hidden");
  }
}

// tabs
$("tabbar").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-nav]");
  if (!btn) return;
  if (btn.dataset.nav === "home" && !save.hatched) {
    showScreen("create");
    return;
  }
  showScreen(btn.dataset.nav);
});

// create flow
$("imageInput").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const im = new Image();
  im.onload = () => engine.applyPhoto(im);
  im.src = URL.createObjectURL(f);
});
$("photoFitSel").onchange = () => engine.refreshPhoto();
$("bgRemoveSel").onchange = () => engine.refreshPhoto();
$("randomMatBtn").onclick = () => engine.randomMaterial();
$("blankStartBtn").onclick = () => engine.blank();
$("makeTemplateBtn").onclick = () => engine.useTemplate($("templateSel").value);
$("toStep2").onclick = () => {
  engine.bake();
  setCreateStep(2);
};
$("backStep1").onclick = () => setCreateStep(1);
$("toStep3").onclick = () => {
  engine.bake();
  setCreateStep(3);
};
$("backStep2").onclick = () => setCreateStep(2);

document.querySelectorAll("#simpleTools [data-tool], .sheet [data-tool]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-tool]").forEach((b) => b.classList.remove("on"));
    btn.classList.add("on");
    engine.setTool(btn.dataset.tool);
  });
});
$("undoBtn").onclick = () => engine.undo();
$("mirrorBtn").onclick = () => engine.mirror();
$("outlineBtn").onclick = () => engine.outline();
$("bakeBtn").onclick = () => engine.bake();

document.querySelectorAll("#faceTools [data-face]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#faceTools [data-face]").forEach((b) => b.classList.remove("on"));
    btn.classList.add("on");
    engine.setFaceMove(btn.dataset.face);
  });
});

$("exprEnabled").onchange = (e) => {
  engine.face.enabled = e.target.checked;
  engine.renderEditor();
};
$("exprEyes").onchange = (e) => {
  engine.face.eyes = e.target.checked;
  engine.renderEditor();
};
$("exprMouth").onchange = (e) => {
  engine.face.mouth = e.target.checked;
  engine.renderEditor();
};

$("hatchBtn").onclick = async () => {
  const patch = engine.exportSavePatch();
  save = {
    ...createEmptySave(),
    ...patch,
    hatched: true,
    bornAt: Date.now(),
    lastTickAt: Date.now(),
    ageMinutes: 0,
    stage: 0,
  };
  persist();
  await engine.loadFromSave(save);
  showScreen("home");
  renderHome();
  engine.think("💖");
};

// care
$("carePad").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-care]");
  if (!btn || !save.hatched) return;
  const result = care(save, btn.dataset.care);
  save = result.save;
  engine.setMood(result.mood, 140);
  engine.think(result.thought);
  persist();
  renderHome();
});

$("debugBoost").onclick = () => {
  if (!save.hatched) return;
  save.ageMinutes += 60;
  save.stats.actionCount += 8;
  save.stats.hunger = 70;
  save.stats.mood = 70;
  save.stats.energy = 70;
  save.stats.hygiene = 80;
  save.stats.poop = 0;
  save.stats.sick = false;
  persist();
  renderHome();
  engine.think("⏩");
};

// evolution
$("evolveBtn").onclick = () => {
  const ready = evolutionReady(save);
  if (!ready.ok) return;
  const branches = evolutionBranches(save);
  $("evoChoices").innerHTML = "";
  branches.forEach((b) => {
    const preview = engine.makeEvoPreview(b.id);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    canvas.getContext("2d").putImageData(preview, 0, 0);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "evo-card";
    card.innerHTML = `<span></span><span><strong>${b.label}</strong><small>${b.blurb}</small></span>`;
    card.querySelector("span").replaceWith(canvas);
    card.onclick = () => {
      engine.applyImage(preview);
      save = applyEvolutionMeta(save, b.id);
      Object.assign(save, engine.exportSavePatch());
      persist();
      $("evoChoices").innerHTML = `<p class="tiny">已進化至 ${STAGES[save.stage]}！</p>`;
      renderHome();
      engine.think("✨");
      engine.setMood("happy", 160);
    };
    $("evoChoices").appendChild(card);
  });
};

// battle UI
function syncBattleSprites() {
  engine.paintSpriteTo(engine.me.getContext("2d"));
  // foe placeholder: mirrored dim copy or blank cpu art
  const fctx = engine.foe.getContext("2d");
  fctx.clearRect(0, 0, 64, 64);
  fctx.fillStyle = "#1a1d2d";
  fctx.fillRect(8, 12, 48, 44);
  fctx.fillStyle = "#ffd166";
  fctx.fillRect(20, 22, 8, 8);
  fctx.fillRect(36, 22, 8, 8);
  $("meName").textContent = save.hatched ? save.name : "未出巢";
}

function setHp(el, unit) {
  const pct = (unit.hp / unit.maxHp) * 100;
  el.style.width = `${pct}%`;
  el.classList.toggle("low", pct < 30);
}

function setBattleMoves(on) {
  document.querySelectorAll("#battlePad [data-move]").forEach((b) => (b.disabled = !on));
}

function logBattle(msg) {
  $("battleLog").textContent = msg;
}

function endBattle(winner) {
  setBattleMoves(false);
  if (!save.hatched) return;
  if (winner === "a") {
    save.stats.battlesWon += 1;
    save.stats.bond = Math.min(100, save.stats.bond + 4);
    save.stats.mood = Math.min(100, save.stats.mood + 8);
    logBattle("勝利！育成成果有效。");
  } else if (winner === "b") {
    save.stats.battlesLost += 1;
    save.stats.mood = Math.max(0, save.stats.mood - 6);
    logBattle("敗北…回去訓練再戰。");
  } else logBattle("平手。");
  persist();
  renderHome();
  battle = null;
}

function startPractice() {
  if (!save.hatched) {
    logBattle("先去創作出巢。");
    return;
  }
  syncBattleSprites();
  const meF = fighterFromSave(save, engine.me);
  const foeF = makeCpuFighter(save.stage);
  battle = { me: meF, foe: foeF, mode: "cpu" };
  $("battleModeChip").textContent = "練習";
  $("foeName").textContent = foeF.name;
  setHp($("meHp"), meF);
  setHp($("foeHp"), foeF);
  setBattleMoves(true);
  logBattle("練習戰開始！揀招式。");
}

function playerMove(move) {
  if (!battle) return;
  if (battle.mode === "cpu") {
    const foeM = cpuMove(battle.foe, battle.me);
    const result = resolveTurn(battle.me, move, battle.foe, foeM);
    battle.me = result.a;
    battle.foe = result.b;
    setHp($("meHp"), battle.me);
    setHp($("foeHp"), battle.foe);
    logBattle(result.log.join(" / "));
    if (result.winner) endBattle(result.winner);
    return;
  }
  if (battle.mode === "net") {
    if (awaitingNetMove) return;
    if (netRole === "host") {
      battle.pendingHostMove = move;
      logBattle("已出招，等對手…");
      awaitingNetMove = true;
      maybeResolveNet();
    } else {
      net.send({ type: "move", move });
      logBattle("已出招，等待同步…");
      awaitingNetMove = true;
    }
  }
}

function maybeResolveNet() {
  if (!battle || battle.mode !== "net" || netRole !== "host") return;
  if (!battle.pendingHostMove || !battle.pendingGuestMove) return;
  const result = resolveTurn(battle.me, battle.pendingHostMove, battle.foe, battle.pendingGuestMove);
  battle.me = result.a;
  battle.foe = result.b;
  battle.pendingHostMove = null;
  battle.pendingGuestMove = null;
  awaitingNetMove = false;
  const payload = {
    type: "turn",
    meHp: battle.me.hp,
    foeHp: battle.foe.hp,
    log: result.log,
    winner: result.winner,
  };
  net.send(payload);
  applyNetTurn(payload, true);
}

function applyNetTurn(payload, asHost) {
  if (!battle) return;
  // host is always "me" locally for host; guest sees swapped hp bars
  if (asHost) {
    battle.me.hp = payload.meHp;
    battle.foe.hp = payload.foeHp;
  } else {
    battle.me.hp = payload.foeHp;
    battle.foe.hp = payload.meHp;
  }
  setHp($("meHp"), battle.me);
  setHp($("foeHp"), battle.foe);
  logBattle(payload.log.join(" / "));
  awaitingNetMove = false;
  if (payload.winner) {
    const localWin =
      payload.winner === "draw"
        ? "draw"
        : (asHost && payload.winner === "a") || (!asHost && payload.winner === "b")
          ? "a"
          : "b";
    endBattle(localWin);
  }
}

$("practiceBtn").onclick = startPractice;
$("battlePad").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-move]");
  if (!btn || btn.disabled) return;
  playerMove(btn.dataset.move);
});

function setupNet() {
  if (net) net.destroy();
  net = createNetController({
    onStatus: (msg) => ($("netStatus").textContent = msg),
    onReady: ({ isHost }) => {
      netRole = isHost ? "host" : "guest";
      $("battleModeChip").textContent = "連線";
      if (!save.hatched) {
        logBattle("未出巢不能對戰");
        return;
      }
      syncBattleSprites();
      const meF = fighterFromSave(save, engine.me);
      // temporary foe stats until handshake snapshot arrives
      const foeF = makeCpuFighter(save.stage);
      foeF.name = "對手";
      battle = { me: meF, foe: foeF, mode: "net", pendingHostMove: null, pendingGuestMove: null };
      setHp($("meHp"), meF);
      setHp($("foeHp"), foeF);
      setBattleMoves(true);
      logBattle(isHost ? "對手已到，你先當主機同步回合" : "已連線，等待主機");
      net.send({
        type: "hello",
        name: save.name,
        power: meF,
      });
    },
    onMessage: (data) => {
      if (!data || !data.type) return;
      if (data.type === "hello") {
        $("foeName").textContent = data.name || "對手";
        if (battle) {
          battle.foe = {
            name: data.name || "對手",
            hp: data.power.hp,
            maxHp: data.power.maxHp,
            atk: data.power.atk,
            spd: data.power.spd,
            mag: data.power.mag,
            guarding: false,
          };
          setHp($("foeHp"), battle.foe);
        }
      }
      if (data.type === "move" && netRole === "host") {
        battle.pendingGuestMove = data.move;
        maybeResolveNet();
      }
      if (data.type === "turn" && netRole === "guest") {
        applyNetTurn(data, false);
      }
    },
  });
}

$("hostBtn").onclick = async () => {
  try {
    setupNet();
    const room = await net.host();
    $("roomCode").value = room;
  } catch (err) {
    $("netStatus").textContent = err.message || String(err);
  }
};

$("joinBtn").onclick = async () => {
  try {
    setupNet();
    await net.join($("roomCode").value);
  } catch (err) {
    $("netStatus").textContent = err.message || String(err);
  }
};

// idle tick every minute while page open
setInterval(() => {
  if (!save.hatched) return;
  const ticked = tickRaise(save);
  save = ticked.save;
  persist();
  renderHome();
}, 60000);

$("nameInput").addEventListener("input", (e) => {
  engine.meta.name = e.target.value || "未命名獸";
  engine.renderEditor();
});

boot();
