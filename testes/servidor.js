// Servidor de teste: serve o app e responde /exec com o backend simulado.
const http=require('http'), fs=require('fs'), path=require('path'), { criar }=require('./mock_gas');
const D='/home/claude/jornada/gas/', APP='/home/claude/jornada/app';
const g=criar(fs.readdirSync(D).filter(f=>f.endsWith('.gs')).sort().map(f=>D+f));
g.configurar(); const sh=g._ss.getSheetByName('usuarios');
sh.appendRow(['Marcela Meneguelli','marques.marcela@estacio.br','admin','todos','sim']);
sh.appendRow(['Angélica Souza','angelica@estacio.br','atendente','renovacao,formandos','sim']);
g.gerarSenhas();
// alunos de exemplo no Formandos (dados fictícios)
const agora=Date.now();
g.Formandos_().gravar_([
  {op:'set',col:'students',id:'202301000001',data:{id:'202301000001',nome:'Ana Exemplo',mat:'202301000001',curso:'Direito',turno:'Noite',doc:'pendente',etapa:'',aac:'pendente',upd:agora}},
  {op:'set',col:'students',id:'202301000002',data:{id:'202301000002',nome:'Bruno Fictício',mat:'202301000002',curso:'Enfermagem',turno:'Manhã',doc:'entregue',etapa:'',aac:'ok',upd:agora}},
]);
// base fictícia da Renovação (ciclo 2026.1)
g.renovacao_configurarPlanilha();
g.Renovacao_().processarAcao('importar_alunos', { __sess:{nome:'Teste',email:'t@e',perfil:'admin'}, ciclo:'2026.1',
  alunos:[1,2,3,4].map(i=>({id:'R'+i, nome:'Renova Exemplo '+i, matricula:'20250100000'+i, curso:i%2?'Direito':'Enfermagem', modalidade:'Presencial', ciclo:'2026.1', status:'pendente', periodo:'3', divTotal:0})) });
fs.writeFileSync('/tmp/prov.json', JSON.stringify({admin:sh.d[1][6], atend:sh.d[2][6]}));
const tipos={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');
  if(u.pathname==='/exec'){
    if(req.method==='POST'){ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ const o=g.doPost({postData:{contents:b}}); res.writeHead(200,{'Content-Type':'application/json'}); res.end(o.t); }); return; }
    const o=g.doGet({parameter:Object.fromEntries(u.searchParams)}); res.writeHead(200,{'Content-Type':'application/javascript'}); return res.end(o.t);
  }
  const f=path.join(APP, u.pathname==='/'?'index.html':decodeURIComponent(u.pathname));
  if(!f.startsWith(APP)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('404');}
  res.writeHead(200,{'Content-Type':tipos[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);
}).listen(8765,()=>console.log('ok 8765'));
