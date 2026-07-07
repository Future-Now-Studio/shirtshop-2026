// Improved name->image matching. Two upgrades over reimport-colormatch:
//   1. Lock variants whose colour NAME appears in a gallery filename (high conf).
//   2. For the rest, assign globally by SMALLEST name-expected↔image-colour
//      distance first (not in name order) — avoids the greedy mis-pairings that
//      made "Black" grab a light-blue image because a closer name took black first.
// Products with <2 distinct front colours are left as-is (WC has no real data).
// Re-derive hex afterwards with derive-variant-hex.mjs.
import sharp from "sharp";
import { admin } from "./checks/_clients.mjs";

const WC_BASE = process.env.WC_BASE_URL;
const WC_AUTH = "Basic " + Buffer.from(`${process.env.WC_CONSUMER_KEY}:${process.env.WC_CONSUMER_SECRET}`).toString("base64");
async function wc(p){const r=await fetch(`${WC_BASE}${p}`,{headers:{Authorization:WC_AUTH}});if(!r.ok)throw new Error(`${p}:${r.status}`);return r.json();}

const MAP = [
  ["off white","#efece2"],["natural raw","#e6dcc6"],["natural","#e9e1cf"],["cream","#efe6d1"],["weiß","#f5f4ef"],["white","#f5f4ef"],
  ["used black","#2c2c2c"],["black denim","#2b3340"],["black","#1b1b1b"],["schwarz","#1b1b1b"],["anthracite","#383b3d"],["charcoal","#36393b"],
  ["india ink","#33373a"],["dark grey","#4a4a4a"],["light graphite","#6e6e6e"],["convoy grey","#8a8d8f"],["pacific grey","#7c8487"],
  ["heather grey","#a7a7a7"],["mid heather","#9a9a9a"],["cool heather","#b4b4b4"],["sport grey","#a7a7a7"],["sport heather","#a7a7a7"],
  ["misty grey","#b9b7b2"],["pale grey","#c7c7c9"],["light oxford","#c9cacf"],["blue grey","#6f87a0"],["grey denim","#56606e"],
  ["grau","#8f8f8f"],["grey","#9a9a9a"],["ash","#c9c7c2"],["steel","#7d8794"],["stone blue","#6f8196"],["stone","#b6ac99"],
  ["sand","#d6c3a0"],["desert dust","#cbb89a"],["mastic","#d8cdb6"],["french navy","#20243d"],["nautical navy","#1f2a44"],
  ["urban navy","#222c40"],["navy","#1f2a44"],["indigo denim","#34465f"],["indigo","#2b3a67"],["cobalt","#1b4fbf"],
  ["bright royal","#2150c8"],["royal","#2150c8"],["diva blue","#1f6fd4"],["bright blue","#1f6fd4"],["worker blue","#34567a"],
  ["marine","#2f6fb0"],["mindful blue","#3a6ea5"],["mineral blue","#5a8fb0"],["dusty blue","#7d9bb5"],["duck egg","#a8cdd4"],
  ["blue ice","#bcd6e6"],["alice blue","#dceaf2"],["sky","#8cc6e8"],["pool blue","#2aa6c4"],["swimming pool","#1aa6c4"],
  ["caribbean","#1aa6c4"],["surf","#1f9fc0"],["aqua","#3fc6cf"],["atoll","#1c9aa0"],["amalfi teal","#1c8a8a"],["deep teal","#13565f"],
  ["teal","#1c8a8a"],["ocean depth","#14506a"],["blue soul","#3a4a6a"],["blue","#2f6fb0"],
  ["bottle green","#0c3d2e"],["moss","#6b7a3b"],["sage","#9caf88"],["faded olive","#79743f"],["olive","#7d7a3a"],
  ["khaki","#8a8150"],["urban khaki","#7c764f"],["aloe","#b5c9a0"],["glazed green","#3f7d4a"],["verdant","#2e7d32"],
  ["go green","#3aa64a"],["green bay","#2e6e4e"],["oasis","#4aa37a"],["camouflage","#5a6648"],["kelly green","#2e9e3a"],
  ["apple","#7ac043"],["pixel lime","#a5cd3c"],["lime","#9bcb3c"],["millennial mint","#a9e0c8"],["mint","#9fe0c0"],["green","#2e7d32"],
  ["earthy red","#9e463c"],["fire red","#cf2a2a"],["classic red","#c0392b"],["red brown","#7a3b2e"],["heritage brown","#5e3a2a"],
  ["worker brown","#5e4533"],["chocolate","#4b2e22"],["kaffa coffee","#4a3528"],["mocha","#6b4a37"],["toffee","#9c6b43"],
  ["camel","#b08d57"],["latte","#c4a884"],["brown","#6b4423"],["red","#c0392b"],["rot","#c0392b"],["burgundy","#5e1322"],["deep plum","#4a1f33"],
  ["bubble gum","#f0a3c0"],["bubble pink","#ef8fb5"],["cotton pink","#f1c0cf"],["powder pink","#f3cdda"],["dusty rose","#c98a98"],
  ["orchid pink","#d98fb5"],["pink joy","#e8709e"],["fraiche peche","#f3b89a"],["fraiche","#f0c2cf"],["peche","#f0a878"],
  ["fuchsia","#d6398e"],["pink","#e87fa5"],["radiant purple","#7a3fae"],["urban purple","#5e3a7a"],["purple love","#7a4ea0"],
  ["millennial lilac","#c9a8d6"],["lilac dream","#cbb0dd"],["lilac","#c3a6d6"],["lavender","#b9a7d8"],["violet","#7a4ea0"],["purple","#7a4ea0"],
  ["solar yellow","#f6c815"],["soft yellow","#f3dd7a"],["lemon sorbet","#f3e58a"],["lemon","#f1d41f"],["butter","#f3e0a0"],
  ["viva yellow","#f6c815"],["gold","#d4af37"],["ochre","#cc8a2a"],["urban orange","#e8722a"],["sunset","#e8602a"],["fiesta","#e8542a"],
  ["apricot","#f0a878"],["sorbet","#f0a878"],["orange","#e8722a"],["yellow","#f1c40f"],["dusk","#6f7a90"],["denim","#3b4a5a"],
];
function expected(name){const n=(name||"").toLowerCase();for(const[k,h]of MAP)if(n.includes(k))return hexToRgb(h);return[140,140,140];}
function hexToRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function dist(a,b){return (a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;}

function nameFromFile(f){const base=f.replace(/\.[a-z0-9]+$/i,"");const m=base.match(/^[A-Za-z]+\d+_(.+)$/);if(!m)return null;let s=m[1].replace(/-?ca\.?-?pantone.*$/i,"").replace(/-\d+[a-z]?$/i,"").replace(/[-_]+/g," ").trim();return s?s.toLowerCase():null;}
function norm(s){return String(s).toLowerCase().replace(/[^a-z0-9]/g,"");}
function mapView(x){x=(x||"").toUpperCase();if(x==="F")return"front";if(x==="B")return"back";if(x==="SR"||x==="R")return"right";if(x==="SL"||x==="L"||x==="S")return"left";return null;}
function parseFile(f){if(!f)return{};let m=f.match(/^P([FBSLR])M\d*_/i);if(m)return{view:mapView(m[1]),code:(f.match(/_C(\w+?)(?:[-_.]|$)/)||[])[1]||null};m=f.match(/^\w+?_\w+?_(\w+?)_([A-Za-z]{1,2})[-_.]/);if(m)return{code:m[1],view:mapView(m[2])};return{};}
const fileOf=(u)=>u.split("/").pop();

async function sampleGarment(url){
  try{const r=await fetch(url);if(!r.ok)return null;
    const{data}=await sharp(Buffer.from(await r.arrayBuffer())).resize(48,48,{fit:"fill"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let gr=0,gg=0,gb=0,gn=0,ar=0,ag=0,ab=0,an=0;
    for(let y=13;y<35;y++)for(let x=13;x<35;x++){const i=(y*48+x)*3,R=data[i],G=data[i+1],B=data[i+2];ar+=R;ag+=G;ab+=B;an++;if(!(R>235&&G>235&&B>235)){gr+=R;gg+=G;gb+=B;gn++;}}
    return gn>an*0.12?[gr/gn,gg/gn,gb/gn]:[ar/an,ag/an,ab/an];
  }catch{return null;}
}
async function upload(productId,variantId,view,url){
  try{const r=await fetch(url);if(!r.ok)return false;const buf=new Uint8Array(await r.arrayBuffer());
    const ext=(url.split(".").pop()||"jpg").split("?")[0].toLowerCase().slice(0,4);
    const path=`${productId}/${variantId}/${view}.${ext}`;
    const{error}=await admin.storage.from("product-images").upload(path,buf,{contentType:r.headers.get("content-type")||"image/jpeg",upsert:true});
    if(error)return false;
    await admin.from("variant_images").upsert({variant_id:variantId,view,storage_path:path},{onConflict:"variant_id,view"});
    return true;
  }catch{return false;}
}

const EXTRA=["back","left","right"];
const products=await wc(`/products?per_page=100&status=publish`);
let grandImgs=0;

for(const wp of products){
  const dbp=await admin.from("products").select("id").eq("slug",wp.slug).single();
  if(dbp.error)continue;
  const productId=dbp.data.id;

  const byCode={};const generic={};const namedFront={};
  for(const img of wp.images||[]){
    const file=fileOf(img.src);const{code,view}=parseFile(file);const nm=nameFromFile(file);
    if(nm&&!namedFront[norm(nm)])namedFront[norm(nm)]=img.src;
    if(!view)continue;if(code)((byCode[code]??={})[view]??=img.src);if(view!=="front"&&(code==="000"||!generic[view]))generic[view]=img.src;
  }
  // sample coded fronts
  const codeColor={};
  for(const[code,views]of Object.entries(byCode)){if(!views.front)continue;const c=await sampleGarment(views.front);if(c)codeColor[code]=c;}
  const codes=Object.keys(codeColor);
  const haveNamed=Object.keys(namedFront).length>0;

  const variants=await admin.from("variants").select("id, colors(name)").eq("product_id",productId);
  if(variants.error||!variants.data.length){console.log(`- ${wp.name}: keine DB-Varianten`);continue;}

  // distinct colours among coded fronts (skip products with too little data)
  const distinct=[];for(const c of codes){const k=codeColor[c];if(!distinct.some(d=>dist(d,k)<600))distinct.push(k);}
  if(!haveNamed && distinct.length<2){console.log(`- ${wp.name}: nur ${distinct.length} distinkte Bilder — übersprungen (WC-Daten fehlen)`);continue;}

  // ---- assignment ----
  const assignedCode={};      // variantId -> code
  const assignedNamedUrl={};  // variantId -> url (named-file lock)
  const usedCode=new Set();

  // 1) lock by name-in-filename
  for(const v of variants.data){
    const cname=v.colors?.name?.trim();const direct=cname?namedFront[norm(cname)]:null;
    if(direct)assignedNamedUrl[v.id]=direct;
  }
  // 2) distance-sorted global greedy over remaining variants × codes
  const remaining=variants.data.filter(v=>!assignedNamedUrl[v.id]);
  const pairs=[];
  for(const v of remaining){const exp=expected(v.colors?.name?.trim());for(const code of codes)pairs.push([dist(exp,codeColor[code]),v.id,code]);}
  pairs.sort((a,b)=>a[0]-b[0]);
  const doneV=new Set();
  for(const[,vid,code]of pairs){
    if(doneV.has(vid)||usedCode.has(code))continue;
    assignedCode[vid]=code;doneV.add(vid);usedCode.add(code);
  }
  // leftover variants (more names than codes) reuse nearest code (allow dup)
  for(const v of remaining){
    if(assignedCode[v.id]||assignedNamedUrl[v.id])continue;
    const exp=expected(v.colors?.name?.trim());let best=null,bd=Infinity;
    for(const code of codes){const d=dist(exp,codeColor[code]);if(d<bd){bd=d;best=code;}}
    if(best)assignedCode[v.id]=best;
  }

  // ---- apply ----
  let imgs=0,named=0;
  for(const v of variants.data){
    if(assignedNamedUrl[v.id]){if(await upload(productId,v.id,"front",assignedNamedUrl[v.id])){imgs++;named++;}continue;}
    const code=assignedCode[v.id];const views=code?byCode[code]:null;if(!views)continue;
    if(views.front&&await upload(productId,v.id,"front",views.front))imgs++;
    for(const view of EXTRA){const u=views[view]||generic[view];if(u&&await upload(productId,v.id,view,u))imgs++;}
  }
  grandImgs+=imgs;
  console.log(`✓ ${wp.name}: ${imgs} Bilder (${named} per Name, ${codes.length} Codes, ${distinct.length} distinkt)`);
}
console.log(`\nFertig: ${grandImgs} Bilder neu zugeordnet (distanz-optimiert).`);
