// For each product: how many DISTINCT garment-colour front images does the WC
// gallery actually provide, vs how many variation names? Tells us whether a
// correct name->image mapping is even possible, or if WC data is too poor.
import sharp from "sharp";
import { admin } from "./checks/_clients.mjs";

const WC_BASE = process.env.WC_BASE_URL;
const WC_AUTH = "Basic " + Buffer.from(`${process.env.WC_CONSUMER_KEY}:${process.env.WC_CONSUMER_SECRET}`).toString("base64");
async function wc(p){const r=await fetch(`${WC_BASE}${p}`,{headers:{Authorization:WC_AUTH}});if(!r.ok)throw new Error(`${p}:${r.status}`);return r.json();}
const fileOf=(u)=>u.split("/").pop();
function mapView(x){x=(x||"").toUpperCase();if(x==="F")return"front";if(x==="B")return"back";if(x==="SR"||x==="R")return"right";if(x==="SL"||x==="L"||x==="S")return"left";return null;}
function parseFile(f){if(!f)return{};let m=f.match(/^P([FBSLR])M\d*_/i);if(m)return{view:mapView(m[1]),code:(f.match(/_C(\w+?)(?:[-_.]|$)/)||[])[1]||null};m=f.match(/^\w+?_\w+?_(\w+?)_([A-Za-z]{1,2})[-_.]/);if(m)return{code:m[1],view:mapView(m[2])};return{};}

async function sample(url){
  try{const r=await fetch(url);if(!r.ok)return null;
    const{data}=await sharp(Buffer.from(await r.arrayBuffer())).resize(48,48,{fit:"fill"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let gr=0,gg=0,gb=0,gn=0;for(let y=13;y<35;y++)for(let x=13;x<35;x++){const i=(y*48+x)*3,R=data[i],G=data[i+1],B=data[i+2];if(!(R>235&&G>235&&B>235)){gr+=R;gg+=G;gb+=B;gn++;}}
    return gn>50?[Math.round(gr/gn),Math.round(gg/gn),Math.round(gb/gn)]:null;
  }catch{return null;}
}
function dist(a,b){return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2);}

const products=await wc(`/products?per_page=100&status=publish`);
for(const wp of products){
  // distinct coded fronts
  const fronts={};
  for(const img of wp.images||[]){const{code,view}=parseFile(fileOf(img.src));if(view==="front"&&code)fronts[code]??=img.src;}
  const codes=Object.keys(fronts);
  // sample & dedup by colour (Δ<25 = same garment colour)
  const colors=[];
  for(const c of codes){const s=await sample(fronts[c]);if(s&&!colors.some(k=>dist(k,s)<25))colors.push(s);}
  const variations=await wc(`/products/${wp.id}/variations?per_page=100`);
  const names=variations.map(v=>v.attributes?.find(a=>/farbe|color/i.test(a.name))?.option?.trim()).filter(Boolean);
  const flag = colors.length < names.length*0.7 ? "  ⚠ zu wenig distinkte Bilder" : "";
  console.log(`${wp.name.padEnd(28)} Namen:${String(names.length).padStart(3)}  coded-Fronts:${String(codes.length).padStart(3)}  distinkte-Farben:${String(colors.length).padStart(3)}${flag}`);
}
