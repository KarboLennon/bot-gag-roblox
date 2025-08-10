const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// ====== CONFIG ======
const groupId = '120363400948750978@g.us';
const API_URL = 'https://gagapi.onrender.com/alldata';

// EDIT watchlist yang mau dipantau
const WATCH_SEEDS = [
  'Burning Bud',
  'Giant Pinecone',
  'Elder Strawberry',
  'Sugar Apple',
  'Ember Lily',
  'Beanstalk',
  'Cacao',
  'Pepper',
  'Mushroom',
  'Grape',
  'Mango',
  'Coconut',
  'Cactus',
  'Dragon Fruit',
];

const WATCH_GEARS = [
  'Advanced Sprinkler',
  'Godly Sprinkler',
  'Master Sprinkler',
  'Grandmaster Sprinkler',
  'Levelup Lollipop',
];

// Interval cek API & reminder
const POLL_MS = 17_000;            // cek data tiap 20 detik
const REMIND_INTERVAL_MS = 30_000; // reminder tiap 30 detik
const MAX_REMIND_TIMES = 7;   

// ====== STATE ======
const client = new Client({ authStrategy: new LocalAuth() });
let lastData = null;

const ACTIVE_ALERTS = new Map();

// ====== HELPERS ======
const normalizeName = (s) =>
  String(s || '').toLowerCase().trim()
    .replace(/favourite/g, 'favorite')
    .replace(/\s+/g, ' ');

// Precompute watchlist (normalized)
const WATCH_SEEDS_SET = new Set(WATCH_SEEDS.map(normalizeName));
const WATCH_GEARS_SET = new Set(WATCH_GEARS.map(normalizeName));

// Rarity → emoji
const TIER_EMOJIS = {
  Common: '⚪',
  Uncommon: '🟢',
  Rare: '🔵',
  Legendary: '🟡',
  Mythical: '🟣',
  Divine: '🟠',
  Prismatic: '🌈',
  Transcendent: '✨'
};

// Rarity ranking (buat threshold reminder)
const RARITY_RANK = {
  'Common': 1,
  'Uncommon': 2,
  'Rare': 3,
  'Legendary': 4,
  'Mythical': 5,
  'Divine': 6,
  'Prismatic': 7,
  'Transcendent': 8
};

