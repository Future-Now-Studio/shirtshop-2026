// Final swatch policy: keep the garment-derived hex when it's close to the
// colour name (reliable, exact shade); otherwise the mapped WC image is wrong or
// generic, so trust the NAME and set the swatch to the name's canonical hex.
// This makes the colour picker honest everywhere while keeping accurate garment
// shades where the image mapping is good. Images themselves stay best-effort.
import { admin } from "./checks/_clients.mjs";

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
function nameHex(name){const n=(name||"").toLowerCase();for(const[k,h]of MAP)if(n.includes(k))return h;return null;}
function toRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}
function dist(a,b){const x=toRgb(a),y=toRgb(b);return Math.sqrt((x[0]-y[0])**2+(x[1]-y[1])**2+(x[2]-y[2])**2);}
const THRESH=80;

const products=await admin.from("products").select("id");
let kept=0,overridden=0,filled=0,unknown=0;
for(const p of products.data){
  const v=await admin.from("variants").select("id,hex,colors(name)").eq("product_id",p.id);
  for(const x of v.data){
    const nh=nameHex(x.colors?.name);
    if(!nh){unknown++;continue;}              // name not in map — leave derived/existing
    if(!x.hex){await admin.from("variants").update({hex:nh}).eq("id",x.id);filled++;continue;}
    if(dist(x.hex,nh)>THRESH){await admin.from("variants").update({hex:nh}).eq("id",x.id);overridden++;}
    else kept++;
  }
}
console.log(`Swatch finalisiert: ${kept} garment-genau behalten, ${overridden} auf Name-Hex korrigiert, ${filled} leere gefüllt, ${unknown} unbekannt (unverändert).`);
