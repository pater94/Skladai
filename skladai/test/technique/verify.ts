/**
 * Harness weryfikacji techniki modelu 3D.
 *
 * Buduje tę samą hierarchię szkieletu co MuscleModel3D (bez renderera), nakłada
 * postawę + pozycję ćwiczenia i liczy ŚWIATOWE pozycje stawów. Następnie
 * sprawdza reguły techniczne — dzięki temu „czy model wykonuje ćwiczenie
 * poprawnie" jest mierzalne, a nie oceniane na oko.
 */
import * as THREE from "three";
import { SKELETON, type SegmentId } from "../../lib/anatomy/muscles3d";
import { EXERCISE_ANATOMY } from "../../lib/anatomy/exercises";
import { archetypeOf } from "../../components/forma/anatomyMotion";
import { STANCES, poseFor, mergePose, type Pose } from "../../components/forma/exercisePose";

const HIP_Y = 0.92;

export interface Joints {
  hip: THREE.Vector3; shoulder: THREE.Vector3; elbow: THREE.Vector3; wrist: THREE.Vector3;
  knee: THREE.Vector3; ankle: THREE.Vector3; headTop: THREE.Vector3; chest: THREE.Vector3;
}

/** Liczy pozycje stawów prawej strony ciała dla zadanej postawy i pozy. */
export function solve(stanceName: keyof typeof STANCES, pose: Pose): Joints {
  const st = STANCES[stanceName];
  const root = new THREE.Group();
  root.position.set(...st.rootPos);
  root.rotation.set(...st.rootRot);
  const bodyOffset = new THREE.Group();
  bodyOffset.position.y = -HIP_Y;
  root.add(bodyOffset);

  const groups: Record<string, THREE.Group> = {};
  const key = (id: SegmentId) => id;
  for (const seg of SKELETON) {
    const g = new THREE.Group();
    const [ox, oy, oz] = seg.origin;
    g.position.set(ox, oy, oz); // strona PRAWA (x>0)
    const parent = seg.parent ? groups[key(seg.parent)] : null;
    (parent ?? bodyOffset).add(g);
    const p = pose[seg.id];
    if (p) g.rotation.set(p[0], p[1], p[2]);
    groups[key(seg.id)] = g;
  }
  root.updateMatrixWorld(true);

  const at = (id: SegmentId, localY: number) => {
    const v = new THREE.Vector3(0, localY, 0);
    groups[key(id)].localToWorld(v);
    return v;
  };
  const len = (id: SegmentId) => SKELETON.find((s) => s.id === id)!.length;

  // KOTWICA: przesuń całe ciało tak, by stopy zostały na podłodze (przysiad)
  // albo dłonie na drążku (podciąganie) — bez tego sylwetka „unosi się" w miejscu.
  if (st.anchor) {
    const cur = st.anchor.joint === "ankle" ? at("shin", -len("shin"))
      : st.anchor.joint === "shoulder" ? at("upperArm", 0)
      : at("foreArm", -len("foreArm"));
    root.position.y += st.anchor.y - cur.y;
    root.updateMatrixWorld(true);
  }

  return {
    hip: at("thigh", 0),
    knee: at("thigh", -len("thigh")),
    ankle: at("shin", -len("shin")),
    shoulder: at("upperArm", 0),
    elbow: at("upperArm", -len("upperArm")),
    wrist: at("foreArm", -len("foreArm")),
    chest: at("torso", len("torso") * 0.62),
    headTop: at("head", len("head")),
  };
}

