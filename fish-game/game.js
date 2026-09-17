/* おさかな育成 〜 My Aquarium 〜
 * ブラウザだけで遊べる、育成系アクアリウムゲーム。
 */
(() => {
  "use strict";

  const SAVE_KEY = "fishGameSave_v1";
  const TANK_W = 900;
  const TANK_H = 560;
  const AUTOSAVE_MS = 5000;

  // ---------------------------------------------------------------
  // マスターデータ
  // ---------------------------------------------------------------

  const SPECIES = [
    { id: "goldfish", name: "きんぎょ", cost: 0, baseColor: "#ff7d3c", accent: "#ffd166", scale: 1.0, tail: "round" },
    { id: "guppy", name: "グッピー", cost: 30, baseColor: "#4fc3ff", accent: "#ffef6f", scale: 0.75, tail: "fan" },
    { id: "neon", name: "ネオンテトラ", cost: 60, baseColor: "#39d3ff", accent: "#ff4d6d", scale: 0.7, tail: "fork" },
    { id: "clown", name: "クマノミ", cost: 100, baseColor: "#ff6a3c", accent: "#ffffff", scale: 0.9, tail: "round" },
    { id: "betta", name: "ベタ", cost: 90, baseColor: "#a259ff", accent: "#ff8ad8", scale: 0.85, tail: "flow" },
    { id: "koi", name: "にしきごい", cost: 150, baseColor: "#ffffff", accent: "#ff5b5b", scale: 1.25, tail: "fork" },
    { id: "shark", name: "ミニシャーク", cost: 400, baseColor: "#8fa3b3", accent: "#e8eef2", scale: 1.6, tail: "shark" },
  ];

  const DECOR = [
    { id: "weed", name: "水草", cost: 20, desc: "なかよし度の回復が少し上がる", emoji: "🌿" },
    { id: "rock", name: "岩", cost: 15, desc: "水そうがにぎやかになる", emoji: "🪨" },
    { id: "chest", name: "たから箱", cost: 80, desc: "たまに泡が出てにぎやか", emoji: "🧰" },
    { id: "castle", name: "おしろ", cost: 150, desc: "なかよし度の回復が上がる", emoji: "🏰" },
    { id: "ship", name: "ちんぼつ船", cost: 220, desc: "水そうが豪華になる", emoji: "🚢" },
  ];

  const STAGE_NAMES = ["稚魚", "若魚", "成魚", "大物"];
  const STAGE_EXP = [0, 20, 60, 150]; // exp required to REACH this stage index

  // ---------------------------------------------------------------
  // 状態
  // ---------------------------------------------------------------

  /** @type {Array<any>} */
  let fishes = [];
  let foods = [];
  let bubbles = [];
  let coins = 20;
  let dirtiness = 0; // 0-100
  let maxSlots = 5;
  let expansions = 0;
  let nextFishSerial = 1;
  let lastFrameTime = performance.now();
  let lastTickSecond = performance.now();

  // ---------------------------------------------------------------
  // ユーティリティ
  // ---------------------------------------------------------------

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const speciesById = (id) => SPECIES.find((s) => s.id === id);
  const decorById = (id) => DECOR.find((d) => d.id === id);

  function stageOf(exp) {
    let s = 0;
    for (let i = 0; i < STAGE_EXP.length; i++) {
      if (exp >= STAGE_EXP[i]) s = i;
    }
    return s;
  }

  function makeFish(speciesId, opts) {
    const sp = speciesById(speciesId);
    const fish = {
      uid: nextFishSerial++,
      speciesId,
      name: sp.name,
      x: rand(80, TANK_W - 80),
      y: rand(80, TANK_H - 140),
      vx: rand(-1, 1) || 0.6,
      vy: 0,
      dir: Math.random() < 0.5 ? 1 : -1,
      wiggle: Math.random() * Math.PI * 2,
      hunger: 80,
      happiness: 80,
      exp: 0,
      stage: 0,
      eatCooldown: 0,
      targetFoodId: null,
      swimTimer: rand(1, 3),
      mouthOpen: 0,
      ...opts,
    };
    return fish;
  }

  // ---------------------------------------------------------------
  // セーブ / ロード
  // ---------------------------------------------------------------

  function save() {
    const data = {
      coins,
      dirtiness,
      maxSlots,
      expansions,
      nextFishSerial,
      ownedDecor,
      fishes: fishes.map((f) => ({
        uid: f.uid,
        speciesId: f.speciesId,
        name: f.name,
        hunger: f.hunger,
        happiness: f.happiness,
        exp: f.exp,
      })),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      /* storage unavailable — ignore */
    }
  }

  function load() {
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch (e) {
      raw = null;
    }
    if (!raw) {
      fishes = [makeFish("goldfish", {})];
      return;
    }
    try {
      const data = JSON.parse(raw);
      coins = data.coins ?? 20;
      dirtiness = data.dirtiness ?? 0;
      maxSlots = data.maxSlots ?? 5;
      expansions = data.expansions ?? 0;
      nextFishSerial = data.nextFishSerial ?? 1;
      ownedDecor = data.ownedDecor ?? [];
      fishes = (data.fishes ?? []).map((f) =>
        makeFish(f.speciesId, {
          uid: f.uid,
          name: f.name,
          hunger: f.hunger,
          happiness: f.happiness,
          exp: f.exp,
          stage: stageOf(f.exp),
        })
      );
      if (fishes.length === 0) fishes = [makeFish("goldfish", {})];
      nextFishSerial = Math.max(nextFishSerial, ...fishes.map((f) => f.uid + 1), 1);
    } catch (e) {
      fishes = [makeFish("goldfish", {})];
    }
  }

  let ownedDecor = [];

  function resetGame() {
    if (!confirm("本当に最初からやりなおしますか?この操作は取り消せません。")) return;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    coins = 20;
    dirtiness = 0;
    maxSlots = 5;
    expansions = 0;
    nextFishSerial = 1;
    ownedDecor = [];
    fishes = [makeFish("goldfish", {})];
    foods = [];
    log("水そうをリセットしました。新しい気持ちでスタート!");
    renderShops();
  }

  // ---------------------------------------------------------------
  // DOM 参照
  // ---------------------------------------------------------------

  const canvas = document.getElementById("tank");
  const ctx = canvas.getContext("2d");
  const coinCountEl = document.getElementById("coin-count");
  const happyAvgEl = document.getElementById("happy-avg");
  const fishCountEl = document.getElementById("fish-count");
  const fishMaxEl = document.getElementById("fish-max");
  const feedBtn = document.getElementById("feed-btn");
  const cleanBtn = document.getElementById("clean-btn");
  const saveBtn = document.getElementById("save-btn");
  const resetBtn = document.getElementById("reset-btn");
  const shopFishList = document.getElementById("shop-fish-list");
  const shopDecoList = document.getElementById("shop-deco-list");
  const fishInfoList = document.getElementById("fish-info-list");
  const toastArea = document.getElementById("toast-area");
  const logText = document.getElementById("log-text");

  function log(msg) {
    logText.textContent = msg;
  }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    toastArea.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ---------------------------------------------------------------
  // タブ切り替え
  // ---------------------------------------------------------------

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // ---------------------------------------------------------------
  // ショップ描画
  // ---------------------------------------------------------------

  function expansionCost() {
    return 200 * (expansions + 1);
  }

  function renderShops() {
    // 魚ショップ
    shopFishList.innerHTML = "";
    SPECIES.forEach((sp) => {
      const owned = fishes.filter((f) => f.speciesId === sp.id).length;
      const row = document.createElement("div");
      row.className = "shop-item";
      row.innerHTML = `
        <div class="swatch" style="background:${sp.baseColor}"></div>
        <div class="info">
          <div class="name">${sp.name} ${owned > 0 ? `<span style="color:#9fd">×${owned}</span>` : ""}</div>
          <div class="desc">${sp.cost === 0 ? "はじめから飼える" : sp.cost + " コイン"}</div>
        </div>
        <button class="buy-btn">${sp.cost === 0 ? "追加" : "購入"}</button>
      `;
      const btn = row.querySelector(".buy-btn");
      const canAfford = coins >= sp.cost;
      const hasSlot = fishes.length < maxSlots;
      btn.disabled = !canAfford || !hasSlot;
      if (!hasSlot) btn.textContent = "満員";
      btn.addEventListener("click", () => buyFish(sp.id));
      shopFishList.appendChild(row);
    });

    const expRow = document.createElement("div");
    expRow.className = "shop-item";
    expRow.innerHTML = `
      <div class="swatch" style="background:#334">🪣</div>
      <div class="info">
        <div class="name">水そうを拡張 (+2枠)</div>
        <div class="desc">現在 ${maxSlots} 枠 / ${expansionCost()} コイン</div>
      </div>
      <button class="buy-btn">拡張</button>
    `;
    const expBtn = expRow.querySelector(".buy-btn");
    expBtn.disabled = coins < expansionCost();
    expBtn.addEventListener("click", buyExpansion);
    shopFishList.appendChild(expRow);

    // かざりショップ
    shopDecoList.innerHTML = "";
    DECOR.forEach((d) => {
      const owned = ownedDecor.includes(d.id);
      const row = document.createElement("div");
      row.className = "shop-item";
      row.innerHTML = `
        <div class="swatch" style="background:#1c5a7a;display:flex;align-items:center;justify-content:center;font-size:18px;">${d.emoji}</div>
        <div class="info">
          <div class="name">${d.name}</div>
          <div class="desc">${owned ? "設置ずみ" : d.desc + " ・ " + d.cost + " コイン"}</div>
        </div>
        <button class="buy-btn">${owned ? "済" : "購入"}</button>
      `;
      const btn = row.querySelector(".buy-btn");
      btn.disabled = owned || coins < d.cost;
      btn.addEventListener("click", () => buyDecor(d.id));
      shopDecoList.appendChild(row);
    });
  }

  function buyFish(speciesId) {
    const sp = speciesById(speciesId);
    if (fishes.length >= maxSlots) {
      toast("水そうがいっぱいです!");
      return;
    }
    if (fishes.some((f) => f.speciesId === speciesId) === false && sp.cost === 0) {
      // free starter species, still allow multiples freely if cost 0
    }
    if (coins < sp.cost) {
      toast("コインが足りません");
      return;
    }
    coins -= sp.cost;
    fishes.push(makeFish(speciesId, {}));
    toast(`${sp.name} が仲間になった!`);
    log(`${sp.name} を水そうに迎えました。`);
    renderShops();
    updateStatsUI();
  }

  function buyExpansion() {
    const cost = expansionCost();
    if (coins < cost) {
      toast("コインが足りません");
      return;
    }
    coins -= cost;
    expansions++;
    maxSlots += 2;
    toast(`水そうが拡張された! (最大${maxSlots}匹)`);
    renderShops();
    updateStatsUI();
  }

  function buyDecor(id) {
    const d = decorById(id);
    if (ownedDecor.includes(id)) return;
    if (coins < d.cost) {
      toast("コインが足りません");
      return;
    }
    coins -= d.cost;
    ownedDecor.push(id);
    toast(`${d.name} を設置した!`);
    renderShops();
    updateStatsUI();
  }

  // ---------------------------------------------------------------
  // 魚図鑑パネル
  // ---------------------------------------------------------------

  function renderFishInfo() {
    fishInfoList.innerHTML = "";
    fishes.forEach((f) => {
      const sp = speciesById(f.speciesId);
      const stageName = STAGE_NAMES[f.stage];
      const nextExp = STAGE_EXP[f.stage + 1];
      const row = document.createElement("div");
      row.className = "fish-info-item";
      row.innerHTML = `
        <div class="swatch" style="background:${sp.baseColor}"></div>
        <div class="info">
          <div class="name">${f.name} <span style="color:#9fd;font-weight:400;">(${stageName})</span></div>
          <div class="bar-row">満腹<div class="bar-track"><div class="bar-fill hunger" style="width:${f.hunger}%"></div></div></div>
          <div class="bar-row">なかよし<div class="bar-track"><div class="bar-fill happy" style="width:${f.happiness}%"></div></div></div>
          <div class="bar-row">成長${nextExp ? "" : "(MAX)"}<div class="bar-track"><div class="bar-fill growth" style="width:${nextExp ? clamp((f.exp - STAGE_EXP[f.stage]) / (nextExp - STAGE_EXP[f.stage]) * 100, 0, 100) : 100}%"></div></div></div>
        </div>
      `;
      fishInfoList.appendChild(row);
    });
  }

  // ---------------------------------------------------------------
  // ゲームロジック更新 (毎秒)
  // ---------------------------------------------------------------

  function tickSecond() {
    let happinessSum = 0;
    const decorBonus = 1 + (ownedDecor.includes("weed") ? 0.15 : 0) + (ownedDecor.includes("castle") ? 0.25 : 0);
    const dirtPenalty = clamp(1 - dirtiness / 150, 0.3, 1);

    fishes.forEach((f) => {
      f.hunger = clamp(f.hunger - 0.9, 0, 100);
      if (f.hunger <= 0) {
        f.happiness = clamp(f.happiness - 1.2, 0, 100);
      } else if (f.hunger > 50) {
        f.happiness = clamp(f.happiness + 0.4 * decorBonus * dirtPenalty, 0, 100);
      }
      happinessSum += f.happiness;

      // 成長: 満腹となかよしが十分なら経験値が増える
      if (f.hunger > 20 && f.happiness > 20) {
        const growthMul = f.happiness > 50 ? 1 : 0.5;
        f.exp += 0.6 * growthMul;
        const newStage = stageOf(f.exp);
        if (newStage > f.stage) {
          f.stage = newStage;
          const bonus = 10 * (newStage + 1);
          coins += bonus;
          toast(`${f.name} が ${STAGE_NAMES[newStage]} に成長!(+${bonus}コイン)`);
          log(`${f.name} が成長して ${STAGE_NAMES[newStage]} になりました!`);
        }
      }
    });

    dirtiness = clamp(dirtiness + fishes.length * 0.25, 0, 100);

    const avgHappy = fishes.length ? happinessSum / fishes.length : 0;
    const passiveCoins = fishes.length * 0.4 * (avgHappy / 100) * dirtPenalty;
    coins += passiveCoins;

    updateStatsUI();
    renderFishInfo();
    // ショップのボタン活性/非活性はコイン変動に応じ都度更新
    renderShopButtonsOnly();
  }

  function renderShopButtonsOnly() {
    // 軽量版: 金額に応じて購入ボタンの有効/無効だけ切り替える
    const fishBtns = shopFishList.querySelectorAll(".shop-item");
    fishBtns.forEach((row, idx) => {
      const btn = row.querySelector(".buy-btn");
      if (!btn) return;
      if (idx < SPECIES.length) {
        const sp = SPECIES[idx];
        const hasSlot = fishes.length < maxSlots;
        btn.disabled = coins < sp.cost || !hasSlot;
      } else {
        btn.disabled = coins < expansionCost();
      }
    });
    const decoBtns = shopDecoList.querySelectorAll(".shop-item");
    decoBtns.forEach((row, idx) => {
      const btn = row.querySelector(".buy-btn");
      if (!btn) return;
      const d = DECOR[idx];
      const owned = ownedDecor.includes(d.id);
      btn.disabled = owned || coins < d.cost;
    });
  }

  function updateStatsUI() {
    coinCountEl.textContent = Math.floor(coins);
    const avgHappy = fishes.length ? fishes.reduce((s, f) => s + f.happiness, 0) / fishes.length : 0;
    happyAvgEl.textContent = Math.round(avgHappy);
    fishCountEl.textContent = fishes.length;
    fishMaxEl.textContent = maxSlots;
  }

  // ---------------------------------------------------------------
  // エサ・そうじ
  // ---------------------------------------------------------------

  feedBtn.addEventListener("click", () => {
    const n = 5;
    for (let i = 0; i < n; i++) {
      foods.push({
        id: Math.random().toString(36).slice(2),
        x: rand(60, TANK_W - 60),
        y: -10 - i * 14,
        vy: rand(0.4, 0.7),
        life: 14, // 秒
      });
    }
    toast("エサをまいた!");
  });

  cleanBtn.addEventListener("click", () => {
    dirtiness = 0;
    fishes.forEach((f) => (f.happiness = clamp(f.happiness + 5, 0, 100)));
    toast("水そうをきれいにした!");
    log("水そうのおそうじをしました。魚たちも気持ちよさそう。");
  });

  saveBtn.addEventListener("click", () => {
    save();
    toast("セーブしました");
  });

  resetBtn.addEventListener("click", resetGame);

  // ---------------------------------------------------------------
  // 描画: 背景・かざり
  // ---------------------------------------------------------------

  function drawBackground(t) {
    const grad = ctx.createLinearGradient(0, 0, 0, TANK_H);
    const dirtT = dirtiness / 100;
    grad.addColorStop(0, mixColor("#1c6f9c", "#4a5f3a", dirtT * 0.5));
    grad.addColorStop(1, mixColor("#083049", "#25361f", dirtT * 0.5));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TANK_W, TANK_H);

    // 光の筋
    ctx.save();
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 4; i++) {
      const x = ((t * 10 + i * 220) % (TANK_W + 200)) - 100;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 60, 0);
      ctx.lineTo(x - 40, TANK_H);
      ctx.lineTo(x - 100, TANK_H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 砂
    ctx.fillStyle = "#d8c078";
    ctx.beginPath();
    ctx.moveTo(0, TANK_H);
    ctx.quadraticCurveTo(TANK_W / 2, TANK_H - 40, TANK_W, TANK_H);
    ctx.lineTo(TANK_W, TANK_H);
    ctx.lineTo(0, TANK_H);
    ctx.closePath();
    ctx.fill();
  }

  function mixColor(c1, c2, t) {
    const p1 = hexToRgb(c1);
    const p2 = hexToRgb(c2);
    const r = Math.round(p1.r + (p2.r - p1.r) * t);
    const g = Math.round(p1.g + (p2.g - p1.g) * t);
    const b = Math.round(p1.b + (p2.b - p1.b) * t);
    return `rgb(${r},${g},${b})`;
  }
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  const decorSlots = [
    { x: 90, y: TANK_H - 20 },
    { x: 230, y: TANK_H - 20 },
    { x: TANK_W - 260, y: TANK_H - 20 },
    { x: TANK_W - 110, y: TANK_H - 20 },
    { x: TANK_W / 2, y: TANK_H - 20 },
  ];

  function drawDecorations(t) {
    ownedDecor.forEach((id, i) => {
      const slot = decorSlots[i % decorSlots.length];
      const d = decorById(id);
      ctx.save();
      ctx.translate(slot.x, slot.y);
      if (id === "weed") {
        for (let k = -2; k <= 2; k++) {
          const sway = Math.sin(t * 1.5 + k) * 8;
          ctx.strokeStyle = "#2f9e52";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(k * 10, 0);
          ctx.quadraticCurveTo(k * 10 + sway, -40, k * 10 + sway * 1.4, -80);
          ctx.stroke();
        }
      } else if (id === "rock") {
        ctx.fillStyle = "#6b7280";
        ctx.beginPath();
        ctx.ellipse(0, -12, 34, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#8b92a0";
        ctx.beginPath();
        ctx.ellipse(-10, -22, 16, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (id === "chest") {
        ctx.fillStyle = "#8a5a2b";
        ctx.fillRect(-24, -28, 48, 24);
        ctx.fillStyle = "#c98f3f";
        ctx.fillRect(-24, -32, 48, 8);
        ctx.fillStyle = "#ffd75e";
        ctx.fillRect(-4, -22, 8, 8);
      } else if (id === "castle") {
        ctx.fillStyle = "#c9a4ff";
        ctx.fillRect(-30, -50, 60, 50);
        ctx.fillRect(-40, -30, 14, 30);
        ctx.fillRect(26, -30, 14, 30);
        ctx.fillStyle = "#8a5cd6";
        ctx.beginPath();
        ctx.moveTo(-40, -30); ctx.lineTo(-33, -44); ctx.lineTo(-26, -30); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(26, -30); ctx.lineTo(33, -44); ctx.lineTo(40, -30); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#4a2e7a";
        ctx.fillRect(-8, -20, 16, 20);
      } else if (id === "ship") {
        ctx.fillStyle = "#5a3a26";
        ctx.beginPath();
        ctx.moveTo(-50, -10);
        ctx.lineTo(50, -10);
        ctx.lineTo(35, 14);
        ctx.lineTo(-35, 14);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#7a5636";
        ctx.fillRect(-6, -55, 10, 45);
        ctx.strokeStyle = "#c9b48a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(4, -50);
        ctx.lineTo(34, -30);
        ctx.lineTo(4, -20);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------
  // 描画: 泡
  // ---------------------------------------------------------------

  function spawnBubbleMaybe(dt) {
    if (Math.random() < dt * (ownedDecor.includes("chest") ? 3 : 1)) {
      bubbles.push({ x: rand(40, TANK_W - 40), y: TANK_H - 10, r: rand(2, 5), vy: rand(0.6, 1.4) });
    }
  }

  function updateBubbles(dt) {
    bubbles.forEach((b) => (b.y -= b.vy * 60 * dt));
    bubbles = bubbles.filter((b) => b.y > -10);
  }

  function drawBubbles() {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    bubbles.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ---------------------------------------------------------------
  // 描画・更新: エサ
  // ---------------------------------------------------------------

  function updateFoods(dt) {
    foods.forEach((f) => {
      f.y += f.vy * 60 * dt;
      f.life -= dt;
    });
    foods = foods.filter((f) => f.y < TANK_H - 15 && f.life > 0);
  }

  function drawFoods() {
    ctx.fillStyle = "#7a4b21";
    foods.forEach((f) => {
      ctx.beginPath();
      ctx.arc(f.x, f.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ---------------------------------------------------------------
  // 更新: 魚の動き & AI
  // ---------------------------------------------------------------

  function updateFishes(dt) {
    fishes.forEach((f) => {
      // 最も近いエサを探す
      let target = null;
      let bestDist = Infinity;
      if (f.eatCooldown <= 0) {
        for (const food of foods) {
          const dx = food.x - f.x;
          const dy = food.y - f.y;
          const d = dx * dx + dy * dy;
          if (d < bestDist) {
            bestDist = d;
            target = food;
          }
        }
      }

      const sp = speciesById(f.speciesId);
      const speed = 55 * (1 + f.stage * 0.08);

      if (target) {
        const dx = target.x - f.x;
        const dy = target.y - f.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        f.vx = (dx / dist) * speed;
        f.vy = (dy / dist) * speed;
        f.dir = dx >= 0 ? 1 : -1;
        if (dist < 16) {
          foods = foods.filter((fd) => fd.id !== target.id);
          f.hunger = clamp(f.hunger + 14, 0, 100);
          f.happiness = clamp(f.happiness + 3, 0, 100);
          f.mouthOpen = 1;
          f.eatCooldown = 0.6;
          if (Math.random() < 0.3) {
            coins += 1;
          }
        }
      } else {
        // ランダム遊泳
        f.swimTimer -= dt;
        if (f.swimTimer <= 0) {
          f.swimTimer = rand(1.5, 3.5);
          const ang = rand(-0.6, 0.6) + (f.dir > 0 ? 0 : Math.PI);
          f.vx = Math.cos(ang) * speed * 0.6;
          f.vy = Math.sin(ang) * speed * 0.3;
          f.dir = f.vx >= 0 ? 1 : -1;
        }
      }

      f.eatCooldown = Math.max(0, f.eatCooldown - dt);
      f.mouthOpen = Math.max(0, f.mouthOpen - dt * 2);

      f.x += f.vx * dt;
      f.y += f.vy * dt;

      const margin = 40 * sp.scale;
      if (f.x < margin) { f.x = margin; f.vx = Math.abs(f.vx); f.dir = 1; }
      if (f.x > TANK_W - margin) { f.x = TANK_W - margin; f.vx = -Math.abs(f.vx); f.dir = -1; }
      if (f.y < 30) { f.y = 30; f.vy = Math.abs(f.vy); }
      if (f.y > TANK_H - 60) { f.y = TANK_H - 60; f.vy = -Math.abs(f.vy); }

      f.wiggle += dt * (4 + Math.abs(f.vx) * 0.05);
    });
  }

  // ---------------------------------------------------------------
  // 描画: 魚
  // ---------------------------------------------------------------

  function drawFish(f) {
    const sp = speciesById(f.speciesId);
    const growScale = 0.7 + f.stage * 0.22;
    const scale = sp.scale * growScale;
    const wig = Math.sin(f.wiggle) * 0.35;

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(clamp(f.vy * 0.01, -0.3, 0.3));
    ctx.scale(f.dir * scale, scale);

    // 尾ひれ
    ctx.fillStyle = shade(sp.accent, -10);
    ctx.save();
    ctx.translate(-26, 0);
    ctx.rotate(wig);
    ctx.beginPath();
    if (sp.tail === "fork") {
      ctx.moveTo(0, 0);
      ctx.lineTo(-20, -14);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-20, 14);
    } else if (sp.tail === "fan") {
      ctx.moveTo(0, 0);
      ctx.lineTo(-18, -16);
      ctx.quadraticCurveTo(-24, 0, -18, 16);
    } else if (sp.tail === "flow") {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-30, -18, -34, -2);
      ctx.quadraticCurveTo(-30, 10, -14, 4);
    } else if (sp.tail === "shark") {
      ctx.moveTo(0, -4);
      ctx.lineTo(-22, -20);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-22, 6);
    } else {
      ctx.moveTo(0, 0);
      ctx.lineTo(-16, -12);
      ctx.lineTo(-16, 12);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 背びれ
    ctx.fillStyle = shade(sp.accent, -15);
    ctx.beginPath();
    if (sp.tail === "shark") {
      ctx.moveTo(-2, -10);
      ctx.lineTo(6, -30);
      ctx.lineTo(14, -10);
    } else {
      ctx.moveTo(-4, -12);
      ctx.quadraticCurveTo(4, -22, 12, -12);
    }
    ctx.closePath();
    ctx.fill();

    // 体
    const bodyGrad = ctx.createLinearGradient(-20, -14, 20, 14);
    bodyGrad.addColorStop(0, shade(sp.baseColor, 12));
    bodyGrad.addColorStop(1, shade(sp.baseColor, -18));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 模様 (種によって軽いアクセント)
    ctx.fillStyle = sp.accent;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(6, -2, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 胸びれ
    ctx.fillStyle = shade(sp.accent, -10);
    ctx.beginPath();
    ctx.ellipse(2, 10, 8, 4, 0.6, 0, Math.PI * 2);
    ctx.fill();

    // 目
    ctx.fillStyle = "#173142";
    ctx.beginPath();
    ctx.arc(14, -2, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(14.8, -2.8, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // 口
    ctx.strokeStyle = "#3a2015";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (f.mouthOpen > 0) {
      ctx.arc(21, 1, 2 + f.mouthOpen * 2, 0, Math.PI);
    } else {
      ctx.moveTo(19, 1);
      ctx.lineTo(22, 1);
    }
    ctx.stroke();

    // 病弱(なかよし度が低い)ときの表情パーツ
    if (f.happiness < 25) {
      ctx.strokeStyle = "#173142";
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.lineTo(16, -3);
      ctx.stroke();
    }

    ctx.restore();

    // 名前ラベル(小さめ、常時ではなく必要なら)
  }

  function shade(hex, percent) {
    const { r, g, b } = hexToRgb(hex);
    const amt = Math.round(2.55 * percent);
    const nr = clamp(r + amt, 0, 255);
    const ng = clamp(g + amt, 0, 255);
    const nb = clamp(b + amt, 0, 255);
    return `rgb(${nr},${ng},${nb})`;
  }

  // ---------------------------------------------------------------
  // メインループ
  // ---------------------------------------------------------------

  function frame(now) {
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    const t = now / 1000;

    if (now - lastTickSecond >= 1000) {
      lastTickSecond = now;
      tickSecond();
    }

    spawnBubbleMaybe(dt);
    updateBubbles(dt);
    updateFoods(dt);
    updateFishes(dt);

    drawBackground(t);
    drawDecorations(t);
    drawBubbles();
    drawFoods();

    // 奥行き感を出すため y でソート
    [...fishes].sort((a, b) => a.y - b.y).forEach(drawFish);

    // 水がよごれてきたら警告オーバーレイ
    if (dirtiness > 70) {
      ctx.fillStyle = "rgba(80,110,40,0.12)";
      ctx.fillRect(0, 0, TANK_W, TANK_H);
    }

    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------
  // 初期化
  // ---------------------------------------------------------------

  load();
  renderShops();
  renderFishInfo();
  updateStatsUI();
  requestAnimationFrame(frame);

  setInterval(save, AUTOSAVE_MS);
  window.addEventListener("beforeunload", save);

  setInterval(renderFishInfo, 1000);
})();
