
const C = window.FAB_CONFIG;
let db, me, myProfile=null, members=[], availability=[], jobs=[], participants=[], dayNotes=[], monthOffset=0, selectedDay=null, channel=null;

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
  if(id==='availability' && !isFabien()) {
    toast('Seul Fabien peut modifier les disponibilités.');
    id='';
  }
  ['availability','job','requests','team','daynotePanel'].forEach(x=>$(x).hidden=x!==id);
  const home=!id;
  document.querySelector('.action-section').hidden=!home;
  document.querySelector('.upcoming').hidden=!home;
}

function memberName(id) {
  if(id===me?.id && myProfile?.display_name) return myProfile.display_name;
  return members.find(m=>m.user_id===id)?.display_name||'Tondeur';
}

// Le rôle administrateur est lié à l'identifiant Supabase unique de Fabien,
// jamais au prénom seul : les anciens doublons "Fabien" ne deviennent pas admins.
const FABIEN_MAIN_USER_ID = 'b8a08855-ad52-421e-be3e-06dca42ba205';

function isFabien() {
  return !!me && me.id === FABIEN_MAIN_USER_ID;
}

function focusMember() {
  return members.find(m=>m.user_id===FABIEN_MAIN_USER_ID)
    || members.find(m=>m.user_id===me?.id && (m.display_name||'').trim().toLowerCase()==='fabien')
    || members.find(m=>(m.display_name||'').trim().toLowerCase()==='fabien')
    || members[0];
}

function jobConfirmed(jobId) {
  const rows=participants.filter(p=>p.job_id===jobId);
  // Le créateur est accepté d'office, mais les invités doivent tous répondre
  // positivement avant que le chantier soit affiché comme confirmé en bleu.
  return rows.length>0 && rows.every(p=>p.status==='accepted');
}

function dayStatus(uid,day) {
  const focus=focusMember();
  const target=focus?.user_id||uid;
  const confirmed=jobs.some(j=>j.day===day&&j.status!=='cancelled'&&jobConfirmed(j.id));
  if(confirmed)return 'busy';
  const record=availability.find(a=>a.user_id===target&&a.day===day);
  return record?.status||'available';
}

function dayLimitLetter(day) {
  const focus=focusMember();
  const record=availability.find(a=>a.user_id===focus?.user_id&&a.day===day);
  const value=(record?.note||'').trim().toUpperCase();
  return value==='S'?'S':'M';
}

function acceptedNames(day) {
  const names=[];
  jobs.filter(j=>j.day===day&&j.status!=='cancelled').forEach(j=>participants.filter(p=>p.job_id===j.id&&p.status==='accepted').forEach(p=>{
    const name=memberName(p.user_id); if(!names.includes(name))names.push(name);
  }));
  return names;
}

