// Өгөгдлийн давхарга. Firebase тохируулаагүй бол DEMO горимд (санах ойд) ажиллана.
import { firebaseConfig } from './firebase-config.js';
import { defaultConfig, todayStr, addDays, calcDay, fmt } from './core.js';

export const isDemo = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('PASTE');
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';

export const state = {
  ready: false, online: true, error: null,
  config: defaultConfig(), configExists: false,
  workers: [], days: [], offDays: [], debts: [], requests: [], audit: [],
  lastAtt: {}, user: null, authReady: false
};
const listeners = new Set();
export const onChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach(f => { try { f(state); } catch (e) { console.error(e); } });

export const dayId = (date, speciesId) => `${date}_${speciesId}`;

let api; // { saveConfig, ... } — Firebase эсвэл demo

/* ------------------------------------------------------------------ */
/* FIREBASE                                                            */
/* ------------------------------------------------------------------ */
async function initFirebase() {
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(SDK + 'firebase-app.js'),
    import(SDK + 'firebase-firestore.js'),
    import(SDK + 'firebase-auth.js')
  ]);
  const app = initializeApp(firebaseConfig);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  const { getDocs, collection, doc, onSnapshot, setDoc, addDoc, deleteDoc, writeBatch, serverTimestamp, query, orderBy, limit } = fs;

  const need = new Set(['config', 'workers', 'days', 'offDays', 'debts', 'requests', 'lastAtt']);
  const fromCache = {};
  const done = key => {
    need.delete(key);
    state.online = navigator.onLine && !Object.values(fromCache).some(Boolean);
    if (!need.size) state.ready = true;
    emit();
  };
  const fail = err => { console.error(err); state.error = err; emit(); };

  let started = false;
  function startData() {
    if (started) return; started = true;
    const subCol = (name, key) => onSnapshot(collection(db, name), snap => {
      state[key] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      fromCache[name] = snap.metadata.fromCache;
      done(key);
    }, fail);
    subCol('workers', 'workers'); subCol('days', 'days'); subCol('offDays', 'offDays'); subCol('debts', 'debts'); subCol('editRequests', 'requests');

    onSnapshot(doc(db, 'config', 'main'), snap => {
      state.configExists = snap.exists();
      state.config = { ...defaultConfig(), ...(snap.exists() ? snap.data() : {}) };
      fromCache.config = snap.metadata.fromCache;
      done('config');
    }, fail);
    onSnapshot(doc(db, 'meta', 'lastAttendance'), snap => {
      state.lastAtt = snap.exists() ? snap.data() : {};
      fromCache.lastAtt = snap.metadata.fromCache;
      done('lastAtt');
    }, fail);
  }

  window.addEventListener('online', () => { state.online = true; emit(); });
  window.addEventListener('offline', () => { state.online = false; emit(); });

  au.onAuthStateChanged(auth, u => { state.user = u ? { email: u.email } : null; state.authReady = true; if (u) startData(); emit(); });

  const ts = () => serverTimestamp();
  api = {
    saveConfig: cfg => setDoc(doc(db, 'config', 'main'), cfg),
    addWorker: w => addDoc(collection(db, 'workers'), { ...w, createdAt: ts() }),
    updateWorker: (id, patch) => setDoc(doc(db, 'workers', id), patch, { merge: true }),
    deleteWorker: id => deleteDoc(doc(db, 'workers', id)),
    saveDay: rec => setDoc(doc(db, 'days', dayId(rec.date, rec.speciesId)), { ...rec, updatedAt: ts() }),
    deleteDay: id => deleteDoc(doc(db, 'days', id)),
    setOffDay: (date, on) => on ? setDoc(doc(db, 'offDays', date), { date }) : deleteDoc(doc(db, 'offDays', date)),
    addDebt: d => addDoc(collection(db, 'debts'), { ...d, paid: false, createdAt: ts() }),
    updateDebt: (id, patch) => setDoc(doc(db, 'debts', id), patch, { merge: true }),
    deleteDebt: id => deleteDoc(doc(db, 'debts', id)),
    checkAdmin: async () => { try { await getDocs(query(collection(db, 'audit'), limit(1))); return true; } catch (e) { return e.code === 'permission-denied' ? false : true; } },
    audit: d => addDoc(collection(db, 'audit'), { ...d, at: ts() }),
    watchAudit: () => onSnapshot(query(collection(db, 'audit'), orderBy('at', 'desc'), limit(300)),
      snap => { state.audit = snap.docs.map(d => ({ id: d.id, ...d.data() })); emit(); }, e => console.error(e)),
    requestEdit: (id, r) => setDoc(doc(db, 'editRequests', id), { ...r, status: 'pending', createdAt: ts() }),
    decideEdit: (id, status) => setDoc(doc(db, 'editRequests', id), { status, decidedAt: ts() }, { merge: true }),
    useEdit: id => setDoc(doc(db, 'editRequests', id), { status: 'used' }, { merge: true }),
    saveLastAtt: (speciesId, data) => setDoc(doc(db, 'meta', 'lastAttendance'), { [speciesId]: data }, { merge: true }),
    async renamePosition(oldName, newName, cfg) {
      const b = writeBatch(db);
      b.set(doc(db, 'config', 'main'), cfg);
      state.workers.filter(w => w.pos === oldName).forEach(w => b.set(doc(db, 'workers', w.id), { pos: newName }, { merge: true }));
      await b.commit();
    },
    signIn: (email, pw) => au.signInWithEmailAndPassword(auth, email, pw),
    signOut: () => au.signOut(auth)
  };
}

