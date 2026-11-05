const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'dev-secret';

app.use(express.json());
app.use(cors());
app.use(express.static('.'));

const users = [];
const members = [
    { id: 1, name: 'Леша', trainer: 'Максим' },
    { id: 2, name: 'Матвей', trainer: 'Илья' },
    { id: 3, name: 'Алена', trainer: 'Мария' },
];
let nextUserId = 1;
let nextMemberId = 4;

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

app.post('/author/register', async (req, res) => {
    try {
        const { email, phone, password } = req.body;
        if (!email || !phone || !password) {
            return res.status(400).json({ error: 'Все поля обязательны' });
        }
        const exists = users.find(u => u.email === email || u.phone === phone);
        if (exists) {
            return res.status(409).json({ error: 'Email или телефон заняты' });
        }
        const hash = await bcrypt.hash(password, 10);
        const user = { id: nextUserId++, email, phone, password: hash };
        users.push(user);
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.status(201).json({
            token,
            user: { id: user.id, email: user.email, phone: user.phone },
        });
    } catch {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/author/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users.find(u => u.email === email);
        if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });
        const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, user: { id: user.id, email: user.email, phone: user.phone } });
    } catch {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/members', authMiddleware, (req, res) => {
    return res.status(200).json(members);
});

app.post('/members', authMiddleware, (req, res) => {
    const { name, trainer } = req.body;
    if (!name) return res.status(400).json({ error: 'Не указано имя' });
    const newMember = { id: nextMemberId++, name, trainer: trainer || null };
    members.push(newMember);
    console.log(`Новый клиент: ${name}`);
    return res.status(201).json({ message: 'Клиент добавлен', member: newMember });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});
