import './style.css';
import { configError } from './supabaseClient.js';
import { getSession, signIn, signOut, onAuthChange, authErrorMessage } from './auth.js';
import { initDayView } from './dayView.js';
import { initMonthView } from './monthView.js';

const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');

let appReady = false;

// ---------- Login ----------

loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (configError) {
    loginError.textContent = configError;
    return;
  }
  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Connexion…';
  try {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    await signIn(email, password);
    // onAuthChange drives the transition to the app.
  } catch (err) {
    loginError.textContent = authErrorMessage(err);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Se connecter';
  }
});

function showLogin() {
  appReady = false;
  appView.style.display = 'none';
  appView.innerHTML = '';
  loginView.style.display = 'flex';
  document.getElementById('login-password').value = '';
}

// ---------- App ----------

async function showApp(session) {
  if (appReady) return;
  appReady = true;

  loginView.style.display = 'none';
  appView.style.display = 'block';

  appView.innerHTML = `
    <div class="appbar">
      <div>
        <h1>Clôture Journalière</h1>
        <div class="sub">Caisse &middot; Ventes &middot; Réconciliation</div>
      </div>
      <div class="appbar-right">
        <nav class="tabs">
          <button class="tab-btn active" data-view="day" type="button">Saisie Journalière</button>
          <button class="tab-btn" data-view="month" type="button">Rapport Mensuel par Catégorie</button>
        </nav>
        <span class="user-chip">${session?.user?.email ?? ''}</span>
        <button class="btn btn-ghost" id="logoutBtn" type="button">Déconnexion</button>
      </div>
    </div>
    <div id="view-day"></div>
    <div id="view-month" style="display:none;"></div>
  `;

  const dayEl = document.getElementById('view-day');
  const monthEl = document.getElementById('view-month');

  initMonthView(monthEl);
  monthEl.style.display = 'none';
  await initDayView(dayEl);

  appView.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      appView.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      dayEl.style.display = view === 'day' ? '' : 'none';
      monthEl.style.display = view === 'month' ? '' : 'none';
    });
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
      await signOut();
    } catch (err) {
      console.error(err);
    }
  });
}

// ---------- Boot ----------

if (configError) {
  // Nothing can work without credentials; say so instead of failing silently.
  showLogin();
  loginError.textContent = configError;
  loginBtn.disabled = true;
} else {
  onAuthChange(session => {
    if (session) showApp(session);
    else showLogin();
  });

  (async () => {
    try {
      const session = await getSession();
      if (session) await showApp(session);
      else showLogin();
    } catch (err) {
      console.error(err);
      showLogin();
      loginError.textContent = authErrorMessage(err);
    }
  })();
}
