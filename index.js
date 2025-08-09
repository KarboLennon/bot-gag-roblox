const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require('fs');

const client = new Client({
  authStrategy: new LocalAuth()
});

const groupId = '120363400948750978@g.us';
const API_URL = 'https://gagapi.onrender.com/alldata';

const recipes = JSON.parse(fs.readFileSync('./gag_recipes.json', 'utf-8'));
const cropTiers = JSON.parse(fs.readFileSync('./crop_tiers.json', 'utf-8'));
const gearTiersArray = JSON.parse(fs.readFileSync('./gear_tiers.json', 'utf-8'));

let lastData = null;

const tierOrder = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Legendary: 3,
  Mythical: 4,
  Divine: 5,
  Prismatic: 6
};

const tierEmojis = {
  Common: '⚪',
  Uncommon: '🟢',
  Rare: '🔵',
  Legendary: '🟡',
  Mythical: '🟣',
  Divine: '🟠',
  Prismatic: '🌈'
};

// === Watchlist bibit  ===
const watchSeeds = [
  'Burning Bud',
  'Giant Pinecone',
  'Elder Strawberry',
  'Sugar Apple',
  'Ember Lily',
  'Beanstalk',
  'Cacao',
  'Pepper',
  'Pumpkin'
];
const watchSeedSet = new Set(watchSeeds.map(s => normalizeName(s)));

// === Watchlist GEARS: Sprinklers ===
const watchGears = [
  'Basic Sprinkler',
  'Advanced Sprinkler',
  'Godly Sprinkler',
  'Master Sprinkler',
  'Grandmaster Sprinkler'
];
const watchGearSet = new Set(watchGears.map(s => normalizeName(s)));

// === Config reminder (10 detik) ===
const REMIND_INTERVAL_MS = 10 * 1000;
const MAX_REMIND_TIMES = 30;
const ACTIVE_ALERTS = new Map(); 

// --- Helpers ---
function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/favourite/g, 'favorite') //
    .replace(/\s+/g, ' ');
}

const gearTiers = Object.fromEntries(
  gearTiersArray
    .filter(it => it?.name && it?.rarity)
    .map(it => [normalizeName(it.name), it.rarity])
);

