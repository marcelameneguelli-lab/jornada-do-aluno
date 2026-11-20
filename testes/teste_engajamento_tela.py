import json, urllib.request
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
def api(o): return json.loads(urllib.request.urlopen(urllib.request.Request(B+'exec', data=json.dumps(o).encode())).read())
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1366,'height':860})
    pg.on('console', lambda m: erros.append(m.text) if m.type=='error' and 'cdnjs' not in str(m.location) and 'ERR_FAILED' not in m.text else None)
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.on('request', lambda r: erros.append('SERVIDOR ANTIGO '+r.url) if 'script.google.com' in r.url else None)
    pg.add_init_script("localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')")
    pg.goto(B); pg.fill('#login-email','felipe@estacio.br'); pg.fill('#login-senha',prov['eng']); pg.click('#btn-entrar')
    pg.wait_for_timeout(3000); print('DBG', pg.text_content('#login-erro'), pg.evaluate('document.body.dataset.tela'), pg.is_visible('#form-troca'))
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['eng']); pg.fill('#troca-nova','Teste2026e'); pg.fill('#troca-conf','Teste2026e'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    pg.hover('#lateral'); pg.wait_for_timeout(250); pg.click('#menu a[href="#/s/engajamento"]'); pg.mouse.move(1000,450)
    pg.wait_for_selector('iframe.moldura-sistema'); ok('Engajamento abre na moldura')
    pg.wait_for_timeout(1500); fr=[f for f in pg.frames if 'modulos/engajamento' in f.url][0]
    assert fr.evaluate("document.getElementById('app-lock-overlay').classList.contains('hidden')"); ok('sem tela de login própria do EngajaVR')
    assert fr.evaluate("_usuarioLogado && _usuarioLogado.nome")=='Felipe Teste' and fr.evaluate("_usuarioLogado.perfil")=='atendente'; ok('EngajaVR reconhece o atendente e o perfil')
    fr.wait_for_function("typeof DB!=='undefined' && DB.length>=6", timeout=20000); ok('base Ímpar carrega do servidor único ('+str(fr.evaluate('DB.length'))+' alunos)')
    assert fr.evaluate("_podeImportar()")==False and fr.evaluate("_podeAdmin()")==False; ok('atendente sem Importar e sem Admin (regra original)')
    pg.wait_for_timeout(800); pg.screenshot(path='/home/claude/testes/tela_engajamento.png')
    # registrar acionamento pelo caminho do app
    fr.evaluate("gasCall('saveAction',{base:'impar',id:'ac_tela_1',matricula:'202301000101',atend:_usuarioLogado.nome,canal:'WhatsApp',obs:'Contato pela Jornada'})"); pg.wait_for_timeout(1500)
    tok=pg.evaluate("JSON.parse(localStorage.getItem('jornada_sessao')).token")
    h=api({'acao':'engajamento.getHistory','token':tok,'base':'impar'}); assert 'ac_tela_1' in json.dumps(h), json.dumps(h)[:300]; ok('acionamento chega ao servidor')
    # Provas grava no servidor
    fr.evaluate("POLO_DATA['202301000102']={status:'agendado',_ts:Date.now()}; _savePoloData()"); pg.wait_for_timeout(1500)
    r=api({'acao':'engajamento.loadPoloData','token':tok,'base':'impar'}); assert '202301000102' in r['data']; ok('Provas agora grava no servidor')
    paginas=[]
    for pid in ['dashboard','painel','followup','tarefas','calendario','tutoriais','evasao','financeiro','estagio','polo','produtividade']:
        try:
            fr.evaluate(f"showPage('{pid}')"); pg.wait_for_timeout(300)
            if fr.evaluate(f"(document.getElementById('page-{pid}')||{{}}).style ? getComputedStyle(document.getElementById('page-{pid}')).display!=='none' : false"): paginas.append(pid)
        except Exception as e: erros.append(f'{pid}: {e}')
    ok('páginas abertas: '+', '.join(paginas))
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
