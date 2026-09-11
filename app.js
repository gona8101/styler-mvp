
let ALL_PRODUCTS = [];
async function getProducts(){ if(ALL_PRODUCTS.length) return ALL_PRODUCTS; const r=await fetch('data/products.json'); ALL_PRODUCTS=await r.json(); return ALL_PRODUCTS; }
const money=n=>new Intl.NumberFormat('ko-KR').format(n)+'원';
function cardHTML(p){return `<a class="product-card" href="product.html?id=${encodeURIComponent(p.id)}"><div class="product-image ${p.gender==='MEN'?'men':''}"></div><div class="name">${p.name}</div><div class="price">${money(p.price)}</div><div class="meta">${(p.colors||[]).join(' · ')} · ${p.fit||''}</div></a>`;}
async function loadFeatured(){const ps=await getProducts();document.getElementById('featured').innerHTML=ps.slice(0,6).map(cardHTML).join('');}
async function loadProducts(){
  const ps=await getProducts(),q=new URLSearchParams(location.search),gender=q.get('gender'); let active=q.get('category')||'all';
  function render(){const list=ps.filter(p=>(!gender||p.gender===gender)&&(active==='all'||p.category===active));document.getElementById('productGrid').innerHTML=list.map(cardHTML).join('');document.getElementById('resultCount').textContent=`${list.length}개 상품`;}
  document.querySelectorAll('#filterChips button').forEach(btn=>{if(btn.dataset.filter===active){document.querySelectorAll('#filterChips button').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');}
  btn.onclick=()=>{active=btn.dataset.filter;document.querySelectorAll('#filterChips button').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');render();};});render();
}
async function loadProductDetail(){
  const ps=await getProducts(),id=new URLSearchParams(location.search).get('id')||ps[0].id,p=ps.find(x=>x.id===id)||ps[0];
  document.getElementById('detail').innerHTML=`<div class="detail-visual"></div><section class="detail-body"><div class="brand-mini">STYLER SELECT · ${p.id}</div><h1>${p.name}</h1><div class="price-big">${money(p.price)}</div><div class="option-title">COLOR</div><div class="option-row">${(p.colors||[]).map((x,i)=>`<button class="option ${i===0?'selected':''}">${x}</button>`).join('')}</div><div class="option-title">SIZE</div><div class="option-row">${(p.sizes||[]).map((x,i)=>`<button class="option ${i===0?'selected':''}">${x}</button>`).join('')}</div><div class="ai-reason"><strong>✦ Agent가 참고할 상품 특징</strong><br/>${p.agent_notes||''}</div></section>`;
  const sheet=document.getElementById('agentSheet');document.getElementById('contextProduct').textContent=p.name;document.getElementById('openAgent').onclick=()=>sheet.classList.remove('hidden');document.getElementById('closeAgent').onclick=()=>sheet.classList.add('hidden');sheet.onclick=e=>{if(e.target===sheet)sheet.classList.add('hidden');};
}
