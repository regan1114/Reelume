import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ffmpeg,probe,runNative} from '../server/native';
import {Library} from '../server/library';
import {renderSegment} from '../server/render';
import {newProject,makeClip} from '../shared/model';

test('one-frame audiovisual segments finish with exact frame counts', {timeout:20000},async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'reelume-short-export-'));
 try{
  const source=path.join(root,'source.mov');
  await ffmpeg(['-f','lavfi','-i','testsrc2=size=160x90:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','2','-c:v','libx264','-c:a','aac',source]);
  const library=new Library(root),media=await library.prepare(source);library.records=[media];
  const p=newProject();p.clips=[makeClip({start:0,kind:'video',trackId:'main',mediaId:media.id,duration:60}),makeClip({start:0,kind:'shape',trackId:'overlay',duration:60,scale:.2})];
  for(const frame of [0,30,59]){
   const dest=path.join(root,`frame-${frame}.mov`);
   await renderSegment(p,library,[],'public/fonts',frame,frame+1,{resolution:720,quality:'standard',encoder:'libx264'},dest,path.join(root,'assets'),{size:{width:160,height:90},signal:AbortSignal.timeout(5000)});
   const info=await probe(dest);assert.equal(info.streams.find((s:any)=>s.codec_type==='video').nb_frames,'1');
   assert.ok(Math.abs(Number(info.streams.find((s:any)=>s.codec_type==='audio').duration)-1/30)<.002);
  }
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('cancel terminates a native process even when it ignores SIGTERM',{timeout:6000},async()=>{
 const controller=new AbortController();
 const result=runNative(process.execPath,['-e',"process.on('SIGTERM',()=>{});console.log('out_time_us=1');setInterval(()=>{},1000)"],{signal:controller.signal,onProgress:()=>controller.abort()});
 await assert.rejects(result,/工作已暫停/);
});
