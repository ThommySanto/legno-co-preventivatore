import {
  ACESFilmicToneMapping, AmbientLight, BufferGeometry, CanvasTexture, Color, DirectionalLight,
  Group, HemisphereLight, LineBasicMaterial, LineSegments, Mesh, MeshStandardMaterial,
  PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, ShadowMaterial, Spherical, SRGBColorSpace,
  Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { furniturePanels, type FurnitureModel, type ModelView } from './furnitureGeometry';

export type FurnitureScene = ReturnType<typeof createFurnitureScene>;
type Options = { reducedMotion: boolean; onInteract: () => void; onOrbit: () => void; onFailure: () => void };

function grainTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const pixels = context.createImageData(512, 512);
  let seed = 743;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const wave = x + Math.sin(y / 91) * 8 + Math.sin(y / 37 + x / 58) * 2;
    const fine = Math.sin(wave * 1.9) * 4 + Math.sin(wave * .36) * 6;
    const ring = Math.pow(Math.abs(Math.sin(wave * .052 + Math.sin(y / 220))), 18) * 20;
    const tone = Math.round(235 + fine - ring + (seed / 4294967296 - .5) * 8);
    const index = (y * 512 + x) * 4;
    pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = tone;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createFurnitureScene(host: HTMLDivElement, initial: FurnitureModel, options: Options) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, .01, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !options.reducedMotion;
  controls.dampingFactor = .09;
  controls.enablePan = false;
  controls.minPolarAngle = .12;
  controls.maxPolarAngle = Math.PI * .54;
  controls.autoRotateSpeed = .7;
  controls.rotateSpeed = .65;
  // Vertical page scrolling stays available on phones. Horizontal drags orbit the model.
  canvas.style.touchAction = 'pan-y';
  const ordinaryWheel = (event: WheelEvent) => { if (!event.ctrlKey) event.stopImmediatePropagation(); };
  canvas.addEventListener('wheel', ordinaryWheel, { capture: true });
  scene.add(new HemisphereLight('#fff5df', '#6b7562', 2.4), new AmbientLight('#ffffff', .6));
  const keyLight = new DirectionalLight('#fff3db', 3.3);
  keyLight.position.set(3.5, 5, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -4;
  keyLight.shadow.camera.right = keyLight.shadow.camera.top = 4;
  keyLight.shadow.normalBias = .018;
  keyLight.shadow.bias = -.00015;
  keyLight.shadow.radius = 4;
  scene.add(keyLight);
  const rim = new DirectionalLight('#e1e9ff', 2);
  rim.position.set(-4, 2, -3);
  scene.add(rim);
  const fill = new DirectionalLight('#ffffff', .8);
  fill.position.set(0, 1, 5);
  scene.add(fill);
  const texture = grainTexture();
  const material = new MeshStandardMaterial({ color: initial.color, map: texture, roughness: .65, metalness: 0 });
  const floorMaterial = new ShadowMaterial({ color: '#17251b', opacity: .22 });
  const floor = new Mesh(new PlaneGeometry(15, 15), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const cabinet = new Group();
  scene.add(cabinet);
  const guideMaterial = new LineBasicMaterial({ color: '#899a7f', transparent: true, opacity: .55 });
  let guide: LineSegments | null = null;
  let model = initial;
  let layout = furniturePanels(model);
  let meshes: { mesh: Mesh<RoundedBoxGeometry>; base: Vector3; offset: Vector3 }[] = [];
  let disposed = false, active = true, frameId = 0, busyFrame = false;
  let exploded = false, spread = 0, spreadTarget = 0, measurements = false;
  let lastTime = 0;
  let selectedView: ModelView = 'perspective';
  let customView = false;
  let cameraTween: { from: Spherical; to: Spherical; start: number } | null = null;
  const orbit = new Spherical();
  const targetColor = new Color(initial.color);
  let targetRoughness = .65;

  const fitDistance = (direction: Vector3) => {
    const right = new Vector3().crossVectors(camera.up, direction).normalize();
    const up = new Vector3().crossVectors(direction, right).normalize();
    const tangent = Math.tan(camera.fov * Math.PI / 360);
    const extra = exploded ? .7 : .08;
    let distance = 0;
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const point = new Vector3(x * (layout.width + extra) / 2, y * (layout.height + extra) / 2, z * (layout.depth + extra) / 2);
      distance = Math.max(distance, point.dot(direction) + Math.max(Math.abs(point.dot(right)) / (tangent * camera.aspect), Math.abs(point.dot(up)) / tangent) * 1.2);
    }
    return distance;
  };
  const requestDraw = () => {
    if (disposed || !active || frameId || busyFrame) return;
    frameId = requestAnimationFrame(draw);
  };
  const stopRotation = () => { controls.autoRotate = false; options.onInteract(); };
  const draw = (now: number) => {
    frameId = 0;
    if (disposed || !active) return;
    busyFrame = true;
    const delta = lastTime ? Math.min((now - lastTime) / 1000, .05) : 1 / 60;
    lastTime = now;
    let moving = false;
    if (cameraTween) {
      const progress = options.reducedMotion ? 1 : Math.min((now - cameraTween.start) / 480, 1);
      const eased = 1 - (1 - progress) ** 3;
      orbit.set(
        cameraTween.from.radius + (cameraTween.to.radius - cameraTween.from.radius) * eased,
        cameraTween.from.phi + (cameraTween.to.phi - cameraTween.from.phi) * eased,
        cameraTween.from.theta + (cameraTween.to.theta - cameraTween.from.theta) * eased,
      );
      camera.position.setFromSpherical(orbit).add(controls.target);
      moving = progress < 1;
      if (!moving) cameraTween = null;
    }
    if (Math.abs(spread - spreadTarget) > .001) {
      spread = options.reducedMotion ? spreadTarget : spread + (spreadTarget - spread) * (1 - Math.exp(-delta * 10));
      moving = true;
    } else spread = spreadTarget;
    meshes.forEach(({ mesh, base, offset }) => mesh.position.copy(base).addScaledVector(offset, spread));
    floor.position.y = -layout.height / 2 - .006 - spread * .18;
    if (Math.abs(material.color.r - targetColor.r) + Math.abs(material.color.g - targetColor.g) + Math.abs(material.color.b - targetColor.b) > .002) { material.color.lerp(targetColor, options.reducedMotion ? 1 : 1 - Math.exp(-delta * 9)); moving = true; }
    if (Math.abs(material.roughness - targetRoughness) > .002) { material.roughness += (targetRoughness - material.roughness) * (options.reducedMotion ? 1 : .18); moving = true; }
    const changed = controls.update(delta);
    try { renderer.render(scene, camera); } catch { active = false; busyFrame = false; options.onFailure(); return; }
    canvas.dataset.camera = camera.position.toArray().map(n => n.toFixed(2)).join(',');
    busyFrame = false;
    if (moving || changed || controls.autoRotate) requestDraw();
  };
  const animateCamera = (to: Vector3, immediate = false) => {
    if (immediate || options.reducedMotion) { camera.position.copy(to); camera.lookAt(controls.target); cameraTween = null; }
    else {
      const from = new Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      const end = new Spherical().setFromVector3(to.clone().sub(controls.target));
      // Follow the shortest arc around the cabinet for front/back transitions.
      const circle = 2 * Math.PI;
      const angle = ((end.theta - from.theta + Math.PI) % circle + circle) % circle - Math.PI;
      end.theta = from.theta + angle;
      cameraTween = { from, to: end, start: performance.now() };
    }
    requestDraw();
  };
  const frameCamera = (direction: Vector3, immediate = false) => {
    const distance = fitDistance(direction);
    controls.minDistance = distance * .38;
    controls.maxDistance = distance * 2.2;
    const to = direction.multiplyScalar(distance);
    animateCamera(to, immediate);
  };
  const setView = (view: ModelView, immediate = false) => {
    selectedView = view; customView = false;
    stopRotation();
    frameCamera((view === 'front' ? new Vector3(0, .035, 1) : view === 'back' ? new Vector3(.1, .16, -1) : new Vector3(1.2, .72, 1.8)).normalize(), immediate);
  };
  const build = () => {
    meshes.forEach(({ mesh }) => { cabinet.remove(mesh); mesh.geometry.dispose(); });
    layout = furniturePanels(model);
    meshes = layout.panels.map(panel => {
      const geometry = new RoundedBoxGeometry(...panel.size, 2, Math.min(.009, Math.min(...panel.size) / 5));
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = panel.id;
      const base = new Vector3(...panel.position), offset = new Vector3(...panel.offset);
      mesh.position.copy(base).addScaledVector(offset, spread);
      cabinet.add(mesh);
      return { mesh, base, offset };
    });
    canvas.dataset.panelCount = String(meshes.length);
    floor.position.y = -layout.height / 2 - .006 - spread * .18;
    if (guide) { scene.remove(guide); guide.geometry.dispose(); }
    const w = layout.width / 2, h = layout.height / 2, d = layout.depth / 2;
    const segments = [
      [-w, -h - .13, d + .14], [w, -h - .13, d + .14],
      [-w, -h - .08, d + .14], [-w, -h - .18, d + .14],
      [w, -h - .08, d + .14], [w, -h - .18, d + .14],
      [-w - .15, -h, d + .14], [-w - .15, h, d + .14],
      [-w - .1, -h, d + .14], [-w - .2, -h, d + .14],
      [-w - .1, h, d + .14], [-w - .2, h, d + .14],
      [w + .15, -h - .13, -d], [w + .15, -h - .13, d],
    ];
    guide = new LineSegments(new BufferGeometry().setFromPoints(segments.map(point => new Vector3(...point))), guideMaterial);
    guide.visible = measurements && !exploded;
    scene.add(guide);
  };
  const resize = () => {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    if (customView) frameCamera(camera.position.clone().sub(controls.target).normalize(), true);
    else setView(selectedView, true);
  };
  const interaction = () => { cameraTween = null; customView = true; stopRotation(); options.onOrbit(); };
  const lost = (event: Event) => { event.preventDefault(); options.onFailure(); };
  controls.addEventListener('start', interaction);
  controls.addEventListener('change', requestDraw);
  canvas.addEventListener('webglcontextlost', lost);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  build();
  resize();

  return {
    update(next: FurnitureModel) {
      const geometryChanged = next.width !== model.width || next.height !== model.height || next.depth !== model.depth || next.thickness !== model.thickness || next.shelves !== model.shelves || next.variant !== model.variant;
      model = next;
      targetColor.set(next.color);
      targetRoughness = next.finish === 'laccato' ? .25 : next.finish === 'cera-naturale' ? .48 : next.finish === 'grezzo' ? .88 : .68;
      if (geometryChanged) { build(); stopRotation(); frameCamera(camera.position.clone().sub(controls.target).normalize()); }
      requestDraw();
    },
    view: setView,
    zoom(factor: number) {
      stopRotation();
      const distance = Math.max(controls.minDistance, Math.min(controls.maxDistance, camera.position.distanceTo(controls.target) * factor));
      const to = camera.position.clone().sub(controls.target).normalize().multiplyScalar(distance).add(controls.target);
      animateCamera(to);
    },
    rotate(horizontal: number, vertical = 0) {
      stopRotation(); cameraTween = null; customView = true; options.onOrbit();
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(camera.up, horizontal);
      if (vertical) {
        const current = Math.acos(offset.y / offset.length());
        const next = Math.max(controls.minPolarAngle, Math.min(controls.maxPolarAngle, current + vertical));
        const length = offset.length(), angle = Math.atan2(offset.x, offset.z);
        offset.set(Math.sin(next) * Math.sin(angle) * length, Math.cos(next) * length, Math.sin(next) * Math.cos(angle) * length);
      }
      camera.position.copy(controls.target).add(offset); requestDraw();
    },
    autoRotate(value: boolean) { cameraTween = null; controls.autoRotate = value; if (value) { customView = true; options.onOrbit(); } requestDraw(); },
    explode(value: boolean) { exploded = value; spreadTarget = value ? 1 : 0; if (guide) guide.visible = measurements && !value; setView('perspective'); },
    measurements(value: boolean) { measurements = value; if (guide) guide.visible = value && !exploded; requestDraw(); },
    active(value: boolean) { active = value; lastTime = 0; if (value) requestDraw(); else { cancelAnimationFrame(frameId); frameId = 0; } },
    motion(reduced: boolean) { options.reducedMotion = reduced; controls.enableDamping = !reduced; if (reduced) stopRotation(); requestDraw(); },
    dispose() {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frameId); observer.disconnect();
      canvas.removeEventListener('wheel', ordinaryWheel, { capture: true });
      canvas.removeEventListener('webglcontextlost', lost);
      controls.removeEventListener('start', interaction); controls.removeEventListener('change', requestDraw); controls.dispose();
      meshes.forEach(({ mesh }) => mesh.geometry.dispose());
      guide?.geometry.dispose(); guideMaterial.dispose(); material.dispose(); texture?.dispose();
      floor.geometry.dispose(); floorMaterial.dispose(); keyLight.shadow.dispose();
      renderer.dispose(); renderer.forceContextLoss(); canvas.remove();
    },
  };
}
