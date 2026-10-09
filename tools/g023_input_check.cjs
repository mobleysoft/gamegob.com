// Portable integration check: actual vendor, kit, game and update loop; DOM/audio
// doubles and synthetic input. Browser measurement: g023_input_check.py + .html.
// Run: node tools/g023_input_check.cjs > /tmp/g023-node-evidence.json
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const files = ['assets/weyland-input.js', 'assets/gg-mobile.js', 'forge_survival.html'];
const sources = Object.fromEntries(files.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const main = [...sources['forge_survival.html'].matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(m => m[1]).find(s => s.includes("const canvas=document.getElementById('c')"));
const checks = [];
const check = (name, pass, observed) => { checks.push({name, pass: !!pass, observed}); };
const near = (a,b) => Math.abs(a-b) < 1e-7;
const zero = m => near(m.x,0) && near(m.y,0);

class Target {
  constructor(tag='') { this.tagName=tag; this.nodeName=tag; this.handlers={}; this.style={}; this.children=[]; this.attrs={}; this.classList={add(){},toggle(){}}; }
  addEventListener(type, fn) { (this.handlers[type]??=[]).push(fn); }
  removeEventListener(type, fn) { this.handlers[type]=(this.handlers[type]||[]).filter(f=>f!==fn); }
  dispatchEvent(e) { e.target??=this; e.preventDefault??=()=>{e.defaultPrevented=true}; e.stopPropagation??=()=>{}; for(const fn of [...(this.handlers[e.type]||[])]) fn(e); return !e.defaultPrevented; }
  setAttribute(k,v) { this.attrs[k]=v; }
  getAttribute(k) { return this.attrs[k]??null; }
  hasAttribute(k) { return k in this.attrs; }
  appendChild(el) { this.children.push(el); el.parentNode=this; return el; }
  remove() { if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(el=>el!==this); }
  closest() { return null; }
  querySelectorAll() { return []; }
  setPointerCapture() {}
  getBoundingClientRect() { return {left:232,top:682,width:140,height:140}; }
}
function fixture({coarse=false, missing=false, inline=false}={}) {
  const win=new Target(),doc=new Target(),canvas=new Target('CANVAS'),frames=new Map(),scripts=[],errors=[];
  let now=0,id=0,c;
  const gradient={addColorStop(){}};
  const ctx=new Proxy({measureText:t=>({width:String(t).length*8}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},
    {get:(o,k)=>k in o?o[k]:(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  canvas.getContext=()=>ctx;
  doc.body=new Target('BODY');doc.documentElement=new Target('HTML');doc.head=new Target('HEAD');
  doc.hidden=false;doc.readyState='loading';doc.activeElement=doc.body;
  doc.currentScript={src:inline?'':'http://localhost/subpath/assets/gg-mobile.js?v=20261009'};
  doc.baseURI='http://localhost/subpath/forge_survival.html';
  doc.createElement=tag=>new Target(tag.toUpperCase());
  doc.getElementById=id=>id==='c'?canvas:null;
  doc.querySelector=()=>null;doc.querySelectorAll=()=>[];
  doc.head.appendChild=script=>{scripts.push(script.src);Promise.resolve().then(()=>{
    if(missing){script.onerror();return}
    vm.runInContext(sources['assets/weyland-input.js'],c,{filename:'weyland-input.js'});script.onload();
  });return script};
  const node=()=>new Proxy({frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}},{get:(o,k)=>o[k]||(()=>{})});
  class Audio { constructor(){this.state='running';this.currentTime=0;this.destination={}} createOscillator(){return node()} createGain(){return node()} resume(){return Promise.resolve()} }
  Object.assign(win,{window:win,document:doc,console:{error:e=>errors.push(e.message)},navigator:{getGamepads:()=>[]},
    matchMedia:q=>({matches:q==='(hover: none) and (pointer: coarse)'&&coarse}),AudioContext:Audio,
    innerWidth:coarse?390:900,innerHeight:coarse?844:700,URL,location:{origin:'http://localhost',pathname:'/subpath/forge_survival.html'},
    performance:{now:()=>now},requestAnimationFrame:cb=>{frames.set(++id,cb);return id},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:()=>0,clearTimeout(){},localStorage:{getItem:()=>null,setItem(){}},CustomEvent:class {constructor(type){this.type=type}}});
  c=vm.createContext(win);
  const run=code=>vm.runInContext(code,c);
  vm.runInContext(sources['assets/gg-mobile.js'],c,{filename:'gg-mobile.js'});
  vm.runInContext(main,c,{filename:'forge_survival.html'});
  const step=()=>{now+=1000/60;const queued=[...frames.values()];frames.clear();queued.forEach(cb=>cb(now))};
  const event=(target,type,props={})=>target.dispatchEvent({type,cancelable:true,...props});
  const key=(code,down=true,repeat=false)=>event(win,down?'keydown':'keyup',{code,repeat,key:code==='Enter'?'Enter':code==='Space'?' ':code.startsWith('Key')?code.slice(3).toLowerCase():code});
  const pos=()=>run('({x:player.x,y:player.y})');
  const move=()=>run('movementInput.state().move');
  const displacement=fn=>{const p=pos();fn();step();const q=pos();return {x:q.x-p.x,y:q.y-p.y}};
  return {win,doc,canvas,run,step,event,key,pos,move,displacement,scripts,errors,ready:async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()}};
}
(async()=>{
  try {
    const f=fixture();await f.ready();
    check('kit resolves the local vendor relative to its own URL',f.scripts[0]==='http://localhost/subpath/assets/weyland-input.js?v=100073ef1640',f.scripts);
    f.key('Enter');f.step();for(let i=0;i<60;i++){f.key('Enter',true,true);f.step()}
    check('single Enter selects; held repeat cannot advance to gameplay',f.run('state===STATE.CHAR_SELECT'),{state:f.run('state'),repeatFrames:60});
    f.key('Enter',false);f.key('Enter');f.step();f.key('Enter',false);
    check('second distinct single press starts game',f.run('state===STATE.PLAYING'),f.run('state'));
    const distance=f.run('player.speed/60');
    for(const [code,x,y] of [['KeyD',1,0],['KeyA',-1,0],['KeyW',0,-1],['KeyS',0,1],['ArrowRight',1,0],['ArrowLeft',-1,0],['ArrowUp',0,-1],['ArrowDown',0,1]]){
      f.key(code);const move=f.move(),d=f.displacement(()=>{});f.key(code,false);
      check(code+' moves on first update through SightX',near(d.x,x*distance)&&near(d.y,y*distance)&&near(move.x,x)&&near(move.y,-y),{move,displacement:d,dt:1/60});
    }
    let d=f.displacement(()=>{});check('key release stops movement',zero(d)&&zero(f.move()),d);
    f.key('KeyD');f.key('KeyW');let move=f.move();f.key('KeyD',false);f.key('KeyW',false);check('diagonal normalized to unit length',near(Math.hypot(move.x,move.y),1),move);
    f.key('KeyA');f.key('KeyD');move=f.move();f.key('KeyA',false);f.key('KeyD',false);check('opposite keys cancel',zero(move),move);
    for(const type of ['blur','resize','orientationchange']){f.key('KeyD');f.event(f.win,type);d=f.displacement(()=>{});check(type+' clears movement without keyup',zero(d)&&zero(f.move()),{move:f.move(),displacement:d})}
    f.key('KeyD');f.run('state=STATE.LEVEL_UP');f.step();move=f.move();f.run('state=STATE.PLAYING');d=f.displacement(()=>{});check('menu transition clears input before resuming',zero(move)&&zero(d),{menu:move,displacement:d});
    f.key('KeyD');f.doc.hidden=true;f.event(f.doc,'visibilitychange');move=f.move();f.doc.hidden=false;f.event(f.doc,'visibilitychange');d=f.displacement(()=>{});check('hidden/resume clears input',zero(move)&&zero(d),{hidden:move,displacement:d});
    f.key('KeyD');const input=new Target('INPUT');f.doc.activeElement=input;f.event(f.doc,'focusin',{target:input});f.key('KeyW');move=f.move();f.doc.activeElement=f.doc.body;check('text focus clears and suppresses movement',zero(move),move);
    const second=await f.win.GG.createInput({active:()=>false});check('second consumer reuses a single vendor load',f.scripts.length===1,f.scripts);second.destroy();

    const t=fixture({coarse:true});await t.ready();
    const pointer=(target,type,x,y,id=1)=>t.event(target,type,{isPrimary:true,button:0,pointerType:'touch',pointerId:id,clientX:x,clientY:y});
    pointer(t.canvas,'pointerdown',195,300);t.step();pointer(t.canvas,'pointerup',195,300);check('single pointer contact opens selection',t.run('state===STATE.CHAR_SELECT'),t.run('state'));
    pointer(t.canvas,'pointerdown',195,724);t.step();pointer(t.canvas,'pointerup',195,724);t.step();check('one Start tap starts play',t.run('state===STATE.PLAYING'),t.run('state'));
    const stick=t.doc.body.children.find(el=>el.className==='weyland-stick'),cx=302,cy=752;
    check('coarse pointer mounts the vendor stick',!!stick&&t.run('movementInput.stickVisible'),{className:stick?.className,visible:t.run('movementInput.stickVisible')});
    pointer(stick,'pointerdown',cx+40,cy);move=t.move();d=t.displacement(()=>{});check('first stick contact moves without hold or double-tap',move.x>0&&d.x>0&&near(d.y,0),{move,displacement:d,dt:1/60});
    pointer(stick,'pointermove',cx,cy-52);move=t.move();d=t.displacement(()=>{});check('drag up maps +forward to -canvasY',near(move.y,1)&&d.y<0&&near(d.x,0),{move,displacement:d});
    pointer(stick,'pointermove',cx+52,cy);t.key('KeyW');move=t.move();t.key('KeyW',false);check('stick and keys share normalized movement',move.x>0&&move.y>0&&near(Math.hypot(move.x,move.y),1),move);
    pointer(stick,'pointerdown',cx-52,cy,2);pointer(stick,'pointerup',cx-52,cy,2);move=t.move();check('second contact cannot steal the stick',near(move.x,1),move);
    pointer(stick,'pointermove',cx+2,cy);check('stick dead zone is neutral',zero(t.move()),t.move());
    for(const type of ['pointerup','pointercancel','lostpointercapture']){
      pointer(stick,'pointerup',cx,cy);pointer(stick,'pointerdown',cx+52,cy);pointer(stick,type,cx+52,cy);d=t.displacement(()=>{});
      check(type+' stops movement',zero(t.move())&&zero(d),{move:t.move(),displacement:d});
    }
    t.event(t.canvas,'dblclick');d=t.displacement(()=>{});check('double-click does not activate gameplay behavior',zero(d)&&t.run('state===STATE.PLAYING'),{displacement:d,state:t.run('state')});
    t.run('movementInput.setEnabled(false)');t.key('KeyD');pointer(stick,'pointerdown',cx+52,cy);d=t.displacement(()=>{});check('disabling shared input stops BOTH sources',zero(d)&&zero(t.move()),{move:t.move(),displacement:d});
    t.run('movementInput.setEnabled(true)');t.step();t.key('KeyD');pointer(stick,'pointerdown',cx+52,cy);t.run('movementInput.destroy()');t.key('KeyD');d=t.displacement(()=>{});check('destroy removes stick and event listeners',!t.doc.body.children.includes(stick)&&zero(d),{displacement:d,stickRemoved:!t.doc.body.children.includes(stick)});
    check('game/kit produced no runtime errors',f.errors.length===0&&t.errors.length===0,[...f.errors,...t.errors]);
    const missing=fixture({missing:true});await missing.ready();missing.key('Enter');missing.step();check('missing vendor reports failure and prevents play',missing.run('inputError && !movementInput && state===STATE.TITLE'),{state:missing.run('state'),errors:missing.errors});
    const inline=fixture({inline:true});await inline.ready();check('inlined kit resolves a local vendor without crashing',inline.run('!!movementInput')&&inline.scripts[0]==='http://localhost/subpath/assets/weyland-input.js?v=100073ef1640',inline.scripts);
    const provenance=JSON.parse(fs.readFileSync(path.join(root,'assets/weyland-input.provenance.json')));
    const vendorHash=crypto.createHash('sha256').update(sources['assets/weyland-input.js']).digest('hex');
    check('vendor matches pinned upstream SHA-256',vendorHash===provenance.sha256,{sha256:vendorHash,commit:provenance.commit});
  } catch(error) {check('integration check completed',false,{message:error.message,stack:error.stack})}
  const report={goal:'g023',recorded_at:new Date().toISOString(),method:'Node VM executes production vendor, shared kit, game and game loop with DOM/audio doubles, synthetic input and explicit 1/60-second frames. Browser/physical-device measurement is separate.',
    source_sha256:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(sources[file]).digest('hex')])),checks,passed:checks.filter(c=>c.pass).length};
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.passed===checks.length?0:1;
})();
