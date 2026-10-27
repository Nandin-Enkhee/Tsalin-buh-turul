// Хоёр сайтад (нягтлан, админ) хуваалцдаг дэлгэцүүд: Нэгтгэл, Цалингийн хуудас, Үнэлгээ (харах)
import * as store from './store.js';
const { state } = store;
import {
  buildSummary, buildPayslip, buildAnimalStats, fmt, shortDate, monthRange, shiftMonth, todayStr, ruleText, monthOf, pad, posIndex
} from './core.js';
import { esc, icon, toast, modal, confirmBox, needOnline } from './ui.js';

const halfMonth = (ym, second) => {
  const { to } = monthRange(ym);
  return second ? { from: `${ym}-16`, to } : { from: `${ym}-01`, to: `${ym}-15` };
};
function defaultPeriod() {
  const t = todayStr(), ym = monthOf(t);
  return halfMonth(ym, +t.slice(8) > 15);
}
const spName = id => state.config.species.find(s => s.id === id)?.name || id;

/** Малын тоо (орсон + худалдан авсан) хүснэгтийн HTML. Нийт нийлбэр зориуд оруулаагүй — төрөл тус бүрээр. */
export function animalTable(stats) {
  const rows = stats.filter(x => x.head || x.buys);
  if (!rows.length) return `<p class="muted">Энэ хугацаанд мал орсон, худалдан авалт бүртгэгдээгүй байна.</p>`;
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Төрөл</th><th class="num">Орсон мал (толгой)</th><th class="num">Худалдан авсан</th><th class="num">Авсан дүн (₮)</th></tr></thead><tbody>
    ${rows.map(x => `<tr><td><b>${esc(x.name)}</b></td><td class="num">${x.head ? fmt(x.head) : '<span class="faint">·</span>'}${x.workDays ? `<div class="faint" style="font-size:11.5px">${x.workDays} өдөр</div>` : ''}</td>
      <td class="num">${x.kg ? `${fmt(x.kg)} кг` : ''}${x.kg && x.pcs ? '<br>' : ''}${x.pcs ? `${fmt(x.pcs)} ширхэг` : ''}${!x.kg && !x.pcs ? '<span class="faint">·</span>' : ''}</td>
      <td class="num">${x.amt ? fmt(x.amt) : '<span class="faint">·</span>'}</td></tr>`).join('')}
    </tbody></table></div>`;
}

/* =============================== НЭГТГЭЛ =============================== */
export function summaryView() {
  const S = { ...defaultPeriod(), sp: 'all' };
  let root;

  function quick(kind) {
    const ym = monthOf(todayStr());
    if (kind === 'h1') Object.assign(S, halfMonth(ym, false));
    else if (kind === 'h2') Object.assign(S, halfMonth(ym, true));
    else if (kind === 'month') Object.assign(S, { from: `${ym}-01`, to: monthRange(ym).to });
    else if (kind === 'prev') { const p = shiftMonth(ym, -1); Object.assign(S, { from: `${p}-01`, to: monthRange(p).to }); }
    root.querySelector('[data-f=from]').value = S.from; root.querySelector('[data-f=to]').value = S.to;
    draw();
  }

  function draw() {
    const box = root.querySelector('#sumTbl');
    const an = buildAnimalStats({ days: state.days, purchases: state.purchases, config: state.config, from: S.from, to: S.to }).filter(x => S.sp === 'all' || x.id === S.sp);
    root.querySelector('#animalBox').innerHTML = `<div class="card-head"><div><h2>Малын тоо</h2><p class="sub">${S.from.replaceAll('-', '.')} – ${S.to.replaceAll('-', '.')} хугацаанд орсон мал болон гаднаас худалдан авсан.</p></div></div>${animalTable(an)}`;
    const sum = buildSummary({ days: state.days, debts: state.debts, config: state.config, from: S.from, to: S.to, speciesId: S.sp });
    const all = S.sp === 'all';
    if (!sum.rows.length) {
      box.innerHTML = `<div class="tbl-wrap"><table class="tbl"><tbody><tr><td class="empty">Энэ хугацаанд баталгаажсан цалин алга.</td></tr></tbody></table></div>`;
      return;
    }
    const dayTot = {};
    sum.rows.forEach(r => Object.entries(r.byDay).forEach(([d, v]) => { dayTot[d] = (dayTot[d] || 0) + v; }));
    let h = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="stick">Ажилтан</th><th>Албан тушаал</th>`;
    sum.dates.forEach(d => { h += `<th class="num">${shortDate(d)}</th>`; });
    h += `<th class="num">Өдөр</th><th class="num">Нийт дүн</th>`;
    if (all) h += `<th class="num">Хувцас</th><th class="num">Дэлгүүр</th><th class="num">Урьдчилгаа</th><th class="num">Нийт олгох</th>`;
    h += `</tr></thead><tbody>`;
    sum.rows.forEach((r, i) => {
      h += `<tr><td class="stick"><span class="faint">${i + 1}.</span> ${esc(r.name)}</td><td><span class="chip">${esc(r.pos)}</span></td>`;
      sum.dates.forEach(d => { h += `<td class="num">${r.byDay[d] ? fmt(r.byDay[d]) : '<span class="faint">·</span>'}</td>`; });
      h += `<td class="num">${r.workedDays}</td><td class="num"><b>${fmt(r.total)}</b></td>`;
      if (all) h += `<td class="num">${r.clothes ? fmt(r.clothes) : ''}</td><td class="num">${r.store ? fmt(r.store) : ''}</td><td class="num">${r.adv ? fmt(r.adv) : ''}</td><td class="num"><b>${fmt(r.net)}</b></td>`;
      h += `</tr>`;
    });
    h += `</tbody><tfoot><tr><td class="stick">Нийт</td><td></td>`;
    sum.dates.forEach(d => { h += `<td class="num">${dayTot[d] ? fmt(dayTot[d]) : ''}</td>`; });
    h += `<td></td><td class="num">${fmt(sum.totals.total)}</td>`;
    if (all) h += `<td class="num">${fmt(sum.totals.clothes)}</td><td class="num">${fmt(sum.totals.store)}</td><td class="num">${fmt(sum.totals.adv)}</td><td class="num">${fmt(sum.totals.net)}</td>`;
    h += `</tr></tfoot></table></div>`;
    h += all
      ? `<p class="hint">«Бүгд» харагдац дээр өр суутгал тооцогдож «Нийт олгох» дүн гарна. Төлсөн гэж тэмдэглэсэн суутгал хасагдахгүй.</p>`
      : `<p class="hint">Тухайн малын төрлийн цалин л харагдана. Ажилтан хоёр төрөлд ажилласан бол суутгалыг давхардуулахгүйн тулд «Бүгд» харагдацаас үз.</p>`;
    box.innerHTML = h;
  }

  function exportXlsx() {
    if (!window.XLSX) { toast('Excel сан ачаалагдаагүй байна. Интернэтээ шалгана уу.', 'bad'); return; }
    const wb = XLSX.utils.book_new();
    const wk = Object.fromEntries(state.workers.map(w => [w.id, w]));
    const make = (speciesId, sheetName) => {
      const sum = buildSummary({ days: state.days, debts: state.debts, config: state.config, from: S.from, to: S.to, speciesId });
      if (!sum.rows.length) return false;
      const all = speciesId === 'all';
      const label = all ? 'бүх мал' : spName(speciesId);
      const aoa = [[state.config.companyName], [`Цалин хөлсний тайлан ${S.from.replaceAll('-', '.')} – ${S.to.replaceAll('-', '.')} (${label})`], []];
      aoa.push(['Д/Д', 'Ажилчдын нэрс', 'Албан тушаал', ...sum.dates.map(shortDate), 'Ажилласан өдөр', 'Нийт дүн',
        ...(all ? ['Өр суутгал хувцас', 'Дэлгүүр тооцоо', 'Урьдчилж олгосон дүн', 'Нийт олгох'] : []), 'Утас', 'Данс']);
      const dayTot = {};
      sum.rows.forEach((r, i) => {
        sum.dates.forEach(d => { if (r.byDay[d]) dayTot[d] = (dayTot[d] || 0) + r.byDay[d]; });
        aoa.push([i + 1, r.name, r.pos, ...sum.dates.map(d => r.byDay[d] || ''), r.workedDays, r.total,
          ...(all ? [r.clothes || '', r.store || '', r.adv || '', r.net] : []), wk[r.wid]?.phone || '', wk[r.wid]?.bank || '']);
      });
      aoa.push(['', 'Нийт', '', ...sum.dates.map(d => dayTot[d] || ''), '', sum.totals.total,
        ...(all ? [sum.totals.clothes, sum.totals.store, sum.totals.adv, sum.totals.net] : [])]);
      aoa.push([], [], ['', 'Тайлан гаргасан нягтлан: ................................. /                    /']);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 12 }, ...sum.dates.map(() => ({ wch: 9 })), { wch: 10 }, { wch: 12 }, ...(all ? [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 13 }] : []), { wch: 12 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Хуудас');
      return true;
    };
    if (S.sp === 'all') {
      make('all', 'Нийт');
      state.config.species.forEach(s => make(s.id, s.name));
    } else make(S.sp, spName(S.sp));
    // Малын тоо: орсон мал + худалдан авсан (хугацаагаар)
    const an = buildAnimalStats({ days: state.days, purchases: state.purchases, config: state.config, from: S.from, to: S.to }).filter(x => (S.sp === 'all' || x.id === S.sp) && (x.head || x.buys));
    if (an.length) {
      const aoa = [[state.config.companyName], [`Малын тоо ${S.from.replaceAll('-', '.')} – ${S.to.replaceAll('-', '.')}`], [],
        ['Төрөл', 'Орсон мал (толгой)', 'Ажилласан өдөр', 'Худалдан авсан мах (кг)', 'Худалдан авсан мал (ширхэг)', 'Худалдан авсан дүн (₮)']];
      an.forEach(x => aoa.push([x.name, x.head || '', x.workDays || '', x.kg || '', x.pcs || '', x.amt || '']));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 15 }, { wch: 22 }, { wch: 26 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Малын тоо');
    }
    if (!wb.SheetNames.length) { toast('Экспортлох өгөгдөл алга', 'bad'); return; }
    XLSX.writeFile(wb, `Цалин_${S.from}_${S.to}.xlsx`);
    toast('Excel файл татагдлаа');
  }

  return {
    title: 'Нэгтгэл',
    mount(r) {
      root = r;
      root.innerHTML = `
        <div class="page-head"><h1>Нэгтгэл</h1><p>Хугацааны цалингийн нэгтгэл — мөр нь ажилтан, багана нь өдөр.</p></div>
        <div class="card">
          <div class="fgrid">
            <div><label class="f">Эхлэх огноо</label><input class="inp" type="date" data-f="from" value="${S.from}"></div>
            <div><label class="f">Дуусах огноо</label><input class="inp" type="date" data-f="to" value="${S.to}"></div>
            <div><label class="f">Малын төрөл</label><select class="inp" data-f="sp"></select></div>
          </div>
          <div class="row mt">
            <button class="btn btn-secondary btn-sm" data-q="h1">Энэ сарын 1–15</button>
            <button class="btn btn-secondary btn-sm" data-q="h2">Энэ сарын 16–сарын эцэс</button>
            <button class="btn btn-secondary btn-sm" data-q="month">Бүтэн сар</button>
            <button class="btn btn-secondary btn-sm" data-q="prev">Өмнөх сар</button>
            <span class="grow"></span>
            <button class="btn btn-primary" data-act="xlsx">${icon('download')} Excel татах</button>
          </div>
        </div>
        <div class="card" id="animalBox"></div>
        <div class="card" id="sumTbl"></div>`;
      root.addEventListener('change', e => {
        const f = e.target.dataset.f; if (!f) return;
        S[f] = e.target.value; draw();
      });
      root.addEventListener('click', e => {
        const q = e.target.closest('[data-q]'); if (q) quick(q.dataset.q);
        if (e.target.closest('[data-act=xlsx]')) exportXlsx();
      });
      this.refresh();
    },
    refresh() {
      const sel = root.querySelector('[data-f=sp]');
      sel.innerHTML = `<option value="all">Бүгд (суутгалтай)</option>` + state.config.species.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
      sel.value = S.sp;
      draw();
    }
  };
}

