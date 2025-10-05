// =================================================================
// ============== SERVER BACKEND UNTUK GAME GACHA ==================
// =================================================================

const express = require('express');
const cors = require('cors'); // Untuk menghubungkan frontend dan backend
const app = express();
const port = 3000; // Server akan berjalan di port 3000

// Middleware
app.use(cors());
app.use(express.json());

console.log("🚀 Server backend Gacha sedang berjalan...");

// --- DATABASE SEMENTARA (IN-MEMORY DATABASE) ---
// Di aplikasi nyata, ganti ini dengan database sungguhan seperti MongoDB atau PostgreSQL
let users = {
    "12345": { username: "Pengguna_Tes", coins: 100, lives: 3 }
    // Data pengguna lain akan ditambahkan di sini secara dinamis
};

// --- KONFIGURASI GAME ---
const gameConfig = {
    items: ['🍒', '🍇', '🍊', '🍌', '💎'],
    prizes: {
        three_of_a_kind: { '🍒🍒🍒': 50, '🍇🍇🍇': 60, '🍊🍊🍊': 80, '🍌🍌🍌': 100, '💎💎💎': 250 },
        two_of_a_kind: 5
    },
    lives_on_buy: 5,
    withdraw_minimum: 300
};

// ======================= API ENDPOINTS =======================

// ENDPOINT 1: Mendapatkan atau membuat profil pengguna
// URL: GET http://localhost:3000/profile/12345
app.get('/profile/:userId', (req, res) => {
    const { userId } = req.params;
    
    // Jika pengguna belum ada, buat profil baru untuknya
    if (!users[userId]) {
        console.log(`Pengguna baru terdeteksi: ${userId}. Membuat profil...`);
        users[userId] = {
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