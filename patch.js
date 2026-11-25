// Запуск: node patch.js
// Нужны рядом: server.js и settings-block.js. Делает копию server.js.bak и вносит все 5 правок.
const fs = require('fs');

const src0 = fs.readFileSync('server.js', 'utf8');
if (src0.includes('openSection')) { console.log('Патч уже применён.'); process.exit(0); }
const block = fs.readFileSync('settings-block.js', 'utf8');
fs.writeFileSync('server.js.bak', src0);

function rep(src, from, to) {
  const i = src.indexOf(from);
  if (i < 0) { console.log('НЕ НАЙДЕНО:\n' + from); process.exit(1); }
  return src.slice(0, i) + to + src.slice(i + from.length);
}

let s = src0;

// 1. блок настроек перед финальным applyCfg();
s = rep(s, 'applyCfg();\nsetInterval(function(){if(CFG.auto)',
  block + '\napplyCfg();\nsetInterval(function(){if(CFG.auto)');

// 2. клик по разделу
s = rep(s, 'else toast("Этот раздел скоро будет")};card', 'else openSection(s[0])};card');

// 3. папки в списке чатов
s = rep(s, 'box.innerHTML="";l=sortPins(l);',
  'box.innerHTML="";box.appendChild(fbar());l=sortPins(l).filter(inFolder);');

// 4. сервер: запоминаем устройство при входе
s = rep(s, 'db.sessions[token] = id; save();',
  "db.sessions[token] = id; db.devs = db.devs || {}; db.devs[token] = { ua: String(req.headers['user-agent'] || '').slice(0, 300), t: Date.now() }; save();");

// 5. сервер: список устройств и завершение сеансов
s = rep(s, "send(res, 404, { error: 'Не найдено.' });", `if (get && path === '/api/devices') {
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
  send(res, 404, { error: 'Не найдено.' });`);

fs.writeFileSync('server.js', s);
console.log('Готово. Перезапусти: BOT_TOKEN=токен node server.js');
