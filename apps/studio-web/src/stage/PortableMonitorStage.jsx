import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildMetrics, createLabelTexture, createScreenTextureState, redrawScreenTexture } from './screenTextures.js';

const TEMP_VECTOR = new THREE.Vector3();
const TEMP_TARGET = new THREE.Vector3();
const TEMP_SPHERICAL = new THREE.Spherical();

function createOrbitState() {
  return {
    currentPhi: 0,
    currentRadius: 0,
    currentTheta: 0,
    defaultPhi: 0,
    defaultRadius: 0,
    defaultTheta: 0,
    dragging: false,
    maxRadius: 6.8,
    minRadius: 2.2,
    mode: '',
    phi: 0,
    pointerX: 0,
    pointerY: 0,
    radius: 0,
    theta: 0,
  };
}

function getDefaultCompanionDevice(scene) {
  switch (scene.id) {
    case 'touch-lamination':
    case 'travel-portable':
      return 'phone';
    case 'gaming-144hz':
    case 'gaming-compact':
    case 'ports-connectivity':
    case 'vesa-speakers':
      return 'desktop';
    default:
      return 'laptop';
  }
}

function normalizeCompanionDevice(value) {
  const raw = String(value || '').toLowerCase();
  if (raw.includes('phone') || raw.includes('mobile')) return 'phone';
  if (raw.includes('desktop') || raw.includes('pc') || raw.includes('console') || raw.includes('tower')) return 'desktop';
  if (raw.includes('laptop') || raw.includes('notebook')) return 'laptop';
  return '';
}

function resolveCompanionDevice(scene, selectedDevice) {
  if (selectedDevice && selectedDevice !== 'auto') return selectedDevice;
  const fromOverride = normalizeCompanionDevice(scene.override?.pairedDevice);
  if (fromOverride) return fromOverride;
  return getDefaultCompanionDevice(scene);
}

function getMonitorPose(scene, product, metrics) {
  const deskTopY = -0.99;
  const footRadius = metrics.depth * 0.24;
  const currentFootCenterY = -metrics.height * 0.76;
  const groundingOffsetY = deskTopY + footRadius - currentFootCenterY;

  let rotationX = THREE.MathUtils.degToRad(4);
  let rotationY = THREE.MathUtils.degToRad(-18);
  let rotationZ = 0;
  let positionX = 0.34;
  let positionZ = 0.16;
  let scale = product.sizeInch <= 7 ? 1.02 : 1;

  if (scene.id === 'hero-main') {
    rotationY = THREE.MathUtils.degToRad(-12);
    positionX = 0.2;
  }

  if (scene.id === 'material-stand' || scene.id === 'compact-build') {
    rotationY = THREE.MathUtils.degToRad(-26);
    positionX = 0.5;
  }

  if (scene.id === 'gaming-144hz' || scene.id === 'gaming-compact') {
    rotationY = THREE.MathUtils.degToRad(-20);
    positionX = 0.28;
    positionZ = 0.1;
  }

  if (scene.id === 'touch-lamination') {
    rotationY = THREE.MathUtils.degToRad(-8);
    positionX = 0.42;
  }

  if (scene.id === 'ports-connectivity') {
    rotationX = THREE.MathUtils.degToRad(6);
    rotationY = -Math.PI / 2.25;
    positionX = 0.82;
    positionZ = 0.08;
  }

  if (scene.id === 'vesa-speakers') {
    rotationX = THREE.MathUtils.degToRad(3);
    rotationY = Math.PI + THREE.MathUtils.degToRad(-22);
    positionX = 0.24;
  }

  return {
    baseOffsetY: groundingOffsetY,
    floatAmount: product.sizeInch <= 7 ? 0.004 : 0.006,
    positionX,
    positionZ,
    rotationX,
    rotationY,
    rotationZ,
    scale,
  };
}

