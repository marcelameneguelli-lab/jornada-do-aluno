# Gera gas/11_Renovacao.gs a partir do backend RenovaVR v6.6, sem mudar regras de negócio.
import re, os
AQUI=os.path.dirname(os.path.abspath(__file__)); RAIZ=os.path.dirname(AQUI)
src=open(os.path.join(RAIZ,'_referencia/renovavr/estacio_gas_backend_v6.6.gs'),encoding='utf8').read()
def troca(s,a,b,n=1):
    assert s.count(a)==n,(a[:80],s.count(a)); return s.replace(a,b)
s=src
# 1. planilha: a cópia/oficial configurada no projeto único
s=troca(s,"""function getSpreadsheet() {
  const id = SPREADSHEET_ID || PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID não configurado. Execute configurarPlanilha() primeiro.');
  return SpreadsheetApp.openById(id);
}""","""function getSpreadsheet() { return planilhaDo_('renovacao'); }""")
s=troca(s,"""  let ss;
  if (SPREADSHEET_ID) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  else if (PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')) ss = getSpreadsheet();
  else {
    ss = SpreadsheetApp.create('Estácio — Renovação de Matrícula');
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  }""","""  const ss = getSpreadsheet();""")
# 2. configurações do script isoladas com prefixo
n=s.count('PropertiesService.getScriptProperties()')
s=s.replace('PropertiesService.getScriptProperties()','propsRenovacao_()')
# 3. sessão: vem do login único (o roteador já autenticou)
s=troca(s,"    sess = validarSessao(d.token);","    sess = d.__sess || null;")
# 4. gatilho do relatório com nome próprio
s=s.replace("t.getHandlerFunction() === 'relatoriosDiarios'","t.getHandlerFunction() === 'renovacao_relatoriosDiarios'").replace("ScriptApp.newTrigger('relatoriosDiarios')","ScriptApp.newTrigger('renovacao_relatoriosDiarios')")
assert "'relatoriosDiarios'" not in s
# lista de ações do roteador original
m=re.search(r'const mapa = \{(.*?)\n  \};',s,re.S); acoes=re.findall(r'^\s*([a-z_]+)\s*:',m.group(1),re.M)
ind='\n'.join(('    '+l if l.strip() else l) for l in s.split('\n'))
DO_NUCLEO=['login','logout','sessao','trocar_senha','usuarios_listar','usuario_salvar','usuario_resetar_senha','usuario_remover']
out=f'''/**
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
function propsRenovacao_() {{
  const p = PropertiesService.getScriptProperties(), pre = 'renovacao_';
  return {{
    getProperty: k => p.getProperty(pre + k),
    setProperty: (k, v) => {{ p.setProperty(pre + k, v); return this; }},
    deleteProperty: k => p.deleteProperty(pre + k),
    getProperties: () => {{ const o = {{}}, t = p.getProperties(); Object.keys(t).forEach(k => {{ if (k.indexOf(pre) === 0) o[k.slice(pre.length)] = t[k]; }}); return o; }},
    deleteAllProperties: () => Object.keys(p.getProperties()).forEach(k => {{ if (k.indexOf(pre) === 0) p.deleteProperty(k); }}),
  }};
}}

function Renovacao_() {{
  if (Renovacao_.ns) return Renovacao_.ns;
  Renovacao_.ns = (function () {{
{ind}

    return {{ processarAcao, relatoriosDiarios, ativarRelatorioDiario, testarRelatorioDiario, configurarPlanilha, repararAcionamentos }};
  }})();
  return Renovacao_.ns;
}}

const ACOES_RENOVACAO = {acoes!r};
const ACOES_RENOVACAO_NO_NUCLEO = {DO_NUCLEO!r};

function Modulo_renovacao() {{
  const acoes = {{}};
  ACOES_RENOVACAO.forEach(nome => {{
    acoes[nome] = (d, eu) => {{
      if (ACOES_RENOVACAO_NO_NUCLEO.indexOf(nome) >= 0) {{
        return {{ ok: false, erro: 'Login, senha e usuários agora ficam na Jornada do Aluno (menu Usuários e perfis).' }};
      }}
      d.__sess = {{ email: eu.email, nome: eu.nome, perfil: eu.perfil, token: '', exp: 0 }};
      return Renovacao_().processarAcao(nome, d);
    }};
  }});
  return {{ acoes: acoes, gestao: [], admin: [] }}; // as regras de perfil são as do código original
}}

/* Rodar pelo editor do Apps Script */
function renovacao_configurarPlanilha() {{ Renovacao_().configurarPlanilha(); }}
function renovacao_relatoriosDiarios() {{ Renovacao_().relatoriosDiarios(); }}
function renovacao_ativarRelatorioDiario() {{ Renovacao_().ativarRelatorioDiario(); }}
function renovacao_testarRelatorioDiario() {{ Renovacao_().testarRelatorioDiario(); }}
function renovacao_repararAcionamentos() {{ Renovacao_().repararAcionamentos(); }}
'''
# Nomes da equipe = usuários da Jornada (decisão de 21/11/2026): o acionamento grava o nome do login e
# a lista de atendentes (distribuição, metas, ranking) vem dos usuários com a Renovação liberada.
_v = "salvar_acionamento:    () => salvarAcionamento(d.acionamento),"
assert out.count(_v) == 1, 'salvar_acionamento'
out = out.replace(_v, "salvar_acionamento:    () => salvarAcionamento(Object.assign({}, d.acionamento, sess && sess.nome ? { colab: sess.nome } : {})),")
_v = """    function carregarAtendentes() {
      return { ok: true, atendentes: lerUsuarios().map(usuarioPublico) };
    }"""
assert out.count(_v) == 1, 'carregarAtendentes'
out = out.replace(_v, """    function carregarAtendentes() {
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
    }""")
# bloqueios curtos: se um processo demorado segurar o bloqueio, segue em vez de dar "Tempo limite do bloqueio"
out = re.sub(r"(?:const|var) lock = LockService\.getScriptLock\(\);\s*\n(\s*)lock\.waitLock\((\d+)\);", r"var lock = bloqueio_(\2);", out)

open(os.path.join(RAIZ,'gas/11_Renovacao.gs'),'w',encoding='utf8').write(out)
print('ok', n,'usos de propriedades isolados;', len(acoes),'ações')
