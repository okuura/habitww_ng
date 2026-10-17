// おもちゃ箱の物理(UI を持たない純粋な関数)。
// 箱の中で円が重力に引かれて落ち、壁と互いにぶつかって転がる。見た目は ToyBox が描く。
// 単位は px と秒。重力の向きは外から渡す(端末の傾き)

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

export function createWorld(width: number, height: number): World {
  return { width, height, bodies: [] };
}

export function addBody(world: World, init: { id: string; x: number; y: number; r: number; vx?: number; vy?: number; angle?: number }): Body {
  const body: Body = {
    id: init.id, x: init.x, y: init.y, vx: init.vx ?? 0, vy: init.vy ?? 0,
    angle: init.angle ?? 0, spin: 0, r: init.r, mass: init.r * init.r, held: false, sleep: 0, px: init.x, py: init.y,
  };
  world.bodies.push(body);
  return body;
}

export const isAsleep = (b: Body) => b.sleep >= SLEEP_FRAMES;

export function wakeAll(world: World) {
  for (const b of world.bodies) b.sleep = 0;
}

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
    if (b.held) continue;
    if (b.x - b.r < 0) { if (record) record.push({ b, nx: 1, ny: 0, vin: -b.vx }); b.x = b.r; }
    if (b.x + b.r > width) { if (record) record.push({ b, nx: -1, ny: 0, vin: b.vx }); b.x = width - b.r; }
    if (b.y - b.r < 0) { if (record) record.push({ b, nx: 0, ny: 1, vin: -b.vy }); b.y = b.r; }
    if (b.y + b.r > height) { if (record) record.push({ b, nx: 0, ny: -1, vin: b.vy }); b.y = height - b.r; }
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
    if (b.held) continue;
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
        const d = Math.sqrt(d2) || 0.001;
        const nx = dx / d;
        const ny = dy / d;
        if (it === 0) contacts.push({ a, b, nx, ny, vn: (b.vx - a.vx) * nx + (b.vy - a.vy) * ny });
        const corr = Math.max(0, minD - d - SLOP) * 0.9;
        if (corr === 0) continue;
        const wa = a.held ? 0 : b.held ? 1 : b.mass / (a.mass + b.mass);
        const wb = b.held ? 0 : a.held ? 1 : a.mass / (a.mass + b.mass);
        a.x -= nx * corr * wa; a.y -= ny * corr * wa;
        b.x += nx * corr * wb; b.y += ny * corr * wb;
      }
    }
    clampWalls(world, it === 0 ? wallHits : null);
  }

  // 速度 = 実際に動いた量(ぶつかって止まった分は自然に消える)
  for (const b of bodies) {
    if (b.held) continue;
    b.vx = (b.x - b.px) / dt;
    b.vy = (b.y - b.py) / dt;
  }

  // 速くぶつかったら跳ね返す。接線方向は摩擦で削って回転にする
  for (const c of contacts) {
    const { a, b, nx, ny } = c;
    const wa = a.held ? 0 : b.held ? 1 : b.mass / (a.mass + b.mass);
    const wb = b.held ? 0 : a.held ? 1 : a.mass / (a.mass + b.mass);
    if (-c.vn > BOUNCE_MIN_SPEED) {
      const dv = -c.vn * BODY_BOUNCE;
      a.vx -= nx * dv * wa; a.vy -= ny * dv * wa;
      b.vx += nx * dv * wb; b.vy += ny * dv * wb;
    }
    const tx = -ny;
    const ty = nx;
    const vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
    a.vx += tx * vt * FRICTION * wa; a.vy += ty * vt * FRICTION * wa;
    b.vx -= tx * vt * FRICTION * wb; b.vy -= ty * vt * FRICTION * wb;
    a.spin += (vt / a.r) * 0.25;
    b.spin += (vt / b.r) * 0.25;
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
    if (Math.hypot(b.vx, b.vy) < SLEEP_SPEED && Math.abs(b.spin) < 0.6) {
      b.vx = 0; b.vy = 0; b.spin = 0;
      b.sleep = Math.min(b.sleep + 1, SLEEP_FRAMES);
    } else {
      b.sleep = 0;
    }
  }
  return hits;
}

/** 振った: 全部に、重力と逆向き(上)+ 横ばらつきの撃力 */
export function impulseAll(world: World, strength: number, gravity: Vec, rand: () => number = Math.random) {
  const g = Math.hypot(gravity.x, gravity.y) || 1;
  const ux = -gravity.x / g;
  const uy = -gravity.y / g;
  for (const b of world.bodies) {
    if (b.held) continue;
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
