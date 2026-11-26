import re
with open('server.js', 'r') as f: c = f.read()

c = c.replace('<title>Приватка</title>', '<title>NuzaGram</title>')
c = c.replace('>Приватка<', '>NuzaGram<')

tg_css = '''<style>
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
</style>'''

c = re.sub(r'<style>.*?</style>', tg_css, c, flags=re.DOTALL)
with open('server.js', 'w') as f: f.write(c)
print("Стили обновлены!")
