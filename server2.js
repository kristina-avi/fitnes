const express = require('express');
const cors = require('cors');
const PORT = 3000;

const app = express();

app.use(express.json());
app.use(cors());

const members = [
    { id: 1, name: 'Леша', trainer: 'Максим' },
    { id: 2, name: 'Матвей', trainer: 'Илья' },
    { id: 3, name: 'Алена', trainer: 'Мария' },
];
let nextId = 4;

app.get('/members', authMiddleware, (req, res) => {
    return res.status(200).json(members);
});

app.post('/login', login);
app.post('/register', register);
app.get('/users', getUsers);

app.post('/members', (req, res) => {
    const { name, trainer } = req.body;

    if (!name) {
        throw new Error('Не указаны имя');
    }
    const newMember = {
        id: nextId++,
        name: name,
        trainer: trainer, 
    };

    members.push(newMember);
    console.log(`Новый клиент добавлен: ${name}`);

    return res.status(201).json({
        message: 'Клиент успешно зарегистрирован в клубе',
        member: newMember,
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});



















// ---------- Middleware авторизации ----------
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({ message: 'Требуется авторизация' });
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Неверный формат токена' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload; // { userId, email, iat, exp }
        next();
    } catch (err) {
        // Невалидный/просроченный токен
        return res.status(403).json({ message: 'Недействительный токен' });
    }
}

// ---------- Регистрация ----------
app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;

    // Валидация
    if (!email || !password) {
        return res.status(400).json({ message: 'email и password обязательны' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'Пароль должен быть не короче 6 символов' });
    }

    // Проверка на занятость email
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
        return res.status(409).json({ message: 'Email уже зарегистрирован' });
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 10);

    try {
        const info = db
            .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
            .run(email, passwordHash);

        return res.status(201).json({ id: info.lastInsertRowid, email });
    } catch (err) {
        // На случай гонки (два одновременных регистра) — UNIQUE constraint
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ message: 'Email уже зарегистрирован' });
        }
        console.error(err);
        return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
    }
});

// ---------- Логин ----------
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    // Одно сообщение на оба случая: нет пользователя ИЛИ неверный пароль
    if (!user) {
        return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
        return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    // Выдаём JWT на 1 час
    const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    return res.status(200).json({ token });
});