import json,re
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'
XLSX=open('/home/claude/testes/node_modules/xlsx/dist/xlsx.full.min.js').read()
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); ctx=br.new_context(viewport={'width':1366,'height':900}, locale='pt-BR')
    ctx.route('**/cdnjs.cloudflare.com/**/xlsx.full.min.js', lambda rt: rt.fulfill(status=200, content_type='application/javascript', body=XLSX))
    pg=ctx.new_page(); pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'"); pg.goto(B+'#/bases/nps'); pg.wait_for_timeout(2500)
    fi=[x for x in pg.frames if 'modo=importar' in x.url][0]; fi.wait_for_selector('#f-importar'); fi.set_input_files('#f-arquivo','/home/claude/testes/medallia_ficticio.xlsx'); fi.wait_for_function("Motor.estado.alunos.length===8")
    pg.goto(B+'#/s/nps'); pg.wait_for_timeout(2500); f=[x for x in pg.frames if 'sistema=nps' in x.url and 'modo=' not in x.url][0]; f.wait_for_function("Motor.estado.alunos.length===8")
    col=f.evaluate("[...document.querySelectorAll('tbody tr td:nth-child(4)')].map(t=>t.innerText)")
    print('coluna Resposta:', col[:4]); assert all(re.fullmatch(r'\d{2}/\d{2}/\d{2}',c) for c in col)
    f.locator('tr[data-mat]').first.click(); f.wait_for_selector('#form-ac'); f.fill('#form-ac [name=obs]','teste'); f.fill('#form-ac [name=fu]','2026-11-25'); f.click('#btn-ac'); pg.wait_for_timeout(1500)
    f.locator('tr[data-mat]').first.click(); f.wait_for_selector('#form-ac'); t=f.inner_text('.hist >> nth=1'); print('histórico:', t.replace('\n',' | ')[:160]); assert re.search(r'Follow-up 25/11/26',t) and re.search(r'\d{2}/\d{2}/\d{2},? \d{2}:\d{2}',t)
    f.click('[data-fechar]'); f.click('[data-aba=followup]'); pg.wait_for_timeout(300); print('follow-up:', f.inner_text('.fu small')[:60]); assert '25/11/26' in f.inner_text('.fu small') and '202601' in f.inner_text('.fu small')
    pg.mouse.move(900,400); f.click('[data-aba=alunos]'); pg.wait_for_timeout(300); pg.screenshot(path='/home/claude/testes/tela_nps.png'); br.close()
print('ok datas dd/mm/aa')
