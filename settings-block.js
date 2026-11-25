/* ===== НАСТРОЙКИ КАК В TELEGRAM =====
   Вставь этот блок в конец сайта (внутри <script>), ПЕРЕД строкой  applyCfg();
   Без обратных кавычек и  — чтобы не сломать String.raw. */

var D2={p_phone:"Все",p_seen:"Все",p_photo:"Все",p_fwd:"Все",p_call:"Все",p_inv:"Все",autoDel:"Никогда",delAcc:"6 мес.",
 n_dm:true,n_dm_t:true,n_dm_s:true,n_gr:true,n_gr_t:true,n_gr_s:true,n_ch:true,n_ch_t:true,n_ch_s:true,
 a_snd:true,a_vib:true,a_pre:true,badge:true,badgeM:true,n_join:true,
 d_mob:true,d_wifi:true,d_roam:false,d_gif:true,d_vid:true,d_save:false,d_low:false,
 f_dm:false,f_group:false,f_channel:false,fcur:"all",pow:false,powAt:15,lang:"ru"};
Object.keys(D2).forEach(function(k){if(CFG[k]===undefined)CFG[k]=D2[k]});

var st2=document.createElement("style");
st2.textContent="#sub{position:absolute;inset:0;background:var(--bg);z-index:8;display:none;flex-direction:column}#sub.on{display:flex}"+
 ".fbar{display:flex;gap:8px;overflow-x:auto;padding:4px 8px 10px}.fbar:empty{display:none}"+
 ".fb{background:var(--card);border:0;border-radius:18px;padding:8px 14px;font-weight:600;color:var(--mute);flex:none;cursor:pointer}"+
 ".fb.sel{background:var(--navon);color:var(--accent)}";
document.head.appendChild(st2);

/* разделы в списке настроек */
["priv","notif","data","fold","dev","pow","lang"].forEach(function(id,i){SET[2+i][0]=id});

/* каркас подэкрана */
function openSub(title,build){var s=$("sub");
 if(!s){s=h("div");s.id="sub";
  s.innerHTML='<div class="top"><button class="ico" id="subBack" aria-label="Назад"></button><h2 id="subT" style="text-align:center;margin-right:44px"></h2></div><div class="page" id="subBox"></div>';
  $("app").appendChild(s);$("subBack").innerHTML=ic("back");$("subBack").onclick=function(){s.classList.remove("on")}}
 $("subT").textContent=title;var b=$("subBox");b.innerHTML="";build(b);s.classList.add("on")}
function cd(t){var c=card(t);for(var i=1;i<arguments.length;i++)c.appendChild(arguments[i]);return c}
function hint(t){return h("div","hint",t)}
function line(title,sub,val,fn){var r=h(fn?"button":"div","srow");var t=h("div","rb");t.appendChild(h("div","rt",title));
 if(sub)t.appendChild(h("div","rs",sub));r.appendChild(t);if(val)r.appendChild(h("div","val",val));if(fn)r.onclick=fn;return r}

var V3=["Все","Мои контакты","Никто"];

/* Конфиденциальность */
function sPriv(b){
 b.appendChild(cd("Кто может видеть",valrow("Номер телефона","p_phone",V3),valrow("Время захода и онлайн","p_seen",V3),
  valrow("Фото профиля","p_photo",V3),valrow("Пересылка сообщений","p_fwd",V3),valrow("Звонки","p_call",V3),valrow("Приглашения в группы","p_inv",V3)));
 b.appendChild(hint("Нажимай на пункт, чтобы переключать: Все → Мои контакты → Никто."));
 b.appendChild(cd("Безопасность",line("Код-пароль","Блокировка при входе в приложение","Выкл",function(){toast("Код-пароль скоро будет")}),
  line("Заблокированные пользователи",null,"0",function(){toast("Список пуст")})));
 b.appendChild(cd("Автоудаление сообщений",valrow("Таймер по умолчанию","autoDel",["Никогда","1 день","1 неделя","1 месяц"])));
 b.appendChild(cd("Удаление аккаунта",valrow("Если вы не заходите","delAcc",["1 мес.","3 мес.","6 мес.","12 мес."])));
 b.appendChild(hint("Если вы не заходите в приложение в течение этого срока, аккаунт будет удалён вместе с сообщениями и контактами."))}

/* Уведомления */
function sNotif(b){
 [["Личные чаты","n_dm"],["Группы","n_gr"],["Каналы","n_ch"]].forEach(function(x){var k=x[1];
  b.appendChild(cd(x[0],toggle("Показывать уведомления",null,k),toggle("Показывать текст",null,k+"_t"),toggle("Звук",null,k+"_s")))});
 b.appendChild(cd("Уведомления в приложении",toggle("Звуки",null,"a_snd"),toggle("Вибрация",null,"a_vib"),toggle("Предпросмотр сообщений",null,"a_pre")));
 b.appendChild(cd("Счётчик значков",toggle("Включая заглушённые чаты","Показывать и заглушённые чаты","badgeM"),toggle("Считать чаты, а не сообщения",null,"badge")));
 b.appendChild(cd("Прочее",toggle("Контакт присоединился","Уведомлять, когда контакт появился в Приватке","n_join")));
 var r=h("button","pbtn alt","Сбросить все уведомления");
 r.onclick=function(){Object.keys(D2).forEach(function(k){if(/^(n_|a_|badge)/.test(k))CFG[k]=D2[k]});saveCfg();toast("Уведомления сброшены");openSection("notif")};
 b.appendChild(r)}

