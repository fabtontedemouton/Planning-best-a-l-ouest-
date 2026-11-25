
const C = window.FAB_CONFIG;
let db, me, members=[], availability=[], jobs=[], participants=[], dayNotes=[], weekOffset=0, rangeDays=45, selectedDay=null, channel=null;

const $ = id => document.getElementById(id);
const dateISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const monday = d => { d=new Date(d); d.setDate(d.getDate()-(d.getDay()+6)%7); return d; };
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(t) {
  $('toast').textContent=t;
  $('toast').style.display='block';
  setTimeout(()=>$('toast').style.display='none',2600);
}

function showPanel(id) {
  ['availability','job','requests','team','daynotePanel'].forEach(x=>$(x).hidden=x!==id);
  const home=!id;
  document.querySelector('.action-section').hidden=!home;
  document.querySelector('.upcoming').hidden=!home;
}

function memberName(id) {
  return members.find(m=>m.user_id===id)?.display_name||'Tondeur';
}

function dayStatus(uid,day) {
  const mine=availability.find(a=>a.user_id===uid&&a.day===day);
  const busy=participants.some(p=>p.user_id===uid&&p.status==='accepted'&&jobs.some(j=>j.id===p.job_id&&j.day===day&&j.status!=='cancelled'));
  if(busy)return 'busy';
  return mine?.status||'unknown';
}

async function init() {
  if(!C||C.SUPABASE_URL.includes('VOTRE-')) {
    $('msg').textContent='Configure Supabase dans config.js avant la mise en service.';
    return;
  }

  db=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{
    auth:{persistSession:true,autoRefreshToken:true}
  });

  const {data:{session},error}=await db.auth.getSession();
  if(error) {
    $('msg').textContent='Erreur de connexion : '+error.message;
    return;
  }

  if(session) {
    const {data:profile,error:profileError}=await db
      .from('team_members').select('display_name')
      .eq('user_id',session.user.id).maybeSingle();
    if(profileError) {
      $('msg').textContent='Impossible de vérifier ton profil : '+profileError.message;
      return;
    }
    if(profile) {
      $('memberName').value=profile.display_name;
      $('memberName').readOnly=true;
      $('loginTitle').textContent='Content de te revoir !';
      $('loginIntro').textContent='Entre ton code PIN pour ouvrir le planning.';
      $('loginBtn').textContent='OUVRIR LE PLANNING →';
    }
  }

  db.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT')location.reload();
  });
}

async function enter(user) {
  me=user;
  $('login').hidden=true;
  $('app').hidden=false;
  $('logout').hidden=false;
  await refresh();
  subscribeRealtime();
}

async function refresh() {
  const from=dateISO(today()),to=new Date(today());
  to.setDate(to.getDate()+60);

  const [m,a,j,p,n]=await Promise.all([
    db.from('team_members').select('*').order('display_name'),
    db.from('availability').select('*').gte('day',from).lte('day',dateISO(to)),
    db.from('jobs').select('*').gte('day',from).lte('day',dateISO(to)).order('day'),
    db.from('job_participants').select('*'),
    db.from('day_notes').select('*').gte('day',from).lte('day',dateISO(to))
  ]);

  for(const [name,res] of [['équipe',m],['disponibilités',a],['chantiers',j],['participants',p],['commentaires',n]]) {
    if(res.error) {
      toast('Erreur '+name+': '+res.error.message);
      return;
    }
  }

  members=m.data||[];
  availability=a.data||[];
  jobs=j.data||[];
  participants=p.data||[];
  dayNotes=n.data||[];

  const mine=members.find(x=>x.user_id===me.id);
  $('myname').textContent=mine?.display_name||'l’équipe';
  render();
  renderTeam();
}

