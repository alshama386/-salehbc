'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {sha2,parseDGBAddress,targetForDiff,hashMeetsTarget,stratumPrevhash}=require('./server');
test('Wallet provided is valid DigiByte P2PKH mainnet with correct checksum',()=>{
 assert.equal(parseDGBAddress('D88AHivqzm3tyrfyUmc8qhv5pKzG2S3eLN'),true);
 assert.equal(parseDGBAddress('D88AHivqzm3tyrfyUmc8qhv5pKzG2S3eLM'),false);
 assert.equal(parseDGBAddress('1BoatSLRHtKNngkdXEeobR76b53LETtpyT'),false);
});
test('SHA256d reproduces known Bitcoin genesis block hash',()=>{
 const header=Buffer.from('01000000' + '00'.repeat(32) +
 '3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a' +
 '29ab5f49'+'ffff001d'+'1dac2b7c','hex');
 assert.equal(header.length,80);
 assert.equal(Buffer.from(sha2(header)).reverse().toString('hex'),'000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f');
});
test('Difficulty target and proof comparison are monotonic',()=>{
 assert(targetForDiff(1)>targetForDiff(10));
 assert(hashMeetsTarget(Buffer.alloc(32),1));
 assert(!hashMeetsTarget(Buffer.alloc(32,255),1));
});
test('Pool prevhash converts 4-byte word endianness',()=>{
 assert.equal(stratumPrevhash('01020304'.repeat(8)).toString('hex'),'04030201'.repeat(8));
});
