'use strict';

/* ---------- 状態管理 ---------- */

const STORAGE_KEY = 'mcam_project_v1';

const VANILLA_INGREDIENTS = [
  'minecraft:stick', 'minecraft:iron_ingot', 'minecraft:gold_ingot', 'minecraft:diamond',
  'minecraft:emerald', 'minecraft:redstone', 'minecraft:coal', 'minecraft:string',
  'minecraft:planks', 'minecraft:cobblestone', 'minecraft:stone', 'minecraft:glass',
  'minecraft:leather', 'minecraft:paper', 'minecraft:book', 'minecraft:wheat',
  'minecraft:egg', 'minecraft:sugar', 'minecraft:milk_bucket', 'minecraft:water_bucket',
  'minecraft:apple', 'minecraft:gunpowder', 'minecraft:blaze_powder', 'minecraft:ender_pearl',
  'minecraft:netherite_ingot', 'minecraft:copper_ingot', 'minecraft:quartz',
  'minecraft:lapis_lazuli', 'minecraft:flint', 'minecraft:feather', 'minecraft:bone',
  'minecraft:slime_ball', 'minecraft:clay_ball', 'minecraft:brick', 'minecraft:nether_brick',
];

function defaultState() {
  return {
    meta: {
      name: '',
      namespace: '',
      description: '',
      author: '',
      icon: null,
      uuids: null,
    },
    items: [],
    blocks: [],
    recipes: [],
  };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return Object.assign(defaultState(), parsed);
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // ストレージが使えない環境では無視する
  }
}

/* ---------- ユーティリティ ---------- */

function uuidv4() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function slugify(str) {
  return (str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

function ns() {
  return slugify(state.meta.namespace) || 'my_addon';
}

function fullId(key) {
  return `${ns()}:${key}`;
}

function ensureUuids() {
  if (!state.meta.uuids) {
    state.meta.uuids = {
      bpHeader: uuidv4(),
      bpModule: uuidv4(),
      rpHeader: uuidv4(),
      rpModule: uuidv4(),
    };
    saveState();
  }
  return state.meta.uuids;
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataURLBase64(dataURL) {
  return dataURL.split(',')[1];
}

function toast(message, isError) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2600);
}

/** 画像未指定時に使う、キーから色を決めた簡易プレースホルダーPNGを作る */
function placeholderTextureDataURL(key, size) {
  size = size || 16;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  ctx.fillStyle = `hsl(${hue}, 55%, 45%)`;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = `hsl(${hue}, 55%, 60%)`;
  ctx.fillRect(2, 2, size - 4, size - 4);
  return canvas.toDataURL('image/png');
}

function placeholderIconDataURL(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#5fb85f');
  grad.addColorStop(1, '#3f8f45');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 140px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letter = (name || 'A').trim().charAt(0).toUpperCase() || 'A';
  ctx.fillText(letter, 128, 145);
  return canvas.toDataURL('image/png');
}

/* ---------- タブ切り替え ---------- */

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  if (btn.dataset.tab === 'recipes') renderRecipeFormOptions();
  if (btn.dataset.tab === 'preview') renderPreview();
});

/* ---------- 基本情報 ---------- */

function renderBasic() {
  document.getElementById('meta-name').value = state.meta.name || '';
  document.getElementById('meta-namespace').value = state.meta.namespace || '';
  document.getElementById('meta-desc').value = state.meta.description || '';
  document.getElementById('meta-author').value = state.meta.author || '';
  document.getElementById('meta-icon-preview').src = state.meta.icon || placeholderIconDataURL(state.meta.name);
}

