import { test, expect, type Page } from '@playwright/test';
import { makeClip, newProject, uid, type Project } from '../../shared/model';

async function open(page:Page,p:Project){
  expect((await page.request.put(`/api/projects/${p.id}`,{headers:{'X-Reelume':'1'},data:p})).ok()).toBeTruthy();
  await page.goto('/');await page.getByRole('button',{name:`開啟 ${p.name}`,exact:true}).click();
  await expect(page.getByText('已儲存至本機',{exact:true})).toBeVisible();
}
async function read(page:Page,p:Project){
  await expect(page.getByText('已儲存至本機',{exact:true})).toBeVisible();
  return await(await page.request.get(`/api/projects/${p.id}`)).json() as Project;
}

for(const mode of ['move','left','right','caption'] as const)test(`${mode} gesture is a preview until drop, and Escape preserves redo`,async({page})=>{
  const p=newProject();p.name=`取消手勢 ${mode}`;p.clips=[makeClip({kind:mode==='caption'?'text':'shape',trackId:mode==='caption'?'text':'main',start:30,duration:90,text:'測試字幕',name:'測試片段'})];
  await open(page,p);
  // Keep a real redo entry: canceling a drag must not clear it or add an undo step.
  await page.getByRole('button',{name:'新增標記（M）',exact:true}).click();await read(page,p);
  await page.getByRole('button',{name:/^復原/}).click();await read(page,p);
  const undo=page.getByRole('button',{name:/^復原/}),redo=page.getByRole('button',{name:/^重做/});
  await expect(undo).toBeDisabled();await expect(redo).toBeEnabled();
  let writes=0;page.on('request',r=>{if(r.method()==='PUT'&&r.url().endsWith(`/api/projects/${p.id}`))writes++;});
  const clip=page.locator('.timeline-clip').first(),target=mode==='left'||mode==='right'?clip.locator(`.trim-handle.${mode}`):clip;
  const b=(await target.boundingBox())!,x=b.x+b.width/2,y=b.y+b.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+55,y,{steps:5});
  // Longer than the autosave debounce; only committed data may reach disk.
  await page.waitForTimeout(900);expect(writes).toBe(0);expect((await read(page,p)).clips).toEqual(p.clips);
  await page.keyboard.press('Escape');await page.mouse.up();
  await expect(undo).toBeDisabled();await expect(redo).toBeEnabled();
  expect((await read(page,p)).clips).toEqual(p.clips);await expect(page.locator('.timeline-drag-preview')).toHaveCount(0);
  expect(await clip.evaluate(el=>parseFloat(el.style.left))).toBe(55);
  // A committed gesture is one undo step, including multiple pointer moves.
  const next=(await target.boundingBox())!;
  await page.mouse.move(next.x+next.width/2,next.y+next.height/2);await page.mouse.down();await page.mouse.move(next.x+next.width/2+55,next.y+next.height/2,{steps:6});await page.mouse.up();
  const saved=await read(page,p);expect(saved.clips).not.toEqual(p.clips);await expect(redo).toBeDisabled();
  await undo.click();expect((await read(page,p)).clips).toEqual(p.clips);await expect(undo).toBeDisabled();
  await redo.click();expect((await read(page,p)).clips).toEqual(saved.clips);
});

for(const cancel of ['pointercancel','blur'])test(`${cancel} discards a multi-track preview and its automatic lanes`,async({page})=>{
  const p=newProject();p.name=`取消跨軌 ${cancel}`;p.clips=[makeClip({kind:'shape',trackId:'main',start:0,duration:60,name:'固定片段'}),makeClip({kind:'shape',trackId:'main',start:90,duration:60,name:'移動片段'})];
  await open(page,p);
  const clip=page.getByRole('button',{name:'移動片段，00:00:03:00',exact:true}),b=(await clip.boundingBox())!;
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2-110,b.y+b.height/2,{steps:6});
  await expect(page.locator('.track-lane')).toHaveCount(p.tracks.length+1);
  await page.evaluate(type=>window.dispatchEvent(new Event(type)),cancel);await page.mouse.up();
  await expect(page.locator('.track-lane')).toHaveCount(p.tracks.length);expect((await read(page,p)).clips).toEqual(p.clips);await expect(page.getByRole('button',{name:/^復原/})).toBeDisabled();
});

test('markers snap and Alt temporarily releases and restores the snap without moving the pointer',async({page})=>{
  const p=newProject();p.name='標記磁吸與暫停';p.clips=[makeClip({kind:'shape',trackId:'main',start:30,duration:60,name:'移動片段'})];p.markers=[{id:uid(),frame:180,name:'對齊標記'}];
  await open(page,p);
  const b=(await page.locator('.timeline-clip').boundingBox())!,x=b.x+b.width/2,y=b.y+b.height/2,guide=page.locator('.timeline-snap-guide');
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+165+4,y);
  await expect(guide).toHaveCount(1);expect(await guide.evaluate(el=>parseFloat(el.style.left))).toBe(330);
  await page.keyboard.down('Alt');await expect(guide).toHaveCount(0);
  await page.keyboard.up('Alt');await expect(guide).toHaveCount(1);
  await page.mouse.up();expect((await read(page,p)).clips[0].start).toBe(120);
});

test('timeline draft updates composited preview and cancel restores the original pixels',async({page})=>{
  const p=newProject();p.name='拖曳預覽畫面';p.clips=[makeClip({kind:'shape',trackId:'main',start:0,duration:90,name:'畫面'})];
  await open(page,p);
  const pixels=()=>page.locator('.canvas-wrap canvas').evaluate((el:HTMLCanvasElement)=>el.toDataURL()),before=await pixels();
  const b=(await page.locator('.timeline-clip').boundingBox())!;
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+55,b.y+b.height/2);
  await expect.poll(pixels).not.toBe(before);await page.keyboard.press('Escape');await page.mouse.up();await expect.poll(pixels).toBe(before);
});
