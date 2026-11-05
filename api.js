const API_URL = 'http://localhost:3000';

const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const memberForm = document.getElementById('memberForm');
const loadMembersBtn = document.getElementById('loadMembersBtn');
const logoutBtn = document.getElementById('logoutBtn');
const output = document.getElementById('output');

const regError = document.getElementById('regError');
const loginError = document.getElementById('loginError');
const memberError = document.getElementById('memberError');
const membersError = document.getElementById('membersError');

const phoneInput = document.getElementById('registerPhone');
const phoneError = document.getElementById('phoneError');

const PHONE_RU_REGEX = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;

phoneInput.addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let normalized = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
    if (normalized.length > 0 && normalized[0] !== '7') normalized = '7' + normalized;
    
    e.target.value = formatPhoneRU(normalized);
});

function checkAuth() {
    const token = localStorage.getItem('token');
    logoutBtn.style.display = token ? 'inline-block' : 'none';
    if (!token) output.style.display = 'none';
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regError.textContent = '';
    phoneError.textContent = '';

    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const phone = phoneInput.value.trim();

    if (!PHONE_RU_REGEX.test(phone)) {
        phoneError.textContent = 'Введите номер в формате +7 (999) 123-45-67';
        phoneInput.focus();
        return;
    }

    try {
        const res = await fetch(`${API_URL}/author/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, phone, password }),
        });
        const data = await res.json();

        if (res.status === 201) {
            if (data.token) localStorage.setItem('token', data.token);
            checkAuth();
            alert('Успех! Вы зарегистрированы.');
            registerForm.reset();
        } else {
            regError.textContent = data.error || 'Ошибка регистрации';
        }
    } catch {
        regError.textContent = 'Ошибка соединения с сервером';
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    try {
        const res = await fetch(`${API_URL}/author/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();

        if (res.status === 200) {
            localStorage.setItem('token', data.token);
            loginForm.reset();
            checkAuth();
            alert('Вы вошли!');
        } else {
            loginError.textContent = data.error || 'Ошибка авторизации';
        }
    } catch {
        loginError.textContent = 'Ошибка соединения с сервером';
    }
});

memberForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    memberError.textContent = '';

    const token = localStorage.getItem('token');
    if (!token) {
        memberError.textContent = 'Сначала авторизуйтесь';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                name: document.getElementById('name').value.trim(),
                trainer: document.getElementById('trainer').value.trim() || null,
            }),
        });
        const data = await res.json();

        if (res.status === 201) {
            alert(`Клиент «${data.member?.name ?? ''}» добавлен`);
            memberForm.reset();
        } else {
            memberError.textContent = data.error || 'Ошибка';
        }
    } catch {
        memberError.textContent = 'Ошибка соединения с сервером';
    }
});

loadMembersBtn.addEventListener('click', async () => {
    membersError.textContent = '';
    output.style.display = 'none';

    const token = localStorage.getItem('token');
    if (!token) {
        membersError.textContent = 'Доступ запрещён. Сначала авторизуйтесь';
        return;
    }

    try {
        const res = await fetch(`${API_URL}/members`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await res.json();

        if (res.status === 200) {
            output.textContent = JSON.stringify(data, null, 2);
            output.style.display = 'block';
        } else {
            membersError.textContent = data.error || 'Ошибка загрузки';
        }
    } catch {
        membersError.textContent = 'Ошибка соединения с сервером';
    }
});

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    checkAuth();
});

checkAuth();

export function extractDigits(value) {
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('8')) digits = '7' + digits.slice(1);
    if (digits.length > 0 && digits[0] !== '7') digits = '7' + digits;
    return digits.slice(0, 11);
}

export function formatPhoneRU(digits) {
    const d = digits.slice(1);
    let out = '+7';
    
    if (d.length > 0) out += ' (' + d.slice(0, 3);
    if (d.length >= 3) out += ')';
    if (d.length > 3) out += ' ' + d.slice(3, 6);
    if (d.length > 6) out += '-' + d.slice(6, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    
    return out;
}