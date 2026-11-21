# Gera app/modulos/renovacao/index.html a partir do index.html do RenovaVR,
# trocando só a conexão e o login (passam a ser os da Jornada do Aluno).
import os
AQUI=os.path.dirname(os.path.abspath(__file__)); RAIZ=os.path.dirname(AQUI)
s=open(os.path.join(RAIZ,'_referencia/renovavr/index.html'),encoding='utf8').read()
def troca(s,a,b,n=1):
    assert s.count(a)==n,(a[:80],s.count(a)); return s.replace(a,b)
# 1. cabeçalho: ícones do app único, sem manifest próprio
s=troca(s,'<link rel="manifest" href="manifest.json">','')
s=troca(s,'<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">','<link rel="icon" type="image/png" href="../../icones/icon-192.png">')
s=troca(s,'<link rel="icon" type="image/png" sizes="16x16" href="icons/favicon-16.png">','')
s=troca(s,'<link rel="apple-touch-icon" href="icons/icon-180.png">','<link rel="apple-touch-icon" href="../../icones/icon-192.png">')
# 2. núcleo da Jornada + sessão vinda do login único, antes de qualquer script do RenovaVR
i=s.index('<script>')
s=s[:i]+'''<script src="../../nucleo/config.js"></script>
<script src="../../nucleo/api.js"></script>
<script>
/* Jornada do Aluno: login, avisos e sessão ficam na tela base */
window.App = (window.parent && window.parent !== window) ? window.parent.App : null;
(function () {
  try {
    var j = Api.Sessao.ler();
    if (j && j.me) localStorage.setItem('sessao', JSON.stringify({ token: 'jornada-sessao-unica-' + j.exp, exp: j.exp, nome: j.me.nome, email: j.me.email, perfil: j.me.perfil }));
    else localStorage.removeItem('sessao');
    // "gasUrl" só indica ao RenovaVR que há servidor; as chamadas vão pela ponte (jsonpGas abaixo)
    localStorage.setItem('gasUrl', 'jornada'); localStorage.setItem('gasUrlVersao', 'jornada');
  } catch (e) {}
})();
</script>
'''+s[i:]
# 3. ponte: toda chamada vai para o servidor único como "renovacao.<ação>"
a=s.index('function jsonpGas(acao, payload, timeoutMs) {'); b=s.index('function gasPost(acao, dados)')
s=s[:a]+'''function jsonpGas(acao, payload, timeoutMs) {
  // Jornada do Aluno: conexão pelo núcleo (login único), sempre na URL do servidor da Jornada.
  var p = Object.assign({}, payload || {}); delete p.token; delete p._viaGet;
  if (acao === 'login') return Promise.resolve({ ok: false, erro: 'Entre pela tela da Jornada do Aluno.' });
  if (acao === 'logout') return Promise.resolve({ ok: true });
  if (acao === 'trocar_senha') {
    return Api.chamar('nucleo.trocar_senha', { atual: p.atual, nova: p.nova }).then(function (r) {
      if (r && r.ok) { var s = Api.Sessao.ler() || {}; Api.Sessao.gravar(Object.assign(s, { token: r.token, exp: r.exp })); }
      else if (r && !r.erro) r.erro = 'Não foi possível trocar a senha.';
      if (r && r.erro === 'senha_atual') r.erro = 'A senha atual não confere.';
      if (r && r.erro === 'senha_fraca') r.erro = r.detalhe || 'Escolha uma senha mais forte.';
      return r;
    });
  }
  return Api.chamar('renovacao.' + acao, p, { timeout: Math.max(timeoutMs || 0, 40000) }).then(function (r) {
    if (r && r.auth === false) { try { sessaoExpirou(); } catch (e) {} }
    return r;
  }, function (e) {
    if (e && e.auth) { try { sessaoExpirou(); } catch (x) {} return { ok: false, auth: false, erro: e.message }; }
    throw e;
  });
}

'''+s[b:]
# 4. a única chamada direta ao servidor (relatório por e-mail) passa pela ponte
s=troca(s,"""    fetch(gasUrl, { method:'POST', body: JSON.stringify({
      acao: 'enviar_email',
      destino: S.adminEmail,
      assunto: `[Estácio] Relatório de Produtividade — ${new Date().toLocaleDateString('pt-BR')}`,
      corpo
    })})
    .then(r=>r.json())""","""    gasPost('enviar_email', {
      destino: S.adminEmail,
      assunto: `[Estácio] Relatório de Produtividade — ${new Date().toLocaleDateString('pt-BR')}`,
      corpo
    })""")
# 5. nunca voltar para a URL do servidor antigo
s=troca(s,"  var GAS_URL_PADRAO = 'https://script.google.com/macros/s/AKfycbzUWA01ltHC3VBSKJZrr1F7D-6u_9LC67itv9KxkTJGFWRaJ7awdftYR1dr6yfuEYL__g/exec';","  var GAS_URL_PADRAO = ''; // Jornada: o servidor é o da Jornada do Aluno")
assert 'AKfycbzUWA01' not in s
# 6. login, troca de senha, sair e usuários: telas da Jornada
s=troca(s,"function mostrarLogin(msg) {\n","function mostrarLogin(msg) {\n  if (window.App && window.App.mostrarLogin) { window.App.mostrarLogin(msg || 'Entre novamente.'); return; }\n")
s=troca(s,"function mostrarTrocaSenha(voluntaria) {\n","function mostrarTrocaSenha(voluntaria) {\n  if (window.App && window.App.pedirTrocaSenha) { window.App.pedirTrocaSenha(!voluntaria); return; }\n")
s=troca(s,"""    try { sessionStorage.removeItem('sessao'); } catch(e) {}
    location.reload();""","""    try { sessionStorage.removeItem('sessao'); } catch(e) {}
    if (window.App && window.App.sair) window.App.sair(); else location.reload();""")
s=troca(s,"""function abrirAtendentes() {
""","""function abrirAtendentes() {
  if (window.parent && window.parent !== window) { window.parent.location.hash = '#/usuarios'; return; }
""")
# 6b. atalho da Central de Bases: abrir direto na importação (só para quem pode ver a tela)
_i=s.rfind('</body>'); s=s[:_i]+'''<script>
/* Jornada: ?tela=importar vindo da Central de Bases */
(function () {
  var t = new URLSearchParams(location.search).get('tela');
  if (t !== 'importar') return;
  var tentativas = 0;
  var abrir = function () {
    tentativas++;
    try { if (typeof S !== 'undefined' && S && S.perfil && typeof podeVer === 'function') { if (podeVer('importar')) ir('importar'); return; } } catch (e) {}
    if (tentativas < 20) setTimeout(abrir, 500);
  };
  window.addEventListener('load', function () { setTimeout(abrir, 800); });
})();
</script>
'''+s[_i:]
# 7. service worker é o da Jornada
s=troca(s,"// ═══ PWA — registrar o Service Worker (permite instalar como app) ═══\nif('serviceWorker' in navigator) {","// ═══ PWA: o service worker é o da Jornada (tela base) ═══\nif(false) {")
os.makedirs(os.path.join(RAIZ,'app/modulos/renovacao'),exist_ok=True)
open(os.path.join(RAIZ,'app/modulos/renovacao/index.html'),'w',encoding='utf8').write(s)
print('ok',len(s))
