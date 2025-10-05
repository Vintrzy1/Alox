// =================================================================
// ============== SERVER BACKEND V2 - DENGAN FITUR BARU =============
// =================================================================

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Perlu untuk memanggil API Telegram
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

console.log("🚀 Server backend Gacha V2 sedang berjalan...");

// --- TOKEN ANDA SUDAH DIMASUKKAN ---
const TELEGRAM_BOT_TOKEN = "8223850482:AAEiTRX9TduTyEmLdiuyeb_tQzlG9-h4S58";
const PAYMENT_PROVIDER_TOKEN = "5775769170:LIVE:TG_2yXEzKfVKXMzP9rA4xDCL5AA";

// --- DATABASE SEMENTARA (IN-MEMORY DATABASE) ---
let users = {
    "12345": { username: "Pengguna_Tes", coins: 500, lives: 1, lastLifeUpdate: Date.now() }
};

// --- KONFIGURASI GAME ---
const gameConfig = {
    items: ['🍒', '🍇', '🍊', '🍌', '💎'],
    prizes: {
        three_of_a_kind: { '🍒🍒🍒': 50, '🍇🍇🍇': 60, '🍊🍊🍊': 80, '🍌🍌🍌': 100, '💎💎💎': 250 },
        two_of_a_kind: 5
    },
    lives_on_buy: 5,
    withdraw_minimum: 300,
    max_lives: 3,
    life_regen_minutes: 30
};

// --- FUNGSI BANTUAN: REGENERASI NYAWA ---
function calculateRegeneratedLives(user) {
    if (user.lives >= gameConfig.max_lives) {
        user.lastLifeUpdate = Date.now();
        return;
    }
    const minutesPassed = (Date.now() - user.lastLifeUpdate) / (1000 * 60);
    const livesToAdd = Math.floor(minutesPassed / gameConfig.life_regen_minutes);
    if (livesToAdd > 0) {
        user.lives = Math.min(gameConfig.max_lives, user.lives + livesToAdd);
        user.lastLifeUpdate = Date.now();
        console.log(`User ${user.username} meregenerasi ${livesToAdd} nyawa. Total sekarang: ${user.lives}`);
    }
}

// ======================= API ENDPOINTS =======================

// ENDPOINT 1: Mendapatkan atau membuat profil pengguna
app.get('/profile/:userId', (req, res) => {
    const { userId } = req.params;
    if (!users[userId]) {
        console.log(`Pengguna baru: ${userId}. Membuat profil...`);
        users[userId] = { username: `user_${userId.substring(0, 5)}`, coins: 50, lives: 3, lastLifeUpdate: Date.now() };
    }
    calculateRegeneratedLives(users[userId]);
    console.log(`Mengambil data untuk pengguna: ${userId}`);
    res.json(users[userId]);
});

// ENDPOINT 2: Melakukan Spin
app.post('/spin', (req, res) => {
    const { userId } = req.body;
    const user = users[userId];
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    calculateRegeneratedLives(user);
    if (user.lives < 1) return res.status(400).json({ error: "Nyawa tidak cukup." });
    user.lives--;
    if (user.lives < gameConfig.max_lives) { user.lastLifeUpdate = Date.now(); }
    const result = [ gameConfig.items[Math.floor(Math.random() * gameConfig.items.length)], gameConfig.items[Math.floor(Math.random() * gameConfig.items.length)], gameConfig.items[Math.floor(Math.random() * gameConfig.items.length)] ];
    const [r1, r2, r3] = result; const resultString = result.join(''); let prize = 0;
    if (r1 === r2 && r2 === r3) { prize = gameConfig.prizes.three_of_a_kind[resultString] || 0; } 
    else if (r1 === r2 || r2 === r3 || r1 === r3) { prize = gameConfig.prizes.two_of_a_kind; }
    if (prize > 0) { user.coins += prize; }
    console.log(`Pengguna ${userId} spin. Hasil: ${resultString}, Hadiah: ${prize}. Sisa nyawa: ${user.lives}, Koin: ${user.coins}`);
    res.json({ message: prize > 0 ? `Anda menang ${prize} koin!` : "Coba lagi!", spinResult: result, updatedProfile: user });
});