async function init() {
  try {
    if(!C || !C.SUPABASE_URL || C.SUPABASE_URL.includes('VOTRE-')) {
      $('msg').textContent='Configure Supabase dans config.js avant la mise en service.';
      return;
    }

    db=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{
      auth:{persistSession:true,autoRefreshToken:true}
    });

    const {data:{session},error}=await db.auth.getSession();
    if(error) throw error;

    if(session) {
      const {data:profile,error:profileError}=await db
        .from('team_members').select('display_name')
        .eq('user_id',session.user.id).maybeSingle();
      if(profileError) throw profileError;
      if(profile) {
        $('memberName').value=profile.display_name || '';
        $('loginTitle').textContent='Content de te revoir !';
        $('loginIntro').textContent='Entre ton code PIN pour ouvrir le planning.';
        $('loginBtn').textContent='OUVRIR LE PLANNING →';
      }
    }

    db.auth.onAuthStateChange((event,s)=>{
      if(s && event==='SIGNED_IN') setTimeout(()=>enter(s.user),0);
      else if(event==='SIGNED_OUT') location.reload();
    });
  } catch(e) {
    $('msg').textContent='Erreur de démarrage : '+(e.message||e);
  }
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

  const {data:ownProfile,error:ownProfileError}=await db
    .from('team_members').select('user_id,display_name,active')
    .eq('user_id',me.id).maybeSingle();
  if(ownProfileError) {
    toast('Impossible de lire ton profil : '+ownProfileError.message);
    return;
  }
  myProfile=ownProfile;
  if(myProfile?.display_name && $('myname')) {
  $('myname').textContent = myProfile.display_name;
  }
  if(!myProfile || myProfile.active===false) {
    toast('Ton accès à cette équipe a été désactivé ou ton profil est introuvable.');
    await db.auth.signOut();
    return;
  }

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

  members=(m.data||[]).filter(x=>x.active!==false);
  availability=a.data||[];
  jobs=j.data||[];
  participants=p.data||[];
  dayNotes=n.data||[];

  const pendingInvites=participants.filter(x=>x.user_id===me.id&&x.status==='invited');
  const pendingIds=new Set(pendingInvites.map(x=>x.id));
  if(invitesLoadedOnce) {
    const fresh=pendingInvites.filter(x=>!seenInviteIds.has(x.id));
    if(fresh.length) {
      toast(fresh.length===1?'Nouvelle invitation de chantier reçue !':fresh.length+' nouvelles invitations reçues !');
    }
  } else if(pendingInvites.length) {
    toast('Tu as '+pendingInvites.length+' invitation(s) à confirmer.');
  }
  seenInviteIds=pendingIds;
  invitesLoadedOnce=true;

  const mine=members.find(x=>x.user_id===me.id)||myProfile;
  $('myname').textContent=(me.id===FABIEN_MAIN_USER_ID?'Fabien':(mine?.display_name||'Profil introuvable'));
  applyRolePermissions();
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
  ['pendingBadge','pendingMenuBadge'].forEach(id=>{
    const badge=$(id);
    if(badge) {
      badge.textContent=pending;
      badge.hidden=pending===0;
    }
  });
  const pendingCard=$('pendingCard');
  if(pendingCard) {
    pendingCard.classList.toggle('has-pending',pending>0);
    pendingCard.setAttribute('aria-label',pending+' invitation(s) à voir');
  }
  const day=dateISO(today());
  $('statfree').textContent=['available','limited'].includes(dayStatus(focusMember()?.user_id,day))?'1':'0';
}