// === Seed tiers (from crop_tears.json) ===
const SEED_TIERS = {
  "carrot": "Common", "strawberry": "Common", "chocolate carrot": "Common",
  "blueberry": "Uncommon", "orange tulip": "Uncommon", "nightshade": "Uncommon", "rose": "Uncommon", "onion": "Uncommon", "monoblooma": "Uncommon", "manuka flower": "Uncommon", "lavender": "Uncommon", "wild carrot": "Uncommon", "dezen": "Uncommon", "artichoke": "Uncommon", "crocus": "Uncommon", "serenity": "Uncommon", "stonebite": "Uncommon", "red lollipop": "Uncommon",
  "tomato": "Rare", "corn": "Rare", "cauliflower": "Rare", "raspberry": "Rare", "glowshroom": "Rare", "daffodil": "Rare", "mint": "Rare", "bee balm": "Rare", "foxglove": "Rare", "pear": "Rare", "delphinium": "Rare", "peace lily": "Rare", "twisted tangle": "Rare", "zenflare": "Rare", "succulent": "Rare", "paradise petal": "Rare", "jalapeno": "Rare", "horsetail": "Rare", "crown melon": "Rare", "nectarshade": "Rare", "dandelion": "Rare", "candy sunflower": "Rare",
  "apple": "Legendary", "green apple": "Legendary", "avocado": "Legendary", "papaya": "Legendary", "watermelon": "Legendary", "pumpkin": "Legendary", "cranberry": "Legendary", "rafflesia": "Legendary", "bamboo": "Legendary", "durian": "Legendary", "moonflower": "Legendary", "starfruit": "Legendary", "veinpetal": "Legendary", "sakura bush": "Legendary", "cantaloupe": "Legendary", "lilac": "Legendary", "lingonberry": "Legendary", "nectar thorn": "Legendary", "soft sunshine": "Legendary", "violet corn": "Legendary", "enkaku": "Legendary", "lucky bamboo": "Legendary", "aloe vera": "Legendary", "horned dinoshroom": "Legendary", "lumira": "Legendary", "taro flower": "Legendary", "boneboo": "Legendary",
  "peach": "Mythical", "lemon": "Mythical", "coconut": "Mythical", "banana": "Mythical", "pineapple": "Mythical", "easter egg": "Mythical", "kiwi": "Mythical", "cactus": "Mythical", "passionfruit": "Mythical", "dragon fruit": "Mythical", "bell pepper": "Mythical", "blood banana": "Mythical", "mango": "Mythical", "prickly pear": "Mythical", "celestiberry": "Mythical", "egg plant": "Mythical", "moon melon": "Mythical", "moonglow": "Mythical", "nectarine": "Mythical", "lily of the valley": "Mythical", "amber spine": "Mythical", "pink lily": "Mythical", "cocovine": "Mythical", "spiked mango": "Mythical", "guanabana": "Mythical", "firefly fern": "Mythical", "purple dahlia": "Mythical", "sugarglaze": "Mythical", "suncoil": "Mythical", "hinomai": "Mythical", "tall asparagus": "Mythical", "honeysuckle": "Mythical", "zen rocks": "Mythical", "bendboo": "Mythical", "parasol flower": "Mythical",
  "cherry blossom": "Divine", "soul fruit": "Divine", "grape": "Divine", "loquat": "Divine", "pepper": "Divine", "cacao": "Divine", "feijoa": "Divine", "cursed fruit": "Divine", "lotus": "Divine", "moon mango": "Divine", "pitcher plant": "Divine", "hive fruit": "Divine", "moon blossom": "Divine", "rosy delight": "Divine", "grand volcania": "Divine", "traveler's fruit": "Divine", "taco fern": "Divine", "maple apple": "Divine", "fossilight": "Divine", "grand tomato": "Divine", "dragon pepper": "Divine", "candy blossom": "Divine", "mushroom": "Divine", "sunflower": "Divine",
  "beanstalk": "Prismatic", "sugar apple": "Prismatic", "ember lily": "Prismatic", "burning bud": "Prismatic", "giant pinecone": "Prismatic", "elephant ears": "Prismatic", "elder strawberry": "Prismatic", "tranquil bloom": "Prismatic",
  "bone blossom": "Transcendent"
};

// === Gear tiers (from gear_tiers.json) ===
const GEAR_TIERS_ARRAY = [
  { "name": "Watering Can", "rarity": "Common" },
  { "name": "Trading Ticket", "rarity": "Uncommon" },
  { "name": "Trowel", "rarity": "Uncommon" },
  { "name": "Recall Wrench", "rarity": "Uncommon" },
  { "name": "Basic Sprinkler", "rarity": "Rare" },
  { "name": "Advanced Sprinkler", "rarity": "Legendary" },
  { "name": "Medium Toy", "rarity": "Legendary" },
  { "name": "Medium Treat", "rarity": "Legendary" },
  { "name": "Godly Sprinkler", "rarity": "Mythical" },
  { "name": "Magnifying Glass", "rarity": "Mythical" },
  { "name": "Master Sprinkler", "rarity": "Divine" },
  { "name": "Cleaning Spray", "rarity": "Divine" },
  { "name": "Favourite Tool", "rarity": "Divine" },
  { "name": "Harvest Tool", "rarity": "Divine" },
  { "name": "Friendship Pot", "rarity": "Divine" },
  { "name": "Grandmaster Sprinkler", "rarity": "Prismatic" },
  { "name": "Levelup Lollipop", "rarity": "Prismatic" }
];
const GEAR_TIER_MAP = Object.fromEntries(
  GEAR_TIERS_ARRAY.map(it => [normalizeName(it.name), it.rarity])
);

