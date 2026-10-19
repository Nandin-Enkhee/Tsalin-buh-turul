// Админы сайт (имэйл/нууц үгээр нэвтэрнэ). Хяналт, календарь, ажилчид, үнэлгээний тохиргоо.
import * as store from './store.js';
import { fmt, todayStr, monthOf, shiftMonth, monthLabel, dayStatus, posIndex, hashPin, shortDate } from './core.js';
import {
  esc, icon, toast, confirmBox, initTheme, mountShell, banner, needOnline, loginScreen,
  monthRibbon, ribbonLegend, scrollRibbonToToday, missingDays
} from './ui.js';
import { summaryView } from './views-shared.js';

const { state } = store;
const app = document.getElementById('app');
const spName = id => state.config.species.find(s => s.id === id)?.name || id;
const teamOf = w => w.team || state.config.species[0].id;
const byName = (a, b) => a.name.localeCompare(b.name, 'mn');

/** config-ийг бүхлээр нь хуулж, өөрчлөөд хадгална */
async function editConfig(fn) {
  if (!needOnline()) return false;
  const next = structuredClone(state.config);
  fn(next);
  try { await store.saveConfig(next); return true; } catch (e) { console.error(e); toast('Хадгалж чадсангүй: ' + (e.code || e.message), 'bad'); return false; }
}