function drawCalendar() {
  const base=today();
  const month=new Date(base.getFullYear(),base.getMonth()+monthOffset,1);
  const year=month.getFullYear();
  const monthIndex=month.getMonth();
  const firstDay=new Date(year,monthIndex,1);
  const lastDay=new Date(year,monthIndex+1,0);
  const offset=(firstDay.getDay()+6)%7;
  const totalCells=Math.ceil((offset+lastDay.getDate())/7)*7;

  $('weeklabel').textContent=month.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  $('calendar').innerHTML='';
  $('calendar').style.gridTemplateColumns='repeat(7,minmax(0,1fr))';

  ['LUN.','MAR.','MER.','JEU.','VEN.','SAM.','DIM.'].forEach(name=>{
    const head=document.createElement('div');
    head.className='calendar-weekday';
    head.textContent=name;
    $('calendar').append(head);
  });

  for(let cell=0;cell<totalCells;cell++) {
    const dayNumber=cell-offset+1;
    if(dayNumber<1 || dayNumber>lastDay.getDate()) {
      const blank=document.createElement('div');
      blank.className='day-empty';
      $('calendar').append(blank);
      continue;
    }

    const d=new Date(year,monthIndex,dayNumber);
    const iso=dateISO(d);
    const el=document.createElement('div');
    el.className='day'+(iso===dateISO(today())?' today':'')+(iso===selectedDay?' selected':'');
    el.innerHTML=`<div class="num">${dayNumber}</div>`;

    const focus=focusMember();
    const status=dayStatus(focus?.user_id,iso);
    el.classList.add('focus-'+status);
    if(status==='busy') {
      const label=document.createElement('div');
      label.className='day-participants';
      label.textContent=acceptedNames(iso).join(', ')||'CHANTIER';
      el.append(label);
    } else if(status==='limited') {
      const label=document.createElement('div');
      label.className='day-limit';
      label.textContent=dayLimitLetter(iso);
      el.append(label);
    }

    if(dayNotes.some(n=>n.day===iso)) {
      const chip=document.createElement('div');
      chip.className='daynote-chip';
      chip.textContent='✎ Note';
      el.append(chip);
    }

    el.onclick=()=>openDayActions(iso);
    $('calendar').append(el);
  }

  $('range30').classList.add('active');
}
function openDayActions(day) {
  selectedDay=day;
  const label=new Date(day+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  $('dayActionTitle').textContent=label;
  const jobsToday=jobs.filter(j=>j.day===day&&j.status!=='cancelled');
  $('dayJobsPreview').innerHTML=jobsToday.length?'<b>Chantiers prévus</b>'+jobsToday.map(j=>{
    const rows=participants.filter(p=>p.job_id===j.id);
    const accepted=rows.filter(p=>p.status==='accepted').map(p=>memberName(p.user_id));
    const waiting=rows.filter(p=>p.status==='invited').map(p=>memberName(p.user_id));
    const declined=rows.filter(p=>p.status==='declined').map(p=>memberName(p.user_id));
    const state=jobConfirmed(j.id)?'CHANTIER CONFIRMÉ':'EN ATTENTE DE RÉPONSES';
    return `<div class="day-job-entry"><b>${esc(j.title)}</b><small>${esc(state)} · proposé par ${esc(memberName(j.created_by))}</small>${accepted.length?`<p>Accepté : ${accepted.map(esc).join(', ')}</p>`:''}${waiting.length?`<p class="pending-text">À confirmer : ${waiting.map(esc).join(', ')}</p>`:''}${declined.length?`<p class="declined-text">Indisponible : ${declined.map(esc).join(', ')}</p>`:''}${j.note?`<p>${esc(j.note)}</p>`:''}</div>`;
  }).join(''):'<p class="muted">Aucun chantier prévu.</p>';
  document.querySelectorAll('[data-daystatus]').forEach(b=>{b.hidden=!isFabien();});
  $('dayActionMenu').hidden=false;
  $('mainMenu').hidden=true;
  $('menuToggle').setAttribute('aria-expanded','false');
}

async function setDayStatus(choice) {
  if(!isFabien())return toast('Seul Fabien peut changer les couleurs du calendrier.');
  if(!selectedDay)return;
  const status=choice.startsWith('limited')?'limited':choice;
  const note=choice==='limitedS'?'S':choice==='limitedM'?'M':'';
  const target=focusMember()?.user_id || me.id;
  const {error}=await db.from('availability').upsert({user_id:target,day:selectedDay,status,note},{onConflict:'user_id,day'});
  if(error)return toast('Disponibilité non enregistrée : '+error.message);
  $('dayActionMenu').hidden=true;
  toast('Couleur de la journée mise à jour');
  await refresh();
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
    const proposer=memberName(j.created_by);
    const c=document.createElement('div');
    c.className='card invitation-card';
    c.innerHTML=`<div class="invitation-tag">🔔 INVITATION À CONFIRMER</div><h3>🐑 ${esc(j.title)}</h3><p>📅 ${esc(new Date(j.day+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}</p><p>Proposé par <b>${esc(proposer)}</b></p>${j.note?`<p>📝 ${esc(j.note)}</p>`:''}<div class="card-actions"><button class="accept">✓ J'ACCEPTE</button><button class="reject">✕ INDISPONIBLE</button></div>`;
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
    c.innerHTML=`<h3>🐑 ${esc(j.title)}</h3><p>${esc(j.day)}</p><p>✂️ ${names.map(esc).join(' · ')||'En attente des réponses'}</p>${j.note?`<p>📝 ${esc(j.note)}</p>`:''}`;
    $('joblist').append(c);
  });
}

function applyRolePermissions() {
  const admin=isFabien();
  document.querySelectorAll('[data-daystatus]').forEach(b=>b.hidden=!admin);
  const availabilityMenu=document.querySelector('[data-panel="availability"]');
  if(availabilityMenu) availabilityMenu.hidden=!admin;
}

