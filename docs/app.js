"use strict";

/* =========================================================
   Mirai Addon Studio
   Minecraft Bedrock アドオンをブラウザだけで作るツール
   ========================================================= */

/* ---------- IndexedDB helper ---------- */
const DB_NAME = "mirai-addon-studio";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("handles")) db.createObjectStore("handles", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGetAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbDelete(storeName, key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- small utils ---------- */
function uuid() { return crypto.randomUUID(); }
function slug(s) {
  return (s || "").toString().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "item";
}
function sanitizeFileName(s) {
  return (s || "addon").replace(/[\\/:*?"<>|]+/g, "_").trim() || "addon";
}
function el(id) { return document.getElementById(id); }
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const DEFAULT_SCRIPT =
  'import { world } from "@minecraft/server";\n\n' +
  "world.afterEvents.playerSpawn.subscribe((event) => {\n" +
  "  if (event.initialSpawn) {\n" +
  '    event.player.sendMessage("§aこのワールドには独自のアドオンが追加されています。");\n' +
  "  }\n" +
  "});\n";

/* ---------- script snippet templates ---------- */
const SCRIPT_TEMPLATES = [
  {
    label: "アイテムを使ったときに処理する",
    code:
      'import { world } from "@minecraft/server";\n\n' +
      "world.afterEvents.itemUse.subscribe((event) => {\n" +
      "  const player = event.source;\n" +
      "  const itemStack = event.itemStack;\n" +
      '  if (itemStack.typeId === "NAMESPACE:ITEM_ID") {\n' +
      '    player.sendMessage("アイテムを使った!");\n' +
      "    // ここに好きな処理を書く\n" +
      "  }\n" +
      "});\n"
  },
  {
    label: "プレイヤー参加時にメッセージを送る",
    code:
      'import { world } from "@minecraft/server";\n\n' +
      "world.afterEvents.playerSpawn.subscribe((event) => {\n" +
      "  if (event.initialSpawn) {\n" +
      '    event.player.sendMessage("§aようこそ!");\n' +
      "  }\n" +
      "});\n"
  },
  {
    label: "一定間隔で処理を繰り返す",
    code:
      'import { system, world } from "@minecraft/server";\n\n' +
      "system.runInterval(() => {\n" +
      "  for (const player of world.getAllPlayers()) {\n" +
      '    // player.onScreenDisplay.setActionBar("毎秒実行される処理");\n' +
      "  }\n" +
      "}, 20); // 20 tick = 1秒ごと\n"
  },
  {
    label: "カスタムコマンドを登録する (/namespace:hello)",
    code:
      'import { system, CommandPermissionLevel, CustomCommandParamType } from "@minecraft/server";\n\n' +
      "system.beforeEvents.startup.subscribe((event) => {\n" +
      "  event.customCommandRegistry.registerCommand(\n" +
      "    {\n" +
      '      name: "NAMESPACE:hello",\n' +
      '      description: "挨拶をする",\n' +
      "      permissionLevel: CommandPermissionLevel.Any,\n" +
      "    },\n" +
      "    (origin) => {\n" +
      '      origin.sourceEntity?.sendMessage("こんにちは!");\n' +
      "    }\n" +
      "  );\n" +
      "});\n"
  },
  {
    label: "エンティティが死んだときに処理する",
    code:
      'import { world } from "@minecraft/server";\n\n' +
      "world.afterEvents.entityDie.subscribe((event) => {\n" +
      '  if (event.deadEntity.typeId === "minecraft:zombie") {\n' +
      "    const loc = event.deadEntity.location;\n" +
      "    const dim = event.deadEntity.dimension;\n" +
      '    dim.spawnItem({ typeId: "minecraft:diamond", amount: 1 }, loc);\n' +
      "  }\n" +
      "});\n"
  },
  {
    label: "スコアボードを操作する",
    code:
      'import { world } from "@minecraft/server";\n\n' +
      'const OBJECTIVE_ID = "NAMESPACE_points";\n\n' +
      "function getObjective() {\n" +
      "  let obj = world.scoreboard.getObjective(OBJECTIVE_ID);\n" +
      "  if (!obj) obj = world.scoreboard.addObjective(OBJECTIVE_ID, \"ポイント\");\n" +
      "  return obj;\n" +
      "}\n\n" +
      "world.afterEvents.playerSpawn.subscribe((event) => {\n" +
      "  const obj = getObjective();\n" +
      "  obj.setScore(event.player, obj.hasParticipant(event.player) ? obj.getScore(event.player) : 0);\n" +
      "});\n"
  }
];

/* ---------- data models ---------- */
function createDefaultProject(name) {
  return {
    id: uuid(),
    name: name || "新しいアドオン",
    desc: "",
    namespace: "mirai",
    engineVersion: "1.21.0",
    icon: null,
    useScript: false,
    packVersion: [1, 0, 0],
    bpHeaderUuid: uuid(),
    bpModuleUuid: uuid(),
    bpScriptModuleUuid: uuid(),
    rpHeaderUuid: uuid(),
    rpModuleUuid: uuid(),
    scriptContent: DEFAULT_SCRIPT,
    items: [],
    blocks: [],
    createdAt: Date.now()
  };
}

function createDefaultItem() {
  const item = {
    id: uuid(),
    identifier: "new_item",
    displayName: "新しいアイテム",
    category: "items",
    maxStack: 64,
    icon: null,
    isFood: false, nutrition: 4, saturation: 0.3, canAlwaysEat: false,
    isTool: false, toolType: "pickaxe", durability: 0, damage: 0,
    enchantable: false, enchantSlot: "pickaxe", enchantValue: 10,
    isGlint: false, fuelAmount: 0,
    customJson: "", jsonDirty: false
  };
  item.customJson = JSON.stringify(buildItemJson(item, "namespace"), null, 2);
  return item;
}

function createDefaultBlock() {
  const block = {
    id: uuid(),
    identifier: "new_block",
    displayName: "新しいブロック",
    category: "construction",
    destroyTime: 1.0,
    explosionResistance: 6,
    friction: 0.6,
    lightEmission: 0,
    mapColor: "#a0a0a0",
    solid: true,
    icon: null,
    customJson: "", jsonDirty: false
  };
  block.customJson = JSON.stringify(buildBlockJson(block, "namespace"), null, 2);
  return block;
}

/* ---------- JSON generators ---------- */
function buildItemComponents(item) {
  const c = {};
  c["minecraft:icon"] = { texture: item.identifier };
  c["minecraft:display_name"] = { value: item.displayName };
  c["minecraft:max_stack_size"] = Number(item.maxStack) || 1;
  if (item.isFood) {
    c["minecraft:food"] = {
      nutrition: Number(item.nutrition) || 0,
      saturation_modifier: Number(item.saturation) || 0,
      can_always_eat: !!item.canAlwaysEat
    };
  }
  if (item.isTool) {
    c["minecraft:hand_equipped"] = true;
    c["minecraft:tags"] = ["minecraft:is_" + item.toolType];
    if (Number(item.durability) > 0) c["minecraft:durability"] = { max_durability: Number(item.durability) };
    if (Number(item.damage) > 0) c["minecraft:damage"] = Number(item.damage);
  }
  if (item.enchantable) {
    c["minecraft:enchantable"] = { slot: item.enchantSlot, value: Number(item.enchantValue) || 1 };
  }
  if (item.isGlint) c["minecraft:glint"] = true;
  if (Number(item.fuelAmount) > 0) c["minecraft:fuel"] = { duration: Number(item.fuelAmount) };
  return c;
}
function buildItemJson(item, namespace) {
  return {
    format_version: "1.21.0",
    "minecraft:item": {
      description: {
        identifier: namespace + ":" + slug(item.identifier),
        menu_category: { category: item.category || "items" }
      },
      components: buildItemComponents(item)
    }
  };
}

function buildBlockComponents(block) {
  const c = {};
  c["minecraft:destructible_by_mining"] = { seconds_to_destroy: Number(block.destroyTime) || 0 };
  c["minecraft:destructible_by_explosion"] = { explosion_resistance: Number(block.explosionResistance) || 0 };
  c["minecraft:friction"] = Number(block.friction) || 0.6;
  if (Number(block.lightEmission) > 0) c["minecraft:light_emission"] = Number(block.lightEmission);
  c["minecraft:map_color"] = block.mapColor || "#a0a0a0";
  c["minecraft:geometry"] = "minecraft:geometry.full_block";
  c["minecraft:material_instances"] = {
    "*": { texture: slug(block.identifier), render_method: block.solid ? "opaque" : "alpha_test" }
  };
  return c;
}
function buildBlockJson(block, namespace) {
  return {
    format_version: "1.21.0",
    "minecraft:block": {
      description: {
        identifier: namespace + ":" + slug(block.identifier),
        menu_category: { category: block.category || "construction" }
      },
      components: buildBlockComponents(block)
    }
  };
}

function parseEngineVersion(str) {
  const parts = (str || "1.21.0").split(".").map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

function buildManifests(project) {
  const engine = parseEngineVersion(project.engineVersion);
  const ver = project.packVersion || [1, 0, 0];
  const bpModules = [{ type: "data", uuid: project.bpModuleUuid, version: ver }];
  const bpDependencies = [{ uuid: project.rpHeaderUuid, version: ver }];
  if (project.useScript) {
    bpModules.push({
      type: "script",
      language: "javascript",
      uuid: project.bpScriptModuleUuid,
      entry: "scripts/main.js",
      version: ver
    });
    bpDependencies.push({ module_name: "@minecraft/server", version: "1.13.0" });
  }
  const bpManifest = {
    format_version: 2,
    header: {
      name: project.name,
      description: project.desc || "",
      uuid: project.bpHeaderUuid,
      version: ver,
      min_engine_version: engine
    },
    modules: bpModules,
    dependencies: bpDependencies
  };
  const rpManifest = {
    format_version: 2,
    header: {
      name: project.name + " RP",
      description: project.desc || "",
      uuid: project.rpHeaderUuid,
      version: ver,
      min_engine_version: engine
    },
    modules: [{ type: "resources", uuid: project.rpModuleUuid, version: ver }]
  };
  return { bpManifest, rpManifest };
}
function bumpPackVersion(project) {
  const ver = (project.packVersion || [1, 0, 0]).slice();
  ver[2] = (ver[2] || 0) + 1;
  project.packVersion = ver;
  return ver;
}

/* ---------- placeholder texture generation ---------- */
function hashColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 55%, 55%)`;
}
function makePlaceholderPngBlob(seed, size = 16) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = hashColor(seed || "x");
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

/* ---------- build export file map ---------- */
async function buildFileMap(project) {
  const { bpManifest, rpManifest } = buildManifests(project);
  const bpFiles = {};
  const rpFiles = {};

  bpFiles["manifest.json"] = JSON.stringify(bpManifest, null, 2);
  rpFiles["manifest.json"] = JSON.stringify(rpManifest, null, 2);

  if (project.icon) {
    bpFiles["pack_icon.png"] = project.icon;
    rpFiles["pack_icon.png"] = project.icon;
  }

  if (project.useScript) {
    bpFiles["scripts/main.js"] = project.scriptContent || DEFAULT_SCRIPT;
  }

  // items
  const itemTextureData = {};
  for (const item of project.items) {
    const id = slug(item.identifier);
    bpFiles[`items/${id}.json`] = item.customJson;
    const texBlob = item.icon || (await makePlaceholderPngBlob("item:" + id));
    rpFiles[`textures/items/${id}.png`] = texBlob;
    itemTextureData[id] = { textures: `textures/items/${id}` };
  }
  if (project.items.length) {
    rpFiles["textures/item_texture.json"] = JSON.stringify(
      { resource_pack_name: "vanilla", texture_name: "atlas.items", texture_data: itemTextureData },
      null, 2
    );
  }

  // blocks
  const terrainTextureData = {};
  const blocksJson = { format_version: [1, 1, 0] };
  for (const block of project.blocks) {
    const id = slug(block.identifier);
    bpFiles[`blocks/${id}.json`] = block.customJson;
    const texBlob = block.icon || (await makePlaceholderPngBlob("block:" + id));
    rpFiles[`textures/blocks/${id}.png`] = texBlob;
    terrainTextureData[id] = { textures: `textures/blocks/${id}` };
    blocksJson[project.namespace + ":" + id] = { textures: id, sound: "stone" };
  }
  if (project.blocks.length) {
    rpFiles["textures/terrain_texture.json"] = JSON.stringify(
      { resource_pack_name: "vanilla", texture_name: "atlas.terrain", padding: 8, num_mip_levels: 4, texture_data: terrainTextureData },
      null, 2
    );
    rpFiles["blocks.json"] = JSON.stringify(blocksJson, null, 2);
  }

  return { bpFiles, rpFiles };
}

/* ---------- state ---------- */
let projects = [];
let currentProject = null;
let currentItemId = null;
let currentBlockId = null;

const saveCurrentProject = debounce(async () => {
  if (!currentProject) return;
  await idbPut("projects", currentProject);
  maybeAutoSync();
}, 300);

/* ---------- tab switching ---------- */
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    el("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "manifest") renderManifestTab();
  });
});
/* ---------- project list / switching ---------- */
async function loadProjects() {
  projects = await idbGetAll("projects");
  if (!projects.length) {
    const p = createDefaultProject("マイアドオン");
    await idbPut("projects", p);
    projects = [p];
  }
  for (const p of projects) {
    if (!p.packVersion) p.packVersion = [1, 0, 0];
  }
  projects.sort((a, b) => a.createdAt - b.createdAt);
  renderProjectSelect();
  const savedId = localStorage.getItem("mirai_current_project");
  currentProject = projects.find((p) => p.id === savedId) || projects[0];
  el("projectSelect").value = currentProject.id;
  renderAll();
}
function renderProjectSelect() {
  const sel = el("projectSelect");
  sel.innerHTML = "";
  for (const p of projects) {
    const opt = document.createElement("option");
    opt.value = p.id; opt.textContent = p.name;
    sel.appendChild(opt);
  }
}
el("projectSelect").addEventListener("change", (e) => {
  currentProject = projects.find((p) => p.id === e.target.value);
  localStorage.setItem("mirai_current_project", currentProject.id);
  currentItemId = null; currentBlockId = null;
  renderAll();
});
el("newProjectBtn").addEventListener("click", async () => {
  const name = prompt("新しいアドオンの名前を入力してください", "新しいアドオン");
  if (name === null) return;
  const p = createDefaultProject(name || "新しいアドオン");
  projects.push(p);
  await idbPut("projects", p);
  currentProject = p;
  localStorage.setItem("mirai_current_project", p.id);
  renderProjectSelect();
  el("projectSelect").value = p.id;
  currentItemId = null; currentBlockId = null;
  renderAll();
});
el("deleteProjectBtn").addEventListener("click", async () => {
  if (projects.length <= 1) { alert("最後の1つのプロジェクトは削除できません。"); return; }
  if (!confirm(`「${currentProject.name}」を削除します。よろしいですか?この操作は取り消せません。`)) return;
  await idbDelete("projects", currentProject.id);
  await idbDelete("handles", "bp_" + currentProject.id);
  await idbDelete("handles", "rp_" + currentProject.id);
  projects = projects.filter((p) => p.id !== currentProject.id);
  currentProject = projects[0];
  localStorage.setItem("mirai_current_project", currentProject.id);
  renderProjectSelect();
  el("projectSelect").value = currentProject.id;
  currentItemId = null; currentBlockId = null;
  renderAll();
});

/* ---------- render everything ---------- */
function renderAll() {
  renderProjectTab();
  renderManifestTab();
  renderItemsTab();
  renderBlocksTab();
  renderScriptTab();
  renderExportTab();
}

/* ---- project tab ---- */
function renderProjectTab() {
  const p = currentProject;
  el("p_name").value = p.name;
  el("p_desc").value = p.desc;
  el("p_namespace").value = p.namespace;
  el("p_engine").value = p.engineVersion;
  el("p_useScript").checked = p.useScript;
  const preview = el("p_icon_preview");
  preview.innerHTML = "";
  if (p.icon) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(p.icon);
    preview.appendChild(img);
  }
}
el("p_name").addEventListener("input", (e) => { currentProject.name = e.target.value; renderProjectSelect(); el("projectSelect").value = currentProject.id; saveCurrentProject(); });
el("p_desc").addEventListener("input", (e) => { currentProject.desc = e.target.value; saveCurrentProject(); });
el("p_namespace").addEventListener("input", (e) => {
  currentProject.namespace = slug(e.target.value);
  regenerateAllJsonIfClean();
  saveCurrentProject();
});
el("p_engine").addEventListener("input", (e) => { currentProject.engineVersion = e.target.value; renderManifestTab(); saveCurrentProject(); });
el("p_useScript").addEventListener("change", (e) => { currentProject.useScript = e.target.checked; renderManifestTab(); renderScriptTab(); saveCurrentProject(); });
el("p_icon").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  currentProject.icon = file;
  renderProjectTab();
  saveCurrentProject();
});

function regenerateAllJsonIfClean() {
  for (const item of currentProject.items) {
    if (!item.jsonDirty) item.customJson = JSON.stringify(buildItemJson(item, currentProject.namespace), null, 2);
  }
  for (const block of currentProject.blocks) {
    if (!block.jsonDirty) block.customJson = JSON.stringify(buildBlockJson(block, currentProject.namespace), null, 2);
  }
  renderItemsTab(); renderBlocksTab();
}

/* ---- manifest tab ---- */
function renderManifestTab() {
  const p = currentProject;
  const { bpManifest, rpManifest } = buildManifests(p);
  const verStr = (p.packVersion || [1, 0, 0]).join(".");
  el("manifestBPInfo").innerHTML =
    `<div>バージョン: ${verStr}</div><div>header uuid: ${p.bpHeaderUuid}</div><div>data module uuid: ${p.bpModuleUuid}</div>` +
    (p.useScript ? `<div>script module uuid: ${p.bpScriptModuleUuid}</div>` : "");
  el("manifestRPInfo").innerHTML = `<div>バージョン: ${verStr}</div><div>header uuid: ${p.rpHeaderUuid}</div><div>resources module uuid: ${p.rpModuleUuid}</div>`;
  el("manifestBPPreview").value = JSON.stringify(bpManifest, null, 2);
  el("manifestRPPreview").value = JSON.stringify(rpManifest, null, 2);
}
el("regenBPUuid").addEventListener("click", () => {
  if (!confirm("BPのUUIDを再生成します。既にMinecraftへ導入済みの場合、別アドオン扱いになります。よろしいですか?")) return;
  currentProject.bpHeaderUuid = uuid();
  currentProject.bpModuleUuid = uuid();
  currentProject.bpScriptModuleUuid = uuid();
  renderManifestTab(); saveCurrentProject();
});
el("regenRPUuid").addEventListener("click", () => {
  if (!confirm("RPのUUIDを再生成します。既にMinecraftへ導入済みの場合、別アドオン扱いになります。よろしいですか?")) return;
  currentProject.rpHeaderUuid = uuid();
  currentProject.rpModuleUuid = uuid();
  renderManifestTab(); saveCurrentProject();
});

/* ---- items tab ---- */
function renderItemsTab() {
  const list = el("itemList");
  list.innerHTML = "";
  for (const item of currentProject.items) {
    const li = document.createElement("li");
    li.className = item.id === currentItemId ? "active" : "";
    li.innerHTML = `<span>${item.displayName || item.identifier}</span><span class="del" data-id="${item.id}">✕</span>`;
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("del")) return;
      currentItemId = item.id;
      renderItemsTab(); renderItemEditor();
    });
    li.querySelector(".del").addEventListener("click", async () => {
      if (!confirm("このアイテムを削除しますか?")) return;
      currentProject.items = currentProject.items.filter((i) => i.id !== item.id);
      if (currentItemId === item.id) currentItemId = null;
      renderItemsTab(); renderItemEditor(); saveCurrentProject();
    });
    list.appendChild(li);
  }
  renderItemEditor();
}
el("addItemBtn").addEventListener("click", () => {
  const item = createDefaultItem();
  item.identifier = "item_" + (currentProject.items.length + 1);
  item.customJson = JSON.stringify(buildItemJson(item, currentProject.namespace), null, 2);
  currentProject.items.push(item);
  currentItemId = item.id;
  renderItemsTab(); saveCurrentProject();
});
function renderItemEditor() {
  const container = el("itemEditor");
  const item = currentProject.items.find((i) => i.id === currentItemId);
  if (!item) { container.innerHTML = '<p class="hint">左のリストからアイテムを選択、または追加してください。</p>'; return; }
  container.innerHTML = `
    <div class="field-row">
      <label>識別子 (ID)
        <input type="text" id="it_identifier" value="${item.identifier}">
      </label>
      <label>表示名
        <input type="text" id="it_displayName" value="${item.displayName}">
      </label>
    </div>
    <div class="field-row">
      <label>カテゴリ
        <select id="it_category">
          ${["items", "equipment", "construction", "nature", "none"].map((c) => `<option value="${c}" ${item.category === c ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </label>
      <label>最大スタック数
        <input type="number" id="it_maxStack" min="1" max="64" value="${item.maxStack}">
      </label>
    </div>
    <label>アイコン画像
      <input type="file" id="it_icon" accept="image/png,image/jpeg">
    </label>
    <label class="checkbox"><input type="checkbox" id="it_isFood" ${item.isFood ? "checked" : ""}> 食べ物にする</label>
    <div class="field-row" id="it_foodFields" style="display:${item.isFood ? "grid" : "none"}">
      <label>栄養価<input type="number" id="it_nutrition" value="${item.nutrition}"></label>
      <label>満腹度修正<input type="number" step="0.1" id="it_saturation" value="${item.saturation}"></label>
    </div>
    <label class="checkbox"><input type="checkbox" id="it_isTool" ${item.isTool ? "checked" : ""}> 道具/武器にする</label>
    <div id="it_toolFields" style="display:${item.isTool ? "block" : "none"}">
      <div class="field-row">
        <label>種類
          <select id="it_toolType">
            ${["pickaxe", "axe", "shovel", "hoe", "sword"].map((t) => `<option value="${t}" ${item.toolType === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </label>
        <label>耐久値 (0=無制限)<input type="number" id="it_durability" value="${item.durability}"></label>
      </div>
      <label>攻撃力 (0=変更なし)<input type="number" id="it_damage" value="${item.damage}"></label>
    </div>
    <label class="checkbox"><input type="checkbox" id="it_enchantable" ${item.enchantable ? "checked" : ""}> エンチャント可能にする</label>
    <div class="field-row" id="it_enchantFields" style="display:${item.enchantable ? "grid" : "none"}">
      <label>スロット
        <select id="it_enchantSlot">
          ${["sword", "pickaxe", "axe", "shovel", "hoe", "armor_head", "armor_torso", "armor_legs", "armor_feet", "bow", "cosmetic_head"].map((s) => `<option value="${s}" ${item.enchantSlot === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </label>
      <label>エンチャント適正値<input type="number" id="it_enchantValue" value="${item.enchantValue}"></label>
    </div>
    <label class="checkbox"><input type="checkbox" id="it_isGlint" ${item.isGlint ? "checked" : ""}> エンチャント風の輝きをつける</label>
    <label>燃料時間 (tick, 0=燃料にしない)<input type="number" id="it_fuelAmount" value="${item.fuelAmount}"></label>

    <h3>詳細JSON (自動生成 / 手動編集可)</h3>
    <textarea id="it_customJson" class="code-preview" rows="16">${item.customJson}</textarea>
    <button class="btn small" id="it_regen">フォームの内容で再生成</button>
  `;

  function update(mutator) {
    mutator();
    if (!item.jsonDirty) item.customJson = JSON.stringify(buildItemJson(item, currentProject.namespace), null, 2);
    saveCurrentProject();
  }

  el("it_identifier").addEventListener("input", (e) => { update(() => { item.identifier = slug(e.target.value); }); renderItemsTab(); });
  el("it_displayName").addEventListener("input", (e) => { update(() => { item.displayName = e.target.value; }); renderItemsTab(); });
  el("it_category").addEventListener("change", (e) => update(() => { item.category = e.target.value; }));
  el("it_maxStack").addEventListener("input", (e) => update(() => { item.maxStack = e.target.value; }));
  el("it_icon").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) update(() => { item.icon = f; }); });
  el("it_isFood").addEventListener("change", (e) => { update(() => { item.isFood = e.target.checked; }); renderItemEditor(); });
  el("it_isTool").addEventListener("change", (e) => { update(() => { item.isTool = e.target.checked; }); renderItemEditor(); });
  el("it_enchantable").addEventListener("change", (e) => { update(() => { item.enchantable = e.target.checked; }); renderItemEditor(); });
  el("it_isGlint").addEventListener("change", (e) => update(() => { item.isGlint = e.target.checked; }));
  el("it_fuelAmount").addEventListener("input", (e) => update(() => { item.fuelAmount = e.target.value; }));
  if (item.isFood) {
    el("it_nutrition").addEventListener("input", (e) => update(() => { item.nutrition = e.target.value; }));
    el("it_saturation").addEventListener("input", (e) => update(() => { item.saturation = e.target.value; }));
  }
  if (item.isTool) {
    el("it_toolType").addEventListener("change", (e) => update(() => { item.toolType = e.target.value; }));
    el("it_durability").addEventListener("input", (e) => update(() => { item.durability = e.target.value; }));
    el("it_damage").addEventListener("input", (e) => update(() => { item.damage = e.target.value; }));
  }
  if (item.enchantable) {
    el("it_enchantSlot").addEventListener("change", (e) => update(() => { item.enchantSlot = e.target.value; }));
    el("it_enchantValue").addEventListener("input", (e) => update(() => { item.enchantValue = e.target.value; }));
  }
  el("it_customJson").addEventListener("input", (e) => { item.customJson = e.target.value; item.jsonDirty = true; saveCurrentProject(); });
  el("it_regen").addEventListener("click", () => {
    item.jsonDirty = false;
    item.customJson = JSON.stringify(buildItemJson(item, currentProject.namespace), null, 2);
    renderItemEditor(); saveCurrentProject();
  });
}

/* ---- blocks tab ---- */
function renderBlocksTab() {
  const list = el("blockList");
  list.innerHTML = "";
  for (const block of currentProject.blocks) {
    const li = document.createElement("li");
    li.className = block.id === currentBlockId ? "active" : "";
    li.innerHTML = `<span>${block.displayName || block.identifier}</span><span class="del" data-id="${block.id}">✕</span>`;
    li.addEventListener("click", (e) => {
      if (e.target.classList.contains("del")) return;
      currentBlockId = block.id;
      renderBlocksTab(); renderBlockEditor();
    });
    li.querySelector(".del").addEventListener("click", async () => {
      if (!confirm("このブロックを削除しますか?")) return;
      currentProject.blocks = currentProject.blocks.filter((b) => b.id !== block.id);
      if (currentBlockId === block.id) currentBlockId = null;
      renderBlocksTab(); renderBlockEditor(); saveCurrentProject();
    });
    list.appendChild(li);
  }
  renderBlockEditor();
}
el("addBlockBtn").addEventListener("click", () => {
  const block = createDefaultBlock();
  block.identifier = "block_" + (currentProject.blocks.length + 1);
  block.customJson = JSON.stringify(buildBlockJson(block, currentProject.namespace), null, 2);
  currentProject.blocks.push(block);
  currentBlockId = block.id;
  renderBlocksTab(); saveCurrentProject();
});
function renderBlockEditor() {
  const container = el("blockEditor");
  const block = currentProject.blocks.find((b) => b.id === currentBlockId);
  if (!block) { container.innerHTML = '<p class="hint">左のリストからブロックを選択、または追加してください。</p>'; return; }
  container.innerHTML = `
    <div class="field-row">
      <label>識別子 (ID)
        <input type="text" id="bl_identifier" value="${block.identifier}">
      </label>
      <label>表示名
        <input type="text" id="bl_displayName" value="${block.displayName}">
      </label>
    </div>
    <div class="field-row">
      <label>カテゴリ
        <select id="bl_category">
          ${["construction", "nature", "equipment", "items", "none"].map((c) => `<option value="${c}" ${block.category === c ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </label>
      <label>マップの色
        <input type="text" id="bl_mapColor" value="${block.mapColor}">
      </label>
    </div>
    <label>テクスチャ画像 (全面共通)
      <input type="file" id="bl_icon" accept="image/png,image/jpeg">
    </label>
    <div class="field-row">
      <label>破壊時間(秒)<input type="number" step="0.1" id="bl_destroyTime" value="${block.destroyTime}"></label>
      <label>爆発耐性<input type="number" step="0.1" id="bl_explosionResistance" value="${block.explosionResistance}"></label>
    </div>
    <div class="field-row">
      <label>摩擦<input type="number" step="0.05" id="bl_friction" value="${block.friction}"></label>
      <label>発光レベル (0-15)<input type="number" min="0" max="15" id="bl_lightEmission" value="${block.lightEmission}"></label>
    </div>
    <label class="checkbox"><input type="checkbox" id="bl_solid" ${block.solid ? "checked" : ""}> 不透明(通常のブロック)にする。外すと半透明扱い</label>

    <h3>詳細JSON (自動生成 / 手動編集可)</h3>
    <textarea id="bl_customJson" class="code-preview" rows="16">${block.customJson}</textarea>
    <button class="btn small" id="bl_regen">フォームの内容で再生成</button>
  `;
  function update(mutator) {
    mutator();
    if (!block.jsonDirty) block.customJson = JSON.stringify(buildBlockJson(block, currentProject.namespace), null, 2);
    saveCurrentProject();
  }
  el("bl_identifier").addEventListener("input", (e) => { update(() => { block.identifier = slug(e.target.value); }); renderBlocksTab(); });
  el("bl_displayName").addEventListener("input", (e) => { update(() => { block.displayName = e.target.value; }); renderBlocksTab(); });
  el("bl_category").addEventListener("change", (e) => update(() => { block.category = e.target.value; }));
  el("bl_mapColor").addEventListener("input", (e) => update(() => { block.mapColor = e.target.value; }));
  el("bl_icon").addEventListener("change", (e) => { const f = e.target.files[0]; if (f) update(() => { block.icon = f; }); });
  el("bl_destroyTime").addEventListener("input", (e) => update(() => { block.destroyTime = e.target.value; }));
  el("bl_explosionResistance").addEventListener("input", (e) => update(() => { block.explosionResistance = e.target.value; }));
  el("bl_friction").addEventListener("input", (e) => update(() => { block.friction = e.target.value; }));
  el("bl_lightEmission").addEventListener("input", (e) => update(() => { block.lightEmission = e.target.value; }));
  el("bl_solid").addEventListener("change", (e) => update(() => { block.solid = e.target.checked; }));
  el("bl_customJson").addEventListener("input", (e) => { block.customJson = e.target.value; block.jsonDirty = true; saveCurrentProject(); });
  el("bl_regen").addEventListener("click", () => {
    block.jsonDirty = false;
    block.customJson = JSON.stringify(buildBlockJson(block, currentProject.namespace), null, 2);
    renderBlockEditor(); saveCurrentProject();
  });
}

/* ---- script tab ---- */
function renderScriptTab() {
  const enabled = currentProject.useScript;
  el("scriptDisabledHint").style.display = enabled ? "none" : "block";
  el("scriptArea").style.display = enabled ? "block" : "none";
  if (enabled) el("scriptEditor").value = currentProject.scriptContent;
}
el("scriptEditor").addEventListener("input", (e) => { currentProject.scriptContent = e.target.value; saveCurrentProject(); });
(function populateTemplateSelect() {
  const sel = el("templateSelect");
  SCRIPT_TEMPLATES.forEach((t, i) => {
    const opt = document.createElement("option");
    opt.value = i; opt.textContent = t.label;
    sel.appendChild(opt);
  });
})();
el("insertTemplateBtn").addEventListener("click", () => {
  const idx = Number(el("templateSelect").value);
  const code = SCRIPT_TEMPLATES[idx].code.replace(/NAMESPACE/g, currentProject.namespace);
  const ta = el("scriptEditor");
  const sep = ta.value.trim().length ? "\n\n" : "";
  ta.value = ta.value + sep + code;
  currentProject.scriptContent = ta.value;
  saveCurrentProject();
});

/* ---- AI assistant tab ---- */
el("ai_apikey").addEventListener("input", (e) => { localStorage.setItem("mirai_ai_key", e.target.value); });
(function restoreKey() {
  const k = localStorage.getItem("mirai_ai_key");
  if (k) el("ai_apikey").value = k;
})();

async function callClaude(apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`APIエラー (${res.status}): ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || []).map((b) => b.text || "").join("\n");
}
function stripCodeFence(text) {
  const m = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return m ? m[1].trim() : text.trim();
}

el("ai_generate").addEventListener("click", async () => {
  const apiKey = el("ai_apikey").value.trim();
  const model = el("ai_model").value;
  const mode = el("ai_mode").value;
  const userPrompt = el("ai_prompt").value.trim();
  const status = el("ai_status");
  const resultBox = el("ai_result");
  const applyBtn = el("ai_apply");
  applyBtn.style.display = "none";
  resultBox.value = "";
  if (!apiKey) { status.textContent = "先にAnthropic APIキーを入力してください。"; return; }
  if (!userPrompt) { status.textContent = "やりたいことを入力してください。"; return; }

  let systemPrompt;
  if (mode === "script") {
    systemPrompt =
      "あなたはMinecraft Bedrock Edition のスクリプトAPI(@minecraft/server, @minecraft/server-ui)に精通したエキスパートです。" +
      "ユーザーの要望を満たすJavaScriptコードのみを出力してください。説明文やMarkdownのコードフェンスは付けないでください。" +
      `このプロジェクトの名前空間は "${currentProject.namespace}" です。アイテムやエンティティのIDを使う場合はこの名前空間を使ってください。`;
  } else if (mode === "item") {
    systemPrompt =
      "あなたはMinecraft Bedrock Editionのデータ駆動アイテム定義に精通したエキスパートです。" +
      'ユーザーの要望を満たす "minecraft:item" のJSON定義のみを出力してください。説明文やMarkdownのコードフェンスは付けないでください。' +
      `format_versionは"1.21.0"を使い、identifierは"${currentProject.namespace}:任意のID"の形式にしてください。`;
  } else {
    systemPrompt =
      "あなたはMinecraft Bedrock Editionのデータ駆動ブロック定義に精通したエキスパートです。" +
      'ユーザーの要望を満たす "minecraft:block" のJSON定義のみを出力してください。説明文やMarkdownのコードフェンスは付けないでください。' +
      `format_versionは"1.21.0"を使い、identifierは"${currentProject.namespace}:任意のID"の形式にしてください。`;
  }

  el("ai_generate").disabled = true;
  status.textContent = "生成中...";
  try {
    const raw = await callClaude(apiKey, model, systemPrompt, userPrompt);
    const code = stripCodeFence(raw);
    resultBox.value = code;
    applyBtn.style.display = "inline-block";
    status.textContent = "生成しました。内容を確認して「反映する」を押してください。";
  } catch (err) {
    status.textContent = "エラー: " + err.message;
  } finally {
    el("ai_generate").disabled = false;
  }
});

el("ai_apply").addEventListener("click", () => {
  const mode = el("ai_mode").value;
  const code = el("ai_result").value;
  if (mode === "script") {
    if (!currentProject.useScript) {
      currentProject.useScript = true;
      renderManifestTab();
    }
    const sep = currentProject.scriptContent.trim().length ? "\n\n" : "";
    currentProject.scriptContent = currentProject.scriptContent + sep + code;
    renderScriptTab();
    document.querySelector('.tab-btn[data-tab="script"]').click();
  } else if (mode === "item") {
    const item = currentProject.items.find((i) => i.id === currentItemId);
    if (!item) { alert("先に「アイテム」タブでアイテムを選択(または追加)してください。"); return; }
    item.customJson = code;
    item.jsonDirty = true;
    document.querySelector('.tab-btn[data-tab="items"]').click();
    renderItemsTab();
  } else {
    const block = currentProject.blocks.find((b) => b.id === currentBlockId);
    if (!block) { alert("先に「ブロック」タブでブロックを選択(または追加)してください。"); return; }
    block.customJson = code;
    block.jsonDirty = true;
    document.querySelector('.tab-btn[data-tab="blocks"]').click();
    renderBlocksTab();
  }
  saveCurrentProject();
});

/* ---- export tab ---- */
function renderExportTab() {
  el("packVersionLabel").textContent = (currentProject.packVersion || [1, 0, 0]).join(".");

  const fsSupported = !!window.showDirectoryPicker;
  el("fsapiUnsupported").style.display = fsSupported ? "none" : "block";
  el("fsapiArea").style.display = fsSupported ? "block" : "none";
  if (fsSupported) refreshFolderStatus();

  const shareSupported = !!(navigator.share && navigator.canShare);
  el("shareUnsupported").style.display = shareSupported ? "none" : "block";
  el("shareToMinecraftBtn").disabled = !shareSupported;
}

async function buildMcaddonBlob(project) {
  const { bpFiles, rpFiles } = await buildFileMap(project);
  const zip = new JSZip();
  const baseName = sanitizeFileName(project.name);
  const bpFolder = zip.folder(baseName + " BP");
  const rpFolder = zip.folder(baseName + " RP");
  for (const [path, val] of Object.entries(bpFiles)) bpFolder.file(path, val);
  for (const [path, val] of Object.entries(rpFiles)) rpFolder.file(path, val);
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, filename: baseName + ".mcaddon" };
}

el("downloadMcaddonBtn").addEventListener("click", async () => {
  const btn = el("downloadMcaddonBtn");
  btn.disabled = true; btn.textContent = "書き出し中...";
  try {
    bumpPackVersion(currentProject);
    renderExportTab(); renderManifestTab();
    const { blob, filename } = await buildMcaddonBlob(currentProject);
    downloadBlob(blob, filename);
    saveCurrentProject();
  } catch (err) {
    alert("書き出しに失敗しました: " + err.message);
  } finally {
    btn.disabled = false; btn.textContent = ".mcaddon をダウンロード";
  }
});

el("shareToMinecraftBtn").addEventListener("click", async () => {
  const btn = el("shareToMinecraftBtn");
  const status = el("shareStatus");
  btn.disabled = true; btn.textContent = "準備中...";
  status.textContent = "";
  try {
    bumpPackVersion(currentProject);
    renderExportTab(); renderManifestTab();
    const { blob, filename } = await buildMcaddonBlob(currentProject);
    const file = new File([blob], filename, { type: "application/octet-stream" });
    if (!navigator.canShare({ files: [file] })) {
      status.textContent = "この端末はファイル共有に対応していません。方法3(ダウンロード)をご利用ください。";
      return;
    }
    await navigator.share({ files: [file], title: currentProject.name });
    status.textContent = "共有しました。表示された一覧から「Minecraft」を選んでください。";
    saveCurrentProject();
  } catch (err) {
    if (err.name === "AbortError") {
      status.textContent = "キャンセルされました。";
    } else {
      status.textContent = "共有に失敗しました: " + err.message + "(方法3のダウンロードをお試しください)";
    }
  } finally {
    btn.disabled = false; btn.textContent = "更新してMinecraftを開く";
  }
});

/* ---- File System Access sync ---- */
async function getHandle(kind) {
  const rec = await idbGet("handles", kind + "_" + currentProject.id);
  return rec ? rec.handle : null;
}
async function setHandle(kind, handle) {
  await idbPut("handles", { key: kind + "_" + currentProject.id, handle });
}
async function refreshFolderStatus() {
  const bp = await getHandle("bp");
  const rp = await getHandle("rp");
  setStatusBadge("bpFolderStatus", bp);
  setStatusBadge("rpFolderStatus", rp);
}
function setStatusBadge(elemId, handle) {
  const badge = el(elemId);
  if (handle) { badge.textContent = "接続済み: " + handle.name; badge.classList.add("ok"); }
  else { badge.textContent = "未接続"; badge.classList.remove("ok"); }
}
el("connectBPFolder").addEventListener("click", async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await setHandle("bp", handle);
    refreshFolderStatus();
  } catch (e) { /* user cancelled */ }
});
el("connectRPFolder").addEventListener("click", async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    await setHandle("rp", handle);
    refreshFolderStatus();
  } catch (e) { /* user cancelled */ }
});

