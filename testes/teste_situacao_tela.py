import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
def fr(pg, s):
    for i in range(30):
        l=[x for x in pg.frames if s in x.url]
        if l: return l[-1]
        pg.wait_for_timeout(300)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg=br.new_page(viewport={'width':1366,'height':900})
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    # motor (Provas): um transferido e um trancado somem da lista por padrão
    pg.goto(B+'#/s/provas'); pg.wait_for_timeout(2500); f=fr(pg,'sistema=provas'); f.wait_for_function("Motor.estado.alunos.length>0")
    total=f.evaluate("Motor.estado.alunos.length")
    f.evaluate("Motor.estado.alunos[0].NOM_SITUACAO_ALUNO='TRANSFERIDO'; Motor.estado.alunos[1].NOM_SITUACAO_ALUNO='TRANCADO'; Motor.desenhar()")
    vis=f.locator('tr[data-mat]').count(); assert vis==total-2, (vis,total); ok(f'só ativos por padrão ({vis} de {total})')
    assert 'fora da lista' in f.inner_text('.filtros'); ok('avisa quantos ficaram de fora')
    f.select_option('#f-sit-aluno','saiu'); f.wait_for_timeout(300)
    assert f.locator('tr[data-mat]').count()==2 and f.locator('.selo-sit').count()==2; ok('filtro "trancados, cancelados, transferidos" mostra os 2 com selo')
    f.select_option('#f-sit-aluno','todos'); f.wait_for_timeout(300); assert f.locator('tr[data-mat]').count()==total; ok('situação: todas')
    f.select_option('#f-sit-aluno','TRANSFERIDO'); f.wait_for_timeout(300); assert f.locator('tr[data-mat]').count()==1; ok('situação exata')
    pg.screenshot(path='/home/claude/testes/tela_situacao.png')
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
