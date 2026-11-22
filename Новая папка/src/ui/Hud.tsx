import { useEffect, useRef, useState } from 'react';
import { BUILDINGS, BUILD_CATS, BUILD_ORDER, RES_INFO, TH, TW, type BuildCat, type BuildingId, type ResKey } from '../game/data';
import { GOVS, RANKS, SPECS } from '../game/meta';
import { TECH_BY_ID } from '../game/techs';
import { personSprite, type Look } from '../game/sprites';
import type { Game, Snapshot, Tool } from '../game/game';
import { buildingIcon, icons } from './icons';

function fmtHour(h: number) {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor(((h % 1) * 60) / 10) * 10;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const portraitCache = new Map<string, string>();
function portrait(look: Look, kid: boolean) {
  const key = JSON.stringify(look) + kid;
  let u = portraitCache.get(key);
  if (!u) {
    u = personSprite(look, 0, 0, 0, kid).toDataURL();
    portraitCache.set(key, u);
  }
  return u;
}

const fmtRate = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(Math.abs(v) < 10 ? 2 : 1)}`;

function ResChip({ icon, value, cap, net, title, onClick, color }: { icon: string; value: number; cap?: number; net?: number; title: string; onClick?: () => void; color?: string }) {
  const full = cap !== undefined && value >= cap;
  const near = cap !== undefined && value >= cap * 0.9;
  return (
    <button onClick={onClick} title={title} className="px-inset pointer-events-auto flex min-w-[88px] items-center gap-2 px-2.5 py-1.5 text-left hover:brightness-125">
      <img src={icon} className="pix h-6 w-6 shrink-0" />
      <div className="leading-none">
        <div className="flex items-baseline gap-1">
          <span className="text-[18px] font-bold text-[#fff3d0]" style={{ color: full ? '#ff9a6a' : near ? '#ffd27a' : color }}>
            {value}
          </span>
          {cap !== undefined && <span className="text-[11px] text-[#a08868]">/{cap}</span>}
        </div>
        {net !== undefined && (
          <div className="mt-0.5 text-[12px]" style={{ color: net > 0.005 ? '#8aff9a' : net < -0.005 ? '#ff7a6a' : '#a08868' }}>
            {Math.abs(net) < 0.005 ? '±0' : fmtRate(net)}/с
          </div>
        )}
      </div>
    </button>
  );
}

function Minimap({ game }: { game: Game }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const SIZE = 150;
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const id = setInterval(() => {
      if (!game.world) return;
      const k = SIZE / game.world.w;
      g.imageSmoothingEnabled = false;
      g.drawImage(game.minimap, 0, 0, SIZE, SIZE);
      for (const b of game.buildings) {
        g.fillStyle = b.done ? '#ffe27a' : '#ffffff80';
        g.fillRect(b.x * k - 1, b.y * k - 1, Math.max(3, b.w * k + 1), Math.max(3, b.h * k + 1));
        g.strokeStyle = '#1a0e06';
        g.strokeRect(b.x * k - 1.5, b.y * k - 1.5, Math.max(3, b.w * k + 1) + 1, Math.max(3, b.h * k + 1) + 1);
      }
      for (const t of game.towns) {
        g.fillStyle = t.owner === 'player' ? '#7dff8c' : '#ff6a5a';
        g.fillRect(t.x * k - 2, t.y * k - 2, 5, 5);
        g.strokeStyle = '#1a0e06';
        g.strokeRect(t.x * k - 2.5, t.y * k - 2.5, 6, 6);
      }
      for (const u of game.units) {
        if (u.spawn > 0) continue;
        g.fillStyle = u.sel ? '#7dff8c' : '#ffffff';
        g.fillRect(u.x * k - 1, u.y * k - 1, 2, 2);
      }
      const vw = game.cw / game.scale / TW;
      const vh = game.ch / game.scale / TH;
      const cx = game.cam.x / TW;
      const cy = game.cam.y / TH;
      g.strokeStyle = '#fff';
      g.lineWidth = 1;
      g.strokeRect((cx - vw / 2) * k + 0.5, (cy - vh / 2) * k + 0.5, vw * k, vh * k);
    }, 100);
    return () => clearInterval(id);
  }, [game]);

  const go = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * game.world.w;
    const y = ((e.clientY - r.top) / r.height) * game.world.h;
    game.centerOn(x * TW, y * TH);
  };
  return (
    <canvas
      ref={ref}
      width={SIZE}
      height={SIZE}
      className="cursor-pointer"
      style={{ width: SIZE, height: SIZE, boxShadow: '0 0 0 2px #0f0906' }}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        go(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons & 1) go(e);
      }}
    />
  );
}

/** Кнопка команды: крупная иконка, понятная подпись и клавиша */
function Cmd({ icon, label, hotkey, onClick, active, tone, title, badge, disabled }: { icon: string; label: string; hotkey?: string; onClick: () => void; active?: boolean; tone?: 'gold' | 'red' | 'green'; title?: string; badge?: string | number; disabled?: boolean }) {
  const toneCls = tone === 'gold' ? 'px-btn-gold' : tone === 'red' ? 'px-btn-red' : tone === 'green' ? 'px-btn-green' : '';
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`px-btn ${toneCls} flex h-[66px] w-[84px] flex-col items-center justify-center gap-0.5 px-1 ${active ? 'active' : ''}`}>
      <span className="text-[24px] leading-none">{icon}</span>
      <span className="text-[13px] leading-none font-bold tracking-wide uppercase">{label}</span>
      {hotkey && <span className="font-pixel absolute -top-2 -right-1.5 bg-[#0f0906] px-1 py-[3px] text-[7px] text-[#ffcf6a]">{hotkey}</span>}
      {badge !== undefined && badge !== 0 && <span className="font-pixel absolute -top-2 -left-1.5 bg-[#c0392b] px-1 py-[3px] text-[8px] text-white">{badge}</span>}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="text-[11px] font-bold tracking-[0.2em] text-[#c8a060] uppercase">{title}</div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function Cost({ icon, n, have }: { icon: string; n: number; have: number }) {
  return (
    <span className="flex items-center gap-0.5" style={{ color: have >= n ? '#f3e3c0' : '#ff7a6a' }}>
      <img src={icon} className="pix h-3.5 w-3.5" />
      {n}
    </span>
  );
}

function JobRow({ icon, label, n, color, onMinus, onPlus, extra }: { icon: string; label: string; n: number | string; color: string; onMinus?: () => void; onPlus?: () => void; extra?: string }) {
  return (
    <div className="flex items-center gap-2 text-[14px]">
      <span className="w-6 text-center text-[17px]">{icon}</span>
      <span className="flex-1 text-[#f3e3c0]">
        {label}
        {extra && <span className="ml-1 text-[11px] text-[#a08868]">{extra}</span>}
      </span>
      <span className="w-8 text-center text-[17px] font-bold" style={{ color }}>
        {n}
      </span>
      {onMinus ? (
        <button onClick={onMinus} className="px-btn font-pixel h-7 w-7 text-[11px]" title="Снять одного работника">
          −
        </button>
      ) : (
        <span className="w-7" />
      )}
      {onPlus ? (
        <button onClick={onPlus} className="px-btn px-btn-green font-pixel h-7 w-7 text-[11px] text-white" title="Отправить свободного человека">
          +
        </button>
      ) : (
        <span className="w-7" />
      )}
    </div>
  );
}

interface Props {
  game: Game;
  snap: Snapshot;
  buildOpen: boolean;
  setBuildOpen: (v: boolean) => void;
  openTree: () => void;
  openMenu: () => void;
  openWorld: (id?: number) => void;
  openEco: () => void;
  devMode: boolean;
  devOpen: boolean;
  toggleDev: () => void;
}

export function Hud({ game, snap, buildOpen, setBuildOpen, openTree, openMenu, openWorld, openEco, devMode, devOpen, toggleDev }: Props) {
  const ic = icons();
  const [cat, setCat] = useState<BuildCat>('home');
  const [hoverB, setHoverB] = useState<BuildingId | null>(null);
  const now = performance.now();
  const toasts = snap.msgs.filter((m) => now - m.t < 9000);
  const res = snap.research ? TECH_BY_ID[snap.research.id] : null;
  const night = snap.hour < 5.5 || snap.hour >= 19.5;
  const net = (k: string) => (snap.flow[k]?.in ?? 0) - (snap.flow[k]?.out ?? 0);
  const warn = (r: string | null) => {
    if (r) game.msg(r, 'warn');
  };

  const toolBtn = (tool: Tool, label: string, key: string, emoji: string, title: string) => (
    <Cmd key={tool} icon={emoji} label={label} hotkey={key} title={title} active={snap.tool === tool} onClick={() => game.setTool(snap.tool === tool ? 'select' : tool)} />
  );

  const toolHint: Record<string, { icon: string; text: string }> = {
    chop: { icon: '🪓', text: 'Обведите рамкой деревья или кликните по дереву — люди будут рубить.' },
    gather: { icon: '🫐', text: 'Обведите рамкой кусты с ягодами — люди будут собирать.' },
    mine: { icon: '⛏️', text: 'Обведите рамкой камни (нужны «Каменные орудия»).' },
  };
  const hint =
    snap.tool === 'build' && snap.buildType
      ? { icon: '🏠', text: `Стройка: ${BUILDINGS[snap.buildType].name}. ЛКМ — поставить (Shift — несколько подряд).` }
      : toolHint[snap.tool];

  const selB = snap.building ? BUILDINGS[snap.building.type] : null;
  const w = snap.workers;
  const adults = w.chop + w.gather + w.mine + w.build + w.idle + w.other;
  const detail = hoverB ?? snap.buildType;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* верхняя панель */}
      <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2">
        <div className="px-panel pointer-events-auto flex flex-wrap items-center gap-1.5 px-2.5 py-2">
          <ResChip icon={ic.wood} value={snap.res.wood} cap={snap.cap} net={net('wood')} title="Дерево — рубите деревья. Нужно для построек и мастерских (откр. экономику)" onClick={openEco} />
          <ResChip icon={ic.stone} value={snap.res.stone} cap={snap.cap} net={net('stone')} title="Камень — добывайте после «Каменных орудий»" onClick={openEco} />
          <ResChip icon={ic.food} value={snap.res.food} cap={snap.cap} net={net('food')} title="Еда — кормит жителей и воинов" onClick={openEco} />
          <ResChip icon={ic.goods} value={snap.res.goods} cap={snap.cap} net={net('goods')} title="Товары — их делают мастерские и заводы. Нужны для зданий, армии и торговли" onClick={openEco} color={snap.toolsOn ? undefined : '#ff9a8a'} />
          <ResChip icon={ic.gold} value={snap.res.gold} net={snap.goldRate} title="Золото — налоги и рынок, минус содержание. Нажмите — экономика" onClick={openEco} color={snap.unpaid ? '#ff7a6a' : undefined} />
          <ResChip icon={ic.know} value={snap.know} net={snap.knowRate} title="Знания — копятся на изучение технологий" onClick={openTree} />
          <div className="px-inset flex items-center gap-2 px-2.5 py-1.5" title="Население / вместимость жилья">
            <img src={ic.pop} className="pix h-6 w-5" />
            <div className="leading-none">
              <div className="text-[18px] font-bold" style={{ color: snap.pop >= snap.housing ? '#ff9a6a' : '#fff3d0' }}>
                {snap.pop}
                <span className="text-[11px] font-normal text-[#a08868]">/{snap.housing}</span>
              </div>
              <div className="mt-0.5 text-[12px] text-[#e8d4a8]">{snap.kids ? `детей ${snap.kids}` : 'жители'}</div>
            </div>
          </div>
          <button onClick={() => openWorld()} title="Армия — открыть «Мир и война» (V)" className="px-inset flex items-center gap-2 px-2.5 py-1.5 text-left hover:brightness-125">
            <img src={ic.army} className="pix h-6 w-6" />
            <div className="leading-none">
              <div className="text-[18px] font-bold text-[#fff3d0]">{snap.army}</div>
              <div className="mt-0.5 text-[12px] text-[#e8d4a8]">{snap.armyAway ? `в походе ${snap.armyAway}` : `лимит ${snap.armyCap}`}</div>
            </div>
          </button>
        </div>

        <div className="px-panel pointer-events-auto px-4 py-2 text-center">
          <div className="font-pixel max-w-[300px] truncate text-[10px] text-[#ffe27a]">
            {SPECS[snap.specId].icon} {RANKS[snap.tierIdx].name.toUpperCase()} «{snap.name.toUpperCase()}»
          </div>
          <div className="font-pixel mt-1.5 text-[7px] text-[#ffe9a8]">
            {snap.stateFormed && snap.gov ? `${GOVS[snap.gov].icon} ${GOVS[snap.gov].name.toUpperCase()} · ` : ''}
            {snap.epoch.toUpperCase()}
          </div>
          <div className="mt-1.5 text-[15px] text-[#e8d4a8]">
            День {snap.day} · {night ? '🌙' : '☀️'} {fmtHour(snap.hour)}
          </div>
        </div>

        <div className="px-panel pointer-events-auto flex items-center gap-2 px-3 py-2">
          {[
            { s: 1, l: '1x' },
            { s: 2, l: '2x' },
            { s: 4, l: '4x' },
          ].map((b) => (
            <button key={b.s} onClick={() => game.setSpeed(b.s)} className={`px-btn font-pixel px-2.5 py-2.5 text-[9px] ${!snap.paused && snap.speed === b.s ? 'active' : ''}`}>
              {b.l}
            </button>
          ))}
          <button onClick={() => game.setPaused(!snap.paused)} className={`px-btn font-pixel px-2.5 py-2.5 text-[9px] ${snap.paused ? 'active' : ''}`} title="Пауза (Пробел)">
            ❚❚
          </button>
          {devMode && (
            <button onClick={toggleDev} className={`px-btn font-pixel px-2.5 py-2.5 text-[9px] ${devOpen ? 'active' : ''}`} title="Меню разработчика (`)">
              🛠
            </button>
          )}
          <button onClick={openMenu} className="px-btn font-pixel px-2.5 py-2.5 text-[9px]" title="Меню (Esc)">
            ☰
          </button>
        </div>
      </div>

      {/* исследование */}
      <div className="absolute inset-x-0 top-[84px] flex justify-center px-2 sm:top-[90px]">
        <button onClick={openTree} className={`px-panel pointer-events-auto flex w-[min(460px,92vw)] items-center gap-3 px-3 py-2 text-left ${res ? '' : 'pulse-px'}`}>
          <span className="px-inset flex h-10 w-10 shrink-0 items-center justify-center text-[22px]">{res ? res.icon : '💡'}</span>
          <div className="min-w-0 flex-1">
            {res ? (
              <>
                <div className="flex justify-between gap-2">
                  <span className="truncate text-[14px] font-bold text-[#ffe9a8]">ИЗУЧАЕТСЯ: {res.name.toUpperCase()}</span>
                  <span className="text-[14px] font-bold text-[#ffcf6a]">
                    {Math.floor(snap.research!.progress)}/{snap.research!.cost}
                  </span>
                </div>
                <div className="px-bar mt-1.5 h-3">
                  <i style={{ width: `${Math.min(100, (snap.research!.progress / snap.research!.cost) * 100)}%` }} />
                </div>
              </>
            ) : (
              <>
                <div className="text-[14px] font-bold text-[#ffe9a8]">ВЫБЕРИТЕ ИЗУЧЕНИЕ</div>
                <div className="mt-0.5 text-[13px] text-[#e8d4a8]">Знания копятся впрок. Открыть древо [T]</div>
              </>
            )}
          </div>
          <span className="font-pixel bg-[#0f0906] px-1.5 py-1 text-[7px] text-[#ffcf6a]">T</span>
        </button>
      </div>

      {/* цели */}
      <div className="absolute top-[156px] left-2 hidden w-[250px] md:block">
        <div className="px-panel-dark pointer-events-auto p-3">
          <div className="mb-2 flex justify-between text-[12px] font-bold tracking-widest text-[#ffcf6a]">
            <span>ЦЕЛИ</span>
            <span>
              {snap.questsDone}/{snap.questsTotal}
            </span>
          </div>
          {snap.objectives.length === 0 && <div className="text-[14px] text-[#8aff9a]">Все цели выполнены!</div>}
          {snap.objectives.map((o) => (
            <div key={o.text} className="flex gap-2 py-0.5 text-[14px] text-[#f3e3c0]">
              <span className="text-[#ffcf6a]">◆</span>
              {o.text}
            </div>
          ))}
        </div>
      </div>

      {/* уведомления */}
      <div className="absolute top-[156px] right-2 flex w-[min(340px,70vw)] flex-col items-end gap-2">
        {toasts.map((m) => (
          <div key={m.id} className="toast-in px-panel-dark px-3 py-2 text-[14px] leading-tight" style={{ color: m.kind === 'good' ? '#9affaa' : m.kind === 'warn' ? '#ffa08a' : '#f3e3c0' }}>
            {m.text}
          </div>
        ))}
        {snap.starving && <div className="px-panel-dark blink-px px-3 py-2 text-[14px] font-bold text-[#ff7a6a]">⚠ ГОЛОД! НУЖНА ЕДА</div>}
        {snap.unpaid && <div className="px-panel-dark px-3 py-2 text-[13px] font-bold text-[#ffb08a]">🪙 Казна пуста — содержание не оплачено</div>}
      </div>

      {/* нижняя панель */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
        {/* информация / работники */}
        <div className="px-panel pointer-events-auto flex min-h-[150px] w-[min(350px,34vw)] min-w-[270px] flex-col gap-2 p-3">
          {snap.selTown !== null && snap.towns.find((t) => t.id === snap.selTown) ? (
            (() => {
              const t = snap.towns.find((q) => q.id === snap.selTown)!;
              const sp = SPECS[t.spec];
              return (
                <>
                  <div className="flex gap-3">
                    <div className="px-inset flex h-[64px] w-[64px] shrink-0 items-center justify-center text-[34px]" style={{ boxShadow: `inset 0 0 0 2px ${sp.color}` }}>
                      {sp.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[16px] font-bold text-[#ffe9a8]">{t.name.toUpperCase()}</div>
                      <div className="mt-1 text-[14px] leading-tight text-[#e8d4a8]">
                        {RANKS[t.tier].name} · {sp.name}
                        <br />👥 {t.pop} · {t.owner === 'player' ? '✔ ваше' : `⚔ ~${t.soldiers} · отн. ${t.attitude}`}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => openWorld(t.id)} className="px-btn px-btn-red px-2 py-2.5 text-[14px] font-bold">
                    ⚔ ДИПЛОМАТИЯ И ВОЙНА
                  </button>
                </>
              );
            })()
          ) : snap.building && selB ? (
            <>
              <div className="flex gap-3">
                <div className="px-inset flex h-[72px] w-[72px] shrink-0 items-center justify-center p-1">
                  <img src={buildingIcon(game, snap.building.type)} className="pix max-h-full max-w-full" />
                </div>
                <div className="min-w-0">
                  <div className="text-[16px] font-bold text-[#ffe9a8]">{selB.name.toUpperCase()}</div>
                  <div className="mt-1 text-[13px] leading-tight text-[#e8d4a8]">{selB.desc}</div>
                </div>
              </div>
              {snap.building.done && selB.prod && (
                <div className="px-inset flex flex-col gap-0.5 px-2 py-1.5 text-[13px] text-[#e8d4a8]">
                  <div>
                    Работники: <b className={snap.jobs.labor >= 1 ? 'text-[#8aff9a]' : 'text-[#ffcf6a]'}>{snap.jobs.staffed}</b>/{snap.jobs.total} (свободные жители, всего по всем цехам)
                  </div>
                  <div>
                    Сырьё: {Object.entries(selB.prod.in).map(([k, v]) => `${RES_INFO[k as ResKey].icon}${v}/с `)}→ 📦{selB.prod.out}/с
                  </div>
                  <div>Загрузка: {Math.round(snap.jobs.labor * (snap.unpaid ? 60 : 100))}%</div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] text-[#ffcf6a]">
                  {snap.building.done ? [selB.housing ? `Жильё: ${selB.housing}` : 'Готово', selB.upkeep ? `содерж. ${selB.upkeep}🪙/с` : ''].filter(Boolean).join(' · ') : `Строится: ${Math.floor(snap.building.progress * 100)}%`}
                </span>
                {snap.building.type !== 'camp' && (
                  <button onClick={() => game.demolish(snap.building!.id)} className="px-btn px-btn-red px-2.5 py-1.5 text-[13px] font-bold">
                    {snap.building.done ? 'СНЕСТИ' : 'ОТМЕНА'}
                  </button>
                )}
              </div>
            </>
          ) : snap.selCount > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-[#ffe9a8]">ВЫБРАНО: {snap.selCount}</span>
                <button onClick={() => game.stopSelected()} className="px-btn px-2.5 py-1.5 text-[13px] font-bold">
                  ■ СТОП <span className="text-[#ffcf6a]">[X]</span>
                </button>
              </div>
              <div className="scroll-px flex max-h-[104px] flex-wrap gap-1.5 overflow-y-auto">
                {snap.units.slice(0, 12).map((u) => (
                  <button key={u.id} onClick={() => game.selectUnit(u.id)} className="px-inset flex items-center gap-1.5 px-1.5 py-1 text-left hover:brightness-125">
                    <img src={portrait(u.look, u.kid)} className="pix h-[30px] w-6" />
                    <div className="leading-none">
                      <div className="text-[13px] font-bold text-[#fff3d0]">{u.name}</div>
                      <div className="mt-0.5 text-[11px] text-[#c8b088]">
                        {u.task}
                        {u.carry ? ` · ${u.carry}` : ''}
                      </div>
                    </div>
                  </button>
                ))}
                {snap.units.length > 12 && <span className="self-center text-[13px] text-[#c8b088]">+{snap.units.length - 12} ещё</span>}
              </div>
              <div className="text-[12px] text-[#a08868]">ПКМ по цели — приказ: дерево, ягоды, камень, стройка, земля.</div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold tracking-widest text-[#ffcf6a]">РАБОТА ПЛЕМЕНИ</span>
                <button onClick={() => warn(game.autoAssign())} disabled={w.idle === 0} className="px-btn px-btn-green px-2 py-1 text-[12px] font-bold text-white" title="Раздать свободным людям работу по нехватке ресурсов (J)">
                  ⚡ АВТО <span className="text-[#ffe9a8]">[J]</span>
                </button>
              </div>
              <JobRow icon="🪓" label="Дерево" n={w.chop} color="#e0b070" onMinus={() => warn(game.assignJob('chop', -1))} onPlus={() => warn(game.assignJob('chop', 1))} />
              <JobRow icon="🫐" label="Ягоды" n={w.gather} color="#ff8a9a" onMinus={() => warn(game.assignJob('gather', -1))} onPlus={() => warn(game.assignJob('gather', 1))} />
              <JobRow icon="⛏️" label="Камень" n={w.mine} color="#c4cad8" onMinus={() => warn(game.assignJob('mine', -1))} onPlus={() => warn(game.assignJob('mine', 1))} />
              {w.build > 0 && <JobRow icon="🔨" label="Стройка" n={w.build} color="#8aff9a" />}
              {snap.jobs.total > 0 && <JobRow icon="🏭" label="Цеха" n={`${snap.jobs.staffed}/${snap.jobs.total}`} color={snap.jobs.labor >= 1 ? '#8aff9a' : '#ffcf6a'} extra="из свободных" />}
              <JobRow icon="💤" label="Свободны" n={w.idle} color={w.idle ? '#ffe27a' : '#a08868'} />
              <div className="text-[11px] text-[#a08868]">
                Всего работников: {adults}. {snap.toolsOn ? '🔧 Инструменты ускоряют работу' : '🔧 Нет товаров — работа медленнее'}
              </div>
            </>
          )}
        </div>

        {/* команды */}
        <div className="pointer-events-none flex flex-1 flex-col items-center gap-2">
          {hint && (
            <div className="px-panel-dark pointer-events-auto flex max-w-[min(680px,90vw)] items-center gap-3 px-3 py-1.5 text-[14px] text-[#ffe9a8]">
              <span className="text-[18px]">{hint.icon}</span>
              <span>{hint.text}</span>
              <button onClick={() => game.setTool('select')} className="px-btn px-2 py-0.5 text-[12px] font-bold">
                ✕ Отмена <span className="text-[#ffcf6a]">[Esc]</span>
              </button>
            </div>
          )}
          {buildOpen && (
            <div className="px-panel pointer-events-auto flex max-w-[min(960px,96vw)] flex-col gap-2 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {BUILD_CATS.map((c) => {
                  const list = BUILD_ORDER.filter((id) => BUILDINGS[id].cat === c.id);
                  const open = list.filter((id) => game.isUnlocked(id)).length;
                  return (
                    <button key={c.id} onClick={() => setCat(c.id)} className={`px-btn flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-bold ${cat === c.id ? 'active' : ''}`} title={c.hint}>
                      <span className="text-[16px]">{c.icon}</span>
                      {c.name}
                      <span className="text-[11px] opacity-70">
                        {open}/{list.length}
                      </span>
                    </button>
                  );
                })}
                <button onClick={() => setBuildOpen(false)} className="px-btn px-btn-red ml-auto px-2.5 py-1.5 text-[13px] font-bold">
                  ✕ <span className="text-[#ffcf6a]">[B]</span>
                </button>
              </div>
              <div className="scroll-px flex gap-2 overflow-x-auto pb-1">
                {BUILD_ORDER.filter((id) => BUILDINGS[id].cat === cat).map((id: BuildingId) => {
                  const d = BUILDINGS[id];
                  const unlocked = game.isUnlocked(id);
                  const afford = game.canAfford(id);
                  const active = snap.buildType === id;
                  return (
                    <button
                      key={id}
                      onClick={() => game.setBuildType(active ? null : id)}
                      onMouseEnter={() => setHoverB(id)}
                      onMouseLeave={() => setHoverB(null)}
                      className={`px-btn relative flex w-[118px] shrink-0 flex-col items-center gap-1 px-2 pt-2 pb-2 ${active ? 'active' : ''}`}
                    >
                      <div className="px-inset flex h-[62px] w-full items-center justify-center p-1" style={{ filter: unlocked ? undefined : 'grayscale(1) brightness(0.45)' }}>
                        <img src={buildingIcon(game, id)} className="pix max-h-full max-w-full" />
                      </div>
                      <div className="text-center text-[13px] leading-tight font-bold">{d.name}</div>
                      {unlocked ? (
                        <div className="flex flex-wrap justify-center gap-x-2 text-[13px]">
                          {(['wood', 'stone', 'goods'] as ResKey[]).map((k) => (d.cost[k] ? <Cost key={k} icon={ic[k]} n={d.cost[k]!} have={game.dev.freeBuild ? 9999 : snap.res[k]} /> : null))}
                          {!d.cost.wood && !d.cost.stone && !d.cost.goods && <span className="text-[#8aff9a]">бесплатно</span>}
                        </div>
                      ) : (
                        <div className="text-center text-[11px] leading-tight text-[#ffa08a]">🔒 {game.unlockName(id)}</div>
                      )}
                      {unlocked && !afford && <div className="pointer-events-none absolute inset-0 bg-black/30" />}
                    </button>
                  );
                })}
              </div>
              {detail && (
                <div className="px-inset flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[13px] text-[#e8d4a8]">
                  <b className="text-[15px] text-[#ffe9a8]">{BUILDINGS[detail].name}</b>
                  <span className="min-w-[200px] flex-1">{BUILDINGS[detail].desc}</span>
                  <span className="text-[#c8b088]">
                    {BUILDINGS[detail].w}×{BUILDINGS[detail].h}
                    {BUILDINGS[detail].jobs ? ` · работников ${BUILDINGS[detail].jobs}` : ''}
                    {BUILDINGS[detail].upkeep ? ` · содержание ${BUILDINGS[detail].upkeep}🪙/с` : ''}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="px-panel pointer-events-auto flex flex-wrap items-end justify-center gap-x-4 gap-y-3 px-4 pt-3 pb-3">
            <Group title="Люди">
              <Cmd icon="👥" label="Все" hotkey="G" title="Выбрать всех жителей (G)" onClick={() => game.selectAll()} />
              <Cmd icon="💤" label="Свободные" hotkey="F" badge={snap.idleCount} title="Выбрать всех, кто сейчас без дела (F)" onClick={() => game.selectIdle()} />
              <Cmd icon="⚡" label="Авто" hotkey="J" title="Раздать свободным людям работу по нехватке ресурсов (J)" disabled={snap.idleCount === 0} onClick={() => warn(game.autoAssign())} />
            </Group>
            <Group title="Разметка работ">
              {toolBtn('chop', 'Рубить', 'Q', '🪓', 'Отметить деревья для рубки (Q)')}
              {toolBtn('gather', 'Ягоды', 'E', '🫐', 'Собирать ягоды (E)')}
              {toolBtn('mine', 'Камень', 'R', '⛏️', 'Добывать камень (R)')}
            </Group>
            <Group title="Стройка">
              <Cmd icon="🏠" label="Строить" hotkey="B" tone="gold" active={buildOpen || snap.tool === 'build'} title="Открыть меню построек (B)" onClick={() => setBuildOpen(!buildOpen)} />
            </Group>
            <Group title="Государство">
              <Cmd icon="💰" label="Экономика" hotkey="M" title="Ресурсы, налоги, рынок и производство (M)" badge={snap.unpaid ? '!' : 0} onClick={openEco} />
              <Cmd icon="💡" label="Знания" hotkey="T" title="Древо технологий (T)" onClick={openTree} />
              <Cmd icon="⚔️" label="Война" hotkey="V" tone="red" title="Армия, дипломатия, походы (V)" onClick={() => openWorld()} />
            </Group>
          </div>
        </div>

        {/* миникарта */}
        <div className="px-panel pointer-events-auto hidden flex-col gap-2 p-3 sm:flex">
          <Minimap game={game} />
          <div className="text-center text-[13px] font-bold text-[#ffcf6a]">{snap.hover || '—'}</div>
        </div>
      </div>
    </div>
  );
}
