/**
 * SISTEMA FORMANDOS
 * Lógica de dados copiada do Painel Formandos v3 (Code.gs), sem alterações de regra:
 * coleções em abas (id | json | upd | del), sincronização por delta e gravação em lote.
 * Mudanças em relação ao original:
 *  - planilha: PLANILHAS.formandos (00_Config.gs);
 *  - login: o do núcleo (02_Acesso.gs); admin e coordenador viram "admin" do painel;
 *  - chaves de versão e gatilho de backup com prefixo "formandos_".
 * Arquivo gerado por ferramentas/gerar_formandos_gas.py. Não editar à mão.
 */

function Formandos_() {
  if (Formandos_.ns) return Formandos_.ns;
  Formandos_.ns = (function () {
    const COLECOES      = ['students', 'formados', 'activity', 'contacts', 'regua', 'config'];

    const SYNC_COLECOES = ['students', 'formados', 'activity', 'contacts', 'regua'];   // 'config' é lida sob demanda

    const CABECALHO     = ['id', 'json', 'upd', 'del'];

    const LIMITE_CELULA = 48000;                 // o Google Sheets aceita 50.000 caracteres por célula

    const MAX_OPS_ATENDENTE = 80;                // limite por envio para perfil atendente

    const BACKUPS_MANTIDOS  = 8;


    /** Confere as regras do perfil e carimba o nome de quem gravou. Devolve texto de erro ou ''. */
    function validar_(ops, eu) {
      const admin = eu.perfil === 'admin';
      if (!admin && ops.length > MAX_OPS_ATENDENTE) return 'envio grande demais para o seu perfil';
      for (let i = 0; i < ops.length; i++) {
        const o = ops[i];
        if (!o || COLECOES.indexOf(o.col) < 0) return 'coleção inválida';
        if (!admin) {
          const permitido =
            ((o.col === 'students' || o.col === 'formados') && o.op === 'update') ||
            ((o.col === 'activity' || o.col === 'contacts') && (o.op === 'set' || o.op === 'update'));
          if (!permitido) { Logger.log('Negado a ' + eu.nome + ': ' + o.op + ' ' + o.col); return o.op + ' em ' + o.col + ' é só para administradores'; }
        }
        // o nome no histórico vem da chave
        if ((o.col === 'activity' || o.col === 'contacts') && o.data && typeof o.data === 'object') {
          const imp = admin && String(o.data.who || '').indexOf('(importação)') >= 0;
          o.data.who = eu.nome + (imp ? ' (importação)' : '');
        }
      }
      return '';
    }


    function planilha_() {
      return planilhaDo_('formandos');
    }

    function aba_(col) {
      if (COLECOES.indexOf(col) < 0) throw new Error('coleção inválida: ' + col);
      const ss = planilha_();
      let sh = ss.getSheetByName(col);
      if (!sh) {
        sh = ss.insertSheet(col);
        sh.getRange(1, 1, 1, 4).setValues([CABECALHO]).setFontWeight('bold');
        sh.getRange('A:A').setNumberFormat('@');          // ids como texto (matrículas longas)
        sh.setFrozenRows(1);
        sh.setColumnWidth(2, 420);
      }
      return sh;
    }


    function ultima_() {
      const cache = CacheService.getScriptCache();
      let v = cache.get('formandos_ultima');
      if (v) return Number(v);
      v = Number(PropertiesService.getScriptProperties().getProperty('formandos_ultima') || 0);
      cache.put('formandos_ultima', String(v), 21600);
      return v;
    }

    function gravarUltima_(v) {
      PropertiesService.getScriptProperties().setProperty('formandos_ultima', String(v));
      CacheService.getScriptCache().put('formandos_ultima', String(v), 21600);
    }


    function poll_(since) {
      const v = ultima_();                                // lida ANTES das linhas: nada se perde
      if (since && since >= v) return { ok: true, v: v, changed: false };
      const docs = {};
      SYNC_COLECOES.forEach(function (col) { docs[col] = delta_(col, since); });
      return { ok: true, v: v, changed: true, full: !since, docs: docs };
    }

    function delta_(col, since) {
      const sh = aba_(col);
      const n = Math.max(sh.getLastRow() - 1, 0);
      if (!n) return [];
      const meta = sh.getRange(2, 3, n, 2).getValues();    // [upd, del]
      const hits = [];
      for (let i = 0; i < n; i++) {
        const upd = Number(meta[i][0]) || 0;
        if (upd > since && !(since === 0 && Number(meta[i][1]))) hits.push(i);
      }
      if (!hits.length) return [];
      let linhas = [];
      if (hits.length > 25) {
        const tudo = sh.getRange(2, 1, n, 4).getValues();
        linhas = hits.map(function (i) { return tudo[i]; });
      } else {
        linhas = hits.map(function (i) { return sh.getRange(i + 2, 1, 1, 4).getValues()[0]; });
      }
      const out = [];
      linhas.forEach(function (r) {
        const apagado = Number(r[3]) === 1;
        if (apagado) { out.push({ id: String(r[0]), del: true }); return; }
        try { out.push({ id: String(r[0]), data: JSON.parse(r[1]) }); } catch (e) { /* linha corrompida: ignora */ }
      });
      return out;
    }

    function getDoc_(col, id) {
      const sh = aba_(col);
      const n = Math.max(sh.getLastRow() - 1, 0);
      if (!n) return { ok: true, exists: false };
      const ids = sh.getRange(2, 1, n, 1).getValues();
      for (let i = n - 1; i >= 0; i--) {
        if (String(ids[i][0]) === id) {
          const r = sh.getRange(i + 2, 1, 1, 4).getValues()[0];
          if (Number(r[3]) === 1) return { ok: true, exists: false };
          try { return { ok: true, exists: true, data: JSON.parse(r[1]) }; } catch (e) { return { ok: true, exists: false }; }
        }
      }
      return { ok: true, exists: false };
    }


    function gravar_(ops) {
      var lock = bloqueio_(25000);
      try {
        const t = Math.max(Date.now(), ultima_() + 1);
        const porCol = {};
        ops.forEach(function (o) {
          if (!o || !o.col || o.id === undefined || o.id === null) return;
          (porCol[o.col] = porCol[o.col] || []).push(o);
        });
        Object.keys(porCol).forEach(function (col) { aplicar_(col, porCol[col], t); });
        SpreadsheetApp.flush();
        gravarUltima_(t);
        return { ok: true, v: t, n: ops.length };
      } finally {
        lock.releaseLock();
      }
    }

    function aplicar_(col, ops, t) {
      const sh = aba_(col);
      const n = Math.max(sh.getLastRow() - 1, 0);
      const ids = n ? sh.getRange(2, 1, n, 1).getValues() : [];
      const idx = {};
      for (let i = 0; i < n; i++) idx[String(ids[i][0])] = i;
      const precisaCorpo = ops.some(function (o) { return o.op === 'update'; });
      const corpo = (precisaCorpo && n) ? sh.getRange(2, 2, n, 3).getValues() : null;   // [json, upd, del]

      const alteradas = {};   // índice existente -> [json, upd, del]
      const novas = [];       // [id, json, upd, del]
      const novaIdx = {};     // id -> posição em novas

      ops.forEach(function (o) {
        const id = String(o.id);
        const i = idx[id];
        if (o.op === 'set') {
          const js = serializar_(o.data || {});
          if (i !== undefined) alteradas[i] = [js, t, 0];
          else if (novaIdx[id] !== undefined) novas[novaIdx[id]] = [id, js, t, 0];
          else { novaIdx[id] = novas.length; novas.push([id, js, t, 0]); }
        } else if (o.op === 'update') {
          let atual = null;
          if (i !== undefined) {
            const cur = alteradas[i] || corpo[i];
            if (!Number(cur[2])) atual = lerJson_(cur[0]);
          } else if (novaIdx[id] !== undefined) {
            atual = lerJson_(novas[novaIdx[id]][1]);
          }
          if (atual === null) return;                    // não existe ou foi apagado: ignora
          const js = serializar_(mesclar_(atual, o.data || {}));
          if (i !== undefined) alteradas[i] = [js, t, 0];
          else novas[novaIdx[id]] = [id, js, t, 0];
        } else if (o.op === 'delete') {
          if (i !== undefined) alteradas[i] = ['', t, 1];
          else if (novaIdx[id] !== undefined) novas[novaIdx[id]] = [id, '', t, 1];
        }
      });

      const chaves = Object.keys(alteradas).map(Number);
      if (chaves.length > 20) {
        const bloco = corpo || sh.getRange(2, 2, n, 3).getValues();
        chaves.forEach(function (i) { bloco[i] = alteradas[i]; });
        sh.getRange(2, 2, n, 3).setValues(bloco);
      } else {
        chaves.forEach(function (i) { sh.getRange(i + 2, 2, 1, 3).setValues([alteradas[i]]); });
      }
      if (novas.length) sh.getRange(n + 2, 1, novas.length, 4).setValues(novas);
    }

    function serializar_(obj) {
      const js = JSON.stringify(obj);
      if (js.length > LIMITE_CELULA) throw new Error('documento grande demais (' + js.length + ' caracteres)');
      return js;
    }

    function lerJson_(txt) {
      try { const o = JSON.parse(txt); return (o && typeof o === 'object') ? o : null; } catch (e) { return null; }
    }

    function mesclar_(base, patch) {
      Object.keys(patch).forEach(function (k) {
        const v = patch[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
          base[k] = mesclar_(base[k], v);
        } else {
          base[k] = v;
        }
      });
      return base;
    }

    /* ───────────────────────── MANUTENÇÃO (rodar manualmente no editor) ───────────────────────── */

    /** Rode uma vez: cria as abas e a aba "usuarios". Depois preencha nome, e-mail e perfil e gere as senhas provisórias. */

    /** Copia a planilha inteira para a pasta "Painel Formandos Backups" do seu Drive e guarda as últimas 8. */
    function backupSemanal() {
      const ss = planilha_();
      const pastas = DriveApp.getFoldersByName('Painel Formandos Backups');
      const pasta = pastas.hasNext() ? pastas.next() : DriveApp.createFolder('Painel Formandos Backups');
      const carimbo = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH-mm');
      DriveApp.getFileById(ss.getId()).makeCopy('Backup Painel Formandos ' + carimbo, pasta);
      const arquivos = [];
      const it = pasta.getFiles();
      while (it.hasNext()) { const f = it.next(); if (/^Backup Painel Formandos /.test(f.getName())) arquivos.push(f); }
      arquivos.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
      arquivos.slice(BACKUPS_MANTIDOS).forEach(function (f) { f.setTrashed(true); });
      Logger.log('Backup feito: ' + carimbo);
    }

    /** Agenda o backup toda segunda-feira, de madrugada. Rode uma vez. */

    /** Agenda o backup toda segunda-feira, de madrugada. Rode uma vez. */
    function ativarBackupSemanal() {
      ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'formandos_backupSemanal') ScriptApp.deleteTrigger(t); });
      ScriptApp.newTrigger('formandos_backupSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(3).create();
      Logger.log('Backup semanal ativado (segunda-feira, por volta das 3h).');
    }

    /** Remove da planilha as linhas apagadas há mais de 30 dias (os atendentes já sincronizaram). */

    /** Remove da planilha as linhas apagadas há mais de 30 dias (os atendentes já sincronizaram). */
    function limparApagados() {
      const corte = Date.now() - 30 * 86400000;
      var lock = bloqueio_(25000);
      try {
        SYNC_COLECOES.forEach(function (col) {
          const sh = aba_(col);
          const n = Math.max(sh.getLastRow() - 1, 0);
          if (!n) return;
          const meta = sh.getRange(2, 3, n, 2).getValues();
          for (let i = n - 1; i >= 0; i--) {
            if (Number(meta[i][1]) === 1 && Number(meta[i][0]) < corte) sh.deleteRow(i + 2);
          }
        });
      } finally { lock.releaseLock(); }
    }

    /** Esqueceu a senha da limpeza de dados? Rode esta função e crie outra no painel. */

    /** Esqueceu a senha da limpeza de dados? Rode esta função e crie outra no painel. */
    function removerSenhaLimpeza() {
      var lock = bloqueio_(25000);
      try {
        const t = Math.max(Date.now(), ultima_() + 1);
        aplicar_('config', [{ op: 'delete', col: 'config', id: 'clear' }], t);
        gravarUltima_(t);
        Logger.log('Senha de limpeza removida. O painel pedirá para criar uma nova.');
      } finally { lock.releaseLock(); }
    }

    return { validar_, poll_, getDoc_, gravar_, ultima_, aba_, backupSemanal, ativarBackupSemanal, limparApagados, removerSenhaLimpeza, COLECOES };
  })();
  return Formandos_.ns;
}

