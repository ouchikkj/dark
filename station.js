(()=>{
'use strict';
const $=id=>document.getElementById(id),root=$('dsStation'),KEY='dark-campaign-access-v1';
let records=[],access=null,state=null,tab='home',pollTimer=null,polling=false,writing=false,generation=0,sceneDirty=false,sceneRevision=null,clueRevision=null,lastCharacter='',sheetTimer=null,notebook=null;
try{records=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(records))records=[];}catch{}
records=records.filter(r=>r&&/^[a-f0-9]{32}$/.test(r.id)&&/^[a-f0-9]{64}$/.test(r.token)).slice(0,30);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const status=text=>{$('dsStatus').textContent=text;};
function remember(){try{localStorage.setItem(KEY,JSON.stringify(records));}catch{status('Acesso ativo, mas não foi possível guardá-lo neste navegador. Libere espaço antes de fechar.');}}
function service(){const u=new URL(window.BREU_CALL_CONFIG?.campaignService||window.BREU_CALL_CONFIG?.tokenService||'');if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error('Configure o endereço do serviço em sala-config.js.');if(u.username||u.password||u.search||u.hash)throw Error('Endereço do serviço inválido.');return u.href.replace(/\/$/,'');}
async function api(path,body={},credential=access){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),15000);
 try{const response=await fetch(service()+'/campaign/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(credential?.token?{Authorization:'Bearer '+credential.token}:{})},body:JSON.stringify(body),signal:ctrl.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  let data;try{data=await response.json();}catch{throw Error('O serviço ainda não está pronto para campanhas. Publique o Worker deste pacote.');}
  if(!response.ok){const error=Error(data.error||'Não foi possível concluir.');error.status=response.status;throw error;}return data;
 }catch(e){if(e.name==='AbortError')throw Error('A resposta demorou. Seu texto continua aqui; confira a conexão e tente novamente.');if(e instanceof TypeError)throw Error('Sem conexão com a campanha. Confira a internet; suas edições ainda estão na tela.');throw e;}finally{clearTimeout(timer);}
}
function parseInvite(value){
 const raw=value.trim();if(/^[a-f0-9]{32}$/.test(raw))return {id:raw};
 let u;try{u=new URL(raw);}catch{throw Error('Cole o convite completo da campanha.');}
 const p=new URLSearchParams(u.hash.slice(1)),id=p.get('campanha'),invitation=p.get('acesso');
 if(!/^[a-f0-9]{32}$/.test(id||''))throw Error('Este não é um convite de campanha.');return {id,invitation};
}
function inviteURL(){const u=new URL(location.href);u.search='';u.hash=new URLSearchParams({campanha:state.id,acesso:state.invitation});return u.href;}
function show(){
 const inCall=Boolean(window.BreuStationRoom?.hasCall());if(inCall){window.BreuStationRoom.show();window.BreuStationRoom.closeSheet();}
 root.classList.toggle('ds-compact',inCall);$('brRoom')?.setAttribute('data-station',String(inCall));
 if(state)$('dsOpenCall').textContent=inCall?'VOLTAR À CHAMADA':state.role==='gm'&&!state.session.room?'ABRIR CHAMADA':'ENTRAR NA CHAMADA';
 root.hidden=false;$('dsClose').textContent=inCall?'VOLTAR À MESA':'VOLTAR À FICHA';$('dsClose').focus();
}
function close(){root.hidden=true;$('brRoom')?.setAttribute('data-station','false');$('dsOpen')?.focus();}
function setTab(value){tab=value==='notebook'&&state?.role!=='gm'?'home':value;root.dataset.notebook=String(tab==='notebook');for(const el of root.querySelectorAll('[data-ds-page]'))el.hidden=el.dataset.dsPage!==tab;for(const btn of root.querySelectorAll('[data-ds-tab]')){btn.classList.toggle('active',btn.dataset.dsTab===tab);btn.setAttribute('aria-pressed',String(btn.dataset.dsTab===tab));}}
function saved(){
 $('dsSaved').replaceChildren(...records.map(r=>{const row=node('div',undefined,'ds-saved'),label=node('div');label.append(node('strong',r.name),node('small',r.role==='gm'?'MESTRE':'JOGADOR'));const open=node('button','CONTINUAR');open.onclick=()=>run(()=>resume(r));row.append(label,open);return row;}));
}
function adopt(data,previous){
 const s=data.state;if(!s?.id)throw Error('Resposta inválida da campanha.');
 access={...previous,id:s.id,name:s.name,role:s.role,token:data.token||previous?.token};
 if(!access.token)throw Error('Não foi possível guardar seu acesso.');
 records=[access,...records.filter(r=>r.id!==s.id)].slice(0,30);remember();state=null;generation++;sceneDirty=false;sceneRevision=null;clueRevision=null;lastCharacter='';
 $('dsClueForm').reset();$('dsSceneEditor').open=false;$('dsClueEditor').open=false;
 apply(s);$('dsLobby').hidden=true;$('dsWorkspace').hidden=false;setTab(s.role==='gm'?'notebook':'home');
 // Consume the campaign invitation without placing the member credential in the URL.
 if(new URLSearchParams(location.hash.slice(1)).has('campanha'))history.replaceState(null,'',location.pathname+location.search);
 schedule();
}
async function resume(record){const data=await api(record.id+'/state',{},record);adopt(data,record);status('Campanha sincronizada.');}
function apply(next){
 if(state?.id===next.id&&state.revision>next.revision)return;
 const previous=state;state=next;const gm=state.role==='gm';
 notebook?.update(state);
 for(const el of root.querySelectorAll('[data-ds-gm]'))el.hidden=!gm;
 $('dsHeading').textContent=state.name;$('dsCampaignTitle').textContent=state.name;
 $('dsSessionLabel').textContent=state.session.active?`SESSÃO ${state.session.number} · EM ANDAMENTO`:'ENTRE SESSÕES';
 $('dsLastSummary').textContent=state.sessions[0]?`Onde paramos · sessão ${state.sessions[0].number}\n${state.sessions[0].summary}`:'Ainda não há um resumo. A primeira sessão começa quando o mestre estiver pronto.';
 $('dsSceneStatus').textContent=state.session.active?`SESSÃO ${state.session.number} · AO VIVO`:'PREPARAÇÃO DA PRÓXIMA SESSÃO';
 $('dsSceneTitle').textContent=state.session.title||'A próxima cena espera por vocês.';
 $('dsSceneLocation').textContent=state.session.location;$('dsSceneObjective').textContent=state.session.objective||'O mestre pode definir o local e o objetivo para orientar o grupo.';
 displayImage($('dsSceneImage'),state.session.image);
 $('dsStartSession').hidden=!gm||state.session.active;$('dsFinishDetails').hidden=!gm||!state.session.active;
 $('dsOpenCall').disabled=!state.session.active;
 $('dsOpenCall').textContent=window.BreuStationRoom?.hasCall()?'VOLTAR À CHAMADA':gm&&!state.session.room?'ABRIR CHAMADA':'ENTRAR NA CHAMADA';
 if(!sceneDirty)fillScene();
 const me=state.members.find(m=>m.id===state.memberId);
 $('dsUnbind').hidden=!me?.character;
 $('dsBindingHint').textContent=access.profileId?(currentProfile()===access.profileId?'Ficha associada: alterações de nome e recursos são compartilhadas automaticamente.':'Você está em outra ficha. A campanha mantém o último estado do personagem associado.'):(me?.character?'Personagem associado em outro dispositivo. Associe a ficha local para atualizar daqui.':'Nenhuma ficha associada neste dispositivo.');
 $('dsMembers').replaceChildren(...state.members.map(m=>{
  const row=node('div',undefined,'ds-member'),info=node('div');info.append(node('strong',m.character?.name||m.name));info.append(node('small',`${m.name}${m.id===state.memberId?' · você':''} · ${m.role==='gm'?'mestre':'jogador'}`));
  if(m.character)info.append(node('small',['vd','san','pe'].map(k=>`${k.toUpperCase()} ${m.character[k].current}/${m.character[k].max}`).join(' · ')));
  row.append(info);if(gm&&m.role!=='gm'){const remove=node('button','REMOVER ACESSO');remove.className='ds-quiet';remove.onclick=()=>confirmInline(remove,'CONFIRMAR REMOÇÃO',()=>command({action:'remove',id:m.id}));row.append(remove);}return row;
 }));
 const revealed=state.clues.filter(c=>c.revealed).length;$('dsClueCount').textContent=String(gm?state.clues.length:revealed);
 $('dsClueHelp').textContent=gm?'Prepare em segredo. O conteúdo só chega aos jogadores depois de revelar. Pistas reveladas permanecem no arquivo.':'As pistas reveladas pelo mestre ficam guardadas aqui, mesmo depois da chamada.';
 renderClues();renderArchive();renderStrip();
 if(gm&& !$('dsInviteBox').hidden)$('dsInviteOutput').value=inviteURL();
 if(previous&&state.clues.some(c=>c.revealed&&!previous.clues.some(p=>p.id===c.id&&p.revealed)))status('Nova pista revelada. Abra Pistas para ver a descoberta.');
}
function displayImage(el,url){el.hidden=!url;if(url){if(el.getAttribute('src')!==url)el.src=url;el.onerror=()=>{el.hidden=true;};}else el.removeAttribute('src');}
function fillScene(){const s=state.session;$('dsSceneTitleInput').value=s.title;$('dsSceneLocationInput').value=s.location;$('dsSceneObjectiveInput').value=s.objective;$('dsSceneImageInput').value=s.image;}
function renderClues(){
 $('dsClues').replaceChildren(...[...state.clues].sort((a,b)=>(b.revealedAt||0)-(a.revealedAt||0)).map(c=>{
  const article=node('article',undefined,'ds-clue'+(!c.revealed?' ds-secret':''));article.append(node('small',c.revealed?'REVELADA AO GRUPO':'SEGREDO DO MESTRE'),node('h3',c.title));
  if(c.image){const img=node('img');img.alt=c.title;img.referrerPolicy='no-referrer';img.loading='lazy';displayImage(img,c.image);article.append(img);}article.append(node('p',c.text,'ds-prose'));
  if(state.role==='gm'){const buttons=node('div',undefined,'ds-actions'),edit=node('button','EDITAR');edit.onclick=()=>editClue(c);buttons.append(edit);if(!c.revealed){const reveal=node('button','REVELAR AO GRUPO');reveal.dataset.dsReveal=c.id;reveal.onclick=()=>confirmInline(reveal,'CONFIRMAR REVELAÇÃO',()=>command({action:'reveal',id:c.id}));buttons.append(reveal);}article.append(buttons);}return article;
 }));
 if(!state.clues.length)$('dsClues').append(node('p',state.role==='gm'?'Prepare a primeira pista acima.':'Nenhuma pista revelada ainda. As descobertas aparecerão aqui.','ds-empty'));
}
function renderArchive(){
 $('dsArchive').replaceChildren(...state.sessions.map(s=>{const a=node('article',undefined,'ds-archive');a.append(node('small',`SESSÃO ${s.number} · ${new Date(s.endedAt).toLocaleDateString('pt-BR')}`),node('h3',s.title||'Registro da sessão'),node('p',s.summary,'ds-prose'));return a;}));
 if(!state.sessions.length)$('dsArchive').append(node('p','Ao encerrar uma sessão, o mestre registra um resumo para o próximo encontro.','ds-empty'));
}
function editClue(c){clueRevision=state.editRevision;$('dsClueEditor').open=true;$('dsClueId').value=c.id;$('dsClueTitle').value=c.title;$('dsClueText').value=c.text;$('dsClueImage').value=c.image;$('dsClueSaveHint').textContent=c.revealed?'Esta pista já foi revelada. Suas alterações também serão compartilhadas.':'Esta pista continua em segredo até você revelar.';$('dsClueTitle').focus();}
function confirmInline(button,label,operation){
 const old=button.textContent;button.textContent=label;button.onclick=()=>run(operation);setTimeout(()=>{if(button.isConnected){button.textContent=old;button.onclick=()=>confirmInline(button,label,operation);}},6000);
}
async function command(body){
 const record=access,gen=generation;
 const data=await api(record.id+'/command',{...body,revision:body.revision??state.editRevision},record);
 if(gen===generation){apply(data.state);status('Alteração salva para a campanha.');}return data;
}
async function run(fn){
 if(writing)return;writing=true;root.setAttribute('aria-busy','true');const buttons=[...root.querySelectorAll('button:not(:disabled)')];buttons.forEach(b=>b.disabled=true);
 try{await fn();}catch(e){status(e.message);if(e.status===409){sceneDirty=true;await refresh().catch(()=>{});sceneRevision=state?.editRevision;clueRevision=state?.editRevision;}if(e.status===401)clearTimeout(pollTimer);}
 finally{writing=false;root.removeAttribute('aria-busy');buttons.forEach(b=>b.disabled=false);if(state)$('dsOpenCall').disabled=!state.session.active;}
}
async function refresh(){
 if(!access)return;const record=access,gen=generation;const {state:next}=await api(record.id+'/state',{},record);if(gen!==generation)return;
 if(!state||next.revision!==state.revision)apply(next);
}
function schedule(delay=4000){clearTimeout(pollTimer);pollTimer=setTimeout(async()=>{
  if(!access)return;if(polling||writing||document.hidden){schedule();return;}polling=true;
  try{await refresh();if($('dsStatus').dataset.offline){delete $('dsStatus').dataset.offline;status('Conexão recuperada. Campanha sincronizada.');}}
  catch(e){$('dsStatus').dataset.offline='true';status(e.message);if(e.status===401){polling=false;return;}}
  polling=false;schedule();
 },delay);}
