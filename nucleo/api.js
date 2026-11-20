/* Jornada do Aluno · comunicação com o Apps Script e sessão
 *
 * Padrão: POST com text/plain (sem pré-voo CORS) e redirect: 'follow'.
 * Reserva: JSONP (tag <script>), usada quando o fetch falha por rede/CORS
 * e o pedido é pequeno o bastante para caber na URL.
 */
(function () {
  const CHAVE_SESSAO = 'jornada_sessao';
  const LIMITE_JSONP = 1800; // caracteres de dados na URL

  const Sessao = {
    ler() {
      try {
        const s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null');
        if (s && s.exp > Date.now()) return s;
      } catch (e) { /* sessão corrompida */ }
      return null;
    },
    gravar(s) { try { localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s)); } catch (e) { /* armazenamento cheio */ } },
    limpar() { try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* ignora */ } },
  };

  function url() {
    const u = (window.JORNADA.gasUrl || '').trim() || (localStorage.getItem('jornada_gas_url') || '').trim();
    if (!u) throw Object.assign(new Error('Endereço do servidor não configurado.'), { config: true });
    return u;
  }

  async function porFetch(corpo, timeoutMs) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(url(), {
        method: 'POST', redirect: 'follow', signal: ctl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(corpo),
      });
      return await r.json();
    } finally { clearTimeout(to); }
  }

  let seq = 0;
  function porJsonp(corpo, timeoutMs) {
    return new Promise((resolve, reject) => {
      const nome = '__jornada_cb_' + Date.now() + '_' + (seq++);
      const { acao, ...resto } = corpo;
      const s = document.createElement('script');
      const fim = () => { delete window[nome]; s.remove(); clearTimeout(to); };
      const to = setTimeout(() => { fim(); reject(new Error('tempo esgotado')); }, timeoutMs);
      window[nome] = (dados) => { fim(); resolve(dados); };
      s.onerror = () => { fim(); reject(new Error('sem resposta do servidor')); };
      s.src = url() + '?acao=' + encodeURIComponent(acao) + '&callback=' + nome + '&data=' + encodeURIComponent(JSON.stringify(resto));
      document.head.appendChild(s);
    });
  }

  /** Chama uma ação do servidor ("sistema.acao"). Devolve o JSON da resposta. */
  async function chamar(acao, dados, opcoes) {
    const o = Object.assign({ timeout: 40000 }, opcoes || {});
    const s = Sessao.ler();
    const corpo = Object.assign({}, dados || {}, { acao: acao });
    if (s && s.token) corpo.token = s.token;
    let r;
    try {
      r = await porFetch(corpo, o.timeout);
    } catch (e) {
      if (e.config) throw e;
      const tamanho = JSON.stringify(corpo).length;
      if (tamanho > LIMITE_JSONP) throw new Error(e.name === 'AbortError' ? 'Tempo esgotado. Tente de novo.' : 'Sem resposta do servidor. Confira a internet.');
      r = await porJsonp(corpo, o.timeout);
    }
    if (r && r.auth === false && acao !== 'nucleo.entrar') {
      if (r.erro === 'trocar') { if (window.App) App.pedirTrocaSenha(); }
      else { Sessao.limpar(); if (window.App) App.mostrarLogin(mensagemAcesso(r.erro)); }
      throw Object.assign(new Error(mensagemAcesso(r.erro)), { auth: true });
    }
    // só o núcleo atualiza a identidade guardada (os sistemas podem devolver formatos próprios)
    if (r && r.me && s && acao.indexOf('nucleo.') === 0) { s.me = r.me; Sessao.gravar(s); }
    return r;
  }

  function mensagemAcesso(codigo) {
    return ({
      credenciais: 'E-mail ou senha incorretos.',
      bloqueado: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.',
      inativo: 'Seu acesso está desativado. Fale com a coordenação.',
      expirou: 'Sua sessão expirou. Entre novamente.',
      auth: 'Sua sessão terminou. Entre novamente.',
      sem_acessos: 'Nenhum usuário cadastrado no servidor ainda.',
      senha_atual: 'A senha atual não confere.',
      trocar: 'Crie a sua senha para continuar.',
    })[codigo] || 'Não foi possível entrar.';
  }

  window.Api = { chamar, Sessao, mensagemAcesso };
})();
