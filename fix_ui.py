with open('server.js', 'r') as f: c = f.read()

# Добавляем стили для экрана входа, которые мы потеряли
fix_css = '''
.country{display:flex;justify-content:space-between;width:100%;background:none;border:1px solid var(--line);border-radius:14px;padding:18px 16px;font-size:17px;cursor:pointer;color:var(--text);margin-bottom:20px}
.country span:last-child{color:var(--mute)}
.phone{position:relative;margin-top:22px;border:2px solid var(--accent);border-radius:14px;display:flex;align-items:center;padding:20px 16px 14px;width:100%}
.phone label{position:absolute;top:-11px;left:12px;background:var(--bg);padding:0 6px;color:var(--accent);font-size:14px}
.cc{font-size:19px;width:64px;border-right:1px solid var(--line);margin-right:14px}
.phone input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--text);font-size:19px}
.go{align-self:flex-end;margin-top:20px;width:62px;height:62px;border-radius:50%;border:0;background:var(--accent);color:#fff;font-size:28px;cursor:pointer;display:grid;place-items:center}
'''
# Вставляем перед закрывающим </style>
c = c.replace('</style>', fix_css + '</style>')

with open('server.js', 'w') as f: f.write(c)
print("Стили входа исправлены!")
