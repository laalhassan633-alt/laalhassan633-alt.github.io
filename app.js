/* ULTRON PWA client — talks to live n8n endpoints */
const BASE = 'https://alirff.app.n8n.cloud';
const $ = id => document.getElementById(id);
const log = $('log'), status_ = $('status'), orb = $('orb'), micBtn = $('micBtn');
const inEl = $('in'), sendBtn = $('send'), persona = $('persona');
const keyOverlay = $('keyOverlay'), apiKeyEl = $('apiKey'), keyGo = $('keyGo');

let apiKey = localStorage.getItem('ultron_api_key') || '';
if (apiKey) keyOverlay.classList.add('hidden');

let audioCtx = null;
function unlockAudio(){
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
    // play a silent blip to fully unlock audio on mobile
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    g.gain.value=0; o.connect(g); g.connect(audioCtx.destination); o.start(0); o.stop(0.01);
  }catch(e){}
}
keyGo.onclick = () => {
  const k = apiKeyEl.value.trim();
  if (!k) return;
  unlockAudio();
  apiKey = k; localStorage.setItem('ultron_api_key', k);
  keyOverlay.classList.add('hidden');
  say('ai', 'Connected to ULTRON. Say something.', 'ULTRON');
  setStatus('IDLE');
};
document.body.addEventListener('touchend', unlockAudio, {once:false});
document.body.addEventListener('click', unlockAudio, {once:false});

function setStatus(t){ status_.textContent = t; }
function say(who, text, tag){
  const d = document.createElement('div');
  d.className = 'msg ' + (who==='me' ? 'me' : 'ai');
  if (tag) { const s=document.createElement('small'); s.textContent=tag; d.appendChild(s); }
  d.appendChild(document.createTextNode(text));
  log.appendChild(d); log.scrollTop = log.scrollHeight;
}
function playAudio(b64, mime){
  if(!b64) return;
  try{
    unlockAudio();
    setStatus('SPEAKING');
    const a = new Audio('data:'+(mime||'audio/mpeg')+';base64,'+b64);
    a.onended = ()=> setStatus('IDLE');
    a.onerror = ()=> setStatus('IDLE');
    const p = a.play();
    if (p && p.catch) p.catch(()=>{ setStatus('TAP TO HEAR'); });
  }catch(e){ setStatus('IDLE'); }
}

async function askText(text){
  if(!text.trim()) return;
  say('me', text); inEl.value='';
  setStatus('THINKING'); orb.classList.add('listening');
  const p = persona.value;
  try{
    let r;
    if (p === 'NOVA') {
      r = await fetch(BASE+'/webhook/nova-emotion', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ session_id:'pwa', message:text }) });
      const j = await r.json();
      say('ai', j.response || j.error || '...', 'NOVA');
      if (j.audio_base64) playAudio(j.audio_base64, j.audio_mime);
    } else {
      r = await fetch(BASE+'/webhook/ultron-core', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ source:'mobile', api_key:apiKey, user_text:text }) });
      const j = await r.json();
      say('ai', j.response || j.error || '...', 'ULTRON');
      if (j.audio_base64) playAudio(j.audio_base64, j.audio_mime);
    }
    setStatus('IDLE');
  }catch(e){ say('ai','Connection error. Check your internet.','SYSTEM'); setStatus('ERROR'); }
  orb.classList.remove('listening');
}

sendBtn.onclick = ()=> askText(inEl.value);
inEl.addEventListener('keydown', e=>{ if(e.key==='Enter') askText(inEl.value); });

// --- Voice input via MediaRecorder -> /webhook/ultron-voice ---
let rec, chunks=[];
micBtn.onclick = async ()=>{
  if (rec && rec.state==='recording'){ rec.stop(); return; }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    chunks=[]; rec = new MediaRecorder(stream);
    rec.ondataavailable = e=> chunks.push(e.data);
    rec.onstop = async ()=>{
      stream.getTracks().forEach(t=>t.stop());
      micBtn.classList.remove('rec'); orb.classList.remove('listening');
      setStatus('THINKING');
      const blob = new Blob(chunks,{type:'audio/webm'});
      const fd = new FormData();
      fd.append('audio', blob, 'voice.webm');
      fd.append('api_key', apiKey);
      fd.append('personality', persona.value);
      try{
        const r = await fetch(BASE+'/webhook/ultron-voice', { method:'POST', body:fd });
        const ct = r.headers.get('content-type')||'';
        if (ct.includes('audio')) { const b = await r.blob(); playAudio(await blobToB64(b), b.type||'audio/mpeg'); setStatus('IDLE'); }
        else { const j = await r.json().catch(()=>({})); say('ai', j.response||j.error||'(no reply)','ULTRON'); setStatus('IDLE'); }
      }catch(e){ say('ai','Voice send failed.','SYSTEM'); setStatus('ERROR'); }
    };
    rec.start(); micBtn.classList.add('rec'); orb.classList.add('listening'); setStatus('LISTENING… tap to stop');
  }catch(e){
    say('ai','Microphone blocked. Allow mic for this site in browser settings.','SYSTEM'); setStatus('MIC BLOCKED');
  }
};
function blobToB64(b){ return new Promise(res=>{ const r=new FileReader(); r.onloadend=()=>res(r.result.split(',')[1]); r.readAsDataURL(b); }); }
