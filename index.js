const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const WebSocket = require('ws');

// ====== CONFIG ======
const groupId = '120363400948750978@g.us';
const JSTUDIO_KEY = process.env.JSTUDIO_KEY || 'YOUR_JSTUDIO_KEY_HERE';
const WS_URL = `wss://websocket.joshlei.com/growagarden?jstudio-key=${encodeURIComponent(JSTUDIO_KEY)}`;

const WATCH_SEEDS = [
  'Burning Bud', 'Giant Pinecone', 'Elder Strawberry', 'Sugar Apple', 'Ember Lily',
  'Beanstalk', 'Cacao', 'Pepper', 'Watermelon', 'Pumpkin', 'Mushroom', 'Grape', 'Pumpkin',
  'Mango', 'Cactus', 'Dragon Fruit', 'Cactus', 'Coconut', 'Apple', 'Bamboo'
];
const WATCH_GEARS = [
  'Basic Sprinkler', 'Advanced Sprinkler', 'Godly Sprinkler', 'Master Sprinkler', 'Grandmaster Sprinkler', 'Levelup Lollipop'
];

// ====== STATE ======
let sock;
let groupMentions = [];
let lastData = null;
const ACTIVE_ALERTS = new Map();

// WS
let ws;
let wsStarted = false;
let heartbeatTimer = null;

// Weather state
let lastWeatherActive = [];
let lastWeatherSig = null;

// ====== WEATHER MAP ======
const WEATHER_META = {
  rain: { emoji: '\u{1F327}\uFE0F', label: 'Rain' },                 // ???
  heatwave: { emoji: '\u{1F525}', label: 'Heatwave' },             // ??
  summerharvest: { emoji: '\u{1F33E}', label: 'Summer Harvest' },       // ??
  tornado: { emoji: '\u{1F32A}\uFE0F', label: 'Tornado' },              // ???
  windy: { emoji: '\u{1F4A8}', label: 'Windy' },                // ??
  auroraborealis: { emoji: '\u{1F30C}', label: 'Aurora Borealis' },      // ??
  tropicalrain: { emoji: '\u{1F326}\uFE0F', label: 'Tropical Rain' },        // ???
  nightevent: { emoji: '\u{1F319}', label: 'Night Event' },          // ??
  sungod: { emoji: '\u2600\uFE0F', label: 'Sun God' },              // ??
  megaharvest: { emoji: '\u{1F33E}', label: 'Mega Harvest' },         // ??
  gale: { emoji: '\u{1F4A8}', label: 'Gale' },                 // ??
  thunderstorm: { emoji: '\u26C8\uFE0F', label: 'Thunderstorm' },         // ??
  bloodmoonevent: { emoji: '\u{1F315}', label: 'Blood Moon' },           // ??
  meteorshower: { emoji: '\u2604\uFE0F', label: 'Meteor Shower' },        // ??
  spacetravel: { emoji: '\u{1F680}', label: 'Space Travel' },         // ??
  disco: { emoji: '\u{1FAA9}', label: 'Disco' },                // ??
  djjhai: { emoji: '\u{1F3A7}', label: 'DJ Jhai' },              // ??
  blackhole: { emoji: '\u26AB', label: 'Black Hole' },           // ?
  jandelstorm: { emoji: '\u{1F300}', label: 'Jandel Storm' },         // ??
  sandstorm: { emoji: '\u{1F32A}\uFE0F', label: 'Sandstorm' },            // ???
  djsandstorm: { emoji: '\u{1FAA9}', label: 'DJ Sandstorm' },         // ??
  volcano: { emoji: '\u{1F30B}', label: 'Volcano' },              // ??
  underthesea: { emoji: '\u{1F30A}', label: 'Under the Sea' },        // ??
  alieninvasion: { emoji: '\u{1F47D}', label: 'Alien Invasion' },       // ??
  jandellazer: { emoji: '\u{1F52B}', label: 'Jandel Lazer' },         // ??
  obby: { emoji: '\u{1FA9C}', label: 'Obby' },                 // ??
  poolparty: { emoji: '\u{1F3CA}', label: 'Pool Party' },           // ??
  jandelzombie: { emoji: '\u{1F9DF}', label: 'Jandel Zombie' },        // ??
  frost: { emoji: '\u2744', label: 'Frost' },                // ??
  radioactivecarrot: { emoji: '\u2622', label: 'Radioactive Carrot' },   // ??
  armageddon: { emoji: '\u{1F4A5}', label: 'Armageddon' },           // ??
  zenaura: { emoji: '\u{1FAB7}', label: 'Zen Aura' },             // ??
  corruptzenaura: { emoji: '\u2620', label: 'Corrupt Zen Aura' },     // ??
  crystalbeams: { emoji: '\u{1F52E}', label: 'Crystal Beams' },        // ??
  jandelfloat: { emoji: '\u{1FA82}', label: 'Jandel Float' },         // ??
  chickenrain: { emoji: '\u{1F414}', label: 'Chicken Rain' },         // ??
  tk_routerunner: { emoji: '\u{1F3C3}', label: 'Route Runner' },         // ??
  tk_moneyrain: { emoji: '\u{1FA99}', label: 'Money Rain' },           // ??
  tk_lightningstorm: { emoji: '\u{1F329}\uFE0F', label: 'Lightning Storm' },      // ???
  jandelkatana: { emoji: '\u{1F5E1}', label: 'Jandel Katana' },        // ???
  acidrain: { emoji: '\u{1F9EA}', label: 'Acid Rain' },            // ??
  meteorstrike: { emoji: '\u2604\uFE0F', label: 'Meteor Strike' },        // ??
  flamingofloat: { emoji: '\u{1F9A9}', label: 'Flamingo Float' },       // ??
  flamingolazer: { emoji: '\u{1F52B}', label: 'Flamingo Lazer' },       // ??
  junkbotraid: { emoji: '\u{1F916}', label: 'Junkbot Raid' },         // ??
  boil: { emoji: '\u2668', label: 'Boil' },                 // ??
  oil: { emoji: '\u{1F6E2}', label: 'Oil' },                  // ???
  kitchenstorm: { emoji: '\u{1F373}', label: 'Kitchen Storm' }         // ??
};

