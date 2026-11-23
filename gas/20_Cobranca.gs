/**
 * COBRANÇA (sistema Financeiro melhorado)
 * Os inadimplentes vêm da base líquida do Engajamento (Ímpar, Par e Técnico).
 *
 * Carteira (CobCarteira_<base>): a cada base nova importada, compara a dívida de cada aluno
 * com a da base anterior e registra o que mudou:
 *   quitou  = deixou de estar inadimplente (acertou o valor)
 *   parcial = continua inadimplente, mas a dívida diminuiu (pagou uma parte)
 *   aumentou, entrou (passou a dever), saiu (não veio mais na base)
 * É daí que sai a evolução: quantos acertaram, quanto foi pago em parte e se as promessas foram cumpridas.
 *
 * Promessas e acordos (CobAcordos_<base>): a equipe registra; cada um vira também um acionamento
 * do Financeiro (acomp_financeiro), então conta na produtividade e no histórico do aluno.
 */

const COB_RESULTADOS = ['Prometeu pagar', 'Acordo fechado', 'Pagou', 'Quer negociar', 'Encaminhado ao ADM.FIN', 'Sem retorno', 'Número errado', 'Outro'];

function cobHoje_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function cobSim_(v) { return ['1', 's', 'sim', 'true', 'yes', 'inadimplente'].indexOf(String(v == null ? '' : v).trim().toLowerCase()) >= 0; }
function cobValor_(r) { return Math.round(evNumero_(r.VAL_DIVIDA || r.VLR_DIVIDA || r.VALOR_DIVIDA || r.DIVIDA) * 100) / 100; }
function cobInadimplente_(r) { return cobSim_(r.INADIMPLENTE) && cobValor_(r) > 0; }
function cobLerJson_(chave, padrao) {
  let raw = '';
  try { raw = Engajamento_().storeGet(chave) || ''; } catch (e) { raw = ''; }
  try { return raw ? JSON.parse(raw) : padrao; } catch (e) { return padrao; }
}
function cobBaseOk_(b) { return BASES_ENGAJAMENTO.indexOf(b) >= 0; }