// ── reguły techniczne ──
type Rule = (top: Joints, bottom: Joints) => string | null;
const R = {
  /** Tors poziomo (leżenie / podpór). */
  torsoHorizontal: (tol = 0.18): Rule => (t, b) => {
    const best = Math.min(Math.abs(t.chest.y - t.hip.y), Math.abs(b.chest.y - b.hip.y));
    return best < tol ? null : `tors nie jest poziomy (Δy=${best.toFixed(2)})`;
  },
  /** Tors pionowo (stanie / siad). */
  torsoUpright: (min = 0.24): Rule => (t, b) => {
    const best = Math.max(t.chest.y - t.hip.y, b.chest.y - b.hip.y);
    return best > min ? null : `tors nie jest wyprostowany (Δy=${best.toFixed(2)})`;
  },
  /** Stopy przy podłodze. */
  feetDown: (maxY = 0.22): Rule => (t, b) => {
    const best = Math.min(t.ankle.y, b.ankle.y);
    return best < maxY ? null : `stopy w powietrzu (y=${best.toFixed(2)})`;
  },
  /** Nadgarstek wyżej niż bark (wyciskanie w górę / nad głowę). */
  wristAboveShoulder: (min = 0.25): Rule => (t, b) => {
    const best = Math.max(t.wrist.y - t.shoulder.y, b.wrist.y - b.shoulder.y);
    return best > min ? null : `ręce nie wypchnięte w górę (max Δ=${best.toFixed(2)})`;
  },
  /** Ciężar zostaje nad klatką, nie wędruje nad głowę (test na „francuskie"). */
  barOverChest: (maxDz = 0.28): Rule => (t, b) => {
    const dTop = Math.abs(t.wrist.z - t.chest.z), dBot = Math.abs(b.wrist.z - b.chest.z);
    return Math.max(dTop, dBot) < maxDz ? null : `sztanga ucieka poza klatkę (Δz góra=${dTop.toFixed(2)}, dół=${dBot.toFixed(2)})`;
  },
  /** W dolnej fazie nadgarstek schodzi do poziomu klatki. */
  bottomAtChest: (maxAbove = 0.30): Rule => (_t, b) =>
    b.wrist.y - b.chest.y < maxAbove ? null : `dół ruchu za wysoko (Δ=${(b.wrist.y - b.chest.y).toFixed(2)})`,
  /** Biodra schodzą (przysiad / suwnica). */
  hipsDrop: (min = 0.18): Rule => (t, b) =>
    Math.abs(t.hip.y - b.hip.y) > min ? null : `biodra nie zmieniają wysokości (${t.hip.y.toFixed(2)} vs ${b.hip.y.toFixed(2)})`,
  /** Kolano zgina się (kąt udo-podudzie). */
  kneeBends: (minDeg = 55): Rule => (t, b) => {
    const angOf = (j: Joints) => {
      const th = new THREE.Vector3().subVectors(j.knee, j.hip).normalize();
      const sh = new THREE.Vector3().subVectors(j.ankle, j.knee).normalize();
      return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(th.dot(sh), -1, 1)));
    };
    const best = Math.max(angOf(t), angOf(b));
    return best > minDeg ? null : `kolano nigdzie się nie zgina (max ${best.toFixed(0)}°)`;
  },
  /** Łokieć się prostuje na końcu ruchu. */
  elbowExtends: (maxDeg = 30): Rule => (t, b) => {
    const angOf = (j: Joints) => {
      const ua = new THREE.Vector3().subVectors(j.elbow, j.shoulder).normalize();
      const fa = new THREE.Vector3().subVectors(j.wrist, j.elbow).normalize();
      return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(ua.dot(fa), -1, 1)));
    };
    const best = Math.min(angOf(t), angOf(b));
    return best < maxDeg ? null : `łokieć nigdzie nie jest wyprostowany (min ${best.toFixed(0)}°)`;
  },
  /** Łokieć się zgina w fazie skurczu. */
  elbowFlexes: (minDeg = 60): Rule => (t, b) => {
    const angOf = (j: Joints) => {
      const ua = new THREE.Vector3().subVectors(j.elbow, j.shoulder).normalize();
      const fa = new THREE.Vector3().subVectors(j.wrist, j.elbow).normalize();
      return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(ua.dot(fa), -1, 1)));
    };
    const best = Math.max(angOf(t), angOf(b));
    return best > minDeg ? null : `łokieć się nie zgina (max ${best.toFixed(0)}°)`;
  },
  /** Ręce ponad głową (podciąganie, ściąganie drążka, OHP). */
  handsOverhead: (): Rule => (t, b) => {
    const best = Math.max(t.wrist.y - t.headTop.y, b.wrist.y - b.headTop.y);
    return best > -0.10 ? null : `ręce nie sięgają nad głowę (max Δ=${best.toFixed(2)})`;
  },
  /** Ciało unosi się (podciąganie). */
  bodyRises: (min = 0.15): Rule => (t, b) =>
    Math.abs(t.chest.y - b.chest.y) > min ? null : `ciało się nie unosi (Δ=${Math.abs(t.chest.y - b.chest.y).toFixed(2)})`,
  /** Ręce rozłożone na boki (wznosy bokiem). */
  armsOut: (min = 0.30): Rule => (t, b) => {
    const best = Math.max(t.wrist.x - t.shoulder.x, b.wrist.x - b.shoulder.x);
    return best > min ? null : `ręce nie odwiedzione (max Δx=${best.toFixed(2)})`;
  },
  /** Podudzie prostuje się (prostowanie nóg). */
  shinExtends: (): Rule => (t, b) => {
    const best = Math.max(t.ankle.z - t.knee.z, b.ankle.z - b.knee.z);
    return best > 0.15 ? null : `podudzie nie prostuje się w przód (max Δz=${best.toFixed(2)})`;
  },
  /** Pięta jedzie do pośladka (uginanie nóg). */
  heelToGlute: (): Rule => (_t, b) =>
    Math.abs(b.ankle.z - b.knee.z) > 0.18 || Math.abs(b.ankle.y - b.knee.y) > 0.18 ? null : "pięta nie jedzie do pośladka",
};

