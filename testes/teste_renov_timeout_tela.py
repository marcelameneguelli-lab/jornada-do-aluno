import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg=br.new_page()
    pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'"); pg.goto(B+'#/s/renovacao'); pg.wait_for_timeout(4000)
    f=[x for x in pg.frames if 'modulos/renovacao' in x.url][-1]
    r=f.evaluate("""() => new Promise(res => {
      const orig = Api.chamar; const vistos = [];
      Api.chamar = (acao, d, o) => { vistos.push(acao + ':' + ((o && o.timeout) || '')); 
        if (acao === 'renovacao.importar_alunos') return Promise.reject(new Error('Tempo esgotado. Tente de novo.'));
        if (acao === 'renovacao.ping') return Promise.resolve({ ok: true, totaisCiclo: { '2026.4': 3 } });
        if (acao === 'renovacao.config') return Promise.resolve({});
        return orig(acao, d, o); };
      window._ciclosImportando = {}; window._ciclosImportando['2026.4'] = 1;
      document.body.insertAdjacentHTML('beforeend', '<p id="imp-confirma"></p>');
      const setT = window.setTimeout; window.setTimeout = (fn, ms) => setT(fn, Math.min(ms, 50));
      enviarBaseServidor('2026.4', [{},{},{}], 1);
      setT(() => res({ msg: document.getElementById('imp-confirma').innerText, vistos }), 1500);
    })""")
    print(r); assert 'confirmou 3' in r['msg'] and 'renovacao.importar_alunos:330000' in r['vistos']; print('ok  tempo esgotado na importação: confere no servidor e confirma')
    br.close()
