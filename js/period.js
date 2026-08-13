/* ============ 经期记录（减脂 → 经期） ============
   四期日历（月经/卵泡/排卵/黄体）+ 点击图例切换高亮 + 一键记录来/结束 + 周期预测 + 症状与流量 + 历史 */
(function(){
  const S=window.Store, I=window.Icon;
  let view=S.today();
  let editId=null, form=null;
  let rootId='fat-body';
  /* 图例高亮状态：null=只显示经期+预测，否则='follicle'|'ovulation'|'luteal' */
  let highlight=null;

  const FLOWS=['很少','少','适中','多','很多'];
  const SYMPTOMS=['腹痛','腰酸','头痛','乳房胀痛','情绪低落','疲惫','长痘','食欲大增','嗜睡','水肿'];

  /* 四期常量 + 每期的身心提示 */
  const PHASES={
    menstrual:{key:'menstrual',label:'经期',color:'#e06a80',bg:'var(--pink)',
      tip:'🌸 身体正在排毒，容易疲劳、腹痛或腰酸。多喝热水、注意保暖、早点休息，别太勉强自己运动哦～'},
    follicle:{key:'follicle',label:'卵泡期',color:'#8babf6',bg:'#dfe7fd',
      tip:'🌱 精力慢慢回升，状态越来越好！适合开始新计划、运动、学习新东西，抓住这段黄金时间 ✨'},
    ovulation:{key:'ovulation',label:'排卵期',color:'#4a9eff',bg:'#d6ecff',
      tip:'💫 皮肤状态最佳、自信满满、魅力高峰！适合社交、拍照、做重要决定，你今天超美的 💕'},
    luteal:{key:'luteal',label:'黄体期',color:'#f5b86a',bg:'#fef0dc',
      tip:'🍂 容易烦躁、水肿、乳房胀痛或食欲大增，都是激素在捣乱。少吃盐、早睡、对自己温柔一点，别和情绪较劲 🧘'}
  };

  function list(){return (S.get().periods||[]).slice().sort((a,b)=>(a.start||'').localeCompare(b.start||''));}
  function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  /* 经期区间：有 end 用 end，没 end 按开始 +5 天粗估（仅用于日历着色） */
  function span(p){
    const st=p.start; if(!st)return null;
    const en=p.end||S.addDays(st,4);
    return {st,en:en<st?st:en};
  }
  function onDay(d){
    return list().find(p=>{const s=span(p);return s&&d>=s.st&&d<=s.en;});
  }
  /* 平均周期 & 平均经期长度 & 下次预测 */
  function stats(){
    const ls=list();
    const gaps=[];
    for(let i=1;i<ls.length;i++){
      const a=S.parse(ls[i-1].start), b=S.parse(ls[i].start);
      const g=Math.round((b-a)/86400000);
      if(g>=15&&g<=60)gaps.push(g);
    }
    const cycle=gaps.length?Math.round(gaps.reduce((a,b)=>a+b,0)/gaps.length):28;
    const lens=ls.filter(p=>p.end).map(p=>Math.round((S.parse(p.end)-S.parse(p.start))/86400000)+1).filter(x=>x>0&&x<=15);
    const len=lens.length?Math.round(lens.reduce((a,b)=>a+b,0)/lens.length):5;
    const last=ls[ls.length-1]||null;
    const next=last?S.addDays(last.start,cycle):'';
    let days=null;
    if(next){days=Math.round((S.parse(next)-S.parse(S.today()))/86400000);}
    return {cycle,len,last,next,days,count:ls.length};
  }

  /* 计算整张日历的四期分布：以"周期起点(经期首日)"为锚，向未来推演多个月份
     规则：
       - 实际记录的月经期优先级最高（实心粉 pd-on）
       - 预测只显示"下一次及之后"的未来周期（st.next 起），已过去的预测不显示
       - 周期内(以周期起点 P 为第 1 天)：
         月经期  [P, P+L-1]            → menstrual (actual=false → 虚线 pd-pred)
         卵泡期  [P+L, P+11]           → follicle
         排卵期  [P+12, P+16]          → ovulation (排卵日 P+14 ✦)
         黄体期  [P+17, P+C-1]         → luteal */
  function phaseMap(){
    const st=stats();
    const m={}; // ds -> {phase, actual, ov}
    /* 1. 实际记录（月经期，实填，最高优先级） */
    list().forEach(p=>{const s=span(p);if(!s)return;for(let d=s.st;d<=s.en;d=S.addDays(d,1))m[d]={phase:'menstrual',actual:true};});
    if(!st.last||!st.next)return m; // 没有记录或无法预测则不填相位
    const C=st.cycle, L=st.len;
    /* 2. 只从 st.next(下次预测经期首日)向未来推演 N 个周期
         已过去的日期不填预测（避免实际11号来了却还显示9号的旧预测） */
    const futureAnchors=[st.next];
    let f=st.next; for(let i=0;i<36;i++){f=S.addDays(f,C);futureAnchors.push(f);}
    futureAnchors.forEach(P=>{
      const mEnd=S.addDays(P,L-1);
      for(let d=P;d<=mEnd;d=S.addDays(d,1))if(!m[d])m[d]={phase:'menstrual',actual:false};
      const ovDay=S.addDays(P,14), ovS=S.addDays(P,12), ovE=S.addDays(P,16);
      for(let d=ovS;d<=ovE;d=S.addDays(d,1))if(!m[d])m[d]={phase:'ovulation'};
      if(!m[ovDay]||!m[ovDay].actual)m[ovDay]={phase:'ovulation',ov:true};
      for(let d=S.addDays(P,L);d<S.addDays(P,12);d=S.addDays(d,1))if(!m[d])m[d]={phase:'follicle'};
      for(let d=S.addDays(P,17);d<S.addDays(P,C);d=S.addDays(d,1))if(!m[d])m[d]={phase:'luteal'};
    });
    return m;
  }

  /* 查询某天所属周期阶段（用于提示卡） */
  function currentPhase(d){
    const m=phaseMap();
    const cell=m[d];
    return cell?cell.phase:null;
  }

  function monthGrid(){
    const ym=view.slice(0,7);
    /* 周日为最后一天：offset = (weekday-1+7)%7 */
    const rawW=S.weekday(ym+'-01');
    const startW=(rawW===0?6:rawW-1);
    const dim=new Date(+view.slice(0,4),+view.slice(5,7),0).getDate();
    const ph=phaseMap();
    let cells='';
    const wk=['一','二','三','四','五','六','日'];
    let head='';wk.forEach(w=>head+='<div class="cal-h">'+w+'</div>');
    for(let i=0;i<startW;i++)cells+='<div class="cal-cell empty"></div>';
    for(let i=1;i<=dim;i++){
      const ds=ym+'-'+S.pad(i);
      const cell=ph[ds];
      const phase=cell?cell.phase:null;
      const actual=cell?cell.actual:false;
      const isOv=cell&&cell.ov;
      let cls='cal-cell';
      if(ds===view)cls+=' sel';
      /* 月经期(实际+预测)默认都显示；点击图例后才叠加显示其他三期 */
      const showPhase=(phase==='menstrual')||(highlight&&phase===highlight);
      if(phase==='menstrual'){
        if(actual)cls+=' pd-on';
        else if(showPhase)cls+=' pd-pred';
      }else if(showPhase){
        if(phase==='ovulation')cls+=isOv?' pd-ov-day':' pd-ov';
        else if(phase==='follicle')cls+=' pd-fol';
        else if(phase==='luteal')cls+=' pd-lut';
      }
      const ovMark=isOv&&showPhase?'<i class="pd-ov-star">✦</i>':'';
      cells+='<div class="'+cls+'" onclick="Period.pick(\''+ds+'\')"><b>'+i+'</b>'+ovMark+'</div>';
    }
    return '<div class="cal-wk">'+head+'</div><div class="cal-grid">'+cells+'</div>';
  }
  function pick(d){view=d;redraw();}
  /* 四期提示卡：根据 view 日期所处阶段显示对应 tip */
  function phaseTipCard(){
    const p=currentPhase(view);
    if(!p||!PHASES[p])return '';
    const info=PHASES[p];
    return `<div class="phase-tip-card" style="background:${info.bg}22;border-left:3px solid ${info.color};border-radius:10px;padding:10px 12px;margin-top:8px;font-size:13px;line-height:1.65;color:var(--text2)">
      <b style="color:${info.color}">${info.label} · 小贴士</b><br>${info.tip}
    </div>`;
  }
  function shiftMonth(n){
    const y=+view.slice(0,4), m=+view.slice(5,7), day=+view.slice(8,10);
    const dim=new Date(y,m-1+n+1,0).getDate();
    const nd=new Date(y,m-1+n,Math.min(day,dim));
    view=nd.getFullYear()+'-'+S.pad(nd.getMonth()+1)+'-'+S.pad(nd.getDate());
    redraw();
  }
  function goToday(){view=S.today();redraw();}

  function render(body){
    if(body)rootId=body.id||'fat-body';
    const el=document.getElementById(rootId);if(!el)return;
    const st=stats();
    const ls=list().slice().reverse();
    const cur=onDay(S.today());
    const running=list().find(p=>p.start&&!p.end);
    const rm=S.get().settings.periodRemind||{on:true,days:1,last:''};

    let tipTxt;
    if(cur)tipTxt='正在经期第 '+(Math.round((S.parse(S.today())-S.parse(cur.start))/86400000)+1)+' 天，多喝热水、注意保暖 🌸';
    else if(st.days===null)tipTxt='记录第一次经期后，就能自动预测下次啦～';
    else if(st.days>0)tipTxt='距离下次预计还有 '+st.days+' 天（'+S.fmtCN(st.next)+'）';
    else if(st.days===0)tipTxt='预计今天可能会来，随身备好用品哦';
    else tipTxt='比预测晚了 '+Math.abs(st.days)+' 天，别紧张，压力和作息都会影响周期';

    el.innerHTML=`
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🌸</span>经期日历</div>
          <span class="pill${view===S.today()?'':' go-today-pill'}" onclick="${view===S.today()?'':'Period.goToday();return false;'}">${view===S.today()?'今天':'回到今天'}</span></div>
        <div class="mp-head">
          <button onclick="Period.shiftMonth(-1)">‹</button>
          <div class="mp-t">${view.slice(0,4)}年 ${+view.slice(5,7)}月</div>
          <button onclick="Period.shiftMonth(1)">›</button>
        </div>
        ${monthGrid()}
        <div class="pd-legend" id="pd-legend">
          <span class="${highlight==null?'active':''}" onclick="Period.togglePhase(null)"><i class="pd-dot on"></i>经期</span>
          <span class="${highlight==null?'active':''}" onclick="Period.togglePhase(null)"><i class="pd-dot pred"></i>预测</span>
          <span class="${highlight==='follicle'?'active':''}" onclick="Period.togglePhase('follicle')"><i class="pd-dot fol"></i>卵泡期</span>
          <span class="${highlight==='ovulation'?'active':''}" onclick="Period.togglePhase('ovulation')"><i class="pd-dot ov"></i>排卵期</span>
          <span class="${highlight==='luteal'?'active':''}" onclick="Period.togglePhase('luteal')"><i class="pd-dot lut"></i>黄体期</span>
        </div>
        ${phaseTipCard()}
        <div class="review-box mt12">${tipTxt}</div>
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">📊</span>周期概览</div></div>
        <div class="grid3">
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px">${st.cycle}</div><div class="lbl">平均周期(天)</div></div>
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px">${st.len}</div><div class="lbl">平均天数</div></div>
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px">${st.count}</div><div class="lbl">已记录次数</div></div>
        </div>
        <div class="flex gap8 mt12">
          ${running
            ? `<button class="btn btn-primary btn-block" onclick="Period.endToday()">🌸 今天结束了</button>`
            : `<button class="btn btn-primary btn-block" onclick="Period.startToday()">🌸 今天来了</button>`}
          <button class="btn btn-ghost btn-block" onclick="Period.add()">＋ 手动添加</button>
        </div>
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🔔</span>经期提醒</div></div>
        <div class="flex between center" style="padding:4px 0">
          <div>
            <div style="font-weight:700;font-size:14px">提前提醒</div>
            <div class="small muted">预计来之前的 ${rm.days} 天，弹出提醒（需授权通知）</div>
          </div>
          <div class="switch ${rm.on?'on':''}" onclick="Period.setRemind(!${rm.on})"></div>
        </div>
        ${rm.on?`<div class="flex gap8 mt8" id="rm-days">
          ${[1,2,3].map(n=>`<button class="btn btn-ghost ${rm.days===n?'btn-primary':''}" style="flex:1;padding:7px 0;font-size:13px" onclick="Period.setRemindDays(${n})">提前${n}天</button>`).join('')}
        </div>
        <div class="small muted mt8">提醒在打开 App 时检查；开启系统通知后，手机锁屏也能收到弹窗。</div>`:''}
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">${I.i('note')}</span>历史记录</div>
          <span class="pill">${ls.length} 次</span></div>
        <div class="small muted" style="margin-bottom:8px">长按任意一条可编辑或删除</div>
        ${ls.length?ls.map(card).join(''):'<div class="empty">'+I.EMPTY.replace('width="120"','width="70"')+'<p>还没有经期记录～</p></div>'}
      </div>
    `;
    if(I&&I.upgrade)I.upgrade(el);
    el.querySelectorAll('.pd-card').forEach(c=>bindLongPress(c,()=>actions(c.dataset.pid)));
  }
  function redraw(){render(null);}

  function card(p){
    const days=p.end?Math.round((S.parse(p.end)-S.parse(p.start))/86400000)+1:null;
    return `<div class="pd-card" data-pid="${p.id}">
      <div class="pc-head">
        <div class="pc-title">
          <b>${S.fmtCN(p.start)} ${p.end?'~ '+S.fmtCN(p.end):'· 进行中'}</b>
          <div class="small muted">${days?days+' 天':'尚未结束'} · 流量 ${p.flow||'适中'}</div>
        </div>
        <span class="pc-score" style="color:var(--pink);border-color:var(--pink)">${days||'—'}</span>
      </div>
      ${(p.symptoms||[]).length?`<div class="pc-tags">${p.symptoms.map(s=>'<span class="pc-tag">'+esc(s)+'</span>').join('')}</div>`:''}
      ${p.note?`<div class="small muted mt8">📝 ${esc(p.note)}</div>`:''}
    </div>`;
  }

  function bindLongPress(el,cb){
    let timer=null;
    const start=()=>{clear();timer=setTimeout(()=>{timer=null;try{navigator.vibrate&&navigator.vibrate(12);}catch(e){}cb();},520);};
    const clear=()=>{if(timer){clearTimeout(timer);timer=null;}};
    el.addEventListener('touchstart',start,{passive:true});
    el.addEventListener('touchmove',clear,{passive:true});
    el.addEventListener('touchend',clear);
    el.addEventListener('touchcancel',clear);
    el.addEventListener('mousedown',start);
    el.addEventListener('mouseup',clear);
    el.addEventListener('mouseleave',clear);
    el.addEventListener('contextmenu',e=>{e.preventDefault();clear();cb();});
  }
  function actions(id){
    const p=(S.get().periods||[]).find(x=>x.id===id);if(!p)return;
    UI.modal(`<div class="modal-title">${S.fmtCN(p.start)} 的经期记录</div>
      <button class="btn btn-primary btn-block" onclick="Period.edit('${id}')">✏️ 编辑</button>
      <button class="btn btn-ghost btn-block mt8" style="color:#e06a80" onclick="Period.del('${id}')">🗑 删除</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">取消</button>`);
  }
  function del(id){
    S.get().periods=(S.get().periods||[]).filter(x=>x.id!==id);
    S.save();UI.close();redraw();UI.toast('已删除');
  }

  function startToday(){
    const d=S.get();if(!Array.isArray(d.periods))d.periods=[];
    if(onDay(S.today())){UI.toast('今天已经在经期里啦');return;}
    d.periods.push({id:S.uid(),start:S.today(),end:'',flow:'适中',symptoms:[],note:''});
    S.save();redraw();UI.toast('已记录 · 好好照顾自己 🌸');
  }
  function endToday(){
    const run=list().find(p=>p.start&&!p.end);
    if(!run){UI.toast('没有进行中的经期');return;}
    run.end=S.today();S.save();redraw();UI.toast('已记录结束 · 辛苦啦 💗');
  }

  function add(){editId=null;form={start:view,end:'',flow:'适中',symptoms:[],note:''};openForm();}
  function edit(id){
    const p=(S.get().periods||[]).find(x=>x.id===id);if(!p)return;
    editId=id;form=Object.assign({},p,{symptoms:(p.symptoms||[]).slice()});openForm();
  }
  function openForm(){
    UI.modal(`
      <div class="modal-title">🌸 ${editId?'编辑':'添加'}经期记录</div>
      <div class="grid2">
        <div class="field"><label>开始日期</label><input id="qf-start" type="date" value="${form.start||''}"></div>
        <div class="field"><label>结束日期（可空）</label><input id="qf-end" type="date" value="${form.end||''}"></div>
      </div>
      <div class="field"><label>流量</label></div>
      <div class="seg wrap" id="qf-flow">${FLOWS.map(f=>'<span class="opt'+(form.flow===f?' on':'')+'" data-v="'+f+'">'+f+'</span>').join('')}</div>
      <div class="field mt8"><label>症状（可多选）</label></div>
      <div class="seg wrap" id="qf-sym">${SYMPTOMS.map(s=>'<span class="opt'+((form.symptoms||[]).includes(s)?' on':'')+'" data-v="'+s+'">'+s+'</span>').join('')}</div>
      <div class="field mt12"><label>备注</label><textarea id="qf-note" rows="2" placeholder="这次痛得厉害 / 喝了红糖水…">${esc(form.note||'')}</textarea></div>
      <div class="flex gap8 mt12">
        <button class="btn btn-primary btn-block" onclick="Period.save()">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>
    `);
    document.querySelectorAll('#qf-flow .opt').forEach(o=>o.onclick=()=>{
      document.querySelectorAll('#qf-flow .opt').forEach(x=>x.classList.remove('on'));
      o.classList.add('on');form.flow=o.dataset.v;
    });
    document.querySelectorAll('#qf-sym .opt').forEach(o=>o.onclick=()=>{
      o.classList.toggle('on');
      const v=o.dataset.v;
      form.symptoms=form.symptoms||[];
      if(o.classList.contains('on')){if(!form.symptoms.includes(v))form.symptoms.push(v);}
      else form.symptoms=form.symptoms.filter(x=>x!==v);
    });
  }
  function save(){
    const st=document.getElementById('qf-start').value;
    if(!st){UI.toast('请选择开始日期');return;}
    const en=document.getElementById('qf-end').value||'';
    if(en&&en<st){UI.toast('结束日期不能早于开始日期');return;}
    const note=(document.getElementById('qf-note').value||'').trim();
    const d=S.get();if(!Array.isArray(d.periods))d.periods=[];
    const payload={start:st,end:en,flow:form.flow||'适中',symptoms:form.symptoms||[],note};
    if(editId){const p=d.periods.find(x=>x.id===editId);if(p)Object.assign(p,payload);}
    else d.periods.push(Object.assign({id:S.uid()},payload));
    S.save();UI.close();view=st;redraw();UI.toast('已保存 🌸');
  }

  function togglePhase(key){
    highlight=(highlight===key)?null:key;
    redraw();
  }

  /* ---------- 经期提前提醒 ---------- */
  function getRemind(){return S.get().settings.periodRemind||{on:true,days:1,last:''};}
  function setRemind(on){
    const r=getRemind();r.on=!!on;S.save();
    if(on&&'Notification' in window&&Notification.permission==='default'){
      Notification.requestPermission().then(p=>{ if(p==='granted'){UI.toast('已开启系统通知 🔔');} });
    }
    redraw();
    if(on)checkReminder(true);
  }
  function setRemindDays(n){
    const r=getRemind();r.days=Math.max(1,Math.min(7,+n||1));S.save();redraw();
    checkReminder(true);
  }
  /* 检查是否到了提前提醒的时机；daily=true 表示手动触发（忽略 last 去重） */
  function checkReminder(daily){
    const r=getRemind();
    if(!r.on)return false;
    const st=stats();
    if(!st.next||st.days===null)return false;
    const d=st.days; // 距下次预计天数（可能为 0 或负）
    const hit=(d===r.days); // 正好提前 N 天
    const today=S.today();
    if(!hit)return false;
    if(!daily&&r.last===today)return false; // 当天已提醒过
    r.last=today;S.save();
    const msg='预计 '+S.fmtCN(st.next)+' 来经期，提前 '+r.days+' 天提醒你备好用品、注意保暖 🌸';
    // 1) 应用内弹窗
    if(window.UI&&UI.modal){
      UI.modal(`<div class="modal-title">🔔 经期提醒</div>
        <div class="modal-body" style="font-size:14px;line-height:1.7;color:var(--text2)">${msg}</div>
        <button class="btn btn-primary btn-block mt12" onclick="UI.close()">知道了</button>`);
    }else if(window.UI&&UI.toast){UI.toast('🔔 '+msg);}
    // 2) 系统通知（手机锁屏弹窗）
    if('Notification' in window&&Notification.permission==='granted'){
      try{new Notification('🌸 经期提醒',{body:msg});}catch(e){}
    }else if('Notification' in window&&Notification.permission==='default'){
      Notification.requestPermission();
    }
    return true;
  }

  window.Period={render,redraw,pick,shiftMonth,goToday,add,edit,del,save,startToday,endToday,stats,onDay,togglePhase,currentPhase,checkReminder,setRemind,setRemindDays};
})();