// ====== WEATHER EFFECTS (ID -> deskripsi singkat ID) ======
const WEATHER_EFFECTS = {
  rain: "Pertumbuhan +50%, peluang mutasi *Wet* (Nilai jual x 2).",
  thunderstorm: "Pertumbuhan +50%, sambaran petir bisa memberi mutasi *Shocked*.",
  frost: "Pertumbuhan +50%, mutasi *Chilled* (x 2) & bisa *Frozen* (x 10), makin besar bila sebelumnya *Wet*.",
  nightevent: "Event malam (±10 menit tiap ±4 jam), peluang mutasi *Moonlit* (x 2).",
  bloodmoonevent: "Varian malam langka, peluang mutasi *Bloodlit* (x 4).",
  meteorshower: "peluang mutasi *Celestial* (x 120).",
  heatwave: "peluang mutasi *Sundried* (x 85).",
  windy: "peluang mutasi *Windstruck* (x 2).",
  tropicalrain: "Pertumbuhan +50%, peluang mutasi *Drenched* (x 5).",
  auroraborealis: "pertumbuhan +50% & peluang mutasi *Aurora*.",
  gale: "efek angin mendorong pemain, peluang *Windstruck*.",
  sandstorm: "peluang mutasi *Sandy*",
  tornado: "peluang mutasi *Twisted* (x 30).",
  blackhole: "peluang mutasi *Voidtouched* (x 135).",
  sungod: "peluang mutasi *Dawnbound* (x 150) (bonus bila memegang *Sunflower*).",
  meteorsrike: "peluang mutasi *Kosmik*.",
  meteorstrike: "peluang mutasi *Kosmik*.",
  disco: "drop/efek khusus.",
  jandelstorm: "petir sering, lebih ke seru-seruan.",
  djsandstorm: "Varian sandstorm oleh DJ.",
  jandellazer: "peluang mutasi *Plasma* (x 5).",
  flamingolazer: "efek mirip lazer.",
  flamingofloat: "efek kosmetik/seru-seruan.",
  jandelfloat: "efek seru-seruan.",
  junkbotraid: "efek khusus area.",
  radioactivecarrot: "efek khusus wortel radioaktif.",
  armageddon: "berbagai efek unik.",
  zenaura: "peluang mutasi bertema *Tranquil*.",
  corruptzenaura: "peluang mutasi *Corrupt*.",
  crystalbeams: "peluang mutasi bertema kristal.",
  poolparty: "efek fun.",
  obby: "efek fun.",
  underthesea: "Bawah laut : efek fun.",
  alieninvasion: "Invasi alien : efek unik.",
  jandelzombie: "Serangan zombie : efek unik.",
  jandelkatana: "Katana khusus : efek unik.",
  tk_routerunner: "Mini-event lari rute : efek fun.",
  tk_moneyrain: "Hujan uang : bonus coin sementara.",
  tk_lightningstorm: "Petir mini-event : efek fun.",
  boil: "Air mendidih : efek lingkungan.",
  oil: "Minyak tumpah : efek lingkungan.",
  volcano: "Letusan : efek lingkungan.",
  kitchenstorm: "Badai Dapur: kecepatan memasak x 2 & peluang mutasi *Aromatic* meningkat."
};