function subscribeRealtime() {
  if(channel)db.removeChannel(channel);

  channel=db.channel('fab-planning-live')
    .on('postgres_changes',{event:'*',schema:'public',table:'team_members'},()=>refresh())
    .on('postgres_changes',{event:'*',schema:'public',table:'availability'},()=>refresh())
    .on('postgres_changes',{event:'*',schema:'public',table:'jobs'},()=>refresh())
    .on('postgres_changes',{event:'*',schema:'public',table:'job_participants'},()=>refresh())
    .on('postgres_changes',{event:'*',schema:'public',table:'day_notes'},()=>refresh())
    .subscribe(status=>{
      if(status==='SUBSCRIBED')toast('Synchronisation en direct activée');
    });
}

function render() {
  drawCalendar();
  renderRequests();
  renderJobs();
  const pending=participants.filter(p=>p.user_id===me.id&&p.status==='invited').length;
  $('statpending').textContent=pending;
  const day=dateISO(today());
  $('statfree').textContent=members.filter(m=>['available','limited'].includes(dayStatus(m.user_id,day))).length;
}

function drawCalendar() {
  const start=monday(today());
  start.setDate(start.getDate()+weekOffset*7);
  const end=new Date(start);
  end.setDate(end.getDate()+rangeDays-1);

  $('weeklabel').textContent=start.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' – '+end.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  $('calendar').innerHTML='';
  $('calendar').style.gridTemplateColumns='repeat(7,minmax(0,1fr))';

  for(let i=0;i<rangeDays;i++) {
    const d=new Date(start);
    d.setDate(d.getDate()+i);
    const iso=dateISO(d);
    const el=document.createElement('div');
    el.className='day'+(iso===dateISO(today())?' today':'')+(iso===selectedDay?' selected':'');

    el.innerHTML=`<div class="dow">${d.toLocaleDateString('fr-FR',{weekday:'short'})}</div><div class="num">${d.getDate()}</div>`;

    members.forEach(m=>{
      const s=dayStatus(m.user_id,iso);
      const pill=document.createElement('div');
      pill.className='person-pill '+s;
      pillSet(pill,m,s);
      el.append(pill);
    });

    if(dayNotes.some(n=>n.day===iso)) {
      const chip=document.createElement('div');
      chip.className='daynote-chip';
      chip.textContent='✎ Note';
      el.append(chip);
    }

    el.onclick=()=>openDayNote(iso);
    $('calendar').append(el);
  }

  $('range30').classList.toggle('active',rangeDays===30);
  $('range45').classList.toggle('active',rangeDays===45);
}

function pillSet(el,m,s) {
  el.textContent=m.display_name.split(' ')[0]+' '+({available:'LIBRE',limited:'LIMITÉ',unavailable:'ABSENT',busy:'CHANTIER',unknown:'?'}[s]||'?');
}

