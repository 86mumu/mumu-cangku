/* ============ 我的菜谱 + 今日均衡搭配 ============
   两部分，互不混淆：
   ① 我的菜谱：只展示用户手动录入的菜（custom:true），忌口命中则隐藏。
   ② 今日均衡搭配：食物组合建议（如「1 个煮鸡蛋 + 1 杯无糖豆浆」），
      不是具体菜谱，只保证三餐加起来满足基础摄入量。可「换一批」刷新。

   搭配生成方式（2026-08 升级）：
   · 本地「食材池」随机组合 —— 主食 × 蛋白 × 蔬果 三个槽位自由排列，
     早/午/晚/加餐合计可生成上万种不重样的搭配，不再是固定那几个配方。
   · 联网灵感 —— 每天异步从 TheMealDB 拉取真实菜谱，按食材词典换算成
     中文食材 + 估算热量，作为 🌐 网络灵感搭配附加展示；断网自动隐藏。 */
(function(){
  const S=window.Store;

  /* 用户手动添加的菜谱（只认 custom:true，旧的内置种子菜谱不再展示） */
  function customRecipes(){
    return (S.get().recipes||[]).filter(r=>r&&r.custom===true);
  }
  /* 忌口列表（去空格去空项） */
  function avoidList(){
    return (S.get().avoid||[]).map(a=>String(a||'').trim()).filter(Boolean);
  }
  /* 命中忌口判断：菜名 / 食材 / 做法里出现忌口关键词就算命中 */
  function hitAvoid(r,av){
    if(!av||!av.length)return false;
    const hay=(r.name||'')+' '+(r.ing||'')+' '+((r.steps||[]).join(' '));
    return av.some(a=>hay.indexOf(a)>=0);
  }
  /* 展示用：我的菜谱（已按忌口过滤） */
  function myRecipes(){
    const av=avoidList();
    return customRecipes().filter(r=>!hitAvoid(r,av));
  }
  /* 被忌口挡掉的菜谱（用于提示「已隐藏 N 道」） */
  function avoidHidden(){
    const av=avoidList();
    return customRecipes().filter(r=>hitAvoid(r,av));
  }
  /* 按 id 查一道菜 */
  function getRecipe(id){
    return (S.get().recipes||[]).find(x=>x.id===id)||null;
  }

  /* ================= 食材池（n 名称 / c 热量 / t 忌口标签） ================= */
  const POOL={
    breakfast:{
      carb:[
        {n:'全麦面包 1 片',c:100,t:['全麦','面包','小麦','麸质']},
        {n:'全麦面包 2 片',c:200,t:['全麦','面包','小麦','麸质']},
        {n:'燕麦粥 1 碗',c:120,t:['燕麦']},
        {n:'杂粮粥 1 碗',c:130,t:['杂粮','粗粮']},
        {n:'小米粥 1 碗',c:90,t:['小米']},
        {n:'蒸红薯 1 个',c:140,t:['红薯','薯']},
        {n:'蒸紫薯 1 个',c:120,t:['紫薯','薯']},
        {n:'煮玉米 1 根',c:100,t:['玉米']},
        {n:'杂粮馒头 半个',c:110,t:['馒头','小麦','麸质']},
        {n:'南瓜小米粥 1 碗',c:110,t:['南瓜','小米']},
        {n:'荞麦馒头 半个',c:105,t:['荞麦','麸质']},
        {n:'蒸山药 1 段',c:90,t:['山药']}
      ],
      pro:[
        {n:'水煮蛋 1 个',c:70,t:['鸡蛋','蛋']},
        {n:'茶叶蛋 1 个',c:75,t:['鸡蛋','蛋']},
        {n:'水煮蛋 2 个',c:140,t:['鸡蛋','蛋']},
        {n:'蒸蛋羹 1 碗',c:90,t:['鸡蛋','蛋']},
        {n:'无糖豆浆 1 杯',c:30,t:['豆浆','大豆','豆']},
        {n:'牛奶 1 杯',c:110,t:['牛奶','奶','乳糖']},
        {n:'无糖酸奶 1 杯',c:70,t:['酸奶','奶','乳糖']},
        {n:'嫩豆腐 1 小块',c:60,t:['豆腐','大豆','豆']},
        {n:'鸡胸肉丝 1 小份',c:90,t:['鸡','鸡肉']},
        {n:'低脂奶酪 1 片',c:60,t:['奶酪','奶','乳糖']}
      ],
      side:[
        {n:'圣女果 5 颗',c:40,t:['圣女果','番茄','西红柿']},
        {n:'拌黄瓜 1 份',c:45,t:['黄瓜']},
        {n:'凉拌菠菜 1 份',c:50,t:['菠菜']},
        {n:'苹果 半个',c:30,t:['苹果']},
        {n:'香蕉 1 根',c:110,t:['香蕉']},
        {n:'蓝莓 1 小把',c:40,t:['蓝莓']},
        {n:'焯西兰花 1 份',c:45,t:['西兰花']},
        {n:'凉拌木耳 1 份',c:50,t:['木耳']},
        {n:'核桃 2 个',c:40,t:['核桃','坚果']},
        {n:'紫甘蓝沙拉 1 份',c:45,t:['甘蓝','紫甘蓝']}
      ]
    },
    lunch:{
      carb:[
        {n:'糙米饭 1 拳',c:160,t:['糙米','米饭','大米']},
        {n:'杂粮饭 1 拳',c:170,t:['杂粮','粗粮']},
        {n:'藜麦饭 1 拳',c:160,t:['藜麦']},
        {n:'荞麦面 1 碗',c:180,t:['荞麦','面']},
        {n:'全麦意面 1 碗',c:190,t:['全麦','面','麸质']},
        {n:'蒸紫薯 1 个',c:120,t:['紫薯','薯']},
        {n:'煮玉米 1 根',c:100,t:['玉米']},
        {n:'白米饭 1 小碗',c:150,t:['米饭','大米']},
        {n:'红豆饭 1 拳',c:175,t:['红豆','米饭']},
        {n:'蒸山药 1 段',c:90,t:['山药']}
      ],
      pro:[
        {n:'清蒸鸡胸 1 份',c:130,t:['鸡','鸡肉','鸡胸']},
        {n:'香煎鸡腿（去皮）1 份',c:150,t:['鸡','鸡肉']},
        {n:'青椒炒瘦肉 1 份',c:150,t:['猪肉','瘦肉','青椒']},
        {n:'清蒸鱼 1 块',c:110,t:['鱼','海鲜']},
        {n:'白灼虾 8 只',c:120,t:['虾','海鲜']},
        {n:'香煎豆腐 1 份',c:120,t:['豆腐','大豆','豆']},
        {n:'番茄炒蛋 1 份',c:130,t:['鸡蛋','蛋','番茄','西红柿']},
        {n:'卤牛肉 1 小份',c:140,t:['牛肉','牛']},
        {n:'香煎三文鱼 1 块',c:160,t:['三文鱼','鱼','海鲜']},
        {n:'鸡蛋羹 1 碗',c:90,t:['鸡蛋','蛋']},
        {n:'炖鸡腿肉 1 份',c:145,t:['鸡','鸡肉']},
        {n:'黑椒鸡丁 1 份',c:135,t:['鸡','鸡肉']},
        {n:'清炒虾仁 1 份',c:115,t:['虾','海鲜']},
        {n:'麻酱鸡丝 1 份',c:140,t:['鸡','鸡肉','芝麻']}
      ],
      veg:[
        {n:'蒜蓉西兰花',c:100,t:['西兰花']},
        {n:'清炒时蔬',c:90,t:['时蔬','青菜']},
        {n:'凉拌木耳',c:90,t:['木耳']},
        {n:'冬瓜汤',c:70,t:['冬瓜']},
        {n:'紫菜蛋花汤',c:60,t:['紫菜','鸡蛋','蛋']},
        {n:'清炒芦笋',c:85,t:['芦笋']},
        {n:'蒜蓉菠菜',c:80,t:['菠菜']},
        {n:'手撕包菜',c:85,t:['包菜','甘蓝']},
        {n:'凉拌海带丝',c:70,t:['海带']},
        {n:'番茄豆腐汤',c:80,t:['番茄','西红柿','豆腐','豆']},
        {n:'清炒荷兰豆',c:90,t:['荷兰豆','豆']},
        {n:'蒸南瓜',c:100,t:['南瓜']}
      ]
    },
    dinner:{
      carb:[
        {n:'杂粮粥 1 碗',c:100,t:['杂粮','粗粮']},
        {n:'小米粥 1 碗',c:80,t:['小米']},
        {n:'蒸紫薯 1 个',c:120,t:['紫薯','薯']},
        {n:'蒸南瓜 1 份',c:100,t:['南瓜']},
        {n:'燕麦粥 1 小碗',c:100,t:['燕麦']},
        {n:'糙米饭 半拳',c:80,t:['糙米','米饭','大米']},
        {n:'荞麦面 半碗',c:90,t:['荞麦','面']},
        {n:'煮玉米 1 根',c:100,t:['玉米']},
        {n:'蒸山药 1 段',c:90,t:['山药']},
        {n:'藜麦 半碗',c:80,t:['藜麦']}
      ],
      pro:[
        {n:'虾仁蒸蛋 1 碗',c:130,t:['虾','海鲜','鸡蛋','蛋']},
        {n:'清蒸鱼 1 块',c:110,t:['鱼','海鲜']},
        {n:'香煎豆腐 1 份',c:130,t:['豆腐','大豆','豆']},
        {n:'鸡胸沙拉 1 份',c:120,t:['鸡','鸡肉','鸡胸']},
        {n:'白灼虾 6 只',c:90,t:['虾','海鲜']},
        {n:'番茄蛋花汤 1 碗',c:90,t:['番茄','西红柿','鸡蛋','蛋']},
        {n:'卤鸡腿（去皮）1 个',c:120,t:['鸡','鸡肉']},
        {n:'嫩豆腐羹 1 碗',c:100,t:['豆腐','大豆','豆']},
        {n:'清炒鸡丝 1 份',c:115,t:['鸡','鸡肉']},
        {n:'水煮蛋 1 个',c:70,t:['鸡蛋','蛋']},
        {n:'清蒸鳕鱼 1 块',c:105,t:['鳕鱼','鱼','海鲜']},
        {n:'煮毛豆 1 小碗',c:120,t:['毛豆','豆']}
      ],
      veg:[
        {n:'凉拌菠菜',c:60,t:['菠菜']},
        {n:'焯西兰花',c:100,t:['西兰花']},
        {n:'拌木耳',c:100,t:['木耳']},
        {n:'炒青菜',c:90,t:['青菜','时蔬']},
        {n:'黄瓜拌海带',c:70,t:['黄瓜','海带']},
        {n:'凉拌番茄',c:60,t:['番茄','西红柿']},
        {n:'清炒芦笋',c:85,t:['芦笋']},
        {n:'蒸茄子',c:80,t:['茄子']},
        {n:'凉拌苦瓜',c:55,t:['苦瓜']},
        {n:'白灼菜心',c:75,t:['菜心','青菜']},
        {n:'清炒莴笋',c:80,t:['莴笋']},
        {n:'紫甘蓝沙拉',c:70,t:['甘蓝','紫甘蓝']}
      ]
    },
    snack:{
      main:[
        {n:'苹果 1 个',c:55,t:['苹果']},
        {n:'香蕉 1 根',c:110,t:['香蕉']},
        {n:'无糖酸奶 1 杯',c:70,t:['酸奶','奶','乳糖']},
        {n:'煮毛豆 1 小碗',c:120,t:['毛豆','豆']},
        {n:'黄瓜 1 根',c:15,t:['黄瓜']},
        {n:'圣女果 10 颗',c:35,t:['圣女果','番茄','西红柿']},
        {n:'蓝莓 1 把',c:60,t:['蓝莓']},
        {n:'橙子 1 个',c:60,t:['橙子','柑橘']},
        {n:'猕猴桃 1 个',c:50,t:['猕猴桃']},
        {n:'水煮蛋 1 个',c:70,t:['鸡蛋','蛋']},
        {n:'无糖豆浆 1 杯',c:30,t:['豆浆','大豆','豆']},
        {n:'希腊酸奶 1 小杯',c:90,t:['酸奶','奶','乳糖']},
        {n:'蒸玉米 半根',c:50,t:['玉米']},
        {n:'烤紫薯 半个',c:60,t:['紫薯','薯']}
      ],
      add:[
        {n:'核桃 2 个',c:80,t:['核桃','坚果']},
        {n:'原味坚果 1 小把',c:125,t:['坚果']},
        {n:'杏仁 8 颗',c:60,t:['杏仁','坚果']},
        {n:'黑巧克力 1 小块',c:55,t:['巧克力','可可']},
        {n:'奇亚籽 1 勺',c:30,t:['奇亚籽']},
        {n:'南瓜子 1 小把',c:70,t:['南瓜子','坚果']},
        {n:'开心果 10 颗',c:60,t:['开心果','坚果']},
        {n:'无糖茶 1 杯',c:0,t:['茶']},
        {n:'海苔 1 小包',c:25,t:['海苔','紫菜']},
        {n:'腰果 6 颗',c:60,t:['腰果','坚果']}
      ]
    }
  };
  const MEAL_ORDER=['breakfast','lunch','dinner','snack'];
  const MEAL_CN={breakfast:'早餐',lunch:'午餐',dinner:'晚餐',snack:'加餐'};

  /* 描述模板：按餐次给一句温柔的平衡说明 */
  const DESC={
    breakfast:['蛋白打底配好碳水，一上午都扛饿','粗粮 + 蛋白 + 维C，血糖稳稳的','早餐吃够蛋白，午饭才不会暴食','热食暖胃，配点果蔬更清爽','慢碳水顶饱，不容易犯困'],
    lunch:['优质蛋白配高纤蔬菜，长肌肉不长肉','主食一拳、蛋白一掌、蔬菜两把，刚刚好','低 GI 主食，午后不犯困','荤素搭配均衡，微量元素也补上了','午餐吃扎实一点，晚上才不会想吃宵夜'],
    dinner:['晚餐少油多蔬，睡前胃也舒服','好消化不积食，夜里不反流','薯类替代精米面，纤维拉满','清淡蛋白收尾，第二天不水肿','晚上七分饱，身体轻松睡得香'],
    snack:['低糖高纤，嘴馋时的救星','蛋白 + 好脂肪，下午不摸鱼','天然食物加餐，比饼干强太多','补点水和钾，缓解疲劳','小份量解馋，不影响正餐']
  };

  /* 稳定伪随机：同一个 seed + 槽位 → 同一个结果 */
  function rnd(seed,salt){
    let h=(seed|0)*2654435761 ^ (salt*40503);
    h=(h^(h>>>13))*1274126177;
    return Math.abs(h^(h>>>16));
  }
  /* 从池子里挑一个，先剔除忌口；全被剔完则退回原池 */
  function pickOne(arr,seed,salt,av){
    let list=arr;
    if(av&&av.length)list=arr.filter(x=>!(x.t||[]).some(tag=>av.some(a=>tag.indexOf(a)>=0||a.indexOf(tag)>=0)));
    if(!list.length)list=arr;
    return list[rnd(seed,salt)%list.length];
  }
  /* 去掉数量后缀，取短名用于命名，如「清蒸鸡胸 1 份」→「清蒸鸡胸」 */
  function shortName(n){
    return String(n||'').replace(/\s*(\d+|半|一|两)\s*\S*$/,'').replace(/（.*?）/g,'').trim()||String(n||'');
  }

  /* 生成某一餐的搭配 */
  function makeCombo(meal,seed,av){
    const p=POOL[meal];
    let items;
    if(meal==='snack'){
      const m=pickOne(p.main,seed,101,av);
      const a=pickOne(p.add,seed,203,av);
      items=(rnd(seed,307)%4===0)?[m]:[m,a]; // 25% 概率只吃一样，更真实
    }else{
      const c=pickOne(p.carb,seed,MEAL_ORDER.indexOf(meal)*11+3,av);
      const r=pickOne(p.pro ,seed,MEAL_ORDER.indexOf(meal)*11+7,av);
      const v=pickOne(p.side||p.veg,seed,MEAL_ORDER.indexOf(meal)*11+13,av);
      items=[c,r,v];
    }
    const cal=items.reduce((s,x)=>s+(+x.c||0),0);
    const dl=DESC[meal]||DESC.lunch;
    const main=items.length>1?items[1]:items[0];
    return {
      id:meal+'-'+seed+'-'+items.map(x=>x.n.length).join(''),
      meal,
      name:shortName(main.n)+(items.length>1?' · '+shortName(items[0].n):''),
      combo:items.map(x=>x.n).join(' + '),
      desc:dl[rnd(seed,MEAL_ORDER.indexOf(meal)*17+5)%dl.length],
      cal,
      ingredients:items.map(x=>({n:x.n,c:x.c}))
    };
  }
  function buildCombos(seed,av){
    return MEAL_ORDER.map(m=>makeCombo(m,seed,av));
  }
  /* 各餐可生成的组合数（展示用，让用户知道不会重样） */
  function comboSpace(){
    const out={};
    ['breakfast','lunch','dinner'].forEach(m=>{
      const p=POOL[m];
      out[m]=p.carb.length*p.pro.length*(p.side||p.veg).length;
    });
    out.snack=POOL.snack.main.length*POOL.snack.add.length;
    return out;
  }

  /* ================= 联网灵感（TheMealDB · 断网自动隐藏） ================= */
  /* 常见食材英中对照 + 每份估算热量（映射不到的食材会被跳过） */
  const ING_MAP={
    'chicken':['鸡肉',140],'chicken breast':['鸡胸肉',130],'chicken thighs':['鸡腿肉',150],
    'beef':['牛肉',160],'minced beef':['牛肉末',170],'pork':['猪肉',170],'lamb':['羊肉',170],
    'salmon':['三文鱼',160],'cod':['鳕鱼',105],'tuna':['金枪鱼',120],'prawns':['虾仁',90],
    'shrimp':['虾仁',90],'fish':['鱼肉',110],'egg':['鸡蛋',70],'eggs':['鸡蛋',140],
    'tofu':['豆腐',110],'milk':['牛奶',110],'yogurt':['酸奶',70],'cheese':['奶酪',90],
    'rice':['米饭',160],'brown rice':['糙米饭',160],'basmati rice':['长粒米饭',160],
    'pasta':['意面',190],'spaghetti':['意面',190],'noodles':['面条',180],'bread':['面包',100],
    'potatoes':['土豆',110],'potato':['土豆',110],'sweet potatoes':['红薯',130],
    'oats':['燕麦',120],'flour':['面粉',100],'couscous':['北非小米',150],'quinoa':['藜麦',150],
    'tomatoes':['番茄',30],'tomato':['番茄',30],'onion':['洋葱',30],'onions':['洋葱',30],
    'garlic':['大蒜',5],'carrots':['胡萝卜',35],'carrot':['胡萝卜',35],'broccoli':['西兰花',45],
    'spinach':['菠菜',25],'mushrooms':['蘑菇',25],'peppers':['彩椒',30],'red pepper':['红椒',30],
    'green pepper':['青椒',25],'courgettes':['西葫芦',20],'zucchini':['西葫芦',20],
    'cabbage':['卷心菜',25],'peas':['豌豆',60],'green beans':['四季豆',35],
    'lettuce':['生菜',15],'cucumber':['黄瓜',15],'celery':['芹菜',15],'corn':['玉米',90],
    'lemon':['柠檬',15],'lime':['青柠',15],'apple':['苹果',55],'banana':['香蕉',110],
    'coconut milk':['椰奶',150],'olive oil':['橄榄油',90],'butter':['黄油',100],
    'chickpeas':['鹰嘴豆',120],'lentils':['扁豆',110],'beans':['豆子',110],
    'ginger':['生姜',5],'soy sauce':['酱油',5],'honey':['蜂蜜',60],'sugar':['糖',40],
    'cream':['奶油',100],'parsley':['欧芹',2],'coriander':['香菜',2],'basil':['罗勒',2],
    'nuts':['坚果',120],'almonds':['杏仁',120],'walnuts':['核桃',130],'avocado':['牛油果',160],
    'yoghurt':['酸奶',70],'stock':['高汤',15],'water':['水',0],'salt':['盐',0],'pepper':['胡椒',0]
  };
  const NET_TIMEOUT=9000;
  const NET_MEAL_SLOT=['lunch','dinner','lunch'];

  function mapIng(name){
    const k=String(name||'').trim().toLowerCase();
    if(!k)return null;
    if(ING_MAP[k])return {n:ING_MAP[k][0],c:ING_MAP[k][1]};
    for(const key in ING_MAP){ if(k.indexOf(key)>=0)return {n:ING_MAP[key][0],c:ING_MAP[key][1]}; }
    return null;
  }
  /* 一条 TheMealDB 记录 → 一张中文搭配卡 */
  function mealToCombo(m,slot){
    if(!m)return null;
    const items=[],seen={};
    for(let i=1;i<=20;i++){
      const raw=m['strIngredient'+i];
      if(!raw||!String(raw).trim())continue;
      const hit=mapIng(raw);
      if(!hit||seen[hit.n])continue;
      if(hit.c<=5)continue;            // 调料类不计入热量卡
      seen[hit.n]=1;items.push(hit);
      if(items.length>=4)break;
    }
    if(items.length<2)return null;
    const cal=items.reduce((s,x)=>s+x.c,0);
    return {
      id:'net-'+(m.idMeal||Math.random().toString(36).slice(2)),
      meal:slot||'lunch',
      net:true,
      name:'🌐 '+(m.strMeal||'网络灵感'),
      combo:items.map(x=>x.n).join(' + '),
      desc:'来自网络的'+(m.strArea?m.strArea+'风味':'当季')+'搭配 · '+(m.strCategory||'均衡')+'，热量为按食材估算',
      cal,
      ingredients:items.map(x=>({n:x.n,c:x.c}))
    };
  }
  async function fetchNetCombos(n){
    const out=[];
    const jobs=[];
    for(let i=0;i<(n||3);i++){
      jobs.push((async()=>{
        try{
          const ctl=new AbortController();
          const timer=setTimeout(()=>ctl.abort(),NET_TIMEOUT);
          const res=await fetch('https://www.themealdb.com/api/json/v1/1/random.php',{signal:ctl.signal});
          clearTimeout(timer);
          if(!res.ok)return;
          const j=await res.json();
          const c=mealToCombo(j&&j.meals&&j.meals[0],NET_MEAL_SLOT[i%NET_MEAL_SLOT.length]);
          if(c)out.push(c);
        }catch(e){}
      })());
    }
    await Promise.allSettled(jobs);
    return out;
  }
  /* 每天异步拉一次网络灵感；失败不影响本地搭配。
     并发保护：正在拉取时直接复用同一个 Promise，避免重复请求 / 竞态 */
  let _netPromise=null;
  function ensureNet(force){
    if(_netPromise)return _netPromise;
    const d=S.get();
    if(!d.recipeNet||typeof d.recipeNet!=='object')d.recipeNet={date:'',items:[]};
    const r=d.recipeNet;
    if(!force&&r.netDate===S.today()&&Array.isArray(r.netCombos)&&r.netCombos.length)return Promise.resolve(r.netCombos);
    _netPromise=(async()=>{
      try{
        const list=await fetchNetCombos(3);
        if(list.length){ r.netCombos=list;r.netDate=S.today();r.netOk=true; }
        else{ r.netOk=false; if(!Array.isArray(r.netCombos))r.netCombos=[]; }
        S.save();
        if(window.Fat&&Fat.redrawDiet){try{Fat.redrawDiet();}catch(e){}}
        return r.netCombos||[];
      }catch(e){ r.netOk=false; return []; }
      finally{ _netPromise=null; }
    })();
    return _netPromise;
  }
  /* 网络灵感（已按忌口过滤） */
  function netCombos(){
    const r=S.get().recipeNet||{};
    const av=avoidList();
    const list=Array.isArray(r.netCombos)?r.netCombos:[];
    if(!av.length)return list;
    return list.filter(c=>!av.some(a=>String(c.combo||'').indexOf(a)>=0));
  }
  function netOk(){ const r=S.get().recipeNet||{}; return r.netOk!==false; }

  /* ================= 落库 / 读取 ================= */
  function regenCombos(seed){
    const d=S.get();
    if(!d.recipeNet||typeof d.recipeNet!=='object')d.recipeNet={date:'',items:[]};
    d.recipeNet.seed=(seed|0);
    d.recipeNet.date=S.today();
    d.recipeNet.dailyCombos=buildCombos(seed,avoidList());
    S.save();
    return d.recipeNet.dailyCombos;
  }
  /* 没有就生成；跨天才刷新（同天换一批走 regenCombos） */
  function ensureDaily(){
    const d=S.get();
    if(!d.recipeNet||typeof d.recipeNet!=='object')d.recipeNet={date:'',items:[]};
    if(d.recipeNet.date!==S.today()||!Array.isArray(d.recipeNet.dailyCombos)||!d.recipeNet.dailyCombos.length){
      /* 每天用日期做种子，天然不重样 */
      const t=S.today();
      const daySeed=(+t.slice(0,4))*10000+(+t.slice(5,7))*100+(+t.slice(8,10));
      regenCombos(daySeed);
    }
    try{ ensureNet(false); }catch(e){}   // 异步联网，不阻塞渲染
  }
  /* 读取：始终按当前忌口实时过滤一次，保证忌口即时生效 */
  function dailyCombos(){
    ensureDaily();
    const av=avoidList();
    const stored=S.get().recipeNet.dailyCombos||[];
    if(!av.length)return stored;
    /* 有忌口时：命中忌口的那一餐用同 seed 重新挑一次（会自动避开） */
    const seed=S.get().recipeNet.seed|0;
    return stored.map(c=>{
      const bad=av.some(a=>String(c.combo||'').indexOf(a)>=0);
      return bad?makeCombo(c.meal,seed,av):c;
    });
  }
  /* 按组合文本查找食材热量拆解（用于点击展示详情） */
  function comboIngredients(comboText){
    const r=S.get().recipeNet||{};
    const pools=[].concat(Array.isArray(r.dailyCombos)?r.dailyCombos:[],
                          Array.isArray(r.netCombos)?r.netCombos:[]);
    const hit=pools.find(c=>c&&c.combo===comboText);
    if(hit&&Array.isArray(hit.ingredients)&&hit.ingredients.length)return hit.ingredients;
    /* 兜底：按 " + " 拆开，逐项到池子里查热量 */
    const all=[];
    MEAL_ORDER.forEach(m=>{
      const p=POOL[m];
      Object.keys(p).forEach(k=>p[k].forEach(x=>all.push(x)));
    });
    return String(comboText||'').split(' + ').map(t=>{
      const f=all.find(x=>x.n===t.trim());
      return {n:t.trim(),c:f?f.c:0};
    }).filter(x=>x.n);
  }

  /* 兼容旧调用：具体推荐菜谱库已移除，恒为空；其余保持可用 */
  function refresh(){ if(window.Fat&&Fat.redrawDiet)try{Fat.redrawDiet();}catch(e){} }
  function dailyPool(){ return []; }

  window.Recipes={
    ensureDaily,refresh,getRecipe,
    myRecipes,customRecipes,avoidHidden,avoidList,hitAvoid,
    dailyCombos,regenCombos,dailyPool,comboIngredients,comboSpace,
    netCombos,ensureNet,netOk,
    /* 旧 API 别名，保证其他模块不报错 */
    dailyFiltered:myRecipes
  };
})();
