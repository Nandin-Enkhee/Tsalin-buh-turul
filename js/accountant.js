// Нягтлангийн сайт (нэвтрэлтгүй). Цалин бодох, ирц, суутгал, ажилчид.
import * as store from './store.js';
import {
  calcDay, dayStatus, fmt, todayStr, monthOf, shiftMonth, monthLabel, posIndex, DEBT_TYPES, shortDate
} from './core.js';
import {
  esc, icon, toast, modal, confirmBox, initTheme, mountShell, banner, needOnline, loginScreen,
  monthRibbon, ribbonLegend, scrollRibbonToToday, missingDays
} from './ui.js';
import { summaryView, payslipView, ratesReadView } from './views-shared.js';

const { state } = store;
const spName = id => state.config.species.find(s => s.id === id)?.name || id;
const teamOf = w => w.team || state.config.species[0].id;
const byName = (a, b) => a.name.localeCompare(b.name, 'mn');

/* ================================ ӨНӨӨДӨР ================================ */
function entryView() {
  const S = {
    date: todayStr(), ym: monthOf(todayStr()), sp: null, head: '', loaded: false,
    checked: new Set(), dayPos: {}, extra: new Set(), shiftOn: false, shifts: [{ head: '', wids: [] }], calc: null
  };
  let root;
  const cfg = () => state.config;
  const teamWorkers = () => state.workers.filter(w => w.active && teamOf(w) === S.sp);
  const extraWorkers = () => state.workers.filter(w => w.active && S.extra.has(w.id) && teamOf(w) !== S.sp);
  const shown = () => [...teamWorkers(), ...extraWorkers()];
  const dpOf = w => (S.dayPos[w.id] && cfg().positions.includes(S.dayPos[w.id]) ? S.dayPos[w.id] : w.pos);
  const existing = () => state.days.find(d => d.id === store.dayId(S.date, S.sp));
  const reqOf = () => state.requests.find(r => r.id === store.dayId(S.date, S.sp));
  const approved = () => reqOf()?.status === 'approved';
  const closed = () => (cfg().closedMonths || []).includes(monthOf(S.date));

  function load() {
    if (!cfg().species.some(s => s.id === S.sp)) S.sp = cfg().species[0].id;
    S.calc = null;
    const rec = existing();
    const alive = new Set(state.workers.filter(w => w.active).map(w => w.id));
    if (rec) {
      S.head = rec.head; S.checked = new Set((rec.rows || []).map(r => r.wid).filter(id => alive.has(id)));
      S.dayPos = Object.fromEntries((rec.rows || []).map(r => [r.wid, r.dayPos]));
      S.extra = new Set((rec.rows || []).filter(r => r.borrowed).map(r => r.wid));
      S.shifts = rec.shifts?.length ? rec.shifts.map(s => ({ head: s.head, wids: [...s.wids] })) : [{ head: '', wids: [] }];
      S.shiftOn = !!rec.shifts?.length;
    } else {
      const la = state.lastAtt[S.sp];
      S.head = ''; S.shiftOn = false; S.shifts = [{ head: '', wids: [] }];
      if (la) {
        S.checked = new Set((la.checked || []).filter(id => alive.has(id)));
        S.dayPos = { ...(la.dayPos || {}) };
        S.extra = new Set((la.extra || []).filter(id => alive.has(id)));
      } else {
        S.checked = new Set(teamWorkers().map(w => w.id)); S.dayPos = {}; S.extra = new Set();
      }
    }
  }
  function members() {
    const pi = posIndex(cfg());
    return shown().filter(w => S.checked.has(w.id))
      .map(w => ({ wid: w.id, name: w.name, basePos: w.pos, dayPos: dpOf(w), fixedSalary: w.fixedSalary, borrowed: S.extra.has(w.id) }))
      .sort((a, b) => pi(a.dayPos) - pi(b.dayPos) || a.name.localeCompare(b.name, 'mn'));
  }

  /* ---------- зурах ---------- */
  function drawRibbon() {
    root.querySelector('#rbMonth').textContent = monthLabel(S.ym);
    root.querySelector('#rbBox').innerHTML = monthRibbon({ ym: S.ym, selected: S.date });
    scrollRibbonToToday(root.querySelector('#rbBox'));
  }
  function drawSeg() {
    root.querySelector('#spSeg').innerHTML = cfg().species.map(s => `<button data-sp="${esc(s.id)}" class="${s.id === S.sp ? 'on' : ''}">${esc(s.name)}</button>`).join('');
  }
  function drawNote() {
    const rec = existing(), box = root.querySelector('#note');
    const status = dayStatus(S.date, state);
    let h = '';
    if (rec) {
      const tot = (rec.rows || []).reduce((s, r) => s + r.amt, 0);
      const rq = reqOf();
      const head = `<b>${esc(spName(S.sp))}</b>-ийн ${S.date} өдрийн цалин баталгаажсан (${fmt(tot)}₮).`;
      if (rq?.status === 'pending') h += banner('warn', 'info', `${head} <b>Засах хүсэлт админы зөвшөөрлийг хүлээж байна.</b><div class="faint" style="font-size:13px">Шалтгаан: ${esc(rq.reason || '')}</div>`);
      else if (rq?.status === 'approved') h += banner('info', 'check', `${head} <b>Админ засахыг зөвшөөрсөн.</b> Ирц, мал, дүнгээ засаад дахин бодож баталгаажуулна уу (нэг удаагийн эрх).
        <div class="mt-s"><button class="btn btn-danger btn-sm" data-act="delday">${icon('trash')} Энэ өдрийн бүртгэлийг устгах</button></div>`);
      else h += banner('info', 'check', `${head} Засахын тулд админы зөвшөөрөл хэрэгтэй.
        ${rq?.status === 'rejected' ? '<div class="faint" style="font-size:13px">Өмнөх хүсэлтийг админ татгалзсан.</div>' : ''}
        <div class="mt-s"><button class="btn btn-secondary btn-sm" data-act="reqedit">${icon('edit')} Засах хүсэлт илгээх</button></div>`);
    }
    if (closed()) h += banner('warn', 'info', `<b>${esc(monthLabel(monthOf(S.date)))} хаагдсан.</b> Энэ сарын цалинг админ нээхээс өмнө өөрчлөх боломжгүй.`);
    if (status === 'off' && !rec) h += banner('warn', 'info', 'Энэ өдөр «ажиллаагүй өдөр» гэж тэмдэглэгдсэн. Цалин баталгаажуулбал ажилласан өдөр болно.');
    box.innerHTML = h;
  }
  function drawAtt() {
    const pi = posIndex(cfg());
    const groups = {};
    shown().forEach(w => { (groups[w.pos] ||= []).push(w); });
    const order = Object.keys(groups).sort((a, b) => pi(a) - pi(b));
    const posOpts = sel => cfg().positions.map(p => `<option ${p === sel ? 'selected' : ''}>${esc(p)}</option>`).join('');
    let h = '';
    if (!order.length) h += `<div class="banner info">${icon('info')}<div>Энэ багт ажилтан бүртгэгдээгүй байна. «Ажилчид» цэсэнд нэмнэ үү, эсвэл өөр багаас сонгоно уу.</div></div>`;
    order.forEach(pos => {
      const list = groups[pos].sort(byName);
      const on = list.filter(w => S.checked.has(w.id)).length;
      h += `<div class="grp"><div class="grp-h"><b>${esc(pos)}</b><span class="c">${on}/${list.length} сонгосон</span>
        <button class="btn btn-secondary btn-sm" data-allpos="${esc(pos)}">${on === list.length ? 'Бүгдийг болиулах' : 'Бүгдийг сонгох'}</button></div><div class="wks">`;
      list.forEach(w => {
        const b = S.extra.has(w.id);
        h += `<div class="wk ${S.checked.has(w.id) ? 'on' : ''}">
          <input type="checkbox" id="c_${esc(w.id)}" data-wid="${esc(w.id)}" ${S.checked.has(w.id) ? 'checked' : ''}>
          <label class="nm" for="c_${esc(w.id)}">${esc(w.name)}${b ? ` <span class="chip info">${esc(spName(teamOf(w)))}</span>` : ''}</label>
          <select class="inp sm" data-dp="${esc(w.id)}" aria-label="${esc(w.name)} — өнөөдрийн ажил" title="Өнөөдрийн ажил">${posOpts(dpOf(w))}</select>
          ${b ? `<button class="btn btn-ghost btn-sm" data-unextra="${esc(w.id)}" title="Жагсаалтаас хасах" aria-label="Жагсаалтаас хасах">×</button>` : ''}</div>`;
      });
      h += `</div></div>`;
    });
    root.querySelector('#attBox').innerHTML = h;
    drawCount(); drawShift();
  }
  function drawCount() {
    const cnt = {};
    members().forEach(m => { cnt[m.dayPos] = (cnt[m.dayPos] || 0) + 1; });
    const pi = posIndex(cfg());
    const parts = Object.keys(cnt).sort((a, b) => pi(a) - pi(b)).map(p => `<span class="cnt">${esc(p)}–<b>${cnt[p]}</b></span>`);
    const total = members().length;
    root.querySelector('#cntBar').innerHTML = `<span class="lbl">Сонгосон</span>${parts.join('') || '<span class="cnt zero">Ажилтан сонгоогүй</span>'}<span class="cnt total">Нийт–${total}</span>`;
  }
  function drawShift() {
    const sPos = cfg().shiftPosition;
    const pool = members().filter(m => m.dayPos === sPos);
    let h = `<label class="row" style="cursor:pointer"><input type="checkbox" data-shifttoggle ${S.shiftOn ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--primary)">
      <b>Ээлжээр бодох</b><span class="muted">— «${esc(sPos)}» ажилчид ээлж тус бүрт өөр тооны мал хүлээн авсан үед</span></label>`;
    if (S.shiftOn) {
      S.shifts.forEach((s, i) => {
        h += `<div class="shift"><div class="row"><b>${i + 1}-р ээлж</b>
          <div style="width:150px"><input class="inp sm" type="number" min="0" inputmode="numeric" placeholder="Мал (толгой)" data-shead="${i}" value="${esc(s.head)}"></div>
          <span class="grow"></span>${S.shifts.length > 1 ? `<button class="btn btn-ghost btn-sm" data-sdel="${i}">${icon('trash')}</button>` : ''}</div>
          <div class="picks">${pool.length ? pool.map(m => `<label><input type="checkbox" data-spick="${i}" data-wid="${esc(m.wid)}" ${s.wids.includes(m.wid) ? 'checked' : ''}>${esc(m.name)}</label>`).join('') : `<span class="muted">Эхлээд дээрээс «${esc(sPos)}» ажилчдаа сонгоно уу.</span>`}</div></div>`;
      });
      h += `<div class="mt-s"><button class="btn btn-secondary btn-sm" data-sadd>${icon('plus')} Ээлж нэмэх</button></div>`;
    }
    root.querySelector('#shiftBox').innerHTML = h;
  }
  function drawCalc() {
    const box = root.querySelector('#calcBox'), act = root.querySelector('#actBox');
    if (!S.calc) { box.innerHTML = ''; act.innerHTML = ''; return; }
    const rows = S.calc.rows;
    box.innerHTML = `<div class="tbl-wrap mt-s"><table class="tbl"><thead><tr><th class="hide-m">№</th><th>Ажилтан</th><th>Өнөөдрийн ажил</th><th class="num">Цалин (₮)</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td class="faint hide-m">${i + 1}</td><td>${esc(r.name)}${r.borrowed ? ` <span class="chip info">өөр баг</span>` : ''}</td>
        <td>${r.dayPos !== r.basePos ? `<span class="chip warn">${esc(r.basePos)} → ${esc(r.dayPos)}</span>` : `<span class="chip">${esc(r.dayPos)}</span>`}</td>
        <td class="num"><input class="inp sm right" style="width:112px" type="number" min="0" inputmode="numeric" data-amt="${i}" value="${r.amt}"></td></tr>`).join('')}
      </tbody></table></div><p class="hint">Дүн бүрийг шаардлагатай бол гараар засаж болно.</p>`;
    const ex = !!existing();
    act.innerHTML = `<div class="actionbar"><div><div class="tot">${rows.length} ажилтан · ${esc(spName(S.sp))} · ${S.date}</div><div class="amt" id="totAmt">${fmt(rows.reduce((s, r) => s + r.amt, 0))} ₮</div></div>
      <span class="grow"></span><button class="btn btn-primary" data-act="confirm" ${ex && !approved() ? 'disabled title="Админы зөвшөөрөл хэрэгтэй"' : ''}>${icon('check')} ${ex ? (approved() ? 'Дарж бичиж баталгаажуулах' : 'Админы зөвшөөрөл хэрэгтэй') : 'Баталгаажуулах'}</button></div>`;
  }
  const drawAll = () => { drawRibbon(); drawSeg(); drawNote(); drawAtt(); drawCalc(); };
  const stale = () => { if (S.calc) { S.calc = null; drawCalc(); toast('Ирц өөрчлөгдсөн тул тооцоог дахин бодно уу'); } };

  /* ---------- үйлдлүүд ---------- */
  function doCalc() {
    const head = +S.head;
    if (!(head > 0)) { toast('Тоо толгойг оруулна уу', 'bad'); root.querySelector('#head').focus(); return; }
    const ms = members();
    if (!ms.length) { toast('Ажилласан ажилтнаа сонгоно уу', 'bad'); return; }
    const rates = cfg().rates[S.sp];
    if (!rates) { toast(`«${spName(S.sp)}»-ийн үнэлгээ тохируулагдаагүй байна. Админд хэлнэ үү.`, 'bad'); return; }
    let shifts = [];
    if (S.shiftOn) {
      const sPos = cfg().shiftPosition;
      const pool = ms.filter(m => m.dayPos === sPos).map(m => m.wid);
      shifts = S.shifts.map(s => ({ head: +s.head, wids: s.wids.filter(id => pool.includes(id)) }));
      if (shifts.some(s => !(s.head > 0) || !s.wids.length)) { toast('Ээлж бүрт мал, ажилтан оруулна уу', 'bad'); return; }
      const missing = pool.filter(id => !shifts.some(s => s.wids.includes(id)));
      if (missing.length) { toast(`Ээлжид хуваарилаагүй: ${ms.filter(m => missing.includes(m.wid)).map(m => m.name).join(', ')}`, 'bad'); return; }
    }
    S.calc = { rows: calcDay({ head, members: ms, rates, shifts, shiftPos: cfg().shiftPosition }), shifts };
    drawCalc();
    root.querySelector('#calcBox').scrollIntoView({ block: 'nearest' });
  }
  async function confirmDay() {
    if (!S.calc || !needOnline()) return;
    if (closed()) { toast('Энэ сар хаагдсан байна. Админ сарыг нээсний дараа засна.', 'bad'); return; }
    if (existing() && !approved()) { toast('Баталгаажсан өдрийг засахад админы зөвшөөрөл хэрэгтэй', 'bad'); return; }
    const rows = S.calc.rows.map(r => ({ wid: r.wid, name: r.name, basePos: r.basePos, dayPos: r.dayPos, amt: Math.round(+r.amt || 0), ...(r.borrowed ? { borrowed: true } : {}) }));
    const rec = {
      date: S.date, speciesId: S.sp, speciesName: spName(S.sp), head: +S.head, rows,
      shifts: S.shiftOn ? S.calc.shifts : [], total: rows.reduce((s, r) => s + r.amt, 0)
    };
    try {
      await store.saveDay(rec);
      if (approved()) await store.useEdit(store.dayId(rec.date, rec.speciesId));
      await store.saveLastAtt(S.sp, { checked: [...S.checked], dayPos: S.dayPos, extra: [...S.extra] });
      toast('Цалин баталгаажлаа ✓'); S.calc = null; drawAll();
    } catch (e) { console.error(e); toast('Хадгалж чадсангүй: ' + (e.code || e.message), 'bad'); }
  }
  async function deleteDay() {
    const rec = existing(); if (!rec || !needOnline()) return;
    if (closed()) { toast('Энэ сар хаагдсан байна.', 'bad'); return; }
    if (!approved()) { toast('Устгахад админы зөвшөөрөл хэрэгтэй', 'bad'); return; }
    if (!(await confirmBox('Бүртгэл устгах', `${S.date} · ${esc(spName(S.sp))}-ийн бүх цалин устна. Үргэлжлүүлэх үү?`, 'Устгах', true))) return;
    try { await store.deleteDay(rec.id); await store.useEdit(rec.id); toast('Устгагдлаа'); load(); drawAll(); }
    catch (e) { console.error(e); toast('Устгаж чадсангүй: ' + (e.code || e.message), 'bad'); }
  }
  async function requestEdit() {
    const rec = existing(); if (!rec || !needOnline()) return;
    const reason = await modal({
      title: 'Засах хүсэлт илгээх',
      body: `<p class="muted">${esc(S.date)} · ${esc(spName(S.sp))}-ийн баталгаажсан цалинг засах/устгах зөвшөөрлийг админаас хүснэ. Зөвшөөрсний дараа нэг удаа засах боломжтой.</p>
        <label class="f" for="rsn">Юуг, яагаад засах вэ?</label><textarea class="inp" id="rsn" rows="3" maxlength="300" placeholder="ж: 3 хүний ирц буруу сонгосон"></textarea>`,
      actions: [{ label: 'Болих', value: null }, { label: 'Хүсэлт илгээх', kind: 'primary', value: back => back.querySelector('#rsn').value.trim() || '' }]
    });
    if (reason === null) return;
    if (!reason) { toast('Шалтгаанаа бичнэ үү', 'bad'); return; }
    try { await store.requestEdit(rec.id, { date: rec.date, speciesId: rec.speciesId, speciesName: spName(rec.speciesId), reason }); toast('Хүсэлт админд илгээгдлээ'); }
    catch (e) { console.error(e); toast('Илгээж чадсангүй: ' + (e.code || e.message), 'bad'); }
  }
  async function borrow() {
    const others = state.workers.filter(w => w.active && teamOf(w) !== S.sp && !S.extra.has(w.id)).sort(byName);
    if (!others.length) { toast('Өөр багт идэвхтэй ажилтан алга'); return; }
    const byTeam = {};
    others.forEach(w => { (byTeam[teamOf(w)] ||= []).push(w); });
    const body = Object.keys(byTeam).map(t => `<div class="pos-h" style="margin:10px 0 4px;font-weight:700;color:var(--muted)">${esc(spName(t))} баг</div><div class="pick-list">${byTeam[t].map(w => `<label><input type="checkbox" value="${esc(w.id)}"> ${esc(w.name)} <span class="chip">${esc(w.pos)}</span></label>`).join('')}</div>`).join('');
    const ids = await modal({
      title: 'Өөр багаас ажилтан нэмэх', body: `<p class="muted">Ажилтныг дахин бүртгэхгүйгээр өнөөдрийн жагсаалтад түр нэмнэ.</p>${body}`,
      actions: [{ label: 'Болих', value: null }, { label: 'Нэмэх', kind: 'primary', value: back => [...back.querySelectorAll('input:checked')].map(i => i.value) }]
    });
    if (!ids || !ids.length) return;
    ids.forEach(id => { S.extra.add(id); S.checked.add(id); });
    stale(); drawAtt();
  }

  return {
    title: 'Өнөөдөр',
    mount(r) {
      root = r;
      root.innerHTML = `
        <div class="page-head"><h1>Өдрийн цалин бодох</h1><p>Огноо, мал, ирцээ оруулаад цалинг бодож баталгаажуулна.</p></div>
        <div class="card"><div class="mhead"><h2 id="rbMonth"></h2>
          <button class="btn btn-secondary btn-sm" data-m="-1" aria-label="Өмнөх сар">${icon('left')}</button>
          <button class="btn btn-secondary btn-sm" data-m="0">Өнөөдөр</button>
          <button class="btn btn-secondary btn-sm" data-m="1" aria-label="Дараах сар">${icon('right')}</button></div>
          <div id="rbBox"></div>${ribbonLegend()}</div>
        <div class="card">
          <div class="step"><span class="n">1</span><div><h3>Огноо ба мал</h3></div></div>
          <div class="fgrid">
            <div><label class="f" for="date">Огноо</label><input class="inp" type="date" id="date" value="${S.date}"></div>
            <div><label class="f">Малын төрөл</label><div class="seg" id="spSeg"></div></div>
            <div><label class="f" for="head">Тоо толгой</label><input class="inp big" id="head" type="number" min="0" inputmode="numeric" placeholder="ж: 74"></div>
          </div>
          <div id="note" class="mt-s"></div>
          <div class="step"><span class="n">2</span><div><h3>Ирц ба өнөөдрийн ажил</h3><p>Ажилласан хүмүүсийг сонгоно. Хэн нэгэн өөр ажил хийсэн бол хажууд нь ажлыг солино.</p></div></div>
          <div class="countbar" id="cntBar"></div>
          <div id="attBox"></div>
          <div class="mt-s"><button class="btn btn-secondary btn-sm" data-act="borrow">${icon('swap')} Өөр багаас ажилтан нэмэх</button></div>
          <div class="step"><span class="n">3</span><div><h3>Ээлж <span class="muted" style="font-weight:500">(заавал биш)</span></h3></div></div>
          <div id="shiftBox"></div>
          <div class="step"><span class="n">4</span><div><h3>Цалин бодох</h3></div></div>
          <button class="btn btn-primary" data-act="calc">Цалин бодох</button>
          <div id="calcBox"></div><div id="actBox"></div>
        </div>`;

      root.addEventListener('click', e => {
        const t = e.target;
        const m = t.closest('[data-m]');
        if (m) { S.ym = m.dataset.m === '0' ? monthOf(todayStr()) : shiftMonth(S.ym, +m.dataset.m); drawRibbon(); return; }
        const day = t.closest('[data-date]');
        if (day) { S.date = day.dataset.date; S.ym = monthOf(S.date); root.querySelector('#date').value = S.date; load(); root.querySelector('#head').value = S.head; drawAll(); return; }
        const sp = t.closest('[data-sp]');
        if (sp) { S.sp = sp.dataset.sp; load(); root.querySelector('#head').value = S.head; drawAll(); return; }
        const ap = t.closest('[data-allpos]');
        if (ap) {
          const list = shown().filter(w => w.pos === ap.dataset.allpos);
          const allOn = list.every(w => S.checked.has(w.id));
          list.forEach(w => allOn ? S.checked.delete(w.id) : S.checked.add(w.id));
          stale(); drawAtt(); return;
        }
        const ux = t.closest('[data-unextra]');
        if (ux) { S.extra.delete(ux.dataset.unextra); S.checked.delete(ux.dataset.unextra); stale(); drawAtt(); return; }
        if (t.closest('[data-sadd]')) { S.shifts.push({ head: '', wids: [] }); drawShift(); return; }
        const sd = t.closest('[data-sdel]'); if (sd) { S.shifts.splice(+sd.dataset.sdel, 1); drawShift(); return; }
        const act = t.closest('[data-act]')?.dataset.act;
        if (act === 'calc') doCalc();
        else if (act === 'confirm') confirmDay();
        else if (act === 'delday') deleteDay();
        else if (act === 'reqedit') requestEdit();
        else if (act === 'borrow') borrow();
      });
      root.addEventListener('change', e => {
        const t = e.target;
        if (t.id === 'date') { if (!t.value) return; S.date = t.value; S.ym = monthOf(S.date); load(); root.querySelector('#head').value = S.head; drawAll(); return; }
        if (t.dataset.wid && !t.dataset.spick) {
          t.checked ? S.checked.add(t.dataset.wid) : S.checked.delete(t.dataset.wid);
          t.closest('.wk').classList.toggle('on', t.checked); stale(); drawAtt(); return;
        }
        if (t.dataset.dp) { S.dayPos[t.dataset.dp] = t.value; stale(); drawAtt(); return; }
        if (t.hasAttribute('data-shifttoggle')) { S.shiftOn = t.checked; drawShift(); return; }
        if (t.dataset.shead !== undefined) { S.shifts[+t.dataset.shead].head = t.value; return; }
        if (t.dataset.spick !== undefined) {
          const s = S.shifts[+t.dataset.spick], id = t.dataset.wid;
          s.wids = t.checked ? [...new Set([...s.wids, id])] : s.wids.filter(x => x !== id); return;
        }
      });
      root.addEventListener('input', e => {
        const t = e.target;
        if (t.id === 'head') { S.head = t.value; if (S.calc) { S.calc = null; drawCalc(); } }
        if (t.dataset.amt !== undefined) {
          S.calc.rows[+t.dataset.amt].amt = +t.value || 0;
          root.querySelector('#totAmt').textContent = fmt(S.calc.rows.reduce((s, r) => s + r.amt, 0)) + ' ₮';
        }
      });
    },
    refresh() {
      if (!state.ready) return;
      if (!S.loaded) { S.sp = cfg().species[0].id; load(); S.loaded = true; root.querySelector('#head').value = S.head; drawAll(); return; }
      drawRibbon(); drawSeg(); drawNote();
      // ирцийн жагсаалтыг (ажилтан нэмэгдсэн/өөрчлөгдсөн үед) шинэчилнэ; оруулсан утга алдагдахгүй
      drawAtt();
    },
    goto(date) { S.date = date; S.ym = monthOf(date); root.querySelector('#date').value = date; load(); root.querySelector('#head').value = S.head; drawAll(); }
  };
}

/* ================================ СУУТГАЛ ================================ */
function debtsView() {
  const dst = d => state.requests.find(r => r.id === 'debt_' + d.id)?.status;
  const F = { status: 'all', wid: 'all' };
  let root;
  function drawTable() {
    let list = [...state.debts].sort((a, b) => b.date.localeCompare(a.date));
    if (F.status !== 'all') list = list.filter(d => (F.status === 'paid') === !!d.paid);
    if (F.wid !== 'all') list = list.filter(d => d.wid === F.wid);
    const open = state.debts.filter(d => !d.paid).reduce((s, d) => s + d.amt, 0);
    root.querySelector('#dSum').textContent = `Төлөгдөөгүй нийт: ${fmt(open)} ₮`;
    root.querySelector('#dBody').innerHTML = list.length ? list.map(d => `<tr>
      <td>${d.date}</td><td>${esc(d.name)}</td><td>${esc(d.type)}${d.note ? `<div class="faint" style="font-size:12px">${esc(d.note)}</div>` : ''}</td>
      <td class="num">${fmt(d.amt)}</td><td><span class="chip ${d.paid ? 'ok' : 'warn'}">${d.paid ? 'Төлсөн' : 'Төлөөгүй'}</span></td>
      <td class="num"><button class="btn btn-secondary btn-sm" data-pay="${esc(d.id)}">${d.paid ? 'Буцаах' : 'Төлсөн болгох'}</button>
        <button class="btn btn-ghost btn-sm" data-del="${esc(d.id)}" aria-label="Устгах" title="${dst(d) === 'approved' ? 'Админ зөвшөөрсөн — устгах' : dst(d) === 'pending' ? 'Хүсэлт хүлээгдэж байна' : 'Устгах хүсэлт илгээх'}">${icon('trash')}${dst(d) === 'approved' ? ' <small>Зөвшөөрсөн</small>' : dst(d) === 'pending' ? ' <small>Хүлээгдэж буй</small>' : ''}</button></td></tr>`).join('')
      : `<tr><td colspan="6" class="empty">Суутгал бүртгэгдээгүй байна.</td></tr>`;
  }
  return {
    title: 'Суутгал',
    mount(r) {
      root = r;
      root.innerHTML = `
        <div class="page-head"><h1>Суутгал</h1><p>Хувцас, дэлгүүрийн тооцоо, урьдчилгаа. Нэгтгэлийн «Нийт олгох» дүнгээс автоматаар хасагдана.</p></div>
        <div class="card"><div class="card-head"><div><h2>Шинэ суутгал бүртгэх</h2></div></div>
          <div class="fgrid">
            <div><label class="f">Ажилтан</label><select class="inp" id="dW"></select></div>
            <div><label class="f">Төрөл</label><select class="inp" id="dT">${DEBT_TYPES.map(t => `<option>${esc(t)}</option>`).join('')}</select></div>
            <div><label class="f">Дүн (₮)</label><input class="inp right" id="dA" type="number" min="0" inputmode="numeric" placeholder="50000"></div>
            <div><label class="f">Огноо</label><input class="inp" id="dD" type="date" value="${todayStr()}"></div>
            <div><label class="f">Тэмдэглэл</label><input class="inp" id="dN" type="text" placeholder="Заавал биш"></div>
          </div><div class="mt"><button class="btn btn-primary" data-act="add">${icon('plus')} Бүртгэх</button></div></div>
        <div class="card"><div class="card-head"><div><h2>Бүртгэлтэй суутгалууд</h2><p class="sub" id="dSum"></p></div>
          <div class="row"><select class="inp sm" data-f="status"><option value="all">Бүгд</option><option value="open">Төлөөгүй</option><option value="paid">Төлсөн</option></select>
          <select class="inp sm" data-f="wid" id="dF"></select></div></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Огноо</th><th>Ажилтан</th><th>Төрөл</th><th class="num">Дүн (₮)</th><th>Төлөв</th><th></th></tr></thead><tbody id="dBody"></tbody></table></div>
          <p class="hint">«Төлсөн» гэж тэмдэглэсэн суутгал цалингаас хасагдахаа болино.</p></div>`;
      root.addEventListener('change', e => { const f = e.target.dataset.f; if (f) { F[f] = e.target.value; drawTable(); } });
      root.addEventListener('click', async e => {
        const t = e.target;
        if (t.closest('[data-act=add]')) {
          if (!needOnline()) return;
          const wid = root.querySelector('#dW').value, amt = +root.querySelector('#dA').value;
          const w = state.workers.find(x => x.id === wid);
          if (!w) { toast('Ажилтан сонгоно уу', 'bad'); return; }
          if (!(amt > 0)) { toast('Дүнг оруулна уу', 'bad'); return; }
          await store.addDebt({ wid, name: w.name, type: root.querySelector('#dT').value, amt: Math.round(amt), date: root.querySelector('#dD').value || todayStr(), note: root.querySelector('#dN').value.trim() });
          root.querySelector('#dA').value = ''; root.querySelector('#dN').value = ''; toast('Суутгал бүртгэгдлээ');
          return;
        }
        const p = t.closest('[data-pay]');
        if (p && needOnline()) { const d = state.debts.find(x => x.id === p.dataset.pay); await store.updateDebt(d.id, { paid: !d.paid }); return; }
        const del = t.closest('[data-del]');
        if (del && needOnline()) {
          const d = state.debts.find(x => x.id === del.dataset.del); if (!d) return;
          const rid = 'debt_' + d.id, rq = state.requests.find(r => r.id === rid);
          if (rq?.status === 'approved') {
            if (!(await confirmBox('Суутгал устгах', `${esc(d.name)} · ${fmt(d.amt)}₮-ийн суутгал устна.`, 'Устгах', true))) return;
            try { await store.deleteDebt(d.id); await store.useEdit(rid); toast('Устгагдлаа'); } catch (er) { console.error(er); toast('Устгаж чадсангүй: ' + (er.code || er.message), 'bad'); }
            return;
          }
          if (rq?.status === 'pending') { toast('Устгах хүсэлт админы зөвшөөрлийг хүлээж байна'); return; }
          const reason = await modal({
            title: 'Суутгал устгах хүсэлт',
            body: `<p class="muted">${esc(d.name)} · ${esc(d.type)} · ${fmt(d.amt)}₮. Устгахын тулд админы зөвшөөрөл хэрэгтэй.</p><label class="f" for="rsn">Яагаад устгах вэ?</label><textarea class="inp" id="rsn" rows="3" maxlength="300"></textarea>`,
            actions: [{ label: 'Болих', value: null }, { label: 'Хүсэлт илгээх', kind: 'primary', value: back => back.querySelector('#rsn').value.trim() || '' }]
          });
          if (reason === null) return;
          if (!reason) { toast('Шалтгаанаа бичнэ үү', 'bad'); return; }
          try { await store.requestEdit(rid, { kind: 'debt', date: d.date, label: `Суутгал: ${d.name}`, speciesName: `Суутгал · ${fmt(d.amt)}₮`, reason }); toast('Хүсэлт админд илгээгдлээ'); }
          catch (er) { console.error(er); toast('Илгээж чадсангүй: ' + (er.code || er.message), 'bad'); }
        }
      });
      this.refresh();
    },
    refresh() {
      root.querySelector('#dW').innerHTML = `<option value="">— Сонгох —</option>` + state.workers.filter(w => w.active).sort(byName).map(w => `<option value="${esc(w.id)}">${esc(w.name)} · ${esc(w.pos)}</option>`).join('');
      const ids = new Map(state.debts.map(d => [d.wid, d.name]));
      const f = root.querySelector('#dF');
      f.innerHTML = `<option value="all">Бүх ажилтан</option>` + [...ids].sort((a, b) => a[1].localeCompare(b[1], 'mn')).map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join('');
      f.value = F.wid;
      drawTable();
    }
  };
}

/* ================================ АЖИЛЧИД ================================ */
function workersView() {
  const F = { team: 'all' };
  let root;
  const dup = (name, exceptId) => state.workers.some(w => w.id !== exceptId && w.name.trim().toLowerCase() === name.trim().toLowerCase());
  const teamOpts = sel => state.config.species.map(s => `<option value="${esc(s.id)}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
  const posOpts = sel => state.config.positions.map(p => `<option ${p === sel ? 'selected' : ''}>${esc(p)}</option>`).join('');

  function drawTable() {
    const pi = posIndex(state.config);
    let list = state.workers.filter(w => F.team === 'all' || teamOf(w) === F.team);
    list = list.sort((a, b) => Number(b.active) - Number(a.active) || pi(a.pos) - pi(b.pos) || byName(a, b));
    root.querySelector('#wSeg').innerHTML = [['all', 'Бүгд'], ...state.config.species.map(s => [s.id, s.name])]
      .map(([id, n]) => `<button data-team="${esc(id)}" class="${F.team === id ? 'on' : ''}">${esc(n)}</button>`).join('');
    root.querySelector('#wBody').innerHTML = list.length ? list.map(w => `<tr style="${w.active ? '' : 'opacity:.55'}">
      <td><b>${esc(w.name)}</b></td><td><span class="chip info">${esc(spName(teamOf(w)))}</span></td><td><span class="chip primary">${esc(w.pos)}</span></td>
      <td>${esc(w.phone || '')}</td><td>${esc(w.bank || '')}</td>
      <td><button class="chip ${w.active ? 'ok' : 'bad'}" style="border:0;cursor:pointer" data-toggle="${esc(w.id)}">${w.active ? 'Идэвхтэй' : 'Идэвхгүй'}</button></td>
      <td class="num"><button class="btn btn-secondary btn-sm" data-edit="${esc(w.id)}">Засах</button></td></tr>`).join('')
      : `<tr><td colspan="7" class="empty">Ажилтан бүртгэгдээгүй байна.</td></tr>`;
  }
  async function edit(id) {
    const w = state.workers.find(x => x.id === id); if (!w) return;
    const res = await modal({
      title: 'Ажилтны мэдээлэл засах',
      body: `<div class="fgrid" style="grid-template-columns:1fr 1fr">
        <div><label class="f">Нэр</label><input class="inp" id="eN" value="${esc(w.name)}"></div>
        <div><label class="f">Баг (мал)</label><select class="inp" id="eT">${teamOpts(teamOf(w))}</select></div>
        <div><label class="f">Үндсэн ажил</label><select class="inp" id="eP">${posOpts(w.pos)}</select></div>
        <div><label class="f">Утас</label><input class="inp" id="eH" value="${esc(w.phone || '')}"></div>
        <div style="grid-column:1/-1"><label class="f">Данс</label><input class="inp" id="eB" value="${esc(w.bank || '')}"></div></div>
        <div class="hint" id="eErr" style="color:var(--bad);min-height:18px"></div>`,
      actions: [{ label: 'Болих', value: null }, {
        label: 'Хадгалах', kind: 'primary', value: back => {
          const name = back.querySelector('#eN').value.trim();
          if (!name) { back.querySelector('#eErr').textContent = 'Нэр оруулна уу'; return undefined; }
          if (dup(name, id)) { back.querySelector('#eErr').textContent = 'Ийм нэртэй ажилтан бүртгэлтэй байна'; return undefined; }
          return { name, team: back.querySelector('#eT').value, pos: back.querySelector('#eP').value, phone: back.querySelector('#eH').value.trim(), bank: back.querySelector('#eB').value.trim() };
        }
      }]
    });
    if (res && needOnline()) { await store.updateWorker(id, res); toast('Хадгалагдлаа'); }
  }
  return {
    title: 'Ажилчид',
    mount(r) {
      root = r;
      root.innerHTML = `
        <div class="page-head"><h1>Ажилчид</h1><p>Шинэ ажилтан бүртгэх, мэдээллийг засах. Ажилтныг устгахгүй — «идэвхгүй» болгоно, өмнөх цалингийн түүх хэвээр үлдэнэ.</p></div>
        <div class="card"><div class="card-head"><div><h2>Шинэ ажилтан бүртгэх</h2></div></div>
          <div class="fgrid"><div><label class="f">Нэр</label><input class="inp" id="nN" placeholder="Овог нэр"></div>
            <div><label class="f">Баг (мал)</label><select class="inp" id="nT"></select></div>
            <div><label class="f">Үндсэн ажил</label><select class="inp" id="nP"></select></div>
            <div><label class="f">Утас</label><input class="inp" id="nH" inputmode="tel" placeholder="99112233"></div>
            <div><label class="f">Данс</label><input class="inp" id="nB" placeholder="Банк, дансны дугаар"></div></div>
          <div class="mt"><button class="btn btn-primary" data-act="add">${icon('plus')} Бүртгэх</button></div></div>
        <div class="card"><div class="card-head"><div><h2>Жагсаалт</h2></div><div class="seg" id="wSeg"></div></div>
          <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Нэр</th><th>Баг</th><th>Ажил</th><th>Утас</th><th>Данс</th><th>Төлөв</th><th></th></tr></thead><tbody id="wBody"></tbody></table></div></div>`;
      root.addEventListener('click', async e => {
        const t = e.target;
        const tm = t.closest('[data-team]'); if (tm) { F.team = tm.dataset.team; drawTable(); return; }
        const ed = t.closest('[data-edit]'); if (ed) { edit(ed.dataset.edit); return; }
        const tg = t.closest('[data-toggle]');
        if (tg && needOnline()) { const w = state.workers.find(x => x.id === tg.dataset.toggle); await store.updateWorker(w.id, { active: !w.active }); return; }
        if (t.closest('[data-act=add]')) {
          const name = root.querySelector('#nN').value.trim();
          if (!name) { toast('Нэр оруулна уу', 'bad'); return; }
          if (dup(name)) { toast(`«${name}» нэртэй ажилтан бүртгэлтэй байна`, 'bad'); return; }
          if (!needOnline()) return;
          await store.addWorker({ name, team: root.querySelector('#nT').value, pos: root.querySelector('#nP').value, phone: root.querySelector('#nH').value.trim(), bank: root.querySelector('#nB').value.trim(), active: true });
          ['#nN', '#nH', '#nB'].forEach(s => { root.querySelector(s).value = ''; }); toast('Ажилтан бүртгэгдлээ');
        }
      });
      this.refresh();
    },
    refresh() {
      const t = root.querySelector('#nT'), p = root.querySelector('#nP');
      const tv = t.value, pv = p.value;
      t.innerHTML = teamOpts(tv || state.config.species[0].id); p.innerHTML = posOpts(pv);
      drawTable();
    }
  };
}

