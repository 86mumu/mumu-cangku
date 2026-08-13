/* ============ 英语学习模块（含音标+朗读+计时器） ============ */
(function(){
  const S=window.Store, I=window.Icon, AI=window.AI;
  const IV=[1,2,4,7,15,30];

  // 初中基础词汇库（带音标）
  const JUNIOR_WORDS = [
    {word:'apple',phonetic:'/ˈæpl/',mean:'苹果',level:1},
    {word:'book',phonetic:/bʊk/,mean:'书',level:1},
    {word:'cat',phonetic:'/kæt/',mean:'猫',level:1},
    {word:'dog',phonetic:'/dɔːɡ/',mean:'狗',level:1},
    {word:'egg',phonetic:'/eɡ/',mean:'蛋',level:1},
    {word:'fish',phonetic:'/fɪʃ/',mean:'鱼',level:1},
    {word:'girl',phonetic:'/ɡɜːl/',mean:'女孩',level:1},
    {word:'hand',phonetic:'/hænd/',mean:'手',level:1},
    {word:'ice',phonetic:'/aɪs/',mean:'冰',level:1},
    {word:'jump',phonetic:'/dʒʌmp/',mean:'跳',level:1},
    {word:'key',phonetic:'/kiː/',mean:'钥匙',level:1},
    {word:'love',phonetic:/lʌv/,mean:'爱',level:1},
    {word:'moon',phonetic:/muːn/,mean:'月亮',level:1},
    {word:'name',phonetic:/neɪm/,mean:'名字',level:1},
    {word:'open',phonetic:/ˈəʊpən/,mean:'打开',level:1},
    {word:'pen',phonetic:/pen/,mean:'钢笔',level:1},
    {word:'queen',phonetic:/kwiːn/,mean:'女王',level:1},
    {word:'rain',phonetic:/reɪn/,mean:'雨',level:1},
    {word:'sun',phonetic:/sʌn/,mean:'太阳',level:1},
    {word:'tree',phonetic:/triː/,mean:'树',level:1},
    {word:'use',phonetic:/juːz/,mean:'使用',level:1},
    {word:'very',phonetic:/ˈveri/,mean:'非常',level:1},
    {word:'water',phonetic:/ˈwɔːtə(r)/,mean:'水',level:1},
    {word:'year',phonetic:/jɪə(r)/,mean:'年',level:1},
    {word:'zero',phonetic:/ˈzɪərəʊ/,mean:'零',level:1},
    {word:'happy',phonetic:/ˈhæpi/,mean:'快乐的',level:2},
    {word:'family',phonetic:/ˈfæməli/,mean:'家庭',level:2},
    {word:'school',phonetic:/skuːl/,mean:'学校',level:2},
    {word:'friend',phonetic:/frend/,mean:'朋友',level:2},
    {word:'teacher',phonetic:/ˈtiːtʃə(r)/,mean:'老师',level:2},
    {word:'student',phonetic:/ˈstjuːdnt/,mean:'学生',level:2},
    {word:'morning',phonetic:/ˈmɔːnɪŋ/,mean:'早晨',level:2},
    {word:'afternoon',phonetic:/ˌɑːftəˈnuːn/,mean:'下午',level:2},
    {word:'evening',phonetic:/ˈiːvnɪŋ/,mean:'傍晚',level:2},
    {word:'breakfast',phonetic:/ˈbrekfəst/,mean:'早餐',level:2},
    {word:'lunch',phonetic:/lʌntʃ/,mean:'午餐',level:2},
    {word:'dinner',phonetic:/ˈdɪnə(r)/,mean:'晚餐',level:2},
    {word:'beautiful',phonetic:/ˈbjuːtɪfl/,mean:'美丽的',level:2},
    {word:'important',phonetic:/ɪmˈpɔːtnt/,mean:'重要的',level:2},
    {word:'different',phonetic:/ˈdɪfrənt/,mean:'不同的',level:2},
    {word:'together',phonetic:/təˈɡeðə(r)/,mean:'一起',level:2}
  ];

  function eng(){return S.get().english;}
  let timerInterval=null;
  let timerStart=0;
  let engRoot='page-english'; // 渲染目标容器（学习页子视图时为 study-english）
  let inBatch=false;          // 批量学习中：不弹达标弹窗，避免打断连续学习
  let hideMean=(function(){try{return localStorage.getItem('eng_hide_mean')==='1';}catch(e){return false;}})();

  function render(){
    const e=eng();const t=S.today();
    promotePool(); // 保证每日新词不超过目标数
    const allW=e.words;
    const total=allW.length;
    // 累计词汇：仅“认识”过的单词才计入（模糊/不认识不计入）
    const knownCount=allW.filter(w=>w.known===true).length;
    const learned=allW.filter(w=>w.status!=='new').length;
    const streak=e.checkins.length;
    // 计时器时长（手动计时，非自动累计）
    const timerMin=e.timerMin||0;

    // 今日新词：只显示今天引入的、还没学的那些（学会一个就少一个，不再补新词）
    const newW=allW.filter(w=>w.learnDate===t&&w.status==='new');
    const learnedToday=allW.filter(w=>w.learnDate===t&&w.status!=='new').length;
    const target=todayTarget();
    const goalDone=learnedToday>=target;
    const prog=Math.min(100,Math.round(learnedToday/Math.max(1,target)*100));

    const reviewW=allW.filter(w=>w.status!=='known'&&(w.reviews||[]).includes(t)&&w.learnDate!==t);

    const isTimerOn=timerInterval!==null;

    let html=`
      <div class="stat-row">
        <div class="stat tap" onclick="Eng.wordList('known')"><div class="emoji">📚</div><div class="num">${knownCount}</div><div class="lbl">累计词汇 ›</div></div>
        <div class="stat tap" onclick="Eng.wordList('learned')"><div class="emoji">🔁</div><div class="num">${learned}</div><div class="lbl">已掌握 ›</div></div>
        <div class="stat"><div class="emoji">🔥</div><div class="num">${streak}</div><div class="lbl">连续学习</div></div>
        <div class="stat"><div class="emoji">⏱️</div><div class="num">${timerMin}'</div><div class="lbl">学习时长</div></div>
      </div>

      <!-- 计时器 -->
      <div style="text-align:center;margin-bottom:12px">
        <button class="timer-btn ${isTimerOn?'on':''}" onclick="Eng.toggleTimer()">
          ${isTimerOn?'⏸ 暂停计时':'▶ 开始学习计时'}
        </button>
        ${isTimerOn?'<div class="small muted mt8" id="timer-live">已学习 <span id="timer-sec">0</span> 秒</div>':''}
      </div>

      <!-- 今日新词：数量 = 你选的目标，学会一个消失一个 -->
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🌸</span>今日新词</div>
          <div class="flex gap8" style="align-items:center">
            <span class="pill pill-btn ${hideMean?'on':''}" onclick="Eng.toggleMean()">${hideMean?'🙈 翻译已隐藏':'👀 隐藏翻译'}</span>
            <span class="pill">${learnedToday}/${target}</span>
          </div></div>

        <div class="goal-pick">
          <span class="small muted" style="flex-shrink:0">今日目标</span>
          ${[5,10,15,20].map(n=>`<span class="gp-chip ${e.goal===n?'on':''}" onclick="Eng.pickGoal(${n})">${n} 个</span>`).join('')}
          <span class="gp-chip ${[5,10,15,20].indexOf(e.goal)<0?'on':''}" onclick="Eng.setGoal()">自定义${[5,10,15,20].indexOf(e.goal)<0?' · '+e.goal:''}</span>
        </div>

        <div class="stat" style="background:var(--grad-soft);box-shadow:none;margin:10px 0">
          <div class="num" style="font-size:20px">${learnedToday}<span style="font-size:13px;color:var(--text2)"> / ${target}</span></div>
          <div class="lbl">已完成目标进度 ${prog}%</div>
        </div>

        ${goalDone?cheerCard(learnedToday,target)
          :(newW.length?`<div>${newW.map((w,idx)=>wordCard(w,idx)).join('')}</div>`
            :'<div class="empty">'+I.EMPTY.replace('width="120"','width="70"')+'<p>今天的词都学完啦，明天再来新词 💗</p></div>')}

        <div class="flex gap8 mt12">
          <button class="btn btn-primary btn-block" onclick="Eng.batchStudy()">批量学习未掌握</button>
          <button class="btn btn-ghost btn-block" onclick="Eng.detail()">查词详情</button>
        </div>
      </div>

      ${phoneCard()}

      ${grammarCard()}

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🔁</span>复习</div>
          <span class="pill">待复习 ${reviewW.length}</span></div>
        ${reviewW.length?`<div class="tag-row">${reviewW.map(w=>`<span class="tag" onclick="Eng.study('${w.id}')">${w.word} ✎</span>`).join('')}</div>`
          :`<div class="empty">${I.EMPTY.replace('width="120"','width="70"')}<p>今天没有待复习的词，轻松一下～<br>遗忘间隔：1‑2‑4‑7‑15‑30 天 🌿</p></div>`}
        <div class="small muted mt8">遗忘间隔：1‑2‑4‑7‑15‑30 天（按记忆曲线温柔提醒）</div>
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">📅</span>打卡日历</div></div>
        ${checkinCal()}
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">🤖</span>AI 学习简报</div></div>
        <button class="btn btn-primary btn-block" onclick="Eng.genBrief()">✨ 生成周简报</button>
      </div>
    `;
    const rootEl=document.getElementById(engRoot);
    if(!rootEl)return;
    rootEl.innerHTML=html;

    // 更新实时计时显示
    if(isTimerOn){
      const el=document.getElementById('timer-sec');
      if(el)el.textContent=Math.floor((Date.now()-timerStart)/1000);
    }
  }

  /* ---------- 搭配词库 ---------- */
  function collocOf(word){
    const bank=window.WORD_COLLOC||{};
    const k=(word||'').toLowerCase();
    const arr=bank[k]||bank[word]||[];
    return Array.isArray(arr)?arr:[];
  }

  /* 从「英文搭配 + 中文意思」里取出可朗读的英文部分 */
  function collocEn(s){
    const t=String(s||'');
    const m=t.match(/^[^\u4e00-\u9fa5]+/);
    return (m?m[0]:t).replace(/[·…]/g,' ').trim()||t;
  }
  /* 一条搭配（带朗读按钮） */
  function clRow(c){
    const en=collocEn(c);
    return `<div class="wc-cl"><span class="wc-cl-t">🌿 ${esc(c)}</span>`+
      `<button class="wc-cl-sp" title="朗读搭配" onclick="event.stopPropagation();Eng.speak('${esc(en)}')">🔊</button></div>`;
  }
  /* 依次朗读一个词的全部搭配 */
  function speakColloc(word){
    const cl=collocOf(word);
    if(!cl.length){UI.toast('这个词还没有收录搭配～');return;}
    let i=0;
    const next=()=>{ if(i>=cl.length)return; speak(collocEn(cl[i])); i++; setTimeout(next,1700); };
    next();
  }

  /* 单词卡片：正面单词 / 背面搭配，点击整卡翻转；释义可点击隐藏 */
  function wordCard(w,idx){
    const cl=collocOf(w.word);
    const masked=hideMean?' masked':'';
    const back=cl.length
      ? `<div class="wc-colloc">${cl.map(clRow).join('')}</div>
         <button class="btn btn-ghost btn-sm btn-block mt8" onclick="event.stopPropagation();Eng.speakColloc('${esc(w.word)}')">🔊 连读全部搭配</button>`
      : `<div class="wc-cl muted">这个词还没有收录搭配～<br>先记住它的意思吧 💗</div>`;
    return `<div class="word-card" data-id="${w.id}" id="wc-${w.id}" onclick="Eng.flip('${w.id}')">
      <div class="wc-inner">
        <div class="wc-face wc-front">
          <div class="w-main">
            <div class="w-word">${esc(w.word)}</div>
            <div class="w-phonetic">${esc(String(w.phonetic||''))}</div>
            <div class="w-mean${masked}" onclick="event.stopPropagation();Eng.toggleOne(this)">${esc(w.mean)}</div>
          </div>
          <div class="w-actions">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();Eng.speak('${esc(w.word)}')" title="朗读音标">🔊</button>
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();Eng.study('${w.id}')">学</button>
          </div>
          <div class="wc-hint">轻点卡片看搭配 ${cl.length?'· '+cl.length+' 条':''} ↻</div>
        </div>
        <div class="wc-face wc-back">
          <div class="wc-back-h">${esc(w.word)} 的常见搭配</div>
          ${back}
          <div class="wc-hint">再点一下翻回来 ↺</div>
        </div>
      </div>
    </div>`;
  }

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

  /* 翻转卡片 */
  function flip(id){
    const el=document.getElementById('wc-'+id);
    if(el)el.classList.toggle('flipped');
  }

  /* 隐藏 / 显示翻译 */
  function toggleOne(el){ if(el)el.classList.toggle('masked'); }
  function toggleMean(){
    hideMean=!hideMean;
    try{localStorage.setItem('eng_hide_mean',hideMean?'1':'0');}catch(e){}
    render();
    UI.toast(hideMean?'翻译已隐藏，点一下就能看 🙈':'翻译已显示 👀');
  }

  /* ---------- 朗读：Web Speech API + 在线发音兜底 ---------- */
  let _voices=[];
  function loadVoices(){
    try{ _voices=window.speechSynthesis.getVoices()||[]; }catch(e){ _voices=[]; }
    return _voices;
  }
  if('speechSynthesis' in window){
    loadVoices();
    try{ window.speechSynthesis.onvoiceschanged=loadVoices; }catch(e){}
  }
  function pickVoice(){
    const vs=_voices.length?_voices:loadVoices();
    if(!vs.length)return null;
    return vs.find(v=>/^en[-_]US/i.test(v.lang))
        || vs.find(v=>/^en[-_]GB/i.test(v.lang))
        || vs.find(v=>/^en/i.test(v.lang))
        || null;
  }
  /* 在线发音兜底（有道词典发音接口） */
  function speakOnline(word,silentFail){
    try{
      const a=new Audio('https://dict.youdao.com/dictvoice?type=2&audio='+encodeURIComponent(word));
      a.play().catch(()=>{ if(!silentFail)UI.toast('这个词暂时读不出来，检查下网络呀 🥲'); });
    }catch(e){ if(!silentFail)UI.toast('这个词暂时读不出来 🥲'); }
  }
  function speak(word){
    if(!word)return;
    const w=String(word).replace(/&#39;/g,"'");
    if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined'){
      speakOnline(w);return;
    }
    try{
      const syn=window.speechSynthesis;
      syn.cancel();
      if(syn.paused){try{syn.resume();}catch(e){}}
      const u=new SpeechSynthesisUtterance(w);
      const v=pickVoice();
      if(v){u.voice=v;u.lang=v.lang;}else{u.lang='en-US';}
      u.rate=0.85; u.pitch=1.1; u.volume=1;
      let done=false;
      u.onstart=()=>{done=true;};
      u.onerror=()=>{ if(!done)speakOnline(w,true); };
      syn.speak(u);
      // 部分内嵌浏览器 speak() 无声且不报错：700ms 内没开口就走在线兜底
      setTimeout(()=>{ if(!done&&!syn.speaking){ speakOnline(w,true); } },700);
    }catch(e){ speakOnline(w); }
  }

  /* ---------- 每日语法小灶 ---------- */
  function tips(){ return window.GRAMMAR_TIPS||[]; }
  function todayTip(){
    const e=eng();const t=S.today();const L=tips();
    if(!L.length)return null;
    if(e.grammarDate!==t){
      e.grammarDate=t;
      e.grammarIdx=(typeof e.grammarIdx==='number'?e.grammarIdx+1:0)%L.length;
      S.save();
    }
    const i=((e.grammarIdx%L.length)+L.length)%L.length;
    return L[i];
  }
  function grammarCard(){
    const e=eng();const t=S.today();const tip=todayTip();
    if(!tip)return '';
    const done=(e.grammarDone||[]).includes(t);
    return `<div class="card grammar-card">
      <div class="card-h"><div class="l"><span class="ico">🍳</span>每日语法小灶</div>
        <span class="pill">已学 ${(e.grammarDone||[]).length} 天</span></div>
      <div class="gm-title">${esc(tip.title)}</div>
      <div class="gm-body">${esc(tip.body)}</div>
      <div class="flex gap8 mt12">
        <button class="btn ${done?'btn-ghost':'btn-primary'} btn-block" onclick="Eng.grammarDone()">${done?'今天已学会 ✅':'学会了 ✅'}</button>
        <button class="btn btn-ghost btn-block" onclick="Eng.nextTip()">换一条 🔄</button>
      </div>
      <div class="small muted mt8">共 ${tips().length} 条小技巧，每天自动轮换一条 🌿</div>
    </div>`;
  }
  /* ================= 每日音标（每天 5 个 · 48 个全表可查） ================= */
  function phoneBank(){return window.PHONETICS||[];}
  /* 今天该学哪 5 个：按日期自动往后轮换，学完一轮从头开始 */
  function todayPhones(){
    const L=phoneBank();if(!L.length)return [];
    const e=eng();const t=S.today();
    if(e.phoneDate!==t){
      if(e.phoneDate)e.phoneIdx=((e.phoneIdx||0)+5)%L.length; // 换新的一天 → 往后推 5 个
      e.phoneDate=t;
      if(typeof e.phoneIdx!=='number')e.phoneIdx=0;
      S.save();
    }
    const start=(e.phoneIdx||0)%L.length;
    const out=[];for(let i=0;i<5;i++)out.push(L[(start+i)%L.length]);
    return out;
  }
  function phoneCard(){
    const L=phoneBank();if(!L.length)return '';
    const e=eng();const t=S.today();
    const list=todayPhones();
    const done=(e.phoneDone||[]).includes(t);
    const round=Math.floor((e.phoneIdx||0)/5)+1;
    return `<div class="card">
      <div class="card-h"><div class="l"><span class="ico">🔤</span>每日音标 · 5 个</div>
        <span class="pill">第 ${round}/${Math.ceil(L.length/5)} 组 · 已学 ${(e.phoneDone||[]).length} 天</span></div>
      <div class="ph-list">
        ${list.map(p=>phoneRow(p)).join('')}
      </div>
      <div class="flex gap8 mt12">
        <button class="btn ${done?'btn-ghost':'btn-primary'} btn-block" onclick="Eng.phoneDone()">${done?'今天已学会 ✅':'学会了 ✅'}</button>
        <button class="btn btn-ghost btn-block" onclick="Eng.nextPhones()">换一组 🔄</button>
      </div>
      <button class="btn btn-ghost btn-block mt8" onclick="Eng.allPhones()">📋 查看全部 ${L.length} 个音标</button>
      <div class="small muted mt8">国际音标共 48 个（20 元音 + 28 辅音），每天 5 个，约 10 天走完一轮 🌿</div>
    </div>`;
  }
  function phoneRow(p){
    const key=esc(p.p);
    return `<div class="ph-row">
      <div class="ph-h">
        <span class="ph-sym">${key}</span>
        <span class="ph-t">${esc(p.t)}</span>
        <button class="wc-cl-sp" title="朗读音标" onclick="Eng.speakPhone('${key}',false)">🔊</button>
      </div>
      <div class="ph-tip">💡 ${esc(p.tip)}</div>
      <div class="ph-sim">🈶 近似：${esc(p.sim)}</div>
      <div class="ph-ex">${(p.ex||[]).map(x=>
        `<span class="ph-word" onclick="Eng.speak('${esc(x.w)}')">${esc(x.w)} <i>${esc(x.ph)}</i> <b>${esc(x.m)}</b> 🔊</span>`
      ).join('')}</div>
    </div>`;
  }
  /* 朗读某个音标的例词：all=false 只读第一个（快速听音标），all=true 依次读全部 */
  function speakPhone(sym,all){
    const p=phoneBank().find(x=>x.p===sym);
    if(!p||!p.ex||!p.ex.length){UI.toast('没找到这个音标的例词');return;}
    if(!all){ speak(p.ex[0].w); return; }
    let i=0;
    const next=()=>{ if(i>=p.ex.length)return; speak(p.ex[i].w); i++; setTimeout(next,1300); };
    next();
  }
  function nextPhones(){
    const L=phoneBank();if(!L.length)return;
    const e=eng();
    e.phoneIdx=((e.phoneIdx||0)+5)%L.length;
    e.phoneDate=S.today();
    S.save();render();UI.toast('换一组音标啦 🔤');
  }
  function phoneDone(){
    const e=eng();const t=S.today();
    e.phoneDone=e.phoneDone||[];
    if(e.phoneDone.includes(t)){UI.toast('今天的音标已经学过啦 🌸');return;}
    e.phoneDone.push(t);
    if(!e.checkins.includes(t))e.checkins.push(t);
    S.save();render();UI.toast('音标 +5，发音会越来越准 💗');
  }
  /* 全部 48 个音标（按元音 / 辅音分组） */
  let _phFilter='all';
  function allPhones(f){
    _phFilter=f||_phFilter||'all';
    const L=phoneBank();
    const vowels=L.filter(x=>x.t.indexOf('元音')===0);
    const cons=L.filter(x=>x.t.indexOf('元音')!==0);
    const show=_phFilter==='vowel'?vowels:(_phFilter==='cons'?cons:L);
    let html='<div class="modal-title">🔤 国际音标全表（'+L.length+'）</div>';
    html+='<div class="subtabs" style="margin-bottom:8px">'
      +'<button class="subtab'+(_phFilter==='all'?' on':'')+'" onclick="Eng.allPhones(\'all\')">全部 '+L.length+'</button>'
      +'<button class="subtab'+(_phFilter==='vowel'?' on':'')+'" onclick="Eng.allPhones(\'vowel\')">元音 '+vowels.length+'</button>'
      +'<button class="subtab'+(_phFilter==='cons'?' on':'')+'" onclick="Eng.allPhones(\'cons\')">辅音 '+cons.length+'</button>'
      +'</div>';
    html+='<div class="small muted" style="margin-bottom:8px">点音标听例词发音，点例词单独朗读。</div>';
    html+='<div class="ph-all">'+show.map(p=>phoneRow(p)).join('')+'</div>';
    html+='<button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>';
    UI.modal(html);
  }

  function nextTip(){
    const e=eng();const L=tips();if(!L.length)return;
    e.grammarIdx=((e.grammarIdx||0)+1)%L.length;
    e.grammarDate=S.today();
    S.save();render();
  }
  function grammarDone(){
    const e=eng();const t=S.today();
    e.grammarDone=e.grammarDone||[];
    if(e.grammarDone.includes(t)){UI.toast('今天已经学过啦 🌸');return;}
    e.grammarDone.push(t);
    if(!e.checkins.includes(t))e.checkins.push(t);
    S.save();render();UI.toast('语法 +1，真棒 💗');
  }

  /* ---- 计时器 ---- */
  function toggleTimer(){
    if(timerInterval){
      // 停止
      clearInterval(timerInterval);
      timerInterval=null;
      const elapsed=Math.floor((Date.now()-timerStart)/1000);
      eng().timerMin=(eng().timerMin||0)+Math.floor(elapsed/60);
      S.save();
      render();
    }else{
      // 开始
      timerStart=Date.now();
      timerInterval=setInterval(()=>{
        const el=document.getElementById('timer-sec');
        if(el)el.textContent=Math.floor((Date.now()-timerStart)/1000);
      },1000);
      render();
    }
  }

  function checkinCal(){
    const e=eng();const t=S.today();
    const ym=t.slice(0,7);
    const set=new Set(e.checkins.filter(d=>d.slice(0,7)===ym));
    const startW=S.weekday(ym+'-01');
    const dim=new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();
    let cells='';const wk=['日','一','二','三','四','五','六'];
    let head='';wk.forEach(w=>head+='<div class="cal-h">'+w+'</div>');
    for(let i=0;i<startW;i++)cells+='<div class="cal-cell empty"></div>';
    for(let i=1;i<=dim;i++){const ds=ym+'-'+S.pad(i);const on=set.has(ds);cells+='<div class="cal-cell '+(on?'sel':'')+(ds===t?' today':'')+'">'+i+'</div>';}
    return '<div class="cal-wk">'+head+'</div><div class="cal-grid">'+cells+'</div>';
  }

  function study(id){
    const w=eng().words.find(x=>x.id===id);if(!w)return;
    const cl=collocOf(w.word);
    UI.modal(`<div class="modal-title">学习 · ${esc(w.word)}</div>
      <div class="card" style="box-shadow:none;text-align:center">
        <div style="font-size:24px;font-weight:700">${esc(w.word)}</div>
        <div style="font-size:16px;color:var(--pink);margin-top:4px">${esc(String(w.phonetic||''))}</div>
        <div class="muted${hideMean?' masked':''}" style="margin-top:6px;font-size:16px" onclick="Eng.toggleOne(this)">${esc(w.mean)}</div>
      </div>
      ${cl.length?`<div class="wc-colloc" style="margin-bottom:10px">${cl.map(clRow).join('')}</div>`:''}
      <div style="text-align:center;margin-bottom:10px" class="flex gap8">
        <button class="btn btn-ghost btn-block btn-sm" onclick="event.stopPropagation();Eng.speak('${esc(w.word)}')">🔊 听发音</button>
        ${cl.length?`<button class="btn btn-ghost btn-block btn-sm" onclick="event.stopPropagation();Eng.speakColloc('${esc(w.word)}')">🔊 读搭配</button>`:''}
      </div>
      <div class="small muted" style="text-align:center;margin-bottom:10px">${w.status==='new'?'新词 · 学完计入今日目标':'复习词 · 按记忆曲线安排下次'}</div>
      <div class="flex gap8">
        <button class="btn btn-ghost btn-block" style="background:var(--success);color:#2f6b3c" onclick="Eng.answer('${id}','known')">认识 😊</button>
        <button class="btn btn-ghost btn-block" onclick="Eng.answer('${id}','fuzzy')">模糊 🤔</button>
        <button class="btn btn-ghost btn-block" style="background:var(--warn);color:var(--pink)" onclick="Eng.answer('${id}','unknown')">不认识 😣</button>
      </div>`);
  }

  function answer(id,res){
    const e=eng();const w=e.words.find(x=>x.id===id);if(!w)return;
    const t=S.today();
    w.stage=w.stage||0;
    if(res==='known'){w.stage=Math.min(IV.length-1,w.stage+1);w.status='learning';w.known=true;}
    else if(res==='fuzzy'){w.stage=Math.max(0,w.stage-1);w.status='learning';w.known=false;
      // 模糊：明天再次出现，反复巩固直到“认识”
      w.reviews=w.reviews||[];const nx=S.addDays(t,1);if(!w.reviews.includes(nx))w.reviews.push(nx);}
    else {w.stage=0;w.status='learning';w.known=false;}
    if(w.stage>=IV.length-1&&res==='known'){w.status='known';}
    w.reviews=w.reviews||[];
    if(res!=='fuzzy'){ // 认识/不认识 走记忆曲线；模糊单独安排明天
      const next=S.addDays(t,IV[w.stage]);
      if(!w.reviews.includes(next))w.reviews.push(next);
    }
    if(!e.checkins.includes(t))e.checkins.push(t);
    S.save();UI.close();render();
    /* 刚好达成今日目标 → 弹一句鼓励 */
    const doneNow=e.words.filter(x=>x.learnDate===t&&x.status!=='new').length;
    const target=todayTarget();
    if(doneNow>=target&&e.cheerDate!==t&&!inBatch){
      e.cheerDate=t;S.save();
      const msg=CHEERS[hashNum(t)%CHEERS.length];
      UI.modal(`<div class="cheer-modal">
        <div class="cheer-emo" style="font-size:46px">🎉</div>
        <div class="modal-title" style="text-align:center;margin:6px 0">今日目标达成！</div>
        <div class="small" style="text-align:center;line-height:1.7;color:var(--text2)">
          今天学会了 <b style="color:var(--pink)">${doneNow}</b> 个单词，完成了 ${target} 个的小目标 🌸<br>${msg}
        </div>
        <button class="btn btn-primary btn-block mt12" onclick="UI.close()">收下鼓励 💗</button>
        <button class="btn btn-ghost btn-block mt8" onclick="UI.close();Eng.moreWords(5)">还想再学 5 个</button>
      </div>`);
    }else{
      UI.toast(res==='known'?'记牢啦 💗':res==='fuzzy'?'明天还会见到它，多温习几次':'后天再见它～');
    }
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
  }

  function batchStudy(){
    const e=eng();const t=S.today();
    /* 只批量学「今日引入的新词」和「今天该复习的词」，不越界拉未来的词 */
    const list=e.words.filter(w=>w.status!=='known'&&((w.status==='new'&&w.learnDate===t)||(w.reviews||[]).includes(t)));
    if(!list.length){UI.toast('没有待学/待复习的词');return;}
    let i=0;
    inBatch=true;
    const step=()=>{
      if(i>=list.length){
        inBatch=false;UI.close();render();
        const done=eng().words.filter(x=>x.learnDate===S.today()&&x.status!=='new').length;
        const tg=todayTarget();
        if(done>=tg&&eng().cheerDate!==S.today()){
          eng().cheerDate=S.today();S.save();
          UI.modal('<div class="cheer-modal"><div class="cheer-emo" style="font-size:46px">🎉</div>'
            +'<div class="modal-title" style="text-align:center;margin:6px 0">今日目标达成！</div>'
            +'<div class="small" style="text-align:center;line-height:1.7;color:var(--text2)">今天学会了 <b style="color:var(--pink)">'+done+'</b> 个单词 🌸<br>'
            +CHEERS[hashNum(S.today())%CHEERS.length]+'</div>'
            +'<button class="btn btn-primary btn-block mt12" onclick="UI.close()">收下鼓励 💗</button></div>');
        }else UI.toast('这批学完啦 🌸');
        return;
      }
      const w=list[i++];
      const cl=collocOf(w.word);
      UI.modal(`<div class="modal-title">学习 ${i}/${list.length} · ${esc(w.word)}</div>
        <div class="card" style="box-shadow:none;text-align:center">
          <div style="font-size:22px;font-weight:700">${esc(w.word)}</div>
          <div style="font-size:14px;color:var(--pink);margin-top:3px">${esc(String(w.phonetic||''))}</div>
          <div class="muted${hideMean?' masked':''}" style="margin-top:4px" onclick="Eng.toggleOne(this)">${esc(w.mean)}</div>
        </div>
        ${cl.length?`<div class="wc-colloc" style="margin-bottom:8px">${cl.slice(0,2).map(clRow).join('')}</div>`:''}
        <div class="flex gap8" style="margin-bottom:8px">
          <button class="btn btn-ghost btn-block btn-sm" onclick="event.stopPropagation();Eng.speak('${esc(w.word)}')">🔊 单词</button>
          ${cl.length?`<button class="btn btn-ghost btn-block btn-sm" onclick="event.stopPropagation();Eng.speakColloc('${esc(w.word)}')">🔊 搭配</button>`:''}
        </div>
        <div class="flex gap8">
          <button class="btn btn-ghost btn-block" style="background:var(--success);color:#2f6b3c" onclick="Eng.answer('${w.id}','known');Eng._batch()">认识</button>
          <button class="btn btn-ghost btn-block" onclick="Eng.answer('${w.id}','fuzzy');Eng._batch()">模糊</button>
          <button class="btn btn-ghost btn-block" style="background:var(--warn);color:var(--pink)" onclick="Eng.answer('${w.id}','unknown');Eng._batch()">不认识</button>
        </div>`);
    };
    window.Eng._batch=step;
    step();
  }

  function detail(){
    const e=eng();
    const goal=todayTarget();
    // 今日待学 = 今天引入且还没学的词（学会即移出）
    const newW=e.words.filter(w=>w.learnDate===S.today()&&w.status==='new');
    const newCount=newW.length;
    const learning=e.words.filter(w=>w.status!=='new'&&w.known!==true);
    const known=e.words.filter(w=>w.known===true);
    let html='<div class="modal-title">📖 词库详情</div>';
    html+='<div class="small muted" style="margin-bottom:8px">今日新词目标 '+goal+' 个 · 词库共 '+e.words.length+' 词 · 累计掌握 '+known.length+'</div>';
    html+='<div class="small" style="font-weight:600;margin:10px 0 4px">待学（'+newCount+'）</div>';
    html+='<div class="tag-row">'+(newW.slice(0,goal).map(w=>`<span class="tag">${w.word} <small style="opacity:.6">${w.phonetic||''}</small></span>`).join('')||'<span class="small muted">暂无</span>')+'</div>';
    html+='<div class="small" style="font-weight:600;margin:12px 0 4px">复习中（'+learning.length+'）</div>';
    html+='<div class="tag-row">'+(learning.map(w=>`<span class="tag">${w.word}</span>`).join('')||'<span class="small muted">暂无</span>')+'</div>';
    html+='<div class="small" style="font-weight:600;margin:12px 0 4px">已掌握（'+known.length+'）</div>';
    html+='<div class="tag-row">'+(known.map(w=>`<span class="tag">${w.word}</span>`).join('')||'<span class="small muted">暂无</span>')+'</div>';
    html+='<button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>';
    UI.modal(html);
  }

  /* ---------- 词汇清单：点「累计词汇 / 已掌握」卡片打开 ---------- */
  let _wlType='known';
  function wordList(type){
    _wlType=type||'known';
    const e=eng();
    const isKnown=_wlType==='known';
    const list=(isKnown
      ? e.words.filter(w=>w.known===true)
      : e.words.filter(w=>w.status!=='new')
    ).slice().sort((a,b)=>String(a.word).localeCompare(String(b.word)));
    const title=isKnown?'📚 累计词汇':'🔁 已掌握词汇';
    const desc=isKnown
      ? '这些是你答过「认识」的词，真正记住的部分 💗'
      : '这些是学过（认识 / 模糊 / 不认识都算）并进入复习曲线的词。';
    let html='<div class="modal-title">'+title+'（'+list.length+'）</div>';
    html+='<div class="subtabs" style="margin-bottom:8px">'
      +'<button class="subtab'+(isKnown?' on':'')+'" onclick="Eng.wordList(\'known\')">📚 累计 '+e.words.filter(w=>w.known===true).length+'</button>'
      +'<button class="subtab'+(!isKnown?' on':'')+'" onclick="Eng.wordList(\'learned\')">🔁 已掌握 '+e.words.filter(w=>w.status!=='new').length+'</button>'
      +'</div>';
    html+='<div class="small muted" style="margin-bottom:8px">'+desc+'</div>';
    if(!list.length){
      html+='<div class="empty">'+I.EMPTY.replace('width="120"','width="70"')+'<p>这里还是空的，去学几个词吧 🌿</p></div>';
    }else{
      html+='<div class="wl-box">'+list.map(w=>{
        const st=w.known===true?'认识':(w.status==='fuzzy'?'模糊':(w.status==='unknown'?'不认识':(w.status==='known'?'认识':'学习中')));
        const stc=w.known===true?'#5faa74':(w.status==='unknown'?'#e06a80':'#e2a13c');
        return '<div class="wl-row">'
          +'<div class="wl-l"><div class="wl-w">'+esc(w.word)+'</div>'
          +'<div class="wl-m">'+esc(String(w.phonetic||''))+(w.phonetic?' · ':'')+esc(w.mean)+'</div></div>'
          +'<span class="wl-st" style="color:'+stc+'">'+st+'</span>'
          +'<button class="wc-cl-sp" title="朗读" onclick="Eng.speak(\''+esc(w.word)+'\')">🔊</button>'
          +'<button class="wc-cl-sp" title="再学一次" onclick="UI.close();Eng.study(\''+w.id+'\')">✎</button>'
        +'</div>';
      }).join('')+'</div>';
    }
    html+='<button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>';
    UI.modal(html);
  }

  function addWord(){
    UI.modal(`<div class="modal-title">添加单词</div>
      <div class="field"><label>单词</label><input id="ew" placeholder="如 blossom"></div>
      <div class="field"><label>音标</label><input id="ep" placeholder="如 /ˈblɒsəm/" value=""></div>
      <div class="field"><label>释义</label><input id="em" placeholder="如 开花；繁荣"></div>
      <div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Eng.saveWord()">加入今日</button><button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>`);
  }
  function saveWord(){
    const word=document.getElementById('ew').value.trim();
    const phonetic=document.getElementById('ep').value.trim();
    const mean=document.getElementById('em').value.trim();
    if(!word){UI.toast('填个单词吧');return;}
    eng().words.push({id:S.uid(),word,phonetic,mean,status:'new',reviews:[],learnDate:S.today(),stage:0});
    S.save();UI.close();render();UI.toast('已添加 📚');
  }
  function setGoal(){
    UI.modal('<div class="modal-title">自定义每日单词目标</div>'
      +'<div class="small muted" style="margin-bottom:8px">选几个就出几张卡片，学会一个就消失一个，不会再冒新词～</div>'
      +'<div class="field"><label>每天想学几个（1~100）</label><input id="eg" type="number" min="1" max="100" value="'+eng().goal+'"></div>'
      +'<div class="flex gap8"><button class="btn btn-primary btn-block" onclick="Eng.saveGoal()">保存</button>'
      +'<button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>');
  }
  function saveGoal(){
    const v=+document.getElementById('eg').value;
    if(v){eng().goal=Math.max(1,Math.min(100,v));eng().bonus=0;eng().bonusDate='';S.save();}
    UI.close();promotePool();render();
    UI.toast('今日目标：'+eng().goal+' 个 ✨');
  }
  function switchBook(){
    const books=['初中基础词汇','日常口语800','四六级高频','旅行英语'];
    UI.modal('<div class="modal-title">切换词书</div><div class="chips">'+books.map(b=>`<div class="chip ${eng().book===b?'on':''}" onclick="Eng.pickBook('${b}')">${b}</div>`).join('')+'</div><div class="small muted mt8">切换只改标题，词库共享哦～</div>');
  }
  function pickBook(b){eng().book=b;S.save();UI.close();render();UI.toast('已切换：'+b);}
  function addToTodo(){if(window.Todo)Todo.addQuick('背单词 '+eng().goal+' 个','daily');}
  function genBrief(){
    const content=AI.englishBrief();
    S.get().reviews.push({id:S.uid(),type:'english',date:S.today(),content,modules:['英语']});S.save();
    UI.modal('<div class="modal-title">📚 AI 学习简报</div><div class="review-box">'+content.replace(/\n/g,'<br>')+'</div><button class="btn btn-primary btn-block mt12" onclick="UI.close()">收下 💗</button>');
  }

  /* ---------- 每日目标 ---------- */
  /* 今日实际目标 = 设定目标 + 今日额外加练数 */
  function todayTarget(){
    const e=eng();const t=S.today();
    const bonus=(e.bonusDate===t)?(+e.bonus||0):0;
    return Math.max(1,(+e.goal||10)+bonus);
  }
  function pickGoal(n){
    const e=eng();
    n=Math.max(1,Math.min(100,+n||10));
    if(e.goal===n){UI.toast('目标已经是 '+n+' 个啦 🌸');return;}
    e.goal=n;e.bonus=0;e.bonusDate='';
    S.save();promotePool();render();
    UI.toast('今日目标改成 '+n+' 个，卡片也跟着变啦 ✨');
  }
  /* 达标后想再来几个：只加练，不改目标 */
  function moreWords(n){
    const e=eng();const t=S.today();
    n=+n||5;
    if(e.bonusDate!==t){e.bonusDate=t;e.bonus=0;}
    e.bonus=(+e.bonus||0)+n;
    S.save();promotePool();render();
    UI.toast('又给你加了 '+n+' 个词，学霸本霸 📚');
  }

  const CHEERS=[
    '今天的小目标稳稳达成，你比昨天又厉害了一点点 🌟',
    '坚持这件事最难，而你今天做到了，真的很棒 💗',
    '词汇量在悄悄涨，未来的你一定会感谢现在的自己 🌱',
    '今日打卡完成！去做点让自己开心的事吧 🍰',
    '每天一点点，积累起来就是了不起的样子 ✨',
    '学完收工，剩下的时间尽情放松，你值得 🌙',
    '进步不需要很大，今天这几个词就够漂亮了 🌸'
  ];
  function hashNum(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}
  function cheerCard(done,target){
    const msg=CHEERS[hashNum(S.today())%CHEERS.length];
    return `<div class="cheer-box">
      <div class="cheer-emo">🎉</div>
      <div class="cheer-t">今日目标达成！${done}/${target}</div>
      <div class="cheer-s">${msg}</div>
      <div class="flex gap8 mt12">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="Eng.moreWords(5)">再来 5 个加练</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="Eng.detail()">看看学过的</button>
      </div>
    </div>`;
  }

  /* 每日新词：今天一共只引入「目标数」个词。
     学会一个就从卡片列表消失，不会再补新的（除非手动加练）。 */
  function promotePool(){
    const e=eng();const t=S.today();
    const target=todayTarget();
    let changed=false;
    // 1) 池子里词不够时，从基础词库 + 扩展词库（300+）补到池（learnDate 置空，暂不展示）
    const have=new Set(e.words.map(w=>(w.word||'').toLowerCase()));
    const src=JUNIOR_WORDS.concat(Array.isArray(window.WORD_BANK)?window.WORD_BANK:[]);
    for(const jw of src){
      const k=(jw.word||'').toLowerCase();
      if(!k||have.has(k))continue;
      e.words.push({id:S.uid(),word:jw.word,phonetic:String(jw.phonetic||''),mean:jw.mean,status:'new',reviews:[],learnDate:'',stage:0,known:false});
      have.add(k);changed=true;
    }
    // 2) 今日已引入总数（含已学会的）不超过目标；不足才补，学完不再冒新词
    const todayAll=e.words.filter(w=>w.learnDate===t);
    let need=target-todayAll.length;
    if(need>0){
      const pool=e.words.filter(w=>w.status==='new'&&w.learnDate!==t).sort((a,b)=>(a.word||'').localeCompare(b.word||''));
      for(const w of pool){if(need<=0)break;w.learnDate=t;need--;changed=true;}
    }else if(need<0){
      // 目标调小了：把多出来的、今天还没学的词退回池子
      const extra=e.words.filter(w=>w.learnDate===t&&w.status==='new');
      for(let i=extra.length-1;i>=0&&need<0;i--){extra[i].learnDate='';need++;changed=true;}
    }
    if(changed)S.save();
  }

  /* 从基础词库补充新词（如果当前词不够） */
  function refillWords(){
    promotePool();
    return eng().words.length;
  }

  window.Eng={render,study,answer,batchStudy,detail,wordList,addWord,saveWord,setGoal,saveGoal,pickGoal,moreWords,todayTarget,
    switchBook,pickBook,addToTodo,genBrief,
    speak,speakColloc,speakPhone,allPhones,nextPhones,phoneDone,
    toggleTimer,refillWords,flip,toggleOne,toggleMean,nextTip,grammarDone,
    setRoot(id){engRoot=id;}};
})();
