// GAG Watch-Only Alerts (Seeds, Gears, Honey Shop)
// - Fokus hanya pada daftar bibit & gear tertentu + Honey Shop
// - Reminder tiap 10 detik sampai dibaca / ada pesan masuk / max 30x
// - Mentions pakai array of IDs (format baru whatsapp-web.js)

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// ====== CONFIG ======
const groupId = '120363400948750978@g.us';
const API_URL = 'https://gagapi.onrender.com/alldata';

// EDIT daftar yang mau dipantau
const WATCH_SEEDS = [
  'Burning Bud',
  'Giant Pinecone',
  'Elder Strawberry',
  'Sugar Apple',
  'Ember Lily',
  'Beanstalk',
  'Cacao',
  'Pepper',
  'Pumpkin',
  'Pumpkin',
  'Mushroom',
  'Grape',
  'Pumpkin',
  'Mango'
];

const WATCH_GEARS = [
  'Basic Sprinkler',
  'Advanced Sprinkler',
  'Godly Sprinkler',
  'Master Sprinkler',
  'Grandmaster Sprinkler'
];

// Interval cek API & reminder
const POLL_MS = 20_000;            // cek data tiap 20 detik
const REMIND_INTERVAL_MS = 10_000; // reminder tiap 10 detik
const MAX_REMIND_TIMES = 30;     // max ~5 menit

// ====== STATE ======
const client = new Client({ authStrategy: new LocalAuth() });

let lastData = null;

/**
 * ACTIVE_ALERTS:
 * key -> {
 *   tries, chatId, startedAt, anchorId, timeoutId
 * }
 */
const ACTIVE_ALERTS = new Map();

// ====== HELPERS ======
const normalizeName = (s) =>
  String(s || '').toLowerCase().trim().replace(/favourite/g, 'favorite').replace(/\s+/g, ' ');

const seedWatchSet = new Set(WATCH_SEEDS.map(normalizeName));
const gearWatchSet = new Set(WATCH_GEARS.map(normalizeName));

function nowWIB() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

async function getGroupMentionIds(chatId) {
  const chat = await client.getChatById(chatId);
  return chat.participants.map(p => p.id._serialized); // ['62xxxx@c.us', ...]
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
  if (ACTIVE_ALERTS.has(uniqueKey)) return; // sudah aktif

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

// ====== CORE CHECK ======
async function checkData() {
  try {
    const { data: newData } = await axios.get(API_URL);

    // Seed & Gear compare butuh lastData
    if (!lastData) {
      lastData = newData;
      return;
    }

    // === Seeds watch ===
    if (Array.isArray(newData.seeds)) {
      for (const s of newData.seeds) {
        const name = s.name || '';
        const normalized = normalizeName(name);
        if (!seedWatchSet.has(normalized)) continue;

        const prevQty = lastData.seeds?.find(x => normalizeName(x.name) === normalized)?.quantity ?? 0;

        // Trigger kalau stok > 0 dan beda dari sebelumnya
        if (s.quantity > 0 && s.quantity !== prevQty) {
          const key = `seed:${normalized}`;
          const text =
            `🌱 *TARGET SEED MUNCUL: ${name}*\n` +
            `• Stok: *${s.quantity}*\n` +
            `• Waktu: ${nowWIB()} WIB\n` +
            `• Notif berhenti otomatis saat dibaca / ada pesan masuk.`;
          await alertUntilSomeoneReads(groupId, text, key);
        }
      }
    }

    // === Gears watch ===
    if (Array.isArray(newData.gear)) {
      for (const g of newData.gear) {
        const name = g.name || '';
        const normalized = normalizeName(name);
        if (!gearWatchSet.has(normalized)) continue;

        const prevQty = lastData.gear?.find(x => normalizeName(x.name) === normalized)?.quantity ?? 0;

        if (g.quantity > 0 && g.quantity !== prevQty) {
          const key = `gear:${normalized}`;
          const text =
            `🛠 *TARGET GEAR MUNCUL: ${name}*\n` +
            `• Stok: *${g.quantity}*\n` +
            `• Waktu: ${nowWIB()} WIB\n` +
            `• Notif berhenti otomatis saat dibaca / ada pesan masuk.`;
          await alertUntilSomeoneReads(groupId, text, key);
        }
      }
    }

    // === Honey Shop (toko event) ===
    // Trigger saat total stok honey berubah dari 0 -> >0, atau ada item honey baru muncul.
    if (Array.isArray(newData.honey)) {
      const totalNew = newData.honey.reduce((a, h) => a + (h.quantity || 0), 0);
      const totalOld = Array.isArray(lastData.honey)
        ? lastData.honey.reduce((a, h) => a + (h.quantity || 0), 0)
        : 0;

      const newNames = new Set(newData.honey.map(h => normalizeName(h.name)));
      const oldNames = new Set((lastData.honey || []).map(h => normalizeName(h.name)));
      const hasNewItem = [...newNames].some(n => !oldNames.has(n));

      if ((totalNew > 0 && totalOld === 0) || hasNewItem) {
        const key = 'honey:shop';
        const list = newData.honey
          .filter(h => (h.quantity || 0) > 0)
          .map(h => `- ${h.name}: ${h.quantity}`)
          .join('\n');

        const text =
          `🍯 *HONEY SHOP MUNCUL!*\n` +
          (list ? `${list}\n` : '') +
          `• Waktu: ${nowWIB()} WIB\n` +
          `• Notif berhenti otomatis saat dibaca / ada pesan masuk.`;
        await alertUntilSomeoneReads(groupId, text, key);
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

  // Command stop: !stopalert <key>
  if (lower.startsWith('!stopalert')) {
    const key = normalizeName(m.body.split(' ')[1] || '');
    if (key && ACTIVE_ALERTS.has(key)) {
      await stopAlert(key, `Alert "${key}" dihentikan manual.`);
    } else {
      await m.reply('Tidak ada alert aktif dengan key itu.');
    }
    return;
  }

  // Command stop all
  if (lower === '!stopall') {
    await stopAll('Semua alert dihentikan manual.');
    return;
  }

  // === STOP SEMUA kalau ada pesan masuk di grup (apa pun, bukan dari bot) ===
  if (m.from === groupId && !m.fromMe && ACTIVE_ALERTS.size) {
    await stopAll('Notif stop: ada pesan masuk di grup.');
  }
});


client.initialize();