/** Atualiza a carteira quando chega uma base nova. Na primeira vez, só fotografa (não conta como evolução). */
function cobProcessar_(base, linhasLidas) {
  const E = Engajamento_();
  const tsBase = String(E.storeGet('crm_base_' + base + '_ts') || '');
  let cart = cobLerJson_('CobCarteira_' + base, null);
  if (cart && cart.baseTs === tsBase) return cart;
  const lock = bloqueio_(30000);
  try {
    cart = cobLerJson_('CobCarteira_' + base, null);
    if (cart && cart.baseTs === tsBase) return cart;
    const linhas = linhasLidas || evLerBase_(base);
    const dataBase = tsBase ? Utilities.formatDate(new Date(Number(tsBase)), Session.getScriptTimeZone(), 'yyyy-MM-dd') : cobHoje_();
    const primeira = !cart;
    if (!cart) cart = { inicio: dataBase, alunos: {}, eventos: [] };
    const A = cart.alunos, ev = cart.eventos, visto = {};
    const evento = (mat, tipo, valor, a) => ev.push({ m: mat, t: tipo, v: Math.round(valor * 100) / 100, d: dataBase, n: a.n });
    linhas.forEach(r => {
      const mat = normMatEv_(r && (r.COD_MATRICULA || r.MATRICULA));
      if (!mat) return;
      visto[mat] = true;
      const v = cobValor_(r), inad = cobInadimplente_(r);
      let a = A[mat];
      if (inad) {
        if (!a || a.st !== 'aberto') {
          if (a && !primeira) evento(mat, a.st === 'quitado' ? 'voltou' : 'entrou', v, a);
          else if (!a && !primeira) evento(mat, 'entrou', v, { n: String(r.NOM_ALUNO || '') });
          A[mat] = a = { n: String(r.NOM_ALUNO || '').slice(0, 80), ini: v, dIni: dataBase, v: v, dV: dataBase, max: v, st: 'aberto', dSt: dataBase, pago: 0 };
        } else {
          if (v < a.v - 0.5) { evento(mat, 'parcial', a.v - v, a); a.pago = Math.round(((a.pago || 0) + a.v - v) * 100) / 100; }
          else if (v > a.v + 0.5) evento(mat, 'aumentou', v - a.v, a);
          if (v !== a.v) { a.v = v; a.dV = dataBase; }
          a.max = Math.max(a.max || 0, v);
        }
      } else if (a && a.st === 'aberto') {
        evento(mat, 'quitou', a.v, a);
        a.pago = Math.round(((a.pago || 0) + a.v) * 100) / 100;
        a.st = 'quitado'; a.dSt = dataBase; a.vQuit = a.v; a.v = 0; a.dV = dataBase;
      }
    });
    Object.keys(A).forEach(mat => {
      const a = A[mat];
      if (!visto[mat] && a.st === 'aberto') { evento(mat, 'saiu', a.v, a); a.st = 'fora'; a.dSt = dataBase; }
    });
    // guarda um ano de histórico
    const corte = Utilities.formatDate(new Date(Date.now() - 400 * 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    Object.keys(A).forEach(mat => { if (A[mat].st !== 'aberto' && A[mat].dSt < corte) delete A[mat]; });
    cart.eventos = ev.filter(e => e.d >= corte).slice(-12000);
    cart.baseTs = tsBase; cart.dataBase = dataBase; cart.processado = Date.now();
    E.storeSet('CobCarteira_' + base, JSON.stringify(cart));
    return cart;
  } finally { lock.releaseLock(); }
}

/** Situação de uma promessa, olhando a dívida de quando foi feita e a de agora. */
function cobAvaliarPromessa_(p, a, hoje) {
  if (p.status === 'cancelada') return 'cancelada';
  if (!a) return 'sem informação';
  if (a.st === 'quitado' && a.dSt >= p.dia) return 'cumprida';
  if (a.st === 'fora') return 'sem informação';
  const pago = Math.max(0, (Number(p.dividaNaHora) || 0) - (Number(a.v) || 0));
  if (pago >= (Number(p.valor) || 0) * 0.9 && pago > 0) return 'cumprida';
  const limite = Utilities.formatDate(new Date(new Date(p.data + 'T12:00:00').getTime() + 3 * 864e5), 'UTC', 'yyyy-MM-dd'); // 3 dias para a baixa chegar na base
  if (hoje <= limite) return pago > 0 ? 'parcial' : 'no prazo';
  return pago > 0 ? 'parcial' : 'quebrada';
}

/** Matrículas dos alunos ativos no sistema Formandos (sem os apagados e os que já colaram grau). */
function cobFormandos_() {
  const mapa = {};
  try {
    const sh = Formandos_().aba_('students');
    const n = Math.max(sh.getLastRow() - 1, 0);
    if (!n) return mapa;
    sh.getRange(2, 1, n, 4).getValues().forEach(l => {
      if (l[3]) return; // apagado
      let o = {};
      try { o = JSON.parse(l[1] || '{}') || {}; } catch (e) { o = {}; }
      if (o.arq) return; // já colou grau
      const mat = normMatEv_(o.mat || l[0]);
      if (mat) mapa[mat] = true;
    });
  } catch (e) { /* sem Formandos, sem tag */ }
  return mapa;
}

function cobDados_(d) {
  const base = cobBaseOk_(d.base) ? d.base : 'impar';
  const linhas = evLerBase_(base);
  const cart = cobProcessar_(base, linhas);
  const A = cart.alunos || {};
  const formandos = cobFormandos_();
  const lista = [];
  linhas.forEach(r => {
    if (!cobInadimplente_(r)) return;
    const mat = normMatEv_(r.COD_MATRICULA || r.MATRICULA);
    if (!mat) return;
    const a = A[mat] || {};
    lista.push({
      mat: mat, nome: String(r.NOM_ALUNO || ''), curso: String(r.NOM_CURSO || ''),
      cel: String(r.NUM_TELEF_CELULAR || r.CELULAR || ''), tel: String(r.NUM_TELEFONE || ''), email: String(r.END_EMAIL || r.EMAIL || ''),
      valor: cobValor_(r), faixa: String(r.FAIXA_DIVIDA || ''), tipo: String(r.TIPO_INADIMPLENCIA || ''),
      diaVenc: String(r.NUM_DIA_VENCTO || '').replace(/\.0$/, ''), promBase: String(r.VENCIMENTO_PROMESSA || ''),
      propensao: String(r.PROPENSAO_EVASAO || ''), situacao: String(r.NOM_SITUACAO_ALUNO || ''),
      entrada: a.dIni || cart.inicio, inicial: a.ini || cobValor_(r), pago: a.pago || 0,
      formando: !!formandos[mat],
    });
  });
  const reg = cobLerJson_('CobAcordos_' + base, { promessas: [], acordos: [] });
  const hoje = cobHoje_();
  (reg.promessas || []).forEach(p => { p.situacao = cobAvaliarPromessa_(p, A[p.mat], hoje); });
  (reg.acordos || []).forEach(ac => {
    const a = A[ac.mat];
    if (ac.status === 'ativo' && a && a.st === 'quitado' && a.dSt >= ac.dia) ac.quitou = true;
    ac.atrasada = ac.status === 'ativo' && (ac.parcelas || []).some(x => !x.paga && x.venc < hoje);
  });
  // quem acertou nos últimos 120 dias (para o painel e para conferir os acordos)
  const corte = Utilities.formatDate(new Date(Date.now() - 120 * 864e5), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return {
    ok: true, base: base, periodo: NOME_PERIODO_EVASAO[base], dataBase: cart.dataBase, inicio: cart.inicio,
    alunos: lista, eventos: (cart.eventos || []).filter(e => e.d >= corte), promessas: reg.promessas || [], acordos: reg.acordos || [],
    resultados: COB_RESULTADOS,
  };
}

function cobRegistro_(base, fn) {
  const lock = bloqueio_(20000);
  try {
    const reg = cobLerJson_('CobAcordos_' + base, { promessas: [], acordos: [] });
    reg.promessas = reg.promessas || []; reg.acordos = reg.acordos || [];
    const r = fn(reg);
    if (r && r.ok) Engajamento_().storeSet('CobAcordos_' + base, JSON.stringify(reg));
    return r;
  } finally { lock.releaseLock(); }
}

function cobDividaAtual_(base, mat) {
  const a = (cobLerJson_('CobCarteira_' + base, { alunos: {} }).alunos || {})[mat];
  return a && a.st === 'aberto' ? a.v : 0;
}

function cobDataOk_(t) { return /^\d{4}-\d{2}-\d{2}$/.test(String(t || '')); }
function cobMoeda_(v) { return 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

function cobPromessa_(d, eu) {
  const base = cobBaseOk_(d.base) ? d.base : '';
  const p = d.promessa || {};
  const mat = normMatEv_(p.mat);
  if (!base || !mat) return { ok: false, erro: 'Aluno ou período não informado.' };
  if (!cobDataOk_(p.data) || p.data < cobHoje_()) return { ok: false, erro: 'Informe a data prometida (hoje ou depois).' };
  const valor = Math.round(evNumero_(p.valor) * 100) / 100;
  if (!(valor > 0)) return { ok: false, erro: 'Informe o valor prometido.' };
  const obs = String(p.obs || '').trim();
  const divida = cobDividaAtual_(base, mat);
  const r = cobRegistro_(base, reg => {
    // uma promessa em aberto por aluno: a nova substitui a anterior que ainda estava no prazo
    reg.promessas.forEach(x => { if (x.mat === mat && x.status === 'ativa') x.status = 'substituida'; });
    const nova = { id: 'p' + Date.now(), mat: mat, nome: String(p.nome || '').slice(0, 120), data: p.data, valor: valor, dividaNaHora: divida,
      dia: cobHoje_(), criado: Date.now(), quem: eu.nome, obs: obs.slice(0, 500), status: 'ativa' };
    reg.promessas.push(nova);
    reg.promessas = reg.promessas.slice(-3000);
    return { ok: true, promessa: nova };
  });
  if (r.ok) acompRegistrar_('financeiro', { reg: { matricula: mat, base: base, aluno: p.nome, canal: p.canal || 'WhatsApp', resultado: 'Prometeu pagar',
    obs: 'Promessa: ' + cobMoeda_(valor) + ' até ' + p.data.split('-').reverse().join('/') + (obs ? '. ' + obs : ''), fu_data: p.data } }, eu);
  return r;
}

function cobAcordo_(d, eu) {
  const base = cobBaseOk_(d.base) ? d.base : '';
  const a = d.acordo || {};
  const mat = normMatEv_(a.mat);
  if (!base || !mat) return { ok: false, erro: 'Aluno ou período não informado.' };
  const total = Math.round(evNumero_(a.total) * 100) / 100;
  const entrada = Math.round(evNumero_(a.entrada) * 100) / 100;
  const n = Math.max(0, Math.min(36, parseInt(a.parcelas, 10) || 0));
  if (!(total > 0)) return { ok: false, erro: 'Informe o valor total do acordo.' };
  if (entrada > total) return { ok: false, erro: 'A entrada não pode ser maior que o total.' };
  if (!entrada && !n) return { ok: false, erro: 'Informe a entrada ou o número de parcelas.' };
  if (entrada && !cobDataOk_(a.entradaVenc)) return { ok: false, erro: 'Informe o vencimento da entrada.' };
  if (n && !cobDataOk_(a.primeiroVenc)) return { ok: false, erro: 'Informe o vencimento da primeira parcela.' };
  const parcelas = [];
  if (entrada) parcelas.push({ n: 0, rotulo: 'Entrada', valor: entrada, venc: a.entradaVenc, paga: false });
  if (n) {
    const resto = Math.round((total - entrada) * 100) / 100, cada = Math.floor(resto / n * 100) / 100;
    const [y, m, dd] = a.primeiroVenc.split('-').map(Number);
    for (let i = 0; i < n; i++) {
      const dt = new Date(y, m - 1 + i, 1);
      const ult = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
      const venc = Utilities.formatDate(new Date(dt.getFullYear(), dt.getMonth(), Math.min(dd, ult)), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const valor = i === n - 1 ? Math.round((resto - cada * (n - 1)) * 100) / 100 : cada;
      parcelas.push({ n: i + 1, rotulo: 'Parcela ' + (i + 1) + '/' + n, valor: valor, venc: venc, paga: false });
    }
  }
  const obs = String(a.obs || '').trim();
  const divida = cobDividaAtual_(base, mat);
  const r = cobRegistro_(base, reg => {
    const novo = { id: 'c' + Date.now(), mat: mat, nome: String(a.nome || '').slice(0, 120), total: total, entrada: entrada, nParcelas: n,
      parcelas: parcelas, dividaNaHora: divida, dia: cobHoje_(), criado: Date.now(), quem: eu.nome, obs: obs.slice(0, 500), status: 'ativo' };
    reg.promessas.forEach(x => { if (x.mat === mat && x.status === 'ativa') x.status = 'substituida'; }); // o acordo vale no lugar da promessa
    reg.acordos.push(novo);
    reg.acordos = reg.acordos.slice(-3000);
    return { ok: true, acordo: novo };
  });
  if (r.ok) acompRegistrar_('financeiro', { reg: { matricula: mat, base: base, aluno: a.nome, canal: a.canal || 'WhatsApp', resultado: 'Acordo fechado',
    obs: 'Acordo de ' + cobMoeda_(total) + (entrada ? ', entrada ' + cobMoeda_(entrada) : '') + (n ? ', ' + n + 'x' : '') + (obs ? '. ' + obs : ''), fu_data: parcelas[0].venc } }, eu);
  return r;
}

/** Marca parcela paga, encerra o acordo (cumprido ou quebrado) ou cancela a promessa. */
function cobAtualizar_(d, eu) {
  const base = cobBaseOk_(d.base) ? d.base : '';
  if (!base || !d.id) return { ok: false, erro: 'Registro não informado.' };
  return cobRegistro_(base, reg => {
    if (String(d.id).charAt(0) === 'p') {
      const p = reg.promessas.filter(x => x.id === d.id)[0];
      if (!p) return { ok: false, erro: 'Promessa não encontrada.' };
      if (d.status !== 'cancelada') return { ok: false, erro: 'Ação inválida.' };
      p.status = 'cancelada'; p.quemAlterou = eu.nome; p.alterado = Date.now();
      return { ok: true, promessa: p };
    }
    const a = reg.acordos.filter(x => x.id === d.id)[0];
    if (!a) return { ok: false, erro: 'Acordo não encontrado.' };
    if (d.parcela != null) {
      const p = a.parcelas.filter(x => x.n === Number(d.parcela))[0];
      if (!p) return { ok: false, erro: 'Parcela não encontrada.' };
      p.paga = !!d.paga; p.quem = eu.nome; p.quando = Date.now();
      if (a.status === 'ativo' && a.parcelas.every(x => x.paga)) a.status = 'cumprido';
      else if (a.status === 'cumprido' && !a.parcelas.every(x => x.paga)) a.status = 'ativo';
    } else if (['cumprido', 'quebrado', 'ativo'].indexOf(d.status) >= 0) {
      a.status = d.status;
    } else return { ok: false, erro: 'Ação inválida.' };
    a.quemAlterou = eu.nome; a.alterado = Date.now();
    return { ok: true, acordo: a };
  });
}

function acoesCobranca_() {
  return {
    cobranca: (d) => cobDados_(d),
    promessa: (d, eu) => cobPromessa_(d, eu),
    acordo: (d, eu) => cobAcordo_(d, eu),
    cobranca_atualizar: (d, eu) => cobAtualizar_(d, eu),
  };
}
