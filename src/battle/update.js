// 戰鬥每一步點行。只改狀態物件，唔掂畫布；數字運算交俾 rules.js。
// 玩家操作（轉車道、發動 OVERDRIVE）都喺呢度，由 controls.js 或者除錯工具叫。

import { TEXT } from '../data/text.js';
import { TUNING } from '../data/tuning.js';
import { HIT_ACTION_TIME } from './actions.js';
import { addNumber, addRing, ageEffects } from './effects.js';
import { stepBullets } from './bullets.js';
import { clearStage } from './combat.js';
import {
  applyContact, applyGate, collectFlightCore, contactApplies, contactLoss, evolutionLevel, fireTier, gainSync, isAirborne,
  isDefeated, isDefeatedPlayer, overdriveDuration, startOverdrive, tickFlight, tickOverdrive,
} from './rules.js';
import { enterStage, makePickup, rowInterval, spawnNextRow } from './spawning.js';

const { world: WORLD, feedback: F } = TUNING;
const SLOTS = TUNING.squad.slots;

/**
 * 行一步。
 * @param {import('./state.js').BattleState} state
 * @param {number} dt  秒
 */
export function updateBattle(state, dt) {
  state.events.length = 0;
  state.t += dt;
  // 飛行：核心倒數、起飛 / 落地
  Object.assign(state.flight, tickFlight(state.flight, dt, TUNING.flight.enabled && state.over > 0));
  // 車道線流動：同門、敵人用同一個速度（純視覺）
  state.scroll += (state.boss ? WORLD.bossPhaseApproachSpeed : WORLD.approachSpeed) * dt;
  state.x += (state.lane - state.x) * Math.min(1, dt * TUNING.player.laneFollow);
  // 隊員各自慢半拍跟上（純畫面，唔影響勝負）
  for (const m of state.squad) {
    const follow = m.index === 0 ? TUNING.player.laneFollow : SLOTS[m.index]?.follow ?? TUNING.player.laneFollow;
    m.x += (state.lane - m.x) * Math.min(1, dt * follow);
    m.lunge = Math.max(0, m.lunge - dt);
    m.sinceAct += dt;
  }

  // 出下一排（首領喺場嗰陣停）
  if (!state.boss) {
    state.spawnT -= dt;
    if (state.spawnT <= 0) {
      const row = spawnNextRow(state);
      // 下一排係首領：隔遠啲先出
      state.spawnT = rowInterval(state) * (state.rows[state.rowIndex]?.kind === 'boss' ? WORLD.bossGap : 1);
      if (row?.kind === 'boss') {
        state.banner = { text: TEXT.banner.bossWarning, t: F.bannerTime, tone: 'alert' };
        state.events.push({ type: 'bossSpawn', stage: state.stageNo });
      }
    }
  }

  // 飛行核心：夠鐘就喺兩排之間出一粒（唔好同門、敵人疊埋一齊）；首領戰冇排，即刻出
  state.flight.nextCore -= dt;
  const half = rowInterval(state) / 2;
  if (TUNING.flight.enabled && state.flight.nextCore <= 0 && (state.boss || (state.spawnT <= half && state.spawnT > half - dt))) {
    state.ents.push(makePickup('flightCore', state.pickRng.pick([-1, 0, 1])));
    state.flight.nextCore = state.pickRng.range(...TUNING.flight.coreInterval);
  }

  // 場上嘅嘢迫近；去到玩家腳線就結算
  const drift = state.boss ? WORLD.bossPhaseApproachSpeed : WORLD.approachSpeed;
  for (const e of state.ents) {
    e.pd = e.d; // 上一步嘅距離：術式陣用嚟判斷「啱啱越過」
    if (e.type === 'enemy' && e.def.approachSpeed !== undefined) {
      e.d = Math.max(e.def.holdDistance ?? 0, e.d - e.def.approachSpeed * dt);
    } else {
      e.d -= (e.type === 'projectile' ? e.speed : drift) * dt;
    }
    if (e.type === 'gate') { e.hit = Math.max(0, e.hit - dt); e.pop = Math.max(0, e.pop - dt); e.flipT = Math.max(0, e.flipT - dt); }
    if (e.type === 'enemy' && e.hit > 0) e.hit -= dt;
    if (e.type === 'enemy' && e.stagger > 0) e.stagger -= dt;
    if (e.d <= 0 && !e.dead) {
      e.dead = true;
      if (e.lane !== state.lane && !e.boss) continue; // 首領佔晒成條路，喺邊條車道都避唔到
      if (e.type === 'gate') passGate(state, e);
      else if (e.type === 'projectile') takeLoss(state, e.dmg);
      else if (e.type === 'pickup') collectPickup(state, e);
      else hitByEnemy(state, e);
    }
  }
  const bossArrived = state.boss?.dead === true; // 首領行到身邊、扣完佢剩低嘅數字
  state.ents = state.ents.filter((e) => !e.dead && !(e.type === 'enemy' && isDefeated(e)));
  if (isDefeatedPlayer(state.power)) { defeat(state); return; }
  if (bossArrived) { clearStage(state); return; } // 扣完仲有剩：捱得過，過關

  // 主角嘅子彈向前飛，飛到嘢先結算（可能打低首領過關）
  stepBullets(state, dt);
  state.ents = state.ents.filter((e) => !(e.type === 'enemy' && isDefeated(e)));

  // 隊員各自按戰鬥風格出手
  for (const member of state.squad) {
    member.behavior.update(state, member, dt);
    if (member.acts !== member.seenActs) { member.seenActs = member.acts; member.sinceAct = 0; }
  }

  state.over = tickOverdrive(state.over, dt);
  for (const z of state.zones) z.t += dt;
  state.zones = state.zones.filter((z) => z.t < z.life);
  ageEffects(state, dt);
  state.shake = Math.max(0, state.shake - dt);
  state.hurt = Math.max(0, state.hurt - dt);
  state.flash = Math.max(0, state.flash - dt);
  state.banner.t = Math.max(0, state.banner.t - dt);
  state.evoT = Math.max(0, state.evoT - dt);
  state.pop.t = Math.max(0, state.pop.t - dt);
}

