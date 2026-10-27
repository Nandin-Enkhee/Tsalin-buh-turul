// Цэвэр логик: DOM, Firebase-ээс хамааралгүй. Node-д ч тест хийж болно.

export const DEBT_TYPES = ['Хувцас', 'Дэлгүүр тооцоо', 'Урьдчилгаа'];
export const DEFAULT_PIN = '8008';

export const pad = n => String(n).padStart(2, '0');
export const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = (now = new Date()) => toDateStr(now);

export function addDays(str, n) {
  const [y, m, d] = str.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + n));
}
export function dateRange(from, to) {
  const out = [];
  let c = from, guard = 0;
  while (c <= to && guard++ < 400) { out.push(c); c = addDays(c, 1); }
  return out;
}
export function monthOf(str) { return str.slice(0, 7); }
export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${pad(last)}`, days: last };
}
export function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y} оны ${m}-р сар`;
}
export const fmt = n => Number(n || 0).toLocaleString('en-US');
export const shortDate = d => `${+d.slice(5, 7)}.${+d.slice(8)}`;

export function defaultConfig() {
  const positions = ['Бой', 'Гэдэс', 'Хөргүүр', 'Мах', 'Яс', 'Умс', 'Бүртгэл', 'Тогооч', 'Үйлчлэгч', 'Толгой', 'Шөрмөс', 'Галч'];
  const th = (lo, hi, cut) => ({ type: 'threshold', lo, hi, cut });
  const ph = rate => ({ type: 'perHead', rate });
  const fx = rate => ({ type: 'fixed', rate });
  const aduu = {
    Бой: ph(18000), Гэдэс: ph(4000), Хөргүүр: th(100000, 150000, 70), Мах: th(100000, 150000, 70), Яс: th(100000, 150000, 70),
    Умс: th(80000, 100000, 70), Бүртгэл: th(80000, 100000, 70), Тогооч: fx(100000), Үйлчлэгч: fx(100000),
    Толгой: fx(100000), Шөрмөс: fx(100000), Галч: fx(100000)
  };
  const small = (boy, guts) => ({
    Бой: ph(boy), Гэдэс: ph(guts), Хөргүүр: th(100000, 140000, 250), Мах: th(100000, 140000, 250), Яс: th(90000, 120000, 250),
    Умс: th(80000, 100000, 250), Бүртгэл: th(80000, 100000, 250), Тогооч: fx(100000), Үйлчлэгч: fx(80000),
    Толгой: fx(100000), Шөрмөс: fx(100000), Галч: fx(100000)
  });
  return {
    companyName: 'Эмээлт Эрдэнэ Трэйд ХХК',
    species: [{ id: 'aduu', name: 'Адуу' }, { id: 'yamaa', name: 'Ямаа' }, { id: 'khoni', name: 'Хонь' }],
    positions,
    rates: { aduu, yamaa: small(1200, 400), khoni: small(1500, 500) },
    shiftPosition: 'Бой',
    pinHash: null,
    closedMonths: [],
    startDate: null
  };
}

