/**
 * GESTÃO: Central de Bases e relatório diário único (todos os sistemas).
 *
 * Relatório: segunda a sexta às 20h e sábado às 13h, para EMAIL_RELATORIO (00_Config.gs).
 * Para ligar: menu Usuários e perfis > Relatório diário > Ativar envio automático
 * (ou rode "ativarRelatorioJornada" no editor). Substitui os relatórios separados do
 * RenovaVR e do EngajaVR, que não devem ser ativados neste projeto.
 */

/* ── Central de Bases ── */

function basesResumo_() {
  const r = { ok: true, renovacao: null, engajamento: {}, formandos: null, erros: [] };
  try {
    const rc = Renovacao_().processarAcao('listar_ciclos', { __sess: { nome: 'Jornada', perfil: 'admin' } });
    r.renovacao = { ciclos: rc.totaisCiclo || {} };
  } catch (e) { r.erros.push('Renovação: ' + e.message); }
  try {
    const E = Engajamento_();
    BASES_ENGAJAMENTO.forEach(b => {
      const chave = 'crm_base_' + b; // mesmas chaves do EngajaVR (BASE_KEYS)
      const info = E.acoes.getBaseTipo({ base: b }) || {};
      let total = 0;
      try {
        const raw = E.storeGet(chave) || '';
        total = (raw.match(/"COD_MATRICULA"/g) || []).length; // conta sem montar a base inteira
      } catch (e) { total = 0; }
      r.engajamento[b] = { total: total, ts: Number(info.ts) || 0 };
    });
  } catch (e) { r.erros.push('Engajamento: ' + e.message); }
  try {
    const sh = Formandos_().aba_('students');
    const n = Math.max(sh.getLastRow() - 1, 0);
    const del = n ? sh.getRange(2, 4, n, 1).getValues() : [];
    r.formandos = { total: del.filter(l => !l[0]).length };
  } catch (e) { r.erros.push('Formandos: ' + e.message); }
  try {
    const b = bolsaLer_(); const ps = Array.from(new Set(b.solicitacoes.map(s => s.periodo))).sort();
    r.bolsa = { total: b.solicitacoes.length, periodos: ps.length, ultimo: ps[ps.length - 1] || '' };
  } catch (e) { r.erros.push('Bolsa: ' + e.message); }
  try {
    const o = cobLerJson_('EstagioBI', null);
    r.estagio = o ? { total: (o.alunos || []).length, disciplinas: (o.alunos || []).reduce((t, a) => t + (a.disciplinas || []).length, 0), ultima: o.ts || 0, quem: o.quem || '' } : { total: 0 };
  } catch (e) { r.erros.push('Estágio: ' + e.message); }
  try {
    const sh = abaNps_();
    const n = Math.max(sh.getLastRow() - 1, 0);
    const datas = n ? sh.getRange(2, 3, n, 2).getValues() : [];
    r.nps = { total: n, ultima: datas.reduce((m, l) => Math.max(m, Number(l[1]) || 0), 0),
      // a planilha pode ter transformado a data em Date: volta para aaaa-mm-dd antes de comparar
      ate: datas.map(l => l[0] instanceof Date ? Utilities.formatDate(l[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(l[0] || '').slice(0, 10))
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).reduce((m, d) => (d > m ? d : m), '') };
  } catch (e) { r.erros.push('NPS: ' + e.message); }
  return r;
}

/* ── Relatório diário único ── */

function inicioDoDia_(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }

function somar_(mapa, sistema, quem) {
  quem = String(quem || 'Não identificado').trim() || 'Não identificado';
  mapa[quem] = mapa[quem] || {};
  mapa[quem][sistema] = (mapa[quem][sistema] || 0) + 1;
}

/** Junta o que cada sistema registrou entre "ini" e "fim" (ms). Cada fonte é independente. */
function coletarDia_(ini, fim) {
  const porAt = {}, erros = [], extras = {}, atrasados = {};
  const tz = Session.getScriptTimeZone();
  const hojeTxt = Utilities.formatDate(new Date(ini), tz, 'dd/MM/yyyy');

  // Renovação: aba Acionamentos (D = atendente, J = status do aluno, M = ts)
  try {
    const sh = planilhaDo_('renovacao').getSheetByName('Acionamentos');
    const n = sh ? Math.max(sh.getLastRow() - 1, 0) : 0;
    let renovados = 0;
    if (n) sh.getRange(2, 1, n, 13).getValues().forEach(l => {
      const ts = Number(l[12]) || 0;
      if (ts >= ini && ts < fim) { somar_(porAt, 'Renovação', l[3]); if (/renovad/i.test(String(l[9]))) renovados++; }
    });
    extras['Renovação'] = renovados ? renovados + ' marcado(s) como renovado(s)' : '';
  } catch (e) { erros.push('Renovação: ' + e.message); }

  // Engajamento: aba Acionamentos (A = datetime dd/MM/yyyy HH:mm:ss, C = atendente)
  try {
    const sh = planilhaDo_('engajamento').getSheetByName('Acionamentos');
    const n = sh ? Math.max(sh.getLastRow() - 1, 0) : 0;
    if (n) sh.getRange(2, 1, n, 3).getValues().forEach(l => {
      const dt = l[0] instanceof Date ? Utilities.formatDate(l[0], tz, 'dd/MM/yyyy') : String(l[0]).slice(0, 10);
      if (dt === hojeTxt) somar_(porAt, 'Engajamento', l[2]);
    });
  } catch (e) { erros.push('Engajamento: ' + e.message); }

  // Provas, Estágio, Financeiro, Financiamentos: motor de acompanhamento
  const hojeIso = Utilities.formatDate(new Date(ini), tz, 'yyyy-MM-dd');
  [['provas', 'Provas'], ['estagio', 'Estágio'], ['financeiro', 'Financeiro'], ['financiamentos', 'Financiamentos'], ['nps', 'NPS']].forEach(([sis, nome]) => {
    try {
      const sh = planilhaDo_(sis).getSheetByName('acomp_' + sis);
      const n = sh ? Math.max(sh.getLastRow() - 1, 0) : 0;
      let atr = 0;
      if (n) sh.getRange(2, 1, n, CAB_ACOMP.length).getValues().forEach(l => {
        const r = regDeLinha_(l);
        if (r.criado >= ini && r.criado < fim) somar_(porAt, nome, r.atendente);
        if (r.fu_status === 'pendente' && r.fu_data && String(r.fu_data) < hojeIso) atr++;
      });
      if (atr) atrasados[nome] = atr;
    } catch (e) { erros.push(nome + ': ' + e.message); }
  });

  // Formandos: coleção "activity" (json com ts e who)
  try {
    const sh = Formandos_().aba_('activity');
    const n = Math.max(sh.getLastRow() - 1, 0);
    if (n) sh.getRange(2, 1, n, 4).getValues().forEach(l => {
      if (l[3]) return;
      let a; try { a = JSON.parse(l[1]); } catch (e) { return; }
      if (a && a.ts >= ini && a.ts < fim) somar_(porAt, 'Formandos', a.who);
    });
  } catch (e) { erros.push('Formandos: ' + e.message); }

  // Quem acessou a Jornada no dia (log da planilha Central)
  const acessos = {};
  try {
    const sh = abaLog_();
    const n = Math.max(sh.getLastRow() - 1, 0);
    const ini2 = Math.max(n - 3000, 0); // só o fim do log
    if (n) sh.getRange(2 + ini2, 1, n - ini2, 3).getValues().forEach(l => {
      const t = l[0] instanceof Date ? l[0].getTime() : 0;
      if (l[1] === 'ACESSO' && t >= ini && t < fim) acessos[l[2]] = Math.min(acessos[l[2]] || t, t);
    });
  } catch (e) { erros.push('Acessos: ' + e.message); }

  return { porAt: porAt, extras: extras, atrasados: atrasados, acessos: acessos, erros: erros };
}

const ORDEM_SISTEMAS_RELATORIO = ['Renovação', 'Engajamento', 'Provas', 'Estágio', 'Financeiro', 'Financiamentos', 'NPS', 'Formandos'];

function montarRelatorio_(dia) {
  const ini = inicioDoDia_(dia || new Date()), fim = ini + 86400000;
  const d = coletarDia_(ini, fim);
  const tz = Session.getScriptTimeZone();
  const dataTxt = Utilities.formatDate(new Date(ini), tz, 'dd/MM/yyyy');
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const sistemas = ORDEM_SISTEMAS_RELATORIO.filter(s => Object.keys(d.porAt).some(p => d.porAt[p][s]));
  const pessoas = Object.keys(d.porAt).sort((a, b) => total_(d.porAt[b]) - total_(d.porAt[a]));
  function total_(o) { return Object.keys(o).reduce((s, k) => s + o[k], 0); }
  const totalGeral = pessoas.reduce((s, p) => s + total_(d.porAt[p]), 0);
  const th = 'style="background:#003B71;color:#fff;padding:6px 10px;text-align:left;font-size:13px"';
  const td = 'style="padding:6px 10px;border-bottom:1px solid #dde3ea;font-size:13px"';
  let html = `<div style="font-family:Segoe UI,Arial,sans-serif;color:#1d2733;max-width:820px">
    <h2 style="color:#003B71;margin:0 0 4px">Jornada do Aluno · Relatório do dia ${dataTxt}</h2>
    <p style="margin:0 0 16px;color:#5b6776">Secretaria Acadêmica VR · ${totalGeral} acionamento(s) e atividade(s) em todos os sistemas</p>`;
  if (pessoas.length) {
    html += `<table style="border-collapse:collapse;width:100%;margin-bottom:16px"><tr><th ${th}>Atendente</th>${sistemas.map(s => `<th ${th}>${s}</th>`).join('')}<th ${th}>Total</th></tr>`;
    pessoas.forEach(p => { html += `<tr><td ${td}><b>${esc(p)}</b></td>${sistemas.map(s => `<td ${td}>${d.porAt[p][s] || ''}</td>`).join('')}<td ${td}><b>${total_(d.porAt[p])}</b></td></tr>`; });
    html += `<tr><td ${td}><b>Total</b></td>${sistemas.map(s => `<td ${td}><b>${pessoas.reduce((x, p) => x + (d.porAt[p][s] || 0), 0)}</b></td>`).join('')}<td ${td}><b>${totalGeral}</b></td></tr></table>`;
  } else {
    html += '<p>Nenhum acionamento registrado hoje.</p>';
  }
  const extras = Object.keys(d.extras).filter(k => d.extras[k]);
  if (extras.length) html += `<p><b>Destaques:</b> ${extras.map(k => `${k}: ${esc(d.extras[k])}`).join(' · ')}</p>`;
  const atr = Object.keys(d.atrasados);
  if (atr.length) html += `<p><b>Follow-ups atrasados:</b> ${atr.map(k => `${k}: ${d.atrasados[k]}`).join(' · ')}</p>`;
  const quem = Object.keys(d.acessos).sort((a, b) => d.acessos[a] - d.acessos[b]);
  html += `<p><b>Acessaram a Jornada hoje (${quem.length}):</b> ${quem.length ? quem.map(q => `${esc(q)} (${Utilities.formatDate(new Date(d.acessos[q]), tz, 'HH:mm')})`).join(', ') : 'ninguém'}</p>`;
  if (d.erros.length) html += `<p style="color:#c92a2a;font-size:12px">Não foi possível ler: ${esc(d.erros.join(' | '))}</p>`;
  html += '<p style="color:#5b6776;font-size:12px">Enviado automaticamente pela Jornada do Aluno.</p></div>';
  return { ok: true, html: html, assunto: `[Jornada do Aluno] Relatório do dia ${dataTxt}`, total: totalGeral, dados: d };
}

function enviarRelatorioJornada_() {
  const r = montarRelatorio_(new Date());
  MailApp.sendEmail({ to: EMAIL_RELATORIO, subject: r.assunto, htmlBody: r.html, name: 'Jornada do Aluno' });
  log_('RELATORIO', 'automático', 'enviado para ' + EMAIL_RELATORIO + ' (' + r.total + ' registros)');
  return { ok: true, para: EMAIL_RELATORIO, total: r.total };
}

/** Gatilho: roda todo dia às 13h e às 20h; envia sábado às 13h e de segunda a sexta às 20h. */
function relatorioJornadaAgendado() {
  const agora = new Date();
  const dia = agora.getDay(), hora = agora.getHours();
  if ((dia >= 1 && dia <= 5 && hora >= 19) || (dia === 6 && hora < 19)) enviarRelatorioJornada_();
}

function ativarRelatorioJornada() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'relatorioJornadaAgendado') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('relatorioJornadaAgendado').timeBased().everyDays(1).atHour(20).create();
  ScriptApp.newTrigger('relatorioJornadaAgendado').timeBased().everyDays(1).atHour(13).create();
  log_('RELATORIO', 'gatilho', 'ativado (seg a sex 20h, sáb 13h)');
  return { ok: true };
}

function relatorioAtivo_() {
  return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'relatorioJornadaAgendado');
}

/** Ações do núcleo para a gestão (registradas em Modulo_nucleo, no 01_Roteador.gs). */
function acoesGestao_() {
  return {
    bases_resumo:      () => basesResumo_(),
    relatorio_previa:  () => { const r = montarRelatorio_(new Date()); return { ok: true, html: r.html, assunto: r.assunto, ativo: relatorioAtivo_(), para: EMAIL_RELATORIO }; },
    relatorio_enviar:  () => enviarRelatorioJornada_(),
    relatorio_ativar:  () => ativarRelatorioJornada(),
  };
}
