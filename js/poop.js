/* ============ 排便健康（减脂 → 排便） ============
   日历（当天有记录则在日期下方显示便便形状）+ 记录表单 + 自动评分 + 历史卡片（长按编辑/删除） */
(function(){
  const S=window.Store, I=window.Icon;
  let view=S.today();     // 日历当前月/选中日
  let form=null;          // 表单临时状态
  let editId=null;

  /* ---------- 布里斯托大便分型（7 型可视化） ---------- */
  const BR='#c68f5e', BR2='#a87041', BR3='#8a5a33', LN='#7a5230';
  function wrap(inner){
    return '<svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="'+LN+
           '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+inner+'</svg>';
  }
  const SHAPES=[
    {t:1,name:'硬球',desc:'一颗颗分离硬块，像坚果',svg:wrap(
      '<circle cx="15" cy="22" r="6.4" fill="'+BR3+'"/><circle cx="30" cy="18" r="5.6" fill="'+BR2+'"/>'+
      '<circle cx="44" cy="23" r="6.2" fill="'+BR3+'"/>'+
      '<path d="M12 20.5h.01M18 24h.01M28 16h.01M41 21h.01M47 25h.01" stroke-width="2.4"/>')},
    {t:2,name:'块状',desc:'香肠状但表面凹凸结块',svg:wrap(
      '<path d="M8 20c0-5 5-7.5 9.5-6.5C21 9 29 8.8 33 12.5c5-1.5 10.5 1 11.5 6s-3 9.5-8 9c-3.5 3.8-11 4-15 .5-5 1-13.5-1.5-13.5-8z" fill="'+BR2+'"/>'+
      '<path d="M19 14.5v11M28 12.5v14M37 14v11" opacity=".5"/>')},
    {t:3,name:'裂纹',desc:'香肠状，表面有裂痕',svg:wrap(
      '<rect x="6.5" y="13" width="47" height="15" rx="7.5" fill="'+BR+'"/>'+
      '<path d="M16 14.5v4M23 25.5v3M31 13.8v5M39 24v4M46 15v4" opacity=".55"/>')},
    {t:4,name:'光滑',desc:'光滑柔软香肠状（最理想）',svg:wrap(
      '<path d="M7 21.5c0-5 4-8 9-8h28c5 0 9 3 9 8s-4 8-9 8H16c-5 0-9-3-9-8z" fill="'+BR+'"/>'+
      '<path d="M14 18.5c8-2 24-2 32 0" opacity=".45"/>')},
    {t:5,name:'软块',desc:'柔软小块，边缘清楚',svg:wrap(
      '<ellipse cx="18" cy="22" rx="10" ry="7.6" fill="'+BR+'"/>'+
      '<ellipse cx="38" cy="20" rx="9" ry="7" fill="'+BR2+'"/>'+
      '<ellipse cx="48" cy="26" rx="5.5" ry="4.4" fill="'+BR+'"/>')},
    {t:6,name:'糊状',desc:'蓬松糊状，边缘不规则',svg:wrap(
      '<path d="M7 25c-1-4 2-6.5 5-6 0-4.5 5-6.5 8.5-4 2.5-3.5 8.5-3.5 11 0 4-2.5 9.5-.5 10 4 4 .5 5.5 4.5 3 7-3 3-34 3.5-37.5 1.5C4.5 26 5.5 25.6 7 25z" fill="'+BR2+'"/>'+
      '<path d="M16 24h4M27 22h6M39 25h4" opacity=".45"/>')},
    {t:7,name:'水状',desc:'完全液体，没有固形物',svg:wrap(
      '<ellipse cx="30" cy="25.5" rx="23" ry="7" fill="'+BR+'" opacity=".85"/>'+
      '<ellipse cx="30" cy="24" rx="14" ry="3.6" fill="'+BR2+'" opacity=".8" stroke="none"/>'+
      '<path d="M11 16.5c1.5 1.5 1.5 3 0 4M49 15c1.6 1.6 1.6 3.2 0 4.4M30 13c1.4 1.4 1.4 2.8 0 4" opacity=".6"/>')}
  ];
  function shapeSvg(t){const s=SHAPES.find(x=>x.t===+t);return s?s.svg:SHAPES[3].svg;}
  function shapeName(t){const s=SHAPES.find(x=>x.t===+t);return s?('第'+s.t+'型 '+s.name):'未知';}

  /* ---------- 选项表 ---------- */
  const COLORS=[
    ['黄褐色','#c9a063'],['深褐色','#7d5231'],['黑色','#3a3230'],
    ['绿色','#6f9e5c'],['红色','#c9556b'],['灰白色','#cfc9c2']
  ];
  const AMOUNTS=['非常少','少','适中','多','较多'];
  const SMELLS=['不臭','臭','很臭','非常臭'];
  const FEELS=['顺畅','费力','便秘','腹泻','排不尽'];
  const DURS=['<5min','5-10min','>10min'];
  const BODYS=['顺畅','适中','困难','残余绞痛','下坠感'];
  const PLACES=['家里','公司','外出'];

  /* ---------- 自动评分 + 文字分析 ---------- */
  function evaluate(r){
    let s=100; const warn=[], tip=[];
    const shapeCut={1:-22,2:-12,3:-2,4:0,5:-8,6:-16,7:-24};
    s+=shapeCut[+r.shape]||0;
    if(+r.shape<=2)tip.push('便便偏干硬，多喝温水、多吃蔬果和粗粮会舒服很多');
    if(+r.shape>=6)tip.push('便便偏稀，饮食清淡一点、少吃生冷，注意保暖');

    const colorCut={'黄褐色':0,'深褐色':-2,'绿色':-10,'黑色':-28,'红色':-28,'灰白色':-26};
    s+=colorCut[r.color]!==undefined?colorCut[r.color]:0;
    if(r.color==='绿色')tip.push('颜色偏绿多与深绿蔬菜或肠道蠕动快有关，观察一两天');
    if(r.color==='黑色')warn.push('颜色发黑需要留意（排除动物血/铁剂/药物影响），持续出现建议就医');
    if(r.color==='红色')warn.push('颜色发红要重视，排除火龙果/甜菜等食物因素后仍出现，建议尽快就医');
    if(r.color==='灰白色')warn.push('灰白色可能与胆汁分泌相关，建议尽快就医检查');

    s+={'非常少':-6,'少':-3,'适中':0,'多':-3,'较多':-6}[r.amount]||0;
    s+={'不臭':0,'臭':-2,'很臭':-6,'非常臭':-10}[r.smell]||0;
    if(r.smell==='非常臭')tip.push('气味重多与高蛋白高油饮食有关，试试多蔬菜少油炸');

    s+={'顺畅':0,'费力':-8,'便秘':-16,'腹泻':-16,'排不尽':-9}[r.feel]||0;
    if(r.feel==='便秘')tip.push('轻微便秘，多喝水、加点膳食纤维，早起一杯温水很有用');
    if(r.feel==='腹泻')tip.push('腹泻要注意补水和电解质，饮食以清淡易消化为主');
    if(r.feel==='排不尽')tip.push('总觉得排不尽，别久蹲久坐，每天固定时间上厕所更规律');

    s+={'<5min':0,'5-10min':-4,'>10min':-10}[r.dur]||0;
    if(r.dur==='>10min')tip.push('蹲太久容易痔疮，建议控制在 5 分钟内，别带手机进厕所');

    if(r.blood){s-=26;warn.push('本次有出血，先观察是否为便秘擦伤；反复出血一定要就医');}

    s+={'顺畅':0,'适中':-2,'困难':-9,'残余绞痛':-11,'下坠感':-8}[r.body]||0;
    if(r.body==='残余绞痛')tip.push('排后仍绞痛，注意腹部保暖、避免辛辣，持续不适要就医');

    s=Math.max(0,Math.min(100,Math.round(s)));
    let level;
    if(s>=90)level='状态优秀';
    else if(s>=78)level='状态不错';
    else if(s>=60)level='基本正常';
    else if(s>=40)level='需要调理';
    else level='存在异常，建议持续观察';

    let text=level+'（'+s+' 分）。';
    if(warn.length)text+=warn.join('；')+'。';
    if(tip.length)text+=tip.slice(0,2).join('；')+'。';
    if(!warn.length&&!tip.length)text+='形状颜色都很健康，保持这样的饮食和作息就好 💗';
    return {score:s,level,analysis:text,warn:warn.length>0};
  }
  function scoreColor(s){return s>=78?'#5faa74':(s>=60?'#e2a13c':'#e06a80');}

  /* ---------- 日历 ---------- */
  function monthGrid(){
    const ym=view.slice(0,7);
    /* 周一为第一天 */
    const rawW=S.weekday(ym+'-01');
    const startW=(rawW===0?6:rawW-1);
    const days=new Date(+view.slice(0,4),+view.slice(5,7),0).getDate();
    const all=S.get().poops||[];
    let cells='';
    const wk=['一','二','三','四','五','六','日'];
    let head='';wk.forEach(w=>head+='<div class="cal-h">'+w+'</div>');
    for(let i=0;i<startW;i++)cells+='<div class="pcal-cell empty"></div>';
    for(let i=1;i<=days;i++){
      const ds=ym+'-'+S.pad(i);
      const recs=all.filter(p=>p.date===ds);
      const cls='pcal-cell'+(ds===view?' sel':'');
      // 当天有拉屎 → 日期数字下方显示便便形状（多条时取最后一条 + 角标数量）
      const mark=recs.length
        ? '<span class="pcal-ico">'+shapeSvg(recs[recs.length-1].shape)+
          (recs.length>1?'<i class="pcal-n">'+recs.length+'</i>':'')+'</span>'
        : '<span class="pcal-ico none"></span>';
      cells+='<div class="'+cls+'" onclick="Poop.pick(\''+ds+'\')"><b>'+i+'</b>'+mark+'</div>';
    }
    return '<div class="cal-wk">'+head+'</div><div class="pcal-grid">'+cells+'</div>';
  }
  function pick(d){view=d;redraw();}
  function shiftMonth(n){
    const y=+view.slice(0,4), m=+view.slice(5,7), day=+view.slice(8,10);
    const dim=new Date(y,m-1+n+1,0).getDate();
    const nd=new Date(y,m-1+n,Math.min(day,dim));
    view=nd.getFullYear()+'-'+S.pad(nd.getMonth()+1)+'-'+S.pad(nd.getDate());
    redraw();
  }
  function goToday(){view=S.today();redraw();}

  /* ---------- 主渲染 ---------- */
  let rootId='fat-body';
  function render(body){
    if(body)rootId=body.id||'fat-body';
    const el=document.getElementById(rootId);if(!el)return;
    const all=(S.get().poops||[]).slice().sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
    const dayRecs=all.filter(p=>p.date===view);
    const mon=all.filter(p=>p.date.slice(0,7)===view.slice(0,7));
    const avg=mon.length?Math.round(mon.reduce((s,p)=>s+(+p.score||0),0)/mon.length):0;
    const isToday=view===S.today();

    el.innerHTML=`
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">${I.i('calendar')}</span>便便日历</div>
          <span class="pill${isToday?'':' go-today-pill'}" onclick="${isToday?'':'Poop.goToday();return false;'}">${isToday?'今天':'回到今天'}</span></div>
        <div class="mp-head">
          <button onclick="Poop.shiftMonth(-1)">‹</button>
          <div class="mp-t">${view.slice(0,4)}年 ${+view.slice(5,7)}月</div>
          <button onclick="Poop.shiftMonth(1)">›</button>
        </div>
        ${monthGrid()}
        <div class="grid3 mt12">
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px">${mon.length}</div><div class="lbl">本月次数</div></div>
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px;color:${scoreColor(avg)}">${avg||'—'}</div><div class="lbl">本月均分</div></div>
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px">${dayRecs.length}</div><div class="lbl">当日记录</div></div>
        </div>
        <button class="btn btn-primary btn-block mt12" onclick="Poop.add()">💩 记录一次便便${isToday?'':'（补录 '+S.fmtCN(view)+'）'}</button>
        <div class="small muted mt8">同一天可以记录多条；日期下方的小图就是当天的便便形状。</div>
      </div>

      ${warnCard()}

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">${I.i('note')}</span>历史记录</div>
          <span class="pill">${all.length} 条</span></div>
        <div class="small muted" style="margin-bottom:8px">按时间倒序 · 长按任意一条可编辑或删除</div>
        ${all.length?all.slice(0,60).map(histCard).join(''):'<div class="empty">'+I.EMPTY.replace('width="120"','width="70"')+'<p>还没有记录，点上面的按钮记一次吧～</p></div>'}
      </div>
    `;
    if(I&&I.upgrade)I.upgrade(el);
    el.querySelectorAll('.poop-card').forEach(c=>bindLongPress(c,()=>actions(c.dataset.pid)));
  }
  function redraw(){render(null);}

  function histCard(p){
    const sc=+p.score||0;
    return `<div class="poop-card" data-pid="${p.id}">
      <div class="pc-head">
        <span class="pc-shape">${shapeSvg(p.shape)}</span>
        <div class="pc-title">
          <b>${S.fmtCN(p.date)}${p.time?' '+p.time:''}</b>
          <div class="small muted">${shapeName(p.shape)} · ${p.color||'—'} · ${p.amount||'—'}</div>
        </div>
        <span class="pc-score" style="color:${scoreColor(sc)};border-color:${scoreColor(sc)}">${sc}</span>
      </div>
      <div class="pc-tags">
        <span class="pc-tag">${p.feel||'—'}</span>
        <span class="pc-tag">${p.dur||'—'}</span>
        <span class="pc-tag">${p.smell||'—'}</span>
        <span class="pc-tag">${p.body||'—'}</span>
        <span class="pc-tag">${p.place||'—'}</span>
        ${p.blood?'<span class="pc-tag danger">有出血</span>':''}
      </div>
      ${p.note?`<div class="small muted mt8">📝 ${esc(p.note)}</div>`:''}
      <div class="pc-ana">${esc(p.analysis||'')}</div>
    </div>`;
  }
  function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

  /* ---------- 异常温和提示（本页 + 首页共用判定） ---------- */
  function anomaly(){
    const t=S.today(), from=S.addDays(t,-29);
    const recent=(S.get().poops||[]).filter(p=>p.date>=from&&p.date<=t);
    const blood=recent.filter(p=>p.blood||p.color==='红色'||p.color==='黑色');
    const loose=recent.filter(p=>+p.shape>=6||p.feel==='腹泻');
    const hard=recent.filter(p=>+p.shape<=2||p.feel==='便秘');
    const msgs=[];
    if(blood.length>=2)msgs.push('近 30 天有 '+blood.length+' 次便血或异常颜色，建议尽快去医院看看，别自己扛 🌸');
    if(loose.length>=5)msgs.push('近 30 天有 '+loose.length+' 次偏稀/腹泻，注意饮食清淡与腹部保暖，持续两周以上建议就医');
    if(hard.length>=5)msgs.push('近 30 天有 '+hard.length+' 次干硬/便秘，多喝水、多吃蔬果，规律作息会好很多');
    return msgs;
  }
  function warnCard(){
    const msgs=anomaly();
    if(!msgs.length)return '';
    return `<div class="card warn-card">
      <div class="card-h"><div class="l"><span class="ico">🌸</span>温柔提醒</div></div>
      ${msgs.map(m=>'<div class="small" style="margin-bottom:6px">· '+m+'</div>').join('')}
      <div class="small muted">这只是根据记录做的温柔提醒，不能代替医生诊断，别太担心 💗</div>
    </div>`;
  }

  /* ---------- 长按操作 ---------- */
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
    const p=(S.get().poops||[]).find(x=>x.id===id);if(!p)return;
    UI.modal(`<div class="modal-title">${S.fmtCN(p.date)}${p.time?' '+p.time:''} 的记录</div>
      <div class="small muted" style="margin-bottom:10px">${shapeName(p.shape)} · ${p.color} · 评分 ${p.score}</div>
      <button class="btn btn-primary btn-block" onclick="Poop.edit('${id}')">✏️ 编辑这条</button>
      <button class="btn btn-ghost btn-block mt8" style="color:#e06a80" onclick="Poop.del('${id}')">🗑 删除这条</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">取消</button>`);
  }
  function del(id){
    S.get().poops=(S.get().poops||[]).filter(x=>x.id!==id);
    S.save();UI.close();redraw();UI.toast('已删除');
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
  }

  /* ---------- 表单 ---------- */
  function nowHM(){const d=new Date();return S.pad(d.getHours())+':'+S.pad(d.getMinutes());}
  function add(){
    editId=null;
    form={date:view,time:nowHM(),shape:4,color:'黄褐色',amount:'适中',smell:'臭',
          feel:'顺畅',dur:'<5min',blood:false,body:'顺畅',place:'家里',note:''};
    openForm();
  }
  function edit(id){
    const p=(S.get().poops||[]).find(x=>x.id===id);if(!p)return;
    editId=id;form=Object.assign({},p);
    openForm();
  }
  function grp(field,list,cur){
    return '<div class="seg wrap" data-grp="'+field+'">'+list.map(v=>{
      const val=Array.isArray(v)?v[0]:v, dot=Array.isArray(v)?'<i class="cdot" style="background:'+v[1]+'"></i>':'';
      return '<span class="opt'+(cur===val?' on':'')+'" data-f="'+field+'" data-v="'+val+'">'+dot+val+'</span>';
    }).join('')+'</div>';
  }
  function openForm(){
    UI.modal(`
      <div class="modal-title">💩 ${editId?'编辑':'记录'}一次便便</div>

      <div class="grid2">
        <div class="field"><label>日期</label><input id="pf-date" type="date" value="${form.date}"></div>
        <div class="field"><label>时间</label><input id="pf-time" type="time" value="${form.time||''}"></div>
      </div>

      <div class="field"><label>排便形状（布里斯托分型）</label></div>
      <div class="bristol" id="pf-shape">
        ${SHAPES.map(s=>`<div class="bs-item${+form.shape===s.t?' on':''}" data-f="shape" data-v="${s.t}">
            <div class="bs-svg">${s.svg}</div>
            <div class="bs-t">${s.t}型 ${s.name}</div>
            <div class="bs-d">${s.desc}</div>
          </div>`).join('')}
      </div>

      <div class="field"><label>颜色</label></div>${grp('color',COLORS,form.color)}
      <div class="field mt8"><label>分量</label></div>${grp('amount',AMOUNTS,form.amount)}
      <div class="field mt8"><label>气味</label></div>${grp('smell',SMELLS,form.smell)}
      <div class="field mt8"><label>排便感受</label></div>${grp('feel',FEELS,form.feel)}
      <div class="field mt8"><label>排便时长</label></div>${grp('dur',DURS,form.dur)}
      <div class="field mt8"><label>是否出血</label></div>${grp('blood',['否','是'],form.blood?'是':'否')}
      <div class="field mt8"><label>便便感受</label></div>${grp('body',BODYS,form.body)}
      <div class="field mt8"><label>地点</label></div>${grp('place',PLACES,form.place)}

      <div class="field mt12"><label>备注</label><textarea id="pf-note" rows="2" placeholder="今天喝水少了 / 昨晚吃了火锅…">${esc(form.note||'')}</textarea></div>

      <div class="review-box" id="pf-preview" style="margin-top:10px"></div>

      <div class="flex gap8 mt12">
        <button class="btn btn-primary btn-block" onclick="Poop.save()">保存并评分</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>
    `);
    const root=document.querySelector('.modal');
    root.addEventListener('click',e=>{
      const o=e.target.closest('[data-f]');if(!o||!root.contains(o))return;
      const f=o.dataset.f, v=o.dataset.v;
      form[f]= f==='blood' ? (v==='是') : (f==='shape'?+v:v);
      const box=o.parentElement;
      box.querySelectorAll('[data-f="'+f+'"]').forEach(x=>x.classList.remove('on'));
      o.classList.add('on');
      preview();
    });
    ['pf-date','pf-time','pf-note'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.oninput=()=>{form[id.slice(3)]=el.value;preview();};
    });
    preview();
  }
  function preview(){
    const el=document.getElementById('pf-preview');if(!el)return;
    const r=evaluate(form);
    el.innerHTML='<b style="color:'+scoreColor(r.score)+'">实时评分 '+r.score+' 分 · '+r.level+'</b><br>'+esc(r.analysis);
  }
  function save(){
    const dv=document.getElementById('pf-date');
    const tv=document.getElementById('pf-time');
    const nv=document.getElementById('pf-note');
    form.date=(dv&&dv.value)||form.date||S.today();
    form.time=(tv&&tv.value)||'';
    form.note=(nv&&nv.value||'').trim();
    const r=evaluate(form);
    const d=S.get();
    if(!Array.isArray(d.poops))d.poops=[];
    if(editId){
      const p=d.poops.find(x=>x.id===editId);
      if(p)Object.assign(p,form,{score:r.score,level:r.level,analysis:r.analysis});
    }else{
      d.poops.push(Object.assign({id:S.uid()},form,{score:r.score,level:r.level,analysis:r.analysis}));
    }
    S.save();UI.close();
    view=form.date;redraw();
    UI.toast(r.score>=78?('记录好啦 · '+r.score+' 分 '+r.level+' 💗'):('已记录 · '+r.score+' 分，'+r.level));
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
  }

  window.Poop={render,redraw,pick,shiftMonth,goToday,add,edit,del,save,anomaly,evaluate,shapeSvg,shapeName};
})();