// ====== WEATHER ======
const WEATHER_MAP = {
  normal: { emoji: '🌤️', label: 'Normal' },
  rain: { emoji: '🌧️', label: 'Rain' },
  frost: { emoji: '❄️', label: 'Frost' },
  thunder: { emoji: '⛈️', label: 'Thunderstorm' },
  thunderstorm: { emoji: '⛈️', label: 'Thunderstorm' },

  // Event
  night: { emoji: '🌙', label: 'Night' },
  meteor_shower: { emoji: '☄️', label: 'Meteor Shower' },
  blood_moon: { emoji: '🌕', label: 'Blood Moon' },
  heatwave: { emoji: '🔥', label: 'Heatwave' },
  windy: { emoji: '💨', label: 'Windy' },
  tropical_rain: { emoji: '🌦️', label: 'Tropical Rain' },
  drought: { emoji: '🏜️', label: 'Drought' },
  aurora: { emoji: '🌌', label: 'Aurora' },
  sandstorm: { emoji: '🌪️', label: 'Sandstorm' },
  gale: { emoji: '💨', label: 'Gale' },
  bee_swarm: { emoji: '🐝', label: 'Bee Swarm' },
  working_bee_swarm: { emoji: '🐝', label: 'Working Bee Swarm' },
  zen_aura: { emoji: '🪷', label: 'Zen Aura' },
  corrupted_aura: { emoji: '☠️', label: 'Corrupted Aura' },
  kitchen_storm: { emoji: '🍳', label: 'Kitchen Storm' },

  // Admin Weather
  disco: { emoji: '🪩', label: 'Disco' },
  jandel_storm: { emoji: '🌀', label: 'Jandel Storm' },
  sheckle_rain: { emoji: '🪙', label: 'Sheckle Rain' },
  chocolate_rain: { emoji: '🍫', label: 'Chocolate Rain' },
  lazer_storm: { emoji: '🔫', label: 'Lazer Storm' },
  tornado: { emoji: '🌪️', label: 'Tornado' },
  black_hole: { emoji: '⚫', label: 'Black Hole' },
  sun_god: { emoji: '☀️', label: 'Sun God' },
  floating_jandel: { emoji: '🪂', label: 'Floating Jandel' },
  volcano: { emoji: '🌋', label: 'Volcano Event' },
  meteor_strike: { emoji: '☄️', label: 'Meteor Strike' },
  alien_invasion: { emoji: '👽', label: 'Alien Invasion' },
  space_travel: { emoji: '🚀', label: 'Space Travel' },
  fried_chicken: { emoji: '🍗', label: 'Fried Chicken' },
  under_the_sea: { emoji: '🌊', label: 'Under the Sea' },
  solar_flare: { emoji: '🌞', label: 'Solar Flare' },
  dj_sam: { emoji: '🎧', label: 'DJ Sam' },
  obby: { emoji: '🪜', label: 'Obby' },
  brains: { emoji: '🧟', label: 'Brains (Zombie Event)' },
  armageddon: { emoji: '💥', label: 'Armageddon' },
  the_carrot: { emoji: '🥕', label: 'The Carrot' },
  route_runner: { emoji: '🏃', label: 'Route Runner' },
  lightning_storm: { emoji: '🌩️', label: 'Lightning Storm' },
  junkbot_raid: { emoji: '🤖', label: 'Junkbot Raid' },
  boil_rain: { emoji: '♨️', label: 'Boil Rain' },
  oil_rain: { emoji: '🛢️', label: 'Oil Rain' }
};

function nowWIB() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

async function getGroupMentionIds(chatId) {
  const chat = await client.getChatById(chatId);
  return chat.participants.map(p => p.id._serialized);
}

async function stopAlert(uniqueKey, reason = 'Notif dihentikan.') {
  const rec = ACTIVE_ALERTS.get(uniqueKey);
  if (rec?.timeoutId) clearTimeout(rec.timeoutId);
  ACTIVE_ALERTS.delete(uniqueKey);
  if (rec?.chatId) {
    try { await client.sendMessage(rec.chatId, `✅ ${reason}`); } catch { }
  }
}

async function stopAll(reason = 'Semua notif dihentikan.') {
  const keys = Array.from(ACTIVE_ALERTS.keys());
  for (const k of keys) await stopAlert(k, reason);
}

