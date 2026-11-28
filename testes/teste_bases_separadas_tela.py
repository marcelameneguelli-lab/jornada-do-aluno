import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg=br.new_page()
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'"); pg.goto(B+'#/s/engajamento'); pg.wait_for_timeout(5000)
    f=[x for x in pg.frames if 'modulos/engajamento' in x.url][-1]
    r=f.evaluate("""async () => {
      if (ACTIVE_BASE !== 'impar') await switchBase('impar');
      const orig = gasCall; const enviados = [];
      gasCall = async (a, b) => {
        if (a === 'getHistory') { await new Promise(r => setTimeout(r, 1500)); return { ok: true, data: { '999000111': [{ id: 'x1', atend: 'A', base: 'impar', datetime: '01/11/2026 10:00' }] } }; }
        if (a === 'saveAction' || a === 'saveHistoryFull') { enviados.push(a + ':' + (b.base || '')); return { ok: true }; }
        return orig(a, b);
      };
      const s = syncFromRemote();             // começa a sincronizar a Ímpar
      await new Promise(r => setTimeout(r, 200));
      await switchBase('par');                // troca para a Par no meio
      await s;
      const res = { base: ACTIVE_BASE, vazou: !!HISTORY['999000111'], guardadoPar: JSON.stringify(JSON.parse(localStorage.getItem(BASE_CONFIG.par.storageH) || '{}')).indexOf('999000111') >= 0, enviados };
      gasCall = orig; return res;
    }""")
    print(r)
    assert r['base']=='par' and not r['vazou'] and not r['guardadoPar'] and not any(':impar' in x or 'HistoryFull' in x for x in r['enviados']); print('ok  resposta da Ímpar que chega depois da troca para a Par é descartada')
    br.close()
print('erros:', erros or 'nenhum')
