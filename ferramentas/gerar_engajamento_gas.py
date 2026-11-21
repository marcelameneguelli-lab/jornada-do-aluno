# Gera gas/12_Engajamento.gs a partir do backend EngajaVR v6, sem mudar regras de negócio.
import re, os
AQUI=os.path.dirname(os.path.abspath(__file__)); RAIZ=os.path.dirname(AQUI)
s=open(os.path.join(RAIZ,'_referencia/engajavr/engajaVR_gas_v6.gs'),encoding='utf8').read()
def troca(s,a,b,n=1):
    assert s.count(a)==n,(a[:80],s.count(a)); return s.replace(a,b)
# 1. planilha da cópia/oficial
s=troca(s,"""function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();""","""function getSheet() {
  var ss = planilhaDo_('engajamento');""")
n_ss=s.count('SpreadsheetApp.getActiveSpreadsheet()')
s=s.replace('SpreadsheetApp.getActiveSpreadsheet()',"planilhaDo_('engajamento')")
# 2. propriedades isoladas
n_p=s.count('PropertiesService.getScriptProperties()')
s=s.replace('PropertiesService.getScriptProperties()','propsEngajamento_()')
# 3. pasta própria no Drive (nunca a de produção)
s=troca(s,"DriveApp.createFolder('EngajaVR_Storage')","DriveApp.createFolder('Jornada_Engajamento_Storage')")
# 4. gatilho com nome próprio
s=s.replace("ScriptApp.newTrigger('enviarRelatorioDiario')","ScriptApp.newTrigger('engajamento_enviarRelatorioDiario')").replace("t.getHandlerFunction() === 'enviarRelatorioDiario'","t.getHandlerFunction() === 'engajamento_enviarRelatorioDiario'")
# 5. extrai o mapa de ações do switch original
casos=re.findall(r"case '([A-Za-z_]+)':\s*result\s*=\s*([^;]+);",s)
assert len(casos)==s.count("case '")==44, len(casos)
linhas=[]
for nome,expr in casos:
    expr=expr.strip()
    linhas.append(f"      {nome}: function (body) {{ return {expr}; }},")
