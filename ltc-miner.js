// Litecoin Scrypt(1024,1,1) browser CPU miner. Experimental: no pool share acceptance verified.
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const bytes=h=>new Uint8Array(h.match(/../g)?.map(x=>parseInt(x,16))||[]);
const rev=h=>h.match(/../g).reverse().join('');
const swapWords=h=>h.match(/.{8}/g).map(w=>rev(w)).join('');
const leNum=(n,len)=>{let s='';for(let i=0;i<len;i++){s+=(n&255).toString(16).padStart(2,'0');n=Math.floor(n/256)}return s};
const diff1=BigInt('0x0000ffff000000000000000000000000000000000000000000000000000000');
function bitsTarget(bits){const n=parseInt(bits.slice(0,2),16),m=BigInt('0x'+bits.slice(2));return n<=3?m>>BigInt(8*(3-n)):m<<BigInt(8*(n-3))}
const rot=(x,n)=>(x<<n)|(x>>>(32-n));
function salsa(x){let z=new Uint32Array(x);for(let i=0;i<8;i+=2){
 z[4]^=rot((z[0]+z[12])|0,7);z[8]^=rot((z[4]+z[0])|0,9);z[12]^=rot((z[8]+z[4])|0,13);z[0]^=rot((z[12]+z[8])|0,18);
 z[9]^=rot((z[5]+z[1])|0,7);z[13]^=rot((z[9]+z[5])|0,9);z[1]^=rot((z[13]+z[9])|0,13);z[5]^=rot((z[1]+z[13])|0,18);
 z[14]^=rot((z[10]+z[6])|0,7);z[2]^=rot((z[14]+z[10])|0,9);z[6]^=rot((z[2]+z[14])|0,13);z[10]^=rot((z[6]+z[2])|0,18);
 z[3]^=rot((z[15]+z[11])|0,7);z[7]^=rot((z[3]+z[15])|0,9);z[11]^=rot((z[7]+z[3])|0,13);z[15]^=rot((z[11]+z[7])|0,18);
 z[1]^=rot((z[0]+z[3])|0,7);z[2]^=rot((z[1]+z[0])|0,9);z[3]^=rot((z[2]+z[1])|0,13);z[0]^=rot((z[3]+z[2])|0,18);
 z[6]^=rot((z[5]+z[4])|0,7);z[7]^=rot((z[6]+z[5])|0,9);z[4]^=rot((z[7]+z[6])|0,13);z[5]^=rot((z[4]+z[7])|0,18);
 z[11]^=rot((z[10]+z[9])|0,7);z[8]^=rot((z[11]+z[10])|0,9);z[9]^=rot((z[8]+z[11])|0,13);z[10]^=rot((z[9]+z[8])|0,18);
 z[12]^=rot((z[15]+z[14])|0,7);z[13]^=rot((z[12]+z[15])|0,9);z[14]^=rot((z[13]+z[12])|0,13);z[15]^=rot((z[14]+z[13])|0,18);
 }for(let i=0;i<16;i++)x[i]=(x[i]+z[i])|0}
function blockmix(x){const t=new Uint32Array(x.subarray(16,32));for(let k=0;k<2;k++){for(let i=0;i<16;i++)t[i]^=x[k*16+i];salsa(t);x.set(t,k*16)}}
async function pbkdf2(password,salt,len){const key=await crypto.subtle.importKey('raw',password,'PBKDF2',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:1},key,len*8))}
async function scrypt80(header){const b=await pbkdf2(header,header,128),x=new Uint32Array(32),view=new DataView(b.buffer);for(let i=0;i<32;i++)x[i]=view.getUint32(i*4,true);const v=new Uint32Array(32768);for(let i=0;i<1024;i++){v.set(x,i*32);blockmix(x)}for(let i=0;i<1024;i++){const j=(x[16]&1023)*32;for(let k=0;k<32;k++)x[k]^=v[j+k];blockmix(x)}for(let i=0;i<32;i++)view.setUint32(i*4,x[i],true);return pbkdf2(header,b,32)}
let running=false,job=null,extra1='',extra2Size=4,difficulty=64,extra2=0n,hashes=0,best=0,started=0,workerIndex=0,workerCount=1;
const notify=(type,data={})=>postMessage({type,...data});
async function mine(task){let local=0,last=performance.now();while(running&&job===task){const x2=extra2.toString(16).padStart(extra2Size*2,'0');extra2=(extra2+BigInt(workerCount))%(1n<<BigInt(extra2Size*8));let root=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',await crypto.subtle.digest('SHA-256',bytes(task.coinb1+extra1+x2+task.coinb2)))));for(const branch of task.branches)root=hex(new Uint8Array(await crypto.subtle.digest('SHA-256',await crypto.subtle.digest('SHA-256',bytes(root+branch)))));const header=bytes(leNum(parseInt(task.version,16),4)+swapWords(task.prevhash)+rev(root)+leNum(parseInt(task.ntime,16),4)+leNum(parseInt(task.nbits,16),4)+'00000000');const dv=new DataView(header.buffer),target=bitsTarget(task.nbits);for(let nonce=0;running&&job===task&&nonce<4294967295;nonce++){dv.setUint32(76,nonce,true);const h=await scrypt80(header),value=BigInt('0x'+hex(h.slice().reverse()));hashes++;local++;const z=value===0n?256:256-value.toString(2).length;if(z>best){best=z;notify('best',{bits:z,hash:hex(h.slice().reverse())})}if(value<=diff1/BigInt(Math.max(1,Math.floor(difficulty)))||value<=target)notify('share',{params:['bridge-enforced-identity',task.id,x2,task.ntime,nonce.toString(16).padStart(8,'0')],block:value<=target,hash:hex(h.slice().reverse())});if(performance.now()-last>1300){const now=performance.now();notify('progress',{hashes,rate:Math.round(local*1000/(now-last))});local=0;last=now;await new Promise(r=>setTimeout(r,0))}}}}
onmessage=e=>{const m=e.data;if(m.type==='start'){running=true;workerIndex=Number(m.index)||0;workerCount=Math.max(1,Number(m.count)||1);extra2=BigInt(workerIndex);hashes=0;best=0;started=performance.now();notify('status',{text:'Waiting for live Litecoin job'});if(job)mine(job).catch(err=>notify('error',{message:String(err)}))}if(m.type==='stop'){running=false;job=null}if(m.type==='extranonce'){extra1=m.extra1;extra2Size=m.size}if(m.type==='difficulty'){difficulty=Number(m.value)||64}if(m.type==='job'){job=m.job;if(running)mine(job).catch(err=>notify('error',{message:String(err)}))}};
