import { BUILDINGS, TH, TW } from './data';
import type { Building, Game, Unit } from './game';
import { RANKS, SPECS } from './meta';
import type { March } from './towns';
import { TOOL_OF } from './game';
import { hash2, ValueNoise } from './rng';
import { mk, personSprite, type Cv } from './sprites';
import type { Obj } from './worldgen';

let markCv: Cv | null = null;
function getMark(): Cv {
  if (markCv) return markCv;
  const c = mk(11, 12);
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a4a1a';
  g.fillRect(0, 0, 11, 10);
  g.fillStyle = '#fff2c8';
  g.fillRect(1, 1, 9, 8);
  g.fillStyle = '#7a4a1a';
  g.fillRect(4, 10, 3, 1);
  g.fillRect(5, 11, 1, 1);
  g.fillStyle = '#7a5230';
  [
    [3, 7],
    [4, 6],
    [5, 5],
    [6, 4],
    [7, 3],
  ].forEach(([x, y]) => g.fillRect(x, y, 1, 1));
  g.fillStyle = '#a8aebc';
  g.fillRect(6, 2, 3, 2);
  g.fillStyle = '#e8ecf4';
  g.fillRect(8, 3, 1, 1);
  markCv = c;
  return c;
}

let clouds: Cv[] | null = null;
function getClouds(): Cv[] {
  if (clouds) return clouds;
  clouds = [];
  for (let k = 0; k < 4; k++) {
    const n = new ValueNoise(100 + k * 7);
    const c = mk(72, 36);
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(8,16,40,0.14)';
    for (let y = 0; y < 36; y++)
      for (let x = 0; x < 72; x++) {
        const dx = (x - 36) / 36;
        const dy = (y - 18) / 18;
        const v = n.fbm(x / 9, y / 7, 3) - (dx * dx + dy * dy) * 0.55;
        if (v > 0.32) g.fillRect(x, y, 1, 1);
      }
    clouds.push(c);
  }
  return clouds;
}

let nightCv: Cv | null = null;