mapa='\n'.join(linhas)
ind='\n'.join(('    '+l if l.strip() else l) for l in s.split('\n'))
out=f'''/**
 * SISTEMA ENGAJAMENTO
 * Backend do EngajaVR v6 (engajaVR_gas_v6.gs) sem mudanças de regra.
 * Mudanças em relação ao original:
 *  - planilha: PLANILHAS.engajamento (00_Config.gs);
 *  - login: o do núcleo. Antes, o servidor aceitava qualquer pedido sem login;
 *    agora só responde a quem entrou na Jornada, e confere o perfil nas ações
 *    administrativas (ver ENGAJAMENTO_ADMIN e ENGAJAMENTO_GESTAO);
 *  - usuários e senhas saem daqui (getUsuarios/saveUsuarios desativados);
 *  - propriedades do script com prefixo "engajamento_" e pasta própria no Drive
 *    (Jornada_Engajamento_Storage), separada da pasta do sistema em produção;
 *  - novas ações savePoloData/loadPoloData: a tela Provas chamava e não existiam,
 *    então os registros de provas ficavam só no navegador de cada pessoa;
 *  - gatilho do relatório: engajamento_enviarRelatorioDiario.
 * Arquivo gerado por ferramentas/gerar_engajamento_gas.py. Não editar à mão.
 */

function propsEngajamento_() {{
  const p = PropertiesService.getScriptProperties(), pre = 'engajamento_';
  return {{
    getProperty: k => p.getProperty(pre + k),
    setProperty: (k, v) => {{ p.setProperty(pre + k, v); }},
    deleteProperty: k => p.deleteProperty(pre + k),
    getProperties: () => {{ const o = {{}}, t = p.getProperties(); Object.keys(t).forEach(k => {{ if (k.indexOf(pre) === 0) o[k.slice(pre.length)] = t[k]; }}); return o; }},
    deleteAllProperties: () => Object.keys(p.getProperties()).forEach(k => {{ if (k.indexOf(pre) === 0) p.deleteProperty(k); }}),
  }};
}}

function Engajamento_() {{
  if (Engajamento_.ns) return Engajamento_.ns;
  Engajamento_.ns = (function () {{
{ind}

    /* Provas (tela "Provas"): registros por matrícula, mesclados pelo mais recente (_ts). */
    function loadPoloData(body) {{
      var base = String((body && body.base) || 'impar');
      var raw = storeGet('PoloData_' + base);
      return {{ ok: true, data: raw ? JSON.parse(raw) : {{}} }};
    }}
    function savePoloData(body) {{
      var base = String((body && body.base) || 'impar');
      var novo = (body && body.data) || {{}};
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {{
        var raw = storeGet('PoloData_' + base), atual = raw ? JSON.parse(raw) : {{}};
        Object.keys(novo).forEach(function (mat) {{
          var r = novo[mat] || {{}}, l = atual[mat];
          if (!l || (Number(r._ts) || 0) >= (Number(l._ts) || 0)) atual[mat] = r;
        }});
        storeSet('PoloData_' + base, JSON.stringify(atual));
        return {{ ok: true, total: Object.keys(atual).length }};
      }} finally {{ lock.releaseLock(); }}
    }}

    var acoes = {{
{mapa}
      savePoloData: savePoloData,
      loadPoloData: loadPoloData,
    }};
    return {{ acoes: acoes, enviarRelatorioDiario: enviarRelatorioDiario, criarTriggerDiario: criarTriggerDiario, testarRelatorio: testarRelatorio, storeGet: storeGet, storeSet: storeSet }};
  }})();
  return Engajamento_.ns;
}}

// Ações que mudam a base ou a estrutura: perfil com gestão (admin ou coordenador)
const ENGAJAMENTO_GESTAO = ['salvarBase', 'publicarBase', 'importarCSVSharePoint'];
// Ações destrutivas ou de manutenção: só admin
const ENGAJAMENTO_ADMIN = ['clearAll', 'restaurarDeAbas', 'reconstruirHistory', 'diagnostico', 'renameAtendente', 'saveRelatEmail'];
// Ações que agora pertencem ao núcleo ou deixaram de existir
const ENGAJAMENTO_DESATIVADAS = {{
  getUsuarios: {{ ok: true, usuarios: [] }},
  saveUsuarios: {{ ok: false, error: 'Usuários agora ficam na Jornada do Aluno (menu Usuários e perfis).' }},
  uploadAppHTML: {{ ok: false, error: 'O aplicativo agora é publicado pela Jornada do Aluno.' }},
}};

function Modulo_engajamento() {{
  const E = Engajamento_();
  const acoes = {{}};
  Object.keys(E.acoes).forEach(nome => {{
    acoes[nome] = (d, eu) => {{
      if (ENGAJAMENTO_DESATIVADAS[nome]) return Object.assign({{}}, ENGAJAMENTO_DESATIVADAS[nome]);
      if (nome === 'getAtendentes') return {{ ok: true, data: nomesEquipe_() }}; // a equipe é a dos usuários da Jornada
      // o atendente é sempre o usuário logado na Jornada (não se escolhe mais numa lista)
      if (eu && eu.nome && d && typeof d === 'object') {{
        if (nome === 'saveAction') d.atend = eu.nome;
        if (nome === 'saveActionLote' && Array.isArray(d.entries)) d.entries.forEach(e => {{ if (e) e.atend = eu.nome; }});
      }}
      return E.acoes[nome](d);
    }};
  }});
  return {{ acoes: acoes, gestao: ENGAJAMENTO_GESTAO, admin: ENGAJAMENTO_ADMIN }};
}}

/* Rodar pelo editor do Apps Script */
function engajamento_enviarRelatorioDiario() {{ Engajamento_().enviarRelatorioDiario(); }}
function engajamento_criarTriggerDiario() {{ Engajamento_().criarTriggerDiario(); }}
function engajamento_testarRelatorio() {{ Engajamento_().testarRelatorio(); }}
'''
# Drive: o DriveApp também devolve arquivos da lixeira. Depois de trocar a base, a leitura podia pegar a
# versão antiga (na lixeira) e o envio em partes juntava pedaços velhos. Lê só o arquivo ativo mais recente,
# e uma falha ao gravar passa a ser erro (antes o servidor dizia "salvo" mesmo sem salvar).
_velho_get = """        var files = folder.getFilesByName('engajavr_' + key + '.json');
        if (files.hasNext()) {
          var f = files.next();
          return f.getBlob().getDataAsString('UTF-8');
        }"""
