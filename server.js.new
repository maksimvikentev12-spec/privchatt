// NuzaGram: сервер + бот + сайт в одном файле. Нужен Node.js 18+.
// Запуск: BOT_TOKEN=токен_от_BotFather node server.js
const http = require('http'), fs = require('fs'), crypto = require('crypto');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { console.log('Нет BOT_TOKEN. Запусти так: BOT_TOKEN=токен node server.js'); process.exit(1); }
const PORT = process.env.PORT || 3000;
const DB_FILE = 'users.json';
fs.mkdirSync('avatars', { recursive: true });

let db = {};
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) {}
db.users = db.users || {}; db.sessions = db.sessions || {}; db.chats = db.chats || {};
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 1));

const tg = (method, body) =>
  fetch('https://api.telegram.org/bot' + TOKEN + '/' + method, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  }).then(r => r.json());

// ---------- номера ----------
// Внутренние номера мессенджера (не настоящие телефоны): +1 555 XXX XXXX
function newPhone() {
  for (;;) {
    const p = '1555' + String(crypto.randomInt(0, 10000000)).padStart(7, '0');
    if (!findByPhone(p)) return p;
  }
}
const findByPhone = p => Object.keys(db.users).find(id => db.users[id].phone === p);
const pretty = p => '+1 (' + p.slice(1, 4) + ') ' + p.slice(4, 7) + '-' + p.slice(7);
const uname = id => ((db.users[id].name || '') + ' ' + (db.users[id].last || '')).trim() || ('Пользователь ' + id.slice(-4));
const pubUser = i => ({ id: i, name: uname(i), username: db.users[i].username || '', avId: db.users[i].avId || '' });

// ---------- бот ----------
function onMessage(m) {
  if (!m || !m.text) return;
  const id = String(m.chat.id);
  if (m.text.startsWith('/start') || m.text.startsWith('/number')) {
    let u = db.users[id];
    if (!u) { u = db.users[id] = { phone: newPhone(), name: m.from.first_name || '', username: '' }; save(); }
    tg('sendMessage', {
      chat_id: id,
      text: 'Твой номер для входа:\n' + pretty(u.phone) +
        '\n\nВведи его на сайте. Код входа придёт сюда.'
    });
  }
}
async function poll() {
  let offset = 0;
  for (;;) {
    try {
      const r = await tg('getUpdates', { offset, timeout: 30 });
      if (r.ok === false) throw new Error(r.description);
      for (const u of r.result || []) { offset = u.update_id + 1; onMessage(u.message); }
    } catch (e) {
      console.log('Ошибка бота:', e.message);
      await new Promise(s => setTimeout(s, 3000));
    }
  }
}

// ---------- чаты ----------
function chatInfo(c, me) {
  let title = c.title, avId = '';
  if (c.type === 'dm') {
    const o = c.members.find(x => x !== me) || me;
    title = uname(o); avId = db.users[o].avId || '';
  }
  const last = c.msgs[c.msgs.length - 1];
  return {
    id: c.id, type: c.type, title, avId, members: c.members.length,
    canPost: c.type !== 'channel' || c.owner === me,
    last: last ? last.text : '', t: last ? last.t : c.t
  };
}
function newChat(type, title, owner, members) {
  const id = crypto.randomBytes(6).toString('hex');
  return db.chats[id] = { id, type, title, owner, members, msgs: [], seq: 0, t: Date.now() };
}

// ---------- HTTP ----------
const codes = {}; // phone -> { code, exp, tries, last }

function readJson(req, max) {
  max = max || 5000;
  return new Promise(res => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > max) req.destroy(); });
    req.on('end', () => { try { res(JSON.parse(s)); } catch (e) { res({}); } });
  });
}
const send = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
};
const clean = (s, n) => String(s || '').trim().slice(0, n);

