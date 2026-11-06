const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;
const SECRET_KEY = 'dev-secret';
const db = new sqlite3.Database('./app.db');

function generateETag(data) {
    return crypto.createHash('md5').update(data).digest('hex');
}

const dbRun = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });

const dbGet = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });

const dbAll = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

async function initDb() {
    db.configure('busyTimeout', 5000);

    await dbRun('PRAGMA journal_mode = DELETE');
    await dbRun('PRAGMA foreign_keys = ON');

    await dbRun(`
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT NOT NULL UNIQUE,
            phone      TEXT NOT NULL UNIQUE,
            password   TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await dbRun(`
        CREATE TABLE IF NOT EXISTS members (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            trainer    TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    const { c } = await dbGet('SELECT COUNT(*) AS c FROM members');
    if (c === 0) {
        await dbRun('BEGIN');
        try {
            await dbRun('INSERT INTO members (name, trainer) VALUES (?, ?)', ['Леша', 'Максим']);
            await dbRun('INSERT INTO members (name, trainer) VALUES (?, ?)', ['Матвей', 'Илья']);
            await dbRun('INSERT INTO members (name, trainer) VALUES (?, ?)', ['Алена', 'Мария']);
            await dbRun('COMMIT');
        } catch (e) {
            await dbRun('ROLLBACK');
            throw e;
        }
    }
}

app.use(express.json());
app.use(cors());
app.use(express.static('.'));

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    const token = authHeader.split(' ')[1];
    try {
        req.user = jwt.verify(token, SECRET_KEY);
        next();
    } catch {
        return res.status(401).json({ error: 'Невалидный токен' });
    }
};

app.get('/cached', (req, res) => {

    const etag = generateETag(JSON.stringify(members));
    const lastModified = new Date().toUTCString();

    // res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('ETag', etag);
    res.setHeader('Last-Modified', lastModified);

    if (req.headers['if-none-match'] === etag ||
        req.headers['if-modified-since'] === lastModified) {
        return res.status(304).end();
    }
    return res.send(members);
})

app.post('/author/register', async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        if (!email || !phone || !password) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }

        const exists = await dbGet(
            'SELECT id FROM users WHERE email = ? OR phone = ?',
            [email, phone]
        );
        if (exists) {
            return res.status(409).json({ error: 'Email или телефон заняты' });
        }

        const hash = await bcrypt.hash(password, 10);
        const { lastID } = await dbRun(
            'INSERT INTO users (email, phone, password) VALUES (?, ?, ?)',
            [email, phone, hash]
        );

        const user = { id: lastID, email, phone };
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.status(201).json({ token, user });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: 'Email или телефон заняты' });
        }
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/author/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, email: user.email, phone: user.phone } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/members', authMiddleware, async (req, res) => {
    try {
        const rows = await dbAll('SELECT id, name, trainer FROM members ORDER BY id');
        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/members', authMiddleware, async (req, res) => {
    try {
        const { name, trainer } = req.body;
        if (!name) return res.status(400).json({ error: 'Не указано имя' });

        const { lastID } = await dbRun(
            'INSERT INTO members (name, trainer) VALUES (?, ?)',
            [name, trainer || null]
        );
        const member = await dbGet(
            'SELECT id, name, trainer FROM members WHERE id = ?',
            [lastID]
        );

        console.log(`Новый клиент: ${name}`);
        res.status(201).json({ message: 'Клиент добавлен', member });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
    console.log(`База данных: ./app.db`);
});