function currentProfile(){try{return activeProfileId||'';}catch{return '';}}
function sheetSummary(){
 const name=$('charNameInput')?.value?.trim();if(!name)throw Error('Preencha o nome do personagem na ficha primeiro.');
 const c={name:name.slice(0,60)};for(const k of ['vd','san','pe'])c[k]={current:Math.max(0,Math.min(1000000,Number($(k+'_atual')?.value)||0)),max:Math.max(1,Math.min(1000000,Number($(k+'_max')?.value)||1))};return c;
}
async function shareCharacter(force=false){
 if(!access||(!force&&(!access.profileId||access.profileId!==currentProfile())))return;
 try{if(isSecondaryTab)throw Error('Esta ficha está aberta em outra aba. Use a aba principal para associar.');}catch(e){if(e.message?.startsWith('Esta ficha'))throw e;}
 const c=sheetSummary(),serialized=JSON.stringify(c);if(!force&&serialized===lastCharacter)return;
 await command({action:'character',character:c});lastCharacter=serialized;
 if(force){access.profileId=currentProfile();remember();apply(state);}
}
function renderStrip(){
 const strip=$('dsSceneStrip');strip.hidden=!state;if(!state)return;
 $('dsStripTitle').textContent=state.session.title||state.name;$('dsStripLocation').textContent=[state.session.active?`Sessão ${state.session.number}`:'Entre sessões',state.session.location].filter(Boolean).join(' · ');
 $('dsStripClues').textContent=`PISTAS · ${state.clues.filter(c=>c.revealed).length}`;
}
// Add navigation beside the existing call controls; the original sheet is never cloned.
const open=node('button','CAMPANHA');open.id='dsOpen';open.className='sys-btn';open.onclick=show;$('brOpen').after(open);
const roomButton=node('button','CAMPANHA');roomButton.type='button';roomButton.onclick=show;document.querySelector('#brRoom .br-header-actions')?.prepend(roomButton);
const strip=node('div');strip.id='dsSceneStrip';strip.hidden=true;const stripInfo=node('div');const stripTitle=node('strong');stripTitle.id='dsStripTitle';const stripLocation=node('small');stripLocation.id='dsStripLocation';stripInfo.append(stripTitle,stripLocation);const clues=node('button','PISTAS');clues.id='dsStripClues';clues.onclick=()=>{show();setTab('clues');};strip.append(stripInfo,clues);$('brVideoArea').before(strip);
$('dsClose').onclick=close;
root.querySelectorAll('[data-ds-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.dsTab));
$('dsGoSession').onclick=()=>setTab('scene');
$('dsSwitch').onclick=()=>{
 if(window.BreuStationRoom?.hasCall()){status('Saia da chamada antes de trocar de campanha.');return;}
 if(sceneDirty||$('dsClueTitle').value||notebook?.hasDraft()){status('Salve ou cancele suas edições antes de trocar de campanha.');return;}
 generation++;access=null;state=null;clearTimeout(pollTimer);$('dsWorkspace').hidden=true;$('dsLobby').hidden=false;$('dsHeading').textContent='Suas campanhas';$('dsSceneStrip').hidden=true;$('dsInviteBox').hidden=true;saved();status('Escolha uma campanha para continuar.');
};
$('dsCreateForm').onsubmit=e=>{e.preventDefault();run(async()=>{const body={name:$('dsCampaignName').value,masterPassword:$('dsCreatePassword').value};const data=await api('create',body,null);$('dsCreatePassword').value='';adopt(data);status('Campanha criada. Convide o grupo e prepare sua primeira cena.');});};
$('dsJoinForm').onsubmit=e=>{e.preventDefault();run(async()=>{const invite=parseInvite($('dsInviteInput').value);const previous=records.find(r=>r.id===invite.id);const data=await api(invite.id+'/join',{invitation:invite.invitation,playerName:$('dsPlayerName').value},previous);adopt(data,previous);$('dsInviteInput').value='';status('Você entrou na campanha. Associe sua ficha para o grupo reconhecer seu personagem.');});};
$('dsRecoverForm').onsubmit=e=>{e.preventDefault();run(async()=>{const {id}=parseInvite($('dsRecoverInvite').value);const data=await api(id+'/recover',{masterPassword:$('dsRecoverPassword').value},null);$('dsRecoverPassword').value='';adopt(data,records.find(r=>r.id===id));status('Acesso de mestre recuperado neste navegador. O acesso anterior foi substituído.');});};
function invite(){if(!state||state.role!=='gm'){show();status('Peça o convite da campanha ao mestre.');return;}show();setTab('home');$('dsInviteBox').hidden=false;$('dsInviteOutput').value=inviteURL();$('dsInviteOutput').focus();}
$('dsInviteButton').onclick=invite;$('dsHideInvite').onclick=()=>{$('dsInviteBox').hidden=true;};
$('dsCopyInvite').onclick=async()=>{try{await navigator.clipboard.writeText(inviteURL());status('Convite copiado. Envie ao grupo.');}catch{$('dsInviteOutput').select();status('Selecione e copie o convite acima.');}};
$('dsRotateInvite').onclick=()=>confirmInline($('dsRotateInvite'),'CONFIRMAR TROCA DO CONVITE',()=>command({action:'rotate'}));
$('dsSceneForm').oninput=()=>{if(!sceneDirty)sceneRevision=state.editRevision;sceneDirty=true;};
$('dsSceneForm').onsubmit=e=>{e.preventDefault();run(async()=>{await command({action:'scene',revision:sceneRevision??state.editRevision,title:$('dsSceneTitleInput').value,location:$('dsSceneLocationInput').value,objective:$('dsSceneObjectiveInput').value,image:$('dsSceneImageInput').value});sceneDirty=false;sceneRevision=null;$('dsSceneEditor').open=false;});};
$('dsCancelScene').onclick=()=>{sceneDirty=false;sceneRevision=null;fillScene();$('dsSceneEditor').open=false;};
$('dsStartSession').onclick=()=>run(()=>{if(window.BreuStationRoom?.hasCall())throw Error('Saia da chamada anterior antes de iniciar outra sessão.');return command({action:'start'});});
$('dsFinishForm').onsubmit=e=>{e.preventDefault();run(async()=>{await command({action:'finish',summary:$('dsSessionSummary').value});$('dsSessionSummary').value='';$('dsFinishDetails').open=false;setTab('archive');});};
$('dsClueForm').onsubmit=e=>{e.preventDefault();run(async()=>{await command({action:'clue',revision:clueRevision??state.editRevision,id:$('dsClueId').value||undefined,title:$('dsClueTitle').value,text:$('dsClueText').value,image:$('dsClueImage').value});$('dsClueForm').reset();$('dsClueEditor').open=false;clueRevision=null;});};
$('dsClueForm').oninput=()=>{if(clueRevision===null)clueRevision=state.editRevision;};
$('dsCancelClue').onclick=()=>{$('dsClueForm').reset();clueRevision=null;$('dsClueEditor').open=false;$('dsClueSaveHint').textContent='Novas pistas são salvas em segredo. Revele quando chegar a hora.';};
$('dsBind').onclick=()=>run(()=>shareCharacter(true));
$('dsUnbind').onclick=()=>run(async()=>{await command({action:'character',character:null});delete access.profileId;remember();lastCharacter='';apply(state);});
$('dsOpenCall').onclick=()=>{close();window.BreuStationRoom?.show();if(!window.BreuStationRoom?.hasCall())$('brJoin').click();};
$('dsExport').onclick=()=>{
 const data={format:'dark-campaign-archive-v1',exportedAt:new Date().toISOString(),name:state.name,session:state.session,clues:state.clues,sessions:state.sessions,members:state.members};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download='dark-campanha-'+state.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Arquivo exportado.');
};
window.DarkStation={active:()=>Boolean(access&&state),invite,close,
 async callAccess(name,userId){if(!access||!state)return null;const result=await api(access.id+'/call',{name,userId});await refresh().catch(()=>{});return result;}
};
notebook=window.createDarkNotebook({command,status,read:body=>api(access.id+'/notebook',body)});
document.addEventListener('input',e=>{if(!e.target.closest('#mainContainer'))return;clearTimeout(sheetTimer);sheetTimer=setTimeout(()=>{if(!writing)shareCharacter().catch(e=>status(e.message));},1500);});
setInterval(()=>{if(access&&!document.hidden&&!writing)shareCharacter().catch(e=>status(e.message));},12000);
window.addEventListener('online',()=>{status('Conexão voltou. Sincronizando…');schedule(0);});
window.addEventListener('offline',()=>{status('Sem internet. Não feche suas edições; elas ainda não foram enviadas.');});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&access)schedule(0);});
root.querySelectorAll('input,textarea,select').forEach(el=>{try{NON_PROFILE_CONTROL_IDS.add(el.id);}catch{}});
saved();status('Escolha sua campanha ou entre pelo convite do mestre.');
function incomingInvite(){
 const incoming=new URLSearchParams(location.hash.slice(1));if(!incoming.has('campanha'))return;
 if(access){show();status('Troque de campanha antes de abrir outro convite.');return;}
 show();$('dsJoinDetails').open=true;$('dsInviteInput').value=location.href;$('dsPlayerName').focus();
}
incomingInvite();window.addEventListener('hashchange',incomingInvite);
})();
