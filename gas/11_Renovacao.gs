/**
 * SISTEMA RENOVAÇÃO
 * Backend do RenovaVR v6.6 (estacio_gas_backend_v6.6.gs) sem mudanças de regra.
 * Mudanças em relação ao original:
 *  - planilha: PLANILHAS.renovacao (00_Config.gs);
 *  - login e usuários: os do núcleo (02_Acesso.gs). Os perfis são os mesmos
 *    (admin, coordenador, atendente, apoio), conferidos pelo próprio código original;
 *  - propriedades do script com prefixo "renovacao_" (SMTP, SMS, controles internos);
 *  - gatilho do relatório: renovacao_relatoriosDiarios.
 * Arquivo gerado por ferramentas/gerar_renovacao_gas.py. Não editar à mão.
 */

/** Propriedades do script só deste sistema (prefixo renovacao_). */
function propsRenovacao_() {
  const p = PropertiesService.getScriptProperties(), pre = 'renovacao_';
  return {
    getProperty: k => p.getProperty(pre + k),
    setProperty: (k, v) => { p.setProperty(pre + k, v); return this; },
    deleteProperty: k => p.deleteProperty(pre + k),
    getProperties: () => { const o = {}, t = p.getProperties(); Object.keys(t).forEach(k => { if (k.indexOf(pre) === 0) o[k.slice(pre.length)] = t[k]; }); return o; },
    deleteAllProperties: () => Object.keys(p.getProperties()).forEach(k => { if (k.indexOf(pre) === 0) p.deleteProperty(k); }),
  };
}