/* ================================ ХЯНАЛТ ================================ */
function dashboardView() {
  const S = { ym: monthOf(todayStr()), sel: todayStr() };
  let root;
  function draw() {
    root.querySelector('#rbMonth').textContent = monthLabel(S.ym);
    root.querySelector('#rbBox').innerHTML = monthRibbon({ ym: S.ym, selected: S.sel });
    scrollRibbonToToday(root.querySelector('#rbBox'));

    const isClosed = (state.config.closedMonths || []).includes(S.ym);
    const cb = root.querySelector('#closeBtn');
    cb.innerHTML = isClosed ? `${icon('check')} Сар хаагдсан · нээх` : 'Сар хаах';
    root.querySelector('#rbMonth').innerHTML = `${esc(monthLabel(S.ym))}${isClosed ? ' <span class="chip warn">хаагдсан</span>' : ''}`;
    const days = state.days.filter(d => monthOf(d.date) === S.ym);
    const dates = [...new Set(days.map(d => d.date))];
    const [y, m] = S.ym.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    let miss = 0, off = 0;
    for (let d = 1; d <= last; d++) {
      const st = dayStatus(`${S.ym}-${String(d).padStart(2, '0')}`, state);
      if (st === 'miss') miss++; else if (st === 'off') off++;
    }
    const total = days.reduce((s, d) => s + (d.rows || []).reduce((a, r) => a + r.amt, 0), 0);
    const bySp = state.config.species.map(s => [s.name, days.filter(d => d.speciesId === s.id).reduce((a, d) => a + (+d.head || 0), 0)]).filter(x => x[1] > 0);
    root.querySelector('#stats').innerHTML = `
      <div class="stat"><div class="k">Баталгаажсан өдөр</div><div class="v ok">${dates.length}</div></div>
      <div class="stat"><div class="k">Шивэгдээгүй өдөр</div><div class="v ${miss ? 'bad' : ''}">${miss}</div></div>
      <div class="stat"><div class="k">Ажиллаагүй өдөр</div><div class="v">${off}</div></div>
      <div class="stat"><div class="k">Нийт бодогдсон цалин</div><div class="v">${fmt(total)}<small> ₮</small></div></div>
      <div class="stat"><div class="k">Нийт мал (толгой)</div><div class="v">${bySp.length ? bySp.map(([n, h]) => `<div style="font-size:15px;font-weight:600">${esc(n)}: ${fmt(h)}</div>`).join('') : '0'}</div></div>`;

    const pend = state.requests.filter(r => r.status === 'pending' || r.status === 'approved').sort((a, b) => a.date.localeCompare(b.date));
    root.querySelector('#reqs').innerHTML = pend.length ? `<div class="card-head"><div><h2>Засах хүсэлтүүд</h2><p class="sub">Нягтлангаас ирсэн. Зөвшөөрвөл нягтлан тухайн өдрийг нэг удаа засах/устгаж чадна.</p></div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Өдөр</th><th>Мал</th><th>Шалтгаан</th><th>Төлөв</th><th></th></tr></thead><tbody>
      ${pend.map(r => `<tr><td><button class="btn btn-ghost btn-sm" data-date="${esc(r.date)}">${esc(r.date)}</button></td><td>${esc(r.speciesName || spName(r.speciesId))}${r.kind === 'debt' ? ` <span class="chip">суутгал</span>` : ''}</td><td style="white-space:normal;min-width:160px">${esc(r.reason || '')}</td>
        <td><span class="chip ${r.status === 'approved' ? 'ok' : 'warn'}">${r.status === 'approved' ? 'Зөвшөөрсөн' : 'Хүлээгдэж буй'}</span></td>
        <td class="num">${r.status === 'pending' ? `<button class="btn btn-primary btn-sm" data-dec="approved" data-rid="${esc(r.id)}">Зөвшөөрөх</button> <button class="btn btn-secondary btn-sm" data-dec="rejected" data-rid="${esc(r.id)}">Татгалзах</button>`
          : `<button class="btn btn-secondary btn-sm" data-dec="rejected" data-rid="${esc(r.id)}">Эрхийг цуцлах</button>`}</td></tr>`).join('')}
      </tbody></table></div>` : '';
    const recs = state.days.filter(d => d.date === S.sel);
    const st = dayStatus(S.sel, state);
    const label = { ok: 'Баталгаажсан', pending: 'Хүлээгдэж буй', miss: 'Шивэгдээгүй', off: 'Ажиллаагүй өдөр', future: 'Ирээдүйн өдөр', before: 'Системийн эхлэлээс өмнө' }[st];
    let h = `<div class="card-head"><div><h2>${S.sel} · өдрийн тооцоо</h2><p class="sub">${label}</p></div></div>`;
    if (!recs.length) h += `<p class="muted">Энэ өдөр баталгаажсан цалин алга.</p>`;
    recs.forEach(rec => {
      const rows = rec.rows || [];
      h += `<div class="row mt"><b>${esc(rec.speciesName || spName(rec.speciesId))}</b><span class="chip">${fmt(rec.head)} толгой</span><span class="grow"></span>
        <button class="btn btn-danger btn-sm" data-delday="${esc(rec.id)}">${icon('trash')} Устгах</button></div>
        <div class="tbl-wrap mt-s"><table class="tbl"><thead><tr><th>№</th><th>Ажилтан</th><th>Өдрийн ажил</th><th class="num">Цалин (₮)</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td class="faint">${i + 1}</td><td>${esc(r.name)}${r.borrowed ? ' <span class="chip info">өөр баг</span>' : ''}</td>
          <td>${r.dayPos !== r.basePos ? `<span class="chip warn">${esc(r.basePos)} → ${esc(r.dayPos)}</span>` : `<span class="chip">${esc(r.dayPos)}</span>`}</td><td class="num">${fmt(r.amt)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="3">Нийт</td><td class="num">${fmt(rows.reduce((s, r) => s + r.amt, 0))}</td></tr></tfoot></table></div>`;
    });
    root.querySelector('#detail').innerHTML = h;
  }
  return {
    title: 'Хяналт',
    mount(r) {
      root = r;
      root.innerHTML = `
        <div class="page-head"><h1>Хяналт</h1><p>Сарын байдал, өдөр бүрийн цалингийн тооцоо.</p></div>
        <div id="stats" class="stats"></div>
        <div class="card" id="reqs"></div>
        <div class="card"><div class="mhead"><h2 id="rbMonth"></h2>
          <button class="btn btn-secondary btn-sm" data-m="-1" aria-label="Өмнөх сар">${icon('left')}</button>
          <button class="btn btn-secondary btn-sm" data-m="0">Энэ сар</button>
          <button class="btn btn-secondary btn-sm" data-m="1" aria-label="Дараах сар">${icon('right')}</button>
          <button class="btn btn-secondary btn-sm" data-act="closem" id="closeBtn"></button></div>
          <div id="rbBox"></div>${ribbonLegend()}</div>
        <div class="card" id="detail"></div>`;
      root.addEventListener('click', async e => {
        const m = e.target.closest('[data-m]');
        if (m) { S.ym = m.dataset.m === '0' ? monthOf(todayStr()) : shiftMonth(S.ym, +m.dataset.m); draw(); return; }
        if (e.target.closest('[data-act=closem]')) {
          const isC = (state.config.closedMonths || []).includes(S.ym);
          if (!(await confirmBox(isC ? 'Сар нээх' : 'Сар хаах', isC ? `${monthLabel(S.ym)}-ийг нээвэл нягтлан дахин өөрчлөх боломжтой болно.` : `${monthLabel(S.ym)}-ийн цалинг хаавал нягтлан энэ сарын цалин нэмэх/засах/устгах боломжгүй болно.`, isC ? 'Нээх' : 'Хаах'))) return;
          const ok = await editConfig(c => { const a = new Set(c.closedMonths || []); isC ? a.delete(S.ym) : a.add(S.ym); c.closedMonths = [...a].sort(); });
          if (ok) toast(isC ? 'Сар нээгдлээ' : 'Сар хаагдлаа');
          return;
        }
        const dc = e.target.closest('[data-dec]');
        if (dc) {
          if (!needOnline()) return;
          try { await store.decideEdit(dc.dataset.rid, dc.dataset.dec); toast(dc.dataset.dec === 'approved' ? 'Зөвшөөрлөө — нягтлан засах боломжтой' : 'Татгалзлаа'); }
          catch (er) { console.error(er); toast('Хадгалж чадсангүй: ' + (er.code || er.message), 'bad'); }
          return;
        }
        const d = e.target.closest('[data-date]'); if (d) { S.sel = d.dataset.date; draw(); return; }
        const del = e.target.closest('[data-delday]');
        if (del) {
          const rec = state.days.find(x => x.id === del.dataset.delday);
          if (!rec || !(await confirmBox('Өдрийн бүртгэл устгах', `${rec.date} · ${esc(rec.speciesName)}-ийн цалингийн бүртгэл устна. Үргэлжлүүлэх үү?`, 'Устгах', true)) || !needOnline()) return;
          await store.deleteDay(rec.id); toast('Устгагдлаа');
        }
      });
      draw();
    },
    refresh() { draw(); },
    select(date) { S.sel = date; S.ym = monthOf(date); draw(); }
  };
}