function drawObj(ctx: CanvasRenderingContext2D, g: Game, o: Obj, dt: number) {
  const s = g.spr[o.spr];
  let dx = Math.round((o.tx + 0.5) * TW - s.width / 2);
  const dy = Math.round((o.ty + 0.9) * TH - s.height);
  if (o.shake > 0) {
    dx += Math.round(Math.sin(o.shake * 70));
    o.shake -= dt;
  }
  ctx.drawImage(s, dx, dy);
  if (o.marked) {
    const m = getMark();
    ctx.drawImage(m, Math.round((o.tx + 0.5) * TW - 5), dy - 10 + Math.round(Math.sin(g.waterT * 4 + o.tx) * 1));
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, u: Unit) {
  const fx = u.x * TW;
  const fy = u.y * TH;
  let alpha = 1;
  if (u.spawn > 0) {
    if (u.spawn > 0.9) return;
    const k = u.spawn / 0.9;
    const inten = Math.sin((1 - k) * Math.PI);
    ctx.globalAlpha = inten * 0.55;
    ctx.fillStyle = '#fff6c0';
    ctx.fillRect(Math.round(fx - 5), Math.round(fy - 70), 10, 70);
    ctx.globalAlpha = inten * 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(fx - 2), Math.round(fy - 70), 4, 70);
    ctx.globalAlpha = inten * 0.7;
    ctx.fillStyle = '#ffe27a';
    const rr = 5 + (1 - k) * 8;
    ctx.fillRect(Math.round(fx - rr), Math.round(fy - 1), Math.round(rr * 2), 2);
    ctx.globalAlpha = 1;
    if (k > 0.55) return;
    alpha = (0.55 - k) / 0.55;
  }
  if (u.sel) {
    ctx.fillStyle = '#7dff8c';
    const rx = u.child ? 6 : 8;
    for (let a = 0; a < 28; a++) {
      const t = (a / 28) * Math.PI * 2;
      ctx.fillRect(Math.round(fx + Math.cos(t) * rx), Math.round(fy + Math.sin(t) * rx * 0.42), 1, 1);
    }
  }
  let frame = 0;
  let dir = u.dir;
  let tool = 0;
  const working = (u.task.type === 'chop' || u.task.type === 'gather' || u.task.type === 'mine' || u.task.type === 'build') && u.phase === 'work';
  if (u.moving) frame = [1, 0, 2, 0][Math.floor(u.anim) & 3];
  else if (working) {
    dir = u.fx;
    frame = u.swing % 1 < 0.5 ? 3 : 4;
    tool = TOOL_OF[u.task.type] ?? 0;
  }
  const spr = personSprite(u.look, dir, frame, tool, u.child);
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, Math.round(fx - 8), Math.round(fy - 19));
  ctx.globalAlpha = 1;
  if (u.carry.n > 0) {
    const top = Math.round(fy - (u.child ? 15 : 22));
    const cx = Math.round(fx);
    if (u.carry.type === 'wood') {
      ctx.fillStyle = '#241408';
      ctx.fillRect(cx - 4, top - 1, 8, 4);
      ctx.fillStyle = '#8a5e36';
      ctx.fillRect(cx - 3, top, 6, 1);
      ctx.fillStyle = '#6a4524';
      ctx.fillRect(cx - 3, top + 1, 6, 1);
      ctx.fillStyle = '#d8aa72';
      ctx.fillRect(cx + 3, top, 1, 2);
    } else if (u.carry.type === 'stone') {
      ctx.fillStyle = '#252830';
      ctx.fillRect(cx - 3, top - 1, 6, 4);
      ctx.fillStyle = '#959cae';
      ctx.fillRect(cx - 2, top, 4, 2);
      ctx.fillStyle = '#c0c6d4';
      ctx.fillRect(cx - 2, top, 2, 1);
    } else {
      ctx.fillStyle = '#4a2e18';
      ctx.fillRect(cx - 3, top, 6, 3);
      ctx.fillStyle = '#c81e34';
      ctx.fillRect(cx - 2, top - 1, 1, 1);
      ctx.fillRect(cx, top - 1, 2, 1);
      ctx.fillStyle = '#ff8696';
      ctx.fillRect(cx - 2, top - 1, 1, 1);
    }
  }
}

function outlineRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
}

function drawBuilding(ctx: CanvasRenderingContext2D, g: Game, b: Building) {
  const s = g.bspr.cv[b.type];
  const dx = Math.round(b.x * TW + (b.w * TW) / 2 - s.width / 2);
  const dy = Math.round((b.y + b.h) * TH - s.height);
  if (b.done) {
    ctx.drawImage(s, dx, dy);
    const fire = g.bspr.fire[b.type];
    if (fire) {
      const f = g.flames;
      const t = Math.floor(g.waterT * 9);
      const fxx = dx + fire.x;
      const fyy = dy + fire.y;
      if (b.type === 'camp') {
        ctx.drawImage(f[(t + 1) & 3], fxx - 9, fyy - 8);
        ctx.drawImage(f[(t + 2) & 3], fxx + 0, fyy - 7);
        ctx.drawImage(f[t & 3], fxx - 5, fyy - 14);
      } else {
        ctx.drawImage(f[(t + b.id) & 3], fxx - 5, fyy - 12);
      }
    }
  } else {
    const p = Math.max(0.04, b.progress);
    ctx.globalAlpha = 0.3;
    ctx.drawImage(s, dx, dy);
    ctx.globalAlpha = 1;
    const sh = s.height;
    const part = Math.max(1, Math.round(sh * p));
    ctx.drawImage(s, 0, sh - part, s.width, part, dx, dy + sh - part, s.width, part);
    // строительные леса
    const x0 = b.x * TW;
    const y1 = (b.y + b.h) * TH;
    ctx.fillStyle = '#8a6238';
    for (const px of [x0 + 1, x0 + b.w * TW - 2]) ctx.fillRect(px, y1 - 14, 1, 14);
    ctx.fillStyle = '#c89a64';
    ctx.fillRect(x0 + 1, y1 - 14, b.w * TW - 2, 1);
    // полоса прогресса
    const bw = Math.max(16, b.w * TW - 4);
    const bx = Math.round(b.x * TW + (b.w * TW) / 2 - bw / 2);
    const by = dy - 5;
    ctx.fillStyle = '#12121a';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = '#3a3a48';
    ctx.fillRect(bx, by, bw, 3);
    ctx.fillStyle = '#7dff8c';
    ctx.fillRect(bx, by, Math.round(bw * b.progress), 3);
    ctx.fillStyle = '#c8ffd0';
    ctx.fillRect(bx, by, Math.round(bw * b.progress), 1);
  }
  if (g.selBuilding === b.id) outlineRect(ctx, b.x * TW - 1, b.y * TH - 1, b.w * TW + 2, b.h * TH + 2, '#7dff8c');
}