/* ============================ ЦАЛИНГИЙН ХУУДАС ============================ */
export function payslipView() {
  const S = { ...defaultPeriod(), wid: '' };
  let root;

  function people() {
    const map = new Map();
    state.workers.forEach(w => map.set(w.id, { id: w.id, name: w.name, pos: w.pos, phone: w.phone, bank: w.bank }));
    state.days.forEach(d => (d.rows || []).forEach(r => { if (!map.has(r.wid)) map.set(r.wid, { id: r.wid, name: r.name + ' (устгагдсан)', pos: r.basePos }); }));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'mn'));
  }

  function draw() {
    const box = root.querySelector('#slip');
    const p = people().find(x => x.id === S.wid);
    if (!p) { box.innerHTML = `<div class="card muted">Цалингийн хуудас харахын тулд ажилтнаа сонгоно уу.</div>`; return; }
    const s = buildPayslip({ wid: p.id, days: state.days, debts: state.debts, from: S.from, to: S.to });
    box.innerHTML = `<div class="slip print-area">
      <h2>${esc(state.config.companyName)}</h2>
      <div style="color:#555">Цалингийн хуудас · ${S.from.replaceAll('-', '.')} – ${S.to.replaceAll('-', '.')}</div>
      <div class="meta">
        <div><span>Ажилтан</span><b>${esc(p.name)}</b></div><div><span>Үндсэн ажил</span>${esc(p.pos || '—')}</div>
        <div><span>Утас</span>${esc(p.phone || '—')}</div><div><span>Данс</span>${esc(p.bank || '—')}</div>
        <div><span>Ажилласан өдөр</span>${s.workedDays}</div></div>
      <table><thead><tr><th>Огноо</th><th>Мал</th><th>Тухайн өдрийн ажил</th><th class="num">Цалин (₮)</th></tr></thead><tbody>
        ${s.lines.length ? s.lines.map(l => `<tr><td>${l.date}</td><td>${esc(l.speciesName)}</td><td>${esc(l.dayPos)}</td><td class="num">${fmt(l.amt)}</td></tr>`).join('') : '<tr><td colspan="4" style="color:#777">Энэ хугацаанд цалин бүртгэгдээгүй.</td></tr>'}
        <tr><td colspan="3"><b>Нийт цалин</b></td><td class="num"><b>${fmt(s.total)}</b></td></tr></tbody></table>
      ${s.deductions.length ? `<table><thead><tr><th>Огноо</th><th colspan="2">Суутгал</th><th class="num">Дүн (₮)</th></tr></thead><tbody>
        ${s.deductions.map(q => `<tr><td>${q.date}</td><td colspan="2">${esc(q.type)}</td><td class="num">−${fmt(q.amt)}</td></tr>`).join('')}</tbody></table>` : ''}
      <div class="net"><span>Олгох дүн</span><span>${fmt(s.net)} ₮</span></div>
      <div class="sign"><div>Олгосон нягтлан</div><div>Хүлээн авсан: ${esc(p.name)}</div></div></div>`;
  }

  return {
    title: 'Цалингийн хуудас',
    mount(r) {
      root = r;
      root.innerHTML = `
        <div class="page-head"><h1>Цалингийн хуудас</h1><p>Цалин олгох өдөр ажилтан бүрт зөвхөн өөрийнх нь цалинг харуулсан хуудас хэвлэнэ.</p></div>
        <div class="card no-print"><div class="fgrid">
          <div><label class="f">Ажилтан</label><select class="inp" data-f="wid"></select></div>
          <div><label class="f">Эхлэх огноо</label><input class="inp" type="date" data-f="from" value="${S.from}"></div>
          <div><label class="f">Дуусах огноо</label><input class="inp" type="date" data-f="to" value="${S.to}"></div></div>
          <div class="row mt"><button class="btn btn-primary" data-act="print">${icon('print')} Хэвлэх</button></div></div>
        <div id="slip"></div>`;
      root.addEventListener('change', e => { const f = e.target.dataset.f; if (!f) return; S[f] = e.target.value; draw(); });
      root.addEventListener('click', e => { if (e.target.closest('[data-act=print]')) { if (!S.wid) { toast('Ажилтан сонгоно уу', 'bad'); return; } window.print(); } });
      this.refresh();
    },
    refresh() {
      const sel = root.querySelector('[data-f=wid]');
      sel.innerHTML = `<option value="">— Ажилтан сонгох —</option>` + people().map(p => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.pos || '')}</option>`).join('');
      sel.value = S.wid;
      draw();
    }
  };
}

/* ============================ ҮНЭЛГЭЭ (харах) ============================ */
export function ratesReadView() {
  let root;
  return {
    title: 'Үнэлгээ',
    mount(r) { root = r; this.refresh(); },
    refresh() {
      const c = state.config;
      root.innerHTML = `
        <div class="page-head"><h1>Үнэлгээ</h1><p>Албан тушаал бүрийн цалингийн үнэлгээ. Зөвхөн админ өөрчилнө.</p></div>
        <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Албан тушаал</th>${c.species.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody>
        ${c.positions.map(p => `<tr><td><span class="chip primary">${esc(p)}</span></td>${c.species.map(s => `<td class="num" style="text-align:left">${ruleText(c.rates[s.id]?.[p])}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
        <p class="hint">Үнэлгээ өөрчлөгдвөл зөвхөн дараа бодогдох цалинд нөлөөлнө — баталгаажсан өдрүүд хэвээр үлдэнэ.</p></div>`;
    }
  };
}

/* ============================ ХУДАЛДАН АВАЛТ ============================ */
/** Гаднаас худалдан авсан мах (кг-аар) эсвэл мал (ширхэгээр). admin=true бол шууд устгана, үгүй бол админаас хүсэлт илгээнэ. */
export function purchasesView({ admin = false } = {}) {
  const F = { ...(() => { const ym = monthOf(todayStr()); return { from: `${ym}-01`, to: monthRange(ym).to }; })(), sp: 'all' };
  const N = { unit: 'kg' };
  let root;
  const unitName = u => (u === 'kg' ? 'кг' : 'ширхэг');
  const rq = p => state.requests.find(r => r.id === 'purchase_' + p.id)?.status;

  function calcTotal() {
    const q = +root.querySelector('#pQ').value || 0, pr = +root.querySelector('#pP').value || 0;
    root.querySelector('#pT').value = q > 0 && pr > 0 ? Math.round(q * pr) : '';
  }
  function draw() {
    const list = state.purchases.filter(p => p.date >= F.from && p.date <= F.to && (F.sp === 'all' || p.speciesId === F.sp))
      .sort((a, b) => b.date.localeCompare(a.date));
    const by = {};
    list.forEach(p => {
      const o = (by[p.speciesId] ||= { name: p.speciesName || spName(p.speciesId), kg: 0, pcs: 0, sum: 0 });
      if (p.unit === 'kg') o.kg += +p.qty || 0; else o.pcs += +p.qty || 0;
      o.sum += +p.total || 0;
    });
    const all = Object.values(by);
    root.querySelector('#pSum').innerHTML = all.length
      ? `<div class="stats">${all.map(o => `<div class="stat"><div class="k">${esc(o.name)}</div><div class="v" style="font-size:17px">${o.kg ? `${fmt(o.kg)} кг` : ''}${o.kg && o.pcs ? ' · ' : ''}${o.pcs ? `${fmt(o.pcs)} ширхэг` : ''}</div><div class="k" style="margin-top:2px">${fmt(o.sum)} ₮</div></div>`).join('')}
        <div class="stat"><div class="k">Нийт дүн</div><div class="v">${fmt(all.reduce((a, o) => a + o.sum, 0))}<small> ₮</small></div></div></div>` : '';
    root.querySelector('#pBody').innerHTML = list.length ? list.map(p => `<tr>
      <td>${esc(p.date)}</td><td><span class="chip info">${esc(p.speciesName || spName(p.speciesId))}</span></td>
      <td class="num">${fmt(p.qty)} ${unitName(p.unit)}</td><td class="num">${fmt(p.price)}</td><td class="num"><b>${fmt(p.total)}</b></td>
      <td style="white-space:normal;min-width:120px">${esc(p.seller || '')}${p.note ? `<div class="faint" style="font-size:12px">${esc(p.note)}</div>` : ''}</td>
      <td class="num"><button class="btn btn-ghost btn-sm" data-pdel="${esc(p.id)}" aria-label="Устгах" title="${admin ? 'Устгах' : rq(p) === 'approved' ? 'Админ зөвшөөрсөн — устгах' : rq(p) === 'pending' ? 'Хүсэлт хүлээгдэж байна' : 'Устгах хүсэлт илгээх'}">${icon('trash')}${!admin && rq(p) === 'approved' ? ' <small>Зөвшөөрсөн</small>' : !admin && rq(p) === 'pending' ? ' <small>Хүлээгдэж буй</small>' : ''}</button></td></tr>`).join('')
      : `<tr><td colspan="7" class="empty">Энэ хугацаанд худалдан авалт бүртгэгдээгүй байна.</td></tr>`;
  }
  async function add() {
    if (!needOnline()) return;
    const sp = root.querySelector('#pS').value, qty = +root.querySelector('#pQ').value, price = +root.querySelector('#pP').value;
    const date = root.querySelector('#pD').value || todayStr();
    let total = Math.round(+root.querySelector('#pT').value || 0);
    if (!state.config.species.some(s => s.id === sp)) { toast('Малын төрөл сонгоно уу', 'bad'); return; }
    if (!(qty > 0)) { toast(N.unit === 'kg' ? 'Жинг (кг) оруулна уу' : 'Ширхэгийн тоог оруулна уу', 'bad'); return; }
    if (!(price > 0) && !(total > 0)) { toast('Нэгж үнэ эсвэл нийт дүнг оруулна уу', 'bad'); return; }
    if (!admin && (state.config.closedMonths || []).includes(monthOf(date))) { toast('Энэ сар хаагдсан байна', 'bad'); return; }
    if (!(total > 0)) total = Math.round(qty * price);
    const unitPrice = price > 0 ? Math.round(price) : Math.round(total / qty);
    try {
      await store.addPurchase({ date, speciesId: sp, speciesName: spName(sp), unit: N.unit, qty, price: unitPrice, total, seller: root.querySelector('#pW').value.trim(), note: root.querySelector('#pN').value.trim() });
      ['#pQ', '#pP', '#pT', '#pW', '#pN'].forEach(i => { root.querySelector(i).value = ''; });
      toast('Худалдан авалт бүртгэгдлээ');
    } catch (e) { console.error(e); toast('Хадгалж чадсангүй: ' + (e.code || e.message), 'bad'); }
  }
  async function del(id) {
    const p = state.purchases.find(x => x.id === id); if (!p || !needOnline()) return;
    const desc = `${esc(p.date)} · ${esc(p.speciesName || '')} · ${fmt(p.qty)} ${unitName(p.unit)} · ${fmt(p.total)}₮`;
    const rid = 'purchase_' + p.id, st = rq(p);
    if (admin || st === 'approved') {
      if (!(await confirmBox('Худалдан авалт устгах', `${desc} — бүртгэл устна.`, 'Устгах', true))) return;
      try { await store.deletePurchase(p.id); if (!admin) await store.useEdit(rid); toast('Устгагдлаа'); } catch (e) { console.error(e); toast('Устгаж чадсангүй: ' + (e.code || e.message), 'bad'); }
      return;
    }
    if (st === 'pending') { toast('Устгах хүсэлт админы зөвшөөрлийг хүлээж байна'); return; }
    const reason = await modal({
      title: 'Худалдан авалт устгах хүсэлт',
      body: `<p class="muted">${desc}. Устгахын тулд админы зөвшөөрөл хэрэгтэй.</p><label class="f" for="rsn">Яагаад устгах вэ?</label><textarea class="inp" id="rsn" rows="3" maxlength="300"></textarea>`,
      actions: [{ label: 'Болих', value: null }, { label: 'Хүсэлт илгээх', kind: 'primary', value: back => back.querySelector('#rsn').value.trim() || '' }]
    });
    if (reason === null) return;
    if (!reason) { toast('Шалтгаанаа бичнэ үү', 'bad'); return; }
    try { await store.requestEdit(rid, { kind: 'purchase', date: p.date, label: `Худалдан авалт: ${p.speciesName}`, speciesName: `Худалдан авалт · ${fmt(p.total)}₮`, reason }); toast('Хүсэлт админд илгээгдлээ'); }
    catch (e) { console.error(e); toast('Илгээж чадсангүй: ' + (e.code || e.message), 'bad'); }
  }
  function exportXlsx() {
    if (!window.XLSX) { toast('Excel сан ачаалагдаагүй байна. Интернэтээ шалгана уу.', 'bad'); return; }
    const list = state.purchases.filter(p => p.date >= F.from && p.date <= F.to && (F.sp === 'all' || p.speciesId === F.sp)).sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length) { toast('Экспортлох өгөгдөл алга', 'bad'); return; }
    const aoa = [[state.config.companyName], [`Худалдан авалтын тайлан ${F.from.replaceAll('-', '.')} – ${F.to.replaceAll('-', '.')}`], [],
      ['Д/Д', 'Огноо', 'Төрөл', 'Хэмжээ', 'Нэгж', 'Нэгж үнэ', 'Нийт дүн', 'Хэнээс', 'Тэмдэглэл']];
    list.forEach((p, i) => aoa.push([i + 1, p.date, p.speciesName || spName(p.speciesId), p.qty, unitName(p.unit), p.price, p.total, p.seller || '', p.note || '']));
    aoa.push(['', 'Нийт', '', '', '', '', list.reduce((a, p) => a + (+p.total || 0), 0)]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 9 }, { wch: 11 }, { wch: 14 }, { wch: 20 }, { wch: 24 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Худалдан авалт');
    XLSX.writeFile(wb, `Худалдан_авалт_${F.from}_${F.to}.xlsx`);
    toast('Excel файл татагдлаа');
  }
  return {
    title: 'Худалдан авалт',
    mount(r) {
      root = r;
      root.innerHTML = `
        <div class="page-head"><h1>Худалдан авалт</h1><p>Гаднаас худалдан авсан мах (кг-аар), эсвэл мал (ширхэгээр) бүртгэнэ.</p></div>
        <div class="card"><div class="card-head"><div><h2>Шинэ худалдан авалт</h2></div></div>
          <div class="fgrid">
            <div><label class="f">Огноо</label><input class="inp" type="date" id="pD" value="${todayStr()}"></div>
            <div><label class="f">Төрөл</label><select class="inp" id="pS"></select></div>
            <div><label class="f">Хэмжээний нэгж</label><div class="seg" id="pU"><button data-unit="kg" class="on">Кг (мах)</button><button data-unit="pcs">Ширхэг (мал)</button></div></div>
            <div><label class="f" id="pQL">Жин (кг)</label><input class="inp right" id="pQ" type="number" min="0" step="any" inputmode="decimal" placeholder="420"></div>
            <div><label class="f" id="pPL">Нэгж үнэ (₮ / кг)</label><input class="inp right" id="pP" type="number" min="0" inputmode="numeric" placeholder="9500"></div>
            <div><label class="f">Нийт дүн (₮)</label><input class="inp right" id="pT" type="number" min="0" inputmode="numeric" placeholder="автоматаар"></div>
            <div><label class="f">Хэнээс авсан</label><input class="inp" id="pW" placeholder="Заавал биш"></div>
            <div><label class="f">Тэмдэглэл</label><input class="inp" id="pN" placeholder="Заавал биш"></div>
          </div>
          <div class="hint">Нийт дүн = хэмжээ × нэгж үнэ гэж автоматаар бодогдоно. Бөөндөө тохирсон үнэтэй бол нийт дүнг гараар бичиж болно.</div>
          <div class="mt"><button class="btn btn-primary" data-act="padd">${icon('plus')} Бүртгэх</button></div></div>
        <div class="card"><div class="card-head"><div><h2>Бүртгэл</h2></div>
          <div class="row"><input class="inp sm" type="date" data-pf="from" style="width:140px" value="${F.from}"><input class="inp sm" type="date" data-pf="to" style="width:140px" value="${F.to}">
          <select class="inp sm" data-pf="sp" id="pF" style="width:130px"></select>
          <button class="btn btn-secondary btn-sm" data-act="pxlsx">${icon('download')} Excel</button></div></div>
          <div id="pSum"></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Огноо</th><th>Төрөл</th><th class="num">Хэмжээ</th><th class="num">Нэгж үнэ</th><th class="num">Нийт (₮)</th><th>Хэнээс / тэмдэглэл</th><th></th></tr></thead><tbody id="pBody"></tbody></table></div>
          ${admin ? '' : '<p class="hint">Буруу бүртгэсэн бол устгах хүсэлт илгээнэ — админ зөвшөөрсний дараа устгана.</p>'}</div>`;
      root.addEventListener('click', e => {
        const u = e.target.closest('[data-unit]');
        if (u) {
          N.unit = u.dataset.unit;
          root.querySelectorAll('#pU button').forEach(b => b.classList.toggle('on', b === u));
          root.querySelector('#pQL').textContent = N.unit === 'kg' ? 'Жин (кг)' : 'Ширхэгийн тоо';
          root.querySelector('#pPL').textContent = N.unit === 'kg' ? 'Нэгж үнэ (₮ / кг)' : 'Нэгж үнэ (₮ / ширхэг)';
          root.querySelector('#pQ').placeholder = N.unit === 'kg' ? '420' : '5';
          calcTotal(); return;
        }
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'padd') add(); else if (act === 'pxlsx') exportXlsx();
        const d = e.target.closest('[data-pdel]'); if (d) del(d.dataset.pdel);
      });
      root.addEventListener('input', e => { if (e.target.id === 'pQ' || e.target.id === 'pP') calcTotal(); });
      root.addEventListener('change', e => { const f = e.target.dataset.pf; if (f) { F[f] = e.target.value; draw(); } });
      this.refresh();
    },
    refresh() {
      const s = root.querySelector('#pS'), cur = s.value;
      s.innerHTML = state.config.species.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
      if (cur) s.value = cur;
      const f = root.querySelector('#pF');
      f.innerHTML = `<option value="all">Бүх төрөл</option>` + state.config.species.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
      f.value = F.sp;
      draw();
    }
  };
}