function positionCamera(camera, orbit, cameraTarget, scene) {
  let position = new THREE.Vector3(2.35, 0.18, 3.05);
  let target = new THREE.Vector3(0.18, -0.05, 0.16);

  if (scene.id === 'hero-main') {
    position = new THREE.Vector3(2.1, 0.28, 2.95);
    target = new THREE.Vector3(0.16, -0.05, 0.14);
  }

  if (scene.id === 'material-stand' || scene.id === 'compact-build') {
    position = new THREE.Vector3(2.48, 0.22, 2.68);
    target = new THREE.Vector3(0.5, -0.08, 0.1);
  }

  if (scene.id === 'office-productivity' || scene.id === 'embedded-control') {
    position = new THREE.Vector3(2.28, 0.24, 2.92);
    target = new THREE.Vector3(0.22, -0.08, 0.12);
  }

  if (scene.id === 'gaming-144hz' || scene.id === 'gaming-compact') {
    position = new THREE.Vector3(2.42, 0.08, 2.78);
    target = new THREE.Vector3(0.2, -0.16, 0.05);
  }

  if (scene.id === 'travel-portable') {
    position = new THREE.Vector3(2.56, 0.24, 3.1);
    target = new THREE.Vector3(0.1, -0.06, 0.18);
  }

  if (scene.id === 'touch-lamination') {
    position = new THREE.Vector3(1.72, 0.2, 2.18);
    target = new THREE.Vector3(0.44, 0.02, 0.18);
  }

  if (scene.id === 'ports-connectivity') {
    position = new THREE.Vector3(1.7, -0.08, 1.92);
    target = new THREE.Vector3(0.88, -0.02, 0.08);
  }

  if (scene.id === 'vesa-speakers') {
    position = new THREE.Vector3(1.96, 0.16, 2.44);
    target = new THREE.Vector3(0.18, -0.06, 0.08);
  }

  camera.position.copy(position);
  cameraTarget.copy(target);

  TEMP_SPHERICAL.setFromVector3(camera.position.clone().sub(cameraTarget));
  orbit.theta = TEMP_SPHERICAL.theta;
  orbit.phi = TEMP_SPHERICAL.phi;
  orbit.radius = TEMP_SPHERICAL.radius;
  orbit.currentTheta = TEMP_SPHERICAL.theta;
  orbit.currentPhi = TEMP_SPHERICAL.phi;
  orbit.currentRadius = TEMP_SPHERICAL.radius;
  orbit.minRadius = 1.5;
  orbit.maxRadius = 6.5;
  orbit.defaultTheta = orbit.theta;
  orbit.defaultPhi = orbit.phi;
  orbit.defaultRadius = orbit.radius;
}

function updateCameraPose(camera, orbit, cameraTarget, immediate = false) {
  const amount = immediate ? 1 : 0.12;
  orbit.currentTheta = THREE.MathUtils.lerp(orbit.currentTheta, orbit.theta, amount);
  orbit.currentPhi = THREE.MathUtils.lerp(orbit.currentPhi, orbit.phi, amount);
  orbit.currentRadius = THREE.MathUtils.lerp(orbit.currentRadius, orbit.radius, amount);
  TEMP_SPHERICAL.set(orbit.currentRadius, orbit.currentPhi, orbit.currentTheta);
  TEMP_VECTOR.setFromSpherical(TEMP_SPHERICAL).add(cameraTarget);
  camera.position.copy(TEMP_VECTOR);
  camera.lookAt(cameraTarget);
}

function resetOrbit(orbit) {
  orbit.theta = orbit.defaultTheta;
  orbit.phi = orbit.defaultPhi;
  orbit.radius = orbit.defaultRadius;
}

function CableCurve({ from, to, color = '#d9dedf', midOffsetA = [0.18, 0.16, -0.04], midOffsetB = [-0.12, 0.1, 0.12] }) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(...from),
        new THREE.Vector3(...from).lerp(new THREE.Vector3(...to), 0.35).add(new THREE.Vector3(...midOffsetA)),
        new THREE.Vector3(...from).lerp(new THREE.Vector3(...to), 0.72).add(new THREE.Vector3(...midOffsetB)),
        new THREE.Vector3(...to),
      ]),
    [from, to, midOffsetA, midOffsetB],
  );

  return (
    <mesh receiveShadow>
      <tubeGeometry args={[curve, 40, 0.012, 10, false]} />
      <meshStandardMaterial color={color} metalness={0.14} roughness={0.54} />
    </mesh>
  );
}

function DeskKeyboard({ position, scale = 1 }) {
  return (
    <mesh castShadow position={position} rotation={[0, THREE.MathUtils.degToRad(-10), 0]} scale={scale}>
      <boxGeometry args={[0.96, 0.04, 0.32]} />
      <meshStandardMaterial color="#d3d6d9" metalness={0.08} roughness={0.78} />
    </mesh>
  );
}

