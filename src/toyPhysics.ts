// おもちゃ箱の物理(UI を持たない純粋な関数)。
// 箱の中で円が重力に引かれて落ち、壁と互いにぶつかって転がる。見た目は ToyBox が描く。
// 単位は px と秒。重力の向きは外から渡す(今は常に下。昔は端末の傾きだった)。
// 棚に並んだ物体は pinned(固定)で動かない。指でなぞられると外れて落ち、落ちた物体が最初に上から
// ぶつかった相手 1 つも外れる(ドミノのように、その下へ順に崩れる)。1 つが外せるのは 1 つだけで、
// 横からの小突きでは外れないので、触れた列だけが崩れて、まわりは残る

export interface Body {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 回転角(rad) */
  angle: number;
  /** 角速度(rad/s) */
  spin: number;
  r: number;
  mass: number;
  /** 指でつまんでいる(重力も衝突の押し戻しも受けない) */
  held: boolean;
  /** 棚に固定されている(動かないが、上からぶつかられると外れる) */
  pinned: boolean;
  /** 固定された物体にぶつかって外せる残り数(なぞられた・外された物体は 1。ゆらしたときは 0) */
  knocks: number;
  /** 止まっているフレーム数(表示や振動の判断用) */
  sleep: number;
  /** このステップの前の位置(速度を位置の差から出すため) */
  px: number;
  py: number;
}

export interface World {
  width: number;
  height: number;
  bodies: Body[];
  /** 足場(タワー用)。上から来た物体だけが乗る。無ければ null */
  platform: { x0: number; x1: number; y: number } | null;
}

/** ぶつかった記録(strength = ぶつかった速さ px/s) */
export interface Hit {
  a: string;
  /** 壁なら null */
  b: string | null;
  strength: number;
}

export interface Vec { x: number; y: number }

/** 重力の強さ(px/s²)。画面の高さ 700px を 0.9 秒ほどで落ちる */
export const GRAVITY = 1800;
const WALL_BOUNCE = 0.35;
const BODY_BOUNCE = 0.4;
const WALL_FRICTION = 0.92;
/** 円どうしの摩擦係数 */
const FRICTION = 0.6;
const AIR_DRAG = 0.995;
const SPIN_DRAG = 0.985;
const MAX_SPEED = 2600;
/** これより遅ければ止める(px/s) */
const SLEEP_SPEED = 12;
const SLEEP_FRAMES = 25;
const ITERATIONS = 4;
/** これより遅いぶつかり方は跳ねない(px/s) */
const BOUNCE_MIN_SPEED = 90;
/** 許すめり込み(px) */
const SLOP = 0.3;
/** 固定された物体は、これより速く上からぶつかられたら外れる(px/s)。乗っているだけ(30 以下)では外れない */
const UNPIN_SPEED = 60;
/** 上から当たったとみなす範囲(当たる向きの下向き成分。1 で真上から、0.6 でおよそ 53° まで) */
const UNPIN_FROM_ABOVE = 0.6;
/**
 * 固定された物体と、ステップの前からこれより深く重なっていた相手は、すり抜ける(px)。
 * 棚に入りきらず重ねて並べたとき、外れた物体が隣を押しのけて飛び散らないように。
 * 乗っているだけのめり込み(SLOP + 1 ステップの落下 ≈ 0.8px)より深くしておく
 */
const GHOST_OVERLAP = 1.5;
/** 外れた物体に、ぶつかってきた速さのこの割合を渡す(ドミノのように下へ伝わる) */
const UNPIN_KICK = 1;

export function createWorld(width: number, height: number): World {
  return { width, height, bodies: [], platform: null };
}

export function addBody(world: World, init: { id: string; x: number; y: number; r: number; vx?: number; vy?: number; angle?: number; pinned?: boolean }): Body {
  const body: Body = {
    id: init.id, x: init.x, y: init.y, vx: init.vx ?? 0, vy: init.vy ?? 0,
    angle: init.angle ?? 0, spin: 0, r: init.r, mass: init.r * init.r, held: false, pinned: init.pinned ?? false, knocks: 0,
    sleep: init.pinned ? SLEEP_FRAMES : 0, px: init.x, py: init.y,
  };
  world.bodies.push(body);
  return body;
}

export const isAsleep = (b: Body) => b.sleep >= SLEEP_FRAMES;

export function wakeAll(world: World) {
  for (const b of world.bodies) b.sleep = 0;
}

export function clear(world: World) {
  world.bodies.length = 0;
}

/** 固定を外す(落ち始める)。knocks は、この物体がさらに外せる数 */
export function unpin(b: Body, knocks = 1) {
  if (!b.pinned) return;
  b.pinned = false;
  b.sleep = 0;
  b.knocks = knocks;
}

