# Gera gas/10_Formandos.gs a partir do Code.gs original do Painel Formandos (v3),
# mantendo a lógica de dados e trocando só: planilha, chaves de versão e login.
import re
src=open('/home/claude/jornada/_referencia/formandos/Code.gs',encoding='utf8').read()
lines=src.split('\n')
# segmenta por declarações de topo
starts=[i for i,l in enumerate(lines) if re.match(r'^(function |const )',l)]
segs={}
for k,i in enumerate(starts):
    j=starts[k+1] if k+1<len(starts) else len(lines)
    # recua comentários imediatamente acima
    a=i
    while a>0 and (lines[a-1].startswith('/**') or lines[a-1].startswith(' *') or lines[a-1].startswith('//')): a-=1
    m=re.match(r'^(?:function|const)\s+([A-Za-z_]+)',lines[i]); nome=m.group(1)
    corpo='\n'.join(lines[i:j]).rstrip()
    # remove comentários de seção /* ─── */ do fim
    corpo=re.sub(r'\n/\* ─+[^\n]*\*/\s*$','',corpo)
    segs[nome]=('\n'.join(lines[a:i])+'\n' if a<i else '')+corpo
manter=['COLECOES','SYNC_COLECOES','CABECALHO','LIMITE_CELULA','MAX_OPS_ATENDENTE','BACKUPS_MANTIDOS',
 'validar_','planilha_','aba_','ultima_','gravarUltima_','poll_','delta_','getDoc_','gravar_','aplicar_',
 'serializar_','lerJson_','mesclar_','backupSemanal','ativarBackupSemanal','limparApagados','removerSenhaLimpeza']
faltando=[n for n in manter if n not in segs]; assert not faltando, faltando
corpo='\n\n'.join(segs[n] for n in manter)
# troca planilha e chaves (isoladas por sistema dentro do projeto único)
corpo=corpo.replace("return PLANILHA_ID ? SpreadsheetApp.openById(PLANILHA_ID) : SpreadsheetApp.getActiveSpreadsheet();","return planilhaDo_('formandos');")
corpo=corpo.replace("cache.get('ultima')","cache.get('formandos_ultima')").replace("cache.put('ultima'","cache.put('formandos_ultima'").replace("getCache().put('ultima'","getCache().put('formandos_ultima'")
corpo=corpo.replace("getProperty('ultima')","getProperty('formandos_ultima')").replace("setProperty('ultima'","setProperty('formandos_ultima'")
corpo=corpo.replace("ScriptApp.newTrigger('backupSemanal')","ScriptApp.newTrigger('formandos_backupSemanal')").replace("t.getHandlerFunction() === 'backupSemanal'","t.getHandlerFunction() === 'formandos_backupSemanal'")
corpo=corpo.replace("'ultima'","'formandos_ultima'")
assert 'PLANILHA_ID' not in corpo
ind='\n'.join(('    '+l if l.strip() else l) for l in corpo.split('\n'))
out=f'''/**
 * SISTEMA FORMANDOS
 * Lógica de dados copiada do Painel Formandos v3 (Code.gs), sem alterações de regra:
 * coleções em abas (id | json | upd | del), sincronização por delta e gravação em lote.
 * Mudanças em relação ao original:
 *  - planilha: PLANILHAS.formandos (00_Config.gs);
 *  - login: o do núcleo (02_Acesso.gs); admin e coordenador viram "admin" do painel;
 *  - chaves de versão e gatilho de backup com prefixo "formandos_".
 * Arquivo gerado por ferramentas/gerar_formandos_gas.py. Não editar à mão.
 */

function Formandos_() {{
  if (Formandos_.ns) return Formandos_.ns;
  Formandos_.ns = (function () {{
{ind}

    return {{ validar_, poll_, getDoc_, gravar_, ultima_, aba_, backupSemanal, ativarBackupSemanal, limparApagados, removerSenhaLimpeza, COLECOES }};
  }})();
  return Formandos_.ns;
}}

/** Identidade no formato que o painel espera. */
function formandosEu_(eu) {{
  const regra = PERFIS[eu.perfil] || PERFIS.atendente;
  return {{ nome: eu.nome, email: eu.email, perfil: regra.gestao ? 'admin' : 'atendente' }};
}}

function Modulo_formandos() {{
  const F = Formandos_();
  const comMe = (eu, r) => Object.assign(r, {{ me: formandosEu_(eu) }});
  return {{
    acoes: {{
      ping: (d, eu) => comMe(eu, {{ ok: true, v: F.ultima_() }}),
      poll: (d, eu) => comMe(eu, F.poll_(Number(d.since) || 0)),
      get: (d, eu) => {{
        const col = String(d.col || ''), id = String(d.id || '');
        if (col === 'config' && id !== 'sem' && formandosEu_(eu).perfil !== 'admin') return {{ ok: false, error: 'sem_permissao' }};
        return comMe(eu, F.getDoc_(col, id));
      }},
      ops: (d, eu) => {{
        const ops = Array.isArray(d.ops) ? d.ops : [];
        if (!ops.length) return comMe(eu, {{ ok: true, v: F.ultima_(), n: 0 }});
        if (ops.length > 400) return {{ ok: false, error: 'lote grande demais (máx. 400 operações)' }};
        const v = F.validar_(ops, formandosEu_(eu));
        if (v) return {{ ok: false, error: 'sem_permissao', detalhe: v }};
        return comMe(eu, F.gravar_(ops));
      }},
    }},
    gestao: [],
    admin: [],
  }};
}}

/* Rodar pelo editor do Apps Script */
function formandos_configurar() {{ Formandos_().COLECOES.forEach(c => Formandos_().aba_(c)); Logger.log('Abas do Formandos conferidas.'); }}
function formandos_backupSemanal() {{ Formandos_().backupSemanal(); }}
function formandos_ativarBackupSemanal() {{ Formandos_().ativarBackupSemanal(); }}
function formandos_limparApagados() {{ Formandos_().limparApagados(); }}
function formandos_removerSenhaLimpeza() {{ Formandos_().removerSenhaLimpeza(); }}
'''
import re
# bloqueios curtos: se um processo demorado segurar o bloqueio, segue em vez de dar "Tempo limite do bloqueio"
out = re.sub(r"(?:const|var) lock = LockService\.getScriptLock\(\);\s*\n(\s*)lock\.waitLock\((\d+)\);", r"var lock = bloqueio_(\2);", out)
open('/home/claude/jornada/gas/10_Formandos.gs','w',encoding='utf8').write(out)
print('ok', out.count('\n'),'linhas')