const normalizeName = (s) =>
  String(s || '').toLowerCase().trim().replace(/favourite/g, 'favorite').replace(/\s+/g, ' ');
const seedWatchSet = new Set(WATCH_SEEDS.map(normalizeName));
const gearWatchSet = new Set(WATCH_GEARS.map(normalizeName));
const normWxId = (id) => String(id || '').toLowerCase().replace(/[\s\-]/g, '');

function nowWIB() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}
const toWIBTime = (unix) => unix ? new Date(unix * 1000).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }) : '-';

// ====== WhatsApp helpers ======
async function refreshGroupMentions() {
  try {
    const meta = await sock.groupMetadata(groupId);
    groupMentions = (meta?.participants || []).map(p => p.id);
  } catch (e) {
    console.error('refreshGroupMentions error:', e.message);
    groupMentions = [];
  }
}

// ====== RARITY / TIERS ======
const TIER_EMOJIS = {
  Common: '\u26AA',            // ?
  Uncommon: '\uD83D\uDFE2',      // ??
  Rare: '\uD83D\uDFE6',      // ??
  Legendary: '\uD83D\uDFE1',      // ??
  Mythical: '\uD83D\uDFE3',      // ??
  Divine: '\uD83D\uDFE0',      // ??
  Prismatic: '\u{1F308}',         // ??
  Transcendent: '\u2728'             // ?
};


// Ranking buat threshold
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

// === Seed tiers (copied from old code) ===
const SEED_TIERS = {
  "carrot": "Common", "strawberry": "Common", "chocolate carrot": "Common",
  "blueberry": "Uncommon", "orange tulip": "Uncommon", "nightshade": "Uncommon", "rose": "Uncommon", "onion": "Uncommon", "monoblooma": "Uncommon", "manuka flower": "Uncommon", "wild carrot": "Uncommon", "dezen": "Uncommon", "artichoke": "Uncommon", "crocus": "Uncommon", "serenity": "Uncommon", "stonebite": "Uncommon", "red lollipop": "Uncommon",
  "tomato": "Rare", "corn": "Rare", "cauliflower": "Rare", "raspberry": "Rare", "glowshroom": "Rare", "daffodil": "Rare", "mint": "Rare", "bee balm": "Rare", "foxglove": "Rare", "pear": "Rare", "delphinium": "Rare", "peace lily": "Rare", "twisted tangle": "Rare", "zenflare": "Rare", "succulent": "Rare", "paradise petal": "Rare", "jalapeno": "Rare", "horsetail": "Rare", "crown melon": "Rare", "nectarshade": "Rare", "dandelion": "Rare", "candy sunflower": "Rare",
  "apple": "Legendary", "green apple": "Legendary", "avocado": "Legendary", "papaya": "Legendary", "watermelon": "Legendary", "pumpkin": "Legendary", "cranberry": "Legendary", "rafflesia": "Legendary", "bamboo": "Legendary", "durian": "Legendary", "moonflower": "Legendary", "starfruit": "Legendary", "veinpetal": "Legendary", "sakura bush": "Legendary", "cantaloupe": "Legendary", "lilac": "Legendary", "lingonberry": "Legendary", "nectar thorn": "Legendary", "soft sunshine": "Legendary", "violet corn": "Legendary", "enkaku": "Legendary", "lucky bamboo": "Legendary", "aloe vera": "Legendary", "horned dinoshroom": "Legendary", "lumira": "Legendary", "taro flower": "Legendary", "boneboo": "Legendary",
  "peach": "Mythical", "lemon": "Mythical", "coconut": "Mythical", "banana": "Mythical", "pineapple": "Mythical", "easter egg": "Mythical", "kiwi": "Mythical", "cactus": "Mythical", "passionfruit": "Mythical", "dragon fruit": "Mythical", "bell pepper": "Mythical", "blood banana": "Mythical", "mango": "Mythical", "prickly pear": "Mythical", "celestiberry": "Mythical", "egg plant": "Mythical", "moon melon": "Mythical", "moonglow": "Mythical", "nectarine": "Mythical", "lily of the valley": "Mythical", "amber spine": "Mythical", "pink lily": "Mythical", "cocovine": "Mythical", "spiked mango": "Mythical", "guanabana": "Mythical", "firefly fern": "Mythical", "purple dahlia": "Mythical", "sugarglaze": "Mythical", "suncoil": "Mythical", "hinomai": "Mythical", "tall asparagus": "Mythical", "honeysuckle": "Mythical", "zen rocks": "Mythical", "bendboo": "Mythical", "parasol flower": "Mythical",
  "cherry blossom": "Divine", "soul fruit": "Divine", "grape": "Divine", "loquat": "Divine", "pepper": "Divine", "cacao": "Divine", "feijoa": "Divine", "cursed fruit": "Divine", "lotus": "Divine", "moon mango": "Divine", "pitcher plant": "Divine", "hive fruit": "Divine", "moon blossom": "Divine", "rosy delight": "Divine", "grand volcania": "Divine", "traveler's fruit": "Divine", "taco fern": "Divine", "maple apple": "Divine", "fossilight": "Divine", "grand tomato": "Divine", "dragon pepper": "Divine", "candy blossom": "Divine", "mushroom": "Divine", "sunflower": "Divine",
  "beanstalk": "Prismatic", "sugar apple": "Prismatic", "ember lily": "Prismatic", "burning bud": "Prismatic", "giant pinecone": "Prismatic", "elephant ears": "Prismatic", "elder strawberry": "Prismatic", "tranquil bloom": "Prismatic",
  "bone blossom": "Transcendent"
};

