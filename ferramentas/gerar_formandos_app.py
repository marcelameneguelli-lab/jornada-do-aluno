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
        j = await Api.chamar('formandos.' + acao, resto);
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
# 5. o service worker é o da Jornada (não registra outro)
s=troca(s,"if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {","if (false) { // Jornada: service worker único na tela base")
os.makedirs('/home/claude/jornada/app/modulos/formandos',exist_ok=True)
open('/home/claude/jornada/app/modulos/formandos/index.html','w',encoding='utf8').write(s)
print('ok', len(s))