/** 全部の固定を外す(ゆらす)。外れた物体は他を外さない */
export function unpinAll(world: World) {
  for (const b of world.bodies) unpin(b, 0);
}

/** 動かない側(つまんでいる・固定)は、押し戻しも跳ね返りも受けない */
const isFixed = (b: Body) => b.held || b.pinned;

const clampSpeed = (b: Body) => {
  const v = Math.hypot(b.vx, b.vy);
  if (v > MAX_SPEED) { b.vx *= MAX_SPEED / v; b.vy *= MAX_SPEED / v; }
};

interface Contact { a: Body; b: Body; nx: number; ny: number; vn: number }
interface WallHit { b: Body; nx: number; ny: number; vin: number }

/** 壁の内側に押し戻す(最初の回だけ、当たった速さを記録する) */
function clampWalls(world: World, record: WallHit[] | null) {
  const { width, height } = world;
  for (const b of world.bodies) {
    if (isFixed(b)) continue;
    if (b.x - b.r < 0) { if (record) record.push({ b, nx: 1, ny: 0, vin: -b.vx }); b.x = b.r; }
    if (b.x + b.r > width) { if (record) record.push({ b, nx: -1, ny: 0, vin: b.vx }); b.x = width - b.r; }
    if (b.y - b.r < 0) { if (record) record.push({ b, nx: 0, ny: 1, vin: -b.vy }); b.y = b.r; }
    if (b.y + b.r > height) { if (record) record.push({ b, nx: 0, ny: -1, vin: b.vy }); b.y = height - b.r; }
    // 足場: 中心が足場の上にあって、前の位置が足場より上だった物体だけ乗せる
    const pf = world.platform;
    if (pf && b.x >= pf.x0 && b.x <= pf.x1 && b.y + b.r > pf.y && b.py + b.r <= pf.y + 2) {
      if (record) record.push({ b, nx: 0, ny: -1, vin: b.vy });
      b.y = pf.y - b.r;
    }
  }
}

/**
 * 1 ステップ進める。gravity は向きと強さ(1 で 1G)。
 * 位置を先に直し(めり込みを押し戻す)、速度は位置の差から出す。山が震えずに静止する
 */
