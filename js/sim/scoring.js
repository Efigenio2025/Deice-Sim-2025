// public/js/sim/scoring.js
const NATO = {A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',
  J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',
  T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu',
  '0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine'};

export const norm = s => String(s||'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const tokenize = s => norm(s).split(' ').filter(Boolean);

export function wordScore(expected, said){
  const e=new Set(tokenize(expected)), s=new Set(tokenize(said));
  if(!e.size) return 0;
  let hit=0; e.forEach(w=>{ if(s.has(w)) hit++; });
  return Math.round((hit/e.size)*100);
}

export function diffWords(exp, heard){
  const E=tokenize(exp), H=tokenize(heard);
  const setE=new Set(E), setH=new Set(H);
  const expToks=E.map(w=>({w, cls:setH.has(w)?'ok':'miss'}));
  const extraToks=H.filter(w=>!setE.has(w)).map(w=>({w, cls:'extra'}));
  return { expToks, extraToks, expCount: E.length, hitCount: E.filter(w=>setH.has(w)).length };
}

export function toNatoTail(tail){
  return tail.toUpperCase().split('').map(ch => NATO[ch] || ch).join(' ');
}

export function prepareExpectedForScenario(scn){
  (scn.steps||[]).forEach(st=>{
    const base = String(st.text || st.phraseId || '');
    st._displayLine = base;
    st._expectedForGrade = (st.role === 'Iceman')
      ? base.replace(/\bN[0-9A-Z]{3,}\b/gi, m => toNatoTail(m))
      : base;
  });
}