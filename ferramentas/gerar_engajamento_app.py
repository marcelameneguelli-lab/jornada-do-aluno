# Gera app/modulos/engajamento/index.html a partir do index.html do EngajaVR,
# trocando só a conexão e o login (passam a ser os da Jornada do Aluno).
import os
AQUI=os.path.dirname(os.path.abspath(__file__)); RAIZ=os.path.dirname(AQUI)
s=open(os.path.join(RAIZ,'_referencia/engajavr/index.html'),encoding='utf8').read()
def troca(s,a,b,n=1):
    assert s.count(a)==n,(a[:80],s.count(a)); return s.replace(a,b)
# 1. sem manifest próprio; ícone do app único
s=troca(s,"""  <script>if(location.protocol==='https:'){var l=document.createElement('link');l.rel='manifest';l.href='manifest.json';document.head.appendChild(l);}</script>""","""  <link rel="icon" type="image/png" href="../../icones/icon-192.png">""")
s=troca(s,'<link rel="apple-touch-icon" href="icon-192.png">','<link rel="apple-touch-icon" href="../../icones/icon-192.png">')
# 2. núcleo da Jornada e sessão vinda do login único, antes do script principal
s=troca(s,'<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>','''<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
  <script src="../../nucleo/config.js"></script>
  <script src="../../nucleo/api.js"></script>
  <script>
  /* Jornada do Aluno: login, avisos e sessão ficam na tela base */
  window.App = (window.parent && window.parent !== window) ? window.parent.App : null;
  window.JORNADA_FERRAMENTA = (function () { var f = new URLSearchParams(location.search).get('ferramenta'); return ['calendario', 'tarefas', 'tutoriais', 'financeiro', 'estagio', 'polo'].indexOf(f) >= 0 ? f : ''; })();
  // Tela original de um sistema próprio (Financeiro, Estágio, Provas): fala só com o servidor desse sistema, na base escolhida
  window.JORNADA_SISTEMA = (function () { var q = new URLSearchParams(location.search), s = q.get('sistema'); return ['financeiro', 'estagio', 'provas'].indexOf(s) >= 0 ? s : ''; })();
  (function () {
    var b = new URLSearchParams(location.search).get('base');
    if (window.JORNADA_SISTEMA && ['impar', 'par', 'ct'].indexOf(b) >= 0) {
      try { window._jornadaBaseAnterior = localStorage.getItem('crm_active_base'); localStorage.setItem('crm_active_base', b); } catch (e) {}
    }
  })();
  (function () {
    try {
      var j = Api.Sessao.ler();
      if (j && j.me) {
        sessionStorage.setItem('engajavr_session_ok', 'true');
        sessionStorage.setItem('engajavr_session_user', JSON.stringify({ nome: j.me.nome, email: j.me.email, perfil: j.me.perfil, senha: 'jornada', primeiroAcesso: false }));
      } else {
        sessionStorage.removeItem('engajavr_session_ok'); sessionStorage.removeItem('engajavr_session_user');
        if (window.App && window.App.mostrarLogin) window.App.mostrarLogin('Entre novamente.');
      }
    } catch (e) {}
  })();
  </script>''')
# 3. servidor: sempre o da Jornada (nunca a URL antiga), pela ponte do núcleo
s=troca(s,"const GAS_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbxLEMQ7c1ToIExilsDUjVRPuj238sk0c5A0rdyYT08fGrhCPpXgx3xD89jbpliBk2qI/exec';","const GAS_URL_DEFAULT = 'jornada'; // Jornada: o servidor é o da Jornada do Aluno")
s=troca(s,"let GAS_URL = localStorage.getItem('crm_gas_url') || GAS_URL_DEFAULT;","let GAS_URL = GAS_URL_DEFAULT;")
assert 'AKfycb' not in s
a=s.index('async function gasCall(action, body={}) {'); b=s.index('// ---- Sincronização de base (DB) com GAS ----')
s=s[:a]+'''async function gasCall(action, body={}) {
  // Jornada do Aluno: conexão pelo núcleo (login único). Mesmo formato de resposta do EngajaVR.
  if (!GAS_URL) return null;
  try {
    const FERR = ['getEventos', 'saveEventos', 'getTarefas', 'saveTarefas', 'getTutoriais', 'saveTutoriais', 'getAtendentes'];
    const sistema = FERR.indexOf(action) >= 0 ? 'ferramentas.' : (window.JORNADA_SISTEMA ? window.JORNADA_SISTEMA + '.' : 'engajamento.');
    const r = await Api.chamar(sistema + action, Object.assign({}, body), { timeout: 30000 });
    if (r && r.permissao === false) { if (!window.JORNADA_FERRAMENTA) showToast('⚠️ ' + (r.erro || 'Seu perfil não pode fazer isso.')); return Object.assign(r, { ok: false, error: r.erro, msg: r.erro }); }
    if (r && r.ok === false && r.erro && !r.error) { r.error = r.erro; if (!r.msg) r.msg = r.erro; }
    return r;
  } catch (e) {
    if (!e.auth) console.warn('gasCall falhou:', action, e.message);
    return null;
  }
}

'''+s[b:]
# 4. sair, PIN de admin e usuários: tudo pela Jornada
s=troca(s,"""function sairDoApp() {
  try {""","""function sairDoApp() {
  if (window.App && window.App.sair) { try { sessionStorage.removeItem(_APP_SESSION_KEY); sessionStorage.removeItem(_APP_USER_KEY); } catch(e) {} window.App.sair(); return; }
  try {""")