// ENDPOINT 3: MEMBUAT INVOICE PEMBELIAN NYAWA
app.post('/create-invoice', async (req, res) => {
    const { userId } = req.body;
    if (!users[userId]) return res.status(404).json({ error: "Pengguna tidak ditemukan." });

    const invoiceDetails = {
        title: `Pembelian ${gameConfig.lives_on_buy} Nyawa`,
        description: `Dapatkan ${gameConfig.lives_on_buy} nyawa untuk melanjutkan permainan Gacha!`,
        payload: `BUY_LIVES_${userId}_${Date.now()}`,
        provider_token: PAYMENT_PROVIDER_TOKEN,
        currency: 'IDR',
        prices: [{ label: `${gameConfig.lives_on_buy} Nyawa`, amount: 15000 * 100 }] // Harga dalam unit terkecil (Rp 15.000)
    };
    try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createInvoiceLink`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invoiceDetails) });
        const data = await response.json();
        if (!data.ok) throw new Error(data.description);
        console.log(`Invoice link dibuat untuk user ${userId}: ${data.result}`);
        res.json({ invoiceUrl: data.result });
    } catch (error) {
        console.error("Gagal membuat invoice link:", error);
        res.status(500).json({ error: "Gagal membuat invoice di sisi server." });
    }
});

// ENDPOINT 4: WEBHOOK UNTUK MENANGANI PEMBAYARAN SUKSES
app.post('/webhook/payment', (req, res) => {
    const { pre_checkout_query, successful_payment } = req.body;
    if (pre_checkout_query) {
        console.log(`Menerima pre_checkout_query dari ${pre_checkout_query.from.id}`);
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pre_checkout_query_id: pre_checkout_query.id, ok: true }) });
        return res.sendStatus(200);
    }
    if (successful_payment) {
        console.log('Pembayaran sukses diterima:', successful_payment);
        const payload = successful_payment.invoice_payload;
        const userId = payload.split('_')[2];
        if (users[userId]) {
            users[userId].lives += gameConfig.lives_on_buy;
            console.log(`SUKSES: ${gameConfig.lives_on_buy} nyawa ditambahkan ke user ${userId}. Total nyawa: ${users[userId].lives}`);
        }
        return res.sendStatus(200);
    }
    res.sendStatus(400);
});

// ENDPOINT 5: Menarik Koin
app.post('/withdraw', (req, res) => {
    const { userId, amount } = req.body;
    const user = users[userId];
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: "Jumlah tidak valid." });
    if (amount < gameConfig.withdraw_minimum) return res.status(400).json({ error: `Penarikan minimal adalah ${gameConfig.withdraw_minimum} koin.` });
    if (amount > user.coins) return res.status(400).json({ error: "Saldo koin tidak mencukupi." });
    user.coins -= amount;
    console.log(`===================================================`);
    console.log(`|| PERMINTAAN PENARIKAN DANA MASUK (PENDING)     ||`);
    console.log(`|| Pengguna: ${user.username} (ID: ${userId})   ||`);
    console.log(`|| Jumlah: ${amount} koin                        ||`);
    console.log(`|| Status: Menunggu pembayaran manual/API call.    ||`);
    console.log(`===================================================`);
    res.json({ message: `Permintaan penarikan ${amount} koin telah dicatat dan akan segera diproses!`, updatedProfile: user });
});

// Jalankan server
app.listen(port, () => {
    console.log(`✅ Backend Gacha V2 aktif dan berjalan di http://localhost:${port}`);
});        users[userId] = {
            username: `user_${userId.substring(0, 5)}`,
            coins: 50, // Koin awal untuk pengguna baru
            lives: 3   // Nyawa awal
        };
    }
    
    console.log(`Mengambil data untuk pengguna: ${userId}`);
    res.json(users[userId]);
});

// ENDPOINT 2: Melakukan Spin
// URL: POST http://localhost:3000/spin
app.post('/spin', (req, res) => {
    const { userId } = req.body;
    const user = users[userId];

    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    if (user.lives < 1) return res.status(400).json({ error: "Nyawa tidak cukup." });

    user.lives--;

    // Logika Gacha di sisi server
    const result = [
        gameConfig.items[Math.floor(Math.random() * gameConfig.items.length)],
        gameConfig.items[Math.floor(Math.random() * gameConfig.items.length)],
        gameConfig.items[Math.floor(Math.random() * gameConfig.items.length)]
    ];
    
    const [r1, r2, r3] = result;
    const resultString = result.join('');
    let prize = 0;

    if (r1 === r2 && r2 === r3) {
        prize = gameConfig.prizes.three_of_a_kind[resultString] || 0;
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
        prize = gameConfig.prizes.two_of_a_kind;
    }

    if (prize > 0) {
        user.coins += prize;
    }

    console.log(`Pengguna ${userId} melakukan spin. Hasil: ${resultString}, Hadiah: ${prize}. Sisa nyawa: ${user.lives}, Total koin: ${user.coins}`);
    res.json({
        message: prize > 0 ? `Anda menang ${prize} koin!` : "Coba lagi!",
        spinResult: result,
        updatedProfile: user
    });
});

// ENDPOINT 3: Membeli Nyawa
// URL: POST http://localhost:3000/buy-lives
app.post('/buy-lives', (req, res) => {
    const { userId } = req.body;
    const user = users[userId];
    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan." });

    // Di aplikasi nyata, di sini akan ada validasi pembayaran dari Telegram
    user.lives += gameConfig.lives_on_buy;
    
    console.log(`Pengguna ${userId} membeli nyawa. Total nyawa sekarang: ${user.lives}`);
    res.json({
        message: `${gameConfig.lives_on_buy} nyawa berhasil ditambahkan!`,
        updatedProfile: user
    });
});

// ENDPOINT 4: Menarik Koin
// URL: POST http://localhost:3000/withdraw
app.post('/withdraw', (req, res) => {
    const { userId, amount } = req.body;
    const user = users[userId];

    if (!user) return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    if (typeof amount !== 'number' || amount <= 0) return res.status(400).json({ error: "Jumlah tidak valid." });
    if (amount < gameConfig.withdraw_minimum) return res.status(400).json({ error: `Penarikan minimal adalah ${gameConfig.withdraw_minimum} koin.` });
    if (amount > user.coins) return res.status(400).json({ error: "Saldo koin tidak mencukupi." });

    // Logika penarikan di sisi server
    user.coins -= amount;

    // Di aplikasi nyata, di sini Anda akan memanggil API pembayaran untuk mengirim uang ke pengguna
    console.log(`PENTING: Pengguna ${userId} menarik ${amount} koin. Proses pembayaran ke pengguna harus dilakukan di sini!`);

    res.json({
        message: `Permintaan penarikan ${amount} koin berhasil diproses! Saldo akan segera dikirim.`,
        updatedProfile: user
    });
});

// Jalankan server
app.listen(port, () => {
    console.log(`✅ Backend Gacha aktif dan berjalan di http://localhost:${port}`);

});