/* Данные и память */
function sData(b){var kb=0;try{kb=Math.round(JSON.stringify(localStorage).length/1024)}catch(e){}
 b.appendChild(cd("Использование памяти",line("Настройки и обои",null,kb+" КБ")));
 var cl=h("button","pbtn alt","Очистить обои из кэша");cl.style.color="var(--text)";
 cl.onclick=function(){CFG.wallImg="";applyCfg();saveCfg();toast("Кэш очищен");openSection("data")};b.appendChild(cl);
 b.appendChild(cd("Автозагрузка медиа",toggle("Через мобильную сеть",null,"d_mob"),toggle("Через Wi-Fi",null,"d_wifi"),toggle("В роуминге",null,"d_roam")));
 b.appendChild(cd("Автовоспроизведение",toggle("GIF",null,"d_gif"),toggle("Видео",null,"d_vid")));
 b.appendChild(cd("Прочее",toggle("Сохранять в галерею","Сохранять полученные фото и видео","d_save"),toggle("Экономия трафика","Меньше данных при загрузке","d_low")))}

/* Папки с чатами */
var FOLD=[["dm","Личные"],["group","Группы"],["channel","Каналы"]];
function sFold(b){b.appendChild(hint("Папки показываются вкладками над списком чатов."));
 b.appendChild(cd("Рекомендуемые папки",toggle("Личные","Только переписки один на один","f_dm"),toggle("Группы",null,"f_group"),toggle("Каналы",null,"f_channel")))}
function fbar(){var bar=h("div","fbar"),on=FOLD.filter(function(f){return CFG["f_"+f[0]]});
 if(CFG.fcur!=="all"&&!CFG["f_"+CFG.fcur])CFG.fcur="all";
 if(!on.length)return bar;
 [["all","Все чаты"]].concat(on).forEach(function(f){var x=h("button","fb"+(CFG.fcur===f[0]?" sel":""),f[1]);
  x.onclick=function(){CFG.fcur=f[0];saveCfg();loadChats()};bar.appendChild(x)});return bar}
function inFolder(c){return CFG.fcur==="all"||c.type===CFG.fcur}

/* Устройства (реальные сеансы с сервера) */
function uaName(u){u=u||"";
 var o=/Android/.test(u)?"Android":/iPhone|iPad/.test(u)?"iOS":/Windows/.test(u)?"Windows":/Mac OS/.test(u)?"macOS":/Linux/.test(u)?"Linux":"Устройство";
 var br=/Edg\//.test(u)?"Edge":/OPR\//.test(u)?"Opera":/Firefox\//.test(u)?"Firefox":/Chrome\//.test(u)?"Chrome":/Safari\//.test(u)?"Safari":"Браузер";
 return br+" · "+o}
function sDev(b){b.appendChild(h("div","empty","Загрузка…"));
 api("GET","/api/devices").then(function(l){b.innerHTML="";
  if(!Array.isArray(l)){b.appendChild(h("div","empty","Не удалось загрузить"));return}
  var cur=l.filter(function(x){return x.cur})[0],ot=l.filter(function(x){return !x.cur});
  if(cur)b.appendChild(cd("Это устройство",line(uaName(cur.ua),"Сейчас в сети")));
  if(ot.length){var rest=card("Активные сеансы");
   ot.forEach(function(x){rest.appendChild(line(uaName(x.ua),x.t?"Вход: "+new Date(x.t).toLocaleString("ru"):"",null,function(){
    if(confirm("Завершить этот сеанс?"))api("POST","/api/devices/end",{id:x.id}).then(function(){openSection("dev")})}))});
   b.appendChild(rest);
   var all=h("button","pbtn alt","Завершить все другие сеансы");
   all.onclick=function(){if(confirm("Завершить все другие сеансы?"))api("POST","/api/devices/end",{all:true}).then(function(){toast("Сеансы завершены");openSection("dev")})};
   b.appendChild(all);b.appendChild(hint("Нажми на сеанс, чтобы завершить его."))}
  else b.appendChild(hint("Других активных сеансов нет."))})}

/* Энергосбережение */
var LOWBAT=false;
function sPow(b){b.appendChild(cd("Энергосбережение",toggle("Режим энергосбережения","Отключает анимации интерфейса","pow")));
 b.appendChild(slider("Включать при заряде ниже, %",0,100,"powAt"));
 b.appendChild(hint("0 — не включать автоматически. Работает там, где браузер даёт доступ к заряду батареи."))}
var _ap=applyCfg;
applyCfg=function(){_ap();document.body.classList.toggle("noanim",!CFG.anim||CFG.pow||LOWBAT)};
if(navigator.getBattery)navigator.getBattery().then(function(bt){
 function u(){LOWBAT=CFG.powAt>0&&!bt.charging&&bt.level*100<=CFG.powAt;applyCfg()}
 bt.onlevelchange=u;bt.onchargingchange=u;u()});

/* Язык */
var LANGS=[["ru","Русский","Русский"],["en","English","Английский"],["uk","Українська","Украинский"],["es","Español","Испанский"],["de","Deutsch","Немецкий"],["tr","Türkçe","Турецкий"]];
function sLang(b){var c=card("Язык интерфейса");
 LANGS.forEach(function(l){c.appendChild(line(l[1],l[2],CFG.lang===l[0]?"✓":"",function(){
  if(l[0]!=="ru"){toast("Интерфейс пока только на русском");return}CFG.lang="ru";saveCfg()}))});
 b.appendChild(c)}

var SEC={priv:["Конфиденциальность",sPriv],notif:["Уведомления",sNotif],data:["Данные и память",sData],
 fold:["Папки с чатами",sFold],dev:["Устройства",sDev],pow:["Энергосбережение",sPow],lang:["Язык",sLang]};
function openSection(id){var s=SEC[id];if(!s){toast("Этот раздел скоро будет");return}openSub(s[0],s[1])}
