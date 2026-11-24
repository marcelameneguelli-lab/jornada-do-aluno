/**
 * ACESSO: login com e-mail institucional e senha, perfis e sistemas liberados.
 * Base: login do Painel Formandos v3 (hash com sal, passe assinado, bloqueio
 * por erros) + perfis do RenovaVR v6.6 (admin, coordenador, atendente, apoio).
 *
 * Aba "usuarios" (planilha central, mantenha PRIVADA):
 *  A nome | B e-mail | C perfil | D sistemas | E ativo | F último acesso |
 *  G senha provisória | H sal (não mexer) | I hash (não mexer) | J trocar senha
 *
 * Coluna "sistemas": "todos" ou lista separada por vírgula, com os nomes
 * renovacao, engajamento, provas, estagio, financeiro, financiamentos, nps, formandos, apoio.
 */

const COLS_USUARIOS = ['nome', 'e-mail', 'perfil', 'sistemas', 'ativo', 'último acesso',
  'senha provisória', 'sal (não mexer)', 'hash (não mexer)', 'trocar senha'];

function planilhaCentral_() {
  return PLANILHA_CENTRAL_ID ? SpreadsheetApp.openById(PLANILHA_CENTRAL_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function abaUsuarios_() {
  const ss = planilhaCentral_();
  let sh = ss.getSheetByName('usuarios');
  if (!sh) {
    sh = ss.insertSheet('usuarios');
    sh.getRange(1, 1, 1, COLS_USUARIOS.length).setValues([COLS_USUARIOS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function normEmail_(v) { return String(v || '').trim().toLowerCase(); }

function normPerfil_(v) {
  const t = String(v || '').trim().toLowerCase();
  if (/^adm/.test(t)) return 'admin';
  if (/^coord/.test(t)) return 'coordenador';
  if (/^apoio/.test(t)) return 'apoio';
  return 'atendente';
}

function normSistemas_(v) {
  const t = String(v || '').trim().toLowerCase();
  if (!t || t === 'todos') return ['todos'];
  const semAcento = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const marcados = semAcento.split(/[,;\s]+/);
  return SISTEMAS.filter(s => marcados.indexOf(s) >= 0); // sempre na ordem do menu
}

function listaUsuarios_() {
  const cache = CacheService.getScriptCache();
  const c = cache.get('usuarios');
  if (c) { try { return JSON.parse(c); } catch (e) { /* recarrega */ } }
  const sh = abaUsuarios_();
  const n = Math.max(sh.getLastRow() - 1, 0);
  const lista = [];
  if (n) {
    sh.getRange(2, 1, n, COLS_USUARIOS.length).getValues().forEach(function (r, i) {
      const nome = String(r[0] || '').trim(), email = normEmail_(r[1]);
      if (!nome || !email) return;
      lista.push({
        nome: nome, email: email,
        perfil: normPerfil_(r[2]),
        sistemas: normSistemas_(r[3]),
        ativo: !/^(n|0|f)/i.test(String(r[4] || 'sim').trim()),
        ultimo: r[5] instanceof Date ? r[5].getTime() : 0,
        provisoria: !!String(r[6] || '').trim(),
        sal: String(r[7] || ''), hash: String(r[8] || ''),
        trocar: /^(s|1|v)/i.test(String(r[9] || '').trim()),
        linha: i + 2,
      });
    });
  }
  cache.put('usuarios', JSON.stringify(lista), 60);
  return lista;
}

function limparCacheUsuarios_() { CacheService.getScriptCache().remove('usuarios'); }

function acharUsuario_(email) {
  email = normEmail_(email);
  return listaUsuarios_().filter(u => u.email === email)[0] || null;
}

function podeSistema_(eu, sis) {
  if (eu.perfil === 'admin') return true;
  return eu.sistemas.indexOf('todos') >= 0 || eu.sistemas.indexOf(sis) >= 0;
}

/** O que o navegador pode saber sobre quem está logado. */
function publico_(u) {
  const regra = PERFIS[u.perfil] || PERFIS.atendente;
  const sistemas = (u.perfil === 'admin' || u.sistemas.indexOf('todos') >= 0) ? SISTEMAS.slice() : u.sistemas.slice();
  return { nome: u.nome, email: u.email, perfil: u.perfil, sistemas: sistemas, gestao: regra.gestao, admin: regra.admin, bases: !!regra.bases };
}

/** Versão para a tela de usuários do administrador (sem sal e sem hash). */
function publicoAdmin_(u) {
  return { nome: u.nome, email: u.email, perfil: u.perfil, sistemas: u.sistemas, ativo: u.ativo,
    ultimo: u.ultimo, provisoria: u.provisoria, trocar: u.trocar, cadastrado: !!u.hash };
}

/* ── senha ── */

function hex_(bytes) {
  return bytes.map(b => ('0' + ((b < 0 ? b + 256 : b) & 255).toString(16)).slice(-2)).join('');
}
function hashSenha_(sal, senha) {
  let d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sal + ':' + senha, Utilities.Charset.UTF_8);
  for (let i = 0; i < RODADAS_HASH; i++) {
    d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, hex_(d) + sal + ':' + senha, Utilities.Charset.UTF_8);
  }
  return hex_(d);
}
function novoSal_() { return Utilities.getUuid().replace(/-/g, ''); }

function iguais_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function senhaFraca_(s, u) {
  if (s.length < 8) return 'Use pelo menos 8 caracteres.';
  if (s.length > 100) return 'Senha longa demais.';
  if (!/[A-Za-z]/.test(s) || !/[0-9]/.test(s)) return 'Misture letras e números.';
  const parte = String(u.email || '').split('@')[0];
  if (parte && s.toLowerCase().indexOf(parte.toLowerCase()) >= 0) return 'Não use o seu e-mail dentro da senha.';
  return '';
}

/** Senha provisória legível: 3 letras + 4 números + 1 letra (sem letras confusas). */
function senhaProvisoria_() {
  const L = 'abcdefghjkmnpqrstuvwxyz', N = '23456789';
  const pick = s => s.charAt(Math.floor(Math.random() * s.length));
  return pick(L).toUpperCase() + pick(L) + pick(L) + pick(N) + pick(N) + pick(N) + pick(N) + pick(L);
}

/* ── passe assinado ── */

function segredo_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('segredo');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid(); props.setProperty('segredo', s); }
  return s;
}
function assinar_(texto) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(texto, segredo_())).replace(/=+$/, '');
}
function b64txt_(t) { return Utilities.base64EncodeWebSafe(t, Utilities.Charset.UTF_8).replace(/=+$/, ''); }
function txtb64_(b) {
  while (b.length % 4) b += '=';
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString('UTF-8');
}

