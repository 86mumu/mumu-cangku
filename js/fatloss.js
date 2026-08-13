/* ============ 减脂模块（运动 / 体重 / 经期 / 排便） ============
   注：饮食已迁出到「食记 → 吃吃」，渲染函数仍留在本文件并对外导出复用 */
(function(){
  const S=window.Store, I=window.Icon, AI=window.AI;
  let sub='exercise';
  let exDate=null; // 运动记录日期（可补录）

  const SUBS=[['exercise','💪 运动'],['weight','⚖️ 体重'],['period','🌸 经期'],['poop','💩 排便']];

  function render(){
    const el=document.getElementById('page-fatloss');
    if(!exDate)exDate=S.today();
    if(!SUBS.some(s=>s[0]===sub))sub='exercise';
    ensurePlanTodos();
    el.innerHTML=`
      <div class="page-head">
        <div class="date-line">${S.fmtCN(S.today())} ${S.weekCN(S.today())} · 动一动，身体会更喜欢你</div>
        <div class="flex between center">
          <div class="title">减脂日记</div>
          <button class="pill" onclick="Fat.report()"><i class="ic">${I.i('chart')}</i> 报告</button>
        </div>
      </div>
      <div class="subtabs">
        ${SUBS.map(s=>`<button class="subtab${sub===s[0]?' on':''}" onclick="Fat.set('${s[0]}')">${s[1]}</button>`).join('')}
      </div>
      <div id="fat-body"></div>
    `;
    const body=document.getElementById('fat-body');
    if(sub==='exercise')renderExercise(body);
    else if(sub==='weight')renderWeight(body);
    else if(sub==='period'){ if(window.Period)Period.render(body); else body.innerHTML='<div class="empty"><p>经期模块加载中…</p></div>'; }
    else if(sub==='poop'){ if(window.Poop)Poop.render(body); else body.innerHTML='<div class="empty"><p>排便模块加载中…</p></div>'; }
    if(I&&I.upgrade)I.upgrade(body);
  }
  function set(s){
    // 兼容旧入口：以前 Fat.set('diet') 指饮食，现在跳到「食记 → 吃吃」
    if(s==='diet'){ if(window.Nav)Nav.go('food'); if(window.Food)Food.setSub('eat'); return; }
    sub=s;render();
  }

  /* ---------- 运动 ---------- */
  /* 计划卡片可选的 Q 版图标 */
  const PLAN_ICO=[
    ['cardio','有氧'],['back','背部'],['legs','腿部'],['run','跑步'],['full','全身'],
    ['rope','跳绳'],['yoga','瑜伽'],['plank','平板支撑'],['squat','深蹲'],['jack','开合跳'],
    ['badminton','羽毛球'],['swim','游泳'],['bike','骑行'],['pilates','普拉提'],['bridge','臀桥'],
    ['pamela','帕梅拉'],['stretch','拉伸'],['other','其他']
  ];
  function planIcon(k){
    if(I.EX[k])return I.EX[k];
    if(I.ICON[k])return I.ICON[k];
    return I.EX.other;
  }
  const SCOPE_TXT={today:'今日',week:'周循环',day:'每日'};

  /* 目标文案：次数 + 每次时长 */
  function goalText(p){
    const n=+p.times||1, m=+p.mins||0;
    return (SCOPE_TXT[p.scope]||'今日')+' '+n+' 次'+(m?' · 每次 '+m+' 分钟':'');
  }
  /* 本周期内已完成的次数（从绑定的待办 done 里数） */
  function planProgress(p){
    const t=p.todoId?S.get().todos.find(x=>x.id===p.todoId):null;
    const need=+p.times||1;
    if(!t)return {cnt:0,need,days:[]};
    const done=t.done||[];
    let hit;
    if(p.scope==='week'){const ws=S.weekStart(S.today()),we=S.addDays(ws,6);hit=done.filter(x=>x>=ws&&x<=we);}
    else hit=done.filter(x=>x===S.today());
    return {cnt:hit.length,need,days:hit};
  }

  /* 计划 ↔ 待办 双向同步：把计划写成/更新为一条待办
     · 今日 → 单次任务（当天没完成自动顺延）
     · 本周 / 本月 → 每天都出现，做满 N 次后本周期内自动隐藏（quota） */
  function syncPlanTodo(p){
    const todos=S.get().todos;
    const isDay=p.scope==='today';
    const period=isDay?'once':'daily';
    const cfg=isDay?{date:S.today()}:{};
    const quota=isDay?null:{scope:p.scope==='day'?'day':'week',times:+p.times||1};
    const content='运动：'+p.title+'（'+goalText(p)+'）';
    let t=p.todoId?todos.find(x=>x.id===p.todoId):null;
    if(t){
      Object.assign(t,{content,period,cfg,quota,rollover:isDay,videoUrl:p.videoUrl||'',planId:p.id});
    }else{
      t={id:S.uid(),content,period,cfg,quota,rollover:isDay,done:[],skip:[],planId:p.id,created:S.today(),
         videoUrl:p.videoUrl||'',imported:true,module:'exercise'};
      todos.push(t);p.todoId=t.id;
    }
  }
  /* 保证每个运动计划都有对应待办（种子计划 / 老数据补齐） */
  function ensurePlanTodos(){
    const d=S.get();const plans=d.exPlans||[];let changed=false;
    plans.forEach(p=>{
      const t=p.todoId?d.todos.find(x=>x.id===p.todoId):null;
      if(!t){p.todoId='';syncPlanTodo(p);changed=true;}
      else if(t.planId!==p.id){t.planId=p.id;changed=true;}
      // 老数据升级：本周/本月计划以前被写成「周循环/月循环」，改成「每天出现 + 次数配额」
      if(t&&p.scope!=='today'&&!t.quota){syncPlanTodo(p);changed=true;}
      if(t&&p.scope==='today'&&t.period!=='once'){syncPlanTodo(p);changed=true;}
      // 旧「月循环」统一转为「每日」
      if(p.scope==='month'){p.scope='day';syncPlanTodo(p);changed=true;}
      if(!p.goal||!/次/.test(p.goal)){p.goal=goalText(p);changed=true;}
    });
    if(changed)S.save();
  }
  function unsyncPlanTodo(p){
    if(!p.todoId)return;
    S.get().todos=S.get().todos.filter(t=>t.id!==p.todoId);
    p.todoId='';
  }
  /* 待办侧改了标题 → 回写到计划（供 Todo 模块调用） */
  function syncFromTodo(todo){
    if(!todo||!todo.planId)return;
    const p=(S.get().exPlans||[]).find(x=>x.id===todo.planId);
    if(!p)return;
    const m=/^运动：(.*?)(?:（([^（）]*)）)?$/.exec(todo.content||'');
    if(m&&m[1])p.title=m[1];
    p.goal=goalText(p);          // 目标由 次数×时长 统一生成，不再从文本反解
    p.videoUrl=todo.videoUrl||'';
  }

  function renderExercise(body){
    ensurePlanTodos();
    const d=exDate;
    const ex=S.S.exercisesToday(d);
    const exMin=ex.reduce((s,e)=>s+(+e.dur||0),0);
    const exCount=ex.length;
    const ws=S.weekStart(d);
    let wkDays=0;for(let i=0;i<7;i++){if(S.S.exercisesToday(S.addDays(ws,i)).length)wkDays++;}
    // 本周消耗
    let wkBurn=0;
    for(let i=0;i<7;i++){
      const dt=S.addDays(ws,i);
      S.S.exercisesToday(dt).forEach(e=>{wkBurn+=(+e.dur||0)*5;}); // 约5kcal/min
    }
    const plans=S.get().exPlans||[];

    // 随机AI建议（每次进入页面随机一个）
    const aiTips=[
      '💪 运动前先做3分钟热身，能减少受伤风险哦～',
      '🏃 有氧运动后拉伸10分钟，线条会更好看！',
      '💧 运动中记得小口补水，别等渴了再喝～',
      '🌙 睡前2小时避免剧烈运动，不然可能睡不着呢',
      '🎯 每周休息1-2天让肌肉恢复，效果更好',
      '😤 力量训练时呼气发力，吸气放松，节奏很重要',
      '🧘 哪怕只是散步15分钟，也比躺着强～今天动了吗？',
      '⚡ 高强度间歇运动(HIIT)20分钟 = 慢跑1小时，时间紧试试看',
      '🍌 运动后30分钟内补充蛋白质，帮助肌肉修复',
      '🎵 听喜欢的歌运动，时间过得更快更开心'
    ];
    const randomTip=aiTips[Math.floor(Math.random()*aiTips.length)];

    let html=`
      <!-- 日期选择器 -->
      <div class="datenav">
        <div class="d-wrap">
          <button onclick="Fat.shiftEx(-1)">‹</button>
          <div class="d" onclick="Fat.openExDatePick()"><span class="ic">📅</span>${S.fmtCN(d)}</div>
          <button onclick="Fat.shiftEx(1)">›</button>
        </div>
        <button class="today-btn-sm${d===S.today()?'':' go-today-pill'}" onclick="Fat.goExToday()">${d===S.today()?'今天':'回到今天'}</button>
      </div>

      <!-- 4 统计卡（新增本周消耗） -->
      <div class="stat-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="stat"><div class="emoji">⏱️</div><div class="num">${exMin}'</div><div class="lbl">运动时长</div></div>
        <div class="stat"><div class="emoji">🔢</div><div class="num">${exCount}</div><div class="lbl">今日次数</div></div>
        <div class="stat"><div class="emoji">📅</div><div class="num">${wkDays}</div><div class="lbl">本周天数</div></div>
        <div class="stat"><div class="emoji">🔥</div><div class="num">${wkBurn}</div><div class="lbl">本周消耗</div></div>
      </div>

      <!-- 运动计划：一行 2 张卡，整卡可点，自动同步到待办 -->
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">💪</span>我的运动计划</div>
          <span class="pill" onclick="Fat.newPlan()">＋ 新增</span></div>
        <div class="plan-grid">
          ${plans.length?plans.map(p=>{
            const lt=p.todoId?S.get().todos.find(x=>x.id===p.todoId):null;
            const doneDays=lt?(lt.done||[]):[];
            const fin=doneDays.includes(S.today());
            const pg=planProgress(p);
            const full=pg.cnt>=pg.need;
            return `
            <div class="plan-card${fin?' done':''}" onclick="Fat.openPlan('${p.id}')">
              <div class="plan-ico">${planIcon(p.icon)}</div>
              <div class="plan-title">${fin?'✅ ':''}${p.title}</div>
              <div class="plan-goal">${p.goal||goalText(p)}</div>
              <div class="plan-foot">
                <span class="plan-scope s-${p.scope}">${SCOPE_TXT[p.scope]||'今日'} ${pg.cnt}/${pg.need}${full?' ✔':''}</span>
                <span class="plan-go" onclick="event.stopPropagation();Fat.goTrain('${p.id}')">去跟练</span>
              </div>
              <div class="plan-week">
                <div class="pw-t">本周打卡</div>
                <div class="pw-dots">
                  ${[0,1,2,3,4,5,6].map(i=>{
                    const dt=S.addDays(ws,i);
                    const on=doneDays.includes(dt);
                    const td=dt===S.today();
                    return `<span class="pw-dot${on?' on':''}${td?' today':''}">${['一','二','三','四','五','六','日'][i]}</span>`;
                  }).join('')}
                </div>
              </div>
            </div>`;}).join(''):`<div class="plan-empty">还没有运动计划，点右上角「＋ 新增」定一个小目标吧 🌿</div>`}
        </div>
        <button class="btn btn-primary btn-block mt12" onclick="Fat.openExDialog()">📝 记录一次运动</button>
      </div>

      <!-- AI 建议（随机显示） -->
      <div class="ai-tip-box">
        <div class="ai-label">✨ AI 小建议</div>
        ${randomTip}
      </div>

      ${ex.length?`
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">📝</span>${d===S.today()?'今日':'该日'}记录</div></div>
        ${ex.map(e=>`<div class="row" data-eid="${e.id}">
          <div class="row-actions"><button class="edit" onclick="Fat.openExDialog('','${e.id}')">编辑</button><button class="del" onclick="Fat.delEx('${e.id}')">删除</button></div>
          <div class="row-inner"><div class="cbox on"></div>
            <div style="flex:1">${e.type} · ${e.dur}分钟 · ~${e.cal||(+e.dur||0)*5}kcal${e.videoUrl?'<span class="pill on" style="margin-left:6px" onclick="Todo.openVideo(\''+e.videoUrl+'\')">▶ 跟练</span>':''}</div></div></div>`).join('')}
      </div>`:emptyEx()}
    `;
    body.innerHTML=html;
    bindSwipeEx(body);
  }
  function emptyEx(){
    const txt=exDate===S.today()?'今天还没运动哦～<br>点「记录一次运动」开始吧':'这天没有运动记录<br>可以补录哦';
    return '<div class="card"><div class="empty">'+I.EMPTY.replace('width="120"','width="80"')+'<p>'+txt+'</p></div></div>';
  }
  function bindSwipeEx(body){
    body.querySelectorAll('.row').forEach(r=>{
      UI.swipe(r.querySelector('.row-inner'),()=>r.classList.add('swiped'),()=>r.classList.remove('swiped'));
    });
  }

  /* 运动日期操作 */
  function shiftEx(n){
    exDate=S.addDays(exDate,n);renderExercise(document.getElementById('fat-body'));
  }
  function goExToday(){exDate=S.today();render();}
  function openExDatePick(){
    UI.datePicker(exDate,ds=>{exDate=ds;render();},'选择运动日期');
  }
  function pickExDate(ds){UI.close();exDate=ds;render();}

  /* ---- 运动记录：运动模式改为自行输入 ---- */
  function usedTypes(){
    const set={};S.get().exercises.forEach(e=>{if(e.type)set[e.type]=1;});
    (S.get().exPlans||[]).forEach(p=>{if(p.title)set[p.title]=1;});
    return Object.keys(set);
  }
  function openExDialog(preset,editId){
    const e=editId?S.get().exercises.find(x=>x.id===editId):null;
    const tp=e?e.type:(preset||'');
    UI.modal(`<div class="modal-title">${e?'修改运动记录':'记录一次运动'}</div>
      <div class="field"><label>运动模式（自己填，想写什么都行）</label>
        <input id="ex-type" list="ex-type-list" value="${(tp||'').replace(/"/g,'&quot;')}" placeholder="如 帕梅拉燃脂 / 快走 / 撸铁">
        <datalist id="ex-type-list">${usedTypes().map(t=>`<option value="${t}">`).join('')}</datalist>
      </div>
      <div class="field"><label>时长（分钟）</label><input id="ex-dur" type="number" inputmode="numeric" value="${e?e.dur:15}" min="1" max="600"></div>
      <div class="field"><label>消耗热量 kcal（可改，默认约 5kcal/分钟）</label><input id="ex-cal" type="number" inputmode="numeric" value="${e?(e.cal||e.dur*5):75}" min="0"></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Fat.saveEx('${editId||''}')">保存</button>
        ${editId?`<button class="btn btn-ghost btn-block" onclick="Fat.delEx('${editId}')">删除</button>`
                :'<button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>'}
      </div>`);
    const di=document.getElementById('ex-dur'),ci=document.getElementById('ex-cal');
    di.addEventListener('input',()=>{ci.value=Math.round((+di.value||0)*5);}); // 时长变了自动估热量
    setTimeout(()=>{const ti=document.getElementById('ex-type');if(ti&&!tp)ti.focus();},80);
  }
  function saveEx(editId){
    const type=(document.getElementById('ex-type').value||'').trim();
    const dur=+document.getElementById('ex-dur').value||0;
    const cal=+document.getElementById('ex-cal').value||0;
    if(!type){UI.toast('填一下运动模式吧');return;}
    if(!dur){UI.toast('请填写时长');return;}
    const ex=S.get().exercises;
    const cur=editId?ex.find(x=>x.id===editId):null;
    if(cur)Object.assign(cur,{type,dur,cal});
    else ex.push({id:S.uid(),date:exDate,type,dur,cal,count:1,videoUrl:''});
    S.save();UI.close();renderExercise(document.getElementById('fat-body'));
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
    UI.toast('已记录 '+type+' '+dur+' 分钟 💪');
  }
  function removeEx(type){
    S.get().exercises=S.get().exercises.filter(e=>!(e.date===exDate&&e.type===type));
    S.save();UI.close();renderExercise(document.getElementById('fat-body'));
  }
  function toggleEx(type){openExDialog(type);}
  function delEx(id){
    S.get().exercises=S.get().exercises.filter(e=>e.id!==id);
    S.save();
    const r=document.getElementById('modal-root');
    if(r&&r.classList.contains('show'))UI.close();
    renderExercise(document.getElementById('fat-body'));
  }

  /* ---- 运动计划 CRUD（与待办双向同步）---- */
  function newPlan(){planForm(null);}
  function openPlan(id){
    const p=(S.get().exPlans||[]).find(x=>x.id===id);if(!p)return;
    const linked=p.todoId?S.get().todos.find(t=>t.id===p.todoId):null;
    UI.modal(`<div class="modal-title">${p.title}</div>
      <div class="plan-detail-ico">${planIcon(p.icon)}</div>
      <div class="small muted" style="text-align:center;margin-bottom:12px">${p.goal||goalText(p)}</div>
      ${(function(){const g=planProgress(p);return '<div class="small" style="text-align:center;margin-bottom:10px;color:var(--pink);font-weight:600">'+
        (SCOPE_TXT[p.scope]||'今日')+'进度 '+g.cnt+' / '+g.need+' 次'+(g.cnt>=g.need?'　已达标 🎉':'')+'</div>';})()}
      ${linked?`<div class="small muted" style="text-align:center;margin-bottom:10px">已同步到待办：${linked.done.includes(S.today())?'今天已完成 ✅':'今天还没打卡'}</div>`:''}
      <button class="btn btn-primary btn-block" onclick="Fat.goTrain('${p.id}')">▶ 去跟练</button>
      <button class="btn btn-ghost btn-block mt8" onclick="Fat.logFromPlan('${p.id}')">📝 记录这次运动</button>
      ${linked?`<button class="btn btn-ghost btn-block mt8" onclick="Fat.togglePlanDone('${p.id}')">${linked.done.includes(S.today())?'取消今日打卡':'✅ 今日打卡完成'}</button>`:''}
      <button class="btn btn-ghost btn-block mt8" onclick="Fat.editPlan('${p.id}')">✏️ 编辑计划</button>
      <button class="btn btn-ghost btn-block mt8" style="color:#e06a86" onclick="Fat.delPlan('${p.id}')">删除计划</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">关闭</button>`);
  }
  function editPlan(id){planForm((S.get().exPlans||[]).find(x=>x.id===id));}
  const TIMES_OPT=[1,2,3,4,5,6,7];
  const MINS_OPT=[10,15,20,30,45,60];
  function planForm(p){
    const isEdit=!!p;
    const p0=p||{id:'',title:'',goal:'',videoUrl:'',scope:'today',icon:'cardio',times:3,mins:20};
    const t0=+p0.times||1, m0=+p0.mins||20;
    UI.modal(`<div class="modal-title">${isEdit?'编辑运动计划':'新增运动计划'}</div>
      <div class="field"><label>标题</label><input id="pl-title" value="${(p0.title||'').replace(/"/g,'&quot;')}" placeholder="如 帕梅拉燃脂"></div>
      <div class="field"><label>目标 · 做几次</label>
        <div class="seg wrap" id="pl-times">
          ${TIMES_OPT.map(n=>`<div class="opt ${t0===n?'on':''}" data-v="${n}">${n} 次</div>`).join('')}
        </div></div>
      <div class="field"><label>目标 · 每次多久</label>
        <div class="seg wrap" id="pl-mins">
          ${MINS_OPT.map(n=>`<div class="opt ${m0===n?'on':''}" data-v="${n}">${n} 分</div>`).join('')}
        </div></div>
      <div class="field"><label>归属（会自动生成对应的待办）</label>
        <div class="seg" id="pl-scope">
          ${['today','week','day'].map(s=>`<div class="opt ${p0.scope===s?'on':''}" data-s="${s}">${SCOPE_TXT[s]}</div>`).join('')}
        </div>
        <div class="small muted mt8" id="pl-hint"></div>
      </div>
      <div class="field"><label>跟练视频链接（可选）</label><input id="pl-video" value="${(p0.videoUrl||'').replace(/"/g,'&quot;')}" placeholder="https://..."></div>
      <div class="field"><label>图标</label>
        <div class="cat-grid" id="pl-ico">
          ${PLAN_ICO.map(k=>`<div class="cat-item ${p0.icon===k[0]?'on':''}" data-k="${k[0]}"><div class="cat-ico">${planIcon(k[0])}</div><div class="cat-name">${k[1]}</div></div>`).join('')}
        </div></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Fat.savePlan('${p0.id}')">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
    const pickOne=(sel,cb)=>document.querySelectorAll(sel+' .opt').forEach(o=>o.onclick=()=>{
      document.querySelectorAll(sel+' .opt').forEach(x=>x.classList.remove('on'));o.classList.add('on');if(cb)cb();});
    function hint(){
      const box=document.getElementById('pl-hint');if(!box)return;
      const sc=(document.querySelector('#pl-scope .opt.on')||{dataset:{s:'today'}}).dataset.s;
      const n=+((document.querySelector('#pl-times .opt.on')||{dataset:{v:1}}).dataset.v)||1;
      const mi=+((document.querySelector('#pl-mins .opt.on')||{dataset:{v:20}}).dataset.v)||20;
      box.textContent = sc==='today'
        ? '今天出现在待办里，没完成会自动顺延到第二天'
        : (sc==='week'
            ? '每周都出现在待办，练满 '+n+' 次（每次 '+mi+' 分钟）后，本周就不再出现'
            : '每天都出现在待办，练满 '+n+' 次（每次 '+mi+' 分钟）后，当天就不再出现');
    }
    pickOne('#pl-scope',hint);pickOne('#pl-times',hint);pickOne('#pl-mins',hint);
    document.querySelectorAll('#pl-ico .cat-item').forEach(o=>o.onclick=()=>{
      document.querySelectorAll('#pl-ico .cat-item').forEach(x=>x.classList.remove('on'));o.classList.add('on');});
    hint();
  }
  function savePlan(id){
    const title=document.getElementById('pl-title').value.trim();
    if(!title){UI.toast('给计划起个名字吧');return;}
    const videoUrl=document.getElementById('pl-video').value.trim();
    const scope=(document.querySelector('#pl-scope .opt.on')||{dataset:{s:'today'}}).dataset.s;
    const times=+((document.querySelector('#pl-times .opt.on')||{dataset:{v:1}}).dataset.v)||1;
    const mins=+((document.querySelector('#pl-mins .opt.on')||{dataset:{v:20}}).dataset.v)||20;
    const icoEl=document.querySelector('#pl-ico .cat-item.on');
    const icon=icoEl?icoEl.dataset.k:'cardio';
    if(!Array.isArray(S.get().exPlans))S.get().exPlans=[];
    let p=id?S.get().exPlans.find(x=>x.id===id):null;
    if(p)Object.assign(p,{title,videoUrl,scope,icon,times,mins});
    else{p={id:S.uid(),title,videoUrl,scope,icon,times,mins,todoId:''};S.get().exPlans.push(p);}
    p.goal=goalText(p);
    syncPlanTodo(p);          // 双向同步：写进待办
    S.save();UI.close();renderExercise(document.getElementById('fat-body'));
    if(window.Todo)try{Todo.render();}catch(e){}
    UI.toast('已保存：'+goalText(p)+' ✅');
  }
  function delPlan(id){
    const p=(S.get().exPlans||[]).find(x=>x.id===id);if(!p)return;
    unsyncPlanTodo(p);        // 双向同步：连带删掉待办
    S.get().exPlans=S.get().exPlans.filter(x=>x.id!==id);
    S.save();UI.close();renderExercise(document.getElementById('fat-body'));
    if(window.Todo)try{Todo.render();}catch(e){}
    UI.toast('计划已删除');
  }
  function togglePlanDone(id){
    const p=(S.get().exPlans||[]).find(x=>x.id===id);if(!p||!p.todoId)return;
    const t=S.get().todos.find(x=>x.id===p.todoId);if(!t)return;
    const d=S.today(),i=t.done.indexOf(d);
    if(i>=0)t.done.splice(i,1);else t.done.push(d);
    S.save();UI.close();renderExercise(document.getElementById('fat-body'));
    if(window.Todo)try{Todo.render();}catch(e){}
    UI.toast(i>=0?'已取消今日打卡':'今日打卡完成 🎉');
  }
  function goTrain(id){
    const p=(S.get().exPlans||[]).find(x=>x.id===id);if(!p)return;
    if(!p.videoUrl){UI.toast('还没填跟练视频链接，先去编辑计划加一个吧');return;}
    if(window.Todo)Todo.openVideo(p.videoUrl);
  }
  function logFromPlan(id){
    const p=(S.get().exPlans||[]).find(x=>x.id===id);if(!p)return;
    UI.close();openExDialog(p.title);
  }

  /* ---------- 饮食（现归属「食记 → 吃吃」，渲染容器可切换） ---------- */
  let dietRoot='food-eat';
  let dietDate=null; /* 食记日期导航选中的日期（null=今天） */
  const MEAL_CN={breakfast:'早餐',lunch:'午餐',dinner:'晚餐',snack:'加餐'};
  function renderDietInto(el,d){ if(!el)return; dietRoot=el.id||'food-eat'; dietDate=d||null; renderDiet(el,d); }
  function redrawDiet(){ const el=document.getElementById(dietRoot); if(el)renderDiet(el,dietDate); }
  function hideMeal(id){ const m=S.get().diet.find(x=>x.id===id); if(!m)return; m.hidden=!m.hidden; S.save(); redrawDiet(); }
  function renderDiet(body,d){
    d=d||S.today();
    const meals=S.S.dietToday(d);
    const goal=S.get().settings.calGoal;
    const ik=S.S.intakeToday(d);
    const cal=ik.total;                 // 三餐 + 喝喝饮品，合并计入每日摄入
    const over=cal>goal;
    const parts=[['breakfast','🌅 早餐'],['lunch','☀️ 午餐'],['dinner','🌙 晚餐'],['snack','🍪 加餐']];

    function mealCard(key,label){
      const ms=meals.filter(m=>m.meal===key);
      const calM=ms.filter(m=>!m.hidden).reduce((s,m)=>s+m.cal,0);
      // 拍照识别的图片直接展示在卡片里；每条可隐藏（隐藏后折叠且不计热量）
      const items=ms.length?ms.map(m=>{
        if(m.hidden)return `<div class="food-item fi-hidden" onclick="Fat.hideMeal('${m.id}')">
          <div class="food-meta"><div class="food-name">${m.name}<span class="small muted">（已隐藏，点开恢复）</span></div></div>
          <span class="food-del" onclick="event.stopPropagation();Fat.delMeal('${m.id}')">✕</span>
        </div>`;
        return `<div class="food-item">
          ${m.img?`<img class="food-img" src="${m.img}" alt="${m.name}" onclick="Fat.viewImg('${m.id}')">`:'<div class="food-img none">🍽</div>'}
          <div class="food-meta">
            <div class="food-name" onclick="event.stopPropagation();Fat.editMeal('${m.id}')">${m.name}</div>
            <div class="small muted">${m.cal} kcal · ${portionTxt(m)} · 蛋白${m.protein||0} · 碳水${m.carb||0}</div>
          </div>
          <div class="fi-acts">
            <span class="food-edit" onclick="event.stopPropagation();Fat.editMeal('${m.id}')">✏️</span>
            <span class="food-hide" onclick="event.stopPropagation();Fat.hideMeal('${m.id}')">🙈 隐藏</span>
            <span class="food-del" onclick="event.stopPropagation();Fat.delMeal('${m.id}')">✕</span>
          </div>
        </div>`;
      }).join(''):'<div class="small muted">还没记录</div>';
      return `<div class="meal">
        <div class="top"><span class="mi">${label.split(' ')[0]}</span><b>${label.split(' ')[1]}</b>
          <span class="pill" style="margin-left:auto">${calM} kcal</span></div>
        <div class="food-list">${items}</div>
        <div class="flex gap8 mt8">
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="Fat.addMeal('${key}','${d}')">＋ 手动添加</button>
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="Fat.upImg('${key}','${d}')">📷 拍照识别</button>
        </div>
      </div>`;
    }

    /* 我的菜谱：只展示自己手动添加的（已按忌口过滤） */
    const myRecs=(window.Recipes?Recipes.myRecipes():(S.get().recipes||[]).filter(r=>r.custom));
    const hiddenByAvoid=(window.Recipes?Recipes.avoidHidden():[]);
    const MEAL_LABEL={breakfast:'🌅 早餐',lunch:'☀️ 午餐',dinner:'🌙 晚餐',snack:'🍪 加餐'};
    const myByMeal={};
    ['breakfast','lunch','dinner','snack'].forEach(k=>myByMeal[k]=myRecs.filter(r=>r.meal===k));

    /* 今日均衡搭配：食物组合建议（不是具体菜，按基础摄入量生成） */
    const combos=(window.Recipes?Recipes.dailyCombos():[]);
    const comboTotal=combos.reduce((s,c)=>s+(+c.cal||0),0);
    const MEAL_ICON={breakfast:'🌅 早餐',lunch:'☀️ 午餐',dinner:'🌙 晚餐',snack:'🍪 加餐'};
    const comboCard=c=>`<div class="rec-card rec-grid-item combo-card" onclick="Fat.comboDetail('${c.combo.replace(/'/g,"\\'")}')">
        <div class="combo-meal">${MEAL_ICON[c.meal]||c.meal}</div>
        <div class="combo-text">${c.combo}</div>
        <div class="combo-desc">${c.desc}</div>
        <div class="combo-cal">🔥 ${c.cal} kcal</div>
        <button class="btn btn-ghost btn-sm mt8" onclick="event.stopPropagation();Fat.comboToTodo('${c.combo.replace(/'/g,"\\'")}')">＋ 记成待办</button>
      </div>`;
    /* 🌐 联网灵感搭配（TheMealDB 每天自动更新，断网就不显示） */
    const netList=(window.Recipes&&Recipes.netCombos)?Recipes.netCombos():[];
    const netOk=(window.Recipes&&Recipes.netOk)?Recipes.netOk():false;
    const space=(window.Recipes&&Recipes.comboSpace)?Recipes.comboSpace():null;
    const spaceTxt=space?`早餐 ${space.breakfast} 种 · 午餐 ${space.lunch} 种 · 晚餐 ${space.dinner} 种 · 加餐 ${space.snack} 种`:'';
    const comboHtml=combos.length?`
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🥗</span>今日均衡搭配</div>
          <span class="pill">合计约 ${comboTotal} kcal</span>
          <button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="Fat.refreshRecipes()">🔄 换一批</button></div>
        <div class="small muted" style="margin-bottom:10px;line-height:1.55">均衡饮食搭配建议：不限定具体一道菜，按基础摄入量自由组合即可。主食 × 蛋白 × 蔬果自由排列（${spaceTxt}），点「换一批」永远不重样 🌿</div>
        <div class="rec-grid">${combos.map(comboCard).join('')}</div>
        ${netList.length?`
        <div class="divider"></div>
        <div class="flex between center" style="margin-bottom:8px">
          <div class="small" style="font-weight:600">🌐 联网灵感搭配（${netList.length}）</div>
          <button class="btn btn-ghost btn-sm" onclick="Fat.refreshNetCombos()">🔄 重新联网</button>
        </div>
        <div class="rec-grid">${netList.map(comboCard).join('')}</div>
        <div class="small muted mt8">这几条来自网络菜谱库，按食材自动换算成中文与估算热量，每天自动更新一批。</div>
        `:`
        <div class="divider"></div>
        <div class="flex between center">
          <div class="small muted">🌐 联网灵感：${netOk?'正在获取…':'当前网络没拿到，先用本地组合'}</div>
          <button class="btn btn-ghost btn-sm" onclick="Fat.refreshNetCombos()">🔄 试试联网</button>
        </div>`}
      </div>`:'';

    /* 菜谱卡片（2 列网格） */
    function recCard(r){
      return `<div class="rec-card rec-grid-item" onclick="Fat.openRecipe('${r.id}')">
        <div style="flex:1;min-width:0">
          <div class="rec-name">${r.name}</div>
          <div class="small muted">🔥${r.cal} · 蛋白${r.protein} · 碳水${r.carb} · 纤维${r.fiber}</div>
          <div class="small" style="color:var(--pink);margin-top:3px">点开看做法 →</div>
        </div>
        <button class="btn btn-ghost btn-sm" style="flex-shrink:0;margin-left:8px" onclick="event.stopPropagation();Fat.recToTodo('${r.name.replace(/'/g,"\\'")}')">＋待办</button>
      </div>`;
    }

    const avoid=S.get().avoid||[];
    const ws=S.weekStart(d), we=S.addDays(ws,6);
    let weekDays=0, weekCal=0;
    for(let i=0;i<7;i++){
      const dt=S.addDays(ws,i);
      const dm=S.S.dietToday(dt).filter(m=>!m.hidden);
      if(dm.length)weekDays++;
      weekCal+=dm.reduce((s,m)=>s+(+m.cal||0),0);
    }
    const todayMeals=meals.filter(m=>!m.hidden).length;

    let html=`
      <!-- 饮食日历（对齐运动页：日期条在卡片外，下方 4 统计卡） -->
      <div class="datenav">
        <div class="d-wrap">
          <button onclick="Food.shiftView(-1)">‹</button>
          <div class="d" onclick="Food.pickDate()"><span class="ic">📅</span>${S.fmtCN(d)}</div>
          <button onclick="Food.shiftView(1)">›</button>
        </div>
        <button class="today-btn-sm${d===S.today()?'':' go-today-pill'}" onclick="Food.goToday()">${d===S.today()?'今天':'回到今天'}</button>
      </div>
      <div class="stat-row" style="grid-template-columns:repeat(4,1fr)">
        <div class="stat"><div class="emoji">🍽️</div><div class="num">${todayMeals}</div><div class="lbl">今日餐数</div></div>
        <div class="stat"><div class="emoji">🔥</div><div class="num">${cal}</div><div class="lbl">今日热量</div></div>
        <div class="stat"><div class="emoji">📅</div><div class="num">${weekDays}</div><div class="lbl">本周天数</div></div>
        <div class="stat"><div class="emoji">🔥</div><div class="num">${weekCal}</div><div class="lbl">本周热量</div></div>
      </div>

      <div class="card" style="${over?'border-color:#e98aa0;background:#fff0f4':''}">
        <div class="card-h"><div class="l"><span class="ico">🔥</span>热量监控</div>
          <span class="pill ${over?'on':''}" onclick="Fat.setGoal()">上限 ${goal}</span></div>
        <div class="stat" style="background:${over?'#fff0f4':'var(--bg)'};box-shadow:none">
          <div class="num" style="color:${over?'#e98aa0':'var(--pink)'};font-size:24px">${cal}</div>
          <div class="lbl">/ ${goal} kcal ${over?'⚠️ 超啦，下一餐清淡点':''}</div>
        </div>
        <div class="small muted mt8">今日摄入合计 <b style="color:var(--pink)">${ik.total}</b> kcal（三餐 ${ik.food} ＋ 饮品 ${ik.drink}）</div>
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🍽️</span>${S.fmtCN(d)} 餐次</div></div>
        ${parts.map(p=>mealCard(p[0],p[1])).join('')}
      </div>

      ${comboHtml}

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">📖</span>我的菜谱</div>
          <span class="pill">${myRecs.length} 道</span>
          <span class="pill" style="margin-left:6px" onclick="Fat.editAvoid()">忌口 ${avoid.length}</span></div>
        <div class="small muted" style="margin-bottom:10px;line-height:1.55">这里只放你自己录的菜，想吃什么自己说了算 🌿</div>
        ${hiddenByAvoid.length?`<div class="small muted" style="margin-bottom:8px;color:#c98">🚫 有 ${hiddenByAvoid.length} 道菜命中了忌口，已自动隐藏</div>`:''}
        ${myRecs.length?['breakfast','lunch','dinner','snack'].map(k=>(myByMeal[k].length?`
          <div class="rec-sec">
            <div class="rec-sec-h">${MEAL_LABEL[k]}<span class="small muted" style="margin-left:6px">${myByMeal[k].length} 道</span></div>
            <div class="rec-grid">${myByMeal[k].map(recCard).join('')}</div>
          </div>`:'')).join('')
        :'<div class="empty" style="padding:18px 0"><p class="small muted">还没有菜谱，点下面按钮把你的拿手菜记下来吧 👩‍🍳</p></div>'}
        <button class="btn btn-primary btn-block mt12" onclick="Fat.newRecipe()">＋ 添加我的菜谱</button>
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">📊</span>${S.fmtCN(d)} 饮食汇总 & AI 简报</div></div>
        <div class="small muted">今日 ${meals.length} 餐 · 合计 ${cal} kcal（含饮品 ${ik.drink}）· 蛋白 ${meals.reduce((s,m)=>s+(+m.protein||0),0)}g · 碳水 ${meals.reduce((s,m)=>s+(+m.carb||0),0)}g</div>
        <button class="btn btn-primary btn-block mt12" onclick="Fat.dietBrief()">✨ 生成 AI 饮食简报</button>
      </div>
    `;
    body.innerHTML=html;
  }
  function setGoal(){
    UI.modal('<div class="modal-title">设置每日热量上限</div><div class="field"><input id="g" type="number" value="'+S.get().settings.calGoal+'" placeholder="如 1600"></div><button class="btn btn-primary btn-block" onclick="Fat.saveGoal()">保存</button>');
  }
  function saveGoal(){
    const v=+document.getElementById('g').value;if(v){S.get().settings.calGoal=v;S.save();}
    UI.close();redrawDiet();
  }
  let _pendingMealImg=''; // 手动添加时暂存图片
  /* ===== 吃吃：克重 / 计量单位 / 历史热量按比例同步 ===== */
  let _mealRef=null,_mealRefGram=100; // 当前匹配到的历史食物（用于热量按比例换算）
  const MEAL_UNITS=[
    {k:'g',t:'克',g:100},
    {k:'bowl',t:'碗',g:250},
    {k:'one',t:'个',g:60},
    {k:'ml',t:'毫升',g:200}
  ];
  function mealSelUnit(){
    const on=document.querySelector('#mu .uchip.on');
    return on?on.getAttribute('data-t'):'克';
  }
  function mealFindRef(name){
    name=(name||'').trim().toLowerCase();
    if(!name){_mealRef=null;_mealRefGram=100;return null;}
    const arr=(S.get().diet||[]).filter(m=>m.name&&m.name.trim().toLowerCase()===name);
    _mealRef=arr.length?arr[arr.length-1]:null; // 取最近一条作基准
    _mealRefGram=_mealRef?(_mealRef.gram||100):100;
    return _mealRef;
  }
  function mealScale(){
    const g=+document.getElementById('mg')?.value||100;
    if(!_mealRef)return; // 没有历史基准时，热量由用户手动填
    const r=g/_mealRefGram; // 按克重比例灵活换算（如 100g→70g：热量×0.7）
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=Math.round(v);};
    set('mc',(_mealRef.cal||0)*r);
    set('mp',(_mealRef.protein||0)*r);
    set('mca',(_mealRef.carb||0)*r);
    set('mf',(_mealRef.fiber||0)*r);
  }
  let _mealHistoryList=[]; // 当前单位下的历史记录备选
  function mealUnitHistory(name,unit){
    name=(name||'').trim().toLowerCase();
    unit=(unit||'').trim();
    if(!name||!unit)return [];
    const arr=(S.get().diet||[]).filter(m=>m.name&&m.name.trim().toLowerCase()===name&&m.unit===unit);
    return arr.slice().reverse(); // 最近用的排前面
  }
  function mealApplyHistoryItem(item){
    if(!item)return;
    const mn=document.getElementById('mn');if(mn)mn.value=item.name||'';
    const mg=document.getElementById('mg');if(mg)mg.value=(item.gram===undefined||item.gram===null)?'':item.gram;
    const unit=item.unit||'克';
    document.querySelectorAll('#mu .uchip').forEach(x=>{x.classList.toggle('on',x.getAttribute('data-t')===unit);});
    const lbl=document.getElementById('mu-label');if(lbl)lbl.textContent=unit;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=(v===undefined||v===null)?'':Math.round(v);};
    set('mc',item.cal);set('mp',item.protein);set('mca',item.carb);set('mf',item.fiber);
    const note=document.getElementById('mnote');if(note)note.value=item.note||'';
    if(item.img){_pendingMealImg=item.img;}
    mealFindRef(item.name||'');
  }
  function mealRenderHistory(list){
    const box=document.getElementById('mu-history');if(!box)return;
    box.style.display='block';
    box.innerHTML='<div class="meal-history-title">选择历史记录</div><div class="meal-hist-list">'+
      list.map((m,i)=>'<div class="meal-hist-item" onclick="Fat.mealApplyHistory('+i+')"><span>'+
        (m.name||'').replace(/</g,'&lt;')+'</span><span class="muted">'+(m.gram||'')+(m.unit||'克')+
        ' · '+(m.cal||0)+'kcal</span></div>').join('')+'</div>';
  }
  function mealApplyHistory(idx){
    const item=_mealHistoryList[idx];if(!item)return;
    mealApplyHistoryItem(item);
    mealHideHistory();
  }
  function mealHideHistory(){
    const box=document.getElementById('mu-history');if(box){box.style.display='none';box.innerHTML='';}
    _mealHistoryList=[];
  }
  function setupMealForm(){
    const mn=document.getElementById('mn');
    if(mn)mn.addEventListener('input',()=>{
      mealHideHistory();
      if(mealFindRef(mn.value)){ mealApplyHistoryItem(_mealRef); } // 选历史名→直接继承最新一条全部数据
      else { const mg=document.getElementById('mg'); if(mg)mg.value=''; }
    });
    const mg=document.getElementById('mg');
    if(mg)mg.addEventListener('input',mealScale);
    document.querySelectorAll('#mu .uchip').forEach(c=>c.addEventListener('click',()=>{
      document.querySelectorAll('#mu .uchip').forEach(x=>x.classList.remove('on'));
      c.classList.add('on');
      const unit=c.getAttribute('data-t');
      const lbl=document.getElementById('mu-label');if(lbl)lbl.textContent=unit;
      const name=(document.getElementById('mn')?.value||'').trim();
      const mgEl=document.getElementById('mg');
      if(!name){ if(mgEl)mgEl.value=''; mealHideHistory(); return; }
      const list=mealUnitHistory(name,unit);
      if(list.length===0){ if(mgEl)mgEl.value=''; mealHideHistory(); }
      else if(list.length===1){ mealApplyHistoryItem(list[0]); mealHideHistory(); }
      else{ _mealHistoryList=list; mealRenderHistory(list); }
    }));
  }
  function portionTxt(m){
    const gram=m&&m.gram?m.gram:100;
    const unit=(m&&m.unit)||'克';
    if(unit==='克'||unit==='g')return gram+'g';
    return gram+unit;
  }
  function addMeal(key,date){
    date=date||S.today();
    _pendingMealImg='';_mealRef=null;_mealRefGram=100;
    /* 从历史记录提取食物名称（去重，最近用的排前面） */
    const histNames=[...new Map((S.get().diet||[]).map(m=>[m.name,m.name]).filter(Boolean)).keys()].reverse().slice(0,50);
    const mealName=MEAL_CN[key]||key;
    UI.modal(`<div class="modal-title">添加${mealName}</div>
      <div class="small muted" style="margin-bottom:8px">记录到 ${S.fmtCN(date)}</div>
      <div class="field"><label>食物名称</label><input id="mn" list="meal-name-list" placeholder="如 鸡胸肉沙拉" autocomplete="off">
        <datalist id="meal-name-list">${histNames.map(n=>`<option value="${n.replace(/"/g,'&quot;')}">`).join('')}</datalist></div>
      <div class="field"><label>克重 / 份量</label>
        <div class="flex gap8" style="align-items:center">
          <input id="mg" type="number" value="" inputmode="numeric" style="flex:1" placeholder="克重/份量">
          <span id="mu-label" class="small muted">克</span>
        </div>
        <div class="uchips" id="mu">
          ${MEAL_UNITS.map((u,i)=>`<button type="button" class="uchip${i===0?' on':''}" data-k="${u.k}" data-g="${u.g}" data-t="${u.t}">${u.t}</button>`).join('')}
        </div>
        <div id="mu-history" class="meal-history"></div>
      </div>
      <div class="field" style="position:relative">
        <label>📷 图片（可选）</label>
        <div class="flex gap8"><input id="mi-preview" readonly placeholder="未选择图片" style="flex:1;cursor:pointer" onclick="document.getElementById('mi-file').click()">
        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('mi-file').click()">选择图片</button></div>
        <input id="mi-file" type="file" accept="image/*" style="display:none" onchange="Fat.onMealImgPick(this)">
        ${_pendingMealImg?`<img id="mi-thumb" src="${_pendingMealImg}" style="max-width:100%;max-height:120px;border-radius:8px;margin-top:6px;display:block">`:''}
      </div>
      <div class="field"><label>热量 kcal</label><input id="mc" type="number" placeholder="如 320"></div>
      <div class="grid3">
        <div class="field"><label>蛋白g</label><input id="mp" type="number"></div>
        <div class="field"><label>碳水g</label><input id="mca" type="number"></div>
        <div class="field"><label>纤维g</label><input id="mf" type="number"></div>
      </div>
      <div class="field"><label>备注</label><textarea id="mnote" placeholder="可选，如 去酱、少油、自制"></textarea></div>
      <div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Fat.saveMeal('${key}','${date}')">保存</button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>`);
    setTimeout(()=>setupMealForm(),0);
  }
  function saveMeal(key,date){
    date=date||S.today();
    const name=document.getElementById('mn').value.trim();if(!name){UI.toast('填个名字吧');return;}
    const gram=+document.getElementById('mg')?.value||100;
    const unit=mealSelUnit();
    const note=document.getElementById('mnote')?.value?.trim()||'';
    S.get().diet.push({id:S.uid(),date:date,meal:key,name,gram:gram,unit:unit,
      cal:+document.getElementById('mc').value||0,
      protein:+document.getElementById('mp')?.value||0,
      carb:+document.getElementById('mca')?.value||0,
      fiber:+document.getElementById('mf')?.value||0,img:_pendingMealImg||null,avoid:[],hidden:false,note});
    _pendingMealImg='';
    S.save();UI.close();redrawDiet();
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
  }
  /* 手动添加表单中选择图片 */
  function onMealImgPick(input){
    const file=input.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=e=>{
      compressImg(e.target.result).then(small=>{
        _pendingMealImg=small;
        const prev=document.getElementById('mi-preview');
        if(prev)prev.value=file.name;
        let thumb=document.getElementById('mi-thumb');
        if(!thumb){thumb=document.createElement('img');thumb.id='mi-thumb';thumb.style.cssText='max-width:100%;max-height:120px;border-radius:8px;margin-top:6px;display:block';input.parentNode.appendChild(thumb);}
        thumb.src=small;
      });
    };
    reader.readAsDataURL(file);
  }
  /* 编辑餐饮记录 */
  function editMeal(id){
    const m=S.get().diet.find(x=>x.id===id);if(!m)return;
    _pendingMealImg=m.img||'';
    _mealRef=m;_mealRefGram=m.gram||100; // 编辑时以本条自身为换算基准
    const histNames=[...new Map((S.get().diet||[]).map(x=>[x.name,x.name]).filter(Boolean)).keys()].reverse().slice(0,50);
    const gram=m.gram||100;
    UI.modal(`<div class="modal-title">编辑${(MEAL_CN[m.meal]||'餐次')}</div>
      <div class="small muted" style="margin-bottom:8px">${S.fmtCN(m.date)}</div>
      <div class="field"><label>食物名称</label><input id="mn" value="${m.name.replace(/"/g,'&quot;')}" list="meal-name-list">
        <datalist id="meal-name-list">${histNames.map(n=>`<option value="${n.replace(/"/g,'&quot;')}">`).join('')}</datalist></div>
      <div class="field"><label>克重 / 份量</label>
        <div class="flex gap8" style="align-items:center">
          <input id="mg" type="number" value="${gram}" inputmode="numeric" style="flex:1" placeholder="克重/份量">
          <span id="mu-label" class="small muted">${m.unit||'克'}</span>
        </div>
        <div class="uchips" id="mu">
          ${MEAL_UNITS.map((u,i)=>`<button type="button" class="uchip${((m.unit&&m.unit===u.t)||(!m.unit&&i===0))?' on':''}" data-k="${u.k}" data-g="${u.g}" data-t="${u.t}">${u.t}</button>`).join('')}
        </div>
        <div id="mu-history" class="meal-history"></div>
      </div>
      <div class="field" style="position:relative">
        <label>📷 图片</label>
        <div class="flex gap8"><input id="mi-preview" readonly placeholder="${m.img?'已选择图片':'未选择图片'}" style="flex:1;cursor:pointer" onclick="document.getElementById('mi-file').click()">
        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('mi-file').click()">${m.img?'更换图片':'选择图片'}</button>
        ${m.img?`<button type="button" class="btn btn-ghost btn-sm" onclick="Fat._pendingImg='';document.getElementById('mi-preview').value='未选择图片';const t=document.getElementById('mi-thumb');if(t)t.remove();">删除</button>`:''}
        </div>
        <input id="mi-file" type="file" accept="image/*" style="display:none" onchange="Fat.onMealImgPick(this)">
        ${_pendingMealImg?`<img id="mi-thumb" src="${_pendingMealImg}" style="max-width:100%;max-height:120px;border-radius:8px;margin-top:6px;display:block">`:''}
      </div>
      <div class="field"><label>热量 kcal</label><input id="mc" type="number" value="${m.cal}"></div>
      <div class="grid3">
        <div class="field"><label>蛋白g</label><input id="mp" type="number" value="${m.protein||0}"></div>
        <div class="field"><label>碳水g</label><input id="mca" type="number" value="${m.carb||0}"></div>
        <div class="field"><label>纤维g</label><input id="mf" type="number" value="${m.fiber||0}"></div>
      </div>
      <div class="field"><label>备注</label><textarea id="mnote" placeholder="可选，如 去酱、少油、自制">${(m.note||'').replace(/</g,'&lt;')}</textarea></div>
      <div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Fat.saveMealEdit('${id}')">保存</button><button class="btn btn-ghost btn-block" onclick="UI.close();_pendingImg='';">取消</button></div>`);
    setTimeout(()=>setupMealForm(),0);
  }
  function saveMealEdit(id){
    const m=S.get().diet.find(x=>x.id===id);if(!m)return;
    m.name=document.getElementById('mn').value.trim()||m.name;
    m.gram=+document.getElementById('mg')?.value||100;
    m.unit=mealSelUnit();
    m.cal=+document.getElementById('mc').value||0;
    m.protein=+document.getElementById('mp')?.value||0;
    m.carb=+document.getElementById('mca')?.value||0;
    m.fiber=+document.getElementById('mf')?.value||0;
    m.note=document.getElementById('mnote')?.value?.trim()||'';
    m.img=_pendingMealImg!==''?_pendingMealImg:m.img; // '' 表示删除，否则保留原值或用新图
    _pendingMealImg='';
    S.save();UI.close();redrawDiet();
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
    UI.toast('已更新 🍽');
  }
  function delMeal(id){S.get().diet=S.get().diet.filter(m=>m.id!==id);S.save();redrawDiet();}
  function recToTodo(name){if(window.Todo)Todo.addQuick('吃：'+name,'daily');}
  function comboToTodo(combo){if(window.Todo)Todo.addQuick('吃：'+combo,'daily');UI.toast('已记成待办 📝');}
  /* 搭配卡片点击 → 展示食材热量详情 + 记成待办 */
  function comboDetail(combo){
    const ings=(window.Recipes&&Recipes.comboIngredients)?Recipes.comboIngredients(combo):[];
    const ingHtml=ings.length?ings.map(i=>`<div class="flex between" style="padding:4px 0;border-bottom:1px solid var(--line2)"><span>${i.n}</span><span style="color:var(--pink);font-weight:600">${i.c} kcal</span></div>`).join(''):'<div class="small muted">暂无详细拆解</div>';
    const total=ings.reduce((s,i)=>s+i.c,0);
    UI.modal(`<div class="modal-title">🥗 搭配详情</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:8px">${combo}</div>
      <div class="small muted" style="margin-bottom:10px">食材热量拆解（合计约 ${total||'?'} kcal）</div>
      <div class="card" style="box-shadow:none;padding:10px 12px">${ingHtml}</div>
      <button class="btn btn-primary btn-block mt12" onclick="UI.close();Fat.comboToTodo('${combo.replace(/'/g,"\\'")}')">＋ 记成今日待办</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">关闭</button>`);
  }
  /* 换一批：换一组均衡搭配 */
  function refreshRecipes(){
    const d=S.get();
    if(!d.recipeNet)d.recipeNet={date:'',items:[]};
    /* 用随机大种子，配合食材池随机组合 → 每次都可能是全新搭配 */
    const seed=((d.recipeNet.seed|0)+1+Math.floor(Math.random()*99991))%1000003;
    if(window.Recipes&&Recipes.regenCombos)Recipes.regenCombos(seed);
    else{d.recipeNet.seed=seed;d.recipeNet.date=S.today();S.save();}
    redrawDiet();
    UI.toast('已换一批搭配 🥗');
  }
  /* 🌐 手动重新联网抓灵感搭配 */
  function refreshNetCombos(){
    if(!(window.Recipes&&Recipes.ensureNet)){UI.toast('联网模块没准备好');return;}
    UI.toast('正在联网找灵感…🌐');
    Promise.resolve(Recipes.ensureNet(true)).then(()=>{
      redrawDiet();
      const n=(Recipes.netCombos&&Recipes.netCombos().length)||0;
      UI.toast(n?('联网拿到 '+n+' 条新灵感 🌐'):'网络没拿到，先用本地组合吧 🌿');
    }).catch(()=>{redrawDiet();UI.toast('联网失败，先用本地组合 🌿');});
  }
  function upImg(key,date){
    window._mealKey=key;
    window._mealDate=date||S.today();
    // 直接触发文件选择
    document.getElementById('food-input').click();
  }
  /* 把照片压到 480px / JPEG，避免撑爆本地存储和云同步 */
  let _pendingImg='';
  function compressImg(dataUrl){
    return new Promise(res=>{
      try{
        const img=new Image();
        img.onload=()=>{
          const max=480;
          let w=img.width,h=img.height;
          if(w>h&&w>max){h=Math.round(h*max/w);w=max;}
          else if(h>=w&&h>max){w=Math.round(w*max/h);h=max;}
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;
          cv.getContext('2d').drawImage(img,0,0,w,h);
          res(cv.toDataURL('image/jpeg',0.72));
        };
        img.onerror=()=>res(dataUrl);
        img.src=dataUrl;
      }catch(e){res(dataUrl);}
    });
  }
  function onFood(file,key){
    const reader=new FileReader();
    reader.onload=e=>{
      compressImg(e.target.result).then(small=>{
        _pendingImg=small;
        const est=AI.foodEstimate();
        UI.modal(`<div class="modal-title">📷 AI 识别中…</div>
          <div class="card" style="box-shadow:none"><img src="${small}" style="width:100%;border-radius:12px;max-height:180px;object-fit:cover;display:block"></div>
          <div class="small muted mt8">AI 估算如下，可手动修改纠正（照片会一起存进餐次卡片里）：</div>
          <div class="field"><label>食物名称</label><input id="mn" value="${est.name}"></div>
          <div class="field"><label>热量 kcal</label><input id="mc" type="number" value="${est.cal}"></div>
          <div class="grid3">
            <div class="field"><label>蛋白g</label><input id="mp" type="number" value="${est.protein}"></div>
            <div class="field"><label>碳水g</label><input id="mca" type="number" value="${est.carb}"></div>
            <div class="field"><label>纤维g</label><input id="mf" type="number" value="${est.fiber}"></div>
          </div>
          <div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Fat.saveMealImg('${key}')">保存</button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>`);
      });
    };
    reader.readAsDataURL(file);
  }
  function saveMealImg(key){
    const name=document.getElementById('mn').value.trim();if(!name){UI.toast('填个名字吧');return;}
    const date=window._mealDate||S.today();
    S.get().diet.push({id:S.uid(),date:date,meal:key,name,
      cal:+document.getElementById('mc').value||0,
      protein:+document.getElementById('mp').value||0,
      carb:+document.getElementById('mca').value||0,
      fiber:+document.getElementById('mf').value||0,
      gram:100,unit:'克',
      img:_pendingImg||'',avoid:[],hidden:false});
    _pendingImg='';
    S.save();UI.close();redrawDiet();
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
    UI.toast('已记录，照片也存好啦 📷');
  }
  /* 点击餐次里的照片放大看 */
  function viewImg(id){
    const m=S.get().diet.find(x=>x.id===id);
    if(!m||!m.img)return;
    UI.modal(`<div class="modal-title">${m.name}</div>
      <img src="${m.img}" style="width:100%;border-radius:14px;display:block">
      <div class="small muted mt8" style="text-align:center">${m.cal} kcal · 蛋白${m.protein||0}g · 碳水${m.carb||0}g · 纤维${m.fiber||0}g</div>
      <button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>`);
  }

  /* ---------- 菜谱教程 & 自定义菜谱 ---------- */
  function openRecipe(id){
    const r=window.Recipes?Recipes.getRecipe(id):(S.get().recipes||[]).find(x=>x.id===id);
    if(r){ showLocalRecipe(r); return; }
    UI.toast('没找到这道菜');
  }
  function showLocalRecipe(r){
    const MEAL={breakfast:'早餐',lunch:'午餐',dinner:'晚餐',snack:'加餐'};
    const isCombo=!!r.combo;
    let html='<div class="modal-title">'+r.name+'</div>'
      +'<div class="small muted" style="margin-bottom:10px">'+(MEAL[r.meal]||'')+' · 🔥'+r.cal+' kcal · 蛋白'+r.protein+'g · 碳水'+r.carb+'g · 纤维'+r.fiber+'g</div>';
    if(isCombo){
      html+='<div class="rec-block"><div class="rec-block-h">🍽️ 搭配建议</div><div class="small" style="line-height:1.65;color:var(--text2)">'+(r.desc||'均衡搭配，按建议量食用即可')+'</div></div>';
    }else if(r.ing){
      html+='<div class="rec-block"><div class="rec-block-h">🧺 食材</div><div class="small">'+r.ing+'</div></div>';
    }
    html+='<div class="rec-block"><div class="rec-block-h">'+(isCombo?'💡 小贴士':'👩‍🍳 做法')+'</div>';
    if(isCombo){
      html+='<div class="small" style="line-height:1.6">以上为今日均衡搭配建议，可根据实际食材和口味灵活调整。重点是：蛋白质每餐都有、蔬菜占半盘、主食控制量。</div>';
    }else if(r.steps&&r.steps.length){
      html+='<ol class="rec-steps">'+r.steps.map(s=>'<li>'+s+'</li>').join('')+'</ol>';
    }else{
      html+='<div class="small muted">这道菜还没写做法，点下面「编辑」补上吧～</div>';
    }
    html+='</div>'
      +'<button class="btn btn-primary btn-block mt12" onclick="Fat.recToTodo(\''+r.name.replace(/'/g,"\\'")+'\')">＋ 加入今日待办</button>';
    if(!isCombo)html+='<button class="btn btn-ghost btn-block mt8" onclick="Fat.eatRecipe(\''+r.id+'\')">🍽 记一笔到今日餐次</button>';
    if(!isCombo)html+='<button class="btn btn-ghost btn-block mt8" onclick="Fat.editRecipe(\''+r.id+'\')">✏️ 编辑这道菜</button>';
    if(r.custom)html+='<button class="btn btn-ghost btn-block mt8" style="color:#e06a86" onclick="Fat.delRecipe(\''+r.id+'\')">删除</button>';
    html+='<button class="btn btn-ghost btn-block mt8" onclick="UI.close()">关闭</button>';
    UI.modal(html);
  }
  function newRecipe(){recipeForm(null);}
  function editRecipe(id){recipeForm((S.get().recipes||[]).find(x=>x.id===id));}
  function recipeForm(r){
    const r0=r||{id:'',name:'',meal:'lunch',cal:400,protein:20,carb:40,fiber:5,ing:'',steps:[]};
    UI.modal(`<div class="modal-title">${r?'编辑菜谱':'添加我的菜谱'}</div>
      <div class="field"><label>菜名</label><input id="rc-name" value="${(r0.name||'').replace(/"/g,'&quot;')}" placeholder="如 番茄鸡蛋面"></div>
      <div class="field"><label>属于哪一餐</label>
        <div class="seg" id="rc-meal">
          ${[['breakfast','早餐'],['lunch','午餐'],['dinner','晚餐'],['snack','加餐']].map(m=>`<div class="opt ${r0.meal===m[0]?'on':''}" data-m="${m[0]}">${m[1]}</div>`).join('')}
        </div></div>
      <div class="grid2">
        <div class="field"><label>热量 kcal</label><input id="rc-cal" type="number" value="${r0.cal}"></div>
        <div class="field"><label>蛋白 g</label><input id="rc-p" type="number" value="${r0.protein}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>碳水 g</label><input id="rc-c" type="number" value="${r0.carb}"></div>
        <div class="field"><label>纤维 g</label><input id="rc-f" type="number" value="${r0.fiber}"></div>
      </div>
      <div class="field"><label>食材（用顿号或逗号隔开）</label><input id="rc-ing" value="${(r0.ing||'').replace(/"/g,'&quot;')}" placeholder="番茄2个、鸡蛋2个、面条100g"></div>
      <div class="field"><label>做法（一行写一步）</label>
        <textarea id="rc-steps" rows="6" placeholder="番茄切块、鸡蛋打散&#10;热锅下蛋炒到半凝固盛出&#10;下番茄炒出汁，加水煮开&#10;下面条煮熟，回锅鸡蛋，调味出锅">${(r0.steps||[]).join('\n')}</textarea></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Fat.saveRecipe('${r0.id}')">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
    document.querySelectorAll('#rc-meal .opt').forEach(o=>o.onclick=()=>{
      document.querySelectorAll('#rc-meal .opt').forEach(x=>x.classList.remove('on'));o.classList.add('on');});
  }
  function saveRecipe(id){
    const name=document.getElementById('rc-name').value.trim();
    if(!name){UI.toast('给这道菜起个名字吧');return;}
    const meal=(document.querySelector('#rc-meal .opt.on')||{dataset:{m:'lunch'}}).dataset.m;
    const steps=document.getElementById('rc-steps').value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const obj={name,meal,
      cal:+document.getElementById('rc-cal').value||0,
      protein:+document.getElementById('rc-p').value||0,
      carb:+document.getElementById('rc-c').value||0,
      fiber:+document.getElementById('rc-f').value||0,
      ing:document.getElementById('rc-ing').value.trim(),steps};
    const list=S.get().recipes;
    const cur=id?list.find(x=>x.id===id):null;
    if(cur)Object.assign(cur,obj);
    else list.push(Object.assign({id:S.uid(),custom:true},obj));
    S.save();UI.close();redrawDiet();
    UI.toast('菜谱已保存 👩‍🍳');
  }
  function delRecipe(id){
    S.get().recipes=S.get().recipes.filter(x=>x.id!==id);
    S.save();UI.close();redrawDiet();UI.toast('已删除');
  }
  /* 把推荐菜直接记进今天的餐次（仅具体菜谱，搭配建议不支持） */
  function eatRecipe(id){
    const r=window.Recipes?Recipes.getRecipe(id):(S.get().recipes||[]).find(x=>x.id===id);
    if(!r){UI.toast('没找到这道菜');return;}
    if(r.combo){UI.toast('这是搭配建议哦，按建议自己搭配就好～');return;}
    S.get().diet.push({id:S.uid(),date:S.today(),meal:r.meal||'lunch',name:r.name,
      cal:r.cal||0,protein:r.protein||0,carb:r.carb||0,fiber:r.fiber||0,gram:100,unit:'克',img:r.img||'',avoid:[],hidden:false});
    S.save();UI.close();redrawDiet();
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
    UI.toast('已记到今日'+(MEAL_CN[r.meal]||'午餐')+' 🍽');
  }
  function editAvoid(){
    const avoid=S.get().avoid||[];
    UI.modal('<div class="modal-title">忌口管理</div>'
      +'<div class="small muted" style="margin-bottom:8px">写下不吃的食材或菜名（如 香菜、内脏、辣）。命中的菜谱会自动从「我的菜谱」里隐藏，点标签可删除。</div>'
      +'<div class="chips" id="av">'+(avoid.length?avoid.map(a=>'<div class="chip on" data-v="'+String(a).replace(/"/g,'&quot;')+'">'+a+' ✕</div>').join(''):'<span class="small muted" id="av-empty">还没有忌口</span>')+'</div>'
      +'<div class="flex gap8 mt12" style="align-items:flex-end">'
      +'  <div class="field" style="flex:1;margin-bottom:0"><input id="avn" placeholder="输入忌口，如 香菜"></div>'
      +'  <button class="btn btn-ghost btn-sm" style="flex-shrink:0" onclick="Fat.addAvoidChip()">＋ 添加</button>'
      +'</div>'
      +'<div class="flex gap8 mt12"><button class="btn btn-primary btn-block" onclick="Fat.saveAvoid()">保存</button>'
      +'<button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>');
    bindAvoidChips();
    const inp=document.getElementById('avn');
    if(inp){
      inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();addAvoidChip();} });
      setTimeout(()=>{try{inp.focus();}catch(e){}},60);
    }
  }
  function bindAvoidChips(){
    document.querySelectorAll('#av .chip').forEach(c=>{c.onclick=()=>c.remove();});
  }
  /* 支持一次输入多个：香菜、内脏,辣 */
  function addAvoidChip(){
    const inp=document.getElementById('avn');const box=document.getElementById('av');
    if(!inp||!box)return;
    const raw=inp.value.trim();
    if(!raw){UI.toast('先写点什么呀 🥗');return;}
    const empt=document.getElementById('av-empty');if(empt)empt.remove();
    const exist=[...box.querySelectorAll('.chip')].map(c=>c.dataset.v);
    let n=0;
    raw.split(/[，,、;；\s]+/).map(s=>s.trim()).filter(Boolean).forEach(v=>{
      if(exist.indexOf(v)>=0)return;
      exist.push(v);
      const c=document.createElement('div');
      c.className='chip on';c.dataset.v=v;c.textContent=v+' ✕';
      c.onclick=()=>c.remove();
      box.appendChild(c);n++;
    });
    inp.value='';
    if(n)UI.toast('已添加 '+n+' 个忌口，记得点保存');
    else UI.toast('这个已经在列表里啦');
  }
  function saveAvoid(){
    /* 输入框里还没点添加的内容也一并存下，避免"加不上" */
    const inp=document.getElementById('avn');
    if(inp&&inp.value.trim())addAvoidChip();
    const chips=[...document.querySelectorAll('#av .chip')]
      .map(c=>c.dataset.v||c.textContent.replace(' ✕','').trim())
      .filter(Boolean);
    S.get().avoid=chips;S.save();UI.close();redrawDiet();
    UI.toast(chips.length?'已保存 '+chips.length+' 个忌口 🥗':'忌口已清空');
  }
  function dietBrief(){
    const content=AI.dietAdvice()+'\n\n'+(S.S.dietToday(S.today()).length?'今日已记录 '+S.S.dietToday(S.today()).length+' 餐，棒棒的 💗':'记得按时吃饭哦');
    S.get().reviews.push({id:S.uid(),type:'diet',date:S.today(),content,modules:['饮食']});S.save();
    UI.modal('<div class="modal-title">🍽️ AI 饮食简报</div><div class="review-box">'+content.replace(/\n/g,'<br>')+'</div><button class="btn btn-primary btn-block mt12" onclick="UI.close()">收下温柔 💗</button>');
  }

  /* ---------- 体重 ---------- */
  const SCENES=['起床空腹','早餐前','早餐后','午餐前','午餐后','晚餐前','晚餐后','入睡前'];
  const BMI_ZONES=[
    {name:'体重过低',max:18.5,color:'#9ad0e8'},
    {name:'体重正常',max:24,color:'#8fd6a8'},
    {name:'超重',max:28,color:'#ffcf8f'},
    {name:'肥胖',max:99,color:'#f093a8'}
  ];
  const ICON_MASCOT=`<svg class="mascot-svg" viewBox="0 0 64 64" fill="none">
    <ellipse cx="32" cy="59" rx="19" ry="4.5" fill="#000" opacity=".05"/>
    <circle cx="32" cy="30" r="20" fill="#ffd9e3"/>
    <circle cx="32" cy="30" r="20" fill="none" stroke="#e86890" stroke-width="2.4"/>
    <path d="M32 9c-5-6-14-5-15 1 4-1 8 0 9 4" fill="#ffb3c2" stroke="#e86890" stroke-width="2" stroke-linejoin="round"/>
    <path d="M32 9c5-6 14-5 15 1-4-1-8 0-9 4" fill="#ffb3c2" stroke="#e86890" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="25" cy="29" r="2.6" fill="#3B2A30"/>
    <circle cx="39" cy="29" r="2.6" fill="#3B2A30"/>
    <circle cx="21" cy="35" r="3.4" fill="#ff8fab" opacity=".55"/>
    <circle cx="43" cy="35" r="3.4" fill="#ff8fab" opacity=".55"/>
    <path d="M27 37c2 2.4 8 2.4 10 0" stroke="#3B2A30" stroke-width="2.2" stroke-linecap="round" fill="none"/>
  </svg>`;
  let _wState={date:null,scene:'起床空腹',kg:60,fat:null,editId:null};
  let _hist={cycle:'week',ym:null,sel:null,comparing:false,picks:[]};
  function kg2jin(kg){return Math.round((+kg)*20)/10;}
  function dispKg(kg){return kg==null||kg===''?'—':kg2jin(kg)+' 斤';}
  function helpTip(txt){return '<button class="hc-help" onclick="Fat.tip('+JSON.stringify(txt).replace(/"/g,'&quot;')+')">?</button>';}
  function latestLog(){return S.S.latestWeightLog();}
  function metaProfile(){return S.get().settings.metaProfile||{};}
  function bmrOf(prof,kg){
    const g=prof.gender||'female', age=+prof.age||0, ht=+prof.height||0, w=+kg||0, act=+prof.activity||1.2;
    if(!age||!ht||!w)return null;
    const bmr=g==='female'?10*w+6.25*ht-5*age-161:10*w+6.25*ht-5*age+5;
    return {bmr:Math.round(bmr),tdee:Math.round(bmr*act)};
  }
  function goalSettings(){const s=S.get().settings;return {start:(s.startWeight!=null?s.startWeight:null),goal:(s.goalWeight!=null?s.goalWeight:null)};}
  function bmiZoneName(b){if(b==null)return '—';for(const z of BMI_ZONES)if(b<z.max)return z.name;return '肥胖';}
  function bmiPct(b){if(b==null)return 0;return Math.max(0,Math.min(100,(b-15)/(40-15)*100));}

  /* ---------- 身体维度（围度） ---------- */
  const DIMENSIONS=[
    {k:'waist',name:'腰围',ico:'🌀'},
    {k:'chest',name:'胸围',ico:'💗'},
    {k:'hip',name:'臀围',ico:'🍑'},
    {k:'thigh',name:'大腿围',ico:'🦵'},
    {k:'calf',name:'小腿围',ico:'🦶'},
    {k:'belly',name:'肚子维度',ico:'⭕'}
  ];
  function dimName(k){const d=DIMENSIONS.find(x=>x.k===k);return d?d.name:k;}
  function dimIco(k){const d=DIMENSIONS.find(x=>x.k===k);return d?d.ico:'📏';}
  let _mState={date:null,key:null,value:0,note:'',editId:null};
  function renderWeight(body){
    const hid=S.get().settings.hideWeight;
    const logs=S.get().weightLogs||[];
    const last=latestLog();
    const prof=metaProfile();
    const ht=+prof.height||0;
    const curKg=last?last.weight:(prof.weight||null);
    const bmr=bmrOf(prof,curKg);
    const lastFat=last?last.fat:null;
    const bmi=(curKg&&ht)?curKg/Math.pow(ht/100,2):null;
    const g=goalSettings();
    const sorted=logs.slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    const startKg=g.start!=null?g.start:(sorted.length?sorted[0].weight:null);
    const goalKg=g.goal!=null?g.goal:null;
    let pct=0,diff=null;
    if(startKg!=null&&goalKg!=null&&curKg!=null&&goalKg<startKg){
      pct=Math.max(0,Math.min(100,Math.round((startKg-curKg)/(startKg-goalKg)*100)));
      diff=+(startKg-curKg).toFixed(1);
    }
    const tv=[];
    for(let i=6;i>=0;i--){const dt=S.addDays(S.today(),-i);const w=S.S.weightToday(dt);if(w&&w.morning!=null)tv.push(+w.morning);}
    const chart=tv.length>=2?UI.lineChart(tv,tv.map((v,i)=>S.fmtCN(S.addDays(S.today(),-i)))):'';
    const zone=bmiZoneName(bmi);

    let html=`
      <div class="card health-card">
        <div class="hc-head">
          <div class="hc-title">⚖️ 健康指数</div>
          <div class="hc-acts">
            <span class="pill ${hid?'on':''}" onclick="Fat.toggleHide()">${hid?'已隐藏':'显示'}</span>
            <button class="hc-hist" onclick="Fat.openWeightHistory()">📊 历史记录</button>
          </div>
        </div>
        <div class="hc-grid">
          <div class="hc-item">
            <div class="hc-label">体重 ${helpTip('当前体重：最近一次记录的数值，单位斤（1kg=2斤）')}</div>
            <div class="hc-val ${hid?'hide-num':''}">${dispKg(curKg)}</div>
          </div>
          <div class="hc-item" onclick="Fat.editMeta()">
            <div class="hc-label">身高 ${helpTip('身高用于计算 BMI 与基础代谢，点此可填写身体参数')}</div>
            <div class="hc-val">${ht?ht+' cm':'去设置 ›'}</div>
          </div>
          <div class="hc-item" onclick="Fat.editMeta()">
            <div class="hc-label">基础代谢 ${helpTip('基础代谢 BMR：完全静止时，身体维持呼吸、心跳、体温等基本生命活动所消耗的热量（Mifflin-St Jeor 公式）')}</div>
            <div class="hc-val">${bmr?bmr.bmr+'<small> kcal</small>':'去设置 ›'}</div>
          </div>
          <div class="hc-item">
            <div class="hc-label">体脂率 ${helpTip('体脂率=身体脂肪重量÷体重，反映胖瘦的身体构成，比单纯体重更有参考意义')}</div>
            <div class="hc-val ${hid?'hide-num':''}">${lastFat!=null?lastFat+'%':'—'}</div>
          </div>
        </div>
        <div class="hc-bmi">
          <div class="hc-bmi-row">
            <span class="hc-bmi-name">BMI</span>
            <b class="hc-bmi-num ${hid?'hide-num':''}">${bmi!=null?bmi.toFixed(1):'—'}</b>
            <span class="hc-bmi-tag z-${BMI_ZONES.findIndex(z=>z.name===zone)}">${zone}</span>
          </div>
          <div class="bmi-bar">
            ${BMI_ZONES.map(z=>`<div class="bmi-seg" style="background:${z.color}">${z.name}</div>`).join('')}
            <div class="bmi-mark" style="left:${bmiPct(bmi)}%"></div>
          </div>
          <div class="bmi-scale"><span>15</span><span>18.5</span><span>24</span><span>28</span><span>40+</span></div>
        </div>
      </div>

      <div class="card goal-card">
        <div class="goal-top">
          <div class="goal-mascot">${ICON_MASCOT}</div>
          <div class="goal-cur">
            <div class="goal-cur-label">当前体重</div>
            <div class="goal-cur-val ${hid?'hide-num':''}">${dispKg(curKg)}</div>
          </div>
        </div>
        <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
        <div class="goal-meta">
          <div class="gm"><span>已减</span><b class="${hid?'hide-num':''}">${diff!=null?diff+' kg':'—'}</b></div>
          <div class="gm"><span>完成</span><b>${pct}%</b></div>
          <div class="gm"><span>目标</span><b class="${hid?'hide-num':''}">${goalKg!=null?dispKg(goalKg):'去设 ›'}</b></div>
        </div>
        <div class="goal-sub">初始 ${startKg!=null?dispKg(startKg):'—'} <span class="arrow">→</span> 目标 ${goalKg!=null?dispKg(goalKg):'—'}</div>
        ${goalKg==null?`<button class="btn btn-ghost btn-block mt10" onclick="Fat.setGoalWeight()">⚙ 设置目标体重</button>`:''}
        <button class="btn btn-primary btn-block mt10" onclick="Fat.openWeight()">＋ 记录今日体重</button>
      </div>

      <div class="card" onclick="Fat.openDimensions()">
        <div class="card-h"><div class="l"><span class="ico">📏</span>身体维度</div>
          <span class="pill">全部 ›</span></div>
        <div class="dim-grid">
          ${DIMENSIONS.map(dm=>{
            const v=S.S.bodyMetricLatest(dm.k);
            return `<div class="dim-cell" onclick="event.stopPropagation();Fat.openMetric('${dm.k}')">
              <span class="dim-ico">${dm.ico}</span>
              <div class="dim-name">${dm.name}</div>
              <div class="dim-val ${hid?'hide-num':''}">${v?'<b>'+v.value+'</b> cm':'—'}</div>
              <div class="dim-date">${v?S.fmtCN(v.date):'去记一笔'}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">📈</span>近 7 日体重</div></div>
        ${chart||'<div class="small muted">记录几天后就能看到温柔的曲线啦～</div>'}
      </div>
    `;
    body.innerHTML=html;
    if(I&&I.upgrade)I.upgrade(body);
  }
  function toggleHide(){const s=S.get().settings;s.hideWeight=!s.hideWeight;S.save();renderWeight(document.getElementById('fat-body'));if(document.getElementById('page-home').classList.contains('active'))Home.render();}
  function saveWeight(){
    const unit=S.get().settings.weightUnit||'kg';
    let m=document.getElementById('wm').value, n=document.getElementById('wn').value;
    /* 如果当前是斤模式，转换为 kg 存储 */
    if(unit==='jin'){m=m?+m/2:'';n=n?+n/2:'';}
    const d=S.today();let w=S.S.weightToday(d);
    if(!w){w={id:S.uid(),date:d,morning:null,night:null,intake:0,burn:0,water:0,dailyBurn:0,hidden:S.get().settings.hideWeight};S.get().weights.push(w);}
    w.morning=m?+m:w.morning;w.night=n?+n:w.night;w.hidden=S.get().settings.hideWeight;
    S.save();renderWeight(document.getElementById('fat-body'));
    /* 保存后清空输入框 */
    const wi=document.getElementById('wm'),wni=document.getElementById('wn');
    if(wi)wi.value='';if(wni)wni.value='';
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
    UI.toast('已保存，好好爱自己 💗');
  }
  function toggleWeightUnit(){
    const s=S.get().settings;
    s.weightUnit=(s.weightUnit||'kg')==='jin'?'kg':'jin';
    S.save();renderWeight(document.getElementById('fat-body'));
  }
  /* 代谢计算器：Mifflin-St Jeor 公式 */
  function calcMetabolism(){
    const gender=document.getElementById('mg').value;
    const age=+document.getElementById('ma').value||0;
    const ht=+document.getElementById('mh').value||0;
    const wt=+document.getElementById('mw').value||0;
    const act=+document.getElementById('mact').value||1.2;
    if(!age||!ht||!wt){UI.toast('请填写年龄、身高、体重');return;}
    /* Mifflin-St Jeor */
    let bmr;
    if(gender==='female')bmr=10*wt+6.25*ht-5*age-161;
    else bmr=10*wt+6.25*ht-5*age+5;
    const tdee=Math.round(bmr*act);
    const rec=Math.round(tdee-400); // 建议减脂摄入（TDEE - 400）
    const curGoal=S.get().settings.calGoal||rec;
    /* 保存用户画像 */
    S.get().settings.metaProfile={gender,age,ht,height:ht,wt,weight:wt,activity:act};
    S.save();
    const box=document.getElementById('meta-result');
    if(box)box.innerHTML=`
      <div class="grid3" style="margin-top:12px;gap:8px">
        <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px;color:#5faa74">${Math.round(bmr)}</div><div class="lbl">基础代谢 BMR</div><div class="small muted">kcal/天（不动也消耗）</div></div>
        <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px;color:var(--pink)">${tdee}</div><div class="lbl">每日消耗 TDEE</div><div class="small muted">kcal/天（含活动）</div></div>
        <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px;color:#e2a13c">${rec}</div><div class="lbl">推荐减脂摄入</div><div class="small muted">kcal/天（TDEE-400）</div></div>
      </div>
      <div class="field mt12" style="background:var(--bg);padding:10px;border-radius:10px;border:1px solid var(--line)">
        <label>我的每日目标：<input id="mgoal" type="number" value="${curGoal}" style="width:80px;text-align:center;border:1px solid var(--line);border-radius:7px;padding:4px 8px;font-size:14px;font-weight:700;color:var(--pink)"> kcal
        <span class="small muted" style="margin-left:6px">（建议比 TDEE 少 300~500）</span></label>
        <button class="btn btn-ghost btn-sm mt8" onclick="Fat.saveMetaGoal()">设为热量上限</button>
      </div>`;
  }
  function saveMetaGoal(){
    const v=+document.getElementById('mgoal')?.value;if(!v)return;
    S.get().settings.calGoal=v;S.save();
    UI.toast('已设置每日热量上限 '+v+' kcal 💪');
    redrawDiet();
  }
  function editBody(){
    const d=S.today();const w=S.S.weightToday(d)||{intake:0,burn:0,water:0,dailyBurn:0};
    UI.modal('<div class="modal-title">编辑身体数据</div>'+
      '<div class="field"><label>摄入(kcal)</label><input id="bi" type="number" value="'+(w.intake||0)+'"></div>'+
      '<div class="field"><label>运动消耗(kcal)</label><input id="bo" type="number" value="'+(w.burn||0)+'"></div>'+
      '<div class="field"><label>⌚ 日常消耗(kcal)</label><input id="db" type="number" value="'+(w.dailyBurn||0)+'" placeholder="手表/走路等非运动消耗"></div>'+
      '<div class="field"><label>饮水(ml)</label><input id="bw" type="number" value="'+(w.water||0)+'"></div>'+
      '<button class="btn btn-primary btn-block" onclick="Fat.saveBody()">保存</button>');
  }
  function saveBody(){
    const d=S.today();let w=S.S.weightToday(d);if(!w){w={id:S.uid(),date:d,morning:null,night:null,intake:0,burn:0,water:0,dailyBurn:0,hidden:S.get().settings.hideWeight};S.get().weights.push(w);}
    w.intake=+document.getElementById('bi').value||0;w.burn=+document.getElementById('bo').value||0;w.dailyBurn=+document.getElementById('db').value||0;w.water=+document.getElementById('bw').value||0;
    S.save();UI.close();renderWeight(document.getElementById('fat-body'));
  }
  function delWeight(id){S.get().weights=S.get().weights.filter(w=>w.id!==id);S.save();renderWeight(document.getElementById('fat-body'));}

  function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function nowHM(){const d=new Date();return S.pad(d.getHours())+':'+S.pad(d.getMinutes());}

  /* ====== 记体重弹窗（底部 sheet） ====== */
  function openWeight(date,editId){
    const logs=S.get().weightLogs||[];
    const edit=editId?logs.find(x=>x.id===editId):null;
    const base=edit||latestLog()||{weight:60,scene:'起床空腹',fat:null,date:S.today()};
    _wState={date:edit?edit.date:(date||S.today()),scene:edit?edit.scene:base.scene,kg:edit?edit.weight:base.weight,fat:edit?edit.fat:null,editId:editId||null};
    const minKg=30,maxKg=130,step=0.1,N=Math.round((maxKg-minKg)/step);
    const items=[];for(let i=0;i<=N;i++)items.push(+(minKg+i*step).toFixed(1));
    const wheel=items.map(v=>`<div class="ww-item" data-v="${v}">${v} <small>kg</small></div>`).join('');
    UI.modal(`
      <div class="wsheet">
        <div class="ws-head">
          <button class="ws-x" onclick="UI.close()">✕</button>
          <div class="ws-title">${editId?'编辑体重记录':'记录体重'}</div>
          <button class="ws-done" onclick="Fat.saveWeightLog()">保存</button>
        </div>
        <div class="ws-date" onclick="UI.datePicker('${_wState.date}',ds=>Fat._setWDate(ds))">
          📅 ${S.fmtCN(_wState.date)} <span class="ws-date-link">切换日期 ›</span>
        </div>
        <div class="ws-label">称重场景</div>
        <div class="ws-scenes">
          ${SCENES.map(s=>`<button class="scene-chip${s===_wState.scene?' on':''}" onclick="Fat._pickScene('${s}')">${s}</button>`).join('')}
        </div>
        <div class="ws-label">体重（滚轮选择）</div>
        <div class="wwrap">
          <div class="ww-center"></div>
          <div class="wwheel" id="ww">${wheel}</div>
        </div>
        <div class="ws-val"><b id="wjin">${kg2jin(_wState.kg)}</b> 斤 <span class="ws-val-kg">/ <b id="wkg">${_wState.kg}</b> kg</span></div>
        <div class="field mt10"><label>体脂率（选填，%）</label><input id="wf" type="number" step="0.1" value="${_wState.fat!=null?_wState.fat:''}" placeholder="如 28.5"></div>
      </div>
    `);
    setTimeout(()=>{
      const w=document.getElementById('ww');if(!w)return;
      const HW=36, idx0=Math.max(0,Math.min(N,Math.round((_wState.kg-minKg)/step)));
      w.scrollTop=idx0*HW;
      const onScroll=()=>{
        const idx=Math.max(0,Math.min(items.length-1,Math.round(w.scrollTop/HW)));
        _wState.kg=items[idx];
        const j=document.getElementById('wjin'),k=document.getElementById('wkg');
        if(j)j.textContent=kg2jin(items[idx]); if(k)k.textContent=items[idx].toFixed(1);
        w.querySelectorAll('.ww-item').forEach((el,i)=>el.classList.toggle('on',i===idx));
      };
      w.addEventListener('scroll',onScroll,{passive:true});
      onScroll();
    },30);
  }
  function _pickScene(s){_wState.scene=s;const box=document.querySelector('.ws-scenes');if(box)box.innerHTML=SCENES.map(x=>`<button class="scene-chip${x===s?' on':''}" onclick="Fat._pickScene('${x}')">${x}</button>`).join('');}
  function _setWDate(ds){_wState.date=ds;const box=document.querySelector('.ws-date');if(box)box.innerHTML='📅 '+S.fmtCN(ds)+' <span class="ws-date-link">切换日期 ›</span>';}
  function saveWeightLog(){
    const fat=document.getElementById('wf').value;
    const log={id:S.uid(),date:_wState.date,time:nowHM(),scene:_wState.scene,weight:+_wState.kg,fat:fat?+fat:null};
    const logs=S.get().weightLogs;
    if(_wState.editId){const i=logs.findIndex(x=>x.id===_wState.editId);if(i>=0)logs[i]=Object.assign({},logs[i],log,{id:_wState.editId});}
    else logs.push(log);
    S.save();UI.close();
    const fb=document.getElementById('fat-body');if(fb)renderWeight(fb);
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
    UI.toast(_wState.editId?'已更新记录 💗':'已记录，好好爱自己 💗');
  }

  /* ====== 身体维度：整页 + 记数字弹窗 ====== */
  function openDimensions(){renderDimensions(document.getElementById('fat-body'));}
  function renderDimensions(body){
    const t=S.today();
    const todayMap=S.S.bodyMetricToday(t);
    const logs=(S.get().bodyMetrics||[]).slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).reverse().slice(0,15);
    body.innerHTML=`
      <div class="dim-full-head">
        <button class="dim-back" onclick="Fat.set('weight')">‹ 返回体重</button>
        <div class="dim-full-title">📏 身体维度</div>
      </div>
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">📅</span>${S.fmtCN(t)} · 今日记录</div></div>
        <div class="dim-grid">
          ${DIMENSIONS.map(dm=>{
            const v=todayMap[dm.k];
            return `<div class="dim-cell" onclick="Fat.openMetric('${dm.k}')">
              <span class="dim-ico">${dm.ico}</span>
              <div class="dim-name">${dm.name}</div>
              <div class="dim-val">${v!=null?'<b>'+v+'</b> cm':'—'}</div>
              <div class="dim-date">${v!=null?'今日已记':'去记一笔'}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🕓</span>最近记录</div></div>
        ${logs.length?logs.map(l=>`<div class="dim-log-row" onclick="Fat.openMetric('${l.key}','${l.id}')">
          <span class="dim-log-ico">${dimIco(l.key)}</span>
          <div class="dim-log-main"><div class="dim-log-name">${dimName(l.key)}</div><div class="dim-log-date">${l.date} ${l.time}</div></div>
          <div class="dim-log-val"><b>${l.value}</b><span> cm</span></div>
        </div>`).join(''):'<div class="small muted" style="text-align:center;padding:18px">还没有维度记录，点上面的卡片记一笔吧～</div>'}
      </div>
    `;
    if(I&&I.upgrade)I.upgrade(body);
  }
  function openMetric(key,editId){
    const dm=DIMENSIONS.find(x=>x.k===key);
    const logs=S.get().bodyMetrics||[];
    const edit=editId?logs.find(x=>x.id===editId):null;
    const base=edit||S.S.bodyMetricLatest(key)||{value:0,date:S.today()};
    _mState={date:edit?edit.date:S.today(),key,value:edit?edit.value:base.value,note:edit?edit.note:'',editId:editId||null};
    UI.modal(`
      <div class="wsheet">
        <div class="ws-head">
          <button class="ws-x" onclick="UI.close()">✕</button>
          <div class="ws-title">${dm?dm.name:'维度'} · 记录围度</div>
          <button class="ws-done" onclick="Fat.saveMetric()">保存</button>
        </div>
        <div class="ws-date" onclick="UI.datePicker('${_mState.date}',ds=>Fat._setMDate(ds))">
          📅 ${S.fmtCN(_mState.date)} <span class="ws-date-link">切换日期 ›</span>
        </div>
        <div class="ws-label">${dm?dm.name+'（cm）':''}</div>
        <div class="field mt8"><input id="mv" type="number" step="0.1" value="${_mState.value||''}" placeholder="如 68.5" inputmode="decimal" style="font-size:22px;font-weight:700;text-align:center;padding:12px"></div>
        <div class="field mt10"><label>备注（选填）</label><input id="mnote" type="text" value="${esc(_mState.note||'')}" placeholder="如 晨起空腹"></div>
      </div>
    `);
    setTimeout(()=>{const i=document.getElementById('mv');if(i)i.focus();},60);
  }
  function _setMDate(ds){_mState.date=ds;const box=document.querySelector('.ws-date');if(box)box.innerHTML='📅 '+S.fmtCN(ds)+' <span class="ws-date-link">切换日期 ›</span>';}
  function saveMetric(){
    const v=document.getElementById('mv').value;
    if(v===''||isNaN(+v)){UI.toast('请填写围度数值');return;}
    const note=document.getElementById('mnote').value;
    const logs=S.get().bodyMetrics;
    const rec={id:S.uid(),date:_mState.date,time:nowHM(),key:_mState.key,value:+v,note:note||''};
    if(_mState.editId){const i=logs.findIndex(x=>x.id===_mState.editId);if(i>=0)logs[i]=Object.assign({},logs[i],rec,{id:_mState.editId});}
    else logs.push(rec);
    S.save();UI.close();
    const fb=document.getElementById('fat-body');if(fb)renderWeight(fb);
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
    UI.toast('已记录 '+dimName(_mState.key)+' 💗');
  }

  /* ====== 历史记录页 ====== */
  function openWeightHistory(){_hist={cycle:'week',ym:S.today().slice(0,7),sel:null,comparing:false,picks:[]};renderWeightHistory(document.getElementById('fat-body'));}
  function histCycle(c){_hist.cycle=c;_hist.sel=null;renderWeightHistory(document.getElementById('fat-body'));}
  function histNav(delta){const y=+_hist.ym.slice(0,4),m=+_hist.ym.slice(5,7);const d=new Date(y,m-1+delta,1);_hist.ym=d.getFullYear()+'-'+S.pad(d.getMonth()+1);renderWeightHistory(document.getElementById('fat-body'));}
  function goHistToday(){_hist.ym=S.today().slice(0,7);_hist.sel=null;renderWeightHistory(document.getElementById('fat-body'));}
  function _pickHistDate(ds){_hist.sel=(_hist.sel===ds?null:ds);renderWeightHistory(document.getElementById('fat-body'));}
  function _histRange(){
    const t=S.today();
    if(_hist.cycle==='week'){const ws=S.weekStart(t);const a=[];for(let i=0;i<7;i++)a.push(S.addDays(ws,i));return a;}
    if(_hist.cycle==='month'){const y=+t.slice(0,4),m=+t.slice(5,7);const n=new Date(y,m,0).getDate();const a=[];for(let i=1;i<=n;i++)a.push(t.slice(0,7)+'-'+S.pad(i));return a;}
    return null;
  }
  function histLogs(){
    const logs=S.get().weightLogs||[];
    if(_hist.sel)return logs.filter(x=>x.date===_hist.sel);
    const r=_histRange();if(r)return logs.filter(x=>r.indexOf(x.date)>=0);
    return logs.slice();
  }
  function renderWeightHistory(body){
    if(!_hist.ym)_hist.ym=S.today().slice(0,7);
    const logs=histLogs().slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    const ym=_hist.ym,y=+ym.slice(0,4),m=+ym.slice(5,7);
    const startW=new Date(y,m-1,1).getDay();
    const dim=new Date(y,m,0).getDate();
    const prevDim=new Date(y,m-1,0).getDate();
    const wk=['日','一','二','三','四','五','六'];
    let head='';wk.forEach(w=>head+='<div class="cal-h">'+w+'</div>');
    let cells='';
    for(let i=startW-1;i>=0;i--){const pd=new Date(y,m-2,prevDim-i);const ds=pd.getFullYear()+'-'+S.pad(pd.getMonth()+1)+'-'+S.pad(pd.getDate());cells+='<div class="cal-cell other" onclick="Fat._pickHistDate(\''+ds+'\')">'+(prevDim-i)+'</div>';}
    for(let i=1;i<=dim;i++){const ds=ym+'-'+S.pad(i);const has=(S.get().weightLogs||[]).some(x=>x.date===ds);cells+='<div class="cal-cell'+(ds===_hist.sel?' sel':'')+(ds===S.today()?' today':'')+(has?' has':'')+'" onclick="Fat._pickHistDate(\''+ds+'\')">'+i+(has?'<i class="dot"></i>':'')+'</div>';}
    const rest=(7-((startW+dim)%7))%7;
    for(let i=1;i<=rest;i++){const nd=new Date(y,m,i);const ds=nd.getFullYear()+'-'+S.pad(nd.getMonth()+1)+'-'+S.pad(nd.getDate());cells+='<div class="cal-cell other" onclick="Fat._pickHistDate(\''+ds+'\')">'+i+'</div>';}
    const sum=histSummary();
    const rows=logs.length?logs.slice().reverse().map(l=>`
      <div class="wh-row${_hist.comparing&&_hist.picks.indexOf(l.id)>=0?' picked':''}">
        <button class="wh-edit" onclick="Fat.editWeightLog('${l.id}')" title="编辑">✎</button>
        <div class="wh-main" onclick="${_hist.comparing?'Fat._toggleCompare(\''+l.id+'\')':'Fat.openWeightDetail(\''+l.id+'\')'}">
          <div class="wh-type">${l.scene}</div>
          <div class="wh-w ${S.get().settings.hideWeight?'hide-num':''}">${kg2jin(l.weight)} 斤</div>
          <div class="wh-fat ${S.get().settings.hideWeight?'hide-num':''}">${l.fat!=null?l.fat+'%':''}</div>
          <div class="wh-time">${l.date} ${l.time}</div>
        </div>
        ${_hist.comparing?`<button class="wh-pick" onclick="Fat._toggleCompare('${l.id}')">${_hist.picks.indexOf(l.id)>=0?'✓':''}</button>`:''}
      </div>`).join(''):'<div class="small muted" style="text-align:center;padding:18px">这段时间里还没有记录～</div>';
    body.innerHTML=`
      <div class="wh-page">
        <div class="wh-head">
          <button class="wh-back" onclick="Fat.set('weight')">‹ 返回</button>
          <div class="wh-title">历史记录</div>
          <div style="width:56px"></div>
        </div>
        <div class="wh-cycles">
          <button class="whc${_hist.cycle==='week'?' on':''}" onclick="Fat.histCycle('week')">按周</button>
          <button class="whc${_hist.cycle==='month'?' on':''}" onclick="Fat.histCycle('month')">按月</button>
          <button class="whc${_hist.cycle==='all'?' on':''}" onclick="Fat.histCycle('all')">全部</button>
        </div>
        ${_hist.sel?`<div class="wh-filter">已筛选：${S.fmtCN(_hist.sel)} <button class="wh-clear" onclick="Fat._pickHistDate('${_hist.sel}')">清除 ✕</button></div>`:''}
        <div class="card" style="box-shadow:none">
          <div class="mp-head">
            <button onclick="Fat.histNav(-1)">‹</button>
            <div class="mp-t">${y}年 ${m}月</div>
            <button class="today-btn${_hist.ym===S.today().slice(0,7)?'':' go-today-pill'}" onclick="Fat.goHistToday()">${_hist.ym===S.today().slice(0,7)?'今天':'回到今天'}</button>
          </div>
          <div class="cal-wk">${head}</div>
          <div class="cal-grid">${cells}</div>
        </div>
        ${sum}
        <div class="wh-list">
          <div class="wh-row wh-head-row">
            <div class="wh-type">类型</div><div class="wh-w">体重(斤)</div><div class="wh-fat">体脂率</div><div class="wh-time">时间</div>
          </div>
          ${rows}
        </div>
        <div class="wh-foot">
          <button class="btn btn-ghost ${_hist.comparing?'on':''}" onclick="Fat._toggleCompareMode()">${_hist.comparing?'取消对比':'⚖ 对比'}</button>
          <button class="btn btn-primary" onclick="Fat.openWeight()">＋ 记录体重</button>
        </div>
      </div>
    `;
    if(I&&I.upgrade)I.upgrade(body);
  }
  function histSummary(){
    const logs=histLogs().slice().sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    if(!logs.length)return '';
    const vals=logs.map(l=>+l.weight);
    const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    const min=Math.min(...vals),max=Math.max(...vals);
    let changeHtml='';
    if(logs.length>=2){const f=vals[0],l=vals[vals.length-1],ch=+(l-f).toFixed(1);changeHtml=`<div class="rep-row"><span>${_hist.cycle==='week'?'本周':_hist.cycle==='month'?'本月':'累计'}变化</span><b style="color:${ch<0?'#3b9e6b':(ch>0?'#e06a80':'inherit')}">${ch>0?'+':''}${ch} kg</b></div>`;}
    const daily={};logs.forEach(l=>{daily[l.date]=l.weight;});
    const days=Object.keys(daily).sort();
    const chart=days.length>=2?UI.lineChart(days.map(d=>+daily[d]),days.map(d=>S.fmtCN(d))):'';
    return `
      <div class="card mt10" style="box-shadow:none">
        <div class="card-h"><div class="l"><span class="ico">📊</span>${_hist.cycle==='week'?'周报趋势':_hist.cycle==='month'?'月报趋势':'全部趋势'}</div></div>
        <div class="rep-row"><span>记录次数</span><b>${logs.length} 次</b></div>
        <div class="rep-row"><span>平均体重</span><b>${kg2jin(avg)} 斤</b></div>
        <div class="rep-row"><span>最轻 / 最重</span><b>${kg2jin(min)} / ${kg2jin(max)} 斤</b></div>
        ${changeHtml}
        ${chart?`<div class="mt10">${chart}</div>`:''}
        <div class="small muted mt8">数据自动汇总，仅作回顾参考，不构成医学/营养建议 💗</div>
      </div>`;
  }
  function openWeightDetail(id){
    const l=(S.get().weightLogs||[]).find(x=>x.id===id);if(!l)return;
    UI.modal(`
      <div class="modal-title">体重记录详情</div>
      <div class="detail-box">
        <div class="detail-row"><span>日期</span><b>${S.fmtCN(l.date)}</b></div>
        <div class="detail-row"><span>称重场景</span><b>${l.scene}</b></div>
        <div class="detail-row"><span>体重</span><b>${kg2jin(l.weight)} 斤（${l.weight} kg）</b></div>
        <div class="detail-row"><span>体脂率</span><b>${l.fat!=null?l.fat+'%':'未记录'}</b></div>
        <div class="detail-row"><span>记录时间</span><b>${l.time}</b></div>
      </div>
      <button class="btn btn-ghost btn-block mt12" onclick="Fat.editWeightLog('${l.id}')">✎ 编辑</button>
      <button class="btn btn-ghost btn-block mt8" style="color:#e06a80" onclick="Fat.delWeightLog('${l.id}')">🗑 删除</button>
      <button class="btn btn-primary btn-block mt12" onclick="UI.close()">关闭</button>
    `);
  }
  function editWeightLog(id){UI.close();openWeight(null,id);}
  function delWeightLog(id){
    S.get().weightLogs=S.get().weightLogs.filter(x=>x.id!==id);S.save();
    if(_hist&&_hist.comparing)_hist.picks=_hist.picks.filter(p=>p!==id);
    const fb=document.getElementById('fat-body');
    if(fb&&fb.querySelector('.wh-page'))renderWeightHistory(fb);else if(fb)renderWeight(fb);
    UI.toast('已删除该记录');
  }
  function _toggleCompareMode(){_hist.comparing=!_hist.comparing;_hist.picks=[];renderWeightHistory(document.getElementById('fat-body'));}
  function _toggleCompare(id){
    const i=_hist.picks.indexOf(id);
    if(i>=0)_hist.picks.splice(i,1);
    else{ if(_hist.picks.length>=2)_hist.picks.shift(); _hist.picks.push(id); }
    renderWeightHistory(document.getElementById('fat-body'));
    if(_hist.picks.length===2)doCompare();
  }
  function doCompare(){
    const logs=S.get().weightLogs||[];
    const a=logs.find(x=>x.id===_hist.picks[0]),b=logs.find(x=>x.id===_hist.picks[1]);
    if(!a||!b)return;
    const ord=a.date+a.time<=b.date+b.time?[a,b]:[b,a];
    const o=ord[0],n=ord[1];
    const diff=+(n.weight-o.weight).toFixed(1);
    const daysBetween=Math.max(0,Math.round((S.parse(n.date)-S.parse(o.date))/86400000));
    UI.modal(`
      <div class="modal-title">⚖ 体重对比</div>
      <div class="cmp-box">
        <div class="cmp-row"><span>${S.fmtCN(o.date)}<br><small>${o.scene}</small></span><b>${kg2jin(o.weight)} 斤</b><span>${o.fat!=null?o.fat+'%':''}</span></div>
        <div class="cmp-arrow">${diff>0?'▲':diff<0?'▼':'＝'} ${diff>0?'+':''}${diff} kg</div>
        <div class="cmp-row"><span>${S.fmtCN(n.date)}<br><small>${n.scene}</small></span><b>${kg2jin(n.weight)} 斤</b><span>${n.fat!=null?n.fat+'%':''}</span></div>
        <div class="small muted" style="text-align:center;margin-top:8px">间隔 ${daysBetween} 天</div>
      </div>
      <button class="btn btn-primary btn-block mt12" onclick="UI.close()">收下 💗</button>
    `);
  }
  function setGoalWeight(){
    const g=goalSettings();
    UI.modal(`
      <div class="modal-title">🎯 设置减脂目标</div>
      <div class="small muted" style="margin-bottom:10px">初始体重默认取最早一条记录，你也可以手动指定。</div>
      <div class="field"><label>初始体重（斤，选填）</label><input id="gs" type="number" step="0.1" value="${g.start!=null?kg2jin(g.start):''}" placeholder="留空=自动取最早记录"></div>
      <div class="field mt8"><label>目标体重（斤）</label><input id="gg" type="number" step="0.1" value="${g.goal!=null?kg2jin(g.goal):''}" placeholder="如 100"></div>
      <button class="btn btn-primary btn-block mt12" onclick="Fat.saveGoalWeight()">保存目标</button>
    `);
  }
  function saveGoalWeight(){
    const s=S.get().settings;
    const gs=document.getElementById('gs').value, gg=document.getElementById('gg').value;
    s.startWeight=gs?+(+gs/2).toFixed(1):null;
    s.goalWeight=gg?+(+gg/2).toFixed(1):null;
    S.save();UI.close();
    const fb=document.getElementById('fat-body');if(fb)renderWeight(fb);
    UI.toast('目标已更新 🎯');
  }
  function editMeta(){
    const prof=S.get().settings.metaProfile||{};
    const gender=prof.gender||'female', age=prof.age||'', ht=prof.height||'', wt=prof.weight||(latestLog()?latestLog().weight:''), act=prof.activity||1.2;
    const actLabels=[{v:1.2,t:'久坐'},{v:1.375,t:'轻度'},{v:1.55,t:'中度'},{v:1.725,t:'重度'},{v:1.9,t:'极重'}];
    UI.modal(`
      <div class="modal-title">⚙ 身体参数</div>
      <div class="small muted" style="margin-bottom:10px">填写后自动计算 BMI 与基础代谢 💗</div>
      <div class="grid5" style="grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px">
        <div class="field" style="margin-bottom:0"><label>性别</label>
          <select id="mg" style="width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--bg);font-size:12.5px">
            <option value="male" ${gender==='male'?'selected':''}>男</option>
            <option value="female" ${gender==='female'?'selected':''}>女</option>
          </select></div>
        <div class="field" style="margin-bottom:0"><label>年龄</label><input id="ma" type="number" value="${age}" placeholder="28" style="width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:9px;font-size:12.5px;box-sizing:border-box"></div>
        <div class="field" style="margin-bottom:0"><label>身高(cm)</label><input id="mh" type="number" value="${ht}" placeholder="165" style="width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:9px;font-size:12.5px;box-sizing:border-box"></div>
        <div class="field" style="margin-bottom:0"><label>体重(kg)</label><input id="mw" type="number" step="0.1" value="${wt}" placeholder="65" style="width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:9px;font-size:12.5px;box-sizing:border-box"></div>
        <div class="field" style="margin-bottom:0"><label>活动量</label>
          <select id="mact" style="width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--bg);font-size:11.5px">
            ${actLabels.map(a=>`<option value="${a.v}" ${Math.abs(act-a.v)<0.01?'selected':''}>${a.t}</option>`).join('')}
          </select></div>
      </div>
      <button class="btn btn-primary btn-block" onclick="Fat.calcMetabolism()">计算并保存</button>
      <div id="meta-result"></div>
    `);
  }
  function tip(txt){UI.modal('<div class="modal-title">说明</div><div class="review-box">'+esc(txt)+'</div><button class="btn btn-primary btn-block mt12" onclick="UI.close()">知道了</button>');}
  function weightReport(kind){
    const d=S.today();
    const list=kind==='week'?rangeWeek(d):rangeMonth(d);
    const vals=list.map(dt=>{const w=S.S.weightToday(dt);return w&&w.morning?w.morning:null;}).filter(v=>v!=null);
    let content='🌸 '+(kind==='week'?'周循环':'月循环')+'体重报告（'+S.fmtCN(list[0])+'~'+S.fmtCN(list[list.length-1])+'）\n\n';
    if(vals.length){
      content+='记录 '+vals.length+' 天，平均 '+(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1)+' kg\n';
      content+='最高 '+(Math.max(...vals)).toFixed(1)+' · 最低 '+(Math.min(...vals)).toFixed(1)+'\n';
      content+='体重起伏很正常，别被数字绑架，健康快乐最重要 💗';
    }else content+='这阵子还没称体重，顺其自然就好～';
    S.get().reviews.push({id:S.uid(),type:'weight',date:d,content,modules:['体重']});S.save();
    UI.modal('<div class="modal-title">📊 '+(kind==='week'?'周报':'月报')+'</div><div class="review-box">'+content.replace(/\n/g,'<br>')+'</div><button class="btn btn-primary btn-block mt12" onclick="UI.close()">收下 💗</button>');
  }
  function rangeWeek(d){const ws=S.weekStart(d);const a=[];for(let i=0;i<7;i++)a.push(S.addDays(ws,i));return a;}
  function rangeMonth(d){const y=+d.slice(0,4),m=+d.slice(5,7);const n=new Date(y,m,0).getDate();const a=[];for(let i=1;i<=n;i++)a.push(d.slice(0,7)+'-'+S.pad(i));return a;}

  /* ---------- 减脂报告（周报 / 月报 / 年报 / 全部） ---------- */
  function report(){
    UI.modal(`<div class="modal-title">📈 减脂报告</div>
      <div class="subtabs" style="margin-bottom:12px">
        <button class="subtab on" id="frp-w" onclick="Fat.reportTab('week')">周报</button>
        <button class="subtab" id="frp-m" onclick="Fat.reportTab('month')">月报</button>
        <button class="subtab" id="frp-y" onclick="Fat.reportTab('year')">年报</button>
        <button class="subtab" id="frp-a" onclick="Fat.reportTab('all')">全部</button>
      </div>
      <div id="frp-body">${reportHTML('week')}</div>
      <button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>`);
  }
  function reportTab(t){
    ['w','m','y','a'].forEach((k,i)=>{
      const types=['week','month','year','all'];
      const el=document.getElementById('frp-'+k);if(el)el.classList.toggle('on',t===types[i]);
    });
    const body=document.getElementById('frp-body');if(body)body.innerHTML=reportHTML(t);
  }
  function reportHTML(type){
    const today=S.today();
    let from='',label='',days=[];
    if(type==='week'){from=S.weekStart(today);label='本周（'+S.fmtCN(from)+' ~ '+S.fmtCN(today)+'）';}
    else if(type==='month'){from=today.slice(0,8)+'01';label=S.fmtCN(today).slice(0,7)+' 月';}
    else if(type==='year'){from=today.slice(0,4)+'-01-01';label=today.slice(0,4)+' 年';}
    else{label='全部记录';}
    if(from)for(let d=from;d<=today;d=S.addDays(d,1))days.push(d);
    const inRange=arr=>arr.filter(x=>x.date>=from&&x.date<=today);
    const poops=S.get().poops||[], ex=S.get().exercises||[];
    const dPoop=inRange(poops), dEx=inRange(ex);
    const poopAvg=dPoop.length?Math.round(dPoop.reduce((s,x)=>s+(+x.score||0),0)/dPoop.length):null;
    const poopAbn=dPoop.filter(x=>x.blood==='是'||x.color==='黑色'||x.color==='红色'||x.feel==='腹泻').length;
    const weights=S.S.weightDaily(from,today);
    const wIn=weights.filter(w=>w.date>=from&&w.date<=today);
    let wChange='—';
    if(wIn.length>=2){const f=wIn[0],l=wIn[wIn.length-1];const fw=+f.morning||0,lw=+l.morning||0;if(fw&&lw)wChange=(lw-fw>=0?'+':'')+(lw-fw).toFixed(1)+' kg';}
    const exMin=dEx.reduce((s,x)=>s+(+x.dur||0),0);
    const exTimes=dEx.length;
    const goalWeight=S.get().settings.goalWeight;
    return `
      <div class="small muted" style="margin-bottom:8px">${label}${days.length?' · 共 '+days.length+' 天':''}</div>
      <div class="rep-grid">
        <div class="rep-card"><div class="rep-num">${exTimes}</div><div class="rep-lbl">运动次数</div></div>
        <div class="rep-card"><div class="rep-num">${exMin}</div><div class="rep-lbl">运动时长(分)</div></div>
        <div class="rep-card"><div class="rep-num">${wIn.length}</div><div class="rep-lbl">称重天数</div></div>
        <div class="rep-card"><div class="rep-num">${goalWeight?goalWeight+'kg':'—'}</div><div class="rep-lbl">目标体重</div></div>
      </div>
      <div class="card mt12">
        <div class="card-h"><div class="l"><span class="ico">💪</span>运动 & 体重</div></div>
        <div class="rep-row"><span>运动次数</span><b>${exTimes} 次</b></div>
        <div class="rep-row"><span>运动时长</span><b>${exMin} 分钟</b></div>
        <div class="rep-row"><span>体重变化</span><b>${wChange}</b></div>
        <div class="rep-row"><span>目标体重</span><b>${goalWeight?goalWeight+' kg':'—'}</b></div>
      </div>
      <div class="card mt12">
        <div class="card-h"><div class="l"><span class="ico">💩</span>排便 & 身体</div></div>
        <div class="rep-row"><span>排便记录</span><b>${dPoop.length} 次</b></div>
        <div class="rep-row"><span>平均评分</span><b>${poopAvg===null?'—':poopAvg+' 分'}</b></div>
        <div class="rep-row"><span>异常次数</span><b style="color:${poopAbn?'#e06a80':'inherit'}">${poopAbn}</b></div>
      </div>
      <div class="small muted mt12">报告基于本地记录生成，仅作回顾参考，不构成任何医学/营养建议 💗</div>
    `;
  }

  window.Fat={render,set,renderDietInto,redrawDiet,refreshRecipes,refreshNetCombos,comboToTodo,comboDetail,hideMeal,toggleEx,delEx,setGoal,saveGoal,addMeal,saveMeal,editMeal,saveMealEdit,onMealImgPick,delMeal,recToTodo,upImg,onFood,saveMealImg,viewImg,mealApplyHistory,
    editAvoid,saveAvoid,addAvoidChip,dietBrief,toggleHide,calcMetabolism,saveMetaGoal,
    openWeight,saveWeightLog,_pickScene,_setWDate,openWeightHistory,renderWeightHistory,openWeightDetail,editWeightLog,delWeightLog,setGoalWeight,saveGoalWeight,editMeta,tip,_toggleCompareMode,_toggleCompare,histCycle,histNav,goHistToday,_pickHistDate,
    openExDialog,saveEx,removeEx,shiftEx,goExToday,openExDatePick,pickExDate,
    newPlan,openPlan,editPlan,savePlan,delPlan,togglePlanDone,goTrain,logFromPlan,syncFromTodo,
    openRecipe,newRecipe,editRecipe,saveRecipe,delRecipe,eatRecipe,ensurePlanTodos,
    openDimensions,renderDimensions,openMetric,saveMetric,_setMDate,report,reportTab};

  /* 启动时补齐「运动计划 → 待办」的绑定，保证不进运动页也能在待办里看到 */
  try{
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{try{ensurePlanTodos();}catch(e){}});
    else ensurePlanTodos();
  }catch(e){}
})();
