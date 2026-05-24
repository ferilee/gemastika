import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  className?: string;
};

function makeSymbolTexture(symbol: string, fg: string, glow: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Soft glow
  ctx.save();
  ctx.translate(128, 132);
  ctx.font = "900 132px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = glow;
  ctx.shadowBlur = 48;
  ctx.fillStyle = glow;
  ctx.fillText(symbol, 0, 0);
  ctx.restore();

  // Core glyph
  ctx.save();
  ctx.translate(128, 132);
  ctx.font = "900 132px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255,255,255,0.15)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = fg;
  ctx.fillText(symbol, 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Three.js hero scene: floating math symbols + glossy shapes, for a "Math3D" vibe.
export function MathHero3D({ className }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const rootEl = root;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rootEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
    camera.position.set(0.2, 0.1, 3.5);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));

    const key = new THREE.DirectionalLight(0x9bd7ff, 1.6);
    key.position.set(3, 3, 2);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xa855f7, 1.0);
    rim.position.set(-3, 1.2, -1.5);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    // Core glossy orb + torus
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x9bd7ff,
      roughness: 0.08,
      metalness: 0.0,
      transmission: 0.85,
      thickness: 0.6,
      clearcoat: 0.9,
      clearcoatRoughness: 0.18,
      ior: 1.4
    });

    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.52, 64, 64), glassMat);
    orb.position.set(0.2, 0.05, 0);
    group.add(orb);

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.18, metalness: 0.35 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 18, 120), ringMat);
    ring.rotation.set(Math.PI / 2.6, 0.0, Math.PI / 8);
    ring.position.set(0.15, 0.05, 0);
    group.add(ring);

    // Symbols (sprites)
    const symbols: Array<{ sprite: THREE.Sprite; base: THREE.Vector3; speed: number; phase: number }> = [];
    const defs = [
      { s: "π", fg: "rgba(255,255,255,0.95)", glow: "rgba(56,189,248,0.85)" },
      { s: "Σ", fg: "rgba(255,255,255,0.95)", glow: "rgba(168,85,247,0.85)" },
      { s: "√", fg: "rgba(255,255,255,0.95)", glow: "rgba(59,130,246,0.8)" },
      { s: "∫", fg: "rgba(255,255,255,0.95)", glow: "rgba(245,158,11,0.75)" },
      { s: "∞", fg: "rgba(255,255,255,0.95)", glow: "rgba(56,189,248,0.75)" }
    ];

    for (let i = 0; i < defs.length; i++) {
      const d = defs[i];
      const tex = makeSymbolTexture(d.s, d.fg, d.glow);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      const scale = 0.55 + (i % 2) * 0.08;
      sprite.scale.set(scale, scale, 1);
      const base = new THREE.Vector3((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.0, (Math.random() - 0.5) * 0.8);
      sprite.position.copy(base);
      group.add(sprite);
      symbols.push({ sprite, base, speed: 0.45 + Math.random() * 0.4, phase: Math.random() * Math.PI * 2 });
    }

    // Subtle background bubbles
    const bubbleMat1 = new THREE.MeshBasicMaterial({ color: 0x6d28d9, transparent: true, opacity: 0.16 });
    const bubble1 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 32), bubbleMat1);
    bubble1.position.set(-1.2, 0.7, -1.6);
    scene.add(bubble1);
    const bubbleMat2 = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12 });
    const bubble2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), bubbleMat2);
    bubble2.position.set(1.15, 0.2, -1.4);
    scene.add(bubble2);

    const clock = new THREE.Clock();
    const pointer = { x: 0, y: 0 };
    function onMove(ev: PointerEvent) {
      const rect = rootEl.getBoundingClientRect();
      const nx = (ev.clientX - rect.left) / rect.width;
      const ny = (ev.clientY - rect.top) / rect.height;
      pointer.x = (nx - 0.5) * 2;
      pointer.y = (ny - 0.5) * 2;
    }
    rootEl.addEventListener("pointermove", onMove);

    function resize() {
      const w = rootEl.clientWidth;
      const h = rootEl.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();

    const ro = new ResizeObserver(() => resize());
    ro.observe(rootEl);

    let raf = 0;
    function tick() {
      const t = clock.getElapsedTime();
      group.rotation.y = 0.25 + Math.sin(t * 0.5) * 0.06 + pointer.x * 0.08;
      group.rotation.x = -0.08 + Math.cos(t * 0.45) * 0.04 - pointer.y * 0.06;
      group.position.y = -0.05 + Math.sin(t * 0.8) * 0.04;

      ring.rotation.z = Math.sin(t * 0.35) * 0.12;
      orb.rotation.y = t * 0.22;

      for (const sym of symbols) {
        sym.sprite.position.set(
          sym.base.x + Math.cos(t * sym.speed + sym.phase) * 0.12,
          sym.base.y + Math.sin(t * sym.speed + sym.phase) * 0.12,
          sym.base.z + Math.sin(t * sym.speed + sym.phase) * 0.05
        );
        const m = sym.sprite.material as THREE.SpriteMaterial;
        m.opacity = 0.78 + Math.sin(t * sym.speed * 1.8 + sym.phase) * 0.12;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf);
      rootEl.removeEventListener("pointermove", onMove);
      ro.disconnect();
      renderer.dispose();
      rootEl.removeChild(renderer.domElement);
      scene.traverse((obj: THREE.Object3D) => {
        const anyObj = obj as any;
        anyObj.geometry?.dispose?.();
        const mat = anyObj.material;
        if (Array.isArray(mat)) mat.forEach((m: any) => m.dispose?.());
        else mat?.dispose?.();
      });
    };
  }, []);

  return <div ref={rootRef} className={className} aria-hidden style={{ width: "100%", height: "100%" }} />;
}