export function step(world: World, dt: number, gravity: Vec): Hit[] {
  const hits: Hit[] = [];
  const { bodies } = world;
  const gx = gravity.x * GRAVITY;
  const gy = gravity.y * GRAVITY;

  // 重力と移動(直す前の位置を覚えておく)
  for (const b of bodies) {
    b.px = b.x;
    b.py = b.y;
    if (isFixed(b)) continue;
    b.vx = (b.vx + gx * dt) * AIR_DRAG;
    b.vy = (b.vy + gy * dt) * AIR_DRAG;
    clampSpeed(b);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin *= SPIN_DRAG;
    b.angle += b.spin * dt;
  }

  // めり込みを押し戻す(円どうし → 壁、を繰り返す)
  const contacts: Contact[] = [];
  const wallHits: WallHit[] = [];
  for (let it = 0; it < ITERATIONS; it++) {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD) continue;
        if (a.pinned || b.pinned) {
          // 固定された物体と前から深く重なっていた相手は、ぶつからずにすり抜ける
          const pdx = b.px - a.px;
          const pdy = b.py - a.py;
          const ghost = minD - GHOST_OVERLAP;
          if (pdx * pdx + pdy * pdy < ghost * ghost) continue;
        }
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d;
        const ny = dy / d;
        if (it === 0) contacts.push({ a, b, nx, ny, vn: (b.vx - a.vx) * nx + (b.vy - a.vy) * ny });
        const corr = Math.max(0, minD - d - SLOP) * 0.9;
        if (corr === 0) continue;
        const wa = isFixed(a) ? 0 : isFixed(b) ? 1 : b.mass / (a.mass + b.mass);
        const wb = isFixed(b) ? 0 : isFixed(a) ? 1 : a.mass / (a.mass + b.mass);
        a.x -= nx * corr * wa; a.y -= ny * corr * wa;
        b.x += nx * corr * wb; b.y += ny * corr * wb;
      }
    }
    clampWalls(world, it === 0 ? wallHits : null);
  }

  // 速度 = 実際に動いた量(ぶつかって止まった分は自然に消える)
  for (const b of bodies) {
    if (isFixed(b)) continue;
    b.vx = (b.x - b.px) / dt;
    b.vy = (b.y - b.py) / dt;
  }

  // 速くぶつかったら跳ね返す。接線方向は摩擦で削って回転にする
  for (const c of contacts) {
    const { a, b, nx, ny } = c;
    // 固定された物体に、外す力の残っている物体が上から勢いよく落ちてきたら外れる(外れた分は跳ね返りも受ける)。
    // 横や下からの小突きでは外れない(床にたまった山のゆれで棚ごと崩れないように)。指でつまんだものは
    // どの向きからでも、いくつでも外せる。外れた側には、ぶつかってきた速さを渡す(隙間が無く並んでいても、
    // その下へ順に伝わる)。nx, ny は a → b の向き
    if (-c.vn > UNPIN_SPEED) {
      const kick = -c.vn * UNPIN_KICK;
      if (b.pinned && !a.pinned && (a.held || (a.knocks > 0 && ny > UNPIN_FROM_ABOVE))) {
        if (!a.held) a.knocks--;
        unpin(b); b.vx += nx * kick; b.vy += ny * kick;
      } else if (a.pinned && !b.pinned && (b.held || (b.knocks > 0 && -ny > UNPIN_FROM_ABOVE))) {
        if (!b.held) b.knocks--;
        unpin(a); a.vx -= nx * kick; a.vy -= ny * kick;
      }
    }
    const wa = isFixed(a) ? 0 : isFixed(b) ? 1 : b.mass / (a.mass + b.mass);
    const wb = isFixed(b) ? 0 : isFixed(a) ? 1 : a.mass / (a.mass + b.mass);
    if (-c.vn > BOUNCE_MIN_SPEED) {
      const dv = -c.vn * BODY_BOUNCE;
      a.vx -= nx * dv * wa; a.vy -= ny * dv * wa;
      b.vx += nx * dv * wb; b.vy += ny * dv * wb;
    }
    const tx = -ny;
    const ty = nx;
    const vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
    // 固定された物体は壁と同じ摩擦(棚の隣に触れたまま滑り落ちられるように。円どうしの摩擦だと止まってしまう)
    const friction = a.pinned || b.pinned ? 1 - WALL_FRICTION : FRICTION;
    a.vx += tx * vt * friction * wa; a.vy += ty * vt * friction * wa;
    b.vx -= tx * vt * friction * wb; b.vy -= ty * vt * friction * wb;
    if (!a.pinned) a.spin += (vt / a.r) * 0.25;
    if (!b.pinned) b.spin += (vt / b.r) * 0.25;
    if (-c.vn > 0) hits.push({ a: a.id, b: b.id, strength: -c.vn });
  }
  for (const w of wallHits) {
    const { b, nx, ny } = w;
    if (w.vin > BOUNCE_MIN_SPEED) {
      // 壁から離れる向きに、入ってきた速さ × 反発
      const vOut = w.vin * WALL_BOUNCE;
      b.vx += nx * vOut; b.vy += ny * vOut;
    }
    // 壁に沿う速度は摩擦で減り、転がる
    const tx = -ny;
    const ty = nx;
    const vt = b.vx * tx + b.vy * ty;
    b.vx -= tx * vt * (1 - WALL_FRICTION); b.vy -= ty * vt * (1 - WALL_FRICTION);
    // 転がる(接点が滑らない角速度。画面座標では時計回りが正)
    b.spin = (b.vx * -ny + b.vy * nx) / b.r;
    if (w.vin > 0) hits.push({ a: b.id, b: null, strength: w.vin });
  }

  // ほぼ止まったら完全に止める。支えが無くなれば重力でまた落ちる
  for (const b of bodies) {
    if (b.held) { b.sleep = 0; continue; }
    if (b.pinned) { b.sleep = SLEEP_FRAMES; continue; }
    if (Math.hypot(b.vx, b.vy) < SLEEP_SPEED && Math.abs(b.spin) < 0.6) {
      b.vx = 0; b.vy = 0; b.spin = 0;
      b.sleep = Math.min(b.sleep + 1, SLEEP_FRAMES);
    } else {
      b.sleep = 0;
    }
  }
  return hits;
}

/** 振った: 全部の固定を外して、重力と逆向き(上)+ 横ばらつきの撃力 */
export function impulseAll(world: World, strength: number, gravity: Vec, rand: () => number = Math.random) {
  const g = Math.hypot(gravity.x, gravity.y) || 1;
  const ux = -gravity.x / g;
  const uy = -gravity.y / g;
  for (const b of world.bodies) {
    if (b.held) continue;
    unpin(b);
    b.sleep = 0;
    const s = strength * (0.6 + rand() * 0.7);
    b.vx += ux * s + (rand() - 0.5) * strength * 0.8;
    b.vy += uy * s + (rand() - 0.5) * strength * 0.3;
    b.spin += (rand() - 0.5) * 12;
    clampSpeed(b);
  }
}

