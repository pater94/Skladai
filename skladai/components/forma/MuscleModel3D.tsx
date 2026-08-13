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
import type { Pose } from "./exercisePose";

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
  activation, onPick, selected, pose,
}: {
  activation: MuscleActivation[];
  onPick: (p: Pick) => void;
  selected: Pick | null;
  /** Docelowe kąty w stawach (pozycja ćwiczenia). */
  pose?: Pose | null;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoverName, setHoverName] = useState<string | null>(null);

  // referencje żywe — używane w pętli renderującej bez restartu sceny
  const selRef = useRef<Pick | null>(selected);
  const poseRef = useRef<Pose | null | undefined>(pose);
  const actRef = useRef<MuscleActivation[]>(activation);
  useEffect(() => { selRef.current = selected; }, [selected]);
  useEffect(() => { poseRef.current = pose; }, [pose]);
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
    camera.position.set(1.35, 1.12, 2.05); // ujęcie 3/4 — pozycje ćwiczeń czytelniejsze niż z przodu

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
    controls.minDistance = 1.2;
    controls.maxDistance = 5;
    controls.enablePan = false;

    // ── szkielet: grupy segmentów (parent-child), osobno dla L i R ──
    const groups: Record<string, THREE.Group> = {};
    const root = new THREE.Group();
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
        (parentKey && groups[parentKey] ? groups[parentKey] : root).add(g);
        groups[keyOf(seg.id, side)] = g;
      }
    }

    // ── poglądowa sylwetka ciała (półprzezroczysta) ──
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x8b95a5, transparent: true, opacity: 0.17, roughness: 0.85, metalness: 0,
      depthWrite: false,
    });
    for (const seg of SKELETON) {
      const sides: Array<"L" | "R" | "C"> = seg.paired ? ["L", "R"] : ["C"];
      for (const side of sides) {
        const g = groups[keyOf(seg.id, side)];
        if (!g) continue;
        const geo = seg.id === "head"
          ? new THREE.SphereGeometry(seg.radius, 20, 16)
          : new THREE.CapsuleGeometry(seg.radius, Math.max(0.01, seg.length - seg.radius * 2), 6, 14);
        const m = new THREE.Mesh(geo, skinMat);
        // tors rośnie W GÓRĘ od miednicy; kończyny zwisają W DÓŁ od stawu
        m.position.y = seg.id === "head" ? seg.length * 0.35
          : seg.id === "torso" ? seg.length / 2
          : -seg.length / 2;
        m.userData.skin = true;
        g.add(m);
      }
    }

    // ── mięśnie ──
    const meshes: THREE.Mesh[] = [];
    const info = new Map<THREE.Mesh, MeshInfo>();
    const sphere = new THREE.SphereGeometry(1, 18, 14);

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
        mat.opacity = lvl >= 0 ? 0.97 : 0.28;
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