function Renovacao_() {
  if (Renovacao_.ns) return Renovacao_.ns;
  Renovacao_.ns = (function () {
    // ============================================================
    // ESTÁCIO VOLTA REDONDA — SISTEMA DE RENOVAÇÃO DE MATRÍCULA
    // Google Apps Script — Backend v6.6 — Login, perfis e importação segura
    // ============================================================
    //
    // NOVIDADES v6.6:
    //   ✅ Boas-vindas: marcações de vários computadores e envios em lote são
    //      somadas no servidor (bv_marcar) e não se apagam mais umas às outras.
    //
    // NOVIDADES v6.5:
    //   ✅ Acionamentos gravados como texto: a planilha não transforma mais o
    //      ciclo "2026.4" em data nem muda o formato da data. Era isso que fazia
    //      o acionamento de um atendente não aparecer para os outros.
    //   ✅ repararAcionamentos(): corrige as linhas já gravadas (rodar uma vez).
    //
    // NOVIDADES v6.4:
    //   ✅ Importar ÍMPAR e PAR juntos: a segunda base espera a primeira terminar
    //      (antes podia falhar por tempo e o ciclo ficava com a base antiga).
    //   ✅ Enquanto um ciclo está sendo gravado, carregar_alunos não entrega
    //      essa aba pela metade para os outros navegadores.
    //
    // NOVIDADES v6.3:
    //   🔐 Login com e-mail institucional + senha (guardada só como hash).
    //   🔐 Toda ação exige sessão válida (12 horas). Sem login, o servidor
    //      não entrega nenhum dado de aluno.
    //   🔐 Perfis conferidos no servidor: admin, coordenador, atendente, apoio.
    //   🔐 Gestão de usuários só para o administrador, com senha provisória
    //      e troca obrigatória no primeiro acesso.
    //   🔐 Acionamentos, envios e acessos ficam no nome de quem está logado.
    //   ▶ Depois de publicar, rode criarAdmin uma vez (ver passo 5 abaixo).
    //
    // NOVIDADES v6.2:
    //   ✅ Aba "Acessos": registra quem entrou no sistema, a que horas e o
    //      tempo ativo aproximado de cada pessoa (rota registrar_acesso).
    //   ✅ Relatório diário de produtividade por e-mail, com acessos,
    //      acionamentos, renovações, envios, follow-ups em atraso e quem da
    //      equipe não acessou. Destino: marques.marcela@estacio.br
    //      Envio: segunda a sexta às 20h, sábado às 13h (HORARIOS_RELATORIO).
    //   ✅ ativarRelatorioDiario(): liga o envio automático sem apagar
    //      os outros gatilhos. testarRelatorioDiario(): manda um agora.
    //
    // NOVIDADES v6 (mantidas):
    //   ✅ Cada ciclo de renovação tem sua própria aba de alunos
    //      (Alunos_2026.3, Alunos_2026.2 ...). Importar um ciclo NÃO mexe nos outros.
    //   ✅ A aba de cada ciclo guarda o objeto completo do aluno (coluna "Dados").
    //   ✅ Acionamentos e envios gravam o ciclo (coluna "Ciclo").
    //   ✅ sync e ping informam o total de alunos por ciclo (totaisCiclo).
    //
    // ▸ PARA ATUALIZAR (mantém a mesma URL):
    //   1. Cole TODO este código no Código.gs e salve (Ctrl+S)
    //   2. Implantar → Gerenciar implantações → lápis (editar)
    //   3. Versão: "Nova versão" → Implantar
    //   4. Uma vez só: escolha a função ativarRelatorioDiario e clique em Executar
    //   5. Uma vez só: escolha a função criarAdmin e clique em Executar.
    //      A senha provisória aparece no "Registro de execução".
    //
    // ============================================================

    const VERSAO_GAS = '6.6';

    // ============================================================
    // ★ CONFIGURAÇÕES
    // ============================================================
    const SPREADSHEET_ID = '';
    // Deixe vazio: o ID já está salvo nas propriedades do script (configurarPlanilha).

    const SMTP_CONFIG = { nomeRem: 'Estácio Volta Redonda', usarGmail: true };

    const SMS_CONFIG = {
      provedor: 'zenvia', zenviaToken: '', zenviaFrom: 'Estacio',
      twilioSid: '', twilioToken: '', twilioFrom: '',
    };

    // Importação automática do Drive (opcional). O ciclo é lido do próprio CSV.
    const DRIVE_ARQUIVOS = [
      { nomeArquivo: 'BASE_RENOVAVEL_IMPAR_VOLTA REDONDA.csv', pastaId: '', descricao: 'ÍMPAR (.1 / .3)' },
      { nomeArquivo: 'BASE_RENOVAVEL_PAR_VOLTA REDONDA.csv',   pastaId: '', descricao: 'PAR (.2 / .4)' },
    ];

    // Relatório diário: e-mail de destino e horários de envio (fuso de Brasília)
    const NOTIF_CONFIG = { emailRelatorio: 'marques.marcela@estacio.br', emailAlertas: '', horaImportacao: 7 };
    // Segunda a sexta às 20h e sábado às 13h. Domingo não envia.
    // Depois de mudar aqui, rode ativarRelatorioDiario de novo.
    const HORARIOS_RELATORIO = [
      { dia: 'MONDAY',    hora: 20 },
      { dia: 'TUESDAY',   hora: 20 },
      { dia: 'WEDNESDAY', hora: 20 },
      { dia: 'THURSDAY',  hora: 20 },
      { dia: 'FRIDAY',    hora: 20 },
      { dia: 'SATURDAY',  hora: 13 },
    ];

    const NOME_HTML = 'estacio_gas_serve.html';
    const NOME_JS   = 'estacio_app.js';

    // Colunas da aba de alunos (1-based)
    const COL_STATUS = 22, COL_ULT_AT = 26, COL_CICLO = 27, COL_DADOS = 28;
    // Coluna Ciclo da aba Acionamentos (1-based) e da aba Envios
    const COL_AC_CICLO = 15, COL_ENV_CICLO = 10;

    // ============================================================
    // ROTEADOR — GET (JSONP) e POST
    // ============================================================
    function doGet(e) {
      if (!e || !e.parameter || !e.parameter.acao) return servirHTML();
      const acao     = e.parameter.acao;
      const callback = e.parameter.callback;
      try {
        if (acao === 'js') return servirJS();
        let d = {};
        if (e.parameter.data) {
          try { d = JSON.parse(decodeURIComponent(e.parameter.data)); }
          catch(parseErr) { try { d = JSON.parse(e.parameter.data); } catch(e2) { d = {}; } }
        } else {
          d = e.parameter;
        }
        return saida(processarAcao(acao, d), callback);
      } catch(err) {
        log('ERRO GET', acao, err.message);
        return saida({ erro: err.message }, callback);
      }
    }

    function doPost(e) {
      try {
        const raw  = e.postData ? e.postData.contents : '{}';
        const d    = JSON.parse(raw);
        const acao = d.acao;
        if (!acao) return responder({ erro: 'Campo "acao" ausente no POST' });
        return responder(processarAcao(acao, d));
      } catch(err) {
        log('ERRO POST', String(e.postData && e.postData.contents).substring(0, 120), err.message);
        return responder({ erro: err.message });
      }
    }

    function saida(obj, callback) {
      if (callback) {
        return ContentService.createTextOutput(callback + '(' + JSON.stringify(obj) + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return responder(obj);
    }

    function responder(dados) {
      return ContentService.createTextOutput(JSON.stringify(dados)).setMimeType(ContentService.MimeType.JSON);
    }

    function processarAcao(acao, d) {
      d = d || {};
      let sess = null;
      if (ACOES_PUBLICAS.indexOf(acao) < 0) {
        sess = d.__sess || null;
        const negado = checarPermissao(acao, sess);
        if (negado) return negado;
        if (acao === 'salvar_config') { const n = checarChaveConfig(d.chave, sess); if (n) return n; }
        if (acao === 'remover_config_prefixo') { const n = checarChaveConfig('', sess, d.prefixo || '-'); if (n) return n; }
        // Quem não é admin só registra no próprio nome
        if (sess.perfil !== 'admin') {
          if (d.acionamento) d.acionamento.colab = sess.nome;
          if (d.envio) d.envio.colab = sess.nome;
        }
      }
      delete d.token;
      const mapa = {
        ping:                  () => getPing(),
        login:                 () => login(d),
        logout:                () => logout(sess),
        sessao:                () => ({ ok: true, nome: sess.nome, email: sess.email, perfil: sess.perfil, exp: sess.exp }),
        trocar_senha:          () => trocarSenha(sess, d),
        usuarios_listar:       () => usuariosListar(),
        usuario_salvar:        () => usuarioSalvar(sess, d),
        usuario_resetar_senha: () => usuarioResetarSenha(sess, d),
        usuario_remover:       () => usuarioRemover(sess, d),
        sync:                  () => getSync(d),
        carregar_alunos:       () => carregarAlunos(d),
        listar_alunos:         () => listarAlunos(d),
        listar_acionamentos:   () => listarAcionamentos(d),
        listar_envios:         () => listarEnvios(d),
        listar_ciclos:         () => ({ ok: true, totaisCiclo: totaisPorCiclo() }),
        dashboard:             () => getDashboard(),
        dashboard_periodos:    () => getDashboardPeriodos(),
        velocidade:            () => getVelocidade(),
        ranking_colab:         () => getRankingColaboradores(d),
        followups_hoje:        () => getFollowUpsHoje(),
        alunos_sem_acionamento:() => getAlunosSemAcionamento(),
        config:                () => getConfig(),
        exportar_csv:          () => exportarCSV(d),
        salvar_acionamento:    () => salvarAcionamento(Object.assign({}, d.acionamento, sess && sess.nome ? { colab: sess.nome } : {})),
        salvar_aluno:          () => salvarAluno(d.aluno),
        importar_alunos:       () => importarAlunos(d.alunos, d.ciclo),
        atualizar_status:      () => atualizarStatus(d.alunoId, d.status, d.ciclo),
        concluir_followup:     () => concluirFollowUp(d.followupId),
        salvar_atendentes:     () => salvarAtendentes(d.atendentes),
        carregar_atendentes:   () => carregarAtendentes(),
        registrar_envio:       () => registrarEnvio(d.envio || d),
        enviar_email:          () => enviarEmail(d),
        enviar_sms:            () => enviarSMS(d),
        salvar_smtp:           () => salvarSMTP(d),
        testar_email:          () => testarEmail(d),
        importar_drive:        () => importarTodosDrive(),
        importar_drive_single: () => importarUmArquivoDrive(d.nomeArquivo || d.nomeAba),
        salvar_config:         () => salvarConfigKey(d.chave, d.valor),
        remover_config:        () => removerConfigKey(d.chave),
        remover_config_prefixo:() => removerConfigPorPrefixo(d.prefixo),
        remover_duplicatas:    () => removerAcionamentosDuplicados(),
        registrar_acesso:      () => registrarAcesso(Object.assign({}, d, { colab: sess.nome })),
        bv_marcar:             () => bvMarcar(d),
        enviar_relatorio_diario:() => enviarRelatorioDiario(true),
      };
      const fn = mapa[acao];
      return fn ? fn() : { erro: 'Ação desconhecida: ' + acao };
    }

    // ============================================================
    // 🌐  SERVIR HTML/JS PELO DRIVE (mantido do v5)
    // ============================================================
    function servirJS() {
      try {
        const arquivos = DriveApp.getFilesByName(NOME_JS);
        if (!arquivos.hasNext()) {
          return ContentService.createTextOutput('console.error("' + NOME_JS + ' não encontrado no Drive.");')
            .setMimeType(ContentService.MimeType.JAVASCRIPT);
        }
        return ContentService.createTextOutput(arquivos.next().getBlob().getDataAsString('UTF-8'))
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      } catch(err) {
        return ContentService.createTextOutput('console.error("Erro ao servir JS: ' + err.message + '");')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
    }

    function servirHTML() {
      try {
        const arquivos = DriveApp.getFilesByName(NOME_HTML);
        if (!arquivos.hasNext()) {
          return HtmlService.createHtmlOutput(
            '<h2 style="font-family:sans-serif;color:#C0392B">⚠️ Arquivo não encontrado</h2>' +
            '<p style="font-family:sans-serif">Faça upload do arquivo <strong>' + NOME_HTML + '</strong> no Google Drive da conta que executa este GAS.</p>'
          ).setTitle('Estácio — Renovação').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }
        let conteudo = arquivos.next().getBlob().getDataAsString('UTF-8');
        const gasUrl = ScriptApp.getService().getUrl();
        conteudo = conteudo.replace("var GAS_URL_PADRAO = '';", "var GAS_URL_PADRAO = '" + gasUrl + "';");
        return HtmlService.createHtmlOutput(conteudo)
          .setTitle('Sistema de Renovação · Estácio Volta Redonda')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      } catch(err) {
        log('ERRO servirHTML', err.message, 'Sistema');
        return HtmlService.createHtmlOutput('<h2 style="font-family:sans-serif;color:#C0392B">Erro ao carregar o sistema</h2><pre>' + err.message + '</pre>').setTitle('Erro');
      }
    }

    // ============================================================
    // 🔁  CICLOS
    // ============================================================
    /** "26.3" → "2026.3" · "2026.2 EAD" → "2026.2" */
    function normCiclo(p) {
      // A planilha às vezes transforma o texto "2026.4" em data (abril/2026)
      if (p instanceof Date && !isNaN(p.getTime())) return p.getFullYear() + '.' + (p.getMonth() + 1);
      const s = String(p == null ? '' : p).trim().replace(',', '.');
      if (/^[A-Za-z]{3} [A-Za-z]{3} \d{2} \d{4}/.test(s)) { const d = new Date(s); if (!isNaN(d.getTime())) return d.getFullYear() + '.' + (d.getMonth() + 1); }
      let m = s.match(/^(\d{2})\.(\d)$/);
      if (m) return '20' + m[1] + '.' + m[2];
      m = s.match(/^(20\d{2})(\d)$/);           // "2026.3" lido como 20263 pela planilha pt_BR
      if (m) return m[1] + '.' + m[2];
      m = s.match(/^(20\d{2})\.(\d)/);
      if (m) return m[1] + '.' + m[2];
      return s;
    }

    function nomeAbaCiclo(ciclo) { return 'Alunos_' + ciclo; }

    /** Abas de ciclo existentes: [{ ciclo, aba }] */
    function abasCiclo(ss) {
      return ss.getSheets()
        .map(sh => ({ nome: sh.getName(), aba: sh }))
        .filter(o => /^Alunos_\d{4}\.\d$/.test(o.nome))
        .map(o => ({ ciclo: o.nome.substring(7), aba: o.aba }))
        .sort((a, b) => a.ciclo < b.ciclo ? -1 : 1);
    }

    function totaisPorCiclo(ss) {
      ss = ss || getSpreadsheet();
      const t = {};
      abasCiclo(ss).forEach(o => t[o.ciclo] = Math.max(0, o.aba.getLastRow() - 1));
      return t;
    }

    // ============================================================
    // 🏓  PING
    // ============================================================
    function getPing() {
      let planilhaOk = false, totalAlunos = 0, periodo = '', totaisCiclo = {};
      try {
        const ss = getSpreadsheet();
        planilhaOk = true;
        totaisCiclo = totaisPorCiclo(ss);
        totalAlunos = Object.keys(totaisCiclo).reduce((s, c) => s + totaisCiclo[c], 0);
        if (!totalAlunos) {
          const abaAl = ss.getSheetByName('Alunos');
          if (abaAl) totalAlunos = Math.max(0, abaAl.getLastRow() - 1);
        }
        periodo = getConfig().periodo_atual || '';
      } catch(e) {}
      return { ok: true, versao: VERSAO_GAS, planilha_ok: planilhaOk, totalAlunos, totaisCiclo, periodo, ts: new Date().toISOString() };
    }

    // ============================================================
    // 🔄  SYNC
    // ============================================================
    function getSync(params) {
      const tsSolicitado = parseInt(params.ts || '0') || 0;
      const ss    = getSpreadsheet();
      const abaAc = ss.getSheetByName('Acionamentos');
      const totaisCiclo = totaisPorCiclo(ss);
      const totalAlunos = Object.keys(totaisCiclo).reduce((s, c) => s + totaisCiclo[c], 0);

      if (!abaAc || abaAc.getLastRow() <= 1) {
        return { ok: true, aviso: 'Nenhum acionamento ainda.', novosAcionamentos: [], alunosAtualizados: [],
                 followups: { hoje: [], atrasados: [] }, totalAcionamentos: 0, totalAlunos, totaisCiclo, ts: Date.now() };
      }

      const dados = abaAc.getDataRange().getValues();
      const col = {}; dados[0].forEach((h, i) => col[h] = i);
      const I = (nome, pad) => (col[nome] !== undefined ? col[nome] : pad);
      const iId = I('ID Acionamento', 0), iAlId = I('ID Aluno', 1), iNome = I('Nome Aluno', 2), iColab = I('Colaborador', 3);
      const iTipo = I('Tipo', 4), iObs = I('Observações', 5), iFuDt = I('Follow-Up Data', 6), iFuTp = I('Follow-Up Tipo', 7);
      const iFuSt = I('Status Follow-Up', 8), iStAl = I('Status Aluno', 9), iData = I('Data', 10), iHora = I('Hora', 11);
      const iTs = I('_ts', 12), iFuPa = I('Follow-Up Para', 13), iCiclo = I('Ciclo', 14);

      const agora = Date.now();
      const novosAcs = [], fuHoje = [], fuAtrasados = [];
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

      dados.slice(1).forEach(row => {
        if (!row[iId]) return;
        const tsAc = parseInt(row[iTs] || '0') || 0;
        if (tsSolicitado === 0 || tsAc > tsSolicitado) {
          novosAcs.push({
            id: String(row[iId]), alunoId: String(row[iAlId]), nomeAluno: String(row[iNome] || ''),
            colab: String(row[iColab] || ''), tipo: String(row[iTipo] || ''), obs: String(row[iObs] || ''),
            fuData: formatarDataBR(row[iFuDt]), fuTipo: String(row[iFuTp] || ''), fuStatus: String(row[iFuSt] || ''),
            fuPara: String(row[iFuPa] || row[iColab] || ''), stAl: String(row[iStAl] || ''),
            data: formatarDataBR(row[iData]), hora: String(row[iHora] || ''), _ts: tsAc,
            ciclo: normCiclo(row[iCiclo] || ''),
          });
        }
        const fuDataStr = formatarDataBR(row[iFuDt]);
        const fuStatus  = String(row[iFuSt] || '').trim();
        if (fuDataStr && fuStatus !== 'OK' && fuStatus !== 'Concluído') {
          const dtFu = parseDataCelula(row[iFuDt]);
          if (dtFu) {
            const item = { id: String(row[iId]), alunoId: String(row[iAlId]), nome: String(row[iNome] || ''),
                           colab: String(row[iColab] || ''), tipo: String(row[iFuTp] || ''), data: fuDataStr,
                           ciclo: normCiclo(row[iCiclo] || '') };
            if (dtFu.getTime() === hoje.getTime()) fuHoje.push(item);
            else if (dtFu < hoje) fuAtrasados.push(item);
          }
        }
      });

      // Alunos alterados (lê só as colunas leves, sem a coluna Dados)
      const alunosAtualizados = [];
      abasCiclo(ss).forEach(o => {
        const n = o.aba.getLastRow() - 1;
        if (n <= 0) return;
        const linhas = o.aba.getRange(2, 1, n, COL_ULT_AT).getValues();
        linhas.forEach(row => {
          if (!row[0]) return;
          let tsUlt = 0;
          try { tsUlt = row[COL_ULT_AT - 1] ? new Date(row[COL_ULT_AT - 1]).getTime() : 0; } catch(e) {}
          if (tsSolicitado === 0 || tsUlt > tsSolicitado) {
            alunosAtualizados.push({ id: String(row[0]), status: String(row[COL_STATUS - 1] || ''), cpf: String(row[3] || ''), ciclo: o.ciclo });
          }
        });
      });

      return { ok: true, novosAcionamentos: novosAcs, alunosAtualizados,
               followups: { hoje: fuHoje, atrasados: fuAtrasados },
               totalAcionamentos: dados.length - 1, totalAlunos, totaisCiclo, ts: agora };
    }

    // ============================================================
    // 👥  CARREGAR ALUNOS (todos os ciclos, ou um só com ?ciclo=)
    // ============================================================
    function carregarAlunos(params) {
      const ss = getSpreadsheet();
      const cicloPedido = normCiclo(params.ciclo || '');
      let fontes = abasCiclo(ss);
      if (cicloPedido) fontes = fontes.filter(o => o.ciclo === cicloPedido);
      // Ciclo sendo gravado agora: não entrega a aba pela metade
      const importando = ciclosImportando();
      fontes = fontes.filter(o => importando.indexOf(o.ciclo) < 0);

      // Compatibilidade: sem nenhuma aba de ciclo ainda, lê a aba antiga "Alunos"
      if (!fontes.length && !cicloPedido) {
        const antiga = ss.getSheetByName(params.aba || 'Alunos');
        if (antiga && antiga.getLastRow() > 1) fontes = [{ ciclo: '', aba: antiga }];
      }
      if (!fontes.length) return { ok: true, aviso: 'Base vazia. Importe o CSV primeiro.', alunos: [], total: 0, totaisCiclo: {} };

      const alunos = [];
      const totaisCiclo = {};
      fontes.forEach(o => {
        const dados = o.aba.getDataRange().getValues();
        const headers = dados[0];
        let n = 0;
        dados.slice(1).forEach(row => {
          if (!row[0]) return;
          const aluno = linhaParaAluno(headers, row, o.ciclo);
          if (aluno) { alunos.push(aluno); n++; }
        });
        if (o.ciclo) totaisCiclo[o.ciclo] = n;
      });
      return { ok: true, alunos, total: alunos.length, totaisCiclo, importando };
    }

    function ciclosImportando() {
      const props = propsRenovacao_().getProperties();
      return Object.keys(props).filter(k => k.indexOf('importando_') === 0 && Date.now() - parseInt(props[k]) < 6 * 60 * 1000)
        .map(k => k.substring(11));
    }

    function linhaParaAluno(headers, row, ciclo) {
      const o = {}; headers.forEach((h, i) => o[h] = row[i]);
      // Formato v6: objeto completo na coluna "Dados"
      if (o['Dados']) {
        try {
          const a = JSON.parse(o['Dados']);
          a.id = String(a.id || o['ID']);
          a.status = String(o['Status'] || a.status || 'Pendente');
          a.cpf = String(o['CPF'] || a.cpf || '');
          if (a.cpf) a.cpfDigitado = a.cpf;
          a.ciclo = ciclo || normCiclo(a.ciclo || o['Ciclo']); // o nome da aba manda
          a.acionamentos = [];
          a._full = true;
          return a;
        } catch(e) {}
      }
      // Formato antigo (v5)
      return {
        id: String(o['ID'] || ''), matricula: String(o['Matrícula'] || o['ID'] || ''), nome: String(o['Nome'] || ''),
        email: String(o['E-mail'] || ''), telefone: String(o['Telefone'] || ''),
        celularOriginal: String(o['Telefone'] || '').replace('+55', ''), curso: String(o['Curso'] || ''),
        modalidade: String(o['Modalidade'] || ''), bu: String(o['BU'] || ''),
        periodo: parseInt(o['Período Aluno'] || '1') || 1, totalPeriodos: parseInt(o['Total Períodos'] || '8') || 8,
        faltaCursar: parseInt(o['Falta Cursar'] || '0') || 0, safra: String(o['Safra'] || ''),
        condicao: String(o['Condição'] || ''), divTotal: parseFloat(String(o['Dívida Total'] || '0').replace(',', '.')) || 0,
        faixaDivida: String(o['Faixa Dívida'] || 'Sem dívida'), tipoInad: String(o['Tipo Inadimplência'] || ''),
        risco: String(o['Crit. Financeira'] || ''), criticidadeFin: String(o['Crit. Financeira'] || ''),
        criticidadeAcad: String(o['Crit. Acadêmica'] || ''), propensao: String(o['Propensão'] || ''),
        formando: String(o['Formando'] || 'N') === 'S', cobDesconto: String(o['Cob. Desconto'] || '') === 'S',
        cobAptoDesc: String(o['Cob. Apto Desc.'] || '') === 'S', status: String(o['Status'] || 'Pendente'),
        cpf: String(o['CPF'] || ''), ciclo: ciclo || normCiclo(o['Ciclo'] || o['Período CSV']), acionamentos: [],
      };
    }

    // ============================================================
    // 📊  ALUNOS — IMPORTAÇÃO POR CICLO
    // ============================================================
    function getHeadersAlunos() {
      return [
        'ID','Nome','Matrícula','CPF','Telefone','E-mail','Curso','BU','Período CSV',
        'Modalidade','Período Aluno','Total Períodos','Falta Cursar','Safra','Condição',
        'Dívida Total','Faixa Dívida','Tipo Inadimplência','Crit. Financeira','Crit. Acadêmica',
        'Formando','Status','Cob. Desconto','Cob. Apto Desc.','Propensão','Última Atualização',
        'Ciclo','Dados',
      ];
    }

    /**
     * Substitui SOMENTE a aba do ciclo informado. Os outros ciclos ficam intactos.
     * O ciclo vem do sistema (lido da coluna PERIODO/PERIODO_ATUAL do CSV).
     */
    function importarAlunos(alunos, ciclo) {
      if (!alunos || !alunos.length) return { ok: false, erro: 'Nenhum aluno recebido.' };
      ciclo = normCiclo(ciclo || (alunos[0] && alunos[0].ciclo) || '');
      if (!/^\d{4}\.\d$/.test(ciclo)) return { ok: false, erro: 'Ciclo inválido ou ausente: "' + ciclo + '"' };

      // Duas bases enviadas juntas (ÍMPAR e PAR): a segunda espera a primeira terminar
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(240000)) return { ok: false, erro: 'Outra base ainda está sendo gravada. Tente de novo em instantes.' };
      const props = propsRenovacao_();
      props.setProperty('importando_' + ciclo, String(Date.now()));
      try {
        const ss  = getSpreadsheet();
        const aba = garantirAbaAlunos(ss, nomeAbaCiclo(ciclo));
        const h   = getHeadersAlunos();
        const lastRow = aba.getLastRow();
        if (lastRow > 1) aba.getRange(2, 1, lastRow - 1, Math.max(aba.getLastColumn(), h.length)).clearContent();

        aba.getRange(2, 9, Math.max(alunos.length, 1), 1).setNumberFormat('@');          // Período CSV como texto
        aba.getRange(2, COL_CICLO, Math.max(alunos.length, 1), 1).setNumberFormat('@');  // Ciclo como texto
        const linhas = alunos.map(a => { a.ciclo = ciclo; return montarLinhaAluno(a, a.status || 'Pendente'); });
        aba.getRange(2, 1, linhas.length, h.length).setValues(linhas);
        colorirPorStatus(aba, linhas.length);

        atualizarAbaConsolidada(ss);
        salvarConfigKey('ultima_atualizacao_' + ciclo, new Date().toLocaleString('pt-BR'));
        SpreadsheetApp.flush();
        log('IMPORTAÇÃO', alunos.length + ' alunos → ' + nomeAbaCiclo(ciclo), 'Sistema');
        return { ok: true, importados: alunos.length, ciclo, aba: nomeAbaCiclo(ciclo) };
      } finally { props.deleteProperty('importando_' + ciclo); lock.releaseLock(); }
    }

    function montarLinhaAluno(a, statusFinal) {
      const copia = {};
      Object.keys(a || {}).forEach(k => { if (k !== 'acionamentos' && k !== '_full') copia[k] = a[k]; });
      let json = JSON.stringify(copia);
      if (json.length > 45000) json = json.substring(0, 45000); // limite de célula do Sheets
      return [
        a.id, a.nome, a.matricula, a.cpfDigitado || a.cpf || '',
        a.telefone || '', a.email || '', a.curso || '',
        a.bu || a.modalidade || '',
        a.periodoAtual || a.periodoCSV || '',
        a.modalidade || '',
        a.periodo || a.periodoAluno || '',
        a.totalPeriodos || '', a.faltaCursar || 0,
        a.safra || '', a.condicao || '', a.divTotal || 0, a.faixaDivida || '', a.tipoInad || '',
        a.criticidadeFin || '', a.criticidadeAcad || '', a.formando ? 'S' : 'N',
        statusFinal,
        a.cobDesconto ? 'S' : 'N', a.cobAptoDesc ? 'S' : 'N',
        a.propensao || '', new Date().toISOString(),
        a.ciclo || '', json,
      ];
    }

    function garantirAbaAlunos(ss, nomeAba) {
      let aba = ss.getSheetByName(nomeAba);
      const h = getHeadersAlunos();
      if (!aba) {
        aba = ss.insertSheet(nomeAba);
        aba.getRange(1, 1, 1, h.length).setValues([h])
          .setFontWeight('bold').setBackground('#0A3D8F').setFontColor('#FFFFFF').setFontSize(11);
        aba.setFrozenRows(1);
      } else {
        const atual = aba.getRange(1, 1, 1, h.length).getValues()[0];
        if (h.some((nome, i) => atual[i] !== nome)) aba.getRange(1, 1, 1, h.length).setValues([h]);
      }
      return aba;
    }

    /** Aba "Alunos" = soma de todos os ciclos (sem a coluna Dados), para relatórios. */
    function atualizarAbaConsolidada(ss) {
      try {
        const cons = garantirAbaAlunos(ss, 'Alunos');
        const lastRow = cons.getLastRow();
        if (lastRow > 1) cons.getRange(2, 1, lastRow - 1, Math.max(cons.getLastColumn(), COL_DADOS)).clearContent();
        let todas = [];
        abasCiclo(ss).forEach(o => {
          const n = o.aba.getLastRow() - 1;
          if (n <= 0) return;
          todas = todas.concat(o.aba.getRange(2, 1, n, COL_CICLO).getValues().filter(r => r[0]));
        });
        if (todas.length) {
          cons.getRange(2, 1, todas.length, COL_CICLO).setValues(todas);
          colorirPorStatus(cons, todas.length);
        }
        salvarConfigKey('total_alunos', String(todas.length));
      } catch(e) {
        log('AVISO', 'Erro ao consolidar: ' + e.message, 'Sistema');
      }
    }

    function colorirPorStatus(aba, totalLinhas) {
      if (totalLinhas < 1) return;
      const dados = aba.getRange(2, COL_STATUS, totalLinhas, 1).getValues();
      const cor = s => s === 'Renovado' ? '#EAFAF1' : s === 'Em negociação' ? '#FEF5E7'
                     : (s === 'Evadido' || s === 'Trancamento') ? '#F0F0F0' : '#FDECEB';
      const larg = COL_CICLO;
      aba.getRange(2, 1, totalLinhas, larg).setBackgrounds(dados.map(([s]) => Array(larg).fill(cor(s))));
    }

    /** Abas onde procurar o aluno: só a do ciclo (se informado) + consolidada. */
    function abasParaAluno(ss, ciclo) {
      ciclo = normCiclo(ciclo || '');
      const lista = abasCiclo(ss).filter(o => !ciclo || o.ciclo === ciclo).map(o => o.aba);
      const cons = ss.getSheetByName('Alunos');
      if (cons) lista.push(cons);
      return lista;
    }

    function salvarAluno(aluno) {
      if (!aluno || !aluno.id) return { ok: false, erro: 'Aluno inválido.' };
      const ss = getSpreadsheet();
      let salvo = false;
      abasParaAluno(ss, aluno.ciclo).forEach(aba => {
        const n = aba.getLastRow() - 1;
        if (n <= 0) return;
        const ids = aba.getRange(2, 1, n, 1).getValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(aluno.id)) {
            const linha = montarLinhaAluno(aluno, aluno.status);
            const larg = aba.getName() === 'Alunos' ? COL_CICLO : COL_DADOS;
            aba.getRange(i + 2, 1, 1, larg).setValues([linha.slice(0, larg)]);
            salvo = true;
          }
        }
      });
      return salvo ? { ok: true } : { ok: false, erro: 'Aluno não encontrado: ' + aluno.id };
    }

    function atualizarStatus(alunoId, novoStatus, ciclo) {
      const ss = getSpreadsheet();
      let atualizado = false;
      abasParaAluno(ss, ciclo).forEach(aba => {
        const n = aba.getLastRow() - 1;
        if (n <= 0) return;
        const ids = aba.getRange(2, 1, n, 1).getValues(); // só a coluna ID (rápido)
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(alunoId)) {
            aba.getRange(i + 2, COL_STATUS).setValue(novoStatus);
            aba.getRange(i + 2, COL_ULT_AT).setValue(new Date().toISOString());
            atualizado = true;
          }
        }
      });
      return atualizado ? { ok: true } : { erro: 'Aluno não encontrado: ' + alunoId };
    }

    function listarAlunos(params) {
      const ss = getSpreadsheet();
      const ciclo = normCiclo(params.ciclo || '');
      const aba = ss.getSheetByName(ciclo ? nomeAbaCiclo(ciclo) : (params.aba || 'Alunos'));
      if (!aba || aba.getLastRow() <= 1) return { alunos: [], total: 0 };
      const n = aba.getLastRow() - 1;
      const headers = aba.getRange(1, 1, 1, COL_CICLO).getValues()[0];
      let alunos = aba.getRange(2, 1, n, COL_CICLO).getValues().map(row => {
        const o = {}; headers.forEach((h, i) => o[h] = row[i]); return o;
      });
      if (params.status)      alunos = alunos.filter(a => a['Status'] === params.status);
      if (params.criticidade) alunos = alunos.filter(a => a['Crit. Financeira'] === params.criticidade);
      if (params.busca) {
        const b = String(params.busca).toLowerCase();
        alunos = alunos.filter(a => String(a['Nome']).toLowerCase().includes(b) || String(a['Matrícula']).includes(params.busca));
      }
      return { alunos, total: alunos.length };
    }

    // ============================================================
    // 👥  ATENDENTES
    // ============================================================
    function salvarAtendentes(lista) {
      // Usado pelas telas antigas (renomear, desativar, conta meta). Mantém e-mail
      // e senha de cada pessoa: casa primeiro pelo e-mail, depois pelo nome.
      if (!lista || !Array.isArray(lista)) return { ok: false, erro: 'Lista inválida.' };
      var lock = bloqueio_(15000);
      try {
        const atuais = lerUsuarios();
        const novos = lista.filter(at => at && at.nome).map(at => {
          const ant = (at.email && atuais.find(x => x.email === emailNorm(at.email)))
                   || atuais.find(x => normNome(x.nome) === normNome(at.nome)) || {};
          return {
            nome: at.nome, perfil: PERFIS_VALIDOS.includes(at.perfil) ? at.perfil : (ant.perfil || 'atendente'),
            equipe: at.equipe || ant.equipe || '', ativo: !!at.ativo, contaMeta: at.contaMeta !== false,
            email: ant.email || emailNorm(at.email), hash: ant.hash || '', salt: ant.salt || '',
            trocarSenha: !!ant.trocarSenha, ultimoLogin: ant.ultimoLogin || '',
          };
        });
        // Administradores nunca somem por uma lista incompleta vinda da tela
        atuais.filter(u => u.perfil === 'admin' && !novos.some(n => n.email && n.email === u.email)).forEach(u => novos.push(u));
        gravarUsuarios(novos);
        novos.filter(u => !u.ativo && u.email).forEach(u => limparSessoes(u.email));
        return { ok: true, total: novos.length };
      } finally { lock.releaseLock(); }
    }

    function carregarAtendentes() {
      // equipe e meta continuam vindo da aba Atendentes da Renovação (pelo e-mail ou pelo nome)
      const antigos = {};
      lerUsuarios().forEach(u => { if (u.email) antigos[u.email] = u; antigos['n:' + normNome(u.nome)] = u; });
      const lista = listaUsuarios_().filter(u => u.ativo && podeSistema_(u, 'renovacao')).map(u => {
        const a = antigos[u.email] || antigos['n:' + normNome(u.nome)] || {};
        return { nome: u.nome, perfil: PERFIS_VALIDOS.includes(u.perfil) ? u.perfil : (u.perfil === 'admin' ? 'admin' : 'atendente'),
                 equipe: a.equipe || '', ativo: u.ativo, contaMeta: a.contaMeta !== false, email: u.email,
                 temSenha: true, trocarSenha: false, ultimoLogin: '' };
      });
      return { ok: true, atendentes: lista };
    }

    // ============================================================
    // 📋  ACIONAMENTOS
    // ============================================================
    function garantirColunaCicloAcionamentos(aba) {
      const props = propsRenovacao_();
      if (props.getProperty('colCicloAcOk') === 'true') return;
      try {
        if (aba.getRange(1, COL_AC_CICLO).getValue() !== 'Ciclo') {
          aba.getRange(1, COL_AC_CICLO).setValue('Ciclo').setFontWeight('bold').setBackground('#0A3D8F').setFontColor('#FFFFFF');
        }
        props.setProperty('colCicloAcOk', 'true');
      } catch(e) {}
    }

    function garantirFormatoDatasSeguro(aba) {
      const props = propsRenovacao_();
      if (props.getProperty('formatoDatasOk') === 'true') return;
      try {
        aba.getParent().setSpreadsheetLocale('pt_BR');
        aba.getRange('G:G').setNumberFormat('@');
        aba.getRange('K:K').setNumberFormat('@');
        props.setProperty('formatoDatasOk', 'true');
      } catch(e) { Logger.log('Aviso: garantirFormatoDatasSeguro falhou: ' + e.message); }
    }

    function salvarAcionamento(ac) {
      if (!ac || !ac.alunoId) return { ok: false, erro: 'Dados de acionamento inválidos.' };
      var lock = bloqueio_(15000);
      try {
        const ss  = getSpreadsheet();
        const aba = ss.getSheetByName('Acionamentos');
        garantirFormatoDatasSeguro(aba);
        garantirColunaCicloAcionamentos(aba);
        const agora = new Date();
        const idStr = String(ac.id || agora.getTime());

        // Duplicata por ID (lê só a coluna de IDs)
        const n = aba.getLastRow() - 1;
        if (n > 0) {
          const ids = aba.getRange(2, 1, n, 1).getValues();
          for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === idStr) return { ok: true, acao: 'ja_existe', id: idStr };
        }

        const ciclo = normCiclo(ac.ciclo || '');
        if (ac.stAl) atualizarStatus(ac.alunoId, ac.stAl, ciclo);

        const tsAgora = agora.getTime();
        // Grava como TEXTO: sem isso a planilha converte "2026.4" em data e
        // "20/10/2026" em outro formato, e o acionamento some dos filtros de quem lê depois.
        const linha = aba.getLastRow() + 1;
        aba.getRange(linha, 1, 1, 15).setNumberFormat('@');
        aba.getRange(linha, 13).setNumberFormat('0');
        aba.getRange(linha, 1, 1, 15).setValues([[
          idStr, String(ac.alunoId), ac.nomeAluno || '', ac.colab || '', ac.tipo || '', ac.obs || '',
          ac.fuData || '', ac.fuTipo || '', ac.fuData ? 'Agendado' : 'OK', ac.stAl || '',
          Utilities.formatDate(agora, tzScript(), 'dd/MM/yyyy'), Utilities.formatDate(agora, tzScript(), 'HH:mm:ss'), tsAgora,
          ac.fuPara || ac.colab || '', ciclo,
        ]]);
        log('ACIONAMENTO', `${ac.tipo} · aluno ${ac.alunoId} · ciclo ${ciclo || '?'}`, ac.colab);
        return { ok: true, id: idStr, ts: tsAgora };
      } finally { lock.releaseLock(); }
    }

    function removerAcionamentosDuplicados() {
      const aba = getSpreadsheet().getSheetByName('Acionamentos');
      if (!aba || aba.getLastRow() <= 1) return { ok: true, removidos: 0 };
      const dados = aba.getDataRange().getValues();
      const headers = dados[0];
      const idxTs = headers.indexOf('_ts');
      const corpo = dados.slice(1).sort((a, b) => (a[idxTs] || 0) - (b[idxTs] || 0));
      const vistos = {}, manter = [headers];
      let removidos = 0;
      corpo.forEach(row => {
        const chave = [row[1], row[3], row[5], row[6], row[4]].join('|');
        if (vistos[chave]) { removidos++; return; }
        vistos[chave] = true; manter.push(row);
      });
      if (removidos > 0) {
        aba.clearContents();
        aba.getRange(1, 1, manter.length, headers.length).setValues(manter);
      }
      log('MANUTENÇÃO', removidos + ' acionamento(s) duplicado(s) removido(s)', 'Sistema');
      return { ok: true, removidos };
    }

    function listarAcionamentos(params) {
      const aba = getSpreadsheet().getSheetByName('Acionamentos');
      const dados = aba.getDataRange().getValues();
      if (dados.length <= 1) return { acionamentos: [] };
      const headers = dados[0];
      let lista = dados.slice(1).map(row => { const o = {}; headers.forEach((h, i) => o[h] = row[i]); return o; })
        .map(a => Object.assign({}, a, { 'Data': formatarDataBR(a['Data']), 'Follow-Up Data': formatarDataBR(a['Follow-Up Data']) }));
      if (params.alunoId)     lista = lista.filter(a => String(a['ID Aluno']) === String(params.alunoId));
      if (params.colaborador) lista = lista.filter(a => a['Colaborador'] === params.colaborador);
      if (params.data)        lista = lista.filter(a => a['Data'] === formatarDataBR(params.data));
      if (params.ciclo)       lista = lista.filter(a => normCiclo(a['Ciclo']) === normCiclo(params.ciclo));
      return { acionamentos: lista };
    }

    function concluirFollowUp(followupId) {
      const aba = getSpreadsheet().getSheetByName('Acionamentos');
      const n = aba.getLastRow() - 1;
      if (n <= 0) return { erro: 'Follow-up não encontrado: ' + followupId };
      const ids = aba.getRange(2, 1, n, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(followupId)) {
          aba.getRange(i + 2, 9).setValue('OK');
          return { ok: true };
        }
      }
      return { erro: 'Follow-up não encontrado: ' + followupId };
    }

    // ============================================================
    // 📤  ENVIOS
    // ============================================================
    function registrarEnvio(env) {
      if (!env) return { ok: false, erro: 'Dados de envio inválidos.' };
      const aba = getSpreadsheet().getSheetByName('Envios');
      if (aba.getRange(1, COL_ENV_CICLO).getValue() !== 'Ciclo') aba.getRange(1, COL_ENV_CICLO).setValue('Ciclo').setFontWeight('bold');
      aba.appendRow([
        new Date().toISOString(), env.canal || '',
        env.alunoEmail || env.alunoTel || env.destino || '',
        env.assunto || '', String(env.preview || env.msg || '').substring(0, 200),
        env.status || 'enviado', env.colab || '', env.alunoId || '', env.tplNome || '',
        normCiclo(env.ciclo || ''),
      ]);
      return { ok: true };
    }

    function listarEnvios(params) {
      const aba = getSpreadsheet().getSheetByName('Envios');
      if (!aba || aba.getLastRow() <= 1) return { envios: [] };
      const dados = aba.getDataRange().getValues();
      const headers = dados[0];
      let envios = dados.slice(1).map(row => { const o = {}; headers.forEach((h, i) => o[h] = row[i]); return o; });
      if (params && params.ciclo) envios = envios.filter(e => normCiclo(e['Ciclo']) === normCiclo(params.ciclo));
      return { envios, total: envios.length };
    }

    // ============================================================
    // ✉️  E-MAIL
    // ============================================================
    function enviarEmail(d) {
      const destino = d.destino || '';
      const assunto = d.assunto || 'Estácio — Renovação de Matrícula';
      const corpo   = d.corpo   || '';
      if (!destino || !destino.includes('@')) return { ok: false, erro: 'E-mail de destino inválido: ' + destino };
      const props = propsRenovacao_();
      const usarGmail = props.getProperty('smtp_usar_gmail') !== 'false';
      try {
        if (usarGmail) {
          GmailApp.sendEmail(destino, assunto, corpo, { name: props.getProperty('smtp_nome') || SMTP_CONFIG.nomeRem, htmlBody: corpoHtml(corpo, assunto) });
        } else {
          enviarViaMailjet(destino, assunto, corpo, props);
        }
        registrarEnvio({ canal: 'email', destino, assunto, preview: corpo.substring(0, 120), status: 'enviado', ciclo: d.ciclo });
        return { ok: true, destino, modo: usarGmail ? 'gmail' : 'smtp' };
      } catch(err) {
        log('ERRO EMAIL', destino, err.message);
        return { ok: false, erro: err.message };
      }
    }

    function enviarViaMailjet(destino, assunto, corpo, props) {
      const apiKey = props.getProperty('mailjet_api_key') || '', apiSecret = props.getProperty('mailjet_api_secret') || '';
      const remetente = props.getProperty('smtp_usuario') || '', nomeRem = props.getProperty('smtp_nome') || 'Estácio Volta Redonda';
      if (!apiKey || !apiSecret) throw new Error('Credenciais Mailjet não configuradas.');
      const resp = UrlFetchApp.fetch('https://api.mailjet.com/v3.1/send', {
        method: 'post', contentType: 'application/json',
        headers: { Authorization: 'Basic ' + Utilities.base64Encode(apiKey + ':' + apiSecret) },
        payload: JSON.stringify({ Messages: [{ From: { Email: remetente, Name: nomeRem }, To: [{ Email: destino }], Subject: assunto, TextPart: corpo, HTMLPart: corpoHtml(corpo, assunto) }] }),
        muteHttpExceptions: true,
      });
      const result = JSON.parse(resp.getContentText());
      if (resp.getResponseCode() !== 200 || !(result.Messages && result.Messages[0] && result.Messages[0].Status === 'success'))
        throw new Error('Mailjet: ' + JSON.stringify(result));
    }

    function corpoHtml(texto, assunto) {
      const linhas = String(texto).split('\n').map(l => `<p style="margin:0 0 8px 0;line-height:1.6">${l || '&nbsp;'}</p>`).join('');
      return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6FA;font-family:Arial,sans-serif">
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
      <tr><td style="background:#0A3D8F;padding:20px 28px">
        <p style="margin:0;color:#fff;font-size:18px;font-weight:700">Estácio · Volta Redonda</p>
        <p style="margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px">Sistema de Renovação de Matrícula</p>
      </td></tr>
      <tr><td style="padding:28px;color:#1A2340;font-size:14px">${linhas}</td></tr>
      <tr><td style="background:#F4F6FA;padding:16px 28px;text-align:center;font-size:11px;color:#6B7A99">
        Estácio Volta Redonda. Em caso de dúvidas, entre em contato pelo WhatsApp ou ligue para a unidade.
      </td></tr>
    </table></td></tr></table></body></html>`;
    }

    function testarEmail(d) {
      return enviarEmail({
        destino: d.destino, assunto: '[TESTE] Sistema Estácio — Renovação de Matrícula',
        corpo: `E-mail de TESTE do Sistema de Acionamento.\n\nEnviado em ${new Date().toLocaleString('pt-BR')} por ${d.colab || 'Administrador'}.`,
      });
    }

    function salvarSMTP(d) {
      const props = propsRenovacao_();
      if (d.host) props.setProperty('smtp_host', d.host);
      if (d.port) props.setProperty('smtp_port', String(d.port));
      if (d.user) props.setProperty('smtp_usuario', d.user);
      if (d.pass) props.setProperty('smtp_senha', d.pass);
      if (d.nome) props.setProperty('smtp_nome', d.nome);
      props.setProperty('smtp_usar_gmail', d.usarGmail === false ? 'false' : 'true');
      if (d.mailjetKey) props.setProperty('mailjet_api_key', d.mailjetKey);
      if (d.mailjetSecret) props.setProperty('mailjet_api_secret', d.mailjetSecret);
      return { ok: true, modo: d.usarGmail === false ? 'smtp/mailjet' : 'gmail' };
    }

    // ============================================================
    // 📱  SMS
    // ============================================================
    function enviarSMS(d) {
      const destino = String(d.destino || '').replace(/\D/g, '');
      const msg = String(d.msg || '').substring(0, 160);
      if (!destino || destino.length < 10) return { ok: false, erro: 'Número inválido: ' + destino };
      const props = propsRenovacao_();
      const provedor = d.prov || props.getProperty('sms_provedor') || SMS_CONFIG.provedor;
      const token = d.token || props.getProperty('sms_token') || '';
      try {
        let resultado;
        if (provedor === 'zenvia') resultado = enviarSMSZenvia(destino, msg, token);
        else if (provedor === 'twilio') resultado = enviarSMSTwilio(destino, msg, props);
        else throw new Error('Provedor desconhecido: ' + provedor);
        registrarEnvio({ canal: 'sms', alunoTel: destino, preview: msg, status: 'enviado', ciclo: d.ciclo });
        return { ok: true, destino, provedor, detalhe: resultado };
      } catch(err) { return { ok: false, erro: err.message }; }
    }

    function enviarSMSZenvia(destino, msg, token) {
      if (!token) throw new Error('Token Zenvia não configurado.');
      const numero = destino.length === 11 ? '55' + destino : destino;
      const resp = UrlFetchApp.fetch('https://api.zenvia.com/v2/channels/sms/messages', {
        method: 'post', contentType: 'application/json', headers: { 'X-API-TOKEN': token },
        payload: JSON.stringify({ from: SMS_CONFIG.zenviaFrom, to: numero, contents: [{ type: 'text', text: msg }] }),
        muteHttpExceptions: true,
      });
      const code = resp.getResponseCode(), body = resp.getContentText();
      if (code < 200 || code >= 300) throw new Error(`Zenvia HTTP ${code}: ${body}`);
      return JSON.parse(body);
    }

    function enviarSMSTwilio(destino, msg, props) {
      const sid = props.getProperty('twilio_sid') || SMS_CONFIG.twilioSid;
      const token = props.getProperty('twilio_token') || SMS_CONFIG.twilioToken;
      const from = props.getProperty('twilio_from') || SMS_CONFIG.twilioFrom;
      if (!sid || !token || !from) throw new Error('Credenciais Twilio não configuradas.');
      const resp = UrlFetchApp.fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'post', headers: { Authorization: 'Basic ' + Utilities.base64Encode(`${sid}:${token}`) },
        payload: { From: from, To: '+55' + destino.replace(/^55/, ''), Body: msg }, muteHttpExceptions: true,
      });
      const code = resp.getResponseCode(), body = resp.getContentText();
      if (code < 200 || code >= 300) throw new Error(`Twilio HTTP ${code}: ${body}`);
      return JSON.parse(body);
    }

    // ============================================================
    // 📥  IMPORTAÇÃO DO GOOGLE DRIVE (opcional) — ciclo lido do CSV
    // ============================================================
    function importarTodosDrive() {
      const resultados = DRIVE_ARQUIVOS.map(cfg => importarUmArquivoDrive(cfg.nomeArquivo));
      salvarConfigKey('ultima_importacao_drive', new Date().toLocaleString('pt-BR'));
      return { ok: true, resultados };
    }

    function importarUmArquivoDrive(nomeArquivo) {
      const cfgArq = DRIVE_ARQUIVOS.find(c => c.nomeArquivo === nomeArquivo) || DRIVE_ARQUIVOS[0];
      try {
        const arqs = cfgArq.pastaId
          ? DriveApp.getFolderById(cfgArq.pastaId).getFilesByName(cfgArq.nomeArquivo)
          : DriveApp.getFilesByName(cfgArq.nomeArquivo);
        if (!arqs.hasNext()) throw new Error(`Arquivo "${cfgArq.nomeArquivo}" não encontrado no Drive.`);
        const arquivo = arqs.next();
        const alunos = parsearCSV(arquivo.getBlob().getDataAsString('ISO-8859-1'));
        if (!alunos.length) throw new Error('CSV sem alunos.');
        const cont = {};
        alunos.forEach(a => { if (a.ciclo) cont[a.ciclo] = (cont[a.ciclo] || 0) + 1; });
        const ciclo = Object.keys(cont).sort((x, y) => cont[y] - cont[x])[0];
        return importarAlunos(alunos, ciclo);
      } catch(err) {
        return { ok: false, arquivo: cfgArq.nomeArquivo, erro: err.message };
      }
    }

    function parsearCSV(texto) {
      const linhas = texto.split(/\r?\n/).filter(Boolean);
      if (linhas.length < 2) return [];
      const sep = linhas[0].includes('\t') ? '\t' : linhas[0].includes(';') ? ';' : ',';
      function parseLinha(linha) {
        const r = []; let cur = ''; let inQ = false;
        for (const c of linha) {
          if (c === '"') inQ = !inQ;
          else if (c === sep && !inQ) { r.push(cur.trim()); cur = ''; }
          else cur += c;
        }
        r.push(cur.trim()); return r;
      }
      const headers = parseLinha(linhas[0]).map(h => h.trim().replace(/^"|"$/g, ''));
      const alunos = [];
      for (let i = 1; i < linhas.length; i++) {
        if (!linhas[i].trim()) continue;
        const vals = parseLinha(linhas[i]);
        const row = {};
        headers.forEach((h, j) => row[h] = (vals[j] || '').trim().replace(/^"|"$/g, ''));
        if (!row['COD_MATRICULA'] && !row['NOM_ALUNO']) continue;
        alunos.push(converterLinha(row));
      }
      return alunos;
    }

    function parseFloat2(v) {
      try { const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.eE+-]/g, '')); return isNaN(n) ? 0 : n; }
      catch(e) { return 0; }
    }

    function converterLinha(row) {
      const divTotal = parseFloat2(row['VAL_DIVIDA_TOTAL']);
      const risco = String(row['RISCO_INADIMPLENCIA'] || '').toUpperCase();
      const crit = risco === 'ALTO' || divTotal > 1500 ? 'Alta' : risco === 'MÉDIO' || divTotal > 500 ? 'Média' : 'Baixa';
      const cond = String(row['CONDICAO_IMPEDE_RENOVACAO'] || '').toUpperCase();
      const tipoInad = row['TIPO_INADIMPLENCIA'] || '';
      const faixaDiv = row['FAIXA_DE_DIVIDA'] || '0';
      let status = 'Pendente';
      if (cond.includes('RENOVADO')) status = 'Renovado';
      else if (cond.includes('CANCELAD') || cond.includes('EVADID')) status = 'Evadido';
      else if (cond.includes('TRANCAD')) status = 'Trancamento';
      if (tipoInad.toUpperCase().includes('NEGOCIACAO') && status === 'Pendente') status = 'Em negociação';
      const tel = String(row['NUM_TELEF_CELULAR'] || '').replace(/\D/g, '');
      const matStr = String(row['COD_MATRICULA'] || '').trim();
      const matNum = Math.round(parseFloat2(matStr));
      const matId = matNum > 0 ? String(matNum) : matStr;
      return {
        id: matId, matricula: matId, nome: row['NOM_ALUNO'] || '', email: row['END_EMAIL'] || '',
        celularOriginal: row['NUM_TELEF_CELULAR'] || '', telefone: tel ? '+55' + tel : '',
        curso: row['NOM_CURSO'] || '', bu: row['BU'] || '', modalidade: row['MODALIDADE_PP_PC'] || '',
        periodo: parseInt(String(row['ID_PERIODO_ALUNO'] || '1').split('.')[0]) || 1,
        totalPeriodos: parseInt(String(row['QTD_PERIODOS_MINIMO'] || '8').split('.')[0]) || 8,
        faltaCursar: parseInt(parseFloat2(row['QTD_DISCIP_FALTA_CURSAR'])), safra: row['SAFRA'] || '',
        condicao: row['CONDICAO_IMPEDE_RENOVACAO'] || '', divTotal, divMens: parseFloat2(row['VAL_DIVIDA_MENS']),
        faixaDivida: faixaDiv === '0' ? 'Sem dívida' : faixaDiv, tipoInad, risco, criticidadeFin: crit,
        criticidadeAcad: row['PROPENSAO_RENOVACAO'] || '', propensao: row['PROPENSAO_RENOVACAO'] || '',
        faixaAprov: row['FAIXA_APROVACAO'] || '', situacaoPeriodo: row['NOM_SITUACAO_PERIODO_ATUAL'] || '',
        periodoAtual: row['PERIODO_ATUAL'] || '', turno: row['NOM_TURNO'] || '',
        formando: String(row['PROVAVEL_FORMANDO'] || '0').trim() === '1',
        vaValor: parseFloat2(row['VAL_A_PAGAR']), bolVencto: (row['DT_VENCIMENTO'] || '').trim(),
        // PAR traz o ciclo em PERIODO_ATUAL ("2026.2 EAD"); ÍMPAR traz em PERIODO ("26.3")
        ciclo: normCiclo(row['PERIODO_ATUAL'] || row['PERIODO'] || ''),
        statusCsv: status, status,
      };
    }

    // ============================================================
    // 📊  DASHBOARD / RELATÓRIOS (usam a aba consolidada "Alunos")
    // ============================================================
    function formatarDataBR(valor) {
      if (valor instanceof Date) {
        if (isNaN(valor.getTime())) return '';
        return Utilities.formatDate(valor, 'America/Sao_Paulo', 'dd/MM/yyyy');
      }
      const s = String(valor || '').trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return m[3] + '/' + m[2] + '/' + m[1];
      return s;
    }

    function parseDataCelula(valor) {
      if (valor instanceof Date && !isNaN(valor.getTime())) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
      const s = String(valor || '').trim();
      if (!s) return null;
      let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
      m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      const t = new Date(s);
      return isNaN(t.getTime()) ? null : t;
    }

    function getDashboard() {
      const ss = getSpreadsheet();
      const abaAl = ss.getSheetByName('Alunos'), abaAc = ss.getSheetByName('Acionamentos');
      const dadosAl = abaAl && abaAl.getLastRow() > 1 ? abaAl.getRange(1, 1, abaAl.getLastRow(), COL_CICLO).getValues() : [];
      const dadosAc = abaAc ? abaAc.getDataRange().getValues() : [];
      const statusCount = { Pendente: 0, 'Em negociação': 0, Renovado: 0, Evadido: 0, Trancamento: 0 };
      const buCount = {};
      dadosAl.slice(1).forEach(row => {
        const s = row[COL_STATUS - 1]; if (statusCount.hasOwnProperty(s)) statusCount[s]++;
        buCount[row[7]] = (buCount[row[7]] || 0) + 1;
      });
      const hoje = new Date().toLocaleDateString('pt-BR');
      const colab = {};
      dadosAc.slice(1).forEach(row => {
        const n = row[3];
        if (!colab[n]) colab[n] = { total: 0, hoje: 0, renovados: 0, semana: 0 };
        colab[n].total++;
        if (formatarDataBR(row[10]) === hoje) colab[n].hoje++;
        if (row[9] === 'Renovado') colab[n].renovados++;
        const dt = parseDataCelula(row[10]);
        if (dt && (new Date() - dt) / 86400000 <= 7) colab[n].semana++;
      });
      const total = Math.max(0, dadosAl.length - 1);
      return { status: statusCount, buCount, total, taxaConversao: total ? Math.round(statusCount.Renovado / total * 100) : 0,
               colaboradores: colab, config: getConfig(), timestamp: new Date().toISOString() };
    }

    function getDashboardPeriodos() {
      const ss = getSpreadsheet();
      const periodos = {};
      abasCiclo(ss).forEach(o => {
        const n = o.aba.getLastRow() - 1;
        const statusCount = { Pendente: 0, 'Em negociação': 0, Renovado: 0, Evadido: 0, Trancamento: 0 };
        const buCount = {};
        if (n > 0) o.aba.getRange(2, 1, n, COL_CICLO).getValues().forEach(row => {
          const s = row[COL_STATUS - 1]; if (statusCount.hasOwnProperty(s)) statusCount[s]++;
          buCount[row[7]] = (buCount[row[7]] || 0) + 1;
        });
        periodos[o.ciclo] = { ciclo: o.ciclo, total: Math.max(0, n), status: statusCount, bu: buCount,
                              taxaConversao: n > 0 ? Math.round(statusCount.Renovado / n * 100) : 0 };
      });
      return { periodos, timestamp: new Date().toISOString() };
    }

    function getVelocidade() {
      const abaAc = getSpreadsheet().getSheetByName('Acionamentos');
      if (!abaAc || abaAc.getLastRow() <= 1) return { velocidade7d: 0, renovadosPorDia: {} };
      const renovadosPorDia = {};
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      abaAc.getDataRange().getValues().slice(1).forEach(row => {
        if (row[9] !== 'Renovado') return;
        const dt = parseDataCelula(row[10]);
        if (!dt || (hoje - dt) / 86400000 > 30) return;
        const key = formatarDataBR(row[10]);
        renovadosPorDia[key] = (renovadosPorDia[key] || 0) + 1;
      });
      const ult7 = Object.entries(renovadosPorDia).filter(([k]) => { const d = parseDataCelula(k); return d && (hoje - d) / 86400000 <= 7; });
      const totalUlt7 = ult7.reduce((s, [, v]) => s + v, 0);
      return { velocidade7d: ult7.length ? Math.round(totalUlt7 / Math.min(ult7.length, 7) * 10) / 10 : 0, renovadosPorDia, totalUltimos7Dias: totalUlt7 };
    }

    function getRankingColaboradores(params) {
      const abaAc = getSpreadsheet().getSheetByName('Acionamentos');
      if (!abaAc || abaAc.getLastRow() <= 1) return { ranking: [] };
      const hoje = new Date().toLocaleDateString('pt-BR');
      const colab = {};
      abaAc.getDataRange().getValues().slice(1).forEach(row => {
        if (params && params.ciclo && normCiclo(row[COL_AC_CICLO - 1]) !== normCiclo(params.ciclo)) return;
        const n = row[3]; if (!n) return;
        if (!colab[n]) colab[n] = { nome: n, total: 0, hoje: 0, semana: 0, renovados: 0, renovadosHoje: 0, followupsAbertos: 0 };
        colab[n].total++;
        if (formatarDataBR(row[10]) === hoje) { colab[n].hoje++; if (row[9] === 'Renovado') colab[n].renovadosHoje++; }
        if (row[9] === 'Renovado') colab[n].renovados++;
        if (row[8] === 'Agendado') colab[n].followupsAbertos++;
        const dt = parseDataCelula(row[10]);
        if (dt && (new Date() - dt) / 86400000 <= 7) colab[n].semana++;
      });
      return { ranking: Object.values(colab).sort((a, b) => b.renovados - a.renovados), total: Object.keys(colab).length };
    }

    function getAlunosSemAcionamento() {
      const ss = getSpreadsheet();
      const abaAl = ss.getSheetByName('Alunos'), abaAc = ss.getSheetByName('Acionamentos');
      if (!abaAl || abaAl.getLastRow() <= 1) return { alunos: [], total: 0 };
      const idsAcionados = new Set();
      if (abaAc && abaAc.getLastRow() > 1) abaAc.getRange(2, 2, abaAc.getLastRow() - 1, 1).getValues().forEach(r => idsAcionados.add(String(r[0])));
      const dados = abaAl.getRange(1, 1, abaAl.getLastRow(), COL_CICLO).getValues();
      const headers = dados[0];
      const semAc = dados.slice(1)
        .filter(row => row[0] && !idsAcionados.has(String(row[0])) && row[COL_STATUS - 1] === 'Pendente')
        .map(row => { const o = {}; headers.forEach((h, i) => o[h] = row[i]); return o; });
      return { alunos: semAc, total: semAc.length };
    }

    function getFollowUpsHoje() {
      const dados = getSpreadsheet().getSheetByName('Acionamentos').getDataRange().getValues();
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const fuHoje = [], fuAtras = [];
      dados.slice(1).forEach(row => {
        if (!row[6] || row[8] === 'OK' || row[8] === 'Concluído') return;
        const d = parseDataCelula(row[6]);
        if (!d) return;
        const item = { id: row[0], alunoId: row[1], nome: row[2], colab: row[3], tipo: row[7], data: formatarDataBR(row[6]), ciclo: normCiclo(row[COL_AC_CICLO - 1] || '') };
        if (d.getTime() === hoje.getTime()) fuHoje.push(item);
        else if (d < hoje) fuAtras.push(item);
      });
      return { hoje: fuHoje, atrasados: fuAtras, total: fuHoje.length + fuAtras.length };
    }
    // ============================================================
    // 👀  ACESSOS — quem entrou no sistema e por quanto tempo
    // ============================================================
    // O sistema manda um sinal ao abrir ("entrada") e, enquanto a pessoa está
    // mexendo na tela, um sinal a cada 5 minutos ("ativo"). Cada sinal ativo
    // conta como 5 minutos de uso. Uma linha por pessoa por dia na aba Acessos.
    const ACESSOS_HEADERS = ['Data', 'Colaborador', 'Primeiro acesso', 'Último sinal', 'Sinais ativos', 'Entradas', 'Ciclo', 'Última tela'];
    const MINUTOS_POR_SINAL = 5;

    function tzScript() { return 'America/Sao_Paulo'; }
    function hojeBR() { return Utilities.formatDate(new Date(), tzScript(), 'dd/MM/yyyy'); }
    function horaAgora() { return Utilities.formatDate(new Date(), tzScript(), 'HH:mm'); }
    function normNome(n) { return String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase(); }

    function garantirAbaAcessos(ss) {
      let aba = ss.getSheetByName('Acessos');
      if (!aba) {
        aba = ss.insertSheet('Acessos');
        aba.getRange(1, 1, 1, ACESSOS_HEADERS.length).setValues([ACESSOS_HEADERS])
          .setFontWeight('bold').setBackground('#0A3D8F').setFontColor('#FFFFFF');
        aba.setFrozenRows(1);
        aba.getRange('A:A').setNumberFormat('@');
        aba.getRange('C:D').setNumberFormat('@');
      }
      return aba;
    }

    function registrarAcesso(d) {
      const colab = String((d && d.colab) || '').trim() || 'Não identificado';
      const evento = d && d.evento === 'ativo' ? 'ativo' : 'entrada';
      var lock = bloqueio_(10000);
      try {
        const aba = garantirAbaAcessos(getSpreadsheet());
        const hoje = hojeBR(), hora = horaAgora();
        const n = aba.getLastRow() - 1;
        if (n > 0) {
          // Só olha os registros recentes (as linhas de hoje ficam no fim)
          const ini = Math.max(0, n - 300);
          const linhas = aba.getRange(2 + ini, 1, n - ini, ACESSOS_HEADERS.length).getValues();
          for (let i = linhas.length - 1; i >= 0; i--) {
            if (String(linhas[i][0]) === hoje && normNome(linhas[i][1]) === normNome(colab)) {
              const r = 2 + ini + i;
              aba.getRange(r, 4).setValue(hora);
              if (evento === 'ativo') aba.getRange(r, 5).setValue((parseInt(linhas[i][4]) || 0) + 1);
              else aba.getRange(r, 6).setValue((parseInt(linhas[i][5]) || 0) + 1);
              aba.getRange(r, 7, 1, 2).setValues([[normCiclo(d.ciclo || ''), String(d.tela || '')]]);
              return { ok: true };
            }
          }
        }
        aba.appendRow([hoje, colab, hora, hora, evento === 'ativo' ? 1 : 0, evento === 'ativo' ? 0 : 1, normCiclo(d.ciclo || ''), String(d.tela || '')]);
        return { ok: true, novo: true };
      } finally { lock.releaseLock(); }
    }

    // ============================================================
    // 📧  RELATÓRIO DIÁRIO DE PRODUTIVIDADE
    // ============================================================
    function emailRelatorioDestino() {
      try { const c = getConfig().email_relatorio; if (c && String(c).includes('@')) return String(c).trim(); } catch(e) {}
      return NOTIF_CONFIG.emailRelatorio;
    }

    function minutosParaTexto(min) {
      if (!min) return '—';
      const h = Math.floor(min / 60), m = min % 60;
      return h ? h + 'h' + (m ? String(m).padStart(2, '0') : '') : m + ' min';
    }

    /** Monta os números do dia. dataBR no formato dd/MM/yyyy (padrão: hoje). */
    function dadosRelatorioDia(dataBR) {
      const ss = getSpreadsheet();
      const dia = dataBR || hojeBR();
      const pessoas = {};
      const P = nome => {
        const k = normNome(nome) || 'nao identificado';
        if (!pessoas[k]) pessoas[k] = { nome: String(nome || 'Não identificado'), primeiro: '', ultimo: '', minutos: 0, entradas: 0,
          acionamentos: 0, renovados: 0, negociacao: 0, evadidos: 0, trancamentos: 0, fuAgendados: 0, fuAtrasados: 0, envios: 0, wpp: 0, email: 0 };
        return pessoas[k];
      };

      // Acessos do dia
      const abaAcs = ss.getSheetByName('Acessos');
      if (abaAcs && abaAcs.getLastRow() > 1) {
        abaAcs.getRange(2, 1, abaAcs.getLastRow() - 1, ACESSOS_HEADERS.length).getValues().forEach(r => {
          if (formatarDataBR(r[0]) !== dia) return;
          const p = P(r[1]);
          p.primeiro = String(r[2] || ''); p.ultimo = String(r[3] || '');
          p.minutos += (parseInt(r[4]) || 0) * MINUTOS_POR_SINAL;
          p.entradas += parseInt(r[5]) || 0;
        });
      }

      // Acionamentos do dia + follow-ups atrasados de cada pessoa
      const abaAc = ss.getSheetByName('Acionamentos');
      const dDia = parseDataCelula(dia);
      let totalAc = 0, totalRen = 0;
      if (abaAc && abaAc.getLastRow() > 1) {
        const dados = abaAc.getDataRange().getValues();
        const col = {}; dados[0].forEach((h, i) => col[h] = i);
        const I = (nome, pad) => (col[nome] !== undefined ? col[nome] : pad);
        const iColab = I('Colaborador', 3), iFuDt = I('Follow-Up Data', 6), iFuSt = I('Status Follow-Up', 8);
        const iStAl = I('Status Aluno', 9), iData = I('Data', 10), iFuPa = I('Follow-Up Para', 13), iObs = I('Observações', 5);
        dados.slice(1).forEach(r => {
          if (!r[0]) return;
          // Envio em lote gera um registro por aluno: já entra em "Envios", não em acionamentos
          const ehLote = /^envio em (lote|massa):/i.test(String(r[iObs] || '').trim());
          if (formatarDataBR(r[iData]) === dia && !ehLote) {
            const p = P(r[iColab]);
            p.acionamentos++; totalAc++;
            const st = String(r[iStAl] || '');
            if (st === 'Renovado') { p.renovados++; totalRen++; }
            else if (st === 'Em negociação') p.negociacao++;
            else if (st === 'Evadido') p.evadidos++;
            else if (st === 'Trancamento') p.trancamentos++;
            if (r[iFuDt]) p.fuAgendados++;
          }
          const fuSt = String(r[iFuSt] || '').trim();
          if (r[iFuDt] && fuSt !== 'OK' && fuSt !== 'Concluído') {
            const dFu = parseDataCelula(r[iFuDt]);
            if (dFu && dDia && dFu <= dDia) {
              const resp = String(r[iFuPa] || r[iColab] || '');
              if (pessoas[normNome(resp)]) pessoas[normNome(resp)].fuAtrasados++;
              else P(resp).fuAtrasados++;
            }
          }
        });
      }

      // Envios do dia (WhatsApp / e-mail registrados pelo sistema)
      const abaEnv = ss.getSheetByName('Envios');
      if (abaEnv && abaEnv.getLastRow() > 1) {
        abaEnv.getRange(2, 1, abaEnv.getLastRow() - 1, 7).getValues().forEach(r => {
          if (!r[0]) return;
          const dt = r[0] instanceof Date ? r[0] : new Date(r[0]);
          if (isNaN(dt.getTime()) || Utilities.formatDate(dt, tzScript(), 'dd/MM/yyyy') !== dia) return;
          if (!r[6]) return; // envio sem colaborador (ex.: teste de e-mail)
          const p = P(r[6]);
          p.envios++;
          if (r[1] === 'wpp') p.wpp++; else if (r[1] === 'email') p.email++;
        });
      }

      // Equipe cadastrada: quem está ativo e não apareceu
      const equipe = (carregarAtendentes().atendentes || []).filter(a => a.ativo);
      const semAcesso = equipe.filter(a => {
        const p = pessoas[normNome(a.nome)];
        return !p || (!p.entradas && !p.minutos && !p.primeiro && !p.acionamentos);
      });
      const perfilDe = {};
      equipe.forEach(a => perfilDe[normNome(a.nome)] = a.perfil || 'atendente');

      // Pessoas que só aparecem por follow-up atrasado (sem uso no dia) vão para a lista de pendências
      const ativos = Object.keys(pessoas).map(k => Object.assign({ chave: k, perfil: perfilDe[k] || '' }, pessoas[k]))
        .filter(p => p.primeiro || p.acionamentos || p.envios)
        .sort((a, b) => b.acionamentos - a.acionamentos || b.minutos - a.minutos);
      const pendFu = Object.keys(pessoas).map(k => pessoas[k]).filter(p => p.fuAtrasados > 0)
        .sort((a, b) => b.fuAtrasados - a.fuAtrasados);

      // Situação por ciclo (aba de cada ciclo)
      const ciclos = getDashboardPeriodos().periodos;

      return { dia, ativos, semAcesso, pendFu, ciclos, totalAc, totalRen,
               totalEnvios: ativos.reduce((s, p) => s + p.envios, 0) };
    }

    function htmlRelatorioDia(R) {
      const th = 'style="padding:7px 8px;background:#0A3D8F;color:#fff;font-size:12px;text-align:center"';
      const td = 'style="padding:6px 8px;border-bottom:1px solid #E3E8F2;font-size:12px;text-align:center"';
      const tdL = 'style="padding:6px 8px;border-bottom:1px solid #E3E8F2;font-size:12px;text-align:left"';
      const tdC = extra => 'style="padding:6px 8px;border-bottom:1px solid #E3E8F2;font-size:12px;text-align:center;' + extra + '"';
      const thL = 'style="padding:7px 8px;background:#0A3D8F;color:#fff;font-size:12px;text-align:left"';
      const kpi = (rot, val, cor) => `<td style="padding:10px;background:#F4F6FA;border-radius:8px;text-align:center;width:25%">
          <div style="font-size:22px;font-weight:700;color:${cor}">${val}</div><div style="font-size:11px;color:#6B7A99">${rot}</div></td>`;

      const linhas = R.ativos.map(p => `<tr>
          <td ${tdL}><strong>${p.nome}</strong>${p.perfil ? '<br><span style="color:#6B7A99;font-size:11px">' + p.perfil + '</span>' : ''}</td>
          <td ${td}>${p.primeiro || '—'}</td><td ${td}>${p.ultimo || '—'}</td><td ${td}>${minutosParaTexto(p.minutos)}</td>
          <td ${td}><strong>${p.acionamentos}</strong></td>
          <td ${tdC('color:#1E8449;font-weight:700')}>${p.renovados}</td>
          <td ${td}>${p.negociacao}</td><td ${td}>${p.evadidos}</td><td ${td}>${p.fuAgendados}</td>
          <td ${td}>${p.envios}${p.envios ? '<br><span style="color:#6B7A99;font-size:10px">' + p.wpp + ' WPP · ' + p.email + ' e-mail</span>' : ''}</td>
          <td ${tdC(p.fuAtrasados ? 'color:#C0392B;font-weight:700' : '')}>${p.fuAtrasados}</td>
        </tr>`).join('');

      const tabelaEquipe = R.ativos.length ? `
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:6px 0 18px">
          <tr><th ${thL}>Pessoa</th>
            <th ${th}>Entrou</th><th ${th}>Último sinal</th><th ${th}>Tempo ativo</th><th ${th}>Acion.</th><th ${th}>Renov.</th>
            <th ${th}>Negoc.</th><th ${th}>Evad.</th><th ${th}>Follow-ups agendados</th><th ${th}>Envios</th><th ${th}>Follow-ups em atraso</th></tr>
          ${linhas}
        </table>` : '<p style="color:#6B7A99">Ninguém acessou o sistema hoje.</p>';

      const semAcesso = R.semAcesso.length
        ? `<p style="margin:0 0 18px;padding:10px 12px;background:#FDECEB;border-radius:8px;font-size:13px"><strong style="color:#C0392B">Não acessaram hoje:</strong> ${R.semAcesso.map(a => a.nome).join(', ')}</p>`
        : '<p style="margin:0 0 18px;padding:10px 12px;background:#EAFAF1;border-radius:8px;font-size:13px;color:#1E8449">Toda a equipe ativa acessou o sistema hoje.</p>';

      const ciclos = Object.keys(R.ciclos).sort().reverse().slice(0, 4).map(c => {
        const p = R.ciclos[c];
        return `<tr><td ${tdL}>${c}</td><td ${td}>${p.total}</td><td ${tdC('color:#1E8449;font-weight:700')}>${p.status.Renovado}</td>
          <td ${td}>${p.status['Em negociação']}</td><td ${td}>${p.status.Pendente}</td><td ${td}>${p.taxaConversao}%</td></tr>`;
      }).join('');

      return `<div style="font-family:Arial,sans-serif;color:#1A2340">
        <h2 style="color:#0A3D8F;margin:0 0 4px">Relatório de produtividade · ${R.dia}</h2>
        <p style="margin:0 0 14px;color:#6B7A99;font-size:12px">Sistema de Renovação · Estácio Volta Redonda</p>
        <table cellpadding="0" cellspacing="6" style="width:100%;margin-bottom:14px"><tr>
          ${kpi('pessoas acessaram', R.ativos.filter(p => p.primeiro).length, '#0A3D8F')}
          ${kpi('acionamentos', R.totalAc, '#0A3D8F')}
          ${kpi('renovações registradas', R.totalRen, '#1E8449')}
          ${kpi('envios', R.totalEnvios, '#0A3D8F')}
        </tr></table>
        <h3 style="color:#0A3D8F;font-size:15px;margin:0 0 4px">Equipe no dia</h3>
        ${tabelaEquipe}
        ${semAcesso}
        ${ciclos ? `<h3 style="color:#0A3D8F;font-size:15px;margin:0 0 4px">Situação por ciclo</h3>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin:6px 0 14px">
          <tr><th ${thL}>Ciclo</th><th ${th}>Base</th><th ${th}>Renovados</th><th ${th}>Negociação</th><th ${th}>Pendentes</th><th ${th}>Taxa</th></tr>
          ${ciclos}</table>` : ''}
        <p style="font-size:11px;color:#6B7A99;margin-top:16px">Tempo ativo é aproximado: conta 5 minutos para cada sinal enviado enquanto a pessoa está mexendo no sistema. "Entrou" é o primeiro acesso do dia. Renovações aqui são as registradas no CRM; a base CSV pode ter outras.</p>
      </div>`;
    }

    /**
     * Envia o relatório do dia. Usado pelo gatilho diário e pelo botão do Admin.
     * forcar = true envia mesmo em dia sem movimento (envio manual).
     */
    function enviarRelatorioDiario(forcar) {
      const destino = emailRelatorioDestino();
      if (!destino) return { ok: false, erro: 'E-mail do relatório não configurado.' };
      const R = dadosRelatorioDia();
      if (forcar !== true && !R.ativos.length && !R.totalAc) {
        log('RELATÓRIO', 'Dia sem movimento, relatório não enviado', 'Sistema');
        return { ok: true, enviado: false, motivo: 'Dia sem movimento' };
      }
      const html = htmlRelatorioDia(R);
      const texto = 'Relatório de produtividade ' + R.dia + '\n\n' + R.ativos.map(p =>
        `${p.nome}: entrou ${p.primeiro || '—'}, tempo ativo ${minutosParaTexto(p.minutos)}, ${p.acionamentos} acionamentos, ${p.renovados} renovados`).join('\n')
        + (R.semAcesso.length ? '\n\nNão acessaram: ' + R.semAcesso.map(a => a.nome).join(', ') : '');
      GmailApp.sendEmail(destino, `[RenovaVR] Produtividade do dia ${R.dia}`, texto,
        { name: 'RenovaVR · Estácio Volta Redonda',
          htmlBody: '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head><body style="margin:0;padding:18px;background:#F4F6FA">'
            + '<div style="max-width:960px;margin:0 auto;background:#fff;border-radius:12px;padding:22px">' + html + '</div></body></html>' });
      log('RELATÓRIO', 'Relatório diário enviado para ' + destino, 'Sistema');
      return { ok: true, enviado: true, destino, pessoas: R.ativos.length, semAcesso: R.semAcesso.length };
    }

    /** Chamado pelo gatilho diário. */
    function relatoriosDiarios() { enviarRelatorioDiario(false); }

    /**
     * ▶ Rode UMA VEZ (Executar → ativarRelatorioDiario) para ligar o envio automático.
     * Remove só o gatilho antigo do relatório; os outros gatilhos ficam como estão.
     */
    function ativarRelatorioDiario() {
      ScriptApp.getProjectTriggers()
        .filter(t => t.getHandlerFunction() === 'renovacao_relatoriosDiarios')
        .forEach(t => ScriptApp.deleteTrigger(t));
      HORARIOS_RELATORIO.forEach(h => {
        ScriptApp.newTrigger('renovacao_relatoriosDiarios').timeBased()
          .onWeekDay(ScriptApp.WeekDay[h.dia]).atHour(h.hora).nearMinute(0)
          .inTimezone('America/Sao_Paulo').create();
      });
      garantirAbaAcessos(getSpreadsheet());
      Logger.log('✅ Relatório ativado para ' + emailRelatorioDestino() + ': ' +
        HORARIOS_RELATORIO.map(h => h.dia.substring(0, 3) + ' ' + h.hora + 'h').join(', '));
    }

    /** ▶ Teste: manda o relatório de hoje agora, mesmo sem movimento. */
    function testarRelatorioDiario() { Logger.log(JSON.stringify(enviarRelatorioDiario(true))); }

    function exportarCSV(params) {
      const ss = getSpreadsheet();
      const nomeAba = params.ciclo ? nomeAbaCiclo(normCiclo(params.ciclo)) : (params.aba || 'Alunos');
      const aba = ss.getSheetByName(nomeAba);
      if (!aba) return { ok: false, erro: 'Aba não encontrada: ' + nomeAba };
      const dados = aba.getRange(1, 1, aba.getLastRow(), Math.min(aba.getLastColumn(), COL_CICLO)).getValues();
      const csv = dados.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      return { ok: true, aba: nomeAba, csv };
    }

    // ============================================================
    // ⚙️  CONFIGURAÇÕES (chave/valor)
    // ============================================================
    function getConfig() {
      const aba = getSpreadsheet().getSheetByName('Configuracoes');
      if (!aba) return {};
      const cfg = {};
      aba.getDataRange().getValues().slice(1).forEach(row => { if (row[0]) cfg[row[0]] = row[1]; });
      return cfg;
    }

    function salvarConfigKey(chave, valor) {
      const aba = getSpreadsheet().getSheetByName('Configuracoes');
      const dados = aba.getDataRange().getValues();
      for (let i = 1; i < dados.length; i++) {
        if (dados[i][0] === chave) { aba.getRange(i + 1, 2).setValue(valor); return { ok: true }; }
      }
      aba.appendRow([chave, valor]);
      return { ok: true, acao: 'inserido' };
    }

    function removerConfigKey(chave) {
      const aba = getSpreadsheet().getSheetByName('Configuracoes');
      if (!aba) return { ok: true, removido: false };
      const dados = aba.getDataRange().getValues();
      for (let i = dados.length - 1; i >= 1; i--) {
        if (dados[i][0] === chave) { aba.deleteRow(i + 1); return { ok: true, removido: true }; }
      }
      return { ok: true, removido: false };
    }

    function removerConfigPorPrefixo(prefixo) {
      const aba = getSpreadsheet().getSheetByName('Configuracoes');
      if (!aba) return { ok: true, removidos: 0 };
      const dados = aba.getDataRange().getValues();
      let removidos = 0;
      for (let i = dados.length - 1; i >= 1; i--) {
        if (String(dados[i][0]).indexOf(prefixo) === 0) { aba.deleteRow(i + 1); removidos++; }
      }
      return { ok: true, removidos };
    }

    // ============================================================
    // 🔧  SETUP (só para planilha nova; a planilha atual já está configurada)
    // ============================================================
    function configurarPlanilha() {
      const ss = getSpreadsheet();
      try { ss.setSpreadsheetLocale('pt_BR'); } catch(e) {}
      const ABAS = {
        'Alunos': getHeadersAlunos(),
        'Acionamentos': ['ID Acionamento','ID Aluno','Nome Aluno','Colaborador','Tipo','Observações','Follow-Up Data','Follow-Up Tipo','Status Follow-Up','Status Aluno','Data','Hora','_ts','Follow-Up Para','Ciclo'],
        'Envios': ['Data/Hora','Canal','Destino','Assunto','Prévia','Status','Colaborador','ID Aluno','Template','Ciclo'],
        'Atendentes': ATEND_HEADERS,
        'Configuracoes': ['Chave','Valor'],
        'Log': ['Timestamp','Tipo','Descrição','Usuário'],
      };
      Object.entries(ABAS).forEach(([nome, headers]) => {
        let aba = ss.getSheetByName(nome);
        if (!aba) aba = ss.insertSheet(nome);
        if (aba.getLastRow() === 0) {
          aba.appendRow(headers);
          aba.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0A3D8F').setFontColor('#FFFFFF').setFontSize(11);
          aba.setFrozenRows(1);
        }
      });
      garantirAbaAcessos(ss);
      try {
        const abaAc = ss.getSheetByName('Acionamentos');
        abaAc.getRange('G:G').setNumberFormat('@');
        abaAc.getRange('K:K').setNumberFormat('@');
      } catch(e) {}
      Logger.log('✅ Planilha pronta: ' + ss.getUrl());
    }

    /** Mantido por compatibilidade: agora só (re)cria o gatilho do relatório diário. */
    function configurarGatilhos() { ativarRelatorioDiario(); }

    // ============================================================
    // 🛠️  UTILITÁRIOS
    // ============================================================
    function getSpreadsheet() { return planilhaDo_('renovacao'); }

    function log(tipo, desc, usuario) {
      try {
        getSpreadsheet().getSheetByName('Log').appendRow([new Date().toISOString(), tipo, String(desc).substring(0, 500), usuario || 'Sistema']);
      } catch(e) { Logger.log('[LOG FALHOU] ' + e.message); }
    }

    // ============================================================
    // 🧪  TESTE RÁPIDO (Executar → testarTudo)
    // ============================================================
    function testarTudo() {
      const ping = getPing();
      Logger.log('Ping: v' + ping.versao + ' · planilha_ok=' + ping.planilha_ok + ' · totalAlunos=' + ping.totalAlunos);
      Logger.log('Ciclos: ' + JSON.stringify(ping.totaisCiclo));
      const sync = getSync({ ts: '0' });
      Logger.log('Sync: ' + sync.novosAcionamentos.length + ' acionamentos');
    }

    // ============================================================
    // 🔐  LOGIN, SESSÕES E PERMISSÕES (v6.3)
    // ============================================================
    // • Cada pessoa entra com e-mail institucional + senha.
    // • A senha nunca é guardada: só um hash (SHA-256 repetido, com sal por
    //   usuário e um "tempero" secreto que fica nas propriedades do script).
    // • O login devolve um token que vale SESSAO_HORAS. Toda ação, menos
    //   ping e login, exige o token e confere o perfil no servidor.
    // • 5 senhas erradas seguidas bloqueiam o e-mail por 15 minutos.
    // • Desativar ou remover alguém derruba a sessão na hora (em até 1 min).
    const SESSAO_HORAS = 12;
    const PERFIS_VALIDOS = ['admin', 'coordenador', 'atendente', 'apoio'];
    const ADMIN_INICIAL = { email: 'marques.marcela@estacio.br', nome: 'Marcela Meneguelli' };

    const ATEND_HEADERS = ['Nome', 'Perfil', 'Equipe', 'Senha', 'Ativo', 'Conta Meta', 'Última Atualização',
                           'Email', 'Hash', 'Salt', 'Trocar Senha', 'Último Login'];

    const ACOES_PUBLICAS = ['ping', 'login'];
    // Só administrador
    const ACOES_ADMIN = ['salvar_atendentes', 'usuarios_listar', 'usuario_salvar', 'usuario_resetar_senha', 'usuario_remover',
      'remover_config', 'remover_duplicatas', 'salvar_smtp', 'testar_email', 'enviar_relatorio_diario'];
    // Administrador e coordenador
    const ACOES_GESTAO = ['importar_alunos', 'importar_drive', 'importar_drive_single', 'exportar_csv'];

    function emailNorm(e) { return String(e || '').trim().toLowerCase(); }

    function hexDe(bytes) { return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join(''); }

    function temperoSecreto() {
      const props = propsRenovacao_();
      let t = props.getProperty('auth_tempero');
      if (!t) { t = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('auth_tempero', t); }
      return t;
    }

    function hashSenha(senha, salt) {
      const tempero = temperoSecreto();
      let h = salt + '|' + String(senha) + '|' + tempero;
      for (let i = 0; i < 250; i++) h = hexDe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
      return h;
    }

    function senhaProvisoria() {
      const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz', num = '23456789';
      const pega = s => s.charAt(Math.floor(Math.random() * s.length));
      let p = '';
      for (let i = 0; i < 4; i++) p += pega(letras);
      p += '-';
      for (let i = 0; i < 4; i++) p += pega(i % 2 ? letras : num);
      return p;
    }

    // ── Aba de usuários (a mesma aba Atendentes, com colunas a mais) ──
    function garantirAbaUsuarios(ss) {
      ss = ss || getSpreadsheet();
      let aba = ss.getSheetByName('Atendentes');
      if (!aba) {
        aba = ss.insertSheet('Atendentes');
        aba.getRange(1, 1, 1, ATEND_HEADERS.length).setValues([ATEND_HEADERS])
          .setFontWeight('bold').setBackground('#0A3D8F').setFontColor('#FFFFFF');
        aba.setFrozenRows(1);
        return aba;
      }
      const atual = aba.getRange(1, 1, 1, ATEND_HEADERS.length).getValues()[0];
      if (ATEND_HEADERS.some((h, i) => atual[i] !== h)) {
        aba.getRange(1, 1, 1, ATEND_HEADERS.length).setValues([ATEND_HEADERS])
          .setFontWeight('bold').setBackground('#0A3D8F').setFontColor('#FFFFFF');
      }
      // Senhas antigas em texto aberto (coluna "Senha") são apagadas
      const n = aba.getLastRow() - 1;
      if (n > 0) {
        const col = aba.getRange(2, 4, n, 1);
        if (col.getValues().some(r => String(r[0]).trim())) col.clearContent();
      }
      return aba;
    }

    function lerUsuarios() {
      const aba = garantirAbaUsuarios();
      const n = aba.getLastRow() - 1;
      if (n <= 0) return [];
      return aba.getRange(2, 1, n, ATEND_HEADERS.length).getValues().filter(r => r[0] || r[7]).map(r => ({
        nome: String(r[0] || ''), perfil: PERFIS_VALIDOS.includes(String(r[1])) ? String(r[1]) : 'atendente',
        equipe: String(r[2] || ''), ativo: String(r[4] || 'S') === 'S', contaMeta: String(r[5] || 'S') !== 'N',
        email: emailNorm(r[7]), hash: String(r[8] || ''), salt: String(r[9] || ''),
        trocarSenha: String(r[10] || '') === 'S', ultimoLogin: String(r[11] || ''),
      }));
    }

    function gravarUsuarios(lista) {
      const aba = garantirAbaUsuarios();
      const n = aba.getLastRow() - 1;
      if (n > 0) aba.getRange(2, 1, n, ATEND_HEADERS.length).clearContent();
      const agora = new Date().toISOString();
      const linhas = lista.map(u => [u.nome || '', u.perfil || 'atendente', u.equipe || '', '',
        u.ativo ? 'S' : 'N', u.contaMeta !== false ? 'S' : 'N', agora,
        emailNorm(u.email), u.hash || '', u.salt || '', u.trocarSenha ? 'S' : 'N', u.ultimoLogin || '']);
      if (linhas.length) {
        aba.getRange(2, 8, linhas.length, 1).setNumberFormat('@');
        aba.getRange(2, 1, linhas.length, ATEND_HEADERS.length).setValues(linhas);
      }
      CacheService.getScriptCache().remove('usuarios_v63');
    }

    /** Usuários sem dados de senha, para o sistema (lista de atendentes, metas, follow-up). */
    function usuarioPublico(u) {
      return { nome: u.nome, perfil: u.perfil, equipe: u.equipe, ativo: u.ativo, contaMeta: u.contaMeta,
               email: u.email, temSenha: !!u.hash, trocarSenha: u.trocarSenha, ultimoLogin: u.ultimoLogin };
    }

    function mapaUsuariosCache() {
      const cache = CacheService.getScriptCache();
      const c = cache.get('usuarios_v63');
      if (c) { try { return JSON.parse(c); } catch(e) {} }
      const mapa = {};
      lerUsuarios().forEach(u => { if (u.email) mapa[u.email] = { nome: u.nome, perfil: u.perfil, ativo: u.ativo }; });
      cache.put('usuarios_v63', JSON.stringify(mapa), 60);
      return mapa;
    }

    // ── Sessões ──
    function validarSessao(token) {
      if (!token || String(token).length < 30) return null;
      const props = propsRenovacao_();
      const raw = props.getProperty('sess_' + token);
      if (!raw) return null;
      let s; try { s = JSON.parse(raw); } catch(e) { return null; }
      if (!s.exp || s.exp < Date.now()) { props.deleteProperty('sess_' + token); return null; }
      const u = mapaUsuariosCache()[s.email];
      if (!u || !u.ativo) { props.deleteProperty('sess_' + token); return null; }
      return { email: s.email, nome: u.nome, perfil: u.perfil, token, exp: s.exp };
    }

    function limparSessoes(email) {
      const props = propsRenovacao_();
      const todas = props.getProperties();
      Object.keys(todas).forEach(k => {
        if (k.indexOf('sess_') !== 0) return;
        try {
          const s = JSON.parse(todas[k]);
          if ((email && s.email === email) || !s.exp || s.exp < Date.now()) props.deleteProperty(k);
        } catch(e) { props.deleteProperty(k); }
      });
    }

    function login(d) {
      const email = emailNorm(d.email);
      const senha = String(d.senha || '');
      if (!email || !senha) return { ok: false, erro: 'Informe e-mail e senha.' };
      const cache = CacheService.getScriptCache();
      const chaveFalha = 'falha_' + email;
      const falhas = parseInt(cache.get(chaveFalha) || '0');
      if (falhas >= 5) return { ok: false, erro: 'Muitas tentativas erradas. Aguarde 15 minutos ou peça para o administrador resetar sua senha.' };

      var lock = bloqueio_(15000);
      try {
        const lista = lerUsuarios();
        const u = lista.find(x => x.email === email);
        const erroPadrao = { ok: false, erro: 'E-mail ou senha incorretos.' };
        if (!u || !u.ativo || !u.hash) {
          cache.put(chaveFalha, String(falhas + 1), 900);
          return (u && u.ativo && !u.hash) ? { ok: false, erro: 'Seu acesso ainda não tem senha. Peça para o administrador gerar uma.' } : erroPadrao;
        }
        if (hashSenha(senha, u.salt) !== u.hash) {
          cache.put(chaveFalha, String(falhas + 1), 900);
          log('LOGIN FALHOU', email, email);
          return erroPadrao;
        }
        cache.remove(chaveFalha);
        limparSessoes(); // remove sessões vencidas
        const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
        const exp = Date.now() + SESSAO_HORAS * 3600 * 1000;
        propsRenovacao_().setProperty('sess_' + token, JSON.stringify({ email, exp }));
        u.ultimoLogin = Utilities.formatDate(new Date(), tzScript(), 'dd/MM/yyyy HH:mm');
        gravarUsuarios(lista);
        log('LOGIN', u.nome, email);
        return { ok: true, token, exp, nome: u.nome, email, perfil: u.perfil, trocarSenha: u.trocarSenha };
      } finally { lock.releaseLock(); }
    }

    function logout(sess) {
      if (sess && sess.token) propsRenovacao_().deleteProperty('sess_' + sess.token);
      return { ok: true };
    }

    function trocarSenha(sess, d) {
      const nova = String(d.nova || '');
      if (nova.length < 8) return { ok: false, erro: 'A nova senha precisa ter pelo menos 8 caracteres.' };
      if (!/[A-Za-z]/.test(nova) || !/\d/.test(nova)) return { ok: false, erro: 'Use letras e números na nova senha.' };
      var lock = bloqueio_(15000);
      try {
        const lista = lerUsuarios();
        const u = lista.find(x => x.email === sess.email);
        if (!u) return { ok: false, erro: 'Usuário não encontrado.' };
        if (hashSenha(String(d.atual || ''), u.salt) !== u.hash) return { ok: false, erro: 'A senha atual não confere.' };
        if (nova === String(d.atual || '')) return { ok: false, erro: 'A nova senha precisa ser diferente da atual.' };
        u.salt = Utilities.getUuid();
        u.hash = hashSenha(nova, u.salt);
        u.trocarSenha = false;
        gravarUsuarios(lista);
        log('SENHA TROCADA', u.nome, u.email);
        return { ok: true };
      } finally { lock.releaseLock(); }
    }

    // ── Gestão de usuários (só admin) ──
    function usuariosListar() {
      return { ok: true, usuarios: lerUsuarios().map(usuarioPublico) };
    }

    function usuarioSalvar(sess, d) {
      const dados = d.usuario || {};
      const email = emailNorm(dados.email);
      const nome = String(dados.nome || '').trim();
      const perfil = PERFIS_VALIDOS.includes(dados.perfil) ? dados.perfil : 'atendente';
      if (!nome) return { ok: false, erro: 'Informe o nome.' };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, erro: 'E-mail inválido.' };
      var lock = bloqueio_(15000);
      try {
        const lista = lerUsuarios();
        const chaveEmail = emailNorm(dados.emailOriginal || '');
        const chaveNome = normNome(dados.nomeOriginal || '');
        let u = (chaveEmail && lista.find(x => x.email === chaveEmail))
             || (!chaveEmail && chaveNome && lista.find(x => !x.email && normNome(x.nome) === chaveNome));
        const outro = lista.find(x => x.email === email && x !== u);
        if (outro) return { ok: false, erro: 'Já existe um usuário com esse e-mail: ' + outro.nome };
        if (u && u.email === sess.email && (perfil !== 'admin' || dados.ativo === false))
          return { ok: false, erro: 'Você não pode tirar o seu próprio acesso de administrador.' };

        let senha = '';
        if (!u) {
          u = { nome, email, perfil, equipe: '', ativo: true, contaMeta: perfil === 'atendente', hash: '', salt: '', trocarSenha: true, ultimoLogin: '' };
          lista.push(u);
        }
        u.nome = nome; u.email = email; u.perfil = perfil;
        if (dados.ativo !== undefined) u.ativo = !!dados.ativo;
        if (dados.contaMeta !== undefined) u.contaMeta = !!dados.contaMeta;
        if (dados.equipe !== undefined) u.equipe = String(dados.equipe || '');
        if (!u.hash) {
          senha = senhaProvisoria();
          u.salt = Utilities.getUuid(); u.hash = hashSenha(senha, u.salt); u.trocarSenha = true;
        }
        gravarUsuarios(lista);
        if (!u.ativo) limparSessoes(u.email);
        log('USUÁRIO SALVO', u.nome + ' · ' + u.perfil, sess.email);
        return { ok: true, usuario: usuarioPublico(u), senhaProvisoria: senha, usuarios: lista.map(usuarioPublico) };
      } finally { lock.releaseLock(); }
    }

    function usuarioResetarSenha(sess, d) {
      const email = emailNorm(d.email);
      var lock = bloqueio_(15000);
      try {
        const lista = lerUsuarios();
        const u = lista.find(x => x.email === email);
        if (!u) return { ok: false, erro: 'Usuário não encontrado.' };
        const senha = senhaProvisoria();
        u.salt = Utilities.getUuid(); u.hash = hashSenha(senha, u.salt); u.trocarSenha = true;
        gravarUsuarios(lista);
        limparSessoes(email);
        CacheService.getScriptCache().remove('falha_' + email);
        log('SENHA RESETADA', u.nome, sess.email);
        return { ok: true, senhaProvisoria: senha, usuario: usuarioPublico(u) };
      } finally { lock.releaseLock(); }
    }

    function usuarioRemover(sess, d) {
      const email = emailNorm(d.email);
      const nome = normNome(d.nome || '');
      if (email && email === sess.email) return { ok: false, erro: 'Você não pode remover o seu próprio usuário.' };
      var lock = bloqueio_(15000);
      try {
        const lista = lerUsuarios();
        const resto = lista.filter(x => email ? x.email !== email : normNome(x.nome) !== nome);
        if (resto.length === lista.length) return { ok: false, erro: 'Usuário não encontrado.' };
        gravarUsuarios(resto);
        if (email) limparSessoes(email);
        log('USUÁRIO REMOVIDO', email || nome, sess.email);
        return { ok: true, usuarios: resto.map(usuarioPublico) };
      } finally { lock.releaseLock(); }
    }

    /**
     * ▶ Rode UMA VEZ no editor (Executar → criarAdmin).
     * Cria (ou atualiza) o seu usuário de administrador e mostra no registro de
     * execução uma senha provisória. No primeiro login o sistema pede a troca.
     */
    function criarAdmin() {
      const lista = lerUsuarios();
      const email = emailNorm(ADMIN_INICIAL.email);
      let u = lista.find(x => x.email === email)
           || lista.find(x => !x.email && normNome(x.nome) === normNome(ADMIN_INICIAL.nome));
      if (!u) { u = { nome: ADMIN_INICIAL.nome, equipe: '', contaMeta: false, ultimoLogin: '' }; lista.push(u); }
      const senha = senhaProvisoria();
      u.email = email; u.perfil = 'admin'; u.ativo = true;
      u.salt = Utilities.getUuid(); u.hash = hashSenha(senha, u.salt); u.trocarSenha = true;
      gravarUsuarios(lista);
      limparSessoes(email);
      Logger.log('✅ Administrador: ' + email + ' (' + u.nome + ')');
      Logger.log('🔑 Senha provisória: ' + senha + '   ← use no primeiro login; o sistema vai pedir para trocar.');
    }

    /** Confere token e perfil antes de qualquer ação. Devolve null se pode seguir. */
    function checarPermissao(acao, sess) {
      if (!sess) return { ok: false, auth: false, erro: 'Sua sessão expirou. Entre novamente.' };
      const p = sess.perfil;
      if (ACOES_ADMIN.includes(acao) && p !== 'admin') return { ok: false, permissao: false, erro: 'Apenas o administrador pode fazer isso.' };
      if (ACOES_GESTAO.includes(acao) && p !== 'admin' && p !== 'coordenador') return { ok: false, permissao: false, erro: 'Seu perfil não pode fazer isso.' };
      return null;
    }

    /** Algumas chaves de configuração também têm dono. */
    function checarChaveConfig(chave, sess, prefixo) {
      const c = String(chave || prefixo || '');
      if (sess.perfil === 'admin') return null;
      if (c === 'email_relatorio' || c.indexOf('metas_') === 0)
        return { ok: false, permissao: false, erro: 'Apenas o administrador pode alterar essa configuração.' };
      if (c.indexOf('curva_') === 0 && sess.perfil !== 'coordenador')
        return { ok: false, permissao: false, erro: 'Seu perfil não pode alterar curvas.' };
      if (prefixo && c.indexOf('curva_') !== 0)
        return { ok: false, permissao: false, erro: 'Apenas o administrador pode remover essa configuração.' };
      return null;
    }

    /**
     * ▶ Rode UMA VEZ (Executar → repararAcionamentos) depois de publicar a v6.5.
     * Corrige as linhas antigas da aba Acionamentos em que a planilha transformou
     * o ciclo ou a data em outro formato. Não apaga nem muda mais nada.
     */
    function repararAcionamentos() {
      const aba = getSpreadsheet().getSheetByName('Acionamentos');
      const n = aba.getLastRow() - 1;
      if (n <= 0) { Logger.log('Nada a reparar.'); return; }
      const rng = aba.getRange(2, 11, n, 5); // Data, Hora, _ts, Follow-Up Para, Ciclo
      const vals = rng.getValues();
      let mudou = 0;
      const novos = vals.map(r => {
        const data = formatarDataBR(r[0]);
        const hora = r[1] instanceof Date ? Utilities.formatDate(r[1], tzScript(), 'HH:mm:ss') : String(r[1] || '');
        const ciclo = r[4] === '' ? '' : normCiclo(r[4]);
        if (data !== String(r[0]) || hora !== String(r[1]) || ciclo !== String(r[4])) mudou++;
        return [data, hora, r[2], r[3], ciclo];
      });
      aba.getRange(2, 11, n, 2).setNumberFormat('@');
      aba.getRange(2, 15, n, 1).setNumberFormat('@');
      rng.setValues(novos);
      Logger.log('✅ ' + mudou + ' linha(s) corrigida(s) de ' + n + '.');
    }

    /**
     * Boas-vindas: soma os alunos marcados à lista que já está no servidor,
     * numa operação só (com trava). Antes, cada computador gravava a lista inteira
     * e uma gravação mais antiga podia apagar marcações feitas em outro lugar.
     */
    function bvMarcar(d) {
      const ciclo = normCiclo(d.ciclo || '');
      if (!/^\d{4}\.\d$/.test(ciclo)) return { ok: false, erro: 'Ciclo inválido.' };
      const ids = (d.ids || []).map(String).filter(Boolean);
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(30000)) return { ok: false, erro: 'Servidor ocupado. Tente de novo.' };
      try {
        const chave = 'bv_' + ciclo;
        let atual = [];
        try { atual = JSON.parse(getConfig()[chave] || '[]') || []; } catch(e) { atual = []; }
        const set = {};
        atual.map(String).forEach(id => set[id] = 1);
        ids.forEach(id => set[id] = 1);
        const lista = Object.keys(set);
        salvarConfigKey(chave, JSON.stringify(lista));
        return { ok: true, lista, total: lista.length };
      } finally { lock.releaseLock(); }
    }


    return { processarAcao, relatoriosDiarios, ativarRelatorioDiario, testarRelatorioDiario, configurarPlanilha, repararAcionamentos };
  })();
  return Renovacao_.ns;
}

const ACOES_RENOVACAO = ['ping', 'login', 'logout', 'sessao', 'trocar_senha', 'usuarios_listar', 'usuario_salvar', 'usuario_resetar_senha', 'usuario_remover', 'sync', 'carregar_alunos', 'listar_alunos', 'listar_acionamentos', 'listar_envios', 'listar_ciclos', 'dashboard', 'dashboard_periodos', 'velocidade', 'ranking_colab', 'followups_hoje', 'alunos_sem_acionamento', 'config', 'exportar_csv', 'salvar_acionamento', 'salvar_aluno', 'importar_alunos', 'atualizar_status', 'concluir_followup', 'salvar_atendentes', 'carregar_atendentes', 'registrar_envio', 'enviar_email', 'enviar_sms', 'salvar_smtp', 'testar_email', 'importar_drive', 'importar_drive_single', 'salvar_config', 'remover_config', 'remover_config_prefixo', 'remover_duplicatas', 'registrar_acesso', 'bv_marcar', 'enviar_relatorio_diario'];
const ACOES_RENOVACAO_NO_NUCLEO = ['login', 'logout', 'sessao', 'trocar_senha', 'usuarios_listar', 'usuario_salvar', 'usuario_resetar_senha', 'usuario_remover'];

function Modulo_renovacao() {
  const acoes = {};
  ACOES_RENOVACAO.forEach(nome => {
    acoes[nome] = (d, eu) => {
      if (ACOES_RENOVACAO_NO_NUCLEO.indexOf(nome) >= 0) {
        return { ok: false, erro: 'Login, senha e usuários agora ficam na Jornada do Aluno (menu Usuários e perfis).' };
      }
      d.__sess = { email: eu.email, nome: eu.nome, perfil: eu.perfil, token: '', exp: 0 };
      return Renovacao_().processarAcao(nome, d);
    };
  });
  return { acoes: acoes, gestao: [], admin: [] }; // as regras de perfil são as do código original
}

/* Rodar pelo editor do Apps Script */
function renovacao_configurarPlanilha() { Renovacao_().configurarPlanilha(); }
function renovacao_relatoriosDiarios() { Renovacao_().relatoriosDiarios(); }
function renovacao_ativarRelatorioDiario() { Renovacao_().ativarRelatorioDiario(); }
function renovacao_testarRelatorioDiario() { Renovacao_().testarRelatorioDiario(); }
function renovacao_repararAcionamentos() { Renovacao_().repararAcionamentos(); }
