(()=>{'use strict';
const TYPES={arc:'Arco',session:'Sessão',scene:'Cena',npc:'Personagem / NPC',place:'Local',faction:'Facção',item:'Item',note:'Nota'};
const MARKS={arc:'AR',session:'SE',scene:'CE',npc:'PC',place:'LO',faction:'FA',item:'IT',note:'NT'};
const STATES={planned:'Em preparação',ready:'Pronto para jogar',done:'Concluído'};
const templates={arc:'# O que está em jogo\n\n# A ameaça\n\n# Desenvolvimento\n\n# Possíveis desfechos',session:'# Objetivo da sessão\n\n- [ ] Rever o encontro anterior\n- [ ] Preparar as cenas\n- [ ] Separar as pistas\n\n# Cenas previstas\n\n# Consequências e próximos passos',scene:'# Abertura\n\n# O que acontece\n\n# Descobertas possíveis\n\n# Escolhas e consequências',npc:'# Papel na história\n\n# Aparência e interpretação\n\n# Desejo\n\n# Segredo\n\n# Relações',place:'# Atmosfera\n\n# O que existe aqui\n\n# Quem frequenta\n\n# Segredos e pistas',faction:'# Objetivo\n\n# Recursos e influência\n\n# Integrantes\n\n# Aliados e rivais',item:'# Descrição\n\n# Origem\n\n# Função na história',note:''};
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
window.createDarkNotebook=function(host){
 let state=null,page=null,dirty=false,saving=false,loading=false,conflict=false,view='pages',reading=false,timer,searchTimer,searchEpoch=0,hits=null,epoch=0,stamp=0;
 const collapsed=new Set(),root=$('nbWorkspace');
 function drafts(){
  if(!state)return [];const prefix=`dark-notebook-draft:${state.id}:${state.memberId}:`,result=[];
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k?.startsWith(prefix))continue;const d=JSON.parse(localStorage.getItem(k));if(d?.page?.id&&typeof d.page.body==='string'&&Array.isArray(d.page.tags))result.push(d.page);}}catch{}return result;
 }
 const pages=()=>[...(state?.notebook||[]),...drafts().filter(d=>!state.notebook.some(p=>p.id===d.id))];
 const key=id=>`dark-notebook-draft:${state.id}:${state.memberId}:${id}`;
 const feedback=t=>{$('nbSaveStatus').textContent=t;};
 const saveDraft=()=>{if(!page)return;try{localStorage.setItem(key(page.id),JSON.stringify({page,at:Date.now()}));}catch{feedback('Sem espaço para o rascunho local. Salve na campanha antes de fechar.');}};
 function clearDraft(id){try{localStorage.removeItem(key(id));}catch{}}
 function update(next){
  if(!next||next.role!=='gm'){state=null;page=null;epoch++;root.hidden=true;return;}
  if(state?.id!==next.id||state?.memberId!==next.memberId){if(dirty)saveDraft();state=next;page=null;dirty=false;conflict=false;epoch++;searchEpoch++;hits=null;$('nbSearch').value='';$('nbFilter').value='';clearTimeout(timer);renderEmpty();}
  else state=next;
  renderTree();if(view==='plan')renderBoard();
  if(page&&!saving&&!loading){const fresh=pages().find(p=>p.id===page.id);if(fresh&&fresh.version>page.version){if(dirty){conflict=true;$('nbConflict').hidden=false;feedback('Outra versão disponível. Seu rascunho está preservado.');}else loadPage(page.id,true);}}
  if(page&&!dirty&&!saving&&!loading)renderRelations();
 }
 function renderEmpty(){ $('nbDocument').hidden=true;$('nbBoard').hidden=view!=='plan';$('nbEmpty').hidden=view==='plan'||Boolean(page);$('nbSeed').hidden=pages().length>0; }
 function filterPages(){
  const filter=$('nbFilter').value,q=norm($('nbSearch').value.trim());
  return pages().filter(p=>(filter==='trash'?p.trash:!p.trash)&&(!filter||['trash','favorite'].includes(filter)||p.type===filter)&&(filter!=='favorite'||p.favorite)&&(!q||(hits?hits.includes(p.id):norm([p.title,...p.tags].join(' ')).includes(q))));
 }
 function renderTree(){
  const list=$('nbTree');list.replaceChildren();const items=filterPages().sort((a,b)=>a.order-b.order||a.title.localeCompare(b.title));
  const flat=Boolean($('nbSearch').value||$('nbFilter').value),visited=new Set();
  const add=(p,depth)=>{
   if(visited.has(p.id))return;visited.add(p.id);const row=el('div',undefined,'nb-tree-row');row.style.setProperty('--depth',depth);
   const children=items.filter(c=>c.parent===p.id);if(children.length&&!flat){const fold=button(collapsed.has(p.id)?'›':'⌄',()=>{collapsed.has(p.id)?collapsed.delete(p.id):collapsed.add(p.id);renderTree();},'nb-fold');fold.setAttribute('aria-label',(collapsed.has(p.id)?'Expandir ':'Recolher ')+p.title);fold.setAttribute('aria-expanded',String(!collapsed.has(p.id)));row.append(fold);}
   const b=button('',()=>selectPage(p.id));b.dataset.nbPage=p.id;b.append(el('span',MARKS[p.type],'nb-type-mark'),document.createTextNode(p.title+(p.favorite?' ☆':'')));if(page?.id===p.id)b.setAttribute('aria-current','page');row.append(b);list.append(row);
   if(!flat&&!collapsed.has(p.id))children.forEach(c=>add(c,depth+1));
  };
  if(flat)items.forEach(p=>add(p,0));else items.filter(p=>!p.parent||!items.some(a=>a.id===p.parent)).forEach(p=>add(p,0));
  if(!items.length)list.append(el('p','Nenhuma página nesta seleção.','ds-muted'));
  $('nbCount').textContent=`${pages().filter(p=>!p.trash).length} páginas · só o mestre`;
 }
 function renderBoard(){
  const board=$('nbBoard');board.replaceChildren();const heading=el('div',undefined,'nb-board-heading');heading.append(el('h2','Da preparação à mesa'),el('p','Arcos, sessões e cenas. Abra uma página para mudar seu estado ou definir a data prevista.'));board.append(heading);
  const grid=el('div',undefined,'nb-board-grid'),items=filterPages().filter(p=>['arc','session','scene'].includes(p.type)&&!p.trash).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.order-b.order);
  for(const [status,label]of Object.entries(STATES)){
   const lane=el('section',undefined,'nb-lane'),group=items.filter(p=>p.status===status);lane.append(el('h3',`${label} · ${group.length}`));
   for(const p of group){const card=button(p.title,()=>selectPage(p.id),'nb-plan-card');card.append(el('small',`${TYPES[p.type]}${p.date?' · '+p.date.split('-').reverse().join('/'):''}`));const parent=pages().find(a=>a.id===p.parent);if(parent)card.append(el('small',parent.title));lane.append(card);}
   if(!group.length)lane.append(el('p','Nenhuma página aqui.','ds-muted'));grid.append(lane);
  }board.append(grid);
 }
 function switchView(next){view=next;$('nbViewPages').classList.toggle('active',view==='pages');$('nbViewPlan').classList.toggle('active',view==='plan');$('nbViewPages').setAttribute('aria-pressed',String(view==='pages'));$('nbViewPlan').setAttribute('aria-pressed',String(view==='plan'));$('nbBoard').hidden=view!=='plan';$('nbDocument').hidden=view!=='pages'||!page;$('nbEmpty').hidden=view!=='pages'||Boolean(page);if(view==='plan')renderBoard();}
 async function loadPage(id,external=false){
  const requestEpoch=++epoch,campaign=state.id;loading=true;documentBusy(true);feedback('Abrindo página…');
  try{const local=state.notebook.some(p=>p.id===id)?null:drafts().find(p=>p.id===id);const data=local?{page:local}:await host.read({id});if(requestEpoch!==epoch||state?.id!==campaign)return;
   page=structuredClone(data.page);dirty=false;conflict=false;
   if(!external){try{const draft=JSON.parse(localStorage.getItem(key(id)));if(draft?.page?.id===id){page=draft.page;dirty=true;conflict=page.version!==data.page.version;}}catch{}}
   documentBusy(false);fillDocument();switchView('pages');renderTree();feedback(dirty?'Rascunho recuperado neste navegador.':'Salvo na campanha');if(dirty&&!conflict)scheduleSave();
   if(!external&&(innerWidth<=800||$('dsStation').classList.contains('ds-compact')))$('nbDocument').scrollIntoView({block:'start',behavior:'auto'});
  }catch(e){feedback(e.message);host.status(e.message);}
  finally{if(requestEpoch===epoch){loading=false;documentBusy(false);if(page?.trash)fillDocument();}}
 }
 function documentBusy(busy){$('nbDocument').setAttribute('aria-busy',String(busy));$('nbDocument').querySelectorAll('input,textarea,select,button').forEach(e=>e.disabled=busy);}
 async function selectPage(id){if(loading)return;if(page?.id===id){switchView('pages');return;}if(dirty&&!await savePage())return;await loadPage(id);}
 function fillDocument(){
  $('nbEmpty').hidden=true;$('nbDocument').hidden=false;
  for(const [id,field]of [['nbTitle','title'],['nbBody','body'],['nbType','type'],['nbState','status'],['nbDate','date']])$(id).value=page[field]||'';
  $('nbTags').value=page.tags.join(', ');$('nbFavorite').textContent=page.favorite?'★':'☆';$('nbFavorite').setAttribute('aria-pressed',String(page.favorite));$('nbFavorite').classList.toggle('active',page.favorite);
  $('nbConflict').hidden=!conflict;$('nbPublicTitle').value=page.title.slice(0,100);$('nbPublicText').value='';$('nbPublicLocation').value='';$('nbPublicImage').value='';$('nbShare').open=false;
  renderRelations();renderBreadcrumb();
  $('nbArchive').textContent=page.trash?'Restaurar página':'Arquivar página';
  for(const id of ['nbTitle','nbBody','nbTags','nbDate'])$(id).readOnly=page.trash;
  for(const id of ['nbType','nbState','nbParent','nbFavorite','nbSave','nbChild','nbUp','nbDown','nbInsertLink'])$(id).disabled=page.trash;
  $('nbShare').hidden=page.trash;renderMode();
 }
 function descendants(id){const found=new Set([id]);let changed=true;while(changed){changed=false;for(const p of pages())if(found.has(p.parent)&&!found.has(p.id)){found.add(p.id);changed=true;}}return found;}
 function renderRelations(){
  if(!page)return;const excluded=descendants(page.id),parent=$('nbParent'),target=$('nbLinkTarget');parent.replaceChildren(new Option('Raiz da campanha',''));target.replaceChildren(new Option('Conectar a uma página…',''));
  for(const p of pages().filter(p=>!p.trash).sort((a,b)=>a.title.localeCompare(b.title))){if(!excluded.has(p.id))parent.add(new Option(p.title,p.id));if(p.id!==page.id)target.add(new Option(`${TYPES[p.type]} · ${p.title}`,p.id));}parent.value=page.parent;
  const links=[...page.body.matchAll(/\[\[([^\]\n]+)\]\]/g)].map(m=>resolveLink(m[1])).filter(Boolean);
  const outgoing=[...new Map(links.map(p=>[p.id,p])).values()],backlinks=pages().filter(p=>!p.trash&&p.links.includes(page.id));
  for(const [id,items]of [['nbOutgoing',outgoing],['nbBacklinks',backlinks]]){$(id).replaceChildren(...items.map(p=>button(p.title,()=>selectPage(p.id))));if(!items.length)$(id).append(el('p',id==='nbOutgoing'?'Conecte esta página a outras notas.':'Nenhuma menção recebida ainda.'));}
 }
 function renderBreadcrumb(){const chain=[],seen=new Set();let p=pages().find(p=>p.id===page.parent);while(p&&!seen.has(p.id)){seen.add(p.id);chain.unshift(p);p=pages().find(x=>x.id===p.parent);}const bar=$('nbBreadcrumb');bar.replaceChildren(el('span',state.name));for(const p of chain){bar.append(el('span','/'),button(p.title,()=>selectPage(p.id)));}bar.append(el('span','/ '+TYPES[page.type]));}
 function capture(){if(!page)return;page={...page,title:$('nbTitle').value,body:$('nbBody').value,type:$('nbType').value,status:$('nbState').value,date:$('nbDate').value,parent:$('nbParent').value,tags:$('nbTags').value.split(',').map(s=>s.trim()).filter(Boolean)};dirty=true;stamp++;saveDraft();feedback('Rascunho neste navegador · aguardando salvar');scheduleSave();}
 function scheduleSave(){clearTimeout(timer);if(!conflict)timer=setTimeout(()=>savePage(),1500);}
 async function savePage(){
  clearTimeout(timer);if(!dirty)return true;if(saving){feedback('Aguarde o salvamento em andamento.');return false;}if(conflict){feedback('Resolva a outra versão antes de continuar.');return false;}
  if(!page.title.trim()){feedback('Dê um título para salvar. O rascunho está neste navegador.');return false;}
  const snapshot=structuredClone(page),sentStamp=stamp,campaign=state.id;saving=true;feedback('Salvando na campanha…');
  try{
   const data=await host.command({...snapshot,action:'pageSave'});if(state?.id!==campaign||page?.id!==snapshot.id)return false;
   if(stamp===sentStamp){page=structuredClone(data.page);dirty=false;clearDraft(page.id);$('nbBody').value=page.body;feedback('Salvo na campanha');renderRelations();renderBreadcrumb();}
   else{page.version=data.page.version;saveDraft();feedback('Alterações recentes aguardando salvar');}
   renderTree();return !dirty;
  }catch(e){if(e.status===409){conflict=true;$('nbConflict').hidden=false;}feedback(e.status===409?'Conflito: seu rascunho foi mantido.':e.message+' Rascunho mantido neste navegador.');saveDraft();return false;}
  finally{saving=false;if(dirty&&!conflict&&stamp!==sentStamp)scheduleSave();}
 }
 async function createPage(parent=''){
  if(loading)return;
  if(dirty&&!await savePage())return;const type=$('nbNewType').value;
  page={id:crypto.randomUUID(),title:'Nova '+(TYPES[type]||'página'),type,parent,body:templates[type]||'',status:'planned',tags:[],links:[],date:'',order:pages().filter(p=>p.parent===parent).reduce((m,p)=>Math.max(m,p.order+1),0),favorite:false,trash:false,version:0};
  dirty=true;conflict=false;stamp++;saveDraft();fillDocument();switchView('pages');$('nbTitle').focus();$('nbTitle').select();feedback('Nova página · rascunho neste navegador');await savePage();
 }
 function resolveLink(raw){const [target]=raw.split('|');return pages().find(p=>!p.trash&&p.id===target)||pages().filter(p=>!p.trash&&norm(p.title)===norm(target)).length===1&&pages().find(p=>!p.trash&&norm(p.title)===norm(target));}
 function inline(parent,text){
  const re=/\[\[([^\]\n]+)\]\]/g;let pos=0;for(const m of text.matchAll(re)){parent.append(document.createTextNode(text.slice(pos,m.index)));const p=resolveLink(m[1]),label=m[1].split('|')[1]||p?.title||m[1];parent.append(p?button(label,()=>selectPage(p.id),'nb-link'):el('span',label,'nb-unresolved'));pos=m.index+m[0].length;}parent.append(document.createTextNode(text.slice(pos)));
 }
 function renderPreview(){
  const preview=$('nbPreview');preview.replaceChildren();page.body.split('\n').forEach((line,index)=>{
   const heading=line.match(/^(#{1,3})\s+(.+)/),check=line.match(/^- \[([ xX])\]\s*(.*)/);let n;
   if(heading){n=el(heading[1].length===1?'h3':'h4');inline(n,heading[2]);}
   else if(check){n=el('label',undefined,'nb-checkline');const box=el('input');box.type='checkbox';box.checked=check[1].toLowerCase()==='x';box.disabled=page.trash;box.onchange=()=>{const lines=page.body.split('\n');lines[index]=lines[index].replace(/^- \[[ xX]\]/,box.checked?'- [x]':'- [ ]');$('nbBody').value=lines.join('\n');capture();};const txt=el('span');inline(txt,check[2]);n.append(box,txt);}
   else if(line.startsWith('> ')){n=el('blockquote');inline(n,line.slice(2));}
   else{n=el('p');inline(n,line.startsWith('- ')?'• '+line.slice(2):line||'\u00a0');}preview.append(n);
  });
 }
 function renderMode(){$('nbEditor').hidden=reading;$('nbPreview').hidden=!reading;$('nbRead').textContent=reading?'Editar':'Leitura';if(reading)renderPreview();}
 function insert(value){const input=$('nbBody');input.focus();input.setRangeText(value,input.selectionStart,input.selectionEnd,'end');capture();}
 async function action(fn){try{await fn();}catch(e){feedback(e.message);host.status(e.message);}}
 function confirm(b,label,fn){const original=b.textContent;b.textContent=label;const again=()=>{b.textContent=original;b.onclick=()=>confirm(b,label,fn);};b.onclick=()=>{again();action(fn);};setTimeout(again,6500);}
 async function move(direction){if(dirty&&!await savePage())return;
  const result=await host.command({action:'pageMove',id:page.id,version:page.version,direction});page=result.page;renderTree();feedback('Ordem atualizada.');
 }
 async function exportBook(markdown){if(dirty&&!await savePage())return;const data=await host.read({export:true});let body=JSON.stringify(data,null,2),extension='json';if(markdown){extension='md';body='# '+data.campaign+'\n\n'+data.pages.map(p=>`## ${p.title}\n\nTipo: ${TYPES[p.type]} · ${STATES[p.status]}${p.trash?' · Arquivada':''}\nID: ${p.id}\n\n${p.body}\n\n---`).join('\n\n');}const url=URL.createObjectURL(new Blob([body],{type:markdown?'text/markdown':'application/json'})),a=el('a');a.href=url;a.download='dark-caderno.'+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('Cópia privada exportada.');}
 for(const id of ['nbTitle','nbBody','nbType','nbState','nbDate','nbTags','nbParent'])$(id).addEventListener('input',capture);
 $('nbNew').onclick=()=>action(()=>createPage());$('nbChild').onclick=()=>action(()=>createPage(page?.id||''));$('nbSave').onclick=savePage;
 $('nbRead').onclick=()=>{reading=!reading;renderMode();};$('nbViewPages').onclick=()=>switchView('pages');$('nbViewPlan').onclick=()=>switchView('plan');
 $('nbFavorite').onclick=()=>{page.favorite=!page.favorite;$('nbFavorite').textContent=page.favorite?'★':'☆';$('nbFavorite').classList.toggle('active',page.favorite);$('nbFavorite').setAttribute('aria-pressed',String(page.favorite));capture();};
 $('nbUp').onclick=()=>action(()=>move(-1));$('nbDown').onclick=()=>action(()=>move(1));
 $('nbInsertLink').onclick=()=>{const p=pages().find(p=>p.id===$('nbLinkTarget').value);if(p)insert(`[[${p.id}|${p.title}]]`);};
 root.querySelectorAll('[data-nb-insert]').forEach(b=>b.onclick=()=>insert({heading:'\n# ',check:'\n- [ ] ',quote:'\n> '}[b.dataset.nbInsert]));
 $('nbFilter').onchange=()=>{renderTree();if(view==='plan')renderBoard();};
 $('nbSearch').oninput=()=>{clearTimeout(searchTimer);hits=null;renderTree();const query=$('nbSearch').value.trim(),token=++searchEpoch;if(!query){if(view==='plan')renderBoard();return;}searchTimer=setTimeout(async()=>{try{const result=await host.read({search:query});if(token!==searchEpoch)return;hits=result.hits;renderTree();if(view==='plan')renderBoard();}catch(e){host.status(e.message);}},300);};
 $('nbSeed').onclick=()=>action(async()=>{await host.command({action:'pageSeed'});const first=pages()[0];if(first)await loadPage(first.id);});
 $('nbArchive').onclick=()=>confirm($('nbArchive'),page?.trash?'Confirmar restauração':'Confirmar arquivamento',async()=>{if(dirty&&!await savePage())return;const result=await host.command({action:page.trash?'pageRestore':'pageTrash',id:page.id,version:page.version});page=result.page;dirty=false;fillDocument();renderTree();feedback(page.trash?'Página arquivada.':'Página restaurada.');});
 $('nbConflictReload').onclick=()=>confirm($('nbConflictReload'),'Confirmar descarte do rascunho',async()=>{clearDraft(page.id);dirty=false;conflict=false;await loadPage(page.id,true);});
 $('nbConflictCopy').onclick=()=>action(async()=>{const previous=page.id;page={...page,id:crypto.randomUUID(),title:(page.title+' · cópia').slice(0,120),version:0,links:[]};conflict=false;dirty=true;stamp++;saveDraft();$('nbConflict').hidden=true;$('nbTitle').value=page.title;if(await savePage())clearDraft(previous);});
 $('nbExportJSON').onclick=()=>action(()=>exportBook(false));$('nbExportMD').onclick=()=>action(()=>exportBook(true));
 $('nbToScene').onclick=()=>confirm($('nbToScene'),'Confirmar cena para o grupo',async()=>{const title=$('nbPublicTitle').value.trim(),objective=$('nbPublicText').value;if(!title)throw Error('Dê um título público para a cena.');if(objective.length>2000)throw Error('A cena aceita até 2.000 caracteres. Reduza o trecho.');await host.command({action:'scene',title,objective,location:$('nbPublicLocation').value,image:$('nbPublicImage').value});feedback('Cena atualizada para o grupo. As anotações continuam privadas.');});
 $('nbToClue').onclick=()=>action(async()=>{const title=$('nbPublicTitle').value.trim();if(!title)throw Error('Dê um título público para a pista.');$('nbToClue').disabled=true;try{await host.command({action:'clue',title,text:$('nbPublicText').value,image:$('nbPublicImage').value});$('nbPublicText').value='';feedback('Pista preparada em segredo. Revele pela aba Pistas quando quiser.');}finally{$('nbToClue').disabled=false;}});
 window.addEventListener('online',()=>{if(dirty&&!conflict)savePage();});window.addEventListener('beforeunload',e=>{if(dirty){saveDraft();e.preventDefault();e.returnValue='';}});
 return {update,hasDraft:()=>dirty,flush:savePage};
};
})();
