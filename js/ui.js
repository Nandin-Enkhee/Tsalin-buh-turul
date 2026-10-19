// Нийтлэг UI туслахууд: аюулгүй HTML, дүрс, toast, modal, сэдэв, shell, сарын туузан
import { state, isDemo } from './store.js';
import { checkPin, dayStatus, monthRange, pad } from './core.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ICONS = {
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  wallet: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  gauge: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  left: '<path d="M15 18l-6-6 6-6"/>', right: '<path d="M9 18l6-6-6-6"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  swap: '<path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>'
};
export const icon = name => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------- Toast ---------- */
export function toast(msg, kind = '') {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg; t.setAttribute('role', 'status');
  box.appendChild(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 5000 : 2800);
}

/* ---------- Modal ---------- */
export function modal({ title, body = '', actions = [{ label: 'Хаах', value: null, kind: 'secondary' }], onOpen }) {
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <h3>${esc(title)}</h3><div class="body">${body}</div>
      <div class="foot">${actions.map((a, i) => `<button class="btn btn-${a.kind || 'secondary'}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
    const close = v => { document.removeEventListener('keydown', onKey); back.remove(); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    back.addEventListener('mousedown', e => { if (e.target === back) close(null); });
    back.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      const a = actions[+b.dataset.i];
      const v = typeof a.value === 'function' ? a.value(back) : a.value;
      if (v === undefined) return;       // функц undefined буцаавал нээлттэй үлдэнэ (шалгалт амжилтгүй)
      close(v);
    });
    document.body.appendChild(back);
    const first = back.querySelector('input,select,button.btn-primary'); first?.focus();
    onOpen?.(back, close);
  });
}

export async function confirmBox(title, message, okLabel = 'Тийм', danger = false) {
  const r = await modal({
    title, body: `<p>${message}</p>`,
    actions: [{ label: 'Болих', value: false }, { label: okLabel, value: true, kind: danger ? 'danger' : 'primary' }]
  });
  return r === true;
}

/** Устгах / дарж бичих үед PIN асууна. Soft guard — жинхэнэ хамгаалалт биш. */
export async function askPin(message = 'Үйлдлийг баталгаажуулахын тулд PIN код оруулна уу.') {
  let ok = false;
  await modal({
    title: 'PIN шаардлагатай',
    body: `<p class="muted">${esc(message)}</p><div class="mt-s"><input class="inp big right" id="pinIn" type="password" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="••••"></div><div class="hint" id="pinErr" style="color:var(--bad);min-height:18px"></div>`,
    actions: [{ label: 'Болих', value: false }, {
      label: 'Батлах', kind: 'primary',
      value: async back => {
        const v = back.querySelector('#pinIn').value;
        if (await checkPin(v, state.config)) { ok = true; return true; }
        back.querySelector('#pinErr').textContent = 'PIN буруу байна';
        back.querySelector('#pinIn').select();
        return undefined;
      }
    }],
    onOpen: (back, close) => {
      back.querySelector('#pinIn').addEventListener('keydown', e => { if (e.key === 'Enter') back.querySelector('.btn-primary').click(); });
    }
  });
  return ok;
}

/* ---------- Сэдэв ---------- */
const THEME_KEY = 'tsalin-theme';
export function initTheme() {
  let t = null;
  try { t = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
}
export function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ }
  return t;
}
const themeBtnHtml = () => document.documentElement.dataset.theme === 'dark'
  ? `${icon('sun')}<span>Цагаан горим</span>` : `${icon('moon')}<span>Харанхуй горим</span>`;

/* ---------- Shell ---------- */
export function mountShell({ root, role, roleLabel, items, onNav, extraFoot = '' }) {
  root.innerHTML = `
  <div class="app">
    <aside class="side">
      <div class="brand"><div class="logo">ЦС</div><div><b>Цалингийн систем</b><small data-company></small><span class="role-tag">${esc(roleLabel)}</span></div></div>
      <nav class="nav" aria-label="Цэс">${items.map(i => `<button data-nav="${i.id}">${icon(i.icon)}<span>${esc(i.label)}</span><em class="badge hidden" data-badge="${i.id}"></em></button>`).join('')}</nav>
      <div class="side-foot">
        <div class="conn"><span class="dot" data-dot></span><span data-conn>Холбогдож байна…</span></div>
        <button class="btn btn-ghost btn-sm" data-theme-btn style="justify-content:flex-start"></button>
        ${extraFoot}
      </div>
    </aside>
    <div class="content">
      <header class="topbar"><div class="logo">ЦС</div><div class="grow"><b>Цалингийн систем</b><small data-company></small></div>
        <span class="dot" data-dot></span><button class="btn btn-ghost btn-sm" data-theme-btn aria-label="Сэдэв солих"></button></header>
      <div class="banners" id="banners"></div>
      <main id="main" tabindex="-1"></main>
    </div>
  </div>
  <nav class="tabbar" aria-label="Цэс">${items.map(i => `<button data-nav="${i.id}">${icon(i.icon)}<span>${esc(i.short || i.label)}</span><em class="badge hidden" data-badge="${i.id}"></em></button>`).join('')}</nav>
  <div id="toasts" aria-live="polite"></div>`;

  const refreshThemeBtns = () => $$('[data-theme-btn]', root).forEach(b => { b.innerHTML = b.closest('.topbar') ? (document.documentElement.dataset.theme === 'dark' ? icon('sun') : icon('moon')) : themeBtnHtml(); });
  refreshThemeBtns();
  root.addEventListener('click', e => {
    const n = e.target.closest('[data-nav]'); if (n) { onNav(n.dataset.nav); return; }
    if (e.target.closest('[data-theme-btn]')) { toggleTheme(); refreshThemeBtns(); }
  });

  return {
    main: $('#main', root),
    setActive(id) { $$('[data-nav]', root).forEach(b => b.classList.toggle('on', b.dataset.nav === id)); },
    setBadge(id, n) { $$(`[data-badge="${id}"]`, root).forEach(b => { b.textContent = n; b.classList.toggle('hidden', !n); }); },
    setBanners(html) { $('#banners', root).innerHTML = html; },
    updateStatus() {
      const bad = !isDemo && !state.online;
      $$('[data-company]', root).forEach(e => { e.textContent = state.config.companyName; });
      $$('[data-dot]', root).forEach(d => { d.className = 'dot' + (isDemo ? ' demo' : bad ? ' off' : ''); });
      $$('[data-conn]', root).forEach(c => { c.textContent = isDemo ? 'DEMO горим' : !state.ready ? 'Холбогдож байна…' : bad ? 'Холболт тасарсан' : 'Холбогдсон'; });
    }
  };
}

export function banner(kind, ic, html) {
  return `<div class="banner ${kind}" role="${kind === 'bad' ? 'alert' : 'status'}">${icon(ic)}<div>${html}</div></div>`;
}

export function needOnline() {
  if (isDemo || state.online) return true;
  toast('Интернэт холболт тасарсан байна. Холбогдсоны дараа дахин оролдоно уу.', 'bad');
  return false;
}

/* ---------- Сарын туузан ---------- */
const WD = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'];
const STATUS_LABEL = { ok: '✓', pending: 'хүлээж', miss: 'дутуу', off: 'амарсан', future: '', before: '' };
export function monthRibbon({ ym, selected, clickable = true, now = new Date() }) {
  const { days } = monthRange(ym);
  const [y, m] = ym.split('-').map(Number);
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  let h = '<div class="ribbon" role="list">';
  for (let d = 1; d <= days; d++) {
    const date = `${ym}-${pad(d)}`;
    const st = dayStatus(date, state, now);
    const wd = new Date(y, m - 1, d).getDay();
    const cnt = state.days.filter(x => x.date === date).length;
    const label = st === 'ok' && cnt > 1 ? `✓ ${cnt}` : STATUS_LABEL[st];
    const cls = `day ${st} ${date === today ? 'today' : ''} ${date === selected ? 'sel' : ''} ${wd === 0 || wd === 6 ? 'is-wkend' : ''}`;
    const inner = `<span class="wd">${WD[wd]}</span><span class="dn">${d}</span><span class="st">${label}</span>`;
    h += clickable ? `<button class="${cls}" data-date="${date}" role="listitem">${inner}</button>` : `<div class="${cls}" role="listitem">${inner}</div>`;
  }
  return h + '</div>';
}
export const ribbonLegend = () => `<div class="legend"><span><i class="l-ok"></i>Баталгаажсан</span><span><i class="l-pending"></i>Хүлээгдэж буй</span><span><i class="l-miss"></i>Шивэгдээгүй</span><span><i class="l-off"></i>Ажиллаагүй өдөр</span></div>`;
export function scrollRibbonToToday(root) {
  const t = root.querySelector('.day.today') || root.querySelector('.day.sel');
  const rb = root.querySelector('.ribbon');
  if (t && rb) rb.scrollLeft = Math.max(0, t.offsetLeft - rb.clientWidth / 2 + t.clientWidth / 2);
}

/** Шалгалттай alert-ууд (хоёр сайтад ижил) */
export function missingDays(now = new Date()) {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const from = (() => { const d = new Date(now); d.setDate(d.getDate() - 45); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  const out = [];
  for (let c = new Date(from); ; c.setDate(c.getDate() + 1)) {
    const s = `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`;
    if (s > today) break;
    if (dayStatus(s, state, now) === 'miss') out.push(s);
  }
  return out;
}

/* ---------- Нэвтрэх дэлгэц (админ, нягтлан хоёрт нийтлэг) ---------- */
const AUTH_ERR = {
  'auth/invalid-credential': 'Имэйл эсвэл нууц үг буруу байна',
  'auth/wrong-password': 'Имэйл эсвэл нууц үг буруу байна',
  'auth/user-not-found': 'Имэйл эсвэл нууц үг буруу байна',
  'auth/too-many-requests': 'Олон удаа буруу оролдлоо. Түр хүлээгээд дахин оролдоно уу',
  'auth/network-request-failed': 'Интернэт холболтоо шалгана уу'
};
export function loginScreen(root, { title, sub, signIn }) {
  root.innerHTML = `<div class="login-wrap"><form class="login" id="lf" novalidate>
    <div class="logo">ЦС</div><h1>${esc(title)}</h1><p>${esc(sub)}</p>
    <label class="f" for="em">Имэйл</label><input class="inp" id="em" type="email" autocomplete="username" required>
    <label class="f mt-s" for="pw" style="margin-top:12px">Нууц үг</label><input class="inp" id="pw" type="password" autocomplete="current-password" required>
    <button class="btn btn-primary mt" style="width:100%" type="submit">Нэвтрэх</button>
    <div class="err" id="err" role="alert"></div>
    ${isDemo ? '<div class="hint">DEMO горим: дурын имэйл, нууц үгээр нэвтэрнэ.</div>' : ''}</form></div>`;
  document.getElementById('lf').addEventListener('submit', async e => {
    e.preventDefault();
    const em = document.getElementById('em').value.trim(), pw = document.getElementById('pw').value;
    const err = document.getElementById('err');
    if (!em || !pw) { err.textContent = 'Имэйл, нууц үгээ оруулна уу'; return; }
    err.textContent = ''; e.submitter.disabled = true;
    try { await signIn(em, pw); } catch (ex) { err.textContent = AUTH_ERR[ex.code] || `Нэвтэрч чадсангүй (${ex.code || ex.message})`; e.submitter.disabled = false; }
  });
  document.getElementById('em').focus();
}