function openDayNote(day) {
  selectedDay=day;
  const note=dayNotes.find(n=>n.day===day);
  $('selectedDayLabel').textContent=new Date(day+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  $('daynoteText').value=note?.comment||'';
  $('daynoteHistory').innerHTML=note?`<p class="muted">Dernière modification par ${esc(memberName(note.updated_by))} · ${new Date(note.updated_at).toLocaleString('fr-FR')}</p>`:'<p class="muted">Aucun commentaire pour cette journée.</p>';
  drawCalendar();
  showPanel('daynotePanel');
}

async function saveDayNote() {
  const comment=$('daynoteText').value.trim();
  if(!selectedDay)return;

  const {error}=await db.from('day_notes').upsert({
    day:selectedDay,
    comment,
    updated_by:me.id,
    updated_at:new Date().toISOString()
  },{onConflict:'day'});

  if(error) {
    toast('Commentaire non enregistré : '+error.message);
    return;
  }

  toast('Commentaire de la journée enregistré');
  showPanel('');
  await refresh();
}

function renderRequests() {
  const mine=participants.filter(p=>p.user_id===me.id&&p.status==='invited');
  $('requestlist').innerHTML=mine.length?'':'<p class="muted">Aucune invitation en attente 👍</p>';

  mine.forEach(p=>{
    const j=jobs.find(x=>x.id===p.job_id);
    if(!j)return;

    const c=document.createElement('div');
    c.className='card';
    c.innerHTML=`<h3>${esc(j.title)}</h3><p>${esc(j.day)} · ${esc(j.start_time.slice(0,5))}–${esc(j.end_time.slice(0,5))}</p><p>Proposé par ${esc(memberName(j.created_by))}</p>${j.note?`<p>📝 ${esc(j.note)}</p>`:''}<div class="card-actions"><button class="accept">J'ACCEPTE</button><button class="reject">INDISPONIBLE</button></div>`;

    c.querySelector('.accept').onclick=()=>answer(p.id,'accepted');
    c.querySelector('.reject').onclick=()=>answer(p.id,'declined');
    $('requestlist').append(c);
  });
}

function renderJobs() {
  const list=jobs.filter(j=>j.day>=dateISO(today())).slice(0,12);
  $('joblist').innerHTML=list.length?'':'<p class="muted">Pas encore de chantier programmé.</p>';

  list.forEach(j=>{
    const ps=participants.filter(p=>p.job_id===j.id);
    const names=ps.filter(p=>p.status==='accepted').map(p=>memberName(p.user_id));
    const c=document.createElement('div');
    c.className='card';
    c.innerHTML=`<h3>🐑 ${esc(j.title)}</h3><p>${esc(j.day)} · ${esc(j.start_time.slice(0,5))}–${esc(j.end_time.slice(0,5))}</p><p>✂️ ${names.map(esc).join(' · ')||'En attente des réponses'}</p>${j.note?`<p>📝 ${esc(j.note)}</p>`:''}`;
    $('joblist').append(c);
  });
}

function renderTeam() {
  $('teamlist').innerHTML=members.map(m=>`<div class="card"><h3>✂️ ${esc(m.display_name)} ${m.user_id===me.id?'· MOI':''}</h3><p>Disponibilités et invitations personnelles</p></div>`).join('')||'<p class="muted">Aucun membre.</p>';
}

async function answer(id,status) {
  const {error}=await db.from('job_participants').update({
    status,
    responded_at:new Date().toISOString()
  }).eq('id',id).eq('user_id',me.id);

  if(error)toast(error.message);
  else {
    toast(status==='accepted'?'Présence confirmée !':'Invitation refusée');
    await refresh();
  }
}

$('loginBtn').onclick=async()=>{
  const name=$('memberName').value.trim();
  const pin=$('memberPin').value.trim();
  if(!/^\\d{4}$/.test(pin)) {
    $('msg').textContent='Le code PIN doit contenir exactement 4 chiffres.';
    return;
  }

  $('loginBtn').disabled=true;
  $('msg').textContent='Connexion…';
  try {
    let {data:{session},error}=await db.auth.getSession();
    if(error)throw error;

    if(!session) {
      const signed=await db.auth.signInAnonymously();
      if(signed.error)throw signed.error;
      session=signed.data.session;
    }
    if(!session?.user)throw new Error('Connexion anonyme impossible.');

    const uid=session.user.id;
    const {data:profile,error:profileError}=await db
      .from('team_members').select('user_id,display_name')
      .eq('user_id',uid).maybeSingle();
    if(profileError)throw profileError;

    const pinKey='best-ouest-pin:'+uid;
    const savedPin=localStorage.getItem(pinKey);
    if(profile) {
      if(savedPin && savedPin!==pin)throw new Error('Code PIN incorrect.');
      if(!savedPin)localStorage.setItem(pinKey,pin);
    } else {
      if(!name)throw new Error('Entre ton prénom pour créer ton profil.');
      const {error:insertError}=await db.from('team_members').insert({
        user_id:uid,display_name:name
      });
      if(insertError)throw insertError;
      localStorage.setItem(pinKey,pin);
    }

    $('msg').textContent='';
    $('memberPin').value='';
    await enter(session.user);
  } catch(e) {
    $('msg').textContent=e.message||'Connexion impossible.';
  } finally {
    $('loginBtn').disabled=false;
  }
};

$('logout').onclick=()=>{
  $('app').hidden=true;
  $('login').hidden=false;
  $('logout').hidden=true;
  $('memberPin').value='';
  $('loginTitle').textContent='Te revoilà !';
  $('loginIntro').textContent='Entre ton code PIN pour ouvrir le planning.';
  $('loginBtn').textContent='OUVRIR LE PLANNING →';
  $('msg').textContent='';
};
$('prev').onclick=()=>{weekOffset--;drawCalendar()};
$('next').onclick=()=>{weekOffset++;drawCalendar()};
$('range30').onclick=()=>{rangeDays=30;weekOffset=0;drawCalendar()};
$('range45').onclick=()=>{rangeDays=45;weekOffset=0;drawCalendar()};

document.querySelectorAll('[data-panel]').forEach(b=>{
  b.onclick=()=>{
    const id=b.dataset.panel;
    showPanel(id);

    if(id==='availability') {
      $('adate').value=dateISO(today());
      const mine=members.find(m=>m.user_id===me.id);
      $('earliest').value=(mine?.earliest_start||'08:00').slice(0,5);
      $('latest').value=(mine?.latest_finish||'18:00').slice(0,5);
    }

    if(id==='job') {
      $('jdate').value=dateISO(today());
      $('memberchecks').innerHTML=members.filter(m=>m.user_id!==me.id).map(m=>`<label class="member-option"><input type="checkbox" value="${m.user_id}"><span>${esc(m.display_name)}</span></label>`).join('')||'<p class="muted">Ajoute d’abord les autres membres.</p>';
    }
  };
});

document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>showPanel(''));

