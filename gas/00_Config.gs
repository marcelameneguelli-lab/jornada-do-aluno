/**
 * JORNADA DO ALUNO · SECRETARIA ACADÊMICA VR
 * Backend único (Google Apps Script)
 *
 * Arquivos deste projeto:
 *   00_Config.gs    constantes e endereços das planilhas
 *   01_Roteador.gs  entrada HTTP (POST e JSONP) e distribuição das ações
 *   02_Acesso.gs    login, senhas, perfis e usuários
 *   03_Util.gs      funções de apoio (log, JSON, datas)
 *
 * INSTALAÇÃO (primeira vez)
 * 1. Crie uma planilha nova "Jornada do Aluno · Central". Extensões > Apps Script.
 * 2. Crie os arquivos acima com os mesmos nomes e cole o conteúdo de cada um.
 * 3. Execute a função "configurar" e autorize. Ela cria as abas "usuarios" e "log".
 * 4. Na aba "usuarios", preencha nome, e-mail, perfil e sistemas de cada pessoa.
 * 5. Menu da planilha: Jornada do Aluno > Gerar senhas provisórias.
 * 6. Implantar > Nova implantação > App da Web. Executar como: Eu.
 *    Quem tem acesso: Qualquer pessoa. Copie a URL /exec para o app/nucleo/config.js.
 * 7. A cada mudança no código: Implantar > Gerenciar implantações > lápis > Nova versão.
 */

const VERSAO = '1.0.0';
const NOME_SISTEMA = 'Jornada do Aluno · Secretaria Acadêmica VR';

// Validade do passe depois do login (mesma regra do RenovaVR: 12 horas)
const SESSAO_HORAS = 12;
const MAX_ERROS = 5;          // erros de senha seguidos antes de bloquear
const BLOQUEIO_MIN = 15;      // minutos de bloqueio
const RODADAS_HASH = 300;

// Planilha central (usuários e log). Vazio = planilha onde este script foi criado.
const PLANILHA_CENTRAL_ID = '';

// Planilhas de cada sistema. FASE DE TESTES: cópias feitas em 20/11/2026.
// Na virada para produção, troque pelos IDs das planilhas oficiais.
const PLANILHAS = {
  renovacao:   '15yJEjzPOOk7O1sA1Z3Ac4FE57Sm-VxK_ot55G5OJMXU', // Cópia de Estácio — Renovação de Matrícula 2026
  engajamento: '19AOaj1dwh-hkiJBLKbHZMvnwP9qhEpScG-VHB-7DjCw', // Cópia do EngajaVR
  formandos:   '1csuSKGzI863WvgeDXxWf17WL2wUWGEYDydyZdJT5PIA', // Cópia de Formandos
  // Sistemas novos (não existiam antes): ficam na planilha Central até termos volume que peça planilha própria
  financiamentos: '',
  nps:            '',
  apoio:          '', // Apoio às Avaliações (NAAP/NAE); vazio = planilha Central
};

// Sistemas do CRM. Provas, Estágio e Financeiro usam a planilha do Engajamento.
// Financiamentos (ProUni, FIES, Pravaler, Ficou Fácil) e NPS (Medallia) são novos.
const SISTEMAS = ['renovacao', 'engajamento', 'provas', 'estagio', 'financeiro', 'financiamentos', 'nps', 'formandos', 'apoio'];

// Perfis. "gestao" libera importar bases, exportar e ver a produtividade de todos.
const PERFIS = {
  admin:       { gestao: true,  admin: true  },
  coordenador: { gestao: true,  admin: false },
  atendente:   { gestao: false, admin: false },
  apoio:       { gestao: false, admin: false },
};

// Relatório diário único (todos os sistemas)
const EMAIL_RELATORIO = 'marques.marcela@estacio.br';
