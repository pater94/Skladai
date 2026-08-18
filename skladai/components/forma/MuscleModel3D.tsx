"use client";

/**
 * FORMA — Interaktywny model 3D mięśni.
 *
 * • Obracanie w każdą stronę (przeciągnij), przybliżanie (szczypnij / kółko).
 * • Każda GŁOWA mięśnia to osobna bryła — klikasz konkretną głowę, nie całą partię.
 * • Kolor bryły = intensywność pracy w danym ćwiczeniu (ta sama skala cieplna
 *   co na planszy 2D). Mięśnie nieaktywne są szare i półprzezroczyste.
 * • Hierarchia stawów (miednica → tors → ramię → przedramię; biodro → udo →
 *   podudzie) pozwala ustawiać pozycje ćwiczeń — mięśnie jadą razem z kością.
 *
 * Three.js ładuje się dynamicznie dopiero przy wejściu w ten widok.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { MUSCLES, type MuscleId } from "@/lib/anatomy/muscles";
import { SKELETON, MUSCLES_3D, type SegmentId } from "@/lib/anatomy/muscles3d";
import type { MuscleActivation } from "@/lib/anatomy/exercises";
import type { Pose, StanceDef, Equipment } from "./exercisePose";

const HEAT = ["#5b6472", "#d99a2b", "#f08a2c", "#f2621f", "#e0231c"];
const INACTIVE = "#3a4049";

export interface Pick { muscle: MuscleId; head?: string }

function contributionOf(act: MuscleActivation | undefined, headId?: string): number | null {
  if (!act) return null;
  if (!headId) return act.share;
  if (!act.heads) return act.share / Math.max(1, MUSCLES[act.muscle].heads.length);
  const pct = act.heads[headId];
  if (pct == null) return 0;
  return (act.share * pct) / 100;
}
function levelOf(c: number | null): number {
  if (c == null) return -1;
  if (c >= 15) return 4;
  if (c >= 8) return 3;
  if (c >= 4) return 2;
  if (c >= 1.5) return 1;
  return 0;
}

interface MeshInfo { muscle: MuscleId; head?: string; level: number; base: THREE.Color }

export default function MuscleModel3D({
  activation, onPick, selected, pose, stance, equipment, cableAt,
}: {
  activation: MuscleActivation[];
  onPick: (p: Pick) => void;
  selected: Pick | null;
  /** Docelowe kąty w stawach (pozycja ćwiczenia). */
  pose?: Pose | null;
  /** Postawa ciała: leżąc / w siadzie / w opadzie / w zwisie… */
  stance?: StanceDef | null;
  /** Sprzęt trzymany w dłoniach. */
  equipment?: Equipment | null;
  /** Pozycja bloczka wyciągu — skąd biegnie linka. */
  cableAt?: [number, number, number] | null;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoverName, setHoverName] = useState<string | null>(null);

  // referencje żywe — używane w pętli renderującej bez restartu sceny
  const selRef = useRef<Pick | null>(selected);
  const poseRef = useRef<Pose | null | undefined>(pose);
  const stanceRef = useRef<StanceDef | null | undefined>(stance);
  const equipRef = useRef<Equipment | null | undefined>(equipment);
  const cableRef = useRef<[number, number, number] | null | undefined>(cableAt);
  const actRef = useRef<MuscleActivation[]>(activation);
  useEffect(() => { selRef.current = selected; }, [selected]);
  useEffect(() => { poseRef.current = pose; }, [pose]);
  useEffect(() => { stanceRef.current = stance; }, [stance]);
  useEffect(() => { equipRef.current = equipment; }, [equipment]);
  useEffect(() => { cableRef.current = cableAt; }, [cableAt]);
  useEffect(() => { actRef.current = activation; }, [activation]);

  const applyRef = useRef<(() => void) | null>(null);
  useEffect(() => { applyRef.current?.(); }, [activation, selected]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 340;
    const height = 460;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(1.75, 1.35, 2.95); // ujęcie 3/4 — pozycje ćwiczeń czytelniejsze niż z przodu

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // światła — ciepłe kluczowe + chłodne dopełnienie, żeby bryły miały formę
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff2e0, 1.5); key.position.set(2, 3, 3); scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fc6ff, 0.7); fill.position.set(-3, 1, -2); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(0, 2, -4); scene.add(rim);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.02, 0);
    controls.minDistance = 1.6;
    controls.maxDistance = 6;
    controls.enablePan = false;

    // ── szkielet: grupy segmentów (parent-child), osobno dla L i R ──
    const groups: Record<string, THREE.Group> = {};
    // root ma origin W BIODRACH — dzięki temu obrót postawy (leżenie, opad,
    // odchylenie w suwnicy) odbywa się wokół bioder, a nie wokół podłogi.
    const HIP_Y = 0.92;
    const root = new THREE.Group();
    const bodyOffset = new THREE.Group();
    bodyOffset.position.y = -HIP_Y;
    root.add(bodyOffset);
    scene.add(root);

    const keyOf = (id: SegmentId, side: "L" | "R" | "C") => `${id}:${side}`;
    for (const seg of SKELETON) {
      const sides: Array<"L" | "R" | "C"> = seg.paired ? ["L", "R"] : ["C"];
      for (const side of sides) {
        const g = new THREE.Group();
        const [ox, oy, oz] = seg.origin;
        const x = side === "L" ? -ox : ox;
        g.position.set(x, oy, oz);
        const parentKey = seg.parent ? keyOf(seg.parent, seg.paired && SKELETON.find((s) => s.id === seg.parent)?.paired ? side : "C") : null;
        (parentKey && groups[parentKey] ? groups[parentKey] : bodyOffset).add(g);
        groups[keyOf(seg.id, side)] = g;
      }
    }

    // ── poglądowa sylwetka ciała (półprzezroczysta) ──
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x93a0b2, transparent: true, opacity: 0.28, roughness: 0.9, metalness: 0,
      depthWrite: false,
    });

    /** Profil tułowia: barki szerokie, talia wcięta, miednica szersza. */
    const torsoProfile = [
      [0.128, 0.00], [0.120, 0.08], [0.113, 0.17], [0.118, 0.26],
      [0.134, 0.35], [0.150, 0.43], [0.152, 0.50], [0.120, 0.56], [0.055, 0.575],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const torsoGeo = new THREE.LatheGeometry(torsoProfile, 22);

    for (const seg of SKELETON) {
      const sides: Array<"L" | "R" | "C"> = seg.paired ? ["L", "R"] : ["C"];
      for (const side of sides) {
        const g = groups[keyOf(seg.id, side)];
        if (!g) continue;
        let geo: THREE.BufferGeometry;
        if (seg.id === "torso") geo = torsoGeo;
        else if (seg.id === "head") geo = new THREE.SphereGeometry(seg.radius, 20, 16);
        else if (seg.id === "hand" || seg.id === "foot") geo = new THREE.BoxGeometry(seg.radius * 1.7, seg.length, seg.radius * 2.4);
        else geo = new THREE.CapsuleGeometry(seg.radius, Math.max(0.01, seg.length - seg.radius * 2), 6, 14);

        const m = new THREE.Mesh(geo, skinMat);
        // tors i szyja rosną W GÓRĘ od stawu; kończyny zwisają W DÓŁ
        m.position.y = seg.id === "torso" ? 0
          : seg.id === "head" ? seg.length * 0.34
          : seg.id === "neck" ? seg.length / 2
          : -seg.length / 2;
        if (seg.id === "foot") m.position.z = seg.length * 0.28; // stopa wysunięta do przodu
        m.userData.skin = true;
        g.add(m);

        // kula w stawie — bez niej kończyny „urywają się" i model rozpada się na bryły
        if (seg.id !== "torso" && seg.id !== "head") {
          const j = new THREE.Mesh(new THREE.SphereGeometry(seg.radius * 1.06, 14, 10), skinMat);
          g.add(j);
        }
      }
    }

    // ── uchwyty dłoni (koniec przedramienia) — do trzymania sprzętu ──
    const handAnchors: Record<"L" | "R", THREE.Object3D> = {} as never;
    for (const side of ["L", "R"] as const) {
      const fore = groups[keyOf("foreArm", side)];
      if (!fore) continue;
      const a = new THREE.Object3D();
      a.position.set(0, -(SKELETON.find((s) => s.id === "foreArm")!.length + 0.03), 0);
      fore.add(a);
      handAnchors[side] = a;
    }

    // ── SPRZĘT trzymany w dłoniach ──
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9c2cf, roughness: 0.35, metalness: 0.75 });
    const plate = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.6, metalness: 0.3 });
    const rope = new THREE.MeshStandardMaterial({ color: 0x76808f, roughness: 0.9 });

    // sztanga: gryf + talerze
    const barbell = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.52, 12), steel);
    shaft.rotation.z = Math.PI / 2; barbell.add(shaft);
    for (const sx of [-0.62, 0.62]) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.045, 18), plate);
      d.rotation.z = Math.PI / 2; d.position.x = sx; barbell.add(d);
    }
    scene.add(barbell);

    // hantle: dwa krótkie gryfy z talerzami
    const dumbbells: THREE.Group[] = [];
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.20, 10), steel);
      h.rotation.z = Math.PI / 2; g.add(h);
      for (const sx of [-0.11, 0.11]) {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 14), plate);
        d.rotation.z = Math.PI / 2; d.position.x = sx; g.add(d);
      }
      scene.add(g); dumbbells.push(g);
    }

    // wyciąg: uchwyt + linka biegnąca do bloczka
    const cableHandle = new THREE.Group();
    const cableBar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.42, 10), steel);
    cableBar.rotation.z = Math.PI / 2; cableHandle.add(cableBar);
    scene.add(cableHandle);
    const cableLine = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 6), rope);
    scene.add(cableLine);

    // maszyna: rama + siedzisko z oparciem
    const machine = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x39414d, roughness: 0.75, metalness: 0.2 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 0.09), frameMat);
    post.position.set(0, 0.75, -0.62); machine.add(post);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.09), frameMat);
    rail.position.set(0, 0.06, -0.62); machine.add(rail);
    scene.add(machine);

    // ── REKWIZYTY POSTAWY (ławka / siedzisko / drążek / podłoga) ──
    const gearMat = new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.85, metalness: 0.1 });
    const props: Record<string, THREE.Object3D> = {};

    const bench = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 1.62), gearMat);
    pad.position.set(0, 0.405, -0.10); bench.add(pad);
    for (const pz of [-0.78, 0.60]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.36, 0.08), frameMat);
      leg.position.set(0, 0.18, pz); bench.add(leg);
    }
    scene.add(bench); props.bench = bench;

    const inclineBench = new THREE.Group();
    const iPad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 1.10), gearMat);
    iPad.position.set(0, 0.52, -0.05); iPad.rotation.x = 42 * (Math.PI / 180); inclineBench.add(iPad);
    const iLeg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08), frameMat);
    iLeg.position.set(0, 0.25, 0.32); inclineBench.add(iLeg);
    scene.add(inclineBench); props.inclineBench = inclineBench;

    const seat = new THREE.Group();
    const sPad = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.09, 0.42), gearMat);
    sPad.position.set(0, 0.52, 0.02); seat.add(sPad);
    const sBack = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.62, 0.09), gearMat);
    sBack.position.set(0, 0.84, -0.22); seat.add(sBack);
    const sLeg = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.48, 0.10), frameMat);
    sLeg.position.set(0, 0.24, 0); seat.add(sLeg);
    scene.add(seat); props.seat = seat;

    const barProp = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.30, 12), steel);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.14, 0); barProp.add(bar);
    for (const sx of [-0.62, 0.62]) {
      const up = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.14, 0.07), frameMat);
      up.position.set(sx, 1.07, 0); barProp.add(up);
    }
    scene.add(barProp); props.bar = barProp;

    const sled = new THREE.Group();
    const platform = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.08, 0.55), gearMat);
    platform.position.set(0, 0.95, -0.78); platform.rotation.x = -32 * (Math.PI / 180); sled.add(platform);
    const backPad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.95), gearMat);
    backPad.position.set(0, 0.40, 0.30); backPad.rotation.x = 32 * (Math.PI / 180); sled.add(backPad);
    scene.add(sled); props.legPressSled = sled;

    // Podłoga z miękką krawędzią — twarda tarcza ucinała się w kadrze jak talerz.
    const floorTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const g = c.getContext("2d")!;
      const rg = g.createRadialGradient(64, 64, 8, 64, 64, 64);
      rg.addColorStop(0, "rgba(255,255,255,1)");
      rg.addColorStop(0.62, "rgba(255,255,255,0.85)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2),
      new THREE.MeshBasicMaterial({ color: 0x1a1f27, map: floorTex, transparent: true, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.005;
    scene.add(floor); props.floor = floor;

    /**
     * Cień kontaktowy — miękka plama pod sylwetką. Bez niego postać wyglądała
     * jakby unosiła się nad podłogą; cień „przykleja" ją do ziemi.
     */
    const shadowTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const g = c.getContext("2d")!;
      const rg = g.createRadialGradient(64, 64, 2, 64, 64, 62);
      rg.addColorStop(0, "rgba(0,0,0,0.85)");
      rg.addColorStop(0.5, "rgba(0,0,0,0.42)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.004;
    scene.add(contactShadow);

    // ── mięśnie ──
    const meshes: THREE.Mesh[] = [];
    const info = new Map<THREE.Mesh, MeshInfo>();

    /**
     * Brzusiec mięśnia jest WRZECIONOWATY — gruby w środku, zbiegający do ścięgien
     * na obu końcach. Kula dawała efekt „kulek naklejonych na patyk"; wrzeciono
     * od razu czyta się jak mięsień. Wpisane w tę samą jednostkową bryłę co kula,
     * więc dotychczasowe wartości `scale` działają bez zmian.
     */
    const spindlePts: THREE.Vector2[] = [];
    const SEG = 14;
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const r = Math.pow(Math.sin(Math.PI * t), 0.62);
      spindlePts.push(new THREE.Vector2(Math.max(0.004, r), -1 + 2 * t));
    }
    const sphere = new THREE.LatheGeometry(spindlePts, 18);

    for (const m3 of MUSCLES_3D) {
      const sides: Array<"L" | "R" | "C"> = m3.center ? ["C"] : ["L", "R"];
      for (const side of sides) {
        const segPaired = SKELETON.find((s) => s.id === m3.segment)?.paired;
        const gKey = keyOf(m3.segment, segPaired ? (side === "C" ? "R" : side) : "C");
        const g = groups[gKey];
        if (!g) continue;
        const mat = new THREE.MeshStandardMaterial({ color: INACTIVE, roughness: 0.62, metalness: 0.05, transparent: true, opacity: 0.35 });
        const mesh = new THREE.Mesh(sphere, mat);
        const [px, py, pz] = m3.pos;
        // dla segmentów parzystych bryła jest już w lokalnym układzie danej strony
        mesh.position.set(segPaired ? px : side === "L" ? -px : px, py, pz);
        mesh.scale.set(...m3.scale);
        if (m3.rot) mesh.rotation.set(...m3.rot);
        g.add(mesh);
        meshes.push(mesh);
        info.set(mesh, { muscle: m3.muscle, head: m3.head, level: -1, base: new THREE.Color(INACTIVE) });
      }
    }

    /** Przemalowanie wg aktywacji + podświetlenie wyboru. */
    const apply = () => {
      const byMuscle = new Map<MuscleId, MuscleActivation>();
      actRef.current.forEach((a) => byMuscle.set(a.muscle, a));
      const sel = selRef.current;
      for (const mesh of meshes) {
        const nfo = info.get(mesh)!;
        const act = byMuscle.get(nfo.muscle);
        const lvl = levelOf(contributionOf(act, nfo.head));
        nfo.level = lvl;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const isSel = !!sel && sel.muscle === nfo.muscle && (!sel.head || sel.head === nfo.head);
        mat.color.set(lvl >= 0 ? HEAT[lvl] : INACTIVE);
        // poziom 0 = mięsień ledwie pracuje → ma się cofnąć, żeby gorące partie
        // czytały się jak mapa cieplna, a nie ginęły w tłumie szarych bryłek
        mat.opacity = lvl >= 1 ? 0.97 : lvl === 0 ? 0.5 : 0.22;
        mat.emissive.set(isSel ? 0xffffff : 0x000000);
        mat.emissiveIntensity = isSel ? 0.42 : 0;
        nfo.base.set(mat.color.getHex());
      }
    };
    applyRef.current = apply;
    apply();

    // ── klikanie / wskazywanie ──
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt = { x: 0, y: 0, t: 0 };

    const pickAt = (clientX: number, clientY: number) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(meshes, false);
      return hits.length ? info.get(hits[0].object as THREE.Mesh) ?? null : null;
    };

    const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY, t: Date.now() }; };
    const onUp = (e: PointerEvent) => {
      // odróżnij kliknięcie od obracania
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      if (moved > 8 || Date.now() - downAt.t > 600) return;
      const hit = pickAt(e.clientX, e.clientY);
      if (hit) onPick({ muscle: hit.muscle, head: hit.head });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const hit = pickAt(e.clientX, e.clientY);
      const mu = hit ? MUSCLES[hit.muscle] : null;
      const hd = hit?.head ? mu?.heads.find((h) => h.id === hit.head) : undefined;
      setHoverName(mu ? (hd ? `${mu.name} — ${hd.name}` : mu.name) : null);
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.touchAction = "none";

    // ── pętla renderująca (pozycja ćwiczenia + delikatny puls pracy) ──
    let raf = 0;
    const clock = new THREE.Clock();
    const focus = new THREE.Vector3();
    const shift = new THREE.Vector3();
    const render = () => {
      raf = requestAnimationFrame(render);
      const t = clock.getElapsedTime();

      // płynne dochodzenie do docelowej pozycji stawów
      const p = poseRef.current;
      for (const seg of SKELETON) {
        for (const side of (seg.paired ? ["L", "R"] : ["C"]) as Array<"L" | "R" | "C">) {
          const g = groups[keyOf(seg.id, side)];
          if (!g) continue;
          const target = p?.[seg.id];
          const sign = side === "L" ? -1 : 1;
          const tx = target ? target[0] : 0;
          const ty = target ? target[1] * sign : 0;
          const tz = target ? target[2] * sign : 0;
          g.rotation.x += (tx - g.rotation.x) * 0.12;
          g.rotation.y += (ty - g.rotation.y) * 0.12;
          g.rotation.z += (tz - g.rotation.z) * 0.12;
        }
      }

      // ── POSTAWA: obrót i przesunięcie całej sylwetki (leżąc / w siadzie / w opadzie) ──
      const st = stanceRef.current;
      const rp = st?.rootPos ?? [0, 0, 0];
      const rr = st?.rootRot ?? [0, 0, 0];
      root.position.x += (rp[0] - root.position.x) * 0.1;
      root.position.y += (rp[1] - root.position.y) * 0.1;
      root.position.z += (rp[2] - root.position.z) * 0.1;
      root.rotation.x += (rr[0] - root.rotation.x) * 0.1;
      root.rotation.y += (rr[1] - root.rotation.y) * 0.1;
      root.rotation.z += (rr[2] - root.rotation.z) * 0.1;

      // ── REKWIZYTY: rekwizyt postawy + ZAWSZE podłoga ──
      // Bez podłogi ławka i drążek wisiały w próżni, a model wyglądał jakby
      // lewitował. Podłoga daje punkt odniesienia „gdzie jest ziemia".
      const wantProp = st?.prop ?? "floor";
      for (const [name, obj] of Object.entries(props)) obj.visible = name === wantProp || name === "floor";

      // ── SPRZĘT: umieść w dłoniach, zgodnie z ich realnym położeniem ──
      const eq = equipRef.current ?? "bodyweight";
      const hl = new THREE.Vector3(), hr = new THREE.Vector3();
      if (handAnchors.L && handAnchors.R) {
        handAnchors.L.getWorldPosition(hl);
        handAnchors.R.getWorldPosition(hr);
      }
      const mid = hl.clone().add(hr).multiplyScalar(0.5);
      const span = hr.clone().sub(hl);

      barbell.visible = eq === "barbell";
      if (barbell.visible) {
        barbell.position.copy(mid);
        // obróć gryf tak, by przechodził przez obie dłonie
        barbell.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), span.clone().normalize());
      }
      dumbbells.forEach((d, i) => {
        d.visible = eq === "dumbbells";
        if (!d.visible) return;
        d.position.copy(i === 0 ? hl : hr);
        d.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), span.clone().normalize());
      });
      cableHandle.visible = eq === "cable";
      cableLine.visible = eq === "cable";
      if (cableHandle.visible) {
        cableHandle.position.copy(mid);
        cableHandle.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), span.clone().normalize());
        // linka od bloczka do uchwytu; pozycja bloczka z definicji ćwiczenia,
        // a gdy jej brak — zgadywana z wysokości dłoni
        const ca = cableRef.current;
        const pulley = ca ? new THREE.Vector3(ca[0], ca[1], ca[2])
          : new THREE.Vector3(0, mid.y > 1.25 ? 2.05 : 0.16, -0.6);
        const dir = pulley.clone().sub(mid);
        cableLine.position.copy(mid.clone().add(dir.clone().multiplyScalar(0.5)));
        cableLine.scale.set(1, Math.max(0.05, dir.length()), 1);
        cableLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      }
      machine.visible = eq === "machine";

      // cień jedzie za sylwetką i blednie, gdy ciało odjeżdża od podłogi
      const hipG = groups[keyOf("thigh", "R")];
      if (hipG) {
        hipG.getWorldPosition(focus);
        contactShadow.position.x = focus.x - 0.10;
        contactShadow.position.z = focus.z;
        const h = Math.max(0, focus.y);
        contactShadow.scale.setScalar(1 + h * 0.55);
        (contactShadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.12, 1 - h * 0.55);
      }

      // ── KADR: kamera PODĄŻA za tułowiem zachowując dystans i kąt ──
      // Sam lerp celu przesuwał obraz w bok (kamera stała w miejscu), więc przy
      // przysiadzie czy leżeniu sylwetka uciekała poza ekran. Teraz o ten sam
      // wektor przesuwamy też kamerę — obrót i zoom użytkownika zostają zachowane.
      const torsoG = groups[keyOf("torso", "C")];
      if (torsoG) {
        torsoG.getWorldPosition(focus);
        focus.y += 0.16;
        shift.subVectors(focus, controls.target).multiplyScalar(0.07);
        controls.target.add(shift);
        camera.position.add(shift);
      }

      // puls najmocniej pracujących
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
      for (const mesh of meshes) {
        const nfo = info.get(mesh)!;
        if (nfo.level >= 3) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          const sel = selRef.current;
          const isSel = !!sel && sel.muscle === nfo.muscle;
          if (!isSel) {
            mat.emissive.setRGB(pulse * 0.16, pulse * 0.05, 0);
            mat.emissiveIntensity = 1;
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    render();

    const onResize = () => {
      const w = mount.clientWidth || 340;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointermove", onMove);
      controls.dispose();
      meshes.forEach((m) => (m.material as THREE.Material).dispose());
      sphere.dispose();
      skinMat.dispose();
      floorTex.dispose();
      shadowTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // scena budowana raz — dane wpływają przez ref-y
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div ref={mountRef} data-testid="muscle-3d" style={{ width: "100%", height: 460, borderRadius: 16, overflow: "hidden" }} />
      {hoverName && (
        <div style={{ position: "absolute", left: 10, bottom: 10, padding: "5px 10px", borderRadius: 9, fontSize: 11.5, fontWeight: 700, background: "rgba(0,0,0,0.6)", color: "#fff", pointerEvents: "none" }}>
          {hoverName}
        </div>
      )}
    </div>
  );
}
