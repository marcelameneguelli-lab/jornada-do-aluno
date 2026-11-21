/**
 * TRAZER O HISTÓRICO DO ENGAJAVR EM USO
 * O EngajaVR atual guarda os acionamentos no Drive (pasta "EngajaVR_Storage", arquivos
 * engajavr_HistoryJSON_<base>.json), e não na planilha, que chegou ao limite de células.
 * Por isso a cópia da planilha não trouxe os acionamentos mais recentes (desde agosto).
 *
 * Esta rotina só LÊ a pasta do EngajaVR (nada é alterado nela) e junta os acionamentos no
 * armazenamento da Jornada (pasta Jornada_Engajamento_Storage), sem duplicar: pode rodar quantas
 * vezes quiser, por exemplo de novo no dia da virada para o sistema novo.
 * Rodar pelo editor (função jornada_trazerHistoricoEngajaVR) ou pela Central de Bases (admin).
 */

const PASTA_ENGAJAVR = 'EngajaVR_Storage';

function chaveAcionamento_(a) { return String(a.id || ((a.datetime || a.date || '') + '|' + (a.atend || a.atendente || '') + '|' + (a.canal || ''))); }

function lerHistoricoEngajaVR_(base) {
  const nome = 'engajavr_HistoryJSON_' + base + '.json';
  let melhor = null, quando = -1;
  const pastas = DriveApp.getFoldersByName(PASTA_ENGAJAVR);
  while (pastas.hasNext()) {
    const arqs = pastas.next().getFilesByName(nome);
    while (arqs.hasNext()) {
      const f = arqs.next();
      let t = 0; try { t = f.getLastUpdated().getTime(); } catch (e) { t = 0; }
      if (f.isTrashed && f.isTrashed()) continue;
      if (t >= quando) { melhor = f; quando = t; }
    }
  }
  if (!melhor) return null;
  try { return JSON.parse(melhor.getBlob().getDataAsString('UTF-8')); } catch (e) { return null; }
}

function trazerHistoricoEngajaVR_(eu) {
  if (!DriveApp.getFoldersByName(PASTA_ENGAJAVR).hasNext()) return { ok: false, erro: 'Não encontrei a pasta "' + PASTA_ENGAJAVR + '" no Drive desta conta.' };
  const E = Engajamento_();
  const resultado = {};
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    BASES_ENGAJAMENTO.forEach(b => {
      const antigo = lerHistoricoEngajaVR_(b);
      if (!antigo) { resultado[b] = { encontrado: false, novos: 0 }; return; }
      let atual = {};
      try { atual = JSON.parse(E.storeGet('HistoryJSON_' + b) || '{}') || {}; } catch (e) { atual = {}; }
      let novos = 0;
      Object.keys(antigo).forEach(mat => {
        const lista = Array.isArray(antigo[mat]) ? antigo[mat] : [];
        if (!lista.length) return;
        const dest = atual[mat] = Array.isArray(atual[mat]) ? atual[mat] : [];
        const ja = {};
        dest.forEach(a => { ja[chaveAcionamento_(a)] = true; });
        lista.forEach(a => { const k = chaveAcionamento_(a); if (!ja[k]) { dest.push(a); ja[k] = true; novos++; } });
      });
      if (novos) E.storeSet('HistoryJSON_' + b, JSON.stringify(atual));
      let total = 0; Object.keys(atual).forEach(m => { total += (atual[m] || []).length; });
      resultado[b] = { encontrado: true, novos: novos, total: total };
    });
  } finally { lock.releaseLock(); }
  log_('HISTORICO', eu ? eu.nome : 'editor', 'trouxe do EngajaVR: ' + JSON.stringify(resultado));
  return { ok: true, bases: resultado };
}

