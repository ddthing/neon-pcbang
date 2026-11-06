// Rebuild the occlusion masks and screen shapes when the hall painting or room atlas changes.
// Run from the repository root: node scripts/calibrate-cafe-art.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const hallFile = "public/corner-hall-timber.webp";
const roomFile = "public/pcbang-rooms-pastel.webp";
const width = 1536, height = 1024;
const pixels = (file) => sharp(file).removeAlpha().raw().toBuffer();
const [hall, rooms] = await Promise.all([pixels(hallFile), pixels(roomFile)]);
const rgb = (image, x, y) => image.subarray((y * width + x) * 3, (y * width + x) * 3 + 3);
const rectangle = (l, t, r, b) => [[l,t],[r,t],[r,b],[l,b]];
function inside(x, y, polygon) {
  let within = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = polygon[i], [c, d] = polygon[j];
    if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) within = !within;
  }
  return within;
}
const hallGlass = [[250,313],[318,392],[397,461],[467,543],[551,616],[622,687],[693,756],
  [762,832],[837,901],[906,968],[974,1035],[1041,1160],[1165,1221],[1227,1285]]
  .map(([left,right]) => rectangle(left,42,right,131));
const roomGlass = {
  solo: [[[0,8],[91,27],[91,285],[0,337]], [[113,34],[177,48],[177,239],[113,274]]],
  duo: [[[0,3],[64,17],[64,232],[0,267]], [[83,25],[160,42],[160,201],[83,246]],
    ...[[219,299],[309,437],[449,535],[541,610],[627,680]].map(([l,r])=>rectangle(l,0,r,17))],
  team: [[[0,22],[55,44],[55,215],[0,246]], [[71,48],[101,59],[101,187],[71,204]]],
  squad: [[[0,10],[68,35],[68,223],[0,259]], [[83,41],[111,50],[111,194],[83,213]]],
};
const offsets = { solo: [0,0], duo: [768,0], team: [0,512], squad: [768,512] };
const hallPlants = [[232,36,295,113],[242,109,285,148],[466,106,514,151],
  [772,106,821,151],[1021,107,1073,151],[1241,36,1300,114],[1246,108,1298,150]];
const roomPlants = { solo: [[0,209,104,340]], duo: [[0,201,103,273]],
  team: [[0,230,55,256]], squad: [[0,203,78,260]] };
const lamps = [355,548,789,965,1157].map((x) => [x-24,40,x+25,75]);
const inBox = (x,y,[l,t,r,b]) => x>=l && y>=t && x<r && y<b;

// Within the foreground bounds, source colors separate leaves, petals, and warm glass
// pendants from the blue city. Keep their dark pixel outlines and one antialiased edge.
function maskWindows(image, mask, polygons, plants, fixtures = [], ox = 0, oy = 0) {
  const isForeground = (x,y) => {
    const plant = plants.some((box) => inBox(x,y,box));
    const light = fixtures.some((box) => inBox(x,y,box));
    if (!plant && !light) return false;
    const [r,g,b] = rgb(image,x+ox,y+oy);
    const leaf = plant && r>b+5 && g-b>Math.max(3,r-g+1);
    const petal = image===rooms && plant &&
      ((r>g+7 && b>g+5) || (r>178 && g>151 && r>g+3 && g>b+4));
    const outline = r>=b-1 && r+g+b<172;
    return leaf || petal || outline || (light && r>b+5);
  };
  for (const poly of polygons) {
    const xs = poly.map(([x])=>x), ys = poly.map(([,y])=>y);
    const left=Math.min(...xs), top=Math.min(...ys);
    const w=Math.max(...xs)-left, h=Math.max(...ys)-top;
    const pane=new Uint8Array(w*h);
    for (let y=0; y<h; y++) for (let x=0; x<w; x++) {
      const px=x+left, py=y+top;
      if (!inside(px+.5,py+.5,poly)) continue;
      pane[x+y*w] = isForeground(px,py) || isForeground(px-1,py) || isForeground(px+1,py) ||
        isForeground(px,py-1) || isForeground(px,py+1) ? 1 : 255;
    }
    // Baked city lamps can be as warm as the leaves. Remove disconnected
    // specks inside each glass pane without filling any real plant silhouette.
    for (let i=0; i<pane.length; i++) {
      if (pane[i]!==1) continue;
      const group=[i];
      pane[i]=2;
      for (let j=0; j<group.length; j++) {
        const n=group[j], x=n%w;
        for (const k of [x>0?n-1:-1,x<w-1?n+1:-1,n-w,n+w]) {
          if(pane[k]===1) { pane[k]=2; group.push(k); }
        }
      }
      if(group.length<45) for(const k of group) pane[k]=255;
    }
    for (let y=0;y<h;y++) for (let x=0;x<w;x++) {
      if(pane[x+y*w]===255) mask[x+left+ox+(y+top+oy)*width]=255;
    }
  }
}
const writeMask = async (file, data, w, h) => {
  const rgba = Buffer.alloc(w*h*4,255);
  for (let i=0; i<data.length; i++) rgba[i*4+3]=data[i];
  await sharp(rgba,{raw:{width:w,height:h,channels:4}}).png({palette:true,colors:2}).toFile(file);
};
const hallMask = Buffer.alloc(width*height);
const roomMask = Buffer.alloc(width*height);
maskWindows(hall,hallMask,hallGlass,hallPlants,lamps);
for (const [name,[ox,oy]] of Object.entries(offsets)) {
  maskWindows(rooms,roomMask,roomGlass[name],roomPlants[name],[],ox,oy);
}
await Promise.all([
  writeMask("public/cafe-glass-hall.png",hallMask,width,height),
  writeMask("public/cafe-glass-rooms.png",roomMask,width,height),
]);

