# Gera app/modulos/formandos/index.html a partir do index.html do Painel Formandos,
# trocando só a conexão (passa a usar o login e o servidor únicos da Jornada).
import os
src=open('/home/claude/jornada/_referencia/formandos/index.html',encoding='utf8').read()
def troca(s, velho, novo, n=1):
    assert s.count(velho)==n, (velho[:70], s.count(velho)); return s.replace(velho, novo)
s=src
# 1. cabeçalho: ícones do app único, sem manifest próprio
s=troca(s,'<link rel="manifest" href="manifest.webmanifest">','')
s=s.replace('href="icon-192.png"','href="../../icones/icon-192.png"').replace('href="apple-touch-icon.png"','href="../../icones/icon-192.png"').replace('href="icon-512.png"','href="../../icones/icon-512.png"')
# 2. carrega o núcleo da Jornada antes dos scripts do painel
i=s.index('<script'); 
s=s[:i]+'<script src="../../nucleo/config.js"></script>\n<script src="../../nucleo/api.js"></script>\n<script>/* Jornada: login e avisos ficam na tela base */ window.App = (window.parent && window.parent !== window) ? window.parent.App : null;</script>\n'+s[i:]
# 3. ponte: toda chamada vai para o servidor único como "formandos.<ação>"
velho_ini='  async function bruto(corpo) {'
a=s.index(velho_ini); b=s.index('  async function chamar(corpo) {')
s=s[:a]+'''  async function bruto(corpo) {
    // Jornada do Aluno: conexão pelo núcleo (login único). Respostas no formato que o painel já entende.
    const { action, token: _semUso, ...resto } = corpo;
    const acao = action || (Array.isArray(corpo.ops) ? 'ops' : 'ping');
    if (acao === 'entrar') return { ok: false, error: 'auth', ver: VERSAO_SERVIDOR };
    let j;
    try {
      if (acao === 'trocar_senha') {
        j = await Api.chamar('nucleo.trocar_senha', { atual: resto.atual, nova: resto.nova });
        if (j && j.ok) { const s = Api.Sessao.ler() || {}; Api.Sessao.gravar(Object.assign(s, { token: j.token, exp: j.exp })); j.token = 'jornada'; }
      } else {
        j = await Api.chamar('formandos.' + acao, window.JORNADA_IMPORTACAO ? Object.assign({ importacao: true }, resto) : resto);
      }
    } catch (e) {
      if (e.auth) return { ok: false, error: 'auth', ver: VERSAO_SERVIDOR };
      const err = new Error(e.message || 'sem resposta do Google'); err.rede = true; throw err;
    }
    if (!j) { const err = new Error('resposta vazia do servidor'); err.rede = true; throw err; }
    if (j.permissao === false) j.error = 'sem_permissao';
    if (j.ok === false && !j.error && j.erro) j.error = j.erro;
    j.ver = VERSAO_SERVIDOR;
    return j;
  }
'''+s[b:]
# 4. sem login próprio: a sessão é a da Jornada
s=troca(s,"      url = urlFixa() ? GAS_URL : (localStorage.getItem(LS_GAS_URL) || '');","      url = 'jornada';")
s=troca(s,"      token = localStorage.getItem(LS_GAS_TOKEN) || '';","      token = 'jornada';")
s=troca(s,"  const guardarToken = () => { try { localStorage.setItem(LS_GAS_TOKEN, token); if (!urlFixa()) localStorage.setItem(LS_GAS_URL, url); } catch (e) {} };","  const guardarToken = () => {};")
a=s.index('  async function entrarInterativo(aviso) {'); b=s.index('  let reauth = null;')
s=s[:a]+'''  async function entrarInterativo(aviso) {
    // Jornada do Aluno: o login é feito na tela base. Ao entrar de novo, o painel é recarregado.
    if (window.App && window.App.mostrarLogin) window.App.mostrarLogin(aviso || 'Entre novamente.');
    return new Promise(() => {});
  }

'''+s[b:]
s=troca(s,"""function sairDesteComputador() {
  try { localStorage.removeItem('formandos_gas_key'); localStorage.removeItem('formandos_gas_token'); localStorage.removeItem(USER_KEY); } catch(e) {}
  location.reload();
}""","""function sairDesteComputador() {
  try { localStorage.removeItem(USER_KEY); } catch(e) {}
  if (window.App && window.App.sair) window.App.sair(); else location.reload();
}""")
# 4b. importação e configurações saíram de dentro do painel (decisão de 21/11/2026):
#     ficam na Central de Bases (?modo=importar) e em Configurações (?modo=config) da Jornada.
_i=s.rfind('</body>'); s=s[:_i]+'''<style>
  html.jornada-normal #btn-import, html.jornada-normal #btn-import-formados, html.jornada-normal #btn-enade, html.jornada-normal #btn-clear { display: none !important; }
  html.jornada-normal #sem-badge { cursor: default; }
  html.jornada-modo .tab-nav, html.jornada-modo .tab-panel, html.jornada-modo .header-right > :not(#sync-label) { display: none !important; }
  #jornada-painel-modo { display: none; }
  html.jornada-modo #jornada-painel-modo { display: block; max-width: 640px; margin: 28px auto; padding: 0 18px; }
  #jornada-painel-modo .jm-card { background: #fff; border: 1px solid #dde4ee; border-radius: 10px; padding: 18px; margin-bottom: 14px; }
  #jornada-painel-modo h3 { margin: 0 0 6px; font-size: 16px; }
  #jornada-painel-modo p { margin: 0 0 12px; font-size: 13px; color: #5b6676; line-height: 1.5; }
</style>
<script>
/* Jornada: modo importar (Central de Bases) e modo config (Configurações) */
(function () {
  var modo = new URLSearchParams(location.search).get('modo');
  modo = (modo === 'importar' || modo === 'config') ? modo : '';
  var raiz = document.documentElement, pai = (window.parent && window.parent !== window) ? window.parent : null;
  if (!modo) {
    raiz.classList.add('jornada-normal');
    // o semestre agora é trocado em Configurações
    var _sem = openSemModal;
    openSemModal = function () { if (pai && ehAdmin()) { pai.location.hash = '#/config/formandos'; return; } if (!pai) return _sem(); };
    return;
  }
  raiz.classList.add('jornada-modo', 'jornada-modo-' + modo);
  if (modo === 'importar' && (function () { try { return ((window.Api && Api.Sessao.ler()) || {}).me || {}; } catch (e) { return {}; } })().bases) {
    // Central de Bases: quem tem "bases" (inclusive atendente) importa alunos, formados e ENADE
    window.JORNADA_IMPORTACAO = true;
    ehAdmin = function () { return true; };
  }
  var painel = document.createElement('div');
  painel.id = 'jornada-painel-modo';
  painel.innerHTML = modo === 'importar'
    ? '<div class="jm-card"><h3>👥 Prováveis formandos</h3><p>Planilha de alunos do semestre. Os contatos, observações e etapas já registrados são mantidos.</p><button class="btn btn-primary" onclick="openImportAlunos()">+ Importar alunos</button></div>'
      + '<div class="jm-card"><h3>🎓 Formados</h3><p>Lista de alunos que já colaram grau.</p><button class="btn btn-primary" onclick="openImportFormados()">+ Importar formados</button></div>'
      + '<div class="jm-card"><h3>📝 ENADE</h3><p>Arquivos de situação do ENADE, aplicados aos alunos do painel.</p><button class="btn btn-ghost" onclick="openEnade()">Importar ENADE</button></div>'
    : '<div class="jm-card"><h3>📅 Semestre de trabalho</h3><p>Semestre atual do painel: <b id="jm-sem">—</b></p><button class="btn btn-primary" onclick="openSemModal()">Alterar semestre</button></div>'
      + '<div class="jm-card"><h3>🗑️ Limpar dados</h3><p>Apaga os dados do painel (pede a senha de limpeza). Use só no fechamento do semestre.</p><button class="btn btn-danger-ghost" onclick="confirmClear()">Limpar dados</button></div>';
  var cab = document.querySelector('.app-header');
  cab.parentNode.insertBefore(painel, cab.nextSibling);
  if (modo === 'config') {
    var copiar = function () { var b = document.getElementById('sem-badge'), d = document.getElementById('jm-sem'); if (b && d) d.textContent = b.textContent; };
    copiar(); setInterval(copiar, 1500);
  }
})();
</script>
'''+s[_i:]
# 5. o service worker é o da Jornada (não registra outro)
s=troca(s,"if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {","if (false) { // Jornada: service worker único na tela base")
os.makedirs('/home/claude/jornada/app/modulos/formandos',exist_ok=True)
open('/home/claude/jornada/app/modulos/formandos/index.html','w',encoding='utf8').write(s)
print('ok', len(s))
