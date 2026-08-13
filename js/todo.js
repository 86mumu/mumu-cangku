/* ============ 记事模块（待办 + 备忘录 + 私密 + 水杯追踪） ============ */
(function(){
  const S=window.Store, I=window.Icon;

  /* ---- 状态 ---- */
  let tab='todo';          // 'todo'=待办, 'memo'=备忘录（分类由 memoCat 决定）
  let memoCat='__all__';   // 备忘录标签：__all__ 全部 / __none__ 未分类 / __pvt__ 私密 / 自定义分类名
  let viewDate=null;
  let search='';           // 顶部搜索关键词（只检索公开笔记，绝不检索私密）
  let pvtUnlocked=false;   // 本次会话是否已解锁私密（刷新/挂起后自动恢复上锁）
  let editingId=null;      // 当前编辑中的笔记 id
  let _history=[];         // 备忘录编辑 undo 历史
  let _histIdx=-1;         // 当前历史位置
  let _histTimer=null;     // 防抖入历史栈
  let _unsavedNew=false;   // 兼容位：备忘录已改为实时保存，恒为 false
  let _scrollMap={};       // 每个标签的滚动位置（切标签时恢复）
  let _activeImg=-1;       // 编辑页当前选中的图片索引（悬浮工具栏）
  let multi=false;         // 备忘录批量多选模式
  let multiSel={};         // 多选选中集合 {id:true}

  /* 保留标签名（不可作为自定义分类名） */
  const CAT_ALL='__all__', CAT_NONE='__none__', CAT_PVT='__pvt__';
  const CAT_RESERVED=['全部','未分类','私密'];

  /* 每杯推荐时间（从早上7点开始，每2小时一杯，最晚21点） */
  const CUP_TIMES=['07:00','09:00','11:00','13:00','15:00','17:00','19:00','21:00'];
  const ST_TXT=['未开始','喝着呢','已完成'];

  /* ============ 工具 ============ */
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function editText(el){
    if(!el)return '';
    if(el.tagName==='TEXTAREA'||el.tagName==='INPUT')return el.value||'';
    if(el.getAttribute('contenteditable')==='true'||el.isContentEditable)return bodyFromEdit(el);
    return el.innerText||'';
  }
  function setEditText(el,text){
    if(!el)return;
    if(el.tagName==='TEXTAREA'||el.tagName==='INPUT'){el.value=text||'';return;}
    if(el.getAttribute('contenteditable')==='true'||el.isContentEditable){
      const t=editingId?S.get().todos.find(x=>x.id===editingId):null;
      el.innerHTML=memoEditHtml({body:text||'',images:t?t.images:[]});
      return;
    }
    el.innerText=text||'';
  }
  /* 备忘录正文：markdown 占位 <-> 编辑区 HTML（清单为真实复选框，图片内联渲染） */
  function memoEditHtml(o){
    const imgs=o.images||[], body=o.body||'', alts=o.imgAlts||{}, zoom=o.imgZoom||{};
    // 单张图片（含描述 / 缩放状态），描述块 contenteditable=false，不参与正文回写
    function imgTag(i){
      if(!imgs[i])return '';
      const cap=alts[i]?String(alts[i]):'';
      return '<img class="memo-edit-img'+(zoom[i]?' zoom':'')+'" data-idx="'+i+'" src="'+esc(imgs[i])+'" alt="'+esc(cap)+'" title="'+esc(cap)+'">'
        +(cap?'<span class="ne-cap" contenteditable="false" data-idx="'+i+'">'+esc(cap)+'</span>':'');
    }
    // 行内 ![](iN) 安全替换为内联图片（其余转义，防 XSS）
    function inlineImg(txt){
      let out='',last=0;const re=/!\[\]\(i(\d+)\)/g;let m;
      while((m=re.exec(txt))){
        out+=esc(txt.slice(last,m.index));
        out+=imgTag(+m[1]);
        last=re.lastIndex;
      }
      out+=esc(txt.slice(last));
      return out;
    }
    return body.split('\n').map(line=>{
      const chk=/^( *)(- \[)( |x|X)(\] )(.*)$/.exec(line);
      if(chk){
        const on=chk[3]!==' ';
        return '<div class="ne-li'+(on?' on':'')+'" data-chk="'+(on?'x':' ')+'">'
          +'<span class="ne-box" contenteditable="false"></span>'
          +'<span class="ne-li-txt">'+inlineImg(chk[5])+'</span></div>';
      }
      const im=/^!\[\]\(i(\d+)\)\s*$/.exec(line.trim());
      if(im){
        const i=+im[1];
        if(imgs[i])return '<div class="ne-li-img">'+imgTag(i)+'</div>';
        return '<div class="ne-empty"></div>';
      }
      if(line.trim()==='')return '<div class="ne-empty"></div>';
      return '<div class="ne-pl">'+inlineImg(line)+'</div>';
    }).join('');
  }
  function bodyFromEdit(el){
    const BLOCK=/^(DIV|P|H[1-6]|LI|BLOCKQUOTE|PRE|SECTION|ARTICLE)$/i;
    // 行内文本（用于复选框文字、段落内联图片）返回字符串，不污染块级 out
    function walkText(node){
      let s='';
      node.childNodes.forEach(ch=>{
        if(ch.nodeType===3){s+=ch.nodeValue||'';return;}
        if(ch.nodeType!==1)return;
        const tag=ch.tagName, cls=ch.className||'';
        if(tag==='BR'){s+='\n';return;}
        if(typeof cls==='string'&&cls.indexOf('ne-cap')>=0)return; // 图片描述不写回正文
        if(tag==='IMG'&&ch.classList.contains('memo-edit-img')){s+='![](i'+(ch.getAttribute('data-idx')||'0')+')';return;}
        s+=walkText(ch);
      });
      return s;
    }
    const out=[];
    function walk(node){
      node.childNodes.forEach(ch=>{
        if(ch.nodeType===3){out.push(ch.nodeValue||'');return;}
        if(ch.nodeType!==1)return;
        const tag=ch.tagName, cls=ch.className||'';
        if(tag==='BR'){out.push('\n');return;}
        if(typeof cls==='string'&&cls.indexOf('ne-cap')>=0)return; // 图片描述不写回正文
        if(tag==='IMG'&&ch.classList.contains('memo-edit-img')){
          out.push('![](i'+(ch.getAttribute('data-idx')||'0')+')');return;
        }
        if(cls.indexOf('ne-li-img')>=0){walk(ch);out.push('\n');return;}
        if(cls.indexOf('ne-li')>=0){
          const checked=ch.getAttribute('data-chk')==='x'||ch.classList.contains('on');
          const tn=ch.querySelector('.ne-li-txt')||ch;
          const txt=walkText(tn);
          out.push('- ['+(checked?'x':' ')+'] '+txt);out.push('\n');
          return;
        }
        if(cls.indexOf('ne-empty')>=0){out.push('\n');return;}
        walk(ch);
        if(BLOCK.test(tag)||cls.indexOf('ne-pl')>=0)out.push('\n');
      });
    }
    walk(el);
    return out.join('')
      .replace(/\r\n/g,'\n')
      .replace(/\n{3,}/g,'\n\n')
      .replace(/^\n+/,'')
      .replace(/[ \t]+\n/g,'\n')
      .replace(/\s+$/,'');
  }
  function showImgLightbox(src){
    if(!src)return;
    UI.modal(`<div style="text-align:center;padding:6px 0"><img src="${esc(src)}" style="max-width:100%;max-height:70vh;border-radius:14px;box-shadow:var(--shadow);display:block;margin:0 auto"></div><button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>`);
  }
  function homeActive(){const e=document.getElementById('page-home');return !!e&&e.classList.contains('active');}
  function isPrivate(t){return !!t.private;}
  /* 标题：优先 title，否则 content，否则正文首行 */
  function titleOf(t){
    if(t.title&&t.title.trim())return t.title.trim();
    if(t.content&&t.content.trim())return t.content.trim();
    const b=firstLine(t.body||'');
    return b||'无标题';
  }
  function firstLine(s){
    const l=(s||'').split('\n').find(x=>x.trim()&&!/^!\[\]\(i\d+\)$/.test(x.trim()));
    return l?l.trim().replace(/^- \[( |x|X)\] /,'').replace(/!\[\]\(i\d+\)/g,'').trim():'';
  }
  function periodLabel(t){
    return {once:'单次',daily:'每日计划',weekly:'周计划',monthly:'月计划',memo:'备忘录'}[t.period]||'';
  }
  /* 时间标签：单次显示日期，周/月显示重复规则 */
  function dueChip(t){
    if(t.period==='once'){const d=t.cfg&&t.cfg.date;if(!d)return '';return '<span class="todo-cat">📅 '+S.fmtCN(d).replace('月','/').replace('日','')+'</span>';}
    if(t.period==='weekly'){const ds=(t.cfg&&t.cfg.days)||[];if(!ds.length)return '';const w=['日','一','二','三','四','五','六'];return '<span class="todo-cat">每周'+ds.map(x=>w[x]).join('/')+'</span>';}
    if(t.period==='monthly'){const ds=(t.cfg&&t.cfg.dates)||[];if(!ds.length)return '';return '<span class="todo-cat">每月'+ds.join('/')+'号</span>';}
    return '';
  }
  /* 把正文转成「预览」HTML：复选框渲染成 ☑/☐，图片占位替换成缩略图 */
  function bodyPreviewHTML(t,max){
    max=max||90;
    let raw=t.body&&t.body.trim()?t.body:(t.content||'');
    const imgs=t.images||[];
    const lines=raw.split('\n');
    let out='',len=0,boxIdx=-1;
    for(let li=0;li<lines.length;li++){
      let line=lines[li];
      let m=/(^- \[)( |x|X)(\] )(.*)$/.exec(line);
      if(m){
        boxIdx++;
        const checked=m[2]!==' ';
        const idx=boxIdx;
        out+='<label class="nb-cbx '+(checked?'on':'')+'" onclick="event.stopPropagation();Todo.toggleBox(\''+t.id+'\','+idx+')">'
           + '<i class="cbx"></i><span class="cbx-txt">'+esc(m[4])+'</span></label><br>';
        len+=m[4].length+2; continue;
      }
      // 图片占位 ![](iN)
      if(/^!\[\]\(i\d+\)\s*$/.test(line.trim())){
        const i=+line.trim().replace(/^!\[\]\(i/,'').replace(/\)\s*$/,'');
        if(imgs[i]){out+='<img class="nb-inline" src="'+esc(imgs[i])+'"><br>';continue;}
      }
      if(!line.trim())continue;
      out+=esc(line)+'<br>';
      len+=line.length;
      if(len>max)break;
    }
    return out;
  }
  /* 缩略图数量（卡片上最多展示 3 张） */
  function thumbImgs(t){return (t.images||[]).slice(0,3);}

  /* 卡片正文预览：纯文本单串（复选框→☐/☑，图片→[图片]），由 CSS 严格限制 2 行省略 */
  function plainPreview(t){
    let raw=(t.body&&t.body.trim())?t.body:(t.content||'');
    const parts=[];
    raw.split('\n').forEach(line=>{
      const m=/^ *- \[( |x|X)\] (.*)$/.exec(line);
      if(m){parts.push((m[1]===' '?'☐ ':'☑ ')+m[2].replace(/!\[\]\(i\d+\)/g,'[图片]').trim());return;}
      const s=line.replace(/!\[\]\(i\d+\)/g,'[图片]').trim();
      if(s)parts.push(s);
    });
    return parts.join('  ').slice(0,160);
  }
  /* 创建时间：优先精确到分的 createdAt，其次日期 */
  function createdText(t){
    if(t.createdAt){
      const d=new Date(t.createdAt);
      if(!isNaN(d))return (d.getMonth()+1)+'月'+d.getDate()+'日 '+S.pad(d.getHours())+':'+S.pad(d.getMinutes());
    }
    return t.created?S.fmtCN(t.created):'';
  }

  /* ============ 分类（自定义标签） ============ */
  function memoCats(){
    const st=S.get();
    if(!Array.isArray(st.noteCats)){
      // 首次：从已有笔记里提取历史分类，避免老数据丢标签
      st.noteCats=[...new Set((st.todos||[]).filter(t=>t.period==='memo'&&!isPrivate(t)).map(t=>t.category).filter(Boolean))];
    }
    return st.noteCats;
  }
  function catLabel(c){
    if(c===CAT_ALL)return '全部';
    if(c===CAT_NONE)return '未分类';
    if(c===CAT_PVT)return '私密';
    return c;
  }
  function normalNotes(){return (S.get().todos||[]).filter(t=>t.period==='memo'&&!isPrivate(t));}
  function privateNotes(){return (S.get().todos||[]).filter(t=>isPrivate(t));}
  function sortNotes(list){
    // 置顶优先（持续生效），其余按修改时间倒序
    return list.slice().sort((a,b)=>{
      if(!!b.pinned!==!!a.pinned)return (b.pinned?1:0)-(a.pinned?1:0);
      const r=(b.modified||'').localeCompare(a.modified||'');
      return r!==0?r:(b.createdAt||0)-(a.createdAt||0);
    });
  }
  function searching(){return !!search.trim();}

  /* 当前标签下的笔记列表 */
  function listForTab(){
    const all=S.get().todos||[];
    if(tab==='todo'){
      let list=all.filter(t=>!isPrivate(t)&&t.period!=='memo');
      if(searching()){
        const q=search.trim().toLowerCase();
        list=list.filter(t=>(titleOf(t)+' '+(t.body||'')+' '+(t.content||'')).toLowerCase().indexOf(q)>=0);
      }
      return sortNotes(list);
    }
    // 私密标签：完全独立的数据源，绝不参与搜索
    if(memoCat===CAT_PVT)return sortNotes(privateNotes());
    let list=normalNotes();
    // 搜索：只在【全部】范围内的普通笔记里检索标题与正文，忽略当前分类
    if(searching()){
      const q=search.trim().toLowerCase();
      return sortNotes(list.filter(t=>(titleOf(t)+' '+(t.body||'')+' '+(t.content||'')).toLowerCase().indexOf(q)>=0));
    }
    if(memoCat===CAT_NONE)list=list.filter(t=>!t.category);
    else if(memoCat!==CAT_ALL)list=list.filter(t=>t.category===memoCat);
    return sortNotes(list);
  }
  function pvtCount(){return privateNotes().length;}

  /* ============ 水杯（保留） ============ */
  function waterOf(d){
    let wl=S.get().waterLog.find(w=>w.date===d);
    if(!wl){wl={date:d,done:0,cups:Array(8).fill(0),st:Array(8).fill(''),et:Array(8).fill('')};S.get().waterLog.push(wl);S.save();}
    if(!Array.isArray(wl.cups))wl.cups=Array(8).fill(0);
    wl.cups=wl.cups.map(c=>c===true?2:(c===false?0:(+c||0)));
    if(!Array.isArray(wl.st))wl.st=Array(8).fill('');
    if(!Array.isArray(wl.et))wl.et=Array(8).fill('');
    while(wl.cups.length<8)wl.cups.push(0);
    while(wl.st.length<8)wl.st.push('');
    while(wl.et.length<8)wl.et.push('');
    wl.done=wl.cups.filter(c=>c===2).length;
    return wl;
  }
  function nowHM(){const n=new Date();return S.pad(n.getHours())+':'+S.pad(n.getMinutes());}
  function toggleCup(date,idx){
    const wl=waterOf(date);const s=wl.cups[idx];let msg='';
    if(s===0){wl.cups[idx]=1;wl.st[idx]=nowHM();wl.et[idx]='';msg='开始喝第 '+(idx+1)+' 杯啦，小口慢慢来～';}
    else if(s===1){wl.cups[idx]=2;wl.et[idx]=nowHM();msg='第 '+(idx+1)+' 杯喝完啦 💧';}
    else{wl.cups[idx]=0;wl.st[idx]='';wl.et[idx]='';msg='已撤销这一杯';}
    wl.done=wl.cups.filter(c=>c===2).length;S.save();
    if(wl.done>=8){
      const wt=S.get().todos.find(t=>t.content.indexOf('水')>=0&&(t.content.indexOf('喝')>=0||t.content.indexOf('杯')>=0));
      if(wt&&Array.isArray(wt.done)&&wt.done.indexOf(date)<0)wt.done.push(date);
      S.save();msg='太棒了！今天喝够 8 杯水 🎉';
    }else if(wl.done<8){
      const wt=S.get().todos.find(t=>t.content.indexOf('水')>=0&&(t.content.indexOf('喝')>=0||t.content.indexOf('杯')>=0));
      if(wt&&Array.isArray(wt.done)){const p=wt.done.indexOf(date);if(p>=0){wt.done.splice(p,1);S.save();}}
    }
    render();UI.toast(msg);
    if(window.Home&&homeActive())Home.render();
  }

  /* ============ 滚动位置保持 ============ */
  function scrollKey(){return tab==='todo'?'todo':('memo:'+memoCat);}
  function saveScroll(){_scrollMap[scrollKey()]=window.scrollY||document.documentElement.scrollTop||0;}
  function restoreScroll(y){
    const top=(typeof y==='number')?y:(_scrollMap[scrollKey()]||0);
    // 等布局完成后再恢复，避免被内容高度变化吞掉
    requestAnimationFrame(()=>{try{window.scrollTo(0,top);}catch(e){}});
  }

  /* ============ 主渲染 ============ */
  /* 备忘录横向滚动标签栏：全部 + 自定义分类 (+ 未分类) + ＋ + 私密 */
  function catBarHTML(){
    const cats=memoCats();
    const hasUncat=cats.length>0&&normalNotes().some(t=>!t.category);
    let html='<div class="cat-bar" id="cat-bar">';
    html+=`<button class="cat-tab${memoCat===CAT_ALL?' on':''}" data-c="${CAT_ALL}" onclick="Todo.openCat('${CAT_ALL}')">全部</button>`;
    cats.forEach(c=>{
      html+=`<button class="cat-tab${memoCat===c?' on':''}" data-c="${esc(c)}" data-custom="1" onclick="Todo.openCat('${esc(c).replace(/'/g,"\\'")}')">${esc(c)}</button>`;
    });
    if(hasUncat)html+=`<button class="cat-tab${memoCat===CAT_NONE?' on':''}" data-c="${CAT_NONE}" onclick="Todo.openCat('${CAT_NONE}')">未分类</button>`;
    html+='<button class="cat-tab cat-add" onclick="Todo.addCat()" title="新增分类">＋</button>';
    const trn=(S.get().trash||[]).length;
    html+=`<button class="cat-tab cat-trash" onclick="Todo.openTrash()" title="回收站">🗑${trn?'<span class="cat-badge">'+trn+'</span>':''}</button>`;
    return html+'</div>';
  }
  function render(keepScroll){
    if(!viewDate)viewDate=S.today(); // 默认显示当天，不沿用上次停留日期
    S.get().todoDate=viewDate;
    const d=viewDate;
    const el=document.getElementById('page-todo');
    if(!el)return;
    const y=(keepScroll===true)?(window.scrollY||document.documentElement.scrollTop||0):null;

    // 离开隐私空间（非 pvt 页面）→ 自动上锁，再次进入须重新验证
    if(!(tab==='memo'&&memoCat===CAT_PVT))relock();

    const subTabs=`<div class="subtabs">
        <button class="subtab${tab==='todo'?' on':''}" onclick="Todo.openTab('todo')">📝 待办</button>
        <button class="subtab${tab==='memo'?' on':''}" onclick="Todo.openTab('memo')">📒 备忘录</button>
      </div>`;
    if(tab==='todo'){
      // 待办：首页同款标题排版
      el.innerHTML=`
        <div class="page-head">
          <div class="date-line">${S.fmtCN(d)} ${S.weekCN(d)} · 记录每一件小事，生活就有迹可循</div>
          <div class="title">记事</div>
        </div>
        ${subTabs}
        <div class="datenav">
          <div class="d-wrap">
            <button onclick="Todo.shift(-1)">‹</button>
            <div class="d" onclick="Todo.openMonthPick()"><span class="ic">📅</span>${S.fmtCN(d)}</div>
            <button onclick="Todo.shift(1)">›</button>
          </div>
          <button class="today-btn-sm${d===S.today()?'':' go-today-pill'}" onclick="Todo.goToday()">${d===S.today()?'今天':'回到今天'}</button>
        </div>
        <div id="note-list"></div>
      `;
    }else{
      // 备忘录：二级菜单子页面（全部/未分类/自定义分类 + 隐藏隐私入口）
      const pageHead=`<div class="page-head">
          <div class="date-line">${S.fmtCN(d)} ${S.weekCN(d)} · 记录每一件小事，生活就有迹可循</div>
          <div class="title">记事</div>
        </div>`;
      if(multi){
        el.innerHTML=`
          ${pageHead}
          ${subTabs}
          <div class="multi-head">
            <button class="multi-x" onclick="Todo.exitMulti()">✕</button>
            <div class="multi-t">已选择 ${Object.keys(multiSel).length} 项</div>
            <button class="multi-all" onclick="Todo.multiAll()">全选</button>
          </div>
          <div id="note-list" class="in-multi"></div>
          <div class="multi-bar">
            <button class="multi-act" onclick="Todo.batchSetPvt()"><i class="ico-lock"></i><span>设为私密</span></button>
            <button class="multi-act" onclick="Todo.batchPin()"><i class="ico-pin"></i><span>置顶</span></button>
            <button class="multi-act" onclick="Todo.batchMove()"><i class="ico-move"></i><span>移动到</span></button>
            <button class="multi-act danger" onclick="Todo.batchDel()"><i class="ico-del"></i><span>删除</span></button>
          </div>`;
      }else{
        const onPvt=memoCat===CAT_PVT;
        el.innerHTML=`
          ${pageHead}
          ${subTabs}
          ${onPvt?'':`<div class="search-bar">
            <span class="si">🔍</span>
            <input class="search-input" id="memo-search" placeholder="搜索笔记标题或内容…" value="${esc(search)}" oninput="Todo.setSearch(this.value)">
            ${search?'<button class="search-clr" onclick="Todo.setSearch(\'\')">✕</button>':''}
          </div>`}
          ${catBarHTML()}
          <div id="note-list" class="two-col"></div>
          ${onPvt?`<button class="note-fab" onclick="Todo.openAdd('pvt')" title="新建私密笔记"><span>+</span><span>记一笔</span></button>`:`<button class="note-fab" onclick="Todo.openAddFloat()" title="新建笔记"><span>+</span><span>记一笔</span></button>`}
        `;
        bindCatBar();
      }
    }
    renderList();
    if(tab==='memo'&&!multi&&memoCat!==CAT_PVT)bindPvtPull();
    restoreScroll(y===null?undefined:y);
  }
  /* 自定义分类标签：长按 / 右键 → 重命名 / 删除 */
  function bindCatBar(){
    const bar=document.getElementById('cat-bar');if(!bar)return;
    bar.querySelectorAll('.cat-tab[data-custom="1"]').forEach(btn=>{
      const name=btn.getAttribute('data-c');
      let timer=null;
      btn.addEventListener('pointerdown',e=>{
        if(e.pointerType==='mouse'&&e.button!==0)return;
        timer=setTimeout(()=>{timer=null;catMenu(name);},480);
      });
      btn.addEventListener('pointerup',()=>{if(timer){clearTimeout(timer);timer=null;}});
      btn.addEventListener('pointerleave',()=>{if(timer){clearTimeout(timer);timer=null;}});
      btn.addEventListener('pointercancel',()=>{if(timer){clearTimeout(timer);timer=null;}});
      btn.addEventListener('contextmenu',e=>{e.preventDefault();if(timer){clearTimeout(timer);timer=null;}catMenu(name);});
    });
    // 让当前选中的标签滚动到可视区域
    const on=bar.querySelector('.cat-tab.on');
    if(on&&on.scrollIntoView)try{on.scrollIntoView({block:'nearest',inline:'nearest'});}catch(e){}
  }

  /* 待办标签下，在列表顶部补一个水杯卡片 */
  function injectWater(d){
    const box=document.getElementById('note-list');if(!box)return;
    const waterLog=waterOf(d);
    const doing=waterLog.cups.filter(c=>c===1).length;
    const html=`
      <div class="card water-card">
        <div class="card-h"><div class="l"><span class="ico">💧</span>今日饮水</div>
          <span class="pill on">已完成 ${waterLog.done} 杯${doing?' · '+doing+' 杯进行中':''}</span></div>
        <div class="water-grid">
          ${CUP_TIMES.map((t,i)=>{
            const s=waterLog.cups[i];
            const cls=s===2?'done':(s===1?'doing':'');
            const icon=s===2?'💧':'🥤';
            const time=s===2?(waterLog.st[i]||'')+'-'+(waterLog.et[i]||''):(s===1?'开始 '+(waterLog.st[i]||''):t);
            return `<div class="water-cup ${cls}" onclick="Todo.toggleCup('${d}',${i})">
              <span class="cup-icon">${icon}</span><span class="cup-state">${ST_TXT[s]}</span><span class="cup-time">${time}</span>
            </div>`;
          }).join('')}
        </div>
        ${waterLog.done>=8
          ? '<div class="small mt8" style="text-align:center;color:var(--pink);font-weight:600">今天喝够 8 杯水啦，身体谢谢你 💗</div>'
          : '<div class="small muted mt8" style="text-align:center">点一下开始喝，喝完再点一下结束</div>'}
      </div>`;
    box.insertAdjacentHTML('afterbegin',html);
  }

  function isDoneToday(t){return (t.done||[]).includes(viewDate);}
  /* 稳定双列瀑布流：两个等宽列容器，按当前列高就矮插入。
     不使用 CSS column-count，从根本上杜绝卡片被拆断 / 错位 / 重复渲染。 */
  function layoutWall(box,list){
    // 单列纵向圆角卡片（用户规格要求的备忘录列表样式）
    list.forEach(t=>{
      const wrap=document.createElement('div');
      wrap.innerHTML=noteCard(t);
      const el=wrap.firstElementChild;
      box.appendChild(el);
      bindCard(el,t);
    });
    return box;
  }
  function emptyBox(tip){
    return '<div class="empty">'+I.EMPTY.replace('width="120"','width="80"')+'<p>'+tip+'</p></div>';
  }
  /* 列表部分（搜索 / 勾选 / 增删改时只刷新它，避免输入框失焦与滚动重置） */
  function renderList(){
    const box=document.getElementById('note-list');if(!box)return;
    const keepY=window.scrollY||document.documentElement.scrollTop||0;
    box.innerHTML='';

    if(tab==='memo'&&memoCat===CAT_PVT&&!pvtUnlocked){
      box.insertAdjacentHTML('beforeend',`
        <div class="card pvt-lock">
          <div class="lock-emo">🔒</div>
          <div class="lock-t">私密笔记已上锁</div>
          <div class="small muted">输入解锁口令查看你的私密内容</div>
          <div class="field mt8"><input id="pvt-pass" type="password" placeholder="解锁口令" onkeydown="if(event.key==='Enter')Todo.unlock(this.value)"></div>
          <button class="btn btn-primary btn-block mt8" onclick="Todo.unlock(document.getElementById('pvt-pass').value)">解锁</button>
          ${!S.get().notesLock?'<div class="small muted mt8">（首次使用：新建一条私密笔记时设置口令）</div>':''}
        </div>`);
      return;
    }

    const list=listForTab();

    // 待办标签：旧样式单排列表 + 水杯 + 未完成/已完成分栏
    if(tab==='todo'){
      injectWater(viewDate);
      box.insertAdjacentHTML('beforeend','<button class="todo-add-btn" onclick="Todo.openAddTask()">＋ 新增待办</button>');
      if(!list.length){
        box.insertAdjacentHTML('beforeend','<div class="empty">'+I.EMPTY.replace('width="120"','width="80"')+'<p>还没有待办，点下方「＋ 新增待办」加一条吧 🌿</p></div>');
        return;
      }
      const undone=list.filter(t=>!isDoneToday(t));
      const done=list.filter(t=>isDoneToday(t));
      if(undone.length){
        box.insertAdjacentHTML('beforeend',`<div class="todo-sec-head"><span class="todo-sec-ico">📝</span><b>未完成（${undone.length}）</b></div>`);
        const wrap=document.createElement('div');wrap.className='todo-list';
        undone.forEach(t=>wrap.insertAdjacentHTML('beforeend',todoRow(t)));
        box.appendChild(wrap);
        undone.forEach(t=>bindTodoRow(wrap.querySelector('[data-nid="'+t.id+'"]'),t));
      }
      // 已完成 标题永远显示，放在「未完成」卡片下面（空时也占位，让用户知道这一栏在哪）
      box.insertAdjacentHTML('beforeend',`<div class="todo-sec-head done"><span class="todo-sec-ico">✓</span><b>已完成（${done.length}）</b></div>`);
      const dwrap=document.createElement('div');dwrap.className='todo-list';
      done.forEach(t=>dwrap.insertAdjacentHTML('beforeend',todoRow(t)));
      box.appendChild(dwrap);
      done.forEach(t=>bindTodoRow(dwrap.querySelector('[data-nid="'+t.id+'"]'),t));
      if(!done.length){
        box.insertAdjacentHTML('beforeend','<div class="todo-done-empty">— 暂无，点上面的待办即可归到这里 —</div>');
      }
      return;
    }

    // 备忘录：双列瀑布流卡片 + 分场景空状态
    if(!list.length){
      let tip;
      if(searching())tip='没有找到与「'+esc(search.trim())+'」相关的笔记<br>换个关键词试试吧 🔍';
      else if(memoCat===CAT_PVT)tip='还没有私密笔记<br>把小心事锁进来吧 🔒';
      else if(memoCat===CAT_NONE)tip='没有未分类的笔记，都已经归好类啦 ✨';
      else if(memoCat===CAT_ALL)tip='还没有笔记，点右下角的「＋」记一笔 🌿';
      else tip='「'+esc(catLabel(memoCat))+'」分类下还没有笔记<br>长按卡片可以把笔记移动过来 🌿';
      box.insertAdjacentHTML('beforeend',emptyBox(tip));
      return;
    }
    if(searching())box.insertAdjacentHTML('beforeend',`<div class="search-tip">共找到 ${list.length} 条笔记（不含私密）</div>`);
    layoutWall(box,list);
    if(keepY)requestAnimationFrame(()=>{try{window.scrollTo(0,keepY);}catch(e){}});
  }

  /* 单张笔记卡片 */
  function noteCard(t){
    const isTodo=t.period!=='memo';
    if(isTodo){
      // 待办卡（保留旧行为）
      const doneToday=(t.done||[]).includes(viewDate);
      const th=thumbImgs(t);
      return `
      <div class="note-card" data-nid="${t.id}">
        <div class="note-check ${doneToday?'on':''}" onclick="event.stopPropagation();Todo.toggle('${t.id}')">${doneToday?'✓':''}</div>
        <div class="note-main">
          <div class="note-title">${t.pinned?'<span class="note-flag">📌</span>':''}${esc(titleOf(t))}</div>
          ${ (t.body||t.content)?`<div class="note-body">${bodyPreviewHTML(t,90)}</div>`:'' }
          ${ th.length?`<div class="note-imgs">${th.map(im=>`<img src="${esc(im)}">`).join('')}</div>`:'' }
          <div class="note-foot">
            <span class="note-date">${S.fmtCN(t.created||t.modified||'')}</span>
            ${t.category?`<span class="note-cat">${esc(t.category)}</span>`:''}
            <span class="pill ${doneToday?'on':''}">${doneToday?'✓ 今日已完成':'待完成'}</span>
          </div>
        </div>
      </div>`;
    }
    // 备忘录卡：标题 + 两行正文预览 + 创建时间（私密卡带锁形图标）
    const preview=plainPreview(t);
    const pin=t.pinned?'<span class="note-flag" title="已置顶">📌</span>':'';
    const prv=t.private?'<span class="note-lock" title="私密笔记">🔒</span>':'';
    const cat=(!t.private&&t.category)?`<span class="note-cat">${esc(t.category)}</span>`:'';
    return `
      <div class="note-card memo-card${t.pinned?' pinned':''}${multi&&multiSel[t.id]?' sel':''}" data-nid="${t.id}">
        <div class="note-main">
          <div class="note-title">${pin}${prv}${esc(titleOf(t))}</div>
          <div class="note-body clamp2">${preview?esc(preview):'<span class="np-empty">（空白笔记）</span>'}</div>
          <div class="note-foot">
            <span class="note-date">${createdText(t)}</span>
            ${cat}
          </div>
        </div>
        ${multi?`<div class="sel-circle${multiSel[t.id]?' on':''}"><span>${multiSel[t.id]?'✓':''}</span></div>`:''}
      </div>`;
  }

  /* 旧待办列表：单条渲染 */
  function todoRow(t){
    const done=isDoneToday(t);
    const hasVideo=t.videoUrl&&t.videoUrl.trim();
    return `
      <div class="todo-row" data-nid="${t.id}" onclick="Todo.rowTap('${t.id}',this)">
        <div class="todo-check ${done?'on':''}">${done?'✓':''}</div>
        <div class="todo-main">
          <div class="todo-title">${esc(titleOf(t))}</div>
          <div class="todo-meta">
            <span class="todo-period">${periodLabel(t)}</span>
            ${dueChip(t)}
            ${t.category?`<span class="todo-cat">${esc(t.category)}</span>`:''}
            ${hasVideo?`<span class="todo-video" onclick="event.stopPropagation();Todo.openVideo('${esc(t.videoUrl)}')">▶ 跟练</span>`:''}
          </div>
        </div>
      </div>`;
  }
  /* 绑定：仅长按检测（click 由内联 onclick 处理） */
  function bindTodoRow(el,t){
    if(!el||!t)return;
    const id=t.id;
    let timer=null;
    el.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      timer=setTimeout(()=>{el.dataset.longpress='1';actionMenu(id);},480);
    });
    const cancelTimer=()=>clearTimeout(timer);
    el.addEventListener('pointermove',cancelTimer);
    el.addEventListener('pointerup',cancelTimer);
    el.addEventListener('pointercancel',cancelTimer);
    el.addEventListener('contextmenu',e=>{e.preventDefault();actionMenu(id);});
  }

  /* 点击 / 长按 绑定（第二个参数是笔记对象，不是 id 字符串） */
  function bindCard(el,t){
    if(!el||!t)return;
    const id=t.id;
    const onPvt=(tab==='memo'&&memoCat===CAT_PVT);
    let timer=null,sx=0,sy=0,long=false,moved=false;
    el.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      long=false;moved=false;sx=e.clientX;sy=e.clientY;
      // 隐私空间内长按 → 编辑/删除菜单；普通列表长按 → 进入批量多选
      timer=setTimeout(()=>{
        long=true;
        if(onPvt)actionMenu(id);
        else if(multi)toggleMultiSel(id);
        else enterMulti(id);
      },480);
    });
    el.addEventListener('pointermove',e=>{
      if(Math.abs(e.clientX-sx)>10||Math.abs(e.clientY-sy)>10){moved=true;clearTimeout(timer);}
    });
    el.addEventListener('pointerup',e=>{
      clearTimeout(timer);
      if(long||moved)return;
      if(e.target.closest('.todo-check,.note-check,.nb-cbx'))return; // 点圆圈=勾选，不打开编辑
      if(multi&&!onPvt){toggleMultiSel(id);return;}
      openNote(id);
    });
    el.addEventListener('pointercancel',()=>clearTimeout(timer));
    el.addEventListener('contextmenu',e=>{
      e.preventDefault();clearTimeout(timer);
      if(onPvt)actionMenu(id);
      else if(multi)toggleMultiSel(id);
      else enterMulti(id);
    });
  }
  /* 点击卡片：普通笔记直接进编辑页；私密笔记先走解锁流程 */
  function openNote(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    if(t.private&&!pvtUnlocked){ensureLock(()=>openEditor(id));return;}
    openEditor(id);
  }

  /* 长按操作菜单 */
  function actionMenu(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    if(t.period==='memo'){
      if(t.private){
        // 隐私空间内：长按仅提供编辑 / 删除
        UI.modal(`
          <div class="modal-title">${esc(titleOf(t))}</div>
          <div class="sheet">
            <button class="sheet-btn" onclick="UI.close();Todo.openEditor('${id}')">✏️ 编辑</button>
            <button class="sheet-btn danger" onclick="Todo.delMemo('${id}')">🗑 删除</button>
            <button class="sheet-btn ghost" onclick="UI.close()">取消</button>
          </div>`);
        return;
      }
      // 普通备忘录：置顶 / 移动分类 / 设为私密 / 删除
      UI.modal(`
        <div class="modal-title">${esc(titleOf(t))}</div>
        <div class="sheet">
          <button class="sheet-btn" onclick="Todo.togglePin('${id}')">${t.pinned?'📌 取消置顶':'📌 置顶'}</button>
          <button class="sheet-btn" onclick="Todo.moveCategory('${id}')">🏷 移动分类</button>
          <button class="sheet-btn" onclick="Todo.togglePvtFromList('${id}')">🔒 设为私密</button>
          <button class="sheet-btn danger" onclick="Todo.delMemo('${id}')">🗑 删除</button>
          <button class="sheet-btn ghost" onclick="UI.close()">取消</button>
        </div>
      `);
      return;
    }
    UI.modal(`
      <div class="modal-title">${esc(titleOf(t))}</div>
      <div class="sheet">
        <button class="sheet-btn" onclick="Todo.renameTask('${id}')">✏️ 重新命名</button>
        <button class="sheet-btn" onclick="Todo.changeTime('${id}')">🕐 改时间</button>
        <button class="sheet-btn" onclick="Todo.togglePin('${id}')">${t.pinned?'取消置顶':'📌 置顶'}</button>
        <button class="sheet-btn danger" onclick="Todo.del('${id}')">🗑 删除</button>
        <button class="sheet-btn ghost" onclick="UI.close()">取消</button>
      </div>
    `);
  }
  /* 重新命名 */
  function renameTask(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    UI.modal(`
      <div class="modal-title">重新命名</div>
      <div class="field"><input id="rn-title" placeholder="任务名称" value="${esc(t.title||t.content||'')}"></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.applyRename('${id}')">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>
    `);
    setTimeout(()=>{const i=document.getElementById('rn-title');if(i)i.focus();},0);
  }
  function applyRename(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    const v=(document.getElementById('rn-title').value||'').trim();
    if(!v){UI.toast('名称不能为空');return;}
    t.title=v;t.content=v;t.modified=S.today();S.save();UI.close();render();UI.toast('已重命名 ✏️');
  }
  /* 改时间：单次→具体日期；周→该星期几；月→该日期；每日→提示每天 */
  function changeTime(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    let cur=S.today(), hint='将任务改到所选日期（单次）';
    if(t.period==='once'){cur=(t.cfg&&t.cfg.date)||S.today();}
    else if(t.period==='weekly'){const ds=(t.cfg&&t.cfg.days)||[];cur=ds.length?S.addDays(S.today(),((ds[0]-new Date(S.today()).getDay())+7)%7):S.today();hint='选择日期后，将按该星期几每周重复';}
    else if(t.period==='monthly'){const ds=(t.cfg&&t.cfg.dates)||[];const d=ds.length?ds[0]:new Date(S.today()).getDate();cur=S.today().slice(0,8)+(d<10?'0'+d:''+d);hint='选择日期后，将按该日期每月重复';}
    else {hint='每日任务每天都会出现，选择日期仅作参考';}
    UI.modal(`
      <div class="modal-title">改时间</div>
      <div class="small muted mb8">${hint}</div>
      <div class="field"><input id="ct-date" type="date" value="${cur}"></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.applyTime('${id}')">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>
    `);
  }
  function applyTime(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    const v=document.getElementById('ct-date').value;if(!v){UI.toast('请选择日期');return;}
    const dt=new Date(v+'T00:00:00');
    t.cfg=t.cfg||{};
    if(t.period==='once')t.cfg.date=v;
    else if(t.period==='weekly')t.cfg.days=[dt.getDay()];
    else if(t.period==='monthly')t.cfg.dates=[dt.getDate()];
    t.modified=S.today();S.save();UI.close();render();UI.toast('已改时间 🕐');
  }
  function togglePin(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    t.pinned=!t.pinned;S.save();UI.close();render(true);UI.toast(t.pinned?'已置顶 📌':'已取消置顶');
  }
  function moveCategory(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    const cats=memoCats();
    UI.modal(`
      <div class="modal-title">移动分类</div>
      <div class="small muted mb8">为这条笔记选择一个分类，或输入新分类名</div>
      <div class="chips" id="mv-cats">
        <div class="chip ${!t.category?'on':''}" data-c="">未分类</div>
        ${cats.map(c=>`<div class="chip ${c===t.category?'on':''}" data-c="${esc(c)}">${esc(c)}</div>`).join('')}
      </div>
      <div class="field mt8"><input id="mv-new" placeholder="新分类名（留空=未分类）" value="${esc(t.category||'')}"></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.applyCategory('${id}')">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>
    `);
    document.querySelectorAll('#mv-cats .chip').forEach(c=>c.onclick=()=>{
      document.querySelectorAll('#mv-cats .chip').forEach(x=>x.classList.remove('on'));
      c.classList.add('on');document.getElementById('mv-new').value=c.dataset.c;
    });
  }
  function applyCategory(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    const v=(document.getElementById('mv-new').value||'').trim();
    if(v&&CAT_RESERVED.indexOf(v)>=0){UI.toast('「'+v+'」是保留名称，换一个吧');return;}
    t.category=v;
    if(v&&memoCats().indexOf(v)<0)memoCats().push(v);
    t.modified=S.today();S.save();UI.close();
    // 编辑页内改分类：只更新按钮文案，不重绘列表
    const cb=document.getElementById('ne-cat-label');
    if(cb){cb.textContent=v||'未分类';UI.toast('已移动到「'+(v||'未分类')+'」');return;}
    render(true);UI.toast('已移动到「'+(v||'未分类')+'」');
  }

  /* ============ 自定义分类：新增 / 重命名 / 删除 ============ */
  function addCat(){
    UI.modal(`
      <div class="modal-title">🏷 新增分类</div>
      <div class="small muted mb8">分类只对普通笔记生效，私密笔记始终独立存放</div>
      <div class="field"><input id="cat-new" placeholder="分类名称，如：工作 / 灵感 / 购物" onkeydown="if(event.key==='Enter')Todo.applyAddCat()"></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.applyAddCat()">创建</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
    setTimeout(()=>{const i=document.getElementById('cat-new');if(i)i.focus();},0);
  }
  function applyAddCat(){
    const el=document.getElementById('cat-new');if(!el)return;
    const v=(el.value||'').trim();
    if(!v){UI.toast('分类名不能为空');return;}
    if(CAT_RESERVED.indexOf(v)>=0){UI.toast('「'+v+'」是保留名称，换一个吧');return;}
    if(memoCats().indexOf(v)>=0){UI.toast('已有同名分类');return;}
    memoCats().push(v);S.save();UI.close();
    memoCat=v;render();UI.toast('已创建分类「'+v+'」🏷');
  }
  function catMenu(name){
    UI.modal(`
      <div class="modal-title">🏷 ${esc(name)}</div>
      <div class="sheet">
        <button class="sheet-btn" onclick="Todo.renameCat('${esc(name).replace(/'/g,"\\'")}')">✏️ 重命名分类</button>
        <button class="sheet-btn danger" onclick="Todo.delCat('${esc(name).replace(/'/g,"\\'")}')">🗑 删除分类</button>
        <button class="sheet-btn ghost" onclick="UI.close()">取消</button>
      </div>`);
  }
  function renameCat(name){
    UI.modal(`
      <div class="modal-title">重命名分类</div>
      <div class="field"><input id="cat-rn" value="${esc(name)}" onkeydown="if(event.key==='Enter')Todo.applyRenameCat('${esc(name).replace(/'/g,"\\'")}')"></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.applyRenameCat('${esc(name).replace(/'/g,"\\'")}')">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
  }
  function applyRenameCat(old){
    const el=document.getElementById('cat-rn');if(!el)return;
    const v=(el.value||'').trim();
    if(!v){UI.toast('分类名不能为空');return;}
    if(CAT_RESERVED.indexOf(v)>=0){UI.toast('「'+v+'」是保留名称，换一个吧');return;}
    if(v!==old&&memoCats().indexOf(v)>=0){UI.toast('已有同名分类');return;}
    const cats=memoCats();const i=cats.indexOf(old);
    if(i>=0)cats[i]=v;
    (S.get().todos||[]).forEach(t=>{if(t.category===old)t.category=v;});
    if(memoCat===old)memoCat=v;
    S.save();UI.close();render();UI.toast('分类已更名为「'+v+'」');
  }
  function delCat(name){
    const n=normalNotes().filter(t=>t.category===name).length;
    UI.modal(`
      <div class="modal-title">删除分类「${esc(name)}」</div>
      <div class="small muted" style="margin-bottom:12px">
        ${n?('该分类下的 <b>'+n+'</b> 条笔记不会被删除，会自动归入「未分类」。'):'该分类下暂无笔记。'}
      </div>
      <button class="btn btn-primary btn-block" style="background:#e06a86" onclick="Todo.applyDelCat('${esc(name).replace(/'/g,"\\'")}')">确认删除分类</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">取消</button>`);
  }
  function applyDelCat(name){
    const cats=memoCats();const i=cats.indexOf(name);
    if(i>=0)cats.splice(i,1);
    (S.get().todos||[]).forEach(t=>{if(t.category===name)t.category='';});
    if(memoCat===name)memoCat=CAT_ALL;
    S.save();UI.close();render();UI.toast('分类已删除，笔记已归入「未分类」');
  }

  /* 切换正文里的复选框（卡片上直接勾） */
  function toggleBox(id,idx){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    const raw=t.body&&t.body.trim()?t.body:(t.content||'');
    const lines=raw.split('\n');let bi=-1,changed=false;
    for(let i=0;i<lines.length;i++){
      const m=/(^- \[)( |x|X)(\] )(.*)$/.exec(lines[i]);
      if(m){bi++;if(bi===idx){lines[i]=(m[1]+(m[2]===' '?'x':' ')+m[3]+m[4]);changed=true;break;}}
    }
    if(changed){t.body=lines.join('\n');t.modified=S.today();S.save();renderList();}
  }

  /* ============ 私密锁 ============ */
  let _afterUnlock=null;   // 解锁成功后要执行的动作
  function ensureLock(cb){
    _afterUnlock=cb||null;
    if(pvtUnlocked&&S.get().notesLock){_afterUnlock=null;if(cb)cb();return;}
    if(!S.get().notesLock){ // 首次：设置口令
      UI.modal(`
        <div class="modal-title">🔒 设置私密口令</div>
        <div class="small muted mb8">这是查看 / 新建私密笔记的钥匙，请记牢（本地个人应用，明文保存）。</div>
        <div class="field"><input id="set-lock" type="password" placeholder="设置解锁口令"></div>
        <button class="btn btn-primary btn-block" onclick="Todo.setLockPass(document.getElementById('set-lock').value)">确定</button>
      `);
      return;
    }
    // 已设口令但未解锁 → 解锁弹窗
    UI.modal(`
      <div class="modal-title">🔒 输入私密口令</div>
      <div class="field"><input id="unlock-pass" type="password" placeholder="解锁口令" onkeydown="if(event.key==='Enter')Todo.unlock(this.value)"></div>
      <button class="btn btn-primary btn-block" onclick="Todo.unlock(document.getElementById('unlock-pass').value)">解锁</button>
    `);
  }
  function runAfterUnlock(){
    const f=_afterUnlock;_afterUnlock=null;
    if(f){f();return;}
    tab='todo';render();
  }
  function setLockPass(p){
    p=(p||'').trim();
    if(!p){UI.toast('口令不能为空');return;}
    S.get().notesLock=p;pvtUnlocked=true;S.save();UI.close();
    UI.toast('私密口令已设置 🔒');runAfterUnlock();
  }
  function unlock(p){
    p=(p||'').trim();
    if(p===S.get().notesLock){pvtUnlocked=true;UI.close();runAfterUnlock();UI.toast('已解锁 🔓');}
    else{UI.toast('口令不正确');}
  }
  /* 挂起 / 关闭页面 → 私密自动恢复上锁 */
  function relock(){
    if(!pvtUnlocked)return;
    pvtUnlocked=false;_afterUnlock=null;
    // 正在编辑私密笔记 → 直接退出编辑页
    const t=editingId?S.get().todos.find(x=>x.id===editingId):null;
    if(t&&t.private){try{closeEditor();}catch(e){}return;}
    const page=document.getElementById('page-todo');
    if(page&&page.classList.contains('active')&&tab==='memo'&&memoCat===CAT_PVT)renderList();
  }

  /* ============ 标签 / 搜索 ============ */
  function openTab(t){
    saveScroll();
    if(t==='memo'){multi=false;multiSel={};if(memoCat===CAT_PVT)memoCat=CAT_ALL;}
    tab=t;
    render();
  }
  function setTab(t){openTab(t);}
  /* 横向标签栏：切换分类（保持各标签自己的滚动位置） */
  function openCat(c){
    saveScroll();
    memoCat=c;
    if(c===CAT_PVT)search='';
    render();
  }
  function setSearch(v){
    search=v==null?'':v;
    const inp=document.getElementById('memo-search');
    if(inp&&inp.value!==search)inp.value=search;
    const bar=document.querySelector('#page-todo .search-bar');
    if(bar){
      const clr=bar.querySelector('.search-clr');
      if(search.trim()&&!clr)bar.insertAdjacentHTML('beforeend','<button class="search-clr" onclick="Todo.setSearch(\'\')">✕</button>');
      else if(!search.trim()&&clr)clr.remove();
    }
    renderList();
  }
  /* 列表长按菜单里的「设为私密 / 解除私密」 */
  function togglePvtFromList(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    if(t.private){
      t.private=false;t.modified=S.today();S.save();UI.close();render(true);
      UI.toast('已解除私密，笔记回到「全部」');
      return;
    }
    if(!S.get().notesLock){UI.close();ensureLock(()=>{const n=S.get().todos.find(x=>x.id===id);if(n){n.private=true;n.pinned=false;n.modified=S.today();S.save();}tab='todo';render();UI.toast('已设为私密 🔒');});return;}
    t.private=true;t.modified=S.today();S.save();UI.close();render(true);
    UI.toast('已设为私密，可在「🔒 私密」中查看');
  }

  /* ============ 编辑页（全屏） ============ */
  function openEditor(id,kind){
    let t=id?S.get().todos.find(x=>x.id===id):null;
    if(!t){
      // 新建：按入口决定类型
      const isPvt=kind==='pvt';
      const period=kind==='memo'||isPvt?'memo':'daily';
      // 新建普通笔记时，自动落到当前选中的自定义分类里
      const inCat=(period==='memo'&&!isPvt&&tab==='memo'&&memoCat!==CAT_ALL&&memoCat!==CAT_NONE&&memoCat!==CAT_PVT)?memoCat:'';
      t={id:S.uid(),title:'',content:'',body:'',images:[],imgAlts:{},imgZoom:{},category:inCat,pinned:false,
         private:isPvt,period, cfg:{}, done:[], skip:[], planId:'', created:S.today(), createdAt:Date.now(),
         videoUrl:'', imported:false, rollover:period==='once', modified:S.today()};
      S.get().todos.push(t);
      S.save();                              // 实时保存：新建即落盘，空白笔记也能保存、闪退不丢
    }
    _unsavedNew=false;
    if(!t.imgAlts)t.imgAlts={};
    if(!t.imgZoom)t.imgZoom={};
    _activeImg=-1;
    editingId=t.id;
    // 兼容旧数据：备忘录正文历史上存于 content 字段（而非 body）。
    // 若正文框(body)为空、而 content 有正文，则把 content 当作正文迁移到 body，
    // 否则正文框会空白、字数统计恒为 0（用户看到“写了字却不计数”，其实内容被显示在了标题栏）。
    if(t.period==='memo' && (!t.body||!t.body.trim()) && t.content && t.content.trim()){
      t.body=t.content;
      t.content='';
      t.modified=S.today();
      S.save();
    }
    const isTodo=t.period!=='memo';
    // 关键修复：打开新编辑器前先移除残留的旧编辑器。否则 DOM 里会同时存在多个
    // id="note-edit" 的 overlay、多个 div#ne-text，导致 document.getElementById('ne-text')
    // 命中旧的那个空 div —— 字数统计、autoSave、正文回写全部读错元素（甚至会丢内容）
    const _oldEditor=document.getElementById('note-edit');
    if(_oldEditor){
      if(_oldEditor._flush)try{window.removeEventListener('pagehide',_oldEditor._flush);}catch(e){}
      _oldEditor.remove();
    }
    const overlay=document.createElement('div');
    overlay.id='note-edit';
    overlay.className='note-edit';

    // 初始化 undo 历史
    _history=[{title:t.title||'',body:t.body||'',images:(t.images||[]).slice()}];
    _histIdx=0;

    if(isTodo){
      // 待办：保持原功能布局（含周期配置、分类）
      overlay.innerHTML=renderTodoEditor(t);
    }else{
      // 备忘录 / 私密：参考截图的简洁笔记编辑页
      overlay.innerHTML=renderMemoEditor(t);
    }
    document.body.appendChild(overlay);

    // 绑定自动保存
    const titleEl=overlay.querySelector('#ne-title');
    const textEl=overlay.querySelector('#ne-text');
    const catEl=overlay.querySelector('#ne-cat');
    const onInput=()=>{autoSave(t,titleEl,textEl,catEl);};
    // 兜底：页面被挂起 / 关闭前再存一次，闪退也不丢内容
    overlay._flush=()=>{try{autoSave(t,titleEl,textEl,catEl);}catch(e){}};
    if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('pagehide',overlay._flush);
    if(titleEl)titleEl.addEventListener('input',onInput);
    if(textEl)textEl.addEventListener('input',onInput);
    if(catEl)catEl.addEventListener('input',onInput);
    if(catEl)overlay.querySelectorAll('#ne-cats .chip').forEach(c=>c.onclick=()=>{catEl.value=c.dataset.c;onInput();});
    if(isTodo){
      renderRecur(t);
    }else{
      // 备忘录：白色卡片就是编辑区，直接输入/粘贴，图片内联显示
      const ta=document.getElementById('ne-text');
      if(ta){
        // iOS Safari 在 contenteditable 里回车默认行为不稳定，强制用 <div> 作为段落分隔，统一可被 CSS 正确处理
        try{document.execCommand('defaultParagraphSeparator',false,'div');}catch(_){}
        // 键盘上方工具栏：聚焦（键盘弹出）时显示，失焦（收起键盘）时隐藏
        // 失焦延迟 250ms 再隐藏，避免点工具栏按钮的瞬间 toolbar 已被 display:none 导致点击不触发
        let _mtHide=null;
        ta.addEventListener('focus',()=>{const tb=document.getElementById('memo-tools');if(tb){tb.classList.add('show');if(_mtHide){clearTimeout(_mtHide);_mtHide=null;}}});
        ta.addEventListener('blur',()=>{const tb=document.getElementById('memo-tools');if(tb){_mtHide=setTimeout(()=>tb.classList.remove('show'),250);}});
        ta.addEventListener('blur',()=>{t.body=editText(ta);t.modified=S.today();S.save();updateMeta(t);});
        ta.addEventListener('input',()=>{autoSave(t,titleEl,ta,catEl);updateMeta(t);pushHistory(t);});
        // 中文输入法兜底：某些输入法 compositionend 后不触发 input，这里强制刷一次字数
        ta.addEventListener('compositionend',()=>{autoSave(t,titleEl,ta,catEl);updateMeta(t);pushHistory(t);});
        ta.addEventListener('keydown',e=>{
          if((e.metaKey||e.ctrlKey)&&e.key==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
          // 回车：手动把光标所在块在光标处拆成两块，确保换行稳定（覆盖普通段落 / 空行 / 复选框）
          if(e.key==='Enter'&&!e.isComposing){
            const sel=window.getSelection();
            if(!sel||!sel.rangeCount)return;
            const rng=sel.getRangeAt(0);
            let node=rng.startContainer;
            if(node&&node.nodeType===3)node=node.parentElement;
            const block=node?node.closest('.ne-pl,.ne-li,.ne-empty'):null;
            if(!block)return; // 裸文本（首行未分段）交给浏览器默认处理，配合 defaultParagraphSeparator=div
            e.preventDefault();
            const r2=document.createRange();r2.selectNodeContents(block);r2.setEnd(rng.startContainer,rng.startOffset);
            const offset=r2.toString().length;
            const full=block.textContent;
            const before=full.slice(0,offset),after=full.slice(offset);
            const emptyLine=!before&&!after;
            const mkPl=txt=>{const d=document.createElement('div');d.className='ne-pl';d.textContent=txt;return d;};
            const mkEmpty=()=>{const d=document.createElement('div');d.className='ne-empty';d.innerHTML='<br>';return d;};
            let nb;
            if(block.classList.contains('ne-li')){
              if(emptyLine){block.remove();nb=mkEmpty();}
              else{
                block.querySelector('.ne-li-txt').textContent=before;
                nb=document.createElement('div');nb.className='ne-li';nb.setAttribute('data-chk',' ');
                nb.innerHTML='<span class="ne-box" contenteditable="false"></span><span class="ne-li-txt"></span>';
                nb.querySelector('.ne-li-txt').textContent=after;
              }
            }else if(emptyLine){
              nb=mkEmpty();
            }else{
              block.textContent=before;nb=mkPl(after);
            }
            block.parentElement.insertBefore(nb,block.nextSibling);
            const target=nb.querySelector? (nb.querySelector('.ne-li-txt')||nb):nb;
            const rr=document.createRange();rr.selectNodeContents(target);rr.collapse(true);
            sel.removeAllRanges();sel.addRange(rr);
            t.body=editText(ta);t.modified=S.today();S.save();updateMeta(t);pushHistory(t);
          }
        });
        ta.addEventListener('click',e=>{
          const box=e.target.closest('.ne-box');
          if(box){
            e.preventDefault();
            const li=box.parentElement;
            const on=li.classList.toggle('on');
            li.setAttribute('data-chk',on?'x':' ');
            t.body=editText(ta);
            t.modified=S.today();S.save();
            updateMeta(t);
            hideImgBar();
            return;
          }
          // 单指点击图片 → 弹出横向悬浮工具栏（多图时只有当前这张有）
          const img=e.target.closest('img.memo-edit-img');
          if(img){e.preventDefault();e.stopPropagation();showImgBar(img);return;}
          if(e.target.closest('.ne-cap')){e.preventDefault();return;}
          hideImgBar();   // 点空白处收起
        });
        // 长按清单条目 → 上移 / 下移 / 删除
        let cTimer=null;
        ta.addEventListener('pointerdown',e=>{
          const li=e.target.closest?e.target.closest('.ne-li'):null;
          if(!li)return;
          cTimer=setTimeout(()=>{cTimer=null;checkItemMenu(li);},520);
        });
        ['pointerup','pointerleave','pointercancel','pointermove'].forEach(ev=>{
          ta.addEventListener(ev,()=>{if(cTimer){clearTimeout(cTimer);cTimer=null;}});
        });
      }
      // 点编辑区以外的空白也收起图片工具栏
      overlay.addEventListener('click',e=>{
        if(e.target.closest('#img-bar'))return;
        if(e.target.closest('img.memo-edit-img'))return;
        hideImgBar();
      });
      // 点击备忘录正文区空白处（除标题/工具栏/按钮/meta 外）自动聚焦正文输入
      const memoBody=overlay.querySelector('.memo-body');
      if(memoBody){
        memoBody.addEventListener('click',e=>{
          const tag=(e.target.tagName||'').toLowerCase();
          if(tag==='button'||tag==='input'||tag==='select'||tag==='textarea'||tag==='a')return;
          if(e.target.closest('button')||e.target.closest('.memo-head')||e.target.closest('.memo-tools')||e.target.closest('.ne-meta')||e.target.closest('.memo-title'))return;
          const txt=document.getElementById('ne-text');
          if(txt&&txt.getAttribute('contenteditable')==='true'){txt.focus();}
        });
      }
      updateMeta(t);
    }
    setTimeout(()=>{if(titleEl)titleEl.focus();},50);
  }

  /* ============ 图片悬浮工具栏 ============ */
  function imgBarEl(){return document.getElementById('img-bar');}
  function hideImgBar(){
    const bar=imgBarEl();if(!bar)return;
    bar.hidden=true;bar.innerHTML='';
    const prev=document.querySelector('img.memo-edit-img.sel');
    if(prev)prev.classList.remove('sel');
    _activeImg=-1;
  }
  function showImgBar(img){
    const bar=imgBarEl();if(!bar||!img)return;
    const idx=+(img.getAttribute('data-idx')||0);
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    document.querySelectorAll('img.memo-edit-img.sel').forEach(x=>x.classList.remove('sel'));
    img.classList.add('sel');
    _activeImg=idx;
    const zoomed=!!(t.imgZoom&&t.imgZoom[idx]);
    const hasCap=!!(t.imgAlts&&t.imgAlts[idx]);
    bar.innerHTML=`
      <button class="ib-btn" onclick="Todo.imgDesc()">📝 ${hasCap?'改描述':'加描述'}</button>
      <button class="ib-btn" onclick="Todo.imgZoom()">${zoomed?'🔽 缩小':'🔼 放大'}</button>
      <button class="ib-btn" onclick="Todo.imgBig()">🔍 看大图</button>
      <button class="ib-btn" onclick="Todo.imgCopy()">⧉ 复制</button>
      <button class="ib-btn danger" onclick="Todo.imgDel()">🗑 删除</button>`;
    bar.hidden=false;
    // 贴着图片上方居中显示，超出视口则改到下方
    try{
      const r=img.getBoundingClientRect();
      const bw=bar.offsetWidth||260, bh=bar.offsetHeight||40;
      let left=r.left+r.width/2-bw/2;
      left=Math.max(8,Math.min(left,window.innerWidth-bw-8));
      let top=r.top-bh-8;
      if(top<8)top=Math.min(r.bottom+8,window.innerHeight-bh-8);
      bar.style.left=left+'px';bar.style.top=top+'px';
    }catch(e){}
  }
  function activeImgNote(){
    const t=S.get().todos.find(x=>x.id===editingId);
    if(!t||_activeImg<0)return null;
    return t;
  }
  function refreshEditBody(t){
    const ta=document.getElementById('ne-text');
    if(ta&&ta.getAttribute('contenteditable')==='true')ta.innerHTML=memoEditHtml(t);
    else if(ta)setEditText(ta,t.body||'');
    neRender(t);updateMeta(t);
  }
  function imgDesc(){
    const t=activeImgNote();if(!t)return;
    const idx=_activeImg;
    const cur=(t.imgAlts&&t.imgAlts[idx])||'';
    UI.modal(`
      <div class="modal-title">📝 图片描述</div>
      <div class="field"><input id="img-desc" placeholder="给这张图片写点说明…" value="${esc(cur)}"></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.applyImgDesc(${idx})">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
    setTimeout(()=>{const i=document.getElementById('img-desc');if(i)i.focus();},0);
  }
  function applyImgDesc(idx){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    const v=(document.getElementById('img-desc').value||'').trim();
    t.imgAlts=t.imgAlts||{};
    if(v)t.imgAlts[idx]=v;else delete t.imgAlts[idx];
    t.modified=S.today();S.save();UI.close();
    refreshEditBody(t);hideImgBar();
    UI.toast(v?'描述已保存 📝':'描述已清除');
  }
  function imgZoom(){
    const t=activeImgNote();if(!t)return;
    const idx=_activeImg;
    t.imgZoom=t.imgZoom||{};
    t.imgZoom[idx]=!t.imgZoom[idx];
    const on=!!t.imgZoom[idx];
    if(!on)delete t.imgZoom[idx];
    t.modified=S.today();S.save();
    const img=document.querySelector('img.memo-edit-img[data-idx="'+idx+'"]');
    if(img)img.classList.toggle('zoom',on);
    hideImgBar();
    UI.toast(on?'已放大显示 🔼':'已恢复小图 🔽');
  }
  function imgBig(){
    const t=activeImgNote();if(!t)return;
    const src=(t.images||[])[_activeImg];
    const cap=(t.imgAlts&&t.imgAlts[_activeImg])||'';
    hideImgBar();
    if(!src){UI.toast('图片已不存在');return;}
    UI.modal(`<div style="text-align:center;padding:6px 0">
        <img src="${esc(src)}" style="max-width:100%;max-height:68vh;border-radius:14px;box-shadow:var(--shadow);display:block;margin:0 auto">
        ${cap?`<div class="small muted mt8">${esc(cap)}</div>`:''}
      </div><button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>`);
  }
  function imgCopy(){
    const t=activeImgNote();if(!t)return;
    if(t.private){UI.toast('私密笔记禁止分享，请先解除私密 🔒');hideImgBar();return;}
    const src=(t.images||[])[_activeImg];
    hideImgBar();
    if(!src){UI.toast('图片已不存在');return;}
    copyImageData(src);
  }
  function copyImageData(src){
    try{
      if(navigator.clipboard&&window.ClipboardItem&&typeof fetch==='function'){
        fetch(src).then(r=>r.blob()).then(b=>navigator.clipboard.write([new ClipboardItem({[b.type||'image/png']:b})]))
          .then(()=>UI.toast('图片已复制 ⧉'))
          .catch(()=>fallbackCopy(src));
        return;
      }
    }catch(e){}
    fallbackCopy(src);
  }
  function fallbackCopy(text){
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(()=>UI.toast('已复制到剪贴板 ⧉')).catch(()=>UI.toast('当前环境不支持复制'));
        return;
      }
      const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
      UI.toast('已复制到剪贴板 ⧉');
    }catch(e){UI.toast('当前环境不支持复制');}
  }
  function imgDel(){
    const t=activeImgNote();if(!t)return;
    const idx=_activeImg;
    hideImgBar();
    removeImg(idx);
    UI.toast('图片已删除 🗑');
  }

  /* 清单条目：上移 / 下移 / 删除 */
  function lineIndexOfLi(li){
    const ta=document.getElementById('ne-text');if(!ta)return -1;
    const nodes=[...ta.children];
    return nodes.indexOf(li);
  }
  function checkItemMenu(li){
    const i=lineIndexOfLi(li);if(i<0)return;
    UI.modal(`
      <div class="modal-title">☑ 清单条目</div>
      <div class="sheet">
        <button class="sheet-btn" onclick="Todo.moveLine(${i},-1)">⬆ 上移</button>
        <button class="sheet-btn" onclick="Todo.moveLine(${i},1)">⬇ 下移</button>
        <button class="sheet-btn danger" onclick="Todo.removeLine(${i})">🗑 删除该条</button>
        <button class="sheet-btn ghost" onclick="UI.close()">取消</button>
      </div>`);
  }
  function moveLine(i,dir){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    const lines=(t.body||'').split('\n');
    const j=i+dir;
    if(i<0||i>=lines.length||j<0||j>=lines.length){UI.close();return;}
    const tmp=lines[i];lines[i]=lines[j];lines[j]=tmp;
    t.body=lines.join('\n');t.modified=S.today();S.save();
    UI.close();refreshEditBody(t);
  }
  function removeLine(i){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    const lines=(t.body||'').split('\n');
    if(i<0||i>=lines.length){UI.close();return;}
    lines.splice(i,1);
    t.body=lines.join('\n');t.modified=S.today();S.save();
    UI.close();refreshEditBody(t);UI.toast('已删除该条');
  }

  /* 右上角「⋯」菜单：分类 / 私密开关 / 复制全文 / 文字格式 / 删除 */
  function memoMenu(){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    UI.modal(`
      <div class="modal-title">${esc(titleOf(t))}</div>
      <div class="sheet">
        <button class="sheet-btn" onclick="Todo.moveCategory('${t.id}')">🏷 分类：${esc(t.category||'未分类')}</button>
        <button class="sheet-btn" onclick="Todo.togglePvt('${t.id}')">${t.private?'🔓 解除私密':'🔒 设为私密'}</button>
        <button class="sheet-btn" onclick="UI.close();Todo.copyAll()">⧉ 复制全文</button>
        <button class="sheet-btn" onclick="UI.close();Todo.toggleFormat()">T 文字格式</button>
        <button class="sheet-btn danger" onclick="Todo.delMemo('${t.id}')">🗑 删除笔记</button>
        <button class="sheet-btn ghost" onclick="UI.close()">取消</button>
      </div>`);
  }
  /* 复制全文（私密笔记禁止直接分享） */
  function copyAll(){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    if(t.private){UI.toast('私密笔记禁止直接分享，请先解除私密 🔒');return;}
    const ta=document.getElementById('ne-text');
    if(ta)t.body=editText(ta);
    const plain=(t.body||'').replace(/!\[\]\(i\d+\)/g,'[图片]').replace(/^ *- \[ \] /gm,'☐ ').replace(/^ *- \[[xX]\] /gm,'☑ ');
    const txt=((t.title||'').trim()?((t.title||'').trim()+'\n\n'):'')+plain;
    if(!txt.trim()){UI.toast('这是一条空白笔记');return;}
    fallbackCopy(txt);
  }

  /* 待办编辑页 HTML */
  function renderTodoEditor(t){
    return `
      <div class="ne-head">
        <button class="ne-x" onclick="Todo.closeEditor()">‹ 返回</button>
        <span class="ne-save" id="ne-save"></span>
        <button class="ne-del" onclick="Todo.del('${t.id}')">删除</button>
      </div>
      <div class="ne-body">
        <input class="ne-title" id="ne-title" placeholder="标题" value="${esc(t.title||t.content||'')}">
        <div class="ne-toolbar">
          <button onclick="Todo.insertCheck()">☑ 复选框</button>
          <button onclick="document.getElementById('ne-img').click()">🖼 图片</button>
          <button id="ne-edit-toggle" onclick="Todo.toggleEditMode()">✎ 编辑</button>
          <button class="${t.private?'on':''}" id="ne-pvt" onclick="Todo.togglePvt('${t.id}')">🔒 私密</button>
          <input id="ne-img" type="file" accept="image/*" hidden onchange="Todo.insertImage(this.files[0])">
        </div>
        <div class="ne-render" id="ne-render"></div>
        <textarea class="ne-text" id="ne-text" style="display:none" placeholder="写点什么…（用「- [ ] 」写可勾选项，回车换行）">${esc(t.body||'')}</textarea>
        <div class="ne-imgs" id="ne-imgs">
          ${(t.images||[]).map((im,i)=>`<div class="ne-thumb"><img src="${esc(im)}"><button onclick="Todo.removeImg(${i})">✕</button></div>`).join('')}
        </div>
        <div class="field mt8"><label>分类标签</label>
          <input id="ne-cat" placeholder="如：工作 / 灵感 / 购物清单" value="${esc(t.category)}">
          <div class="chips mt4" id="ne-cats">${catChips(t.category)}</div>
        </div>
        <div class="field mt8"><label>重复</label>
          <select id="ne-period" onchange="Todo.renderRecur()">
            ${['once','daily','weekly','monthly'].map(p=>`<option value="${p}" ${t.period===p?'selected':''}>${{once:'不重复（单次）',daily:'每日',weekly:'每周',monthly:'每月'}[p]}</option>`).join('')}
          </select>
          <div id="ne-recur"></div></div>
        <div class="small muted mt8" id="ne-meta">创建：${S.fmtCN(t.created||'')} · 修改：${S.fmtCN(t.modified||'')}</div>
      </div>`;
  }

  /* 备忘录编辑页 HTML（参考截图：粉色 Q 版简约风） */
  function renderMemoEditor(t){
    return `
      <div class="ne-head memo-head">
        <button class="ne-back" onclick="Todo.closeEditor()" title="返回"><i class="ico-back"></i></button>
        <div class="ne-actions">
          <button class="ne-act" id="ne-undo" onclick="Todo.undo()" title="撤销" disabled><i class="ico-undo"></i></button>
          <button class="ne-act" id="ne-redo" onclick="Todo.redo()" title="重做" disabled><i class="ico-redo"></i></button>
          <button class="ne-act ne-more" id="ne-more" onclick="Todo.memoMenu()" title="更多">⋯</button>
          <button class="ne-act ne-act-done" id="ne-done" onclick="Todo.finishMemo()" title="完成"><i class="ico-done"></i></button>
        </div>
      </div>
      <div class="ne-body memo-body">
        <input class="ne-title memo-title" id="ne-title" placeholder="标题" value="${esc(t.title||t.content||'')}">
        <div class="ne-meta" id="ne-meta">${createdText(t)} <span class="dot">|</span> 正文<span id="ne-count">0</span>字
          <span class="dot">|</span> <span class="ne-cat-chip" onclick="Todo.moveCategory('${t.id}')">🏷 <span id="ne-cat-label">${esc(t.category||'未分类')}</span></span>
          <span class="ne-pvt-chip${t.private?' on':''}" id="ne-pvt-chip">${t.private?'🔒 私密':''}</span>
        </div>

        <div class="ne-text memo-text memo-edit" id="ne-text" contenteditable="true" placeholder="点击输入正文…"
          autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false">${memoEditHtml(t)}</div>
        <input id="ne-img" type="file" accept="image/*" hidden onchange="Todo.insertImage(this.files[0])">
        <div class="img-bar" id="img-bar" hidden></div>

        <div class="memo-tools" id="memo-tools">
          <button class="memo-tool" onpointerdown="event.preventDefault()" onclick="document.getElementById('ne-img').click()" title="插入图片"><i class="ico-img"></i><span>插入图片</span></button>
          <button class="memo-tool" onpointerdown="event.preventDefault()" onclick="Todo.insertCheck()" title="插入复选框"><i class="ico-check"></i><span>复选框</span></button>
          <button class="memo-tool" onpointerdown="event.preventDefault()" onclick="Todo.startHandwrite()" title="涂鸦"><i class="ico-pen"></i><span>涂鸦</span></button>
        </div>
      </div>`;
  }

  function fmtDateTime(d){
    if(!d)return '';
    const now=new Date();
    const today=S.today();
    const y=d.slice(0,4), m=+d.slice(5,7), day=+d.slice(8,10);
    const ap=now.getHours()<12?'上午':'下午';
    const h=now.getHours()%12||12;
    const min=S.pad(now.getMinutes());
    let dateTxt='';
    if(d===today)dateTxt='今天';
    else if(d===S.addDays(today,-1))dateTxt='昨天';
    else dateTxt=m+'月'+day+'日';
    return dateTxt+' '+ap+h+':'+min;
  }
  function updateMeta(t){
    // 只做增量更新，保留 meta 行里的分类 / 私密标识（创建时间恒定不变）
    const cnt=document.getElementById('ne-count');
    if(cnt)cnt.textContent=wordCount(t);
    const cl=document.getElementById('ne-cat-label');
    if(cl)cl.textContent=t.category||'未分类';
    const pv=document.getElementById('ne-pvt-chip');
    if(pv){pv.textContent=t.private?'🔒 私密':'';pv.classList.toggle('on',!!t.private);}
  }
  function wordCount(t){
    // 只统计正文，不统计标题
    let s='';
    const ta=document.getElementById('ne-text');
    if(ta&&(ta.getAttribute('contenteditable')==='true'||ta.isContentEditable)){
      // 1. 优先用结构化的 editText（保留图片占位/复选框等语义）
      s=editText(ta)||'';
      // 2. 终极兜底：直接读 textContent，跳过任何结构化 walk 漏掉的字符
      //    （处理某些浏览器/输入法下 #ne-text DOM 结构未被 walk 正确遍历的极端情况）
      const tc=(ta.textContent||'').replace(/\s/g,'');
      const sClean=s.replace(/\s/g,'');
      if(tc.length>sClean.length) s=tc;
    }
    // 兜底：DOM 取不到时再用已保存的 t.body
    if(!s&&t&&t.body)s=t.body;
    s=s||'';
    // 中文/英文/数字都算字；去掉图片占位、复选框标记、markdown 标记和空白
    const clean=s.replace(/!\[\]\(i\d+\)/g,'').replace(/- \[[ xX]\] /g,'').replace(/[#*_\-\`\s]/g,'');
    return (clean.match(/[\u4e00-\u9fa5\w]/g)||[]).length;
  }
  /* 调试用：浏览器控制台执行 Todo.debugWordCount() 查看字数链路全状态 */
  function debugWordCount(){
    const ta=document.getElementById('ne-text');
    const cnt=document.getElementById('ne-count');
    const t=editingId?S.get().todos.find(x=>x.id===editingId):null;
    return {
      editingId,
      allNoteEdit:document.querySelectorAll('#note-edit').length,
      allNeText:document.querySelectorAll('#ne-text').length,
      neTextExists:!!ta,
      neTextTag:ta&&ta.tagName,
      neTextCE:ta&&ta.getAttribute('contenteditable'),
      neTextDisplay:ta&&ta.style.display,
      neTextTextContent:ta?(ta.textContent||''):null,
      neTextInnerHTML:ta?(ta.innerHTML||'').slice(0,400):null,
      tBody:t?(t.body||''):null,
      tTitle:t?(t.title||''):null,
      tContent:t?(t.content||''):null,
      neCountText:cnt?cnt.textContent:null,
      wordCountResult:wordCount(t),
    };
  }

  function memoEnterEdit(ta,renderBox){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    setEditText(ta,t.body||'');
    renderBox.style.display='none';
    ta.style.display='block';
    ta.focus();
  }
  function memoExitEdit(ta,renderBox,t){
    t.body=editText(ta);
    t.modified=S.today();S.save();
    ta.style.display='none';
    renderBox.style.display='block';
    neRender(t);
    updateMeta(t);
  }

  /* 编辑历史：撤销 / 重做 */
  function pushHistory(t){
    clearTimeout(_histTimer);
    _histTimer=setTimeout(()=>{
      const snap={title:t.title||'',body:t.body||'',images:(t.images||[]).slice()};
      // 如果和当前相同就不压栈
      if(_histIdx>=0&&_history[_histIdx].body===snap.body&&_history[_histIdx].title===snap.title)return;
      // 撤销后重新输入时，把 redo 部分丢掉
      if(_histIdx<_history.length-1)_history=_history.slice(0,_histIdx+1);
      _history.push(snap);_histIdx++;
      if(_history.length>30)_history.shift();
      updateHistBtns();
    },400);
  }
  function updateHistBtns(){
    const u=document.getElementById('ne-undo'), r=document.getElementById('ne-redo');
    if(u)u.disabled=_histIdx<=0;
    if(r)r.disabled=_histIdx>=_history.length-1;
  }
  function undo(){
    if(_histIdx<=0)return;
    _histIdx--;
    applyHistory();
  }
  function redo(){
    if(_histIdx>=_history.length-1)return;
    _histIdx++;
    applyHistory();
  }
  function applyHistory(){
    const snap=_history[_histIdx];if(!snap)return;
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    t.title=snap.title;t.content=snap.title;t.body=snap.body;t.images=snap.images.slice();
    t.modified=S.today();S.save();
    const titleEl=document.getElementById('ne-title');
    const ta=document.getElementById('ne-text');
    if(titleEl)titleEl.value=snap.title;
    if(ta){setEditText(ta,snap.body);}
    neRender(t);
    updateMeta(t);
    updateHistBtns();
  }

  /* 底部工具栏：AI 编辑 */
  function aiEdit(){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    UI.modal(`
      <div class="modal-title">✨ AI 编辑</div>
      <div class="small muted mb8">基于当前内容，让 AI 帮你续写或润色</div>
      <div class="field">
        <textarea id="ai-prompt" rows="3" placeholder="告诉 AI 想怎么改，例如：帮我润色得更温柔；续写一段感想…">${esc('基于以下内容'+(t.title?'《'+t.title+'》':'')+'：\n'+(t.body||'').slice(0,120)+(t.body&&t.body.length>120?'…':''))}</textarea>
      </div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.applyAiEdit()">生成</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
  }
  function applyAiEdit(){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    const prompt=(document.getElementById('ai-prompt').value||'').trim();
    if(!prompt){UI.toast('请输入需求');return;}
    UI.close();
    const res=window.AI?AI.ask(prompt):'AI 暂时不可用，请手动编辑 💗';
    t.body=(t.body||'')+'\n\n'+res;
    t.modified=S.today();S.save();
    const ta=document.getElementById('ne-text');
    if(ta){setEditText(ta,t.body);}
    neRender(t);updateMeta(t);pushHistory(t);
    UI.toast('AI 已生成 ✨');
  }
  /* 语音输入 */
  function startVoice(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){UI.toast('当前浏览器不支持语音输入');return;}
    const r=new SR();r.lang='zh-CN';r.continuous=false;r.interimResults=false;
    r.onresult=e=>{
      const txt=e.results[0][0].transcript;
      const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
      t.body=(t.body||'')+(t.body&&!t.body.endsWith('\n')?'\n':'')+txt;
      t.modified=S.today();S.save();
      const ta=document.getElementById('ne-text');if(ta){setEditText(ta,t.body);}
      neRender(t);updateMeta(t);pushHistory(t);
      UI.toast('语音已转文字 🎙');
    };
    r.onerror=e=>UI.toast('语音识别失败：'+e.error);
    r.start();
  }
  /* 手写（简化：弹出 canvas 涂鸦） */
  function startHandwrite(){
    UI.modal(`
      <div class="modal-title">✍ 手写 / 涂鸦</div>
      <canvas id="hw-cv" width="300" height="180" style="background:#fff;border-radius:12px;border:1px solid var(--line);width:100%;touch-action:none"></canvas>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.saveHandwrite()">保存为图片</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
    setTimeout(()=>{
      const cv=document.getElementById('hw-cv');if(!cv)return;
      const ctx=cv.getContext('2d');ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.lineCap='round';
      let draw=false;
      const pos=e=>{const r=cv.getBoundingClientRect();const p=e.touches?e.touches[0]:e;return {x:(p.clientX-r.left)*(cv.width/r.width),y:(p.clientY-r.top)*(cv.height/r.height)};};
      cv.addEventListener('pointerdown',e=>{draw=true;const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);cv.setPointerCapture(e.pointerId);});
      cv.addEventListener('pointermove',e=>{if(!draw)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();});
      cv.addEventListener('pointerup',()=>{draw=false;});
      cv.addEventListener('pointerleave',()=>{draw=false;});
    },0);
  }
  function saveHandwrite(){
    const cv=document.getElementById('hw-cv');if(!cv)return;
    const data=cv.toDataURL('image/png');
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    t.images=t.images||[];const idx=t.images.length;t.images.push(data);
    UI.close();
    const ta=document.getElementById('ne-text');
    if(ta){
      ta.focus();
      const range=document.createRange();range.selectNodeContents(ta);range.collapse(false);
      const sel=window.getSelection();if(sel){sel.removeAllRanges();sel.addRange(range);}
      document.execCommand('insertHTML',false,`<img class="memo-edit-img" data-idx="${idx}" src="${esc(data)}" alt="">`);
      t.body=editText(ta);
    }else{
      t.body=(t.body||'')+((t.body&&!t.body.endsWith('\n'))?'\n':'')+'![](i'+idx+')\n';
    }
    t.modified=S.today();S.save();
    neRender(t);updateMeta(t);pushHistory(t);
    UI.toast('涂鸦已保存 ✍');
  }
  /* 文字格式菜单 */
  function toggleFormat(){
    UI.modal(`
      <div class="modal-title">T 文字格式</div>
      <div class="flex gap8 wrap">
        <button class="btn btn-ghost" onclick="Todo.wrapSelection('**','**')">加粗</button>
        <button class="btn btn-ghost" onclick="Todo.wrapSelection('*','*')">斜体</button>
        <button class="btn btn-ghost" onclick="Todo.wrapSelection('### ','')">小标题</button>
        <button class="btn btn-ghost" onclick="Todo.wrapSelection('> ','')">引用</button>
        <button class="btn btn-ghost" onclick="Todo.wrapSelection('\u0060','\u0060')">代码</button>
      </div>
      <button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>`);
  }
  function wrapSelection(before,after){
    UI.close();
    const ta=document.getElementById('ne-text');if(!ta)return;
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    ta.focus();
    const sel=window.getSelection?window.getSelection():null;
    let txt='';
    if(sel&&sel.rangeCount>0&&!sel.isCollapsed)txt=sel.toString();
    document.execCommand('insertText',false,before+txt+after);
    t.body=editText(ta);t.modified=S.today();S.save();
    neRender(t);updateMeta(t);pushHistory(t);
  }
  let _editMode=false;
  /* 编辑页：正文以内联渲染展示，复选框是正文里的真实方框，可直接点勾 */
  function neRender(t){
    const box=document.getElementById('ne-render');if(!box)return;
    const imgs=(t.images)||[];
    const lines=(t.body||'').split('\n');
    let html='';
    lines.forEach((line,li)=>{
      const m=/^( *)(- \[)( |x|X)(\] )(.*)$/.exec(line);
      if(m){
        html+='<label class="ne-cbx '+(m[3]!==' '?'on':'')+'" onclick="event.stopPropagation();Todo.toggleCheckLine('+li+')">'
            + '<i class="cbx"></i><span class="cbx-txt">'+esc(m[5])+'</span></label>';
        return;
      }
      const im=/^!\[\]\(i(\d+)\)\s*$/.exec(line.trim());
      if(im){
        const i=+im[1];
        if(imgs[i])html+='<div class="ne-imgline"><img src="'+esc(imgs[i])+'"><button class="ne-img-x" onclick="Todo.removeImg('+i+')">✕</button></div>';
        return;
      }
      if(line.trim()===''){html+='<div class="ne-br"></div>';return;}
      html+='<div class="ne-line">'+esc(line)+'</div>';
    });
    box.innerHTML=html||'<div class="ne-ph">写点什么…（点「☑ 复选框」插入可勾选的待办项）</div>';
  }
  /* 在「渲染 / 编辑文字」间切换 */
  function toggleEditMode(){
    _editMode=!_editMode;
    const render=document.getElementById('ne-render');
    const ta=document.getElementById('ne-text');
    const btn=document.getElementById('ne-edit-toggle');
    if(_editMode){
      const t=S.get().todos.find(x=>x.id===editingId);
      if(t&&ta)setEditText(ta,t.body||'');
      if(render)render.style.display='none';
      if(ta){ta.style.display='';ta.focus();}
      if(btn)btn.classList.add('on');
    }else{
      const t=S.get().todos.find(x=>x.id===editingId);
      if(t&&ta){t.body=editText(ta);t.modified=S.today();S.save();}
      if(ta)ta.style.display='none';
      if(render){render.style.display='';neRender(t);}
      if(btn)btn.classList.remove('on');
    }
  }
  function catChips(sel){
    const cats=[...new Set((S.get().todos||[]).map(x=>x.category).filter(Boolean))];
    if(!cats.length)return '';
    return cats.map(c=>`<div class="chip ${c===sel?'on':''}" data-c="${esc(c)}">${esc(c)}</div>`).join('');
  }
  function autoSave(t,titleEl,textEl,catEl){
    const isTodo=t.period!=='memo';
    if(titleEl){t.title=titleEl.value;t.content=t.title;} // 兼容旧字段
    // 优先用传入的 textEl，避免 getElementById 命中旧 overlay 残留元素
    const ta=textEl||document.getElementById('ne-text');
    if(ta)t.body=editText(ta);
    if(catEl)t.category=catEl.value.trim();
    t.modified=S.today();
    S.save();                              // 实时自动保存：标题 / 正文 / 分类每次变更都落盘
    const s=document.getElementById('ne-save');
    if(s)s.textContent='已保存 '+S.fmtCN(t.modified);
    if(!isTodo)updateMeta(t);
  }
  function insertCheck(){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    const ta=document.getElementById('ne-text');
    if(ta&&ta.getAttribute('contenteditable')==='true'){
      // 备忘录：把当前段落变成复选框项（在文字最前方加真实复选框）
      ta.focus();
      const sel=window.getSelection();
      let block=null;
      if(sel&&sel.rangeCount){
        let n=sel.anchorNode;
        if(n&&n.nodeType===3)n=n.parentElement;
        while(n&&n!==ta&&n.parentElement!==ta)n=n.parentElement;
        if(n&&n!==ta)block=n;
      }
      const mk=()=>{const li=document.createElement('div');li.className='ne-li';li.setAttribute('data-chk',' ');
        li.innerHTML='<span class="ne-box" contenteditable="false"></span><span class="ne-li-txt"></span>';return li;};
      const place=span=>{if(!span)return;const r=document.createRange();r.selectNodeContents(span);r.collapse(false);
        const s=window.getSelection();if(s){s.removeAllRanges();s.addRange(r);}};
      if(block&&block.classList.contains('ne-li')){
        const li=mk();block.parentElement.insertBefore(li,block.nextSibling);place(li.querySelector('.ne-li-txt'));
      }else if(block){
        const li=mk();li.querySelector('.ne-li-txt').textContent=block.textContent||'';
        block.parentElement.replaceChild(li,block);place(li.querySelector('.ne-li-txt'));
      }else{
        const li=mk();li.querySelector('.ne-li-txt').textContent=ta.textContent||'';
        ta.innerHTML='';ta.appendChild(li);place(li.querySelector('.ne-li-txt'));
      }
      t.body=editText(ta);
      t.modified=S.today();S.save();
      updateMeta(t);
      return;
    }
    if(ta){
      // 待办 textarea：原 markdown 行为
      ta.focus();
      const txt=editText(ta);
      const prefix=(txt&&!txt.endsWith('\n'))?'\n':'';
      const range=document.createRange();range.selectNodeContents(ta);range.collapse(false);
      const sel=window.getSelection();if(sel){sel.removeAllRanges();sel.addRange(range);}
      document.execCommand('insertText',false,prefix+'- [ ] ');
      t.body=editText(ta);autoSave(t,document.getElementById('ne-title'),ta,document.getElementById('ne-cat'));
    }else{
      t.body=(t.body||'')+((t.body&&!t.body.endsWith('\n'))?'\n':'')+'- [ ] ';
      t.modified=S.today();S.save();neRender(t);
    }
  }
  /* 编辑页：正文里的方框打勾 / 取消（内联，直接改 [ ]<->[x]） */
  function toggleCheckLine(li){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    const lines=(t.body||'').split('\n');
    if(li<0||li>=lines.length)return;
    const m=/^( *)(- \[)( |x|X)(\] )(.*)$/.exec(lines[li]);if(!m)return;
    const checked=m[3]!==' ';
    lines[li]=m[1]+m[2]+(checked?' ':'x')+m[4]+m[5];
    t.body=lines.join('\n');
    t.modified=S.today();S.save();
    neRender(t);
    const ta=document.getElementById('ne-text');if(ta&&ta.style.display!=='none')setEditText(ta,t.body);
  }
  function insertImage(file){
    if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{
      const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
      t.images=t.images||[];t.imgAlts=t.imgAlts||{};t.imgZoom=t.imgZoom||{};
      const idx=t.images.length;t.images.push(ev.target.result);
      hideImgBar();
      const ta=document.getElementById('ne-text');
      if(ta){
        ta.focus();
        const range=document.createRange();range.selectNodeContents(ta);range.collapse(false);
        const sel=window.getSelection();if(sel){sel.removeAllRanges();sel.addRange(range);}
        const html=`<img class="memo-edit-img" data-idx="${idx}" src="${esc(ev.target.result)}" alt="">`;
        document.execCommand('insertHTML',false,html);
        t.body=editText(ta);
      }else{
        t.body=(t.body||'')+'\n![](i'+idx+')\n';
      }
      t.modified=S.today();S.save();
      neRender(t);
      const box=document.getElementById('ne-imgs');
      if(box)box.insertAdjacentHTML('beforeend',`<div class="ne-thumb"><img src="${esc(ev.target.result)}"><button onclick="Todo.removeImg(${idx})">✕</button></div>`);
      const s=document.getElementById('ne-save');if(s)s.textContent='已保存 '+S.fmtCN(t.modified);
    };
    r.readAsDataURL(file);
  }
  /* 删除图片：只摘掉该图占位，后面的索引整体前移，正文位置与其它图片保持不变 */
  function removeImg(i){
    const t=S.get().todos.find(x=>x.id===editingId);if(!t)return;
    if(!Array.isArray(t.images)||i<0||i>=t.images.length)return;
    const ta=document.getElementById('ne-text');
    if(ta&&ta.style.display!=='none')t.body=editText(ta);
    let body=(t.body||'').split('!['+']('+'i'+i+')').join('');
    body=body.replace(/!\[\]\(i(\d+)\)/g,(m,n)=>'![](i'+(+n>i?(+n-1):+n)+')');
    t.body=body.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n');
    t.images.splice(i,1);
    // 描述 / 缩放状态跟着重排
    const alts={},zoom={};
    Object.keys(t.imgAlts||{}).forEach(k=>{const n=+k;if(n===i)return;alts[n>i?n-1:n]=t.imgAlts[k];});
    Object.keys(t.imgZoom||{}).forEach(k=>{const n=+k;if(n===i)return;zoom[n>i?n-1:n]=t.imgZoom[k];});
    t.imgAlts=alts;t.imgZoom=zoom;
    t.modified=S.today();S.save();
    const box=document.getElementById('ne-imgs');
    if(box)box.innerHTML=(t.images||[]).map((im,k)=>`<div class="ne-thumb"><img src="${esc(im)}"><button onclick="Todo.removeImg(${k})">✕</button></div>`).join('');
    refreshEditBody(t);
  }
  /* 依据 images 数组重建正文里的图片占位（保证索引连续） */
  function rebuildBodyImages(body,imgs){
    let raw=body||'';
    raw=raw.replace(/!\[\]\(i\d+\)/g,''); // 清掉旧占位
    raw=raw.replace(/\n{3,}/g,'\n\n');
    imgs.forEach((im,i)=>{raw+=('\n![](i'+i+')\n');});
    return raw.trim()+'\n';
  }
  function togglePvt(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    if(!t.private&&!S.get().notesLock){
      // 首次设为私密 → 先设口令
      UI.modal(`
        <div class="modal-title">🔒 设置私密口令</div>
        <div class="small muted mb8">设为私密后，这条笔记会从公开列表消失，需口令才能查看。</div>
        <div class="field"><input id="set-lock2" type="password" placeholder="设置解锁口令"></div>
        <button class="btn btn-primary btn-block" onclick="Todo.setLockPass2('${id}',document.getElementById('set-lock2').value)">确定并设为私密</button>
      `);
      return;
    }
    t.private=!t.private;t.modified=S.today();S.save();
    const btn=document.getElementById('ne-pvt');
    if(btn)btn.classList.toggle('on',t.private);
    updateMeta(t);
    UI.close();
    UI.toast(t.private?'已设为私密 🔒（不可直接分享）':'已解除私密，现在可以分享了');
    render(true);
  }
  function setLockPass2(id,p){
    p=(p||'').trim();if(!p){UI.toast('口令不能为空');return;}
    S.get().notesLock=p;pvtUnlocked=true;S.save();
    const t=S.get().todos.find(x=>x.id===id);if(t){t.private=true;t.modified=S.today();S.save();updateMeta(t);}
    const btn=document.getElementById('ne-pvt');if(btn)btn.classList.add('on');
    UI.close();UI.toast('已设为私密 🔒');render(true);
  }
  function renderRecur(t){
    t=t||S.get().todos.find(x=>x.id===editingId);if(!t)return;
    const box=document.getElementById('ne-recur');if(!box)return;
    const p=document.getElementById('ne-period')?document.getElementById('ne-period').value:t.period;
    if(p==='weekly'){
      const wk=[['0','日'],['1','一'],['2','二'],['3','三'],['4','四'],['5','五'],['6','六']];
      const sel=(t.cfg&&t.cfg.days)||[];
      box.innerHTML='<div class="chips" id="rc-days">'+wk.map(w=>`<div class="chip ${sel.includes(+w[0])?'on':''}" data-d="${w[0]}">周${w[1]}</div>`).join('')+'</div>';
      box.querySelectorAll('.chip').forEach(c=>c.onclick=()=>c.classList.toggle('on'));
    }else if(p==='monthly'){
      box.innerHTML='<input id="rc-dom" type="number" min="1" max="31" placeholder="每月几号" value="'+((t.cfg&&t.cfg.dates&&t.cfg.dates[0])||'')+'">';
    }else if(p==='once'){
      box.innerHTML='<input id="rc-date" type="date" value="'+((t.cfg&&t.cfg.date)||S.today())+'">'
        +'<label class="flex between center mt4"><span>当天没完成，自动顺延</span><span class="switch '+(t.rollover!==false?'on':'')+'" id="rc-roll" onclick="this.classList.toggle(\'on\')"></span></label>';
    }else box.innerHTML='<div class="small muted">每天都会出现这条待办</div>';
  }
  /* 完成：内容已实时保存，这里只做最后一次同步后退出 */
  function finishMemo(){
    const t=editingId?S.get().todos.find(x=>x.id===editingId):null;
    if(t){
      const ta=document.getElementById('ne-text');
      const titleEl=document.getElementById('ne-title');
      if(titleEl){t.title=titleEl.value;t.content=titleEl.value;}
      if(ta&&ta.style.display!=='none')t.body=editText(ta);
      t.modified=S.today();S.save();
      if(window.Home&&homeActive())Home.render();
    }
    closeEditor(true);
  }
  function closeEditor(skipConfirm){
    const t=editingId?S.get().todos.find(x=>x.id===editingId):null;
    if(t&&!skipConfirm){
      // 未保存直接退出 → 提示「放弃本次编辑」
      const snap0=_history[0]||{};
      const dirty=(t.title||'')!==(snap0.title||'')||(t.body||'')!==(snap0.body||'')||JSON.stringify(t.images||[])!==JSON.stringify(snap0.images||[]);
      if(dirty){
        UI.modal(`<div class="modal-title">放弃本次编辑？</div>
          <div class="small muted" style="text-align:center;margin:0 0 10px">笔记内容会实时自动保存。<br>选择「放弃修改」将恢复到你打开编辑前的状态。</div>
          <div class="flex gap8 mt8">
            <button class="btn btn-ghost btn-block" onclick="UI.close()">继续编辑</button>
            <button class="btn btn-danger btn-block" onclick="Todo.confirmDiscard()">放弃修改</button>
          </div>`);
        return;
      }
    }
    if(t){
      // 先把标题与正文编辑区最终值同步回来（实时保存，空白笔记同样保留）
      const titleEl=document.getElementById('ne-title');
      if(titleEl){t.title=titleEl.value;t.content=titleEl.value;}
      const ta=document.getElementById('ne-text');
      if(ta&&ta.style.display!=='none')t.body=editText(ta);
      // 收尾：周期配置写回（待办）
      const pe=document.getElementById('ne-period');
      if(pe){
        t.period=pe.value;
        if(t.period==='weekly')t.cfg={days:[...document.querySelectorAll('#rc-days .chip.on')].map(c=>+c.dataset.d)};
        else if(t.period==='monthly'){const v=document.getElementById('rc-dom').value;t.cfg={dates:v?[+v]:[]};}
        else if(t.period==='once'){t.cfg={date:document.getElementById('rc-date').value};const sw=document.getElementById('rc-roll');t.rollover=sw?sw.classList.contains('on'):true;}
        else t.cfg={};
      }
      // 待办里空白草稿仍然不保留；备忘录空白笔记允许保存
      if(t.period!=='memo'&&!titleOf(t)&&!(t.body&&t.body.trim())){
        S.get().todos=S.get().todos.filter(x=>x.id!==t.id);
      }
      S.save();
    }
    editingId=null;_history=[];_histIdx=-1;_activeImg=-1;_unsavedNew=false;
    const ov=document.getElementById('note-edit');
    if(ov){
      if(ov._flush)try{window.removeEventListener('pagehide',ov._flush);}catch(e){}
      ov.remove();
    }
    render(true);
  }
  /* 放弃本次编辑：恢复到打开编辑前的快照并关闭 */
  function confirmDiscard(){
    const t=editingId?S.get().todos.find(x=>x.id===editingId):null;
    if(t&&_history[0]){t.title=_history[0].title||'';t.body=_history[0].body||'';t.images=(_history[0].images||[]).slice();S.save();}
    editingId=null;_history=[];_histIdx=-1;_activeImg=-1;_unsavedNew=false;
    const ov=document.getElementById('note-edit');
    if(ov){if(ov._flush)try{window.removeEventListener('pagehide',ov._flush);}catch(e){}ov.remove();}
    UI.close();
    render(true);
  }

  /* ============ 通用操作（保留旧接口） ============ */
  function shift(n){if(n===0){viewDate=S.today();}else{viewDate=S.addDays(viewDate,n);}render();}
  function goToday(){viewDate=S.today();render();}
  /* 内联 onclick 入口：长按后跳过，否则切换完成 */
  function rowTap(id,el){
    if(el&&el.dataset.longpress){delete el.dataset.longpress;return;}
    toggle(id);
  }
  function toggle(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    const dt=viewDate||S.today();const i=(t.done||[]).indexOf(dt);
    if(i>=0)t.done.splice(i,1);else t.done.push(dt);
    S.save();renderList();
    if(window.Home&&homeActive())Home.render();
  }
  function del(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t){UI.close();return;}
    if(t.period==='once'){delForever(id);return;}
    UI.modal(`<div class="modal-title">删除「${esc(titleOf(t))}」</div>
      <div class="small muted" style="margin-bottom:12px">这是一个${periodLabel(t)}笔记。</div>
      <button class="btn btn-primary btn-block" onclick="Todo.delOnce('${id}')">只删 ${S.fmtCN(viewDate)} 这一次</button>
      <div class="small muted mt8" style="text-align:center">其他日期照常出现</div>
      <button class="btn btn-ghost btn-block mt12" style="color:#e06a86" onclick="Todo.delForever('${id}')">永久删除</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">取消</button>`);
  }
  function delOnce(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t)return;
    if(!Array.isArray(t.skip))t.skip=[];
    if(!t.skip.includes(viewDate))t.skip.push(viewDate);
    const di=(t.done||[]).indexOf(viewDate);if(di>=0)t.done.splice(di,1);
    S.save();UI.close();render();
    if(window.Fat)try{Fat.render();}catch(e){}
  }
  function delForever(id){
    const t=S.get().todos.find(x=>x.id===id);
    if(t&&t.planId){const p=(S.get().exPlans||[]).find(x=>x.id===t.planId);if(p)p.todoId='';}
    S.get().todos=S.get().todos.filter(x=>x.id!==id);
    S.save();UI.close();render();
    if(window.Fat)try{Fat.render();}catch(e){}
  }
  function edit(id){openEditor(id);}
  function openMonthPick(){UI.datePicker(viewDate,ds=>{viewDate=ds;render();},'选择日期');}
  function pickDate(ds){viewDate=ds;UI.close();render();}

  /* 新增：待办 / 备忘录 / 私密 各自独立入口（不再共用一个按钮） */
  function openAdd(kind){
    if(kind==='pvt'&&!S.get().notesLock){
      ensureLock(()=>{tab='pvt';render();});return;
    }
    openEditor(null,kind);
  }

  /* 待办旧样式：右上角「+ 新增」弹出的底部任务表单 */
  function openAddTask(){
    UI.modal(`
      <div class="modal-title">新增任务</div>
      <div class="field">
        <label>任务内容</label>
        <input id="ta-content" placeholder="今天想完成什么？">
      </div>
      <div class="field">
        <label>周期类型</label>
        <div class="seg" id="ta-period">
          <div class="opt on" data-v="once">单次</div>
          <div class="opt" data-v="daily">每日计划</div>
          <div class="opt" data-v="weekly">周计划</div>
          <div class="opt" data-v="monthly">月计划</div>
        </div>
      </div>
      <div class="field">
        <label>跟练视频链接（可选，运动任务可填）</label>
        <input id="ta-video" placeholder="https://...">
      </div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.saveTask()">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>
    `);
    setTimeout(()=>{
      document.querySelectorAll('#ta-period .opt').forEach(o=>{
        o.onclick=()=>{
          document.querySelectorAll('#ta-period .opt').forEach(x=>x.classList.remove('on'));
          o.classList.add('on');
        };
      });
      const input=document.getElementById('ta-content');if(input)input.focus();
    },0);
  }
  function saveTask(){
    const content=(document.getElementById('ta-content').value||'').trim();
    if(!content){UI.toast('任务内容不能为空');return;}
    const period=(document.querySelector('#ta-period .opt.on')||{}).dataset.v||'daily';
    const videoUrl=normUrl(document.getElementById('ta-video').value||'');
    const t={id:S.uid(),content,title:content,body:'',images:[],category:'',pinned:false,private:false,
      period,cfg:{},done:[],skip:[],planId:'',created:S.today(),videoUrl,imported:false,rollover:period==='once',modified:S.today()};
    S.get().todos.push(t);S.save();
    UI.close();render();UI.toast('已新增待办 ✅');
    if(window.Home&&homeActive())Home.render();
  }

  /* 从运动 / 饮食 / 英语 导入（保持兼容） */
  function addQuick(content,period,el){
    S.get().todos.push({id:S.uid(),content,title:content,body:'',images:[],category:'',pinned:false,private:false,
      period:period||'daily',cfg:{},done:[],skip:[],planId:'',created:S.today(),videoUrl:'',imported:true,rollover:false,modified:S.today()});
    S.save();UI.toast('已加入待办 ✅');
    if(el)el.classList.add('on');
    if(window.Home&&homeActive())Home.render();
  }

  function openImport(){
    const d=S.today();
    const ex=S.S.exercisesToday(d).map(e=>e.type);
    const di=S.S.dietToday(d).map(m=>m.name);
    let html='<div class="modal-title">从其他模块导入</div><div class="small muted mb8">把今天的运动/饮食一键变成待办任务～</div>';
    if(ex.length)html+='<div class="field"><label>运动</label><div class="chips">'+ex.map((x,i)=>`<div class="chip" onclick="Todo.addQuick('运动：${x}','daily',this)">${x}</div>`).join('')+'</div></div>';
    if(di.length)html+='<div class="field"><label>饮食</label><div class="chips">'+di.map(x=>`<div class="chip" onclick="Todo.addQuick('吃饭：${x}','daily',this)">${x}</div>`).join('')+'</div></div>';
    if(!ex.length&&!di.length)html+='<div class="empty">'+I.EMPTY.replace('width="120"','width="70"')+'<p>今天还没有运动或饮食记录可导入</p></div>';
    html+='<button class="btn btn-ghost btn-block mt8" onclick="UI.close()">关闭</button>';
    UI.modal(html);
  }

  /* 跟练视频（保持兼容） */
  function normUrl(u){
    u=(u||'').trim();if(!u)return '';
    if(/^(https?:)?\/\//i.test(u))return u.replace(/^\/\//,'https://');
    if(/^(www\.|[\w-]+\.[a-z]{2,})/i.test(u))return 'https://'+u;
    return u;
  }
  function openVideo(url){
    const u=normUrl(url);if(!u){UI.toast('暂无视频');return;}
    let ok=false;
    try{const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noopener noreferrer';a.style.display='none';document.body.appendChild(a);a.click();document.body.removeChild(a);ok=true;}catch(e){ok=false;}
    if(!ok){try{ok=!!window.open(u,'_blank','noopener');}catch(e){ok=false;}}
    if(!ok){
      UI.modal(`<div class="modal-title">▶ 跟练视频</div>
        <div class="small muted" style="margin-bottom:10px">浏览器拦截了自动跳转，点下面的链接手动打开：</div>
        <a class="btn btn-primary btn-block" href="${u}" target="_blank" rel="noopener noreferrer">立即打开</a>
        <div class="field mt8"><label>或复制链接</label><input value="${u}" onclick="this.select()" readonly></div>
        <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">关闭</button>`);
    }
  }

  /* 右下角悬浮加号：直接新建一条空白笔记（当前分类下） */
  function openAddFloat(){
    if(tab==='todo'){openAdd('todo');return;}
    if(memoCat===CAT_PVT){openAdd('pvt');return;}
    openAdd('memo');
  }

  /* ============ 回收站（备忘录删除后入站，保留 30 天） ============ */
  function diffDays(a,b){try{return Math.round((S.parse(b)-S.parse(a))/86400000);}catch(e){return 0;}}
  function delMemo(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t){UI.close();return;}
    UI.modal(`
      <div class="modal-title">删除笔记</div>
      <div class="small muted" style="text-align:center;margin:0 0 10px">确定删除「${esc(titleOf(t))}」吗？<br>删除后可在回收站 30 天内恢复</div>
      <div class="flex gap8 mt8">
        <button class="btn btn-danger btn-block" onclick="Todo.doDelMemo('${id}')">删除</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
  }
  function doDelMemo(id){
    const t=S.get().todos.find(x=>x.id===id);if(!t){UI.close();return;}
    if(t.planId){const p=(S.get().exPlans||[]).find(x=>x.id===t.planId);if(p)p.todoId='';}
    S.addToTrash(t);
    S.get().todos=S.get().todos.filter(x=>x.id!==id);
    S.save();UI.close();
    // 若正在编辑这条笔记，先退出编辑页
    const ov=document.getElementById('note-edit');
    if(ov&&editingId===id){editingId=null;_history=[];_histIdx=-1;
      if(ov._flush)try{window.removeEventListener('pagehide',ov._flush);}catch(e){}
      ov.remove();}
    render(true);
    if(window.Fat)try{Fat.render();}catch(e){}
    UI.toast('已移到回收站 🗑（30 天内可恢复）');
  }
  function openTrash(){
    const trash=S.get().trash||[];
    S.purgeTrash();
    if(!trash.length){
      UI.modal(`<div class="modal-title">🗑 回收站</div>
        <div class="small muted" style="text-align:center;padding:20px 0">回收站是空的～<br>删除的备忘录会在这里保留 30 天</div>
        <button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>`);
      return;
    }
    const items=trash.slice().reverse().map(x=>{
      const it=x.item||{};const id=it.id||'';
      const daysAgo=diffDays(x.deletedAt,S.today());
      const left=Math.max(0,30-daysAgo);
      return `<div class="trash-row">
        <div class="trash-info">
          <div class="trash-title">${esc(titleOf(it))}</div>
          <div class="trash-sub">${S.fmtCN(x.deletedAt)} 删除 · 还剩 ${left} 天</div>
        </div>
        <div class="trash-acts">
          <button class="trash-btn" onclick="Todo.restoreMemo('${id}')">恢复</button>
          <button class="trash-btn danger" onclick="Todo.eraseMemo('${id}')">彻底删除</button>
        </div>
      </div>`;
    }).join('');
    UI.modal(`<div class="modal-title">🗑 回收站</div>
      <div class="small muted" style="margin-bottom:10px">删除的内容会保留 30 天，过期自动清除</div>
      <div class="trash-list">${items}</div>
      <button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>`);
  }
  function restoreMemo(id){
    UI.close();
    if(S.restoreFromTrash(id)){UI.toast('已恢复 ♻');render();}
    else{UI.toast('该内容已不存在');}
  }
  function eraseMemo(id){
    S.get().trash=(S.get().trash||[]).filter(x=>!(x.item&&x.item.id===id));
    S.save();UI.toast('已彻底删除');openTrash();
  }

  /* 页面挂起 / 关闭 → 私密自动恢复上锁 */
  if(typeof document!=='undefined'&&document.addEventListener){
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')relock();});
    if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('pagehide',relock);
  }

  /* 清空全部备忘录（普通+私密+自定义分类），保留其它 app 数据；不可逆，仅由用户显式调用 */
  function wipeMemos(){
    const st=S.get();
    const all=st.todos||[];
    const before=all.length;
    const kept=all.filter(t=>!(t.period==='memo'||t.private||t.tab==='memo'||t.tab==='pvt'));
    st.todos=kept;
    st.noteCats=[];           // 清空备忘录自定义分类
    pvtUnlocked=false;        // 重置私密锁定状态
    S.save();
    tab='todo';memoCat=CAT_ALL;search='';
    render(true);
    if(window.UI&&UI.toast)UI.toast('已清空全部备忘录（移除了 '+(before-kept.length)+' 条）');
    return {removed:before-kept.length, remaining:kept.length};
  }

  /* 一次性自动清空：用户要求直接删除全部旧备忘录（不可逆）。靠 memosWiped 标记只执行一次，
     不会误删之后新建的笔记；不在加载时强制 render，交由 app 正常渲染展示空状态。 */
  if(typeof window!=='undefined'){
    const autoWipeMemos=()=>{
      if(S.get().memosWiped)return;
      const all=S.get().todos||[];
      const has=all.some(t=>t.period==='memo'||t.private||t.tab==='memo'||t.tab==='pvt');
      if(has){
        S.get().todos=all.filter(t=>!(t.period==='memo'||t.private||t.tab==='memo'||t.tab==='pvt'));
        S.get().noteCats=[]; S.save();
        if(window.UI&&UI.toast)UI.toast('已自动清空旧备忘录');
      }
      S.get().memosWiped=true; S.save();
    };
    if(document.readyState==='complete'||document.readyState==='interactive')autoWipeMemos();
    else window.addEventListener('DOMContentLoaded',autoWipeMemos);
  }

  /* ============ 隐藏隐私入口：大幅下拉触发密码弹窗（无任何可见入口） ============ */
  const PVT_PULL=320;       // 下拉阈值（轻拉 / 普通拉动不触发）
  let _pullBound=false;
  function canPvtGate(){
    return tab==='memo'&&!multi&&memoCat!==CAT_PVT
      && !document.getElementById('note-edit')
      && !document.querySelector('.modal-mask,.modal-wrap');
  }
  function bindPvtPull(){
    if(_pullBound)return;_pullBound=true;
    const page=document.getElementById('page-todo');if(!page)return;
    let startY=0,pulling=false,pull=0,wheelAcc=0,wheelTimer=null;
    function reset(){pulling=false;pull=0;}
    function onStart(e){
      if((window.scrollY||document.documentElement.scrollTop||0)>0)return; // 仅在置顶累计
      startY=e.touches?e.touches[0].clientY:0;
      pulling=startY>0;pull=0;
    }
    function onMove(e){
      if(!pulling)return;
      const y=e.touches?e.touches[0].clientY:0;
      const dy=y-startY;
      if(dy<=0){pull=0;return;}            // 向上滑动不累计
      pull=dy;
      if(pull>=PVT_PULL){reset();if(canPvtGate())pvtGate();}
    }
    function onWheel(e){
      if((window.scrollY||document.documentElement.scrollTop||0)>0)return;
      if(e.deltaY<0){wheelAcc+=(-e.deltaY);clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>{wheelAcc=0;},500);
        if(wheelAcc>=PVT_PULL){wheelAcc=0;if(canPvtGate())pvtGate();}}
      else wheelAcc=0;
    }
    page.addEventListener('touchstart',onStart,{passive:true});
    page.addEventListener('touchmove',onMove,{passive:true});
    page.addEventListener('touchend',reset,{passive:true});
    page.addEventListener('touchcancel',reset,{passive:true});
    page.addEventListener('wheel',onWheel,{passive:true});
  }
  function pvtGate(){
    if(!canPvtGate())return;
    if(pvtUnlocked){enterPvt();return;}
    if(!S.get().notesLock){setPvtPassModal();return;} // 首次：自动设密码
    pvtPassModal();
  }
  function enterPvt(){
    memoCat=CAT_PVT;multi=false;multiSel={};
    if(S.get().notesLock)pvtUnlocked=true;
    render();
  }
  /* 密码验证弹窗（下拉唤起隐私空间触发） */
  function pvtPassModal(){
    UI.modal(`
      <div class="modal-title">🔒 隐私空间</div>
      <div class="small muted" style="text-align:center;margin:0 0 10px">输入密码进入，内容仅对你可见</div>
      <div class="field"><input id="pvt-input" type="password" inputmode="numeric" placeholder="请输入密码" autocomplete="off" onkeydown="if(event.key==='Enter')Todo.pvtSubmit()"></div>
      <div class="pvt-err" id="pvt-err"></div>
      <button class="btn btn-primary btn-block mt8" onclick="Todo.pvtSubmit()">进入</button>
      <div class="pvt-foot">
        <button class="link" onclick="UI.close()">取消</button>
        <button class="link" onclick="Todo.pvtForget()">忘记密码？</button>
      </div>`);
    setTimeout(()=>{const i=document.getElementById('pvt-input');if(i)i.focus();},0);
  }
  function pvtSubmit(){
    const inp=document.getElementById('pvt-input');if(!inp)return;
    const v=inp.value||'';
    if(v===S.get().notesLock){UI.close();pvtUnlocked=true;enterPvt();}
    else{const e=document.getElementById('pvt-err');if(e)e.textContent='密码错误，请重试';inp.value='';inp.focus();}
  }
  function pvtForget(){pvtResetModal();}
  function pvtResetModal(){
    UI.modal(`
      <div class="modal-title">重置隐私密码</div>
      <div class="small muted mb8">验证旧密码后设置新密码（私密笔记将用新密码重新上锁）</div>
      <div class="field"><input id="pvt-old" type="password" placeholder="旧密码" autocomplete="off"></div>
      <div class="field"><input id="pvt-new" type="password" placeholder="新密码" autocomplete="off"></div>
      <div class="pvt-err" id="pvt-reset-err"></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.pvtDoReset()">确认重置</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
  }
  function pvtDoReset(){
    const oldV=(document.getElementById('pvt-old').value||''), neu=(document.getElementById('pvt-new').value||'').trim();
    if(oldV!==S.get().notesLock){const e=document.getElementById('pvt-reset-err');if(e)e.textContent='旧密码不正确';return;}
    if(!neu){const e=document.getElementById('pvt-reset-err');if(e)e.textContent='新密码不能为空';return;}
    S.get().notesLock=neu;S.save();UI.close();UI.toast('隐私密码已重置 🔒');
  }
  /* 首次设置密码（下拉进入但还未设过） */
  function setPvtPassModal(){
    UI.modal(`
      <div class="modal-title">🔒 设置隐私密码</div>
      <div class="small muted" style="text-align:center;margin:0 0 10px">为隐私空间设置一个密码，下拉入口才会生效</div>
      <div class="field"><input id="pvt-set" type="password" inputmode="numeric" placeholder="设置密码" autocomplete="off"></div>
      <div class="field"><input id="pvt-set2" type="password" inputmode="numeric" placeholder="再次确认" autocomplete="off" onkeydown="if(event.key==='Enter')Todo.pvtSetConfirm()"></div>
      <div class="pvt-err" id="pvt-set-err"></div>
      <button class="btn btn-primary btn-block mt8" onclick="Todo.pvtSetConfirm()">确认</button>
      <div class="pvt-foot"><button class="link" onclick="UI.close()">取消</button></div>`);
    setTimeout(()=>{const i=document.getElementById('pvt-set');if(i)i.focus();},0);
  }
  let _multiAfter=null;
  function pvtSetConfirm(){
    const a=(document.getElementById('pvt-set').value||'').trim(), b=(document.getElementById('pvt-set2').value||'').trim();
    const e=document.getElementById('pvt-set-err');
    if(!a){if(e)e.textContent='密码不能为空';return;}
    if(a!==b){if(e)e.textContent='两次输入不一致';return;}
    S.get().notesLock=a;S.save();pvtUnlocked=true;UI.close();UI.toast('隐私密码已设置 🔒');
    const f=_multiAfter;_multiAfter=null;
    if(f)f();else enterPvt();
  }

  /* ============ 批量多选模式（长按进入） ============ */
  function enterMulti(id){
    if(multi)return;
    multi=true;multiSel={};
    if(id)multiSel[id]=true;
    render();
  }
  function toggleMultiSel(id){
    if(!multi)return;
    if(multiSel[id])delete multiSel[id];else multiSel[id]=true;
    const cnt=Object.keys(multiSel).length;
    const mt=document.querySelector('.multi-t');if(mt)mt.textContent='已选择 '+cnt+' 项';
    const card=document.querySelector('[data-nid="'+id+'"]');
    if(card){const on=!!multiSel[id];card.classList.toggle('sel',on);
      const sc=card.querySelector('.sel-circle');if(sc){sc.classList.toggle('on',on);const sp=sc.querySelector('span');if(sp)sp.textContent=on?'✓':'';}}
  }
  function exitMulti(){multi=false;multiSel={};render();}
  function multiAll(){
    const list=listForTab();
    multiSel={};list.forEach(t=>{if(!t.private)multiSel[t.id]=true;});
    render();
  }
  function batchSetPvt(){
    const ids=Object.keys(multiSel);if(!ids.length){UI.toast('请先选择笔记');return;}
    const doSet=()=>{
      const st=S.get();
      ids.forEach(id=>{const t=st.todos.find(x=>x.id===id);if(t){t.private=true;t.pinned=false;t.modified=S.today();}});
      S.save();enterPvt();UI.toast('已设为私密，移入隐私空间 🔒');
    };
    if(!S.get().notesLock){setPvtPassModal();_multiAfter=doSet;return;}
    doSet();
  }
  function batchPin(){
    const ids=Object.keys(multiSel);if(!ids.length){UI.toast('请先选择笔记');return;}
    const st=S.get();
    ids.forEach(id=>{const t=st.todos.find(x=>x.id===id);if(t&&!t.private){t.pinned=!t.pinned;t.modified=S.today();}});
    S.save();exitMulti();UI.toast('已更新置顶状态 📌');
  }
  function batchMove(){
    const ids=Object.keys(multiSel);if(!ids.length){UI.toast('请先选择笔记');return;}
    const cats=memoCats();
    UI.modal(`
      <div class="modal-title">移动到分类</div>
      <div class="small muted mb8">将选中的 ${ids.length} 条笔记移动到分类</div>
      <div class="chips" id="bm-cats">
        <div class="chip on" data-c="">未分类</div>
        ${cats.map(c=>`<div class="chip" data-c="${esc(c)}">${esc(c)}</div>`).join('')}
      </div>
      <div class="field mt8"><input id="bm-new" placeholder="新分类名（留空=未分类）"></div>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Todo.applyBatchMove()">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
    document.querySelectorAll('#bm-cats .chip').forEach(c=>c.onclick=()=>{
      document.querySelectorAll('#bm-cats .chip').forEach(x=>x.classList.remove('on'));
      c.classList.add('on');document.getElementById('bm-new').value=c.dataset.c;
    });
    _batchIds=ids;
  }
  let _batchIds=[];
  function applyBatchMove(){
    const ids=_batchIds;const v=(document.getElementById('bm-new').value||'').trim();
    if(v&&CAT_RESERVED.indexOf(v)>=0){UI.toast('「'+v+'」是保留名称');return;}
    const st=S.get();
    ids.forEach(id=>{const t=st.todos.find(x=>x.id===id);if(t&&!t.private){t.category=v;if(v&&memoCats().indexOf(v)<0)memoCats().push(v);t.modified=S.today();}});
    S.save();UI.close();exitMulti();UI.toast('已移动到「'+(v||'未分类')+'」');
  }
  function batchDel(){
    const ids=Object.keys(multiSel);if(!ids.length){UI.toast('请先选择笔记');return;}
    UI.modal(`
      <div class="modal-title">删除笔记</div>
      <div class="small muted" style="text-align:center;margin:0 0 10px">确定删除选中的 ${ids.length} 条笔记吗？<br>删除后可在回收站 30 天内恢复</div>
      <div class="flex gap8 mt8">
        <button class="btn btn-danger btn-block" onclick="Todo.doBatchDel()">删除</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>`);
  }
  function doBatchDel(){
    const ids=Object.keys(multiSel);
    const st=S.get();
    ids.forEach(id=>{const t=st.todos.find(x=>x.id===id);if(t)S.addToTrash(t);});
    st.todos=st.todos.filter(x=>!ids.includes(x.id));
    S.save();UI.close();exitMulti();UI.toast('已移到回收站 🗑（30 天内可恢复）');
  }

  window.Todo={
    render,shift,goToday,rowTap,toggle,del,delOnce,delForever,edit,openAdd,openImport,addQuick,openVideo,normUrl,
    toggleCup,openMonthPick,pickDate,setTab,openTab,openCat,setSearch,openNote,
    addCat,applyAddCat,catMenu,renameCat,applyRenameCat,delCat,applyDelCat,
    openEditor,closeEditor,confirmDiscard,finishMemo,insertCheck,insertImage,removeImg,togglePvt,togglePvtFromList,
    setLockPass,setLockPass2,unlock,relock,
    togglePin,moveCategory,applyCategory,toggleBox,renderRecur,openAddFloat,neRender,toggleEditMode,toggleCheckLine,
    openAddTask,saveTask,actionMenu,renameTask,applyRename,changeTime,applyTime,
    undo,redo,aiEdit,applyAiEdit,startVoice,startHandwrite,saveHandwrite,toggleFormat,wrapSelection,copyAll,memoMenu,
    imgDesc,applyImgDesc,imgZoom,imgBig,imgCopy,imgDel,hideImgBar,moveLine,removeLine,
    delMemo,doDelMemo,openTrash,restoreMemo,eraseMemo,wipeMemos,
    enterMulti,exitMulti,multiAll,toggleMultiSel,batchSetPvt,batchPin,batchMove,applyBatchMove,batchDel,doBatchDel,
    pvtGate,bindPvtPull,pvtSubmit,pvtForget,pvtDoReset,pvtSetConfirm,setPvtPassModal,enterPvt,pvtPassModal,pvtResetModal,
    /* 测试/调试用：读取内部状态 */
    _state:()=>({tab,memoCat,search,pvtUnlocked,editingId,multi,multiSel}),
    debugWordCount
  };
})();
