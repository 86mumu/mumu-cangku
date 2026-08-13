/* ============ 阅读板块：实时联网深度阅读（防弹版） ============ */
(function(){
  /* ---- 0. 安全依赖获取 ---- */
  var S = window.Store;
  if(!S || !S.get || !S.save){
    console.error('[Reading] Store 不可用');
    window.Reading = { render: function(){}, refresh: function(){} };
    return;
  }

  /* ---- 1. 本地兜底文章（保证永远有内容） ---- */
  var FALLBACKS = [
    {
      id:'fb01',title:'如果没有天赋，就不断的重复',source:'本地·治愈',date:'2026-08-01',
      body:"如果没有天赋，就不断的重复，如果不是天才，那就一步步的来。新的一天，早上好，人生在世，慢也好，步子小也好，只要往前走就好。\n\n所有的努力，不是让别人觉得你多了不起，而是为了让自己打心眼里看得起自己。看不清方向时，就比别人坚持的更久一些。那些看似不起眼的日复一日，会在将来的某一天让你突然看到坚持的意义。\n\n天生我材必有用，千金散尽还复来。世间没有白走的路，每一步坚持，都在为未来铺路。"
    },
    {
      id:'fb02',title:'允许自己今天不那么好',source:'本地·治愈',date:'2026-08-01',
      body:"你不必每天都阳光满满，不必每时每刻都积极向上。累了就休息，难过了就哭一会儿，迷茫了就发会儿呆。\n\n我们总被告诉要坚强、要乐观、要永远充满能量。但人不是机器，不可能永远高速运转。那些低电量的时刻，恰恰是身体和心灵在提醒你：该充电了。\n\n所以今天，如果不想笑就不笑，不想努力就躺平一会儿。明天又是新的一天，而你，已经被允许做自己了。"
    },
    {
      id:'fb03',title:'人生本就是一场边走边悟的旅程',source:'本地·散文',date:'2026-08-01',
      body:"天生我材必有用，千金散尽还复来。世间没有白走的路，每一步坚持，都在为未来铺路。草有枯荣季，人有起伏时。低谷不是结局，只是提醒你，该沉淀、该蓄力、该重新出发了。\n\n风雨是生活的常态，扛住风雨，才是成长的必修课。愿我们都能在前行的途中，守住初心，活成自己喜欢的模样。人要有破局的勇气，困在执念里，只会步步维艰。勇敢地向前走，胜过原地徘徊一万步。"
    },
    {
      id:'fb04',title:'痛苦是成长的入场券',source:'本地·哲理',date:'2026-08-01',
      body:"没有人喜欢痛苦。但回过头看，几乎所有重要的成长，都伴随着某种程度的痛苦。\n\n学走路会摔跤，学骑车会摔倒，第一次失恋会心痛，第一次失业会恐慌。这些感觉都不好受，但正是这些不好受的经历，塑造了更强大的你。\n\n尼采说：杀不死我的，使我更强大。你每一次从痛苦中站起来，都会比之前更坚韧、更有智慧、更知道自己想要什么。所以下次痛苦来临的时候，别急着逃避。问问它：你来教我什么？"
    },
    {
      id:'fb05',title:'写给深夜还没睡的你',source:'本地·独白',date:'2026-08-01',
      body:"又是一个睡不着觉的夜晚吗？手机屏幕的光照在你脸上，周围安静得只能听到自己的呼吸声。\n\n我想告诉你的是：睡不着也没关系。不是每个夜晚都必须立刻入睡，也不是每个问题都必须马上有答案。有时候，夜晚就是用来发呆的，用来和自己的情绪待在一起的。\n\n今晚就放过自己吧。闭上眼睛，深呼吸，不管明天怎样，至少此刻你是安全的、是被这个世界容纳的。晚安。"
    },
    {
      id:'fb06',title:'慢慢变好，是给自己最好的礼物',source:'本地·治愈',date:'2026-08-01',
      body:"不要总想着一夜之间改变一切。真正持久的改变，都是悄无声息发生的。就像春天的花开，你以为它是一夜之间绽放的，其实它在土里酝酿了整个冬天。\n\n从今天开始，只做一个小小的改变：早睡十分钟，或者每天喝够水，或者把我不行换成我再试试。不需要惊天动地，只需要比昨天好一点点。\n\n一个月后回头看，你会发现，原来自己已经走了这么远。"
    }
  ];

  /* ---- 2. 网络源配置 ---- */
  var NET_SOURCES = [
    { name: '36kr', url: 'https://api.rss2json.com/v1/api.json?rss_url=https://36kr.com/feed' },
    { name: '少数派', url: 'https://api.rss2json.com/v1/api.json?rss_url=https://sspai.com/feed' },
    { name: '澎湃', url: 'https://api.rss2json.com/v1/api.json?rss_url=https://www.thepaper.cn/rss.jsp' },
    { name: '界面', url: 'https://api.rss2json.com/v1/api.json?rss_url=https://www.jiemian.com/rss' },
    { name: '人民日报', url: 'https://api.rss2json.com/v1/api.json?rss_url=http://feed.people.com.cn/rss/roll.xml' },
    { name: '新华网', url: 'https://api.rss2json.com/v1/api.json?rss_url=http://www.news.cn/rss/news_all.xml' }
  ];

  /* ---- 3. 工具函数 ---- */
  function rd(){
    try{ return S.get().reading; }catch(e){ return null; }
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripTags(s){
    return String(s)
      .replace(/<[^>]+>/g, '')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s*(查看全文|查看详情|阅读更多|点击查看|Read more|阅读原文)[…·]*$/gi, '');
  }

  function shuffle(arr){
    var a = arr.slice();
    for(var i = a.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function todayStr(){
    try{ return S.today(); }catch(e){ return '2026-08-01'; }
  }

  /* ---- 4. 解析网络文章 ---- */
  function parseNetItem(srcName, it){
    var body = stripTags(it.content || it.description || '');
    if(body.length < 50) return null;
    return {
      id: 'net_' + srcName + '_' + String(it.guid || it.title || Date.now()).slice(0, 16),
      title: (it.title || '无题').trim(),
      source: srcName,
      date: String(it.pubDate || '').slice(0, 10) || todayStr(),
      body: body.slice(0, 3000),
      link: it.link || '',
      isNet: true,
      fetchedAt: Date.now()
    };
  }

  /* ---- 5. 联网抓取 ---- */
  async function fetchFromNetwork(){
    var results = [];
    var promises = NET_SOURCES.map(function(src){
      return (async function(){
        try{
          var controller = new AbortController();
          var timer = setTimeout(function(){ controller.abort(); }, 10000);
          var res = await fetch(src.url, { signal: controller.signal });
          clearTimeout(timer);
          if(!res.ok) return;
          var data = await res.json();
          if(!data || !data.items || !data.items.length) return;
          var items = [];
          for(var i = 0; i < data.items.length; i++){
            var item = parseNetItem(src.name, data.items[i]);
            if(item) items.push(item);
          }
          for(var j = 0; j < items.length; j++) results.push(items[j]);
          console.log('[Reading] ' + src.name + ' 获取 ' + items.length + ' 篇');
        }catch(e){
          console.log('[Reading] ' + src.name + ': ' + e.message);
        }
      })();
    });
    await Promise.allSettled(promises);
    return shuffle(results);
  }

  /* ---- 6. 本地兜底抽取 ---- */
  function pickFallback(n){
    var picked = shuffle(FALLBACKS).slice(0, n || 2);
    var out = [];
    for(var i = 0; i < picked.length; i++){
      out.push({
        id: picked[i].id,
        title: picked[i].title,
        source: picked[i].source,
        date: picked[i].date,
        body: picked[i].body,
        isNet: false,
        fetchedAt: Date.now()
      });
    }
    return out;
  }

  /* ---- 7. 同步填充（保证打开即有内容） ---- */
  function ensureLocal(){
    var r = rd();
    if(!r){ return; }
    if(!Array.isArray(r.today)) r.today = [];
    if(!Array.isArray(r.history)) r.history = [];
    if(r.today.length === 0){
      r.today = pickFallback(2);
      try{ S.save(); }catch(e){}
    }
  }

  /* ---- 8. 异步联网更新 ---- */
  async function ensureDaily(){
    var r = rd();
    if(!r) return;
    if(!Array.isArray(r.today)) r.today = [];
    if(!Array.isArray(r.history)) r.history = [];

    // 当天已有则跳过
    if(r.lastFetch === todayStr() && r.today.length > 0) return;

    var articles = [];
    try{ articles = await fetchFromNetwork(); }catch(e){}

    if(articles.length >= 2){
      r.today = articles.slice(0, 3);
      r.netOk = true;
      r.lastFetch = todayStr();
      try{ S.save(); }catch(e){}
      var live = document.getElementById('study-reading');
      if(live) paint(live);
    }else{
      ensureLocal();
      r.netOk = false;
      r.lastFetch = todayStr();
      try{ S.save(); }catch(e){}
    }
  }

  /* ---- 9. 手动刷新 ---- */
  async function refresh(){
    var el = document.getElementById('study-reading');
    if(el){
      el.innerHTML = '<div class="card read-head"><div class="read-head-l"><div class="read-head-t">🔄 正在刷新...</div><div class="small muted">正在从全网获取最新爆款文章...</div></div></div>';
    }
    if(window.UI && UI.toast) UI.toast('正在全网搜索最新文章... 📡');

    var articles = [];
    try{ articles = await fetchFromNetwork(); }catch(e){}

    var r = rd();

    if(articles.length >= 2){
      if(r){ r.today = articles.slice(0, 3); r.netOk = true; r.lastFetch = todayStr(); try{S.save();}catch(e){} }
      render('study-reading');
      if(window.UI && UI.toast) UI.toast('已更新！获取到 ' + articles.length + ' 篇最新文章 ✨');
    }else{
      if(r){ r.today = pickFallback(2); r.netOk = false; r.lastFetch = todayStr(); try{S.save();}catch(e){} }
      render('study-reading');
      if(window.UI && UI.toast) UI.toast('网络暂时不可用，已加载本地精选 📚');
    }
  }

  /* ---- 10. 标记已读 ---- */
  function markRead(article){
    var r = rd();
    if(!r) return;
    r.history = r.history || [];
    var filtered = [];
    for(var i = 0; i < r.history.length; i++){
      if(r.history[i].id !== article.id) filtered.push(r.history[i]);
    }
    r.history = filtered;
    r.history.unshift({
      id: article.id,
      title: article.title,
      source: article.source,
      date: article.date,
      body: article.body,
      readAt: Date.now()
    });
    if(r.history.length > 200) r.history = r.history.slice(0, 200);
    try{ S.save(); }catch(e){}
    updateReadButton(article.id);
  }

  function updateReadButton(id){
    var btns = document.querySelectorAll('.ra-read-btn[data-id="' + id + '"]');
    for(var i = 0; i < btns.length; i++){
      btns[i].textContent = '✅ 已读';
      btns[i].className = 'btn btn-sm ra-read-done';
      btns[i].disabled = true;
    }
  }

  function markAndToast(id){
    var list = (rd() && rd().today) || [];
    var hist = (rd() && rd().history) || [];
    var article = null;
    for(var i = 0; i < list.length; i++){ if(list[i].id === id){ article = list[i]; break; } }
    if(!article){
      for(var j = 0; j < hist.length; j++){ if(hist[j].id === id){ article = hist[j]; break; } }
    }
    if(!article){ if(UI && UI.toast) UI.toast('未找到该文章'); return; }
    markRead(article);
    if(UI && UI.toast) UI.toast('已标记为已读 ✅');
  }

  /* ---- 11. 渲染（核心入口） ---- */
  function render(targetId){
    var el = document.getElementById(targetId);
    if(!el) return;

    // 先用本地内容填充（同步，不等网络）
    ensureLocal();
    paint(el);

    // 后台异步联网
    setTimeout(function(){ ensureDaily().catch(function(){}); }, 100);
  }

  /* ---- 12. 绘制页面 ---- */
  function paint(el){
    var r = rd();
    var list = (r && r.today) || [];

    var cards = '';
    for(var i = 0; i < list.length; i++){
      var a = list[i];
      var paras = (a.body || '').split(/\n\n+/);
      var paragraphs = '';
      for(var p = 0; p < paras.length; p++){
        if(paras[p].trim()) paragraphs += '<p>' + esc(paras[p].trim()) + '</p>';
      }

      var isAlreadyRead = false;
      if(r && r.history){
        for(var h = 0; h < r.history.length; h++){
          if(r.history[h].id === a.id){ isAlreadyRead = true; break; }
        }
      }

      cards += '<article class="read-article">' +
        '<div class="ra-header">' +
          '<span class="ra-source">' + esc(a.source) + '</span>' +
          (a.isNet ? '<span class="ra-badge">实时</span>' : '') +
        '</div>' +
        '<h2 class="ra-title">' + esc(a.title) + '</h2>' +
        '<div class="ra-meta">' + esc(a.date || '') + ' · 约 ' + Math.max(80, (a.body||'').length) + ' 字</div>' +
        '<div class="ra-body">' + paragraphs + '</div>' +
        '<div class="ra-foot">' +
          (isAlreadyRead
            ? '<button class="btn btn-sm ra-read-done" disabled>✅ 已读</button>'
            : '<button class="btn btn-ghost btn-sm ra-read-btn" data-id="' + a.id + '" onclick="Reading.markAndToast(\'' + a.id + '\')">○ 未阅读</button>'
          ) +
        '</div>' +
      '</article>';
    }

    if(!cards){
      cards = '<div class="empty"><p>正在准备今日文章...</p></div>';
    }

    var hist = (r && r.history) || [];
    var recent = hist.slice(0, 5);
    var histHtml = '';
    if(recent.length > 0){
      histHtml = '<div class="read-hist"><div class="read-hist-h">🕘 最近阅读</div><div class="hist-list">';
      for(var k = 0; k < recent.length; k++){
        histHtml += '<div class="hist-item" onclick="Reading.showArticle(\'' + recent[k].id + '\')"><span class="hist-dot"></span>' + esc(recent[k].title) + '</div>';
      }
      histHtml += '</div></div>';
    }

    var netStatus = (r && r.netOk !== false) ? '已接入网络实时获取' : '本地精选';
    var lastDate = (r && r.lastFetch) || todayStr();

    el.innerHTML =
      '<div class="card read-head">' +
        '<div class="read-head-l">' +
          '<div class="read-head-t">📖 每日深度阅读</div>' +
          '<div class="small muted">' + netStatus + ' · ' + lastDate + '</div>' +
        '</div>' +
        '<button class="btn btn-primary btn-sm" onclick="Reading.refresh()">🔄 刷新文章</button>' +
      '</div>' +
      cards +
      histHtml;
  }

  /* ---- 13. 历史弹窗 ---- */
  function showHistory(){
    var hist = (rd() && rd().history) || [];
    if(!hist.length){
      if(UI && UI.modal) UI.modal('<div class="modal-title">🕘 阅读历史</div><div class="empty">还没有阅读记录哦～<br>读完一篇文章后点击「未阅读」标记即可记录 🌿</div><button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>');
      return;
    }
    var html = '<div class="modal-title">🕘 阅读历史（' + hist.length + '篇）</div>';
    html += '<div class="hist-modal-list">';
    for(var i = 0; i < hist.length; i++){
      html += '<div class="hist-item" onclick="UI.close();Reading.showArticle(\'' + hist[i].id + '\')"><span class="hist-dot"></span><b>' + esc(hist[i].title) + '</b><span class="muted small ml8">' + esc(hist[i].source) + '</span></div>';
    }
    html += '</div>';
    html += '<button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>';
    if(UI && UI.modal) UI.modal(html);
  }

  /* ---- 14. 查看单篇弹窗 ---- */
  function showArticle(id){
    var hist = (rd() && rd().history) || [];
    var todayList = (rd() && rd().today) || [];
    var a = null;
    for(var i = 0; i < hist.length; i++){ if(hist[i].id === id){ a = hist[i]; break; } }
    if(!a){
      for(var j = 0; j < todayList.length; j++){ if(todayList[j].id === id){ a = todayList[j]; break; } }
    }
    if(!a) return;

    var paras = (a.body || '').split(/\n\n+/);
    var paragraphs = '';
    for(var p = 0; p < paras.length; p++){
      if(paras[p].trim()) paragraphs += '<p>' + esc(paras[p].trim()) + '</p>';
    }
    if(UI && UI.modal) UI.modal(
      '<div class="modal-title">' + esc(a.title) + '</div>' +
      '<div class="small muted mb8">' + esc(a.source) + ' · ' + esc(a.date || '') + '</div>' +
      '<div class="ra-body-in-modal">' + paragraphs + '</div>' +
      '<button class="btn btn-ghost btn-block mt12" onclick="UI.close()">关闭</button>'
    );
    markRead(a);
  }

  /* ---- 15. 暴露 API（绝对安全） ---- */
  window.Reading = {
    render: render,
    refresh: refresh,
    ensureDaily: function(){ ensureDaily().catch(function(){}); },
    markRead: markRead,
    markAndToast: markAndToast,
    showHistory: showHistory,
    showArticle: showArticle
  };

  console.log('[Reading] 模块加载成功 ✅');
})();