/** Identidade no formato que o painel espera. */
function formandosEu_(eu, importacao) {
  const regra = PERFIS[eu.perfil] || PERFIS.atendente;
  // na Central de Bases, quem tem "bases" importa alunos, formados e ENADE como o administrador do painel
  return { nome: eu.nome, email: eu.email, perfil: (regra.gestao || (importacao && regra.bases)) ? 'admin' : 'atendente' };
}

function Modulo_formandos() {
  const F = Formandos_();
  const comMe = (eu, r) => Object.assign(r, { me: formandosEu_(eu) });
  return {
    acoes: {
      ping: (d, eu) => comMe(eu, { ok: true, v: F.ultima_() }),
      poll: (d, eu) => comMe(eu, F.poll_(Number(d.since) || 0)),
      get: (d, eu) => {
        const col = String(d.col || ''), id = String(d.id || '');
        if (col === 'config' && id !== 'sem' && formandosEu_(eu).perfil !== 'admin') return { ok: false, error: 'sem_permissao' };
        return comMe(eu, F.getDoc_(col, id));
      },
      ops: (d, eu) => {
        const ops = Array.isArray(d.ops) ? d.ops : [];
        if (!ops.length) return comMe(eu, { ok: true, v: F.ultima_(), n: 0 });
        if (ops.length > 400) return { ok: false, error: 'lote grande demais (máx. 400 operações)' };
        const v = F.validar_(ops, formandosEu_(eu, d.importacao === true));
        if (v) return { ok: false, error: 'sem_permissao', detalhe: v };
        return comMe(eu, F.gravar_(ops));
      },
    },
    gestao: [],
    admin: [],
  };
}

/* Rodar pelo editor do Apps Script */
function formandos_configurar() { Formandos_().COLECOES.forEach(c => Formandos_().aba_(c)); Logger.log('Abas do Formandos conferidas.'); }
function formandos_backupSemanal() { Formandos_().backupSemanal(); }
function formandos_ativarBackupSemanal() { Formandos_().ativarBackupSemanal(); }
function formandos_limparApagados() { Formandos_().limparApagados(); }
function formandos_removerSenhaLimpeza() { Formandos_().removerSenhaLimpeza(); }
