/* ============ AI 能力模拟层（规则式生成，软萌语气） ============ */
(function(){
  const S=window.Store, ICON=window.Icon;

  function greet(h){
    if(h<6)return '夜深啦，木木早点休息，明天又是甜甜的一天 🌙';
    if(h<9)return '早安木木～新的一天从温柔的自己开始 ☀️';
    if(h<12)return '上午好呀，慢慢来，你已经很棒了 🌸';
    if(h<14)return '中午啦，记得好好吃饭补充能量哦 🍱';
    if(h<18)return '下午好，喝口水伸个懒腰，继续闪闪发光 ✨';
    if(h<22)return '晚上好木木，今天也辛苦啦，给自己一个拥抱 🤗';
    return '夜色温柔，放下手机，做个好梦吧 🌟';
  }

  /* 每日小结 */
  function dailySummary(d){
    const t=S.today();
    const todos=S.S.todosToday(d);
    const done=todos.filter(x=>x.done.includes(d));
    const ex=S.S.exercisesToday(d);
    const diet=S.S.dietToday(d);
    const en=S.get().english.words.filter(w=>w.learnDate===d&&w.status==='new');
    const w=S.S.weightToday(d);
    const cal=diet.reduce((s,m)=>s+m.cal,0);
    const exMin=ex.reduce((s,e)=>s+(+e.dur||0),0);

    let lines=[];
    lines.push('🌸 '+S.fmtCN(d)+' · 木木的今日小结');
    lines.push('');
    if(done.length||todos.length){
      const p=todos.length?Math.round(done.length/todos.length*100):0;
      lines.push('📋 待办：完成了 '+done.length+' / '+todos.length+' 项（'+p+'%），每一步都算数～');
    }
    if(ex.length) lines.push('💪 运动：今天动了 '+exMin+' 分钟，身体在悄悄变好呢');
    else lines.push('💪 运动：今天还没动起来，散个步也好呀');
    if(diet.length) lines.push('🍽️ 饮食：记录了 '+diet.length+' 餐，约 '+cal+' kcal，均衡就好');
    else lines.push('🍽️ 饮食：还没记录餐食，记得好好吃饭哦');
    if(en.length) lines.push('📚 英语：今天学了 '+en.length+' 个新词，温润积累中');
    if(w) lines.push('⚖️ 体重：已记录今日体重，保持平常心最重要');
    lines.push('');
    lines.push('你今天也认真生活啦，木木最棒 💗');
    return lines.join('\n');
  }

  /* 全模块周复盘 */
  function weeklyReview(){
    const t=S.today();
    const ws=S.weekStart(t);
    const days=[];for(let i=0;i<7;i++)days.push(S.addDays(ws,i));
    let todoDone=0,todoAll=0,exDays=new Set(),exMin=0,cal=0,words=0,spent=0,income=0;
    const mods=[];
    days.forEach(d=>{
      const td=S.S.todosToday(d);todoAll+=td.length;todoDone+=td.filter(x=>x.done.includes(d)).length;
      const ex=S.S.exercisesToday(d);if(ex.length){exDays.add(d);exMin+=ex.reduce((s,e)=>s+(+e.dur||0),0);}
      const di=S.S.dietToday(d);cal+=di.reduce((s,m)=>s+m.cal,0);
      words+=S.get().english.words.filter(w=>w.learnDate===d).length;
      const ym=d.slice(0,7);S.S.billsMonth(ym).forEach(b=>{if(b.date===d){if(b.type==='expense')spent+=b.amount;else income+=b.amount;}});
    });
    const todoP=todoAll?Math.round(todoDone/todoAll*100):0;
    let L=[];
    L.push('🌸 本周综合复盘（'+S.fmtCN(days[0])+' ~ '+S.fmtCN(days[6])+'）');
    L.push('');
    L.push('【待办】完成 '+todoDone+'/'+todoAll+' 项，达成率 '+todoP+'%。'+ (todoP>=70?'节奏很稳，为你开心～':todoP>=40?'稳步推进，不急不躁 🌿':"慢慢来，完成比完美更重要 🌿"));
    mods.push('待办');
    L.push('【运动】运动 '+exDays.size+' 天，累计 '+exMin+' 分钟。'+(exDays.size>=4?'运动习惯正在养成，超棒！':exDays.size>=2?'有在动就好，下周长一点点 💪':'本周动得少，周末散个步也很治愈 🚶‍♀️'));
    mods.push('运动');
    L.push('【饮食】本周共摄入约 '+cal+' kcal，记得多喝水、蔬菜管够 🥗');
    mods.push('饮食');
    L.push('【体重】'+(S.get().weightLogs.length?'已记录体重变化，体重起伏很正常，别被数字绑架 💗':'这周还没称体重，顺其自然就好'));
    mods.push('体重');
    L.push('【记账】本周支出 ¥'+spent+'，收入 ¥'+income+'。钱花在喜欢的地方就值得 ✨');
    mods.push('记账');
    L.push('【英语】本周学习 '+words+' 个词，'+(words>=20?'词汇量噌噌涨 📚':'每日十分钟，细水长流'));
    mods.push('英语');
    const tr=S.get().travels.filter(x=>x.status==='upcoming').length;
    L.push('【旅游】'+tr+' 个旅行计划在酝酿中，期待出发 🧳');
    mods.push('旅游');
    L.push('');
    L.push('这一周你认真生活、温柔待己，下一周也会很好的 🌟');
    return {content:L.join('\n'),modules:mods};
  }

  /* 旅行方案生成 */
  function travelPlan(dest,days,budget){
    const d=+days||3, b=+budget||3000;
    const per=Math.round(b/d);
    const L=[];
    L.push('🌸 '+dest+' · '+d+'天温柔行程（预算约 ¥'+b+'）');
    L.push('');
    for(let i=1;i<=d;i++){
      L.push('Day '+i+'：');
      if(i===1)L.push('  · 抵达'+dest+'，入住后附近散散步适应环境');
      else if(i===d)L.push('  · 买点小伴手礼，慢悠悠返程');
      else L.push('  · 上午逛景点，午餐尝当地小吃，下午咖啡馆放空，预算约 ¥'+per);
      L.push('');
    }
    L.push('💡 小贴士：每天留点空白时间，旅行是为了松口气，不是赶场哦～');
    return L.join('\n');
  }

  /* ===== 进阶旅行攻略生成（细节输入版） =====
     o: {dest,from,date,time,trans,days,budget,mates,styles:[],stay,note}
     返回 {text, days:[{date,plan}], pack:[string], tip} */
  function travelPlanPro(o){
    o=o||{};
    const dest=(o.dest||'目的地').trim();
    const from=(o.from||'').trim();
    const D=Math.max(1,Math.min(30,+o.days||3));
    const B=Math.max(0,+o.budget||0);
    const trans=o.trans||'高铁';
    const mates=o.mates||'独自';
    const stay=o.stay||'市区酒店';
    const note=(o.note||'').trim();
    const styles=(Array.isArray(o.styles)&&o.styles.length)?o.styles:['美食','闲逛'];
    const startDate=o.date||'';
    const startTime=o.time||'';

    /* --- 交通建议 --- */
    const TRANS={
      '高铁':{lead:'建议提前 40 分钟到站，取票＋安检不慌张',tipTxt:'高铁上备个颈枕和充电宝，靠窗位看风景更舒服',packs:['身份证','颈枕','小零食']},
      '飞机':{lead:'国内航班建议提前 2 小时到机场，国际提前 3 小时',tipTxt:'液体不超 100ml，充电宝必须随身不能托运',packs:['身份证/护照','分装瓶(≤100ml)','眼罩耳塞']},
      '自驾':{lead:'出发前检查胎压、油量、玻璃水，导航先离线下载好',tipTxt:'每 2 小时进一次服务区活动一下，别硬撑',packs:['驾照行驶证','车充','应急药包']},
      '大巴':{lead:'建议提前 20 分钟到客运站，票据留好',tipTxt:'车上颠簸，晕车的话提前半小时吃晕车药',packs:['晕车药','薄毯/外套','耳机']},
      '火车卧铺':{lead:'建议提前 30 分钟到站，上车后先安置好行李',tipTxt:'带个折叠拖鞋和一次性床单，睡得更安心',packs:['折叠拖鞋','一次性床单','洗漱包']},
      '轮渡':{lead:'建议提前 45 分钟到码头，出门前查一下当日海况',tipTxt:'甲板风大，备件防风外套；晕船提前吃药',packs:['防风外套','晕船药','防水袋']}
    };
    const TR=TRANS[trans]||TRANS['高铁'];

    /* --- 出发时间段判断，决定 Day1 强度 --- */
    const hh=startTime?+String(startTime).slice(0,2):9;
    const slot=hh<7?'清早':hh<11?'上午':hh<14?'中午':hh<18?'下午':'晚上';
    const arriveLate=hh>=15;

    /* --- 预算拆解 --- */
    const bk={t:Math.round(B*0.30),h:Math.round(B*0.28),f:Math.round(B*0.22),p:Math.round(B*0.12),s:Math.round(B*0.08)};
    const perDay=D?Math.round((B-bk.t)/D):0;

    /* --- 风格 → 活动词库 --- */
    const ACT={
      '美食':['找一家本地人排队的老店吃早点','钻小巷子里的苍蝇馆子，比网红店地道','逛当地菜市场，看新鲜食材也很治愈','去夜市扫街，小份多样最划算'],
      '文艺':['去当地博物馆/美术馆泡两小时','找一家独立书店坐坐，买本当地作家的书','老城区街拍，挑光线好的下午','看一场当地的小剧场演出'],
      '自然':['去城郊的山/湖/海边走走，带够水','清晨看日出，人少空气也好','找条步道慢慢走，别赶路','傍晚在江边/海边发呆看落日'],
      '购物':['逛本地特色商圈，先比价再下手','买点当地限定的伴手礼','奥莱/免税店集中采购，留出行李空间','逛逛本地设计师小店'],
      '打卡':['去地标建筑拍照，早上人最少','找当地热门机位打卡出片','咖啡馆探店，拍照顺便歇脚','夜景机位蹲一张，三脚架带上'],
      '躺平':['睡到自然醒，酒店早餐慢慢吃','找家咖啡馆待一下午，什么都不做','泡个澡/做个按摩，把疲惫泡走','在公园长椅上晒太阳发呆'],
      '亲子':['安排一个动物园/水族馆/科技馆','找有儿童区的餐厅，节奏放慢','下午一定留出午休时间','找个亲子乐园放电'],
      '闲逛':['随便挑条街走走，遇到什么算什么','坐一趟当地公交/电车环城','公园里坐坐，看本地人的日常','老街区慢慢晃，遇店就进']
    };
    const pool=[];styles.forEach(s=>{(ACT[s]||ACT['闲逛']).forEach(x=>{if(pool.indexOf(x)<0)pool.push(x);});});
    const pick=i=>pool[((i%pool.length)+pool.length)%pool.length];

    /* --- 同行提示 --- */
    const MATE={'独自':'一个人旅行行程随时能改，注意夜间安全、贵重物品别离身',
      '情侣':'两个人别把行程排太满，留点时间腻歪和拍照',
      '闺蜜':'姐妹出行拍照需求大，挑光线好的时段安排机位',
      '家人':'长辈体力有限，每天景点别超过 2 个，中午务必休息',
      '朋友':'人多口味杂，吃饭前先统一意见，AA 记账更清爽'};

    /* --- 逐日行程 --- */
    const daysArr=[];const L=[];
    L.push('🌸 '+dest+' · '+D+'天'+(D>1?(D-1)+'晚':'')+'攻略'+(from?'（'+from+' 出发）':''));
    L.push('');
    L.push('【行前概览】');
    if(startDate)L.push('· 出发：'+startDate+(startTime?' '+startTime:'')+'（'+slot+'出发）');
    else if(startTime)L.push('· 出发时间：'+startTime+'（'+slot+'出发）');
    L.push('· 交通方式：'+trans+(from?'（'+from+' → '+dest+'）':''));
    L.push('· '+TR.lead);
    L.push('· 住宿：'+stay+'，尽量订在地铁站/景点密集区附近，少走冤枉路');
    L.push('· 同行：'+mates+' —— '+(MATE[mates]||MATE['独自']));
    if(note)L.push('· 你的备注：'+note);
    L.push('');
    if(B>0){
      L.push('【预算拆解 · 总 ¥'+B+'】');
      L.push('· 往返交通 ¥'+bk.t+' ｜ 住宿 ¥'+bk.h+(D>1?'（约 ¥'+Math.round(bk.h/(D-1))+'/晚）':''));
      L.push('· 餐饮 ¥'+bk.f+' ｜ 门票娱乐 ¥'+bk.p+' ｜ 购物机动 ¥'+bk.s);
      L.push('· 到当地后每天可花约 ¥'+perDay+'，超了就在购物上收一收');
      L.push('');
    }
    L.push('【每日行程】');
    for(let i=1;i<=D;i++){
      const dstr=startDate?S.addDays(startDate,i-1):'';
      let plan='';
      if(i===1){
        if(arriveLate){
          plan=(startTime||'下午')+' 从'+(from||'出发地')+'出发（'+trans+'）；抵达后直接去'+stay+'办入住放行李；'
            +'晚上：附近吃顿热乎的，散步熟悉周边，早点睡养精神';
        }else{
          plan=(startTime||slot)+' 从'+(from||'出发地')+'出发（'+trans+'）；抵达后先入住/寄存行李（'+stay+'）；'
            +'下午：'+pick(0)+'；晚上：'+pick(1);
        }
      }else if(i===D&&D>1){
        plan='上午：退房前收好行李寄存前台，'+pick(i*3)+'；中午：吃顿正经当地菜收尾；'
          +'下午：买伴手礼，留足 2 小时去车站/机场，慢悠悠返程';
      }else{
        plan='上午：'+pick(i*3)+'；中午：'+pick(i*3+1)+'；下午：'+pick(i*3+2)+'；晚上：'+pick(i*3+3)
          +(perDay?'（今日预算约 ¥'+perDay+'）':'');
      }
      daysArr.push({date:dstr,plan});
      L.push('Day '+i+(dstr?'（'+dstr+'）':'')+'：'+plan);
    }
    L.push('');
    L.push('【小贴士】');
    L.push('· '+TR.tipTxt);
    L.push('· 热门景点尽量早去，10 点之后人就多了');
    L.push('· 每天留半天空白，旅行是为了松口气不是赶场');
    L.push('· 证件、现金、充电宝分开放，别都塞一个包');

    /* --- 打包清单 --- */
    const pack=['身份证/证件','手机＋充电器','充电宝','换洗衣物 '+Math.min(D,7)+' 套','洗漱包','常用药/创可贴','纸巾湿巾'];
    const add=x=>{if(pack.indexOf(x)<0)pack.push(x);};
    TR.packs.forEach(add);
    const mon=startDate?+startDate.slice(5,7):(new Date().getMonth()+1);
    if(mon>=6&&mon<=9){add('防晒霜');add('遮阳帽');add('便携小风扇');}
    if(mon>=11||mon<=2){add('保暖外套');add('围巾手套');add('暖宝宝');}
    if(mon>=3&&mon<=5){add('薄外套');add('防过敏药');}
    if(styles.indexOf('自然')>=0){add('舒适徒步鞋');add('驱蚊液');}
    if(styles.indexOf('打卡')>=0||styles.indexOf('文艺')>=0){add('拍照穿的衣服');add('小镜子');}
    if(styles.indexOf('购物')>=0){add('折叠购物袋');}
    if(mates==='家人'){add('长辈常用药');}

    return {text:L.join('\n'),days:daysArr,pack:pack,tip:travelTip(dest)};
  }

  /* 饮食建议（结合运动） */
  function dietAdvice(){
    const t=S.today();
    const ex=S.S.exercisesToday(t);const diet=S.S.dietToday(t);
    const cal=diet.reduce((s,m)=>s+m.cal,0);
    const exMin=ex.reduce((s,e)=>s+(+e.dur||0),0);
    if(exMin>=30)return '今天运动不少，可以适当多吃点优质蛋白补充体力，比如鸡蛋、鱼肉、豆腐，身体会感谢你的 💪';
    if(cal>1600)return '今天吃得略丰盛，下一餐清爽点就好，来份蔬菜沙拉平衡一下，别有负担哦 🥗';
    if(cal===0)return '还没记录餐食呀，记得按时吃饭，胃暖了心情也会好 🍚';
    return '饮食节奏挺好，记得多喝水、蔬果均衡，身体会悄悄变轻盈 ✨';
  }

  /* 消费简报 */
  function expenseBrief(){
    const t=S.today();const ym=t.slice(0,7);
    const bs=S.S.billsMonth(ym);
    let exp=0,inc=0;const cat={};
    bs.forEach(b=>{if(b.type==='expense'){exp+=b.amount;cat[b.category]=(cat[b.category]||0)+b.amount;}else inc+=b.amount;});
    const bd=S.get().budget.amount;
    const top=Object.entries(cat).sort((a,b)=>b[1]-a[1])[0];
    let L=['🌸 '+ym+' 消费小简报'];
    L.push('');
    L.push('本月支出 ¥'+exp+'，收入 ¥'+inc+'，预算 ¥'+bd);
    if(top)L.push('花得最多的是「'+top[0]+'」¥'+top[1]+'，占了不小比例呢');
    if(exp>bd)L.push('⚠️ 已超预算啦，剩下的日子温柔一点花，奶茶少一杯也没关系 🥤');
    else L.push('预算还剩 ¥'+(bd-exp)+'，稳稳的，给自己点个赞 👍');
    L.push('');
    L.push('钱是服务生活的，花在喜欢和需要的地方就很好，别苛责自己 💗');
    return L.join('\n');
  }

  /* 英语周报 */
  function englishBrief(){
    const e=S.get().english;
    const total=e.words.length;
    const learned=e.words.filter(w=>w.status!=='new').length;
    const streak=e.checkins.length;
    let L=['🌸 英语学习小简报'];
    L.push('');
    L.push('累计词汇 '+total+' 个，已掌握 '+learned+' 个');
    L.push('打卡 '+streak+' 天，每天十分钟，进步看得见 📚');
    L.push('');
    L.push('记单词别贪多，睡前回想一下今天学的词，记忆会更牢哦～ 🌙');
    return L.join('\n');
  }

  /* 体重AI分析 */
  function weightAnalysis(d){
    const w=S.S.weightToday(d);
    if(!w)return '今天还没称体重呀，选个固定时间称就好，数字只是参考，健康才是主角 💗';
    let s='今天体重已记录～ ';
    if(w.morning&&w.night)s+='早晚差 '+(Math.abs(w.morning-w.night)).toFixed(1)+' kg，一天内波动正常，别担心。';
    s+=' 饮水量 '+(w.water||0)+' ml，'+( (w.water||0)>=1500?'很棒💧':'再多喝一点更舒服哦' );
    s+=' 体重起伏是身体在和你说话，温柔看待就好 🌸';
    return s;
  }

  /* 旅游出行建议 */
  function travelTip(dest){
    return '🌸 关于 '+dest+' 的小心机：\n· 当地美食先查评价，网红店未必合胃口，巷子里的更地道\n· 肠胃药、创可贴随身带，旅行安心感拉满\n· 热门景点早去早回，避开人潮更出片\n· 留半天什么都不安排，才是真正的度假 🧳';
  }

  /* 菜谱过滤忌口 */
  /* 菜谱推荐：忌口的菜（菜名或食材命中）直接剔除，不再出现在推荐里 */
  function filterRecipes(){
    const avoid=(S.get().avoid||[]).map(a=>(a||'').trim()).filter(Boolean);
    const all=S.get().recipes||[];
    if(!avoid.length)return all;
    return all.filter(r=>{
      const hay=(r.name||'')+' '+(r.ing||'')+' '+((r.steps||[]).join(' '));
      return !avoid.some(a=>hay.indexOf(a)>=0);
    });
  }

  /* 食物图片识别（增强版：覆盖常见中餐/快餐/小吃，按类别匹配）
     注：前端模拟识别，基于随机合理值+大分类库，用户可手动纠正
     实际使用时图片不会传到服务器，仅在浏览器本地处理
  */
  // 食物数据库（名称 + 热量 + 蛋白质 + 碳水 + 膳食纤维）
  const FOOD_DB = [
    // === 面食类 ===
    {name:'麻辣烫',cal:520,protein:22,carb:58,fiber:6,tags:['麻辣','烫','面','粉']},
    {name:'冒菜',cal:480,protein:20,carb:52,fiber:5,tags:['冒菜','麻辣','川菜']},
    {name:'酸辣粉',cal:420,protein:8,carb:65,fiber:2,tags:['酸辣','粉','红薯']},
    {name:'螺蛳粉',cal:450,protein:10,carb:62,fiber:3,tags:['螺蛳','粉','酸笋']},
    {name:'重庆小面',cal:460,protein:14,carb:60,fiber:2,tags:['小面','重庆','面条','麻辣']},
    {name:'兰州拉面',cal:550,protein:24,carb:72,fiber:3,tags:['拉面','兰州','牛肉','面条']},
    {name:'炸酱面',cal:500,protein:16,carb:68,fiber:3,tags:['炸酱','面条','北京']},
    {name:'刀削面',cal:480,protein:15,carb:70,fiber:2,tags:['刀削','面条','山西']},
    {name:'热干面',cal:420,protein:12,carb:58,fiber:2,tags:['热干面','武汉','芝麻']},
    {name:'担担面',cal:450,protein:14,carb:55,fiber:3,tags:['担担','四川','面条']},
    {name:'米线',cal:340,protein:8,carb:55,fiber:1,tags:['米线','云南','过桥']},
    {name:'河粉',cal:320,protein:7,carb:52,fiber:1,tags:['河粉','炒牛河','广东']},
    {name:'乌冬面',cal:380,protein:10,carb:62,fiber:2,tags:['乌冬','日式','面条']},
    {name:'意大利面',cal:380,protein:13,carb:58,fiber:3,tags:['意面','意大利','pasta']},

    // === 米饭类 ===
    {name:'米饭套餐（两菜一汤）',cal:580,protein:24,carb:72,fiber:5,tags:['米饭','套餐','盖饭','盒饭']},
    {name:'蛋炒饭',cal:520,protein:12,carb:68,fiber:2,tags:['炒饭','蛋','米饭']},
    {name:'扬州炒饭',cal:550,protein:18,carb:65,fiber:3,tags:['扬州','炒饭','虾仁']},
    {name:'煲仔饭',cal:620,protein:26,carb:70,fiber:4,tags:['煲仔','腊味','广东']},
    {name:'卤肉饭',cal:560,protein:20,carb:62,fiber:2,tags:['卤肉','台湾','肥肉']},
    {name:'咖喱饭',cal:580,protein:18,carb:68,fiber:4,tags:['咖喱','日本','印度']},
    {name:'盖浇饭',cal:540,protein:20,carb:65,fiber:3,tags:['盖浇','家常菜','工作餐']},

    // === 中式正餐 ===
    {name:'宫保鸡丁',cal:420,protein:32,carb:12,fiber:3,tags:['宫保','鸡丁','花生','川菜']},
    {name:'麻婆豆腐',cal:350,protein:16,carb:10,fiber:4,tags:['麻婆','豆腐','川菜','麻辣']},
    {name:'红烧肉',cal:520,protein:22,carb:18,fiber:1,tags:['红烧','猪肉','五花肉','东坡']},
    {name:'糖醋里脊',cal:480,protein:28,carb:35,fiber:1,tags:['糖醋','里脊','排骨','酸甜']},
    {name:'鱼香肉丝',cal:400,protein:26,carb:15,fiber:2,tags:['鱼香','肉丝','川菜']},
    {name:'回锅肉',cal:500,protein:24,carb:8,fiber:2,tags:['回锅','肉片','蒜苗','川菜']},
    {name:'水煮鱼',cal:380,protein:36,carb:8,fiber:3,tags:['水煮','鱼','麻辣','川菜']},
    {name:'酸菜鱼',cal:320,protein:34,carb:10,fiber:3,tags:['酸菜','鱼','酸汤']},
    {name:'可乐鸡翅',cal:420,protein:28,carb:30,fiber:0,tags:['可乐','鸡翅','甜']},
    {name:'番茄炒蛋',cal:280,protein:14,carb:12,fiber:2,tags:['番茄','鸡蛋','家常']},
    {name:'青椒肉丝',cal:320,protein:24,carb:10,fiber:3,tags:['青椒','肉丝','下饭']},
    {name:'地三鲜',cal:260,protein:8,carb:22,fiber:6,tags:['地三鲜','土豆','茄子','东北']},
    {name:'蒸蛋羹',cal:120,protein:10,carb:4,fiber:0,tags:['蒸蛋','鸡蛋羹','嫩']},
    {name:'清蒸鱼',cal:200,protein:30,carb:2,fiber:0,tags:['清蒸','鱼','鲈鱼','清淡']},
    {name:'白切鸡',cal:260,protein:36,carb:2,fiber:0,tags:['白切鸡','广东','湛江']},
    {name:'红烧排骨',cal:480,protein:28,carb:22,fiber:1,tags:['红烧','排骨','糖醋']},
    {name:'蒜蓉虾',cal:240,protein:28,carb:6,fiber:1,tags:['蒜蓉','虾','海鲜']},
    {name:'干锅花菜',cal:280,protein:8,carb:18,fiber:6,tags:['干锅','花菜','腊肉']},
    {name:'手撕包菜',cal:160,protein:4,carb:12,fiber:5,tags:['手撕','包菜','酸辣']},

    // === 快餐/外卖 ===
    {name:'黄焖鸡米饭',cal:620,protein:38,carb:72,fiber:4,tags:['黄焖鸡','米饭','香菇']},
    {name:'沙县小吃（拌面+炖罐）',cal:520,protein:22,carb:58,fiber:3,tags:['沙县','拌面','扁肉','云吞']},
    {name:'肯德基汉堡套餐',cal:850,protein:28,carb:85,fiber:4,tags:['KFC','肯德基','汉堡','炸鸡']},
    {name:'麦当劳套餐',cal:820,protein:26,carb:88,fiber:3,tags:['麦当劳','巨无霸','薯条']},
    {name:' Subway 三明治',cal:380,protein:24,carb:42,fiber:4,tags:['subway','三明治','赛百味']},
    {name:'煎饼果子',cal:420,protein:14,carb:52,fiber:4,tags:['煎饼','果子','早餐','天津']},
    {name:'肉夹馍',cal:450,protein:22,carb:42,fiber:2,tags:['肉夹馍','陕西','腊汁肉']},
    {name:'煎饺',cal:360,protein:12,carb:40,fiber:2,tags:['煎饺','锅贴','饺子']},
    {name:'小笼包（一笼）',cal:420,protein:18,carb:45,fiber:1,tags:['小笼包','汤包','上海']},

    // === 火锅/串串 ===
    {name:'火锅（一人份）',cal:720,protein:36,carb:28,fiber:8,tags:['火锅','涮肉','麻辣','清汤']},
    {name:'串串香',cal:450,protein:20,carb:25,fiber:5,tags:['串串','冷锅','竹签']},
    {name:'烤串（5串）',cal:380,protein:24,carb:6,fiber:1,tags:['烤串','烧烤','羊肉','孜然']},

    // === 轻食/沙拉 ===
    {name:'鸡胸肉沙拉',cal:320,protein:38,carb:18,fiber:6,tags:['沙拉','鸡胸','轻食','健身']},
    {name:'金枪鱼沙拉',cal:280,protein:30,carb:14,fiber:4,tags:['金枪鱼','沙拉','吞拿鱼']},
    {name:'牛肉波奇饭',cal:480,protein:32,carb:48,fiber:5,tags:['波奇','poke','牛肉','糙米']},
    {name:'蔬菜沙拉',cal:150,protein:5,carb:12,fiber:6,tags:['蔬菜','沙拉','减脂','轻食']},

    // === 小吃/零食 ===
    {name:'水果酸奶杯',cal:180,protein:8,carb:28,fiber:3,tags:['水果','酸奶','杯','甜品']},
    {name:'奶茶（全糖）',cal:420,protein:6,carb:58,fiber:0,tags:['奶茶','珍珠','全糖','饮料']},
    {name:'蛋糕卷',cal:320,protein:6,carb:42,fiber:1,tags:['蛋糕','甜点','奶油','生日']},
    {name:'蛋挞（2个）',cal:340,protein:6,carb:35,fiber:0,tags:['蛋挞','葡式','肯德基']},
    {name:'章鱼小丸子',cal:300,protein:10,carb:35,fiber:1,tags:['章鱼','丸子','木鱼花']},
    {name:'关东煮',cal:250,protein:14,carb:22,fiber:3,tags:['关东煮','便利店','萝卜']},
    {name:'手抓饼',cal:450,protein:12,carb:48,fiber:2,tags:['手抓饼','鸡蛋','早餐']},

    // === 早餐类 ===
    {name:'豆浆油条',cal:420,protein:14,carb:45,fiber:2,tags:['豆浆','油条','早餐','传统']},
    {name:'包子（肉包2个）',cal:380,protein:16,carb:42,fiber:2,tags:['包子','肉包','早餐','馒头']},
    {name:'粥（皮蛋瘦肉粥）',cal:220,protein:12,carb:35,fiber:1,tags:['粥','皮蛋','瘦肉','早餐']},
    {name:'三明治',cal:340,protein:16,carb:35,fiber:3,tags:['三明治','火腿','早餐','面包']},
    {name:'面包+牛奶',cal:350,protein:14,carb:45,fiber:2,tags:['面包','牛奶','吐司','早餐']}
  ];

  function foodEstimate(){
    // 返回一个"看起来合理"的食物估算
    // 前端无法真正做图像识别，这里从分类库中随机返回一项
    // 用户看到后可以手动修改纠正
    const idx = Math.floor(Math.random() * FOOD_DB.length);
    return {...FOOD_DB[idx]};
  }

  window.AI={greet,dailySummary,weeklyReview,travelPlan,travelPlanPro,dietAdvice,expenseBrief,englishBrief,weightAnalysis,travelTip,filterRecipes,foodEstimate};
})();