function getLocalTime() {
  return new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatRecipe(recipe) {
  let text = `🍽️ *Resep ${recipe.name}*\n`;
  for (const [tier, ingredients] of Object.entries(recipe.tiers)) {
    if (ingredients.length > 0) {
      text += `\n⭐ ${tier}:\n- ${ingredients.join('\n- ')}`;
    }
  }
  return text;
}

// === Mention-all helper ===
async function getGroupMentions(chatId) {
  const chat = await client.getChatById(chatId);
  const mentions = [];
  for (const p of chat.participants) {
    const c = await client.getContactById(p.id._serialized);
    mentions.push(c);
  }
  return mentions;
}

// === Alert loop sampai ada yang read ===
async function alertUntilSomeoneReads(chatId, text, uniqueKey) {
  if (ACTIVE_ALERTS.has(uniqueKey)) return; 
  const mentions = await getGroupMentions(chatId);
  let tries = 0;

  // kirim pertama
  let msg = await client.sendMessage(chatId, text, { mentions });

  async function tick() {
    try {
      const info = await msg.getInfo(); 
      const hasReader = Array.isArray(info.read) && info.read.length > 0;

      if (hasReader) {
        ACTIVE_ALERTS.delete(uniqueKey);
        await client.sendMessage(chatId, '✅ Notif stop: sudah ada yang baca.');
        return;
      }

      tries++;
      if (tries >= MAX_REMIND_TIMES) {
        ACTIVE_ALERTS.delete(uniqueKey);
        await client.sendMessage(chatId, '⏹️ Notif dihentikan: batas reminder tercapai.');
        return;
      }

      msg = await client.sendMessage(
        chatId,
        `🔔 *Reminder ${tries}/${MAX_REMIND_TIMES}*\n${text}`,
        { mentions }
      );
      setTimeout(tick, REMIND_INTERVAL_MS);
    } catch (e) {
      console.error('alertUntilSomeoneReads error:', e.message);
      setTimeout(tick, REMIND_INTERVAL_MS);
    }
  }

  ACTIVE_ALERTS.set(uniqueKey, { tries });
  setTimeout(tick, REMIND_INTERVAL_MS);
}

// stop manual
client.on('message', async (m) => {
  if (m.body.toLowerCase().startsWith('!stopalert')) {
    const key = m.body.split(' ')[1];
    if (key && ACTIVE_ALERTS.has(normalizeName(key))) {
      ACTIVE_ALERTS.delete(normalizeName(key));
      await m.reply(`🔕 Alert "${normalizeName(key)}" ditandai berhenti (loop akan stop di tick berikutnya).`);
    } else {
      await m.reply('Tidak ada alert aktif dengan key itu.');
    }
  }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
  console.log(`[${getLocalTime()}] Ready`);
  checkData();
  setInterval(checkData, 20 * 1000);
});

async function checkData() {
  try {
    const res = await axios.get(API_URL);
    const newData = res.data;

    if (!lastData) {
      lastData = newData;
      return;
    }

    let updateMsg = `🔔 *Update Grow A Garden (${getLocalTime()} WIB):*\n\n`;
    let hasSeedOrGearChanges = false;

    // ==== Weather ====
    updateMsg += `🌦 Weather: ${newData.weather?.type ?? '-'} (active: ${newData.weather?.active ?? '-'})\n`;
    if (Array.isArray(newData.weather?.effects) && newData.weather.effects.length) {
      updateMsg += `✨ Effects:\n- ${newData.weather.effects.join('\n- ')}\n`;
    }
    updateMsg += '\n';

    // ==== Seeds ====
    if (newData.seeds?.length) {
      const grouped = {};

      // NOTE
      newData.seeds.forEach(async s => {
        const old = lastData.seeds.find(x => x.name === s.name);
        const tier = cropTiers[s.name.toLowerCase()] || 'Unknown';
        const emoji = tierEmojis[tier] || '';
        const label = `${emoji} [${tier}]`;

        let line = '';
        if (!old) {
          line = `  └─ 🆕 ${s.name}: ${s.quantity}`;
          hasSeedOrGearChanges = true;
        } else if (old.quantity !== s.quantity) {
          line = `  └─ ${s.name}: ${old.quantity} → ${s.quantity}`;
          hasSeedOrGearChanges = true;
        }

        if (line) {
          if (!grouped[label]) grouped[label] = [];
          grouped[label].push(line);
        }

        // ALERT Seeds
        const normalized = normalizeName(s.name);
        if (watchSeedSet.has(normalized)) {
          const oldQty = lastData.seeds.find(x => normalizeName(x.name) === normalized)?.quantity ?? 0;
          if (s.quantity > 0 && s.quantity !== oldQty) {
            const jam = getLocalTime();
            const alertText =
              `🌱 *BIBIT INCARAN MUNCUL: ${s.name}*\n` +
              `• Stok: *${s.quantity}*\n` +
              `• Waktu: ${jam} WIB\n` +
              `• Notif akan berhenti otomatis begitu pesan dibaca.`;
            const key = `seed:${normalized}`;
            await alertUntilSomeoneReads(groupId, alertText, key);
          }
        }
      });

      const orderedTiers = Object.keys(tierOrder).sort((a, b) => tierOrder[a] - tierOrder[b]);
      let seedSection = '🌱 *Seeds:*\n';
      orderedTiers.forEach(tier => {
        const label = `${tierEmojis[tier]} [${tier}]`;
        if (grouped[label]) seedSection += `${label}\n${grouped[label].join('\n')}\n`;
      });
      if (seedSection.trim() !== '🌱 *Seeds:*') updateMsg += seedSection + '\n';
    }

    // ==== Eggs ====
    if (newData.eggs?.length) {
      let section = `🥚 *Eggs:*\n`;
      newData.eggs.forEach(e => (section += `- ${e.name}: ${e.quantity}\n`));
      updateMsg += section + '\n';
    }

    // ==== Gear ====
    if (newData.gear?.length) {
      const grouped = {};

      newData.gear.forEach(async g => {
        const old = lastData.gear.find(x => x.name === g.name);
        const tier = gearTiers[normalizeName(g.name)] || 'Unknown';
        const emoji = tierEmojis[tier] || '';
        const head = `${emoji} [${tier}]`;

        let line = '';
        if (!old) {
          line = `  └─ 🆕 ${g.name}: ${g.quantity}`;
          hasSeedOrGearChanges = true;
        } else if (old.quantity !== g.quantity) {
          line = `  └─ ${g.name}: ${old.quantity} → ${g.quantity}`;
          hasSeedOrGearChanges = true;
        }
        if (line) {
          if (!grouped[head]) grouped[head] = [];
          grouped[head].push(line);
        }

        // ALERT Gears: sprinklers
        const normalizedG = normalizeName(g.name);
        if (watchGearSet.has(normalizedG)) {
          const oldQty = lastData.gear.find(x => normalizeName(x.name) === normalizedG)?.quantity ?? 0;
          if (g.quantity > 0 && g.quantity !== oldQty) {
            const jam = getLocalTime();
            const alertText =
              `🛠 *GEAR INCARAN MUNCUL: ${g.name}*\n` +
              `• Stok: *${g.quantity}*\n` +
              `• Rarity: ${gearTiers[normalizedG] || 'Unknown'}\n` +
              `• Waktu: ${jam} WIB\n` +
              `• Notif akan berhenti otomatis begitu pesan dibaca.`;
            const key = `gear:${normalizedG}`;
            await alertUntilSomeoneReads(groupId, alertText, key);
          }
        }
      });

      const ordered = Object.keys(tierOrder).sort((a, b) => tierOrder[a] - tierOrder[b]);
      let gearSection = '🛠 Gear:\n';
      ordered.forEach(tier => {
        const head = `${tierEmojis[tier]} [${tier}]`;
        if (grouped[head]) gearSection += `${head}\n${grouped[head].join('\n')}\n`;
      });
      if (gearSection.trim() !== '🛠 Gear:') updateMsg += gearSection + '\n';
    }

    // ==== Honey ====
    if (newData.honey?.length) {
      let section = `🍯 *Honey:*\n`;
      newData.honey.forEach(h => (section += `- ${h.name}: ${h.quantity}\n`));
      updateMsg += section + '\n';
    }

    // ==== Cosmetics ====
    if (newData.cosmetics?.length) {
      const changes = [];
      newData.cosmetics.forEach(c => {
        const old = lastData.cosmetics.find(x => x.name === c.name);
        if (!old) changes.push(`🆕 - ${c.name}: ${c.quantity}`);
        else if (old.quantity !== c.quantity) changes.push(`- ${c.name}: ${old.quantity} → ${c.quantity}`);
      });
      if (changes.length > 0) updateMsg += `🎨 *Cosmetics:*\n${changes.join('\n')}\n\n`;
    }

    // ==== Events ====
    if (newData.events?.length) {
      const changes = [];
      newData.events.forEach(ev => {
        const old = lastData.events.find(x => x.name === ev.name);
        if (!old) changes.push(`🆕 - ${ev.name}: ${ev.quantity}`);
        else if (old.quantity !== ev.quantity) changes.push(`- ${ev.name}: ${old.quantity} → ${ev.quantity}`);
      });
      if (changes.length > 0) updateMsg += `🎉 *Events:*\n${changes.join('\n')}\n\n`;
    }

    // ==== Chris P. craving ====
    const cravingChanged = newData.chrisPCraving?.food !== lastData.chrisPCraving?.food;
    if (cravingChanged && newData.chrisPCraving?.food) {
      updateMsg += `🍕 Chris P. craving: *${newData.chrisPCraving.food}* 😋\n`;
      const recipe = recipes.find(r => r.name.toLowerCase() === newData.chrisPCraving.food.toLowerCase());
      if (recipe) updateMsg += `\n${formatRecipe(recipe)}\n`;
    }

    if (hasSeedOrGearChanges || cravingChanged) {
      await client.sendMessage(groupId, updateMsg);
    }

    lastData = newData;
  } catch (err) {
    console.error(`[${getLocalTime()}] ⚠️ Error ambil data API:`, err.message);
  }
}

// ==== Command handler ====
client.on('message', async msg => {
  if (msg.body.toLowerCase() === '!chris') {
    try {
      const res = await axios.get(API_URL);
      const data = res.data;

      if (!data.chrisPCraving) {
        await msg.reply('Chris P. lagi nggak craving makanan apapun sekarang.');
        return;
      }

      const craving = data.chrisPCraving.food;
      let reply = `🍕 Chris P. lagi pengen: *${craving}* 😋`;
      const recipe = recipes.find(r => r.name.toLowerCase() === craving.toLowerCase());
      if (recipe) reply += '\n\n' + formatRecipe(recipe);

      await msg.reply(reply);
    } catch (err) {
      await msg.reply('Gagal ambil data craving dari API.');
    }
  }
});

client.initialize();
