// public/js/sim/gate.js
const EMP_ID_KEY = 'trainer.employeeId';
const $ = id => document.getElementById(id);
const setText = (el,t)=>{ if(el) el.textContent=t; };

function getEmployeeId(){ return localStorage.getItem(EMP_ID_KEY)||''; }
function setEmployeeId(id){ localStorage.setItem(EMP_ID_KEY,id); }
function openEmp(){ $('empIdModal')?.classList.remove('hidden'); }
function closeEmp(){ $('empIdModal')?.classList.add('hidden'); }

export function ensureEmpGate(){
  const have = getEmployeeId();
  const badge = $('empIdBadge');
  if (!have) openEmp(); else { closeEmp(); setText(badge, 'ID: '+have); }

  $('empIdSave').onclick = () => {
    const v = ($('empIdInput').value || '').trim();
    if (v.length < 3) { setText($('empIdMsg'),'Enter valid ID'); return; }
    setEmployeeId(v); setText(badge,'ID: '+v); setText($('empIdMsg'),''); closeEmp();
  };
  $('empIdCancel').onclick = () => setText($('empIdMsg'), 'Employee ID is required.');
  $('changeIdBtn').onclick = openEmp;
}