async function alertUntilSomeoneReads(chatId, text, uniqueKey) {
  if (ACTIVE_ALERTS.has(uniqueKey)) return;

  const mentions = await getGroupMentionIds(chatId);
  const anchorMsg = await client.sendMessage(chatId, text, { mentions });

  const rec = {
    tries: 0,
    chatId,
    startedAt: Date.now(),
    anchorId: anchorMsg.id.id,
    timeoutId: null
  };
  ACTIVE_ALERTS.set(uniqueKey, rec);

  const tick = async () => {
    if (!ACTIVE_ALERTS.has(uniqueKey)) return;
    try {
      const info = await anchorMsg.getInfo();
      const hasReader = Array.isArray(info.read) && info.read.length > 0;
      if (hasReader) return void stopAlert(uniqueKey, 'Notif stop: sudah ada yang baca.');

      rec.tries++;
      if (rec.tries >= MAX_REMIND_TIMES) {
        return void stopAlert(uniqueKey, 'Notif dihentikan: batas reminder tercapai.');
      }

      const mentions = await getGroupMentionIds(chatId);
      await client.sendMessage(chatId, `🔔 *Reminder ${rec.tries}/${MAX_REMIND_TIMES}*\n${text}`, { mentions });
      rec.timeoutId = setTimeout(tick, REMIND_INTERVAL_MS);
      ACTIVE_ALERTS.set(uniqueKey, rec);
    } catch (e) {
      console.error('alertUntilSomeoneReads error:', e.message);
      rec.timeoutId = setTimeout(tick, REMIND_INTERVAL_MS);
      ACTIVE_ALERTS.set(uniqueKey, rec);
    }
  };

  rec.timeoutId = setTimeout(tick, REMIND_INTERVAL_MS);
  ACTIVE_ALERTS.set(uniqueKey, rec);
}

// ====== WEATHER HELPERS ======
function formatWeatherLine(weather) {
  if (!weather) return null;
  const typeKey = String(weather.type || 'normal').toLowerCase().replace(/\s+/g, '_');
  const map = WEATHER_MAP[typeKey] || { emoji: '⛅', label: (weather.type || 'Normal') };
  const activeTxt = weather.active ? 'aktif' : 'non-aktif';
  const effectsTxt = Array.isArray(weather.effects) && weather.effects.length
    ? ` | efek: ${weather.effects.join(', ')}`
    : '';
  const last = new Date(weather.lastUpdated || Date.now()).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  return `${map.emoji} *Cuaca:* ${map.label} (${activeTxt}) • update: ${last} WIB${effectsTxt}`;
}

function weatherChanged(newWx, oldWx) {
  if (!newWx && !oldWx) return false;
  if (!oldWx) return true;
  const a = {
    type: (newWx.type || '').toLowerCase(),
    active: !!newWx.active,
    effects: JSON.stringify(newWx.effects || []),
    lastUpdated: newWx.lastUpdated || ''
  };
  const b = {
    type: (oldWx.type || '').toLowerCase(),
    active: !!oldWx.active,
    effects: JSON.stringify(oldWx.effects || []),
    lastUpdated: oldWx.lastUpdated || ''
  };
  return a.type !== b.type || a.active !== b.active || a.effects !== b.effects || a.lastUpdated !== b.lastUpdated;
}

function formatRecentWeatherHistory(history = [], n = 3) {
  if (!Array.isArray(history) || history.length === 0) return '';
  const lastN = history.slice(-n).reverse(); 
  const lines = lastN.map((h) => {
    const tKey = String(h.type || 'normal').toLowerCase().replace(/\s+/g, '_');
    const e = (WEATHER_MAP[tKey]?.emoji) || '⛅';
    const label = (WEATHER_MAP[tKey]?.label) || (h.type || 'Normal');
    const start = h.startTime ? new Date(h.startTime).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';
    const end = h.endTime ? new Date(h.endTime).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : (h.active ? 'berlangsung' : '-');
    return `- ${e} ${label} • ${start} → ${end}`;
  });
  return `\n🗓️ *Riwayat Cuaca Terakhir:*\n${lines.join('\n')}`;
}

