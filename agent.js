import fs from 'node:fs';
import path from 'node:path';

const OPENAI_URL = 'https://api.openai.com/v1/responses';
const norm = v => String(v ?? '').toLowerCase().replace(/\s+/g, '');

function readProducts(){
  return JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','products.json'),'utf8'));
}

function normalizeGender(v=''){
  const x=norm(v);
  if(['women','woman','female','여성','여자'].includes(x)) return 'women';
  if(['men','man','male','남성','남자'].includes(x)) return 'men';
  return x;
}

function normalizeCategory(v=''){
  const x=norm(v);
  if(['재킷','자켓','jacket','블루종'].some(k=>x.includes(norm(k)))) return '재킷';
  if(['아우터','outer','outerwear'].some(k=>x.includes(norm(k)))) return '아우터';
  if(['상의','탑','top','셔츠','니트','티셔츠'].some(k=>x.includes(norm(k)))) return '상의';
  if(['팬츠','바지','하의','pants','bottom'].some(k=>x.includes(norm(k)))) return '팬츠';
  if(['신발','슈즈','shoes','로퍼','스니커즈','더비'].some(k=>x.includes(norm(k)))) return '신발';
  if(['가방','백','bag'].some(k=>x.includes(norm(k)))) return '가방';
  return x;
}

function inferMaxPrice(query='', explicit=null){
  if(explicit!=null && explicit!=='') return Number(explicit);
  const q=String(query).replace(/,/g,'');
  let m=q.match(/(\d+(?:\.\d+)?)\s*만원/);
  if(m) return Math.round(Number(m[1])*10000);
  m=q.match(/(\d{4,})\s*원/);
  if(m) return Number(m[1]);
  return null;
}

function inferColor(query='', explicit=''){
  if(explicit) return explicit;
  const q=norm(query);
  const colors=['브라운','갈색','블랙','검정','차콜','네이비','크림','아이보리','화이트','흰색','블루','그레이','회색','인디고'];
  return colors.find(c=>q.includes(norm(c)))||'';
}

function colorAliases(v=''){
  const x=norm(v);
  const groups={
    '브라운':['브라운','갈색','brown'],
    '블랙':['블랙','검정','black'],
    '화이트':['화이트','흰색','white'],
    '그레이':['그레이','회색','gray','grey']
  };
  for(const [k,vals] of Object.entries(groups)) if(vals.some(a=>x.includes(norm(a)))) return vals.map(norm);
  return [x];
}

function searchProducts(products,args={}){
  const {query='',category='',gender='',limit=6}=args;
  const maxPrice=inferMaxPrice(query,args.max_price);
  const wantedColor=inferColor(query,args.color||'');
  const qTokens=String(query).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').split(' ').map(norm).filter(Boolean)
    .filter(t=>!['이하','미만','이상','추천','찾아줘','보여줘','상품'].includes(t) && !/^\d+$/.test(t));
  const c=normalizeCategory(category||query);
  const g=normalizeGender(gender);
  const aliases=colorAliases(wantedColor);

  return products.map(p=>{
    const pg=normalizeGender(p.gender);
    if(g && pg!==g) return null;

    if(c){
      const pc=norm(`${p.category} ${p.subcategory} ${p.name}`);
      if(c==='재킷' && !['재킷','자켓','블루종'].some(k=>pc.includes(norm(k)))) return null;
      else if(c==='아우터' && !norm(p.category).includes('아우터')) return null;
      else if(c==='상의' && !norm(p.category).includes('상의')) return null;
      else if(c==='팬츠' && !['팬츠','하의','바지'].some(k=>pc.includes(norm(k)))) return null;
      else if(c==='신발' && !norm(p.category).includes('신발')) return null;
      else if(c==='가방' && !norm(p.category).includes('가방')) return null;
    }

    if(maxPrice!=null && Number(p.price)>maxPrice) return null;
    if(wantedColor){
      const productColors=(p.colors||[]).map(norm);
      if(!productColors.some(pc=>aliases.some(a=>pc.includes(a)||a.includes(pc)))) return null;
    }

    const hay=norm([p.name,p.gender,p.category,p.subcategory,...(p.colors||[]),...(p.style||[]),...(p.occasions||[]),p.fit,p.length,p.agent_notes].join(' '));
    let score=0;
    for(const t of qTokens) if(hay.includes(t)) score+=2;
    if(wantedColor) score+=4;
    if(c) score+=2;
    return {p,score};
  }).filter(Boolean).sort((a,b)=>b.score-a.score||a.p.price-b.p.price)
    .slice(0,Math.max(1,Math.min(Number(limit)||6,8))).map(x=>x.p);
}
function getProduct(products,args={}){ return products.find(p=>norm(p.id)===norm(args.id))||null; }