function DeskMouse({ position, scale = 1 }) {
  return (
    <mesh castShadow position={position} scale={[scale * 0.76, scale, scale * 1.16]}>
      <sphereGeometry args={[0.12, 28, 20]} />
      <meshStandardMaterial color="#d3d6d9" metalness={0.06} roughness={0.64} />
    </mesh>
  );
}

function LaptopDevice() {
  return (
    <group position={[-1.24, -0.69, 0.88]} rotation={[0, THREE.MathUtils.degToRad(22), 0]} scale={0.96}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.36, 0.08, 0.96]} />
        <meshStandardMaterial color="#ced3da" metalness={0.24} roughness={0.58} />
      </mesh>
      <mesh castShadow position={[0, 0.48, -0.26]} rotation={[THREE.MathUtils.degToRad(-110), 0, 0]}>
        <boxGeometry args={[1.28, 0.82, 0.06]} />
        <meshStandardMaterial color="#90a5ba" metalness={0.16} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.48, -0.22]} rotation={[THREE.MathUtils.degToRad(-110), 0, 0]}>
        <planeGeometry args={[1.14, 0.68]} />
        <meshBasicMaterial color="#8fc4ff" opacity={0.76} toneMapped={false} transparent />
      </mesh>
      <CableCurve from={[-0.44, 0.06, -0.12]} to={[1.18, 0.2, -0.52]} />
    </group>
  );
}

function PhoneDevice() {
  return (
    <group position={[-1.02, -0.73, 0.72]} rotation={[0, THREE.MathUtils.degToRad(8), 0]}>
      <mesh castShadow receiveShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[0.22, 0.2, 0.12]} />
        <meshStandardMaterial color="#f1dbc1" metalness={0.02} roughness={0.86} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[0.38, 0.66, 0.04]} />
        <meshStandardMaterial color="#151a22" metalness={0.18} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.34, 0.03]}>
        <planeGeometry args={[0.28, 0.54]} />
        <meshBasicMaterial color="#8ef0d1" opacity={0.9} toneMapped={false} transparent />
      </mesh>
      <CableCurve from={[0.04, -0.04, 0.02]} to={[1.12, 0.16, -0.42]} midOffsetA={[0.12, 0.04, -0.02]} midOffsetB={[-0.08, 0.08, 0.1]} />
    </group>
  );
}

function DesktopDevice() {
  return (
    <>
      <group position={[1.92, -0.72, 0.82]} rotation={[0, THREE.MathUtils.degToRad(-12), 0]} scale={1.04}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.72, 1.16, 0.56]} />
          <meshStandardMaterial color="#232b32" metalness={0.28} roughness={0.48} />
        </mesh>
        <mesh position={[0.18, 0.16, 0.29]}>
          <boxGeometry args={[0.22, 0.56, 0.02]} />
          <meshBasicMaterial color="#7dd3fc" opacity={0.34} toneMapped={false} transparent />
        </mesh>
        <mesh position={[-0.16, -0.18, 0.29]}>
          <boxGeometry args={[0.16, 0.2, 0.02]} />
          <meshBasicMaterial color="#f6a96b" opacity={0.26} toneMapped={false} transparent />
        </mesh>
      </group>
      <DeskKeyboard position={[0.92, -0.98, 1.02]} scale={0.92} />
      <DeskMouse position={[1.64, -0.96, 1.04]} scale={0.92} />
      <CableCurve from={[1.6, -0.4, 0.58]} to={[0.88, 0.14, -0.4]} color="#d8dfe4" midOffsetA={[-0.18, 0.22, -0.1]} midOffsetB={[-0.16, 0.08, 0.08]} />
    </>
  );
}

