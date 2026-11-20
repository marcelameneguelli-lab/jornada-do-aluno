import json, urllib.request
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
def api(o):
    return json.loads(urllib.request.urlopen(urllib.request.Request(B+'exec', data=json.dumps(o).encode())).read())
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1366,'height':860})
    pg.on('console', lambda m: erros.append(m.text) if m.type=='error' and 'cdnjs' not in str(m.location) and 'ERR_' not in m.text else None)
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.on('request', lambda r: erros.append('SERVIDOR ANTIGO '+r.url) if 'script.google.com' in r.url else None)
    pg.add_init_script("localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')")
    pg.goto(B); pg.fill('#login-email','angelica@estacio.br'); pg.fill('#login-senha',prov['atend']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['atend']); pg.fill('#troca-nova','Teste2026a'); pg.fill('#troca-conf','Teste2026a'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    pg.hover('#lateral'); pg.wait_for_timeout(250); pg.click('#menu a[href="#/s/renovacao"]'); pg.mouse.move(1000,450); pg.wait_for_selector('iframe.moldura-sistema'); ok('Renovação abre na moldura')
    pg.wait_for_function("(()=>{const f=[...document.querySelectorAll('iframe')].map(i=>i.contentWindow).find(w=>w&&w.location.href.includes('renovacao'));return f&&f.document.readyState==='complete'})()", timeout=15000)
    fr=[f for f in pg.frames if 'modulos/renovacao' in f.url][0]
    assert not fr.evaluate("document.getElementById('login-wrap').classList.contains('on')"); ok('sem tela de login própria do RenovaVR')
    assert fr.evaluate("S.colab")=='Angélica Souza' and fr.evaluate("S.perfil")=='atendente', fr.evaluate("[S.colab,S.perfil]"); ok('RenovaVR reconhece a atendente e o perfil')
    fr.wait_for_function("typeof ALUNOS!=='undefined' && ALUNOS.length>=4", timeout=20000); ok('base do ciclo carrega do servidor único')
    fr.evaluate("ir('alunos')"); pg.wait_for_timeout(600); assert fr.locator('text=Renova Exemplo 1').count()>0; ok('lista de alunos mostra a base')
    pg.screenshot(path='/home/claude/testes/tela_renovacao_alunos.png')
    fr.evaluate("abrirAluno('R1')"); pg.wait_for_timeout(400)
    fr.evaluate("document.getElementById('obs-ac').value='Contato feito pela Jornada'"); fr.evaluate("salvarAcionamento()"); pg.wait_for_timeout(2500)
    tok=pg.evaluate("JSON.parse(localStorage.getItem('jornada_sessao')).token")
    r=api({'acao':'renovacao.listar_acionamentos','token':tok})
    linhas=json.dumps(r, ensure_ascii=False)
    assert 'Contato feito pela Jornada' in linhas and 'Angélica Souza' in linhas, linhas[:400]; ok('acionamento registrado na tela chega à planilha no nome da atendente')
    vistas=[]
    for t in ['dash','alunos','envios','followup','renovados','relatorios','evasao','boasvindas','produtividade']:
        fr.evaluate(f"try{{ir('{t}')}}catch(e){{console.error(e)}}"); pg.wait_for_timeout(250)
        if fr.evaluate(f"document.getElementById('tela-{t}').style.display!=='none'"): vistas.append(t)
    ok('telas que a atendente pode abrir: '+', '.join(vistas))
    assert fr.evaluate("podeVer('config')")==False; ok('Configurações bloqueada para atendente (regra original)')
    fr.evaluate("ir('dash')"); pg.mouse.move(900,400); pg.wait_for_timeout(600); pg.screenshot(path='/home/claude/testes/tela_renovacao.png')
    pg.hover('#lateral'); pg.wait_for_timeout(250); pg.click('#menu a[href="#/s/formandos"]'); pg.mouse.move(1000,450); pg.wait_for_timeout(1500); pg.hover('#lateral'); pg.wait_for_timeout(250); pg.click('#menu a[href="#/s/renovacao"]'); pg.mouse.move(1000,450); pg.wait_for_timeout(1500)
    assert pg.evaluate("JSON.parse(localStorage.getItem('jornada_sessao')).me.sistemas.length")==2; ok('trocar entre Formandos e Renovação mantém a sessão')
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
