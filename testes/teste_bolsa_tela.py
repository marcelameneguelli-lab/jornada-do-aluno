import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
XLSX=open('/home/claude/testes/node_modules/xlsx/dist/xlsx.full.min.js').read()
def ok(m):
    global n; n+=1; print('ok ',m)
def fr(pg):
    for i in range(30):
        l=[x for x in pg.frames if 'modulos/bolsa' in x.url]
        if l: return l[-1]
        pg.wait_for_timeout(300)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx=br.new_context(viewport={'width':1366,'height':900}); pg=ctx.new_page()
    ctx.route('**/cdnjs.cloudflare.com/**/xlsx.full.min.js', lambda rt: rt.fulfill(status=200, content_type='application/javascript', body=XLSX))
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: erros.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text and 'fonts' not in m.text and 'sandboxed' not in m.text else None)
    pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    assert 'Bolsa Permanência' in pg.inner_text('#menu'); ok('menu mostra Bolsa Permanência')
    pg.goto(B+'#/bases'); pg.wait_for_timeout(2500)
    assert 'Importar planilha da bolsa' in pg.inner_text('body'); ok('card da bolsa na Central de Bases')
    pg.click('text=Importar planilha da bolsa'); pg.wait_for_timeout(1500)
    f=fr(pg); f.wait_for_selector('#arq')
    f.set_input_files('#arq','/home/claude/testes/bolsa_ficticia.xlsx'); f.wait_for_selector('#previa .lembrete', timeout=20000)
    assert f.input_value('#periodo')=='26.3', f.input_value('#periodo'); txt=f.inner_text('#previa'); assert '3' in txt, txt; ok('aba e período detectados: '+txt.strip()[:90])
    f.click('#importar'); f.wait_for_function("document.querySelector('#importar').textContent.indexOf('✓')>=0", timeout=20000); ok('importou')
    pg.goto(B+'#/s/bolsa'); pg.wait_for_timeout(2500)
    f=fr(pg); f.wait_for_selector('.pool', timeout=15000)
    assert f.inner_text('#c-sol')=='3'; ok('3 solicitações no período 26.3')
    f.click('[data-aba="pool"]'); f.fill('[data-pool="PRESENCIAL"]','10000'); f.fill('[data-pool="EAD"]','5000'); f.click('#salvar-pool'); f.wait_for_timeout(1500)
    f.click('[data-aba="painel"]'); f.wait_for_timeout(300); t=f.inner_text('.pools')
    assert '8.200,00' in t and '4.100,00' in t, t; ok('saldo = pool − lançado − comprometido (8.200 presencial, 4.100 EAD)')
    pg.screenshot(path='/home/claude/testes/tela_bolsa_painel.png')
    f.click('[data-aba="solicitacoes"]'); f.wait_for_timeout(300)
    assert 'Não pagou a renovação' in f.inner_text('tbody'); ok('alertas aparecem na lista')
    f.click('tr[data-id] >> text=Aluno Ficticio Tres'); f.wait_for_selector('#f')
    f.select_option('[name=status]','lancada'); f.fill('[name=consumo]','700'); f.click('#btn-salvar'); f.wait_for_timeout(1500)
    assert 'Lançada' in f.inner_text('tbody'); ok('edição salva com status lançada')
    pg.screenshot(path='/home/claude/testes/tela_bolsa_lista.png')
    f.click('#btn-nova'); f.wait_for_selector('#f'); f.fill('[name=mat]','202501000004'); f.select_option('[name=tipo]',index=1); f.wait_for_timeout(200)
    assert len(f.input_value('[name=descricao]'))>20; ok('motivo preenche a justificativa padrão')
    pg.screenshot(path='/home/claude/testes/tela_bolsa_form.png')
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
