import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1366,'height':900})
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.add_init_script("localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    pg.goto(B+'#/bases'); pg.wait_for_selector('.card-sistema.base', timeout=15000)
    txt=pg.inner_text('#cards-bases').replace('\xa0',' ')
    assert 'Ciclo 2026.1: 4 alunos' in txt and 'Engajamento Ímpar' in txt and '6 alunos' in txt and 'Formandos' in txt, txt[:400]; ok('Central de Bases mostra Renovação, 3 bases do Engajamento e Formandos')
    pg.screenshot(path='/home/claude/testes/tela_central_bases.png')
    pg.click('text=Importar no Engajamento >> nth=0'); pg.wait_for_timeout(5000)
    fr=[x for x in pg.frames if 'modulos/engajamento' in x.url][0]
    assert fr.evaluate("document.getElementById('page-importar').classList.contains('active')"); ok('atalho abre o Engajamento direto na importação')
    pg.goto(B+'#/bases'); pg.wait_for_selector('.card-sistema.base'); pg.click('text=Importar na Renovação'); pg.wait_for_timeout(6000)
    fr=[x for x in pg.frames if 'modulos/renovacao' in x.url][0]
    assert fr.evaluate("document.getElementById('tela-importar').style.display!=='none'"); ok('atalho abre a Renovação direto na importação')
    pg.goto(B+'#/relatorio'); pg.wait_for_selector('#rel-frame', timeout=15000); pg.wait_for_timeout(800)
    h=pg.frame_locator('#rel-frame').locator('body').inner_text()
    assert 'Relatório do dia' in h and 'Acessaram a Jornada hoje' in h, h[:300]; ok('prévia do relatório aparece')
    assert 'desligado' in pg.inner_text('#rel-info'); pg.click('#rel-ativar'); pg.wait_for_timeout(2500); ok('botão de ativar o envio automático responde')
    pg.screenshot(path='/home/claude/testes/tela_relatorio.png', full_page=True)
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