document.getElementById('meta-name').addEventListener('input', (e) => {
  state.meta.name = e.target.value;
  if (!state.meta.namespace) {
    document.getElementById('meta-namespace').placeholder = slugify(e.target.value) || '例: my_addon';
  }
  document.getElementById('meta-icon-preview').src = state.meta.icon || placeholderIconDataURL(state.meta.name);
  saveState();
});
document.getElementById('meta-namespace').addEventListener('input', (e) => {
  e.target.value = slugify(e.target.value);
  state.meta.namespace = e.target.value;
  saveState();
});
document.getElementById('meta-desc').addEventListener('input', (e) => {
  state.meta.description = e.target.value;
  saveState();
});
document.getElementById('meta-author').addEventListener('input', (e) => {
  state.meta.author = e.target.value;
  saveState();
});
document.getElementById('meta-icon').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  state.meta.icon = await fileToDataURL(file);
  document.getElementById('meta-icon-preview').src = state.meta.icon;
  saveState();
});
document.getElementById('btn-clear-icon').addEventListener('click', () => {
  state.meta.icon = null;
  document.getElementById('meta-icon').value = '';
  document.getElementById('meta-icon-preview').src = placeholderIconDataURL(state.meta.name);
  saveState();
});

/* ---------- アイテム ---------- */

let editingItemTexture = null;

document.getElementById('item-type').addEventListener('change', (e) => {
  document.getElementById('item-food-fields').classList.toggle('hidden', e.target.value !== 'food');
  document.getElementById('item-tool-fields').classList.toggle('hidden', e.target.value !== 'tool');
});

document.getElementById('item-texture').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  editingItemTexture = await fileToDataURL(file);
  const prev = document.getElementById('item-texture-preview');
  prev.src = editingItemTexture;
  prev.classList.add('show');
});

document.getElementById('item-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = slugify(document.getElementById('item-key').value);
  if (!key) { toast('IDを入力してください', true); return; }

  const editId = document.getElementById('item-edit-id').value;
  const dup = state.items.find(i => i.key === key && i.id !== editId);
  if (dup) { toast('同じIDのアイテムが既にあります', true); return; }

  const type = document.getElementById('item-type').value;
  const entry = {
    id: editId || uuidv4(),
    key,
    nameJa: document.getElementById('item-name-ja').value.trim() || key,
    nameEn: document.getElementById('item-name-en').value.trim() || key,
    texture: editingItemTexture || (editId && state.items.find(i => i.id === editId)?.texture) || null,
    stackSize: Math.max(1, Math.min(64, Number(document.getElementById('item-stack').value) || 64)),
    type,
    food: {
      nutrition: Number(document.getElementById('item-food-nutrition').value) || 0,
      saturation: Number(document.getElementById('item-food-saturation').value) || 0,
      alwaysEat: document.getElementById('item-food-always').checked,
    },
    tool: {
      durability: Number(document.getElementById('item-tool-durability').value) || 1,
      damage: Number(document.getElementById('item-tool-damage').value) || 0,
    },
  };

  if (editId) {
    const idx = state.items.findIndex(i => i.id === editId);
    state.items[idx] = entry;
    toast('アイテムを更新しました');
  } else {
    state.items.push(entry);
    toast('アイテムを追加しました');
  }

  saveState();
  resetItemForm();
  renderItems();
});

document.getElementById('item-cancel-edit').addEventListener('click', resetItemForm);

function resetItemForm() {
  document.getElementById('item-form').reset();
  document.getElementById('item-edit-id').value = '';
  document.getElementById('item-form-title').textContent = 'アイテムを追加';
  document.getElementById('item-cancel-edit').classList.add('hidden');
  document.getElementById('item-food-fields').classList.add('hidden');
  document.getElementById('item-tool-fields').classList.add('hidden');
  document.getElementById('item-texture-preview').classList.remove('show');
  document.getElementById('item-stack').value = 64;
  editingItemTexture = null;
}

function editItem(id) {
  const it = state.items.find(i => i.id === id);
  if (!it) return;
  document.getElementById('item-edit-id').value = it.id;
  document.getElementById('item-key').value = it.key;
  document.getElementById('item-name-ja').value = it.nameJa;
  document.getElementById('item-name-en').value = it.nameEn;
  document.getElementById('item-stack').value = it.stackSize;
  document.getElementById('item-type').value = it.type;
  document.getElementById('item-food-nutrition').value = it.food.nutrition;
  document.getElementById('item-food-saturation').value = it.food.saturation;
  document.getElementById('item-food-always').checked = it.food.alwaysEat;
  document.getElementById('item-tool-durability').value = it.tool.durability;
  document.getElementById('item-tool-damage').value = it.tool.damage;
  document.getElementById('item-food-fields').classList.toggle('hidden', it.type !== 'food');
  document.getElementById('item-tool-fields').classList.toggle('hidden', it.type !== 'tool');
  const prev = document.getElementById('item-texture-preview');
  if (it.texture) { prev.src = it.texture; prev.classList.add('show'); }
  editingItemTexture = it.texture;
  document.getElementById('item-form-title').textContent = `「${it.nameJa}」を編集中`;
  document.getElementById('item-cancel-edit').classList.remove('hidden');
  document.getElementById('tab-items').scrollIntoView({ behavior: 'smooth' });
}

