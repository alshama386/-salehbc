// Integration test with a local mock Stratum pool. No network access beyond localhost.
'use strict';
const net=require('node:net');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const crypto=require('node:crypto');
const {sha2,hashMeetsTarget}=require('./server');
function delay(ms){return new Promise(r=>setTimeout(r,ms));}
async function getPort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;s.close();return p;}
async function main(){
 const mockPort=await getPort(),httpPort=await getPort();
 let submitSeen=false;
 const pool=net.createServer(sock=>{
  let received='';
  sock.on('data',chunk=>{received+=chunk;
   while(received.includes('\n')){const i=received.indexOf('\n');const line=received.slice(0,i);received=received.slice(i+1);
    const req=JSON.parse(line);
    if(req.method==='mining.subscribe')sock.write(JSON.stringify({id:req.id,result:[[], '01020304',4],error:null})+'\n');
    if(req.method==='mining.authorize'){
      assert(req.params[0].startsWith('D88AHivqzm3tyrfyUmc8qhv5pKzG2S3eLN'));
      sock.write(JSON.stringify({id:req.id,result:true,error:null})+'\n');
      sock.write(JSON.stringify({id:null,method:'mining.set_difficulty',params:[0.000001]})+'\n');
      sock.write(JSON.stringify({id:null,method:'mining.notify',params:[
        'test-job','00'.repeat(32),'01000000','ffffffff',[],
        '20000000','1d00ffff','5f5e1000',true]})+'\n');
    }
    if(req.method==='mining.submit'){
      submitSeen=true;
      assert.equal(req.params[1],'test-job');
      assert.equal(req.params[2],'00000000');
      sock.write(JSON.stringify({id:req.id,result:true,error:null})+'\n');
    }
   }
  });
 });
 await new Promise(r=>pool.listen(mockPort,'127.0.0.1',r));
 const child=spawn(process.execPath,['server.js'],{cwd:__dirname,
  env:{...process.env,PORT:String(httpPort),POOL_PORT:String(mockPort),POOL_HOST:'127.0.0.1'}});
 let stderr='';child.stderr.on('data',b=>stderr+=b.toString());
 try{
   const base='http://127.0.0.1:'+httpPort;
   async function req(url,body){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,result:await r.json()};}
   let up=false;
   for(let i=0;i<50;i++){try{const r=await req('/api/state');if(r.status===200){up=true;break;}}catch{}await delay(80);}
   assert(up,'Server not started');
   assert.equal((await req('/api/start',{})).result.ok,true);
   let state;
   for(let i=0;i<100;i++){state=(await req('/api/state')).result;if(state.status==='mining')break;await delay(50);}
   assert.equal(state.status,'mining',JSON.stringify(state));
   assert(state.job.headerPrefix.length===152);
   const prefix=Buffer.from(state.job.headerPrefix,'hex');
   let nonce=null;
   for(let n=0;n<100000;n++){
     const bytes=Buffer.alloc(4);bytes.writeUInt32LE(n);
     if(hashMeetsTarget(sha2(Buffer.concat([prefix,bytes])),state.job.difficulty)){nonce=n.toString(16).padStart(8,'0');break;}
   }
   assert(nonce,'Could not find a low-difficulty valid share');
   const submitted=await req('/api/share',{jobId:state.job.id,nonce});
   assert.equal(submitted.result.ok,true,JSON.stringify(submitted));
   for(let i=0;i<50;i++){state=(await req('/api/state')).result;if(state.accepted===1)break;await delay(50);}
   assert(submitSeen,'No Stratum submission seen');
   assert.equal(state.accepted,1);
   const dupe=await req('/api/share',{jobId:state.job.id,nonce});assert.equal(dupe.status,400);
   await req('/api/stop',{});
   console.log('PASS: mock Stratum subscribe, authorize, job, valid share, pool acceptance, duplicate rejection');
 }finally{child.kill('SIGKILL');pool.close();if(stderr)console.error(stderr);}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