/* ================================== ROUTER ================================== */
initTheme();
const ITEMS = [
  { id: 'entry', label: 'Өнөөдөр', short: 'Өнөөдөр', icon: 'edit' },
  { id: 'summary', label: 'Нэгтгэл · Excel', short: 'Нэгтгэл', icon: 'table' },
  { id: 'slip', label: 'Цалингийн хуудас', short: 'Хуудас', icon: 'file' },
  { id: 'debts', label: 'Суутгал', short: 'Суутгал', icon: 'wallet' },
  { id: 'workers', label: 'Ажилчид', short: 'Ажилчид', icon: 'users' },
  { id: 'rates', label: 'Үнэлгээ', short: 'Үнэлгээ', icon: 'tag' }
];
const factories = { entry: entryView, summary: summaryView, slip: payslipView, debts: debtsView, workers: workersView, rates: ratesReadView };
const views = {}, panes = {};
let current = 'entry';

const app = document.getElementById('app');
let shell = null;
function mountApp() {
  shell = mountShell({
    root: app, role: 'acc', roleLabel: 'Нягтлан', items: ITEMS, onNav: go,
    extraFoot: `<div class="conn" style="word-break:break-all">${icon('user')}<span>${esc(state.user?.email || '')}</span></div><button class="btn btn-secondary btn-sm" id="so" style="justify-content:flex-start">${icon('logout')} Гарах</button>`
  });
  ITEMS.forEach(i => { const d = document.createElement('div'); d.className = 'hidden'; d.dataset.pane = i.id; shell.main.appendChild(d); panes[i.id] = d; });
  document.getElementById('so').addEventListener('click', async () => { await store.signOutUser(); location.reload(); });
  go('entry');
}

