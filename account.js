(()=>{
'use strict';
window.createDarkAccount=({service,onChange,status})=>{
 const $=id=>document.getElementById(id),KEY='dark-account-session-v1';
 let session=null,enabled=false,ready=false,nonce='',busy=false;
 try{session=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{}
 if(!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(session?.token||''))session=null;
 async function request(op,body={}){
  const response=await fetch(service()+'/account/'+op,{method:'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.token}:{})},body:JSON.stringify(body),credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
  let data;try{data=await response.json();}catch{throw Error('Atualize o Worker para ativar as contas individuais.');}
  if(!response.ok){const error=Error(data.error||'Não foi possível acessar sua conta.');error.status=response.status;throw error;}return data;
 }
 function remember(){try{if(session)sessionStorage.setItem(KEY,JSON.stringify(session));else sessionStorage.removeItem(KEY);}catch{status('Seu acesso funciona nesta tela, mas não pôde ser guardado para recarga.');}}
 function render(){
  $('dsAccountName').textContent=session?'Olá, '+session.user.name:'Sua mesa começa com você';
  $('dsAccountHelp').textContent=session?'Crie suas campanhas ou participe das mesas dos seus amigos.':enabled?'Entre para criar mesas e encontrar suas campanhas em outros dispositivos.':'As contas individuais ainda não foram ativadas pelo responsável pelo site. Seus acessos antigos continuam disponíveis.';
  $('dsGoogleButton').hidden=Boolean(session)||!enabled;
  $('dsLogout').hidden=!session;
  $('dsAccountRefresh').hidden=!session;
  $('dsCreatePasswordRow').hidden=enabled||Boolean(session);
  $('dsCreatePassword').required=!enabled&&!session;
  $('dsCreateHint').textContent=session?'Você será mestre desta campanha. Convide os jogadores depois de criar.':enabled?'Entre com Google acima para criar sua própria campanha.':'Enquanto o login é configurado, a criação antiga usa a senha do responsável pelo site.';
  $('dsCreateSubmit').disabled=!ready||(enabled&&!session);
 }
 async function refresh(){
  if(!session)return;
  try{const data=await request('me');session.user=data.user;remember();render();onChange(data.campaigns);}
  catch(e){if(e.status===401){session=null;remember();render();onChange([]);}throw e;}
 }
 async function login(response){
  if(busy)return;busy=true;status('Entrando na sua conta…');
  try{session=await request('login',{credential:response.credential,nonce});remember();await refresh();status('Conta conectada. Escolha uma campanha ou crie sua mesa.');}
  catch(e){status(e.message);}finally{busy=false;}
 }
 async function init(){
  try{
   const config=await request('config');enabled=config.enabled;ready=true;render();
   try{await refresh();}catch(e){if(e.status!==401)throw e;status('Sua sessão expirou. Entre novamente para continuar.');}
   if(enabled){
    nonce=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
    if(!window.google?.accounts?.id)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>reject(Error('Não foi possível carregar o Google. Confira a conexão e tente novamente.'));document.head.append(script);});
    window.google.accounts.id.initialize({client_id:config.googleClientId,callback:login,nonce,auto_select:false});
    window.google.accounts.id.renderButton($('dsGoogleButton'),{theme:'filled_black',size:'large',shape:'pill',text:'continue_with',locale:'pt-BR'});
   }
  }catch(e){$('dsAccountHelp').textContent=e.message;status(e.message);}
 }
 $('dsLogout').onclick=async()=>{
  if(busy)return;busy=true;
  try{await request('logout');session=null;remember();window.google?.accounts?.id.disableAutoSelect();render();onChange([]);status('Você saiu da conta neste navegador.');}
  catch(e){if(e.status===401){session=null;remember();render();onChange([]);}status(e.message);}finally{busy=false;}
 };
 $('dsAccountRefresh').onclick=()=>refresh().catch(e=>status(e.message));
 render();init();
 return {token:()=>session?.token,user:()=>session?.user,enabled:()=>enabled,refresh};
};
})();