async function api(req, res, path, q, me) {
  const get = req.method === 'GET';
  const body = get ? {} : await readJson(req, path === '/api/avatar' ? 400000 : 5000);
  const user = db.users[me];

  if (get && path === '/api/me')
    return send(res, 200, {
      id: me, name: user.name || '', last: user.last || '', bio: user.bio || '',
      username: user.username || '', birthday: user.birthday || '',
      phone: pretty(user.phone), avId: user.avId || ''
    });

  if (path === '/api/profile') {
    const un = clean(body.username, 20).replace(/^@/, '');
    if (un && !/^[A-Za-z0-9_]{3,20}$/.test(un))
      return send(res, 400, { error: 'Имя пользователя: 3-20 символов, латиница, цифры и _.' });
    if (un && Object.keys(db.users).some(i => i !== me && (db.users[i].username || '').toLowerCase() === un.toLowerCase()))
      return send(res, 400, { error: 'Это имя пользователя уже занято.' });
    const b = String(body.birthday || '');
    if (b && (!/^\d{4}-\d{2}-\d{2}$/.test(b) || isNaN(Date.parse(b)) || b < '1800-01-01' || b > new Date().toISOString().slice(0, 10)))
      return send(res, 400, { error: 'Проверь дату рождения.' });
    user.name = clean(body.name, 40); user.last = clean(body.last, 40);
    user.bio = clean(body.bio, 70); user.username = un; user.birthday = b; save();
    return send(res, 200, { ok: true });
  }

  if (path === '/api/avatar') {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/.exec(String(body.data || ''));
    if (!m || m[1].length > 300000) return send(res, 400, { error: 'Не удалось загрузить фото.' });
    const id = crypto.randomBytes(6).toString('hex');
    fs.writeFileSync('avatars/' + id + '.jpg', Buffer.from(m[1], 'base64'));
    if (user.avId) fs.unlink('avatars/' + user.avId + '.jpg', () => {});
    user.avId = id; save();
    return send(res, 200, { avId: id });
  }

  if (get && path === '/api/users')
    return send(res, 200, Object.keys(db.users).filter(i => i !== me).map(pubUser));

  if (get && path === '/api/search') {
    const s = (q.get('q') || '').trim().toLowerCase().replace(/^@/, '');
    if (!s) return send(res, 200, { people: [], chats: [] });
    const digits = s.replace(/\D/g, '');
    const people = Object.keys(db.users).filter(i => i !== me).filter(i => {
      const u = db.users[i];
      return uname(i).toLowerCase().includes(s) || (u.username || '').toLowerCase().includes(s) ||
        (digits.length >= 7 && u.phone === digits);
    }).map(pubUser);
    const chats = Object.values(db.chats).filter(c => c.type !== 'dm' && c.title.toLowerCase().includes(s))
      .map(c => ({ id: c.id, type: c.type, title: c.title, members: c.members.length, joined: c.members.includes(me) }));
    return send(res, 200, { people: people.slice(0, 20), chats: chats.slice(0, 20) });
  }

  if (get && path === '/api/chats')
    return send(res, 200, Object.values(db.chats).filter(c => c.members.includes(me))
      .map(c => chatInfo(c, me)).sort((a, b) => b.t - a.t));

  if (path === '/api/chat/new') {
    const title = clean(body.title, 50);
    if (!['group', 'channel'].includes(body.type) || !title)
      return send(res, 400, { error: 'Введите название.' });
    const c = newChat(body.type, title, me, [me]); save();
    return send(res, 200, { id: c.id });
  }

  if (path === '/api/chat/dm') {
    const other = String(body.userId || '');
    if (!db.users[other] || other === me) return send(res, 400, { error: 'Пользователь не найден.' });
    let c = Object.values(db.chats).find(c => c.type === 'dm' && c.members.includes(me) && c.members.includes(other));
    if (!c) { c = newChat('dm', '', me, [me, other]); save(); }
    return send(res, 200, { id: c.id });
  }

  if (path === '/api/chat/join') {
    const c = db.chats[body.chatId];
    if (!c || c.type === 'dm') return send(res, 404, { error: 'Чат не найден.' });
    if (!c.members.includes(me)) { c.members.push(me); save(); }
    return send(res, 200, { id: c.id });
  }

  if (path === '/api/chat/leave') {
    const c = db.chats[body.id];
    if (!c || !c.members.includes(me)) return send(res, 404, { error: 'Чат не найден.' });
    c.members = c.members.filter(x => x !== me);
    if (!c.members.length) delete db.chats[c.id];
    save();
    return send(res, 200, { ok: true });
  }

  if (get && path === '/api/chat/messages') {
    const c = db.chats[q.get('id')];
    if (!c || !c.members.includes(me)) return send(res, 404, { error: 'Чат не найден.' });
    const after = Number(q.get('after')) || 0;
    return send(res, 200, {
      chat: chatInfo(c, me),
      msgs: c.msgs.filter(m => m.n > after).map(m => ({
        n: m.n, mine: m.from === me, name: uname(m.from), text: m.text, t: m.t
      }))
    });
  }

  if (path === '/api/chat/send') {
    const c = db.chats[body.id];
    if (!c || !c.members.includes(me)) return send(res, 404, { error: 'Чат не найден.' });
    if (c.type === 'channel' && c.owner !== me) return send(res, 403, { error: 'В канале пишет только владелец.' });
    const text = clean(body.text, 2000);
    if (!text) return send(res, 400, { error: 'Пустое сообщение.' });
    c.msgs.push({ n: ++c.seq, from: me, text, t: Date.now() }); save();
    return send(res, 200, { ok: true });
  }

  if (get && path === '/api/devices') {
    const cur = req.headers['x-token'];
    return send(res, 200, Object.keys(db.sessions).filter(t => db.sessions[t] === me).map(t => ({
      id: t.slice(0, 12), cur: t === cur,
      ua: ((db.devs || {})[t] || {}).ua || '', t: ((db.devs || {})[t] || {}).t || 0
    })).sort((a, b) => (b.cur - a.cur) || (b.t - a.t)));
  }
  if (path === '/api/devices/end') {
    const cur = req.headers['x-token'];
    for (const t of Object.keys(db.sessions))
      if (db.sessions[t] === me && t !== cur && (body.all || t.slice(0, 12) === String(body.id || ''))) {
        delete db.sessions[t]; if (db.devs) delete db.devs[t];
      }
    save(); return send(res, 200, { ok: true });
  }
  send(res, 404, { error: 'Не найдено.' });
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), path = u.pathname;
  try {
    if (req.method === 'GET' && (path === '/' || path === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(PAGE);
    }
    const av = /^\/av\/([0-9a-f]{12})\.jpg$/.exec(path);
    if (req.method === 'GET' && av) {
      return fs.readFile('avatars/' + av[1] + '.jpg', (err, buf) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable' });
        res.end(buf);
      });
    }
    if (req.method === 'POST' && path === '/api/send') {
      const phone = String((await readJson(req)).phone || '').replace(/\D/g, '');
      const id = findByPhone(phone);
      if (!id) return send(res, 404, { error: 'Номер не найден. Получи номер у бота командой /start.' });
      const c = codes[phone];
      if (c && Date.now() - c.last < 30000)
        return send(res, 429, { error: 'Код уже отправлен. Подожди 30 секунд.' });
      const code = String(crypto.randomInt(10000, 100000));
      codes[phone] = { code, exp: Date.now() + 5 * 60000, tries: 0, last: Date.now() };
      const r = await tg('sendMessage', { chat_id: id, text: 'Код входа: ' + code + '\nНикому его не говори.' });
      if (!r.ok) return send(res, 502, { error: 'Бот не смог отправить код. Напиши ему /start.' });
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && path === '/api/verify') {
      const b = await readJson(req);
      const phone = String(b.phone || '').replace(/\D/g, '');
      const c = codes[phone];
      if (!c || Date.now() > c.exp) return send(res, 400, { error: 'Код устарел. Запроси новый.' });
      if (++c.tries > 5) { delete codes[phone]; return send(res, 429, { error: 'Слишком много попыток. Запроси новый код.' }); }
      if (String(b.code) !== c.code) return send(res, 400, { error: 'Неверный код. Проверь цифры и повтори.' });
      delete codes[phone];
      const id = findByPhone(phone);
      const token = crypto.randomBytes(24).toString('hex');
      db.sessions[token] = id; db.devs = db.devs || {}; db.devs[token] = { ua: String(req.headers['user-agent'] || '').slice(0, 300), t: Date.now() }; save();
      return send(res, 200, { ok: true, token, name: db.users[id].name });
    }
    if (path.startsWith('/api/')) {
      const me = db.sessions[req.headers['x-token']];
      if (!me || !db.users[me]) return send(res, 401, { error: 'Войди заново.' });
      return await api(req, res, path, u.searchParams, me);
    }
    res.writeHead(404); res.end();
  } catch (e) {
    console.log('Ошибка:', e.message);
    if (!res.headersSent) send(res, 500, { error: 'Ошибка сервера.' });
  }
}).listen(PORT, () => console.log('Сайт: http://localhost:' + PORT));

poll();

