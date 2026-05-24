import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = {
  className?: string;
};

// Three.js hero scene: a simple "Teacher3D" character (stylized) + chalkboard.
// Built from primitives to avoid external assets.
export function TeacherHero3D({ className }: Props) {
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
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
    camera.position.set(0.35, 0.15, 4.0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0x9bd7ff, 1.4);
    key.position.set(3, 3, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa855f7, 1.0);
    rim.position.set(-3, 1.2, -1.5);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);

    const skin = new THREE.MeshStandardMaterial({ color: 0xf2d1b3, roughness: 0.55, metalness: 0.0 });
    const suit = new THREE.MeshStandardMaterial({ color: 0x163b7a, roughness: 0.35, metalness: 0.1 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x2b6cff, roughness: 0.25, metalness: 0.25 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.35, metalness: 0.2 });

    // Chalkboard (simple box to avoid Three.js addons)
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.25, 0.08), dark);
    board.position.set(0.75, 0.25, -0.6);
    group.add(board);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.08, 1.33, 0.06), accent);
    frame.position.copy(board.position);
    frame.position.z -= 0.02;
    group.add(frame);

    // Chalk writing (planes with emissive-ish material)
    function line(y: number, w: number) {
      const m = new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.55 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.05), m);
      mesh.position.set(0.75, y, -0.55);
      group.add(mesh);
    }
    line(0.45, 1.3);
    line(0.25, 1.6);
    line(0.05, 1.1);

    // Teacher character (simple bust)
    const teacher = new THREE.Group();
    teacher.position.set(-0.35, -0.15, 0.0);
    group.add(teacher);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 48, 48), skin);
    head.position.set(0, 0.75, 0.1);
    teacher.add(head);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.345, 48, 48), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.75, metalness: 0.05 }));
    hair.scale.set(1, 0.72, 1);
    hair.position.set(0, 0.86, 0.07);
    teacher.add(hair);

    // Body (cylinder + bottom sphere)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.65, 32), suit);
    body.position.set(0, 0.25, 0);
    teacher.add(body);
    const bodyBottom = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 32), suit);
    bodyBottom.scale.set(1, 0.55, 1);
    bodyBottom.position.set(0, -0.08, 0);
    teacher.add(bodyBottom);

    // Collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 12, 36), new THREE.MeshStandardMaterial({ color: 0xe9eef9, roughness: 0.6, metalness: 0.0 }));
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.48, 0.05);
    teacher.add(collar);

    // Arms + book
    const armGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.45, 18);
    const arm1 = new THREE.Mesh(armGeo, suit);
    arm1.position.set(0.34, 0.18, 0.08);
    arm1.rotation.z = -0.35;
    arm1.rotation.x = 0.15;
    teacher.add(arm1);
    const arm2 = arm1.clone();
    arm2.position.x = -0.34;
    arm2.rotation.z = 0.35;
    teacher.add(arm2);

    const book = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.08), accent);
    book.position.set(0, -0.05, 0.18);
    book.rotation.x = -0.15;
    teacher.add(book);
    const bookPage = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.34, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75, metalness: 0.0 })
    );
    bookPage.position.set(0, -0.05, 0.22);
    teacher.add(bookPage);

    // Glow bubble behind teacher
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.12 })
    );
    halo.position.set(-0.5, 0.4, -1.2);
    group.add(halo);

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
      group.rotation.y = 0.12 + Math.sin(t * 0.45) * 0.05 + pointer.x * 0.08;
      group.rotation.x = -0.06 + Math.cos(t * 0.4) * 0.03 - pointer.y * 0.06;
      group.position.y = -0.08 + Math.sin(t * 0.8) * 0.03;

      teacher.rotation.y = Math.sin(t * 0.6) * 0.06;
      teacher.position.y = -0.15 + Math.sin(t * 0.95) * 0.03;
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