function drawMarch(ctx: CanvasRenderingContext2D, g: Game, m: March) {
  const k = Math.min(1, m.t / m.dur);
  const x0 = (m.sx + 0.5) * TW;
  const y0 = (m.sy + 0.7) * TH;
  const x1 = (m.tx + 0.5) * TW;
  const y1 = (m.ty + 0.7) * TH;
  const px = x0 + (x1 - x0) * k;
  const py = y0 + (y1 - y0) * k;
  const col = m.incoming ? '#ff6a5a' : '#ffe27a';
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = col;
  const len = Math.hypot(x1 - x0, y1 - y0);
  for (let d = 0; d < len; d += 9) {
    const f = d / len;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * f), Math.round(y0 + (y1 - y0) * f), 2, 1);
  }
  ctx.globalAlpha = 1;
  const dir = x1 >= x0 ? 2 : 3;
  const frame = [1, 0, 2, 0][Math.floor(g.waterT * 6) & 3];
  if (m.sea) {
    const bx = Math.round(px - 8);
    const by = Math.round(py - 10 + Math.sin(g.waterT * 3) * 0.8);
    ctx.fillStyle = '#4a2e18';
    ctx.fillRect(bx, by + 6, 16, 3);
    ctx.fillRect(bx + 2, by + 9, 12, 1);
    ctx.fillStyle = '#8a5e36';
    ctx.fillRect(bx, by + 6, 16, 1);
    ctx.fillStyle = '#6a4524';
    ctx.fillRect(bx + 7, by - 6, 1, 12);
    ctx.fillStyle = '#f4ecd8';
    ctx.fillRect(bx + 8, by - 5, 6, 8);
    ctx.fillStyle = col;
    ctx.fillRect(bx + 8, by - 7, 4, 2);
    return;
  }
  const cloth = m.incoming ? 2 : 3;
  const look = { skin: 1, hair: 0, cloth, female: false };
  const offs = [
    [0, 0],
    [-6, 2],
    [5, 3],
  ];
  offs.sort((a, b) => a[1] - b[1]);
  for (const [ox, oy] of offs) ctx.drawImage(personSprite(look, dir, frame, 0, false), Math.round(px + ox - 8), Math.round(py + oy - 19));
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(Math.round(px) - 1, Math.round(py) - 34, 1, 16);
  ctx.fillStyle = col;
  ctx.fillRect(Math.round(px), Math.round(py) - 34, 6, 4);
  ctx.fillStyle = '#1a0e06';
  ctx.fillRect(Math.round(px), Math.round(py) - 30, 6, 1);
}

function label(ctx: CanvasRenderingContext2D, x: number, y: number, title: string, sub: string, col: string, fs: number) {
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.font = `600 ${fs}px "Pixelify Sans", ui-monospace, monospace`;
  ctx.lineWidth = Math.max(3, fs * 0.28);
  ctx.strokeStyle = 'rgba(12,8,6,0.92)';
  ctx.strokeText(title, x, y);
  ctx.fillStyle = col;
  ctx.fillText(title, x, y);
  ctx.font = `500 ${Math.round(fs * 0.78)}px "Pixelify Sans", ui-monospace, monospace`;
  ctx.lineWidth = Math.max(3, fs * 0.24);
  ctx.strokeText(sub, x, y + fs * 0.95);
  ctx.fillStyle = '#f3e3c0';
  ctx.fillText(sub, x, y + fs * 0.95);
}

