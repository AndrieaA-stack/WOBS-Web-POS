// Replace with your exact Render Web Service URL
const RENDER_BACKEND_URL = "https://wobs-web-pos.onrender.com"; 

const isLocalhost = (
  window.location.hostname === "localhost" || 
  window.location.hostname === "127.0.0.1" || 
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.startsWith("10.") ||
  window.location.hostname.startsWith("172.") ||
  window.location.hostname.endsWith(".local") ||
  window.location.protocol === "file:"
);

const API_URL = isLocalhost
  ? `http://${(window.location.hostname && !window.location.hostname.includes('file')) ? window.location.hostname : 'localhost'}:5000/api` 
  : `${RENDER_BACKEND_URL}/api`;

function openAdminAuthModal() {
  const modal = document.getElementById('modal-admin-auth');
  if (modal) modal.classList.remove('hidden');
}

function closeAdminAuthModal() {
  const modal = document.getElementById('modal-admin-auth');
  if (modal) modal.classList.add('hidden');
}

function switchAuthTab(type) {
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');
  const loginForm = document.getElementById('form-admin-login');
  const signupForm = document.getElementById('form-admin-signup');
  const msg = document.getElementById('auth-msg');

  if (msg) msg.textContent = "";

  if (type === 'login') {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  } else {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value.trim();
  const msg = document.getElementById('auth-msg');

  try {
    const res = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      sessionStorage.setItem('wobs_admin_authenticated', 'true');
      sessionStorage.setItem('wobs_admin_username', data.user.username);
      window.location.href = "Admin.html";
    } else {
      msg.className = "scan-msg text-danger";
      msg.textContent = "❌ " + (data.message || "Invalid credentials or account pending approval.");
    }
  } catch (err) {
    msg.className = "scan-msg text-danger";
    msg.textContent = "❌ Server error. Please check your backend database connection.";
  }
}

async function handleAdminSignup(e) {
  e.preventDefault();
  const fn = document.getElementById('signup-fullname').value.trim();
  const u = document.getElementById('signup-username').value.trim();
  const p = document.getElementById('signup-password').value.trim();
  const msg = document.getElementById('auth-msg');

  try {
    const res = await fetch(`${API_URL}/admin/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullname: fn, username: u, password: p })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      msg.className = "scan-msg text-primary";
      msg.textContent = "✅ Request submitted! Please ask an existing Admin to approve your account.";
      document.getElementById('form-admin-signup').reset();
    } else {
      msg.className = "scan-msg text-danger";
      msg.textContent = "❌ " + (data.message || "Failed to register.");
    }
  } catch (err) {
    msg.className = "scan-msg text-danger";
    msg.textContent = "❌ Server error during registration.";
  }
}