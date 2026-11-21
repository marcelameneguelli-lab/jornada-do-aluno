/**
 * SISTEMA EVASÃO
 * Duas frentes, sempre separadas por período (Ímpar, Par e Técnico):
 *
 *  1) Aluno matriculado: cancelados, trancados e intenções de saída da base líquida.
 *     Os registros ficam em EvasaoData_<base> (o mesmo armazenamento que a aba Evasão do
 *     EngajaVR usava, então nada se perde). Cancelados e trancados da base aparecem sozinhos,
 *     sem objeção, até alguém registrar o motivo.
 *
 *  2) Renovação: alunos com status Evadido ou Trancamento nos ciclos de renovação.
 *     Com o ciclo aberto (prazo não passou) dá para reverter o status. Com o ciclo encerrado,
 *     o aluno segue para a recaptura, feita por outro setor, e aqui só fica a consulta.
 *
 * Objeção: lista padrão da Renovação + "Outro", que exige descrever o motivo.
 */

const OBJECOES_EVASAO = [
  'Financeiro: não consegue pagar a mensalidade',
  'Financeiro: dívida / negociação não aceita',
  'Perda de bolsa, FIES ou ProUni',
  'Foi para outra instituição (concorrência)',
  'Trabalho / falta de tempo',
  'Saúde ou questões pessoais / familiares',
  'Mudança de cidade',
  'Insatisfação com o curso ou a metodologia',
  'Insatisfação com atendimento ou infraestrutura',
  'Não se identificou com o curso / vai trocar de curso',
  'Pausa temporária (pretende voltar)',
  'Sem contato / não respondeu',
  'Outro',
];
const SITUACOES_EVASAO = ['cancelado', 'trancado', 'intencao', 'revertido'];
const STATUS_EVASAO_RENOV = ['Evadido', 'Trancamento'];
const STATUS_REVERSAO_RENOV = ['Renovado', 'Em negociação', 'Pendente'];
const NOME_PERIODO_EVASAO = { impar: 'Ímpar', par: 'Par', ct: 'Técnico' };

function normMatEv_(m) { return String(m == null ? '' : m).replace(/\.0$/, '').replace(/\D/g, ''); }

