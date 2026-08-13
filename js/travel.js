/* ============ 旅游计划模块 ============ */
(function(){
  const S=window.Store, I=window.Icon, AI=window.AI;
  let tab='upcoming';
  let viewId=null; // 当前进入的旅行计划详情 id
  const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function render(){
    if(viewId){renderPlan(viewId);return;}
    renderList();
  }
  function backList(){viewId=null;render();}
  function renderList(){
    const tr=S.get().travels;
    const total=tr.length;
    const up=tr.filter(t=>t.status==='upcoming').length;
    const done=tr.filter(t=>t.status==='archived').length;
    const budgetSum=tr.reduce((s,t)=>s+(+t.budget||0),0);

    const list=tr.filter(t=>t.status===tab);
    let html=`
      <div class="page-head">
        <div class="date-line">${S.fmtCN(S.today())} ${S.weekCN(S.today())} · 去看世界，也好好看自己 🧳</div>
        <div class="title">旅行计划</div>
      </div>

      <div class="stat-row">
        <div class="stat"><div class="emoji">🗺️</div><div class="num">${total}</div><div class="lbl">计划总数</div></div>
        <div class="stat"><div class="emoji">✈️</div><div class="num">${up}</div><div class="lbl">待出行</div></div>
        <div class="stat"><div class="emoji">🏁</div><div class="num">${done}</div><div class="lbl">已完成</div></div>
        <div class="stat"><div class="emoji">💰</div><div class="num">¥${budgetSum}</div><div class="lbl">累计预算</div></div>
      </div>

      <div class="subtabs">
        <button class="${tab==='upcoming'?'on':''}" onclick="Trav.setTab('upcoming')">待出行</button>
        <button class="${tab==='archived'?'on':''}" onclick="Trav.setTab('archived')">已归档</button>
      </div>

      <div class="card ai-trav-card">
        <div class="card-h"><div class="l"><span class="ico">✨</span>AI 旅行攻略</div>
          <span class="pill">越具体越好用</span></div>
        <div class="small muted" style="line-height:1.6">告诉我：<b>从哪出发</b>、<b>几点走</b>、<b>怎么去</b>、<b>去哪玩几天</b>、<b>预算多少</b>，
          我帮你排好每天上午/中午/下午/晚上的安排，还有预算拆解和打包清单 🧳</div>
        <button class="btn btn-primary btn-block mt12" onclick="Trav.aiGen()">✨ 生成我的旅行攻略</button>
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🧳</span>我的旅行清单</div>
          <span class="pill" onclick="Trav.newTravel()">＋ 新建</span></div>
        <div class="tag-row">
          ${list.length?list.map(t=>{
            const total=t.pack.length,packed=t.pack.filter(p=>p.done).length;
            const p=total?Math.round(packed/total*100):0;
            return `<span class="tag peach" onclick="Trav.open('${t.id}')">${t.dest} <span class="small">${p}%</span> ›</span>`;
          }).join(''):'<span class="small muted">还没有旅行计划，点「新建」或让 AI 帮你生成 ✨</span>'}
        </div>
      </div>

      <div class="trav-list">
        ${list.length?list.map(t=>card(t)).join(''):'<div class="card"><div class="empty">'+I.EMPTY.replace('width="120"','width="80"')+'<p>这里还空空的，去创造一个目的地吧 🌸</p></div></div>'}
      </div>
    `;
    document.getElementById('page-travel').innerHTML=html;
    bindTravelCards();
  }
  let drag=null, blockClicks=false;
  /* 轻点进入旅行计划页面；长按拖动排序 */
  function bindTravelCards(){
    document.querySelectorAll('#page-travel .trav-card').forEach(el=>{
      if(el.dataset.bound)return;el.dataset.bound='1';
      const id=el.dataset.id;if(!id)return;
      let timer=null,sx=0,sy=0,long=false,moved=false,captured=false;
      const start=(x,y)=>{long=false;moved=false;sx=x;sy=y;timer=setTimeout(()=>{timer=null;long=true;startDrag(el,id);},480);};
      const cancel=()=>{if(timer){clearTimeout(timer);timer=null;}};
      el.addEventListener('pointerdown',e=>{
        if(blockClicks||drag||e.pointerType==='mouse'&&e.button!==0)return;
        try{el.setPointerCapture(e.pointerId);captured=true;}catch(_){}
        start(e.clientX,e.clientY);
      });
      el.addEventListener('pointermove',e=>{
        if(drag){e.preventDefault();moveDrag(e.clientY);return;}
        if(!timer)return;
        if(Math.abs(e.clientX-sx)>10||Math.abs(e.clientY-sy)>10){moved=true;cancel();}
      });
      el.addEventListener('pointerup',e=>{
        if(captured){try{el.releasePointerCapture(e.pointerId);}catch(_){}captured=false;}
        if(drag){endDrag();return;}
        cancel();
        if(!long&&!moved)open(id);
      });
      el.addEventListener('pointercancel',()=>{
        if(captured){try{el.releasePointerCapture(e.pointerId);}catch(_){}captured=false;}
        cancel();endDrag();
      });
      el.addEventListener('contextmenu',e=>{e.preventDefault();cancel();});
    });
  }
  function startDrag(el,id){
    if(drag)return;
    const rect=el.getBoundingClientRect();
    const clone=el.cloneNode(true);
    clone.classList.add('trav-drag-clone');
    clone.style.cssText=`position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;z-index:1000;pointer-events:none;opacity:.95;transform:scale(1.03);box-shadow:0 10px 30px rgba(0,0,0,.18);`;
    document.body.appendChild(clone);
    el.classList.add('trav-dragging');
    drag={id,el,clone,origY:rect.top+rect.height/2,origIdx:travIndex(id)};
  }
  function moveDrag(y){
    if(!drag)return;
    const rect=drag.el.getBoundingClientRect();
    drag.clone.style.top=(rect.top+(y-drag.origY))+'px';
    document.querySelectorAll('#page-travel .trav-card').forEach(c=>c.classList.remove('trav-drop-target'));
    const target=dropTarget(y);
    if(target&&target!==drag.el)target.classList.add('trav-drop-target');
  }
  function endDrag(){
    if(!drag)return;
    const y=parseFloat(drag.clone.style.top)+drag.clone.getBoundingClientRect().height/2;
    const target=dropTarget(y);
    const from=drag.origIdx;
    let to=from;
    if(target){to=travIndex(target.dataset.id);}
    if(to!==from)reorderTravels(from,to);
    drag.clone.remove();drag.el.classList.remove('trav-dragging');
    document.querySelectorAll('#page-travel .trav-card').forEach(c=>c.classList.remove('trav-drop-target'));
    drag=null;blockClicks=true;setTimeout(()=>blockClicks=false,400);render();
  }
  function dropTarget(y){
    const cards=[...document.querySelectorAll('#page-travel .trav-card:not(.trav-dragging)')];
    for(const c of cards){const r=c.getBoundingClientRect();if(y<r.top+r.height/2)return c;}
    return cards[cards.length-1]||null;
  }
  function travIndex(id){return S.get().travels.findIndex(t=>t.id===id);}
  function reorderTravels(from,to){
    const arr=S.get().travels;const [item]=arr.splice(from,1);arr.splice(to,0,item);S.save();
  }
  function card(t){
    const packed=t.pack.filter(p=>p.done).length;const p=t.pack.length?Math.round(packed/t.pack.length*100):0;
    return `<div class="card trav-card" data-id="${t.id}">
      <div class="flex between center">
        <div><div style="font-weight:600;font-size:16px">${t.title}</div>
          <div class="small muted">${t.dest} · ${dateTxt(t)} · ¥${t.budget||0}</div></div>
        <span class="pill">打包 ${p}%</span>
      </div>
    </div>`;
  }
  function dateTxt(t){ if(!t.start&&!t.end)return "时间待定"; if(t.start&&!t.end)return t.start+" 出发"; if(!t.start&&t.end)return "至 "+t.end; return t.start+" ~ "+t.end; }
  function setTab(x){tab=x;render();}

  function newTravel(){
    UI.modal(`<div class="modal-title">新建旅行</div>
      <div class="field"><label>旅行名称</label><input id="tt" placeholder="如 春日京都行"></div>
      <div class="field"><label>目的地</label><input id="td" placeholder="如 京都"></div>
      <div class="grid2">
        <div class="field"><label>出发（可不填）</label><input id="ts" type="date"></div>
        <div class="field"><label>返程（可不填）</label><input id="te" type="date"></div>
      </div>
      <div class="small muted" style="margin:-4px 0 10px">时间还没定也没关系，先把想去的地方记下来 🌿</div>
      <div class="field"><label>预算(¥)</label><input id="tb" type="number" placeholder="如 5000"></div>
      <div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Trav.saveTravel()">创建</button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>`);
  }
  function saveTravel(){
    const title=document.getElementById('tt').value.trim()||'我的旅行';
    const dest=document.getElementById('td').value.trim()||'未知';
    const start=document.getElementById('ts').value,end=document.getElementById('te').value;
    const budget=+document.getElementById('tb').value||0;
    S.get().travels.push({id:S.uid(),title,status:'upcoming',dest,start,end,budget,days:[],pack:[],billIds:[],notes:'',tip:''});
    S.save();UI.close();render();UI.toast('旅行已创建 ✈️');
  }

  function open(id){viewId=id;render();}
  function renderPlan(id){
    const t=S.get().travels.find(x=>x.id===id);if(!t){backList();return;}
    const packed=t.pack.filter(p=>p.done).length;
    // 旅行开销统计：标记为旅行且日期在区间内
    let exp=0;S.get().bills.forEach(b=>{if(b.travel&&t.start&&b.date>=t.start&&(!t.end||b.date<=t.end))exp+=b.amount;});
    const tip=t.tip||AI.travelTip(t.dest);
    let html=`
      <div class="sv-detail-head">
        <button class="sv-back" onclick="Trav.backList()">${I.i('back')}</button>
        <div class="sv-detail-title">${esc(t.title)}</div>
        <button class="sv-more" onclick="Trav.planMore('${id}')">${I.i('more')}</button>
      </div>
      <div class="trav-plan-body">
      <div class="card">
        <div class="flex between"><b>📍 ${t.dest}</b><span class="pill">${t.status==='upcoming'?'待出行':'已归档'}</span></div>
        <div class="small muted mt8">📅 ${dateTxt(t)} · 💰 预算 ¥${t.budget||0} · 已花 ¥${exp}</div>
        <div class="flex gap8 mt12">
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="Trav.editPlan('${id}')">编辑信息</button>
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="Trav.toggleArch('${id}')">${t.status==='upcoming'?'归档':'恢复'}</button>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">📝</span>每日行程</div>
          <span class="pill" onclick="Trav.addDay('${id}')">＋</span></div>
        ${t.days.length?t.days.map((d,i)=>`<div class="small" style="margin:6px 0"><b>${d.date||'Day'+(i+1)}</b>：${d.plan||''} <span class="pill" onclick="Trav.delDay('${id}',${i})">✕</span></div>`).join(''):'<div class="small muted">还没有行程，点「＋」添加</div>'}
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🎒</span>打包清单（${packed}/${t.pack.length}）</div>
          <span class="pill" onclick="Trav.addPack('${id}')">＋</span></div>
        ${t.pack.length?t.pack.map((p,i)=>`<div class="row" data-pk="${i}">
          <div class="row-actions"><button class="edit" onclick="Trav.editPack('${id}',${i})">编辑</button><button class="del" onclick="Trav.delPack('${id}',${i})">删除</button></div>
          <div class="row-inner" onclick="Trav.togPack('${id}',${i})">
            <div class="cbox ${p.done?'on':''}"></div>
            <div style="flex:1;text-decoration:${p.done?'line-through':''};color:${p.done?'var(--text3)':'var(--text)'}">${p.text}</div></div></div>`).join(''):'<div class="small muted">清单空空，先加几样吧</div>'}
        <button class="btn btn-ghost btn-block mt8" onclick="Trav.packToTodo('${id}')">📋 打包清单一键导入待办</button>
      </div>

      ${t.notes?`<div class="card">
        <div class="card-h"><div class="l"><span class="ico">✨</span>完整攻略</div></div>
        <div class="small muted">已生成含行前概览、预算拆解、逐日安排的完整攻略</div>
        <button class="btn btn-ghost btn-block mt8" onclick="Trav.showPlan('${id}')">📖 查看完整攻略</button>
      </div>`:''}

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🤖</span>AI 出行建议</div></div>
        <div class="review-box">${tip.replace(/\n/g,'<br>')}</div>
        <button class="btn btn-primary btn-block mt8" onclick="Trav.genTip('${id}')">🔄 重新生成建议</button>
      </div>

      <div class="flex gap8">
        <button class="btn btn-primary btn-block" onclick="Trav.brief('${id}')">✨ 生成旅行简报</button>
        <button class="btn btn-ghost btn-block" style="color:#e06a80;border-color:#e06a80" onclick="Trav.delTravel('${id}')">🗑 删除计划</button>
      </div>
      </div>
    `;
    document.getElementById('page-travel').innerHTML=html;
    document.querySelectorAll('[data-pk] .row-inner').forEach(r=>UI.swipe(r,()=>r.closest('.row').classList.add('swiped'),()=>r.closest('.row').classList.remove('swiped')));
  }
  function planMore(id){
    const t=S.get().travels.find(x=>x.id===id);if(!t)return;
    const arch=t.status==='upcoming'?`<button class="sheet-btn" onclick="Trav.toggleArch('${id}');UI.close();">📥 归档</button>`:`<button class="sheet-btn" onclick="Trav.toggleArch('${id}');UI.close();">♻️ 恢复</button>`;
    UI.modal(`<div class="modal-title">${esc(t.title)}</div>
      <div class="sheet">
        <button class="sheet-btn" onclick="Trav.editPlan('${id}');UI.close();">✏️ 编辑信息</button>
        ${arch}
        <button class="sheet-btn danger" onclick="Trav.delTravel('${id}')">🗑 删除计划</button>
        <button class="sheet-btn ghost" onclick="UI.close()">取消</button>
      </div>`);
  }

  function editPlan(id){
    const t=S.get().travels.find(x=>x.id===id);if(!t)return;
    UI.modal(`<div class="modal-title">编辑旅行信息</div>
      <div class="field"><label>名称</label><input id="tt" value="${t.title}"></div>
      <div class="field"><label>目的地</label><input id="td" value="${t.dest}"></div>
      <div class="grid2"><div class="field"><label>出发</label><input id="ts" type="date" value="${t.start||''}"></div><div class="field"><label>返程</label><input id="te" type="date" value="${t.end||''}"></div></div>
      <div class="field"><label>预算</label><input id="tb" type="number" value="${t.budget||0}"></div>
      <div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Trav.updPlan('${id}')">保存</button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>`);
  }
  function updPlan(id){
    const t=S.get().travels.find(x=>x.id===id);if(!t)return;
    t.title=document.getElementById('tt').value.trim()||t.title;
    t.dest=document.getElementById('td').value.trim()||t.dest;
    t.start=document.getElementById('ts').value;t.end=document.getElementById('te').value;
    t.budget=+document.getElementById('tb').value||0;
    S.save();UI.close();render();UI.toast('已更新');
  }
  function toggleArch(id){const t=S.get().travels.find(x=>x.id===id);if(!t)return;t.status=t.status==='upcoming'?'archived':'upcoming';S.save();UI.close();render();}
  function delTravel(id){
    S.get().travels=S.get().travels.filter(x=>x.id!==id);
    if(viewId===id)viewId=null;
    S.save();UI.close();render();
    UI.toast('已删除旅行计划 🗑');
  }
  function addDay(id){
    UI.modal('<div class="modal-title">添加行程</div><div class="field"><label>日期</label><input id="dd" type="date"></div><div class="field"><label>安排</label><input id="dp" placeholder="如 逛清水寺，晚上吃和牛"></div><div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Trav.saveDay(\''+id+'\')">保存</button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>');
  }
  function saveDay(id){
    const t=S.get().travels.find(x=>x.id===id);if(!t)return;
    t.days.push({date:document.getElementById('dd').value,plan:document.getElementById('dp').value.trim()});
    S.save();UI.close();open(id);
  }
  function delDay(id,i){const t=S.get().travels.find(x=>x.id===id);if(!t)return;t.days.splice(i,1);S.save();open(id);}
  function addPack(id){
    UI.modal('<div class="modal-title">添加打包项</div><div class="field"><input id="pk" placeholder="如 充电器、护照、面膜"></div><div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Trav.savePack(\''+id+'\')">添加</button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>');
  }
  function savePack(id){
    const t=S.get().travels.find(x=>x.id===id);if(!t)return;
    const v=document.getElementById('pk').value.trim();if(!v){UI.toast('填点啥');return;}
    v.split(/[，,、]/).forEach(x=>{if(x.trim())t.pack.push({id:S.uid(),text:x.trim(),done:false});});
    S.save();UI.close();open(id);
  }
  function editPack(id,i){
    const t=S.get().travels.find(x=>x.id===id);if(!t)return;const p=t.pack[i];
    UI.modal('<div class="modal-title">编辑打包项</div><div class="field"><input id="pke" value="'+p.text+'"></div><div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Trav.updPack(\''+id+'\','+i+')">保存</button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>');
  }
  function updPack(id,i){const t=S.get().travels.find(x=>x.id===id);if(!t)return;t.pack[i].text=document.getElementById('pke').value.trim();S.save();UI.close();open(id);}
  function delPack(id,i){const t=S.get().travels.find(x=>x.id===id);if(!t)return;t.pack.splice(i,1);S.save();open(id);}
  function togPack(id,i){const t=S.get().travels.find(x=>x.id===id);if(!t)return;t.pack[i].done=!t.pack[i].done;S.save();open(id);}
  function packToTodo(id){const t=S.get().travels.find(x=>x.id===id);if(!t)return;let n=0;t.pack.forEach(p=>{Todo.addQuick('🧳'+t.dest+'：'+p.text,'once',{__silent:true});n++;});UI.toast('已导入 '+n+' 项到待办 📋');if(document.getElementById('page-home').classList.contains('active'))Home.render();}
  function genTip(id){const t=S.get().travels.find(x=>x.id===id);if(!t)return;t.tip=AI.travelTip(t.dest);S.save();open(id);}
  function brief(id){
    const t=S.get().travels.find(x=>x.id===id);if(!t)return;
    let exp=0;S.get().bills.forEach(b=>{if(b.travel&&t.start&&b.date>=t.start&&(!t.end||b.date<=t.end))exp+=b.amount;});
    const content='🌸 '+t.title+'（'+t.dest+'）旅行简报\n\n📅 '+dateTxt(t)+'\n💰 预算 ¥'+t.budget+'，已花 ¥'+exp+'\n🎒 打包完成 '+t.pack.filter(p=>p.done).length+'/'+t.pack.length+'\n\n愿这趟旅程温柔又尽兴，留下甜甜的回忆 🧳';
    S.get().reviews.push({id:S.uid(),type:'travel',date:S.today(),content,modules:['旅游']});S.save();
    UI.modal('<div class="modal-title">🧳 旅行简报</div><div class="review-box">'+content.replace(/\n/g,'<br>')+'</div><button class="btn btn-primary btn-block mt12" onclick="UI.close()">收下 💗</button>');
  }

  /* ========== AI 生成攻略（细节输入版） ========== */
  const TRANS_OPTS=['高铁','飞机','自驾','大巴','火车卧铺','轮渡'];
  const MATE_OPTS=['独自','情侣','闺蜜','家人','朋友'];
  const STYLE_OPTS=['美食','文艺','自然','打卡','购物','躺平','亲子','闲逛'];
  const STAY_OPTS=['市区酒店','景区附近','民宿','青旅','温泉度假'];
  /* 上次填过的偏好，下次默认带出来 */
  let lastOpt={trans:'高铁',mates:'独自',stay:'市区酒店',styles:['美食','闲逛'],from:''};

  function chipRow(id,opts,sel,multi){
    const on=multi?(sel||[]):[sel];
    return '<div class="chips'+(multi?' multi':'')+'" id="'+id+'" data-multi="'+(multi?1:0)+'">'
      +opts.map(o=>'<div class="chip'+(on.indexOf(o)>=0?' on':'')+'" data-v="'+o+'">'+o+'</div>').join('')
      +'</div>';
  }
  function bindChips(id){
    const box=document.getElementById(id);if(!box)return;
    const multi=box.dataset.multi==='1';
    box.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{
      if(multi){c.classList.toggle('on');}
      else{box.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');}
    });
  }
  function chipVal(id,multi){
    const box=document.getElementById(id);if(!box)return multi?[]:'';
    const on=[...box.querySelectorAll('.chip.on')].map(c=>c.dataset.v);
    return multi?on:(on[0]||'');
  }

  function aiGen(){
    const today=S.today();
    UI.modal(`<div class="modal-title">✨ AI 旅行攻略</div>
      <div class="small muted" style="margin-bottom:10px">填得越细，攻略越贴合你。只有目的地是必填的 🌿</div>

      <div class="grid2">
        <div class="field"><label>出发地</label><input id="g-from" value="${(lastOpt.from||'').replace(/"/g,'&quot;')}" placeholder="如 深圳"></div>
        <div class="field"><label>目的地 *</label><input id="g-dest" placeholder="如 成都"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>出发日期（可不填）</label><input id="g-date" type="date" value="${lastOpt.date||''}" placeholder="不填则用第1天/第2天..."></div>
        <div class="field"><label>几点出发</label><input id="g-time" type="time" value="${lastOpt.time||'08:30'}"></div>
      </div>
      <div class="field"><label>怎么出发</label>${chipRow('g-trans',TRANS_OPTS,lastOpt.trans,false)}</div>
      <div class="grid2">
        <div class="field"><label>玩几天</label><input id="g-days" type="number" min="1" max="30" value="3"></div>
        <div class="field"><label>预算 ¥</label><input id="g-budget" type="number" value="3000"></div>
      </div>
      <div class="field"><label>和谁一起</label>${chipRow('g-mates',MATE_OPTS,lastOpt.mates,false)}</div>
      <div class="field"><label>想怎么玩（可多选）</label>${chipRow('g-styles',STYLE_OPTS,lastOpt.styles,true)}</div>
      <div class="field"><label>住哪儿</label>${chipRow('g-stay',STAY_OPTS,lastOpt.stay,false)}</div>
      <div class="field"><label>还有什么要求（可不填）</label>
        <textarea id="g-note" rows="2" placeholder="如：不想爬山、要带宝宝、想吃火锅、走路别太多"></textarea></div>

      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Trav.doGen()">✨ 生成攻略</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
    ['g-trans','g-mates','g-styles','g-stay'].forEach(bindChips);
  }

  function doGen(){
    const v=id=>{const el=document.getElementById(id);return el?el.value.trim():'';};
    const dest=v('g-dest');
    if(!dest){UI.toast('先填个目的地呀 🌏');return;}
    const opt={
      dest,from:v('g-from'),date:v('g-date'),time:v('g-time'),
      days:+v('g-days')||3,budget:+v('g-budget')||0,
      trans:chipVal('g-trans')||'高铁',
      mates:chipVal('g-mates')||'独自',
      styles:chipVal('g-styles',true),
      stay:chipVal('g-stay')||'市区酒店',
      note:v('g-note')
    };
    lastOpt={trans:opt.trans,mates:opt.mates,stay:opt.stay,styles:opt.styles.slice(),from:opt.from,date:opt.date,time:opt.time};

    const res=AI.travelPlanPro(opt);
    const hasDate=!!opt.date;
    const start=opt.date||'';
    const end=start?S.addDays(start,Math.max(0,opt.days-1)):'';
    /* 无日期时，days 里的 date 用 "第N天" 格式 */
    if(res.days&&!hasDate){
      res.days.forEach((d,i)=>{d.date='第'+(i+1)+'天';});
    }
    const t={id:S.uid(),title:dest+opt.days+'天'+(opt.styles[0]||'')+'行',status:'upcoming',
      dest,start,end,budget:opt.budget,
      days:res.days,
      pack:res.pack.map(x=>({id:S.uid(),text:x,done:false})),
      billIds:[],notes:res.text,tip:res.tip,
      meta:{from:opt.from,time:opt.time,trans:opt.trans,mates:opt.mates,styles:opt.styles,stay:opt.stay,note:opt.note}};
    S.get().travels.push(t);
    S.save();UI.close();render();
    UI.toast('攻略生成好啦 ✨');
    showPlan(t.id);
  }

  /* 攻略详情弹窗（生成后直接展示） */
  function showPlan(id){
    const t=S.get().travels.find(x=>x.id===id);if(!t)return;
    const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    UI.modal(`<div class="modal-title">✨ ${esc(t.title)}</div>
      <div class="review-box" style="max-height:52vh;overflow:auto;line-height:1.75">${esc(t.notes).replace(/\n/g,'<br>')}</div>
      <div class="small muted mt8">🎒 已自动生成 ${t.pack.length} 项打包清单，行程也存进「每日行程」了</div>
      <button class="btn btn-primary btn-block mt12" onclick="Trav.open('${t.id}')">📖 打开这个旅行计划</button>
      <button class="btn btn-ghost btn-block mt8" onclick="Trav.packToTodo('${t.id}');UI.close()">📋 打包清单导入待办</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">关闭</button>`);
  }

  window.Trav={render,setTab,newTravel,saveTravel,open,backList,renderPlan,planMore,editPlan,updPlan,toggleArch,delTravel,addDay,saveDay,delDay,addPack,savePack,editPack,updPack,delPack,togPack,packToTodo,genTip,brief,aiGen,doGen,showPlan};
})();