function renderTeam() {
  const ordered=[...members].sort((a,b)=>(a.user_id===me.id?-1:0)-(b.user_id===me.id?-1:0));
  const seen=new Set();
  const unique=ordered.filter(m=>{
    const key=(m.display_name||'').trim().toLocaleLowerCase('fr-FR');
    if(!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const admin=isFabien();
  $('teamlist').innerHTML=unique.map(m=>`<div class="card team-member-card"><div><h3>✂️ ${esc(m.display_name)} ${m.user_id===me.id?'· MOI':''}</h3><p>Compte actif de l’équipe</p></div>${admin&&m.user_id!==me.id?`<button class="danger remove-member" data-remove-member="${m.user_id}" data-member-name="${esc(m.display_name)}">Retirer</button>`:''}</div>`).join('')||'<p class="muted">Aucun membre.</p>';
  document.querySelectorAll('[data-remove-member]').forEach(button=>{
    button.onclick=()=>removeTeamMember(button.dataset.removeMember,button.dataset.memberName);
  });
}

async function removeTeamMember(userId,name) {
  if(!isFabien()) return toast('Seul Fabien peut retirer un membre.');
  if(!userId || userId===me.id) return toast('Tu ne peux pas retirer ton propre compte.');
  if(!window.confirm('Retirer '+name+' de l’équipe ? Ses anciens chantiers et historiques seront conservés.')) return;
  const {error}=await db.rpc('remove_team_member',{target_user_id:userId});
  if(error) return toast('Retrait impossible : '+error.message);
  toast(name+' a été retiré de l’équipe.');
  await refresh();
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
  const msg=$('msg');

  if(!/^\d{4}$/.test(pin)) {
    msg.textContent='Le code PIN doit contenir exactement 4 chiffres.';
    return;
  }
  if(!db) {
    msg.textContent='Connexion à Supabase non initialisée. Recharge l’application.';
    return;
  }

  const btn=$('loginBtn');
  btn.disabled=true;
  msg.textContent='Connexion en cours…';

  try {
    let {data:{session},error}=await db.auth.getSession();
    if(error) throw error;

    if(!session) {
      const signed=await db.auth.signInAnonymously();
      if(signed.error) throw signed.error;
      session=signed.data.session;
    }
    if(!session || !session.user) throw new Error('Supabase n’a pas créé de session.');

    const uid=session.user.id;
    const {data:profile,error:profileError}=await db
      .from('team_members').select('user_id,display_name,active')
      .eq('user_id',uid).maybeSingle();
    if(profileError) throw profileError;

    const pinKey='best-ouest-pin:'+uid;
    const savedPin=localStorage.getItem(pinKey);

    if(profile) {
      if(profile.active===false) throw new Error('Ce compte a été retiré de l’équipe. Contacte Fabien.');
      myProfile=profile;
      if(savedPin && savedPin!==pin) throw new Error('Code PIN incorrect.');
      if(!savedPin) localStorage.setItem(pinKey,pin);
      if(!name) throw new Error('Entre ton prénom.');
      if(name !== profile.display_name) {
        const {error:renameError}=await db.from('team_members')
          .update({display_name:name})
          .eq('user_id',uid);
        if(renameError) throw renameError;
      }
    } else {
      if(!name) throw new Error('Entre ton prénom pour créer ton profil.');
      const {error:insertError}=await db.from('team_members').insert({
        user_id:uid,
        display_name:name
      });
      if(insertError) throw insertError;
      myProfile={user_id:uid,display_name:name};
      localStorage.setItem(pinKey,pin);
    }

    msg.textContent='Profil validé, ouverture du planning…';
    await enter(session.user);
  } catch(e) {
    msg.textContent=e.message||'Connexion impossible.';
  } finally {
    btn.disabled=false;
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
$('prev').onclick=()=>{monthOffset--;drawCalendar()};
$('next').onclick=()=>{monthOffset++;drawCalendar()};
$('range30').onclick=()=>{monthOffset=0;drawCalendar()};


document.querySelectorAll('[data-panel]').forEach(b=>{
  b.onclick=()=>{
    const id=b.dataset.panel;
    showPanel(id);
    $('mainMenu').hidden=true;
    $('menuToggle').setAttribute('aria-expanded','false');

    if(id==='availability') {
      $('adate').value=selectedDay||dateISO(today());
      $('astatus').value='available';
      $('limitPeriod').value='M';
      $('limitLabel').hidden=true;
    }

    if(id==='job') {
      $('jdate').value=selectedDay||dateISO(today());
      $('memberchecks').innerHTML=members.filter(m=>m.user_id!==me.id).map(m=>`<label class="member-option"><input type="checkbox" value="${m.user_id}"><span>${esc(m.display_name)}</span></label>`).join('')||'<p class="muted">Ajoute d’abord les autres membres.</p>';
    }
  };
});

document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>showPanel(''));

$('astatus').onchange=()=>{$('limitLabel').hidden=$('astatus').value!=='limited';};
$('saveA').onclick=async()=>{
  if(!isFabien())return toast('Seul Fabien peut modifier les disponibilités.');
  const day=$('adate').value;
  if(!day)return toast('Choisis une date');
  const status=$('astatus').value;
  const note=status==='limited'?$('limitPeriod').value:'';
  const {error}=await db.from('availability').upsert({user_id:me.id,day,status,note},{onConflict:'user_id,day'});
  if(error)toast('Disponibilité non enregistrée : '+error.message);
  else {
    toast('Disponibilité enregistrée');
    showPanel('');
    await refresh();
  }
};

$('createJob').onclick=async()=>{
  const title=$('jname').value.trim();
  const day=$('jdate').value;
  const button=$('createJob');
  const start='08:00';
  const end='17:00';

  if(!title||!day)return toast('Vérifie le nom et la date');
  if(!me?.id)return toast('Reconnecte-toi avant de proposer un chantier.');

  const selected=[...new Set([...document.querySelectorAll('#memberchecks input:checked')].map(x=>x.value).filter(id=>id && id!==me.id))];
  button.disabled=true;
  button.textContent='ENVOI EN COURS…';

  try {
    const {data:job,error}=await db.from('jobs').insert({
      created_by:me.id,
      title,
      day,
      start_time:start,
      end_time:end,
      note:$('jnote').value.trim(),
      status:'scheduled'
    }).select().single();

    if(error)throw new Error('Création du chantier impossible : '+error.message);
    if(!job?.id)throw new Error('Supabase n’a pas retourné le chantier créé.');

    const rows=[
      {job_id:job.id,user_id:me.id,status:'accepted'},
      ...selected.map(user_id=>({job_id:job.id,user_id,status:'invited'}))
    ];
    const result=await db.from('job_participants').insert(rows);

    if(result.error) {
      // Ne pas laisser un chantier orphelin qui semblerait confirmé.
      await db.from('jobs').update({status:'cancelled'}).eq('id',job.id).eq('created_by',me.id);
      throw new Error('Le chantier a été créé mais les invitations n’ont pas été enregistrées : '+result.error.message+'. Vérifie les droits SQL des invitations.');
    }

    toast(selected.length
      ? 'Chantier créé : '+selected.length+' invitation(s) envoyée(s).'
      : 'Chantier créé. Tu n’as sélectionné aucun autre tondeur.');
    $('jname').value='';
    $('jnote').value='';
    showPanel('');
    await refresh();
  } catch(error) {
    toast(error.message||'Erreur lors de la création du chantier.');
  } finally {
    button.disabled=false;
    button.innerHTML='ENVOYER LES INVITATIONS <span>→</span>';
  }
};


$('pendingCard').onclick=()=>showPanel('requests');
$('pendingCard').onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showPanel('requests');}};
$('menuToggle').onclick=(event)=>{
  event.stopPropagation();
  const opening=$('mainMenu').hidden;
  $('mainMenu').hidden=!opening;
  $('menuToggle').setAttribute('aria-expanded',String(opening));
};
document.addEventListener('click',event=>{
  if(!$('mainMenu').hidden && !event.target.closest('#mainMenu') && !event.target.closest('#menuToggle')) {
    $('mainMenu').hidden=true;
    $('menuToggle').setAttribute('aria-expanded','false');
  }
});
$('closeDayMenu').onclick=()=>{$('dayActionMenu').hidden=true;};
document.querySelectorAll('[data-daystatus]').forEach(b=>b.onclick=()=>setDayStatus(b.dataset.daystatus));
$('dayProposeJob').onclick=()=>{
  $('dayActionMenu').hidden=true;
  showPanel('job');
  $('jdate').value=selectedDay;
  $('memberchecks').innerHTML=members.filter(m=>m.user_id!==me.id).map(m=>`<label class="member-option"><input type="checkbox" value="${m.user_id}"><span>${esc(m.display_name)}</span></label>`).join('')||'<p class="muted">Ajoute d’abord les autres membres.</p>';
};
$('dayViewNotes').onclick=()=>{ $('dayActionMenu').hidden=true; openDayNote(selectedDay); };

$('saveDayNote').onclick=saveDayNote;

init();
