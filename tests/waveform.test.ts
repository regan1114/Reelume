import test from 'node:test';
import assert from 'node:assert/strict';
import { waveformBinCount, waveformPath } from '../shared/waveform';
import { Library } from '../server/library';
import { ffmpeg } from '../server/native';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('waveform retains transients and maps trim, speed and scroll to source time',()=>{
  const peaks=[0,0,1,0,0,0,0,0];
  assert.equal(waveformPath(peaks,8,0,1,8),'M0.50 10.00V10.00M2.50 1.00V19.00M4.50 10.00V10.00M6.50 10.00V10.00');
  assert.equal(waveformPath(peaks,8,2,1,2),'M0.50 1.00V19.00');
  assert.equal(waveformPath(peaks,8,0,2,2),'M0.50 1.00V19.00');
  assert.equal(waveformPath(peaks,8,8,1,2),'M0.50 10.00V10.00');
  assert.equal(waveformPath([],8,0,1,8),'');
  assert.equal(waveformBinCount(3600),360000);
  assert.equal(waveformBinCount(86400),360000);
});

test('existing coarse waveforms regenerate with detailed peaks and silence',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'reelume-waveform-')),library=new Library(root);
  try{
    const file=path.join(root,'tone.wav');
    await ffmpeg(['-f','lavfi','-i','aevalsrc=if(lt(t\\,4)\\,0\\,0.5*sin(2*PI*440*t)):s=8000:d=8',file]);
    await library.init();const media=await library.prepare(file);media.waveform=Array(600).fill(1);await library.addPrepared([media]);
    await library.init();
    const deadline=Date.now()+10000;
    while(library.get(media.id).waveform?.length!==800&&Date.now()<deadline){
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    const peaks=library.get(media.id).waveform!;
    assert.equal(peaks.length,800);assert.ok(peaks.slice(0,390).every(v=>v===0));assert.ok(peaks.slice(410).every(v=>v>.45&&v<=.5));
  }finally{library.close();await fs.rm(root,{recursive:true,force:true});}
});