s=troca(s,"""function _initAdmin() {
  admRenderUsuarios();""","""function _initAdmin() {
  // Jornada: a aba Admin só aparece para o perfil admin, então o PIN não é mais pedido
  if (_podeAdmin()) _adminAutenticado = true;
  admRenderUsuarios();""")
s=troca(s,"""function admRenderUsuarios() {
  var lista = document.getElementById('adm-users-lista');
  if (!lista) return;""","""function admRenderUsuarios() {
  var lista = document.getElementById('adm-users-lista');
  if (!lista) return;
  if (window.parent && window.parent !== window) {
    lista.innerHTML = '<div style="font-size:13px;padding:10px;background:var(--bg);border-radius:6px">Usuários, senhas e perfis agora ficam na Jornada do Aluno. <a href="#" onclick="window.parent.location.hash=\\'#/usuarios\\';return false">Abrir Usuários e perfis</a></div>';
    return;
  }""")
# 4b. abrir com sessão = mesmo caminho do login (traz a base do servidor quando o computador não tem)
s=troca(s,"""  if (!_verificarSessaoApp()) {
    setTimeout(function(){
      var el = document.getElementById('lg-email');
      if (el) el.focus();
    }, 100);
  } else {
    init();
  }""","""  if (!_verificarSessaoApp()) {
    setTimeout(function(){
      var el = document.getElementById('lg-email');
      if (el) el.focus();
    }, 100);
  } else {
    if (window.JORNADA_SISTEMA) {
      // Jornada: tela original de Financeiro, Estágio ou Provas, com a base carregada do servidor
      document.body.classList.add('modo-ferramenta');
      try { if (window._jornadaBaseAnterior != null) localStorage.setItem('crm_active_base', window._jornadaBaseAnterior); } catch (e) {}
      // nesta tela só existe a página do sistema: qualquer pedido de outra página volta para ela
      var _showPageOriginal = showPage;
      showPage = function (p) { return _showPageOriginal(window.JORNADA_FERRAMENTA); };
      _concluirLogin(_usuarioLogado);
      showPage(window.JORNADA_FERRAMENTA);
    } else if (window.JORNADA_FERRAMENTA) {
      // Jornada: ferramenta da equipe (Calendário, Tarefas ou Tutoriais), sem a base de alunos
      var _nomes = { calendario: '🗓️ Calendário', tarefas: '✅ Tarefas', tutoriais: '📚 Tutoriais' };
      document.body.classList.add('modo-ferramenta');
      var _lt = document.getElementById('logo-titulo'); if (_lt) _lt.textContent = _nomes[window.JORNADA_FERRAMENTA];
      document.querySelectorAll('h2').forEach(function (h) { if (h.textContent.indexOf('Tarefas de Engajamento') >= 0) h.textContent = '✅ Tarefas da equipe'; });
      init().catch(function(){}).then(function () { showPage(window.JORNADA_FERRAMENTA); });
      setTimeout(function () { showPage(window.JORNADA_FERRAMENTA); }, 50);
    } else {
      _concluirLogin(_usuarioLogado); // Jornada: inclui a busca da base no servidor
      _jornadaModo();
    }
  }""")
# 4c. menu do Engajamento sem as telas que saíram (decisão de 20/11/2026):
#     Calendário, Tarefas e Tutoriais viram ferramentas da equipe; Financeiro, Estágio e Provas viram sistemas próprios.
for linha in ['    <button class="tab" onclick="showPage(\'calendario\')">🗓️ Calendário</button>\n',
              '    <button class="tab" id="tab-tarefas" onclick="showPage(\'tarefas\')">✅ Tarefas</button>\n',
              '    <button class="tab" onclick="showPage(\'tutoriais\')">📚 Tutoriais</button>\n',
              '    <button class="tab" onclick="showPage(\'financeiro\')">💰 Financeiro</button>\n',
              '    <button class="tab" onclick="showPage(\'estagio\')">🎓 Estágio</button>\n',
              '    <button class="tab" onclick="showPage(\'polo\')">📝 Provas</button>\n']:
    s=troca(s,linha,'')
