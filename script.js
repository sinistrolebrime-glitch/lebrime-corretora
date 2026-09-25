const products = {
  auto:{title:'Seguro Auto e Moto',description:'Soluções para veículos particulares, utilitários, motos e diferentes perfis de utilização.',points:['Coberturas conforme o perfil e a contratação','Assistências disponíveis conforme o produto','Opções para veículos individuais e necessidades de frota'],msg:'Seguro Auto ou Moto'},
  empresarial:{title:'Seguro Empresarial',description:'Proteção para patrimônio, atividade e continuidade de empresas de diferentes portes e segmentos.',points:['Coberturas patrimoniais','Responsabilidade civil e riscos adicionais','Análise conforme atividade e exposição do negócio'],msg:'Seguro Empresarial'},
  garantia:{title:'Seguro Garantia',description:'Modalidades voltadas ao cumprimento de determinadas obrigações contratuais, judiciais e relacionadas a licitações.',points:['Garantia de participação em licitações','Garantia de execução contratual','Garantias judiciais e outras modalidades'],msg:'Seguro Garantia'},
  vida:{title:'Seguro de Vida',description:'Alternativas para proteção financeira individual, familiar ou vinculada a empresas.',points:['Planos individuais e coletivos','Coberturas definidas conforme contratação','Soluções para empresas e grupos'],msg:'Seguro de Vida'},
  saude:{title:'Seguro Saúde',description:'Opções de contratação para pessoas, famílias e empresas conforme elegibilidade e oferta disponível.',points:['Alternativas individuais/familiares quando disponíveis','Planos empresariais','Análise de rede e características do produto'],msg:'Seguro Saúde'},
  residencial:{title:'Seguro Residencial',description:'Coberturas e serviços para residências, considerando características do imóvel e necessidades do segurado.',points:['Coberturas patrimoniais','Responsabilidade civil conforme produto','Assistências residenciais quando contratadas'],msg:'Seguro Residencial'},
  transporte:{title:'Seguro Transporte',description:'Soluções voltadas à movimentação de mercadorias e operações logísticas.',points:['Análise de mercadorias e rotas','Coberturas conforme modalidade de transporte','Condições adequadas à operação do cliente'],msg:'Seguro Transporte'},
  agro:{title:'Seguro Agro',description:'Alternativas para riscos ligados ao agronegócio, conforme atividade e disponibilidade de produtos.',points:['Propriedades e estruturas','Máquinas e equipamentos, conforme produto','Soluções específicas para operações do agro'],msg:'Seguro Agro'},
  rc:{title:'Responsabilidade Civil',description:'Coberturas destinadas a determinadas responsabilidades de profissionais e empresas, conforme o produto contratado.',points:['RC Geral','RC Profissional em modalidades elegíveis','Limites e extensões definidos na contratação'],msg:'Seguro de Responsabilidade Civil'},
  obras:{title:'Riscos de Engenharia',description:'Soluções para obras civis, instalações, montagens e riscos relacionados à execução de projetos.',points:['Obras civis em construção','Instalação e montagem','Coberturas adicionais conforme o projeto'],msg:'Seguro de Riscos de Engenharia / Obras'},
  viagem:{title:'Seguro Viagem',description:'Coberturas e assistências para viagens nacionais ou internacionais, conforme plano contratado.',points:['Planos para diferentes destinos','Assistências conforme as condições do produto','Opções para lazer e negócios'],msg:'Seguro Viagem'},
  outros:{title:'Outros Ramos',description:'A Lebrime também pode avaliar necessidades específicas que não estejam destacadas nesta página.',points:['Riscos especiais','Soluções corporativas','Consulta a diferentes produtos e seguradoras'],msg:'outro ramo de seguro'}
};

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
function closeMenu(){
  nav?.classList.remove('open');
  menuToggle?.setAttribute('aria-expanded','false');
}
menuToggle?.addEventListener('click',()=>{
  if(!nav) return;
  const open = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded',String(open));
});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));

function scrollToSection(target){
  const header = document.querySelector('.header');
  const offset = (header?.getBoundingClientRect().height ?? 0) + 12;
  const top = window.scrollY + target.getBoundingClientRect().top - offset;
  window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
}
document.querySelectorAll('a[href^="#"]').forEach(link=>{
  link.addEventListener('click',event=>{
    const hash = link.getAttribute('href');
    if(!hash || hash.length < 2) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if(!target) return;
    event.preventDefault();
    closeMenu();
    if(window.location.hash !== hash) history.pushState(null,'',hash);
    scrollToSection(target);
  });
});
window.addEventListener('popstate',()=>{
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = id ? document.getElementById(id) : null;
  if(target) scrollToSection(target);
  else window.scrollTo({top:0,behavior:'smooth'});
});

const modal = document.getElementById('productModal');
const title = document.getElementById('modalTitle');
const description = document.getElementById('modalDescription');
const points = document.getElementById('modalPoints');
const whatsapp = document.getElementById('modalWhatsapp');

document.querySelectorAll('.product-card').forEach(card=>{
  card.addEventListener('click',()=>{
    const item = products[card.dataset.product];
    if(!item) return;
    title.textContent=item.title;
    description.textContent=item.description;
    points.innerHTML=item.points.map(p=>'<div>✓ '+p+'</div>').join('');
    const text=encodeURIComponent('Olá, gostaria de solicitar uma cotação de '+item.msg+' com a Lebrime.');
    whatsapp.href='https://wa.me/5586994801456?text='+text;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
  });
});
function closeModal(){
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}
document.querySelectorAll('[data-close-modal]').forEach(el=>el.addEventListener('click',closeModal));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});