/** 指の位置に一番近い物体(少し外側まで許す) */
export function pick(world: World, x: number, y: number, slack = 10): Body | null {
  let best: Body | null = null;
  let bestD = Infinity;
  for (const b of world.bodies) {
    const d = Math.hypot(b.x - x, b.y - y) - b.r;
    if (d <= slack && d < bestD) { best = b; bestD = d; }
  }
  return best;
}

export function grab(b: Body) {
  b.held = true;
  b.sleep = 0;
  b.vx = 0; b.vy = 0;
}

/** つまんだまま動かす。離したときに残す速度を、指の動きからなめらかに作る */
export function moveHeld(world: World, b: Body, x: number, y: number, dt: number) {
  if (dt <= 0) return;
  const nx = Math.min(world.width - b.r, Math.max(b.r, x));
  const ny = Math.min(world.height - b.r, Math.max(b.r, y));
  const vx = (nx - b.x) / dt;
  const vy = (ny - b.y) / dt;
  b.vx = b.vx * 0.5 + vx * 0.5;
  b.vy = b.vy * 0.5 + vy * 0.5;
  b.x = nx;
  b.y = ny;
}

export function release(b: Body) {
  b.held = false;
  b.sleep = 0;
  clampSpeed(b);
  b.spin += b.vx / b.r * 0.2;
}

/** 棚に並べたときの 1 つの位置 */
export interface Slot { id: string; x: number; y: number }

interface ShelfItem { id: string; r: number; /** 円の上にはみ出す飾り(メダルのリボン)の分、上に空ける */ top?: number }

/**
 * 棚のように、上から順に行で詰めて並べる。行ごとに左右中央、行の高さはその行の一番大きい物体。
 * 高さに収まらないときは間隔を縮めて(重なってよい)、縮めても入らない分は下にはみ出す
 */
export function shelfLayout(items: ShelfItem[], width: number, height: number, gap = 6, pad = 10): Slot[] {
  if (items.length === 0) return [];
  // 行の高さ = 飾りの分(top)+ 一番大きい円。円の中心は top の下に置く(大きい円どうしが上下で触れないように)
  const pack = (scale: number) => {
    const rows: { items: ShelfItem[]; w: number; body: number; top: number }[] = [];
    let row: { items: ShelfItem[]; w: number; body: number; top: number } | null = null;
    for (const it of items) {
      const w = (it.r * 2 + gap) * scale;
      if (!row || row.w + w > width - pad * 2) {
        row = { items: [], w: 0, body: 0, top: 0 };
        rows.push(row);
      }
      row.items.push(it);
      row.w += w;
      row.top = Math.max(row.top, (it.top ?? 0) * scale);
      row.body = Math.max(row.body, w);
    }
    return rows;
  };
  const total = (rows: { body: number; top: number }[]) => rows.reduce((s, r) => s + r.top + r.body, 0);
  const fits = (scale: number) => total(pack(scale)) <= height - pad * 2;
  let scale = 1;
  if (!fits(1)) {
    // 間隔を縮めると 1 行に入る数も増えるので、収まる一番大きい倍率を二分探索で探す
    let lo = 0.55;
    let hi = 1;
    if (fits(lo)) {
      for (let i = 0; i < 10; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) lo = mid; else hi = mid;
      }
    }
    scale = lo;
  }
  const rows = pack(scale);
  const slots: Slot[] = [];
  let y = pad;
  for (const r of rows) {
    let x = (width - r.w) / 2;
    for (const it of r.items) {
      const w = (it.r * 2 + gap) * scale;
      slots.push({ id: it.id, x: x + w / 2, y: y + r.top + r.body / 2 });
      x += w;
    }
    y += r.top + r.body;
  }
  return slots;
}

/**
 * 指でなぞった線分(p0→p1)の近くにある物体の固定を外し、指の速さで押す。
 * 触れた物体の数を返す
 */
export function sweep(world: World, p0: Vec, p1: Vec, v: Vec, slack = 14): number {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len2 = dx * dx + dy * dy;
  let touched = 0;
  for (const b of world.bodies) {
    if (b.held) continue;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((b.x - p0.x) * dx + (b.y - p0.y) * dy) / len2));
    const cx = p0.x + dx * t;
    const cy = p0.y + dy * t;
    if (Math.hypot(b.x - cx, b.y - cy) > b.r + slack) continue;
    touched++;
    unpin(b);
    b.sleep = 0;
    b.vx = b.vx * 0.3 + v.x * 0.8;
    b.vy = b.vy * 0.3 + v.y * 0.8;
    b.spin += (v.x / b.r) * 0.15;
    clampSpeed(b);
  }
  return touched;
}
