# Checklist de recursos dos sistemas atuais

Gerado a partir do código de referência. Cada item precisa existir e funcionar no sistema unificado antes de a etapa ser dada como concluída.


## RenovaVR: telas

- [x] tela alunos
- [x] tela boasvindas
- [x] tela config
- [x] tela dash
- [x] tela envios
- [x] tela evasao
- [x] tela followup
- [x] tela importar
- [x] tela produtividade
- [x] tela relatorios
- [x] tela renovados

## RenovaVR: ações do servidor (GAS v6.6)

- [x] ping
- [x] login (agora no núcleo da Jornada)
- [x] logout (agora no núcleo da Jornada)
- [x] sessao (agora no núcleo da Jornada)
- [x] trocar_senha (agora no núcleo da Jornada)
- [x] usuarios_listar (agora no núcleo da Jornada)
- [x] usuario_salvar (agora no núcleo da Jornada)
- [x] usuario_resetar_senha (agora no núcleo da Jornada)
- [x] usuario_remover (agora no núcleo da Jornada)
- [x] sync
- [x] carregar_alunos
- [x] listar_alunos
- [x] listar_acionamentos
- [x] listar_envios
- [x] listar_ciclos
- [x] dashboard
- [x] dashboard_periodos
- [x] velocidade
- [x] ranking_colab
- [x] followups_hoje
- [x] alunos_sem_acionamento
- [x] config
- [x] exportar_csv
- [x] salvar_acionamento
- [x] salvar_aluno
- [x] importar_alunos
- [x] atualizar_status
- [x] concluir_followup
- [x] salvar_atendentes
- [x] carregar_atendentes
- [x] registrar_envio
- [x] enviar_email
- [x] enviar_sms
- [x] salvar_smtp
- [x] testar_email
- [x] importar_drive
- [x] importar_drive_single
- [x] salvar_config
- [x] remover_config
- [x] remover_config_prefixo
- [x] remover_duplicatas
- [x] registrar_acesso
- [x] bv_marcar
- [x] enviar_relatorio_diario

Verificado em 20/11/2026 no ambiente simulado: 14 testes de backend (importação de ciclo, acionamento no nome de quem está logado, sem duplicar, sync, dashboard, regras de perfil) e 9 passos no navegador. Telas por perfil: atendente vê Dashboard, Alunos, Envios, Follow-up e Boas-vindas; admin vê todas.

## EngajaVR: telas

- [x] admin: Todos os atendentes
- [x] admin: 🔐 Admin
- [x] calendario: 🗓️ Calendário
- [x] dashboard: Dashboard
- [x] estagio: 🎓 Estágio
- [x] evasao: 🚪 Evasão
- [x] financeiro: (local._ts||0)) { mapaLocal[e.id] = e;
- [x] financeiro: 💰 Financeiro
- [x] followup: 0) {
      ATENDENTES = ATENDENTES.conc
- [x] followup: 📅 Follow-up
- [x] importar: Importar
- [x] painel: 0) {
    document.querySelectorAll('.pi
- [x] painel: Painel
- [x] painel: ❌ Erro ao processar: ' + err.message + '
- [x] polo: 📝 Provas
- [x] produtividade: Produtividade
- [x] tarefas: ✅ Tarefas
- [x] tutoriais: 📚 Tutoriais

## EngajaVR: ações do servidor (GAS v6)

- [x] carregarBase
- [x] clearAll
- [x] diagnostico
- [x] getAtendentes
- [x] getBasePublicada
- [x] getBaseTipo
- [x] getContacts
- [x] getEvasaoData
- [x] getEventos
- [x] getFollowups
- [x] getHistory
- [x] getModelos
- [x] getSharePointCSV
- [x] getSnaps
- [x] getTCEData
- [x] getTarefas
- [x] getTutoriais
- [x] getUsuarios (desativada: usuários no núcleo)
- [x] importarCSVSharePoint
- [x] mergeEvasaoData
- [x] ping
- [x] publicarBase
- [x] reconstruirHistory
- [x] renameAtendente
- [x] restaurarDeAbas
- [x] salvarBase
- [x] saveAction
- [x] saveActionLote
- [x] saveAtendentes
- [x] saveContact
- [x] saveEvasaoData
- [x] saveEventos
- [x] saveFollowup
- [x] saveHistoryFull
- [x] saveModelos
- [x] saveRelatEmail
- [x] saveSnaps
- [x] saveTCEData
- [x] saveTarefas
- [x] saveTutoriais
- [x] saveUsuarios (desativada: usuários no núcleo)
- [x] sendEmail
- [x] sendEmailLote
- [x] uploadAppHTML (desativada: app publicado pela Jornada)

## EngajaVR: ações chamadas pelo front que NÃO existem no servidor

- [x] loadPoloData (criada no 12_Engajamento.gs)
- [x] savePoloData (criada no 12_Engajamento.gs)

Verificado em 20/11/2026 no ambiente simulado: 13 testes de backend (sem login o servidor recusa, bases Ímpar/Par/Técnico separadas, importação só gestão, limpar só admin, Provas no servidor, pasta e propriedades isoladas) e 8 passos no navegador (11 páginas abrem).

## Painel Formandos: abas

- [x] aba alunos
- [x] aba anteriores
- [x] aba atividade
- [x] aba evolucao
- [x] aba formados
- [x] aba guia
- [x] aba regua

## Painel Formandos: ações e coleções do servidor (GAS v3)

- [x] ação entrar (substituída pelo login único)
- [x] ação get
- [x] ação poll
- [x] ação trocar_senha (vai para o núcleo)
- [x] coleção students
- [x] coleção formados
- [x] coleção activity
- [x] coleção contacts
- [x] coleção regua

Verificado em 20/11/2026 no ambiente simulado: 10 testes de backend e 9 passos no navegador (abas, ficha do aluno, gravação pela tela, identidade e perfil).
