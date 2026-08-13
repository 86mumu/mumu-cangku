/* ============ 专属记账模块（三标签：首页 / 日历 / 存钱） ============ */
(function(){
  const S=window.Store, I=window.Icon, AI=window.AI;
  let accTab='home';
  let calYM=S.today().slice(0,7);
  let calSel=S.today();
  let filter={type:'all',cat:'all',from:'',to:''};
  let selCat='';          // 宫格里当前选中的分类名
  let selType='expense';  // 宫格当前展示的是支出还是收入
  let lastPreset=null;    // 再记：保留上一笔预设
  let svView={name:'list',id:''}; // 存钱视图：list / plan
  let svTab='in';         // 存钱详情标签：in 已存入 / out 取出记录
  let addOpen=false;      // 记一笔是否处于整页模式
  let addReturn=null;     // 记一笔返回状态
  let editId='';          // 整页编辑模式当前账单 id
  const SAVE_MODES=[
    {key:'fixed',name:'定额存钱',   icon:'🎯', period:'day',   label:'每天存',  times:1,   base:'',   increment:false},
    {key:'free', name:'自由存钱',   icon:'🌿', period:'free',  label:'',        times:1,   base:0,    increment:false}
  ];
  const PERIOD_CN={day:'天',week:'周',month:'月',year:'年'};
  let svIcon='🐷';
  let svArchOpen=false; // 已归档计划展开状态
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  /* ---- 分类工具（支持两级：一级分组 + 二级叶子） ---- */
  function catsOf(type){return S.cats(type);}
  function leafCats(type){return catsOf(type).filter(c=>!c.isGroup);}
  function groupCats(type){return catsOf(type).filter(c=>c.isGroup);}
  function catNames(type){return leafCats(type).map(c=>c.name);}
  function allNames(){return catNames('expense').concat(catNames('income'));}
  function catIcon(key){
    const M=window.CAT_ICONS||{};
    return M[key]||M['其他']||'';
  }
  function iconOfName(name){
    const all=leafCats('expense').concat(leafCats('income'));
    const c=all.find(x=>x.name===name);
    return catIcon(c?(c.icon||c.name):name);
  }
  function catItem(c,sel){
    return `<div class="cat-item${c.name===sel?' on':''}" data-cat="${c.name}" onclick="Acc.pickCat(this)">
      <div class="cat-ico">${catIcon(c.icon||c.name)}</div>
      <div class="cat-name">${c.name}</div>
    </div>`;
  }
  function catGrid(type,sel){
    const groups=groupCats(type);
    const others=leafCats(type).filter(c=>!c.parent);
    let html='';
    groups.forEach(g=>{
      const kids=leafCats(type).filter(c=>c.parent===g.name);
      if(!kids.length)return;
      html+=`<div class="cat-group">
        <div class="cat-g-h">${g.icon}<span>${g.name}</span></div>
        <div class="cat-sub">${kids.map(c=>catItem(c,sel)).join('')}</div>
      </div>`;
    });
    if(others.length){
      html+=`<div class="cat-group">
        <div class="cat-g-h"><span>其他</span></div>
        <div class="cat-sub">${others.map(c=>catItem(c,sel)).join('')}</div>
      </div>`;
    }
    return '<div class="cat-groups">'+html+'</div>';
  }
  function pickCat(el){
    selCat=el.dataset.cat;
    const box=el.closest('#cat-box')||el.parentNode;
    box.querySelectorAll('.cat-item').forEach(x=>x.classList.remove('on'));
    el.classList.add('on');
  }
  function switchType(t){
    selType=t;
    const box=document.getElementById('cat-box');
    if(!box)return;
    selCat=catNames(t).includes(selCat)?selCat:'';
    box.innerHTML=catGrid(t,selCat);
  }

  /* ---- 渲染入口 ---- */
  function render(){
    const el=document.getElementById('page-account');
    if(addOpen){renderAddPage();return;}
    el.innerHTML=`<div class="page-head">
        <div class="date-line">${S.fmtCN(S.today())} ${S.weekCN(S.today())} · 花在喜欢的地方，就值得 💗</div>
        <div class="acc-head-row flex between center">
          <div class="title">我的账单</div>
          <div class="acc-actions">
            <button class="pill acc-act" onclick="Acc.searchBills()" title="搜索账单"><i class="ic">${Icon.i('search')}</i><span>搜索</span></button>
            <button class="pill acc-act" onclick="Acc.openImport()" title="导入账单"><i class="ic">${Icon.i('import')}</i><span>导入</span></button>
            <button class="pill acc-act" onclick="Acc.exportBills()" title="导出账单"><i class="ic">${Icon.i('export')}</i><span>导出</span></button>
            <button class="pill acc-act" onclick="Acc.openComposition()" title="账单"><i class="ic">${Icon.i('bills')}</i><span>账单</span></button>
          </div>
        </div>
      </div>
      <div class="subtabs account-tabs">
        <button class="subtab${accTab==='home'?' on':''}" onclick="Acc.setTab('home')">🏠 总览</button>
        <button class="subtab${accTab==='calendar'?' on':''}" onclick="Acc.setTab('calendar')">📅 视图</button>
        <button class="subtab${accTab==='savings'?' on':''}" onclick="Acc.setTab('savings')">🏦 存钱</button>
      </div>
      <div id="acc-content"></div>`;
    if(accTab==='home')renderHome();
    else if(accTab==='calendar')renderCalendar();
    else if(accTab==='all')renderAll();
    else renderSavings();
  }
  function setTab(t){accTab=t;if(t==='savings')svView={name:'list',id:''};render();}

  /* ---- 首页 ---- */
  function renderHome(){
    const t=S.today(); const ym=t.slice(0,7);
    const bills=S.S.billsMonth(ym);
    let inc=0,exp=0; bills.forEach(b=>{if(b.type==='expense')exp+=b.amount;else inc+=b.amount;});
    exp=budgetExpense(ym); // 预算口径：排除「不计入预算」及分类级排除
    const budget=S.get().budget.amount; const bal=inc-exp; const remain=budget-exp;
    const hid=S.get().settings.hideMoney;
    const hn=v=>hid?'•••':fmtMoney(v);
    const daysInMonth=new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();
    const avgDay=daysInMonth>0?exp/daysInMonth:0;
    const todayNum=S.parse(t).getDate();
    const restDays=Math.max(1, new Date(S.parse(ym+'-01').getFullYear(),S.parse(ym+'-01').getMonth()+1,0).getDate()-todayNum );
    const dailyRemain=remain>0?remain/restDays:0;

    const recent=recent7Bills();

    const content=document.getElementById('acc-content');
    const pct=budget?(exp/budget*100).toFixed(1):0;
    const ratio=budget>0?exp/budget:0;
    const ringCls=ratio>=1?'ring-bar-red':(ratio>=0.8?'ring-bar-orange':'ring-bar-green');
    content.innerHTML=`
      <div class="acc-hero acc-hero-pink">
        <div class="acc-hero-top">
          <span class="acc-hero-month">${ym.slice(0,4)}年${+ym.slice(5,7)}月 · 支出</span>
          <span class="pill ${hid?'on':''}" onclick="Acc.toggleHide()">${hid?'已隐藏':'显示'}</span>
        </div>

        <div class="acc-budget-main" onclick="Acc.editBudget()" title="点击设置预算">
          <div class="acc-budget-title"><span>本月预算</span><b>${hn(budget)}</b></div>
          <div class="acc-budget-cols">
            <div class="acc-col acc-col-ring">
              <div class="acc-budget-ring">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" class="ring-bg"/>
                  <circle cx="50" cy="50" r="42" class="ring-bar ${ringCls}" stroke-dasharray="${Math.min(264,Math.max(0,budget?exp/budget*264:0))} 264"/>
                </svg>
                <div class="ring-txt"><b>${pct}%</b><span>已用</span></div>
              </div>
            </div>
            <div class="acc-col">
              <div class="acc-col-amt">${hn(exp)}</div>
              <div class="acc-col-label">已消费</div>
            </div>
            <div class="acc-col">
              <div class="acc-col-amt" style="color:${remain<0?'#e5604d':'#3b9e6b'}">${hn(remain)}</div>
              <div class="acc-col-label">剩余额度</div>
            </div>
          </div>
        </div>

        <div class="acc-mini-rows">
          <div class="acc-mini-row"><span class="dot" style="background:#f7c948"></span><span>本月日均消费</span><b>${hn(avgDay)}</b></div>
          <div class="acc-mini-row"><span class="dot" style="background:#4dabf7"></span><span>剩余每日可消费</span><b>${hn(dailyRemain)}</b></div>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">📒</span>近 7 天账单</div><span class="pill" onclick="Acc.setTab('all')">全部账单 ›</span></div>
        ${recent}
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">💾</span>数据备份 / 恢复</div></div>
        <div class="small muted" style="margin-bottom:10px">把工作台全部数据（待办、饮食、体重、记账、轻断食等）导出成文件，或从上次备份恢复。换网址 / 换设备时用它迁移数据。</div>
        <div class="flex gap8">
          <button class="btn btn-primary btn-block" onclick="Acc.backup()">⬇️ 备份到文件</button>
          <button class="btn btn-ghost btn-block" onclick="Acc.restore()">⬆️ 从文件恢复</button>
        </div>
      </div>

      <button class="acc-fab" onclick="Acc.openAdd()">＋<br>记一笔</button>
    `;
  }

  /* ---- 预算口径：排除「不计入预算」账单与分类级排除 ---- */
  function budgetExpense(ym){
    const exSet=new Set(leafCats('expense').filter(c=>c.exb).map(c=>c.name));
    return S.get().bills.filter(b=>b.date.slice(0,7)===ym && b.type==='expense' && !(b.noBudget || exSet.has(b.category))).reduce((s,b)=>s+b.amount,0);
  }

  /* ---- 右上角：搜索账单 ---- */
  function searchBills(){
    UI.modal(`<div class="modal-title">🔍 搜索账单</div>
      <div class="field"><input id="bs-q" placeholder="分类 / 备注 / 金额" autofocus></div>
      <div id="bs-res" class="prev-list"></div>
      <button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>`);
    const inp=document.getElementById('bs-q');
    const res=document.getElementById('bs-res');
    if(inp)inp.focus();
    const run=()=>{
      const q=(inp.value||'').trim().toLowerCase();
      let bs=S.get().bills.slice().sort((a,b)=>a.date<b.date?1:-1);
      if(q)bs=bs.filter(b=>(''+b.category+' '+(b.note||'')+' '+b.amount).toLowerCase().includes(q));
      if(!bs.length){res.innerHTML='<div class="small muted">没有匹配的账单</div>';return;}
      res.innerHTML=bs.slice(0,200).map(b=>`<div class="row" data-bid="${b.id}">
        <div class="row-inner" onclick="UI.close();Acc.openEditBill('${b.id}')">
          <div class="bill-ico">${iconOfName(b.category)}</div>
          <div style="flex:1"><div style="font-weight:600">${esc(b.category)}${b.note?' · '+esc(b.note):''}</div>
            <div class="small muted">${b.date} · ${b.type==='expense'?'支出':'收入'}</div></div>
          <div style="font-weight:700;color:${b.type==='expense'?'#e98aa0':'#3b9e6b'}">${b.type==='expense'?'-':'+'}${fmtAmt(b.amount)}</div>
        </div></div>`).join('');
    };
    if(inp)inp.addEventListener('input',run);
    run();
  }

  /* ---- 右上角：支出构成弹窗 ---- */
  function openComposition(){
    const t=S.today(); const ym=t.slice(0,7);
    const bills=S.S.billsMonth(ym);
    const expByCat={}; bills.filter(b=>b.type==='expense').forEach(b=>expByCat[b.category]=(expByCat[b.category]||0)+b.amount);
    const pieData=Object.entries(expByCat).map(([k,v])=>({label:k,value:v}));
    const total=Object.values(expByCat).reduce((s,v)=>s+v,0);
    let html='<div class="modal-title">'+ym.slice(0,4)+'年'+ym.slice(5,7)+'月 账单</div>';
    html+= pieData.length?UI.pieChart(pieData):'<div class="small muted">本月还没有支出记录</div>';
    if(pieData.length)html+='<div class="small muted mt8">共 '+pieData.length+' 类 · 合计 '+fmtMoney(total)+'</div>';
    html+='<button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>';
    UI.modal(html);
  }

  /* ---- 右上角：导出账单为 CSV ---- */
  function exportBills(){
    const bs=S.get().bills||[];
    const header='日期,类型,金额,分类,备注,旅行';
    const rows=bs.map(b=>[b.date,b.type,b.amount,b.category,(b.note||'').replace(/[\n,]/g,' '),b.travel?'是':'否'].join(','));
    const csv='\ufeff'+[header].concat(rows).join('\n');
    try{
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url; a.download='账单_'+S.today()+'.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      UI.toast('已导出 '+bs.length+' 条账单');
    }catch(e){
      UI.toast('导出失败：'+e.message);
    }
  }
  function fmtMoney(n){
    const v=+n||0;
    const parts=(Number.isInteger(v)?String(v):v.toFixed(2)).split('.');
    parts[0]=parts[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
    return '¥'+parts.join('.');
  }
  /* 账单金额：强制两位小数 + 千分位（用户要求统一保留两位小数点） */
  function fmtAmt(v){const n=+v||0;return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
  function recent7Bills(){
    const end=S.today(), start=S.addDays(end,-6);
    let bs=S.get().bills.filter(b=>b.date>=start&&b.date<=end);
    bs.sort((a,b)=>a.date<b.date?1:-1);
    if(!bs.length)return '<div class="small muted">近 7 天还没有账单</div>';
    const dayTotal={};
    bs.forEach(b=>{ if(b.type==='expense') dayTotal[b.date]=(dayTotal[b.date]||0)+b.amount; });
    let html='',cur=null;
    bs.forEach(b=>{
      if(b.date!==cur){cur=b.date;html+=`<div class="acc-day-h small muted"><span>${S.fmtCN(b.date)} ${S.weekCN(b.date)}</span><span class="acc-day-sum">支 ${fmtAmt(dayTotal[b.date]||0)}</span></div>`;}
      html+=`<div class="row" data-bid="${b.id}">
        <div class="row-actions"><button class="edit" onclick="Acc.openEditBill('${b.id}')">编辑</button><button class="del" onclick="Acc.delBill('${b.id}')">删除</button></div>
        <div class="row-inner" onclick="Acc.openEditBill('${b.id}')">
          <div class="bill-ico">${iconOfName(b.category)}</div>
          <div style="flex:1"><div style="font-weight:600">${b.category} ${b.note?'· '+b.note:''}</div>
            <div class="small muted">${b.type==='expense'?'支出':'收入'}${b.importSource?' · '+b.importSource:''}${b.travel?' · 🧳旅行':''}</div></div>
          <div style="font-weight:700;color:${b.type==='expense'?'#e98aa0':'#3b9e6b'}">${b.type==='expense'?'-':'+'}${fmtAmt(b.amount)}</div>
        </div></div>`;
    });
    return html;
  }
  function rowHtml(b){
    return `<div class="row" data-bid="${b.id}">
      <div class="row-actions"><button class="edit" onclick="Acc.openEditBill('${b.id}')">编辑</button><button class="del" onclick="Acc.delBill('${b.id}')">删除</button></div>
      <div class="row-inner" onclick="Acc.openEditBill('${b.id}')">
        <div class="bill-ico">${iconOfName(b.category)}</div>
        <div style="flex:1"><div style="font-weight:600">${esc(b.category)} ${b.note?('· '+esc(b.note)):''}</div>
          <div class="small muted">${b.type==='expense'?'支出':'收入'}${b.importSource?(' · '+esc(b.importSource)):''}${b.travel?' · 🧳旅行':''}</div></div>
          <div style="font-weight:700;color:${b.type==='expense'?'#e98aa0':'#3b9e6b'}">${b.type==='expense'?'-':'+'}${fmtAmt(b.amount)}</div>
      </div></div>`;
  }

  /* ---- 全部账单（支持时间区间 + 分类筛选） ---- */
  function renderAll(){
    const content=document.getElementById('acc-content');
    const all=S.get().bills.slice();
    const cats=[...new Set(all.map(b=>b.category))].sort();
    let bs=all.slice();
    if(filter.from)bs=bs.filter(b=>b.date>=filter.from);
    if(filter.to)bs=bs.filter(b=>b.date<=filter.to);
    if(filter.type!=='all')bs=bs.filter(b=>b.type===filter.type);
    if(filter.cat!=='all')bs=bs.filter(b=>b.category===filter.cat);
    bs.sort((a,b)=>a.date<b.date?1:(a.date>b.date?-1:0));
    const exp=bs.filter(b=>b.type==='expense').reduce((s,b)=>s+b.amount,0);
    const inc=bs.filter(b=>b.type==='income').reduce((s,b)=>s+b.amount,0);
    let opts='<option value="all">全部分类</option>';
    cats.forEach(c=>{opts+=`<option value="${esc(c)}"${filter.cat===c?' selected':''}>${esc(c)}</option>`;});
    let listHtml;
    if(!bs.length)listHtml='<div class="small muted">这段时间还没有账单</div>';
    else{
      let html='',cur=null;
      bs.forEach(b=>{
        if(b.date!==cur){cur=b.date;html+='<div class="small muted" style="margin:12px 0 6px;font-weight:600">'+S.fmtCN(b.date)+' '+S.weekCN(b.date)+'</div>';}
        html+=rowHtml(b);
      });
      listHtml=html;
    }
    content.innerHTML=`
      <div class="sv-detail-head">
        <button class="sv-back" onclick="Acc.setTab('home')">${Icon.i('back')}</button>
        <div class="sv-detail-title">全部账单</div>
        <button class="sv-more" onclick="Acc.allMore()">${Icon.i('more')}</button>
      </div>
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">📋</span>全部账单</div>
          <span class="pill" onclick="Acc.resetAllFilter()">重置</span></div>
        <div class="af-filters">
          <div class="af-row">
            <label>开始<span class="af-date" onclick="Acc.pickFrom()">${filter.from||'选择日期'}</span></label>
            <label>结束<span class="af-date" onclick="Acc.pickTo()">${filter.to||'选择日期'}</span></label>
          </div>
          <div class="af-row">
            <select id="af-cat" onchange="Acc.applyAllFilter()">${opts}</select>
          </div>
        </div>
        <div class="af-sum">
          <div><span>支出</span><b style="color:#e98aa0">${fmtMoney(exp)}</b></div>
          <div><span>收入</span><b style="color:#3b9e6b">${fmtMoney(inc)}</b></div>
          <div><span>结余</span><b>${fmtMoney(inc-exp)}</b></div>
        </div>
      </div>
      <div class="card">
        ${listHtml}
      </div>`;
  }
  function applyAllFilter(){
    const c=document.getElementById('af-cat');
    filter.cat=c?c.value:'all';
    renderAll();
  }
  function resetAllFilter(){filter={type:'all',cat:'all',from:'',to:''};renderAll();}
  function pickFrom(){UI.datePicker(filter.from||S.today(),d=>{filter.from=d;renderAll();},'选择开始日期');}
  function pickTo(){UI.datePicker(filter.to||S.today(),d=>{filter.to=d;renderAll();},'选择结束日期');}
  function allMore(){
    UI.modal(`<div class="modal-title">账单操作</div>
      <div class="wsheet">
        <button class="sheet-btn" onclick="Acc.openAdd();UI.close();">＋ 记一笔</button>
        <button class="sheet-btn ghost" onclick="UI.close()">取消</button>
      </div>`);
  }

  /* ---- 日历 ---- */
  function renderCalendar(){
    const content=document.getElementById('acc-content');
    const isToday=calSel===S.today();
    content.innerHTML=`<div class="card">
      <div class="card-h"><div class="l"><span class="ico">${I.i('calendar')}</span>记账日历</div></div>
      <div class="mp-head">
        <button onclick="Acc.shiftMonth(-1)">‹</button>
        <div class="mp-t" onclick="Acc.pickMonth()">${calYM.slice(0,4)}年 ${+calYM.slice(5,7)}月</div>
        <button class="today-btn${isToday?'':' go-today-pill'}" onclick="Acc.goCalToday()">${isToday?'今天':'回到今天'}</button>
      </div>
      ${monthGrid(calYM)}
      <div class="acc-cal-sum">
        <span>支出 <b>${fmtMoney(monthExpense(calYM))}</b></span>
        <span>收入 <b>${fmtMoney(monthIncome(calYM))}</b></span>
      </div>
    </div>
    <div class="card">
      <div class="card-h"><div class="l"><span class="ico">${I.i('calendar')}</span>${S.fmtCN(calSel)} ${S.weekCN(calSel)} 账单</div><span class="pill" onclick="Acc.openAdd({date:'${calSel}'})">＋ 记一笔</span></div>
      ${dayBills(calSel)}
    </div>
    <button class="acc-fab" onclick="Acc.openAdd({date:'${calSel}'})">＋<br>记一笔</button>`;
  }
  function shiftMonth(dir){
    const d=S.parse(calYM+'-01');
    d.setMonth(d.getMonth()+dir);
    calYM=`${d.getFullYear()}-${S.pad(d.getMonth()+1)}`;
    calSel=calYM+'-01';
    renderCalendar();
  }
  function goCalToday(){
    calYM=S.today().slice(0,7); calSel=S.today();
    renderCalendar();
  }
  function pickMonth(){
    UI.datePicker(calSel||calYM+'-01',d=>{calYM=d.slice(0,7);calSel=d;renderCalendar();},'选择日期');
  }
  function monthGrid(ym){
    /* 与便便日历一致：周一为第一天 */
    const days=new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();
    const rawW=S.weekday(ym+'-01');
    const startW=(rawW===0?6:rawW-1);
    const wk=['一','二','三','四','五','六','日'];
    let head='';wk.forEach(w=>head+='<div class="cal-h">'+w+'</div>');
    let cells='';
    // 计算当月最大单日支出，用于热力图归一化
    let maxE=0;
    for(let i=1;i<=days;i++){
      const e=dayExpense(ym+'-'+S.pad(i));
      if(e>maxE)maxE=e;
    }
    for(let i=0;i<startW;i++)cells+='<div class="pcal-cell empty"></div>';
    for(let i=1;i<=days;i++){
      const ds=ym+'-'+S.pad(i);
      const e=dayExpense(ds);
      const cls='pcal-cell'+(ds===calSel?' sel':'')+(ds===S.today()?' today':'')+' '+heatClass(e,maxE);
      // 选中日用圆点突出：有花销深红，无花销绿色
      const dot=ds===calSel?`<span class="pcal-dot${e>0?' pcal-dot-exp':' pcal-dot-free'}">${i}</span>`:`<b>${i}</b>`;
      const mark=e>0?'<span class="pcal-amt">'+fmtCal(e)+'</span>':'<span class="pcal-amt"></span>';
      cells+='<div class="'+cls+'" onclick="Acc.pickCalDate(\''+ds+'\')">'+dot+mark+'</div>';
    }
    return '<div class="cal-wk">'+head+'</div><div class="pcal-grid">'+cells+'</div>';
  }
  function heatClass(e,max){
    if(!e)return 'lv0';
    if(max<=0)return 'lv1';
    const r=e/max;
    const lv=Math.min(10, Math.max(1, Math.floor(r*10)+1));
    return 'lv'+lv;
  }
  function fmtCal(n){
    const v=+n||0; if(v<=0)return '';
    return '¥'+fmtAmt(v);
  }
  function pickCalDate(d){
    calSel=d; renderCalendar();
    // 点选某天后，自动把当天账单卡片滚入视野，明确「进入」当天
    const card=document.querySelector('#acc-content .card');
    if(card&&card.scrollIntoView)card.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function dayExpense(d){
    return S.get().bills.filter(b=>b.date===d&&b.type==='expense').reduce((s,b)=>s+b.amount,0);
  }
  function dayIncome(d){
    return S.get().bills.filter(b=>b.date===d&&b.type==='income').reduce((s,b)=>s+b.amount,0);
  }
  function monthExpense(ym){return S.get().bills.filter(b=>b.date.slice(0,7)===ym&&b.type==='expense').reduce((s,b)=>s+b.amount,0);}
  function monthIncome(ym){return S.get().bills.filter(b=>b.date.slice(0,7)===ym&&b.type==='income').reduce((s,b)=>s+b.amount,0);}
  function dayBills(d){
    const bs=S.get().bills.filter(b=>b.date===d).sort((a,b)=>a.type.localeCompare(b.type)||a.amount-b.amount);
    if(!bs.length)return '<div class="small muted">今天还没有账单</div>';
    let html='';
    bs.forEach(b=>{
      html+=`<div class="row" data-bid="${b.id}">
        <div class="row-actions"><button class="edit" onclick="Acc.openEditBill('${b.id}')">编辑</button><button class="del" onclick="Acc.delBill('${b.id}')">删除</button></div>
        <div class="row-inner" onclick="Acc.openEditBill('${b.id}')">
          <div class="bill-ico">${iconOfName(b.category)}</div>
          <div style="flex:1"><div style="font-weight:600">${b.category} ${b.note?'· '+b.note:''}</div>
            <div class="small muted">${b.type==='expense'?'支出':'收入'}${b.importSource?' · '+b.importSource:''}</div></div>
          <div style="font-weight:700;color:${b.type==='expense'?'#e98aa0':'#3b9e6b'}">${b.type==='expense'?'-':'+'}${fmtAmt(b.amount)}</div>
        </div></div>`;
    });
    return html;
  }

  /* ---- 存钱（重设计：汇总卡 + 计划列表 + 详情页） ---- */
  function planCur(p){return +p.currentAmount||0;}
  function planEmoji(p){return p.icon||'🌿';}
  function computeTarget(p){
    if(p.mode==='free')return +p.targetAmount||0;
    const base=+p.baseAmount||0, times=+p.times||0;
    if(p.increment)return base*times*(times+1)/2;
    return base*times;
  }
  function renderSavings(){
    if(svView.name==='plan'){renderPlan(svView.id);return;}
    if(svView.name==='create'||svView.name==='edit'){renderSavingForm(svView.id);return;}
    if(svView.name==='archived'){renderArchivedPlans();return;}
    const plans=S.get().savingsPlans||[];
    const active=plans.filter(p=>!p.archived);
    const archived=plans.filter(p=>p.archived);
    const total=active.reduce((s,p)=>s+planCur(p),0);
    const target=active.reduce((s,p)=>s+computeTarget(p),0);
    const remain=Math.max(0,target-total);
    const content=document.getElementById('acc-content');
    content.innerHTML=`
      <div class="sv-summary">
        <div class="sv-sum-item"><span>累计存入</span><b>${fmtMoney(total)}</b></div>
        <div class="sv-sum-item"><span>存钱总目标</span><b>${fmtMoney(target)}</b></div>
        <div class="sv-sum-item"><span>剩余目标</span><b>${fmtMoney(remain)}</b></div>
      </div>
      <div class="sv-subhead">
        <span class="sv-sh-l">我的存钱计划</span>
        <span class="sv-sh-r" onclick="Acc.openArchived()">已归档计划 › (${archived.length})</span>
      </div>
      <div class="sv-plan-list">
        ${active.length?active.map(planCard).join(''):''}
        <div class="sv-plan sv-create" onclick="Acc.openSaving()">
          <div class="sv-plan-ic">${Icon.i('plus')}</div>
          <div class="sv-plan-main"><div class="sv-plan-name">新建存钱计划</div></div>
        </div>
      </div>
    `;
    setTimeout(bindPlanGestures,0);
  }
  function openArchived(){svView={name:'archived',id:''};renderSavings();}
  function renderArchivedPlans(){
    const archived=(S.get().savingsPlans||[]).filter(p=>p.archived);
    const content=document.getElementById('acc-content');
    content.innerHTML=`
      <div class="sv-detail-head">
        <button class="sv-back" onclick="Acc.backSavings()">${Icon.i('back')}</button>
        <div class="sv-detail-title">已归档存钱计划</div>
      </div>
      <div class="sv-plan-list" style="padding:0 16px">
        ${archived.length?archived.map(planCard).join(''):'<div class="small muted sv-empty" style="text-align:center;padding:40px 0">还没有已归档计划</div>'}
      </div>`;
    setTimeout(bindPlanGestures,0);
  }
  function planCard(p){
    const cur=planCur(p), target=computeTarget(p);
    const pct=target>0?Math.min(100,cur/target*100):0;
    const remain=Math.max(0,target-cur);
    const modeName=(SAVE_MODES.find(m=>m.key===p.mode)||{}).name||'自由存钱';
    return `<div class="sv-plan-wrap" data-sid="${p.id}">
      <div class="sv-plan" data-sid="${p.id}">
        <div class="sv-plan-ic">${planEmoji(p)}</div>
        <div class="sv-plan-main">
          <div class="sv-plan-name">${esc(p.name)} <span class="sv-plan-mode">${modeName}</span></div>
          <div class="sv-plan-date">${p.startDate||''}${p.endDate?' ~ '+p.endDate:' ~ 进行中'}</div>
          <div class="sv-plan-bar"><div class="sv-plan-fill" style="width:${pct}%"></div></div>
          <div class="sv-plan-foot"><span>目标 ${fmtMoney(target)} · 剩余 ${fmtMoney(remain)}</span><span>${pct.toFixed(0)}%</span></div>
        </div>
      </div>
    </div>`;
  }
  function bindPlanGestures(){
    document.querySelectorAll('.sv-plan-wrap').forEach(wrap=>{
      if(wrap.dataset.bound)return;wrap.dataset.bound='1';
      const card=wrap.querySelector('.sv-plan');
      const id=card.dataset.sid;if(!id)return;
      let timer=null,sx=0,sy=0,long=false,moved=false,blocked=false,lastPointer='';
      const block=(ms=600)=>{blocked=true;setTimeout(()=>blocked=false,ms);};
      const start=(x,y)=>{long=false;moved=false;blocked=false;sx=x;sy=y;timer=setTimeout(()=>{long=true;timer=null;planSortMenu(id);},520);};
      const cancel=()=>{if(timer){clearTimeout(timer);timer=null;}};
      const doOpen=()=>{openPlan(id);};
      card.addEventListener('pointerdown',e=>{
        lastPointer=e.pointerType;
        if(e.pointerType==='mouse'&&e.button!==0)return;   // 右键交给 contextmenu 处理
        try{card.setPointerCapture(e.pointerId);}catch(_){}
        start(e.clientX,e.clientY);
      },{passive:true});
      card.addEventListener('pointermove',e=>{
        if(!timer)return;
        const dx=e.clientX-sx,dy=e.clientY-sy;
        if(Math.abs(dy)>10||Math.abs(dx)>12){moved=true;cancel();}
      });
      const end=e=>{
        try{card.releasePointerCapture(e.pointerId);}catch(_){}
        if(e.pointerType==='mouse'&&e.button!==0){cancel();return;}  // 右键/中键松手不进入计划
        if(long){block();e.preventDefault();}                // 长按已触发，松手不再进入计划
        else if(!moved){doOpen();}
        cancel();
      };
      card.addEventListener('pointerup',end);
      card.addEventListener('pointercancel',()=>{cancel();});
      // 右键（电脑端）→ 直接编辑；原生长按（手机端）→ 视为长按打开操作菜单
      card.addEventListener('contextmenu',e=>{
        e.preventDefault();
        if(lastPointer==='mouse'){block();openSaving(id);return;}   // 电脑端右键编辑
        if(long)return;                                            // 计时器已打开过菜单，避免重复弹窗
        long=true;cancel();block();planSortMenu(id);              // 手机端长按菜单（含编辑/排序/删除）
      });
      // 阻止长按/右击后触发的合成点击误触进入计划
      card.addEventListener('click',e=>{if(blocked||long||moved){e.stopPropagation();e.preventDefault();}});
    });
  }
  function planSortMenu(id){
    UI.modal(`<div class="modal-title">调整顺序 / 操作</div>
      <div class="wsheet">
        <button class="sheet-btn" onclick="Acc.movePlan('${id}',-1)">⬆️ 上移</button>
        <button class="sheet-btn" onclick="Acc.movePlan('${id}',1)">⬇️ 下移</button>
        <button class="sheet-btn" onclick="Acc.openSaving('${id}');UI.close();">✏️ 编辑计划</button>
        <button class="sheet-btn danger" onclick="Acc.delPlan('${id}')">🗑 删除计划</button>
        <button class="sheet-btn ghost" onclick="UI.close()">取消</button>
      </div>`);
  }
  function movePlan(id,dir){
    const plans=S.get().savingsPlans;if(!plans.length)return;
    const idx=plans.findIndex(p=>p.id===id);if(idx<0)return UI.close();
    const nidx=idx+dir;if(nidx<0||nidx>=plans.length)return UI.close();
    [plans[idx],plans[nidx]]=[plans[nidx],plans[idx]];
    S.save();UI.close();renderSavings();
  }
  function openPlan(id){svView={name:'plan',id};renderSavings();}
  function backSavings(){svView={name:'list',id:''};renderSavings();}
  function toggleArchived(){svArchOpen=!svArchOpen;renderSavings();}
  function scrollArchived(){svArchOpen=true;renderSavings();setTimeout(()=>{const el=document.getElementById('sv-arch');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},30);}
  function svSwitch(t){svTab=t;renderSavings();}
  function renderPlan(id){
    const p=(S.get().savingsPlans||[]).find(x=>x.id===id);if(!p){backSavings();return;}
    const cur=planCur(p), target=computeTarget(p);
    const pct=target>0?Math.min(100,cur/target*100):0;
    const remain=Math.max(0,target-cur);
    const deposits=(p.deposits||[]).slice().sort((a,b)=>a.date>b.date?1:-1);
    const checks=deposits.length;
    const isFixed=p.mode==='fixed';
    const pending=isFixed?genPending(p):[];
    const content=document.getElementById('acc-content');
    const inCards=(isFixed?pending.map(x=>pendingCard(x)):[]).concat(deposits.map(d=>depCard(d,'in',p.id))).join('');
    const outCards=(p.withdraws||[]).slice().sort((a,b)=>a.date>b.date?1:-1).map(d=>depCard(d,'out',p.id)).join('');
    content.innerHTML=`
      <div class="sv-detail-head">
        <button class="sv-back" onclick="Acc.backSavings()">${Icon.i('back')}</button>
        <div class="sv-detail-title">存钱</div>
        <button class="sv-more" onclick="Acc.planMore('${p.id}')">${Icon.i('more')}</button>
      </div>
      <div class="sv-info">
        <div class="sv-info-top">
          <div class="sv-info-ic">${Icon.i('piggy')}</div>
          <div class="sv-info-main">
            <div class="sv-info-name">${esc(p.name)}</div>
            <div class="sv-info-date">${p.startDate||''}${p.endDate?' ~ '+p.endDate:' ~ 进行中'}</div>
          </div>
          <div class="sv-info-right">
            <div class="sv-info-target"><span>目标</span><b>${fmtMoney(target)}</b></div>
            <div class="sv-info-remain"><span>剩余</span><b>${fmtMoney(remain)}</b><span class="sv-q" onclick="UI.toast('剩余 = 目标金额 − 已存入金额')">${Icon.i('question')}</span></div>
          </div>
        </div>
        <div class="sv-info-bar"><div class="sv-info-fill" style="width:${pct}%"></div></div>
        <div class="sv-info-foot"><span>累计存入 <b>${fmtMoney(cur)}</b></span><span>打卡 ${checks} 次</span></div>
      </div>
      <div class="sv-tabs">
        <button class="sv-tab${svTab==='in'?' on':''}" onclick="Acc.svSwitch('in')">已存入</button>
        <button class="sv-tab${svTab==='out'?' on':''}" onclick="Acc.svSwitch('out')">取出记录</button>
      </div>
      <div class="sv-grid">
        ${svTab==='in'
          ?(isFixed
            ?(inCards||'<div class="small muted sv-empty">还没有待存入计划</div>')
            :(deposits.length
              ? deposits.map(d=>depCard(d,'in',p.id)).join('')
              :'<div class="small muted sv-empty">还没有存入记录</div>')
            + (!isFixed?`<div class="sv-add-card" onclick="Acc.openDeposit('${p.id}')">
              <div class="sv-add-ic">${Icon.i('plus')}</div>
              <div class="sv-add-tx">存一笔</div>
            </div>`:''))
          :(outCards||'<div class="small muted sv-empty">还没有取出记录</div>')}
      </div>
    `;
  }
  function depCard(d,type,pid){
    const click=type==='in'?` onclick="Acc.editDeposit('${pid}','${d.id}')"`:'';
    return `<div class="sv-dep ${type==='in'?'sv-dep-in':'sv-dep-out'}"${click}>
      <div class="sv-dep-tag">${type==='in'?'已存入':'已取出'}</div>
      <div class="sv-dep-amt" style="color:${type==='in'?'#3b9e6b':'#e98aa0'}">${type==='in'?'+':'-'}${fmtMoney(d.amount)}</div>
      <div class="sv-dep-date">${d.date.replace(/-/g,'.')}</div>
    </div>`;
  }
  function pendingCard(x){
    return `<div class="sv-dep sv-dep-pending" onclick="Acc.openDeposit('${x.pid}',${x.amt},${x.idx})">
      <div class="sv-dep-tag">待存入</div>
      <div class="sv-dep-amt">${fmtMoney(x.amt)}</div>
      <div class="sv-dep-date">${x.label}</div>
    </div>`;
  }
  function genPending(p){
    const times=+p.times||0;
    const deposits=p.deposits||[];
    const hasSlot=deposits.some(d=>d.slotIdx!=null);
    const doneSlots=new Set(deposits.filter(d=>d.slotIdx!=null).map(d=>d.slotIdx));
    const legacyDone=deposits.length; // 旧数据没有 slotIdx 时，默认前 N 个槽位已完成
    const base=+p.baseAmount||0;
    const period=p.period||'day';
    const start=p.startDate||S.today();
    const list=[];
    for(let i=0;i<times;i++){
      const completed=hasSlot?doneSlots.has(i):(i<legacyDone);
      if(!completed) list.push({pid:p.id,amt:base,label:pendingLabel(start,period,i),idx:i});
    }
    return list;
  }
  function pendingLabel(start,period,offset){
    const d=new Date(start+'T00:00:00');
    switch(period){
      case 'day':d.setDate(d.getDate()+offset);break;
      case 'week':d.setDate(d.getDate()+offset*7);break;
      case 'month':d.setMonth(d.getMonth()+offset);break;
      case 'year':d.setFullYear(d.getFullYear()+offset);break;
    }
    const y=d.getFullYear(),m=('0'+(d.getMonth()+1)).slice(-2);
    if(period==='year')return `${y}`;
    if(period==='month')return `${y}.${m}`;
    return `${y}.${m}.${('0'+d.getDate()).slice(-2)}`;
  }
  function planMore(id){
    UI.modal(`<div class="modal-title">计划操作</div>
      <div class="wsheet">
        <button class="sheet-btn" onclick="Acc.openSaving('${id}')">✏️ 编辑计划</button>
        <button class="sheet-btn" onclick="Acc.archivePlan('${id}')">📦 归档 / 恢复</button>
        <button class="sheet-btn danger" onclick="Acc.delPlan('${id}')">🗑 删除计划</button>
        <button class="sheet-btn ghost" onclick="UI.close()">取消</button>
      </div>`);
  }
  function archivePlan(id){
    const p=(S.get().savingsPlans||[]).find(x=>x.id===id);if(!p)return;
    p.archived=!p.archived;S.save();UI.close();renderSavings();UI.toast(p.archived?'已归档':'已恢复');
  }
  function delPlan(id){
    UI.modal(`<div class="modal-title">确定删除这个存钱计划？</div>
      <div class="small muted">删除后计划与所有存入记录都不会恢复，确定吗？</div>
      <div class="flex gap8 mt12">
        <button class="btn btn-ghost btn-block" style="color:#e06a80;border-color:#e06a80" onclick="Acc.doDelPlan('${id}')">删除</button>
        <button class="btn btn-primary btn-block" onclick="UI.close()">取消</button>
      </div>`);
  }
  function doDelPlan(id){
    S.get().savingsPlans=S.get().savingsPlans.filter(p=>p.id!==id);S.save();UI.close();backSavings();UI.toast('已删除');
  }
  function openSaving(id){
    const p=id?(S.get().savingsPlans||[]).find(x=>x.id===id):null;
    svView={name:id?'edit':'create',id:id||'',mode:p?p.mode:'fixed'};
    svIcon=p?(p.icon||'🐷'):'🐷';
    renderSavings();
  }
  function renderSavingForm(id){
    const p=id?(S.get().savingsPlans||[]).find(x=>x.id===id):null;
    const mode=svView.mode||(p?p.mode:'fixed');
    const cfg=SAVE_MODES.find(m=>m.key===mode);
    const isFree=mode==='free';
    const name=p?p.name:cfg.name;
    const start=p?p.startDate:S.today();
    const end=p?p.endDate:'';
    const base=p?('baseAmount' in p?p.baseAmount:cfg.base):cfg.base;
    const times=p?('times' in p?p.times:cfg.times):cfg.times;
    const increment=p?('increment' in p?p.increment:cfg.increment):cfg.increment;
    const target=p?computeTarget(p):(isFree?'':computeTarget({mode,baseAmount:base,times,increment}));
    const icon=svIcon||p&&p.icon||'🐷';
    const period=isFree?'':(p?p.period:cfg.period);
    const logoEl=/^[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]$/u.test(icon)?`<span class="svf-logo-emoji">${icon}</span>`:Icon.i('piggy');
    const content=document.getElementById('acc-content');
    content.innerHTML=`
      <div class="sv-detail-head">
        <button class="sv-back" onclick="Acc.backSavings()">${Icon.i('back')}</button>
        <div class="sv-detail-title">${p?'编辑':'添加'}存钱计划</div>
        <div class="sv-back" style="visibility:hidden">${Icon.i('back')}</div>
      </div>
      <div class="sv-form" data-mode="${mode}">
        <div class="svf-modes">
          ${SAVE_MODES.map(m=>`<button type="button" class="svf-mode ${m.key===mode?'on':''}" onclick="Acc.svfSetMode('${m.key}')">${m.icon} ${m.name}</button>`).join('')}
        </div>
        <div class="svf-card">
        <div class="svf-row" onclick="Acc.openIconPicker()">
          <span class="svf-label">计划Logo</span>
          <span class="svf-val svf-logo">${logoEl}</span>
          <span class="svf-arrow">›</span>
        </div>
        <input type="hidden" id="sv-icon" value="${esc(icon)}">
        <div class="svf-row">
          <span class="svf-label">计划名称</span>
          <input class="svf-input" id="sv-name" value="${esc(name)}" placeholder="点击输入…">
        </div>
        <div class="svf-row" onclick="Acc.svfPickDate('sv-start')">
          <span class="svf-label">开始日期</span>
          <span class="svf-val" id="sv-start-txt">${start}</span>
          <input type="hidden" id="sv-start" value="${start}">
          <span class="svf-arrow">›</span>
        </div>
        ${isFree?`<div class="svf-row" onclick="Acc.svfPickDate('sv-end')">
          <span class="svf-label">结束日期</span>
          <span class="svf-val svf-placeholder" id="sv-end-txt">${end||'选填'}</span>
          <input type="hidden" id="sv-end" value="${end}">
          <span class="svf-arrow">›</span>
        </div>`:''}
        <div class="svf-row">
          <span class="svf-label" id="sv-base-label">${isFree?'起始金额':svfBaseLabel(period)}</span>
          <input class="svf-input svf-num" id="sv-base" type="number" inputmode="decimal" value="${base}" placeholder="0.00">
        </div>
        ${!isFree?`<div class="svf-row" style="align-items:flex-start">
          <span class="svf-label" style="padding-top:8px">存钱周期</span>
          <div class="svf-modes" id="sv-period-chips" style="margin:0;flex-wrap:wrap;justify-content:flex-end">
            ${Object.keys(PERIOD_CN).map(k=>`<button type="button" class="svf-mode ${k===period?'on':''}" data-period="${k}" onclick="Acc.svfSetPeriod('${k}')">${PERIOD_CN[k]}</button>`).join('')}
          </div>
          <input type="hidden" id="sv-period" value="${period}">
        </div>
        <div class="svf-row">
          <span class="svf-label">存钱次数</span>
          <input class="svf-input svf-num" id="sv-times" type="number" inputmode="numeric" value="${times}" placeholder="0">
        </div>`:`<div class="svf-row">
          <span class="svf-label">目标金额</span>
          <input class="svf-input svf-num" id="sv-target" type="number" inputmode="decimal" value="${p?p.targetAmount:''}" placeholder="选填">
        </div>`}
        <div class="svf-hint" id="sv-hint">${isFree?'':svfHint({mode,baseAmount:base,times,increment:false})}</div>
        </div>
      </div>
      <div class="sv-form-foot">
        <button class="btn btn-primary btn-block" onclick="Acc.saveSaving('${id||''}')">${p?'保存':'添加'}</button>
      </div>`;
    // 绑定名称/金额输入实时重算提示
    const nameIn=document.getElementById('sv-name');
    if(nameIn&&!p)nameIn.addEventListener('input',e=>{if(e.target.dataset.auto!=='0')e.target.dataset.auto='1';});
    ['sv-base','sv-base2','sv-times'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.addEventListener('input',Acc.svfRecalc);
    });
  }
  function svfHint(p){
    const t=computeTarget(p); const n=+p.times||0;
    return `${n} ${PERIOD_CN[p.period]||'期'}后可存 ${fmtMoney(t)}`;
  }
  function svfBaseLabel(period){return '每'+(PERIOD_CN[period]||'期')+'存';}
  function svfFixedLabel(period){return '第1'+ (PERIOD_CN[period]||'期') +'存';}
  function svfPickPeriod(){
    const cur=document.getElementById('sv-period').value||'day';
    const opts=Object.keys(PERIOD_CN).map(k=>`<div class="svf-mode ${k===cur?'on':''}" onclick="Acc.svfSetPeriod('${k}')">${PERIOD_CN[k]}</div>`).join('');
    UI.modal(`<div class="modal-title">选择存钱周期</div><div class="svf-modes" style="margin:12px 0">${opts}</div><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>`);
  }
  function svfSetPeriod(period){
    const perIn=document.getElementById('sv-period');
    if(perIn)perIn.value=period;
    // 高亮周期卡片
    document.querySelectorAll('#sv-period-chips .svf-mode').forEach(b=>b.classList.toggle('on',b.dataset.period===period));
    // 定额模式下 label 随周期变化
    const mode=document.querySelector('.sv-form')?.dataset.mode;
    if(mode==='fixed'){
      const label=document.getElementById('sv-base-label');
      if(label)label.textContent=svfBaseLabel(period);
    }
    svfRecalc();
  }
  function svfRecalc(){
    const mode=document.querySelector('.sv-form').dataset.mode;
    if(mode==='free')return;
    const base=+(document.getElementById('sv-base')).value||0;
    const times=+document.getElementById('sv-times').value||0;
    const period=document.getElementById('sv-period').value||'day';
    const hint=document.getElementById('sv-hint');
    if(hint)hint.textContent=svfHint({mode,period,baseAmount:base,times,increment:false});
  }
  function svfSetMode(key){
    svView.mode=key;
    renderSavingForm(svView.id);
  }
  function svfPickDate(id){
    const cur=document.getElementById(id).value||S.today();
    UI.datePicker(cur,d=>{
      document.getElementById(id).value=d;
      const txt=document.getElementById(id+'-txt');
      if(txt){txt.textContent=d;txt.classList.remove('svf-placeholder');}
    },id==='sv-end'?'选择结束日期':'选择开始日期');
  }
  function openIconPicker(){
    const icons=['🐷','🌿','✈️','🚗','🏠','💍','🎓','👶','🎮','📱','💻','🛍️','🍔','🏥','🎁','🎯','🌻','⭐','🐱','🐶','🍀','🌙','☀️','🌈'];
    const cur=document.getElementById('sv-icon').value;
    UI.modal(`<div class="modal-title">选择计划图标</div>
      <div class="svf-icon-grid">${icons.map(ic=>`<div class="svf-icon-cell ${ic===cur?'on':''}" onclick="Acc.pickSvIcon('${ic}')">${ic}</div>`).join('')}</div>
      <div class="field"><input id="sv-icon-custom" value="${esc(cur)}" placeholder="输入 emoji 或文字"></div>
      <button class="btn btn-primary btn-block" onclick="Acc.pickSvIcon(document.getElementById('sv-icon-custom').value.trim()||'🐷')">确定</button>`);
  }
  function pickSvIcon(ic){svIcon=ic;UI.close();renderSavingForm(svView.id);}
  function saveSaving(id){
    const name=document.getElementById('sv-name').value.trim();
    const icon=document.getElementById('sv-icon').value.trim()||'🐷';
    const start=document.getElementById('sv-start').value||S.today();
    const end=(document.getElementById('sv-end')||{}).value||'';
    const mode=document.querySelector('.sv-form').dataset.mode;
    if(!name){UI.toast('填个计划名称');return;}
    const cfg=SAVE_MODES.find(m=>m.key===mode);
    let plan={id:id||S.uid(),name,icon,mode,startDate:start,endDate:end,currentAmount:0,deposits:[],withdraws:[],archived:false};
    if(mode==='free'){
      plan.targetAmount=+(document.getElementById('sv-target').value)||0;
      plan.period='free';plan.increment=false;plan.times=1;plan.baseAmount=+(document.getElementById('sv-base').value)||0;
    }else{
      plan.period=(document.getElementById('sv-period').value)||cfg.period;
      plan.baseAmount=+(document.getElementById('sv-base').value)||0;
      plan.times=+document.getElementById('sv-times').value||0;
      plan.increment=false;
      plan.targetAmount=computeTarget(plan);
    }
    const plans=S.get().savingsPlans;
    if(id){
      const old=plans.find(x=>x.id===id);
      if(old){
        plan.currentAmount=old.currentAmount||0;
        plan.deposits=old.deposits||[];
        plan.withdraws=old.withdraws||[];
        plan.archived=old.archived||false;
        Object.assign(old,plan);
      }
    }else{
      // 默认把首期存入？不，让用户自己打卡
      plans.push(plan);
    }
    S.save();backSavings();UI.toast(id?'已保存':'已添加');
  }
  function openDeposit(id, presetAmt, slotIdx){
    const p=(S.get().savingsPlans||[]).find(x=>x.id===id);if(!p)return;
    const fixed=slotIdx!=null || presetAmt>0;
    const defDate=fixed?pendingLabel(p.startDate||S.today(),p.period||'day',slotIdx||0):S.today();
    UI.modal(`<div class="modal-title">${fixed?'打卡存入':'存一笔'} · ${esc(p.name)}</div>
      <div class="wsheet">
        ${fixed?'':`<div class="seg" id="dp-kind">
          <div class="opt on" data-k="in">存入</div>
          <div class="opt" data-k="out">取出</div>
        </div>`}
        <div class="field"><label>金额</label><input id="dp-amt" type="number" inputmode="decimal" value="${fixed?(presetAmt||p.baseAmount||''):''}" ${fixed?'readonly':''} placeholder="0.00"></div>
        <div class="field"><label>存入时间</label>
          <input type="hidden" id="dp-date" value="${defDate.replace(/\./g,'-')}">
          <div class="dp-date" onclick="Acc.pickDepositDate()">${defDate.replace(/-/g,'/')}</div>
        </div>
        <div class="field"><label>备注</label><input id="dp-note" placeholder="如 第 3 周"></div>
        <div class="flex gap8 mt8">
          <button class="btn btn-primary btn-block" onclick="Acc.saveDeposit('${id}',${fixed},${slotIdx==null?-1:slotIdx})">确认</button>
          <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
        </div>
      </div>`);
    if(!fixed){
      document.querySelectorAll('#dp-kind .opt').forEach(o=>o.onclick=()=>{
        document.querySelectorAll('#dp-kind .opt').forEach(x=>x.classList.remove('on'));
        o.classList.add('on');
      });
    }
  }
  function pickDepositDate(){
    const cur=document.getElementById('dp-date').value||S.today();
    UI.datePicker(cur,d=>{
      document.getElementById('dp-date').value=d;
      const disp=document.querySelector('.dp-date');
      if(disp)disp.textContent=d.replace(/-/g,'/');
    },'选择存入时间');
  }
  function saveDeposit(id,fixed,slotIdx){
    const p=(S.get().savingsPlans||[]).find(x=>x.id===id);if(!p)return;
    const kind=fixed?'in':(document.querySelector('#dp-kind .opt.on').dataset.k);
    const amt=fixed?+document.getElementById('dp-amt').value:(+document.getElementById('dp-amt').value);if(!amt){UI.toast('填个金额吧');return;}
    const date=document.getElementById('dp-date').value||S.today();
    const note=document.getElementById('dp-note').value.trim();
    p.deposits=p.deposits||[];p.withdraws=p.withdraws||[];
    const rec={id:S.uid(),amount:amt,date,note};
    if(slotIdx!=null && slotIdx>=0) rec.slotIdx=slotIdx;
    if(kind==='in')p.deposits.push(rec);
    else p.withdraws.push(rec);
    p.currentAmount=(+p.currentAmount||0)+(kind==='in'?amt:-amt);
    S.save();UI.close();renderSavings();UI.toast(kind==='in'?'已存入 💗':'已取出');
  }
  function editDeposit(pid,did){
    const p=(S.get().savingsPlans||[]).find(x=>x.id===pid);if(!p)return;
    const d=(p.deposits||[]).find(x=>x.id===did);if(!d)return;
    UI.modal(`<div class="modal-title">编辑存入记录</div>
      <div class="wsheet">
        <div class="field"><label>金额</label><input id="dp-amt" type="number" inputmode="decimal" value="${d.amount}"></div>
        <div class="field"><label>存入时间</label>
          <input type="hidden" id="dp-date" value="${d.date}">
          <div class="dp-date" onclick="Acc.pickDepositDate()">${d.date.replace(/-/g,'/')}</div>
        </div>
        <div class="field"><label>备注</label><input id="dp-note" value="${esc(d.note||'')}" placeholder="如 第 3 周"></div>
        <div class="flex gap8 mt8">
          <button class="btn btn-primary btn-block" onclick="Acc.saveDepositEdit('${pid}','${did}')">保存修改</button>
          <button class="btn btn-ghost btn-block" onclick="Acc.withdrawDeposit('${pid}','${did}')">取出</button>
        </div>
        <button class="btn btn-ghost btn-block mt8" style="color:#e06a80;border-color:#e06a80" onclick="Acc.delDeposit('${pid}','${did}')">删除记录</button>
        <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">取消</button>
      </div>`);
  }
  function saveDepositEdit(pid,did){
    const p=(S.get().savingsPlans||[]).find(x=>x.id===pid);if(!p)return;
    const d=(p.deposits||[]).find(x=>x.id===did);if(!d)return;
    const amt=+document.getElementById('dp-amt').value||0; if(!amt){UI.toast('金额不能为 0');return;}
    const date=document.getElementById('dp-date').value||d.date;
    const note=document.getElementById('dp-note').value.trim();
    p.currentAmount=(+p.currentAmount||0)-(+d.amount||0)+amt;
    d.amount=amt;d.date=date;d.note=note;
    S.save();UI.close();renderSavings();UI.toast('已更新');
  }
  function withdrawDeposit(pid,did){
    const p=(S.get().savingsPlans||[]).find(x=>x.id===pid);if(!p)return;
    const d=(p.deposits||[]).find(x=>x.id===did);if(!d)return;
    const amt=+document.getElementById('dp-amt').value||(+d.amount||0); if(!amt){UI.toast('金额不能为 0');return;}
    const date=document.getElementById('dp-date').value||d.date;
    const note=document.getElementById('dp-note').value.trim();
    p.withdraws=p.withdraws||[];
    p.withdraws.push({id:S.uid(),amount:amt,date,note});
    p.currentAmount=(+p.currentAmount||0)-amt;
    S.save();UI.close();renderSavings();UI.toast('已取出');
  }
  function delDeposit(pid,did){
    const p=(S.get().savingsPlans||[]).find(x=>x.id===pid);if(!p)return;
    const idx=(p.deposits||[]).findIndex(x=>x.id===did);if(idx<0)return;
    const d=p.deposits[idx];
    p.currentAmount=(+p.currentAmount||0)-(+d.amount||0);
    p.deposits.splice(idx,1);
    S.save();UI.close();renderSavings();UI.toast('已删除记录');
  }

  /* ---- 记一笔：整页分类选择器 ---- */
  function openAdd(preset){
    addReturn={tab:accTab,calYM,calSel,svView:Object.assign({},svView)};
    addOpen=true;
    renderAddPage(preset);
  }
  function closeAdd(){
    addOpen=false;editId='';addPreset={};
    if(addReturn){
      accTab=addReturn.tab;calYM=addReturn.calYM;calSel=addReturn.calSel;svView=addReturn.svView;
    }
    render();
  }
  let addPreset={}; // 当前记一笔的表单状态
  function renderAddPage(preset){
    if(preset){
      selType=preset.type||'expense';
      selCat=preset.category||'';
      addPreset={type:selType,category:selCat,date:preset.date||S.today(),note:preset.note||'',travel:!!preset.travel,noBudget:!!preset.noBudget};
    }else if(!addPreset.date){
      addPreset={type:selType||'expense',category:selCat||'',date:S.today(),note:'',travel:false,noBudget:false};
    }
    selType=addPreset.type;selCat=addPreset.category;
    const isEdit=!!editId;
    const footBtns=isEdit
      ? `<div class="add-btn-row"><button class="btn btn-primary add-btn-save" onclick="Acc.saveEditBill()">保存</button><button class="btn btn-ghost add-btn-more" style="color:#e06a80;border-color:#e06a80" onclick="Acc.delBillFromEdit()">删除</button></div>`
      : `<div class="add-btn-row"><button class="btn btn-primary add-btn-save" onclick="Acc.saveBill(false)">保存</button><button class="btn btn-ghost add-btn-more" onclick="Acc.saveBill(true)">再记</button></div>`;
    const el=document.getElementById('page-account');
    el.innerHTML=`<div class="add-page">
      <div class="sv-detail-head add-head">
        <button class="sv-back" onclick="Acc.closeAdd()">${Icon.i('back')}</button>
        <div class="sv-detail-title">${isEdit?'编辑账单':'记一笔'}</div>
        <button class="sv-back" style="visibility:hidden">${Icon.i('back')}</button>
      </div>
      <div class="add-type-bar">
        <div class="add-type ${selType==='expense'?'on':''}" onclick="Acc.switchAddType('expense')">支出</div>
        <div class="add-type ${selType==='income'?'on':''}" onclick="Acc.switchAddType('income')">收入</div>
      </div>
      <div class="add-body">
        <div class="add-cat-grid" id="add-cat-box">${addCatGrid(selType,selCat)}</div>
        <div class="add-fields">
          <div class="add-field" onclick="Acc.pickAddDate()">
            <span class="add-f-lbl">日期</span>
            <input type="hidden" id="bd" value="${addPreset.date}">
            <span class="add-f-val" id="bd-txt">${addPreset.date}</span>
            <span class="add-f-arrow">›</span>
          </div>
          <div class="add-field">
            <span class="add-f-lbl">备注</span>
            <input id="bn" class="add-f-input" placeholder="如 午餐" value="${esc(addPreset.note)}">
          </div>
          <label class="add-check"><input type="checkbox" id="btravel" ${addPreset.travel?'checked':''}> 标记为旅行相关开销</label>
          <label class="add-check"><input type="checkbox" id="bno" ${addPreset.noBudget?'checked':''}> 不计入预算</label>
        </div>
      </div>
      <div class="add-foot">
        <div class="add-amt-bar">
          <span class="add-amt-sign">${selType==='expense'?'-':'+'}</span>
          <input id="ba" class="add-amt" type="number" inputmode="decimal" placeholder="0.00" value="${addPreset.amount||''}">
        </div>
        ${footBtns}
      </div>
      <div id="subcat-pop" class="subcat-pop" style="display:none"></div>
    </div>`;
    setTimeout(()=>{
      const a=document.getElementById('ba');if(a)a.focus();
      document.removeEventListener('click',closeSubOnDoc);
      document.addEventListener('click',closeSubOnDoc);
    },50);
  }
  function addCatGrid(type,sel){
    const list=catsOf(type).filter(c=>!c.parent);
    return list.map(c=>{
      const kids=c.isGroup?leafCats(type).filter(x=>x.parent===c.name):[];
      const hasKids=kids.length>0;
      const on=c.name===sel?' on':'';
      const ico=catIcon(c.icon||c.name);
      return `<div class="add-cat-item${on}${hasKids?' has-kids':''}" data-cat="${esc(c.name)}" data-group="${hasKids?1:0}" onclick="Acc.clickAddCat(this)">
        <div class="add-cat-box"><div class="cat-ico">${ico}${hasKids?'<span class="cat-dots">···</span>':''}</div></div>
        <div class="cat-name">${esc(c.name)}</div>
      </div>`;
    }).join('');
  }
  function switchAddType(t){
    syncAddForm();
    addPreset.type=t;addPreset.category='';selType=t;selCat='';
    renderAddPage();
  }
  function clickAddCat(el){
    const name=el.dataset.cat;
    const isGroup=el.dataset.group==='1';
    if(isGroup){
      const kids=leafCats(selType).filter(x=>x.parent===name);
      showSubcatPop(el,name,kids);
      return;
    }
    selCat=name;addPreset.category=name;
    document.querySelectorAll('.add-cat-item').forEach(x=>x.classList.remove('on'));
    el.classList.add('on');
  }
  function showSubcatPop(el,groupName,kids){
    const pop=document.getElementById('subcat-pop');
    if(!pop)return;
    const rect=el.getBoundingClientRect();
    const grid=document.getElementById('add-cat-box').getBoundingClientRect();
    pop.innerHTML=`<div class="subcat-title">${esc(groupName)}</div>
      <div class="subcat-grid">${kids.map(c=>`<div class="subcat-cell${c.name===selCat?' on':''}" data-cat="${esc(c.name)}" onclick="Acc.pickSubCat(this)">
        <div class="subcat-box">${catIcon(c.icon||c.name)}</div>
        <div class="subcat-name">${esc(c.name)}</div>
      </div>`).join('')}</div>`;
    pop.style.display='block';
    // 气泡水平居中在触发项上方或下方
    const popW=Math.min(320,grid.width-16);
    let left=rect.left+rect.width/2-popW/2;
    left=Math.max(grid.left+8,Math.min(grid.right-popW-8,left));
    let top=rect.bottom+12;
    if(top+180>window.innerHeight)top=Math.max(10,rect.top-180);
    pop.style.width=popW+'px';pop.style.left=left+'px';pop.style.top=top+'px';
  }
  function hideSubcatPop(){
    const pop=document.getElementById('subcat-pop');if(pop)pop.style.display='none';
  }
  function pickSubCat(el){
    syncAddForm();
    const name=el.dataset.cat;
    selCat=name;addPreset.category=name;
    hideSubcatPop();
    renderAddPage();
  }
  function pickAddDate(){
    syncAddForm();
    UI.datePicker(addPreset.date||S.today(),d=>{addPreset.date=d;renderAddPage();},'选择日期');
  }
  function syncAddForm(){
    const a=document.getElementById('ba'); if(a)addPreset.amount=a.value;
    const n=document.getElementById('bn'); if(n)addPreset.note=n.value.trim();
    const tr=document.getElementById('btravel'); if(tr)addPreset.travel=tr.checked;
    const nb=document.getElementById('bno'); if(nb)addPreset.noBudget=nb.checked;
  }
  function saveBill(keepOpen){
    const type=selType;
    const amount=+document.getElementById('ba').value;if(!amount){UI.toast('填个金额吧');return;}
    if(!selCat){UI.toast('点一个分类吧 🏷');return;}
    const category=selCat;
    const date=document.getElementById('bd').value;
    const note=document.getElementById('bn').value.trim();
    const travel=document.getElementById('btravel').checked;
    const noBudget=document.getElementById('bno').checked;
    S.get().bills.push({id:S.uid(),type,amount,category,note,date,travel,noBudget,importSource:''});
    S.save();
    if(keepOpen){
      lastPreset={type,category,date,note,travel,noBudget};
      addPreset={type,category,date,note,travel,noBudget,amount:''};
      renderAddPage();
      UI.toast('已记下，继续记～ 💗');
    }else{
      addOpen=false;addPreset={};
      if(addReturn){accTab=addReturn.tab;calYM=addReturn.calYM;calSel=addReturn.calSel;svView=addReturn.svView;}
      render();
      if(document.getElementById('page-home').classList.contains('active'))Home.render();
      UI.toast('记好啦 💗');
    }
  }
  function closeSubOnDoc(e){
    const pop=document.getElementById('subcat-pop');
    if(pop&&pop.style.display!=='none'&&!pop.contains(e.target)&&!e.target.closest('.add-cat-item'))hideSubcatPop();
  }

  function openEditBill(id){
    const b=S.get().bills.find(x=>x.id===id);if(!b)return;
    addReturn={tab:accTab,calYM,calSel,svView:Object.assign({},svView)};
    editId=id;
    addOpen=true;
    addPreset={type:b.type,category:b.category,date:b.date,note:b.note||'',travel:!!b.travel,noBudget:!!b.noBudget,amount:b.amount};
    selType=b.type;selCat=b.category;
    renderAddPage();
  }
  function editBill(id){openEditBill(id);}
  function saveEditBill(){
    const b=S.get().bills.find(x=>x.id===editId);if(!b)return;
    const amount=+document.getElementById('ba').value;if(!amount){UI.toast('填个金额吧');return;}
    if(!selCat){UI.toast('点一个分类吧 🏷');return;}
    Object.assign(b,{type:selType,amount,category:selCat,date:document.getElementById('bd').value,note:document.getElementById('bn').value.trim(),noBudget:document.getElementById('bno').checked,travel:document.getElementById('btravel').checked});
    S.save();
    editId='';addOpen=false;addPreset={};
    if(addReturn){accTab=addReturn.tab;calYM=addReturn.calYM;calSel=addReturn.calSel;svView=addReturn.svView;}
    render();
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
    UI.toast('已更新');
  }
  function delBillFromEdit(){
    S.get().bills=S.get().bills.filter(b=>b.id!==editId);
    S.save();
    editId='';addOpen=false;addPreset={};
    if(addReturn){accTab=addReturn.tab;calYM=addReturn.calYM;calSel=addReturn.calSel;svView=addReturn.svView;}
    render();
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
    UI.toast('已删除');
  }
  function delBill(id){S.get().bills=S.get().bills.filter(b=>b.id!==id);S.save();UI.close();render();
    if(document.getElementById('page-home').classList.contains('active'))Home.render();}

  /* ---- 预算 ---- */
  function editBudget(){
    UI.modal('<div class="modal-title">🎯 设置月度预算</div>'+
      '<div class="small muted" style="margin-bottom:10px">设定一个舒服的额度，超了也别焦虑，知道钱去哪儿了就好 💗</div>'+
      '<div class="field"><label>本月预算（元）</label><input id="bgt" type="number" inputmode="decimal" value="'+S.get().budget.amount+'" placeholder="如 3000"></div>'+
      '<div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Acc.saveBudget()">保存</button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>');
  }
  function saveBudget(){
    const v=+document.getElementById('bgt').value;
    if(v){S.get().budget.amount=v;S.save();}
    UI.close();render();UI.toast('预算已更新');
    if(window.Home&&document.getElementById('page-home').classList.contains('active'))Home.render();
  }
  function toggleHide(){
    const s=S.get().settings; s.hideMoney=!s.hideMoney; S.save(); render();
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
  }

  /* ---- 分类管理 ---- */
  let mgType='expense';
  function manageCats(t){
    mgType=t||mgType||'expense';
    UI.modal(`<div class="modal-title">🏷 编辑分类</div>
      <div class="field"><div class="seg" id="mg-t">
        <div class="opt ${mgType==='expense'?'on':''}" data-t="expense">支出分类</div>
        <div class="opt ${mgType==='income'?'on':''}" data-t="income">收入分类</div></div></div>
      <div class="small muted" style="margin-bottom:8px">改名字直接在输入框里改；用 ↑↓ 调整排列顺序；点图标可以换一个。</div>
      <div id="mg-list">${mgList()}</div>
      <div class="flex gap8 mt12">
        <button class="btn btn-ghost btn-block" onclick="Acc.addCat()">＋ 新增分类</button>
        <button class="btn btn-primary btn-block" onclick="Acc.saveCats()">保存</button>
      </div>
      <button class="btn btn-ghost btn-block mt8" onclick="Acc.backToAdd()">返回记账</button>`);
    document.querySelectorAll('#mg-t .opt').forEach(o=>o.onclick=()=>{saveCatsSilent();mgType=o.dataset.t;manageCats(mgType);});
  }
  function mgList(){
    const list=catsOf(mgType);
    if(!list.length)return '<div class="small muted">还没有分类，点下面新增一个吧</div>';
    return list.map((c,i)=>`<div class="mg-row" data-id="${c.id}">
      <div class="mg-ico" onclick="Acc.pickIcon('${c.id}')">${catIcon(c.icon||c.name)}</div>
      <input class="mg-name" value="${(c.name||'').replace(/"/g,'&quot;')}" maxlength="8">
      <button class="mg-btn" onclick="Acc.moveCat('${c.id}',-1)" ${i===0?'disabled':''}>↑</button>
      <button class="mg-btn" onclick="Acc.moveCat('${c.id}',1)" ${i===list.length-1?'disabled':''}>↓</button>
      ${c.isGroup?'':`<button class="mg-btn exb ${c.exb?'on':''}" onclick="Acc.toggleExb('${c.id}')" title="不计入预算">${c.exb?'不计':'计入'}</button>`}
      <button class="mg-btn del" onclick="Acc.delCat('${c.id}')">✕</button>
    </div>`).join('');
  }
  function refreshMg(){const b=document.getElementById('mg-list');if(b){b.innerHTML=mgList();if(window.Icon)Icon.upgrade(b);}}
  function saveCatsSilent(){
    const rows=document.querySelectorAll('#mg-list .mg-row');
    if(!rows.length)return;
    const list=catsOf(mgType);
    rows.forEach(r=>{
      const c=list.find(x=>x.id===r.dataset.id);
      if(!c)return;
      const v=r.querySelector('.mg-name').value.trim();
      if(v&&v!==c.name){
        const old=c.name; c.name=v;
        S.get().bills.forEach(b=>{if(b.category===old)b.category=v;});
      }
    });
    S.save();
  }
  function saveCats(){saveCatsSilent();UI.close();render();UI.toast('分类已更新 🏷');}
  function moveCat(id,dir){
    saveCatsSilent();
    const list=catsOf(mgType);
    const i=list.findIndex(x=>x.id===id);
    const j=i+dir;
    if(i<0||j<0||j>=list.length)return;
    const tmp=list[i];list[i]=list[j];list[j]=tmp;
    S.save();refreshMg();
  }
  function delCat(id){
    saveCatsSilent();
    const list=catsOf(mgType);
    const c=list.find(x=>x.id===id);if(!c)return;
    const used=S.get().bills.filter(b=>b.category===c.name).length;
    if(used){UI.toast('「'+c.name+'」还有 '+used+' 笔账单，先改掉再删');return;}
    const i=list.indexOf(c);list.splice(i,1);
    S.save();refreshMg();
  }
  function toggleExb(id){
    saveCatsSilent();
    const c=catsOf(mgType).find(x=>x.id===id);
    if(c){c.exb=!c.exb;S.save();refreshMg();}
  }
  function addCat(){
    saveCatsSilent();
    catsOf(mgType).push({id:S.uid(),name:'新分类',icon:'其他'});
    S.save();refreshMg();
  }
  function pickIcon(id){
    saveCatsSilent();
    const keys=Object.keys(window.CAT_ICONS||{});
    UI.modal('<div class="modal-title">选个图标</div><div class="cat-grid">'+
      keys.map(k=>`<div class="cat-item" onclick="Acc.setIcon('${id}','${k}')"><div class="cat-ico">${catIcon(k)}</div><div class="cat-name">${k}</div></div>`).join('')+
      '</div><button class="btn btn-ghost btn-block mt12" onclick="Acc.manageCats()">返回</button>');
  }
  function setIcon(id,key){
    const c=catsOf(mgType).find(x=>x.id===id);
    if(c)c.icon=key;
    S.save();manageCats(mgType);
  }
  function backToAdd(){UI.close();openAdd();}

  /* ---- AI 简报 / 导入（保持原样） ---- */
  function genBrief(){
    const content=AI.expenseBrief();
    S.get().reviews.push({id:S.uid(),type:'account',date:S.today(),content,modules:['记账']});S.save();
    UI.modal('<div class="modal-title">💰 AI 消费简报</div><div class="review-box">'+content.replace(/\n/g,'<br>')+'</div><button class="btn btn-primary btn-block mt12" onclick="UI.close()">收下 💗</button>');
  }
  function openImport(){
    const n=S.get().bills.filter(b=>b.importSource==='导入').length;
    UI.modal('<div class="modal-title">📥 导入账单</div>'+
      '<div class="small muted mb8">只支持本地导出的账单文件（微信支付 / 支付宝的 CSV、Excel），全部在浏览器本地解析，不上传服务器 🔒。微信聊天框里的零散账目请先「导出账单文件」或整理成 CSV 后粘贴。</div>'+
      '<input type="file" id="imp-file" accept=".csv,.xlsx,.xls" style="font-size:13px">'+
      '<div class="small muted mt8">也可直接粘贴 CSV 文本（格式：日期,收支,金额,分类,备注）：</div>'+
      '<textarea id="imp-text" rows="3" placeholder="2026-08-05,支出,12.50,奶茶,下午茶"></textarea>'+
      '<div class="flex gap8 mt8"><button class="btn btn-primary btn-block" onclick="Acc.runImport()">解析预览</button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>'+
      (n?`<button class="btn btn-ghost btn-block mt8" style="color:#e06a80;border-color:#e06a80" onclick="Acc.clearImported()">🗑 清空之前导入的 ${n} 条账单</button>`:''));
    document.getElementById('imp-file').addEventListener('change',e=>{
      const f=e.target.files[0];if(!f)return;
      const isXls=/\.xlsx?$/i.test(f.name);
      const done=rows=>showPreview(rows,f.name);
      if(isXls)parseXlsx(f).then(done).catch(err=>UI.toast('解析失败：'+err.message));
      else f.text().then(txt=>done(parseCsv(txt)));
    });
  }
  function clearImported(){
    const before=S.get().bills.length;
    S.get().bills=S.get().bills.filter(b=>b.importSource!=='导入');
    const removed=before-S.get().bills.length;
    S.save();render();
    UI.toast('已删除 '+removed+' 条导入账单');
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
  }
  function parseCsv(txt){
    const lines=(''+txt).replace(/\r/g,'').split('\n');
    const rows=[];
    for(const line of lines){
      if(!line.trim())continue;
      const row=[];let cur='';let q=false;
      for(let i=0;i<line.length;i++){
        const ch=line[i];
        if(q){
          if(ch==='"'){ if(line[i+1]==='"'){cur+='"';i++;} else q=false; }
          else cur+=ch;
        }else{
          if(ch==='"')q=true;
          else if(ch===','){row.push(cur);cur='';}
          else cur+=ch;
        }
      }
      row.push(cur);
      rows.push(row.map(c=>c.trim()));
    }
    return rows;
  }
  function pad2(n){n=''+n;return n.length<2?'0'+n:n;}
  function parseMoney(s){
    if(s==null)return null;
    let t=(''+s).trim().replace(/[¥$,\s元]/g,'');
    if(t==='')return null;
    const neg=t[0]==='-' || t[0]==='(';
    t=t.replace(/^[-(]/,'').replace(/\)$/,'');
    if(!/^\d+(\.\d+)?$/.test(t))return null;
    const n=parseFloat(t);
    if(isNaN(n)||n<=0)return null;
    if(n>1e8)return null;
    return neg?-n:n;
  }
  function parseDate(s){
    if(s==null)return '';
    const t=(''+s).trim();
    let m;
    // 2026-08-05 / 2026/08/05 / 2026.08.05 / 2026年08月05日（可带时间）
    if((m=t.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/))) return m[1]+'-'+pad2(m[2])+'-'+pad2(m[3]);
    // 08-05 / 08/05（当年）
    if((m=t.match(/(\d{1,2})[-/](\d{1,2})(?!\d)/))) return S.today().slice(0,4)+'-'+pad2(m[1])+'-'+pad2(m[2]);
    return '';
  }
  function detectHeader(cells){
    const cols={};
    cells.forEach((c,i)=>{
      const h=(''+c).trim().replace(/\s+/g,'');
      if(/^(交易时间|记账时间|创建时间|入账时间|付款时间|时间|日期)$/.test(h)) cols.date=i;
      else if(/^(金额|金额\(元\)|金额（元）|实付金额|实收金额|交易金额|应收金额|总额|数额|总价|付款金额)$/.test(h)) cols.amount=i;
      else if(/^(收\/支|收支|收付款|收付方向|资金流向|类型)$/.test(h)) cols.type=i;
      else if(/^(交易分类|交易类型|分类|类目|账单分类)$/.test(h)) cols.cat=i;
      else if(/^(商品名称|商品|交易对方|对方|商户|店名|商家|交易对方全称)$/.test(h)) cols.merchant=i;
      else if(/^(备注|备注信息|说明|摘要|备注说明)$/.test(h)) cols.note=i;
    });
    return cols;
  }
  const CAT_KEYWORDS=[
    [['早餐','早饭','早点'],'早餐'],[['午餐','午饭','中饭'],'午餐'],[['晚餐','晚饭','夜宵'],'晚餐'],
    [['奶茶','咖啡','饮料'],'奶茶'],[['甜品','蛋糕','面包'],'甜品'],[['水果'],'水果'],
    [['零食','小吃'],'零食'],[['食材','菜','生鲜'],'食材'],
    [['餐','餐饮','美食','饭店','餐厅','外卖','食堂'],'其他'],
    [['日用品','日用','超市','百货','杂货'],'日用品'],[['团购','拼团'],'团购'],
    [['出去玩','玩','旅游','旅行','景点','门票','酒店'],'出去玩'],[['电影','游戏','娱乐','KTV','演出'],'出去玩'],
    [['话费','流量','通讯','宽带'],'话费'],[['服饰','衣服','服装','鞋','包'],'服饰'],
    [['美妆','化妆','护肤','美容'],'美妆'],[['家庭','家居','物业','房租','水电','燃气'],'家庭'],
    [['停车'],'停车'],[['洗车','修车','汽配','加油','车'],'洗车'],[['减肥','健身','运动'],'减肥'],
    [['社交','请客','礼物','人情','聚会'],'社交'],[['医疗','医院','药店','药','保健','诊所'],'医疗'],
    [['学习','教育','书','课程','培训','网课','资料'],'学习'],[['信用卡','还款','分期'],'信用卡'],
    [['工资','薪资','奖金','薪酬'],'工资'],[['兼职','外快'],'兼职'],[['红包'],'红包'],
    [['理财','基金','股票','投资','证券'],'理财']
  ];
  function mapCat(text){
    if(!text)return '其他';
    for(const [kws,cat] of CAT_KEYWORDS){ for(const kw of kws){ if((''+text).indexOf(kw)>=0) return cat; } }
    return '其他';
  }
  async function parseXlsx(file){
    await ensureXlsx();
    const buf=await file.arrayBuffer();
    const wb=window.XLSX.read(buf,{type:'array'});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const json=window.XLSX.utils.sheet_to_json(ws,{header:1});
    return json.map(r=>r.map(c=>c==null?'':(''+c).trim()));
  }
  function ensureXlsx(){
    if(window.XLSX)return Promise.resolve();
    return new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload=res;s.onerror=()=>rej(new Error('网络加载失败，请用CSV'));
      document.head.appendChild(s);
    });
  }
  function mapRow(cells,hdr,source){
    let date='',amount=0,type='expense',category='其他',note='',merchant='';
    // 金额
    if(hdr && typeof hdr.amount==='number'){
      const m=parseMoney(cells[hdr.amount]);
      if(m!=null){ amount=Math.abs(m); if(m<0) type='expense'; }
    }
    if(!amount){
      let best=null;
      cells.forEach(c=>{
        if(/余额/.test(c))return; // 跳过「余额」列，避免误把账户余额当成消费金额
        const m=parseMoney(c); if(m==null)return;
        const s=(''+c).replace(/[^\d.]/g,'');
        const dec=(s.split('.')[1]||'').length;
        const score=(dec===2?2:1)+(Math.abs(m)<10000?1:0);
        if(best===null||score>best.score) best={n:Math.abs(m),score};
      });
      if(best) amount=best.n;
    }
    // 日期
    if(hdr && typeof hdr.date==='number') date=parseDate(cells[hdr.date]);
    if(!date){ for(const c of cells){ const d=parseDate(c); if(d){date=d;break;} } }
    // 收支类型
    if(hdr && typeof hdr.type==='number'){
      const tv=(''+(cells[hdr.type]||'')).trim();
      if(/收入|收起|进账|收款|存入|转入/.test(tv)) type='income';
      else if(/支出|付出|付款|代扣|转出|消费/.test(tv)) type='expense';
      else if(/\//.test(tv) || tv==='') type='expense'; // 转账等默认支出，后续按 skip 过滤
    }
    // 兜底：整行关键词再判断一次
    if(type==='expense'){
      const j=cells.join(' ');
      if(/(收入|收款|进账|工资|红包|退款|转入|存入)/.test(j) && !/(支出|付款|消费|转出|扣款|代付)/.test(j)) type='income';
    }
    // 分类
    if(hdr && typeof hdr.cat==='number') category=mapCat(cells[hdr.cat]);
    else { for(const c of cells){ const cat=mapCat(c); if(cat!=='其他'){category=cat;break;} } }
    // 商户/备注
    if(hdr){
      if(typeof hdr.merchant==='number') merchant=(''+(cells[hdr.merchant]||'')).replace(/\s+/g,' ').trim();
      if(typeof hdr.note==='number') note=(''+(cells[hdr.note]||'')).replace(/\s+/g,' ').trim();
    }else{
      for(const c of cells){
        const s=(''+c).trim();
        if(/[一-龥]{2,}/.test(s) && !/日期|收支|金额|分类|备注|交易|时间/.test(s) && parseMoney(s)==null){
          if(!merchant) merchant=s; else if(!note) note=s;
        }
      }
    }
    note=note||merchant||'';
    const skip=/转账|红包|退款|信用卡还款/.test(cells.join(' '));
    return {date:date||S.today(),type,amount:Math.round(amount*100)/100,category,note,skip};
  }
  function showPreview(rows,source){
    if(!rows||!rows.length){UI.toast('没解析到数据');return;}
    let hdr=null, data=rows;
    if(rows.length>1){
      const h=detectHeader(rows[0]);
      if(h.date!=null||h.amount!=null||h.type!=null){ hdr=h; data=rows.slice(1); }
    }
    const mapped=data.map(r=>mapRow(r,hdr,source));
    const hdrTxt = hdr
      ? '已识别表头：日期'+(hdr.amount!=null?'/金额':'')+(hdr.type!=null?'/收支':'')+(hdr.cat!=null?'/分类':'')+(hdr.merchant!=null?'/商户':'')+' 列'
      : '未识别到表头，已用启发式识别';
    let html='<div class="modal-title">导入预览（'+source+'）</div><div class="small muted mb8">'+hdrTxt+'；可逐条改分类 / 取消勾选，转账红包退款默认不导入</div>';
    html+='<div class="prev-list">';
    mapped.forEach((m,i)=>{
      html+=`<div class="prev-item" data-i="${i}">
        <input type="checkbox" ${m.skip?'':'checked'} data-skip>
        <span style="width:84px">${m.date}</span>
        <span style="width:40px;color:${m.type==='expense'?'#e98aa0':'#3b9e6b'}">${m.type==='expense'?'-':'+'}¥${m.amount.toFixed(2)}</span>
        <select data-cat>${allNames().map(c=>`<option ${c===m.category?'selected':''}>${c}</option>`).join('')}</select>
        <span style="flex:1;color:var(--text2)">${esc(m.note)}</span>
      </div>`;
    });
    html+='</div>';
    html+='<div class="flex gap8 mt12"><button class="btn btn-primary btn-block" onclick="Acc.confirmImport()">确认导入 <span id="imp-cnt">'+mapped.filter(m=>!m.skip).length+'</span></button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>';
    UI.modal(html);
    window._importRows=mapped;
    document.querySelectorAll('.prev-item').forEach(it=>{
      it.querySelector('[data-skip]').addEventListener('change',updCnt);
      it.querySelector('[data-cat]').addEventListener('change',e=>{window._importRows[+it.dataset.i].category=e.target.value;});
    });
  }
  function updCnt(){
    const cnt=[...document.querySelectorAll('.prev-item [data-skip]')].filter(c=>c.checked).length;
    document.getElementById('imp-cnt').textContent=cnt;
  }
  function confirmImport(){
    const rows=window._importRows||[];
    let added=0;
    rows.forEach(m=>{
      if(!m.skip && m.amount>0){
        const dup=S.get().bills.some(b=>b.date===m.date&&b.amount===m.amount&&b.note===m.note);
        if(!dup){S.get().bills.push({id:S.uid(),type:m.type,amount:m.amount,category:m.category,note:m.note,date:m.date,travel:false,importSource:'导入'});added++;}
      }
    });
    S.save();UI.close();render();
    UI.toast('成功导入 '+added+' 条 💗');
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
  }
  function runImport(){
    const txt=document.getElementById('imp-text').value.trim();
    if(!txt){UI.toast('请选择文件或粘贴文本');return;}
    showPreview(parseCsv(txt),'粘贴文本');
  }

  /* ---- 整库备份 / 恢复（迁移用） ---- */
  let _restoreText=null;
  function backup(){
    try{
      const json=S.exportJSON();
      const blob=new Blob([json],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      const d=(S.today()||'').replace(/-/g,'');
      a.href=url; a.download='mumu-workbench-'+(d||'backup')+'.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>{try{URL.revokeObjectURL(url);}catch(e){}},1000);
      UI.toast('已导出备份文件 💾');
    }catch(e){ console.error(e); UI.toast('备份失败：'+(e&&e.message||e)); }
  }
  function restore(){
    _restoreText=null;
    UI.modal(`<div class="modal-title">⚠️ 从备份恢复数据</div>
      <div class="small muted">选择之前导出的备份文件（.json）。恢复会用备份<b>整体替换</b>当前这台设备上的全部数据，建议先点「备份到文件」存一份当前数据再恢复。</div>
      <div class="field mt12"><input id="bk-file" type="file" accept="application/json,.json" onchange="Acc._onFile(this)"></div>
      <div id="bk-msg" class="small muted" style="min-height:18px"></div>
      <div class="flex gap8 mt12">
        <button class="btn btn-primary btn-block" onclick="Acc._doRestore()">确认恢复</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
  }
  function _onFile(input){
    const f=input.files&&input.files[0]; if(!f){_restoreText=null;return;}
    const r=new FileReader();
    r.onload=()=>{ _restoreText=String(r.result||''); const m=document.getElementById('bk-msg'); if(m)m.textContent='已读取：'+f.name+'（'+(_restoreText.length)+' 字符）'; };
    r.onerror=()=>{ _restoreText=null; const m=document.getElementById('bk-msg'); if(m)m.textContent='读取失败，请重试'; };
    r.readAsText(f);
  }
  function _doRestore(){
    if(!_restoreText){ UI.toast('请先选择备份文件'); return; }
    try{
      S.importJSON(_restoreText);
      _restoreText=null; UI.close();
      ['Home','Todo','Fat','Acc','Food','Travel','Study','Period','Poop','Reading'].forEach(n=>{try{window[n]&&window[n].render&&window[n].render();}catch(e){}});
      if(window.Home)try{Home.render();}catch(e){}
      if(window.Nav&&Nav.refresh)try{Nav.refresh();}catch(e){}
      UI.toast('已从备份恢复全部数据 ✅');
    }catch(e){ console.error(e); UI.toast('恢复失败：'+(e&&e.message||e)); }
  }

  window.Acc={render,setTab,shiftMonth,goCalToday,pickMonth,pickCalDate,
    toggleHide,openAdd,saveBill,editBill,openEditBill,saveEditBill,delBillFromEdit,delBill,genBrief,openImport,runImport,confirmImport,clearImported,
    searchBills,openComposition,exportBills,
    renderAll,applyAllFilter,resetAllFilter,pickFrom,pickTo,allMore,
    pickCat,switchType,manageCats,saveCats,moveCat,delCat,addCat,pickIcon,setIcon,backToAdd,toggleExb,editBudget,saveBudget,
    openSaving,saveSaving,openPlan,backSavings,planMore,archivePlan,delPlan,doDelPlan,openDeposit,saveDeposit,editDeposit,saveDepositEdit,withdrawDeposit,delDeposit,svSwitch,scrollArchived,toggleArchived,openArchived,renderArchivedPlans,movePlan,planSortMenu,bindPlanGestures,
    svfSetMode,svfRecalc,svfPickDate,svfPickPeriod,svfSetPeriod,svfFixedLabel,openIconPicker,pickSvIcon,computeTarget,
    closeAdd,renderAddPage,addCatGrid,switchAddType,clickAddCat,showSubcatPop,hideSubcatPop,pickSubCat,pickAddDate,closeSubOnDoc,
    backup,restore,_onFile,_doRestore};
})();
