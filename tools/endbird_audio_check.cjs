// Portable lifecycle checks with Web Audio/DOM doubles. Run: node tools/endbird_audio_check.cjs
// These check scheduling and game integration; physical playback still needs a browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..');
class Target {
 constructor(){this.handlers={};this.attributes={};this.style={};}
 addEventListener(n,f){(this.handlers[n]??=[]).push(f);}
 dispatch(n,e={}){e.type=n;e.stopPropagation??=()=>{};e.preventDefault??=()=>{};for(const f of this.handlers[n]??[])f(e);}
 setAttribute(k,v){this.attributes[k]=v;}
}
class Param {
 constructor(value=0){this.value=value;this.events=[];}
 setValueAtTime(v,t){this.events.push(['set',v,t]);this.value=v;return this;}
 setTargetAtTime(v,t,tau){assert.ok(tau>0);this.events.push(['target',v,t]);this.value=v;return this;}
 linearRampToValueAtTime(v,t){this.events.push(['linear',v,t]);this.value=v;return this;}
 exponentialRampToValueAtTime(v,t){assert.ok(v>0);this.events.push(['exp',v,t]);this.value=v;return this;}
 cancelScheduledValues(t){this.events=this.events.filter(e=>e[2]<t);return this;}
}
class Node {
 constructor(c){this.context=c;this.connections=[];this.gain=new Param(1);this.frequency=new Param(440);this.detune=new Param();this.Q=new Param();this.delayTime=new Param();this.playbackRate=new Param(1);c.nodes.push(this);}
 connect(n){this.connections.push(n);return n;}
 disconnect(){this.connections=[];}
 start(t=0){this.startAt=t;this.started=true;}
 stop(t=0){this.stopAt=t;}
}
class Audio extends Target {
 static contexts=[];
 constructor(){super();this.state='suspended';this.currentTime=0;this.sampleRate=48000;this.nodes=[];this.destination={};Audio.contexts.push(this);}
 createGain(){return new Node(this);}
 createOscillator(){return new Node(this);}
 createBufferSource(){return new Node(this);}
 createBiquadFilter(){return new Node(this);}
 createDelay(){return new Node(this);}
 createBuffer(ch,n,sr){return {sampleRate:sr,getChannelData:()=>new Float32Array(n)};}
 resume(){this.state='running';this.dispatch('statechange');return Promise.resolve();}
 suspend(){this.state='suspended';this.dispatch('statechange');return Promise.resolve();}
 close(){this.state='closed';return Promise.resolve();}
}
const canvas=new Target(),button=new Target(),doc=new Target();
const gradient={addColorStop(){}};
const ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:t=>({width:String(t).length*8})},{get:(x,k)=>k in x?x[k]:(()=>{}),set:(x,k,v)=>(x[k]=v,true)});
canvas.getContext=()=>ctx;
doc.getElementById=id=>id==='c'?canvas:button;doc.hidden=false;doc.referrer='';
const saved={};const win=new Target();
Object.assign(win,{AudioContext:Audio,innerWidth:390,innerHeight:844,navigator:{},location:{pathname:'/forge_end_bird.html'},performance:{now:()=>2000},localStorage:{getItem:k=>saved[k]??null,setItem:(k,v)=>saved[k]=v},setTimeout:()=>0,requestAnimationFrame:()=>0,console,document:doc,createEndBirdAudio:undefined,globalThis:win,Math:Object.create(Math)});
win.window=win;const c=vm.createContext(win);
vm.runInContext(fs.readFileSync(path.join(repo,'assets/endbird-audio.js'),'utf8'),c);
const html=fs.readFileSync(path.join(repo,'forge_end_bird.html'),'utf8');
const main=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes("const canvas = document.getElementById('c')"));
vm.runInContext(main,c);
const run=s=>vm.runInContext(s,c);
const checks=[];const ok=(name,fn)=>{fn();checks.push(name);};
ok('page and game-loop sounds do not create audio without a gesture',()=>{run('sfx.click(); sfx.eat(); audioTick(); loop(16)');assert.equal(Audio.contexts.length,0);});
ok('synthetic events do not unlock audio',()=>{win.dispatch('keydown',{key:'Enter',code:'Enter',isTrusted:false});assert.equal(Audio.contexts.length,0);});
ok('trusted gesture builds one context and resumes it',()=>{win.dispatch('pointerdown',{isTrusted:true});assert.equal(Audio.contexts.length,1);assert.equal(Audio.contexts[0].state,'running');});
ok('canvas cue routing follows actual gameplay state',()=>{run("state=STATE.UPGRADE; sfx.hit(); initGame(0); audioTick(); combo=1; sfx.eat(); invincibleTimer=0; sfx.hit(); invincibleTimer=1.5; player.hp=1; sfx.hit(); sfx.grow();");const k=run('audioEngine.stats().kinds');for(const name of ['deny','eat','bonk','hurt','grow'])assert.equal(k[name],1,name);});
ok('pickup rate cap merges rapid eats while keeping combo rewards',()=>{run('combo=5; sfx.eat(); combo=10; sfx.eat();');const s=run('audioEngine.stats()');assert.equal(s.kinds.eat,1);assert.ok(s.dropped.eat>=2);assert.ok(s.kinds.sting>=2);});
ok('future unlock scheduling retains active voices for cancellation',()=>{run('sfx.unlock(); sfx.tierUp(); audioTick();');const a=Audio.contexts[0],active=a.nodes.filter(n=>n.started&&n.stopAt>a.currentTime&&n.startAt<=a.currentTime+.005);assert.ok(active.length>0);button.dispatch('click',{isTrusted:true});assert.equal(run('save.muted'),true);assert.equal(JSON.parse(saved.endbird_save).muted,true);assert.equal(button.attributes['aria-pressed'],'true');for(const n of active)assert.ok(n.stopAt<=a.currentTime,`old source still scheduled through ${n.stopAt}`);});
ok('muted game cues and gestures cannot leak audio',()=>{const before=run('audioEngine.stats().started');run('sfx.eat(); sfx.explode(); audioTick()');win.dispatch('pointerdown',{isTrusted:true});assert.equal(run('audioEngine.stats().started'),before);assert.equal(run('audioEngine.master.gain.value'),0);});
ok('one native button tap restores audio without starting a game',()=>{run('state=STATE.TITLE');button.dispatch('click',{isTrusted:true});assert.equal(run('save.muted'),false);assert.equal(run('state'),0);assert.equal(run('touch.active'),false);assert.equal(button.attributes['aria-label'],'Mute sound');});
ok('M toggles once and ignores repeat',()=>{win.dispatch('keydown',{key:'m',code:'KeyM',isTrusted:true,repeat:false});assert.equal(run('save.muted'),true);win.dispatch('keydown',{key:'m',code:'KeyM',isTrusted:true,repeat:true});assert.equal(run('save.muted'),true);win.dispatch('keydown',{key:'m',code:'KeyM',isTrusted:true,repeat:false});assert.equal(run('save.muted'),false);});
ok('BOOM tap executes its existing ability without a ReferenceError',()=>{run('initGame(0);explodeReady=true;');canvas.dispatch('click',{clientX:330,clientY:764,isTrusted:true});assert.equal(run('explodeReady'),false);assert.equal(run('explodeCooldown'),8);assert.ok(run('audioEngine.stats().kinds.explode')>=1);});
ok('hidden page cancels audio, then interruption resumes on another gesture',()=>{doc.hidden=true;doc.dispatch('visibilitychange');assert.equal(Audio.contexts[0].state,'suspended');assert.equal(run('audioEngine.master.gain.value'),0);doc.hidden=false;doc.dispatch('visibilitychange');assert.equal(Audio.contexts[0].state,'running');Audio.contexts[0].state='interrupted';Audio.contexts[0].dispatch('statechange');win.dispatch('touchend',{isTrusted:true});assert.equal(Audio.contexts[0].state,'running');});
ok('all ten ambience tiers and game-over cues build valid local audio graphs',()=>{for(let tier=0;tier<10;tier++){run(`currentTier=${tier};audioEngine.setAmbience(${tier},'play',audioNow());audioEngine.tick(audioNow()+1);`);}run('endRun(false);audioTick();');assert.equal(run('audioEngine.ambInfo()'),null);assert.equal(run('audioEngine.stats().kinds.death'),1);run('audioEngine.clear(audioCtx.currentTime);initGame(9);endRun(true);audioTick();');assert.equal(run('audioEngine.stats().kinds.victory'),1);});
ok('clear stops and disconnects scheduled ambience pings',()=>{
 const a=Audio.contexts[0];a.currentTime=1;run('audioEngine.clear(audioCtx.currentTime);audioEngine.setAmbience(0,"play",audioNow());');
 const oldRandom=win.Math.random;win.Math.random=()=>0.5;
 try {run('audioEngine.tick(1.5)');} finally {win.Math.random=oldRandom;}
 const pings=a.nodes.filter(n=>n.started&&n.startAt>1.5&&n.stopAt>1.5);
 assert.ok(pings.length>0,'the regression must queue a future ping');
 a.currentTime=1.5;run('audioEngine.clear(audioCtx.currentTime)');
 for(const n of pings){assert.ok(n.stopAt<=1.5);assert.equal(n.connections.length,0);assert.equal(typeof n.onended,'function');n.onended();}
});
ok('clear also cancels outgoing ambience during a tier crossfade',()=>{
 const a=Audio.contexts[0];a.currentTime=2;run('audioEngine.setAmbience(0,"play",audioNow())');
 const oldBed=a.nodes.filter(n=>n.started&&n.startAt>=2&&n.stopAt===undefined);
 assert.ok(oldBed.length>0);run('audioEngine.setAmbience(1,"play",2.5)');
 assert.ok(oldBed.some(n=>n.stopAt>2.6),'the regression must leave a fading old bed');
 a.currentTime=2.6;run('audioEngine.clear(audioCtx.currentTime)');
 for(const n of oldBed){assert.ok(n.stopAt<=2.6);assert.equal(n.connections.length,0);}
});
ok('starting a new run cancels previous death and pending reward cues',()=>{
 const a=Audio.contexts[0];a.currentTime=3;run('initGame(0);combo=1;sfx.eat();sfx.unlock();endRun(false);audioTick()');
 const oldCues=a.nodes.filter(n=>n.started&&n.stopAt>3.01&&n.startAt>=3.01);
 assert.ok(oldCues.some(n=>n.startAt>4.1),'the regression must schedule a held reward');
 a.currentTime=4.1;run('initGame(0);audioTick()');
 for(const n of oldCues){assert.ok(n.stopAt<=4.1);assert.equal(n.connections.length,0);}
 assert.equal(run('state'),1);assert.equal(run('audioEngine.ambInfo().tier'),0);
});
console.log(JSON.stringify({passed:checks.length,checks,note:'VM integration with validated Web Audio calls; no browser playback or physical phone audio claim.'},null,2));
