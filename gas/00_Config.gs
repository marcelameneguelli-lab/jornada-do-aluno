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
// IDs das planilhas usadas pela Jornada.
// Virada de 21/11/2026: planilhas OFICIAIS (antes eram as cópias de teste:
//   renovacao 15yJEjzP..., engajamento 19AOaj1d..., formandos 1csuSKGz...)
const PLANILHAS = {
  renovacao:   '1MoWvv-7rRnnSuttr5ID4ugrcOWSVhh2iwZpKbosxxNc', // OFICIAL: Estácio — Renovação de Matrícula 2026
  engajamento: '1GQ1svA47TuXFRH2VXktUYxnV_B-gZTGWdwwrhEB5h-s', // OFICIAL: EngajaVR ("Planilha sem título")
  formandos:   '1kAVYw7wNKYiJui44LhKQwUPjgMJMQRv2isLWTwfYG-M', // OFICIAL: Formandos
  // Sistemas novos (não existiam antes): ficam na planilha Central até termos volume que peça planilha própria
  financiamentos: '',
  nps:            '',
  provas:         '', // acionamentos de Provas, Estágio e Financeiro: vazio = planilha Central
  estagio:        '',
  financeiro:     '',
  apoio:          '', // Apoio às Avaliações (NAAP/NAE); vazio = planilha Central
  risco:          '', // Alunos em risco: só lê os outros sistemas
  evasao:         '', // Evasão: registros no armazenamento do Engajamento (EvasaoData_<base>) e status na Renovação
};

// Sistemas do CRM. Provas, Estágio e Financeiro leem a base do Engajamento e gravam na Central.
// Financiamentos (ProUni, FIES, Pravaler, Ficou Fácil) e NPS (Medallia) são novos.
const SISTEMAS = ['renovacao', 'engajamento', 'provas', 'estagio', 'financeiro', 'financiamentos', 'nps', 'formandos', 'apoio', 'evasao', 'risco'];

// Perfis. "gestao" libera exportar e ver a produtividade de todos. "bases" libera a Central de Bases (importar).
const PERFIS = {
  admin:       { gestao: true,  admin: true,  bases: true  },
  coordenador: { gestao: true,  admin: false, bases: true  },
  atendente:   { gestao: false, admin: false, bases: true  },
  apoio:       { gestao: false, admin: false, bases: false },
};
// Ações de importação da Central de Bases: valem para quem tem "bases", mesmo sem "gestao".
const ACOES_BASES = ['nucleo.bases_resumo', 'engajamento.salvarBase', 'engajamento.publicarBase', 'engajamento.importarCSVSharePoint',
  'nps.importar', 'estagio.importar'];
const ACOES_BASES_RENOVACAO = ['importar_alunos', 'importar_drive', 'importar_drive_single'];
function podeBases_(eu) { return !!(eu && (PERFIS[eu.perfil] || PERFIS.atendente).bases); }

// Relatório diário único (todos os sistemas)
const EMAIL_RELATORIO = 'marques.marcela@estacio.br';
