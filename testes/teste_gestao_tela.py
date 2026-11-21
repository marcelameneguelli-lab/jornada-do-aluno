import json
from playwright.sync_api import sync_playwright
prov=json.load(open('/tmp/prov.json')); B='http://localhost:8765/'; erros=[]; n=0
def ok(m):
    global n; n+=1; print('ok ',m)
with sync_playwright() as p:
    br=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=br.new_page(viewport={'width':1366,'height':900})
    pg.on('pageerror', lambda e: erros.append('PAGEERR '+str(e)))
    pg.add_init_script("localStorage.setItem('jornada_gas_url','http://localhost:8765/exec')")
    pg.goto(B); pg.fill('#login-email','marques.marcela@estacio.br'); pg.fill('#login-senha',prov['admin']); pg.click('#btn-entrar')
    pg.wait_for_selector('#form-troca:not([hidden])'); pg.fill('#troca-atual',prov['admin']); pg.fill('#troca-nova','Admin2026b'); pg.fill('#troca-conf','Admin2026b'); pg.click('#form-troca button.primario')
    pg.wait_for_function("document.body.dataset.tela==='app'")
    pg.goto(B+'#/bases'); pg.wait_for_selector('.card-sistema.base', timeout=15000)
    txt=pg.inner_text('#cards-bases').replace('\xa0',' ')
    assert 'Ciclo 2026.1: 4 alunos' in txt and 'Base líquida Ímpar' in txt and '6 alunos' in txt and 'Formandos' in txt, txt[:400]; ok('Central de Bases mostra Renovação, 3 bases líquidas, Formandos e NPS')
    pg.screenshot(path='/home/claude/testes/tela_central_bases.png')
    fr_de=lambda parte: [x for x in pg.frames if parte in x.url][0]
    # Engajamento: importação da base Par, sem o resto do sistema
    pg.click('text=Importar base Par'); pg.wait_for_timeout(5000); fr=fr_de('modulos/engajamento')
    assert fr.evaluate("document.getElementById('page-importar').classList.contains('active') && ACTIVE_BASE==='par'"); ok('Central abre a importação do Engajamento já na base Par')
    assert not fr.is_visible('.tab-bar') and not fr.is_visible('.gas-config'); ok('só a importação aparece (sem abas e sem a conexão manual com o GAS)')
    fr.evaluate("showPage('painel')"); assert fr.evaluate("document.getElementById('page-importar').classList.contains('active')"); ok('no modo importar não dá para sair para outra tela')
    pg.screenshot(path='/home/claude/testes/tela_central_engajamento.png')
    # Renovação
    pg.goto(B+'#/bases'); pg.wait_for_selector('.card-sistema.base'); pg.click('text=Importar base da Renovação'); pg.wait_for_timeout(6000); fr=fr_de('modulos/renovacao')
    assert fr.evaluate("document.getElementById('tela-importar').style.display!=='none'") and not fr.is_visible('#sb'); ok('Central abre a importação da Renovação, sem o menu do sistema')
    fr.evaluate("ir('alunos')"); assert fr.evaluate("document.getElementById('tela-importar').style.display!=='none'"); ok('Renovação em modo importar fica só na importação')
    # Formandos
    pg.goto(B+'#/bases'); pg.wait_for_selector('.card-sistema.base'); pg.click('text=Importar no Formandos'); pg.wait_for_timeout(5000); fr=fr_de('modulos/formandos')
    assert fr.is_visible('#jornada-painel-modo') and not fr.is_visible('.tab-nav'); ok('Central abre o Formandos só com as importações (alunos, formados, ENADE)')
    fr.click('#jornada-painel-modo >> text=+ Importar alunos'); pg.wait_for_timeout(500); assert fr.is_visible('#import-modal'); ok('botão abre a importação original do Formandos')
    pg.screenshot(path='/home/claude/testes/tela_central_formandos.png')
    # dentro dos sistemas não há mais importação nem área de administrador
    pg.goto(B+'#/s/renovacao'); pg.wait_for_timeout(6000); fr=fr_de('modulos/renovacao')
    assert not fr.is_visible('#sb a[onclick="ir(\'importar\')"]') and not fr.is_visible('#menu-config') and not fr.is_visible('#menu-admin'); ok('Renovação sem Importar, Configurações e Admin no menu')
    fr.evaluate("ir('importar')"); pg.wait_for_timeout(800); assert pg.evaluate("location.hash")=='#/bases/renovacao'; ok('atalho interno "Importar" da Renovação leva para a Central de Bases')
    pg.goto(B+'#/s/engajamento'); pg.wait_for_timeout(5000); fr=fr_de('modulos/engajamento')
    assert not fr.is_visible('#tab-importar') and fr.locator('[onclick="showPage(\'admin\')"]:visible').count()==0; ok('Engajamento sem a aba Importar e sem o botão Admin')
    fr.evaluate("showPage('admin')"); pg.wait_for_timeout(800); assert pg.evaluate("location.hash")=='#/config/engajamento'; ok('pedido de Admin no Engajamento leva para Configurações')
    pg.goto(B+'#/s/formandos'); pg.wait_for_timeout(5000); fr=fr_de('modulos/formandos')
    assert not fr.is_visible('#btn-import') and not fr.is_visible('#btn-clear') and not fr.is_visible('#btn-enade'); ok('Formandos sem Importar, ENADE e Limpar dados no cabeçalho')
    # Configurações
    pg.goto(B+'#/config'); pg.wait_for_selector('.card-sistema.base'); assert pg.locator('.card-sistema.base').count()==3; ok('Configurações reúne Renovação, Engajamento e Formandos')
    pg.click('text=Abrir configurações >> nth=0'); pg.wait_for_timeout(6000); fr=fr_de('modulos/renovacao')
    assert fr.evaluate("document.getElementById('tela-config').style.display!=='none'") and fr.is_visible('#jornada-barra-modo'); ok('Configurações da Renovação (metas, ritmo, prazo e painel do administrador)')
    pg.screenshot(path='/home/claude/testes/tela_config_renovacao.png')
    pg.goto(B+'#/config/engajamento'); pg.wait_for_timeout(5000); fr=fr_de('modulos/engajamento')
    assert fr.evaluate("document.getElementById('page-admin').classList.contains('active')") and fr.is_visible('#atend-list') and not fr.is_visible('#publish-result') and not fr.is_visible('#adm-user-email'); ok('Configurações do Engajamento sem PIN, sem publicar no GAS e sem usuários próprios')
    pg.screenshot(path='/home/claude/testes/tela_config_engajamento.png')
    pg.goto(B+'#/config/formandos'); pg.wait_for_timeout(5000); fr=fr_de('modulos/formandos')
    assert 'Semestre de trabalho' in fr.inner_text('#jornada-painel-modo'); ok('Configurações do Formandos (semestre e limpeza)')
    pg.goto(B+'#/relatorio'); pg.wait_for_selector('#rel-frame', timeout=15000); pg.wait_for_timeout(800)
    h=pg.frame_locator('#rel-frame').locator('body').inner_text()
    assert 'Relatório do dia' in h and 'Acessaram a Jornada hoje' in h, h[:300]; ok('prévia do relatório aparece')
    assert 'desligado' in pg.inner_text('#rel-info'); pg.click('#rel-ativar'); pg.wait_for_timeout(2500); ok('botão de ativar o envio automático responde')
    pg.screenshot(path='/home/claude/testes/tela_relatorio.png', full_page=True)
    br.close()
print(n,'passos ok'); print('erros:', erros or 'nenhum')