_novo_get = """        var files = folder.getFilesByName('engajavr_' + key + '.json');
        var melhor = null, quando = -1;
        while (files.hasNext()) {
          var f = files.next();
          if (f.isTrashed()) continue;
          var t = f.getLastUpdated().getTime();
          if (t > quando) { melhor = f; quando = t; }
        }
        if (melhor) return melhor.getBlob().getDataAsString('UTF-8');"""
assert out.count(_velho_get) == 1, 'driveGet'
out = out.replace(_velho_get, _novo_get)
_velho_set = """          var files = folder.getFilesByName(fileName);
          while (files.hasNext()) { files.next().setTrashed(true); } // remove versão antiga
          folder.createFile(fileName, value, 'application/json');"""
_novo_set = """          var antigos = [];
          var files = folder.getFilesByName(fileName);
          while (files.hasNext()) { var fa = files.next(); if (!fa.isTrashed()) antigos.push(fa); }
          folder.createFile(fileName, value, 'application/json'); // grava a nova antes de apagar a antiga
          antigos.forEach(function (fa) { try { fa.setTrashed(true); } catch (e) {} });"""
assert out.count(_velho_set) == 1, 'driveSet'
out = out.replace(_velho_set, _novo_set)
_velho_falha = """      } catch(e) {
        Logger.log('driveSet erro: ' + e.message);
        return false;
      }"""
assert out.count(_velho_falha) == 1, 'driveSet falha'
out = out.replace(_velho_falha, """      } catch(e) {
        Logger.log('driveSet erro: ' + e.message);
        throw new Error('Não foi possível gravar no Drive (' + key + '): ' + e.message);
      }""")
# A planilha do EngajaVR está no limite de células: gravar a linha na aba Acionamentos pode falhar.
# O acionamento fica salvo mesmo assim no histórico (Drive), que é de onde os sistemas leem.
for _velha in ["""      sh.appendRow([entry.datetime, entry.matricula, entry.atend, entry.canal,
                    entry.motivo, entry.obs, entry.base, entry.nps, entry.id]);""",
               """        sh.appendRow([e.datetime||'', e.matricula||'', e.atend||'',
                      e.canal||'', e.motivo||'', e.obs||'', e.base||base, e.nps||'', e.id||'']);"""]:
    assert out.count(_velha) == 1, _velha[:40]
    out = out.replace(_velha, '      try {\n' + _velha + '\n      } catch (eLinha) { Logger.log(\'Acionamentos (planilha cheia?): \' + eLinha.message); }')
for _velha in ["""      var sh = getOrCreate('Acionamentos',
        ['datetime','matricula','atendente','canal','motivo','obs','base','nps','id']);
      var _tz""", """      var sh   = getOrCreate('Acionamentos',
        ['datetime','matricula','atendente','canal','motivo','obs','base','nps','id']);
"""]:
    assert out.count(_velha) == 1, _velha[:40]
    _nova = _velha.replace("var sh = getOrCreate(", "var sh = { appendRow: function () {} }; try { sh = getOrCreate(").replace("var sh   = getOrCreate(", "var sh = { appendRow: function () {} }; try { sh = getOrCreate(").replace("'id']);", "'id']); } catch (eAba) { Logger.log('Acionamentos: ' + eAba.message); }")
    out = out.replace(_velha, _nova)
open(os.path.join(RAIZ,'gas/12_Engajamento.gs'),'w',encoding='utf8').write(out)
print('ok', len(casos),'ações;', n_ss,'acessos à planilha;', n_p,'usos de propriedades isolados')
