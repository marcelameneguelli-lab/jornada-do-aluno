// Virada: a Jornada lê tudo do EngajaVR em uso pela API dele (aqui, o código original rodando num simulador à parte)
const { criar } = require('./mock_gas'); const assert=require('assert'); const fs=require('fs');
const D='/home/claude/jornada/gas/';
const g = criar(fs.readdirSync(D).filter(f=>f.endsWith('.gs')).sort().map(f=>D+f));
const velho = criar(['/home/claude/jornada/_referencia/engajavr/engajaVR_gas_v6.gs']);
const post=o=>JSON.parse(g.doPost({postData:{contents:JSON.stringify(o)}}).t);
const apiVelha=o=>{ const r=velho.doPost({postData:{contents:JSON.stringify(o)}}); return JSON.parse(r.t||r.getContent()); };
let ok=0; const t=(n,f)=>{ try{ f(); ok++; console.log('ok  '+n);}catch(e){ console.log('FALHOU '+n+': '+e.stack.split('\n').slice(0,3).join(' ')); process.exitCode=1; } };
// o EngajaVR em uso, com dados (pequenos ficam nas propriedades dele, como na vida real)
apiVelha({action:'saveEventos',eventos:[{id:'ev1',titulo:'Reunião'}]});
apiVelha({action:'saveTarefas',tarefas:[{id:'t1',texto:'Ligar formandos'}]});
apiVelha({action:'saveAtendentes',atendentes:['Angelica','Felipe']});
apiVelha({action:'saveAction',base:'par',id:'p1',matricula:'202602000001',atend:'Felipe',canal:'WhatsApp',motivo:'academico',datetime:'10/09/2026 10:00:00'});
apiVelha({action:'saveAction',base:'impar',id:'i1',matricula:'202301000100',atend:'Angelica',canal:'Ligação',motivo:'academico',datetime:'20/08/2026 09:00:00'});
g.UrlFetchApp.fetch = (url) => {
  const q={}; url.split('?')[1].split('&').forEach(p=>{ const [k,v]=p.split('='); q[k]=decodeURIComponent(v||''); });
  const r=velho.doGet({parameter:q}); const txt=r.t||r.getContent();
  return { getResponseCode:()=>200, getContentText:()=>txt };
};
g.configurar(); const sh=g._ss.getSheetByName('usuarios');
sh.appendRow(['Marcela','marques.marcela@estacio.br','admin','todos','sim']); sh.appendRow(['Felipe','felipe@estacio.br','coordenador','todos','sim']); g.gerarSenhas();
const login=(email,linha,nova)=>{ const p=sh.d[linha-1][6]; const e=post({acao:'nucleo.entrar',email,senha:p}); return post({acao:'nucleo.trocar_senha',token:e.token,atual:p,nova}).token; };
const tM=login('marques.marcela@estacio.br',2,'Senha2026a'), tF=login('felipe@estacio.br',3,'Senha2026b');
post({acao:'engajamento.saveAction',token:tM,base:'impar',id:'novo1',matricula:'202301000100',atend:'Marcela',canal:'WhatsApp',motivo:'academico'});
const URL='https://script.google.com/macros/s/ABC/exec';
t('endereço inválido é recusado', ()=>{ assert.equal(post({acao:'nucleo.migrar_engajavr',token:tM,url:'http://x'}).ok,false); });
let rel;
t('traz calendário, tarefas, atendentes e acionamentos do EngajaVR', ()=>{ const r=post({acao:'nucleo.migrar_engajavr',token:tM,url:URL}); assert(r.ok,JSON.stringify(r)); rel=r.relatorio; console.log('    ',JSON.stringify(rel)); assert.equal(rel.listas['calendário'],1); assert.equal(rel.listas.tarefas,1); assert.equal(rel.listas.atendentes,2); assert.equal(rel.bases.par.acionamentos,1); assert.equal(rel.bases.impar.acionamentos,1); });
t('na Jornada: calendário e tarefas vieram', ()=>{ assert.equal(post({acao:'ferramentas.getEventos',token:tF}).data[0].titulo,'Reunião'); assert.equal(post({acao:'ferramentas.getTarefas',token:tF}).data[0].texto,'Ligar formandos'); });
t('na Jornada: acionamento antigo e o novo juntos', ()=>{ const h=post({acao:'provas.getHistory',token:tM,base:'impar'}).data['202301000100']; assert.equal(h.length,2); });
t('repetir não duplica', ()=>{ const r=post({acao:'nucleo.migrar_engajavr',token:tM,url:URL}).relatorio; assert.equal(r.listas.tarefas,0); assert.equal(r.bases.impar.acionamentos,0); });
t('só o admin faz a virada', ()=>{ assert.equal(post({acao:'nucleo.migrar_engajavr',token:tF,url:URL}).permissao,false); });
console.log(ok+' testes da virada passaram');