/* ------------------------------------------------------------------ */
/* DEMO (санах ой)                                                     */
/* ------------------------------------------------------------------ */
function initDemo() {
  let n = 1;
  const uid = p => `${p}${n++}`;
  const cfg = defaultConfig();
  state.config = cfg; state.configExists = true;
  state.user = null; state.authReady = true;

  const team = (sp, list) => list.forEach(([name, pos]) =>
    state.workers.push({ id: uid('w'), name, pos, team: sp, phone: '99' + String(10000000 + n * 137).slice(0, 6), bank: 'MN' + String(1000 + n * 77), active: true }));
  team('aduu', [['Батжаргал', 'Бой'], ['Отгонбаяр', 'Бой'], ['Мөнхжин', 'Бой'], ['Эрдэнэбат', 'Бой'], ['Сарнай', 'Гэдэс'], ['Дулмаа', 'Гэдэс'],
    ['Ганзориг', 'Хөргүүр'], ['Тэмүүлэн', 'Мах'], ['Билгүүн', 'Яс'], ['Наранцэцэг', 'Тогооч'], ['Болормаа', 'Үйлчлэгч'], ['Цэрэнпил', 'Умс'], ['Сүхбаатар', 'Бүртгэл']]);
  team('yamaa', [['Гантулга', 'Бой'], ['Амарсанаа', 'Бой'], ['Номин', 'Гэдэс'], ['Золбоо', 'Хөргүүр'], ['Пүрэвдорж', 'Мах'], ['Оюунаа', 'Тогооч']]);
  team('khoni', [['Баттулга', 'Бой'], ['Дэлгэрмаа', 'Гэдэс']]);
  state.workers.find(w => w.name === 'Наранцэцэг').fixedSalary = 120000;

  const today = todayStr();
  const mkDay = (date, sp, head) => {
    const members = state.workers.filter(w => w.team === sp && w.active)
      .map(w => ({ wid: w.id, name: w.name, basePos: w.pos, dayPos: w.pos, fixedSalary: w.fixedSalary }));
    const rows = calcDay({ head, members, rates: cfg.rates[sp] });
    const spName = cfg.species.find(s => s.id === sp).name;
    state.days.push({ id: dayId(date, sp), date, speciesId: sp, speciesName: spName, head, rows });
  };
  [[-5, 'aduu', 52], [-4, 'aduu', 74], [-4, 'yamaa', 310], [-2, 'aduu', 68], [-1, 'aduu', 81], [-1, 'khoni', 420]]
    .forEach(([off, sp, head]) => mkDay(addDays(today, off), sp, head));
  state.offDays.push({ id: addDays(today, -3), date: addDays(today, -3) });
  state.debts.push(
    { id: uid('d'), date: addDays(today, -4), wid: state.workers[1].id, name: state.workers[1].name, type: 'Хувцас', amt: 60000, paid: false },
    { id: uid('d'), date: addDays(today, -2), wid: state.workers[4].id, name: state.workers[4].name, type: 'Дэлгүүр тооцоо', amt: 35000, paid: false });
  state.ready = true;

  const upsert = (arr, item) => { const i = arr.findIndex(x => x.id === item.id); if (i >= 0) arr[i] = { ...arr[i], ...item }; else arr.push(item); };
  const ok = () => { emit(); return Promise.resolve(); };
  api = {
    saveConfig: c => { state.config = { ...c }; state.configExists = true; return ok(); },
    addWorker: w => { state.workers.push({ id: uid('w'), ...w }); return ok(); },
    updateWorker: (id, p) => { upsert(state.workers, { id, ...p }); return ok(); },
    deleteWorker: id => { state.workers = state.workers.filter(w => w.id !== id); return ok(); },
    saveDay: rec => { upsert(state.days, { ...rec, id: dayId(rec.date, rec.speciesId) }); return ok(); },
    deleteDay: id => { state.days = state.days.filter(d => d.id !== id); return ok(); },
    setOffDay: (date, on) => { state.offDays = state.offDays.filter(o => o.date !== date); if (on) state.offDays.push({ id: date, date }); return ok(); },
    addDebt: d => { state.debts.push({ id: uid('d'), paid: false, ...d }); return ok(); },
    updateDebt: (id, p) => { upsert(state.debts, { id, ...p }); return ok(); },
    deleteDebt: id => { state.debts = state.debts.filter(d => d.id !== id); return ok(); },
    audit: d => { state.audit.unshift({ id: uid('a'), at: new Date().toISOString(), ...d }); return ok(); },
    checkAdmin: async () => true,
    watchAudit: () => () => {},
    requestEdit: (id, r) => { upsert(state.requests, { id, ...r, status: 'pending' }); return ok(); },
    decideEdit: (id, status) => { upsert(state.requests, { id, status }); return ok(); },
    useEdit: id => { upsert(state.requests, { id, status: 'used' }); return ok(); },
    saveLastAtt: (sp, data) => { state.lastAtt = { ...state.lastAtt, [sp]: data }; return ok(); },
    renamePosition: (o, nn, c) => { state.config = { ...c }; state.workers.forEach(w => { if (w.pos === o) w.pos = nn; }); return ok(); },
    signIn: async (email, pw) => {
      if (!email || !pw) throw Object.assign(new Error('x'), { code: 'auth/invalid-credential' });
      state.user = { email }; emit();
    },
    signOut: async () => { state.user = null; emit(); }
  };
  emit();
}

