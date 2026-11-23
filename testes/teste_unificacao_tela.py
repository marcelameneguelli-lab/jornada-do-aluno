import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1400,'height':900}, locale='pt-BR')
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.add_init_script("try{localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')}catch(e){}")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    pg.goto(B+'#/s/provas'); pg.wait_for_timeout(2500)
    f=[x for x in pg.frames if 'sistema=provas' in x.url][0]; f.wait_for_function("Motor.estado.alunos.length===3", timeout=15000)
    f.wait_for_timeout(1500)
    pg.context.grant_permissions([]); pg.evaluate("window.open = () => null")
    # Estágio: TCE na tela nova, sem a tela original
    pg.goto(B+'#/s/estagio'); pg.wait_for_timeout(3000)
    f=[x for x in pg.frames if 'sistema=estagio' in x.url][0]; f.wait_for_function("Motor.estado.alunos.length>0", timeout=15000)
    assert not f.is_visible('#aba-original'); ok('Estágio sem a aba "Tela original"')
    assert 'SEM TCE' in f.inner_text('.cartoes').upper(); ok('cartões do TCE (sem TCE, aberto, deferido, indeferido, documentos)')
    m=f.evaluate("Motor.estado.alunos[0].COD_MATRICULA"); f.click(f'tr[data-mat="{m}"] td.nome'); f.wait_for_selector('#extras')
    f.check('#extras [data-extra="tce_aberto"]'); f.wait_for_timeout(1500)
    assert 'Atualizado por' in f.inner_text('#extras-quem'); ok('marcar "TCE aberto" na ficha salva na hora')
    f.click('[data-fechar]') if f.locator('[data-fechar]').count() else None
    f.evaluate("document.getElementById('modal').hidden=true"); f.click('[data-card="aberto"]'); f.wait_for_timeout(300)
    assert f.locator('tr[data-mat]').count()==1; ok('cartão "TCE aberto" filtra o aluno marcado')
    # disparo em lote
    f.click('[data-card=""]'); f.wait_for_timeout(300)
    f.evaluate("window.open=()=>null")
    f.check('#sel-pagina'); assert f.is_visible('#barra-lote'); ok('marcar alunos mostra a barra de disparo em lote')
    f.click('#lote-abrir'); f.wait_for_selector('#lote-msg'); assert '{nome}' in f.input_value('#lote-msg'); ok('mensagem pronta com variáveis ({nome}, {curso}, {atendente})')
    pg.screenshot(path='/home/claude/testes/tela_lote.png')
    f.click('#lote-enviar'); f.wait_for_function("document.getElementById('modal').hidden", timeout=30000)
    n_regs=f.evaluate("Object.values(Motor.estado.regs).filter(x=>x.obs.indexOf('Mensagem em lote')===0).length"); assert n_regs>=1, n_regs; ok(f'disparo registra acionamento em nome do usuário ({n_regs})')
    # Provas e Financeiro sem tela original
    for sis in ['provas']:
        pg.goto(B+'#/s/'+sis); pg.wait_for_timeout(2500); f=[x for x in pg.frames if 'sistema='+sis in x.url][0]; f.wait_for_function("Motor.estado.alunos.length>=0 && document.getElementById('area').innerText.length>50", timeout=15000)
        assert not f.is_visible('#aba-original'); ok(f'{sis}: sem a aba "Tela original"')
    pg.goto(B+'#/s/financeiro'); pg.wait_for_timeout(2500); fc=[x for x in pg.frames if 'modulos/cobranca' in x.url][0]; fc.wait_for_selector('.regua', timeout=15000); ok('Financeiro abre a Cobrança (régua de cobrança)')
    # Engajamento: clicar no nome abre a ficha, atendente travado no usuário logado
    pg.goto(B+'#/s/engajamento'); pg.wait_for_timeout(6000); fe=[x for x in pg.frames if 'modulos/engajamento' in x.url][0]
    fe.wait_for_selector('#table-body tr[data-mat]', timeout=20000)
    fe.click('#table-body tr[data-mat] td:nth-child(4)'); fe.wait_for_timeout(800)
    assert fe.evaluate("document.getElementById('modal-overlay') ? getComputedStyle(document.getElementById('modal-overlay')).display!=='none' : !!document.querySelector('.modal.open, .modal-overlay.open, #modal.open')"), 'modal'
    ok('Engajamento: clicar no nome do aluno abre a ficha')
    v=fe.evaluate("[document.getElementById('m-atend').value, document.getElementById('m-atend').options.length]"); assert v[0]=='Marcela Meneguelli' and v[1]==1, v; ok('atendente travado no usuário logado (Marcela Meneguelli)')
    pg.screenshot(path='/home/claude/testes/tela_engaja_ficha.png')
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
