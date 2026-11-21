/**
 * ROTEADOR
 * Toda chamada traz "acao" no formato "sistema.acao" (ex.: "nucleo.ping",
 * "formandos.poll"). Ações sem ponto são do núcleo.
 *
 * Entrada principal: POST com Content-Type text/plain (evita o pré-voo CORS).
 * Reserva: GET com ?acao=...&data=<json>&callback=fn (JSONP), para redes que
 * bloqueiam a leitura da resposta do fetch.
 */

const ACOES_PUBLICAS = ['nucleo.ping', 'nucleo.entrar'];
// ações de leitura que valem para todo usuário logado, mesmo sem o sistema liberado
const ACOES_TODOS_LOGADOS = ['apoio.orientacoes'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.acao) {
    return ContentService.createTextOutput(NOME_SISTEMA + ': servidor ativo (v' + VERSAO + ').')
      .setMimeType(ContentService.MimeType.TEXT);
  }
  let d = {};
  if (p.data) { try { d = JSON.parse(p.data); } catch (err) { d = {}; } }
  return saida_(processar_(p.acao, d), p.callback);
}

function doPost(e) {
  let d = {};
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return saida_({ ok: false, erro: 'Pedido inválido.' }); }
  return saida_(processar_(d.acao, d));
}

function saida_(obj, callback) {
  obj.ver = VERSAO;
  const txt = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][\w$.]{0,80}$/.test(callback)) {
    return ContentService.createTextOutput(callback + '(' + txt + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(txt).setMimeType(ContentService.MimeType.JSON);
}

/** Separa "sistema.acao". Ações sem ponto pertencem ao núcleo. */
function separarAcao_(acao) {
  const a = String(acao || '');
  const i = a.indexOf('.');
  return i < 0 ? { sis: 'nucleo', nome: a } : { sis: a.slice(0, i), nome: a.slice(i + 1) };
}

/** Módulo de cada sistema: função global Modulo_<sistema>() que devolve { acoes, gestao, admin }. */
function obterModulo_(sis) {
  if (sis === 'nucleo') return Modulo_nucleo();
  if (sis === 'ferramentas') return Modulo_ferramentas();
  if (SISTEMAS.indexOf(sis) < 0) return null;
  const f = globalThis['Modulo_' + sis];
  return typeof f === 'function' ? f() : null;
}

function processar_(acao, d) {
  d = d || {};
  const { sis, nome } = separarAcao_(acao);
  const chave = sis + '.' + nome;
  try {
    let eu = null;
    if (ACOES_PUBLICAS.indexOf(chave) < 0) {
      eu = autenticar_(d.token, chave === 'nucleo.trocar_senha');
      if (eu.erro) return { ok: false, auth: false, erro: eu.erro };
      // núcleo e ferramentas da equipe (Calendário, Tarefas, Tutoriais) valem para todos os logados
      if (sis !== 'nucleo' && sis !== 'ferramentas' && ACOES_TODOS_LOGADOS.indexOf(chave) < 0 && !podeSistema_(eu, sis)) {
        return { ok: false, permissao: false, erro: 'Seu perfil não tem acesso a este sistema.' };
      }
    }
    delete d.token;
    const mod = obterModulo_(sis);
    if (!mod) return { ok: false, erro: 'Sistema ainda não disponível: ' + sis };
    const fn = mod.acoes[nome];
    if (!fn) return { ok: false, erro: 'Ação desconhecida: ' + chave };
    if (eu) {
      const regra = PERFIS[eu.perfil] || PERFIS.atendente;
      if ((mod.admin || []).indexOf(nome) >= 0 && !regra.admin) return { ok: false, permissao: false, erro: 'Apenas o administrador pode fazer isso.' };
      if ((mod.gestao || []).indexOf(nome) >= 0 && !regra.gestao) return { ok: false, permissao: false, erro: 'Seu perfil não pode fazer isso.' };
    }
    const r = fn(d, eu) || {};
    if (eu && !r.me) r.me = publico_(eu); // o módulo pode devolver a identidade no formato dele
    return r;
  } catch (err) {
    log_('ERRO', chave, String(err && err.message || err));
    return { ok: false, erro: String(err && err.message || err) };
  }
}

/** Ações do núcleo (login, usuários, informações gerais). */
function Modulo_nucleo() {
  return {
    acoes: Object.assign(acoesGestao_(), {
      ping:            () => ({ ok: true, nome: NOME_SISTEMA }),
      entrar:          (d) => entrar_(d),
      sessao:          (d, eu) => ({ ok: true }),
      trocar_senha:    (d, eu) => trocarSenha_(eu, d),
      usuarios_listar: () => ({ ok: true, usuarios: listaUsuarios_().map(publicoAdmin_) }),
      usuario_salvar:  (d, eu) => usuarioSalvar_(d, eu),
      usuario_senha:   (d, eu) => usuarioNovaProvisoria_(d, eu),
      historico_engajavr: (d, eu) => trazerHistoricoEngajaVR_(eu),
    }),
    admin: ['usuarios_listar', 'usuario_salvar', 'usuario_senha', 'relatorio_previa', 'relatorio_enviar', 'relatorio_ativar', 'historico_engajavr'],
    gestao: ['bases_resumo'],
  };
}
