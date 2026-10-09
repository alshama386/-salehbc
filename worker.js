import { connect } from 'cloudflare:sockets';
const SOLO_WALLET='14c6FYanugodb4unhbXWrb2S6as4JbL4E5';
const POOL_WORKER='salehbc.001';
const TARGETS={solo:{host:'stratum.ckpool.org',port:3333,user:SOLO_WALLET},pool:{host:'btc.poolbinance.com',port:1800,user:POOL_WORKER}};
export default {async fetch(request){
 const url=new URL(request.url);const mode=url.searchParams.get('mode')==='pool'?'pool':'solo';const target=TARGETS[mode];
 if(url.pathname==='/status')return Response.json({project:'SALEHBC',version:'4.0',mode,host:target.host,port:target.port,worker:target.user,connected:false},{headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}});
 if(url.pathname!=='/stratum'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('SALEHBC v4.0 websocket /stratum?mode=solo|pool',{status:400});
 const [client,server]=Object.values(new WebSocketPair());server.accept();let tcp,writer,reader,closed=false,buffer='';
 const send=o=>{try{server.send(typeof o==='string'?o:JSON.stringify(o))}catch{}};
 const shutdown=()=>{if(closed)return;closed=true;try{reader?.cancel()}catch{}try{writer?.releaseLock()}catch{}try{tcp?.close()}catch{}try{server.close(1000,'Closed')}catch{}};
 try{tcp=connect({hostname:target.host,port:target.port});await tcp.opened;writer=tcp.writable.getWriter();reader=tcp.readable.getReader();
 server.addEventListener('message',async e=>{if(closed)return;try{const m=JSON.parse(String(e.data));if(!m||!['mining.subscribe','mining.authorize','mining.submit','mining.suggest_difficulty','mining.configure'].includes(m.method))return;
 if(m.method==='mining.authorize')m.params=[target.user,'x'];
 if(m.method==='mining.submit'){if(!Array.isArray(m.params)||m.params.length!==5||!m.params.slice(1).every(x=>typeof x==='string')||m.params.some(x=>String(x).length>256))return;m.params[0]=target.user}
 if(JSON.stringify(m).length>2048)return;await writer.write(new TextEncoder().encode(JSON.stringify(m)+'\n'))}catch(err){send({bridge_error:String(err)})}});
 server.addEventListener('close',shutdown);server.addEventListener('error',shutdown);
 (async()=>{try{const decoder=new TextDecoder();while(!closed){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>131072)throw Error('Pool buffer overflow');let i;while((i=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(line)send(line)}}}catch(e){send({bridge_error:'Pool disconnected: '+String(e)})}finally{shutdown()}})();
 }catch(e){send({bridge_error:'Pool connection failed: '+String(e)});shutdown()}
 return new Response(null,{status:101,webSocket:client});}};