function go(id) {
  current = id;
  Object.entries(panes).forEach(([k, el]) => el.classList.toggle('hidden', k !== id));
  shell.setActive(id);
  if (!views[id]) { views[id] = factories[id](); views[id].mount(panes[id]); }
  views[id].refresh?.();
  window.scrollTo(0, 0);
}

function updateBanners() {
  if (!shell) return;
  const now = new Date();
  let h = '';
  if (store.isDemo) h += banner('info', 'info', '<b>DEMO горим.</b> Firebase холбогдоогүй тул туршилтын өгөгдөлтэй, түр санах ойд ажиллаж байна. Холбохыг SETUP.md-ээс үз.');
  if (state.error) h += banner('bad', 'alert', `<b>Өгөгдөл уншихад алдаа гарлаа.</b> <span>Firebase тохиргоо (firebase-config.js) болон Firestore rules-ээ шалгана уу. (${esc(state.error.code || state.error.message || '')})</span>`);
  else if (!store.isDemo && state.ready && !state.online) h += banner('warn', 'alert', '<b>Холболт тасарсан.</b> <span>Хадгалах үйлдлүүд холболт сэргэтэл түр хаагдсан.</span>');
  if (!store.isDemo && state.ready && !state.configExists) h += banner('warn', 'info', '<b>Анхны тохиргоо хийгдээгүй.</b> <span>Админ нэвтэрч орвол үнэлгээний тохиргоо автоматаар үүснэ. Түр хугацаанд стандарт үнэлгээгээр ажиллаж байна.</span>');
  const miss = state.ready ? missingDays(now) : [];
  const today = todayStr(now);
  const past = miss.filter(d => d !== today);
  if (past.length) h += banner('warn', 'alert', `<b>Дутуу өдөр: ${past.length}.</b> <span>${past.slice(-8).map(d => `<button class="btn btn-secondary btn-sm" data-goto="${d}">${shortDate(d)}</button>`).join(' ')}</span>`);
  shell.setBanners(h);
  shell.setBadge('entry', miss.length);
  shell.updateStatus();
}
document.addEventListener('click', e => {
  const g = e.target.closest('[data-goto]'); if (!g) return;
  go('entry'); views.entry.goto(g.dataset.goto);
});

let raf = 0;
store.onChange(() => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (!state.authReady) { app.innerHTML = '<div class="login-wrap"><div class="muted">Ачаалж байна…</div></div>'; return; }
    if (!state.user) { if (shell || !document.getElementById('lf')) { shell = null; loginScreen(app, { title: 'Нягтлан нэвтрэх', sub: 'Цалингийн систем', signIn: store.signIn }); } return; }
    if (!shell) { mountApp(); }
    updateBanners(); views[current]?.refresh?.();
  });
});
store.init();