function findMatchingItems(products,args={}){
  const current=products.find(p=>norm(p.id)===norm(args.current_product_id));
  if(!current) return [];
  const owned=norm(args.owned_item||'');
  const exclude=new Set((args.exclude_categories||[]).map(norm));
  const prefs=[];
  const add=(arr,cat)=>(arr||[]).forEach(x=>prefs.push({term:norm(x),cat}));
  add(current.matches_tops,'상의'); add(current.matches_bottoms,'하의'); add(current.matches_shoes,'신발'); add(current.matches_bags,'가방'); add(current.matches_outer,'아우터');
  return products.filter(p=>p.id!==current.id&&p.gender===current.gender&&!exclude.has(norm(p.category))).map(p=>{
    const hay=norm([p.name,p.category,p.subcategory,...(p.colors||[]),...(p.style||[]),p.fit,p.agent_notes].join(' '));
    let score=0;
    for(const pref of prefs){ if(hay.includes(pref.term)) score+=4; if(norm(p.category).includes(pref.cat)) score+=1; }
    if((owned.includes('검정')||owned.includes('블랙')) && (p.colors||[]).some(x=>['화이트','크림','아이보리','브라운','차콜'].some(c=>norm(x).includes(norm(c))))) score+=2;
    if(owned.includes('와이드')&&norm(p.category)==='상의') score+=2;
    return {p,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.p.price-b.p.price).slice(0,Math.max(1,Math.min(Number(args.limit)||4,6))).map(x=>x.p);
}

const tools=[
  {type:'function',name:'search_products',description:'styler의 실제 상품 카탈로그에서 사용자의 조건에 맞는 상품을 검색한다. 상품 추천이 필요하면 반드시 사용한다.',parameters:{type:'object',properties:{query:{type:'string'},category:{type:'string'},gender:{type:'string'},max_price:{type:['number','null']},color:{type:'string'},limit:{type:'number'}},required:['query','category','gender','max_price','color','limit'],additionalProperties:false},strict:true},
  {type:'function',name:'get_product',description:'특정 상품의 상세 정보를 조회한다.',parameters:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},strict:true},
  {type:'function',name:'find_matching_items',description:'현재 상품과 사용자가 이미 가진 옷을 함께 고려해 코디를 완성할 실제 styler 상품을 찾는다.',parameters:{type:'object',properties:{current_product_id:{type:'string'},owned_item:{type:'string'},exclude_categories:{type:'array',items:{type:'string'}},limit:{type:'number'}},required:['current_product_id','owned_item','exclude_categories','limit'],additionalProperties:false},strict:true}
];

async function callOpenAI(body){
  const r=await fetch(OPENAI_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify(body)});
  const data=await r.json();
  if(!r.ok) throw new Error(data?.error?.message||'OpenAI API 오류');
  return data;
}

function extractText(resp){
  if(resp.output_text) return resp.output_text;
  const parts=[];
  for(const item of resp.output||[]) if(item.type==='message') for(const c of item.content||[]) if(c.type==='output_text'&&c.text) parts.push(c.text);
  return parts.join('\n');
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST만 지원합니다.'});
  if(!process.env.OPENAI_API_KEY) return res.status(500).json({error:'OPENAI_API_KEY가 설정되지 않았어요.'});
  try{
    const products=readProducts();
    const {message,currentProductId='',history=[]}=req.body||{};
    if(!message?.trim()) return res.status(400).json({error:'메시지를 입력해주세요.'});

    const system=`너는 패션 이커머스 styler의 Buyer-side AI Shopping Agent다.\n무조건 구매를 유도하지 말고 사용자의 구매 의사결정을 돕는다.\n존재하지 않는 상품/가격/색상/사이즈를 지어내지 않는다.\n상품 추천이 필요하면 반드시 제공된 도구로 실제 카탈로그를 검색한다.\n현재 보고 있는 상품 ID: ${currentProductId||'없음'}\n사용자가 이거/이 재킷이라고 하면 현재 상품을 의미할 수 있다.\n이미 가지고 있다고 말한 아이템은 다시 사라고 추천하지 않는다.\n한국어로 모바일에서 읽기 쉽게 3~6문장으로 답한다.`;
    const historyText=(history||[]).slice(-6).map(x=>`${x.role}: ${x.text}`).join('\n');
    let input=[{role:'system',content:system},{role:'user',content:historyText?`최근 대화:\n${historyText}\n\n새 메시지: ${message}`:message}];
    let response=await callOpenAI({model:'gpt-5.6-luna',input,tools,reasoning:{effort:'low'}});
    const recommended=new Map();

    for(let round=0;round<4;round++){
      const calls=(response.output||[]).filter(x=>x.type==='function_call');
      if(!calls.length) break;
      input.push(...response.output);
      for(const call of calls){
        let args={}; try{args=JSON.parse(call.arguments||'{}')}catch{}
        let result;
        if(call.name==='search_products') result=searchProducts(products,args);
        else if(call.name==='get_product') result=getProduct(products,args);
        else if(call.name==='find_matching_items') result=findMatchingItems(products,args);
        else result={error:'지원하지 않는 도구'};
        const arr=Array.isArray(result)?result:(result?[result]:[]); for(const p of arr) if(p?.id) recommended.set(p.id,p);
        input.push({type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)});
      }
      response=await callOpenAI({model:'gpt-5.6-luna',input,tools,reasoning:{effort:'low'}});
    }

    res.status(200).json({reply:extractText(response)||'조건에 맞는 상품을 확인했어요.',products:[...recommended.values()].slice(0,6)});
  }catch(e){
    console.error(e); res.status(500).json({error:e.message||'Agent 실행 중 오류가 발생했어요.'});
  }
}
