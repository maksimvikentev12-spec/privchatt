// Приватка: сервер + бот + сайт в одном файле. Нужен Node.js 18+.
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
      db.sessions[token] = id; save();
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
<meta name="color-scheme" content="dark"><title>Приватка</title><link rel="icon" id="fav" href="data:,">
<style>
:root{--bg:#181818;--field:#1e1e1e;--card:#232323;--line:#4a4a4a;--text:#f2f2f2;--mute:#8a8a8a;--accent:#86b055;--mine:#3d5a2a;--err:#e0685f;--fs:16px;--br:17px;--wall:#181818;--nav:#222;--navon:#2c3626;--sheet:#202020;--bd:#333}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding-top:env(safe-area-inset-top,0px)}
button{font:inherit;color:inherit}
svg{display:block}
button:focus-visible,input:focus-visible{outline:3px solid #cfe8ad;outline-offset:2px}
.hide{display:none!important}
.screen{display:none;max-width:420px;margin:0 auto;padding:16px 24px 32px;min-height:90vh;flex-direction:column}
.screen.on{display:flex}
.back{background:none;border:0;font-size:28px;padding:8px 0;width:40px;text-align:left;cursor:pointer}
h1{font-size:22px;font-weight:600;text-align:center;margin:56px 0 12px}
.sub{color:var(--mute);text-align:center;font-size:17px;line-height:1.5;margin:0 0 36px}
.country{display:flex;justify-content:space-between;width:100%;background:none;border:1px solid var(--line);border-radius:14px;padding:18px 16px;font-size:17px;cursor:pointer}
.country span:last-child{color:var(--mute)}
.phone{position:relative;margin-top:22px;border:2px solid var(--accent);border-radius:14px;display:flex;align-items:center;padding:20px 16px 14px}
.phone label{position:absolute;top:-11px;left:12px;background:var(--bg);padding:0 6px;color:var(--accent);font-size:14px}
.cc{font-size:19px;width:64px;border-right:1px solid var(--line);margin-right:14px}
.phone input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--text);font-size:19px}
.msg{min-height:24px;text-align:center;margin:14px 0 0;color:var(--err);font-size:15px}
.go{align-self:flex-end;margin-top:10px;width:62px;height:62px;border-radius:50%;border:0;background:var(--accent);color:#fff;font-size:28px;cursor:pointer}
.go:disabled{opacity:.35}
.code{width:100%;background:var(--field);border:2px solid var(--accent);border-radius:14px;padding:16px;text-align:center;font-size:32px;letter-spacing:14px;color:var(--text);outline:0}
.link{background:none;border:0;color:var(--accent);font-size:16px;margin-top:20px;cursor:pointer;align-self:center}
.link:disabled{color:var(--mute)}
/* приложение */
#app{display:none;height:100%;max-width:560px;margin:0 auto;position:relative;overflow:hidden}
#app.on{display:block}
.tab{display:none;height:100%;flex-direction:column}
.tab.on{display:flex}
.top{display:flex;align-items:center;gap:10px;padding:12px 16px;min-height:64px}
.top h2{flex:1;margin:0;font-size:24px;font-weight:600}
.ico{background:var(--card);border:0;border-radius:50%;width:44px;height:44px;display:grid;place-items:center;cursor:pointer;flex:none;padding:0}
.sbox{flex:1;background:var(--card);border:0;border-radius:22px;padding:12px 16px;color:var(--text);font-size:17px;outline:0;min-width:0}
.scroll{flex:1;overflow:auto;padding:0 8px 130px}
.row{display:flex;align-items:center;gap:14px;width:100%;background:none;border:0;padding:10px 8px;text-align:left;cursor:pointer;border-radius:14px}
.row:active{background:var(--card)}
.ava{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-size:22px;font-weight:600;flex:none;color:#fff;position:relative}
.rb{flex:1;min-width:0}
.rt{font-size:17px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rs{color:var(--mute);font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.rr{color:var(--mute);font-size:13px;flex:none}
.btn{background:var(--accent);color:#14210a;border:0;border-radius:18px;padding:8px 14px;font-weight:600;cursor:pointer;flex:none}
.sec{color:var(--accent);font-size:14px;padding:14px 10px 4px}
.empty{color:var(--mute);text-align:center;padding:60px 30px;line-height:1.5;white-space:pre-line}
.fab{position:absolute;right:18px;bottom:calc(env(safe-area-inset-bottom,0px) + 100px);width:62px;height:62px;border-radius:50%;border:0;background:var(--accent);color:#fff;display:grid;place-items:center;cursor:pointer;z-index:3}
.nav{position:absolute;left:14px;right:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);display:flex;gap:2px;background:var(--nav);border-radius:34px;padding:6px;z-index:3}
.nav button{flex:1;background:none;border:0;border-radius:28px;padding:9px 2px 8px;color:var(--text);font-size:13px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}
.nav button.on{background:var(--navon);color:var(--accent)}
.nav .ni{height:26px;display:grid;place-items:center}
/* профиль и настройки */
.page{flex:1;overflow:auto;padding:0 14px 130px}
.hero{text-align:center;padding:8px 0 18px}
.hero .ava{width:116px;height:116px;font-size:48px;margin:0 auto 14px}
.hero h3{margin:0 0 6px;font-size:23px;font-weight:600}
.hero p{margin:0;color:var(--mute);font-size:16px}
.cam{position:absolute;right:-2px;bottom:-2px;width:38px;height:38px;border-radius:50%;background:var(--accent);display:grid;place-items:center;color:#14210a;border:3px solid var(--bg);cursor:pointer}
.acts{display:flex;gap:10px;margin-bottom:14px}
.acts button{flex:1;background:var(--card);border:0;border-radius:18px;padding:16px 4px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;font-size:14px;font-weight:600;cursor:pointer}
.card{background:var(--card);border-radius:22px;padding:6px 16px;margin-bottom:14px}
.kv{padding:12px 0}
.kv .v{font-size:19px;font-weight:600}
.kv .k{color:var(--mute);font-size:15px;margin-top:3px}
.srow{display:flex;align-items:center;gap:16px;width:100%;background:none;border:0;padding:12px 0;text-align:left;cursor:pointer}
.si{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;color:#fff;flex:none}
.srow .rt{font-size:18px}
.srow .rs{white-space:normal}
/* аккаунт */
#acc,#chat{position:absolute;inset:0;background:var(--bg);z-index:8;display:none;flex-direction:column}
#acc.on,#chat.on{display:flex}
.lab{color:var(--accent);font-size:14px;margin:12px 0 4px}
.inp{display:block;width:100%;background:none;border:0;border-bottom:1px solid var(--bd);padding:12px 0;color:var(--text);font-size:19px;outline:0}
.inp::placeholder{color:var(--mute)}
.inp:last-child{border-bottom:0}
.cnt{display:flex;align-items:center}
.cnt .inp{flex:1;border:0}.cnt span{color:var(--mute);font-size:19px}
.hint{color:var(--mute);font-size:15px;padding:0 6px 14px;line-height:1.4}
.pbtn{width:100%;margin-top:6px;background:var(--accent);color:#14210a;border:0;border-radius:16px;padding:15px;font-size:17px;font-weight:600;cursor:pointer}
.pbtn.alt{background:var(--card);color:var(--err);margin-top:12px}
.pmsg{min-height:22px;text-align:center;margin-top:10px;font-size:15px}
/* чат */
.msgs{flex:1;overflow:auto;padding:8px 12px;display:flex;flex-direction:column;gap:6px;background:var(--wall)}
.b{max-width:80%;padding:8px 12px;border-radius:var(--br);font-size:var(--fs);background:var(--card);align-self:flex-start;line-height:1.35;word-break:break-word;white-space:pre-wrap}
.b.mine{background:var(--mine);color:#fff;align-self:flex-end}
.b .who{color:var(--accent);font-size:13px;font-weight:600;margin-bottom:2px}
.b .tm{color:var(--mute);font-size:11px;text-align:right;margin-top:2px}
.compose{display:flex;align-items:center;gap:8px;padding:8px 10px calc(env(safe-area-inset-bottom,0px) + 8px)}
.cbox{flex:1;display:flex;align-items:center;background:var(--card);border-radius:26px;padding:0 6px;min-width:0}
.cbox textarea{flex:1;background:none;border:0;padding:15px 4px;color:var(--text);font:inherit;font-size:18px;line-height:1.25;outline:0;min-width:0;resize:none;max-height:120px;height:52px}
.cib{background:none;border:0;width:42px;height:42px;display:grid;place-items:center;color:var(--mute);cursor:pointer;flex:none;padding:0}
.sendb{width:52px;height:52px;border-radius:50%;border:0;background:var