// ---------- сайт ----------
const PAGE = String.raw`<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark"><title>NuzaGram</title><link rel="icon" id="fav" href="data:,">
<style>
:root{--bg:#17212b;--field:#232e3c;--card:#232e3c;--line:#101921;--text:#ffffff;--mute:#708499;--accent:#5ca1e6;--mine:#2b5278;--err:#e0685f;--fs:15px;--br:12px;--wall:#0e1621;--nav:#17212b;--navon:#232e3c;--sheet:#17212b;--bd:#101921}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding-top:env(safe-area-inset-top,0px)}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
.hide{display:none!important}
.screen{display:none;max-width:420px;margin:0 auto;padding:16px 24px 32px;min-height:90vh;flex-direction:column}
.screen.on{display:flex}
h1{font-size:22px;font-weight:600;text-align:center;margin:56px 0 12px}
.sub{color:var(--mute);text-align:center;font-size:17px;line-height:1.5;margin:0 0 36px}
.go{align-self:flex-end;margin-top:10px;width:62px;height:62px;border-radius:50%;background:var(--accent);color:#fff;font-size:28px;display:grid;place-items:center}
#app{display:none;height:100%;max-width:560px;margin:0 auto;position:relative;overflow:hidden}
#app.on{display:block}
.tab{display:none;height:100%;flex-direction:column}
.tab.on{display:flex}
.top{display:flex;align-items:center;gap:10px;padding:10px 16px;min-height:56px;background:var(--nav);border-bottom:1px solid var(--line)}
.top h2{flex:1;margin:0;font-size:20px;font-weight:600}
.ico{background:none;border:0;border-radius:50%;width:40px;height:40px;display:grid;place-items:center;flex:none;color:var(--mute)}
.scroll{flex:1;overflow:auto;padding:0 0 85px}
.row{display:flex;align-items:center;gap:14px;width:100%;background:none;border:0;padding:10px 16px;text-align:left;border-bottom:1px solid var(--line)}
.row:active{background:var(--field)}
.ava{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-size:22px;font-weight:600;flex:none;color:#fff;position:relative}
.rb{flex:1;min-width:0}
.rt{font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs{color:var(--mute);font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.rr{color:var(--mute);font-size:13px;flex:none}
.fab{position:fixed;right:20px;bottom:calc(env(safe-area-inset-bottom,0px) + 100px);width:50px;height:50px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;box-shadow:0 4px 10px rgba(0,0,0,.3);z-index:3}
.nav{position:fixed;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);display:flex;background:var(--nav);border-radius:30px;padding:6px 10px;z-index:3;max-width:440px;margin:0 auto;box-shadow:0 4px 15px rgba(0,0,0,0.5);align-items:center;}
.nav button{flex:1;background:none;border:0;border-radius:20px;padding:8px 2px;color:var(--mute);font-size:11px;display:flex;flex-direction:column;align-items:center;gap:3px;transition:0.2s;}
.nav button.on{color:var(--accent);background:var(--navon);}
.page{flex:1;overflow:auto;padding:0 0 85px}
.hero{text-align:center;padding:20px 0 18px;border-bottom:1px solid var(--line);margin-bottom:10px}
.hero .ava{width:100px;height:100px;font-size:40px;margin:0 auto 14px}
.hero h3{margin:0 0 6px;font-size:22px;font-weight:600}
.hero p{margin:0;color:var(--mute);font-size:15px}
.card{background:var(--bg);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:0 16px;margin-bottom:15px}
.kv{padding:12px 0}
.kv .v{font-size:17px;font-weight:600}
.kv .k{color:var(--mute);font-size:14px;margin-top:3px}
.srow{display:flex;align-items:center;gap:16px;width:100%;background:none;border:0;padding:14px 0;text-align:left;border-bottom:1px solid var(--line)}
.srow:last-child{border-bottom:0}
.si{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;color:#fff;flex:none}
.srow .rt{font-size:17px;font-weight:400}
.srow .rs{white-space:normal;font-size:14px}
#acc,#chat,#cset,#web{position:absolute;inset:0;background:var(--bg);z-index:8;display:none;flex-direction:column}
#acc.on,#chat.on,#cset.on,#web.on{display:flex}
.msgs{flex:1;overflow:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:var(--wall)}
.b{max-width:80%;padding:8px 12px;border-radius:12px;font-size:16px;background:var(--card);align-self:flex-start;line-height:1.35;word-break:break-word;white-space:pre-wrap;position:relative}
.b.mine{background:var(--mine);color:#fff;align-self:flex-end}
.b .tm{color:var(--mute);font-size:11px;text-align:right;margin-top:4px}
.b.mine .tm{color:#a0b8d0}
.compose{display:flex;align-items:flex-end;gap:8px;padding:8px 10px calc(env(safe-area-inset-bottom,0px) + 8px);background:var(--nav);border-top:1px solid var(--line)}
.cbox{flex:1;display:flex;align-items:center;background:var(--field);border-radius:18px;padding:0 6px;min-width:0}
.cbox textarea{flex:1;background:none;border:0;padding:12px 4px;color:var(--text);font:inherit;font-size:16px;outline:0;min-width:0;resize:none;max-height:120px;height:44px}
.sendb{width:44px;height:44px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;flex:none}

.country{display:flex;justify-content:space-between;width:100%;background:none;border:1px solid var(--line);border-radius:14px;padding:18px 16px;font-size:17px;cursor:pointer;color:var(--text);margin-bottom:20px}
.country span:last-child{color:var(--mute)}
.phone{position:relative;margin-top:22px;border:2px solid var(--accent);border-radius:14px;display:flex;align-items:center;padding:20px 16px 14px;width:100%}
.phone label{position:absolute;top:-11px;left:12px;background:var(--bg);padding:0 6px;color:var(--accent);font-size:14px}
.cc{font-size:19px;width:64px;border-right:1px solid var(--line);margin-right:14px}
.phone input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--text);font-size:19px}
.go{align-self:flex-end;margin-top:20px;width:62px;height:62px;border-radius:50%;border:0;background:var(--accent);color:#fff;font-size:28px;cursor:pointer;display:grid;place-items:center}
<link rel="stylesheet" href="/style.css"></style></head><body>

<section class="screen on" id="s1">
 <button class="back" aria-label="Назад">←</button>
 <h1>Номер телефона</h1>
 <p class="sub">Проверьте код страны<br>и введите свой номер<br>телефона.</p>
 <button class="country" id="countryBtn"><span id="countryName">США</span><span>›</span></button>
 <div class="phone"><label for="num">Номер телефона</label><span class="cc" id="cc">+1</span>
  <input id="num" type="tel" inputmode="tel" placeholder="(000) 000-0000"></div>
 <p class="msg" id="err1" role="alert"></p>
 <button class="go" id="next1" disabled aria-label="Продолжить">→</button>
</section>
<section class="screen" id="s2">
 <button class="back" id="back2" aria-label="Назад">←</button>
 <h1 id="t2">Введите код</h1>
 <p class="sub">Код пришёл от бота<br>в Telegram.</p>
 <input class="code" id="code" inputmode="numeric" maxlength="5" autocomplete="one-time-code" aria-label="Код из 5 цифр" placeholder="•••••">
 <p class="msg" id="err" role="alert"></p>
 <button class="link" id="resend" disabled>Отправить код ещё раз</button>
</section>

<div id="app">
 <section class="tab on" id="tChats">
  <div class="top" id="topNormal"><h2>NuzaGram</h2><button class="ico" id="sBtn" aria-label="Поиск"></button></div>
  <div class="top hide" id="topSearch"><button class="ico" id="sBack" aria-label="Закрыть поиск"></button><input class="sbox" id="sInp" placeholder="Поиск людей, групп и каналов" autocomplete="off"></div>
  <div class="scroll" id="chatList"></div>
  <div class="scroll hide" id="searchRes"></div>
  <button class="fab" id="fab" aria-label="Создать группу или канал"></button>
 </section>
 <section class="tab" id="tContacts">
  <div class="top"><h2>Контакты</h2></div>
  <div class="scroll" id="contactList"></div>
 </section>
 <section class="tab" id="tSettings">
  <div class="top"><h2>Настройки</h2></div>
  <div class="page" id="setBox"></div>
 </section>
 <section class="tab" id="tProfile">
  <div class="top"><h2>Профиль</h2></div>
  <div class="page" id="profBox"></div>
 </section>
 <nav class="nav" id="nav" aria-label="Разделы"></nav>

 <div id="acc">
  <div class="top"><button class="ico" id="aBack" aria-label="Назад"></button><h2 style="text-align:center;margin-right:44px">Аккаунт</h2></div>
  <div class="page" id="accBox"></div>
 </div>

 <div id="cset">
  <div class="top"><button class="ico" id="csBack" aria-label="Назад"></button><h2 style="text-align:center;margin-right:44px">Настройки чатов</h2></div>
  <div class="page" id="csetBox"></div>
 </div>
 <div id="web">
  <div class="webbar"><button class="ico" id="webBack" aria-label="Закрыть"></button><div class="rb"><div class="rt" id="webT"></div></div><button class="btn" id="webExt">В браузере</button></div>
  <iframe id="webF" title="Встроенный браузер" sandbox="allow-scripts allow-forms allow-same-origin allow-popups" style="flex:1;border:0;background:#fff"></iframe>
 </div>
 <div id="pk"><div class="sh" id="pkBox"></div></div>
 <div id="chat">
  <div class="top"><button class="ico" id="cBack" aria-label="Назад"></button><div id="cAva"></div><div class="rb"><div class="rt" id="cTitle"></div><div class="rs" id="cSub"></div></div></div>
  <div class="msgs" id="msgs"></div>
  <div class="compose" id="compose">
   <div class="cbox"><button class="cib" id="cEmoji" aria-label="Эмодзи"></button><textarea id="cInp" rows="1" placeholder="Сообщение" autocomplete="off"></textarea><button class="cib" id="cClip" aria-label="Прикрепить"></button></div>
   <button class="sendb" id="cSend" aria-label="Отправить"></button>
  </div>
  <div class="note hide" id="cNote">В канале пишет только владелец.</div>
 </div>

 <div id="sheet"><div class="sh">
  <h3>Создать</h3>
  <input id="newTitle" maxlength="50" placeholder="Название" autocomplete="off">
  <div class="pmsg" id="newMsg" style="color:var(--err)"></div>
  <div class="two"><button id="mkGroup">Группа</button><button id="mkChannel">Канал</button></div>
  <button class="x" id="shX">Отмена</button>
 </div></div>
</div>
<input type="file" id="pick" accept="image/*" class="hide"><input type="file" id="pickWall" accept="image/*" class="hide">
<div id="toast" role="status"></div>

<script>
var $=function(i){return document.getElementById(i)};
var T=null;try{T=localStorage.getItem("token")}catch(e){}
function h(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function svg(p,s,w){s=s||24;return '<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="currentColor" stroke-width="'+(w||1.8)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'}
var P={
 chats:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
 contacts:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.5c1.5-2.2 3.3-3 5.5-3s4 .8 5.5 3"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
 person:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
 back:'<path d="M19 12H5M12 19l-7-7 7-7"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 cam:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
 pen:'<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
 smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14a4.5 4.5 0 0 0 8 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
 clip:'<path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 5 5l-8.5 8.5a1.7 1.7 0 0 1-2.5-2.5L14 8"/>',
 mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 send:'<path d="M5 12h14M13 6l6 6-6 6"/>',
 key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
 spk:'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
 pie:'<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>',
 folder:'<path d="M3 7h6l2 2h10v10H3z"/>',
 laptop:'<rect x="4" y="5" width="16" height="11" rx="1"/><path d="M2 19h20"/>',
 bat:'<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 11v2"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'
};
function ic(n,s,w){return svg(P[n],s,w)}
function ava(name,av,size){name=name||"?";var a=h("div","ava",av?"":(name.trim().charAt(0).toUpperCase()||"?"));
 if(av){a.style.backgroundImage="url(/av/"+av+".jpg)";a.style.backgroundSize="cover";a.style.backgroundPosition="center"}
 else{var s=0;for(var i=0;i<name.length;i++)s=(s*31+name.charCodeAt(i))%360;a.style.background="hsl("+s+" 45% 38%)"}
 if(size){a.style.width=a.style.height=size+"px";a.style.fontSize=Math.round(size*.42)+"px"}return a}
function toast(t){var e=$("toast");e.textContent=t;e.style.display="block";clearTimeout(e.t);e.t=setTimeout(function(){e.style.display="none"},2200)}
function api(m,url,data){return fetch(url,{method:m,headers:{"content-type":"application/json","x-token":T||""},body:m==="GET"?undefined:JSON.stringify(data||{})})
 .then(function(r){return r.json().then(function(j){if(r.status===401&&T)logout();return j})})
 .catch(function(){return {error:"Нет связи с сервером. Проверь, что он запущен."}})}
function logout(){T=null;ME=null;try{localStorage.removeItem("token")}catch(e){}
 closeChat();$("acc").classList.remove("on");$("app").classList.remove("on");show("s1")}
function fmtTime(t){var d=new Date(t),n=new Date();
 return d.toDateString()===n.toDateString()?d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):d.toLocaleDateString([],{day:"numeric",month:"short"})}
function full(m){return ((m.name||"")+" "+(m.last||"")).trim()||"Без имени"}

/* ---------- вход ---------- */
var cur=["США","+1"],timer=null;
function show(id){["s1","s2"].forEach(function(s){$(s).classList.toggle("on",s===id)})}
function digits(){return $("num").value.replace(/\D/g,"")}
function fmt(d){d=d.slice(0,10);var a=d.slice(0,3),b=d.slice(3,6),c=d.slice(6);
 return (a?"("+a+(a.length===3?")":""):"")+(b?" "+b:"")+(c?"-"+c:"")}
function phoneFull(){return "1"+digits()}
$("num").addEventListener("input",function(){this.value=fmt(digits());$("err1").textContent="";$("next1").disabled=digits().length<10});
function cooldown(){$("resend").disabled=true;var s=30;clearInterval(timer);
 $("resend").textContent="Отправить ещё раз через "+s+" с";
 timer=setInterval(function(){s--;if(s<=0){clearInterval(timer);$("resend").disabled=false;$("resend").textContent="Отправить код ещё раз"}
  else $("resend").textContent="Отправить ещё раз через "+s+" с"},1000)}
$("next1").onclick=function(){$("next1").disabled=true;
 api("POST","/api/send",{phone:phoneFull()}).then(function(j){$("next1").disabled=false;
  if(j.error){$("err1").textContent=j.error;return}
  $("t2").textContent="+1 "+$("num").value;$("code").value="";$("err").textContent="";show("s2");cooldown();$("code").focus()})};
$("back2").onclick=function(){show("s1")};
$("resend").onclick=function(){$("err").textContent="";api("POST","/api/send",{phone:phoneFull()}).then(function(j){if(j.error)$("err").textContent=j.error;else cooldown()})};
$("code").addEventListener("input",function(){this.value=this.value.replace(/\D/g,"");$("err").textContent="";
 if(this.value.length===5){api("POST","/api/verify",{phone:phoneFull(),code:this.value}).then(function(j){
  if(j.error){$("err").textContent=j.error;return}
  T=j.token;try{localStorage.setItem("token",T)}catch(e){}enterApp()})}});

/* ---------- иконки в интерфейсе ---------- */
$("sBtn").innerHTML=ic("search");$("sBack").innerHTML=ic("back");$("aBack").innerHTML=ic("back");$("cBack").innerHTML=ic("back");
$("fab").innerHTML=ic("plus",32,2);$("cEmoji").innerHTML=ic("smile",26);$("cClip").innerHTML=ic("clip",26);

/* ---------- приложение ---------- */
var ME=null,tab="tChats",searching=false;
var NAV=[["tChats","Чаты","chats"],["tContacts","Контакты","contacts"],["tSettings","Настройки","gear"],["tProfile","Профиль","person"]];
function buildNav(){var n=$("nav");n.innerHTML="";
 NAV.forEach(function(x){var b=h("button",x[0]===tab?"on":"");b.dataset.t=x[0];
  var i=h("span","ni");
  if(x[0]==="tProfile"&&ME&&ME.avId)i.appendChild(ava(full(ME),ME.avId,28));else i.innerHTML=ic(x[2],26);
  b.appendChild(i);b.appendChild(document.createTextNode(x[1]));b.onclick=function(){setTab(x[0])};n.appendChild(b)})}
function loadMe(cb){api("GET","/api/me").then(function(m){if(m&&!m.error){ME=m;buildNav()}if(cb)cb(m)})}
function enterApp(){$("s1").classList.remove("on");$("s2").classList.remove("on");$("app").classList.add("on");
 loadMe(function(){setTab("tChats")})}
function setTab(id){tab=id;
 document.querySelectorAll(".tab").forEach(function(t){t.classList.toggle("on",t.id===id)});buildNav();
 if(id==="tChats")loadChats();if(id==="tContacts")loadContacts();if(id==="tSettings")loadSettings();if(id==="tProfile")loadProfile()}

function row(name,av,title,sub,right,fn,div){var r=h(div?"div":"button","row");
 r.appendChild(ava(name,av));var b=h("div","rb");b.appendChild(h("div","rt",title));if(sub)b.appendChild(h("div","rs",sub));r.appendChild(b);
 if(right)r.appendChild(typeof right==="string"?h("div","rr",right):right);if(fn&&!div)r.onclick=fn;return r}
var KIND={group:"Группа",channel:"Канал",dm:""};

function loadChats(){api("GET","/api/chats").then(function(l){
 if(!Array.isArray(l)||searching)return;var box=$("chatList");box.innerHTML="";box.appendChild(fbar());l=sortPins(l).filter(inFolder);
 if(!l.length){box.appendChild(h("div","empty","Чатов пока нет.\nНажми +, чтобы создать группу или канал, или найди человека через поиск."));return}
 l.forEach(function(c){var sub=c.last||(KIND[c.type]?KIND[c.type]+" · "+c.members+" уч.":"Нет сообщений");
  addChatRow(box,c,sub)})})}
function loadContacts(){api("GET","/api/users").then(function(l){
 var box=$("contactList");box.innerHTML="";
 if(!Array.isArray(l)||!l.length){box.appendChild(h("div","empty","Других пользователей пока нет.\nКогда кто-то войдёт через бота, он появится здесь."));return}
 l.forEach(function(u){box.appendChild(row(u.name,u.avId,u.name,u.username?"@"+u.username:"",null,function(){openDm(u.id)}))})})}
function openDm(id){api("POST","/api/chat/dm",{userId:id}).then(function(j){if(j.id)openChat(j.id)})}

/* поиск */
var st=null;
$("sBtn").onclick=function(){searching=true;$("topNormal").classList.add("hide");$("topSearch").classList.remove("hide");
 $("chatList").classList.add("hide");$("searchRes").classList.remove("hide");$("fab").classList.add("hide");$("sInp").value="";$("searchRes").innerHTML="";$("sInp").focus()};
function endSearch(){searching=false;$("topNormal").classList.remove("hide");$("topSearch").classList.add("hide");
 $("chatList").classList.remove("hide");$("searchRes").classList.add("hide");$("fab").classList.remove("hide");loadChats()}
$("sBack").onclick=endSearch;
$("sInp").addEventListener("input",function(){clearTimeout(st);var q=this.value.trim();
 if(!q){$("searchRes").innerHTML="";return}
 st=setTimeout(function(){api("GET","/api/search?q="+encodeURIComponent(q)).then(function(j){
  var box=$("searchRes");box.innerHTML="";if(!j||j.error)return;
  if(!j.people.length&&!j.chats.length){box.appendChild(h("div","empty","Ничего не найдено."));return}
  if(j.people.length){box.appendChild(h("div","sec","Люди"));
   j.people.forEach(function(u){box.appendChild(row(u.name,u.avId,u.name,u.username?"@"+u.username:"",null,function(){endSearch();openDm(u.id)}))})}
  if(j.chats.length){box.appendChild(h("div","sec","Группы и каналы"));
   j.chats.forEach(function(c){
    if(c.joined){box.appendChild(row(c.title,"",c.title,KIND[c.type]+" · "+c.members+" уч.",null,function(){endSearch();openChat(c.id)}));return}
    var b=h("button","btn","Вступить");
    var r=row(c.title,"",c.title,KIND[c.type]+" · "+c.members+" уч.",b,null,true);
    b.onclick=function(){api("POST","/api/chat/join",{chatId:c.id}).then(function(x){if(x.id){endSearch();openChat(x.id)}})};
    box.appendChild(r)})}})},250)});

/* создание */
$("fab").onclick=function(){$("newTitle").value="";$("newMsg").textContent="";$("sheet").classList.add("on");$("newTitle").focus()};
$("shX").onclick=function(){$("sheet").classList.remove("on")};
function mk(type){api("POST","/api/chat/new",{type:type,title:$("newTitle").value}).then(function(j){
 if(j.error){$("newMsg").textContent=j.error;return}$("sheet").classList.remove("on");openChat(j.id)})}
$("mkGroup").onclick=function(){mk("group")};$("mkChannel").onclick=function(){mk("channel")};

/* фото профиля */
function pickPhoto(){$("pick").value="";$("pick").click()}
$("pick").onchange=function(){var f=this.files[0];if(!f)return;var img=new Image();
 img.onload=function(){var c=document.createElement("canvas");c.width=c.height=256;var s=Math.min(img.width,img.height);
  c.getContext("2d").drawImage(img,(img.width-s)/2,(img.height-s)/2,s,s,0,0,256,256);
  api("POST","/api/avatar",{data:c.toDataURL("image/jpeg",0.82)}).then(function(j){
   if(j.error){toast(j.error);return}toast("Фото обновлено");loadMe(function(){refreshTab()})})};
 img.onerror=function(){toast("Не удалось открыть фото")};img.src=URL.createObjectURL(f)};
function refreshTab(){if(tab==="tSettings")loadSettings();if(tab==="tProfile")loadProfile();if(tab==="tChats"&&!searching)loadChats()}

/* профиль */
function age(b){var d=new Date(b),n=new Date(),a=n.getFullYear()-d.getFullYear();
 if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return a}
function ruAge(a){var l=a%10,t=a%100;return a+" "+((t>10&&t<15)?"лет":l===1?"год":(l>1&&l<5)?"года":"лет")}
function kv(v,k){var d=h("div","kv");d.appendChild(h("div","v",v));d.appendChild(h("div","k",k));return d}
function loadProfile(){loadMe(function(m){if(!m||m.error)return;var b=$("profBox");b.innerHTML="";
 var hero=h("div","hero");hero.appendChild(ava(full(m),m.avId));hero.appendChild(h("h3",null,full(m)));hero.appendChild(h("p",null,"в сети"));b.appendChild(hero);
 var acts=h("div","acts");
 [["cam","Выбрать фото",pickPhoto],["pen","Изменить",openAcc],["gear","Настройки",function(){setTab("tSettings")}]].forEach(function(a){
  var bt=h("button");var s=h("span");s.innerHTML=ic(a[0],26);bt.appendChild(s);bt.appendChild(document.createTextNode(a[1]));bt.onclick=a[2];acts.appendChild(bt)});
 b.appendChild(acts);
 var card=h("div","card");card.appendChild(kv(m.phone,"Телефон"));
 card.appendChild(kv(m.username?"@"+m.username:"Не указано","Имя пользователя"));
 if(m.birthday){var d=new Date(m.birthday);card.appendChild(kv(d.toLocaleDateString("ru",{day:"numeric",month:"short",year:"numeric"}).replace(" г.","")+" ("+ruAge(age(m.birthday))+")","День рождения"))}
 if(m.bio)card.appendChild(kv(m.bio,"О себе"));
 b.appendChild(card)})}

/* настройки */
var SET=[["acc","Аккаунт","Номер, имя пользователя, «О себе»","#2f9bf0","person"],["chat","Настройки чатов","Обои, ночной режим, анимации","#f0a030","chats"],
 ["x","Конфиденциальность","Время захода, устройства, ключи доступа","#3ab54a","key"],["x","Уведомления","Звуки, звонки, счётчик сообщений","#e84855","spk"],
 ["x","Данные и память","Настройки загрузки медиафайлов","#3b6cf0","pie"],["x","Папки с чатами","Сортировка чатов по папкам","#1f9cf0","folder"],
 ["x","Устройства","Управление активными сеансами","#22b5b5","laptop"],["x","Энергосбережение","Экономия энергии при низком заряде","#f08a30","bat"],
 ["x","Язык","Русский","#a45be0","globe"]];
function loadSettings(){loadMe(function(m){if(!m||m.error)return;var b=$("setBox");b.innerHTML="";
 var hero=h("div","hero");var a=ava(full(m),m.avId);var cm=h("button","cam");cm.innerHTML=ic("cam",20);cm.setAttribute("aria-label","Выбрать фото");cm.onclick=pickPhoto;a.appendChild(cm);
 hero.appendChild(a);hero.appendChild(h("h3",null,full(m)));hero.appendChild(h("p",null,m.phone+(m.username?" • @"+m.username:"")));b.appendChild(hero);
 var card=h("div","card");
 SET.forEach(function(s){var r=h("button","srow");var i=h("span","si");i.style.background=s[3];i.innerHTML=ic(s[4],24);r.appendChild(i);
  var t=h("div","rb");t.appendChild(h("div","rt",s[1]));t.appendChild(h("div","rs",s[2]));r.appendChild(t);
  r.onclick=function(){if(s[0]==="acc")openAcc();else if(s[0]==="chat")openCset();else openSection(s[0])};card.appendChild(r)});
 b.appendChild(card)})}

/* аккаунт */
function openAcc(){loadMe(function(m){if(!m||m.error)return;var b=$("accBox");b.innerHTML="";
 var c1=h("div","card");
 c1.appendChild(h("div","lab","Ваше имя"));var n=h("input","inp");n.value=m.name;n.maxLength=40;c1.appendChild(n);
 var l=h("input","inp");l.value=m.last;l.maxLength=40;l.placeholder="Фамилия";c1.appendChild(l);b.appendChild(c1);
 var c2=h("div","card cnt");var bio=h("input","inp");bio.value=m.bio;bio.maxLength=70;bio.placeholder="«О себе»";
 var ct=h("span",null,String(70-m.bio.length));bio.oninput=function(){ct.textContent=String(70-bio.value.length)};c2.appendChild(bio);c2.appendChild(ct);b.appendChild(c2);
 b.appendChild(h("div","hint","Напишите немного о себе."));
 var c3=h("div","card");c3.appendChild(h("div","lab","Информация о Вас"));
 c3.appendChild(kv(m.phone,"Номер выдаёт бот, его нельзя изменить"));
 var un=h("input","inp");un.value=m.username;un.maxLength=20;un.placeholder="username";c3.appendChild(h("div","k",""));c3.appendChild(un);
 c3.appendChild(h("div","k","Имя пользователя"));
 var bd=h("input","inp");bd.type="date";bd.value=m.birthday;bd.max=new Date().toISOString().slice(0,10);c3.appendChild(bd);c3.appendChild(h("div","k","День рождения"));b.appendChild(c3);
 var pm=h("div","pmsg"),sv=h("button","pbtn","Сохранить"),lo=h("button","pbtn alt","Выйти из аккаунта");
 sv.onclick=function(){api("POST","/api/profile",{name:n.value,last:l.value,bio:bio.value,username:un.value,birthday:bd.value}).then(function(j){
  if(j.error){pm.style.color="var(--err)";pm.textContent=j.error;return}
  toast("Сохранено");$("acc").classList.remove("on");loadMe(function(){refreshTab()})})};
 lo.onclick=logout;b.appendChild(sv);b.appendChild(pm);b.appendChild(lo);
 $("acc").classList.add("on")})}
$("aBack").onclick=function(){$("acc").classList.remove("on")};

/* чат */
var CH=null,poller=null;
function setSend(){var ta=$("cInp");ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,120)+"px";var has=$("cInp").value.trim().length>0;$("cSend").innerHTML=has?ic("send",26,2.2):ic("mic",26,2)}
$("cInp").addEventListener("input",setSend);setSend();
function openChat(id){CH={id:id,after:0};$("msgs").innerHTML="";$("chat").classList.add("on");$("cInp").value="";setSend();
 pull(true);clearInterval(poller);poller=setInterval(function(){pull(false)},2500)}
function closeChat(){clearInterval(poller);CH=null;$("chat").classList.remove("on");if(tab==="tChats"&&!searching)loadChats()}
$("cBack").onclick=closeChat;
function pull(first){if(!CH)return;var id=CH.id;
 api("GET","/api/chat/messages?id="+id+"&after="+CH.after).then(function(j){
  if(!CH||CH.id!==id)return;if(j.error){if(first)closeChat();return}
  $("cTitle").textContent=j.chat.title;
  $("cSub").textContent=j.chat.type==="dm"?"":(KIND[j.chat.type]+" · "+j.chat.members+" уч.");
  if(first){var w=$("cAva");w.innerHTML="";w.appendChild(ava(j.chat.title,j.chat.avId,44))}
  $("compose").classList.toggle("hide",!j.chat.canPost);$("cNote").classList.toggle("hide",j.chat.canPost);
  var box=$("msgs"),near=box.scrollHeight-box.scrollTop-box.clientHeight<120;
  j.msgs.forEach(function(m){CH.after=Math.max(CH.after,m.n);
   var b=h("div","b"+(m.mine?" mine":""));if(!m.mine&&j.chat.type==="group")b.appendChild(h("div","who",m.name));
   b.appendChild(linkify(m.text));b.appendChild(h("div","tm",fmtTime(m.t)));box.appendChild(b)});
  if(first||(near&&j.msgs.length))box.scrollTop=box.scrollHeight})}
function sendMsg(){var t=$("cInp").value.trim();if(!CH)return;if(!t){toast("Голосовые сообщения скоро будут");return}
 $("cInp").value="";setSend();
 api("POST","/api/chat/send",{id:CH.id,text:t}).then(function(j){if(j.error){$("cInp").value=t;setSend();toast(j.error);return}pull(false)})}
$("cSend").onclick=sendMsg;
$("cEmoji").onclick=function(){toast("Эмодзи скоро будут")};$("cClip").onclick=function(){toast("Отправка файлов скоро будет")};
$("cInp").addEventListener("keydown",function(e){if(e.key==="Enter"&&CFG.enter&&!e.shiftKey){e.preventDefault();sendMsg()}});

setInterval(function(){if($("app").classList.contains("on")&&!CH&&tab==="tChats"&&!searching)loadChats()},5000);

/* ---------- настройки чатов ---------- */
P.sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
P.moon='<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>';
P.image='<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/>';
P.palette='<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2-.6-1.2.2-2.5 1.7-2.5H18a3 3 0 0 0 3-3C21 7 17 3 12 3z"/><circle cx="8" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="11" r="1"/>';
P.brush='<path d="M14 4l6 6-7 7-6-6zM7 11l-3 8 8-3"/>';
P.pin='<path d="M12 17v5M8 3h8l-1 7 3 3H6l3-3z"/>';

var DEF={fs:16,br:17,theme:0,mine:"",accent:"",wall:-1,wallImg:"",dark:true,auto:false,lines:2,icon:0,swipe:"pin",browser:false,anim:true,
 hold:true,holdTalk:false,pauseRec:true,pauseStart:false,mic:"Встроенный",direct:true,adult:false,enter:false,dist:"Автоматически",pins:[]};
var CFG={};try{CFG=JSON.parse(localStorage.getItem("cfg")||"{}")}catch(e){}
Object.keys(DEF).forEach(function(k){if(CFG[k]===undefined)CFG[k]=DEF[k]});
function saveCfg(){try{localStorage.setItem("cfg",JSON.stringify(CFG))}catch(e){toast("Не удалось сохранить настройки")}}

var THEMES=[
 {n:"Лес",e:"🌿",mine:"#3d5a2a",wall:"#121212"},
 {n:"Палитра",e:"🎨",mine:"#a85a2d",wall:"#101010"},
 {n:"Аркада",e:"🎮",mine:"linear-gradient(135deg,#d44fa0,#6a5ae0)",wall:"linear-gradient(160deg,#0e1a38,#1b1440)"},
 {n:"Праздник",e:"🎄",mine:"linear-gradient(135deg,#c98a2c,#9a5a1e)",wall:"linear-gradient(160deg,#1f1410,#0f0c0a)"},
 {n:"Кристалл",e:"💜",mine:"linear-gradient(135deg,#a86ad8,#6a4ab8)",wall:"linear-gradient(160deg,#1c1030,#0c0818)"}];
var WALLS=[["Тёмная","#121212"],["Синяя","linear-gradient(160deg,#0e1a38,#1b1440)"],["Лес","linear-gradient(160deg,#0f1f10,#22331a)"],
 ["Закат","linear-gradient(160deg,#341a2a,#40281a)"],["Фиолет","linear-gradient(160deg,#1c1030,#0c0818)"],["Светлая","#e6ebe0"]];
var MINES=["#3d5a2a","#a85a2d","#2c5f8f","#7a3f9a","#8f2c4a","#2f6f6a","#555555","#b0872a"];
var ACCENTS=["#86b055","#4ea3e0","#e0a030","#e0685f","#a45be0","#3ab5a5","#e0589a","#b8b8b8"];
var ICONS=[["Океан","#37b6e8","#1d7fc4"],["Закат","#f59a45","#d94a6a"],["Лес","#9bd06a","#3f7a3a"],["Ночь","#3a4075","#0f1226"]];
function iconSvg(i,s){var c=ICONS[i];return '<svg viewBox="0 0 64 64" width="'+s+'" height="'+s+'" aria-hidden="true"><defs><linearGradient id="g'+i+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+c[1]+'"/><stop offset="1" stop-color="'+c[2]+'"/></linearGradient></defs><circle cx="32" cy="32" r="30" fill="url(#g'+i+')"/><path d="M18 22a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H31l-8 7v-7h-1a6 6 0 0 1-4-6z" fill="#fff"/></svg>'}

function isNight(){if(CFG.auto){var hr=new Date().getHours();return hr>=21||hr<7}return CFG.dark}
function wallCss(){var th=THEMES[CFG.theme]||THEMES[0];
 if(CFG.wallImg)return 'center / cover url("'+CFG.wallImg+'")';
 if(CFG.wall>=0&&WALLS[CFG.wall])return WALLS[CFG.wall][1];
 return isNight()?th.wall:"#e6ebe0"}
function applyCfg(){var r=document.documentElement,th=THEMES[CFG.theme]||THEMES[0],n=isNight();
 r.dataset.theme=n?"dark":"light";r.style.colorScheme=n?"dark":"light";
 r.style.setProperty("--fs",CFG.fs+"px");r.style.setProperty("--br",CFG.br+"px");
 r.style.setProperty("--mine",CFG.mine||th.mine);r.style.setProperty("--accent",CFG.accent||"#86b055");
 r.style.setProperty("--wall",wallCss());
 document.body.classList.toggle("noanim",!CFG.anim);document.body.classList.toggle("l3",CFG.lines===3);
 $("fav").href="data:image/svg+xml,"+encodeURIComponent(iconSvg(CFG.icon,64))}

/* элементы интерфейса */
function card(t){var c=h("div","card");if(t)c.appendChild(h("div","lab",t));return c}
function slider(title,min,max,key){var c=card();var tp=h("div","slh");tp.appendChild(h("div","lab2",title));
 var v=h("div","slv",String(CFG[key]));tp.appendChild(v);c.appendChild(tp);
 var r=h("input");r.type="range";r.min=min;r.max=max;r.value=CFG[key];r.setAttribute("aria-label",title);
 r.oninput=function(){CFG[key]=+r.value;v.textContent=r.value;applyCfg();saveCfg()};c.appendChild(r);return c}
function preview(){var p=h("div","pv");
 var a=h("div","b");var q=h("div","quote");q.appendChild(h("div","qn",ME?full(ME):"Вы"));q.appendChild(h("div",null,"Доброе утро!"));a.appendChild(q);
 a.appendChild(document.createTextNode("Знаешь, который час?"));a.appendChild(h("div","tm","02:30"));
 var b=h("div","b mine","В Токио утро");b.appendChild(h("div","tm","02:45"));p.appendChild(a);p.appendChild(b);return p}
function act(icon,text,right,fn){var b=h("button","srow act");var i=h("span","ai");i.innerHTML=ic(icon,26);b.appendChild(i);
 b.appendChild(h("div","rb at",text));if(right)b.appendChild(right);b.onclick=fn;return b}
function toggle(title,sub,key,note){var b=h("div","srow trow");var t=h("div","rb");t.appendChild(h("div","rt",title));
 if(sub!=null){var s=h("div","rs",typeof sub==="function"?sub():sub);s.style.whiteSpace="normal";t.appendChild(s)}b.appendChild(t);
 var sw=h("button","tg");sw.setAttribute("role","switch");sw.setAttribute("aria-label",title);sw.setAttribute("aria-checked",String(!!CFG[key]));
 sw.onclick=function(){CFG[key]=!CFG[key];sw.setAttribute("aria-checked",String(!!CFG[key]));applyCfg();saveCfg();
  if(key==="auto")renderCset();else if(note)toast(note)};
 b.appendChild(sw);return b}
function valrow(title,key,opts){var b=h("button","srow");b.appendChild(h("div","rb rt",title));var v=h("div","val",CFG[key]);b.appendChild(v);
 b.onclick=function(){CFG[key]=opts[(opts.indexOf(CFG[key])+1)%opts.length];v.textContent=CFG[key];saveCfg()};return b}

/* шторка выбора */
function openPk(title,build){var b=$("pkBox");b.innerHTML="";b.appendChild(h("h3",null,title));build(b);
 var x=h("button","x","Закрыть");x.onclick=closePk;b.appendChild(x);$("pk").classList.add("on")}
function closePk(){$("pk").classList.remove("on")}
$("pk").onclick=function(e){if(e.target===this)closePk()};
function pickColor(title,list,key){openPk(title,function(b){var g=h("div","sw");
 list.forEach(function(c){var s=h("button","dot"+(CFG[key]===c?" sel":""));s.style.background=c;s.setAttribute("aria-label",c);
  s.onclick=function(){CFG[key]=c;applyCfg();saveCfg();closePk();renderCset()};g.appendChild(s)});b.appendChild(g);
 var r=h("button","pbtn alt","По умолчанию");r.style.color="var(--text)";
 r.onclick=function(){CFG[key]="";applyCfg();saveCfg();closePk();renderCset()};b.appendChild(r)})}
function pickWall(){openPk("Обои",function(b){var g=h("div","walls");
 WALLS.forEach(function(w,i){var s=h("button","wl"+(CFG.wall===i&&!CFG.wallImg?" sel":""));s.style.background=w[1];s.setAttribute("aria-label",w[0]);
  s.onclick=function(){CFG.wall=i;CFG.wallImg="";applyCfg();saveCfg();closePk();renderCset()};g.appendChild(s)});b.appendChild(g);
 var up=h("button","pbtn","Выбрать из галереи");up.onclick=function(){closePk();$("pickWall").value="";$("pickWall").click()};b.appendChild(up);
 var r=h("button","pbtn alt","Сбросить обои");r.style.color="var(--text)";
 r.onclick=function(){CFG.wall=-1;CFG.wallImg="";applyCfg();saveCfg();closePk();renderCset()};b.appendChild(r)})}
$("pickWall").onchange=function(){var f=this.files[0];if(!f)return;var img=new Image();
 img.onload=function(){var w=Math.min(720,img.width),c=document.createElement("canvas");c.width=w;c.height=Math.round(img.height*w/img.width);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);CFG.wallImg=c.toDataURL("image/jpeg",0.7);applyCfg();saveCfg();renderCset();toast("Обои изменены")};
 img.onerror=function(){toast("Не удалось открыть фото")};img.src=URL.createObjectURL(f)};

/* блоки экрана */
function themesCard(){var c=card("Цветовая тема");var car=h("div","car");
 THEMES.forEach(function(t,i){var b=h("button","tc"+(i===CFG.theme?" sel":""));b.setAttribute("aria-label",t.n);b.style.background=isNight()?t.wall:"#e6ebe0";
  var m=h("span","tm1");m.style.background=t.mine;b.appendChild(m);b.appendChild(h("span","tm2"));b.appendChild(h("span","te",t.e));
  b.onclick=function(){CFG.theme=i;CFG.mine="";CFG.wall=-1;CFG.wallImg="";applyCfg();saveCfg();renderCset()};car.appendChild(b)});
 c.appendChild(car);
 c.appendChild(act(isNight()?"sun":"moon",isNight()?"Переключить на дневную тему":"Переключить на ночную тему",null,function(){
  CFG.dark=!isNight();CFG.auto=false;applyCfg();saveCfg();renderCset()}));
 c.appendChild(act("brush","Настройки темы",null,function(){pickColor("Цвет оформления",ACCENTS,"accent")}));return c}
function linesCard(){var c=card("Список чатов");var g=h("div","lines");
 [[2,"Двустрочный"],[3,"Трёхстрочный"]].forEach(function(o){var b=h("button","ln"+(CFG.lines===o[0]?" sel":""));
  var pv=h("span","lpv");for(var i=0;i<o[0];i++)pv.appendChild(h("i"));b.appendChild(pv);b.appendChild(document.createTextNode(o[1]));
  b.onclick=function(){CFG.lines=o[0];applyCfg();saveCfg();renderCset()};g.appendChild(b)});c.appendChild(g);return c}
function iconsCard(){var c=card("Иконка приложения");var car=h("div","car icons");
 ICONS.forEach(function(x,i){var b=h("button","ic"+(i===CFG.icon?" sel":""));var s=h("span");s.innerHTML=iconSvg(i,56);b.appendChild(s);b.appendChild(h("span","icl",x[0]));
  b.onclick=function(){CFG.icon=i;applyCfg();saveCfg();renderCset()};car.appendChild(b)});c.appendChild(car);return c}
function swipeCard(){var c=card("Смахивание влево в списке чатов");var w=h("div","swp");
 var pv=h("div","swpv");pv.appendChild(h("i"));pv.appendChild(h("b"));w.appendChild(pv);
 var col=h("div","swo");[["none","Нет"],["pin","Закрепить"],["del","Удалить"]].forEach(function(o){
  var b=h("button","so"+(CFG.swipe===o[0]?" sel":""),o[1]);b.onclick=function(){CFG.swipe=o[0];saveCfg();renderCset();loadChats()};col.appendChild(b)});
 w.appendChild(col);c.appendChild(w);return c}
function renderCset(){var b=$("csetBox"),st=b.scrollTop;b.innerHTML="";
 var c1=slider("Размер текста сообщений",12,30,"fs");c1.appendChild(preview());
 c1.appendChild(act("image","Изменить обои",null,pickWall));
 c1.appendChild(act("palette","Изменить цвет",h("span","chip",ME?full(ME):"Вы"),function(){pickColor("Цвет ваших сообщений",MINES,"mine")}));
 b.appendChild(c1);b.appendChild(themesCard());b.appendChild(slider("Углы блоков с сообщениями",0,17,"br"));
 b.appendChild(linesCard());b.appendChild(iconsCard());b.appendChild(swipeCard());
 b.appendChild(h("div","hint","Выбор действия, которое будет выполняться при смахивании влево в списке чатов."));
 var t=card();
 t.appendChild(toggle("Смена темы ночью",function(){return CFG.auto?"Включена":"Выключена"},"auto"));
 t.appendChild(toggle("Встроенный браузер","Открывать ссылки в приложении","browser"));
 t.appendChild(toggle("Анимации","Настройки для экономии заряда","anim"));
 var sr=h("button","srow");var sb=h("div","rb");sb.appendChild(h("div","rt","Стикеры и эмодзи"));sb.appendChild(h("div","rs","Настройки стикеров, эмодзи и анимированных эмодзи"));
 sr.appendChild(sb);sr.onclick=function(){toast("Стикеры скоро будут")};t.appendChild(sr);b.appendChild(t);
 var m=card("Медиафайлы и звук");
 m.appendChild(toggle("Поднести и слушать","Переключаться на верхний динамик, когда Вы подносите телефон к уху","hold"));
 m.appendChild(toggle("Поднести и говорить","Записывать голосовое сообщение, когда Вы подносите телефон к уху","holdTalk"));
 m.appendChild(toggle("Пауза музыки при записи видеосообщения","Останавливать музыку на время записи видеосообщения","pauseRec"));
 m.appendChild(toggle("Пауза музыки при запуске видеосообщения",null,"pauseStart"));
 m.appendChild(valrow("Микрофон","mic",["Встроенный"]));b.appendChild(m);
 var o=card("Прочие настройки");
 o.appendChild(toggle("Direct Share","Показывать недавние чаты в меню «Поделиться»","direct"));
 o.appendChild(toggle("Показывать материалы 18+","Не скрывать медиа, предназначенные только для взрослых","adult"));
 o.appendChild(toggle("Отправка по Enter",null,"enter"));
 o.appendChild(valrow("Мера расстояния","dist",["Автоматически","Километры","Мили"]));b.appendChild(o);
 b.scrollTop=st}
function openCset(){renderCset();$("cset").classList.add("on")}
$("csBack").innerHTML=ic("back");$("csBack").onclick=function(){$("cset").classList.remove("on")};

/* список чатов: закрепление и смахивание */
function sortPins(l){var p=CFG.pins||[];return l.slice().sort(function(a,b){var x=p.indexOf(a.id)>-1,y=p.indexOf(b.id)>-1;return x===y?b.t-a.t:x?-1:1})}
function doSwipe(c){
 if(CFG.swipe==="pin"){var i=CFG.pins.indexOf(c.id);if(i>-1)CFG.pins.splice(i,1);else CFG.pins.push(c.id);saveCfg();loadChats();toast(i>-1?"Чат откреплён":"Чат закреплён")}
 else if(CFG.swipe==="del"){if(confirm("Удалить чат «"+c.title+"»?"))api("POST","/api/chat/leave",{id:c.id}).then(function(){loadChats()})}}
function addChatRow(box,c,sub){var pinned=CFG.pins.indexOf(c.id)>-1,right=fmtTime(c.t);
 if(pinned){right=h("div","rr");right.style.display="flex";right.style.alignItems="center";right.style.gap="6px";
  var pi=h("span");pi.innerHTML=ic("pin",16);right.appendChild(pi);right.appendChild(document.createTextNode(fmtTime(c.t)))}
 var r=row(c.title,c.avId,c.title,sub,right,function(){openChat(c.id)});
 if(CFG.swipe==="none"){box.appendChild(r);return}
 var wrap=h("div","swr"),un=h("div","under",CFG.swipe==="pin"?(pinned?"Открепить":"Закрепить"):"Удалить");
 un.style.background=CFG.swipe==="pin"?"var(--accent)":"#c0443c";wrap.appendChild(un);wrap.appendChild(r);
 var x0=0,y0=0,dx=0,lock=null,on=false;
 r.addEventListener("touchstart",function(e){var t=e.touches[0];x0=t.clientX;y0=t.clientY;dx=0;lock=null;on=true;r.style.transition="none"},{passive:true});
 r.addEventListener("touchmove",function(e){if(!on)return;var t=e.touches[0],mx=t.clientX-x0,my=t.clientY-y0;
  if(lock===null&&(Math.abs(mx)>8||Math.abs(my)>8))lock=Math.abs(mx)>Math.abs(my);
  if(lock){dx=Math.min(0,mx);r.style.transform="translateX("+dx+"px)"}},{passive:true});
 r.addEventListener("touchend",function(){on=false;r.style.transition="";r.style.transform="";if(lock&&dx<-110)doSwipe(c)});
 box.appendChild(wrap)}

/* ссылки и встроенный браузер */
var URLRE=/(https?:\/\/[^\s]+)/g;
function linkify(t){var f=document.createDocumentFragment();t.split(URLRE).forEach(function(p,i){
 if(i%2===1){var a=h("a",null,p);a.href=p;a.target="_blank";a.rel="noopener noreferrer";a.style.color="inherit";a.style.textDecoration="underline";
  a.onclick=function(e){if(CFG.browser){e.preventDefault();openWeb(p)}};f.appendChild(a)}
 else if(p)f.appendChild(document.createTextNode(p))});return f}
function openWeb(u){$("webT").textContent=u;$("webF").src=u;$("webExt").onclick=function(){window.open(u,"_blank","noopener")};$("web").classList.add("on")}
$("webBack").innerHTML=ic("back");$("webBack").onclick=function(){$("web").classList.remove("on");$("webF").src="about:blank"};

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

applyCfg();
setInterval(function(){if(CFG.auto)applyCfg()},60000);

/* старт */
buildNav();
if(T){api("GET","/api/me").then(function(m){if(m&&!m.error)enterApp()})}
</script></body></html>`;
