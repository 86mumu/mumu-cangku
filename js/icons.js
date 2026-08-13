/* ============================================================
   图标库 — Q 版卡通手绘描边风格
   规范：深黑描边 #3B2A30 / 主体蜜桃粉·樱花粉填充 / 白色高光留白
        全圆角软萌造型 / 透明底 / 统一 48x48 viewBox
   参考样例：秒表、火焰、哑铃
   ============================================================ */
(function(){
  const OL='#3B2A30';      // 描边
  const PK='#FFB3C7';      // 蜜桃粉
  const PK2='#FF8FAB';     // 樱花深粉
  const PL='#FFE3EC';      // 浅樱花
  const CR='#FFF6F8';      // 奶白
  const W ='#FFFFFF';
  const YL='#FFE0A8';      // 极少量暖黄点缀（蝴蝶结/花心）

  /* 包一层统一描边参数 */
  const S=(inner)=>`<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${OL}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  /* 白色高光留白 */
  const hi=(cx,cy,rx,ry,rot)=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${W}" stroke="none" opacity=".8"${rot?` transform="rotate(${rot} ${cx} ${cy})"`:''}/>`;

  /* ================= 导航主图标 ================= */

  // 首页 — 小房子
  const home=S(`
    <path d="M24 7.2 41 22.4a2.2 2.2 0 0 1-1.5 3.8H8.5A2.2 2.2 0 0 1 7 22.4z" fill="${PK2}"/>
    <path d="M11.5 25.5V37.5a3.5 3.5 0 0 0 3.5 3.5h18a3.5 3.5 0 0 0 3.5-3.5V25.5" fill="${PL}"/>
    <path d="M19.5 41V31.5a4.5 4.5 0 0 1 9 0V41" fill="${PK}"/>
    ${hi(15.5,15.5,2.2,3.4,42)}
  `);

  // 待办 — 圆角剪贴板
  const todo=S(`
    <rect x="9.5" y="9" width="29" height="32" rx="8" fill="${PL}"/>
    <rect x="17" y="4.5" width="14" height="8" rx="4" fill="${PK2}"/>
    <path d="M16.5 24.2 19.7 27.4 26 20.4"/>
    <path d="M17 33.5h14"/>
    ${hi(14,17,1.8,3,0)}
  `);

  // 减脂 — 哑铃
  const dumbbell=S(`
    <rect x="4.5" y="16.5" width="8" height="15" rx="4" fill="${PK}"/>
    <rect x="35.5" y="16.5" width="8" height="15" rx="4" fill="${PK}"/>
    <rect x="12.5" y="19.5" width="5.5" height="9" rx="2.7" fill="${PK2}"/>
    <rect x="30" y="19.5" width="5.5" height="9" rx="2.7" fill="${PK2}"/>
    <rect x="17.5" y="21.3" width="13" height="5.4" rx="2.7" fill="${PL}"/>
    ${hi(8.5,21,1.5,2.6,0)}
  `);

  // 记账 — 钱包
  const wallet=S(`
    <path d="M9 12.5h26a6 6 0 0 1 6 6v17a6 6 0 0 1-6 6H9a4 4 0 0 1-4-4v-21a4 4 0 0 1 4-4z" fill="${PK}"/>
    <path d="M41 22h-7.5a5 5 0 0 0 0 10H41" fill="${PL}"/>
    <circle cx="33.8" cy="27" r="2" fill="${OL}" stroke="none"/>
    ${hi(11,19,1.8,3.2,0)}
  `);

  // 英语 — 书本
  const book=S(`
    <path d="M24 13.5c-4-3.6-9.5-4.8-15.5-4.2A2.2 2.2 0 0 0 6.5 11.5v22.6a2.2 2.2 0 0 0 2.4 2.2c6-.6 11.1.6 15.1 4.2z" fill="${PL}"/>
    <path d="M24 13.5c4-3.6 9.5-4.8 15.5-4.2a2.2 2.2 0 0 1 2 2.2v22.6a2.2 2.2 0 0 1-2.4 2.2c-6-.6-11.1.6-15.1 4.2z" fill="${PK}"/>
    <path d="M24 13.5v27"/>
    ${hi(13,18.5,2.2,3.4,-16)}
  `);

  // 旅游 — 行李箱
  const suitcase=S(`
    <rect x="6" y="15" width="36" height="26" rx="8" fill="${PK}"/>
    <path d="M18 15v-3.2A3.8 3.8 0 0 1 21.8 8h4.4A3.8 3.8 0 0 1 30 11.8V15"/>
    <path d="M20.5 15h7v26h-7z" fill="${PL}"/>
    ${hi(11,21.5,1.8,3,0)}
  `);

  /* ================= 通用功能图标 ================= */

  const stopwatch=S(`
    <rect x="19.3" y="3.2" width="9.4" height="5.6" rx="2.8" fill="${PL}"/>
    <path d="M36.5 11 39.8 7.7"/>
    <circle cx="24" cy="28" r="14.6" fill="${PK}"/>
    <circle cx="24" cy="28" r="9.8" fill="${CR}"/>
    <path d="M24 21.6V28h5"/>
    ${hi(17.5,22,3,2,-32)}
  `);

  const fire=S(`
    <path d="M25.2 4c.6 6.2 5.2 8.6 7.6 12.8A13.6 13.6 0 1 1 11 24.4c0-5.6 3.6-8.2 5.6-12.8.8 3 2 4.6 3.6 5.6.8-3.6.6-8.6 5-13.2z" fill="${PK2}"/>
    <path d="M24.4 25.6c.6 2.6 3.6 3.6 3.6 6.4a4.7 4.7 0 0 1-9.4 0c0-2.4 2.2-3.2 3-5.6.9 1.6 2 1.6 2.8-.8z" fill="${PL}"/>
  `);

  const drop=S(`
    <path d="M24 5.4c0 0 12.4 13 12.4 21A12.4 12.4 0 0 1 11.6 26.4C11.6 18.4 24 5.4 24 5.4z" fill="${PK}"/>
    ${hi(19,27,2.6,4,-18)}
  `);

  const cup=S(`
    <path d="M10.5 9.5h27a2 2 0 0 1 0 5.2h-27a2 2 0 0 1 0-5.2z" fill="${PK}"/>
    <path d="M12.8 14.7h22.4l-2.4 23.2A4 4 0 0 1 28.8 41.5H19.2a4 4 0 0 1-4-3.6z" fill="${PL}"/>
    <path d="M15 25.5h18" opacity=".55"/>
    ${hi(19,20,2,3.2,0)}
  `);

  const calendar=S(`
    <rect x="5.5" y="10" width="37" height="31" rx="8" fill="${PL}"/>
    <path d="M5.5 19.5h37"/>
    <path d="M15 5.5v7M33 5.5v7"/>
    <circle cx="16.5" cy="27.5" r="2.5" fill="${PK2}" stroke="none"/>
    <circle cx="24" cy="27.5" r="2.5" fill="${PK}" stroke="none"/>
    <circle cx="31.5" cy="27.5" r="2.5" fill="${PK}" stroke="none"/>
    <circle cx="16.5" cy="34.5" r="2.5" fill="${PK}" stroke="none"/>
    <circle cx="24" cy="34.5" r="2.5" fill="${PK2}" stroke="none"/>
  `);

  const check=S(`
    <circle cx="24" cy="24" r="16.8" fill="${PK}"/>
    <path d="M15.8 24.6 21.4 30.2 32.6 18.2" stroke="${W}" stroke-width="3.6"/>
    ${hi(15,16,2.6,3.6,-35)}
  `);

  const note=S(`
    <rect x="6.5" y="6.5" width="24" height="33" rx="7" fill="${PL}"/>
    <path d="M13 17h11M13 24h8"/>
    <path d="M41 20.8 27.8 34 22 35.8l1.8-5.8L37 16.8a2.8 2.8 0 0 1 4 4z" fill="${PK}"/>
    ${hi(11,13,1.6,2.6,0)}
  `);

  const chart=S(`
    <rect x="6" y="26" width="9" height="15" rx="4" fill="${PL}"/>
    <rect x="19.5" y="17" width="9" height="24" rx="4" fill="${PK}"/>
    <rect x="33" y="8.5" width="9" height="32.5" rx="4" fill="${PK2}"/>
  `);

  const scale=S(`
    <rect x="5.5" y="11.5" width="37" height="29" rx="9" fill="${PL}"/>
    <path d="M14.5 30a9.5 9.5 0 0 1 19 0" fill="${PK}"/>
    <path d="M24 29.5 29.5 23"/>
    <circle cx="24" cy="30" r="2.2" fill="${OL}" stroke="none"/>
    ${hi(12,17,2.4,1.8,-20)}
  `);

  const plate=S(`
    <circle cx="24" cy="24" r="16.5" fill="${PL}"/>
    <circle cx="24" cy="24" r="9.5" fill="${CR}"/>
    ${hi(18,17.5,3.2,2,-32)}
  `);

  /* 食记：一只小碗 + 一杯奶茶（吃吃 + 喝喝） */
  const food=S(`
    <path d="M5.5 22.5h21a1 1 0 0 1 1 1.2A11.5 11.5 0 0 1 16 34.5 11.5 11.5 0 0 1 4.5 23.7a1 1 0 0 1 1-1.2z" fill="${PK}"/>
    <path d="M4 38.5h24" stroke-width="3"/>
    <path d="M11 18.5c0-3 3-3 3-6M19 18.5c0-3 3-3 3-6" opacity=".6"/>
    <path d="M31.5 15.5h11a1.4 1.4 0 0 1 1.4 1.6l-2 19a3.4 3.4 0 0 1-3.4 3h-3a3.4 3.4 0 0 1-3.4-3l-2-19a1.4 1.4 0 0 1 1.4-1.6z" fill="${PL}"/>
    <path d="M30.8 23.5h13.4" opacity=".55"/>
    <circle cx="35.5" cy="30" r="1.7" fill="${OL}" stroke="none"/>
    <circle cx="40" cy="32.5" r="1.5" fill="${OL}" stroke="none"/>
  `);

  /* 排便：Q 版小便便（三层螺旋 + 表情） */
  const poop=S(`
    <path d="M19 13.5c0-3.4 3-5.6 6-4.6 2 .7 2.8 2.6 2.6 4.6h1.6a4.2 4.2 0 0 1 0 8.4H18.8a4.2 4.2 0 0 1 0-8.4z" fill="${PK2}"/>
    <path d="M15.5 21.9h17a5 5 0 0 1 0 10h-17a5 5 0 0 1 0-10z" fill="${PK}"/>
    <path d="M11.5 31.9h25a5.3 5.3 0 0 1 0 10.6h-25a5.3 5.3 0 0 1 0-10.6z" fill="${PL}"/>
    <circle cx="19" cy="36.5" r="1.8" fill="${OL}" stroke="none"/>
    <circle cx="29" cy="36.5" r="1.8" fill="${OL}" stroke="none"/>
    <path d="M21.5 39.8a3.4 3.4 0 0 0 5 0" stroke-width="2.2"/>
  `);

  const sunrise=S(`
    <path d="M13.5 29a10.5 10.5 0 0 1 21 0z" fill="${PK}"/>
    <path d="M6 33.5h36M11 39.5h26"/>
    <path d="M24 8.5v4.5M11.5 13.5l3 3M36.5 13.5l-3 3M5.5 26h4M38.5 26h4"/>
  `);

  const sun=S(`
    <circle cx="24" cy="24" r="10" fill="${PK}"/>
    <path d="M24 5v5.5M24 37.5V43M5 24h5.5M37.5 24H43M10.6 10.6l3.9 3.9M33.5 33.5l3.9 3.9M37.4 10.6l-3.9 3.9M14.5 33.5l-3.9 3.9"/>
    ${hi(20,20,2.4,1.8,-30)}
  `);

  const moon=S(`
    <path d="M31.5 5.5A18.5 18.5 0 1 0 42 32.5 15.5 15.5 0 0 1 31.5 5.5z" fill="${PL}"/>
    <circle cx="33" cy="14" r="1.8" fill="${PK}" stroke="none"/>
    <circle cx="27" cy="21" r="1.4" fill="${PK}" stroke="none"/>
  `);

  const cookie=S(`
    <circle cx="24" cy="24" r="16.5" fill="${PL}"/>
    <circle cx="19" cy="19" r="2.3" fill="${PK2}" stroke="none"/>
    <circle cx="29.5" cy="22" r="2" fill="${PK2}" stroke="none"/>
    <circle cx="22" cy="30.5" r="2.3" fill="${PK2}" stroke="none"/>
    <circle cx="30" cy="31" r="1.6" fill="${PK2}" stroke="none"/>
  `);

  const chef=S(`
    <path d="M13.5 24.5a8.5 8.5 0 1 1 3.3-16.3 9.5 9.5 0 0 1 16.4 0 8.5 8.5 0 1 1 3.3 16.3z" fill="${PL}"/>
    <path d="M13.5 24.5h21V35a4 4 0 0 1-4 4H17.5a4 4 0 0 1-4-4z" fill="${PK}"/>
    ${hi(16,14,2.4,3,-20)}
  `);

  const camera=S(`
    <rect x="4.5" y="14" width="39" height="26" rx="8" fill="${PK}"/>
    <path d="M17.5 14 20 9h8l2.5 5"/>
    <circle cx="24" cy="27" r="8.2" fill="${CR}"/>
    <circle cx="24" cy="27" r="4" fill="${PK2}"/>
    ${hi(11,20,2,1.5,0)}
  `);

  const sparkle=S(`
    <path d="M19.5 5 22.8 14.2 32 17.5 22.8 20.8 19.5 30 16.2 20.8 7 17.5l9.2-3.3z" fill="${PK}"/>
    <path d="M34.5 26 36.3 31.2 41.5 33 36.3 34.8 34.5 40 32.7 34.8 27.5 33l5.2-1.8z" fill="${PL}"/>
  `);

  const heart=S(`
    <path d="M24 40.5S6.5 29.5 6.5 18.4A9.6 9.6 0 0 1 24 13.2a9.6 9.6 0 0 1 17.5 5.2C41.5 29.5 24 40.5 24 40.5z" fill="${PK2}"/>
    ${hi(15,19.5,2.6,3.6,-30)}
  `);

  const star=S(`
    <path d="M24 5.5 29.8 17.3 42.8 19.2 33.4 28.4 35.6 41.3 24 35.2 12.4 41.3 14.6 28.4 5.2 19.2l13-1.9z" fill="${PK}"/>
    ${hi(17,17,2.2,3,-35)}
  `);

  const money=S(`
    <path d="M17.5 12.5 20.8 6.5h6.4l3.3 6z" fill="${PL}"/>
    <path d="M17.5 12.5C11 17 7.5 23 7.5 28.5a16.5 16.5 0 0 0 33 0c0-5.5-3.5-11.5-10-16z" fill="${PK}"/>
    <path d="M19.5 23 24 28.5 28.5 23M24 28.5V35M20 30.5h8"/>
    ${hi(14,22,2,3.2,20)}
  `);

  const pin=S(`
    <path d="M24 5.2A13.4 13.4 0 0 1 37.4 18.6c0 9.8-13.4 24.4-13.4 24.4S10.6 28.4 10.6 18.6A13.4 13.4 0 0 1 24 5.2z" fill="${PK}"/>
    <circle cx="24" cy="18.4" r="5.2" fill="${CR}"/>
    ${hi(17.5,13,2,2.8,-30)}
  `);

  const run=S(`
    <circle cx="30.5" cy="9.5" r="5.4" fill="${PK}"/>
    <rect x="25" y="14.5" width="8" height="15" rx="4" fill="${PL}" transform="rotate(22 29 22)"/>
    <rect x="13" y="16" width="6.5" height="13" rx="3.2" fill="${PK}" transform="rotate(55 16 22)"/>
    <rect x="35" y="14" width="6.5" height="13" rx="3.2" fill="${PK}" transform="rotate(-55 38 20)"/>
    <rect x="19" y="28" width="6.5" height="14" rx="3.2" fill="${PK}" transform="rotate(40 22 35)"/>
    <rect x="29" y="28" width="6.5" height="14" rx="3.2" fill="${PK}" transform="rotate(-28 32 35)"/>
    ${hi(29,19,2,3,-20)}
  `);

  const clock=S(`
    <circle cx="24" cy="24" r="16.5" fill="${PK}"/>
    <circle cx="24" cy="24" r="11.5" fill="${CR}"/>
    <path d="M24 16.5V24.5h6.5"/>
    ${hi(17,17,2.6,1.8,-32)}
  `);

  const target=S(`
    <circle cx="24" cy="24" r="16.5" fill="${PL}"/>
    <circle cx="24" cy="24" r="10.5" fill="${PK}"/>
    <circle cx="24" cy="24" r="4.2" fill="${PK2}"/>
  `);

  const flower=(function(){
    let p='';
    for(let i=0;i<5;i++){p+=`<ellipse cx="24" cy="13.5" rx="6.2" ry="8" fill="${PK}" transform="rotate(${i*72} 24 24)"/>`;}
    return S(p+`<circle cx="24" cy="24" r="4.6" fill="${YL}"/>`);
  })();

  const hash=S(`
    <rect x="6" y="6" width="36" height="36" rx="11" fill="${PL}"/>
    <path d="M18.5 13.5v21M29.5 13.5v21M13.5 19h21M13.5 29h21"/>
  `);

  const bulb=S(`
    <path d="M24 5.2A13.2 13.2 0 0 1 32 28.6V33H16v-4.4A13.2 13.2 0 0 1 24 5.2z" fill="${PK}"/>
    <path d="M17.5 36.5h13M20 41h8"/>
    ${hi(18.5,15,2.2,3.4,-25)}
  `);

  const party=S(`
    <path d="M7 41.5 17.5 15.5 33.5 31.5z" fill="${PK}"/>
    <path d="M17.5 15.5 33.5 31.5" opacity=".35"/>
    <circle cx="36" cy="10" r="2.6" fill="${PK2}" stroke="none"/>
    <circle cx="28" cy="6.5" r="2" fill="${PL}" stroke="none"/>
    <circle cx="42" cy="20" r="2" fill="${PL}" stroke="none"/>
    <path d="M32 17.5l3-3M38.5 26l3.5-1" opacity=".6"/>
  `);

  const edit=S(`
    <path d="M38.6 9.4a4.6 4.6 0 0 1 0 6.5L17.2 37.3 8 40l2.7-9.2L32.1 9.4a4.6 4.6 0 0 1 6.5 0z" fill="${PK}"/>
    <path d="M30.5 13 35 17.5"/>
    ${hi(20,25,2,3.2,45)}
  `);

  const plus=S(`
    <circle cx="24" cy="24" r="16.8" fill="${PK}"/>
    <path d="M24 15.5v17M15.5 24h17" stroke="${W}" stroke-width="3.6"/>
  `);

  const speaker=S(`
    <path d="M10 19h6.5L26 11v26l-9.5-8H10a2.5 2.5 0 0 1-2.5-2.5v-5A2.5 2.5 0 0 1 10 19z" fill="${PK}"/>
    <path d="M31.5 18.5a8 8 0 0 1 0 11M36 14a14 14 0 0 1 0 20"/>
  `);

  const leaf=S(`
    <path d="M38.5 8.5C22 7 10.5 15 10.5 27.5c0 4 1.4 7.5 3.6 10 3-13 11.4-19.5 20.4-22.5-7 4.5-13.5 10-16.5 22 14 4 28.5-6 20.5-28.5z" fill="${PK}"/>
  `);

  // 搜索 — 圆润放大镜
  const search=S(`
    <circle cx="21.5" cy="21.5" r="12" fill="${PL}"/>
    <circle cx="21.5" cy="21.5" r="8.5" fill="${CR}"/>
    <path d="M27.5 27.5l7 7"/>
    ${hi(17,17,2.4,3.6,-35)}
  `);

  // 导入 — 箭头落入盒子
  const importIcon=S(`
    <path d="M7.5 18h33a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3h-33a3 3 0 0 1-3-3V21a3 3 0 0 1 3-3z" fill="${PL}"/>
    <path d="M24 8v14M17.5 17.5 24 24l6.5-6.5" stroke="${PK2}" stroke-width="2.6"/>
    ${hi(12,23,2,3.2,0)}
  `);

  // 导出 — 箭头飞出盒子
  const exportIcon=S(`
    <path d="M7.5 18h33a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3h-33a3 3 0 0 1-3-3V21a3 3 0 0 1 3-3z" fill="${PL}"/>
    <path d="M24 30V16M17.5 22.5 24 16l6.5 6.5" stroke="${PK2}" stroke-width="2.6"/>
    ${hi(12,30,2,3.2,0)}
  `);

  /* ================= 运动快捷记录插画（保留 有氧 / 其他，其余重绘为 Q 版软萌小人） ================= */
  const EX={
    cardio:S(`<path d="M24 40S7 29.5 7 18.8A9.2 9.2 0 0 1 24 13.8a9.2 9.2 0 0 1 17 5C41 29.5 24 40 24 40z" fill="${PK2}"/>
      <path d="M12 24.5h6l3-5 4 10 3.5-6.5h6.5" stroke="${W}" stroke-width="2.6"/>${hi(15,19.5,2.4,3.4,-30)}`),
    back:S(`
      <circle cx="24" cy="9" r="5.2" fill="${PK}"/>
      <path d="M15 25c0-7 3-11 9-11s9 4 9 11c0 9-3.5 17-9 17s-9-8-9-17z" fill="${PL}"/>
      <rect x="9.5" y="23" width="6" height="16" rx="3" fill="${PK}"/>
      <rect x="32.5" y="23" width="6" height="16" rx="3" fill="${PK}"/>
      <path d="M24 17v17" opacity=".5"/>${hi(24,23,2.4,4.5,-20)}`),
    legs:S(`
      <circle cx="24" cy="8.5" r="5" fill="${PK}"/>
      <rect x="20.5" y="12.5" width="7.5" height="9" rx="3.7" fill="${PL}"/>
      <rect x="18.5" y="20" width="6.5" height="13" rx="3.2" fill="${PK}"/>
      <rect x="18.5" y="30" width="13" height="6.5" rx="3.2" fill="${PK}"/>
      <rect x="26.5" y="20" width="6.5" height="19" rx="3.2" fill="${PK}"/>${hi(23,15,2,3,-20)}`),
    run:run,
    full:S(`
      <circle cx="24" cy="9.5" r="5.4" fill="${PK}"/>
      <rect x="19.5" y="14.5" width="9" height="18" rx="4.5" fill="${PL}"/>
      <rect x="5" y="15" width="6.5" height="15" rx="3.2" fill="${PK}" transform="rotate(-32 8 22)"/>
      <rect x="36.5" y="15" width="6.5" height="15" rx="3.2" fill="${PK}" transform="rotate(32 40 22)"/>
      <rect x="19" y="30" width="6.5" height="14" rx="3.2" fill="${PK}" transform="rotate(13 22 37)"/>
      <rect x="22.5" y="30" width="6.5" height="14" rx="3.2" fill="${PK}" transform="rotate(-13 26 37)"/>${hi(22,20,2.2,3.6,-20)}`),
    /* —— 跳绳 —— */
    rope:S(`
      <path d="M11 14c-6.5 8.5-5 23 13 23s19.5-14.5 13-23" fill="none" opacity=".85"/>
      <circle cx="11" cy="13" r="2.4" fill="${PK2}" stroke="none"/>
      <circle cx="37" cy="13" r="2.4" fill="${PK2}" stroke="none"/>
      <circle cx="24" cy="12" r="4.6" fill="${PK}"/>
      <rect x="20.5" y="16.5" width="7" height="12" rx="3.5" fill="${PL}"/>
      <path d="M20.5 20 13.5 15.5M27.5 20 34.5 15.5"/>
      <path d="M22 28.5l-2.5 8M26 28.5l2.5 8"/>${hi(22,19,1.8,2.6,-25)}`),
    /* —— 瑜伽（盘腿打坐）—— */
    yoga:S(`
      <circle cx="24" cy="11" r="5" fill="${PK}"/>
      <path d="M17.5 23a6.5 6.5 0 0 1 13 0v6h-13z" fill="${PL}"/>
      <path d="M9 36c0-4.2 6.5-6.5 15-6.5s15 2.3 15 6.5c0 2.2-2.5 3.2-15 3.2S9 38.2 9 36z" fill="${PK}"/>
      <path d="M18 25 11 30M30 25 37 30"/>
      <circle cx="10" cy="31" r="2.2" fill="${PK2}" stroke="none"/>
      <circle cx="38" cy="31" r="2.2" fill="${PK2}" stroke="none"/>${hi(20,20,2,3,-20)}`),
    /* —— 平板支撑 —— */
    plank:S(`
      <path d="M5 38h38" opacity=".55"/>
      <circle cx="36" cy="15.5" r="4.6" fill="${PK}"/>
      <rect x="9" y="21" width="25" height="8.5" rx="4.2" fill="${PL}" transform="rotate(-11 21.5 25)"/>
      <path d="M31.5 25v13M12.5 27.5 10.5 38"/>
      <path d="M8 38h6M28.5 38h6"/>${hi(20,23,2.2,3,-11)}`),
    /* —— 深蹲 —— */
    squat:S(`
      <circle cx="24" cy="9" r="4.8" fill="${PK}"/>
      <rect x="19.8" y="13.5" width="8.4" height="11.5" rx="4.2" fill="${PL}"/>
      <path d="M20 17.5 13 21M28 17.5 35 21"/>
      <path d="M22 25l-6 6.5 3 8M26 25l6 6.5-3 8"/>
      <rect x="8.5" y="18.5" width="6" height="5" rx="2.5" fill="${PK2}"/>
      <rect x="33.5" y="18.5" width="6" height="5" rx="2.5" fill="${PK2}"/>${hi(22,16,1.8,2.6,-20)}`),
    /* —— 开合跳 —— */
    jack:S(`
      <circle cx="24" cy="9.5" r="4.8" fill="${PK}"/>
      <rect x="19.8" y="14" width="8.4" height="13" rx="4.2" fill="${PL}"/>
      <path d="M20.5 16.5 9.5 10M27.5 16.5 38.5 10"/>
      <path d="M22 27 13.5 39.5M26 27 34.5 39.5"/>
      <circle cx="8" cy="9" r="2.4" fill="${PK2}" stroke="none"/>
      <circle cx="40" cy="9" r="2.4" fill="${PK2}" stroke="none"/>${hi(22,18,1.8,2.8,-20)}`),
    /* —— 羽毛球 —— */
    badminton:S(`
      <ellipse cx="17" cy="17.5" rx="9.5" ry="11.5" fill="${PL}" transform="rotate(-35 17 17.5)"/>
      <path d="M10.5 13.5 21.5 21M13.5 9.5 24 17.5" opacity=".4"/>
      <path d="M22.5 26.5 33.5 39.5" stroke-width="3.4"/>
      <path d="M35.5 22.5 39.5 17.5 45 20 41.5 26z" fill="${W}"/>
      <circle cx="35.5" cy="23" r="2.8" fill="${PK2}" stroke="none"/>${hi(13,12,2,3,-35)}`),
    /* —— 游泳 —— */
    swim:S(`
      <circle cx="16.5" cy="16.5" r="4.8" fill="${PK}"/>
      <path d="M11.5 26.5c5.5-4 13-3.5 18 0l7 3.5" fill="none" stroke-width="3.2"/>
      <path d="M21.5 22 32 11" stroke-width="3"/>
      <circle cx="34" cy="9" r="2.6" fill="${PK2}" stroke="none"/>
      <path d="M4 34q5-3.6 10 0t10 0 10 0 10 0" fill="none"/>
      <path d="M4 40q5-3.6 10 0t10 0 10 0 10 0" fill="none" opacity=".5"/>${hi(14.5,14,1.8,2.6,-25)}`),
    /* —— 骑行 —— */
    bike:S(`
      <circle cx="12" cy="31" r="8.6" fill="${PL}"/>
      <circle cx="36" cy="31" r="8.6" fill="${PL}"/>
      <path d="M12 31 20.5 17.5h8L36 31" fill="none"/>
      <path d="M20.5 17.5 25.5 31"/>
      <path d="M16.5 14.5h6.5" stroke-width="3.2"/>
      <path d="M28.5 17.5 31.5 13.5"/>
      <circle cx="25.5" cy="31" r="2.6" fill="${PK2}" stroke="none"/>${hi(8,27,2,3,-30)}`),
    /* —— 普拉提 —— */
    pilates:S(`
      <rect x="4.5" y="32" width="39" height="7.5" rx="3.7" fill="${PL}"/>
      <circle cx="12.5" cy="24" r="4.6" fill="${PK}"/>
      <path d="M16.5 29h12" stroke-width="3.2"/>
      <path d="M28.5 29 38 19.5" stroke-width="3.2"/>
      <circle cx="39.5" cy="18" r="2.4" fill="${PK2}" stroke="none"/>
      <path d="M17 25.5 24 22" opacity=".8"/>${hi(10.5,22,1.8,2.6,-25)}`),
    /* —— 臀桥 —— */
    bridge:S(`
      <path d="M4 38.5h40" opacity=".55"/>
      <circle cx="10" cy="32.5" r="4.6" fill="${PK}"/>
      <path d="M14.5 34.5q7-17 17-6" fill="none" stroke-width="3.4"/>
      <path d="M31.5 28.5 35 38.5" stroke-width="3.4"/>
      <path d="M14 38.5h5M32 38.5h6"/>
      <circle cx="22" cy="23.5" r="2.4" fill="${PK2}" stroke="none"/>${hi(8.5,30.5,1.8,2.4,-25)}`),
    /* —— 帕梅拉（马尾小人 + 爱心）—— */
    pamela:S(`
      <path d="M14.5 9.5q-4.5-.5-5 3.5t3.5 4.5" fill="${PK2}"/>
      <circle cx="19.5" cy="12" r="5" fill="${PK}"/>
      <rect x="15.5" y="16.5" width="8" height="13" rx="4" fill="${PL}"/>
      <path d="M16 20 9.5 25M23.5 20 30 25"/>
      <path d="M17.5 29.5 15 40M22 29.5 25 40"/>
      <path d="M38 14.5c1.7-2.8 6.3-1.7 6.3 1.7 0 3.2-4.2 5.7-6.3 7.8-2.1-2.1-6.3-4.6-6.3-7.8 0-3.4 4.6-4.5 6.3-1.7z" fill="${PK2}"/>${hi(17.5,19,1.8,2.6,-25)}`),
    /* —— 拉伸 —— */
    stretch:S(`
      <circle cx="21.5" cy="10.5" r="4.8" fill="${PK}"/>
      <path d="M21.5 15.5q6.5 6 4.5 14" fill="none" stroke-width="3.4"/>
      <path d="M22 17.5 33 8.5" stroke-width="3"/>
      <path d="M22 18.5 11.5 13.5" stroke-width="3"/>
      <path d="M26 29.5 22.5 40M26 29.5 33.5 38.5" stroke-width="3"/>
      <circle cx="35" cy="6.5" r="2.4" fill="${PK2}" stroke="none"/>
      <circle cx="9.5" cy="12.5" r="2.2" fill="${PK2}" stroke="none"/>${hi(19.5,9,1.8,2.6,-25)}`),
    other:S(`<rect x="5" y="17" width="7.5" height="14" rx="3.7" fill="${PK}"/>
      <rect x="35.5" y="17" width="7.5" height="14" rx="3.7" fill="${PK}"/>
      <rect x="12.5" y="21" width="23" height="6" rx="3" fill="${PL}"/>
      <path d="M40 6l1.4 3.6L45 11l-3.6 1.4L40 16l-1.4-3.6L35 11l3.6-1.4z" fill="${PK2}"/>`)
  };

  /* ================= 补充功能图标（同画风） ================= */

  // 支出 — 长翅膀飞走的钞票
  const spend=S(`
    <rect x="12" y="19" width="27" height="17" rx="5" fill="${PL}"/>
    <circle cx="25.5" cy="27.5" r="4.6" fill="${PK2}"/>
    <path d="M12 22.5C7 19 4.5 21.5 3 25c4-1.5 6.5-.5 9 1.5z" fill="${PK}"/>
    <path d="M12.5 30.5c-4 .5-6 2.5-6.5 5 3-1.5 5-1.5 7-.8z" fill="${PK}"/>
    ${hi(17,23.5,1.7,2.6,-28)}
  `);

  // 饼图 — 圆润分区
  const pie=S(`
    <circle cx="24" cy="25" r="16.5" fill="${PL}"/>
    <path d="M24 25V8.5A16.5 16.5 0 0 1 38.7 17z" fill="${PK2}"/>
    <path d="M24 25l14.7-8A16.5 16.5 0 0 1 34 39.5z" fill="${PK}"/>
    ${hi(15.5,17.5,2.4,3.6,-35)}
  `);

  // AI 小机器人
  const robot=S(`
    <path d="M24 6v4.5"/><circle cx="24" cy="5" r="2.4" fill="${PK2}"/>
    <rect x="8.5" y="11" width="31" height="24" rx="9" fill="${PL}"/>
    <ellipse cx="18" cy="21.5" rx="2.9" ry="3.5" fill="${OL}" stroke="none"/>
    <ellipse cx="30" cy="21.5" rx="2.9" ry="3.5" fill="${OL}" stroke="none"/>
    <path d="M19.5 28.5q4.5 3.5 9 0"/>
    <rect x="3.5" y="19" width="5.5" height="9" rx="2.7" fill="${PK}"/>
    <rect x="39" y="19" width="5.5" height="9" rx="2.7" fill="${PK}"/>
    <path d="M16 35v4.5M32 35v4.5"/>
    ${hi(14.5,16.5,2,2.8,-30)}
  `);

  // 账本 — 圆角笔记本
  const ledger=S(`
    <rect x="10" y="7.5" width="28" height="33" rx="7" fill="${PL}"/>
    <path d="M10 14.5a7 7 0 0 1 7-7h3v33h-3a7 7 0 0 1-7-7z" fill="${PK2}"/>
    <path d="M25 18h8M25 25h8M25 32h5"/>
    ${hi(30,12.5,2.6,1.8,0)}
  `);

  // 复习 — 循环箭头
  const repeat=S(`
    <path d="M12 20a12.5 12.5 0 0 1 21-5.5" fill="none"/>
    <path d="M33.5 7.5V15h-7.5"/>
    <path d="M36 28a12.5 12.5 0 0 1-21 5.5" fill="none"/>
    <path d="M14.5 40.5V33H22"/>
    <circle cx="24" cy="24" r="5.6" fill="${PK}"/>
    ${hi(22,22,1.6,2.2,-30)}
  `);

  // 地图
  const map=S(`
    <path d="M5.5 13.5 17 9v27.5L5.5 41z" fill="${PL}"/>
    <path d="M17 9l14 4.5V41l-14-4.5z" fill="${PK}"/>
    <path d="M31 13.5 42.5 9v27.5L31 41z" fill="${PL}"/>
    <circle cx="24" cy="21" r="4.4" fill="${PK2}"/>
    ${hi(10.5,16,1.8,2.6,-25)}
  `);

  // 终点旗
  const flag=S(`
    <path d="M12 41V7.5" stroke-width="3"/>
    <path d="M12 9h22a2 2 0 0 1 1.5 3.3l-4 4.7 4 4.7A2 2 0 0 1 34 25H12z" fill="${PK}"/>
    <path d="M12 9h11v8H12zM23 17h11v8H23z" fill="${PK2}" stroke="none" opacity=".85"/>
    ${hi(16,12.5,1.8,2.4,-25)}
  `);

  // 眼睛 — 睁开（Q 版大眼睛，带长睫毛高光）
  const eye=S(`
    <ellipse cx="24" cy="24" rx="17" ry="12" fill="${PL}"/>
    <circle cx="24" cy="24" r="8.2" fill="${PK2}"/>
    <circle cx="24" cy="24" r="4.2" fill="${OL}" stroke="none"/>
    <circle cx="26.5" cy="21" r="2.8" fill="${W}" stroke="none"/>
    <path d="M8 20c4-5 10-7 16-7s12 2 16 7M8 28c4 5 10 7 16 7s12-2 16-7" opacity=".35"/>
  `);

  // 眼睛 — 闭合/隐藏（Q 版闭眼带睫毛 + 斜杠）
  const eyeOff=S(`
    <path d="M8 24c5-7 11-10 16-10s11 3 16 10" fill="none"/>
    <path d="M8 24c5 7 11 10 16 10s11-3 16-10" fill="none"/>
    <path d="M13 19l-2.5-3M18 16.5l-1.5-4M24 15.5V11M30 16.5l1.5-4M35 19l2.5-3" stroke-width="2"/>
    <path d="M11 11l26 26" stroke-width="2.8"/>
  `);

  // 返回 — 左箭头
  const back=S(`<path d="M27 12 14 24l13 12"/><path d="M14 24h21"/>`);
  // 更多 — 三点
  const more=S(`<circle cx="14" cy="24" r="2.6" fill="${OL}" stroke="none"/><circle cx="24" cy="24" r="2.6" fill="${OL}" stroke="none"/><circle cx="34" cy="24" r="2.6" fill="${OL}" stroke="none"/>`);
  // 问号 — 提示
  const question=S(`<circle cx="24" cy="24" r="16.5" fill="${PL}"/><path d="M19 18.5a5 5 0 0 1 9.6 1.8c0 3.4-4.6 4.2-4.6 7.7"/><circle cx="24" cy="34" r="2.4" fill="${OL}" stroke="none"/>`);
  // 减号 — 取出
  const minus=S(`<circle cx="24" cy="24" r="16.8" fill="${PK}"/><path d="M15.5 24h17" stroke="${W}" stroke-width="3.6"/>`);
  // 小猪存钱罐 — Q 版描边
  const piggy=S(`<ellipse cx="26" cy="26" rx="15.5" ry="12.5" fill="${PK}"/>
    <path d="M30 13c4-2.4 9.4-.4 9.4 5.2-3.2 1-6.4 1-8.4-1.2" fill="${PK2}"/>
    <circle cx="19.5" cy="24" r="2.4" fill="${OL}" stroke="none"/>
    <ellipse cx="40.5" cy="23.5" rx="3.2" ry="4.4" fill="${PK2}"/>
    <circle cx="41" cy="22.5" r="1.2" fill="${OL}" stroke="none"/>
    <path d="M12 30v5M17 30v5" opacity=".5"/>
    <path d="M30 28h6" stroke="${W}" stroke-width="2.6"/>`);

  /* ================= 空状态插画（Q 版手绘描边 · 小花盆嫩芽，无猫咪） ================= */
  const EMPTY=`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${OL}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M40 76h40l-4 28a6 6 0 0 1-6 5H50a6 6 0 0 1-6-5z" fill="${PK2}"/>
    <rect x="36" y="66" width="48" height="13" rx="6.5" fill="${PK}"/>
    <path d="M60 66V46" stroke="${OL}" stroke-width="3"/>
    <ellipse cx="47" cy="48" rx="12" ry="7.5" fill="${PL}" transform="rotate(-32 47 48)"/>
    <ellipse cx="73" cy="48" rx="12" ry="7.5" fill="${PK}" transform="rotate(32 73 48)"/>
    <path d="M92 28 96 38 106 42 96 46 92 56 88 46 78 42 88 38z" fill="${PK2}"/>
    <circle cx="30" cy="38" r="2.8" fill="${PK}" stroke="none"/>
    <circle cx="34" cy="56" r="2.2" fill="${PK}" stroke="none"/>
    <circle cx="88" cy="70" r="2.2" fill="${PK}" stroke="none"/>
  </svg>`;

  /* ================= 导出 ================= */
  const ICON={
    home, todo, fatloss:dumbbell, account:wallet, english:book, travel:suitcase, fast:stopwatch,
    dumbbell, wallet, book, suitcase, food, poop,
    stopwatch, fire, drop, cup, calendar, check, note, chart, scale, plate,
    sunrise, sun, moon, cookie, chef, camera, sparkle, heart, star, money,
    pin, run, clock, target, flower, hash, bulb, party, edit, plus, speaker, leaf,
    search, import: importIcon, export: exportIcon, bills: ledger,
    spend, pie, robot, ledger, repeat, map, flag, eye, eyeOff,
    back, more, question, minus, piggy
  };

  /* emoji → 图标映射（渲染后自动替换） */
  const EMAP={
    '💧':'drop','🥤':'cup','🔥':'fire','⏱':'stopwatch','⏱️':'stopwatch','⏰':'clock','🕒':'clock',
    '📅':'calendar','📆':'calendar','🗓':'calendar','🗓️':'calendar',
    '📝':'note','✏️':'edit','✍️':'edit','✅':'check','☑️':'check','📊':'chart','📈':'chart','📉':'chart',
    '⚖️':'scale','⚖':'scale','🍽️':'plate','🍽':'plate','🌅':'sunrise','☀️':'sun','🌞':'sun','🌙':'moon',
    '🍪':'cookie','👩‍🍳':'chef','👨‍🍳':'chef','📷':'camera','📸':'camera','✨':'sparkle','💫':'sparkle',
    '💗':'heart','💖':'heart','❤️':'heart','⭐':'star','🌟':'star','💰':'money','💴':'money','💵':'money',
    '💳':'wallet','👛':'wallet','📍':'pin','🏃':'run','🏃‍♀️':'run','🎯':'target','🌸':'flower','🌿':'leaf',
    '🔢':'hash','💡':'bulb','🎉':'party','🎊':'party','💪':'dumbbell','🏠':'home','🏡':'home',
    '📋':'todo','📌':'todo','📚':'book','📖':'book','🧳':'travel','✈️':'travel','🔊':'speaker','🌺':'flower',
    '💸':'spend','🥧':'pie','🤖':'robot','📒':'ledger','📔':'ledger','🔁':'repeat','🔄':'repeat',
    '🗺️':'map','🗺':'map','🏁':'flag','🚩':'flag'
  };

  /* 将容器内 .ico/.emoji/.mi/.cup-icon 中的 emoji 替换为统一图标 */
  function upgrade(root){
    (root||document).querySelectorAll('.ico,.emoji,.mi,.cup-icon,.ic').forEach(el=>{
      if(el.dataset.icOk)return;
      const t=(el.textContent||'').trim();
      const n=EMAP[t];
      if(n&&ICON[n]){el.dataset.icOk='1';el.innerHTML=ICON[n];}
    });
  }
  function i(name){return ICON[name]||'';}

  window.Icon={ICON,EX,EMPTY,EMAP,upgrade,i,OL,PK,PK2,PL,W};
})();
