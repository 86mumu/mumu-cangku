/* ============ 学习中心（英语 + 阅读 两个子板块） ============ */
(function(){
  var sub = 'english';

  function render(){
    var el = document.getElementById('page-study');
    if(!el) return;

    const today = window.Store.today();
    el.innerHTML =
      '<div class="page-head">' +
        '<div class="date-line">' + window.Store.fmtCN(today) + ' ' + window.Store.weekCN(today) + ' · 每天进步一点点</div>' +
        '<div class="title">学习中心</div>' +
      '</div>' +
      '<div class="subtabs">' +
        '<button class="subtab ' + (sub === 'english' ? 'on' : '') + '" onclick="Study.setSub(\'english\')">📚 英语</button>' +
        '<button class="subtab ' + (sub === 'reading' ? 'on' : '') + '" onclick="Study.setSub(\'reading\')">📖 阅读</button>' +
      '</div>' +
      '<div id="study-english" class="subview"></div>' +
      '<div id="study-reading" class="subview"></div>';

    var engEl = document.getElementById('study-english');
    var readEl = document.getElementById('study-reading');

    if(sub === 'english'){
      engEl.style.display = '';
      readEl.style.display = 'none';
      if(window.Eng && typeof Eng.render === 'function'){
        Eng.setRoot('study-english');
        Eng.render();
      } else {
        engEl.innerHTML = '<div class="empty"><p>英语模块准备中...</p></div>';
      }
    } else {
      engEl.style.display = 'none';
      readEl.style.display = '';
      if(window.Reading && typeof window.Reading.render === 'function'){
        window.Reading.render('study-reading');
      } else {
        // Reading 模块不可用时显示默认内容
        readEl.innerHTML =
          '<div class="card read-head">' +
            '<div class="read-head-l"><div class="read-head-t">📖 每日深度阅读</div><div class="small muted">本地精选 · ' + new Date().toISOString().slice(0,10) + '</div></div>' +
            '<button class="btn btn-primary btn-sm" onclick="location.reload()">🔄 刷新页面</button>' +
          '</div>' +
          '<article class="read-article">' +
            '<div class="ra-header"><span class="ra-source">本地·治愈</span></div>' +
            '<h2 class="ra-title">允许自己今天不那么好</h2>' +
            '<div class="ra-body">' +
              '<p>你不必每天都阳光满满，不必每时每刻都积极向上。累了就休息，难过了就哭一会儿，迷茫了就发会儿呆。</p>' +
              '<p>我们总被告诉要坚强、要乐观、要永远充满能量。但人不是机器，不可能永远高速运转。那些低电量的时刻，恰恰是身体和心灵在提醒你：该充电了。</p>' +
              '<p>所以今天，如果不想笑就不笑，不想努力就躺平一会儿。明天又是新的一天，而你，已经被允许做自己了。</p>' +
            '</div>' +
            '<div class="ra-foot"><button class="btn btn-ghost btn-sm">✓ 已阅读</button></div>' +
          '</article>' +
          '<article class="read-article">' +
            '<div class="ra-header"><span class="ra-source">本地·哲理</span></div>' +
            '<h2 class="ra-title">痛苦是成长的入场券</h2>' +
            '<div class="ra-body">' +
              '<p>没有人喜欢痛苦。但回过头看，几乎所有重要的成长，都伴随着某种程度的痛苦。</p>' +
              '<p>学走路会摔跤，学骑车会摔倒，第一次失恋会心痛，第一次失业会恐慌。这些感觉都不好受，但正是这些不好受的经历，塑造了更强大的你。</p>' +
              '<p>尼采说：杀不死我的，使我更强大。你每一次从痛苦中站起来，都会比之前更坚韧、更有智慧。</p>' +
            '</div>' +
            '<div class="ra-foot"><button class="btn btn-ghost btn-sm">✓ 已阅读</button></div>' +
          '</article>';
      }
    }
  }

  function setSub(s){
    if(s !== 'english' && s !== 'reading') return;
    sub = s;
    render();
  }

  window.Study = { render: render, setSub: setSub };
})();