// === Gear tiers (copied from old code) ===
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

// ====== Build batch message ======
function buildBatchMessage({ seedLines = [], gearLines = [], honeyLines = [], shopLabel = 'Event Shop', endUnix = 0 }) {
  const parts = [];
  parts.push(`\u{1F6A8} Item Baru Muncul`);

  if (seedLines.length) parts.push(`\n\n\u{1F331} *Seeds:*\n${seedLines.join('\n')}`);
  if (gearLines.length) parts.push(`\n\n\u{1F6E0} *Gears:*\n${gearLines.join('\n')}`);
  if (honeyLines.length) parts.push(`\n\n\u{1F36F} *${shopLabel}:*\n${honeyLines.join('\n')}`);

  const endTxt = endUnix ? toWIBTime(endUnix) : '-';
  parts.push(`\n\n\u{1F552} Berakhir pada: ${endTxt} WIB`);
  return parts.join('');
}


// ====== Adapter WS ? app model ======
function adaptFromWS(payload) {
  const mapList = (arr) => Array.isArray(arr)
    ? arr.map(it => ({
        name: it.display_name || it.item_id || '',
        quantity: Number(it.quantity || 0),
        end: Number(it.end_date_unix || it.end_duration_unix || 0)
      }))
    : [];

  const honeyRaw = Array.isArray(payload?.eventshop_stock)
    ? payload.eventshop_stock
    : Array.isArray(payload?.eventshop_stock?.stock)
      ? payload.eventshop_stock.stock
      : [];

  const nowSec = Math.floor(Date.now() / 1000);
  const weatherArr = Array.isArray(payload?.weather)
    ? payload.weather
    : Array.isArray(payload?.active_weather)
      ? payload.active_weather
      : Array.isArray(payload?.weather?.active)
        ? payload.weather.active
        : [];

  const weatherActive = weatherArr
    .filter(w => {
      const flag  = (w?.active ?? w?.is_active);
      const start = Number(w?.start_duration_unix ?? w?.start_date_unix ?? w?.start_unix ?? 0);
      const end   = Number(w?.end_duration_unix   ?? w?.end_date_unix   ?? w?.end_unix   ?? 0);
      if (flag === true)  return true;
      if (flag === false) return false;
      return (start > 0 && end > 0 && nowSec >= start && nowSec < end); 
    })
    .map(w => ({
      id: normWxId(w.weather_id || w.weather_name || w.id || ''),
      name: w.weather_name || w.weather_id || w.name || '',
      start: Number(w?.start_duration_unix ?? w?.start_date_unix ?? w?.start_unix ?? 0),
      end:   Number(w?.end_duration_unix   ?? w?.end_date_unix   ?? w?.end_unix   ?? 0)
    }));

  const shopName = payload?.eventshop_stock?.name
    || payload?.eventshop_stock?.shop_name
    || 'Event Shop';

  return {
    seeds: mapList(payload?.seed_stock),
    gear:  mapList(payload?.gear_stock),
    honey: mapList(honeyRaw),
    weatherActive,
    shopName
  };
}

