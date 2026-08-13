/* ============ 木木的工作台 · 数据存储层 ============ */
(function(){
  const KEY = 'mumu_workspace_v2';

  /* ---- 日期工具 ---- */
  function pad(n){return n<10?'0'+n:''+n;}
  function today(){const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function parse(d){const p=d.split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
  function addDays(d,n){const x=parse(d);x.setDate(x.getDate()+n);return x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate());}
  function weekday(d){return parse(d).getDay();} // 0=Sun..6=Sat
  function dayOfMonth(d){return parse(d).getDate();}
  function fmtCN(d){const x=parse(d);return (x.getMonth()+1)+'月'+x.getDate()+'日';}
  function weekCN(d){const w=['日','一','二','三','四','五','六'];return '周'+w[weekday(d)];}
  function weekStart(d){ // 周一为一周开始
    const w=weekday(d); const back=(w===0?6:w-1); return addDays(d,-back);
  }
  function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}

  /* ---- 初中基础词汇（带音标）---- */
  const JUNIOR_RAW = [
    ['gentle','/ˈdʒentl/','温柔的'],
    ['bloom','/bluːm/','开花'],
    ['cozy','/ˈkəʊzi/','温馨的'],
    ['serene','/sɪˈriːn/','宁静的'],
    ['whisper','/ˈwɪspə(r)/','低语'],
    ['apple','/ˈæpl/','苹果'],
    ['happy','/ˈhæpi/','快乐的'],
    ['water','/ˈwɔːtə(r)/','水'],
    ['family','/ˈfæməli/','家庭'],
    ['friend','/frend/','朋友'],
    ['school','/skuːl/','学校'],
    ['morning','/ˈmɔːnɪŋ/','早晨'],
    ['beautiful','/ˈbjuːtɪfl/','美丽的'],
    ['important','/ɪmˈpɔːtnt/','重要的'],
    ['together','/təˈɡeðə(r)/','一起']
  ];
  const JUNIOR_SEED = JUNIOR_RAW.map(r=>({
    id:uid(),word:r[0],phonetic:r[1],mean:r[2],
    status:'new',reviews:[],learnDate:'',stage:0,known:false
  }));

  /* ---- 默认记账分类（宫格图标 · 可编辑）---- */
  const DEF_EXP_CATS = ['早餐','午餐','晚餐','零食','水果','奶茶','甜品','小吃','食材','日用品','出去玩','团购','充电桩','话费','服饰','美妆','家庭','停车','洗车','修车','汽配','减肥','社交','医疗','学习','信用卡','杂','其他'];
  const DEF_INC_CATS = ['工资','兼职','红包','理财','其他'];
  function buildCats(){
    const groups=[
      {id:uid(),name:'餐饮',icon:'🍽️',isGroup:true,parent:null,exb:false},
      {id:uid(),name:'交通',icon:'🚗',isGroup:true,parent:null,exb:false},
    ];
    const foodKids=['早餐','午餐','晚餐'];
    const transKids=['停车','洗车','修车','汽配'];
    const expLeaves=['早餐','午餐','晚餐','零食','水果','奶茶','甜品','小吃','食材','日用品','出去玩','团购','充电桩','话费','服饰','美妆','家庭','停车','洗车','修车','汽配','减肥','社交','医疗','学习','信用卡','杂','其他'];
    const leaves=expLeaves.map(n=>({id:uid(),name:n,icon:n,isGroup:false,parent:foodKids.includes(n)?'餐饮':transKids.includes(n)?'交通':null,exb:false}));
    return {
      expense: groups.concat(leaves),
      income : DEF_INC_CATS.map(n=>({id:uid(),name:n,icon:n,isGroup:false,parent:null,exb:false}))
    };
  }
  /* 旧版本扁平分类 → 两级结构迁移 */
  function migrateCats(){
    ['expense','income'].forEach(t=>{
      const arr=get().cats[t];
      if(!Array.isArray(arr)||!arr.length)return;
      if('isGroup' in arr[0]&&'parent' in arr[0])return; // 已迁移
      if(t==='expense'){
        const parentOf={'早餐':'餐饮','午餐':'餐饮','晚餐':'餐饮','停车':'交通','洗车':'交通','修车':'交通','汽配':'交通'};
        const groups=['餐饮','交通'].map(g=>({id:uid(),name:g,icon:g==='餐饮'?'🍽️':'🚗',isGroup:true,parent:null,exb:false}));
        const leaves=arr.map(c=>({id:c.id||uid(),name:c.name,icon:c.icon||c.name,isGroup:false,parent:parentOf[c.name]||null,exb:false}));
        get().cats[t]=groups.concat(leaves);
      }else{
        get().cats[t]=arr.map(c=>({id:c.id||uid(),name:c.name,icon:c.icon||c.name,isGroup:false,parent:null,exb:false}));
      }
    });
  }

  /* ---- 默认菜谱做法（点击推荐菜可看教程）---- */
  const RECIPE_STEPS = {
    '燕麦牛奶碗':{ing:'即食燕麦40g、牛奶200ml、香蕉半根、蓝莓一小把、蜂蜜少许',steps:['燕麦倒入碗中，加入温牛奶没过燕麦，静置 3 分钟泡软。','香蕉切片、蓝莓洗净铺在表面。','淋一点蜂蜜，喜欢的话再撒些坚果碎即可。']},
    '牛油果全麦吐司':{ing:'全麦吐司2片、牛油果半个、鸡蛋1个、黑胡椒盐少许、柠檬汁几滴',steps:['吐司放平底锅或烤箱，小火烤到两面微脆。','牛油果去核挖出，用叉子压成泥，加几滴柠檬汁和黑胡椒盐拌匀。','另起锅煎一个溏心蛋。','牛油果泥抹在吐司上，放上煎蛋，再撒点黑胡椒即可。']},
    '鸡胸西兰花便当':{ing:'鸡胸肉150g、西兰花200g、糙米饭一小碗、黑胡椒、生抽、橄榄油',steps:['鸡胸肉横刀片薄，用生抽+黑胡椒+一点橄榄油腌 15 分钟。','西兰花掰小朵，沸水加盐焯 2 分钟捞出过凉水，保持翠绿。','平底锅少油，中火把鸡胸两面各煎 3 分钟至微焦，静置 2 分钟再切条（更嫩）。','便当盒里铺糙米饭，摆上鸡胸和西兰花，撒黑胡椒即可。']},
    '藜麦牛肉沙拉':{ing:'藜麦60g、牛里脊150g、圣女果、生菜、紫甘蓝、橄榄油、黑醋',steps:['藜麦洗净，加 1.5 倍水煮 15 分钟至开花，捞出沥干放凉。','牛里脊切块，黑胡椒盐腌 10 分钟，热锅大火快煎 2 分钟至五分熟。','蔬菜洗净撕小块，圣女果对半切。','所有材料拌在一起，淋橄榄油+黑醋，撒盐和黑胡椒即可。']},
    '清蒸鱼+时蔬':{ing:'鲈鱼一条、姜丝、葱丝、蒸鱼豉油、时令青菜200g',steps:['鱼洗净两面划刀，抹少许盐，铺姜丝去腥。','水开后上锅大火蒸 8 分钟（一斤左右的鱼），关火焖 2 分钟。','倒掉盘中腥水，铺上葱丝，淋蒸鱼豉油。','烧一勺热油浇在葱丝上激香。','另起锅清炒时蔬，摆盘一起吃。']},
    '豆腐味噌汤':{ing:'嫩豆腐一盒、味噌2大勺、海带芽少许、葱花、清水500ml',steps:['清水烧开，放入泡发的海带芽煮 2 分钟。','豆腐切小方块下锅，转小火。','味噌先用一小碗热汤化开（不要直接下锅，会结块），再倒回锅中。','汤微微冒泡即关火（味噌久煮会失去香气），撒葱花即可。']},
    '希腊酸奶莓果':{ing:'无糖希腊酸奶150g、草莓/蓝莓/树莓一小碗、奇亚籽1小勺',steps:['酸奶倒入杯中铺底。','莓果洗净，大颗的对半切开，铺在酸奶上。','撒一小勺奇亚籽增加饱腹感和纤维。','想更甜可以淋几滴蜂蜜，冷藏 10 分钟风味更好。']},
    '坚果一小把':{ing:'原味混合坚果25g（大约一小把）',steps:['选原味、无盐无糖烘焙的混合坚果。','用手抓一小把（约 25g）装进小碟，剩下的立刻收起来，避免不知不觉吃过量。','下午 3-4 点当加餐吃，配一杯温水，抗饿又稳血糖。']}
  };
  function seedRecipes(){
    const base=[
      {name:'燕麦牛奶碗',meal:'breakfast',cal:320,protein:14,carb:48,fiber:6},
      {name:'牛油果全麦吐司',meal:'breakfast',cal:300,protein:10,carb:34,fiber:7},
      {name:'鸡胸西兰花便当',meal:'lunch',cal:430,protein:40,carb:40,fiber:6},
      {name:'藜麦牛肉沙拉',meal:'lunch',cal:480,protein:36,carb:45,fiber:8},
      {name:'清蒸鱼+时蔬',meal:'dinner',cal:360,protein:34,carb:22,fiber:5},
      {name:'豆腐味噌汤',meal:'dinner',cal:160,protein:12,carb:14,fiber:3},
      {name:'希腊酸奶莓果',meal:'snack',cal:180,protein:12,carb:20,fiber:3},
      {name:'坚果一小把',meal:'snack',cal:160,protein:5,carb:6,fiber:2}
    ];
    return base.map(r=>{
      const t=RECIPE_STEPS[r.name]||{};
      return Object.assign({},r,{id:uid(),ing:t.ing||'',steps:t.steps||[],custom:false});
    });
  }

  /* ---- 种子数据 ---- */
  function seed(){
    const t=today();
    return {
      user:{name:'木木',avatar:null,streak:1},
      settings:{hideWeight:false,hideMoney:false,calGoal:1600,
        periodRemind:{on:true,days:1,last:''},
        fasting:{on:true,eatStart:'08:00',eatEnd:'16:00'}},
      notesLock:'',    // 记事「私密」分组的解锁口令（本地个人应用，明文存储即可）
      todoDate:t,
      todos:[
        {id:uid(),content:'晨间拉伸 10 分钟',period:'daily',cfg:{},done:[t],created:t,videoUrl:'',imported:false},
        {id:uid(),content:'背单词 10 个',period:'daily',cfg:{},done:[],created:t,videoUrl:'',imported:false,module:'english'},
        {id:uid(),content:'周四瑜伽课',period:'weekly',cfg:{days:[4]},done:[],created:t,videoUrl:'',imported:false}
        // 去掉"喝8杯水"任务，改为独立的水杯追踪系统
      ],
      trash:[], // 回收站：被删除的备忘录/笔记 {item, deletedAt}（仅保留近 30 天）
      exercises:[], // {id,date,type,dur,cal,count,videoUrl}
      exPlans:[     // 运动计划卡片 {id,title,goal,videoUrl,scope:today|week|month,icon,todoId}
        {id:uid(),title:'晨间拉伸',goal:'10 分钟 · 唤醒身体',videoUrl:'',scope:'today',icon:'stretch',todoId:''},
        {id:uid(),title:'帕梅拉燃脂',goal:'每周 3 次 · 每次 20 分钟',videoUrl:'',scope:'week',icon:'hiit',todoId:''}
      ],
      diet:[], // {id,date,meal,name,cal,protein,carb,fiber,img,avoid:[]}
      drinks:[], // 喝喝：奶茶饮品 {id,date,time,name,brand,size,sugar,temp,cal,price,note,img,rating}
      drinkBrands:['喜茶','奈雪','蜜雪冰城','茶百道','古茗','霸王茶姬','星巴克','瑞幸','自制'], // 饮品品牌标签（可追加自定义）
      poops:[],  // 排便记录 {id,date,time,shape,color,amount,smell,feel,dur,blood,body,place,note,score,analysis}
      periods:[],// 经期记录 {id,start,end,flow,symptoms:[],note}
      avoid:[], // 忌口
      recipes:seedRecipes(),
      weights:[], // 兼容字段（保留，已不再主动写入；数据真源见 weightLogs）
      weightLogs:[], // 体重明细真源：{id,date,time,scene,weight(kg),fat(体脂率%)}
      bodyMetrics:[], // 身体维度真源：{id,date,time,key,value(cm),note} key∈waist/chest/hip/thigh/calf/belly
      bills:[], // {id,type,amount,category,note,date,importSource,travel}
      cats:buildCats(), // 记账分类（可编辑名称/排序）
      budget:{month:new Date().getMonth()+1,amount:3000},
      savingsPlans:[], // 存钱计划 {id,name,targetAmount,currentAmount,icon,startDate,endDate,archived}
      waterLog:[], // [{date, done, cups:[bool×8]}]
      medLog:[],   // 吃药打卡 [{date, taken:[0/1 ×3]}]（整肠生 · 每天 一天三顿，含周日）
      english:{
        goal:10,
        words:JUNIOR_SEED,
        checkins:[t],
        study:[{date:t,min:12}],
        timerMin:0, // 手动计时累计分钟数
        book:'初中基础词汇',
        grammarIdx:0,      // 语法小灶：今天第几条
        grammarDate:'',    // 语法小灶：上次轮换日期
        grammarDone:[],    // 已「学会了」的日期
        phoneIdx:0,        // 每日音标：从第几个开始（每天 5 个）
        phoneDate:'',      // 每日音标：上次轮换日期
        phoneDone:[]       // 音标已学会的日期
      },
      travels:[], // {id,title,status,dest,start,end,budget,days:[{date,plan}],pack:[{id,text,done}],billIds:[],notes,tip}
      reviews:[], // {id,type,date,content,modules:[]}
      reading:{lastFetch:'',today:[],history:[],fetched:[],netOk:null}, // 每日深度阅读（联网获取+本地兜底）
      recipeNet:{date:'',items:[],netOk:null}, // 每日健康菜谱（联网获取+本地兜底）
      fastingSession:null, // 当前进行中的轻断食会话 {id,date,fastStart,fastEnd,startedAt,status,pausedTotal,pausedAt}
      fastingHistory:[]   // 轻断食历史记录 [{id,date,fastStart,fastEnd,startedAt,endedAt,status,plannedFastingMin,achievedFastingMin,pausedMin,note}]
    };
  }

  /* ---- 读写 ---- */
  let data=null;
  /* ---- 数据迁移（旧版本结构补齐）---- */
  function migrate(d){
    if(!d||typeof d!=='object')d=seed();
    if(!d.waterLog)d.waterLog=[];
    if(!d.medLog)d.medLog=[];
    (d.medLog||[]).forEach(m=>{
      if(!Array.isArray(m.taken))m.taken=[0,0,0];
      while(m.taken.length<3)m.taken.push(0);
      m.taken=m.taken.map(x=>x?1:0);
    });
    if(d.english&&!d.english.timerMin)d.english.timerMin=0;
    if(d.english){
      if(typeof d.english.phoneIdx!=='number')d.english.phoneIdx=0;
      if(typeof d.english.phoneDate!=='string')d.english.phoneDate='';
      if(!Array.isArray(d.english.phoneDone))d.english.phoneDone=[];
    }
    (d.waterLog||[]).forEach(wl=>{
      if(!Array.isArray(wl.cups))wl.cups=Array(8).fill(0);
      wl.cups=wl.cups.map(c=>c===true?2:(c===false?0:(+c||0)));
      while(wl.cups.length<8)wl.cups.push(0);
      if(!Array.isArray(wl.st))wl.st=Array(8).fill('');
      if(!Array.isArray(wl.et))wl.et=Array(8).fill('');
      while(wl.st.length<8)wl.st.push('');
      while(wl.et.length<8)wl.et.push('');
      wl.done=wl.cups.filter(c=>c===2).length;
    });
    /* 记账分类：旧版没有 cats 字段 → 建默认表；老账单的旧分类名自动补进去 */
    if(!d.cats||!Array.isArray(d.cats.expense)||!d.cats.expense.length){
      d.cats=buildCats();
      const known={};d.cats.expense.forEach(c=>known[c.name]=1);d.cats.income.forEach(c=>known[c.name]=1);
      (d.bills||[]).forEach(b=>{
        if(b.category&&!known[b.category]){
          known[b.category]=1;
          (b.type==='income'?d.cats.income:d.cats.expense).push({id:uid(),name:b.category,icon:'其他'});
        }
      });
    }
    d.cats.expense.forEach(c=>{if(!c.id)c.id=uid();if(!c.icon)c.icon='其他';});
    d.cats.income.forEach(c=>{if(!c.id)c.id=uid();if(!c.icon)c.icon='其他';});

    /* 食记（喝喝）/ 排便 / 经期：新模块数据补齐 */
    if(!Array.isArray(d.drinks))d.drinks=[];
    d.drinks.forEach(x=>{
      if(!x.id)x.id=uid();
      if(typeof x.cal!=='number')x.cal=+x.cal||0;
      if(typeof x.price!=='number')x.price=+x.price||0;
      if(typeof x.name!=='string')x.name='饮品';
      if(typeof x.time!=='string')x.time='';
      if(typeof x.rating!=='number')x.rating=+x.rating||0;
      if(typeof x.img!=='string')x.img=x.img||'';
    });
    if(!Array.isArray(d.drinkBrands)||!d.drinkBrands.length)d.drinkBrands=['喜茶','奈雪','蜜雪冰城','茶百道','古茗','霸王茶姬','星巴克','瑞幸','自制'];
    if(!Array.isArray(d.poops))d.poops=[];
    d.poops.forEach(x=>{
      if(!x.id)x.id=uid();
      if(typeof x.shape==='number')x.shape=[x.shape];
      else if(!Array.isArray(x.shape))x.shape=[+x.shape||4];
      if(typeof x.blood!=='boolean')x.blood=!!x.blood;
      if(typeof x.note!=='string')x.note='';
      if(typeof x.time!=='string')x.time='';
      if(typeof x.score!=='number')x.score=0;
    });
    if(!Array.isArray(d.periods))d.periods=[];
    d.periods.forEach(x=>{
      if(!x.id)x.id=uid();
      if(!Array.isArray(x.symptoms))x.symptoms=[];
      if(typeof x.end!=='string')x.end='';
      if(typeof x.flow!=='string')x.flow='适中';
      if(typeof x.note!=='string')x.note='';
    });

    /* 饮食（吃吃）：补齐 hidden 标记，隐藏的餐次不计入每日摄入 */
    if(!Array.isArray(d.diet))d.diet=[];
    d.diet.forEach(m=>{ if(typeof m.hidden!=='boolean')m.hidden=false; });

    /* 全局设置 */
    if(!d.settings||typeof d.settings!=='object')d.settings={};
    if(typeof d.settings.hideWeight!=='boolean')d.settings.hideWeight=false;
    if(typeof d.settings.hideMoney!=='boolean')d.settings.hideMoney=false;
    if(typeof d.settings.calGoal!=='number')d.settings.calGoal=1600;
    if(typeof d.settings.hideReview!=='boolean')d.settings.hideReview=false;
    if(!d.settings.periodRemind||typeof d.settings.periodRemind!=='object')d.settings.periodRemind={on:true,days:1,last:''};
    if(typeof d.settings.periodRemind.on!=='boolean')d.settings.periodRemind.on=true;
    if(typeof d.settings.periodRemind.days!=='number')d.settings.periodRemind.days=1;
    if(typeof d.settings.periodRemind.last!=='string')d.settings.periodRemind.last='';
    /* 轻断食 16+8 自定义时间窗口 */
    if(!d.settings.fasting||typeof d.settings.fasting!=='object')d.settings.fasting={on:true,eatStart:'08:00',eatEnd:'16:00'};
    if(typeof d.settings.fasting.on!=='boolean')d.settings.fasting.on=true;
    if(typeof d.settings.fasting.eatStart!=='string'||!/^\d{1,2}:\d{2}$/.test(d.settings.fasting.eatStart))d.settings.fasting.eatStart='08:00';
    if(typeof d.settings.fasting.eatEnd!=='string'||!/^\d{1,2}:\d{2}$/.test(d.settings.fasting.eatEnd))d.settings.fasting.eatEnd='16:00';
    /* 轻断食计时会话 / 历史 */
    if(!d.hasOwnProperty('fastingSession'))d.fastingSession=null;
    if(d.fastingSession&&typeof d.fastingSession!=='object')d.fastingSession=null;
    if(d.fastingSession){
      if(typeof d.fastingSession.id!=='string')d.fastingSession.id=uid();
      if(typeof d.fastingSession.date!=='string')d.fastingSession.date=today();
      if(typeof d.fastingSession.status!=='string')d.fastingSession.status='running';
      if(typeof d.fastingSession.pausedTotal!=='number')d.fastingSession.pausedTotal=0;
    }
    if(!Array.isArray(d.fastingHistory))d.fastingHistory=[];
    d.fastingHistory.forEach(h=>{ if(!h.id)h.id=uid(); if(typeof h.date!=='string')h.date=''; if(typeof h.achievedFastingMin!=='number')h.achievedFastingMin=0; });

    /* 身体维度（围度）数据补齐 */
    if(!Array.isArray(d.bodyMetrics))d.bodyMetrics=[];
    d.bodyMetrics.forEach(x=>{
      if(!x.id)x.id=uid();
      if(typeof x.date!=='string')x.date=today();
      if(typeof x.time!=='string')x.time='12:00';
      if(typeof x.key!=='string')x.key='waist';
      if(typeof x.value!=='number')x.value=+x.value||0;
      if(typeof x.note!=='string')x.note='';
    });

    /* 存钱计划 */
    if(!Array.isArray(d.savingsPlans))d.savingsPlans=[];
    d.savingsPlans.forEach(p=>{
      if(!p.id)p.id=uid();
      if(typeof p.name!=='string')p.name='存钱计划';
      if(typeof p.targetAmount!=='number')p.targetAmount=+p.targetAmount||0;
      if(typeof p.currentAmount!=='number')p.currentAmount=+p.currentAmount||0;
      if(typeof p.icon!=='string'||p.icon==='🐷')p.icon='🌿';
      if(typeof p.mode!=='string')p.mode='自由';
      if(!Array.isArray(p.deposits))p.deposits=[];
      if(!Array.isArray(p.withdraws))p.withdraws=[];
      if(typeof p.startDate!=='string')p.startDate=today();
      if(typeof p.endDate!=='string')p.endDate='';
      if(typeof p.archived!=='boolean')p.archived=false;
      // 新字段：周期/起始金额/递增/次数（编辑弹窗需要）
      // 12m/52w/365d 模式已下线，旧计划降级为自由模式保留目标金额
      if(!p.mode||p.mode==='自由'||p.mode==='12m'||p.mode==='52w'||p.mode==='365d'){p.mode='free';p.period='free';p.increment=false;p.times=1;p.baseAmount=0;}
      else if(p.mode==='fixed'){p.period=p.period||'day';p.times=+p.times||1;p.increment=!!p.increment;p.baseAmount=+p.baseAmount||(+p.targetAmount)||0;}
      else {p.mode='free';p.period='free';p.increment=false;p.times=1;p.baseAmount=0;}
    });
    /* 旧计划：把已存金额沉淀为首笔存入记录（避免取出记录与累计不一致） */
    d.savingsPlans.forEach(p=>{
      if((+p.currentAmount||0)>0 && (!p.deposits||!p.deposits.length)){
        p.deposits=[{id:uid(),amount:+p.currentAmount,date:p.startDate||today(),note:'初始存入'}];
      }
    });
    /* 分类两级结构迁移 */
    migrateCats();

    /* 运动计划：目标 = 次数 + 每次时长 */
    if(!Array.isArray(d.exPlans))d.exPlans=[];
    d.exPlans.forEach(p=>{
      if(!p.id)p.id=uid();
      if(!p.scope)p.scope='today';
      if(typeof p.videoUrl!=='string')p.videoUrl='';
      if(typeof p.todoId!=='string')p.todoId='';
      if(!p.icon)p.icon='cardio';
      if(typeof p.times!=='number'||p.times<1){
        const m=/(\d+)\s*次/.exec(p.goal||'');
        p.times=m?+m[1]:(p.scope==='today'?1:3);
      }
      if(typeof p.mins!=='number'||p.mins<1){
        const m=/(\d+)\s*分钟/.exec(p.goal||'');
        p.mins=m?+m[1]:20;
      }
    });

    /* 菜谱：补 id / 做法教程 / 自定义标记 */
    if(!Array.isArray(d.recipes)||!d.recipes.length)d.recipes=seedRecipes();
    d.recipes.forEach(r=>{
      if(!r.id)r.id=uid();
      if(typeof r.custom!=='boolean')r.custom=false;
      if(!Array.isArray(r.steps)||!r.steps.length){
        const t=RECIPE_STEPS[r.name];
        r.steps=t?t.steps.slice():[];
        if(!r.ing)r.ing=t?t.ing:'';
      }
      if(typeof r.ing!=='string')r.ing='';
    });

    /* 待办：单次删除需要 skip 数组；运动计划联动需要 planId；rollover=当天没完成自动顺延 */
    (d.todos||[]).forEach(t=>{
      if(!Array.isArray(t.skip))t.skip=[];
      if(typeof t.planId!=='string')t.planId='';
      if(!Array.isArray(t.done))t.done=[];
      if(typeof t.rollover!=='boolean')t.rollover=(t.period==='once');
      if(t.quota&&(typeof t.quota!=='object'||!(+t.quota.times>0)))t.quota=null;
      /* 记事笔记字段补齐（标题/正文/图片/分类/置顶/私密/修改时间） */
      if(typeof t.title!=='string')t.title='';
      if(typeof t.body!=='string')t.body='';
      if(!Array.isArray(t.images))t.images=[];
      if(typeof t.category!=='string')t.category='';
      if(typeof t.pinned!=='boolean')t.pinned=false;
      if(typeof t.private!=='boolean')t.private=false;
      if(typeof t.modified!=='string')t.modified=t.created||'';
      if(typeof t.content!=='string')t.content=t.title||''; // 旧版只有 content 的，保证不空
    });
    if(typeof d.notesLock!=='string')d.notesLock='';

    /* 体重：旧 weights（按天 morning/night）迁移到 weightLogs（每次称重明细） */
    if(!Array.isArray(d.weightLogs))d.weightLogs=[];
    if(!d.weightLogs.length && Array.isArray(d.weights) && d.weights.length){
      d.weights.forEach(w=>{
        const add=(weight,scene)=>{ if(weight!=null&&weight!==''){ d.weightLogs.push({id:uid(),date:w.date,time:scene==='起床空腹'?'07:30':'21:30',scene,weight:+weight,fat:w.fat||null}); } };
        add(w.morning,'起床空腹'); add(w.night,'入睡前');
      });
    }

    if(d.english&&Array.isArray(d.english.words)){
      const map={};JUNIOR_RAW.forEach(r=>map[r[0]]=r[1]);
      d.english.words.forEach(w=>{
        if(!w.id)w.id=uid();
        if(typeof w.phonetic!=='string')w.phonetic=map[w.word]||'';
        if(typeof w.known!=='boolean')w.known=false;
      });
      /* 扩充词库到 300+：把 WORD_BANK 里还没有的词补进来 */
      if(window.WORD_BANK&&Array.isArray(window.WORD_BANK)){
        const has={};d.english.words.forEach(w=>has[(w.word||'').toLowerCase()]=1);
        window.WORD_BANK.forEach(b=>{
          const k=(b.word||'').toLowerCase();
          if(k&&!has[k]){
            has[k]=1;
            d.english.words.push({id:uid(),word:b.word,phonetic:b.phonetic||'',mean:b.mean||'',
              status:'new',reviews:[],learnDate:'',stage:0,known:false});
          }
        });
      }
      if(typeof d.english.grammarIdx!=='number')d.english.grammarIdx=0;
      if(typeof d.english.grammarDate!=='string')d.english.grammarDate='';
      if(!Array.isArray(d.english.grammarDone))d.english.grammarDone=[];
      const goal=(d.english.goal)||10;
      const todayNew=d.english.words.filter(w=>w.learnDate===today()&&w.status==='new');
      if(todayNew.length>goal){todayNew.slice(goal).forEach(w=>{w.learnDate='';});}
    }
    /* 阅读板块：每日深度阅读 */
    if(!d.reading||typeof d.reading!=='object')d.reading={lastFetch:'',today:[],history:[],fetched:[],netOk:null};
    if(!Array.isArray(d.reading.today))d.reading.today=[];
    if(!Array.isArray(d.reading.history))d.reading.history=[];
    if(!Array.isArray(d.reading.fetched))d.reading.fetched=[];
    if(!d.recipeNet||typeof d.recipeNet!=='object')d.recipeNet={date:'',items:[],netOk:null};
    if(!Array.isArray(d.recipeNet.items))d.recipeNet.items=[];
    return d;
  }

  /* ---- 云端同步（Supabase，仅 anon key + 同步口令，绝不使用 secret）---- */
  const SB_URL='https://acyaohrlgndorohobcpi.supabase.co';
  const SB_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjeWFvaHJsZ25kb3JvaG9iY3BpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NDU0NTEsImV4cCI6MjEwMTAyMTQ1MX0.hLUp4ToLYnUAriar1oj-a-BDis6wfhl6tyHQrICzKhY';
  const SYNC_KEY_LS='WB_SYNC_KEY';
  let sb=null, syncKey=null, sbReady=false, _lastSaved=Date.now(), _autoTimer=null;
  const _cloudCbs=[];
  function _toast(m){try{if(window.UI)UI.toast(m);else console.warn(m);}catch(e){console.warn(m);}}
  function _cloudEmit(){_cloudCbs.forEach(c=>{try{c(syncKey);}catch(e){}});}
  async function _hash(s){
    // 纯 JS SHA-256：无论 http/https/file 哪种打开方式，哈希结果都一致，
    // 避免同一口令在非安全上下文（crypto.subtle 不可用）下退化成不同算法导致两端分裂。
    try{ return window.__sha256Hex(s); }
    catch(e){ return 'k_'+encodeURIComponent(s); }
  }
  /* 连接后每 60 秒静默拉取一次云端最新数据（不弹提示，避免打扰） */
  function startAutoSync(){
    if(_autoTimer)return;
    _autoTimer=setInterval(()=>{ if(syncKey&&sb) cloudPull(false,true); }, 60000);
  }
  function cloudInit(){
    try{
      if(window.supabase&&window.supabase.createClient){
        sb=window.supabase.createClient(SB_URL,SB_ANON,{auth:{persistSession:false}});
        sbReady=true;
        let saved=null;try{saved=localStorage.getItem(SYNC_KEY_LS);}catch(e){}
        // 仅拉取云端，不主动覆盖，避免冲掉其他端的数据（启动时静默）
        if(saved){ syncKey=saved; cloudPull(true,true); }
        startAutoSync();
        _cloudEmit();
      }else{sbReady=true;_cloudEmit();}
    }catch(e){sbReady=true;_cloudEmit();}
  }
  async function cloudConnect(pass){
    if(!sb){_toast('云端未就绪，请刷新页面');return;}
    syncKey=await _hash(pass);
    try{localStorage.setItem(SYNC_KEY_LS,syncKey);}catch(e){}
    await cloudPull(true);   // 连接时只下载
    startAutoSync();
    _cloudEmit();
  }
  function cloudDisconnect(){
    syncKey=null;
    try{localStorage.removeItem(SYNC_KEY_LS);}catch(e){}
    _cloudEmit();
  }
  /* 上传：仅在本地有改动时由 save() 触发，或云端还无该行时作为初始数据上传 */
  function cloudPush(silent){
    if(!sb||!syncKey)return;
    try{
      sb.from('workbench').upsert({sync_key:syncKey,payload:data,updated_at:new Date().toISOString()})
        .then(({error})=>{if(error){console.warn('[sync] push',error.message);if(!silent)_toast('同步失败：'+error.message);}});
    }catch(e){ if(!silent)_toast('同步异常'); }
  }
  /* silent=true 时全程不弹 toast（自动同步用），手动同步才提示 */
  function cloudPull(force,silent){
    if(!sb||!syncKey)return;
    sb.from('workbench').select('payload,updated_at').eq('sync_key',syncKey).maybeSingle()
      .then(({data:row,error})=>{
        if(error){console.warn('[sync] pull',error.message);if(!silent)_toast('拉取失败：'+error.message);return;}
        if(row&&row.payload){
          const tu=new Date(row.updated_at).getTime();
          if(force||tu>_lastSaved){
            data=migrate(row.payload);
            _lastSaved=tu;
            try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){}
            ['Home','Todo','Fat','Acc','Eng','Trav'].forEach(n=>{try{window[n]&&window[n].render&&window[n].render();}catch(e){}});
            if(!silent)_toast('已同步到云端最新数据 ☁️');
          }
        } else {
          // 云端还没有该口令的数据 → 把本地作为初始数据上传
          cloudPush(silent);
        }
        _cloudEmit();
      });
  }
  function cloudRefresh(silent){ cloudPull(false,silent); }

  function load(){
    let raw=null;try{raw=localStorage.getItem(KEY);}catch(e){}
    if(raw){try{data=JSON.parse(raw);}catch(e){data=null;}}
    if(!data)data=seed();
    data=migrate(data);
    purgeTrash();
    save();
    return data;
  }
  /* 回收站：把一条笔记移入回收站（保留 deletedAt），并清理超过 30 天的内容 */
  function addToTrash(item){
    if(!Array.isArray(data.trash))data.trash=[];
    data.trash.push({item,deletedAt:today()});
    purgeTrash();
  }
  function restoreFromTrash(id){
    if(!Array.isArray(data.trash))return false;
    const i=data.trash.findIndex(x=>x.item&&x.item.id===id);
    if(i<0)return false;
    const it=data.trash[i].item;
    if(it&&!get().todos.find(t=>t.id===it.id))get().todos.push(it);
    data.trash.splice(i,1);
    save();return true;
  }
  function purgeTrash(){
    if(!Array.isArray(data.trash)){data.trash=[];return;}
    const cut=addDays(today(),-30);
    const before=data.trash.length;
    data.trash=data.trash.filter(x=>x.deletedAt&&x.deletedAt>=cut);
    if(data.trash.length!==before)save();
  }
  /* save 触发的上传属于自动同步 → 静默，不弹窗 */
  function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){} _lastSaved=Date.now(); cloudPush(true);}
  function get(){return data||load();}
  function reset(){data=seed();save();}
  /* 导出整库为 JSON 字符串（含版本号与时间戳），供备份/迁移 */
  function exportJSON(){
    return JSON.stringify({app:'mumu-workbench',v:2,exportedAt:new Date().toISOString(),data:get()},null,2);
  }
  /* 导入 JSON 备份：校验后整体替换本地数据，重启后由 load() 自动迁移 */
  function importJSON(str){
    const obj=(typeof str==='string')?JSON.parse(str):str;
    const inc=(obj&&typeof obj==='object'&&obj.data)?obj.data:obj;
    if(!inc||typeof inc!=='object')throw new Error('备份文件格式不正确');
    if(!Array.isArray(inc.todos))throw new Error('备份缺少待办数据');
    if(!inc.english||!Array.isArray(inc.english.words))throw new Error('备份缺少单词数据');
    data=inc;save();
  }

  /* ---- 业务读取（跨模块） ---- */
  const S={
    todosToday(d){
      const dt=get().todos.filter(t=>visibleOn(t,d));
      return dt;
    },
    doneToday(d){return get().todos.filter(t=>t.done.includes(d));},
    exercisesToday(d){return get().exercises.filter(e=>e.date===d);},
    dietToday(d){return get().diet.filter(m=>m.date===d);},
    drinksToday(d){return (get().drinks||[]).filter(m=>m.date===d);},
    /* 每日总摄入 = 三餐 + 饮品（喝喝的热量自动合并） */
    intakeToday(d){
      const food=(get().diet||[]).filter(m=>m.date===d && !m.hidden).reduce((s,m)=>s+(+m.cal||0),0);
      const drink=(get().drinks||[]).filter(m=>m.date===d).reduce((s,m)=>s+(+m.cal||0),0);
      return {food,drink,total:food+drink};
    },
    poopsToday(d){return (get().poops||[]).filter(p=>p.date===d);},
    /* 最近 n 天的排便记录（用于首页联动与异常提示） */
    poopsRange(from,to){return (get().poops||[]).filter(p=>p.date>=from&&p.date<=to);},
    periodOn(d){return (get().periods||[]).find(p=>p.start&&p.start<=d&&(p.end?d<=p.end:d<=addDays(p.start,6)));},
    weightToday(d){
      const logs=(get().weightLogs||[]).filter(x=>x.date===d).slice().sort((a,b)=>(a.time||'').localeCompare(b.time||''));
      if(!logs.length)return undefined;
      const f=logs[0], l=logs[logs.length-1];
      return {date:d, morning:f.weight, night:l.weight, fat:l.fat||null, hidden:get().settings.hideWeight};
    },
    latestWeightLog(){
      const a=(get().weightLogs||[]).slice().sort((x,y)=>(x.date+x.time).localeCompare(y.date+y.time));
      return a.length?a[a.length-1]:null;
    },
    /* 身体维度：某日各围度最新值（按记录时间取当日的最后一条） */
    bodyMetricToday(d){
      const ms=(get().bodyMetrics||[]).filter(x=>x.date===d).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
      const map={};
      ms.forEach(x=>{ map[x.key]=x.value; });
      return map;
    },
    /* 身体维度：某围度 key 的最近一次记录 */
    bodyMetricLatest(key){
      const a=(get().bodyMetrics||[]).filter(x=>x.key===key).slice().sort((x,y)=>(x.date+x.time).localeCompare(y.date+y.time));
      return a.length?a[a.length-1]:null;
    },
    weightDaily(from,to){
      const a=(get().weightLogs||[]).filter(x=>x.date>=from&&x.date<=to).slice().sort((x,y)=>(x.date+x.time).localeCompare(y.date+y.time));
      const m={};a.forEach(x=>{m[x.date]=x.weight;});
      return Object.keys(m).sort().map(d=>({date:d,morning:m[d]}));
    },
    billsMonth(ym){return get().bills.filter(b=>b.date.slice(0,7)===ym);},
    savingsTotal(){return (get().savingsPlans||[]).filter(p=>!p.archived).reduce((s,p)=>s+(+p.currentAmount||0),0);},
    savingsTarget(){return (get().savingsPlans||[]).filter(p=>!p.archived).reduce((s,p)=>s+(+p.targetAmount||0),0);},
    englishToday(d){const e=get().english;return e.words.filter(w=>w.learnDate===d && w.status==='new');}
  };
  /* 顺延：单次任务过了指定日期还没完成 → 一直跟到今天为止 */
  function isRolled(t,d){
    if(!t||t.period!=='once')return false;
    if(t.rollover===false)return false;
    const od=(t.cfg||{}).date;
    if(!od||od>=d)return false;
    const done=t.done||[];
    // 完成过就不再往后顺延；但完成的那一天本身仍要留在列表里（显示在「已完成」）
    if(done.length&&!done.includes(d))return false;
    if(Array.isArray(t.skip)&&t.skip.includes(d))return false;
    return d<=today();                            // 只顺延到今天，不污染未来
  }
  /* 配额：本周/本月要做 N 次，做满就不再出现（运动计划「本周 5 次」用） */
  function quotaDone(t,d){
    const q=t&&t.quota;if(!q||!(+q.times>0))return null;
    const done=t.done||[];
    let hit;
    if(q.scope==='day'){hit=done.filter(x=>x===d);}
    else{const ws=weekStart(d),we=addDays(ws,6);hit=done.filter(x=>x>=ws&&x<=we);}
    return {need:+q.times,cnt:hit.length,scope:q.scope==='day'?'今日':'本周'};
  }
  function visibleOn(t,d){
    if(t.private)return false;        // 私密笔记与公开列表完全隔离（不进待办 / 不进首页）
    if(t.period==='memo')return false; // 备忘录不进待办清单
    if(Array.isArray(t.skip)&&t.skip.includes(d))return false; // 单次删除：只跳过这一天
    // 配额已完成 → 本周期内不再出现（当天已打卡的仍留在「已完成」里）
    const q=quotaDone(t,d);
    if(q&&q.cnt>=q.need&&!(t.done||[]).includes(d))return false;
    if(t.period==='daily')return true;
    if(t.period==='once')return (t.cfg&&t.cfg.date===d)||isRolled(t,d);
    if(t.period==='weekly')return (t.cfg.days||[]).includes(weekday(d));
    if(t.period==='monthly')return (t.cfg.dates||[]).includes(dayOfMonth(d));
    return true;
  }

  /* ---- 记账分类读取（供各模块使用）---- */
  function cats(type){const c=get().cats;return (type==='income'?c.income:c.expense)||[];}
  function allCatNames(){const c=get().cats;return c.expense.map(x=>x.name).concat(c.income.map(x=>x.name));}

  window.Store={
    KEY,load,save,get,reset,seed,exportJSON,importJSON,
    addToTrash,restoreFromTrash,purgeTrash,
    today,parse,addDays,weekday,dayOfMonth,fmtCN,weekCN,weekStart,uid,pad,
    S,visibleOn,isRolled,quotaDone,cats,allCatNames,RECIPE_STEPS,
    cloud:{init:cloudInit,connect:cloudConnect,disconnect:cloudDisconnect,refresh:cloudRefresh,push:s=>cloudPush(s),on:fn=>_cloudCbs.push(fn),key:()=>syncKey,ready:()=>sbReady,isOn:()=>!!syncKey}
  };
})();
