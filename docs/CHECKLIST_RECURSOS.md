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

- [ ] admin: Todos os atendentes
- [ ] admin: 🔐 Admin
- [ ] calendario: 🗓️ Calendário
- [ ] dashboard: Dashboard
- [ ] estagio: 🎓 Estágio
- [ ] evasao: 🚪 Evasão
- [ ] financeiro: (local._ts||0)) { mapaLocal[e.id] = e;
- [ ] financeiro: 💰 Financeiro
- [ ] followup: 0) {
      ATENDENTES = ATENDENTES.conc
- [ ] followup: 📅 Follow-up
- [ ] importar: Importar
- [ ] painel: 0) {
    document.querySelectorAll('.pi
- [ ] painel: Painel
- [ ] painel: ❌ Erro ao processar: ' + err.message + '
- [ ] polo: 📝 Provas
- [ ] produtividade: Produtividade
- [ ] tarefas: ✅ Tarefas
- [ ] tutoriais: 📚 Tutoriais

## EngajaVR: ações do servidor (GAS v6)

- [ ] carregarBase
- [ ] clearAll
- [ ] diagnostico
- [ ] getAtendentes
- [ ] getBasePublicada
- [ ] getBaseTipo
- [ ] getContacts
- [ ] getEvasaoData
- [ ] getEventos
- [ ] getFollowups
- [ ] getHistory
- [ ] getModelos
- [ ] getSharePointCSV
- [ ] getSnaps
- [ ] getTCEData
- [ ] getTarefas
- [ ] getTutoriais
- [ ] getUsuarios
- [ ] importarCSVSharePoint
- [ ] mergeEvasaoData
- [ ] ping
- [ ] publicarBase
- [ ] reconstruirHistory
- [ ] renameAtendente
- [ ] restaurarDeAbas
- [ ] salvarBase
- [ ] saveAction
- [ ] saveActionLote
- [ ] saveAtendentes
- [ ] saveContact
- [ ] saveEvasaoData
- [ ] saveEventos
- [ ] saveFollowup
- [ ] saveHistoryFull
- [ ] saveModelos
- [ ] saveRelatEmail
- [ ] saveSnaps
- [ ] saveTCEData
- [ ] saveTarefas
- [ ] saveTutoriais
- [ ] saveUsuarios
- [ ] sendEmail
- [ ] sendEmailLote
- [ ] uploadAppHTML

## EngajaVR: ações chamadas pelo front que NÃO existem no servidor

- [ ] loadPoloData (criar no backend unificado)
- [ ] savePoloData (criar no backend unificado)

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