async function ensurePermission(handle) {
  if (!handle) return false;
  const opts = { mode: "readwrite" };
  if ((await handle.queryPermission(opts)) === "granted") return true;
  if ((await handle.requestPermission(opts)) === "granted") return true;
  return false;
}
async function writeFilesToHandle(dirHandle, filesMap) {
  for (const [path, value] of Object.entries(filesMap)) {
    const parts = path.split("/");
    const filename = parts.pop();
    let dir = dirHandle;
    for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(value);
    await writable.close();
  }
}
async function syncNow() {
  const status = el("syncStatus");
  const bpHandle = await getHandle("bp");
  const rpHandle = await getHandle("rp");
  if (!bpHandle && !rpHandle) { status.textContent = "先にBP/RPフォルダを選択してください。"; return; }
  status.textContent = "同期中...";
  try {
    const { bpFiles, rpFiles } = await buildFileMap(currentProject);
    if (bpHandle) {
      if (!(await ensurePermission(bpHandle))) throw new Error("BPフォルダへの書き込み権限がありません。再接続してください。");
      await writeFilesToHandle(bpHandle, bpFiles);
    }
    if (rpHandle) {
      if (!(await ensurePermission(rpHandle))) throw new Error("RPフォルダへの書き込み権限がありません。再接続してください。");
      await writeFilesToHandle(rpHandle, rpFiles);
    }
    status.textContent = "同期しました。(" + new Date().toLocaleTimeString() + ") ワールドを開き直すと反映されます。";
  } catch (err) {
    status.textContent = "同期エラー: " + err.message;
  }
}
el("syncNowBtn").addEventListener("click", syncNow);
const debouncedAutoSync = debounce(syncNow, 800);
function maybeAutoSync() {
  if (el("autoSyncToggle") && el("autoSyncToggle").checked) debouncedAutoSync();
}

/* ---------- boot ---------- */
loadProjects();