function evLerRegistros_(base) {
  let raw = '';
  try { raw = Engajamento_().storeGet('EvasaoData_' + base) || ''; } catch (e) { raw = ''; }
  try { const l = JSON.parse(raw || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}

function evLerBase_(base) {
  let raw = '';
  try { raw = Engajamento_().storeGet('crm_base_' + base) || ''; } catch (e) { raw = ''; }
  if (!raw) return [];
  try { const l = JSON.parse(raw); return Array.isArray(l) ? l : ((l && l.dados) || []); } catch (e) { return []; }
}

function evNumero_(v) {
  const n = parseFloat(String(v == null ? '' : v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/** Registros do período + cancelados e trancados da base líquida que ainda não têm registro. */
function evMatriculados_(d) {
  const base = BASES_ENGAJAMENTO.indexOf(d.base) >= 0 ? d.base : 'impar';
  const lista = evLerRegistros_(base).filter(e => e && e.id);
  const ja = {};
  lista.forEach(e => { const m = normMatEv_(e.mat); if (m) ja[m] = true; });
  const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  let daBase = 0;
  evLerBase_(base).forEach(r => {
    const mat = normMatEv_(r && (r.COD_MATRICULA || r.MATRICULA));
    if (!mat || ja[mat]) return;
    const sit = String(r.NOM_SITUACAO_ALUNO || r.SITUACAO_ALUNO || '').toUpperCase();
    let s = '';
    if (/CANCELAD|CANCELAMENTO/.test(sit)) s = 'cancelado';
    else if (/TRANCAD|TRANCAMENTO/.test(sit)) s = 'trancado';
    if (!s) return;
    const div = evNumero_(r.DIVIDA || r.VLR_DIVIDA || r.VALOR_DIVIDA);
    lista.push({ id: 'ev_db_' + mat, mat: mat, nome: String(r.NOM_ALUNO || ''), curso: String(r.NOM_CURSO || ''), base: base, sit: s,
      obj: '', obs: '', atend: '', data: hoje, divida: div > 0 ? div.toFixed(2).replace('.', ',') : '', _importado: true, _ts: 0 });
    ja[mat] = true; daBase++;
  });
  return { ok: true, base: base, periodo: NOME_PERIODO_EVASAO[base], dados: lista, daBase: daBase };
}

function evSalvar_(d, eu) {
  const base = BASES_ENGAJAMENTO.indexOf(d.base) >= 0 ? d.base : '';
  if (!base) return { ok: false, erro: 'Escolha o período (Ímpar, Par ou Técnico).' };
  const r = d.registro || {};
  const mat = normMatEv_(r.mat);
  if (mat.length < 6) return { ok: false, erro: 'Informe a matrícula do aluno.' };
  if (SITUACOES_EVASAO.indexOf(r.sit) < 0) return { ok: false, erro: 'Situação inválida.' };
  let obj = String(r.obj || '').trim();
  const objOutro = String(r.obj_outro || '').trim().slice(0, 200);
  if (r.sit !== 'revertido' && !obj) return { ok: false, erro: 'Escolha a objeção (o motivo da saída).' };
  if (obj && OBJECOES_EVASAO.indexOf(obj) < 0 && obj !== 'Sem objeção registrada') return { ok: false, erro: 'Objeção fora da lista. Use "Outro" e descreva o motivo.' };
  if (obj === 'Outro' && !objOutro) return { ok: false, erro: 'Em "Outro", descreva o motivo.' };
  const reg = {
    id: String(r.id || ('ev_' + mat)).slice(0, 60), mat: mat,
    nome: String(r.nome || '').slice(0, 200), curso: String(r.curso || '').slice(0, 200), base: base, sit: r.sit,
    obj: obj, obj_outro: obj === 'Outro' ? objOutro : '', obs: String(r.obs || '').slice(0, 2000),
    atend: eu.nome, data: /^\d{4}-\d{2}-\d{2}$/.test(String(r.data || '')) ? String(r.data) : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    divida: String(r.divida || '').slice(0, 30), _ts: Date.now(),
  };
  const lock = bloqueio_(20000);
  try {
    const atual = evLerRegistros_(base);
    // uma linha por aluno: o registro novo substitui o anterior da mesma matrícula
    const antes = atual.filter(e => e && (e.id === reg.id || normMatEv_(e.mat) === mat))[0];
    if (antes && !r.id) reg.id = antes.id;
    if (antes && antes.sit !== reg.sit) reg.historico = (antes.historico || []).concat([{ sit: antes.sit, obj: antes.obj || '', quem: antes.atend || '', ts: antes._ts || 0 }]).slice(-20);
    else if (antes && antes.historico) reg.historico = antes.historico;
    const nova = atual.filter(e => e && e.id !== reg.id && normMatEv_(e.mat) !== mat).concat([reg]);
    Engajamento_().storeSet('EvasaoData_' + base, JSON.stringify(nova));
    log_('EVASAO', eu.nome, 'matrícula ' + mat + ' · ' + reg.sit + (obj ? ' · ' + obj : '') + ' (' + NOME_PERIODO_EVASAO[base] + ')');
    return { ok: true, registro: reg };
  } finally { lock.releaseLock(); }
}

function evExcluir_(d, eu) {
  const base = BASES_ENGAJAMENTO.indexOf(d.base) >= 0 ? d.base : '';
  if (!base || !d.id) return { ok: false, erro: 'Registro não informado.' };
  const lock = bloqueio_(20000);
  try {
    const atual = evLerRegistros_(base);
    const nova = atual.filter(e => e && e.id !== d.id);
    if (nova.length === atual.length) return { ok: false, erro: 'Registro não encontrado.' };
    Engajamento_().storeSet('EvasaoData_' + base, JSON.stringify(nova));
    log_('EVASAO', eu.nome, 'excluiu o registro ' + d.id + ' (' + NOME_PERIODO_EVASAO[base] + ')');
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* ---------------- Renovação ---------------- */

function evSessao_(eu) { return { email: eu.email, nome: eu.nome, perfil: eu.perfil, token: '', exp: 0 }; }

function evParidade_(ciclo) {
  const n = parseInt(String(ciclo).slice(-1), 10);
  return isNaN(n) ? '' : (n % 2 ? 'impar' : 'par');
}

function evPrazoData_(txt) {
  const p = String(txt || '').split('/');
  if (p.length !== 3) return null;
  const dt = new Date(+p[2], +p[1] - 1, +p[0], 23, 59, 59);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Ciclo aberto = prazo ainda não passou (ou não definido). Encerrado = segue para a recaptura. */
function evCiclosCfg_(eu) {
  let cfg = {};
  try { cfg = Renovacao_().processarAcao('config', { __sess: evSessao_(eu) }) || {}; } catch (e) { cfg = {}; }
  let cc = {};
  try { cc = JSON.parse(cfg.ciclo_cfg || '{}') || {}; } catch (e) { cc = {}; }
  return cc;
}

function evCicloAberto_(cc, ciclo) {
  const dt = evPrazoData_((cc[ciclo] || {}).prazo);
  if (!dt) return true;
  return Date.now() <= dt.getTime();
}

function evObjecao_(obs) {
  const m = String(obs || '').match(/\[Obje[çc][ãa]o:\s*([^|\]]+?)\s*(?:\|\s*([^\]]*))?\]/);
  return m ? { obj: m[1].trim(), detalhe: String(m[2] || '').trim() } : null;
}

function evDataAc_(a) {
  const ts = Number(a['_ts']) || 0;
  if (ts) return ts;
  const p = String(a['Data'] || '').split('/');
  return p.length === 3 ? new Date(+p[2], +p[1] - 1, +p[0]).getTime() : 0;
}

function evRenovacao_(d, eu) {
  const R = Renovacao_(), sess = evSessao_(eu);
  const ra = R.processarAcao('carregar_alunos', { __sess: sess });
  if (ra && ra.ok === false) return ra;
  const cc = evCiclosCfg_(eu);
  const paridade = d.paridade === 'par' || d.paridade === 'impar' ? d.paridade : '';
  const alunos = ((ra && ra.alunos) || []).filter(a => a && STATUS_EVASAO_RENOV.indexOf(String(a.status)) >= 0)
    .filter(a => !paridade || evParidade_(a.ciclo) === paridade);
  const quer = {};
  alunos.forEach(a => { quer[a.ciclo + '|' + a.id] = true; });
  // último acionamento de cada aluno no ciclo: de quem, quando e com que objeção
  const ult = {}, ultObj = {};
  if (alunos.length) {
    const rl = R.processarAcao('listar_acionamentos', { __sess: sess }) || {};
    (rl.acionamentos || []).forEach(a => {
      const ciclo = String(a['Ciclo'] || '');
      const k = ciclo + '|' + String(a['ID Aluno']);
      if (!quer[k]) return;
      const t = evDataAc_(a);
      if (!ult[k] || t >= ult[k].t) ult[k] = { t: t, colab: String(a['Colaborador'] || ''), data: String(a['Data'] || ''), tipo: String(a['Tipo'] || '') };
      const o = evObjecao_(a['Observações']);
      if (o && (!ultObj[k] || t >= ultObj[k].t)) ultObj[k] = Object.assign({ t: t }, o);
    });
  }
  const ciclos = {};
  alunos.forEach(a => {
    const c = String(a.ciclo || '');
    if (!ciclos[c]) {
      const prazo = (cc[c] || {}).prazo || '';
      ciclos[c] = { ciclo: c, paridade: evParidade_(c), prazo: prazo, aberto: evCicloAberto_(cc, c), alunos: [] };
    }
    const k = c + '|' + a.id, u = ult[k] || {}, o = ultObj[k] || {};
    ciclos[c].alunos.push({ id: String(a.id), matricula: String(a.matricula || a.id || ''), nome: String(a.nome || ''), curso: String(a.curso || ''),
      modalidade: String(a.modalidade || ''), status: String(a.status), obj: o.obj || '', detalhe: o.detalhe || '',
      colab: u.colab || '', data: u.data || '', tipo: u.tipo || '' });
  });
  const lista = Object.keys(ciclos).sort().reverse().map(c => ciclos[c]);
  return { ok: true, ciclos: lista };
}

function evReverter_(d, eu) {
  const ciclo = String(d.ciclo || '');
  if (!d.alunoId || !ciclo) return { ok: false, erro: 'Aluno ou ciclo não informado.' };
  if (STATUS_REVERSAO_RENOV.indexOf(d.status) < 0) return { ok: false, erro: 'Escolha o novo status (Renovado, Em negociação ou Pendente).' };
  const cc = evCiclosCfg_(eu);
  if (!evCicloAberto_(cc, ciclo)) return { ok: false, erro: 'O ciclo ' + ciclo + ' já encerrou. Este aluno segue para a recaptura, feita por outro setor.' };
  const obs = String(d.obs || '').trim().slice(0, 1500);
  if (!obs) return { ok: false, erro: 'Descreva como a evasão foi revertida.' };
  const r = Renovacao_().processarAcao('salvar_acionamento', { __sess: evSessao_(eu), acionamento: {
    id: 'rev_' + Date.now(), alunoId: String(d.alunoId), nomeAluno: String(d.nomeAluno || ''), colab: eu.nome,
    tipo: 'Reversão de evasão', obs: obs, stAl: d.status, ciclo: ciclo } });
  if (r && r.ok) log_('EVASAO', eu.nome, 'reverteu na Renovação o aluno ' + d.alunoId + ' (ciclo ' + ciclo + ') para ' + d.status);
  return r && r.ok ? { ok: true } : (r || { ok: false, erro: 'Não foi possível reverter.' });
}

function Modulo_evasao() {
  return {
    acoes: {
      config: () => ({ ok: true, objecoes: OBJECOES_EVASAO, situacoes: SITUACOES_EVASAO, reversao: STATUS_REVERSAO_RENOV, periodos: NOME_PERIODO_EVASAO }),
      matriculados: (d) => evMatriculados_(d),
      salvar: (d, eu) => evSalvar_(d, eu),
      excluir: (d, eu) => evExcluir_(d, eu),
      buscar_aluno: (d) => apoioBuscarAluno_(d),
      renovacao: (d, eu) => evRenovacao_(d, eu),
      reverter: (d, eu) => evReverter_(d, eu),
    },
    gestao: ['excluir'],
    admin: [],
  };
}
