import json, urllib.request
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
def api(o): return json.loads(urllib.request.urlopen(urllib.request.Request(B+'exec', data=json.dumps(o).encode())).read())
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1366,'height':860})
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.add_init_script("localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')")
    # Angélica: Renovação e Formandos, SEM Engajamento
    pg.goto(B); pg.fill('#login-email','angelica@estacio.br'); pg.fill('#login-senha',prov['atend']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['atend']); pg.fill('#troca-nova','Teste2026a'); pg.fill('#troca-conf','Teste2026a'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    assert pg.locator('.card-sistema.ferramenta').count()==3; ok('Início mostra as 3 ferramentas da equipe')
    assert pg.locator('#menu a[href="#/f/tarefas"]').count()==1; ok('menu tem Calendário, Tarefas e Tutoriais')
    for f,txt in [('tarefas','Tarefas'),('calendario','Calendário'),('tutoriais','Tutoriais')]:
        pg.goto(B+'#/f/'+f); pg.wait_for_timeout(2500)
        fr=[x for x in pg.frames if 'ferramenta='+f in x.url][0]
        assert fr.evaluate(f"document.getElementById('page-{f}').classList.contains('active')"), f
        assert not fr.is_visible('.tab-bar') and not fr.is_visible('#base-selector'); 
        toasts=fr.evaluate("document.body.innerText.includes('Seu perfil não pode')")
        assert not toasts, 'aviso de permissão apareceu'
        ok(f'{txt} abre para quem não tem Engajamento, sem abas nem bases')
        if f=='tarefas': pg.mouse.move(900,400); pg.screenshot(path='/home/claude/testes/tela_tarefas.png')
    fr=[x for x in pg.frames if 'ferramenta=tutoriais' in x.url][0]
    fr.evaluate("TUTORIAIS.push({id:'tu1',titulo:'Como registrar acionamento',categoria:'Geral',tipo:'texto',conteudo:'teste'}); gasCall('saveTutoriais',{tutoriais:TUTORIAIS})"); pg.wait_for_timeout(1500)
    tok=pg.evaluate("JSON.parse(localStorage.getItem('jornada_sessao')).token")
    assert 'Como registrar acionamento' in json.dumps(api({'acao':'ferramentas.getTutoriais','token':tok}), ensure_ascii=False); ok('tutorial salvo vai para o servidor')
    br.close()
# Engajamento sem as abas que saíram
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1366,'height':860})
    pg.add_init_script("localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')")
    pg.goto(B); pg.fill('#login-email','felipe@estacio.br'); pg.fill('#login-senha',prov['eng']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['eng']); pg.fill('#troca-nova','Teste2026e'); pg.fill('#troca-conf','Teste2026e'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'"); pg.goto(B+'#/s/engajamento'); pg.wait_for_timeout(3000)
    fr=[x for x in pg.frames if 'modulos/engajamento' in x.url][0]
    abas=[t.strip() for t in fr.locator('.tab-bar .tab').all_text_contents() if fr.locator('.tab-bar .tab').count()]
    visiveis=fr.evaluate("[...document.querySelectorAll('.tab-bar .tab')].filter(b=>b.offsetParent!==null).map(b=>b.textContent.trim())")
    assert not any(x in ' '.join(abas) for x in ['Calendário','Tarefas','Tutoriais','Financeiro','Estágio','Provas']), abas
    ok('abas do Engajamento: '+', '.join(visiveis))
    pg.mouse.move(900,400); pg.screenshot(path='/home/claude/testes/tela_engajamento.png')
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
