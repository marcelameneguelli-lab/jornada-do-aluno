import json, urllib.request
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
def api(o): return json.loads(urllib.request.urlopen(urllib.request.Request(B+'exec', data=json.dumps(o).encode())).read())
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1366,'height':900})
    pg.on('console', lambda m: erros.append(m.text) if m.type=='error' and 'cdnjs' not in str(m.location) and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.add_init_script("localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    tok=lambda: pg.evaluate("JSON.parse(localStorage.getItem('jornada_sessao')).token")
    fr=lambda s: [x for x in pg.frames if 'sistema='+s in x.url and 'acompanhamento' in x.url][0]
    esperado={'provas':3,'estagio':2,'financiamentos':4}
    for s,qt in esperado.items():
        pg.goto(B+'#/s/'+s); pg.wait_for_timeout(2500)
        f=fr(s); f.wait_for_function("window.Motor && Motor.estado.alunos.length>0", timeout=15000)
        assert f.evaluate("Motor.estado.alunos.length")==qt, (s, f.evaluate("Motor.estado.alunos.length"))
        ok(f'{s}: {qt} alunos elegíveis da base Ímpar do Engajamento')
    # Financiamentos: alerta de 75%, ficha, acionamento com follow-up
    pg.goto(B+'#/s/financiamentos'); pg.wait_for_timeout(2500); f=fr('financiamentos'); f.wait_for_function("Motor.estado.alunos.length>0")
    assert f.locator('td.alerta').count()==1; ok('alerta de aprovação abaixo de 75% só para o ProUni com 66,67%')
    pg.mouse.move(900,400); pg.screenshot(path='/home/claude/testes/tela_financiamentos.png')
    f.locator('tr[data-mat="202301000101"]').click(); f.wait_for_selector('#form-ac')
    campos=f.evaluate("[...document.querySelectorAll('#ficha-campos [data-campo]')].map(s=>s.dataset.campo)")
    assert campos==['bolsa','termo_atualizacao','termo_reconsideracao','termo_encerramento'], campos; ok('ProUni: tipo de bolsa e os 3 termos na ficha')
    f.select_option('[data-campo=bolsa]','Parcial'); f.select_option('[data-campo=termo_atualizacao]','Pendente'); f.click('#btn-ficha'); pg.wait_for_timeout(1500)
    f.select_option('#form-ac [name=canal]','Ligação'); f.select_option('#form-ac [name=resultado]','Pendência de documento')
    f.fill('#form-ac [name=obs]','Falta assinar o termo de atualização'); f.fill('#form-ac [name=fu]','2026-11-23')
    pg.screenshot(path='/home/claude/testes/tela_financiamentos_aluno.png')
    f.click('#btn-ac'); pg.wait_for_timeout(1500)
    l=api({'acao':'financiamentos.listar','token':tok()}); r=l['regs'][0]
    assert r['atendente']=='Marcela Meneguelli' and r['fu_status']=='pendente' and l['fichas']['202301000101']['dados']['termo_atualizacao']=='Pendente', json.dumps(l)[:300]
    ok('ficha e acionamento com follow-up gravados no servidor')
    f.evaluate("Motor.estado.filtro.extra='pendente'"); f.click('[data-aba=alunos]'); pg.wait_for_timeout(300)
    assert f.locator('tr[data-mat]').count()==1; ok('filtro "com termo pendente" funciona')
    f.click('[data-aba=followup]'); pg.wait_for_timeout(300); assert f.locator('[data-feito]').count()==1; ok('follow-up aparece na aba')
    f.click('[data-feito]'); pg.wait_for_timeout(1500); assert api({'acao':'financiamentos.listar','token':tok()})['regs'][0]['fu_status']=='feito'; ok('concluir follow-up grava no servidor')
    f.click('[data-aba=dashboard]'); pg.wait_for_timeout(300); assert '25% de cobertura' in f.inner_text('#area').replace('\xa0',' '), f.inner_text('#area')[:300]; ok('dashboard: 1 de 4 acionados = 25% de cobertura')
    pg.mouse.move(900,400); pg.screenshot(path='/home/claude/testes/tela_financiamentos_dash.png')
    f.click('[data-aba=produtividade]'); pg.wait_for_timeout(300); assert 'Marcela Meneguelli' in f.inner_text('#area'); ok('produtividade mostra a atendente')
    # troca de base (Provas)
    pg.goto(B+'#/s/provas'); pg.wait_for_timeout(2500); f=fr('provas'); f.wait_for_function("Motor.estado.alunos.length>0")
    # troca de base
    f.click('#bases [data-base=par]'); pg.wait_for_timeout(2500); f.click('[data-aba=alunos]'); pg.wait_for_timeout(300); assert f.evaluate("Motor.estado.alunos.length")==0 and 'ainda não foi importada' in f.inner_text('#area'); ok('base Par vazia avisa que não foi importada')
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
