/* ============ 应用入口：导航 / 图表 / 手势 / 日期选择器 ============ */
(function(){
  const S=window.Store, I=window.Icon;
  let toastTimer=null;

  /* ---- UI 公共 ---- */
  const UI={
    toast(msg){
      const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
      clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1900);
    },
    modal(html){
      const r=document.getElementById('modal-root');
      r.innerHTML='<div class="modal-mask" onclick="UI.close()"></div><div class="modal">'+html+'</div>';
      r.classList.add('show');
      const m=r.querySelector('.modal');if(m)m.scrollTop=0;
      I.upgrade(r);
    },
    close(){const r=document.getElementById('modal-root');r.classList.remove('show');r.innerHTML='';},

    /* ====== 通用月视图日期选择器（可自由翻阅上下月 / 跨年） ====== */
    _dp:{ym:'',cur:'',cb:null,title:''},
    datePicker(current,cb,title){
      const cur=current||S.today();
      UI._dp={ym:cur.slice(0,7),cur:cur,cb:cb,title:title||'选择日期'};
      UI.modal(`
        <div class="modal-title">${UI._dp.title}</div>
        <div class="mp-head">
          <button onclick="UI.dpNav(-1)">‹</button>
          <div class="mp-t" id="dp-title"></div>
          <button class="today-btn${cur===S.today()?'':' go-today-pill'}" onclick="UI.dpPick('${S.today()}')">${cur===S.today()?'今天':'回到今天'}</button>
        </div>
        <div id="dp-body"></div>
        <div class="mp-quick">
          <button class="btn btn-ghost btn-sm" onclick="UI.dpNav(-12)">上一年</button>
          <button class="btn btn-ghost btn-sm" onclick="UI.dpPick('${S.today()}')">回到今天</button>
          <button class="btn btn-ghost btn-sm" onclick="UI.dpNav(12)">下一年</button>
        </div>
        <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">关闭</button>
      `);
      UI.dpRender();
    },
    dpNav(delta){
      const y=+UI._dp.ym.slice(0,4), m=+UI._dp.ym.slice(5,7);
      const d=new Date(y,m-1+delta,1);
      UI._dp.ym=d.getFullYear()+'-'+S.pad(d.getMonth()+1);
      UI.dpRender();
    },
    dpRender(){
      const box=document.getElementById('dp-body');if(!box)return;
      const ym=UI._dp.ym;
      const y=+ym.slice(0,4), m=+ym.slice(5,7);
      document.getElementById('dp-title').textContent=y+'年 '+m+'月';
      const startW=new Date(y,m-1,1).getDay();
      const dim=new Date(y,m,0).getDate();
      const prevDim=new Date(y,m-1,0).getDate();
      const wk=['日','一','二','三','四','五','六'];
      let head='';wk.forEach(w=>head+='<div class="cal-h">'+w+'</div>');
      let cells='';
      // 上月补位（可点击 → 直接跳到上个月那天）
      for(let i=startW-1;i>=0;i--){
        const pd=new Date(y,m-2,prevDim-i);
        const ds=pd.getFullYear()+'-'+S.pad(pd.getMonth()+1)+'-'+S.pad(pd.getDate());
        cells+='<div class="cal-cell other" onclick="UI.dpPick(\''+ds+'\')">'+(prevDim-i)+'</div>';
      }
      for(let i=1;i<=dim;i++){
        const ds=ym+'-'+S.pad(i);
        cells+='<div class="cal-cell'+(ds===UI._dp.cur?' sel':'')+(ds===S.today()?' today':'')+'" onclick="UI.dpPick(\''+ds+'\')">'+i+'</div>';
      }
      // 下月补位
      const rest=(7-((startW+dim)%7))%7;
      for(let i=1;i<=rest;i++){
        const nd=new Date(y,m,i);
        const ds=nd.getFullYear()+'-'+S.pad(nd.getMonth()+1)+'-'+S.pad(nd.getDate());
        cells+='<div class="cal-cell other" onclick="UI.dpPick(\''+ds+'\')">'+i+'</div>';
      }
      box.innerHTML='<div class="cal-wk">'+head+'</div><div class="cal-grid">'+cells+'</div>';
    },
    dpPick(ds){
      const cb=UI._dp.cb;UI.close();if(cb)cb(ds);
    },

    /* 左滑显示操作按钮。阈值放大到 14px，且只有真正拖动过才拦截点击，
       避免手指轻微抖动被误判成滑动、把这一次点击吃掉（导致「要点两次」） */
    swipe(el,onOpen,onClose){
      let sx=0,sy=0,drag=false,moved=false,cur=0,opened=false;
      el.style.transition='transform .22s ease';
      el.style.touchAction='pan-y';
      el.addEventListener('pointerdown',e=>{
        if(e.pointerType==='mouse'&&e.button!==0)return;
        sx=e.clientX;sy=e.clientY;drag=true;moved=false;cur=0;el.style.transition='none';
        try{el.setPointerCapture(e.pointerId);}catch(err){}
      });
      el.addEventListener('pointermove',e=>{
        if(!drag)return;
        const dx=e.clientX-sx,dy=e.clientY-sy;
        if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>14){drag=false;el.style.transition='transform .22s ease';el.style.transform=opened?'translateX(-120px)':'translateX(0)';return;} // 判定为纵向滚动，交还给页面
        if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>14){moved=true;cur=Math.max(-120,Math.min(0,dx));el.style.transform='translateX('+cur+'px)';}
      });
      const end=()=>{
        if(!drag)return;drag=false;el.style.transition='transform .22s ease';
        if(cur<-55){opened=true;el.style.transform='translateX(-120px)';onOpen&&onOpen();}
        else if(moved||opened){opened=false;el.style.transform='translateX(0)';onClose&&onClose();}
        // 只有真的拖动过才拦截紧随其后的 click，并且最多拦 250ms 就自动解除
        if(moved){
          const stop=ev=>{ev.stopPropagation();ev.preventDefault();off();};
          const off=()=>{document.removeEventListener('click',stop,true);clearTimeout(tm);};
          const tm=setTimeout(off,250);
          document.addEventListener('click',stop,true);
        }
        moved=false;cur=0;
      };
      el.addEventListener('pointerup',end);
      el.addEventListener('pointercancel',end);
    },
    lineChart(vals,labels){
      if(vals.length<2)return '';
      const W=320,H=140,pad=20;
      const min=Math.min(...vals),max=Math.max(...vals),span=(max-min)||1;
      const X=i=>pad+(W-2*pad)*i/(vals.length-1);
      const Y=v=>H-pad-(H-2*pad)*(v-min)/span;
      const pts=vals.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ');
      const dots=vals.map((v,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3.4" fill="#fff" stroke="#e86890" stroke-width="2"/>`).join('');
      return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" style="max-height:160px">
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e86890"/><stop offset="1" stop-color="#ffb3c2"/></linearGradient></defs>
        <polyline points="${pts}" fill="none" stroke="url(#lg)" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg></div>`;
    },
    pieChart(data){
      const total=data.reduce((s,d)=>s+d.value,0)||1;
      const cx=90,cy=90,r=64,colors=['#e86890','#ffb3c2','#ffd1a3','#b2e8bc','#cce0f8','#ffd9e3','#f8c8d8','#9ad0c2'];
      let ang=-Math.PI/2,a2,paths='';
      data.forEach((d,i)=>{const f=d.value/total;a2=ang+f*2*Math.PI;const x1=cx+r*Math.cos(ang),y1=cy+r*Math.sin(ang),x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2);const large=f>0.5?1:0;paths+=`<path d="M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${colors[i%colors.length]}" stroke="#fff" stroke-width="1.5"/>`;ang=a2;});
      const leg=data.map((d,i)=>`<div class="flex between" style="font-size:11.5px;margin-bottom:3px"><span><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${colors[i%colors.length]};margin-right:5px"></span>${d.label}</span><span class="muted">¥${d.value}</span></div>`).join('');
      return `<div class="flex gap12 center"><svg viewBox="0 0 180 180" style="width:130px;height:130px;flex-shrink:0">${paths}</svg><div style="flex:1">${leg}</div></div>`;
    },
    barChart(data,labels){
      const W=320,H=140,pad=18,bw=20,max=Math.max(...data,1);
      const gap=(W-2*pad-(bw*data.length))/(data.length+1);
      let bars='';
      data.forEach((v,i)=>{
        const h=(H-pad-20)*(v/max);
        const x=pad+gap*(i+1)+bw*i;
        const y=H-20-h;
        bars+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${Math.max(0,h).toFixed(1)}" rx="6" fill="${v>0?'url(#bg)':'#f7e6ec'}"/>`;
        if(v>0)bars+=`<text x="${(x+bw/2).toFixed(1)}" y="${(y-3).toFixed(1)}" font-size="8.5" fill="#886e78" text-anchor="middle">${v}</text>`;
        bars+=`<text x="${(x+bw/2).toFixed(1)}" y="${H-6}" font-size="8.5" fill="#886e78" text-anchor="middle">${labels[i]}</text>`;
      });
      return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" style="max-height:150px"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3c2"/><stop offset="1" stop-color="#e86890"/></linearGradient></defs>${bars}</svg></div>`;
    }
  };
  window.UI=UI;

  /* ---- 导航（底部 Tab） ---- */
  const Nav={
    go(page){
      document.querySelectorAll('.tab-item').forEach(t=>t.classList.toggle('active',t.dataset.page===page));
      document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));
      ({home:()=>Home.render(),todo:()=>Todo.render(),fatloss:()=>Fat.render(),food:()=>Food.render(),
        account:()=>Acc.render(),study:()=>Study.render(),travel:()=>Trav.render(),
        fast:()=>Fast.render(),fasthistory:()=>Fast.renderHistory()}[page]||(()=>{}))();
      I.upgrade(document.body); // 同步替换图标，避免 emoji 闪一帧
      const m=document.getElementById('main');if(m&&m.scrollIntoView)try{window.scrollTo(0,0);}catch(e){}
    }
  };
  window.Nav=Nav;

  /* ---- 头像 / 云端账号 ---- */
  function initAvatar(){
    const u=S.get().user;
    const img=document.getElementById('avatar-img');
    if(u.avatar)img.style.backgroundImage='url('+u.avatar+')';
    else img.innerHTML=I.i('flower');
    document.getElementById('avatar-btn').onclick=onAvatarClick;
    document.getElementById('avatar-input').onchange=onAvatarFile;
    S.cloud.on(refreshAvatarUI);
    refreshAvatarUI();
  }
  function onAvatarFile(e){
    const f=e.target.files[0];if(!f)return;
    const img=document.getElementById('avatar-img');
    const r=new FileReader();
    r.onload=ev=>{S.get().user.avatar=ev.target.result;S.save();img.innerHTML='';img.style.backgroundImage='url('+ev.target.result+')';UI.toast('头像已更新');};
    r.readAsDataURL(f);
  }
  function refreshAvatarUI(){
    const on=S.cloud.isOn();
    const btn=document.getElementById('avatar-btn');
    if(btn)btn.classList.toggle('synced',on);
  }
  function onAvatarClick(){
    if(S.cloud.isOn())openCloudMenu();
    else openLoginModal();
  }
  function openLoginModal(){
    UI.modal(`
      <div class="modal-title">☁️ 开启云端同步</div>
      <div class="small muted" style="margin-bottom:10px">设置一个「同步口令」（任意你记得住的词语，如 mumu2026）。电脑和手机输入<strong>同一个口令</strong>，数据就自动同步——无需邮箱、无需注册。</div>
      <div class="field"><label>同步口令</label><input id="login-pass" type="text" placeholder="例如 mumu2026" autocomplete="off"></div>
      <div class="flex gap8">
        <button class="btn btn-primary btn-block" onclick="App.connectCloud()">连接并同步</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>
      <div class="small muted mt8">⚠️ 口令即钥匙，请记牢；更换设备时输入同一口令即可取回数据。这是个人应用，靠口令保密。</div>
    `);
  }
  function openCloudMenu(){
    const fp=(S.cloud.key()||'').slice(0,8);
    UI.modal(`
      <div class="modal-title">☁️ 云端已同步</div>
      <div class="small muted" style="margin-bottom:10px">数据已实时备份到云端，每 1 分钟静默自动同步一次（不打扰你）。其他设备输入同一「同步口令」即可看到同一份工作台。</div>
      <div class="sync-fp">同步指纹：<b>${fp}</b><div class="small muted mt4">手机和电脑这里的指纹必须完全一致，否则说明两端用了不同口令（不会同步）。</div></div>
      <button class="btn btn-primary btn-block mt8" onclick="App.syncNow()">立即同步</button>
      <button class="btn btn-ghost btn-block mt8" onclick="App.reconnect()">重新输入口令 / 切换设备</button>
      <button class="btn btn-ghost btn-block mt8" onclick="App.changeAvatar()">更换头像</button>
      <button class="btn btn-ghost btn-block mt8" onclick="App.logoutCloud()">断开同步</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">关闭</button>
    `);
  }
  /* 已连接状态下想重新输入口令：先断开，再弹出口令框 */
  function reconnect(){
    S.cloud.disconnect();
    UI.close();
    openLoginModal();
  }
  /* 手动同步：保留提示弹窗（自动同步则完全静默） */
  function syncNow(){
    if(!S.cloud.isOn()){UI.toast('未连接云端');return;}
    UI.toast('正在同步…');
    S.cloud.push(false);      // 先把本地改动推上去
    S.cloud.refresh(false);   // 再拉云端最新
    setTimeout(()=>{UI.toast('同步完成 ☁️');if(window.Home)Home.render();},900);
  }
  function connectCloud(){
    const pass=document.getElementById('login-pass').value.trim();
    if(!pass){UI.toast('请输入同步口令');return;}
    UI.toast('正在连接云端…');
    S.cloud.connect(pass).then(()=>{
      UI.close();
      UI.toast('已连接云端，数据同步完成 ☁️');
      if(window.Home)Home.render();
    }).catch(e=>UI.toast('连接失败：'+(e&&e.message||e)));
  }
  function changeAvatar(){UI.close();document.getElementById('avatar-input').click();}
  function logoutCloud(){UI.close();S.cloud.disconnect();UI.toast('已断开云端同步');if(window.Home)Home.render();}

  /* ---- 食物识别图片 ---- */
  function initFood(){
    document.getElementById('food-input').onchange=e=>{
      const f=e.target.files[0];if(!f)return;
      const key=window._mealKey||'lunch';
      Fat.onFood(f,key);
      e.target.value='';
    };
  }

  /* ---- 初始化图标 ---- */
  function initIcons(){
    document.querySelectorAll('.tab-ico').forEach(el=>{el.innerHTML=I.ICON[el.dataset.ico]||'';});
    const bl=document.getElementById('brand-logo');
    if(bl)bl.innerHTML=I.i('flower');
  }

  /* ---- 图标自动升级：渲染后把 emoji 换成统一风格图标 ---- */
  function initIconObserver(){
    if(typeof MutationObserver==='undefined')return;
    // MutationObserver 回调本身在微任务里、绘制之前执行，直接同步替换即可（不会闪 emoji）
    let busy=false;
    const ob=new MutationObserver(()=>{
      if(busy)return;          // 防止 upgrade 自身写入 DOM 造成递归
      busy=true;
      try{I.upgrade(document.body);}finally{busy=false;}
    });
    ob.observe(document.body,{childList:true,subtree:true});
  }

  /* ---- 启动 ---- */
  function boot(){
    S.load();
    S.cloud.init();
    initIcons();initAvatar();initFood();
    if(window.Reading)Reading.ensureDaily(); // 每日自动抽取当日深度阅读
    Nav.go('home');
    I.upgrade(document.body);
    initIconObserver();
    // 经期提前提醒：启动即检查 + 每小时复检（跨过提醒时点也能弹窗）
    if(window.Period&&Period.checkReminder)Period.checkReminder();
    if(window.Period)setInterval(()=>{ if(window.Period)Period.checkReminder(); },60*60*1000);
    // 阅读板块：每小时检查一次，跨过早上 8 点时自动补抽当日文章
    if(window.Reading)setInterval(()=>{ if(window.Reading)Reading.ensureDaily(); },60*60*1000);
    // 切回页面时静默拉取云端最新数据（手机改完、电脑切回来即同步，不弹窗）
    document.addEventListener('visibilitychange',()=>{
      if(!document.hidden && S.cloud.isOn())S.cloud.refresh(true);
    });
  }
  if(document.readyState!=='loading')boot();
  else document.addEventListener('DOMContentLoaded',boot);

  window.App={boot,connectCloud,changeAvatar,logoutCloud,syncNow,reconnect};
})();