function RoomDecor({ scene }) {
  const accent = scene.appearance.accent || '#7dd3fc';

  return (
    <>
      <mesh position={[-1.34, -1.13, 0.52]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.9, 1.86]} />
        <meshStandardMaterial color="#d6bf9d" roughness={0.96} />
      </mesh>

      <group position={[1.74, 0.06, -1.62]}>
        <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
          <boxGeometry args={[1.34, 0.08, 0.3]} />
          <meshStandardMaterial color="#8d6543" roughness={0.84} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.26, 0]}>
          <boxGeometry args={[1.18, 0.08, 0.3]} />
          <meshStandardMaterial color="#8d6543" roughness={0.84} />
        </mesh>
        {[
          [-0.42, 0.46, '#a97b55', 0.18],
          [-0.2, 0.46, accent, 0.14],
          [0.06, 0.46, '#f0d4a8', 0.2],
          [0.3, 0.46, '#c87d52', 0.16],
          [-0.3, 1.1, '#f3e7d7', 0.2],
          [-0.04, 1.1, '#94b6c5', 0.14],
          [0.24, 1.1, '#6e8d74', 0.18],
        ].map(([x, y, color, width]) => (
          <mesh key={`${x}-${y}-${color}`} castShadow position={[x, y, 0]}>
            <boxGeometry args={[width, 0.4, 0.18]} />
            <meshStandardMaterial color={color} roughness={0.78} />
          </mesh>
        ))}
      </group>

      <group position={[-2.38, -0.82, -1.18]}>
        <mesh castShadow receiveShadow position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.2, 0.26, 0.68, 24]} />
          <meshStandardMaterial color="#7c8b5f" roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0, 0.96, 0]}>
          <sphereGeometry args={[0.34, 22, 20]} />
          <meshStandardMaterial color="#5d7f55" roughness={0.88} />
        </mesh>
        <mesh castShadow position={[-0.22, 0.9, 0.08]}>
          <sphereGeometry args={[0.18, 18, 18]} />
          <meshStandardMaterial color="#6e915f" roughness={0.88} />
        </mesh>
        <mesh castShadow position={[0.22, 0.84, -0.06]}>
          <sphereGeometry args={[0.2, 18, 18]} />
          <meshStandardMaterial color="#769b64" roughness={0.88} />
        </mesh>
      </group>

      <group position={[0.98, -0.82, 1.34]}>
        <mesh castShadow receiveShadow position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 0.64, 20]} />
          <meshStandardMaterial color="#d8d8d1" roughness={0.66} />
        </mesh>
        <mesh castShadow position={[0.08, 0.84, -0.06]} rotation={[0, 0, THREE.MathUtils.degToRad(-18)]}>
          <cylinderGeometry args={[0.02, 0.03, 0.92, 18]} />
          <meshStandardMaterial color="#4b4844" roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0.24, 1.16, -0.12]}>
          <coneGeometry args={[0.22, 0.28, 20]} />
          <meshStandardMaterial color="#efe1cd" roughness={0.9} />
        </mesh>
      </group>

      <mesh castShadow receiveShadow position={[-0.84, -0.9, 1.12]}>
        <cylinderGeometry args={[0.08, 0.08, 0.22, 18]} />
        <meshStandardMaterial color="#e8e5de" roughness={0.92} />
      </mesh>
      <mesh position={[-0.84, -0.77, 1.12]}>
        <torusGeometry args={[0.08, 0.01, 12, 30]} />
        <meshStandardMaterial color="#dbb17f" roughness={0.74} />
      </mesh>
    </>
  );
}

