/* ============ 食记（吃吃 / 喝喝） ============
   吃吃：原「减脂 → 饮食」整体迁移过来（复用 Fat.renderDietInto）
   喝喝：奶茶饮品记录，热量自动合并进每日摄入总量 */
(function(){
  const S=window.Store, I=window.Icon;
  let sub='eat';
  let viewDate=S.today(); /* 食记日期导航选中的日期（默认今天） */
  let editId=null, form=null;
  let _pendingImg=''; /* 待保存的饮品图片 base64 */

  /* 常见奶茶热量参考（中杯，仅估算，可手动改） */
  const PRESET=[
    {name:'珍珠奶茶',cal:450},{name:'芋泥波波',cal:480},{name:'杨枝甘露',cal:420},
    {name:'柠檬茶',cal:180},{name:'四季春茶（无糖）',cal:15},{name:'生椰拿铁',cal:230},
    {name:'美式咖啡',cal:10},{name:'厚乳拿铁',cal:280},{name:'草莓奶昔',cal:390},
    {name:'葡萄冰茶',cal:260},{name:'桃桃乌龙',cal:230},{name:'可乐',cal:200}
  ];
  const SIZES=['小杯','中杯','大杯'];
  const SUGARS=['无糖','三分糖','五分糖','七分糖','全糖'];
  const TEMPS=['去冰','少冰','正常冰','常温','热','沙冰'];
  /* 糖度对热量的系数（在基准热量上估算） */
  const SUGAR_K={'无糖':0.62,'三分糖':0.78,'五分糖':0.88,'七分糖':0.95,'全糖':1};
  const SIZE_K={'小杯':0.8,'中杯':1,'大杯':1.25};
  /* 按饮品名称估算热量：中杯基准 × 规格 × 糖度。先匹配预设，再按关键词启发式 */
  function drinkEstimate(name, size, sugar){
    const nm=(name||'').trim();
    const sz=SIZE_K[size||'中杯']||1;
    const sg=SUGAR_K[sugar||'全糖']||1;
    let base=null, from='';
    if(nm){
      let hit=PRESET.find(p=>p.name===nm);
      if(!hit)hit=PRESET.find(p=>nm.includes(p.name)||p.name.includes(nm));
      if(hit){base=hit.cal; from=hit.name;}
    }
    if(base===null){
      const kw=[
        {t:['美式','黑咖','americano','black coffee','冷萃'],b:10},
        {t:['摩卡','mocha'],b:300},
        {t:['拿铁','latte','澳白','卡布','cappuccino','oat'],b:200},
        {t:['咖啡','coffee','浓缩'],b:150},
        {t:['星冰乐','frappuccino','奶昔','shake','奶盖'],b:380},
        {t:['奶茶','波波','芋泥','奶绿','烤奶','奶青','牛乳','鲜奶','厚乳','芝士'],b:400},
        {t:['杨枝甘露','芒果'],b:420},
        {t:['柠檬','乌龙','绿茶','红茶','四季春','茉莉','青茶','茶','tea'],b:120},
        {t:['果汁','橙汁','西瓜','葡萄','莓','鲜榨','水果'],b:160},
        {t:['可乐','汽水','雪碧','苏打','soda','cola'],b:200},
        {t:['豆浆','豆奶','soy'],b:120},
        {t:['可可','巧克力','chocolate'],b:250},
        {t:['酸奶','优格','yogurt'],b:150}
      ];
      if(nm){
        const low=nm.toLowerCase();
        for(const k of kw){ if(k.t.some(x=>low.includes(x.toLowerCase()))){base=k.b;from=nm;break;} }
      }
    }
    if(base===null)base=250;
    const cal=Math.round(base*sz*sg);
    return {cal, base:Math.round(base), sizeK:sz, sugarK:sg, matched:!!from, from};
  }

  function brands(){return (S.get().drinkBrands&&S.get().drinkBrands.length)?S.get().drinkBrands:['喜茶','奈雪','蜜雪冰城','茶百道','古茗','霸王茶姬','星巴克','瑞幸','自制'];}
  function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
  function nowHM(){const d=new Date();return S.pad(d.getHours())+':'+S.pad(d.getMinutes());}

  function render(){
    const el=document.getElementById('page-food');if(!el)return;
    const d=S.today();
    const ik=S.S.intakeToday(d);
    const sameDay=viewDate===d;
    el.innerHTML=`
      <div class="page-head">
        <div class="date-line">${S.fmtCN(d)} ${S.weekCN(d)} · 好好吃饭，也好好喝一杯 🍮</div>
        <div class="flex between center">
          <div class="title">食记</div>
          <button class="pill" onclick="Food.report()"><i class="ic">${I.i('chart')}</i> 报告</button>
        </div>
      </div>

      <div class="subtabs">
        <button class="subtab${sub==='eat'?' on':''}" onclick="Food.setSub('eat')">🍚 吃吃</button>
        <button class="subtab${sub==='drink'?' on':''}" onclick="Food.setSub('drink')">🧋 喝喝</button>
      </div>
      <div id="food-eat" class="subview" style="${sub==='eat'?'':'display:none'}"></div>
      <div id="food-drink" class="subview" style="${sub==='drink'?'':'display:none'}"></div>
    `;
    if(sub==='eat'){
      const box=document.getElementById('food-eat');
      if(window.Fat&&Fat.renderDietInto)Fat.renderDietInto(box,viewDate);
      else box.innerHTML='<div class="empty"><p>饮食模块加载中…</p></div>';
      if(window.Recipes)Recipes.ensureDaily(); /* 每天从网络获取新鲜健康菜 */
    }else{
      renderDrink(viewDate);
    }
    if(I&&I.upgrade)I.upgrade(el);
  }
  function setSub(s){sub=(s==='drink'?'drink':'eat');render();}
  /* 日期导航 */
  function shiftView(n){viewDate=S.addDays(viewDate,n);render();}
  function setViewToday(){viewDate=S.today();render();}
  function pickDate(){
    if(window.UI&&UI.datePicker)UI.datePicker(viewDate,ds=>{viewDate=ds;render();},'选择日期');
    else{const inp=document.getElementById('food-date');if(!inp)return;try{inp.showPicker();}catch(e){inp.click();}}
  }
  function onPickDate(v){if(v){viewDate=v;render();}}

  /* ---------- 喝喝日历（月网格 + 缩略图，对齐便便日历） ---------- */
  function monthGridDrink(d){
    const ym=d.slice(0,7);
    const rawW=S.weekday(ym+'-01');
    const startW=(rawW===0?6:rawW-1);
    const days=new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();
    const all=S.get().drinks||[];
    let cells='';
    const wk=['一','二','三','四','五','六','日'];
    let head='';wk.forEach(w=>head+='<div class="cal-h">'+w+'</div>');
    for(let i=0;i<startW;i++)cells+='<div class="dcal-cell empty"></div>';
    for(let i=1;i<=days;i++){
      const ds=ym+'-'+S.pad(i);
      const recs=all.filter(x=>x.date===ds);
      const cls='dcal-cell'+(recs.length?' has':'')+(ds===d?' sel':'');
      let mark='<span class="dcal-ico none"></span>';
      if(recs.length){
        const sorted=[...recs].sort((a,b)=>(a.time||'').localeCompare(b.time||''));
        const lastWithImg=sorted.reverse().find(x=>x.img);
        const src=lastWithImg?lastWithImg.img:'';
        const ico=src?`<img src="${src}" alt="">`:'<i class="dcal-emo">🧋</i>';
        const badge=recs.length>1?`<i class="dcal-n">${recs.length}</i>`:'';
        mark=`<span class="dcal-ico">${ico}${badge}</span>`;
      }
      cells+=`<div class="${cls}" onclick="Food.pickCalDay('${ds}')"><b>${i}</b>${mark}</div>`;
    }
    return '<div class="cal-wk">'+head+'</div><div class="dcal-grid">'+cells+'</div>';
  }
  function shiftMonth(n){
    const y=+viewDate.slice(0,4), m=+viewDate.slice(5,7), day=+viewDate.slice(8,10);
    const dim=new Date(y,m-1+n+1,0).getDate();
    const nd=new Date(y,m-1+n,Math.min(day,dim));
    viewDate=nd.getFullYear()+'-'+S.pad(nd.getMonth()+1)+'-'+S.pad(nd.getDate());
    render();
  }
  function goToday(){viewDate=S.today();render();}
  function pickCalDay(ds){viewDate=ds;render();}

  /* ---------- 喝喝 ---------- */
  function renderDrink(d){
    const box=document.getElementById('food-drink');if(!box)return;
    d=d||S.today();
    const isToday=d===S.today();
    const today=S.S.drinksToday(d).slice().sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    const all=(S.get().drinks||[]).slice().sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
    const recent7=all.filter(x=>x.date>=S.addDays(S.today(),-6));
    const mon=all.filter(x=>x.date.slice(0,7)===d.slice(0,7));
    const monCount=mon.length;
    const monKcal=Math.round(mon.reduce((s,x)=>s+(+x.cal||0),0));
    const monMoney=mon.reduce((s,x)=>s+(+x.price||0),0);

    box.innerHTML=`
      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">${I.i('calendar')}</span>喝喝日历</div>
          <span class="pill${isToday?'':' go-today-pill'}" onclick="${isToday?'':'Food.goToday();return false;'}">${isToday?'今天':'回到今天'}</span></div>
        <div class="mp-head">
          <button onclick="Food.shiftMonth(-1)">‹</button>
          <div class="mp-t">${d.slice(0,4)}年 ${+d.slice(5,7)}月</div>
          <button onclick="Food.shiftMonth(1)">›</button>
        </div>
        ${monthGridDrink(d)}
        <div class="grid3 mt12">
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px">${monCount}</div><div class="lbl">本月杯数</div></div>
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px">${monKcal}</div><div class="lbl">本月热量</div></div>
          <div class="stat" style="box-shadow:none;background:var(--bg)"><div class="num" style="font-size:16px">¥${monMoney}</div><div class="lbl">本月花费</div></div>
        </div>
        <button class="btn btn-primary btn-block mt12" onclick="Food.addDrink()">＋ 记一杯</button>
      </div>

      <div class="card">
        <div class="card-h"><div class="l"><span class="ico">${I.i('note')}</span>近 7 天饮品历史</div>
          <span class="pill">${recent7.length} 杯</span></div>
        <div class="small muted" style="margin-bottom:8px">按时间倒序 · 长按可编辑或删除</div>
        ${recent7.length?recent7.map(dcard).join(''):'<div class="empty">'+I.EMPTY.replace('width="120"','width="70"')+'<p>近 7 天还没有饮品记录～</p></div>'}
      </div>
    `;
    if(I&&I.upgrade)I.upgrade(box);
    box.querySelectorAll('.drink-card').forEach(c=>bindLongPress(c,()=>actions(c.dataset.did)));
  }
  function dcard(x){
    const hot=(+x.cal||0)>=400;
    const stars=x.rating>0?'<span class="dk-stars" style="color:var(--amber,#f5a623)">'+('★'.repeat(x.rating)+'☆'.repeat(5-x.rating))+'</span>':'';
    const img=x.img?`<img class="dk-thumb" src="${x.img}" alt="${esc(x.name)}" onclick="Food.viewImg2('${x.id}')">`:'<span class="dk-ico">'+I.i('cup')+'</span>';
    return `<div class="drink-card" data-did="${x.id}">
      ${img}
      <div class="dk-body">
        <div class="dk-name">${esc(x.name)}</div>
        <div class="small muted">${S.fmtCN(x.date)}${x.time?' '+x.time:''}${x.brand?' · '+esc(x.brand):''} · ${esc(x.size||'中杯')} · ${esc(x.sugar||'全糖')} · ${esc(x.temp||'正常冰')}${stars?' · '+stars:''}</div>
      </div>
      <div class="dk-right">
        <b style="color:${hot?'#e06a80':'var(--pink)'}">${+x.cal||0}</b><span class="small muted"> kcal</span>
        ${x.price?'<div class="small muted">¥'+x.price+'</div>':''}
      </div>
    </div>`;
  }
  /* 本周饮品热量小柱图 */
  function weekChart(ws){
    const days=[];for(let i=0;i<7;i++)days.push(S.addDays(ws,i));
    const vals=days.map(dt=>(S.get().drinks||[]).filter(x=>x.date===dt).reduce((s,x)=>s+(+x.cal||0),0));
    if(!vals.some(v=>v>0))return '';
    const max=Math.max(...vals,1);
    const wk=['一','二','三','四','五','六','日'];
    const bars=days.map((dt,i)=>{
      const h=Math.round(vals[i]/max*70);
      const isT=dt===S.today();
      return `<div class="dw-col"><div class="dw-v">${vals[i]||''}</div>
        <div class="dw-bar" style="height:${Math.max(h,3)}px;opacity:${isT?1:.72}"></div>
        <div class="dw-l${isT?' on':''}">${wk[i]}</div></div>`;
    }).join('');
    return `<div class="card">
      <div class="card-h"><div class="l"><span class="ico">📊</span>本周饮品热量</div>
        <span class="pill">${vals.reduce((a,b)=>a+b,0)} kcal</span></div>
      <div class="dw-chart">${bars}</div>
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
    const x=(S.get().drinks||[]).find(v=>v.id===id);if(!x)return;
    UI.modal(`<div class="modal-title">${esc(x.name)}</div>
      <div class="small muted" style="margin-bottom:10px">${S.fmtCN(x.date)}${x.time?' '+x.time:''} · ${+x.cal||0} kcal</div>
      <button class="btn btn-primary btn-block" onclick="Food.editDrink('${id}')">✏️ 编辑</button>
      <button class="btn btn-ghost btn-block mt8" style="color:#e06a80" onclick="Food.delDrink('${id}')">🗑 删除</button>
      <button class="btn btn-ghost btn-block mt8" onclick="UI.close()">取消</button>`);
  }
  function delDrink(id){
    S.get().drinks=(S.get().drinks||[]).filter(x=>x.id!==id);
    S.save();UI.close();render();UI.toast('已删除');
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
  }

  function addDrink(){
    editId=null;_pendingImg='';
    form={date:viewDate,time:nowHM(),name:'',brand:'其他',size:'中杯',sugar:'五分糖',temp:'正常冰',base:0,cal:0,price:0,rating:0,note:'',img:''};
    openForm();
  }
  function editDrink(id){
    const x=(S.get().drinks||[]).find(v=>v.id===id);if(!x)return;
    editId=id;_pendingImg=x.img||'';form=Object.assign({base:+x.cal||0},x);openForm();
  }
  function seg(field,list,cur){
    return '<div class="seg wrap" data-grp="'+field+'">'+list.map(v=>
      '<span class="opt'+(cur===v?' on':'')+'" data-f="'+field+'" data-v="'+esc(v)+'">'+esc(v)+'</span>').join('')+'</div>';
  }
  function brandSeg(cur){
    const bs=brands();
    const items=bs.map(b=>'<span class="opt'+(cur===b?' on':'')+'" data-f="brand" data-v="'+esc(b)+'">'+esc(b)+'</span>').join('');
    return '<div class="seg wrap" data-grp="brand">'+items+'<span class="opt custom" data-custom="1">＋自定义</span></div>';
  }
  function openForm(){
    UI.modal(`
      <div class="modal-title">🥤 ${editId?'编辑':'记一杯'}</div>

      <div class="field"><label>快速选择（点一下自动填名称和热量）</label></div>
      <div class="seg wrap" id="dk-preset">
        ${PRESET.map(p=>'<span class="opt" data-pn="'+esc(p.name)+'" data-pc="'+p.cal+'">'+esc(p.name)+'</span>').join('')}
      </div>

      <div class="field mt12"><label>饮品名称</label><input id="dk-name" value="${esc(form.name||'')}" placeholder="如 三分糖芋泥波波"></div>
      <div class="field"><label>品牌（点「＋自定义」可手写新品牌，会自动加入标签）</label></div>${brandSeg(form.brand)}
      <div class="field mt8"><label>评价（1-5 星）</label></div>
      <div class="seg wrap" id="dk-rating">
        ${[1,2,3,4,5].map(n=>'<span class="opt'+(form.rating===n?' on':'')+'" data-f="rating" data-v="'+n+'">'+('★'.repeat(n)+'☆'.repeat(5-n))+' '+n+'</span>').join('')}
      </div>
      <div class="field mt8"><label>规格</label></div>${seg('size',SIZES,form.size)}
      <div class="field mt8"><label>糖度</label></div>${seg('sugar',SUGARS,form.sugar)}
      <div class="field mt8"><label>温度</label></div>${seg('temp',TEMPS,form.temp)}

      <div class="field mt8"><label>奶茶照片（可选）</label></div>
      <div class="flex gap8">
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="Food.upDrinkImg()">📷 加图片</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" ${_pendingImg?'':'disabled style="opacity:.5"'} onclick="Food.clearDrinkImg()">移除</button>
      </div>
      <input type="file" id="dk-img" accept="image/*" hidden onchange="Food.onDrinkImg(this.files[0])">
      ${_pendingImg?`<img id="dk-img-prev" src="${_pendingImg}" style="width:100%;border-radius:12px;max-height:160px;object-fit:cover;margin-top:8px;display:block">`:''}

      <div class="grid3 mt12">
        <div class="field"><label>热量 kcal</label><input id="dk-cal" type="number" value="${+form.cal||0}"></div>
        <div class="field"><label>价格 ¥</label><input id="dk-price" type="number" step="0.1" value="${+form.price||0}"></div>
        <div class="field"><label>时间</label><input id="dk-time" type="time" value="${form.time||''}"></div>
      </div>
      <div class="field"><label>日期</label><input id="dk-date" type="date" value="${form.date}"></div>
      <div class="field"><label>备注</label><input id="dk-note" value="${esc(form.note||'')}" placeholder="和朋友一起喝的～"></div>

      <div class="small muted" id="dk-hint" style="margin-top:6px"></div>

      <button class="btn btn-ghost btn-block mt8" onclick="Food.askDoubao()">💡 喝喝助手（本地·免费·免配置）</button>

      <div class="flex gap8 mt12">
        <button class="btn btn-primary btn-block" onclick="Food.saveDrink()">保存</button>
        <button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button>
      </div>
    `);
    const root=document.querySelector('.modal');
    // 预设：填名称 + 基准热量，再按规格/糖度换算
    root.querySelectorAll('#dk-preset .opt').forEach(o=>o.onclick=()=>{
      root.querySelectorAll('#dk-preset .opt').forEach(x=>x.classList.remove('on'));
      o.classList.add('on');
      form.name=o.dataset.pn; form.base=+o.dataset.pc||0;
      document.getElementById('dk-name').value=form.name;
      recalc();
    });
    root.addEventListener('click',e=>{
      const o=e.target.closest('[data-f]');if(!o)return;
      const f=o.dataset.f, v=o.dataset.v;
      if(f==='brand'){
        form.brand=v;
        o.parentElement.querySelectorAll('[data-f="brand"]').forEach(x=>x.classList.remove('on'));
        o.classList.add('on');
        return;
      }
      form[f]=v;
      o.parentElement.querySelectorAll('[data-f="'+f+'"]').forEach(x=>x.classList.remove('on'));
      o.classList.add('on');
      recalc();
      if(!form.base)autoEstimateCal();
    });
    // 「＋自定义」品牌 → 弹窗手动输入
    const customTag=root.querySelector('[data-custom]');
    if(customTag)customTag.onclick=()=>openBrandPopup();
    const calEl=document.getElementById('dk-cal');
    if(calEl)calEl.oninput=()=>{form.cal=+calEl.value||0;form.base=0;form.manualCal=true;hint();};
    const nameEl=document.getElementById('dk-name');
    if(nameEl)nameEl.oninput=()=>onNameInput();
    if(!form.base&&!form.manualCal)autoEstimateCal();
    hint();
  }
  /* 自定义品牌弹窗：输入后加入 drinkBrands 标签并选中 */
  function openBrandPopup(){
    UI.modal('<div class="modal-title">自定义品牌</div>'
      +'<div class="small muted mb8">输入新品牌名称，保存后会自动加入下方标签，下次直接点选～</div>'
      +'<div class="field"><input id="cb-brand" placeholder="如 库迪咖啡 / CoCo" value="'+esc(form.brand&&!brands().includes(form.brand)?form.brand:'')+'"></div>'
      +'<div class="flex gap8 mt12">'
      +'<button class="btn btn-primary btn-block" onclick="Food.confirmBrand()">保存</button>'
      +'<button class="btn btn-ghost btn-block" onclick="UI.close()">取消</button></div>');
    setTimeout(()=>{const e=document.getElementById('cb-brand');if(e)e.focus();},30);
  }
  function confirmBrand(){
    const v=(document.getElementById('cb-brand').value||'').trim();
    if(!v){UI.toast('写个品牌名吧');return;}
    const bs=S.get().drinkBrands;if(!Array.isArray(bs))S.get().drinkBrands=brands().slice();
    if(!S.get().drinkBrands.includes(v))S.get().drinkBrands.push(v);
    form.brand=v;S.save();UI.close();openForm();
  }
  function clearDrinkImg(){_pendingImg='';const p=document.getElementById('dk-img-prev');if(p)p.remove();}
  function upDrinkImg(){const e=document.getElementById('dk-img');if(e)e.click();}
  function onDrinkImg(file){
    if(!file)return;
    const reader=new FileReader();
    reader.onload=e=>{compressImg(e.target.result).then(s=>{_pendingImg=s;const p=document.getElementById('dk-img-prev');if(p)p.src=s;else{const i=document.createElement('img');i.id='dk-img-prev';i.src=s;i.style.cssText='width:100%;border-radius:12px;max-height:160px;object-fit:cover;margin-top:8px;display:block';document.getElementById('dk-img').insertAdjacentElement('afterend',i);}UI.toast('图片已选好 📷');});};
    reader.readAsDataURL(file);
  }
  /* 把照片压到 480px / JPEG，避免撑爆本地存储 */
  function compressImg(dataUrl){
    return new Promise(res=>{
      try{
        const img=new Image();
        img.onload=()=>{
          const max=480;let w=img.width,h=img.height;
          if(w>h&&w>max){h=Math.round(h*max/w);w=max;}else if(h>=w&&h>max){w=Math.round(w*max/h);h=max;}
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;
          cv.getContext('2d').drawImage(img,0,0,w,h);
          res(cv.toDataURL('image/jpeg',0.72));
        };
        img.onerror=()=>res(dataUrl);img.src=dataUrl;
      }catch(e){res(dataUrl);}
    });
  }
  /* 规格 × 糖度 换算热量（仅在选了预设时自动算，手填后不再覆盖） */
  function recalc(){
    if(!form.base){hint();return;}
    const v=Math.round(form.base*(SIZE_K[form.size]||1)*(SUGAR_K[form.sugar]||1));
    form.cal=v;
    const el=document.getElementById('dk-cal');if(el)el.value=v;
    hint();
  }
  function hint(){
    const el=document.getElementById('dk-hint');if(!el)return;
    const cal=+form.cal||0;
    const ik=S.S.intakeToday(form.date||S.today());
    const goal=S.get().settings.calGoal;
    const after=ik.total-(editId?( (S.get().drinks||[]).find(x=>x.id===editId)||{}).cal||0:0)+cal;
    el.innerHTML=(form.base?'已按「'+form.size+' · '+form.sugar+'」估算，可手动修改。<br>':'')+
      '这一杯 <b>'+cal+'</b> kcal，记录后今日摄入约 <b style="color:'+(after>goal?'#e06a80':'var(--pink)')+'">'+after+'</b> / '+goal+' kcal';
  }
  function saveDrink(){
    const name=(document.getElementById('dk-name').value||'').trim();
    if(!name){UI.toast('给这杯取个名字吧');return;}
    const finalBrand=form.brand||'其他';
    const rec={
      date:document.getElementById('dk-date').value||S.today(),
      time:document.getElementById('dk-time').value||'',
      name, brand:finalBrand, size:form.size||'中杯', sugar:form.sugar||'全糖', temp:form.temp||'正常冰',
      cal:+document.getElementById('dk-cal').value||0,
      price:+document.getElementById('dk-price').value||0,
      rating:+form.rating||0,
      note:(document.getElementById('dk-note').value||'').trim(),
      img:_pendingImg||''
    };
    const d=S.get();if(!Array.isArray(d.drinks))d.drinks=[];
    if(editId){const x=d.drinks.find(v=>v.id===editId);if(x)Object.assign(x,rec);}
    else d.drinks.push(Object.assign({id:S.uid()},rec));
    S.save();UI.close();
    sub='drink';render();
    UI.toast('已记下这一杯 🥤 热量已并入今日摄入');
    if(document.getElementById('page-home').classList.contains('active'))Home.render();
  }

  /* 放大饮品图片 */
  function viewImg2(id){
    const x=(S.get().drinks||[]).find(v=>v.id===id);if(!x||!x.img)return;
    UI.modal(`<div class="modal-title">${esc(x.name)}</div>
      <img src="${x.img}" style="width:100%;border-radius:14px;display:block">
      <div class="small muted mt8" style="text-align:center">${S.fmtCN(x.date)}${x.time?' '+x.time:''} · ${+x.cal||0} kcal</div>
      <button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>`);
  }

  /* ---------- 周报 / 月报 / 年报 / 全部 ---------- */
  function report(){
    UI.modal(`<div class="modal-title">📈 食记报告</div>
      <div class="subtabs" style="margin-bottom:12px">
        <button class="subtab on" id="rp-w" onclick="Food.reportTab('week')">周报</button>
        <button class="subtab" id="rp-m" onclick="Food.reportTab('month')">月报</button>
        <button class="subtab" id="rp-y" onclick="Food.reportTab('year')">年报</button>
        <button class="subtab" id="rp-a" onclick="Food.reportTab('all')">全部</button>
      </div>
      <div id="rp-body">${reportHTML('week')}</div>
      <button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>`);
  }
  function reportTab(t){
    ['w','m','y','a'].forEach((k,i)=>{
      const types=['week','month','year','all'];
      const el=document.getElementById('rp-'+k);if(el)el.classList.toggle('on',t===types[i]);
    });
    document.getElementById('rp-body').innerHTML=reportHTML(t);
  }
  function reportHTML(type){
    const today=S.today();
    let from='',label='',days=[];
    if(type==='week'){from=S.weekStart(today);label='本周（'+S.fmtCN(from)+' ~ '+S.fmtCN(today)+'）';}
    else if(type==='month'){from=today.slice(0,8)+'01';label=S.fmtCN(today).slice(0,7)+' 月';}
    else if(type==='year'){from=today.slice(0,4)+'-01-01';label=today.slice(0,4)+' 年';}
    else{label='全部记录';}
    if(from)for(let d=from;d<=today;d=S.addDays(d,1))days.push(d);
    const diet=S.get().diet||[], drinks=S.get().drinks||[];
    const inRange=arr=>arr.filter(x=>x.date>=from&&x.date<=today);
    const dDiet=inRange(diet), dDrink=inRange(drinks);
    const goal=S.get().settings.calGoal;
    const totals=dDiet.map(m=>(+m.cal||0)+(+m.intake||0)); // 餐次热量
    const drinkKcal=dDrink.reduce((s,x)=>s+(+x.cal||0),0);
    const daysTracked=new Set(dDiet.map(m=>m.date)).size;
    const avg=daysTracked?Math.round(dDiet.reduce((s,m)=>s+(+m.cal||0),0)/daysTracked):0;
    const under=dDiet.filter(m=>(+m.cal||0)<=goal).length;
    const spend=dDrink.reduce((s,x)=>s+(+x.price||0),0);
    const brandCnt={};dDrink.forEach(x=>{if(x.brand)brandCnt[x.brand]=(brandCnt[x.brand]||0)+1;});
    const topBrand=Object.keys(brandCnt).sort((a,b)=>brandCnt[b]-brandCnt[a])[0]||'—';
    const avgRate=dDrink.length?((dDrink.reduce((s,x)=>s+(+x.rating||0),0)/dDrink.length).toFixed(1)):'—';
    const bar=(v,max,color)=>{const h=max?Math.max(4,Math.round(v/max*100)):4;return `<div style="height:${h}px;background:${color};border-radius:4px;width:100%"></div>`;};
    const maxKcal=Math.max(goal,avg,1);
    return `
      <div class="small muted" style="margin-bottom:8px">${label}${days.length?' · 共 '+days.length+' 天':''}</div>
      <div class="rep-grid">
        <div class="rep-card"><div class="rep-num">${daysTracked}</div><div class="rep-lbl">有记录天数</div></div>
        <div class="rep-card"><div class="rep-num">${avg}</div><div class="rep-lbl">日均摄入(kcal)</div></div>
        <div class="rep-card"><div class="rep-num">${dDrink.length}</div><div class="rep-lbl">饮品杯数</div></div>
        <div class="rep-card"><div class="rep-num">¥${spend}</div><div class="rep-lbl">饮品花费</div></div>
      </div>
      <div class="card mt12">
        <div class="card-h"><div class="l"><span class="ico">🍽️</span>摄入与饮品</div></div>
        <div class="rep-row"><span>日均摄入（三餐）</span><b>${avg} kcal</b></div>
        <div class="rep-row"><span>达标天数（≤${goal}）</span><b>${under} / ${daysTracked}</b></div>
        <div class="rep-row"><span>饮品总热量</span><b>${drinkKcal} kcal</b></div>
        <div class="rep-row"><span>最常喝品牌</span><b>${esc(topBrand)}</b></div>
        <div class="rep-row"><span>平均评分</span><b>${avgRate} ★</b></div>
        <div class="rep-bar" style="margin-top:8px"><div style="width:${Math.min(100,Math.round(avg/maxKcal*100))}%;background:${avg>goal?'#e06a80':'var(--pink)'};height:8px;border-radius:6px"></div></div>
        <div class="small muted">${avg>goal?'这段时间平均摄入偏高，下一阶段可以稍微清淡点 🥗':'摄入控制得不错，继续保持 💗'}</div>
      </div>
      <div class="small muted mt12">报告基于本地记录生成，仅作回顾参考，不构成任何医学/营养建议 💗</div>
    `;
  }

  /* ---------- 豆包（在线 AI）内置入口：记一杯里直接问 ---------- */
  let dbHistory=[], dbCtx='';
  function buildCtx(){
    const f=form||{};
    const nm=f.name||'未命名饮品';
    const est=drinkEstimate(nm, f.size, f.sugar);
    return nm+' · '+(f.brand||'其他')+' · '+(f.size||'中杯')
      +' · '+(f.sugar||'全糖')+' · '+(f.temp||'正常冰')+' · 估算约 '+est.cal+' kcal';
  }
  /* 切到豆包面板前，先把记一杯输入框的实时内容同步回 form，防止切走丢数据 */
  function syncFormFromDom(){
    const g=id=>document.getElementById(id);
    if(g('dk-name'))form.name=g('dk-name').value;
    if(g('dk-cal'))form.cal=+g('dk-cal').value||0;
    if(g('dk-price'))form.price=+g('dk-price').value||0;
    if(g('dk-time'))form.time=g('dk-time').value;
    if(g('dk-date'))form.date=g('dk-date').value;
    if(g('dk-note'))form.note=g('dk-note').value;
  }
  function askDoubao(){
    syncFormFromDom();
    dbCtx=buildCtx(); dbHistory=[];
    UI.modal(`
      <div class="modal-title">💡 喝喝助手</div>
      <div class="small muted mb8" style="word-break:break-all">当前这杯：${esc(dbCtx)}</div>
      <div class="small muted" style="margin-bottom:8px">本地离线 · 免费 · 无需任何配置，不联网、不消耗 token。问我：热量？糖分？健不健康？配方？</div>
      <div class="db-box" id="db-box"></div>
      <textarea id="db-input" class="db-input" placeholder="问喝喝助手：这杯热量高吗？糖分多不多？适合减脂吗？"></textarea>
      <div class="flex gap8 mt8">
        <button class="btn btn-primary btn-block" onclick="Food.dbSend()">发送</button>
        <button class="btn btn-ghost" onclick="Food.dbBack()">← 记一杯</button>
      </div>
    `);
    dbPaint();
  }
  function dbSaveKey(){}
  function dbEditKey(){}
  function dbFillCal(v){
    form.cal=+v||0;
    if(window.UI&&UI.toast)UI.toast('已记下估算热量 '+form.cal+' kcal，返回「记一杯」即可看到');
  }
  /* 记一杯里：输入名称后实时估算热量（仅在没有手动改热量、且没选预设时） */
  function onNameInput(){
    const el=document.getElementById('dk-name'); if(!el)return;
    form.name=el.value;
    form.base=0;
    if(!form.manualCal)autoEstimateCal();
  }
  function autoEstimateCal(){
    const el=document.getElementById('dk-cal'); if(!el)return;
    if(form.base!==0)return;            // 选了预设：交给 recalc
    if(form.manualCal)return;           // 用户手动改过热量：不覆盖
    if(!form.name)return;
    const est=drinkEstimate(form.name, form.size, form.sugar);
    form.cal=est.cal; el.value=est.cal; hint();
  }
  function dbBack(){ UI.close(); openForm(); }
  function dbFmt(s){ return esc(s||'').replace(/\n/g,'<br>'); }
  function dbPaint(){
    const box=document.getElementById('db-box'); if(!box)return;
    let h='<div class="db-msg ai">你好，我是喝喝助手 💡 这杯 '+dbFmt(dbCtx)+'，想问点什么？热量、糖分、健不健康都可以问我～</div>';
    dbHistory.forEach(m=>{ h+='<div class="db-msg '+(m.role==='user'?'me':'ai')+'">'+dbFmt(m.content)+'</div>'; });
    box.innerHTML=h; box.scrollTop=box.scrollHeight;
  }
  /* 本地离线规则助手：不联网、不收费、无 token。会按「名称+规格+糖度」真正估算热量 */
  function localAnswer(q){
    const f=form||{};
    const name=f.name||'';
    const sugar=f.sugar||'全糖';
    const temp=f.temp||'正常冰';
    const size=f.size||'中杯';
    const qq=(q||'');
    const est=drinkEstimate(name, size, sugar);
    const cal=est.cal;
    // 没填名称却问热量 → 提示先填名称
    if(!name && /热量|算|估算|多少卡|kcal|大卡|cal|填入|填/.test(qq)){
      return '先告诉我这杯叫什么名字（在「饮品名称」里填一下，或点上面的「快速选择」选个相近的），我才能根据名称、规格和糖度帮你估算热量～';
    }
    // 热量 / 估算 意图：真正去算，而不是读你填的热量
    if(/热量|算|估算|多少卡|kcal|大卡|cal|填入|填一下|帮我填/.test(qq)){
      let s='根据「'+name+' · '+size+' · '+sugar+'」，帮你算出来这杯大约 <b>'+cal+' kcal</b>。';
      if(est.matched)s+='（按常见配方基准 '+est.base+' kcal × '+size+'('+est.sizeK+') × '+sugar+'('+est.sugarK+') 估算）';
      else s+='（按同类饮品基准 '+est.base+' kcal 估算，名字写越具体越准）';
      s+='<br><button class="btn btn-primary btn-sm mt8" onclick="Food.dbFillCal('+cal+')">✓ 用 '+cal+' kcal 填入热量框</button>';
      s+=' 想控卡可改选「少糖/无糖 + 小杯」，热量还能再降一截～';
      return s;
    }
    if(/糖|甜|甜度/.test(qq)){
      if(/无|少|低|半|三分/.test(sugar))return name+' 已经是'+sugar+'啦，控糖很棒 👍 维持就好。';
      return name+' 当前是'+sugar+'。减糖建议选「少糖」或「无糖」，既能保留风味又少负担；奶茶类每降一档糖大约少 30~60 kcal。';
    }
    if(/健康|适合|好不|可以喝|能不能|胖|减脂|减肥|热量高|推荐|建议|配方|怎么做|原料|成分|里面|有什么/.test(qq)){
      let s='「'+name+'」'+size+'·'+sugar+' 估算约 <b>'+cal+' kcal</b>。';
      if(cal>=350)s+=' 热量偏高，减脂期建议偶尔喝、别每天，并相应减少其他加餐。';
      else if(cal>=150)s+=' 热量适中，日常喝问题不大，注意当天总热量别超太多。';
      else s+=' 热量较低，基本可以放心喝～';
      s+='<br><button class="btn btn-primary btn-sm mt8" onclick="Food.dbFillCal('+cal+')">✓ 用 '+cal+' kcal 填入热量框</button>';
      s+=' 想更健康：选无糖/少糖、少冰、小杯。';
      return s;
    }
    // 默认：给一个综合小结
    return '关于「'+name+'」('+size+'·'+sugar+'·'+temp+')，我帮你估算约 <b>'+cal+' kcal</b>。问我：算热量？糖分？健不健康？都能答，也能一键把估算填入热量框 💡';
  }
  async function callDoubao(messages){
    // 离线本地规则助手：不联网、不收费、无 token
    let q='';
    for(let i=messages.length-1;i>=0;i--){ if(messages[i].role==='user'){ q=messages[i].content; break; } }
    return localAnswer(q);
  }
  async function dbSend(){
    const inp=document.getElementById('db-input'); if(!inp)return;
    const q=inp.value.trim(); if(!q)return;
    dbHistory.push({role:'user',content:q}); dbPaint(); inp.value='';
    const sys={role:'system',content:'你是喝喝助手，木木的本地离线小助手。用户正在记录一杯饮品，信息：'+dbCtx+'。'};
    const box=document.getElementById('db-box');
    const thinking=document.createElement('div'); thinking.className='db-msg ai'; thinking.textContent='喝喝助手思考中…';
    if(box){box.appendChild(thinking); box.scrollTop=box.scrollHeight;}
    try{
      const ans=await callDoubao([sys].concat(dbHistory));
      dbHistory.push({role:'assistant',content:ans}); dbPaint();
    }catch(e){
      dbHistory.push({role:'assistant',content:'⚠️ '+e.message}); dbPaint();
    }
  }

  window.Food={render,setSub,addDrink,editDrink,delDrink,saveDrink,
    shiftView,setViewToday,pickDate,onPickDate,shiftMonth,goToday,pickCalDay,report,reportTab,
    upDrinkImg,onDrinkImg,clearDrinkImg,confirmBrand,viewImg2,
    askDoubao,dbSend,dbBack,dbSaveKey,dbEditKey,dbFillCal,onNameInput};
})();
