import {CONFIG} from './config.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const D={CYB:'CYBERSECURITY',IT:'INFORMATION TECHNOLOGY'};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,10);
const S={students:[],sessions:[],dept:'CYB',date:today(),marks:{},dirty:false,view:'dashboard',hs:null};
const cloud=!!(CONFIG.SUPABASE_URL&&CONFIG.SUPABASE_ANON_KEY);let sb,db;
const studs=d=>S.students.filter(s=>s.dept===d);
const sess=(d,dt)=>S.sessions.find(x=>x.dept===d&&x.date===dt);
const pct=(a,b)=>b?Math.round(a*1000/b)/10:0;
const msg=t=>{$('#msg').textContent=t;setTimeout(()=>$('#msg').textContent='',4000)};
const key=s=>s.dept+'|'+(s.sid?s.sid.toLowerCase():s.name.toLowerCase().replace(/\s+/g,' '));

/* ---------- storage adapters ---------- */
function localDB(){
 const open=()=>new Promise((res,rej)=>{const r=indexedDB.open('attendance',1);r.onupgradeneeded=()=>{r.result.createObjectStore('students',{keyPath:'id'});r.result.createObjectStore('sessions',{keyPath:'key'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
 const run=async(st,mode,f)=>{const d=await open();return new Promise((res,rej)=>{const t=d.transaction(st,mode);let out;t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);out=f(t)})};
 const all=st=>new Promise(async(res,rej)=>{const d=await open();const q=d.transaction(st).objectStore(st).getAll();q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
 return{
  async load(){return{students:await all('students'),sessions:(await all('sessions')).map(({key,...r})=>r)}},
  addStudents:l=>run('students','readwrite',t=>l.forEach(s=>t.objectStore('students').put(s))),
  updStudent:s=>run('students','readwrite',t=>t.objectStore('students').put(s)),
  delStudent:id=>run('students','readwrite',t=>t.objectStore('students').delete(id)),
  saveSession:(dept,date,marks)=>run('sessions','readwrite',t=>t.objectStore('sessions').put({key:dept+'|'+date,dept,date,marks})),
  async restore(j){await run('students','readwrite',t=>{t.objectStore('students').clear();j.students.forEach(s=>t.objectStore('students').put(s))});await run('sessions','readwrite',t=>{t.objectStore('sessions').clear();j.sessions.forEach(s=>t.objectStore('sessions').put({...s,key:s.dept+'|'+s.date}))})}};
}
function cloudDB(){const chk=r=>{if(r.error)throw r.error;return r.data};return{
 async load(){const[a,b]=await Promise.all([sb.from('students').select('*').order('name'),sb.from('sessions').select('dept,date,attendance(student_id,present)')]);
  return{students:chk(a).map(s=>({id:s.id,dept:s.dept,sid:s.student_no||'',name:s.name})),sessions:chk(b).map(s=>({dept:s.dept,date:s.date,marks:Object.fromEntries(s.attendance.map(r=>[r.student_id,r.present]))}))}},
 async addStudents(l){chk(await sb.from('students').insert(l.map(s=>({id:s.id,dept:s.dept,student_no:s.sid||null,name:s.name}))))},
 async updStudent(s){chk(await sb.from('students').update({student_no:s.sid||null,name:s.name}).eq('id',s.id))},
 async delStudent(id){chk(await sb.from('students').delete().eq('id',id))},
 async saveSession(dept,date,marks){const r=chk(await sb.from('sessions').upsert({dept,date,saved_at:new Date().toISOString()},{onConflict:'dept,date'}).select('id').single());
  chk(await sb.from('attendance').delete().eq('session_id',r.id));
  chk(await sb.from('attendance').insert(Object.entries(marks).map(([student_id,present])=>({session_id:r.id,student_id,present}))))}}}

/* ---------- boot ---------- */
async function boot(){
 if(cloud){sb=supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);db=cloudDB();
  const{data}=await sb.auth.getSession();if(!data.session){$('#login').hidden=false;return}}
 else db=localDB();
 $('#login').hidden=true;$('#app').hidden=false;
 $('#mode').textContent=cloud?'Cloud mode (Supabase)':'Local demo mode';
 if(!cloud)$('#banner').textContent='Local demonstration mode: records are stored only in this browser (IndexedDB), are not shared across devices, and can be lost if browser data is cleared. Export a backup in Settings. This is not secure centralized university storage.';
 try{Object.assign(S,await db.load())}catch(e){msg('Load failed: '+(e.message||e))}
 $('#dt').value=S.date;go('dashboard');
}
$('#lf').onsubmit=async e=>{e.preventDefault();sb=supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
 const{error}=await sb.auth.signInWithPassword({email:$('#em').value,password:$('#pw').value});if(error)$('#lerr').textContent=error.message;else boot()};

/* ---------- navigation ---------- */
const titles={dashboard:'Dashboard',students:'Students',attendance:'Take attendance',history:'Student history',reports:'Reports',settings:'Settings'};
function go(v){if(S.dirty&&S.view==='attendance'&&v!=='attendance'&&!confirm('Discard unsaved attendance changes?'))return;if(v!=='attendance')S.dirty=false;
 S.view=v;$$('section').forEach(s=>s.classList.toggle('on',s.id==='v-'+v));$$('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
 $('#title').textContent=titles[v];$('#side').classList.remove('open');R[v]()}
$$('nav button').forEach(b=>b.onclick=()=>go(b.dataset.v));$('#menu').onclick=()=>$('#side').classList.toggle('open');
$('#dept').onchange=e=>{if(S.dirty&&!confirm('Discard unsaved changes?')){e.target.value=S.dept;return}S.dirty=false;S.dept=e.target.value;R[S.view]()};
$('#theme').onclick=()=>{const h=document.documentElement;h.dataset.theme=h.dataset.theme==='dark'?'light':'dark';R[S.view]()};

/* ---------- dashboard ---------- */
const charts={};const ch=(id,cfg)=>{charts[id]?.destroy();charts[id]=new Chart($('#'+id),cfg)};
function stats(d){const st=studs(d),ss=S.sessions.filter(x=>x.dept===d);let p=0,t=0;const per={};
 st.forEach(s=>per[s.id]={s,p:0,a:0});ss.forEach(x=>Object.entries(x.marks).forEach(([id,v])=>{if(!per[id])return;t++;if(v){p++;per[id].p++}else per[id].a++}));return{p,t,per,ss}}
const R={};
R.dashboard=()=>{const on=S.sessions.filter(x=>x.date===S.date);let p=0,a=0;on.forEach(x=>Object.values(x.marks).forEach(v=>v?p++:a++));
 const dates=new Set(S.sessions.map(x=>x.date));
 const k=[['Registered students',S.students.length],['CYBERSECURITY',studs('CYB').length],['INFORMATION TECHNOLOGY',studs('IT').length],['Present ('+S.date+')',on.length?p:'—'],['Absent',on.length?a:'—'],['Attendance %',on.length?pct(p,p+a)+'%':'—'],['Dates recorded',dates.size]];
 $('#cards').innerHTML=k.map(([l,v])=>`<div class="k"><b>${v}</b><span>${l}</span></div>`).join('');
 const dk=S.view&&document.documentElement.dataset.theme==='dark';Chart.defaults.color=dk?'#cbd5e1':'#334155';
 ch('c1',{type:'doughnut',data:{labels:['Present','Absent'],datasets:[{data:[p,a],backgroundColor:['#13a89e','#c0392b']}]}});
 const sc=Object.keys(D).map(d=>stats(d));
 ch('c2',{type:'bar',data:{labels:Object.values(D),datasets:[{label:'%',data:sc.map(x=>pct(x.p,x.t)),backgroundColor:['#0b2545','#22c3e6']}]},options:{scales:{y:{min:0,max:100}},plugins:{legend:{display:false}}}});
 const dl=[...dates].sort();
 ch('c3',{type:'line',data:{labels:dl,datasets:Object.keys(D).map((d,i)=>({label:D[d],borderColor:['#0b2545','#22c3e6'][i],spanGaps:true,data:dl.map(t=>{const x=sess(d,t);if(!x)return null;const v=Object.values(x.marks);return pct(v.filter(Boolean).length,v.length)})}))},options:{scales:{y:{min:0,max:100}}}});
 const top=sc.flatMap(x=>Object.values(x.per)).sort((a,b)=>b.a-a.a).slice(0,8);
 ch('c4',{type:'bar',data:{labels:top.map(x=>x.s.name),datasets:[{label:'Absences',data:top.map(x=>x.a),backgroundColor:'#13a89e'}]},options:{indexAxis:'y'}})};

/* ---------- students ---------- */
R.students=()=>{const q=$('#sq').value.trim().toLowerCase(),st=studs(S.dept).filter(s=>!q||(s.name+s.sid).toLowerCase().includes(q));
 $('#stb').innerHTML=st.length?st.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.sid)}</td><td class="n">${esc(s.name)}</td><td><button class="btn alt" data-e="${s.id}">Edit</button> <button class="btn del" data-d="${s.id}">Remove</button></td></tr>`).join(''):'<tr><td colspan=4>No students yet. Import an Excel file or add one manually.</td></tr>'};
$('#sq').oninput=R.students;
$('#stb').onclick=async e=>{const id=e.target.dataset.e||e.target.dataset.d;if(!id)return;const s=S.students.find(x=>x.id===id);
 try{if(e.target.dataset.d){if(!confirm(`Remove ${s.name}? Their saved attendance records will also be deleted.`))return;await db.delStudent(id);S.students=S.students.filter(x=>x.id!==id);S.sessions.forEach(x=>delete x.marks[id])}
 else{const name=prompt('Name',s.name);if(!name)return;const sid=prompt('Student ID (optional)',s.sid)||'';Object.assign(s,{name:name.trim(),sid:sid.trim()});await db.updStudent(s)}
 R.students()}catch(err){msg('Error: '+(err.message||err))}};
$('#addS').onclick=async()=>{const name=prompt('Student full name');if(!name?.trim())return;const sid=(prompt('Student ID (optional)')||'').trim();
 const s={id:crypto.randomUUID(),dept:S.dept,sid,name:name.trim().replace(/\s+/g,' ')};if(S.students.some(x=>key(x)===key(s)))return msg('Duplicate: this student already exists in '+D[S.dept]);
 try{await db.addStudents([s]);S.students.push(s);R.students();msg('Student added')}catch(err){msg('Error: '+(err.message||err))}};
$('#tpl').onclick=()=>{const wb=XLSX.utils.book_new();['CYBERSECURITY','INFORMATION TECHNOLOGY'].forEach(n=>XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Student ID','Name'],['',''],]),n));XLSX.writeFile(wb,'students_template.xlsx')};
const toDept=(v,def)=>/CYBER|سيبر|امن|أمن/i.test(v)?'CYB':/INFORMATION|^IT$|معلومات/i.test(v)?'IT':def;
$('#xf').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
 if(!/\.xlsx?$/i.test(f.name)||f.size>5e6)return msg('Choose an .xlsx or .xls file under 5 MB.');
 try{const wb=XLSX.read(await f.arrayBuffer(),{type:'array'}),seen=new Set(S.students.map(key)),rows=[];
  wb.SheetNames.forEach(n=>{const r=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:''});if(!r.length)return;
   const h=r[0].map(String);let ni=h.findIndex(x=>/name|الاسم|اسم/i.test(x)),ii=h.findIndex(x=>/\bid\b|رقم|no\.?$/i.test(x)),di=h.findIndex(x=>/dept|department|القسم/i.test(x));
   let body=r.slice(1);if(ni<0){ni=r[0].findIndex(x=>x!==''&&isNaN(x));if(ni<0)return;body=r;ii=-1}
   const sheetDept=toDept(n,S.dept);
   body.forEach(x=>{const name=String(x[ni]||'').trim().replace(/\s+/g,' ');if(!name)return;const s={id:crypto.randomUUID(),name,sid:ii>=0?String(x[ii]||'').trim():'',dept:di>=0?toDept(String(x[di]),sheetDept):sheetDept};
    s.dup=seen.has(key(s));seen.add(key(s));rows.push(s)})});
  if(!rows.length)return msg('No student names found. Use a column titled "Name" or "الاسم".');
  const fresh=rows.filter(s=>!s.dup);$('#dlg').innerHTML=`<h3>Import preview</h3><p>${fresh.length} new, ${rows.length-fresh.length} duplicates skipped. Sheets named like a department are assigned automatically; other sheets use <b>${D[S.dept]}</b>.</p><div style="max-height:260px;overflow:auto"><table>${rows.slice(0,100).map(s=>`<tr><td>${esc(s.sid)}</td><td class="n">${esc(s.name)}</td><td>${s.dept}</td><td>${s.dup?'duplicate':'new'}</td></tr>`).join('')}</table></div><div class="bar" style="margin-top:12px"><button class="btn" id="ok">Import ${fresh.length}</button><button class="btn alt" id="no">Cancel</button></div>`;
  $('#dlg').showModal();$('#no').onclick=()=>$('#dlg').close();
  $('#ok').onclick=async()=>{try{await db.addStudents(fresh.map(({dup,...s})=>s));S.students.push(...fresh.map(({dup,...s})=>s));$('#dlg').close();R.students();msg(`Imported ${fresh.length} students successfully.`)}catch(err){msg('Import failed: '+(err.message||err))}}
 }catch(err){msg('Could not read file: '+(err.message||err))}};

/* ---------- attendance ---------- */
const curMarks=()=>S.dirty?S.marks:(sess(S.dept,S.date)?.marks||{});
R.attendance=()=>{const rec=sess(S.dept,S.date),m=curMarks(),q=$('#aq').value.trim().toLowerCase(),all=studs(S.dept),st=all.filter(s=>!q||(s.name+s.sid).toLowerCase().includes(q));
 $('#atb').innerHTML=st.length?st.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.sid)}</td><td class="n">${esc(s.name)}</td><td><input type="checkbox" data-id="${s.id}" aria-label="Present: ${esc(s.name)}" ${m[s.id]?'checked':''}></td></tr>`).join(''):'<tr><td colspan=4>No students in this department.</td></tr>';
 const p=all.filter(s=>m[s.id]).length,known=rec||S.dirty;
 $('#astats').innerHTML=[['Enrolled',all.length],['Present',p],['Absent',known?all.length-p:'—']].map(([l,v])=>`<div class="k"><b>${v}</b><span>${l}</span></div>`).join('');
 const el=$('#st');el.className='pill '+(S.dirty?'dirty':rec?'saved':'');el.textContent=S.dirty?'Unsaved changes':rec?'Saved':'Not recorded';
 $('#rdates').innerHTML=S.sessions.filter(x=>x.dept===S.dept).map(x=>x.date).sort().map(d=>`<button data-d="${d}">${d}</button>`).join('')||'No dates recorded yet.'};
const setM=f=>{S.marks={...curMarks()};studs(S.dept).forEach(s=>S.marks[s.id]=f(s));S.dirty=true;R.attendance()};
$('#atb').onchange=e=>{const id=e.target.dataset.id;if(!id)return;S.marks={...curMarks(),[id]:e.target.checked};S.dirty=true;R.attendance()};
$('#allP').onclick=()=>setM(()=>true);$('#allA').onclick=()=>setM(()=>false);
$('#rst').onclick=()=>{S.dirty=false;R.attendance()};$('#aq').oninput=R.attendance;
const pick=d=>{if(S.dirty&&!confirm('Discard unsaved changes?')){$('#dt').value=S.date;return}S.dirty=false;S.date=d;$('#dt').value=d;R.attendance()};
$('#dt').onchange=e=>e.target.value&&pick(e.target.value);$('#rdates').onclick=e=>e.target.dataset.d&&pick(e.target.dataset.d);
$('#save').onclick=async()=>{const st=studs(S.dept);if(!st.length)return msg('Add students first.');const rec=sess(S.dept,S.date);
 if(rec&&!confirm(`Attendance for ${D[S.dept]} on ${S.date} is already saved. Replace it?`))return;
 const m=curMarks(),marks=Object.fromEntries(st.map(s=>[s.id,!!m[s.id]]));
 try{await db.saveSession(S.dept,S.date,marks);if(rec)rec.marks=marks;else S.sessions.push({dept:S.dept,date:S.date,marks});S.dirty=false;R.attendance();msg('Attendance saved.')}catch(err){msg('Save failed: '+(err.message||err))}};

/* ---------- history ---------- */
R.history=()=>{const st=studs(S.dept);$('#hs').innerHTML=st.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
 if(!$('#hm').value)$('#hm').value=S.date.slice(0,7);if(S.hs&&st.some(s=>s.id===S.hs))$('#hs').value=S.hs;
 const s=st.find(x=>x.id===$('#hs').value);S.hs=s?.id;
 if(!s){$('#hinfo').innerHTML='<div class="k"><span>No students in this department.</span></div>';$('#cal').innerHTML='';return}
 const rec=S.sessions.filter(x=>x.dept===s.dept&&s.id in x.marks).sort((a,b)=>a.date<b.date?-1:1),P=rec.filter(x=>x.marks[s.id]);
 $('#hinfo').innerHTML=[['Student',esc(s.name)],['ID',esc(s.sid)||'—'],['Sessions',rec.length],['Attended',P.length],['Absent',rec.length-P.length],['Attendance %',pct(P.length,rec.length)+'%']].map(([l,v])=>`<div class="k"><b style="font-size:16px">${v}</b><span>${l}</span></div>`).join('');
 const[y,m]=$('#hm').value.split('-').map(Number),n=new Date(y,m,0).getDate(),f=new Date(y,m-1,1).getDay();
 $('#cal').innerHTML='SMTWTFS'.split('').map(d=>`<div>${d}</div>`).join('')+'<span></span>'.repeat(f)+Array.from({length:n},(_,i)=>{const d=`${y}-${String(m).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`,x=rec.find(r=>r.date===d);return`<div class="${x?(x.marks[s.id]?'P':'A'):''}" title="${x?(x.marks[s.id]?'Present':'Absent'):'Not recorded'}">${i+1}</div>`}).join('')};
$('#hs').onchange=e=>{S.hs=e.target.value;R.history()};$('#hm').onchange=R.history;

/* ---------- reports ---------- */
let rep=null;
function build(){const ds=$('#rd').value==='ALL'?Object.keys(D):[$('#rd').value],f=$('#rf').value||'0000',t=$('#rt').value||'9999';
 const rows=[],dates=[...new Set(S.sessions.filter(x=>ds.includes(x.dept)&&x.date>=f&&x.date<=t).map(x=>x.date))].sort();
 const head=['#','ID','Name','Department',...dates,'Present','Absent','%'];let n=0;
 ds.forEach(d=>studs(d).forEach(s=>{let p=0,a=0;const c=dates.map(dt=>{const x=sess(d,dt);if(!x||!(s.id in x.marks))return'-';return x.marks[s.id]?(p++,'P'):(a++,'A')});rows.push([++n,s.sid,s.name,D[d],...c,p,a,pct(p,p+a)])}));
 return{head,rows,title:`Attendance report - ${$('#rd').value==='ALL'?'All departments':D[ds[0]]} (${$('#rf').value||'start'} to ${$('#rt').value||'latest'})`}}
$('#rg').onclick=()=>{rep=build();$('#rout').innerHTML=rep.rows.length&&rep.head.length>7?`<h3>${esc(rep.title)}</h3><table><thead><tr>${rep.head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rep.rows.map(r=>`<tr>${r.map((c,i)=>`<td${i==2?' class="n"':''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table><p>P = present, A = absent, - = not recorded.</p>`:'No saved attendance in this range.'};
const sheet=()=>{if(!rep)$('#rg').click();return rep&&XLSX.utils.aoa_to_sheet([[rep.title],[],rep.head,...rep.rows])};
$('#rx').onclick=()=>{const s=sheet();if(!s)return;const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,s,'Attendance');XLSX.writeFile(wb,'attendance_report.xlsx')};
$('#rc').onclick=()=>{const s=sheet();if(!s)return;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+XLSX.utils.sheet_to_csv(s)],{type:'text/csv;charset=utf-8'}));a.download='attendance_report.csv';a.click()};
$('#rp').onclick=()=>{$('#rg').click();print()};

/* ---------- settings ---------- */
R.settings=()=>{$('#setdata').innerHTML=cloud?'<h3>Account</h3><button class="btn alt" id="lo">Sign out</button>':'<h3>Local backup</h3><p>Data lives only in this browser. Back up regularly.</p><button class="btn" id="bk">Export backup</button> <label class="btn alt">Restore backup<input id="rs" type="file" accept=".json" hidden></label>';
 if(cloud)$('#lo').onclick=async()=>{await sb.auth.signOut();location.reload()};
 else{$('#bk').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({students:S.students,sessions:S.sessions})],{type:'application/json'}));a.download='attendance_backup.json';a.click()};
  $('#rs').onchange=async e=>{if(!e.target.files[0]||!confirm('Restoring replaces all current local data. Continue?'))return;try{const j=JSON.parse(await e.target.files[0].text());if(!Array.isArray(j.students)||!Array.isArray(j.sessions))throw Error('Invalid backup file');await db.restore(j);Object.assign(S,j);msg('Backup restored.')}catch(err){msg('Restore failed: '+err.message)}}}};
boot();