$('saveA').onclick=async()=>{
  const day=$('adate').value;
  if(!day)return toast('Choisis une date');

  const earliest=$('earliest').value||'08:00';
  const latest=$('latest').value||'18:00';
  if(earliest>=latest)return toast('Vérifie tes horaires');

  const profile=await db.from('team_members').update({
    earliest_start:earliest,
    latest_finish:latest
  }).eq('user_id',me.id);

  if(profile.error)return toast(profile.error.message);

  const {error}=await db.from('availability').upsert({
    user_id:me.id,
    day,
    status:$('astatus').value,
    note:$('anote').value
  },{onConflict:'user_id,day'});

  if(error)toast(error.message);
  else {
    toast('Disponibilité et horaires enregistrés');
    showPanel('');
    await refresh();
  }
};

$('createJob').onclick=async()=>{
  const title=$('jname').value.trim();
  const day=$('jdate').value;
  const start=$('jstart').value;
  const end=$('jend').value;

  if(!title||!day||!start||!end||start>=end)return toast('Vérifie le nom, la date et les horaires');

  const mine=members.find(m=>m.user_id===me.id);
  const earliest=(mine?.earliest_start||'08:00').slice(0,5);
  const latest=(mine?.latest_finish||'18:00').slice(0,5);

  if(start<earliest||end>latest)return toast('Ce chantier dépasse tes horaires personnels ('+earliest+'–'+latest+')');

  const selected=[...document.querySelectorAll('#memberchecks input:checked')].map(x=>x.value);

  const {data:job,error}=await db.from('jobs').insert({
    created_by:me.id,
    title,
    day,
    start_time:start,
    end_time:end,
    note:$('jnote').value,
    status:'scheduled'
  }).select().single();

  if(error)return toast(error.message);

  const rows=[
    {job_id:job.id,user_id:me.id,status:'accepted'},
    ...selected.map(user_id=>({job_id:job.id,user_id,status:'invited'}))
  ];

  const result=await db.from('job_participants').insert(rows);

  if(result.error) {
    toast('Chantier créé, mais invitations non envoyées : '+result.error.message);
    return;
  }

  toast('Chantier créé, invitations envoyées !');
  $('jname').value='';
  $('jnote').value='';
  showPanel('');
  await refresh();
};

$('saveDayNote').onclick=saveDayNote;

init();
 