/** Reguły per ćwiczenie; klucz "*<archetyp>" = domyślne dla wzorca. */
export const RULES: Record<string, Rule[]> = {
  // ── wyciskanie leżąc: tors poziomo, stopy na podłodze, sztanga nad klatką ──
  bench_flat: [R.torsoHorizontal(), R.feetDown(), R.wristAboveShoulder(), R.barOverChest(), R.bottomAtChest(), R.elbowExtends(), R.elbowFlexes()],
  db_bench:   [R.torsoHorizontal(), R.feetDown(), R.wristAboveShoulder(), R.barOverChest(), R.elbowExtends(), R.elbowFlexes()],
  bench_decline: [R.torsoHorizontal(), R.wristAboveShoulder(), R.barOverChest(), R.elbowExtends()],
  close_grip_bench: [R.torsoHorizontal(), R.feetDown(), R.wristAboveShoulder(), R.barOverChest(), R.elbowExtends(), R.elbowFlexes()],
  fly:        [R.torsoHorizontal(), R.feetDown(), R.wristAboveShoulder(), R.armsOut()],
  machine_press: [R.torsoUpright(), R.elbowExtends(), R.elbowFlexes()],
  bench_incline: [R.wristAboveShoulder(), R.elbowExtends(), R.elbowFlexes()],
  db_incline:    [R.wristAboveShoulder(), R.elbowExtends(), R.elbowFlexes()],

  // ── francuskie: TU sztanga MA iść nad głowę (odwrotnie niż w wyciskaniu) ──
  skullcrusher: [R.torsoHorizontal(), R.wristAboveShoulder(), R.elbowExtends(), R.elbowFlexes()],
  pullover:     [R.torsoHorizontal(), R.feetDown()],

  // ── ciągnięcie pionowe ──
  pullup:         [R.torsoUpright(), R.handsOverhead(), R.bodyRises(), R.elbowFlexes()],
  chinup:         [R.torsoUpright(), R.handsOverhead(), R.bodyRises(), R.elbowFlexes()],
  pullup_neutral: [R.torsoUpright(), R.handsOverhead(), R.bodyRises(), R.elbowFlexes()],
  lat_pulldown:   [R.torsoUpright(), R.handsOverhead(), R.elbowFlexes()],

  // ── ciągnięcie poziome ──
  bb_row:    [R.elbowFlexes(), R.elbowExtends()],
  db_row:    [R.elbowFlexes()],
  tbar_row:  [R.elbowFlexes()],
  cable_row: [R.elbowFlexes()],

  // ── barki / ramiona ──
  ohp:          [R.torsoUpright(), R.handsOverhead(), R.elbowExtends(), R.elbowFlexes()],
  db_ohp:       [R.handsOverhead(), R.elbowExtends(), R.elbowFlexes()],
  lateral_raise:[R.torsoUpright(), R.armsOut()],
  bb_curl:      [R.torsoUpright(), R.elbowFlexes()],
  db_curl:      [R.torsoUpright(), R.elbowFlexes()],
  hammer_curl:  [R.torsoUpright(), R.elbowFlexes()],
  cable_curl:   [R.torsoUpright(), R.elbowFlexes()],
  pushdown:     [R.torsoUpright(), R.elbowExtends(), R.elbowFlexes()],
  overhead_ext: [R.elbowExtends(), R.elbowFlexes()],

  // ── nogi ──
  squat:        [R.torsoUpright(0.25), R.hipsDrop(), R.kneeBends()],
  front_squat:  [R.torsoUpright(0.25), R.hipsDrop(), R.kneeBends()],
  goblet_squat: [R.torsoUpright(0.25), R.hipsDrop(), R.kneeBends()],
  hack_squat:   [R.hipsDrop(), R.kneeBends()],
  lunges:       [R.hipsDrop(), R.kneeBends()],
  bulgarian:    [R.hipsDrop(), R.kneeBends()],
  leg_press:    [R.kneeBends()],
  deadlift:     [R.hipsDrop(0.05)],
  rdl:          [R.hipsDrop(0.02)],
  leg_extension:[R.shinExtends(), R.kneeBends()],
  leg_curl:     [R.heelToGlute()],
  hip_thrust:   [R.hipsDrop(0.05), R.kneeBends()],
  good_morning:  [R.hipsDrop(0.02), R.torsoUpright()],
  sumo_deadlift: [R.hipsDrop(0.05), R.kneeBends(30)],
  smith_squat:   [R.torsoUpright(0.25), R.hipsDrop(), R.kneeBends()],
  step_up:       [R.hipsDrop(), R.kneeBends()],
  seated_leg_curl: [R.heelToGlute(), R.kneeBends()],
  hip_abduction: [R.torsoUpright()],
  hip_adduction: [R.torsoUpright()],
  glute_kickback:[R.kneeBends(30)],

  // ── core / masa ciała ──
  pushup:    [R.torsoHorizontal(0.30), R.elbowExtends(), R.elbowFlexes()],
  diamond_pushup: [R.torsoHorizontal(0.30), R.elbowExtends(), R.elbowFlexes()],
  plank:     [R.torsoHorizontal(0.30)],
  dips:      [R.elbowExtends(), R.elbowFlexes()],
  leg_raise: [R.handsOverhead()],
};

// ── uruchomienie ──
export function runTechniqueCheck() {
  let fails = 0, checks = 0;
  const report: string[] = [];

  for (const ex of EXERCISE_ANATOMY) {
    const rules = RULES[ex.id];
    if (!rules) continue;
    const mv = poseFor(ex, archetypeOf(ex));
    const base = STANCES[mv.stance].base;
    const bottom = solve(mv.stance, mergePose(base, mv.start));
    const top = solve(mv.stance, mergePose(base, mv.end));
    const errs = rules.map((r) => r(top, bottom)).filter(Boolean) as string[];
    checks += rules.length;
    if (errs.length) {
      fails += errs.length;
      report.push(`❌ ${ex.name} [${mv.stance}]`);
      errs.forEach((e) => report.push(`      ${e}`));
    } else {
      report.push(`✅ ${ex.name} [${mv.stance}]`);
    }
  }

  console.log(report.join("\n"));
  console.log(`\nSprawdzeń: ${checks} | Błędów: ${fails}`);
  process.exit(fails ? 1 : 0);
}


if (process.argv[1] && /verify.ts$/.test(process.argv[1])) runTechniqueCheck();