export async function init() {
  try {
    if (isDemo) initDemo(); else await initFirebase();
  } catch (e) {
    console.error(e); state.error = e; emit();
  }
}

/* Нийтийн API — UI үүнийг дуудна */
const wname = id => state.workers.find(w => w.id === id)?.name || id;
const LOG = {
  saveConfig: () => 'Тохиргоо өөрчиллөө',
  renamePosition: (o, n) => `Албан тушаал нэр солив: ${o} → ${n}`,
  addWorker: w => `Ажилтан нэмэв: ${w.name} (${w.pos})`,
  updateWorker: (id, p) => `Ажилтны мэдээлэл өөрчиллөө: ${wname(id)} (${Object.keys(p).join(', ')})`,
  deleteWorker: id => `Ажилтан устгав: ${wname(id)}`,
  saveDay: r => `Цалин баталгаажуулав: ${r.date} · ${r.speciesName} · ${r.head} толгой · ${(r.rows || []).length} хүн · ${fmt(r.total || 0)}₮`,
  deleteDay: id => `Өдрийн бүртгэл устгав: ${id.replace('_', ' · ')}`,
  setOffDay: (d, on) => `${d}: ${on ? 'ажиллаагүй өдөр болгов' : 'ажиллаагүй өдрөөс буцаав'}`,
  addDebt: d => `Суутгал нэмэв: ${d.name} · ${d.type} · ${fmt(d.amt)}₮`,
  updateDebt: (id, p) => { const d = state.debts.find(x => x.id === id); return `Суутгал өөрчиллөө: ${d?.name || ''}${p.paid === undefined ? '' : p.paid ? ' — төлсөн' : ' — төлөөгүй болгов'}`; },
  deleteDebt: id => { const d = state.debts.find(x => x.id === id); return `Суутгал устгав: ${d?.name || ''} · ${fmt(d?.amt || 0)}₮`; },
  requestEdit: (id, r) => `Засах/устгах хүсэлт: ${r.label || r.date} — ${r.reason}`,
  decideEdit: (id, st) => `Хүсэлт ${st === 'approved' ? 'зөвшөөрөв' : 'татгалзав / цуцлав'}: ${id.replace('_', ' · ')}`
};
const call = name => async (...a) => {
  const text = LOG[name]?.(...a);
  const r = await api[name](...a);
  if (text) api.audit({ who: state.user?.email || 'нягтлан', action: name, text }).catch(e => console.error(e));
  return r;
};
export const saveConfig = call('saveConfig');
export const addWorker = call('addWorker');
export const updateWorker = call('updateWorker');
export const deleteWorker = call('deleteWorker');
export const saveDay = call('saveDay');
export const deleteDay = call('deleteDay');
export const setOffDay = call('setOffDay');
export const addDebt = call('addDebt');
export const updateDebt = call('updateDebt');
export const deleteDebt = call('deleteDebt');
export const requestEdit = call('requestEdit');
export const decideEdit = call('decideEdit');
export const useEdit = call('useEdit');
export const saveLastAtt = call('saveLastAtt');
export const renamePosition = call('renamePosition');
export const signIn = call('signIn');
export const signOutUser = call('signOut');
export const watchAudit = () => api.watchAudit();
export const checkAdmin = () => api.checkAdmin();
export const poke = () => emit();