/** Passe: e-mail | expira | início do hash. Trocar a senha invalida os passes antigos. */
function emitirPasse_(u) {
  const exp = Date.now() + SESSAO_HORAS * 3600000;
  const carga = b64txt_(u.email + '|' + exp + '|' + u.hash.slice(0, 10));
  return { token: carga + '.' + assinar_(carga), exp: exp };
}

function autenticar_(token, aceitaTrocar) {
  const t = String(token || '');
  const i = t.indexOf('.');
  if (i < 1) return { erro: 'auth' };
  const carga = t.slice(0, i), sig = t.slice(i + 1);
  if (!iguais_(assinar_(carga), sig)) return { erro: 'auth' };
  let partes;
  try { partes = txtb64_(carga).split('|'); } catch (e) { return { erro: 'auth' }; }
  if (partes.length !== 3) return { erro: 'auth' };
  if (Number(partes[1]) < Date.now()) return { erro: 'expirou' };
  const u = acharUsuario_(partes[0]);
  if (!u || !u.hash || u.hash.slice(0, 10) !== partes[2]) return { erro: 'auth' };
  if (!u.ativo) return { erro: 'inativo' };
  if (u.trocar && !aceitaTrocar) return { erro: 'trocar' };
  return u;
}

function entrar_(d) {
  const email = normEmail_(d.email), senha = String(d.senha || '');
  if (!email || !senha) return { ok: false, erro: 'credenciais' };
  const cache = CacheService.getScriptCache();
  const chaveErro = 'err:' + email;
  const erros = Number(cache.get(chaveErro) || 0);
  if (erros >= MAX_ERROS) return { ok: false, erro: 'bloqueado' };
  if (!listaUsuarios_().length) return { ok: false, erro: 'sem_acessos' };
  const u = acharUsuario_(email);
  // calcula o hash sempre, para não revelar pelo tempo se o e-mail existe
  const calc = hashSenha_(u && u.sal ? u.sal : 'sem-sal', senha);
  if (!(u && u.hash && iguais_(calc, u.hash))) {
    cache.put(chaveErro, String(erros + 1), BLOQUEIO_MIN * 60);
    Utilities.sleep(600);
    return { ok: false, erro: 'credenciais', restam: Math.max(MAX_ERROS - erros - 1, 0) };
  }
  if (!u.ativo) return { ok: false, erro: 'inativo' };
  cache.remove(chaveErro);
  registrarAcesso_(u);
  const passe = emitirPasse_(u);
  return { ok: true, token: passe.token, exp: passe.exp, trocar: u.trocar, me: publico_(u) };
}