/* ================================ КАЛЕНДАРЬ ================================ */
function calendarView() {
  const S = { ym: monthOf(todayStr()) };
  let root;
  const draw = () => {
    root.querySelector('#rbMonth').textContent = monthLabel(S.ym);
    root.querySelector('#rbBox').innerHTML = monthRibbon({ ym: S.ym });
    scrollRibbonToToday(root.querySelector('#rbBox'));
  };
  return {
    title: 'Календарь',
    mount(r) {
      root = r;
      root.innerHTML = `
        <div class="page-head"><h1>Ажиллаагүй өдөр</h1><p>Үйлдвэр ажиллаагүй өдрийг тэмдэглэнэ. Тэмдэглэсэн өдөр «шивэгдээгүй» гэсэн анхааруулга нягтлан болон танд гарахгүй.</p></div>
        <div class="card"><div class="mhead"><h2 id="rbMonth"></h2>
          <button class="btn btn-secondary btn-sm" data-m="-1" aria-label="Өмнөх сар">${icon('left')}</button>
          <button class="btn btn-secondary btn-sm" data-m="0">Энэ сар</button>
          <button class="btn btn-secondary btn-sm" data-m="1" aria-label="Дараах сар">${icon('right')}</button></div>
          <div id="rbBox"></div>${ribbonLegend()}
          <p class="hint">Өдөр дээр дарж «ажиллаагүй» болгоно, дахин дарж буцаана. Цалин баталгаажсан өдрийг өөрчлөх боломжгүй.</p></div>`;
      root.addEventListener('click', async e => {
        const m = e.target.closest('[data-m]');
        if (m) { S.ym = m.dataset.m === '0' ? monthOf(todayStr()) : shiftMonth(S.ym, +m.dataset.m); draw(); return; }
        const d = e.target.closest('[data-date]'); if (!d || !needOnline()) return;
        const date = d.dataset.date;
        if (state.days.some(x => x.date === date)) { toast('Цалин баталгаажсан өдрийг ажиллаагүй болгох боломжгүй', 'bad'); return; }
        const on = !state.offDays.some(o => o.date === date);
        await store.setOffDay(date, on);
        toast(on ? `${date} — ажиллаагүй өдөр болгов` : `${date} — буцаалаа`);
      });
      draw();
    },
    refresh() { draw(); }
  };
}

