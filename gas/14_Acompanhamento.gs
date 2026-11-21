/**
 * MOTOR DE ACOMPANHAMENTO (Provas, Estágio, Financeiro, Financiamentos)
 * Cada sistema registra acionamentos, follow-ups e uma ficha por aluno, separados por sistema.
 * Os alunos vêm da base do Engajamento (Ímpar, Par, Técnico), sem upload separado.
 *
 * Planilha: PLANILHAS.<sistema> (vazio = planilha Central). Abas criadas sozinhas:
 *   acomp_<sistema>: id | matricula | base | aluno | atendente | canal | resultado | obs |
 *                    fu_data | fu_status | criado | atualizado | quem_atualizou
 *   ficha_<sistema>: matricula | dados (json) | atualizado | quem
 */

const CAB_ACOMP = ['id', 'matricula', 'base', 'aluno', 'atendente', 'canal', 'resultado', 'obs',
  'fu_data', 'fu_status', 'criado', 'atualizado', 'quem_atualizou'];
const CAB_FICHA = ['matricula', 'dados', 'atualizado', 'quem'];
const BASES_ENGAJAMENTO = ['impar', 'par', 'ct'];

/* Ações do EngajaVR que a "tela original" de cada sistema pode usar */
const ACOES_ORIGINAIS = {
  comuns:     ['carregarBase', 'getBaseTipo', 'getHistory', 'getAtendentes', 'getContacts', 'ping'],
  provas:     ['loadPoloData', 'savePoloData'],
  estagio:    ['getTCEData', 'saveTCEData'],
  financeiro: ['saveAction', 'saveActionLote', 'sendEmail', 'sendEmailLote'],
  financiamentos: [],
};

function abaAcomp_(sis, tipo) {
  const ss = planilhaDo_(sis);
  const nome = tipo + '_' + sis;
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    const cab = tipo === 'acomp' ? CAB_ACOMP : CAB_FICHA;
    sh = ss.insertSheet(nome);
    sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:B').setNumberFormat('@'); // id e matrícula como texto
    if (tipo === 'acomp') sh.getRange('I:I').setNumberFormat('@'); // data do follow-up como texto (aaaa-mm-dd)
  }
  return sh;
}

function linhasDe_(sh, ncol) {
  const n = Math.max(sh.getLastRow() - 1, 0);
  return n ? sh.getRange(2, 1, n, ncol).getValues() : [];
}

function regDeLinha_(l) {
  const o = {};
  // a planilha transforma "2026-11-22" em data: o follow-up volta para aaaa-mm-dd, o resto vira milissegundos
  CAB_ACOMP.forEach((c, i) => {
    const v = l[i];
    if (v instanceof Date) o[c] = c === 'fu_data' ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : v.getTime();
    else o[c] = v;
  });
  o.fu_data = o.fu_data ? String(o.fu_data).slice(0, 10) : '';
  o.id = String(o.id); o.matricula = String(o.matricula);
  o.criado = Number(o.criado) || 0; o.atualizado = Number(o.atualizado) || 0;
  return o;
}

function agoraUnico_() { return Date.now(); }

/** Lista registros e fichas (todos, ou só os alterados depois de "since"). */
function acompListar_(sis, d) {
  const since = Number(d.since) || 0;
  const regs = linhasDe_(abaAcomp_(sis, 'acomp'), CAB_ACOMP.length).map(regDeLinha_)
    .filter(r => r.id && (!since || r.atualizado > since));
  const fichas = {};
  linhasDe_(abaAcomp_(sis, 'ficha'), CAB_FICHA.length).forEach(l => {
    const at = Number(l[2]) || 0;
    if (!l[0] || (since && at <= since)) return;
    try { fichas[String(l[0])] = { dados: JSON.parse(l[1] || '{}'), atualizado: at, quem: l[3] }; } catch (e) { /* ignora */ }
  });
  return { ok: true, regs: regs, fichas: fichas, agora: Date.now() };
}

