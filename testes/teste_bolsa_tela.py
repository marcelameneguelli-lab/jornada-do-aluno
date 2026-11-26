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
    ctx=br.new_context(viewport={'width':1366,'height':900}, accept_downloads=True); pg=ctx.new_page()
    ctx.route('**/cdnjs.cloudflare.com/**/xlsx.full.min.js', lambda rt: rt.fulfill(status=200, content_type='application/javascript', body=XLSX))
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: erros.append(m.text) if m.type=='error' and 'ERR_FAILED' not in m.text and 'fonts' not in m.text and 'sandboxed' not in m.text else None)
    pg.on('dialog', lambda d: (erros.append('DIALOG '+d.message), d.dismiss()))
    pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    pg.goto(B+'#/bases'); pg.wait_for_timeout(2500)
    assert 'Central de Bases' in pg.inner_text('body') and 'planilha da bolsa' not in pg.inner_text('body').lower(); ok('Central de Bases não tem mais importação da bolsa')
    pg.goto(B+'#/s/bolsa'); pg.wait_for_timeout(2500)
    f=fr(pg); f.wait_for_selector('#btn-per')
    f.wait_for_selector('#in-periodo2', timeout=15000); f.fill('#in-periodo2','26.3'); f.click('#ok-periodo2'); f.wait_for_selector('#nova-linha', timeout=15000); assert f.input_value('#sel-periodo')=='26.3'; ok('período 26.3 criado pelo campo na tela (sem janela do navegador)')
    f.click('#btn-per'); f.fill('#in-periodo','27.1'); f.press('#in-periodo','Enter'); f.wait_for_timeout(800); assert f.input_value('#sel-periodo')=='27.1'; f.select_option('#sel-periodo','26.3'); f.wait_for_timeout(1000); ok('botão + Novo período no alto também cria (27.1) e dá para voltar ao 26.3')
    f.click('#nova-linha'); tr='tr.rascunho'
    f.fill(f'{tr} [data-k=mat]','202301000101'); f.press(f'{tr} [data-k=mat]','Tab'); f.wait_for_timeout(1500)
    assert f.input_value(f'{tr} [data-k=nome]')=='Engaja Exemplo 2'; ok('matrícula completa nome, curso e contato pela base líquida')
    assert 'Falta' in f.inner_text(f'{tr} .salvo'); ok('linha incompleta fica como rascunho: '+f.inner_text(f'{tr} .salvo'))
    f.select_option(f'{tr} [data-k=modalidade]','PRESENCIAL'); f.fill(f'{tr} [data-k=pct]','40'); f.press(f'{tr} [data-k=pct]','Tab')
    f.select_option(f'{tr} [data-k=tipo]',index=1); f.wait_for_timeout(2000)
    assert len(f.input_value('tbody tr [data-k=descricao]'))>20; ok('tipo preenche a justificativa padrão')
    assert f.inner_text('#c-sol')=='1' and f.locator('tr.rascunho').count()==0, f.inner_text('tbody tr .salvo'); ok('linha salva sozinha ao completar os obrigatórios')
    row='tbody tr[data-id]'
    f.select_option(f'{row} [data-k=status]','lancada'); f.wait_for_timeout(300); f.fill(f'{row} [data-k=consumo]','1.500,00'); f.press(f'{row} [data-k=consumo]','Tab'); f.wait_for_timeout(2000)
    assert f.input_value(f'{row} [data-k=dataLanc]'); ok('lançada: data do lançamento preenchida pelo sistema')
    f.click('#nova-linha'); f.fill('tr.rascunho [data-k=mat]','202301000104'); f.press('tr.rascunho [data-k=mat]','Tab'); f.wait_for_timeout(1500)
    f.select_option('tr.rascunho [data-k=tipo]',index=2); f.fill('tr.rascunho [data-k=pct]','30'); f.press('tr.rascunho [data-k=pct]','Tab'); f.wait_for_timeout(1500)
    if f.locator('tr.rascunho').count(): f.select_option('tr.rascunho [data-k=modalidade]','EAD'); f.wait_for_timeout(1500)
    assert f.inner_text('#c-sol')=='2'; ok('segunda linha salva')
    pg.screenshot(path='/home/claude/testes/tela_bolsa_planilha.png')
    # recarrega: dados persistem
    pg.reload(); pg.wait_for_timeout(3000); f=fr(pg); f.wait_for_selector('tbody tr[data-id]', timeout=15000)
    assert f.locator('tbody tr[data-id]').count()==2 and f.input_value('tbody tr[data-id] [data-k=consumo]') in ('1500','1500,00','1.500'), f.input_value('tbody tr[data-id] [data-k=consumo]'); ok('ao reabrir, a planilha está igual')
    f.click('[data-aba="pool"]'); f.fill('[data-pool="PRESENCIAL"]','10000'); f.click('#salvar-pool'); f.wait_for_timeout(1500)
    f.click('[data-aba="painel"]'); f.wait_for_timeout(300); assert '8.500,00' in f.inner_text('.pools'); ok('saldo do pool calculado (8.500)')
    f.click('[data-aba="solicitacoes"]'); f.wait_for_timeout(300)
    with pg.expect_download() as d: f.click('#exportar')
    arq='/tmp/bolsa_export.xlsx'; d.value.save_as(arq); ok('extraiu '+d.value.suggested_filename)
    br.close()
import openpyxl
wb=openpyxl.load_workbook('/tmp/bolsa_export.xlsx'); print(wb.sheetnames); ws=wb[wb.sheetnames[0]]
cab=[c.value for c in ws[1]]; assert cab[2]=='MATRICULA' and ws.max_row==3, (cab, ws.max_row)
assert 'Controle pool' in wb.sheetnames; ok('Excel com a aba de solicitações (mesmas colunas) e o controle do pool')
print(n,'passos ok'); print('erros:', erros or 'nenhum')