/** Rodar pelo editor do Apps Script. */
function jornada_trazerHistoricoEngajaVR() {
  const r = trazerHistoricoEngajaVR_(null);
  Logger.log(JSON.stringify(r));
  return r;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * VIRADA: TRAZER TUDO DO ENGAJAVR EM USO PELA API DELE
 * O EngajaVR guarda valores pequenos nas propriedades do próprio Apps Script (que outro projeto
 * não consegue ler) e os grandes no Drive. Pela API do EngajaVR (só leituras "get") vem tudo,
 * de qualquer um dos lugares. Nada é gravado no EngajaVR.
 *
 * Junta sem duplicar: acionamentos e follow-ups por id; listas (calendário, tarefas, tutoriais,
 * atendentes, modelos) por id ou conteúdo. Bases líquidas: só se a do EngajaVR for mais nova.
 * ───────────────────────────────────────────────────────────────────────────── */

function lerApiEngajaVR_(url, acao, params) {
  let q = url + (url.indexOf('?') < 0 ? '?' : '&') + 'action=' + encodeURIComponent(acao);
  Object.keys(params || {}).forEach(k => { q += '&' + k + '=' + encodeURIComponent(params[k]); });
  const resp = UrlFetchApp.fetch(q, { muteHttpExceptions: true, followRedirects: true });
  if (resp.getResponseCode() !== 200) throw new Error(acao + ': resposta ' + resp.getResponseCode());
  let txt = resp.getContentText('UTF-8').trim();
  const m = txt.match(/^[\w$.]+\(([\s\S]*)\);?$/); // aceita JSONP
  if (m) txt = m[1];
  const r = JSON.parse(txt);
  if (r && r.ok === false) throw new Error(acao + ': ' + (r.error || r.erro || r.msg || 'erro'));
  return r;
}

function juntarListas_(atual, novo) {
  // objeto (não lista): só copia quando a Jornada ainda não tem nada
  if (novo && typeof novo === 'object' && !Array.isArray(novo)) {
    const vazio = !atual || (typeof atual === 'object' && !Object.keys(atual).length);
    return vazio && Object.keys(novo).length ? { lista: novo, novos: Object.keys(novo).length } : { lista: atual, novos: 0 };
  }
  atual = Array.isArray(atual) ? atual : []; novo = Array.isArray(novo) ? novo : [];
  const chave = x => (x && typeof x === 'object' && x.id != null) ? 'id:' + x.id : 'v:' + JSON.stringify(x);
  const ja = {}; atual.forEach(x => { ja[chave(x)] = true; });
  let n = 0;
  novo.forEach(x => { if (!ja[chave(x)]) { atual.push(x); ja[chave(x)] = true; n++; } });
  return { lista: atual, novos: n };
}

function lerJson_(E, chave, padrao) { try { const r = E.storeGet(chave); return r ? JSON.parse(r) : padrao; } catch (e) { return padrao; } }

function migrarEngajaVR_(url, eu) {
  url = String(url || '').trim();
  if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(url)) return { ok: false, erro: 'Informe o endereço /exec do Apps Script do EngajaVR (https://script.google.com/macros/s/.../exec).' };
  try { lerApiEngajaVR_(url, 'ping'); } catch (e) { return { ok: false, erro: 'O EngajaVR não respondeu: ' + e.message }; }
  const E = Engajamento_();
  const rel = { listas: {}, bases: {} };
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    // listas gerais
    [['getEventos', 'EventosJSON', 'calendário'], ['getTarefas', 'Tarefas', 'tarefas'], ['getTutoriais', 'Tutoriais', 'tutoriais'],
     ['getAtendentes', 'AtendentesJSON', 'atendentes'], ['getModelos', 'ModelosJSON', 'modelos de mensagem']].forEach(([acao, chave, nome]) => {
      try {
        const r = lerApiEngajaVR_(url, acao);
        const j = juntarListas_(lerJson_(E, chave, []), r.data);
        if (j.novos) E.storeSet(chave, JSON.stringify(j.lista));
        rel.listas[nome] = j.novos;
      } catch (e) { rel.listas[nome] = 'erro: ' + e.message; }
    });
    BASES_ENGAJAMENTO.forEach(b => {
      const x = rel.bases[b] = {};
      // acionamentos (histórico de todas as fontes do EngajaVR)
      try {
        const antigo = lerApiEngajaVR_(url, 'getHistory', { base: b }).data || {};
        const atual = lerJson_(E, 'HistoryJSON_' + b, {}) || {};
        let n = 0;
        Object.keys(antigo).forEach(mat => {
          const dest = atual[mat] = Array.isArray(atual[mat]) ? atual[mat] : [];
          const ja = {}; dest.forEach(a => { ja[chaveAcionamento_(a)] = true; });
          (antigo[mat] || []).forEach(a => { const k = chaveAcionamento_(a); if (!ja[k]) { dest.push(a); ja[k] = true; n++; } });
        });
        if (n) E.storeSet('HistoryJSON_' + b, JSON.stringify(atual));
        x.acionamentos = n;
      } catch (e) { x.acionamentos = 'erro: ' + e.message; }
      // follow-ups, estágio (TCE), evasão e fotografias do painel
      [['getFollowups', 'FollowupsJSON_', 'followups', 'obj'], ['getTCEData', 'TCEData_', 'estagio', 'obj'],
       ['getEvasaoData', 'EvasaoData_', 'evasao', 'lista'], ['getSnaps', 'snaps_', 'fotografias', 'lista']].forEach(([acao, pref, nome, tipo]) => {
        try {
          const r = lerApiEngajaVR_(url, acao, { base: b });
          const dado = acao === 'getSnaps' ? r.snaps : r.data;
          if (tipo === 'obj') {
            const atual = lerJson_(E, pref + b, {}) || {};
            let n = 0;
            Object.keys(dado || {}).forEach(k => { if (atual[k] == null) { atual[k] = dado[k]; n++; } });
            if (n) E.storeSet(pref + b, JSON.stringify(atual));
            x[nome] = n;
          } else {
            const j = juntarListas_(lerJson_(E, pref + b, []), dado);
            if (j.novos) E.storeSet(pref + b, JSON.stringify(j.lista));
            x[nome] = j.novos;
          }
        } catch (e) { x[nome] = 'erro: ' + e.message; }
      });
      // base líquida: só se a do EngajaVR for mais nova que a da Jornada
      try {
        const tsVelho = Number((lerApiEngajaVR_(url, 'getBaseTipo', { base: b }) || {}).ts) || 0;
        const tsNovo = Number(E.storeGet('crm_base_' + b + '_ts') || 0);
        if (tsVelho > tsNovo) {
          const r = lerApiEngajaVR_(url, 'carregarBase', { base: b });
          if (Array.isArray(r.dados) && r.dados.length) {
            E.storeSet('crm_base_' + b, JSON.stringify(r.dados));
            E.storeSet('crm_base_' + b + '_ts', String(tsVelho));
            x.base = r.dados.length + ' alunos (mais nova no EngajaVR)';
          } else x.base = 'vazia no EngajaVR';
        } else x.base = tsNovo ? 'a da Jornada já é a mais nova' : 'sem base nos dois';
      } catch (e) { x.base = 'erro: ' + e.message; }
    });
  } finally { lock.releaseLock(); }
  log_('VIRADA', eu ? eu.nome : 'editor', 'dados do EngajaVR: ' + JSON.stringify(rel));
  return { ok: true, relatorio: rel };
}

/** Pelo editor: troque o endereço abaixo pelo /exec do EngajaVR em uso e rode. */
function jornada_migrarEngajaVR() {
  const url = PropertiesService.getScriptProperties().getProperty('engajavr_url_antigo') || '';
  const r = migrarEngajaVR_(url, null);
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}