s=troca(s,'</style>','''  /* Jornada: modo ferramenta (Calendário, Tarefas, Tutoriais) sem abas, bases, contador de alunos e rodapé do EngajaVR */
  body.modo-ferramenta .tab-bar, body.modo-ferramenta .base-selector, body.modo-ferramenta #priority-bar,
  body.modo-ferramenta #top-count, body.modo-ferramenta .status-dot, body.modo-ferramenta .rodape-engajavr { display: none !important; }
</style>''')
s=troca(s,'<div style="text-align:center;padding:10px;font-size:11px;color:var(--text3);border-top:1px solid var(--border);background:var(--surface)">\n  Desenvolvido por','<div class="rodape-engajavr" style="text-align:center;padding:10px;font-size:11px;color:var(--text3);border-top:1px solid var(--border);background:var(--surface)">\n  Desenvolvido por')
# 4d. importação e área administrativa saíram de dentro do sistema (decisão de 21/11/2026):
#     ficam na Central de Bases e em Configurações da Jornada (?modo=importar&base=X ou ?modo=config).
_i=s.rfind('</body>'); s=s[:_i]+'''<style>
  html.jornada-normal #tab-importar, html.jornada-normal [onclick="showPage('admin')"] { display: none !important; }
  html.jornada-modo .tab-bar, html.jornada-modo #priority-bar, html.jornada-modo #top-count, html.jornada-modo .rodape-engajavr { display: none !important; }
  .jornada-obsoleto { display: none !important; }
</style>
<script>
/* Jornada: modo importar (Central de Bases) e modo config (Configurações) */
function _jornadaModo() {
  var q = new URLSearchParams(location.search), modo = q.get('modo');
  modo = (modo === 'importar' || modo === 'config') ? modo : '';
  var raiz = document.documentElement, pai = (window.parent && window.parent !== window) ? window.parent : null;
  // itens que não existem mais na Jornada: publicar HTML no GAS, usuários e senha próprios, conexão manual com o GAS
  ['publish-result', 'adm-user-email', 'admin-new-pin-1'].forEach(function (id) {
    var el = document.getElementById(id), card = el && el.closest('#admsub-gestao > div'); if (card) card.classList.add('jornada-obsoleto');
  });
  document.querySelectorAll('#page-importar .gas-config').forEach(function (el) { var c = el.closest('.chart-card'); if (c) c.classList.add('jornada-obsoleto'); });
  document.querySelectorAll('[onclick="adminLogout()"]').forEach(function (b) { b.classList.add('jornada-obsoleto'); });
  var _tm = document.getElementById('admin-timer-display'); if (_tm && _tm.parentNode) _tm.parentNode.classList.add('jornada-obsoleto');
  var _show = showPage;
  if (!modo) {
    raiz.classList.add('jornada-normal');
    showPage = function (p) {
      if (pai && p === 'importar') { pai.location.hash = '#/bases/engajamento?base=' + (typeof ACTIVE_BASE !== 'undefined' ? ACTIVE_BASE : 'impar'); return; }
      if (pai && p === 'admin') { pai.location.hash = '#/config/engajamento'; return; }
      return _show.apply(this, arguments);
    };
    return;
  }
  raiz.classList.add('jornada-modo', 'jornada-modo-' + modo);
  var tela = modo === 'importar' ? 'importar' : 'admin';
  var pode = modo === 'importar' ? _podeImportar() : _podeAdmin();
  showPage = function () { return _show(tela); };
  if (!pode) { document.querySelector('.main').innerHTML = '<div style="padding:40px;text-align:center">Seu perfil não tem acesso a esta área.</div>'; return; }
  var base = q.get('base');
  var abrir = function () { _show(tela); };
  if (base && typeof BASE_CONFIG !== 'undefined' && BASE_CONFIG[base] && base !== ACTIVE_BASE) {
    Promise.resolve(switchBase(base)).catch(function () {}).then(function () { setTimeout(abrir, 50); });
  } else setTimeout(abrir, 50);
}
</script>
'''+s[_i:]
# 5. service worker é o da Jornada
s=troca(s,"if ('serviceWorker' in navigator && location.protocol === 'https:') {","if (false) { // Jornada: service worker único na tela base")
os.makedirs(os.path.join(RAIZ,'app/modulos/engajamento'),exist_ok=True)
open(os.path.join(RAIZ,'app/modulos/engajamento/index.html'),'w',encoding='utf8').write(s)
print('ok',len(s))