// ====== Weather helpers ======
let wxEndDebounceTimer = null;
let wxEndPending = null;
const weatherSig = (list) =>
  JSON.stringify((list || []).map(w => `${w.id}:${w.start}:${w.end}`).sort());

function buildWeatherStartText(started = []) {
  const lines = ['\u{1F7E2} *Cuaca Aktif:*'];
  for (const w of started) {
    const meta = WEATHER_META[w.id] || {};
    const label = meta.label || w.name;
    const emoji = meta.emoji || '\u{26C5}';
    const efek = WEATHER_EFFECTS[w.id] || 'Efek khusus (belum didata).';
    lines.push(`${emoji} ${label} - sampai ${toWIBTime(w.end)} WIB\n${efek}`);
  }
  return lines.join('\n');
}

function buildWeatherEndText(ended = [], activeCountAfter = 0) {
  if (activeCountAfter === 0) {
    return '\u{26C5} Cuaca normal kembali'; // ?
  }
  return ended.map(w => {
    const meta = WEATHER_META[w.id] || {};
    return `${meta.emoji || '\u{26C5}'} ${meta.label || w.name} telah berakhir`;
  }).join('\n');
}

// === per-weather end timers ===
const WX_END_TIMERS = new Map();

function clearWxTimer(id) {
  const t = WX_END_TIMERS.get(id);
  if (t) clearTimeout(t);
  WX_END_TIMERS.delete(id);
}

// ====== MERGE/DEBOUNCE NOTIF ======
let mergeTimer = null;
const MERGE_WINDOW_MS = 1500;
let PENDING = {
  seedLines: [],
  gearLines: [],
  honeyLines: [],
  endCandidates: [],
  shopLabel: 'Event Shop'
};

function queueMergedNotification(part) {
  const pushUnique = (arr, lines) => {
    const set = new Set(arr);
    for (const line of lines) if (line && !set.has(line)) { arr.push(line); set.add(line); }
  };
  pushUnique(PENDING.seedLines, part.seedLines || []);
  pushUnique(PENDING.gearLines, part.gearLines || []);
  pushUnique(PENDING.honeyLines, part.honeyLines || []);
  if (Array.isArray(part.endCandidates)) PENDING.endCandidates.push(...part.endCandidates);
  if (part?.shopLabel) PENDING.shopLabel = part.shopLabel;
  if (mergeTimer) clearTimeout(mergeTimer);
  mergeTimer = setTimeout(flushMerged, MERGE_WINDOW_MS);
}

async function flushMerged() {
  mergeTimer = null;
  const hasAny = PENDING.seedLines.length || PENDING.gearLines.length || PENDING.honeyLines.length;
  if (!hasAny) return;

  const batchEndUnix = PENDING.endCandidates.length ? Math.min(...PENDING.endCandidates) : 0;

  const text = buildBatchMessage({
    seedLines: PENDING.seedLines,
    gearLines: PENDING.gearLines,
    honeyLines: PENDING.honeyLines,
    endUnix: batchEndUnix,
    shopLabel: PENDING.shopLabel
  });

  try {
    await sock.sendMessage(groupId, { text, mentions: groupMentions });
  } catch {}

  PENDING = { seedLines: [], gearLines: [], honeyLines: [], endCandidates: [], shopLabel: 'Event Shop' };
}