function CozyRoomEnvironment({ lightBoost, scene }) {
  const accent = useMemo(() => new THREE.Color(scene.appearance.accent || '#7dd3fc'), [scene.appearance.accent]);
  const warmSun = useMemo(() => accent.clone().lerp(new THREE.Color('#ffd2a3'), 0.72), [accent]);

  return (
    <>
      <fogExp2 attach="fog" args={['#c7b39d', 0.055]} />
      <color attach="background" args={['#c7b39d']} />
      <ambientLight intensity={0.74 * lightBoost} />
      <hemisphereLight args={['#fff4de', '#654f42', 0.88 * lightBoost]} />
      <directionalLight
        castShadow
        color={warmSun}
        intensity={1.48 * lightBoost}
        position={[-2.2, 2.8, 2.4]}
        shadow-camera-bottom={-4}
        shadow-camera-far={12}
        shadow-camera-left={-4}
        shadow-camera-near={0.1}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
      <pointLight color="#ffddb7" decay={2} distance={7} intensity={0.68 * lightBoost} position={[1.12, 0.44, 1.26]} />
      <pointLight color={accent.clone().multiplyScalar(1.6)} decay={2} distance={8} intensity={0.18 * lightBoost} position={[0.2, 0.3, -0.6]} />

      <mesh position={[0, -1.28, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 8]} />
        <meshStandardMaterial color="#9f7d64" roughness={0.96} />
      </mesh>

      <mesh position={[0, 0.18, -2.1]} receiveShadow>
        <planeGeometry args={[8.8, 4.2]} />
        <meshStandardMaterial color="#d6c0a8" roughness={0.98} />
      </mesh>

      <mesh position={[-3.28, 0.16, -0.12]} receiveShadow rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[5.2, 4.2]} />
        <meshStandardMaterial color="#ccb59b" roughness={0.98} />
      </mesh>

      <mesh position={[0.34, 1.08, -2.06]}>
        <planeGeometry args={[2.2, 1.32]} />
        <meshBasicMaterial color="#fff0cf" opacity={0.84} transparent />
      </mesh>
      <mesh position={[0.34, 1.08, -2.04]}>
        <planeGeometry args={[2.42, 1.54]} />
        <meshBasicMaterial color="#8e654b" />
      </mesh>
      <mesh position={[0.34, 1.08, -2.03]}>
        <boxGeometry args={[0.06, 1.54, 0.04]} />
        <meshStandardMaterial color="#8e654b" roughness={0.82} />
      </mesh>
      <mesh position={[0.34, 1.08, -2.03]}>
        <boxGeometry args={[2.42, 0.06, 0.04]} />
        <meshStandardMaterial color="#8e654b" roughness={0.82} />
      </mesh>

      <mesh position={[-0.62, 0.18, -1.92]} rotation={[0, 0, THREE.MathUtils.degToRad(14)]}>
        <planeGeometry args={[1.22, 2.8]} />
        <meshStandardMaterial color="#c58761" opacity={0.84} roughness={0.96} transparent />
      </mesh>
      <mesh position={[1.26, 0.22, -1.92]} rotation={[0, 0, THREE.MathUtils.degToRad(-10)]}>
        <planeGeometry args={[1.16, 2.72]} />
        <meshStandardMaterial color="#e2c29f" opacity={0.84} roughness={0.96} transparent />
      </mesh>

      <mesh position={[0.18, -1.08, 0.74]} receiveShadow>
        <boxGeometry args={[4.6, 0.14, 1.84]} />
        <meshStandardMaterial color="#7b5439" roughness={0.86} />
      </mesh>
      {[
        [-1.84, -1.52, 0.02],
        [2.06, -1.52, 0.02],
        [-1.84, -1.52, 1.46],
        [2.06, -1.52, 1.46],
      ].map((leg) => (
        <mesh castShadow key={leg.join('-')} position={leg}>
          <boxGeometry args={[0.14, 0.88, 0.14]} />
          <meshStandardMaterial color="#6d4932" roughness={0.84} />
        </mesh>
      ))}

      <mesh position={[0.44, -0.99, 0.66]} receiveShadow>
        <boxGeometry args={[1.44, 0.02, 0.76]} />
        <meshStandardMaterial color="#3b3430" opacity={0.92} roughness={0.82} transparent />
      </mesh>

      <mesh position={[-0.96, -1.21, 1.56]} receiveShadow rotation={[THREE.MathUtils.degToRad(-90), 0, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 0.14, 28]} />
        <meshStandardMaterial color="#4f3c31" roughness={0.92} />
      </mesh>
      <mesh position={[-0.96, -0.92, 1.42]} receiveShadow rotation={[0, THREE.MathUtils.degToRad(-12), 0]}>
        <boxGeometry args={[0.94, 0.12, 0.84]} />
        <meshStandardMaterial color="#8c6346" roughness={0.9} />
      </mesh>
      <mesh position={[-0.96, -0.64, 1.34]} receiveShadow rotation={[0, THREE.MathUtils.degToRad(-12), 0]}>
        <boxGeometry args={[0.86, 0.56, 0.12]} />
        <meshStandardMaterial color="#8c6346" roughness={0.9} />
      </mesh>
    </>
  );
}

function CompanionSetup({ scene, selectedDevice }) {
  const device = resolveCompanionDevice(scene, selectedDevice);

  return (
    <>
      <RoomDecor scene={scene} />
      {device === 'laptop' ? <LaptopDevice /> : null}
      {device === 'phone' ? <PhoneDevice /> : null}
      {device === 'desktop' ? <DesktopDevice /> : null}
    </>
  );
}