function drawLabels(ctx: CanvasRenderingContext2D, g: Game, left: number, top: number, s: number) {
  if (g.mode !== 'play') return;
  const fs = Math.max(11 * g.dpr, Math.round(4.3 * s));
  const camp = g.buildings[0];
  if (camp) {
    const x = ((camp.x + camp.w / 2) * TW - left) * s;
    const y = (camp.y * TH - 22 - top) * s;
    if (x > -200 && x < g.cw + 200 && y > -60 && y < g.ch + 60) {
      const n = g.totalPop();
      label(ctx, x, y, `★ ${g.name}`, `${RANKS[g.tierIdx].name} · ${n} чел.${g.stateFormed ? ' · Государство' : ''}`, '#ffe27a', fs + 2);
    }
  }
  for (const t of g.towns) {
    const x = ((t.x + 0.5) * TW - left) * s;
    const y = ((t.y - 4.2) * TH - top) * s;
    if (x < -200 || x > g.cw + 200 || y < -60 || y > g.ch + 60) continue;
    const mine = t.owner === 'player';
    const col = mine ? '#7dff8c' : t.attitude < 35 ? '#ff9a8a' : t.attitude < 60 ? '#ffe9a8' : '#b8f0a0';
    label(ctx, x, y, `${SPECS[t.spec].icon} ${t.name}${mine ? ' ✔' : ''}`, `${RANKS[t.tier].name} · ${Math.floor(t.pop)}${mine ? '' : ` · ⚔${Math.floor(t.soldiers)}`}`, col, fs);
  }
}