// ====== Process incoming data ======
async function processNewData(newData) {

// --- Weather realtime ---
const currWx = (newData.weatherActive || []).slice().sort((a,b)=>a.id.localeCompare(b.id));
const currSig = weatherSig(currWx);

if (currSig !== lastWeatherSig) {
  const prev = lastWeatherActive || [];
  const prevIds = new Set(prev.map(w => w.id));
  const currIds = new Set(currWx.map(w => w.id));

  const started = currWx.filter(w => !prevIds.has(w.id));
  const ended   = prev.filter(w => !currIds.has(w.id));

  // 1) Tangani yang mulai (jangan block yang berakhir)
  if (started.length) {
    for (const w of started) clearWxTimer(w.id);
    if (wxEndDebounceTimer) { clearTimeout(wxEndDebounceTimer); wxEndDebounceTimer = null; wxEndPending = null; }
    const text = buildWeatherStartText(started);
    try { await sock.sendMessage(groupId, { text, mentions: groupMentions }); } catch {}
  }

  // 2) Baru setelah itu, tangani yang berakhir
  if (ended.length) {
    for (const w of ended) {
      clearWxTimer(w.id);
      const nowSec = Math.floor(Date.now()/1000);
      const SAFETY_MS = 1500;
      const delayMs = Math.max(0, (Number(w.end||nowSec) - nowSec) * 1000) + SAFETY_MS;

      const timerId = setTimeout(async () => {
        const stillActive = (lastWeatherActive || []).some(x => x.id === w.id);
        if (stillActive) { clearWxTimer(w.id); return; }

        const meta  = WEATHER_META[w.id] || {};
        const label = meta.label || w.name || w.id;

        const active = (lastWeatherActive || []);
        let text = '';
        if (active.length === 0) {
          text = '\u{26C5} Cuaca normal kembali';
        } else {
          const activeLines = ['\u{1F7E2} Cuaca Aktif:'];
          for (const wx of active) {
            const m = WEATHER_META[wx.id] || {};
            const lbl = m.label || wx.name || wx.id;
            const eff = WEATHER_EFFECTS?.[wx.id] || '';
            activeLines.push(`${m.emoji || '\u{26C5}'} ${lbl} - sampai ${toWIBTime(wx.end)} WIB${eff ? `\n${eff}` : ''}`);
          }
          text = `${meta.emoji || '\u{26C5}'} ${label} telah berakhir\n\n${activeLines.join('\n')}`;
        }

        try { await sock.sendMessage(groupId, { text, mentions: groupMentions }); } catch {}
        clearWxTimer(w.id);
      }, delayMs);

      WX_END_TIMERS.set(w.id, timerId);
    }
  }

  lastWeatherActive = currWx;
  lastWeatherSig = currSig;
}

  // Batch Seeds/Gears/Honey
  if (!lastData) { lastData = newData; return; }

  const seedLines = [];
  const gearLines = [];
  const honeyLines = [];
  const endCandidates = [];

  let seedHasHighTrigger = false;
  let gearHasHighTrigger = false;

  const prevSeedsMap = new Map((lastData.seeds || []).map(s => [normalizeName(s.name), s.quantity || 0]));
  for (const s of (newData.seeds || [])) {
    const name = s.name || '';
    const norm = normalizeName(name);
    if (!seedWatchSet.has(norm)) continue;
    const prevQty = prevSeedsMap.get(norm) ?? 0;
    if ((s.quantity || 0) > 0 && s.quantity !== prevQty) {
      const tier = SEED_TIERS[norm] || 'Unknown';
      const emoji = TIER_EMOJIS[tier] || '';
      seedLines.push(`- ${emoji}[${tier}] ${name}: *${s.quantity}*`);
      if (s.end) endCandidates.push(Number(s.end));
      if (RARITY_RANK[tier] >= RARITY_RANK['Divine']) seedHasHighTrigger = true;
    }
  }

  const prevGearsMap = new Map((lastData.gear || []).map(g => [normalizeName(g.name), g.quantity || 0]));
  for (const g of (newData.gear || [])) {
    const name = g.name || '';
    const norm = normalizeName(name);
    if (!gearWatchSet.has(norm)) continue;
    const prevQty = prevGearsMap.get(norm) ?? 0;
    if ((g.quantity || 0) > 0 && g.quantity !== prevQty) {
      const tier = GEAR_TIER_MAP[norm] || 'Unknown';
      const emoji = TIER_EMOJIS[tier] || '';
      gearLines.push(`- ${emoji}[${tier}] ${name}: *${g.quantity}*`);
      if (g.end) endCandidates.push(Number(g.end));
      if (RARITY_RANK[tier] >= RARITY_RANK['Mythical']) gearHasHighTrigger = true;
    }
  }

  const prevHoneyMap = new Map((lastData.honey || []).map(h => [normalizeName(h.name), h.quantity || 0]));
  for (const h of (newData.honey || [])) {
    const name = h.name || '';
    const norm = normalizeName(name);
    const qty = h.quantity || 0;
    const prevQty = prevHoneyMap.get(norm) ?? 0;
    if (qty > 0 && (qty !== prevQty || !prevHoneyMap.has(norm))) {
      honeyLines.push(`- ${name}: *${qty}*`);
      if (h.end) endCandidates.push(Number(h.end));
    }
  }

  const hasAny = seedLines.length || gearLines.length || honeyLines.length;
  if (hasAny) {
    queueMergedNotification({
      seedLines,
      gearLines,
      honeyLines,
      endCandidates,
      shopLabel: newData.shopName || 'Event Shop'
    });
  }
  lastData = newData;
}

