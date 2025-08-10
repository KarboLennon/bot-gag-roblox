# 🌱 Grow A Garden WhatsApp Bot

Bot WhatsApp berbasis **Node.js** untuk memantau game **Grow a Garden (Roblox)** dan mengirimkan update otomatis ke grup WhatsApp.

---

## 📖 Deskripsi

Bot ini memantau perubahan data game **Grow a Garden** (seperti cuaca, tanaman, gear, telur, honey, dan event) dari API, lalu mengirimkan notifikasi otomatis ke grup WhatsApp.  
Notifikasi disusun rapi, dengan **label rarity dan emoji** sehingga mudah dibaca.

Bot ini juga dilengkapi perintah `!chris` untuk menampilkan craving Chris P. beserta resepnya.

---

## ✨ Fitur Utama

| Fitur                  | Deskripsi |
|------------------------|-----------|
| 🔔 Notifikasi Otomatis | Mengirim update ke grup setiap ada perubahan data di API |
| 🌦 Weather             | Menampilkan cuaca dan efek yang sedang aktif |
| 🌱 Seeds               | Mengelompokkan tanaman berdasarkan rarity dan menampilkan perubahan |
| 🛠 Gear                | Mengelompokkan gear berdasarkan rarity dan menampilkan perubahan |
| 🥚 Eggs                | Menampilkan jumlah telur |
| 🍯 Honey               | Menampilkan jumlah honey dan efeknya |
| 🎨 Cosmetics           | Menampilkan perubahan jumlah kosmetik |
| 🎉 Events              | Menampilkan event yang aktif |
| 🍕 Craving Chris P.    | Command `!chris` untuk menampilkan craving terbaru beserta resep |

---

## 🧰 Kebutuhan

- Node.js **v18+** (disarankan versi LTS)
- Akun WhatsApp aktif (untuk scan QR pertama kali)
- API Grow a Garden yang sudah berjalan (atur di variabel `API_URL` di kode)
- File konfigurasi JSON:
  - `crop_tiers.json` → mapping nama tanaman ke rarity
  - `gear_tiers.json` → mapping nama gear ke rarity
  - `gag_recipes.json` → daftar resep Chris P.

---

## 📦 Instalasi

```bash
# Clone repository
git clone https://github.com/<username>/<repo>.git
cd <repo>

# Install dependencies
npm install whatsapp-web.js qrcode-terminal axios