function deleteItem(id) {
  if (!confirm('このアイテムを削除しますか?')) return;
  state.items = state.items.filter(i => i.id !== id);
  saveState();
  renderItems();
}

function renderItems() {
  const list = document.getElementById('item-list');
  document.getElementById('count-items').textContent = state.items.length;
  if (state.items.length === 0) {
    list.innerHTML = '<p class="empty-hint">まだアイテムがありません。</p>';
    return;
  }
  list.innerHTML = '';
  state.items.forEach(it => {
    const card = document.createElement('div');
    card.className = 'item-card';
    const typeLabel = { simple: '通常', food: '食べ物', tool: '道具・武器' }[it.type] || it.type;
    card.innerHTML = `
      <img src="${it.texture || placeholderTextureDataURL(it.key)}" alt="">
      <div class="info">
        <div class="name">${escapeHtml(it.nameJa)}</div>
        <div class="sub">${fullId(it.key)} ・ ${typeLabel} ・ 最大${it.stackSize}個</div>
      </div>
      <div class="actions">
        <button class="btn-icon" title="編集" onclick="editItem('${it.id}')">✏️</button>
        <button class="btn-icon" title="削除" onclick="deleteItem('${it.id}')">🗑️</button>
      </div>`;
    list.appendChild(card);
  });
}

/* ---------- ブロック ---------- */

let editingBlockTexture = null;

document.getElementById('block-texture').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  editingBlockTexture = await fileToDataURL(file);
  const prev = document.getElementById('block-texture-preview');
  prev.src = editingBlockTexture;
  prev.classList.add('show');
});

document.getElementById('block-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const key = slugify(document.getElementById('block-key').value);
  if (!key) { toast('IDを入力してください', true); return; }

  const editId = document.getElementById('block-edit-id').value;
  const dup = state.blocks.find(b => b.key === key && b.id !== editId);
  if (dup) { toast('同じIDのブロックが既にあります', true); return; }

  const entry = {
    id: editId || uuidv4(),
    key,
    nameJa: document.getElementById('block-name-ja').value.trim() || key,
    nameEn: document.getElementById('block-name-en').value.trim() || key,
    texture: editingBlockTexture || (editId && state.blocks.find(b => b.id === editId)?.texture) || null,
    destroyTime: Number(document.getElementById('block-destroy-time').value) || 0,
    explosionResistance: Number(document.getElementById('block-explosion-resistance').value) || 0,
    mapColor: document.getElementById('block-map-color').value,
  };

  if (editId) {
    const idx = state.blocks.findIndex(b => b.id === editId);
    state.blocks[idx] = entry;
    toast('ブロックを更新しました');
  } else {
    state.blocks.push(entry);
    toast('ブロックを追加しました');
  }

  saveState();
  resetBlockForm();
  renderBlocks();
});

document.getElementById('block-cancel-edit').addEventListener('click', resetBlockForm);

function resetBlockForm() {
  document.getElementById('block-form').reset();
  document.getElementById('block-edit-id').value = '';
  document.getElementById('block-form-title').textContent = 'ブロックを追加';
  document.getElementById('block-cancel-edit').classList.add('hidden');
  document.getElementById('block-texture-preview').classList.remove('show');
  document.getElementById('block-destroy-time').value = 1.5;
  document.getElementById('block-explosion-resistance').value = 6;
  document.getElementById('block-map-color').value = '#a15c33';
  editingBlockTexture = null;
}

