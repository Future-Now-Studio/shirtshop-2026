// Assign honest, distinct swatch hex per colour from its NAME (WooCommerce has no
// hex). Keyword list is ordered specific → generic; first match wins.
import { admin } from "./checks/_clients.mjs";

const MAP = [
  // neutrals
  ["off white", "#efece2"], ["natural raw", "#e6dcc6"], ["natural", "#e9e1cf"], ["cream", "#efe6d1"],
  ["honey paper", "#e8dcc0"], ["weiß", "#f5f4ef"], ["white", "#f5f4ef"],
  ["used black", "#2c2c2c"], ["black denim", "#2b3340"], ["black", "#1b1b1b"], ["schwarz", "#1b1b1b"],
  ["anthracite", "#383b3d"], ["charcoal", "#36393b"], ["india ink", "#33373a"], ["dark grey", "#4a4a4a"],
  ["light graphite", "#6e6e6e"], ["urban grey", "#6b6b6b"], ["pacific grey", "#7c8487"], ["convoy grey", "#8a8d8f"],
  ["misty grey", "#b9b7b2"], ["pale grey", "#c7c7c9"], ["light oxford", "#c9cacf"], ["light blue", "#a9cfe5"],
  ["blue grey", "#6f87a0"], ["grey denim", "#56606e"], ["heather grey", "#a7a7a7"], ["mid heather", "#9a9a9a"],
  ["cool heather", "#b4b4b4"], ["sport grey", "#a7a7a7"], ["sport heather", "#a7a7a7"], ["eco heather", "#b0aa9e"],
  ["heather haze", "#cfc7bd"], ["misty jade", "#a9c7bd"], ["urban khaki", "#7c764f"], ["light", "#cfd2d6"],
  ["grau", "#8f8f8f"], ["grey", "#9a9a9a"], ["steel", "#7d8794"], ["stone blue", "#6f8196"], ["stone", "#b6ac99"],
  ["ash", "#c9c7c2"], ["mastic", "#d8cdb6"], ["desert dust", "#cbb89a"], ["sand", "#d6c3a0"], ["stargazer", "#4a5a6a"],
  // blue family
  ["french navy", "#20243d"], ["nautical navy", "#1f2a44"], ["urban navy", "#222c40"], ["navy", "#1f2a44"],
  ["indigo denim", "#34465f"], ["indigo", "#2b3a67"], ["cobalt", "#1b4fbf"], ["bright royal", "#2150c8"],
  ["royal", "#2150c8"], ["diva blue", "#1f6fd4"], ["bright blue", "#1f6fd4"], ["worker blue", "#34567a"],
  ["marine", "#2f6fb0"], ["mindful blue", "#3a6ea5"], ["mineral blue", "#5a8fb0"], ["dusty blue", "#7d9bb5"],
  ["duck egg", "#a8cdd4"], ["blue ice", "#bcd6e6"], ["alice blue", "#dceaf2"], ["sky", "#8cc6e8"],
  ["pool blue", "#2aa6c4"], ["swimming pool", "#1aa6c4"], ["caribbean", "#1aa6c4"], ["surf", "#1f9fc0"],
  ["aqua", "#3fc6cf"], ["atoll", "#1c9aa0"], ["amalfi teal", "#1c8a8a"], ["deep teal", "#13565f"],
  ["teal", "#1c8a8a"], ["ocean depth", "#14506a"], ["worker", "#34567a"], ["blue soul", "#3a4a6a"],
  ["cobalt blue", "#1b4fbf"], ["blue", "#2f6fb0"],
  // green family
  ["bottle green", "#0c3d2e"], ["moss", "#6b7a3b"], ["sage", "#9caf88"],
  ["faded olive", "#79743f"], ["olive", "#7d7a3a"], ["khaki", "#8a8150"], ["aloe", "#b5c9a0"],
  ["glazed green", "#3f7d4a"], ["verdant", "#2e7d32"], ["go green", "#3aa64a"], ["green bay", "#2e6e4e"],
  ["oasis", "#4aa37a"], ["orchid green", "#5a8a6a"], ["camouflage", "#5a6648"], ["kelly green", "#2e9e3a"],
  ["apple", "#7ac043"], ["pixel lime", "#a5cd3c"], ["lime", "#9bcb3c"], ["millennial mint", "#a9e0c8"],
  ["mint", "#9fe0c0"], ["nispero", "#9ab84a"], ["nanjaro", "#6a8f5a"], ["green", "#2e7d32"],
  // red / brown
  ["earthy red", "#9e463c"], ["fire red", "#cf2a2a"], ["classic red", "#c0392b"], ["sunset orange", "#e8602a"],
  ["red brown", "#7a3b2e"], ["heritage brown", "#5e3a2a"], ["worker brown", "#5e4533"], ["chocolate", "#4b2e22"],
  ["kaffa coffee", "#4a3528"], ["mocha", "#6b4a37"], ["toffee", "#9c6b43"], ["camel", "#b08d57"],
  ["latte", "#c4a884"], ["brown", "#6b4423"], ["red", "#c0392b"], ["rot", "#c0392b"], ["burgundy", "#5e1322"],
  ["deep plum", "#4a1f33"],
  // pink
  ["bubble gum", "#f0a3c0"], ["bubble pink", "#ef8fb5"], ["cotton pink", "#f1c0cf"], ["powder pink", "#f3cdda"],
  ["dusty rose", "#c98a98"], ["orchid pink", "#d98fb5"], ["pink joy", "#e8709e"], ["fraiche peche", "#f3b89a"],
  ["fraiche", "#f0c2cf"], ["peche", "#f0a878"], ["fuchsia", "#d6398e"], ["pink", "#e87fa5"],
  // purple
  ["radiant purple", "#7a3fae"], ["urban purple", "#5e3a7a"], ["purple love", "#7a4ea0"], ["millennial lilac", "#c9a8d6"],
  ["lilac dream", "#cbb0dd"], ["lilac", "#c3a6d6"], ["lavender", "#b9a7d8"], ["violet", "#7a4ea0"], ["purple", "#7a4ea0"],
  // yellow / orange
  ["solar yellow", "#f6c815"], ["soft yellow", "#f3dd7a"], ["lemon sorbet", "#f3e58a"], ["lemon", "#f1d41f"],
  ["butter", "#f3e0a0"], ["viva yellow", "#f6c815"], ["gold", "#d4af37"], ["ochre", "#cc8a2a"],
  ["urban orange", "#e8722a"], ["sunset", "#e8602a"], ["fiesta", "#e8542a"], ["apricot", "#f0a878"],
  ["sorbet", "#f0a878"], ["orange", "#e8722a"], ["yellow", "#f1c40f"],
  // misc
  ["dusk", "#6f7a90"], ["deep plum", "#4a1f33"], ["denim", "#3b4a5a"],
];

function guessHex(name) {
  const n = name.toLowerCase();
  for (const [kw, hex] of MAP) if (n.includes(kw)) return hex;
  return "#b3b3b3";
}

const colors = await admin.from("colors").select("id, name");
let n = 0;
for (const c of colors.data) {
  const { error } = await admin.from("colors").update({ hex: guessHex(c.name) }).eq("id", c.id);
  if (!error) n++;
}
console.log(`${n} Farben mit namensbasiertem Hex gesetzt.`);
