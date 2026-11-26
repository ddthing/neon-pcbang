import { CHARACTER_SPEC, WORLD_SPEC } from "./renewal-layout.mjs";

const C = WORLD_SPEC.palette;
const shadow = "rgba(41,36,53,0.28)";
const leather = "#48374e";
const leatherLight = "#927388";
const metal = "#243043";
const metalLight = "#526578";
const denim = "#415269";
const skin = "#f1ba94";
const hair = "#593742";
const hairLight = "#955c55";
const jacket = "#577c72";
const jacketLight = "#a2bd87";
const stride = [[0, 0], [-2, 2], [-1, 1], [0, 0], [2, -2], [1, -1]];
const sideKeys = [[0, -2], [1, 0], [0, 2], [-1, 0]];

export function createSliceArt(ctx, px) {
  function box(x, y, w, h, color, edge = C.ink) {
    px(x, y, w, h, edge);
    if (w > 2 && h > 2) px(x + 1, y + 1, w - 2, h - 2, color);
  }

  // Rasterize at pixel centers so diagonal silhouettes never rely on Canvas antialiasing.
  function shape(color, points) {
    const minY = Math.min(...points.map(([, y]) => y));
    const maxY = Math.max(...points.map(([, y]) => y));
    for (let y = minY; y < maxY; y++) {
      const edges = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if (y + 0.5 < Math.min(ay, by) || y + 0.5 >= Math.max(ay, by)) continue;
        edges.push(ax + (bx - ax) * (y + 0.5 - ay) / (by - ay));
      }
      edges.sort((a, b) => a - b);
      for (let i = 0; i < edges.length; i += 2) {
        const left = Math.ceil(edges[i] - 0.5);
        const right = Math.ceil(edges[i + 1] - 0.5);
        px(left, y, right - left, 1, color);
      }
    }
  }

  function localShape(x, y, color, points, direction = 1) {
    shape(color, points.map(([dx, dy]) => [x + dx * direction, y + dy]));
  }

  function drawPlant(item, time, reduced) {
    const { x, y } = item.anchor;
    const sway = reduced ? 0 : Math.round(Math.sin(time * 1.35 + x));
    const paint = (color, points) => localShape(x, y, color, points);

    function pot(width, height, glaze, lip) {
      const r = width / 2;
      px(x - r - 1, y - 1, width + 2, 3, shadow);
      paint(C.ink, [[-r,-height],[r,-height],[r,-height+4],[r-3,0],[-r+3,0],[-r,-height+4]]);
      paint(glaze, [[-r+1,-height+3],[r-1,-height+3],[r-3,-1],[-r+3,-1]]);
      px(x - r + 1, y - height + 1, width - 2, 2, lip);
      px(x - r + 2, y - height, width - 4, 1, "#523842");
      px(x - r + 3, y - height + 5, 2, height - 7, lip);
    }

    function leaf(lx, ly, flip, light, dark) {
      localShape(lx, ly, "#304746", [[0,0],[2,-6],[7,-9],[10,-9],[11,-6],[9,-3],[6,-1]], flip);
      localShape(lx, ly, dark, [[1,-1],[3,-6],[7,-8],[10,-8],[10,-6],[8,-3],[5,-2]], flip);
      localShape(lx, ly, light, [[2,-2],[4,-6],[7,-7],[9,-7],[7,-5],[5,-4]], flip);
    }

    if (item.species === "broadleaf") {
      paint("#405850", [[-2,-11],[-3,-23],[-9,-29],[-7,-29],[-1,-23],[0,-36],[2,-36],[2,-20],[8,-27],[10,-27],[2,-16],[1,-11]]);
      leaf(x - 1, y - 23, -1, "#9fb185", "#5a816f");
      leaf(x + 1, y - 20, 1, "#afbf8d", "#659080");
      paint("#304746", [[0,-24],[-3+sway,-29],[-3+sway,-34],[sway,-38],[3+sway,-37],[5+sway,-34],[4+sway,-30]]);
      paint("#8baa78", [[0,-26],[-2+sway,-30],[-2+sway,-34],[sway,-37],[2+sway,-36],[3+sway,-33]]);
      leaf(x - 1, y - 15, -1, "#73a07e", "#466d61");
      pot(16, 13, "#a66159", "#d58a72");
    } else if (item.species === "pothos") {
      paint("#405850", [[-9,-7],[-10,-16],[-7,-24],[-4,-27],[5,-25],[9,-18],[9,-6],[7,-6],[7,-17],[2,-22],[-5,-23],[-8,-15],[-7,-7]]);
      leaf(x, y - 19, -1, "#a9bc82", "#648263");
      leaf(x, y - 17, 1, "#bec794", "#6b896c");
      pot(14, 12, "#75617e", "#ae91a2");
      paint("#7c9f75", [[-4,-19],[-2,-17],[-4,-13],[-7+sway,-11],[-8+sway,-6],[-10+sway,-7],[-9,-13]]);
      paint("#96ad77", [[6,-18],[8,-17],[6,-12],[8+sway,-9],[6+sway,-5],[4+sway,-6],[6,-9],[4,-12]]);
      px(x - 3, y - 23, 3, 1, "#cbd3a0");
    } else {
      pot(14, 9, "#52667f", "#8eafad");
      paint("#324d4e", [[-9,-14],[-6,-15],[-7,-18],[-3,-18],[-2,-22],[1,-22],[4,-18],[7,-19],[7,-16],[9,-15],[8,-12],[3,-9],[-4,-9],[-8,-11]]);
      paint("#5c8881", [[-8,-13],[-4,-14],[-6,-17],[-3,-17],[0,-12],[4,-16],[6,-16],[5,-13],[8,-14],[6,-11],[2,-10],[-4,-10]]);
      paint("#a6c899", [[-3,-18],[-1+sway,-21],[1+sway,-20],[3,-17],[2,-14],[0,-12],[-1,-16]]);
      px(x, y - 19, 1, 3, "#d4daae");
    }
  }

  function drawKiosk(item, mode, time, reduced) {
    const { x, y, width: w, height: h } = item.visualRect;
    const paint = (color, points) => localShape(x, y, color, points);
    px(x + 2, y + h - 2, w - 2, 2, shadow);
    paint(C.ink, [[6,23],[22,23],[21,34],[25,36],[25,40],[3,40],[3,36],[7,34]]);
    paint(metalLight, [[7,24],[17,24],[17,34],[22,36],[22,38],[5,38],[5,36],[8,34]]);
    px(x + 9, y + 27, 2, 9, "#7d8d98");
    paint(C.ink, [[4,0],[23,0],[27,4],[25,24],[22,27],[3,27],[0,23],[1,5]]);
    paint("#a08797", [[4,1],[22,1],[25,4],[23,22],[21,24],[3,24],[1,22],[2,6]]);
    paint(C.plum, [[24,5],[26,5],[24,24],[22,26],[4,26],[3,24],[22,23]]);
    box(x + 4, y + 4, 18, 16, "#304a59");
    px(x + 6, y + 6, 14, 1, C.aqua);
    if (mode === "confirmed") {
      paint("#a5d8a3", [[7,12],[9,10],[12,13],[17,8],[19,10],[12,17]]);
    } else {
      for (const dx of [7, 14]) {
        px(x + dx, y + 9, 4, 3, mode === "selecting" && dx === 7 ? C.gold : C.aqua);
        px(x + dx + 1, y + 12, 2, 3, C.blue);
      }
      px(x + 7, y + 17, 11, 1, C.milk);
    }
    px(x + 6, y + 21, 7, 1, C.ink);
    px(x + 17, y + 21, 2, 1, reduced || Math.floor(time * 2) % 2 === 0 ? C.milk : C.rust);
  }

  function screen(x, y, w, h, runtime, time, reduced) {
    px(x, y, w, h, runtime.bootStage === "on" ? "#235361" : "#202d40");
    if (runtime.bootStage === "off") {
      shape("#354558", [[x,y],[x+w-1,y],[x+1,y+h-2],[x,y+h-2]]);
      return;
    }
    if (runtime.bootStage === "booting") {
      const progress = Math.max(1, Math.floor((w - 2) * runtime.bootTimer));
      px(x + 1, y + 3, w - 2, 2, C.aqua);
      px(x + 1, y + Math.floor(h / 2) + 1, progress, 1, C.milk);
      return;
    }
    px(x + 1, y + 1, w - 2, 2, "#a0d1c9");
    px(x + 1, y + 5, Math.max(2, w - 4), 1, "#64a5a9");
    px(x + 1, y + 7, Math.max(1, w - 6), 1, "#81bfb4");
    if (reduced || Math.floor(time * 3) % 2 === 0) px(x + w - 3, y + h - 3, 2, 1, C.gold);
  }

  function tower(x, y, on) {
    box(x, y, 9, 13, metal);
    px(x + 1, y + 1, 7, 1, metalLight);
    px(x + 2, y + 3, 5, 1, "#181b2c");
    px(x + 2, y + 5, 1, 1, on ? C.aqua : "#a76c68");
    px(x + 4, y + 5, 3, 1, metalLight);
    px(x + 3, y + 8, 4, 1, "#3d4e64");
    px(x + 3, y + 10, 4, 1, "#3d4e64");
  }

  function drawDesk(seat, runtime, time, reduced) {
    const d = seat.deskRect;
    const m = seat.monitorRect;
    const k = seat.keyboardAnchor;
    const solo = seat.facing === "up";
    const right = seat.facing === "right";
    const on = runtime.bootStage !== "off";
    px(d.x + 2, d.y + d.height - 2, d.width, 4, shadow);
    box(d.x, d.y, d.width, d.height, "#ac756b");
    px(d.x + 2, d.y + 1, d.width - 4, 1, "#d0997e");
    px(d.x + 1, d.y + d.height - 5, d.width - 2, 1, "#d0967a");
    px(d.x + 1, d.y + d.height - 4, d.width - 2, 3, "#714858");
    px(d.x + 3, d.y + d.height - 2, 3, 2, "#4d3446");
    px(d.x + d.width - 6, d.y + d.height - 2, 3, 2, "#4d3446");
    for (const [dy, dx, tail] of [[7,4,6],[13,3,11],[18,8,4],[31,5,6],[40,8,9]]) {
      if (dy < d.height - 5) px(d.x + dx, d.y + dy, d.width - dx - tail, 1, "#ba8272");
    }
    if (solo) {
      tower(d.x + 1, d.y + 1, on);
      px(m.x + 10, m.y + m.height - 5, 6, 4, metal);
      px(m.x + 6, m.y + m.height - 2, 14, 2, C.ink);
      box(m.x, m.y, m.width, m.height - 5, metalLight);
      screen(m.x + 2, m.y + 2, m.width - 4, m.height - 9, runtime, time, reduced);
      px(m.x + m.width - 5, m.y + m.height - 7, 1, 1, on ? C.aqua : "#a76c68");
      box(k.x - 9, k.y - 3, 18, 6, metalLight);
      for (let key = -7; key <= 7; key += 2) px(k.x + key, k.y - 2, 1, 2, "#aab3b8");
      px(k.x - 4, k.y + 1, 8, 1, "#81939b");
      box(k.x + 11, k.y - 3, 8, 7, "#794d61", "#6d485a");
      box(k.x + 13, k.y - 2, 4, 5, "#c6b2aa");
    } else {
      tower(right ? d.x + d.width - 10 : d.x + 1, d.y + 2, on);
      const mx = right ? m.x : m.x + m.width;
      const dir = right ? 1 : -1;
      const paint = (color, points) => localShape(mx, m.y, color, points, dir);
      paint(C.ink, [[2,0],[14,3],[16,6],[16,15],[11,17],[11,20],[14,20],[14,22],[5,22],[5,20],[8,18],[8,16],[1,15],[0,12],[0,3]]);
      paint(metalLight, [[2,1],[12,3],[12,15],[4,15],[1,13],[1,3]]);
      paint(metal, [[12,4],[15,6],[15,14],[12,15]]);
      screen(right ? m.x + 2 : m.x + 5, m.y + 4, 9, 9, runtime, time, reduced);
      px(right ? m.x + 3 : m.x + 12, m.y + 14, 1, 1, on ? C.aqua : "#a76c68");
      const kbX = right ? k.x - 2 : k.x - 3;
      box(kbX, k.y - 7, 6, 14, metalLight);
      for (let dy = -5; dy <= 4; dy += 3) px(kbX + 1, k.y + dy, 4, 1, "#aab3b8");
      box(kbX, k.y + 8, 7, 6, "#794d61", "#6d485a");
      box(kbX + 1, k.y + 9, 4, 4, "#c6b2aa");
    }
  }

  function drawChairBase(seat) {
    const { x, y } = seat.cushionAnchor;
    const solo = seat.facing === "up";
    const dir = seat.facing === "left" ? -1 : 1;
    const paint = (color, points) => localShape(x, y, color, points, dir);
    px(x - 9, y + 5, 18, 3, shadow);
    paint(C.ink, [[-2,1],[2,1],[3,4],[8,5],[8,7],[3,6],[1,8],[-2,8],[-3,6],[-8,7],[-8,5],[-3,4]]);
    px(x - 1, y + 3, 2, 3, metalLight);
    paint(C.ink, [[-6,-7],[6,-7],[9,-4],[9,2],[6,4],[-6,4],[-8,2],[-8,-4]]);
    paint(leather, [[-6,-6],[6,-6],[8,-4],[8,1],[5,3],[-5,3],[-7,1],[-7,-4]]);
    paint("#75576d", [[-5,-5],[5,-5],[7,-3],[7,0],[5,1],[-5,1],[-6,0],[-6,-3]]);
    if (solo) {
      px(x - 9, y - 5, 3, 6, C.ink);
      px(x + 6, y - 5, 3, 6, C.ink);
      px(x - 9, y - 5, 3, 2, metalLight);
      px(x + 6, y - 5, 3, 2, metalLight);
    }
  }

  function drawBackrest(seat) {
    const { x, y } = seat.cushionAnchor;
    if (seat.facing === "up") {
      localShape(x, y, C.ink, [[-6,-4],[6,-4],[8,-2],[8,4],[6,7],[-6,7],[-8,4],[-8,-2]]);
      localShape(x, y, leather, [[-6,-3],[6,-3],[7,-2],[7,4],[5,6],[-5,6],[-7,4],[-7,-2]]);
      px(x - 5, y - 2, 10, 1, leatherLight);
      px(x - 4, y, 8, 1, "#644960");
      px(x - 3, y + 4, 6, 1, "#342d42");
    } else {
      const dir = seat.facing === "right" ? 1 : -1;
      localShape(x, y, C.ink, [[-9,-12],[-6,-12],[-4,-10],[-4,-2],[-2,1],[-2,5],[-6,5],[-9,1],[-10,-3]], dir);
      localShape(x, y, leather, [[-9,-11],[-6,-11],[-5,-10],[-5,-2],[-3,1],[-3,4],[-6,4],[-8,1]], dir);
      localShape(x, y, leatherLight, [[-9,-10],[-7,-10],[-6,-8],[-6,-3],[-7,-3]], dir);
      box(dir > 0 ? x - 3 : x - 4, y + 1, 7, 3, metalLight);
    }
  }

  function drawTray(seat) {
    const { x, y, width: w, height: h } = seat.trayAnchor;
    box(x, y, w, h, "#b67e65", "#644353");
    px(x + 1, y + h - 2, w - 2, 1, "#d79a75");
    localShape(x + 1, y + 2, C.ink, [[1,0],[5,0],[6,1],[6,4],[4,5],[2,5],[0,3],[0,1]]);
    px(x + 2, y + 3, 5, 2, C.gold);
    px(x + 3, y + 5, 3, 1, C.milk);
    px(x + 4, y + 3, 1, 1, "#87684d");
    box(x + w - 5, y + 2, 4, 5, "#79a7a9");
    px(x + w - 3, y + 1, 1, 3, C.milk);
  }

  function head(x, y, facing) {
    const side = facing === "left" || facing === "right";
    const dir = facing === "left" ? -1 : 1;
    const paint = (color, points) => localShape(x, y, color, points, dir);
    paint(C.ink, [[-5,0],[4,0],[7,2],[8,4],[8,10],[6,13],[3,15],[-4,15],[-7,12],[-8,9],[-8,4]]);
    paint(hair, [[-5,1],[4,1],[6,3],[7,5],[6,11],[3,14],[-4,14],[-6,11],[-7,8],[-7,4]]);
    paint(hairLight, [[-5,2],[3,2],[5,3],[4,5],[0,4],[-3,6],[-6,6],[-6,4]]);
    if (facing !== "up") {
      if (side) {
        paint(skin, [[1,6],[4,4],[6,6],[7,8],[7,11],[4,13],[1,13],[0,11]]);
        paint(C.ink, [[4,7],[5,7],[5,9],[4,9]]);
        paint("#d68d7e", [[4,10],[6,10],[6,11],[4,11]]);
      } else {
        paint(skin, [[-6,7],[-3,7],[-1,5],[2,6],[5,5],[6,8],[6,11],[3,14],[-3,14],[-6,11]]);
        px(x - 4, y + 8, 1, 2, C.ink);
        px(x + 3, y + 8, 1, 2, C.ink);
        px(x - 5, y + 11, 2, 1, "#d68d7e");
        px(x + 3, y + 11, 2, 1, "#d68d7e");
      }
    } else {
      paint("#77494a", [[-5,7],[5,6],[6,9],[4,12],[-3,13],[-5,11]]);
    }
    paint("#517e77", [[-7,4],[-5,2],[3,1],[6,3],[6,4],[2,3],[-4,4],[-6,6]]);
    if (side) {
      box(dir > 0 ? x - 5 : x + 1, y + 6, 4, 6, "#8abaae");
    } else {
      px(x - 8, y + 6, 2, 5, "#8abaae");
      px(x + 6, y + 6, 2, 5, "#8abaae");
    }
  }

  function drawCharacter(p, seat) {
    const progress = seat ? Math.round(p.sitProgress * (CHARACTER_SPEC.sitFrames - 1)) / (CHARACTER_SPEC.sitFrames - 1) : 0;
    const seated = progress === 1;
    const origin = p.mode === "stand-up" ? seat?.standPoint : seat?.approachPoint;
    const x = Math.round(seat ? origin.x + (seat.cushionAnchor.x - origin.x) * progress : p.x);
    const y = Math.round(seat ? origin.y + (seat.cushionAnchor.y - origin.y) * progress : p.y);
    const phase = Math.floor(p.walkDistance / 5) % CHARACTER_SPEC.walkFramesPerDirection;
    const [near, far] = p.mode === "walk" ? stride[phase] : [0, 0];
    const side = p.facing === "left" || p.facing === "right";
    const dir = p.facing === "left" ? -1 : 1;
    const crown = y - CHARACTER_SPEC.standingHeight + Math.round(progress * 7) - (p.mode === "walk" && phase % 3 === 1 ? 1 : 0);
    const shoulder = crown + 15;
    const paint = (color, points) => localShape(x, shoulder, color, points, dir);

    if (!seated) {
      px(x - 5, y - 1, 10, 3, shadow);
      for (const [i, step] of [far, near].entries()) {
        const lx = x + (side ? (step * dir + i - 2) : (i * 5 - 5));
        const ly = y - 10 + (side ? 0 : step);
        box(lx, ly, 4, 10, i === 0 ? "#384459" : denim);
        px(lx + (side && dir < 0 ? -1 : 1), ly + 8, 4, 2, i === 0 ? "#b5a1a1" : "#e2c5aa");
      }
    } else if (side) {
      paint(C.ink, [[0,4],[8,3],[10,4],[10,8],[9,10],[6,10],[6,7],[0,8]]);
      paint(denim, [[1,5],[8,4],[9,5],[8,8],[7,8],[7,6],[1,7]]);
    }

    paint(C.ink, [[-4,-2],[3,-2],[6,0],[7,5],[5,9],[-5,9],[-7,6],[-7,2]]);
    paint(jacket, [[-4,-1],[3,-1],[5,1],[6,5],[4,8],[-4,8],[-6,5],[-6,2]]);
    paint(jacketLight, [[-4,0],[4,0],[3,3],[0,4],[-4,2]]);
    if (p.facing === "down") {
      px(x - 1, shoulder + 1, 2, 3, C.milk);
      px(x - 3, shoulder + 6, 6, 1, "#789781");
    }
    if (seated) {
      const k = seat.keyboardAnchor;
      const typing = Math.floor(p.typingClock * 7) % CHARACTER_SPEC.typingFrames;
      if (side) {
        const [keyX, keyY] = sideKeys[typing];
        const reachX = k.x + keyX * dir;
        const reachY = k.y + keyY;
        shape(C.ink, [[x+2*dir,shoulder+1],[x+6*dir,shoulder+2],[x+9*dir,shoulder+5],[reachX,reachY-1],[reachX+2*dir,reachY],[reachX+2*dir,reachY+2],[x+9*dir,shoulder+9],[x+5*dir,shoulder+8],[x+2*dir,shoulder+5]]);
        shape(jacketLight, [[x+3*dir,shoulder+2],[x+5*dir,shoulder+3],[x+9*dir,shoulder+6],[reachX,reachY],[reachX,reachY+2],[x+9*dir,shoulder+8],[x+5*dir,shoulder+7],[x+3*dir,shoulder+4]]);
        px(reachX + (dir < 0 ? -2 : 0), reachY, 3, 2, skin);
      } else {
        for (const [i, dx] of [-5, 5].entries()) {
          const handX = k.x + (i === 0 ? -5 : 1) + (typing === 3 && i === 0 ? 1 : 0);
          const handY = k.y + (typing === i * 2 ? -2 : 0);
          shape(C.ink, [[x+dx-2,shoulder+4],[x+dx+2,shoulder+4],[handX+2,handY],[handX-2,handY]]);
          shape(i === 0 ? jacketLight : jacket, [[x+dx-1,shoulder+3],[x+dx+1,shoulder+3],[handX+1,handY+1],[handX-1,handY+1]]);
          px(handX - 1, handY - 1, 3, 2, skin);
        }
      }
    } else {
      const lean = Math.round(progress * 5);
      const armX = x + (side ? (lean - 2) * dir : -7);
      const armY = shoulder + 3 + Math.round(far / 2) - lean;
      px(armX, armY, 3, 5, jacketLight);
      px(armX + 1, armY + 4, 2, 2, skin);
      if (!side) px(x + 5, shoulder + 6 + Math.round(near / 2), 2, 2, skin);
    }
    head(x, crown, p.facing);
  }

  return { drawPlant, drawKiosk, drawDesk, drawChairBase, drawBackrest, drawTray, drawCharacter };
}
