import json, urllib.request
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]
def api(o):
    r=urllib.request.Request(B+'exec',data=json.dumps(o).encode(),headers={'Content-Type':'text/plain'}); return json.loads(urllib.request.urlopen(r).read())
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg=br.new_page(viewport={'width':1500,'height':900})
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    tok=pg.evaluate("Api.Sessao.ler().token")
    dados=api({'acao':'engajamento.carregarBase','token':tok,'base':'par'}).get('data') or []
    dados=[x for x in dados if x.get('COD_MATRICULA')!='202301000001']+[{'COD_MATRICULA':'202301000001','NOM_ALUNO':'Ana Exemplo','NUM_TELEF_CELULAR':'24999990001','END_EMAIL':'ana.exemplo@teste.br','NOM_SITUACAO_ALUNO':'MATRICULADO'}]
    assert api({'acao':'engajamento.salvarBase','token':tok,'base':'par','dados':dados,'parte':0,'total':1})['ok']
    pg.goto(B+'#/s/formandos'); pg.wait_for_timeout(6000)
    f=[x for x in pg.frames if 'modulos/formandos' in x.url][-1]
    f.wait_for_selector('.ct-base', timeout=20000); txt=f.inner_text('.ct-base')
    assert '(24) 99999-0001' in txt and 'ana.exemplo@teste.br' in txt, txt; print('ok  tabela mostra celular e e-mail da base líquida:', txt.replace('\n',' | '))
    assert 'wa.me/5524999990001' in f.inner_html('.ct-base'); print('ok  celular abre o WhatsApp')
    f.click('button.name-btn >> text=Ana Exemplo'); f.wait_for_selector('#dr-contato a'); print('ok  ficha mostra o contato:', f.inner_text('#dr-contato').replace('\n',' | '))
    pg.screenshot(path='/home/claude/testes/tela_formandos_contato.png')
    br.close()
print('erros:', [e for e in erros if 'cdnjs' not in e] or 'nenhum')
