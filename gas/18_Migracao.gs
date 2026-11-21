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
