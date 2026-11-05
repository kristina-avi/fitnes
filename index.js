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

function checkAuth() {
    const token = localStorage.getItem('token');
    logoutBtn.style.display = token ? 'inline-block' : 'none';
    if (!token) output.style.display = 'none';
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regError.textContent = '';

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('regEmail').value.trim(),
                password: document.getElementById('regPassword').value.trim(),
            }),
        });
        const data = await res.json();

        if (res.status === 201) {
            alert('Успех');
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

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('loginEmail').value.trim(),
                password: document.getElementById('loginPassword').value.trim(),
            }),
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
            alert(`Клиент «${data.member.name}» добавлен`);
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