export async function hashPin(pin) {
  const buf = new TextEncoder().encode('tsalin:' + pin);
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function checkPin(pin, cfg) {
  if (!cfg.pinHash) return pin === DEFAULT_PIN;
  return (await hashPin(pin)) === cfg.pinHash;
}

export function ruleText(r) {
  if (!r) return '—';
  if (r.type === 'perHead') return `${fmt(r.rate)}₮ / толгой`;
  if (r.type === 'fixed') return `${fmt(r.rate)}₮ тогтмол`;
  return `<${r.cut}: ${fmt(r.lo)}₮ · ≥${r.cut}: ${fmt(r.hi)}₮`;
}

export function ruleAmount(rule, head, count, fixedOverride) {
  if (!rule) return 0;
  if (rule.type === 'fixed') return fixedOverride > 0 ? fixedOverride : (rule.rate || 0);
  if (rule.type === 'threshold') return head < rule.cut ? rule.lo : rule.hi;
  if (rule.type === 'perHead') return Math.floor((head * rule.rate / Math.max(count, 1)) / 1000) * 1000;
  return 0;
}

/**
 * members: [{wid,name,basePos,dayPos,fixedSalary,borrowed}]
 * rates: {position: rule} (тухайн малын төрлийнх)
 * shifts: [{head, wids:[]}] — зөвхөн shiftPos дээр хамаарна
 */
export function calcDay({ head, members, rates, shifts = [], shiftPos = 'Бой' }) {
  const count = {};
  members.forEach(m => { count[m.dayPos] = (count[m.dayPos] || 0) + 1; });
  const useShifts = shifts.length > 0;
  return members.map(m => {
    const rule = rates[m.dayPos];
    let amt;
    if (head === 0 && !(rule && rule.type === 'fixed')) amt = 0;   // мал ороогүй өдөр зөвхөн тогтмол цалинтай ажил цалинтай
    else if (useShifts && m.dayPos === shiftPos && rule && rule.type === 'perHead') {
      amt = 0;
      shifts.forEach(s => {
        if (s.wids.includes(m.wid)) amt += Math.floor((s.head * rule.rate / Math.max(s.wids.length, 1)) / 1000) * 1000;
      });
    } else {
      amt = ruleAmount(rule, head, count[m.dayPos], m.fixedSalary);
    }
    return { wid: m.wid, name: m.name, basePos: m.basePos, dayPos: m.dayPos, amt, borrowed: !!m.borrowed };
  });
}

/** Өдрийн төлөв: ok | off | pending | miss | future | before */
export function dayStatus(date, { days, offDays, config }, now = new Date()) {
  const today = todayStr(now);
  if (days.some(d => d.date === date)) return 'ok';
  const start = config.startDate || days.reduce((m, d) => (m && m < d.date ? m : d.date), null) || today;
  if (date < start) return 'before';
  if (offDays.some(o => o.date === date)) return 'off';
  if (date > today) return 'future';
  if (date < today) return 'miss';
  return 'pending';
}

export function posIndex(config) {
  const idx = {};
  config.positions.forEach((p, i) => { idx[p] = i; });
  return p => (p in idx ? idx[p] : 999);
}

/**
 * speciesId: 'all' эсвэл тодорхой id. 'all' үед суутгал тооцно.
 */
export function buildSummary({ days, debts, config, from, to, speciesId }) {
  const dates = dateRange(from, to);
  const per = new Map();
  days.filter(d => d.date >= from && d.date <= to && (speciesId === 'all' || d.speciesId === speciesId)).forEach(d => {
    (d.rows || []).forEach(r => {
      let p = per.get(r.wid);
      if (!p) { p = { wid: r.wid, name: r.name, pos: r.basePos, byDay: {}, worked: new Set(), total: 0 }; per.set(r.wid, p); }
      p.byDay[d.date] = (p.byDay[d.date] || 0) + r.amt;
      p.worked.add(d.date);
      p.total += r.amt;
    });
  });
  const pi = posIndex(config);
  const rows = [...per.values()].map(p => {
    const sum = t => speciesId === 'all'
      ? debts.filter(q => q.wid === p.wid && q.type === t && !q.paid && q.date >= from && q.date <= to).reduce((s, q) => s + q.amt, 0)
      : 0;
    const clothes = sum('Хувцас'), store = sum('Дэлгүүр тооцоо'), adv = sum('Урьдчилгаа');
    return { ...p, workedDays: p.worked.size, clothes, store, adv, net: p.total - clothes - store - adv };
  }).sort((a, b) => pi(a.pos) - pi(b.pos) || a.name.localeCompare(b.name, 'mn'));
  const totals = rows.reduce((t, r) => {
    t.total += r.total; t.clothes += r.clothes; t.store += r.store; t.adv += r.adv; t.net += r.net; return t;
  }, { total: 0, clothes: 0, store: 0, adv: 0, net: 0 });
  return { dates, rows, totals };
}

/** Нэг ажилтны цалингийн хуудас */
export function buildPayslip({ wid, days, debts, from, to }) {
  const lines = [];
  days.filter(d => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date)).forEach(d => {
    (d.rows || []).filter(r => r.wid === wid).forEach(r => {
      lines.push({ date: d.date, speciesName: d.speciesName, dayPos: r.dayPos, amt: r.amt });
    });
  });
  const total = lines.reduce((s, l) => s + l.amt, 0);
  const deductions = debts.filter(q => q.wid === wid && !q.paid && q.date >= from && q.date <= to);
  const ded = deductions.reduce((s, q) => s + q.amt, 0);
  return { lines, total, deductions, ded, net: total - ded, workedDays: new Set(lines.map(l => l.date)).size };
}
