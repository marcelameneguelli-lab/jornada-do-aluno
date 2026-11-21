/**
 * SISTEMA APOIO ÀS AVALIAÇÕES (NAAP / NAE)
 * Direcionamento para avaliações e uso da plataforma. De propósito, NÃO existe campo de
 * diagnóstico, condição ou categoria: o registro diz o que fazer, nunca o motivo.
 *
 * Quem tem o sistema "apoio" liberado (NAAP, NAE, coordenação) cadastra e revisa as orientações.
 * Todos os usuários logados podem LER as orientações ativas (ação apoio.orientacoes), para que
 * apareçam em Provas e nos demais sistemas na hora de atender o aluno.
 *
 * Aba (planilha PLANILHAS.apoio, vazio = Central): apoio_orientacoes: matricula | dados (json) | ativo | revisao | atualizado | quem
 */

const CAB_APOIO = ['matricula', 'dados', 'ativo', 'revisao', 'atualizado', 'quem'];
// campos aceitos (qualquer outro é descartado, para não virar lugar de diagnóstico)
const CAMPOS_APOIO = ['aluno', 'curso', 'avaliacao', 'tempo_adicional', 'plataforma', 'orientacoes', 'responsavel', 'contato'];

function abaApoio_() {
  const ss = planilhaDo_('apoio');
  let sh = ss.getSheetByName('apoio_orientacoes');
  if (!sh) {
    sh = ss.insertSheet('apoio_orientacoes');
    sh.getRange(1, 1, 1, CAB_APOIO.length).setValues([CAB_APOIO]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@');
    sh.getRange('D:D').setNumberFormat('@');
  }
  return sh;
}

function normMatApoio_(m) { return String(m == null ? '' : m).replace(/\.0$/, '').replace(/\D/g, ''); }

function apoioLer_(soAtivas) {
  const sh = abaApoio_();
  const n = Math.max(sh.getLastRow() - 1, 0);
  const lista = [];
  if (n) sh.getRange(2, 1, n, CAB_APOIO.length).getValues().forEach(l => {
    const ativo = String(l[2]) === 'sim';
    if (soAtivas && !ativo) return;
    let o = {};
    try { o = JSON.parse(l[1] || '{}'); } catch (e) { return; }
    o.matricula = normMatApoio_(l[0]); o.ativo = ativo; o.revisao = String(l[3] || '');
    o.atualizado = Number(l[4]) || 0; o.quem = String(l[5] || '');
    lista.push(o);
  });
  return lista;
}

/** Para toda a equipe: só as orientações ativas, sem responsável/contato interno do NAAP. */
function apoioOrientacoes_() {
  const dados = apoioLer_(true).map(o => ({
    matricula: o.matricula, aluno: o.aluno || '', avaliacao: o.avaliacao || [], tempo_adicional: o.tempo_adicional || '',
    plataforma: o.plataforma || [], orientacoes: o.orientacoes || '', revisao: o.revisao,
  }));
  return { ok: true, dados: dados };
}

function apoioSalvar_(d, eu) {
  const r = d.registro || {};
  const mat = normMatApoio_(r.matricula);
  if (mat.length < 6) return { ok: false, erro: 'Informe a matrícula do aluno.' };
  const o = {};
  CAMPOS_APOIO.forEach(c => { if (r[c] != null) o[c] = r[c]; });
  ['avaliacao', 'plataforma'].forEach(c => { o[c] = (Array.isArray(o[c]) ? o[c] : []).map(x => String(x).slice(0, 120)).slice(0, 30); });
  ['aluno', 'curso', 'tempo_adicional', 'responsavel', 'contato'].forEach(c => { o[c] = String(o[c] || '').slice(0, 200); });
  o.orientacoes = String(o.orientacoes || '').slice(0, 2000);
  if (!o.avaliacao.length && !o.plataforma.length && !o.orientacoes.trim()) return { ok: false, erro: 'Marque ao menos um recurso ou escreva uma orientação.' };
  const revisao = /^\d{4}-\d{2}-\d{2}$/.test(String(r.revisao || '')) ? String(r.revisao) : '';
  const ativo = r.ativo === false ? 'nao' : 'sim';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = abaApoio_();
    const n = Math.max(sh.getLastRow() - 1, 0);
    let linha = 0;
    if (n) sh.getRange(2, 1, n, 1).getValues().some((l, i) => { if (normMatApoio_(l[0]) === mat) { linha = i + 2; return true; } return false; });
    const valores = [mat, JSON.stringify(o), ativo, revisao, Date.now(), eu.nome];
    if (linha) sh.getRange(linha, 1, 1, CAB_APOIO.length).setValues([valores]);
    else sh.appendRow(valores);
    log_('APOIO', eu.nome, (linha ? 'atualizou' : 'cadastrou') + ' orientações da matrícula ' + mat + (ativo === 'nao' ? ' (encerrado)' : ''));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** Nome e curso do aluno pela matrícula, procurando nas bases líquidas (Ímpar, Par e Técnico). */
function apoioBuscarAluno_(d) {
  const mat = normMatApoio_(d.matricula);
  if (mat.length < 6) return { ok: false, erro: 'Matrícula incompleta.' };
  const E = Engajamento_();
  for (let i = 0; i < BASES_ENGAJAMENTO.length; i++) {
    const b = BASES_ENGAJAMENTO[i];
    let raw = '';
    try { raw = E.storeGet('crm_base_' + b) || ''; } catch (e) { raw = ''; }
    if (!raw || raw.indexOf(mat) < 0) continue; // evita montar a base quando a matrícula nem aparece
    let lista = [];
    try { lista = JSON.parse(raw); } catch (e) { continue; }
    if (!Array.isArray(lista)) lista = (lista && lista.dados) || [];
    const r = lista.filter(x => x && normMatApoio_(x.COD_MATRICULA || x.MATRICULA) === mat)[0];
    if (r) return { ok: true, aluno: String(r.NOM_ALUNO || ''), curso: String(r.NOM_CURSO || ''), base: b };
  }
  return { ok: true, aluno: '', curso: '', naoEncontrado: true };
}

function Modulo_apoio() {
  return {
    acoes: {
      listar: () => ({ ok: true, dados: apoioLer_(false) }),
      orientacoes: () => apoioOrientacoes_(),
      salvar: (d, eu) => apoioSalvar_(d, eu),
      buscar_aluno: (d) => apoioBuscarAluno_(d),
    },
    // leitura das orientações ativas vale para todos os logados (ver ACOES_TODOS_LOGADOS)
  };
}