/** 通過一道門。 */
function passGate(state, gate) {
  const before = state.power;
  state.power = applyGate(before, gate, { overdrive: state.over > 0, gateRules: state.gateRules });
  const up = state.power >= before;
  addNumber(state, { leaderX: state.x }, (up ? '+' : '−') + Math.abs(state.power - before), up ? 'gain' : 'loss', true);
  state.pop = { t: TUNING.headNumber.popTime, tone: up ? 'gain' : 'loss' };
  state.flash = F.gateFlash;
  state.sync = gainSync(state.sync, TUNING.sync.perGate);
  // 火力升級：一個光環提一提
  if (fireTier(state.power) > fireTier(before)) addRing(state, { lane: state.lane, d: 0, hk: 0.2 }, TUNING.firepower.tiers[fireTier(state.power)].color, 1.3);
  // 進化：呢關第一次過門檻先做演出
  const level = evolutionLevel(state.power);
  if (level > state.evo) {
    state.evo = level;
    state.evoT = TUNING.evolution.showTime;
    state.banner = { text: TEXT.banner.evolve, t: TUNING.evolution.showTime, tone: 'info' };
    addRing(state, { lane: state.lane, d: 0, hk: 0.18 }, TUNING.evolution.colors[level] ?? '255,255,255', 2.4);
    state.events.push({ type: 'evolve', level });
  }
}

/** 俾敵人行到身邊（即係未打完）：由攻擊力扣佢頭上剩低嘅數字，隻敵人消失。 */
function hitByEnemy(state, enemy) {
  if (!contactApplies(enemy.def, isAirborne(state.flight))) return; // 飛緊：地面敵人喺腳下經過
  takeLoss(state, contactLoss(enemy.hp, state.contactScale));
}

/** 執到道具。 */
function collectPickup(state, pickup) {
  if (pickup.kind === 'flightCore') {
    Object.assign(state.flight, collectFlightCore(state.flight));
    addRing(state, { lane: state.lane, d: 0, hk: 0.16 }, '95,240,255', 1.6);
  }
  state.events.push({ type: 'pickup', kind: pickup.kind });
}

/** 扣攻擊力，連畫面震動、飄字同頭頂數字跳動。 */
function takeLoss(state, loss) {
  if (loss <= 0) return;
  state.power = applyContact(state.power, loss);
  state.shake = F.contactShake;
  state.hurt = HIT_ACTION_TIME;
  state.pop = { t: TUNING.headNumber.popTime, tone: 'loss' };
  addNumber(state, { leaderX: state.x }, '−' + loss, 'loss', true);
}

/** 攻擊力跌到 0：失敗，由頭重打呢關（攻擊力返去開場數值；SYNC、超載、飛行清零）。 */
function defeat(state) {
  state.events.push({ type: 'defeat', stage: state.stageNo });
  state.banner = { text: TEXT.banner.defeat, t: F.bannerTime, tone: 'alert' };
  state.sync = 0; state.over = 0;
  Object.assign(state.flight, { time: 0, on: false, air: 0 });
  enterStage(state, state.stageNo);
}

// ---------- 玩家操作 ----------

/** 轉去指定車道（-1 左、0 中、1 右）。 */
export function setLane(state, lane) {
  state.lane = Math.max(-1, Math.min(1, Math.round(lane)));
}

/** 向左（-1）或者向右（+1）移一條車道。 */
export function shiftLane(state, delta) {
  setLane(state, state.lane + delta);
}

/**
 * 發動 OVERDRIVE。SYNC 未滿或者已經發動緊就冇反應。
 * @returns {boolean} 有冇發動到
 */
export function triggerOverdrive(state) {
  const duration = overdriveDuration(state.gateRules);
  const next = startOverdrive(state, duration);
  if (!next.started) return false;
  state.sync = next.sync;
  state.over = next.over;
  state.overMax = duration;
  state.banner = { text: TEXT.banner.overdrive, t: F.overdriveBannerTime, tone: 'info' };
  return true;
}
