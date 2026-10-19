// Хоёр сайтад (нягтлан, админ) хуваалцдаг дэлгэцүүд: Нэгтгэл, Цалингийн хуудас, Үнэлгээ (харах)
import { state } from './store.js';
import {
  buildSummary, buildPayslip, fmt, shortDate, monthRange, shiftMonth, todayStr, ruleText, monthOf, pad, posIndex
} from './core.js';
import { esc, icon, toast } from './ui.js';

const halfMonth = (ym, second) => {
  const { to } = monthRange(ym);
  return second ? { from: `${ym}-16`, to } : { from: `${ym}-01`, to: `${ym}-15` };
};
function defaultPeriod() {
  const t = todayStr(), ym = monthOf(t);
  return halfMonth(ym, +t.slice(8) > 15);
}
const spName = id => state.config.species.find(s => s.id === id)?.name || id;

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
