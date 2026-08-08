import {
  W,
  H,
  clamp,
  rgb,
  hx,
  setp,
  getp,
  makeImage,
  cloneImage,
  buildTemplate,
  applyOutline,
  mirrorX,
  flood,
  line,
  rect,
  ellipse,
  makePhotoDraft,
  materialFromPalette,
  elementFromPalette,
  suggestName,
  effectiveMove,
  drawExpression,
  evoVariant,
  imageToBase64,
  base64ToImage,
} from "./pixel.js";

export function createSpriteEngine() {
  const edit = document.getElementById("editCanvas");
  const ectx = edit.getContext("2d", { willReadFrequently: true });
  const room = document.getElementById("roomCanvas");
  const rctx = room.getContext("2d");
  const preview = document.getElementById("previewCanvas");
  const pctx = preview.getContext("2d");
  const me = document.getElementById("meCanvas");
  const mctx = me.getContext("2d");
  const foe = document.getElementById("foeCanvas");
  const fctx = foe.getContext("2d");

  let img = makeImage(ectx);
  let draft = makeImage(ectx);
  let hasDraft = false;
  let tool = "pen";
  let drawing = false;
  let start = null;
  let undo = [];
  let faceMove = null;
  let faceLast = null;
  let exprDrag = false;
  let lastPhoto = null;
  let seed = 12345;
  let roomState = { x: 220, y: 250, targetX: 480, facing: 1, thought: "", timer: 0 };
  let expr = { mood: "neutral", timer: 0 };
  let face = {
    enabled: true,
    eyes: true,
    mouth: true,
    handles: true,
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
  let meta = {
    name: "未命名獸",
    palette: ["#ff6b6b", "#ffd166", "#58c7ff", "#ffffff", "#1a1d2d", "#4be38f"],
    template: "humanoid",
    move: "auto",
    material: "未抽取",
    element: "火",
  };

  function push() {
    undo.push(new Uint8ClampedArray(img.data));
    if (undo.length > 40) undo.shift();
  }

  function composite() {
    const out = makeImage(ectx);
    out.data.set(draft.data);
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] > 0) {
        out.data[i] = img.data[i];
        out.data[i + 1] = img.data[i + 1];
        out.data[i + 2] = img.data[i + 2];
        out.data[i + 3] = img.data[i + 3];
      }
    }
    return out;
  }

  function mergeDraft() {
    if (!hasDraft) return;
    for (let i = 0; i < draft.data.length; i += 4) {
      if (draft.data[i + 3] > 0 && img.data[i + 3] === 0) {
        img.data[i] = draft.data[i];
        img.data[i + 1] = draft.data[i + 1];
        img.data[i + 2] = draft.data[i + 2];
        img.data[i + 3] = draft.data[i + 3];
      }
    }
    draft = makeImage(ectx);
    hasDraft = false;
  }

  function renderEditor() {
    ectx.putImageData(composite(), 0, 0);
    drawExpression(ectx, expr, { ...face, handles: face.handles && (!!faceMove || exprDrag) });
    drawPreview();
  }

  function drawPreview() {
    pctx.clearRect(0, 0, 128, 128);
    const g = pctx.createLinearGradient(0, 0, 128, 128);
    g.addColorStop(0, "#1e2b58");
    g.addColorStop(1, "#111629");
    pctx.fillStyle = g;
    pctx.fillRect(0, 0, 128, 128);
    pctx.drawImage(edit, 32, 20, 64, 64);
    pctx.fillStyle = "#eef4ff";
    pctx.font = "12px sans-serif";
    pctx.fillText(meta.name.slice(0, 10), 12, 110);
  }

  function paintSpriteTo(ctx2d, size = 64) {
    ctx2d.clearRect(0, 0, size, size);
    ctx2d.imageSmoothingEnabled = false;
    ctx2d.drawImage(edit, 0, 0, size, size);
  }

  function updatePaletteUI() {
    const pal = document.getElementById("palette");
    pal.innerHTML = "";
    meta.palette.forEach((h) => {
      const d = document.createElement("div");
      d.className = "swatch";
      d.style.background = h;
      d.onclick = () => (document.getElementById("paintColor").value = h);
      pal.appendChild(d);
    });
  }

  function pos(e) {
    const r = edit.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * H);
    return { x: clamp(x, 0, 63), y: clamp(y, 0, 63) };
  }

  function paintAt(e) {
    const p = pos(e);
    const col = rgb(document.getElementById("paintColor").value);
    const rad = e.shiftKey ? 2 : 1;
    if (tool === "pick") {
      const c = getp(composite(), p.x, p.y);
      if (c[3] > 0) document.getElementById("paintColor").value = hx(c[0], c[1], c[2]);
      return;
    }
    if (tool === "fill") {
      flood(img, p.x, p.y, col);
      renderEditor();
      return;
    }
    for (let yy = -rad; yy <= rad; yy++)
      for (let xx = -rad; xx <= rad; xx++)
        if (xx * xx + yy * yy <= rad * rad) {
          if (tool === "erase") setp(img, p.x + xx, p.y + yy, [0, 0, 0], 0);
          else setp(img, p.x + xx, p.y + yy, col);
        }
    renderEditor();
  }

  function shapePreview(e) {
    const p = pos(e);
    const col = rgb(document.getElementById("paintColor").value);
    if (!start) return;
    const temp = makeImage(ectx);
    temp.data.set(img.data);
    if (tool === "line") line(temp, start.x, start.y, p.x, p.y, col);
    if (tool === "rect") rect(temp, start.x, start.y, p.x, p.y, col);
    if (tool === "ellipse")
      ellipse(
        temp,
        (start.x + p.x) / 2,
        (start.y + p.y) / 2,
        Math.max(1, Math.abs(p.x - start.x) / 2),
        Math.max(1, Math.abs(p.y - start.y) / 2),
        col,
      );
    ectx.putImageData(temp, 0, 0);
  }

  function moveFace(target, dx, dy) {
    if (target === "eyes" || target === "face") {
      face.eyeLX = clamp(face.eyeLX + dx, 0, 63);
      face.eyeLY = clamp(face.eyeLY + dy, 0, 63);
      face.eyeRX = clamp(face.eyeRX + dx, 0, 63);
      face.eyeRY = clamp(face.eyeRY + dy, 0, 63);
    }
    if (target === "m" || target === "face") {
      face.mouthX = clamp(face.mouthX + dx, 0, 63);
      face.mouthY = clamp(face.mouthY + dy, 0, 63);
    }
    if (target === "l") {
      face.eyeLX = clamp(face.eyeLX + dx, 0, 63);
      face.eyeLY = clamp(face.eyeLY + dy, 0, 63);
    }
    if (target === "r") {
      face.eyeRX = clamp(face.eyeRX + dx, 0, 63);
      face.eyeRY = clamp(face.eyeRY + dy, 0, 63);
    }
  }

  function setFacePoint(target, p) {
    if (target === "l") {
      face.eyeLX = p.x;
      face.eyeLY = p.y;
    }
    if (target === "r") {
      face.eyeRX = p.x;
      face.eyeRY = p.y;
    }
    if (target === "m") {
      face.mouthX = p.x;
      face.mouthY = p.y;
    }
  }

  edit.addEventListener("pointerdown", (e) => {
    edit.setPointerCapture?.(e.pointerId);
    const p = pos(e);
    if (faceMove) {
      exprDrag = true;
      faceLast = p;
      if (faceMove === "l" || faceMove === "r" || faceMove === "m") setFacePoint(faceMove, p);
      renderEditor();
      return;
    }
    drawing = true;
    if (hasDraft && tool !== "pick") mergeDraft();
    push();
    start = p;
    if (["line", "rect", "ellipse"].includes(tool)) shapePreview(e);
    else paintAt(e);
  });
  edit.addEventListener("pointermove", (e) => {
    if (exprDrag) {
      const p = pos(e);
      const dx = p.x - faceLast.x,
        dy = p.y - faceLast.y;
      if (faceMove === "eyes" || faceMove === "face") moveFace(faceMove, dx, dy);
      else if (faceMove === "l" || faceMove === "r" || faceMove === "m") setFacePoint(faceMove, p);
      faceLast = p;
      renderEditor();
      return;
    }
    if (!drawing) return;
    if (["line", "rect", "ellipse"].includes(tool)) shapePreview(e);
    else paintAt(e);
  });
  window.addEventListener("pointerup", (e) => {
    if (exprDrag) {
      exprDrag = false;
      faceLast = null;
      return;
    }
    if (!drawing) return;
    if (["line", "rect", "ellipse"].includes(tool)) {
      const p = pos(e);
      const col = rgb(document.getElementById("paintColor").value);
      if (tool === "line") line(img, start.x, start.y, p.x, p.y, col);
      if (tool === "rect") rect(img, start.x, start.y, p.x, p.y, col);
      if (tool === "ellipse")
        ellipse(
          img,
          (start.x + p.x) / 2,
          (start.y + p.y) / 2,
          Math.max(1, Math.abs(p.x - start.x) / 2),
          Math.max(1, Math.abs(p.y - start.y) / 2),
          col,
        );
      renderEditor();
    }
    drawing = false;
    start = null;
  });

  function useTemplate(type) {
    meta.template = type;
    const built = buildTemplate(ectx, type, meta.palette);
    draft = built.im;
    hasDraft = !built.empty;
    if (built.empty) {
      draft = makeImage(ectx);
      hasDraft = false;
    }
    renderEditor();
  }

  function applyPhoto(fileImg) {
    lastPhoto = fileImg;
    const fit = document.getElementById("photoFitSel").value;
    const bg = document.getElementById("bgRemoveSel").value;
    const out = makePhotoDraft(ectx, fileImg, fit, bg, 55);
    draft = out.draft;
    hasDraft = true;
    meta.palette = out.palette;
    meta.material = materialFromPalette(meta.palette);
    meta.element = elementFromPalette(meta.palette);
    seed = out.seed;
    meta.name = suggestName(meta.palette);
    document.getElementById("nameInput").value = meta.name;
    document.getElementById("paintColor").value = meta.palette[2];
    document.getElementById("matText").textContent =
      `草稿完成 · ${meta.material} · 保留 ${out.kept}px / 移除 ${out.removed}px`;
    updatePaletteUI();
    renderEditor();
  }

  function randomMaterial() {
    meta.palette = [0, 1, 2, 3, 4, 5].map(() => hx(Math.random() * 255, Math.random() * 255, Math.random() * 255));
    meta.material = materialFromPalette(meta.palette);
    meta.element = elementFromPalette(meta.palette);
    meta.name = suggestName(meta.palette);
    document.getElementById("nameInput").value = meta.name;
    document.getElementById("paintColor").value = meta.palette[2];
    document.getElementById("matText").textContent = `隨機材料：${meta.material}`;
    updatePaletteUI();
    useTemplate(document.getElementById("templateSel").value);
  }

  function blank() {
    img = makeImage(ectx);
    draft = makeImage(ectx);
    hasDraft = false;
    document.getElementById("matText").textContent = "空白畫布";
    renderEditor();
  }

  function bake() {
    if (!hasDraft) useTemplate(meta.template);
    push();
    mergeDraft();
    renderEditor();
  }

  function setMood(m, frames = 120) {
    expr.mood = m;
    expr.timer = frames;
    renderEditor();
  }

  function drawRoom(t) {
    rctx.clearRect(0, 0, 720, 420);
    rctx.fillStyle = "#0f1730";
    rctx.fillRect(0, 0, 720, 240);
    rctx.fillStyle = "#173630";
    rctx.fillRect(0, 240, 720, 180);
    for (let x = 0; x < 720; x += 24) {
      rctx.strokeStyle = "rgba(255,255,255,.04)";
      rctx.beginPath();
      rctx.moveTo(x, 0);
      rctx.lineTo(x, 420);
      rctx.stroke();
    }
    // poop markers drawn by UI layer via roomState.poop if set externally
    if (roomState.poop > 0) {
      for (let i = 0; i < roomState.poop; i++) {
        rctx.font = "28px sans-serif";
        rctx.fillText("💩", 120 + i * 50, 340);
      }
    }

    if (Math.abs(roomState.targetX - roomState.x) < 3) roomState.targetX = 80 + Math.random() * 560;
    const mv = effectiveMove(meta.template, meta.move);
    const sp = mv === "fly" || mv === "roll" || mv === "glitch" ? 2 : 1.2;
    roomState.facing = roomState.targetX >= roomState.x ? 1 : -1;
    if (!roomState.frozen) roomState.x += Math.sign(roomState.targetX - roomState.x) * sp;

    let yOff = 0,
      rot = 0,
      sx = 1,
      sy = 1,
      alpha = 1,
      time = t / 1000;
    if (mv === "hop") {
      yOff = -Math.abs(Math.sin(time * 6)) * 26;
      sy = 1 + Math.max(0, Math.sin(time * 6 - 0.4)) * 0.08;
      sx = 1 - (sy - 1) * 0.5;
    }
    if (mv === "float") {
      yOff = Math.sin(time * 2.2) * 12 - 10;
      rot = Math.sin(time * 1.7) * 0.05;
    }
    if (mv === "walk") {
      yOff = -Math.abs(Math.sin(time * 8)) * 5;
      rot = Math.sin(time * 10) * 0.08;
    }
    if (mv === "fly") {
      yOff = Math.sin(time * 7) * 9 - 45;
      rot = Math.sin(time * 5) * 0.08;
    }
    if (mv === "roll") {
      rot = time * 4 * roomState.facing;
      yOff = -3;
    }

    rctx.fillStyle = "rgba(0,0,0,.28)";
    rctx.beginPath();
    rctx.ellipse(roomState.x, roomState.y + 52, 60 * (1 - Math.min(Math.abs(yOff) / 90, 0.45)), 12, 0, 0, Math.PI * 2);
    rctx.fill();
    rctx.save();
    rctx.globalAlpha = alpha;
    rctx.translate(roomState.x, roomState.y + yOff);
    rctx.rotate(rot);
    rctx.scale(roomState.facing * 2.4 * sx, 2.4 * sy);
    rctx.drawImage(edit, -32, -32, 64, 64);
    rctx.restore();

    if (expr.timer > 0) {
      expr.timer--;
      if (expr.timer === 0) {
        expr.mood = "neutral";
        renderEditor();
      }
    }
    if (roomState.timer > 0) {
      roomState.timer--;
      rctx.fillStyle = "white";
      rctx.beginPath();
      rctx.roundRect(roomState.x + 38, roomState.y + yOff - 90, 62, 32, 8);
      rctx.fill();
      rctx.fillStyle = "#111629";
      rctx.font = "20px sans-serif";
      rctx.fillText(roomState.thought, roomState.x + 50, roomState.y + yOff - 68);
    }
    requestAnimationFrame(drawRoom);
  }

  async function loadFromSave(save) {
    meta.name = save.name;
    meta.palette = save.palette;
    meta.template = save.template;
    meta.move = save.move || "auto";
    meta.material = save.material;
    meta.element = save.element;
    face = { ...face, ...save.face, handles: false };
    if (save.sprite) img = await base64ToImage(ectx, save.sprite);
    else {
      useTemplate(save.template || "humanoid");
      mergeDraft();
    }
    draft = makeImage(ectx);
    hasDraft = false;
    document.getElementById("nameInput").value = save.name;
    updatePaletteUI();
    renderEditor();
  }

  function exportSavePatch() {
    mergeDraft();
    renderEditor();
    return {
      name: document.getElementById("nameInput").value || meta.name,
      palette: meta.palette,
      template: meta.template,
      move: meta.move,
      material: meta.material,
      element: meta.element,
      sprite: imageToBase64(ectx, img),
      face: { ...face, handles: false },
    };
  }

  function makeEvoPreview(kind) {
    mergeDraft();
    return evoVariant(ectx, img, kind, meta.palette);
  }

  function applyImage(im) {
    push();
    img = cloneImage(ectx, im);
    renderEditor();
  }

  // init starter
  useTemplate("humanoid");
  mergeDraft();
  updatePaletteUI();
  renderEditor();
  requestAnimationFrame(drawRoom);

  return {
    edit,
    me,
    foe,
    meta,
    face,
    expr,
    roomState,
    setTool(t) {
      tool = t;
    },
    setFaceMove(t) {
      faceMove = t || null;
      face.handles = !!faceMove;
      renderEditor();
    },
    undo() {
      const u = undo.pop();
      if (!u) return;
      img.data.set(u);
      renderEditor();
    },
    mirror() {
      if (hasDraft) mergeDraft();
      push();
      img = mirrorX(ectx, img);
      renderEditor();
    },
    outline() {
      if (hasDraft) mergeDraft();
      push();
      applyOutline(img);
      renderEditor();
    },
    bake,
    useTemplate,
    applyPhoto,
    randomMaterial,
    blank,
    setMood,
    renderEditor,
    paintSpriteTo,
    loadFromSave,
    exportSavePatch,
    makeEvoPreview,
    applyImage,
    refreshPhoto() {
      if (lastPhoto) applyPhoto(lastPhoto);
    },
    think(text) {
      roomState.thought = text;
      roomState.timer = 90;
      roomState.targetX = 80 + Math.random() * 560;
    },
  };
}