const rows = [196,244,291,338,386,434,481,529,577,626,675];
const hallSeeds = [[428,491],[651,714],[892,955],[1133,1196]]
  .flatMap((pair)=>rows.flatMap((y)=>pair.map((x)=>[x,y,19,14])));
const baySeeds = {
  solo: [[149,244,20,12]], duo: [[108,434,19,12],[168,434,19,12]],
  team: [148,204,260,317,373].map(y=>[1447,y,21,12]),
  squad: [562,650,736].flatMap(y=>[[1367,y,21,12],[1448,y,21,12]]),
};
const roomSeeds = {
  solo: [[408,199,88,48]],
  duo: [[283,208,75,42],[502,208,75,42]],
  team: [170,290,410,530,650].map(x=>[x,207,44,29]),
  squad: [
    ...[252,414,575].map(x=>[x,116,58,30]),
    ...[219,410,598].map(x=>[x,253,67,39]),
  ],
};

// Find the inner panel row by row from the bounded source pixels, rather than
// fitting every monitor to the same CSS rectangle. The perimeter has room for
// the dim painted bezel, and can follow the little left/right screen variations.
function panel(image, [cx,cy,rx,ry], ox,oy, material) {
  const get = (x,y) => rgb(image,x+ox,y+oy);
  const glass = ([r,g,b]) => material === "mini" ? r>=64 && b>=r-8 && g>=r-8 :
    material === "hall" ? r>=87 && b>=r-8 && g>=r-11 : r>=87 && b>=r-22 && g>=r-30;
  const bands = [];
  for (let y=cy-ry; y<=cy+ry; y++) {
    const hits = [];
    for (let x=cx-rx; x<=cx+rx; x++) if (glass(get(x,y))) hits.push(x);
    if (hits.length >= rx*1.15) bands.push([y,hits[0],hits.at(-1)+1]);
  }
  const solid = bands.filter(([y])=>Math.abs(y-cy)<=2);
  if (!solid.length) throw Error("Uncalibrated panel "+[cx,cy,ox,oy,material]);
  const first = bands.findIndex(([y])=>y===solid[0][0]);
  let a=first, b=first;
  while(a>0 && bands[a][0]-bands[a-1][0]===1) a--;
  while(b+1<bands.length && bands[b+1][0]-bands[b][0]===1) b++;
  const screen = bands.slice(a,b+1);
  const median = (ns) => ns.toSorted((x,y)=>x-y)[Math.floor(ns.length/2)];
  const left = median(screen.map(([,x])=>x)), right = median(screen.map(([, ,x])=>x));
  // Soft reflections on a glass panel can have the same color as the frame.
  // Bound isolated hits to the screen's predominant edges.
  const trace = screen.map(([y,l,r])=>[y,Math.max(left-1,Math.min(left+1,l)),Math.max(right-1,Math.min(right+1,r))]);
  const top=trace[0][0], bottom=trace.at(-1)[0]+1;
  const edge = (row, i) => [row[i],row[0]];
  const points = [
    ...trace.filter((row,i)=>!i||trace[i-1][1]!==row[1]).flatMap((row,i,all)=>
      i ? [[all[i-1][1],row[0]],edge(row,1)] : [edge(row,1)]),
    [trace.at(-1)[1],bottom],[trace.at(-1)[2],bottom],
    ...trace.toReversed().filter((row,i)=>i===0||trace[trace.length-i][2]!==row[2])
      .slice(1).flatMap((row)=>[[trace[row[0]-top+1][2],row[0]+1],[row[2],row[0]+1]]),
    edge(trace[0],2),
  ];
  return points;
}
const geometry = {hall: hallSeeds.map(seed=>panel(hall,seed,0,0,"hall"))};
for(const [name,seeds] of Object.entries(baySeeds)) {
  geometry["hall-"+name]=seeds.map(seed=>panel(hall,seed,0,0,"mini"));
}
for(const [name,seeds] of Object.entries(roomSeeds)) {
  geometry[name]=seeds.map(seed=>panel(rooms,seed,...offsets[name],"room"));
}
await writeFile("public/cafe-screen-shapes.js",
  "// Source-pixel coordinates generated by scripts/calibrate-cafe-art.mjs.\nconst cafeScreenShapes = " +
  JSON.stringify(geometry,null,0).replaceAll('],"','],\n"') + ";\n");