function editBlock(id) {
  const b = state.blocks.find(x => x.id === id);
  if (!b) return;
  document.getElementById('block-edit-id').value = b.id;
  document.getElementById('block-key').value = b.key;
  document.getElementById('block-name-ja').value = b.nameJa;
  document.getElementById('block-name-en').value = b.nameEn;
  document.getElementById('block-destroy-time').value = b.destroyTime;
  document.getElementById('block-explosion-resistance').value = b.explosionResistance;
  document.getElementById('block-map-color').value = b.mapColor;
  const prev = document.getElementById('block-texture-preview');
  if (b.texture) { prev.src = b.texture; prev.classList.add('show'); }
  editingBlockTexture = b.texture;
  document.getElementById('block-form-title').textContent = `「${b.nameJa}」を編集中`;
  document.getElementById('block-cancel-edit').classList.remove('hidden');
  document.getElementById('tab-blocks').scrollIntoView({ behavior: 'smooth' });
}

function deleteBlock(id) {
  if (!confirm('このブロックを削除しますか?')) return;
  state.blocks = state.blocks.filter(b => b.id !== id);
  saveState();
  renderBlocks();
}

function renderBlocks() {
  const list = document.getElementById('block-list');
  document.getElementById('count-blocks').textContent = state.blocks.length;
  if (state.blocks.length === 0) {
    list.innerHTML = '<p class="empty-hint">まだブロックがありません。</p>';
    return;
  }
  list.innerHTML = '';
  state.blocks.forEach(b => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <img src="${b.texture || placeholderTextureDataURL(b.key)}" alt="">
      <div class="info">
        <div class="name">${escapeHtml(b.nameJa)}</div>
        <div class="sub">${fullId(b.key)} ・ 硬さ${b.destroyTime}</div>
      </div>
      <div class="actions">
        <button class="btn-icon" title="編集" onclick="editBlock('${b.id}')">✏️</button>
        <button class="btn-icon" title="削除" onclick="deleteBlock('${b.id}')">🗑️</button>
      </div>`;
    list.appendChild(card);
  });
}

/* ---------- レシピ ---------- */

function allCraftableTargets() {
  const items = state.items.map(i => ({ id: fullId(i.key), label: `[アイテム] ${i.nameJa}` }));
  const blocks = state.blocks.map(b => ({ id: fullId(b.key), label: `[ブロック] ${b.nameJa}` }));
  return items.concat(blocks);
}

function renderRecipeFormOptions() {
  const select = document.getElementById('recipe-output');
  const targets = allCraftableTargets();
  select.innerHTML = targets.length
    ? targets.map(t => `<option value="${t.id}">${escapeHtml(t.label)} (${t.id})</option>`).join('')
    : '<option value="">先にアイテムかブロックを追加してください</option>';

  const datalist = document.getElementById('ingredient-options');
  const custom = targets.map(t => t.id);
  datalist.innerHTML = custom.concat(VANILLA_INGREDIENTS)
    .map(id => `<option value="${id}"></option>`).join('');
}

function buildCraftGrid() {
  const grid = document.getElementById('craft-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('list', 'ingredient-options');
    input.placeholder = '空';
    input.className = 'craft-cell';
    input.dataset.cell = i;
    grid.appendChild(input);
  }
}
buildCraftGrid();

document.getElementById('recipe-type').addEventListener('change', (e) => {
  const shaped = e.target.value === 'shaped';
  document.getElementById('recipe-shaped-fields').classList.toggle('hidden', !shaped);
  document.getElementById('recipe-shapeless-fields').classList.toggle('hidden', shaped);
});

function addShapelessRow(id, count) {
  const wrap = document.getElementById('shapeless-list');
  const row = document.createElement('div');
  row.className = 'shapeless-row';
  row.innerHTML = `
    <input type="text" list="ingredient-options" placeholder="材料ID (例: minecraft:stick)" value="${id ? escapeHtml(id) : ''}">
    <input type="number" min="1" max="64" value="${count || 1}">
    <button type="button" class="btn-icon" title="削除">🗑️</button>`;
  row.querySelector('button').addEventListener('click', () => row.remove());
  wrap.appendChild(row);
}
document.getElementById('btn-add-ingredient').addEventListener('click', () => addShapelessRow());

document.getElementById('recipe-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const outputId = document.getElementById('recipe-output').value;
  if (!outputId) { toast('先にアイテムかブロックを追加してください', true); return; }

  const type = document.getElementById('recipe-type').value;
  const count = Math.max(1, Number(document.getElementById('recipe-count').value) || 1);

  let recipe = {
    id: uuidv4(),
    key: `recipe_${slugify(outputId.split(':')[1] || 'item')}_${Date.now().toString(36)}`,
    type,
    outputId,
    outputCount: count,
  };

  if (type === 'shaped') {
    const cells = Array.from(document.querySelectorAll('#craft-grid input')).map(i => i.value.trim());
    if (cells.every(c => !c)) { toast('材料を1つ以上入力してください', true); return; }
    recipe.grid = cells;
  } else {
    const rows = Array.from(document.querySelectorAll('#shapeless-list .shapeless-row'));
    const ingredients = rows.map(r => {
      const inputs = r.querySelectorAll('input');
      return { id: inputs[0].value.trim(), count: Math.max(1, Number(inputs[1].value) || 1) };
    }).filter(i => i.id);
    if (ingredients.length === 0) { toast('材料を1つ以上追加してください', true); return; }
    recipe.ingredients = ingredients;
  }

  state.recipes.push(recipe);
  saveState();
  toast('レシピを追加しました');

  document.getElementById('recipe-form').reset();
  buildCraftGrid();
  document.getElementById('shapeless-list').innerHTML = '';
  renderRecipes();
});

function deleteRecipe(id) {
  if (!confirm('このレシピを削除しますか?')) return;
  state.recipes = state.recipes.filter(r => r.id !== id);
  saveState();
  renderRecipes();
}

function recipeLabel(r) {
  const target = allCraftableTargets().find(t => t.id === r.outputId);
  return target ? target.label.replace(/^\[[^\]]+\]\s*/, '') : r.outputId;
}

function renderRecipes() {
  const list = document.getElementById('recipe-list');
  document.getElementById('count-recipes').textContent = state.recipes.length;
  if (state.recipes.length === 0) {
    list.innerHTML = '<p class="empty-hint">まだレシピがありません。</p>';
    return;
  }
  list.innerHTML = '';
  state.recipes.forEach(r => {
    const card = document.createElement('div');
    card.className = 'item-card';
    const typeLabel = r.type === 'shaped' ? '型あり' : '型なし';
    card.innerHTML = `
      <div class="info">
        <div class="name">→ ${escapeHtml(recipeLabel(r))} x${r.outputCount}</div>
        <div class="sub">${typeLabel} ・ ${r.outputId}</div>
      </div>
      <div class="actions">
        <button class="btn-icon" title="削除" onclick="deleteRecipe('${r.id}')">🗑️</button>
      </div>`;
    list.appendChild(card);
  });
}

/* ---------- プレビュー ---------- */

function renderPreview() {
  const el = document.getElementById('preview-summary');
  el.innerHTML = `
    <div class="stat"><div class="num">${state.items.length}</div><div class="label">アイテム</div></div>
    <div class="stat"><div class="num">${state.blocks.length}</div><div class="label">ブロック</div></div>
    <div class="stat"><div class="num">${state.recipes.length}</div><div class="label">レシピ</div></div>
  `;
}

/* ---------- リセット ---------- */

document.getElementById('btn-reset').addEventListener('click', () => {
  if (!confirm('入力した内容をすべて削除して最初からやり直しますか?この操作は取り消せません。')) return;
  state = defaultState();
  saveState();
  resetItemForm();
  resetBlockForm();
  document.getElementById('meta-icon').value = '';
  renderAll();
  toast('リセットしました');
});

/* ---------- 書き出し (.mcaddon) ---------- */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function buildItemJson(it) {
  const components = {
    'minecraft:icon': `${it.key}_icon`,
    'minecraft:max_stack_size': it.stackSize,
  };
  if (it.type === 'food') {
    components['minecraft:food'] = {
      nutrition: it.food.nutrition,
      saturation_modifier: it.food.saturation,
      can_always_eat: it.food.alwaysEat,
    };
    components['minecraft:use_duration'] = 1.6;
    components['minecraft:use_animation'] = 'eat';
  }
  if (it.type === 'tool') {
    components['minecraft:durability'] = { max_durability: it.tool.durability };
    components['minecraft:damage'] = it.tool.damage;
    components['minecraft:hand_equipped'] = true;
  }
  return {
    format_version: '1.16.100',
    'minecraft:item': {
      description: { identifier: fullId(it.key), category: 'Items' },
      components,
    },
  };
}

function buildBlockJson(b) {
  return {
    format_version: '1.16.100',
    'minecraft:block': {
      description: { identifier: fullId(b.key) },
      components: {
        'minecraft:destroy_time': b.destroyTime,
        'minecraft:explosion_resistance': b.explosionResistance,
        'minecraft:friction': 0.4,
        'minecraft:map_color': b.mapColor,
        'minecraft:loot': `loot_tables/blocks/${b.key}.json`,
      },
    },
  };
}

function buildLootTableJson(id) {
  return {
    pools: [{ rolls: 1, entries: [{ type: 'item', name: id, weight: 1 }] }],
  };
}

function buildRecipeJson(r) {
  if (r.type === 'shaped') {
    const rows = [r.grid.slice(0, 3), r.grid.slice(3, 6), r.grid.slice(6, 9)];
    const key = {};
    const letters = 'ABCDEFGHI'.split('');
    let li = 0;
    const pattern = rows.map(row => row.map(cell => {
      if (!cell) return ' ';
      let letter = Object.keys(key).find(k => key[k].item === cell);
      if (!letter) {
        letter = letters[li++];
        key[letter] = { item: cell };
      }
      return letter;
    }).join(''));
    return {
      format_version: '1.16.100',
      'minecraft:recipe_shaped': {
        description: { identifier: fullId(r.key) },
        tags: ['crafting_table'],
        pattern,
        key,
        result: { item: r.outputId, count: r.outputCount },
      },
    };
  }
  return {
    format_version: '1.16.100',
    'minecraft:recipe_shapeless': {
      description: { identifier: fullId(r.key) },
      tags: ['crafting_table'],
      ingredients: r.ingredients.map(i => ({ item: i.id, count: i.count })),
      result: { item: r.outputId, count: r.outputCount },
    },
  };
}

function buildLangLines() {
  const lines = [];
  state.items.forEach(it => {
    lines.push(`item.${fullId(it.key)}=${it.nameEn || it.nameJa}`);
  });
  state.blocks.forEach(b => {
    lines.push(`tile.${fullId(b.key)}.name=${b.nameEn || b.nameJa}`);
  });
  return lines;
}
function buildLangLinesJa() {
  const lines = [];
  state.items.forEach(it => {
    lines.push(`item.${fullId(it.key)}=${it.nameJa}`);
  });
  state.blocks.forEach(b => {
    lines.push(`tile.${fullId(b.key)}.name=${b.nameJa}`);
  });
  return lines;
}

async function exportAddon() {
  if (typeof JSZip === 'undefined') {
    toast('書き出し機能の読み込みに失敗しました。通信環境を確認してください。', true);
    return;
  }
  if (!state.meta.name.trim()) {
    toast('「基本情報」タブでアドオン名を入力してください', true);
    switchTab('basic');
    return;
  }
  if (state.items.length === 0 && state.blocks.length === 0) {
    toast('アイテムかブロックを1つ以上追加してください', true);
    return;
  }

  const uuids = ensureUuids();
  const addonName = state.meta.name.trim();
  const baseSlug = ns();
  const bpName = `${addonName} [BP]`;
  const rpName = `${addonName} [RP]`;
  const desc = state.meta.description.trim() || `Created with マイクラ アドオンメーカー`;

  const zip = new JSZip();
  const bp = zip.folder(`${baseSlug}_BP`);
  const rp = zip.folder(`${baseSlug}_RP`);

  const bpManifest = {
    format_version: 2,
    header: {
      name: 'pack.name',
      description: 'pack.description',
      uuid: uuids.bpHeader,
      version: [1, 0, 0],
      min_engine_version: [1, 20, 10],
    },
    modules: [
      { type: 'data', uuid: uuids.bpModule, version: [1, 0, 0] },
    ],
    dependencies: [
      { uuid: uuids.rpHeader, version: [1, 0, 0] },
    ],
  };
  const rpManifest = {
    format_version: 2,
    header: {
      name: 'pack.name',
      description: 'pack.description',
      uuid: uuids.rpHeader,
      version: [1, 0, 0],
      min_engine_version: [1, 20, 10],
    },
    modules: [
      { type: 'resources', uuid: uuids.rpModule, version: [1, 0, 0] },
    ],
  };
  bp.file('manifest.json', JSON.stringify(bpManifest, null, 2));
  rp.file('manifest.json', JSON.stringify(rpManifest, null, 2));

  const iconDataURL = state.meta.icon || placeholderIconDataURL(addonName);
  bp.file('pack_icon.png', dataURLBase64(iconDataURL), { base64: true });
  rp.file('pack_icon.png', dataURLBase64(iconDataURL), { base64: true });

  const bpLangEn = [`pack.name=${bpName}`, `pack.description=${desc}`, ''].concat(buildLangLines()).join('\n');
  const rpLangEn = [`pack.name=${rpName}`, `pack.description=${desc}`, ''].concat(buildLangLines()).join('\n');
  const bpLangJa = [`pack.name=${bpName}`, `pack.description=${desc}`, ''].concat(buildLangLinesJa()).join('\n');
  const rpLangJa = [`pack.name=${rpName}`, `pack.description=${desc}`, ''].concat(buildLangLinesJa()).join('\n');
  bp.file('texts/en_US.lang', bpLangEn);
  bp.file('texts/ja_JP.lang', bpLangJa);
  bp.file('texts/languages.json', JSON.stringify(['en_US', 'ja_JP'], null, 2));
  rp.file('texts/en_US.lang', rpLangEn);
  rp.file('texts/ja_JP.lang', rpLangJa);
  rp.file('texts/languages.json', JSON.stringify(['en_US', 'ja_JP'], null, 2));

  const itemTextureData = {};
  state.items.forEach(it => {
    const tex = it.texture || placeholderTextureDataURL(it.key);
    rp.file(`textures/items/${it.key}.png`, dataURLBase64(tex), { base64: true });
    bp.file(`items/${it.key}.json`, JSON.stringify(buildItemJson(it), null, 2));
    itemTextureData[`${it.key}_icon`] = { textures: `textures/items/${it.key}` };
  });
  if (state.items.length > 0) {
    rp.file('textures/item_texture.json', JSON.stringify({
      resource_pack_name: ns(),
      texture_name: 'atlas.items',
      texture_data: itemTextureData,
    }, null, 2));
  }

  const blocksJson = { format_version: [1, 1, 0] };
  const terrainTextureData = {};
  state.blocks.forEach(b => {
    const tex = b.texture || placeholderTextureDataURL(b.key);
    rp.file(`textures/blocks/${b.key}.png`, dataURLBase64(tex), { base64: true });
    bp.file(`blocks/${b.key}.json`, JSON.stringify(buildBlockJson(b), null, 2));
    bp.file(`loot_tables/blocks/${b.key}.json`, JSON.stringify(buildLootTableJson(fullId(b.key)), null, 2));
    blocksJson[fullId(b.key)] = { textures: `${b.key}_tex`, sound: 'stone' };
    terrainTextureData[`${b.key}_tex`] = { textures: `textures/blocks/${b.key}` };
  });
  if (state.blocks.length > 0) {
    rp.file('blocks.json', JSON.stringify(blocksJson, null, 2));
    rp.file('textures/terrain_texture.json', JSON.stringify({
      resource_pack_name: ns(),
      texture_name: 'atlas.terrain',
      padding: 8,
      num_mip_levels: 4,
      texture_data: terrainTextureData,
    }, null, 2));
  }

  state.recipes.forEach(r => {
    bp.file(`recipes/${r.key}.json`, JSON.stringify(buildRecipeJson(r), null, 2));
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseSlug}.mcaddon`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  toast('ダウンロードしました!Minecraftでファイルを開いてインポートしてください。');
}

document.getElementById('btn-export').addEventListener('click', exportAddon);
document.getElementById('btn-export-2').addEventListener('click', exportAddon);

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
}

/* ---------- 初期化 ---------- */

function renderAll() {
  renderBasic();
  renderItems();
  renderBlocks();
  renderRecipes();
  renderRecipeFormOptions();
  renderPreview();
}

renderAll();
