import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1366,'height':900})
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: erros.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text else None)
    pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    assert 'Alunos em risco' in pg.inner_text('#menu'); ok('menu tem Alunos em risco')
    pg.goto(B+'#/s/risco'); pg.wait_for_timeout(2500)
    f=[x for x in pg.frames if 'modulos/risco' in x.url][0]; f.wait_for_selector('.cards', timeout=20000)
    nlin=f.locator('tr[data-mat]').count(); assert nlin>0, f.inner_text('#area')[:300]; ok(f'painel lista {nlin} aluno(s) com sinais')
    pg.screenshot(path='/home/claude/testes/tela_risco.png', full_page=True)
    prim=f.locator('tr[data-mat]').first; prim.click(); f.wait_for_selector('#modal:not([hidden]) .grupo'); ok('ficha mostra os sinais agrupados por área')
    pg.screenshot(path='/home/claude/testes/tela_risco_ficha.png')
    f.click('[data-fechar]'); btn=f.locator('[data-sinal]').first; btn.click(); f.wait_for_timeout(300); assert f.locator('.sinais-filtro button.sel').count()==1; ok('filtro por sinal')
    f.click('#periodos button[data-p="par"]'); f.wait_for_timeout(2500); assert 'Par ·' in f.inner_text('#sub'); ok('troca para o período Par')
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
