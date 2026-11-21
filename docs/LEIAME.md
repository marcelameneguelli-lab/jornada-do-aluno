# Jornada do Aluno · Secretaria Acadêmica VR

CRM unificado da SSA: Renovação, Engajamento, Provas, Estágio, Financeiro, Financiamentos, NPS e Formandos, com login único e perfis.

## Pastas

- `app/` aplicativo (o que vai para o GitHub Pages ou Cloudflare)
- `gas/` backend do Google Apps Script
- `docs/` arquitetura e checklist de recursos dos sistemas antigos
- `testes/` testes automáticos (backend simulado e navegador)

## Situação

- Etapa 0 concluída: estrutura, arquitetura, checklist.
- Etapa 1 concluída: núcleo (login único, troca de senha, perfis, sistemas liberados por usuário, gestão de usuários, menu, PWA). Testado: 17 testes de backend e 12 passos no navegador.
- Etapa 2 concluída no ambiente simulado: sistema Formandos (todas as abas do Painel Formandos, com o login único). Testado: 10 testes de backend e 9 passos no navegador.
- Etapa 3 concluída no ambiente simulado: sistema Renovação (todas as telas do RenovaVR, com o login único). Testado: 14 testes de backend e 9 passos no navegador.
- Etapa 4 concluída no ambiente simulado: sistema Engajamento (todas as páginas do EngajaVR, 3 bases, com o login único; o servidor passou a exigir login e a conferir o perfil; Provas grava no servidor). Testado: 13 testes de backend e 8 passos no navegador.
- Ajuste de 20/11/2026: Engajamento só com Painel, Dashboard, Produtividade, Follow-up, Evasão, Importar e Admin. Calendário, Tarefas e Tutoriais viraram Ferramentas da equipe (para todos). Testado: 15 testes de backend e 7 passos no navegador.
- Etapa 5 concluída no ambiente simulado: Provas, Estágio e Financeiro como sistemas próprios, pelo motor de acompanhamento (alunos da base do Engajamento, acionamento, follow-up, dashboard, produtividade e a tela original do EngajaVR). Testado: 11 testes de backend e 15 passos no navegador.
- Etapa 6 em parte: Financiamentos pronto no mesmo motor (programas, alerta de 75% para ProUni e FIES, tipo de bolsa, termos e "renovou com o programa"). NPS pronto também (etapa 6 concluída): importação do arquivo do Medallia, grupos, filtros, ficha do caso, NPS por mês e modalidade. Testado: 9 passos no navegador e conferido com o arquivo real (362 respostas, NPS 40,3).
- Etapa 7 concluída no ambiente simulado: Central de Bases (situação de cada base e atalho para a importação de cada sistema) e relatório diário único (todos os sistemas por atendente, destaques, follow-ups atrasados e quem acessou), com prévia e envio pelo menu Relatório diário. Testado: 8 testes de backend e 5 passos no navegador.
- Ajuste de 21/11/2026 (versão 1.1.0): importação só na Central de Bases e administração única. Os sistemas não têm mais Importar, Configurações nem Admin; Configurações (grupo Administração do menu) reúne a parte de administrador da Renovação, do Engajamento e do Formandos. Só muda o site, o Apps Script continua igual. Testado: 19 passos no navegador, mais todos os testes anteriores.
- `ferramentas/` scripts que geram o sistema Formandos a partir do Painel original (não editar os arquivos gerados à mão).

## Como publicar o backend de teste

1. No Google Drive (conta marcela.meneguelli), crie uma planilha nova chamada **Jornada do Aluno · Central**.
2. Na planilha: Extensões > Apps Script. Crie um arquivo para cada um da pasta `gas/` (00_Config, 01_Roteador, 02_Acesso, 03_Util, 10_Formandos, 11_Renovacao, 12_Engajamento, 13_Ferramentas, 14_Acompanhamento, 15_Gestao, 16_NPS), com o mesmo nome, e cole o conteúdo.
3. Selecione a função `configurar` e clique em Executar. Autorize quando pedir. Depois execute `formandos_configurar` e `renovacao_configurarPlanilha` (conferem as abas nas cópias das planilhas) e, se quiser o backup semanal, `formandos_ativarBackupSemanal`.
4. Na aba `usuarios`, preencha: nome, e-mail, perfil (admin, coordenador, atendente ou apoio), sistemas (`todos` ou nomes separados por vírgula: renovacao, engajamento, provas, estagio, financeiro, financiamentos, nps, formandos) e ativo (sim).
5. Recarregue a planilha e use o menu **Jornada do Aluno > Gerar senhas provisórias**. As senhas aparecem na coluna G.
6. Implantar > Nova implantação > App da Web. Executar como: Eu. Quem tem acesso: **Qualquer pessoa**. Copie a URL que termina em `/exec`.
7. Cole essa URL em `app/nucleo/config.js`, no campo `gasUrl`.

Mantenha a planilha Central privada: ela guarda os acessos.

## Atenção durante os testes

- Não ative ainda o relatório diário da Renovação no projeto novo (`renovacao_ativarRelatorioDiario`). O sistema atual continua mandando o dele, e o relatório único de todos os sistemas entra na etapa 7.
- Se a Renovação usa SMTP, Mailjet ou SMS, essas chaves ficam no projeto antigo e precisam ser cadastradas de novo em Configurações, dentro da Renovação na Jornada.
- O Engajamento de teste começa sem bases: o EngajaVR em uso guarda as bases numa pasta do Drive que o projeto novo não usa (de propósito). Importe as bases pela aba Importar do Engajamento, dentro da Jornada. O histórico de acionamentos do EngajaVR atual também não aparece no teste.
- Não ative o relatório diário do Engajamento no projeto novo (`engajamento_criarTriggerDiario`) pelo mesmo motivo da Renovação.

## Ligar o relatório diário único

1. No Apps Script, selecione a função `ativarRelatorioJornada` e clique em Executar. Autorize o envio de e-mail e os gatilhos quando pedir.
2. Na Jornada, menu Relatório diário: confira a prévia e use "Enviar agora" para testar.
3. Não ative os relatórios antigos neste projeto (`renovacao_ativarRelatorioDiario`, `engajamento_criarTriggerDiario`). Quando a Jornada entrar em produção, desligue os relatórios do RenovaVR e do EngajaVR atuais para não receber três e-mails.

## Atualizar o servidor quando sair versão nova

1. Cole o conteúdo novo nos arquivos da pasta `gas/` (crie os que forem novos, com o mesmo nome).
2. Implantar > Gerenciar implantações > lápis > Versão: Nova versão > Implantar. A URL continua a mesma.

## NPS (Medallia)

1. No Medallia, exporte a pesquisa Experiência Geral (Survey Export) em Excel, sem alterar o arquivo.
2. Na Jornada, abra Central de Bases, cartão NPS, e use "Importar respostas do Medallia" (perfis admin e coordenador).
3. Pode importar o arquivo acumulado sempre: respostas que já existem são atualizadas, e as novas são acrescentadas (a chave é o ID da Pesquisa).
4. A meta de NPS (46,24) fica em `app/modulos/acompanhamento/sistemas.js` (META_NPS).
