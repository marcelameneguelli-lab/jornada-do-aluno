# Sistema unificado da SSA (nome provisório: Jornada)

CRM único que reúne o RenovaVR, o EngajaVR e o Painel Formandos, com login único e perfis de acesso.

## Decisões tomadas (20/11/2026)

1. CRM unificado. Ao entrar em um sistema (ex.: Renovação), a pessoa trabalha só aquela base. Cada sistema mantém o próprio follow-up, a própria produtividade e o próprio dashboard, porque as bases são diferentes.
2. Provas, Estágio e Financeiro saem de dentro do EngajaVR e viram sistemas próprios, cada um com acionamento, acompanhamento, follow-up e dashboard.
3. Testes feitos com cópias das planilhas atuais. Os sistemas em uso não são alterados.
4. Um usuário por colaborador, com perfil que define quais sistemas e telas ele acessa (como hoje).
5. Um relatório diário único às 20h cobrindo todos os sistemas.
6. Cores Estácio mantidas (#003B71 e #8DC63F). Nome a definir, ligado à ideia de jornada acadêmica.
7. Projeto criado no computador, na Área de Trabalho.
9. Engajamento enxuto (20/11/2026): Estágio, Provas e Financeiro saem de dentro dele (viram sistemas próprios). Calendário, Tarefas e Tutoriais viram Ferramentas da equipe, fora dos sistemas, para todos os usuários. Dentro do Engajamento ficam Painel, Dashboard, Produtividade, Follow-up, Evasão, Importar e Admin.
8. Dois sistemas novos (20/11/2026): Financiamentos (ProUni, FIES, Pravaler, Ficou Fácil), com acompanhamento do aproveitamento acadêmico e da assinatura dos termos, e NPS, com a base exportada do Medallia para trabalhar promotores, neutros e detratores.

## Sistemas (módulos)

| Sistema | Origem | Base usada |
|---|---|---|
| Renovação | RenovaVR | Renovação Ímpar ou Renovação Par |
| Engajamento | EngajaVR | Engajamento Ímpar, Par ou Técnico |
| Provas | EngajaVR (tela Provas) | mesma base do Engajamento (colunas AV, AVS, SM, Simulados) |
| Estágio | EngajaVR (tela Estágio) | mesma base do Engajamento (colunas de elegibilidade e TCE) |
| Financeiro | EngajaVR (tela Financeiro) | mesma base do Engajamento (vencimentos e dívida) |
| Financiamentos | novo | base líquida, filtrada pela coluna CLASSE_PAGANTE_SEMESTRE (ProUni, FIES, Pravaler, Ficou Fácil) |
| NPS | novo | exportação do Medallia (promotores 9 e 10, neutros 7 e 8, detratores 0 a 6) |
| Formandos | Painel Formandos | base de formandos do semestre |

Cada sistema tem: lista de alunos, modal de acionamento, follow-up, produtividade, dashboard e, quando já existia, Evasão e telas próprias.

## Motor de acompanhamento (Provas, Estágio, Financeiro, Financiamentos)

Uma tela única (`app/modulos/acompanhamento/`) configurada por sistema em `sistemas.js`: quem entra (regra sobre a base do Engajamento), colunas, filtros, resultados de contato, indicadores e, no Financiamentos, a ficha do aluno.

Abas: Alunos (lista, filtros, exportação CSV, ficha e acionamento), Follow-up (atrasados, hoje, próximos; meus ou da equipe), Dashboard (alunos, cobertura, acionamentos, follow-ups, resultados, canais, 14 dias), Produtividade (por atendente e período) e Tela original (a página do EngajaVR, para TCE, agendamento de provas e disparo em lote).

Regras de entrada: Provas = AV ou AVS no polo (QTD_ELEGIVEL_AV_POLO / QTD_ELEGIVEL_AVS_POLO); Estágio = QTD_ELEGIVEL_ESTAGIO; Financeiro = INADIMPLENTE; Financiamentos = CLASSE_PAGANTE_SEMESTRE (PROUNI, FIES, PRAVALER, PAR, BOLSISTA100), BOLSA_FICOU_FACIL ou BOLSA_PRV.

Servidor: 14_Acompanhamento.gs. Abas acomp_<sistema> (acionamentos e follow-ups) e ficha_<sistema> (campos por aluno). O atendente gravado é sempre quem está logado. Cada sistema só acessa as ações do EngajaVR que a sua tela original usa.

## NPS (Medallia)

Mesmo motor de acompanhamento, com base própria: a exportação "Survey Export" do Medallia, lida no navegador (SheetJS) e enviada em lotes para a aba nps_respostas (16_NPS.gs), com chave no ID da Pesquisa. Cada resposta é uma linha (o mesmo aluno pode responder mais de uma vez). Grupos: promotor 9 e 10, neutro 7 e 8, detrator 0 a 6. Dashboard com NPS e meta, NPS por mês e por modalidade, motivos dos detratores e insatisfação por tema. Ficha do caso: tema da dor e situação.

Conferido em 20/11/2026 com o arquivo real (Responses_20261120_163817.xlsx): 362 respostas de jan a nov/2026, NPS 40,3 (225 promotores, 58 neutros, 79 detratores).

## Ferramentas da equipe

Calendário, Tarefas e Tutoriais aparecem no menu e no Início para todos os usuários logados, sem depender dos sistemas liberados. Usam as telas e os dados do EngajaVR (mesmo armazenamento), abertas em "modo ferramenta" (sem abas, bases nem contador de alunos). No servidor, ficam em 13_Ferramentas.gs (ações ferramentas.*).

## Central de Bases e Configurações (administração única)

Decisão de 21/11/2026: as bases são importadas só na Central de Bases, e os sistemas apenas consomem os dados. As áreas de administrador que ficavam dentro de cada sistema foram reunidas em Configurações, no grupo Administração do menu (junto com Usuários e perfis e Relatório diário).

- Central de Bases (admin e coordenador): um cartão por base com a situação (ciclos, alunos, última importação) e quem usa a base. O botão abre a tela de importação original do sistema em `?modo=importar`, sem o restante do sistema:
  - Renovação: tela Importar Base do RenovaVR (ciclo, curva, Drive).
  - Base líquida Ímpar, Par e Técnico: página Importar do EngajaVR, já na base escolhida. Serve Engajamento, Provas, Estágio, Financeiro e Financiamentos.
  - Formandos: importar alunos, importar formados e ENADE.
  - NPS: arquivo Survey Export do Medallia.
- Configurações (admin): abre cada sistema em `?modo=config`:
  - Renovação: ritmo, metas, período e prazo, painel do administrador.
  - Engajamento: equipe de atendentes, renomear no histórico, relatório por atendente, zona de perigo. Saíram o PIN, o "publicar no GAS" e os usuários próprios, que já não tinham função.
  - Formandos: semestre de trabalho e limpeza dos dados.
- Dentro dos sistemas não há mais Importar, Configurações nem Admin. Os atalhos internos que existiam (por exemplo "Ir para Importação" no dashboard da Renovação) levam para a Central de Bases ou para Configurações.
- Nada mudou no servidor: as ações de importação e de configuração são as mesmas, com as mesmas permissões.

Dentro de cada sistema, o topo mostra sempre um selo com a base ativa (cor diferente para ímpar e par), para não misturar ciclos.

## Frontend

```
app/
  index.html          casca: login, menu por perfil, selo da base, sincronização
  nucleo/             comunicação com o GAS, sessão, matrícula, importador CSV/XLSX,
                      exportação CSV (; e BOM), avisos, tema Estácio
  modulos/
    renovacao/  engajamento/  provas/  estagio/  financeiro/  formandos/
  manifest + service worker únicos (PWA)
```

Cada sistema abre numa moldura própria (iframe) dentro da tela base. Assim o visual e os scripts de um sistema não interferem nos outros, e os sistemas migrados mantêm todos os recursos. O login, o menu e a sessão são sempre os da tela base.

Com um sistema aberto, o menu da Jornada fica compacto (só ícones) e abre por cima ao passar o mouse.

Na Renovação, os perfis são os mesmos do RenovaVR (admin, coordenador, atendente, apoio) e as regras de cada tela continuam as do código original. A gestão de usuários do RenovaVR leva para Usuários e perfis da Jornada.

No Engajamento, as regras de perfil são as do EngajaVR (Importar só admin e coordenador, aba Admin só admin, sem o PIN, que deixou de ser necessário). O servidor agora exige login e confere o perfil nas ações de importação (gestão) e nas destrutivas ou de manutenção (admin). Os dados do teste ficam numa pasta própria do Drive (Jornada_Engajamento_Storage) e em propriedades com prefixo engajamento_.

No Formandos, admin e coordenador entram como "admin" do painel (importar, limpar, trocar semestre). Atendente e apoio entram como "atendente". Hospedagem igual à atual (GitHub Pages e Cloudflare Workers).

## Backend (Google Apps Script)

Um projeto GAS novo com roteador `modulo.acao`.

- Login único: e-mail institucional e senha (hash com sal), passe assinado, bloqueio após 5 erros, senha provisória com troca obrigatória. Perfis com permissões por sistema e por tela.
- O código de cada backend atual vira um arquivo dentro do projeto e continua lendo e gravando nas planilhas por ID (nas etapas de teste, nas cópias).
- Comunicação: POST text/plain como padrão e JSONP como reserva quando o fetch for bloqueado.
- Relatório diário único às 20h (seg a sex) e 13h (sábado), em 15_Gestao.gs: acionamentos e atividades do dia por atendente em cada sistema, renovados do dia, follow-ups atrasados e quem acessou a Jornada.

## Endereços atuais

- Painel Formandos em produção: https://painel-formandos.marcela-meneguelli.workers.dev/ (Cloudflare Workers)

## Etapas

0. Estrutura, documentação e checklist de recursos.
1. Núcleo: comunicação, login único, perfis, menu, PWA.
2. Formandos.
3. Renovação.
4. Engajamento.
5. Provas, Estágio e Financeiro como sistemas próprios.
6. Financiamentos e NPS (sistemas novos).
7. Central de Bases, relatório único e integrações.
8. Virada para produção, só com autorização.

## Sistemas novos: o que cada um terá

**Financiamentos**
- Lista dos alunos com ProUni, FIES, Pravaler ou Ficou Fácil, com filtro por programa.
- Aproveitamento acadêmico por aluno, lido da coluna APROVEITAMENTO_ACADEMICO_ATUAL (texto no formato "75%", o mesmo que o EngajaVR já usa), com alerta para quem está abaixo da regra do programa (regra configurável por programa).
- Importante: a importação precisa manter a coluna CLASSE_PAGANTE_SEMESTRE, que o EngajaVR hoje não usa.
- Base: a mesma base líquida do Engajamento. Não há upload separado.
- Conferido na BASE_LIQUIDA_IMPAR (20/11/2026, 2.603 alunos, 238 colunas, arquivo em cp1252 com ";"):
  - CLASSE_PAGANTE_SEMESTRE traz PROUNI (93), FIES (21), PRAVALER (2), PAR (1), BOLSISTA100 (40) e MENSALISTA.
  - Ficou Fácil não aparece nessa coluna: vem na coluna BOLSA_FICOU_FACIL (1 = tem). Pravaler também tem BOLSA_PRV.
  - APROVEITAMENTO_ACADEMICO_ATUAL não é número: vem 0%, PARCIAL, 100% ou vazio (semestre em andamento).
    O percentual exato do semestre fechado está em PCT_APROVACAO_ANT (ex.: 66,67). A faixa atual está em FAIXA_APROVEITAMENTO.
  - Regra de 75% conferida com PCT_APROVACAO_ANT: 4 alunos ProUni abaixo; nenhum FIES abaixo (7 FIES sem informação).
  - O importador precisa reconhecer arquivo em cp1252, além de UTF-8.
- Decisões (20/11/2026):
  - Regra de 75% conferida pela PCT_APROVACAO_ANT (semestre fechado). O aproveitamento atual (FAIXA_APROVEITAMENTO) aparece como acompanhamento de risco.
  - Entram no sistema: PROUNI, FIES, PRAVALER, PAR, BOLSISTA100 e quem tiver BOLSA_FICOU_FACIL ou BOLSA_PRV = 1.
  - Pravaler e Ficou Fácil ganham a marcação "renovou com o programa" (sim, não, não informado).
- Tipo de bolsa (integral ou parcial): a base não traz o percentual, então o atendente cadastra no aluno e o dado fica guardado entre importações.
- Aproveitamento mínimo: 75% para ProUni e FIES (editável na configuração).
- Termos por semestre:
  - FIES: aditamento ou suspensão.
  - ProUni: termo de atualização, reconsideração ou encerramento.
  - Pravaler e Ficou Fácil: financiamento privado, sem regra de aproveitamento e sem termos na instituição (a renovação é feita direto com o programa). Aparecem na lista, com acionamento e follow-up, sem alerta de aproveitamento.
  Cada termo tem situação (pendente, assinado, não se aplica), data e quem registrou.
- Controle de termos por programa e semestre (assinado, pendente, prazo), com lista de pendências.
- Acionamento, follow-up, produtividade e dashboard próprios.

**NPS**
- Importação da planilha exportada do Medallia e cruzamento com as bases pela matrícula (ou CPF/e-mail, se a exportação não trouxer matrícula).
- Classificação automática: promotor, neutro, detrator, e score NPS por período, curso e modalidade, com a meta configurável.
- Fila de trabalho por grupo, com detratores como prioridade, e registro do retorno ao aluno.
- Acionamento, follow-up, produtividade e dashboard próprios.
- A nota de NPS que o atendente já registra no acionamento do Engajamento continua lá, separada da pesquisa do Medallia.

Cada etapa só termina quando os itens dela em `CHECKLIST_RECURSOS.md` estão conferidos.

## Pontos de atenção encontrados nos originais

- EngajaVR: o servidor entrega dados de alunos e a lista de usuários sem login, e aceita troca da lista de usuários por qualquer pessoa com a URL. Resolvido pelo login único.
- EngajaVR: a tela Provas chama `savePoloData` e `loadPoloData`, que não existem no backend, então os registros de provas ficam só no navegador de cada pessoa. O sistema Provas novo grava no servidor.
- EngajaVR: PIN de admin padrão 1234 guardado no navegador. Substituído pelo perfil admin.

## Apoio às Avaliações (21/11/2026)

Sistema `apoio` para o NAAP e o NAE: direcionamento para avaliações e uso da plataforma, sem rotular o aluno (não há campo de diagnóstico, condição ou laudo, e o servidor descarta campos fora da lista).
- Servidor: 17_Apoio.gs, aba `apoio_orientacoes` (planilha PLANILHAS.apoio, vazio = Central). Ações: `listar` e `salvar` (quem tem o sistema), `orientacoes` (leitura para todos os logados, via ACOES_TODOS_LOGADOS no roteador, só registros ativos e sem responsável/contato).
- Site: modulos/apoio (cadastro, abas Ativas, Para revisar e Encerradas) e nucleo/apoio.js (lista padronizada de recursos, selo e quadro). O motor de acompanhamento mostra o selo na lista e o quadro na ficha (Provas, Estágio, Financeiro, Financiamentos, NPS).
- Próximo passo possível: o mesmo selo dentro de Renovação, Engajamento e Formandos.
