import { connect } from 'cloudflare:sockets';
const HOST='stratum.ckpool.org', PORT=3333;
const WALLET='14c6FYanugodb4unhbXWrb2S6as4JbL4E5';
export default {
 async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==='/status')return Response.json({project:'SALEHBC',mode:'SOLO',bridge:'READY',pool:`${HOST}:${PORT}`,wallet:WALLET,connected:false,info:'Bridge ready; no persistent pool connection until browser opens /stratum'} ,{headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}});
  if(url.pathname!=='/stratum'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('SALEHBC SOLO bridge. WebSocket /stratum required.',{status:400});
  const [client,server]=Object.values(new WebSocketPair());server.accept();
  let tcp,writer,reader,closed=false,buffer='',outstanding=0;
  const send=o=>{try{server.send(typeof o==='string'?o:JSON.stringify(o))}catch{}};
  const shutdown=()=>{if(closed)return;closed=true;try{reader?.cancel()}catch{}try{writer?.releaseLock()}catch{}try{tcp?.close()}catch{}try{server.close(1000,'Closed')}catch{}};
  try{
   tcp=connect({hostname:HOST,port:PORT});writer=tcp.writable.getWriter();reader=tcp.readable.getReader();
   server.addEventListener('message',async e=>{
    if(closed)return;
    try{
     const msg=JSON.parse(String(e.data));
     if(!msg||typeof msg.method!=='string'||!['mining.subscribe','mining.authorize','mining.submit','mining.suggest_difficulty','mining.configure'].includes(msg.method))return;
     if(msg.method==='mining.authorize'){msg.params=[WALLET,'x'];}
     if(msg.method==='mining.submit'){
      if(!Array.isArray(msg.params)||msg.params.length!==5||!msg.params.slice(1).every(x=>typeof x==='string')||msg.params.some(x=>String(x).length>256))return;
      msg.params[0]=WALLET;
     }
     if(JSON.stringify(msg).length>2048)return;
     await writer.write(new TextEncoder().encode(JSON.stringify(msg)+'\n'));
    }catch(err){send({bridge_error:String(err)})}
   });
   server.addEventListener('close',shutdown);server.addEventListener('error',shutdown);
   (async()=>{try{while(!closed){const {value,done}=await reader.read();if(done)break;buffer+=new TextDecoder().decode(value,{stream:true});if(buffer.length>131072)throw Error('Pool buffer overflow');let idx;while((idx=buffer.indexOf('\n'))!==-1){const line=buffer.slice(0,idx).trim();buffer=buffer.slice(idx+1);if(line)send(line)}}}catch(e){send({bridge_error:'Pool disconnected: '+String(e)})}finally{shutdown()}})();
  }catch(e){send({bridge_error:'Pool connection failed: '+String(e)});shutdown()}
  return new Response(null,{status:101,webSocket:client});
 }
};
