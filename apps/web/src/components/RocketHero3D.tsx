import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  className?: string;
};

// Lightweight Three.js hero scene (no react-three-fiber):
// A stylized rocket built from primitives with simple flame + smoke particles.
export function RocketHero3D({ className }: Props) {
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

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0.2, 0.25, 3.2);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0x9bd7ff, 1.4);
    key.position.set(3, 3, 2);
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xa855f7, 0.9);
    rim.position.set(-3, 1.5, -1.5);
    scene.add(rim);

    // Rocket group
    const rocket = new THREE.Group();
    scene.add(rocket);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe9eef9,
      roughness: 0.32,
      metalness: 0.15
    });
    const blueMat = new THREE.MeshStandardMaterial({
      color: 0x2b6cff,
      roughness: 0.22,
      metalness: 0.3
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0f1a2e,
      roughness: 0.35,
      metalness: 0.25
    });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.2, 32), bodyMat);
    body.position.y = 0.2;
    rocket.add(body);

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.55, 32), blueMat);
    nose.position.y = 0.2 + 0.6 + 0.25;
    rocket.add(nose);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 12, 44), blueMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.05;
    rocket.add(ring);

    const windowOuter = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), darkMat);
    windowOuter.position.set(0.18, 0.35, 0.24);
    rocket.add(windowOuter);

    const windowInner = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x163b7a, roughness: 0.08, metalness: 0.6, emissive: 0x1d4ed8, emissiveIntensity: 0.15 })
    );
    windowInner.position.copy(windowOuter.position).add(new THREE.Vector3(0, 0, 0.05));
    rocket.add(windowInner);

    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.22, 24), darkMat);
    nozzle.position.y = -0.55;
    rocket.add(nozzle);

    // Fins
    const finGeo = new THREE.BoxGeometry(0.08, 0.22, 0.26);
    const fin1 = new THREE.Mesh(finGeo, blueMat);
    fin1.position.set(0.28, -0.3, 0);
    fin1.rotation.z = -0.2;
    rocket.add(fin1);
    const fin2 = fin1.clone();
    fin2.position.x = -0.28;
    fin2.rotation.z = 0.2;
    rocket.add(fin2);

    // Flame (cone) + glow (sprite)
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xffb100,
      roughness: 0.9,
      metalness: 0.0,
      emissive: 0xff6a00,
      emissiveIntensity: 1.4
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 24), flameMat);
    flame.rotation.x = Math.PI;
    flame.position.y = -0.75;
    rocket.add(flame);

    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const gctx = glowCanvas.getContext("2d");
    if (gctx) {
      const grd = gctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      grd.addColorStop(0, "rgba(255,190,80,0.95)");
      grd.addColorStop(0.35, "rgba(255,120,0,0.55)");
      grd.addColorStop(1, "rgba(255,120,0,0)");
      gctx.fillStyle = grd;
      gctx.fillRect(0, 0, 128, 128);
    }
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
    glow.scale.set(1.25, 1.25, 1);
    glow.position.set(0, -0.9, 0);
    rocket.add(glow);

    // Smoke particles
    const smokeCount = 220;
    const smokeGeo = new THREE.BufferGeometry();
    const smokePos = new Float32Array(smokeCount * 3);
    const smokeVel = new Float32Array(smokeCount * 3);
    for (let i = 0; i < smokeCount; i++) {
      smokePos[i * 3 + 0] = (Math.random() - 0.5) * 0.6;
      smokePos[i * 3 + 1] = -1.05 - Math.random() * 0.7;
      smokePos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
      smokeVel[i * 3 + 0] = (Math.random() - 0.5) * 0.07;
      smokeVel[i * 3 + 1] = 0.06 + Math.random() * 0.08;
      smokeVel[i * 3 + 2] = (Math.random() - 0.5) * 0.07;
    }
    smokeGeo.setAttribute("position", new THREE.BufferAttribute(smokePos, 3));
    const smokeMat = new THREE.PointsMaterial({
      size: 0.06,
      color: 0x9aa7bf,
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });
    const smoke = new THREE.Points(smokeGeo, smokeMat);
    scene.add(smoke);

    // Ground shadow-ish blob
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 64),
      new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.25 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.05, -1.25, 0);
    scene.add(shadow);

    // Subtle background sphere gradients (for depth)
    const bg1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x6d28d9, transparent: true, opacity: 0.18 })
    );
    bg1.position.set(-1.25, 0.7, -1.6);
    scene.add(bg1);
    const bg2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12 })
    );
    bg2.position.set(1.15, 0.2, -1.4);
    scene.add(bg2);

    const clock = new THREE.Clock();

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

    // Interaction: slight parallax on mouse move
    const pointer = { x: 0, y: 0 };
    function onMove(ev: PointerEvent) {
      const rect = rootEl.getBoundingClientRect();
      const nx = (ev.clientX - rect.left) / rect.width;
      const ny = (ev.clientY - rect.top) / rect.height;
      pointer.x = (nx - 0.5) * 2;
      pointer.y = (ny - 0.5) * 2;
    }
    rootEl.addEventListener("pointermove", onMove);

    let raf = 0;
    function tick() {
      const t = clock.getElapsedTime();

      rocket.rotation.y = 0.25 + Math.sin(t * 0.55) * 0.06 + pointer.x * 0.08;
      rocket.rotation.x = -0.1 + Math.cos(t * 0.45) * 0.04 - pointer.y * 0.06;
      rocket.position.y = -0.1 + Math.sin(t * 0.9) * 0.04;

      flame.scale.set(1, 1 + Math.sin(t * 10) * 0.06, 1);
      glow.material.opacity = 0.65 + Math.sin(t * 8) * 0.08;

      // Smoke loop
      const pos = smokeGeo.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < smokeCount; i++) {
        const ix = i * 3;
        smokePos[ix + 0] += smokeVel[ix + 0];
        smokePos[ix + 1] += smokeVel[ix + 1];
        smokePos[ix + 2] += smokeVel[ix + 2];
        smokeVel[ix + 0] *= 0.992;
        smokeVel[ix + 2] *= 0.992;
        // reset when too high
        if (smokePos[ix + 1] > -0.25) {
          smokePos[ix + 0] = (Math.random() - 0.5) * 0.6;
          smokePos[ix + 1] = -1.05 - Math.random() * 0.7;
          smokePos[ix + 2] = (Math.random() - 0.5) * 0.6;
          smokeVel[ix + 0] = (Math.random() - 0.5) * 0.07;
          smokeVel[ix + 1] = 0.06 + Math.random() * 0.08;
          smokeVel[ix + 2] = (Math.random() - 0.5) * 0.07;
        }
      }
      pos.needsUpdate = true;
      smokeMat.opacity = 0.28 + Math.sin(t * 0.6) * 0.03;

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

      // Dispose geometries/materials we created
      scene.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if ((mesh as any).geometry) (mesh as any).geometry.dispose?.();
        const mat = (mesh as any).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
        else mat?.dispose?.();
      });
      glowTex.dispose();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={className}
      aria-hidden
      style={{ width: "100%", height: "100%" }}
    />
  );
}
