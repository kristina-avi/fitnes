require('dotenv').config();





// ---------- БД ----------
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) return console.error(err.message);

    db.serialize(() => {
        db.run(`CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE,
            password TEXT
        )`);

        db.run(`CREATE TABLE members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            trainer TEXT
        )`);

        const stmt = db.prepare(`INSERT INTO members (name, trainer) VALUES (?, ?)`);
        stmt.run('Леша', 'Максим');
        stmt.run('Матвей', 'Илья');
        stmt.run('Алена', 'Мария');
        stmt.finalize();
    });
});

// ---------- Middleware ----------
function authMiddleware(req, res, next) {
    const header = req.headers['authorization'];
    const token = header && header.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Доступ запрещен' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Невалидный токен' });
        }
        req.user = user;
        next();
    });
}

// ---------- Регистрация ----------
app.post('/auth/register', async (req, res) => {
    let { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }

    email = email.trim().toLowerCase();
    password = password.trim();

    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (email, password) VALUES (?, ?)`,
            [email, hashedPassword],
            function (err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(409).json({ error: 'Email уже занят' });
                    }
                    return res.status(500).json({ error: 'Ошибка базы данных' });
                }
                res.status(201).json({ id: this.lastID, email });
            }
        );
    } catch {
        res.status(500).json({ error: 'Ошибка сервера при хешировании' });
    }
});

// ---------- Логин ----------
app.post('/auth/login', (req, res) => {
    let { email, password } = req.body;

    if (!email || !password) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    email = email.trim().toLowerCase();
    password = password.trim();

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Неверный email или пароль' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.json({ token });
    });
});

// ---------- Список клиентов (защищено) ----------
app.get('/members', authMiddleware, (req, res) => {
    db.all(`SELECT id, name, trainer FROM members`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        res.json(rows);
    });
});

// ---------- Добавление клиента (защищено) ----------
app.post('/members', authMiddleware, (req, res) => {
    const { name, trainer } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Не указано имя' });
    }

    db.run(
        `INSERT INTO members (name, trainer) VALUES (?, ?)`,
        [name, trainer || null],
        function (err) {
            if (err) return res.status(500).json({ error: 'Ошибка базы данных' });

            console.log(`Новый клиент добавлен: ${name}`);
            res.status(201).json({
                message: 'Клиент успешно зарегистрирован в клубе',
                member: { id: this.lastID, name, trainer: trainer || null },
            });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});