function MonitorRig({ product, scene, settings }) {
  const groupRef = useRef(null);
  const screenMaterialRef = useRef(null);
  const metrics = useMemo(() => buildMetrics(product), [product]);
  const pose = useMemo(() => getMonitorPose(scene, product, metrics), [scene, product, metrics]);
  const screenState = useMemo(() => createScreenTextureState(scene, product), [scene, product]);
  const logoTexture = useMemo(
    () => createLabelTexture(product.branding?.brandName || 'LuminaDisplay', 640, 140, { fontSize: product.sizeInch <= 7 ? 40 : 54 }),
    [product.branding?.brandName, product.sizeInch],
  );
  const rearLogoTexture = useMemo(
    () =>
      createLabelTexture(product.branding?.brandName || 'LuminaDisplay', 520, 120, {
        color: 'rgba(255,255,255,0.72)',
        fontSize: product.sizeInch <= 7 ? 34 : 44,
      }),
    [product.branding?.brandName, product.sizeInch],
  );
  const sceneStartRef = useRef(0);

  useEffect(() => {
    sceneStartRef.current = 0;
  }, [scene.id, product.id]);

  useEffect(
    () => () => {
      screenState.texture.dispose();
      logoTexture.dispose();
      rearLogoTexture.dispose();
    },
    [logoTexture, rearLogoTexture, screenState],
  );

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.set(pose.positionX, pose.baseOffsetY, pose.positionZ);
    groupRef.current.rotation.set(pose.rotationX, pose.rotationY, pose.rotationZ);
    groupRef.current.scale.setScalar(pose.scale);
  }, [pose]);

  useEffect(() => {
    if (screenMaterialRef.current) {
      screenMaterialRef.current.color.setScalar(settings.screenExposure);
    }
  }, [settings.screenExposure]);

  useFrame((state) => {
    if (!sceneStartRef.current) {
      sceneStartRef.current = state.clock.elapsedTime;
    }

    redrawScreenTexture(screenState, scene, product, state.clock.elapsedTime - sceneStartRef.current);

    if (!groupRef.current) return;

    groupRef.current.position.x = pose.positionX;
    groupRef.current.position.z = pose.positionZ;
    groupRef.current.position.y = pose.baseOffsetY + Math.sin(state.clock.elapsedTime * 0.68) * pose.floatAmount;
    groupRef.current.rotation.x = pose.rotationX;
    groupRef.current.rotation.z = pose.rotationZ;
    groupRef.current.rotation.y =
      pose.rotationY +
      (settings.autoRotate && scene.id !== 'ports-connectivity'
        ? Math.sin(state.clock.elapsedTime * 0.36) * 0.028
        : 0);
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[metrics.width, metrics.height, metrics.depth]} />
        <meshStandardMaterial color="#20262f" metalness={settings.metalness} roughness={settings.roughness} />
      </mesh>

      <mesh position={[0, 0.16, metrics.depth / 2 + 0.002]}>
        <planeGeometry args={[metrics.screenWidth, metrics.screenHeight]} />
        <meshBasicMaterial ref={screenMaterialRef} map={screenState.texture} toneMapped={false} />
      </mesh>

      <mesh position={[0, 0.16, metrics.depth / 2 + 0.006]}>
        <planeGeometry args={[metrics.screenWidth * 1.01, metrics.screenHeight * 1.01]} />
        <meshPhysicalMaterial clearcoat={1} color="#ffffff" metalness={0} opacity={0.12} roughness={0.18} transmission={0.08} transparent />
      </mesh>

      <mesh position={[0, -metrics.height * 0.42, metrics.depth / 2 + 0.004]}>
        <planeGeometry args={[metrics.width * 0.26, metrics.height * 0.05]} />
        <meshBasicMaterial map={logoTexture} toneMapped={false} transparent />
      </mesh>

      <mesh position={[-metrics.width * 0.24, metrics.height * 0.38, -metrics.depth / 2 - 0.004]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[metrics.width * 0.24, metrics.height * 0.045]} />
        <meshBasicMaterial map={rearLogoTexture} toneMapped={false} transparent />
      </mesh>

      <mesh castShadow position={[0, 0.04, -metrics.depth / 2 - metrics.depth * 0.04]} receiveShadow>
        <boxGeometry args={[metrics.width * 0.22, metrics.height * 0.18, metrics.depth * 0.3]} />
        <meshStandardMaterial color="#2c3440" metalness={settings.metalness} roughness={Math.max(settings.roughness, 0.4)} />
      </mesh>

      {[
        [-0.1, -0.1],
        [0.1, -0.1],
        [-0.1, 0.1],
        [0.1, 0.1],
      ].map((hole) => (
        <mesh key={hole.join('-')} position={[hole[0] * metrics.width, hole[1] * metrics.height, -metrics.depth / 2 - metrics.depth * 0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[metrics.depth * 0.14, metrics.depth * 0.14, metrics.depth * 0.12, 22]} />
          <meshStandardMaterial color="#d7e0ea" metalness={0.38} roughness={0.5} />
        </mesh>
      ))}

      {[
        { y: 0.16, width: metrics.depth * 0.42 },
        { y: 0.04, width: metrics.depth * 0.32 },
        { y: -0.08, width: metrics.depth * 0.32 },
        { y: -0.2, width: metrics.depth * 0.18 },
      ].map((port, index) => (
        <mesh
          key={`${port.y}-${port.width}`}
          position={[metrics.width / 2 + metrics.depth * 0.045, port.y * metrics.height, 0.14 - index * metrics.depth * 0.4]}
        >
          <boxGeometry args={[metrics.depth * 0.14, metrics.height * 0.03, port.width]} />
          <meshStandardMaterial color={index === 0 ? '#0b1118' : '#111827'} metalness={0.05} roughness={0.72} />
        </mesh>
      ))}

      {scene.id === 'ports-connectivity' ? (
        <mesh position={[metrics.width / 2 + metrics.depth * 0.08, 0.02, 0]}>
          <boxGeometry args={[metrics.width * 0.02, metrics.height * 0.46, metrics.depth * 0.9]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={0.18} opacity={0.22} transparent />
        </mesh>
      ) : null}

      <mesh castShadow position={[0, -metrics.height * 0.44, -metrics.depth * 0.5]} receiveShadow rotation={[THREE.MathUtils.degToRad(24), 0, 0]} scale={product.sizeInch <= 7 ? [0.84, 0.82, 0.84] : [1, 1, 1]}>
        <boxGeometry args={[metrics.width * 0.14, metrics.standHeight, metrics.depth * 1.3]} />
        <meshStandardMaterial color="#323b47" metalness={settings.metalness} roughness={Math.max(settings.roughness, 0.38)} />
      </mesh>

      <mesh
        castShadow
        position={[0, -metrics.height * 0.76, metrics.depth * 0.1]}
        receiveShadow
        rotation={[0, 0, Math.PI / 2]}
        scale={product.sizeInch <= 7 ? [0.85, 0.85, 0.85] : [1, 1, 1]}
      >
        <cylinderGeometry args={[metrics.depth * 0.24, metrics.depth * 0.3, metrics.footWidth, 28]} />
        <meshStandardMaterial color="#3a4450" metalness={settings.metalness} roughness={Math.max(settings.roughness, 0.42)} />
      </mesh>
    </group>
  );
}

function StageScene({ companionDevice, controllerRef, product, scene, settings }) {
  const { camera, gl, scene: threeScene } = useThree();
  const orbitRef = useRef(createOrbitState());
  const cameraTargetRef = useRef(new THREE.Vector3(0.18, -0.05, 0.16));

  useEffect(() => {
    positionCamera(camera, orbitRef.current, cameraTargetRef.current, scene);
    updateCameraPose(camera, orbitRef.current, cameraTargetRef.current, true);
  }, [camera, scene]);

  useEffect(() => {
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
  }, [camera, settings.fov]);

  useEffect(() => {
    controllerRef.current = {
      camera,
      gl,
      resetView() {
        resetOrbit(orbitRef.current);
      },
      scene: threeScene,
    };

    const domElement = gl.domElement;

    function handlePointerDown(event) {
      if (event.button !== 0 && event.button !== 2) return;
      orbitRef.current.dragging = true;
      orbitRef.current.mode = event.button === 2 ? 'pan' : 'orbit';
      orbitRef.current.pointerX = event.clientX;
      orbitRef.current.pointerY = event.clientY;
      domElement.classList.add('is-dragging');
    }

    function handlePointerMove(event) {
      if (!orbitRef.current.dragging) return;
      const deltaX = event.clientX - orbitRef.current.pointerX;
      const deltaY = event.clientY - orbitRef.current.pointerY;
      orbitRef.current.pointerX = event.clientX;
      orbitRef.current.pointerY = event.clientY;

      if (orbitRef.current.mode === 'pan') {
        const panScale = orbitRef.current.currentRadius * 0.0009;
        const forward = TEMP_TARGET.copy(camera.position).sub(cameraTargetRef.current).normalize();
        const right = TEMP_VECTOR.crossVectors(camera.up, forward).normalize();
        const up = new THREE.Vector3().crossVectors(forward, right).normalize();
        cameraTargetRef.current.addScaledVector(right, -deltaX * panScale);
        cameraTargetRef.current.addScaledVector(up, deltaY * panScale);
        return;
      }

      orbitRef.current.theta -= deltaX * 0.008;
      orbitRef.current.phi = THREE.MathUtils.clamp(orbitRef.current.phi - deltaY * 0.008, 0.42, Math.PI - 0.42);
    }

    function handlePointerUp() {
      orbitRef.current.dragging = false;
      orbitRef.current.mode = '';
      domElement.classList.remove('is-dragging');
    }

    function handleWheel(event) {
      event.preventDefault();
      const zoomFactor = 1 + event.deltaY * 0.0012;
      orbitRef.current.radius = THREE.MathUtils.clamp(
        orbitRef.current.radius * zoomFactor,
        orbitRef.current.minRadius,
        orbitRef.current.maxRadius,
      );
    }

    function handleContextMenu(event) {
      event.preventDefault();
    }

    domElement.addEventListener('pointerdown', handlePointerDown);
    domElement.addEventListener('contextmenu', handleContextMenu);
    domElement.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      controllerRef.current = null;
      domElement.removeEventListener('pointerdown', handlePointerDown);
      domElement.removeEventListener('contextmenu', handleContextMenu);
      domElement.removeEventListener('wheel', handleWheel);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [camera, controllerRef, gl, threeScene]);

  useFrame(() => {
    updateCameraPose(camera, orbitRef.current, cameraTargetRef.current);
  });

  return (
    <>
      <CozyRoomEnvironment lightBoost={settings.lightBoost} scene={scene} />
      <MonitorRig product={product} scene={scene} settings={settings} />
      <group visible={settings.propsVisible}>
        <CompanionSetup scene={scene} selectedDevice={companionDevice} />
      </group>
    </>
  );
}

export const PortableMonitorStage = forwardRef(function PortableMonitorStage(
  { companionDevice = 'auto', product, scene, settings },
  ref,
) {
  const controllerRef = useRef(null);
  const stageStyle = {
    '--stage-accent': 'rgba(245, 203, 154, 0.24)',
    '--stage-backdrop': 'linear-gradient(180deg, #cfbaa2 0%, #9c8169 52%, #463630 100%)',
    '--stage-text': scene.appearance.text,
  };

  useImperativeHandle(
    ref,
    () => ({
      captureStream(fps = 30) {
        const canvas = controllerRef.current?.gl?.domElement;
        if (!canvas || typeof canvas.captureStream !== 'function') return null;
        return canvas.captureStream(fps);
      },
      exportPng(filename = 'scene.png') {
        const canvas = controllerRef.current?.gl?.domElement;
        const renderer = controllerRef.current?.gl;
        const threeScene = controllerRef.current?.scene;
        const camera = controllerRef.current?.camera;
        if (!canvas || !renderer || !threeScene || !camera) return;
        renderer.render(threeScene, camera);
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename;
        link.click();
      },
      isReady() {
        return Boolean(controllerRef.current?.gl && controllerRef.current?.camera);
      },
      resetView() {
        controllerRef.current?.resetView?.();
      },
    }),
    [],
  );

  return (
    <div className="three-stage" style={stageStyle}>
      <Canvas
        camera={{ far: 100, fov: settings.fov, near: 0.01, position: [2.35, 0.18, 3.05] }}
        className="three-stage__canvas-surface"
        dpr={[1, 3]}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        shadows
      >
        <StageScene
          companionDevice={companionDevice}
          controllerRef={controllerRef}
          product={product}
          scene={scene}
          settings={settings}
        />
      </Canvas>
    </div>
  );
});