/** Novo acionamento (ou edição do follow-up de um existente). O atendente é sempre quem está logado. */
function acompRegistrar_(sis, d, eu) {
  const r = d.reg || {};
  const mat = String(r.matricula || '').trim();
  if (!mat) return { ok: false, erro: 'Matrícula ausente.' };
  if (!String(r.obs || '').trim()) return { ok: false, erro: 'Preencha a observação do atendimento.' };
  const base = BASES_ENGAJAMENTO.indexOf(r.base) >= 0 ? r.base : '';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = abaAcomp_(sis, 'acomp');
    const id = String(r.id || ('a' + Date.now() + Math.random().toString(36).slice(2, 7)));
    const linhas = linhasDe_(sh, 1);
    for (let i = 0; i < linhas.length; i++) {
      if (String(linhas[i][0]) === id) return { ok: true, id: id, repetido: true }; // mesmo envio duas vezes
    }
    const agora = agoraUnico_();
    sh.appendRow([id, mat, base, String(r.aluno || '').slice(0, 120), eu.nome, String(r.canal || '').slice(0, 40),
      String(r.resultado || '').slice(0, 80), String(r.obs).slice(0, 2000), String(r.fu_data || ''),
      r.fu_data ? 'pendente' : '', agora, agora, eu.nome]);
    return { ok: true, id: id, atualizado: agora };
  } finally { lock.releaseLock(); }
}

/** Conclui (ou reabre) o follow-up de um acionamento. */
function acompFollowup_(sis, d, eu) {
  const id = String(d.id || '');
  const status = d.status === 'pendente' ? 'pendente' : 'feito';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = abaAcomp_(sis, 'acomp');
    const linhas = linhasDe_(sh, 1);
    for (let i = 0; i < linhas.length; i++) {
      if (String(linhas[i][0]) === id) {
        const agora = agoraUnico_();
        sh.getRange(i + 2, 10).setValue(status);
        sh.getRange(i + 2, 12, 1, 2).setValues([[agora, eu.nome]]);
        return { ok: true, atualizado: agora };
      }
    }
    return { ok: false, erro: 'Acionamento não encontrado.' };
  } finally { lock.releaseLock(); }
}

/** Ficha do aluno no sistema (campos próprios, ex.: termos do ProUni/FIES). Mescla campo a campo. */
function acompFicha_(sis, d, eu) {
  const mat = String(d.matricula || '').trim();
  const novos = d.dados || {};
  if (!mat) return { ok: false, erro: 'Matrícula ausente.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = abaAcomp_(sis, 'ficha');
    const linhas = linhasDe_(sh, 2);
    const agora = agoraUnico_();
    for (let i = 0; i < linhas.length; i++) {
      if (String(linhas[i][0]) === mat) {
        let atual = {};
        try { atual = JSON.parse(linhas[i][1] || '{}'); } catch (e) { atual = {}; }
        const dados = Object.assign(atual, novos);
        sh.getRange(i + 2, 2, 1, 3).setValues([[JSON.stringify(dados), agora, eu.nome]]);
        return { ok: true, dados: dados, atualizado: agora };
      }
    }
    sh.appendRow([mat, JSON.stringify(novos), agora, eu.nome]);
    return { ok: true, dados: novos, atualizado: agora };
  } finally { lock.releaseLock(); }
}

/** Fábrica dos módulos: mesma lógica para todos, com as ações originais de cada um. */
function moduloAcompanhamento_(sis) {
  const E = Engajamento_();
  const acoes = {
    listar:       (d) => acompListar_(sis, d),
    registrar:    (d, eu) => acompRegistrar_(sis, d, eu),
    followup:     (d, eu) => acompFollowup_(sis, d, eu),
    ficha:        (d, eu) => acompFicha_(sis, d, eu),
  };
  ACOES_ORIGINAIS.comuns.concat(ACOES_ORIGINAIS[sis] || []).forEach(nome => {
    acoes[nome] = (d) => {
      if ('base' in d && BASES_ENGAJAMENTO.indexOf(d.base) < 0) return { ok: false, erro: 'Base desconhecida.' };
      return E.acoes[nome](d);
    };
  });
  return { acoes: acoes, gestao: [], admin: [] };
}

function Modulo_provas()         { return moduloAcompanhamento_('provas'); }
function Modulo_estagio()        { return moduloAcompanhamento_('estagio'); }
function Modulo_financeiro()     { return moduloAcompanhamento_('financeiro'); }
function Modulo_financiamentos() { return moduloAcompanhamento_('financiamentos'); }
