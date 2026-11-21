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
    pg.goto(B+'#/bases/engajamento?base=par'); pg.wait_for_timeout(5000)
    fr=[x for x in pg.frames if 'modulos/engajamento' in x.url][0]
    fr.wait_for_function("document.getElementById('page-importar').classList.contains('active') && ACTIVE_BASE==='par'", timeout=20000)
    fr.set_input_files('#csv-input','/home/claude/testes/base_par_ficticia.csv')
    pg.wait_for_selector('#barra-envio:not([hidden])', timeout=20000); t=pg.inner_text('#barra-envio'); print('   ',t[:120])
    assert 'parte' in t and 'Par' in t; ok('mostra o andamento do envio da base no shell')
    # sai da tela no meio do envio: o envio continua
    pg.goto(B+'#/inicio')
    pg.wait_for_selector('#barra-envio.ok', timeout=60000); t=pg.inner_text('#barra-envio'); print('   ',t[:140])
    assert '1.050' in t; ok('o envio termina mesmo saindo da tela de importação (1.050 alunos)')
    pg.goto(B+'#/s/provas'); pg.wait_for_timeout(2500)
    f=[x for x in pg.frames if 'sistema=provas' in x.url][0]
    f.click('[data-base=par]') if f.locator('[data-base=par]').count() else None
    f.wait_for_function("Motor.estado.base==='par' && Motor.estado.todos===1050", timeout=20000); ok('Provas pega a base nova (Par, 1.050 alunos)')
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
