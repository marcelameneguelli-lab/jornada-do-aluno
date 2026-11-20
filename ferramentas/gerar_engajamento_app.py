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
    const r = await Api.chamar('engajamento.' + action, Object.assign({}, body), { timeout: 30000 });
    if (r && r.permissao === false) { showToast('⚠️ ' + (r.erro || 'Seu perfil não pode fazer isso.')); return Object.assign(r, { ok: false, error: r.erro, msg: r.erro }); }
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
    _concluirLogin(_usuarioLogado); // Jornada: inclui a busca da base no servidor
  }""")
# 5. service worker é o da Jornada
s=troca(s,"if ('serviceWorker' in navigator && location.protocol === 'https:') {","if (false) { // Jornada: service worker único na tela base")
os.makedirs(os.path.join(RAIZ,'app/modulos/engajamento'),exist_ok=True)
open(os.path.join(RAIZ,'app/modulos/engajamento/index.html'),'w',encoding='utf8').write(s)
print('ok',len(s))
