/* 轻断食 · 计时模块（计划页 + 历史页） */
(function(){
  const S=window.Store, I=window.Icon; // 每个模块自立 S/I 别名（与全局 window.Store/window.Icon 对齐）
  let _timer=null;          // 倒计时定时器 id
  function stopTimer(){ if(_timer){clearInterval(_timer);_timer=null;} }

  /* ---- 时间工具 ---- */
  function toMin(t){const p=(t||'00:00').split(':');return (+p[0]||0)*60+(+p[1]||0);}
  function minToHHMM(m){m=((m%1440)+1440)%1440;const h=Math.floor(m/60),mm=m%60;return (h<10?'0':'')+h+':'+(mm<10?'0':'')+mm;}
  function todayTsOn(dateStr,hhmm){const p=(hhmm||'00:00').split(':');const a=(dateStr||S.today()).split('-').map(Number);const d=new Date(a[0],a[1]-1,a[2],+p[0]||0,+p[1]||0,0,0);return d.getTime();}
  function fmtDur(min){const tot=Math.max(0,Math.round(min));const h=Math.floor(tot/60),m=tot%60;return h>0?(h+' 小时'+(m?(' '+m+' 分'):'')):(tot+' 分');}
  function fmtClock(ms){const s=Math.max(0,Math.floor(ms/1000));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;const p=n=>(n<10?'0':'')+n;return p(h)+':'+p(m)+':'+p(ss);}

  function getSession(){return S.get().fastingSession;}
  function save(){S.save();}

  /* 根据会话与给定时刻，算出当前所处阶段与边界（绝对时间戳） */
  function compute(sess, now){
    const durMin=((toMin(sess.fastEnd)-toMin(sess.fastStart))+1440)%1440 || 960; // 断食时长（分钟），默认 16h
    const startMs=todayTsOn(sess.date,sess.fastStart);
    const endMs=startMs+durMin*60000;            // 断食结束（进食窗口开启）
    const eatEndMs=startMs+1440*60000;           // 进食窗口结束（次日同时刻，开启下一轮）
    let phase,boundary;
    if(now<startMs){phase='wait';boundary=startMs;}
    else if(now<endMs){phase='fast';boundary=endMs;}
    else if(now<eatEndMs){phase='eat';boundary=eatEndMs;}
    else {phase='done';boundary=eatEndMs;}
    return {phase,boundary,startMs,endMs,eatEndMs,durMin};
  }
  /* 考虑暂停的“有效当前时刻” */
  function effNow(sess){
    if(sess.status==='paused'&&sess.pausedAt) return sess.pausedAt-(sess.pausedTotal||0);
    return Date.now()-(sess.pausedTotal||0);
  }

  /* ---------- 计划页（计时） ---------- */
  function render(){
    stopTimer();
    const root=document.getElementById('page-fast');
    if(!root)return;
    const sess=getSession();
    if(sess&&(sess.status==='running'||sess.status==='paused')){
      root.innerHTML=`<div class="page-pad">
        <div class="ph"><span class="ph-back" onclick="Nav.go('home')">‹</span><b>轻断食进行中</b></div>
        ${timerInner(sess)}
        <div class="fast-actions">
          <button class="btn ${sess.status==='paused'?'btn-primary':'btn-ghost'}" onclick="Fast.togglePause()">${sess.status==='paused'?'▶ 继续':'⏸ 暂停'}</button>
          <button class="btn btn-danger" onclick="Fast.endFast()">结束本轮</button>
        </div>
        <p class="small muted center mt12">本轮计划断食 8 小时，进食窗口 16 小时。手动开始的计划只记录今天。</p>
      </div>`;
      mountTimer(root,sess);
    }else{
      root.innerHTML=setupView();
      bindSetup();
    }
    I.upgrade(root);
  }

  function setupView(){
    const fs=S.get().settings.fasting;
    // 默认断食开始 = 进食窗口结束时刻，断食 8 小时
    let defStart=fs.eatEnd||'16:00';
    let defEnd=minToHHMM(toMin(defStart)+960);
    const now=new Date();
    const cur=now.getHours()*60+now.getMinutes();
    const eatS=toMin(fs.eatStart),eatE=toMin(fs.eatEnd);
    const eating=(eatE>=eatS)?(cur>=eatS&&cur<=eatE):(cur>=eatS||cur<=eatE);
    const liveTxt=!fs.on?'轻断食已关闭':(eating?'当前：进食中 🍽️':'当前：断食中 🌙');
    return `<div class="page-pad">
      <div class="ph"><span class="ph-back" onclick="Nav.go('home')">‹</span><b>轻断食计划</b></div>

      <div class="card fast-setup">
        <div class="fast-card-status ${fs.on?(eating?'eat':'fast'):'off'}">${liveTxt}</div>
        <p class="small muted mt6">设定本轮断食的开始时间，结束时间会自动顺延 16 小时（断食窗口 16h，进食窗口 8h）。只持续今天哦～</p>

        <div class="field mt12"><label>断食开始</label><input id="ffs" type="time" value="${defStart}"></div>
        <div class="field"><label>断食结束</label><input id="ffe" type="time" value="${defEnd}"></div>

        <div class="fast-preview">
          <div class="fp-col"><div class="fp-ico">🌙</div><div class="fp-label">断食时段</div><div class="fp-val" id="fp-fast">16 小时</div></div>
          <div class="fp-arrow">→</div>
          <div class="fp-col"><div class="fp-ico">🍽️</div><div class="fp-label">进食时段</div><div class="fp-val" id="fp-eat">8 小时</div></div>
        </div>

        <button class="btn btn-primary btn-block mt14" onclick="Fast.startFast()">⏱️ 开始断食</button>
        <button class="btn btn-ghost btn-block mt8" onclick="Nav.go('fasthistory')">📖 查看历史记录</button>
      </div>

      <div class="card mt12">
        <div class="card-h"><div class="l"><span class="ico">⚙️</span>我的 16+8 默认时间</div>
          <span class="pill ${fs.on?'on':''}" onclick="event.stopPropagation();Home.toggleFasting()">${fs.on?'已开启':'已关闭'}</span></div>
        <div class="fast-ranges">
          <div class="fast-range"><div class="fr-ico">🍽️</div><div class="fr-main"><div class="fr-label">饮食时间</div><div class="fr-val">${fs.eatStart} – ${fs.eatEnd}</div></div></div>
          <div class="fast-range"><div class="fr-ico">🌙</div><div class="fr-main"><div class="fr-label">断食时间</div><div class="fr-val">${fs.eatEnd} – 次日 ${fs.eatStart}</div></div></div>
        </div>
        <button class="btn btn-ghost btn-block mt10" onclick="Home.openFasting()">自定义时间范围</button>
      </div>
    </div>`;
  }

  function bindSetup(){
    const ffs=document.getElementById('ffs'), ffe=document.getElementById('ffe');
    if(!ffs||!ffe)return;
    function preview(){
      const s=toMin(ffs.value), e=toMin(ffe.value);
      const dur=((e-s)+1440)%1440;
      const d=dur||480;
      const fpF=document.getElementById('fp-fast'), fpE=document.getElementById('fp-eat');
      if(fpF)fpF.textContent=fmtDur(d);
      if(fpE)fpE.textContent=fmtDur(1440-d);
    }
    ffs.addEventListener('input',()=>{ ffe.value=minToHHMM(toMin(ffs.value)+480); preview(); }); // 改开始 → 结束自动 +8h
    ffe.addEventListener('input',preview);
    preview();
  }

  function startFast(){
    const ffs=document.getElementById('ffs'), ffe=document.getElementById('ffe');
    const s=ffs&&ffs.value, e=ffe&&ffe.value;
    if(!s){UI.toast('请选择断食开始时间');return;}
    const fastEnd=e||minToHHMM(toMin(s)+960);
    const sess={id:S.uid(),date:S.today(),fastStart:s,fastEnd:fastEnd,startedAt:Date.now(),status:'running',pausedTotal:0,pausedAt:null};
    S.get().fastingSession=sess;save();
    UI.toast('轻断食已开始 💗 坚持住～');
    rerender();
  }

  /* 计时主体（不含 page-pad/操作按钮），首页卡片与计时页共用 */
  function timerInner(sess){
    const c=compute(sess,effNow(sess));
    const phaseTxt={wait:'即将开始',fast:'断食时段',eat:'进食时段',done:'本轮完成'}[c.phase];
    const phaseCls={wait:'wait',fast:'fast',eat:'eat',done:'done'}[c.phase];
    const paused=sess.status==='paused';
    return `<div class="fast-timer ${phaseCls} ${paused?'paused':''}">
        <div class="ft-phase" id="ft-phase">${paused?'已暂停':phaseTxt}</div>
        <div class="ft-count" id="ft-count">--:--:--</div>
        <div class="ft-sub" id="ft-sub"></div>
        <div class="ft-bar"><div class="ft-bar-fill" id="ft-fill"></div></div>
        <div class="ft-range">${sess.fastStart} 🌙 → ${sess.fastEnd} 🍽️</div>
        ${paused?'<div class="ft-pause-flag">⏸ 计时已暂停</div>':''}
      </div>`;
  }

  /* 从首页点「开始断食」：先弹出时间选择，选今天几点开始断食（断食 16h） */
  function pickStart(){
    const fs=S.get().settings.fasting;
    const def=fs.eatEnd||'16:00'; // 默认断食开始 = 进食窗口结束时刻
    UI.modal(`
      <div class="modal-title">⏱️ 选择断食开始时间</div>
      <div class="small muted" style="margin-bottom:10px">选一个今天的时间开始本轮轻断食，断食 16 小时、进食 8 小时，只记录今天～</div>
      <div class="field"><label>今天几点开始断食</label><input id="fsPick" type="time" value="${def}"></div>
      <button class="btn btn-primary btn-block mt12" onclick="Fast.confirmStart()">开始断食</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">取消</button>
    `);
  }
  function confirmStart(){
    const el=document.getElementById('fsPick');
    const s=el&&el.value;
    if(!s){UI.toast('请选择开始时间');return;}
    const fastEnd=minToHHMM(toMin(s)+960); // 断食 16 小时
    const sess={id:S.uid(),date:S.today(),fastStart:s,fastEnd:fastEnd,startedAt:Date.now(),status:'running',pausedTotal:0,pausedAt:null};
    S.get().fastingSession=sess;save();
    UI.close();
    UI.toast('轻断食已开始 💗 坚持住～');
    rerender();
  }

  /* 首页卡片用的精简计时：左侧阶段 + 右侧倒计时 */
  function homeTimer(sess){
    const c=compute(sess,effNow(sess));
    const phaseTxt={wait:'即将开始',fast:'断食时段',eat:'进食时段',done:'本轮完成'}[c.phase];
    const paused=sess.status==='paused';
    return `<div class="fast-live ${c.phase} ${paused?'paused':''}">
      <div class="fast-live-l">
        <div class="fl-phase" id="ft-phase">${paused?'已暂停':phaseTxt}</div>
        <div class="fl-tip" id="ft-sub"></div>
      </div>
      <div class="fast-live-r">
        <div class="fl-count" id="ft-count">--:--:--</div>
        <div class="fl-range">${sess.fastStart} 🌙 → ${sess.fastEnd} 🍽️</div>
      </div>
    </div>`;
  }

  function startTick(root, sess){
    stopTimer();
    const tick=()=>{
      const cur=getSession();
      if(!cur||cur.id!==sess.id){ stopTimer(); return; } // 会话已变（结束/跨天）
      // 跨天自动归档
      if(S.today()!==cur.date){ archive('auto'); return; }
      const now=effNow(cur);
      const c=compute(cur,now);
      const remain=Math.max(0,c.boundary-now);
      const countEl=root.querySelector('#ft-count');
      const phaseEl=root.querySelector('#ft-phase');
      const subEl=root.querySelector('#ft-sub');
      const fillEl=root.querySelector('#ft-fill');
      if(countEl)countEl.textContent=fmtClock(remain);
      if(cur.status==='paused'){
        if(phaseEl)phaseEl.textContent='已暂停';
        if(subEl)subEl.textContent='点击「继续」恢复计时';
        return; // 暂停态不更新阶段/进度
      }
      const phaseTxt={wait:'即将开始断食',fast:'断食中 · 坚持一下下 💪',eat:'进食窗口已开启 🍽️ 好好吃饭',done:'本轮已完成 💗'}[c.phase];
      if(phaseEl)phaseEl.textContent={wait:'即将开始',fast:'断食时段',eat:'进食时段',done:'本轮完成'}[c.phase];
      if(subEl)subEl.textContent=(c.phase==='wait'?('距断食开始还有 '+fmtClock(remain)):(c.phase==='fast'?('距进食窗口开启还有 '+fmtClock(remain)):(c.phase==='eat'?('距下一轮断食还有 '+fmtClock(remain)):'今晚的断食圆满完成')));
      if(fillEl){
        const total=(c.phase==='fast')?(c.endMs-c.startMs):(c.phase==='eat'?(c.eatEndMs-c.endMs):(c.phase==='wait'?1:(c.eatEndMs-c.startMs)));
        const passed=total-remain;
        const pct=total>0?Math.max(0,Math.min(100,passed/total*100)):0;
        fillEl.style.width=pct.toFixed(1)+'%';
      }
    };
    tick();
    _timer=setInterval(tick,1000);
  }
  function mountTimer(root,sess){ startTick(root,sess); }

  /* 根据当前激活页面决定渲染目标（首页卡片 or 计时页） */
  function rerender(){
    const home=document.getElementById('page-home');
    if(home&&home.classList.contains('active')){ if(window.Home)Home.render(); }
    else render();
  }

  function togglePause(){
    const s=getSession();if(!s)return;
    if(s.status==='running'){s.status='paused';s.pausedAt=Date.now();}
    else if(s.status==='paused'){s.pausedTotal+=(Date.now()-(s.pausedAt||Date.now()));s.pausedAt=null;s.status='running';}
    save();rerender();
  }

  function achievedMin(sess,now){
    const c=compute(sess,now);
    if(c.phase==='wait')return 0;
    if(c.phase==='fast')return Math.max(0,(c.boundary-now)/60000);
    return c.durMin; // eat/done → 完成整段断食
  }

  function archive(status){
    const s=getSession();if(!s){stopTimer();return;}
    const now=Date.now();
    const ach=Math.round(achievedMin(s,now));
    const rec={id:s.id,date:s.date,fastStart:s.fastStart,fastEnd:s.fastEnd,startedAt:s.startedAt,endedAt:now,
      status:status||'ended',plannedFastingMin:960,achievedFastingMin:ach,
      pausedMin:Math.round((s.pausedTotal||0)/60000),note:''};
    S.get().fastingHistory.unshift(rec);
    S.get().fastingSession=null;save();stopTimer();
    if(status==='auto')UI.toast('新的一天啦，昨天的轻断食已自动归档 💗');
    rerender();
  }

  function endFast(){
    const s=getSession();if(!s)return;
    archive('ended'); // 直接终止，记录存入历史
  }

  function histMore(){
    UI.modal(`<div class="modal-title">轻断食历史</div>
      <button class="btn btn-ghost btn-block mt8" onclick="Fast.clearHistory();UI.close()">🗑 清空历史记录</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">取消</button>`);
  }
  function clearHistory(){
    S.get().fastingHistory=[];save();
    renderHistory();
    UI.toast('历史记录已清空');
  }

  /* ---------- 历史页 ---------- */
  function renderHistory(){
    stopTimer();
    const root=document.getElementById('page-fasthistory');
    if(!root)return;
    const list=S.get().fastingHistory||[];
    let rows='';
    if(!list.length){
      rows='<div class="empty">'+I.EMPTY.replace('width="120"','width="80"')+'<p>还没有轻断食记录</p><span class="small muted">从计划页点「开始断食」开启第一轮吧 💗</span></div>';
    }else{
      list.forEach(h=>{
        const statusMap={ended:'已结束',auto:'跨天归档',finished:'已完成'};
        const stCls={ended:'end',auto:'auto',finished:'fin'}[h.status]||'end';
        const done=h.achievedFastingMin>=480;
        const pct=Math.min(100,Math.round(h.achievedFastingMin/960*100));
        rows+=`<div class="card fast-hist-item">
          <div class="fhi-top"><b>${h.date}</b><span class="fhi-badge ${stCls}">${statusMap[h.status]||'已结束'}</span></div>
          <div class="fhi-range">${h.fastStart} 🌙 → ${h.fastEnd} 🍽️</div>
          <div class="fhi-bar"><div class="fhi-bar-fill ${done?'full':''}" style="width:${pct}%"></div></div>
          <div class="fhi-meta">
            <span>断食达成 <b>${fmtDur(h.achievedFastingMin)}</b> / 16 小时</span>
            ${h.pausedMin?('<span class="muted">暂停 '+fmtDur(h.pausedMin)+'</span>'):''}
          </div>
        </div>`;
      });
    }
    root.innerHTML=`<div class="page-pad">
      <div class="sv-detail-head">
        <button class="sv-back" onclick="Nav.go('fast')">${I.i('back')}</button>
        <div class="sv-detail-title">轻断食历史</div>
        <button class="sv-more" onclick="Fast.histMore()">${I.i('more')}</button>
      </div>
      ${rows}
      <button class="btn btn-ghost btn-block mt12" onclick="Nav.go('fast')">← 返回计划页</button>
    </div>`;
    I.upgrade(root);
  }

  window.Fast={render,renderHistory,startFast,pickStart,confirmStart,homeTimer,togglePause,endFast,archive,histMore,clearHistory,timerInner,mountTimer};
})();