// ====== WS game ======
function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => { try { ws?.ping(); } catch { } }, 25_000);
}
function stopHeartbeat() { if (heartbeatTimer) clearInterval(heartbeatTimer); heartbeatTimer = null; }

function connectGameWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    console.log('[WS] already connected/connecting');
    return;
  }
  if (ws) { try { ws.close(1000, 'reinit'); } catch { } }

  ws = new WebSocket(WS_URL);

  ws.on('open', () => { console.log('[WS] connected'); startHeartbeat(); });

  ws.on('message', async (data) => {
    try {
      const payload = JSON.parse(String(data));
      const adapted = adaptFromWS(payload);
      await processNewData(adapted);
    } catch (e) { console.error('[WS] message parse error:', e.message); }
  });

  ws.on('ping', (d) => { try { ws.pong(d); } catch { } });

  ws.on('close', (code, reason) => {
    console.log(`[WS] closed ${code} ${reason || ''}`);
    stopHeartbeat();
    if (code === 4001) {
      console.warn('[WS] key in use elsewhere. Reconnect in 60s.');
      setTimeout(connectGameWS, 60_000);
      return;
    }
    setTimeout(connectGameWS, 5000);
  });

  ws.on('error', (e) => console.error('[WS] error:', e?.message || e));
}

// ====== MAIN ======
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    emitOwnEvents: true,
    browser: ['GAGBot', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (upd) => {
    const { connection, qr, lastDisconnect } = upd;

    if (qr) {
      console.log('Scan QR (WhatsApp > Linked devices > Link a device):');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') {
      console.log(' WA connected.');
      await refreshGroupMentions();
      if (!wsStarted) { wsStarted = true; connectGameWS(); }
    }
    if (connection === 'close') {
      const status = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = status === DisconnectReason.loggedOut;
      console.log('? WA closed', status, loggedOut ? '(logged out)' : '');
      if (loggedOut) console.log('Hapus folder ./auth untuk pair ulang.');
      else setTimeout(start, 3000);
    }
  });

  // Commands manual
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of (messages || [])) {
      const jid = m.key.remoteJid;
      const fromMe = m.key.fromMe;
      const text = (m.message?.conversation || m.message?.extendedTextMessage?.text || '')
        .trim().toLowerCase();
      if (jid !== groupId) continue;

      if (text.startsWith('!stopalert')) {
        const key = normalizeName(text.split(' ')[1] || '');
        if (key && ACTIVE_ALERTS.has(key)) await stopAlert(key, `Alert "${key}" dihentikan manual.`);
        else if (!fromMe) await sock.sendMessage(groupId, { text: 'Tidak ada alert aktif dengan key itu.' });
      } else if (text === '!stopall' && !fromMe) {
        await stopAll('Semua alert dihentikan manual.');
      }
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    try {
      if (update.id !== groupId) return;

      if (update.action === 'add') {
        for (const participant of update.participants) {
          const text = `Selamat datang, demi efisiensi, pada notifikasi hanya ada gear dan seed langka, 
jadi gear dan seed yang sering muncul tidak akan masuk ke list bot kami, terimakasih ??`;
          await sock.sendMessage(groupId, { text, mentions: [participant] });
        }
      }
    } catch (err) {
      console.error('Error welcome message:', err);
    }
  });

}

start().catch(err => console.error('fatal error:', err));
process.on('unhandledRejection', (err) => console.error('UNHANDLED:', err));
process.on('uncaughtException', (err) => console.error('UNCAUGHT:', err));
