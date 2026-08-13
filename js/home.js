/* ============ 首页 · 聚合仪表盘 ============ */
(function(){
  const S=window.Store, I=window.Icon, AI=window.AI;
  let view=S.today(); // 日历选中的日期

  function monthGrid(d){
    const first=S.parse(d); first.setDate(1);
    const ym=d.slice(0,7);
    const startW=S.weekday(d.slice(0,7)+'-01');
    const daysInMonth=new Date(+d.slice(0,4),+d.slice(5,7),0).getDate();
    let cells='';
    const wk=['日','一','二','三','四','五','六'];
    let head='';wk.forEach(w=>head+='<div class="cal-h">'+w+'</div>');
    for(let i=0;i<startW;i++)cells+='<div class="cal-cell empty"></div>';
    for(let i=1;i<=daysInMonth;i++){
      const ds=ym+'-'+S.pad(i);
      const cls='cal-cell'+(ds===view?' sel':'')+(ds===S.today()?' today':'');
      // 去掉底部红点
      cells+='<div class="'+cls+'" onclick="Home.pick(\''+ds+'\')">'+i+'</div>';
    }
    return '<div class="cal-wk">'+head+'</div><div class="cal-grid">'+cells+'</div>';
  }

  function render(){
    const t=S.today();
    const d=S.fmtCN(view), wd=S.weekCN(view);
    const todos=S.S.todosToday(view);
    const done=todos.filter(x=>x.done.includes(view));
    const ex=S.S.exercisesToday(view);
    const diet=S.S.dietToday(view);
    const en=S.get().english.words.filter(x=>x.learnDate===view&&x.status==='new');
    const w=S.S.weightToday(view);
    const ik=S.S.intakeToday(view);          // 三餐 + 喝喝（饮品热量已合并）
    const cal=ik.total;
    const exMin=ex.reduce((s,e)=>s+(+e.dur||0),0);
    const enGoal=S.get().english.goal;
    // 累计词汇：与英语页一致，仅“认识”过的计入
    const enLearned=S.get().english.words.filter(x=>x.known===true).length;

    // 身体状态
    const hid=S.get().settings.hideWeight;
    const intake=cal, burn=ex.reduce((s,e)=>s+(+e.dur||0)*4,0);
    const waterData=getWaterData(view);
    const waterDone=waterData?waterData.done:0;
    const wt=hid?'•••':(w?(w.morning?w.morning+'kg':'—'):'—');

    // 排便（联动减脂-排便）
    const P=window.Poop;
    const poops=(S.S.poopsToday?S.S.poopsToday(view):[]).slice()
                 .sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    const pScore=poops.length?Math.round(poops.reduce((s,p)=>s+(+p.score||0),0)/poops.length):0;
    const pIco=poops.length&&P?P.shapeSvg(poops[poops.length-1].shape):'';
    const pColor=poops.length?(pScore>=78?'#5faa74':(pScore>=60?'#e2a13c':'#e06a80')):'var(--muted)';
    // 经期
    const pd=S.S.periodOn?S.S.periodOn(view):null;
    // 温和提示（近 30 天异常）
    const warnMsgs=(P&&P.anomaly)?P.anomaly():[];
    // 综合小结：饮食 / 运动 / 排便 联动一句话
    const combo=(()=>{
      const arr=[];
      if(cal) arr.push('摄入 '+cal+' kcal'+(ik.drink?'（含饮品 '+ik.drink+'）':''));
      if(exMin) arr.push('运动 '+exMin+' 分钟');
      if(poops.length) arr.push('排便 '+poops.length+' 次 · 评分 '+pScore);
      if(!arr.length) return '今天还没有记录，随手记一笔就好 🌿';
      let tip='';
      if(poops.length&&pScore<60) tip = exMin<20 ? ' · 肠道状态一般，试试饭后散步 20 分钟' : ' · 肠道状态一般，注意多喝水和膳食纤维';
      else if(!poops.length) tip=' · 今天还没记录排便哦';
      else if(pScore>=78) tip=' · 肠道状态不错，继续保持 💚';
      return arr.join(' · ')+tip;
    })();

    // 财务
    const ym=t.slice(0,7);
    let spent=0;S.S.billsMonth(ym).forEach(b=>{if(b.type==='expense')spent+=b.amount;});
    const budget=S.get().budget.amount;
    const remain=budget-spent;
    // 允许「还没定日期」的旅行计划：有日期的排前面，没日期的兜底展示
    const upc=S.get().travels.filter(x=>x.status==='upcoming');
    const dated=upc.filter(x=>x.start&&x.start>=t).sort((a,b)=>a.start.localeCompare(b.start));
    const undated=upc.filter(x=>!x.start);
    const nextTravel=dated[0]||undated[0];

    // 本周复盘最新 + 是否收起
    const latest=S.get().reviews.filter(r=>r.type==='weekly').slice(-1)[0];
    const hideRv=!!S.get().settings.hideReview;

    const el=document.getElementById('page-home');
    el.innerHTML=`
      <div class="page-head">
        <div class="date-line">${S.fmtCN(t)} ${S.weekCN(t)} · 把日子过成喜欢的样子</div>
        <div class="title">木木的今天</div>
      </div>

      ${medCard(view)}

      <!-- 4 统计（整卡可点击跳转） -->
      <div class="stat-row">
        <div class="stat tap" onclick="Nav.go('todo')"><div class="emoji">📋</div><div class="num">${done.length}/${todos.length}</div><div class="lbl">今日待办</div></div>
        <div class="stat tap" onclick="Nav.go('food');Food.setSub('eat')"><div class="emoji">🍽️</div><div class="num">${cal}</div><div class="lbl">今日摄入(kcal)</div></div>
        <div class="stat tap" onclick="Nav.go('fatloss');Fat.set('exercise')"><div class="emoji">💪</div><div class="num">${exMin}'</div><div class="lbl">今日运动</div></div>
        <div class="stat tap" onclick="Nav.go('study')"><div class="emoji">📚</div><div class="num">${enLearned}</div><div class="lbl">累计词汇</div></div>
      </div>

      ${fastCard()}

      <!-- 身体状态（体重 / 喝水 / 消耗 / 排便，联动饮食·运动） -->
      <div class="card nav" onclick="Nav.go('fatloss');Fat.set('weight')">
        <div class="card-h"><div class="l"><span class="ico">⚖️</span>身体状态</div>
          <span class="pill ${hid?'on':''}" onclick="event.stopPropagation();Home.toggleWeight()">${hid?'已隐藏':'显示'}</span></div>
        <div class="grid4">
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="emoji">⚖️</div><div class="num ${hid?'hide-num':''}" style="font-size:15px">${wt}</div><div class="lbl">体重</div></div>
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="emoji">💧</div><div class="num" style="font-size:15px">${waterDone}/8</div><div class="lbl">喝水(杯)</div></div>
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="emoji">🔥</div><div class="num" style="font-size:15px">${burn}</div><div class="lbl">消耗(kcal)</div></div>
          <div class="stat" style="box-shadow:none;background:var(--bg)" onclick="event.stopPropagation();Nav.go('fatloss');Fat.set('poop')">
            <div class="emoji hm-poop">${pIco||'💩'}</div>
            <div class="num" style="font-size:15px;color:${pColor}">${poops.length?poops.length+'次 '+pScore+'分':'—'}</div>
            <div class="lbl">排便</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="small muted">${combo}</div>
        ${pd?'<div class="small mt8" style="color:#e08aa4">🌸 经期中（'+pd.start+' 开始）· 注意保暖和休息</div>':''}
        <div class="small muted mt8">体重数字仅为参考，别被它定义你 💗</div>
      </div>

      ${warnMsgs.length?`
      <div class="card warn-card">
        <div class="card-h"><div class="l"><span class="ico">🌸</span>温柔提醒</div>
          <span class="pill" onclick="event.stopPropagation();Nav.go('fatloss');Fat.set('poop')">去看看</span></div>
        ${warnMsgs.map(m=>'<div class="small" style="margin-bottom:6px">· '+m+'</div>').join('')}
        <div class="small muted">这只是根据记录做的温柔提醒，不能代替医生诊断，别太担心 💗</div>
      </div>`:''}

      <!-- 财务 & 出行（整卡跳记账；最近旅行可单独跳旅游） -->
      <div class="card nav" onclick="Nav.go('account')">
        <div class="card-h"><div class="l"><span class="ico">💰</span>财务 & 出行</div>
          <span class="pill">本月</span></div>
        <div class="grid2">
          <div class="stat" style="box-shadow:none;background:var(--bg)">
            <div class="emoji">💰</div>
            <div class="num" style="font-size:17px;color:${remain<0?'#e98aa0':'var(--pink)'}">${remain<0?'-':''}¥${Math.abs(remain).toFixed(2)}</div>
            <div class="lbl">本月预算剩余</div>
          </div>
          <div class="stat" style="box-shadow:none;background:var(--bg)" onclick="event.stopPropagation();Nav.go('travel')">
            <div class="emoji">🧳</div>
            <div class="num" style="font-size:14px">${nextTravel?nextTravel.dest:'暂无'}</div>
            <div class="lbl">最近旅行</div>
          </div>
        </div>
      </div>

      <!-- 本周复盘预览（可隐藏） -->
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🌸</span>本周复盘预览</div>
          <span class="pill ${hideRv?'on':''}" onclick="Home.toggleReview()">${hideRv?'已隐藏 · 点开':'隐藏'}</span></div>
        ${hideRv?'<div class="small muted">复盘已收起，点右上角就能展开～</div>':`
        ${latest?'<div class="review-box">'+latest.content.replace(/\n/g,'<br>')+'</div>'
                :'<div class="empty">'+I.EMPTY.replace('width="120"','width="70"')+'<p>还没生成本周复盘，点下面按钮试试～</p></div>'}
        <button class="btn btn-primary btn-block mt12" onclick="Home.genWeek()">✨ 一键生成综合周复盘</button>
        ${S.get().reviews.filter(r=>r.type==='weekly').length?'<button class="btn btn-ghost btn-block mt8" onclick="Home.history()">查看历史复盘</button>':''}`}
      </div>

      <!-- 数据备份（长期保障：换设备/清缓存不丢） -->
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">${I.i('note')}</span>数据备份</div></div>
        <div class="small muted" style="margin-bottom:8px">数据存在本机浏览器。定期导出一份文件，换手机或清缓存后随时恢复。</div>
        <div class="flex gap8">
          <button class="btn btn-ghost btn-block" onclick="Home.exportData()">⬇ 导出备份</button>
          <button class="btn btn-ghost btn-block" onclick="Home.importData()">⬆ 导入恢复</button>
        </div>
      </div>
    `;
    // 轻断食进行中：在首页卡片直接挂载倒计时（不需进入计划页）
    const fssess=S.get().fastingSession;
    if(fssess&&(fssess.status==='running'||fssess.status==='paused')&&window.Fast){
      const fcard=el.querySelector('.fast-card');
      if(fcard) Fast.mountTimer(fcard, fssess);
    }
  }

  /* ---- 吃药提醒：整肠生 · 每天 一天三顿（含周日） ---- */
  const MED_SLOTS=[
    {k:'早',ico:'🌅',t:'早餐后'},
    {k:'午',ico:'☀️',t:'午餐后'},
    {k:'晚',ico:'🌙',t:'晚餐后'}
  ];
  function medOf(d){
    if(!S.get().medLog)S.get().medLog=[];
    let m=S.get().medLog.find(x=>x.date===d);
    if(!m){m={date:d,taken:[0,0,0]};S.get().medLog.push(m);S.save();}
    if(!Array.isArray(m.taken))m.taken=[0,0,0];
    while(m.taken.length<3)m.taken.push(0);
    return m;
  }
  function medCard(d){
    const m=medOf(d);
    const n=m.taken.filter(x=>x).length;
    return `<div class="card med-card">
      <div class="datenav med-datebar">
        <div class="d-wrap">
          <button onclick="Home.shiftMed(-1)">‹</button>
          <div class="d" onclick="Home.pickDateMed(this)"><span class="ic">📅</span>${S.fmtCN(d)}</div>
          <button onclick="Home.shiftMed(1)">›</button>
        </div>
        <button class="today-btn-sm${d===S.today()?'':' go-today-pill'}" onclick="Home.goToday()">${d===S.today()?'今天':'回到今天'}</button>
      </div>
      <div class="card-h"><div class="l"><span class="ico">💊</span>吃药提醒 · 整肠生</div>
        <span class="pill ${n>=3?'on':''}">${n}/3 顿</span></div>
      <div class="grid3">
        ${MED_SLOTS.map((s,i)=>{
          const on=!!m.taken[i];
          return `<div class="med-cell ${on?'done':''}" onclick="Home.toggleMed(${i})">
            <span class="med-ico">${on?'✅':s.ico}</span>
            <span class="med-k">${s.k}</span>
            <span class="med-t">${on?'已服用':s.t}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="small muted mt8" style="text-align:center">${n>=3?'今天三顿都吃啦，肠胃谢谢你 💗':'每天 · 一天三顿（含周日）· 饭后温水送服'}</div>
    </div>`;
  }
  function toggleMed(i){
    const m=medOf(view);
    m.taken[i]=m.taken[i]?0:1;
    S.save();render();
    UI.toast(m.taken[i]?'已记录，别忘了下一顿 💊':'已取消这一顿');
  }

  function pick(d){view=d;render();}
  function goToday(){view=S.today();render();}
  /* 吃药卡片内的小日历：左右按天切换，点击日期用和减脂运动一样的 UI.datePicker */
  function shiftMed(n){view=S.addDays(view,n);render();}
  function pickDateMed(el){
    UI.datePicker(view,ds=>{view=ds;render();},'选择日期');
  }
  /* 首页日历跨月切换（支持上个月 / 下个月，可跨年） */
  function shiftMonth(n){
    const y=+view.slice(0,4), m=+view.slice(5,7), day=+view.slice(8,10);
    const dim=new Date(y,m-1+n+1,0).getDate();
    const nd=new Date(y,m-1+n,Math.min(day,dim));
    view=nd.getFullYear()+'-'+S.pad(nd.getMonth()+1)+'-'+S.pad(nd.getDate());
    render();
  }

  function toggleWeight(){
    const s=S.get().settings;s.hideWeight=!s.hideWeight;S.save();render();
  }
  /* 本周复盘收起 / 展开 */
  function toggleReview(){
    const s=S.get().settings;s.hideReview=!s.hideReview;S.save();render();
    UI.toast(s.hideReview?'本周复盘已收起':'本周复盘已展开');
  }

  /* ---- 轻断食 16+8 ---- */
  function toMin(t){const p=(t||'00:00').split(':');return (+p[0]||0)*60+(+p[1]||0);}
  function fastCard(){
    const fs=S.get().settings.fasting;
    const sess=S.get().fastingSession;
    const active=sess&&(sess.status==='running'||sess.status==='paused');
    const head=`<div class="card-h"><div class="l"><span class="ico">⏱️</span>轻断食 · 16+8</div>
        <div class="fast-h-pills">
          <span class="pill ${fs.on?'on':''}" onclick="event.stopPropagation();Home.toggleFasting()">${fs.on?'已开启':'已关闭'}</span>
          <span class="pill" onclick="event.stopPropagation();Nav.go('fasthistory')">全部记录 ›</span>
        </div>
      </div>`;
    if(active){
      const paused=sess.status==='paused';
      return `<div class="card fast-card">
        ${head}
        ${window.Fast?Fast.homeTimer(sess):''}
        <div class="fast-actions">
          <button class="btn ${paused?'btn-primary':'btn-ghost'}" onclick="event.stopPropagation();Fast.togglePause()">${paused?'▶ 继续':'⏸ 暂停'}</button>
          <button class="btn btn-danger" onclick="event.stopPropagation();Fast.endFast()">结束本轮</button>
        </div>
      </div>`;
    }
    const now=new Date();
    const cur=now.getHours()*60+now.getMinutes();
    const eatS=toMin(fs.eatStart), eatE=toMin(fs.eatEnd);
    const eatLen=eatE>=eatS?(eatE-eatS):(eatE+1440-eatS);
    const fastingLen=1440-eatLen;
    const eating = fs.on && ((eatE>=eatS)?(cur>=eatS&&cur<=eatE):(cur>=eatS||cur<=eatE));
    const liveCls=!fs.on?'off':(eating?'eat':'fast');
    const liveTxt=!fs.on?'轻断食已关闭':(eating?'当前：进食中 🍽️':'当前：断食中 🌙');
    return `<div class="card fast-card">
      ${head}
      <div class="fast-card-status ${liveCls}">${liveTxt}</div>
      <div class="fast-cols">
        <div class="fast-col"><div class="fc-label">饮食时间</div><div class="fc-val">${fs.eatStart} – ${fs.eatEnd}</div><div class="fc-sub">${(eatLen/60).toFixed(eatLen%60?1:0)}h</div></div>
        <div class="fast-col"><div class="fc-label">断食时间</div><div class="fc-val">${fs.eatEnd} – 次日 ${fs.eatStart}</div><div class="fc-sub">${(fastingLen/60).toFixed(fastingLen%60?1:0)}h</div></div>
      </div>
      <div class="fast-actions">
        <button class="btn btn-primary" onclick="event.stopPropagation();Fast.pickStart()">⏱️ 开始断食</button>
        <button class="btn btn-ghost" onclick="event.stopPropagation();Home.openFasting()">⚙ 自定义时间</button>
      </div>
    </div>`;
  }
  function toggleFasting(){
    const fs=S.get().settings.fasting;fs.on=!fs.on;S.save();render();
    UI.toast(fs.on?'轻断食已开启 💗':'轻断食已关闭');
  }
  function openFasting(){
    const fs=S.get().settings.fasting;
    UI.modal(`
      <div class="modal-title">⏱️ 自定义轻断食时间</div>
      <div class="small muted" style="margin-bottom:10px">设定一天里可以吃饭的「饮食时间」，其余时间就是「断食时间」。默认 16+8（饮食 8 小时，断食 16 小时）。选了开始时间，结束会自动往后延 8 小时。</div>
      <div class="field"><label>饮食开始</label><input id="feS" type="time" value="${fs.eatStart}"></div>
      <div class="field"><label>饮食结束</label><input id="feE" type="time" value="${fs.eatEnd}"></div>
      <button class="btn btn-primary btn-block mt12" onclick="Home.saveFasting()">保存</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">取消</button>
    `);
    const feS=document.getElementById('feS'), feE=document.getElementById('feE');
    if(feS&&feE){
      feS.addEventListener('input',()=>{
        const m=toMin(feS.value); const tot=((m+480)%1440+1440)%1440;
        const h=Math.floor(tot/60), mm=tot%60;
        feE.value=(h<10?'0':'')+h+':'+(mm<10?'0':'')+mm;
      });
    }
  }
  function saveFasting(){
    const s=document.getElementById('feS').value, e=document.getElementById('feE').value;
    if(!s||!e){UI.toast('请选择时间');return;}
    const fs=S.get().settings.fasting;
    fs.eatStart=s;fs.eatEnd=e;S.save();UI.close();render();
    UI.toast('已更新轻断食时间 💗');
  }

  /* 编辑预算已迁移到「专属记账」页面（Acc.editBudget） */

  function genWeek(){
    const r=AI.weeklyReview();
    const rev={id:S.uid(),type:'weekly',date:S.today(),content:r.content,modules:r.modules};
    S.get().reviews.push(rev);S.save();
    UI.modal('<div class="modal-title">🌸 本周综合复盘</div><div class="review-box">'+r.content.replace(/\n/g,'<br>')+'</div><button class="btn btn-primary btn-block mt12" onclick="UI.close()">好呀，收下这份温柔</button>');
    render();
  }

  function history(){
    const list=S.get().reviews.filter(r=>r.type==='weekly').reverse();
    let html='<div class="modal-title">📖 历史复盘</div>';
    if(!list.length)html+='<div class="empty">'+I.EMPTY.replace('width="120"','width="70"')+'<p>还没有复盘记录</p></div>';
    list.forEach(r=>{
      html+='<div class="card" style="margin-bottom:10px"><div class="small muted">'+r.date+'</div><div class="review-box mt8">'+r.content.replace(/\n/g,'<br>')+'</div></div>';
    });
    html+='<button class="btn btn-ghost btn-block mt8" onclick="UI.close()">关闭</button>';
    UI.modal(html);
  }

  /* ---- 水杯数据读取 ---- */
  function getWaterData(date){
    return S.get().waterLog.find(w=>w.date===date)||null;
  }

  /* ---- 数据备份：导出 JSON 文件 / 从文件导入恢复 ---- */
  function exportData(){
    const json=S.exportJSON();
    const blob=new Blob([json],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='木木工作台备份_'+S.today()+'.json';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    UI.toast('备份已下载到本地 💾');
  }
  function importData(){
    const inp=document.createElement('input');
    inp.type='file';inp.accept='application/json';
    inp.onchange=()=>{
      const f=inp.files[0];if(!f)return;
      const rd=new FileReader();
      rd.onload=()=>{
        try{ S.importJSON(rd.result); UI.toast('导入成功，正在恢复…'); setTimeout(()=>location.reload(),600); }
        catch(e){ UI.toast('导入失败：'+e.message); }
      };
      rd.readAsText(f);
    };
    inp.click();
  }

  window.Home={render,pick,goToday,shiftMonth,shiftMed,pickDateMed,toggleWeight,toggleReview,genWeek,history,getWaterData,exportData,importData,toggleMed,
    toggleFasting,openFasting,saveFasting};
})();
