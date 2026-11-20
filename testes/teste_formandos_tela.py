import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1366,'height':860})
    pg.on('console', lambda m: erros.append(m.text+' @ '+str(m.location)) if m.type=='error' else None)
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)+' | '+str(e.stack)[:300]))
    pg.on('response', lambda r: erros.append('404 '+r.url) if r.status==404 else None)
    pg.on('response', lambda r: erros.append('HTML-PARA-SCRIPT '+r.url) if r.request.resource_type=='script' and 'html' in (r.headers.get('content-type') or '') else None)
    pg.on('response', lambda r: erros.append('HTTP%d %s' % (r.status, r.url)) if r.status>=400 else None)
    pg.add_init_script("localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')")
    pg.goto(B); pg.fill('#login-email','angelica@estacio.br'); pg.fill('#login-senha',prov['atend']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['atend']); pg.fill('#troca-nova','Teste2026a'); pg.fill('#troca-conf','Teste2026a'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    pg.hover('#lateral'); pg.wait_for_timeout(250); pg.click('#menu a[href="#/s/formandos"]'); pg.mouse.move(1000,450); pg.wait_for_selector('iframe.moldura-sistema'); ok('Formandos abre na moldura')
    fr=pg.frame_locator('iframe.moldura-sistema')
    fr.locator('text=Ana Exemplo').first.wait_for(timeout=15000); ok('alunos carregam do servidor único')
    assert fr.locator('#gas-modal').is_hidden(); ok('sem tela de login própria do painel')
    fr.locator('#user-pill-name').wait_for(); 
    pg.wait_for_function("document.querySelector('iframe.moldura-sistema').contentDocument.getElementById('user-pill-name').textContent.includes('Ang')", timeout=10000); ok('painel mostra a atendente logada')
    assert pg.evaluate("document.querySelector('iframe.moldura-sistema').contentDocument.body.classList.contains('perfil-atendente')"); ok('perfil atendente aplicado no painel')
    pg.wait_for_timeout(800); pg.screenshot(path='/home/claude/testes/tela_formandos.png')
    # registrar contato/observação: abre o aluno
    fr.locator('text=Ana Exemplo').first.click(); pg.wait_for_timeout(800)
    pg.screenshot(path='/home/claude/testes/tela_formandos_aluno.png')
    assert pg.evaluate("!document.querySelector('iframe.moldura-sistema').contentDocument.getElementById('drawer').hidden"); ok('ficha do aluno abre')
    pg.evaluate("document.querySelector('iframe.moldura-sistema').contentWindow.closeDrawer()"); pg.wait_for_timeout(300)
    for aba in ['formados','regua','atividade','evolucao','guia']:
        fr.locator(f"[onclick*=\"switchTab('{aba}'\"]").first.click(); pg.wait_for_timeout(250)
    ok('todas as abas abrem')
    # gravação pela tela: atualiza a observação de um aluno pelo mesmo caminho que o painel usa
    quadro=[f for f in pg.frames if 'modulos/formandos' in f.url][0]
    quadro.evaluate("dbCap.doc('students/202301000001').update({obs:'Gravado pela tela', upd:Date.now()})")
    pg.wait_for_timeout(3000)
    import urllib.request, json as J
    tok=pg.evaluate("JSON.parse(localStorage.getItem('jornada_sessao')).token")
    r=J.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8765/exec', data=J.dumps({'acao':'formandos.get','token':tok,'col':'students','id':'202301000001'}).encode())).read())
    assert r['data'].get('obs')=='Gravado pela tela', r; ok('alteração feita na tela chega à planilha')
    pg.hover('#lateral'); pg.wait_for_timeout(250); pg.click('#menu a[href="#/inicio"]'); pg.mouse.move(1000,450); pg.wait_for_selector('.card-sistema'); ok('volta ao início pela tela base')
    br.close()
print(n,'passos ok'); print('erros:', erros)
