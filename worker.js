// Real SHA-256d proof-of-work using browser WebCrypto. No simulated hashes.
let enabled=false, activeJob=null, currentNonce=0, attemptCount=0;
let tickAt=Date.now(), tickHashes=0, bestBits=0;
const DIFF1 = BigInt('0x00000000FFFF0000000000000000000000000000000000000000000000000000');
function fromHex(hex){return Uint8Array.from(hex.match(/.{2}/g).map(x=>parseInt(x,16)));}
function leadingZeroBitsLE(digest){
 let bits=0;
 for(let i=31;i>=0;i--){let b=digest[i];if(!b){bits+=8;continue;}
  for(let k=7;k>=0;k--){if(b&(1<<k))return bits;bits++;}}
 return bits;
}
function validHash(digest,target){let n=0n;for(let i=31;i>=0;i--)n=(n<<8n)+BigInt(digest[i]);return n<=target;}
function target(diff){const val=Number(diff);const scaled=BigInt(Math.max(1,Math.round(val*1e6)));return (DIFF1*1000000n)/scaled;}
function start(job){
 enabled=true;activeJob=job;currentNonce=0;tickAt=Date.now();tickHashes=0;
 if(!globalThis.crypto?.subtle){postMessage({type:'error',message:'WebCrypto unavailable: use HTTPS or localhost'});enabled=false;return;}
 if(!job)return;
 run(job);
}
async function run(job){
 const prefix=fromHex(job.headerPrefix);
 if(prefix.length!==76){postMessage({type:'error',message:'Invalid mining job header'});return;}
 const header=new Uint8Array(80);header.set(prefix,0);
 const goal=target(job.difficulty);
 while(enabled&&activeJob===job){
   const nonce=currentNonce++>>>0;
   header[76]=nonce&255;header[77]=(nonce>>>8)&255;header[78]=(nonce>>>16)&255;header[79]=(nonce>>>24)&255;
   const a=await crypto.subtle.digest('SHA-256',header);
   const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',a));
   if(!enabled||activeJob!==job)break;
   attemptCount++;tickHashes++;
   const zeros=leadingZeroBitsLE(digest);
   if(zeros>bestBits)bestBits=zeros;
   if(validHash(digest,goal)){
     postMessage({type:'share',jobId:job.id,nonce:nonce.toString(16).padStart(8,'0')});
   }
   const t=Date.now();
   if(t-tickAt>=1000){
     postMessage({type:'stats',hashes:tickHashes,elapsedMs:t-tickAt,bestLeadingZeroBits:bestBits});
     tickHashes=0;tickAt=t;
   }
   // Don't freeze the browser; timer permits worker to receive new jobs / stop.
   if(nonce%64===0)await new Promise(resolve=>setTimeout(resolve,0));
   if(currentNonce>0xffffffff)currentNonce=0;
 }
}
onmessage=event=>{
  if(event.data?.type==='start'){
    enabled=false;activeJob=null;
    setTimeout(()=>start(event.data.job),0);
  }else if(event.data?.type==='stop'){
    enabled=false;activeJob=null;
    if(tickHashes){postMessage({type:'stats',hashes:tickHashes,elapsedMs:Date.now()-tickAt,bestLeadingZeroBits:bestBits});tickHashes=0;}
  }
};
