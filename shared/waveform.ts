// 10 ms peaks, bounded for long recordings to keep library responses manageable.
export const waveformBinCount=(duration:number)=>Math.max(600,Math.min(360000,Math.ceil(duration*100)));

export function waveformPath(peaks:readonly number[],duration:number,sourceStart:number,secondsPerPixel:number,width:number){
  if(!peaks.length||duration<=0||secondsPerPixel<=0||width<=0)return '';
  const rate=peaks.length/duration,segments:string[]=[];
  // Anchor the strokes to source time so scrolling does not make them shimmer.
  const offset=sourceStart/secondsPerPixel;
  for(let x=Math.ceil(offset/2)*2-offset+.5;x<width;x+=2){
    const from=Math.floor((sourceStart+(x-.5)*secondsPerPixel)*rate);
    const to=Math.ceil((sourceStart+(x+1.5)*secondsPerPixel)*rate);
    let peak=0;
    for(let i=Math.max(0,from);i<Math.min(peaks.length,to);i++)peak=Math.max(peak,peaks[i]);
    const height=Math.min(1,Math.max(0,peak))*9;
    segments.push(`M${x.toFixed(2)} ${(10-height).toFixed(2)}V${(10+height).toFixed(2)}`);
  }
  return segments.join('');
}