/* ================================ АЖИЛЧИД ================================ */
function workersView() {
  const F = { team: 'all' };
  let root;
  function draw() {
    const pi = posIndex(state.config);
    const list = state.workers.filter(w => F.team === 'all' || teamOf(w) === F.team)
      .sort((a, b) => Number(b.active) - Number(a.active) || pi(a.pos) - pi(b.pos) || byName(a, b));
    root.querySelector('#wSeg').innerHTML = [['all', 'Бүгд'], ...state.config.species.map(s => [s.id, s.name])]
      .map(([id, n]) => `<button data-team="${esc(id)}" class="${F.team === id ? 'on' : ''}">${esc(n)}</button>`).join('');
    root.querySelector('#wBody').innerHTML = list.length ? list.map(w => `<tr style="${w.active ? '' : 'opacity:.55'}">
      <td><b>${esc(w.name)}</b></td><td><span class="chip info">${esc(spName(teamOf(w)))}</span></td><td><span class="chip primary">${esc(w.pos)}</span></td>
      <td>${esc(w.phone || '')}</td>
      <td><input class="inp sm right" style="width:120px" type="number" min="0" inputmode="numeric" placeholder="стандарт" data-fixed="${esc(w.id)}" value="${w.fixedSalary > 0 ? w.fixedSalary : ''}"></td>
      <td><span class="chip ${w.active ? 'ok' : 'bad'}">${w.active ? 'Идэвхтэй' : 'Идэвхгүй'}</span></td>
      <td class="num"><button class="btn btn-ghost btn-sm" data-del="${esc(w.id)}" aria-label="Устгах">${icon('trash')}</button></td></tr>`).join('')
      : `<tr><td colspan="7" class="empty">Ажилтан бүртгэгдээгүй байна.</td></tr>`;
  }
  return {
    title: 'Ажилчид',
    mount(r) {
      root = r;
      root.innerHTML = `
        <div class="page-head"><h1>Ажилчид</h1><p>Тогтмол цалингийн тусгай дүн оруулах, ажилтан устгах. Шинэ ажилтныг нягтлан бүртгэнэ.</p></div>
        <div class="card"><div class="card-head"><div><h2>Жагсаалт</h2><p class="sub">«Тогтмол цалин» нь зөвхөн тогтмол үнэлгээтэй ажил (Тогооч, Шөрмөс гэх мэт) дээр стандарт дүнгийн оронд үйлчилнэ. Хоосон бол стандарт дүн.</p></div><div class="seg" id="wSeg"></div></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Нэр</th><th>Баг</th><th>Ажил</th><th>Утас</th><th class="num">Тогтмол цалин (₮)</th><th>Төлөв</th><th></th></tr></thead><tbody id="wBody"></tbody></table></div></div>`;
      root.addEventListener('click', async e => {
        const tm = e.target.closest('[data-team]'); if (tm) { F.team = tm.dataset.team; draw(); return; }
        const del = e.target.closest('[data-del]');
        if (del) {
          const w = state.workers.find(x => x.id === del.dataset.del); if (!w) return;
          if (!(await confirmBox('Ажилтан устгах', `<b>${esc(w.name)}</b>-ийг жагсаалтаас бүрмөсөн устгах уу? Өмнөх цалингийн бүртгэл, тайлан хэвээр үлдэнэ. Түр хасах бол нягтлан «идэвхгүй» болгоно.`, 'Устгах', true)) || !needOnline()) return;
          await store.deleteWorker(w.id); toast('Ажилтан устгагдлаа');
        }
      });
      root.addEventListener('change', async e => {
        const id = e.target.dataset.fixed; if (!id || !needOnline()) return;
        await store.updateWorker(id, { fixedSalary: Math.max(0, Math.round(+e.target.value || 0)) });
        toast('Хадгалагдлаа');
      });
      draw();
    },
    refresh() { if (!root.contains(document.activeElement) || document.activeElement.tagName !== 'INPUT') draw(); }
  };
}