// ====== CORE CHECK (BATCH) ======
async function checkData() {
  try {
    const { data: newData } = await axios.get(API_URL);

    if (!lastData) {
      lastData = newData;
      return;
    }

    const seedLines = [];
    const gearLines = [];
    let honeyLines = [];
    let weatherLine = null;

    // flags untuk aturan reminder khusus
    let seedHasHighTrigger = false; // Divine+
    let gearHasHighTrigger = false; // Divine+

    // === WEATHER ===
    if (newData.weather && weatherChanged(newData.weather, lastData.weather)) {
      weatherLine = formatWeatherLine(newData.weather);
    }

    // === Seeds (watchlist) ===
    if (Array.isArray(newData.seeds)) {
      for (const s of newData.seeds) {
        const name = s.name || '';
        const norm = normalizeName(name);
        if (!WATCH_SEEDS_SET.has(norm)) continue;

        const prevQty = lastData.seeds?.find(x => normalizeName(x.name) === norm)?.quantity ?? 0;
        if (s.quantity > 0 && s.quantity !== prevQty) {
          const tier = SEED_TIERS[norm] || 'Unknown';
          const emoji = TIER_EMOJIS[tier] || '';
          seedLines.push(`- ${emoji}[${tier}] ${name}: *${s.quantity}*`);

          if (RARITY_RANK[tier] >= RARITY_RANK['Divine']) {
            seedHasHighTrigger = true;
          }
        }
      }
    }

    // === Gears (watchlist) ===
    if (Array.isArray(newData.gear)) {
      for (const g of newData.gear) {
        const name = g.name || '';
        const norm = normalizeName(name);
        if (!WATCH_GEARS_SET.has(norm)) continue;

        const prevQty = lastData.gear?.find(x => normalizeName(x.name) === norm)?.quantity ?? 0;
        if (g.quantity > 0 && g.quantity !== prevQty) {
          const tier = GEAR_TIER_MAP[norm] || 'Unknown';
          const emoji = TIER_EMOJIS[tier] || '';
          gearLines.push(`- ${emoji}[${tier}] ${name}: *${g.quantity}*`);

          if (RARITY_RANK[tier] >= RARITY_RANK['Mythical']) {
            gearHasHighTrigger = true;
          }
        }
      }
    }

    // === Honey Shop (event shop) ===
    if (Array.isArray(newData.honey)) {
      const prevMap = new Map((lastData.honey || []).map(h => [normalizeName(h.name), h.quantity || 0]));
      for (const h of newData.honey) {
        const name = h.name || '';
        const norm = normalizeName(name);
        const qty = h.quantity || 0;
        const prevQty = prevMap.get(norm) ?? 0;

        if (qty > 0 && (qty !== prevQty || !prevMap.has(norm))) {
          honeyLines.push(`- ${name}: *${qty}*`);
        }
      }
    }

    // === Build & send message ===
    const hasNonWeather = seedLines.length || gearLines.length || honeyLines.length;
    const hasWeather = !!weatherLine;

    if (hasNonWeather || hasWeather) {
      const pieces = [];
      pieces.push(`🚨 *Information Alert* (${nowWIB()} WIB)`);

      // deklarasi di luar biar gak out-of-scope
      if (hasWeather) {
        pieces.push(`\n${weatherLine}`);
      }
      if (seedLines.length) pieces.push(`\n🌱 *Seeds:*\n${seedLines.join('\n')}`);
      if (gearLines.length) pieces.push(`\n🛠 *Gears:*\n${gearLines.join('\n')}`);
      if (honeyLines.length) pieces.push(`\n🍯 *Honey Shop:*\n${honeyLines.join('\n')}`);

      // Reminder hanya kalau ada trigger high-tier sesuai aturan
      const shouldRemind = hasNonWeather && (seedHasHighTrigger || gearHasHighTrigger);

      if (shouldRemind) {
        const finalPieces = [...pieces, `\n• Respon untuk mematikan reminder.`];
        const finalText = finalPieces.join('');
        const key = `batch:${Date.now()}`;
        await alertUntilSomeoneReads(groupId, finalText, key);
      } else {
        const textOnce = pieces.join('');
        const mentions = await getGroupMentionIds(groupId);
        await client.sendMessage(groupId, textOnce, { mentions });
      }
    }

    lastData = newData;
  } catch (err) {
    console.error(`[${nowWIB()}] Error fetch API:`, err.message);
  }
}

// ====== EVENTS ======
client.on('qr', (qr) => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
  console.log(`[${nowWIB()}] Ready`);
  checkData();
  setInterval(checkData, POLL_MS);
});

// Stop manual & stop on any incoming message
client.on('message', async (m) => {
  const lower = m.body?.toLowerCase?.() || '';

  if (lower.startsWith('!stopalert')) {
    const key = normalizeName(m.body.split(' ')[1] || '');
    if (key && ACTIVE_ALERTS.has(key)) {
      await stopAlert(key, `Alert "${key}" dihentikan manual.`);
    } else {
      await m.reply('Tidak ada alert aktif dengan key itu.');
    }
    return;
  }

  if (lower === '!stopall') {
    await stopAll('Semua alert dihentikan manual.');
    return;
  }

  if (m.from === groupId && !m.fromMe && ACTIVE_ALERTS.size) {
    await stopAll('Oke.');
  }
});

client.initialize();
