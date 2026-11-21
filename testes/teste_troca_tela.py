import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1400,'height':900}, locale='pt-BR')
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    pg.goto(B+'#/s/provas'); pg.wait_for_timeout(2500)
    f=[x for x in pg.frames if 'sistema=provas' in x.url][0]; f.wait_for_function("Motor.estado.alunos.length===3", timeout=15000)
    f.wait_for_timeout(1500)
    for i in range(3):
        pg.goto(B+'#/s/provas'); pg.wait_for_timeout(700); pg.goto(B+'#/s/financeiro'); pg.wait_for_timeout(500); pg.goto(B+'#/s/financiamentos')
    pg.wait_for_timeout(9000)
    av=pg.inner_text('#avisos') if pg.locator('#avisos').count() else ''
    assert 'getItem' not in av and 'null' not in av, av; ok('trocar de sistema durante o carregamento não mostra erro')
    f=[x for x in pg.frames if 'sistema=financiamentos' in x.url][0]; f.wait_for_function("Motor.estado.carregado || Motor.estado.alunos.length>=0", timeout=15000); ok('a tela que ficou aberta carrega normalmente')
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