export function renderFrame(g: Game, dt: number) {
  const ctx = g.ctx;
  const s = g.scale;
  const cw = g.cw;
  const ch = g.ch;
  const w = g.world;
  const W = w.w * TW;
  const H = w.h * TH;
  const left = Math.round(g.cam.x - cw / (2 * s));
  const top = Math.round(g.cam.y - ch / (2 * s));
  g.viewLeft = left;
  g.viewTop = top;
  const vw = Math.ceil(cw / s) + 1;
  const vh = Math.ceil(ch / s) + 1;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a548c';
  ctx.fillRect(0, 0, cw, ch);
  ctx.setTransform(s, 0, 0, s, -left * s, -top * s);
  ctx.imageSmoothingEnabled = false;

  const sx = Math.max(0, left);
  const sy = Math.max(0, top);
  const ex = Math.min(W, left + vw);
  const ey = Math.min(H, top + vh);
  if (ex > sx && ey > sy) ctx.drawImage(g.terrain, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);

  const c0 = Math.max(0, Math.floor(left / TW) - 2);
  const c1 = Math.min(w.w - 1, Math.floor((left + vw) / TW) + 2);
  const r0 = Math.max(0, Math.floor(top / TH) - 1);
  const r1 = Math.min(w.h - 1, Math.floor((top + vh) / TH) + 6);

  // блики на воде
  const wt = Math.floor(g.waterT * 1.6);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let ty = r0; ty <= Math.min(w.h - 1, r1 - 5); ty++)
    for (let tx = c0; tx <= c1; tx++) {
      if (w.biome[ty * w.w + tx] > 1) continue;
      const hh = hash2(tx, ty, wt * 13 + 5);
      if (hh < 0.07) ctx.fillRect(tx * TW + Math.floor(hash2(tx, ty, wt) * 12), ty * TH + Math.floor(hash2(ty, tx, wt) * 9), 3, 1);
    }

  // подготовка рядов
  for (let r = r0; r <= r1; r++) {
    g.pre[r].length = 0;
    g.post[r].length = 0;
  }
  for (const u of g.units) {
    const row = Math.floor(u.y);
    if (row < r0 || row > r1) continue;
    const px = u.x * TW;
    if (px < left - 20 || px > left + vw + 20) continue;
    (u.y - row < 0.8 ? g.pre : g.post)[row].push(u);
  }
  for (const b of g.buildings) {
    const row = b.y + b.h - 1;
    if (row < r0 || row > r1 + 0) continue;
    if ((b.x + b.w) * TW < left - 40 || b.x * TW > left + vw + 40) continue;
    g.post[row].push(b);
  }
  for (const t of g.towns) {
    for (const b of t.bld) {
      const row = b.y + b.h - 1;
      if (row < r0 || row > r1) continue;
      if ((b.x + b.w) * TW < left - 40 || b.x * TW > left + vw + 40) continue;
      g.post[row].push(b);
    }
  }
  const key = (e: Unit | Building) => ('look' in e ? e.y : e.y + e.h);
  const drawEntity = (e: Unit | Building) => {
    if ('look' in e) drawUnit(ctx, e);
    else drawBuilding(ctx, g, e);
  };
  for (let r = r0; r <= r1; r++) {
    const pre = g.pre[r];
    if (pre.length) {
      pre.sort((a, b) => key(a) - key(b));
      for (const e of pre) drawEntity(e);
    }
    const row = r * w.w;
    for (let tx = c0; tx <= c1; tx++) {
      const o = w.objs[row + tx];
      if (o) drawObj(ctx, g, o, dt);
    }
    const post = g.post[r];
    if (post.length) {
      post.sort((a, b) => key(a) - key(b));
      for (const e of post) drawEntity(e);
    }
  }

  // «пинги» приказов
  for (const p of g.pings) {
    const k = p.t / 0.7;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 3 + k * 12, (3 + k * 12) * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // походы армий
  for (const m of g.marches) drawMarch(ctx, g, m);

  // подсветка наведения
  if (g.mode === 'play' && g.mouse.inside) {
    if (g.tool === 'chop' || g.tool === 'gather' || g.tool === 'mine') {
      const o = g.hoverObj;
      if (o) outlineRect(ctx, o.tx * TW, o.ty * TH, TW, TH, '#ffe27a');
    }
    if (g.tool === 'build' && g.buildType) {
      const def = BUILDINGS[g.buildType];
      const gp = g.ghostPos();
      const why = g.canPlace(g.buildType, gp.x, gp.y);
      const okc = !why && g.canAfford(g.buildType);
      ctx.fillStyle = okc ? 'rgba(90,255,120,0.32)' : 'rgba(255,70,70,0.36)';
      ctx.fillRect(gp.x * TW, gp.y * TH, def.w * TW, def.h * TH);
      outlineRect(ctx, gp.x * TW, gp.y * TH, def.w * TW, def.h * TH, okc ? '#7dff8c' : '#ff6a6a');
      const sp = g.bspr.cv[g.buildType];
      ctx.globalAlpha = 0.62;
      ctx.drawImage(sp, Math.round(gp.x * TW + (def.w * TW) / 2 - sp.width / 2), Math.round((gp.y + def.h) * TH - sp.height));
      ctx.globalAlpha = 1;
    }
  }

  // облачные тени
  if (g.mode) {
    const cl = getClouds();
    for (let i = 0; i < 5; i++) {
      const sp = cl[i % cl.length];
      const cwid = sp.width * 3;
      const px = ((i * 523 + g.waterT * 3.2) % (W + cwid * 2)) - cwid;
      const py = (i * 397) % (H - 60);
      if (px + cwid < left || px > left + vw || py + sp.height * 3 < top || py > top + vh) continue;
      ctx.drawImage(sp, Math.round(px), Math.round(py), cwid, sp.height * 3);
    }
  }

  // частицы
  for (const p of g.particles) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    ctx.globalAlpha = a;
    if (p.text) {
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1a1018';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      const sz = p.size;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }
  }
  ctx.globalAlpha = 1;

  // ---- экранные эффекты ----
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const light = Math.max(0, Math.min(1, 0.5 + 0.55 * Math.sin((g.dayT - 0.25) * Math.PI * 2)));
  const nightness = Math.max(0, Math.min(1, (0.62 - light) / 0.62));
  if (nightness > 0.01) {
    const q = 5;
    const nw = Math.ceil(cw / q);
    const nh = Math.ceil(ch / q);
    if (!nightCv) nightCv = mk(nw, nh);
    if (nightCv.width !== nw || nightCv.height !== nh) {
      nightCv.width = nw;
      nightCv.height = nh;
    }
    const n = nightCv.getContext('2d')!;
    n.globalCompositeOperation = 'source-over';
    const dusk = Math.max(0, 1 - Math.abs(light - 0.4) / 0.28);
    const rr = Math.round(12 + dusk * 60);
    const gg = Math.round(18 + dusk * 14);
    const bb = Math.round(52 - dusk * 6);
    n.clearRect(0, 0, nw, nh);
    n.fillStyle = `rgba(${rr},${gg},${bb},${0.64 * nightness})`;
    n.fillRect(0, 0, nw, nh);
    n.globalCompositeOperation = 'destination-out';
    const glow: { x: number; y: number; r: number }[] = [];
    for (const b of g.buildings) {
      const d = BUILDINGS[b.type];
      if (!b.done || !d.light) continue;
      const rad = b.type === 'camp' ? 110 : b.type === 'hall' ? 100 : b.type === 'shrine' ? 80 : 64;
      glow.push({ x: ((b.x + b.w / 2) * TW - left) * s, y: ((b.y + b.h - 0.6) * TH - top) * s, r: rad * s });
    }
    for (const b of g.buildings) {
      if (!b.done || BUILDINGS[b.type].housing <= 0 || b.type === 'camp') continue;
      glow.push({ x: ((b.x + b.w / 2) * TW - left) * s, y: ((b.y + b.h - 0.6) * TH - top) * s, r: 30 * s });
    }
    for (const u of g.units) glow.push({ x: (u.x * TW - left) * s, y: (u.y * TH - 8 - top) * s, r: 14 * s });
    for (const gl of glow) {
      const x = gl.x / q;
      const y = gl.y / q;
      const r = gl.r / q;
      if (x < -r || y < -r || x > nw + r || y > nh + r) continue;
      const gr = n.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,0.95)');
      gr.addColorStop(0.5, 'rgba(0,0,0,0.5)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      n.fillStyle = gr;
      n.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.drawImage(nightCv, 0, 0, cw, ch);
    // тёплое свечение огней
    ctx.globalCompositeOperation = 'lighter';
    for (const b of g.buildings) {
      const d = BUILDINGS[b.type];
      if (!b.done || !d.light) continue;
      const x = ((b.x + b.w / 2) * TW - left) * s;
      const y = ((b.y + b.h - 0.6) * TH - top) * s;
      const r = (b.type === 'camp' ? 70 : 42) * s;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,150,60,${0.28 * nightness})`);
      gr.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  } else if (light < 0.85 && light > 0.62) {
    // лёгкая тёплая дымка на закате/рассвете
    ctx.fillStyle = `rgba(255,170,90,${(0.85 - light) * 0.08})`;
    ctx.fillRect(0, 0, cw, ch);
  }

  drawLabels(ctx, g, left, top, s);

  // рамка выделения
  if (g.drag && g.mode === 'play') {
    const d = g.drag;
    const x = Math.min(d.sx, g.mouse.sx);
    const y = Math.min(d.sy, g.mouse.sy);
    const bw = Math.abs(g.mouse.sx - d.sx);
    const bh = Math.abs(g.mouse.sy - d.sy);
    if (bw > 4 || bh > 4) {
      const col = g.tool === 'chop' ? '255,160,70' : g.tool === 'gather' ? '255,110,140' : g.tool === 'mine' ? '190,200,220' : '125,255,140';
      ctx.fillStyle = `rgba(${col},0.16)`;
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = `rgb(${col})`;
      ctx.lineWidth = Math.max(1, Math.round(g.dpr));
      ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, bw, bh);
    }
  }
  ctx.imageSmoothingEnabled = false;

  // курсор
  let cur = 'default';
  if (g.mode === 'play') {
    if (g.tool === 'chop' || g.tool === 'gather' || g.tool === 'mine') cur = 'crosshair';
    else if (g.tool === 'build') cur = 'cell';
    else if (g.hoverUnit || g.hoverBuilding || g.hoverTown) cur = 'pointer';
    else if (g.hoverObj && g.selUnits().length) cur = 'pointer';
  }
  if (g.canvas.style.cursor !== cur) g.canvas.style.cursor = cur;
}