/* ================================ ТОХИРГОО ================================ */
function settingsView() {
  let root;
  const typeDefault = t => t === 'fixed' ? { type: 'fixed', rate: 100000 } : t === 'perHead' ? { type: 'perHead', rate: 1000 } : { type: 'threshold', lo: 80000, hi: 100000, cut: 70 };
  const TYPE_LABEL = { fixed: 'тогтмол', perHead: 'толгой тутам', threshold: 'босготой' };

  function rateCell(si, pi) {
    const c = state.config, sp = c.species[si], p = c.positions[pi], r = c.rates[sp.id]?.[p];
    if (!r) return '<span class="faint">үнэлгээ алга</span>';
    const n = (f, w, v) => `<input class="inp sm right" style="width:${w}px" type="number" min="0" inputmode="numeric" data-rate data-si="${si}" data-pi="${pi}" data-fld="${f}" value="${v}" aria-label="${esc(p)} ${f}">`;
    if (r.type === 'fixed') return `${n('rate', 110, r.rate)} <span class="faint">₮ өдөрт</span>`;
    if (r.type === 'perHead') return `${n('rate', 110, r.rate)} <span class="faint">₮ / толгой</span>`;
    return `<span class="faint">&lt;</span>${n('cut', 64, r.cut)}<span class="faint"> толгойд</span> ${n('lo', 100, r.lo)} <span class="faint">₮, түүнээс дээш</span> ${n('hi', 100, r.hi)} <span class="faint">₮</span>`;
  }
  function draw() {
    const c = state.config;
    root.querySelector('#posBody').innerHTML = c.positions.map((p, pi) => {
      const r = c.rates[c.species[0]?.id]?.[p];
      return `<tr><td><input class="inp sm" style="width:200px" data-pname="${pi}" value="${esc(p)}" aria-label="Албан тушаалын нэр"></td>
        <td><span class="chip">${TYPE_LABEL[r?.type] || '—'}</span></td>
        <td class="num"><button class="btn btn-ghost btn-sm" data-prem="${pi}" aria-label="Хасах">${icon('trash')}</button></td></tr>`;
    }).join('');
    root.querySelector('#rateCards').innerHTML = c.species.map((s, si) => `
      <div class="card"><div class="card-head"><div><h2>Үнэлгээ · ${esc(s.name)}</h2><p class="sub">Дүн бүрийг засаад талбараас гарахад хадгалагдана.</p></div>
        <div><label class="f">Төрлийн нэр</label><input class="inp sm" style="width:180px" data-spname="${si}" value="${esc(s.name)}"></div></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Албан тушаал</th><th>Үнэлгээ</th></tr></thead><tbody>
        ${c.positions.map((p, pi) => `<tr><td><span class="chip primary">${esc(p)}</span></td><td style="white-space:nowrap">${rateCell(si, pi)}</td></tr>`).join('')}
        </tbody></table></div></div>`).join('');
    root.querySelector('#coName').value = c.companyName || '';
    root.querySelector('#startDate').value = c.startDate || '';
    root.querySelector('#shiftPos').innerHTML = c.positions.map(p => `<option ${p === c.shiftPosition ? 'selected' : ''}>${esc(p)}</option>`).join('');
    root.querySelector('#pinNote').textContent = c.pinHash ? 'PIN тохируулагдсан.' : 'Одоогоор стандарт PIN (8008) ашиглаж байна — солихыг зөвлөе.';
  }
  async function renamePosition(idx, name) {
    const old = state.config.positions[idx]; name = name.trim();
    if (!name || name === old) { draw(); return; }
    if (state.config.positions.includes(name)) { toast('Ийм нэртэй албан тушаал байна', 'bad'); draw(); return; }
    if (!needOnline()) { draw(); return; }
    const next = structuredClone(state.config);
    next.positions[idx] = name;
    Object.values(next.rates).forEach(r => { if (r[old]) { r[name] = r[old]; delete r[old]; } });
    if (next.shiftPosition === old) next.shiftPosition = name;
    try { await store.renamePosition(old, name, next); toast('Нэр солигдлоо (ажилчдын бүртгэл дагаж шинэчлэгдэнэ)'); } catch (e) { toast('Алдаа: ' + (e.code || e.message), 'bad'); }
  }
  return {
    title: 'Тохиргоо',
    mount(r) {
      root = r;
      root.innerHTML = `
        <div class="page-head"><h1>Тохиргоо</h1><p>Албан тушаал, малын төрөл, цалингийн үнэлгээ. Өөрчлөлт зөвхөн цаашид бодогдох цалинд нөлөөлнө — баталгаажсан өдрүүд хэвээр.</p></div>
        <div class="card"><div class="card-head"><div><h2>Албан тушаалууд</h2><p class="sub">Нэрийг шууд солих боломжтой — ажилчдын бүртгэл дагаж шинэчлэгдэнэ. Идэвхтэй ажилтантай албан тушаалыг хасах боломжгүй.</p></div></div>
          <div class="tbl-wrap" style="max-height:340px"><table class="tbl"><thead><tr><th>Нэр</th><th>Цалингийн төрөл</th><th></th></tr></thead><tbody id="posBody"></tbody></table></div>
          <div class="row mt"><div><label class="f">Шинэ албан тушаал</label><input class="inp" id="npName" placeholder="ж: Арьс" style="width:200px"></div>
            <div><label class="f">Цалингийн төрөл</label><select class="inp" id="npType" style="width:230px"><option value="fixed">Тогтмол өдрийн цалин</option><option value="perHead">Толгой тутмын үнэлгээ</option><option value="threshold">Босготой (бага / их)</option></select></div>
            <div style="align-self:flex-end"><button class="btn btn-primary" data-act="addpos">${icon('plus')} Нэмэх</button></div></div>
          <p class="hint">Шинэ албан тушаал бүх малын төрөлд стандарт дүнгээр үүснэ — дараа нь дүнг нь доорх үнэлгээнд засна.</p></div>
        <div id="rateCards"></div>
        <div class="card"><div class="card-head"><div><h2>Малын төрөл нэмэх</h2><p class="sub">Жишээ нь үхэр, сарлаг. Эхний төрлийн үнэлгээг хуулж үүсгэнэ — дараа нь дүнг нь засна. Төрлийг устгах боломжгүй (түүхэн тайланд хэрэгтэй).</p></div></div>
          <div class="row"><input class="inp" id="nsName" placeholder="ж: Үхэр" style="max-width:260px"><button class="btn btn-primary" data-act="addsp">${icon('plus')} Төрөл нэмэх</button></div></div>
        <div class="card"><div class="card-head"><div><h2>Ерөнхий</h2></div></div>
          <div class="fgrid">
            <div><label class="f">Компанийн нэр (тайлан, хуудсанд гарна)</label><input class="inp" id="coName"></div>
            <div><label class="f">Системийг хэрэглэж эхэлсэн огноо</label><input class="inp" type="date" id="startDate"><div class="hint">Энэ огнооноос өмнөх өдрүүд «дутуу» гэж улаан болохгүй.</div></div>
            <div><label class="f">Ээлжээр бодох албан тушаал</label><select class="inp" id="shiftPos"></select></div>
            <div><label class="f">Устгах/дарж бичих PIN (нягтланд)</label><div class="row"><input class="inp right" id="newPin" type="password" inputmode="numeric" maxlength="8" placeholder="Шинэ PIN" style="max-width:160px"><button class="btn btn-secondary" data-act="pin">Солих</button></div><div class="hint" id="pinNote"></div></div>
          </div></div>
        <div class="card"><div class="card-head"><div><h2>Нөөц хуулбар</h2><p class="sub">Бүх өгөгдлийг (ажилтан, цалин, суутгал, тохиргоо) JSON файлаар татаж хадгална. Сард нэг удаа татахыг зөвлөе.</p></div></div>
          <button class="btn btn-secondary" data-act="backup">${icon('file')} Нөөц хуулбар татах</button></div>`;

      root.addEventListener('change', async e => {
        const t = e.target;
        if (t.dataset.rate !== undefined) {
          const v = Math.max(0, Math.round(+t.value || 0));
          const ok = await editConfig(c => { c.rates[c.species[+t.dataset.si].id][c.positions[+t.dataset.pi]][t.dataset.fld] = v; });
          if (ok) toast('Үнэлгээ хадгалагдлаа');
        } else if (t.dataset.spname !== undefined) {
          const name = t.value.trim(); if (!name) { draw(); return; }
          if (await editConfig(c => { c.species[+t.dataset.spname].name = name; })) toast('Хадгалагдлаа');
        } else if (t.dataset.pname !== undefined) renamePosition(+t.dataset.pname, t.value);
        else if (t.id === 'coName') { if (await editConfig(c => { c.companyName = t.value.trim() || c.companyName; })) toast('Хадгалагдлаа'); }
        else if (t.id === 'startDate') { if (await editConfig(c => { c.startDate = t.value || null; })) toast('Хадгалагдлаа'); }
        else if (t.id === 'shiftPos') { if (await editConfig(c => { c.shiftPosition = t.value; })) toast('Хадгалагдлаа'); }
      });
      root.addEventListener('click', async e => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        const prem = e.target.closest('[data-prem]');
        if (prem) {
          const p = state.config.positions[+prem.dataset.prem];
          if (state.workers.some(w => w.active && w.pos === p)) { toast(`«${p}» албан тушаалд идэвхтэй ажилтан байгаа тул хасах боломжгүй`, 'bad'); return; }
          if (!(await confirmBox('Албан тушаал хасах', `«${esc(p)}»-ийг үнэлгээний жагсаалтаас хасах уу?`, 'Хасах', true))) return;
          await editConfig(c => { c.positions = c.positions.filter(x => x !== p); Object.values(c.rates).forEach(r => { delete r[p]; }); if (c.shiftPosition === p) c.shiftPosition = c.positions[0] || ''; });
          return;
        }
        if (act === 'backup') {
          const data = { exportedAt: new Date().toISOString(), config: state.config, workers: state.workers, days: state.days, offDays: state.offDays, debts: state.debts };
          const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
          const a = document.createElement('a'); a.href = url; a.download = `tsalin-backup-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url);
          toast('Нөөц хуулбар татагдлаа'); return;
        }
        if (act === 'addpos') {
          const name = root.querySelector('#npName').value.trim();
          if (!name) { toast('Нэр оруулна уу', 'bad'); return; }
          if (state.config.positions.includes(name)) { toast('Ийм нэртэй албан тушаал байна', 'bad'); return; }
          const type = root.querySelector('#npType').value;
          if (await editConfig(c => { c.positions.push(name); c.species.forEach(s => { (c.rates[s.id] ||= {})[name] = typeDefault(type); }); })) { root.querySelector('#npName').value = ''; toast('Албан тушаал нэмэгдлээ — дүнг нь засна уу'); }
        } else if (act === 'addsp') {
          const name = root.querySelector('#nsName').value.trim();
          if (!name) { toast('Нэр оруулна уу', 'bad'); return; }
          if (state.config.species.some(s => s.name.toLowerCase() === name.toLowerCase())) { toast('Ийм нэртэй төрөл байна', 'bad'); return; }
          const id = 's' + Date.now().toString(36);
          if (await editConfig(c => { c.species.push({ id, name }); c.rates[id] = structuredClone(c.rates[c.species[0].id] || {}); })) { root.querySelector('#nsName').value = ''; toast(`«${name}» нэмэгдлээ — үнэлгээг нь засна уу`); }
        } else if (act === 'pin') {
          const v = root.querySelector('#newPin').value.trim();
          if (!/^\d{4,8}$/.test(v)) { toast('PIN нь 4–8 оронтой тоо байна', 'bad'); return; }
          const hash = await hashPin(v);
          if (await editConfig(c => { c.pinHash = hash; })) { root.querySelector('#newPin').value = ''; toast('PIN солигдлоо'); }
        }
      });
      draw();
    },
    refresh() { if (!root.contains(document.activeElement) || document.activeElement.tagName !== 'INPUT') draw(); }
  };
}

/* ================================ ТҮҮХ ================================ */
function auditView() {
  let root, started = false;
  const when = a => { const d = a.at?.toDate ? a.at.toDate() : new Date(a.at); return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function draw() {
    const list = [...state.audit];
    root.querySelector('#aBody').innerHTML = list.length ? list.map(a => `<tr><td style="white-space:nowrap">${when(a)}</td><td>${esc(a.who || '')}</td><td style="white-space:normal;min-width:220px">${esc(a.text || '')}</td></tr>`).join('')
      : `<tr><td colspan="3" class="empty">Одоогоор түүх алга.</td></tr>`;
  }
  return {
    mount(r) {
      root = r;
      root.innerHTML = `<div class="page-head"><h1>Өөрчлөлтийн түүх</h1><p>Хэн, хэзээ, юуг өөрчилснийг харуулна (сүүлийн 300 бүртгэл).</p></div>
        <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Огноо</th><th>Хэн</th><th>Үйлдэл</th></tr></thead><tbody id="aBody"></tbody></table></div></div>`;
    },
    refresh() { if (!started) { started = true; store.watchAudit(); } draw(); }
  };
}

/* ================================== ROUTER ================================== */
initTheme();
const ITEMS = [
  { id: 'dash', label: 'Хяналт', short: 'Хяналт', icon: 'gauge' },
  { id: 'summary', label: 'Нэгтгэл · Excel', short: 'Нэгтгэл', icon: 'table' },
  { id: 'calendar', label: 'Календарь', short: 'Календарь', icon: 'calendar' },
  { id: 'workers', label: 'Ажилчид', short: 'Ажилчид', icon: 'users' },
  { id: 'audit', label: 'Түүх', short: 'Түүх', icon: 'file' },
  { id: 'settings', label: 'Тохиргоо', short: 'Тохиргоо', icon: 'settings' }
];
const factories = { dash: dashboardView, summary: summaryView, calendar: calendarView, workers: workersView, audit: auditView, settings: settingsView };
const views = {}, panes = {};
let shell = null, current = 'dash', seeded = false, adminOk = null, checking = false;

function go(id) {
  current = id;
  Object.entries(panes).forEach(([k, el]) => el.classList.toggle('hidden', k !== id));
  shell.setActive(id);
  if (!views[id]) { views[id] = factories[id](); views[id].mount(panes[id]); }
  views[id].refresh?.();
  window.scrollTo(0, 0);
}
function mountAdmin() {
  shell = mountShell({
    root: app, role: 'admin', roleLabel: 'Админ', items: ITEMS, onNav: go,
    extraFoot: `<div class="conn" style="word-break:break-all">${icon('user')}<span id="who"></span></div><button class="btn btn-secondary btn-sm" id="so" style="justify-content:flex-start">${icon('logout')} Гарах</button>`
  });
  ITEMS.forEach(i => { const d = document.createElement('div'); d.className = 'hidden'; d.dataset.pane = i.id; shell.main.appendChild(d); panes[i.id] = d; });
  document.getElementById('so').addEventListener('click', async () => { await store.signOutUser(); location.reload(); });
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-goto]'); if (!g) return;
    go('dash'); views.dash.select(g.dataset.goto);
  });
  go('dash');
}

function updateBanners() {
  if (!shell) return;
  const now = new Date();
  let h = '';
  if (store.isDemo) h += banner('info', 'info', '<b>DEMO горим.</b> Firebase холбогдоогүй тул туршилтын өгөгдөлтэй ажиллаж байна.');
  if (state.error) h += banner('bad', 'alert', `<b>Өгөгдөл уншихад алдаа гарлаа.</b> <span>firebase-config.js болон Firestore rules-ээ шалгана уу. (${esc(state.error.code || state.error.message || '')})</span>`);
  else if (!store.isDemo && state.ready && !state.online) h += banner('warn', 'alert', '<b>Холболт тасарсан.</b> <span>Өөрчлөлт хадгалах үйлдлүүд түр хаагдсан.</span>');
  const miss = state.ready ? missingDays(now) : [];
  const today = todayStr(now);
  const past = miss.filter(d => d !== today);
  if (past.length) h += banner('warn', 'alert', `<b>Шивэгдээгүй өдөр: ${past.length}.</b> <span>${past.slice(-8).map(d => `<button class="btn btn-secondary btn-sm" data-goto="${d}">${shortDate(d)}</button>`).join(' ')}</span>`);
  const pr = state.requests.filter(r => r.status === 'pending');
  if (pr.length) h += banner('warn', 'info', `<b>Засах хүсэлт: ${pr.length}.</b> <span>Нягтлан баталгаажсан цалин засахыг хүссэн. <button class="btn btn-secondary btn-sm" data-goto="${pr[0].date}">Харах</button></span>`);
  shell.setBanners(h);
  shell.setBadge('dash', miss.length + pr.length);
  shell.updateStatus();
  const who = document.getElementById('who'); if (who) who.textContent = state.user?.email || '';
}

let raf = 0;
store.onChange(() => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(async () => {
    if (!state.authReady) { app.innerHTML = '<div class="login-wrap"><div class="muted">Ачаалж байна…</div></div>'; return; }
    if (!state.user) { if (shell || !document.getElementById('lf')) { shell = null; loginScreen(app, { title: 'Админ нэвтрэх', sub: 'Цалингийн системийн удирдлага', signIn: store.signIn }); } return; }
    if (adminOk === null) {
      if (!checking) {
        checking = true;
        store.checkAdmin().then(ok => { adminOk = ok; checking = false; store.poke(); });
      }
      app.innerHTML = '<div class="login-wrap"><div class="muted">Эрх шалгаж байна…</div></div>'; return;
    }
    if (adminOk === false) {
      app.innerHTML = `<div class="login-wrap"><div class="login"><div class="logo">ЦС</div><h1>Админы эрх алга</h1><p>Энэ хаяг (${esc(state.user.email)}) админ биш байна. Нягтлангийн сайт руу орно уу.</p>
        <a class="btn btn-primary mt" style="width:100%;text-decoration:none;justify-content:center" href="../">Нягтлангийн сайт</a>
        <button class="btn btn-secondary mt-s" style="width:100%;margin-top:8px" id="so2">Гарах</button></div></div>`;
      document.getElementById('so2').addEventListener('click', async () => { await store.signOutUser(); location.reload(); });
      return;
    }
    if (!shell) mountAdmin();
    // Эхний нэвтрэлт: тохиргооны документ байхгүй бол стандарт утгаар үүсгэнэ
    if (state.ready && !state.configExists && !store.isDemo && !seeded) { seeded = true; try { await store.saveConfig(structuredClone(state.config)); toast('Анхны тохиргоо үүслээ'); } catch (e) { console.error(e); } }
    updateBanners(); views[current]?.refresh?.();
  });
});
setInterval(updateBanners, 60000);
store.init();
