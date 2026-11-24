import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
import urllib.request
def api_tok(pg,o):
    o=dict(o); o['token']=pg.evaluate("JSON.parse(localStorage.getItem('jornada_sessao')).token")
    return json.loads(urllib.request.urlopen(urllib.request.Request(B+'exec', data=json.dumps(o).encode())).read())
def ok(m):
    global n; n+=1; print('ok ',m)
def entrar(ctx, email, senha, nova):
    pg=ctx.new_page()
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email',email); pg.fill('#login-senha',senha); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',senha); pg.fill('#troca-nova',nova); pg.fill('#troca-conf',nova); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'"); return pg
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx=br.new_context(viewport={'width':1366,'height':900}, locale='pt-BR')
    pg=entrar(ctx,'angelica@estacio.br',prov['atend'],'Atend2026b')
    m=pg.inner_text('#menu'); assert 'Central de Bases' in m and 'Configurações' not in m and 'Usuários' not in m, m; ok('atendente vê Central de Bases, mas não Configurações nem Usuários')
    pg.click('a[href="#/bases"]'); pg.wait_for_selector('#cards-bases .card-sistema', timeout=15000); pg.wait_for_timeout(800)
    t=pg.inner_text('#cards-bases'); assert 'Importar base da Renovação' in t and 'Importar no Formandos' in t; ok('cards da Central com os botões dos sistemas liberados para ela')
    assert 'Trazer tudo do EngajaVR' not in t; ok('migração do EngajaVR continua só do administrador')
    pg.screenshot(path='/home/claude/testes/tela_bases_atendente.png')
    pg.click('a[href="#/bases/renovacao"]'); pg.wait_for_timeout(4000)
    fr=[x for x in pg.frames if 'modulos/renovacao' in x.url][0]
    fr.wait_for_function("document.body.innerText.length>100", timeout=15000); pg.wait_for_timeout(2500)
    tx=fr.inner_text('body'); assert 'não tem acesso' not in tx, tx[:300]; ok('Renovação: tela de importação abre para atendente')
    pg.screenshot(path='/home/claude/testes/tela_bases_atendente_renov.png')
    pg.goto(B+'#/bases'); pg.wait_for_timeout(1500); pg.click('a[href="#/bases/formandos"]'); pg.wait_for_timeout(4000)
    ff=[x for x in pg.frames if 'modulos/formandos' in x.url][0]; ff.wait_for_selector('#jornada-painel-modo', timeout=15000)
    ff.click('#jornada-painel-modo button:has-text("Importar alunos")'); pg.wait_for_timeout(800)
    assert ff.locator('#csv-input').is_visible(); ok('Formandos: atendente abre a importação de alunos')
    ff.fill('#csv-input','MATRICULA;NOME;CURSO;CELULAR;EMAIL\n202399000777;Formando Atendente Teste;DIREITO;24999990000;f@t.com')
    ff.click('button:has-text("Analisar")'); pg.wait_for_timeout(1500)
    pg.screenshot(path='/home/claude/testes/tela_bases_atendente_form1.png')
    sel=ff.locator('select:visible').first; sel.select_option(label='NOME'); pg.wait_for_timeout(500)
    ff.click('button:visible:has-text("Importar 1")'); pg.wait_for_timeout(4000)
    pg.screenshot(path='/home/claude/testes/tela_bases_atendente_form.png')
    r=api_tok(pg,{'acao':'formandos.poll','since':0}); nomes=[json.dumps(x) for x in json.dumps(r).split('Formando Atendente Teste')]
    assert len(nomes)>1, str(r)[:300]; ok('Formandos: importação feita pela atendente gravou o aluno')
    ctx2=br.new_context(viewport={'width':1366,'height':900}, locale='pt-BR'); pg2=entrar(ctx2,'felipe@estacio.br',prov['eng'],'Eng2026b')
    pg2.goto(B+'#/bases/engajamento?base=impar'); pg2.wait_for_timeout(5000)
    fe=[x for x in pg2.frames if 'modulos/engajamento' in x.url][0]; pg2.wait_for_timeout(2000)
    assert 'não tem acesso' not in fe.inner_text('body'); ok('Engajamento: atendente abre a importação da base líquida')
    pg2.screenshot(path='/home/claude/testes/tela_bases_atendente_eng.png')
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