function trocarSenha_(eu, d) {
  const atual = String(d.atual || ''), nova = String(d.nova || '');
  const cache = CacheService.getScriptCache();
  const chaveErro = 'err:' + eu.email;
  const erros = Number(cache.get(chaveErro) || 0);
  if (erros >= MAX_ERROS) return { ok: false, erro: 'bloqueado' };
  if (!iguais_(hashSenha_(eu.sal || 'sem-sal', atual), eu.hash)) {
    cache.put(chaveErro, String(erros + 1), BLOQUEIO_MIN * 60);
    Utilities.sleep(600);
    return { ok: false, erro: 'senha_atual' };
  }
  const motivo = senhaFraca_(nova, eu);
  if (motivo) return { ok: false, erro: 'senha_fraca', detalhe: motivo };
  if (nova === atual) return { ok: false, erro: 'senha_fraca', detalhe: 'A nova senha precisa ser diferente da atual.' };
  const lock = bloqueio_(20000);
  try {
    const sal = novoSal_(), hash = hashSenha_(sal, nova);
    const sh = abaUsuarios_();
    sh.getRange(eu.linha, 7, 1, 4).setValues([['', sal, hash, 'não']]);
    limparCacheUsuarios_(); cache.remove(chaveErro);
    const passe = emitirPasse_(Object.assign({}, eu, { sal: sal, hash: hash, trocar: false }));
    return { ok: true, token: passe.token, exp: passe.exp };
  } finally { lock.releaseLock(); }
}

function registrarAcesso_(u) {
  try {
    const cache = CacheService.getScriptCache();
    const marca = 'acc:' + u.email;
    if (cache.get(marca)) return;
    cache.put(marca, '1', 1800);
    abaUsuarios_().getRange(u.linha, 6).setValue(new Date());
    log_('ACESSO', u.nome, u.email);
  } catch (e) { /* não é crítico */ }
}

/* ── gestão de usuários (só admin) ── */

/** Grava uma senha provisória na linha e obriga a troca no próximo acesso. */
function gravarProvisoria_(sh, linha) {
  const prov = senhaProvisoria_();
  const sal = novoSal_();
  sh.getRange(linha, 7, 1, 4).setValues([[prov, sal, hashSenha_(sal, prov), 'sim']]);
  return prov;
}

function usuarioSalvar_(d, eu) {
  const u = d.usuario || {};
  const email = normEmail_(u.email), nome = String(u.nome || '').trim();
  if (!email || !nome) return { ok: false, erro: 'Informe nome e e-mail.' };
  const perfil = normPerfil_(u.perfil);
  const sistemas = Array.isArray(u.sistemas) ? u.sistemas.join(',') : String(u.sistemas || 'todos');
  const ativo = u.ativo === false ? 'não' : 'sim';
  if (email === eu.email && (ativo === 'não' || perfil !== 'admin')) {
    return { ok: false, erro: 'Você não pode tirar o seu próprio acesso de administrador.' };
  }
  const lock = bloqueio_(20000);
  try {
    const sh = abaUsuarios_();
    const existente = acharUsuario_(email);
    let prov = '';
    if (existente) {
      sh.getRange(existente.linha, 1, 1, 5).setValues([[nome, email, perfil, sistemas, ativo]]);
    } else {
      const linha = sh.getLastRow() + 1;
      sh.getRange(linha, 1, 1, 5).setValues([[nome, email, perfil, sistemas, ativo]]);
      prov = gravarProvisoria_(sh, linha);
    }
    limparCacheUsuarios_();
    log_('USUARIO', eu.nome, (existente ? 'alterou ' : 'criou ') + email);
    return { ok: true, provisoria: prov };
  } finally { lock.releaseLock(); }
}

function usuarioNovaProvisoria_(d, eu) {
  const alvo = acharUsuario_(d.email);
  if (!alvo) return { ok: false, erro: 'Usuário não encontrado.' };
  const lock = bloqueio_(20000);
  try {
    const prov = gravarProvisoria_(abaUsuarios_(), alvo.linha);
    limparCacheUsuarios_();
    CacheService.getScriptCache().remove('err:' + alvo.email);
    log_('USUARIO', eu.nome, 'nova senha provisória para ' + alvo.email);
    return { ok: true, provisoria: prov };
  } finally { lock.releaseLock(); }
}

/* ── rodar pelo editor ou pelo menu da planilha ── */

function configurar() {
  abaUsuarios_();
  abaLog_();
  segredo_();
  Logger.log('Pronto. Preencha a aba "usuarios" e use o menu Jornada do Aluno > Gerar senhas provisórias.');
}

/** Gera senha provisória para quem ainda não tem senha cadastrada. */
function gerarSenhas() {
  const sh = abaUsuarios_();
  limparCacheUsuarios_();
  let n = 0;
  listaUsuarios_().forEach(u => { if (!u.hash) { gravarProvisoria_(sh, u.linha); n++; } });
  limparCacheUsuarios_();
  try { SpreadsheetApp.getUi().alert(n + ' senha(s) provisória(s) gerada(s) na coluna G.'); } catch (e) { Logger.log(n + ' senhas geradas'); }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('Jornada do Aluno')
      .addItem('Gerar senhas provisórias', 'gerarSenhas')
      .addToUi();
  } catch (e) { /* aberto fora da planilha */ }
}
