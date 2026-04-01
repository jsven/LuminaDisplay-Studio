import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildMetrics, createLabelTexture, createScreenTextureState, redrawScreenTexture } from './screenTextures.js';
import { getSceneLayout } from './scene-layout.config.js';

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

function toRadians(rotationDeg = [0, 0, 0]) {
  return rotationDeg.map((value) => THREE.MathUtils.degToRad(value));
}

function resolveCompanionDevice(layout, selectedDevice) {
  if (selectedDevice && selectedDevice !== 'auto') return selectedDevice;
  return layout.companion.device || 'laptop';
}

function getMonitorPose(layout, product, metrics) {
  const deskTopY = layout.monitor.surfaceY;
  const footRadius = metrics.depth * 0.24;
  const currentFootCenterY = -metrics.height * 0.76;
  const groundingOffsetY = deskTopY + footRadius - currentFootCenterY;
  const [rotationX, rotationY, rotationZ] = toRadians(layout.monitor.rotationDeg);
  const [positionX, , positionZ] = layout.monitor.position;

  return {
    baseOffsetY: groundingOffsetY,
    floatAmount: layout.monitor.floatAmount,
    positionX,
    positionZ,
    rotationX,
    rotationY,
    rotationZ,
    scale: (layout.monitor.scale || 1) * (product.sizeInch <= 7 ? 1.02 : 1),
  };
}

function positionCamera(camera, orbit, cameraTarget, layout) {
  camera.position.set(...layout.camera.position);
  cameraTarget.set(...layout.camera.target);

  TEMP_SPHERICAL.setFromVector3(camera.position.clone().sub(cameraTarget));
  orbit.theta = TEMP_SPHERICAL.theta;
  orbit.phi = TEMP_SPHERICAL.phi;
  orbit.radius = TEMP_SPHERICAL.radius;
  orbit.currentTheta = TEMP_SPHERICAL.theta;
  orbit.currentPhi = TEMP_SPHERICAL.phi;
  orbit.currentRadius = TEMP_SPHERICAL.radius;
  orbit.minRadius = layout.camera.orbitMinRadius ?? 1.5;
  orbit.maxRadius = layout.camera.orbitMaxRadius ?? 6.5;
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

function LaptopDevice({ layout }) {
  const config = layout.companion.laptop;
  const rotation = toRadians(config.rotationDeg);

  return (
    <group position={config.position} rotation={rotation} scale={config.scale}>
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
      <CableCurve
        from={config.cable.from}
        midOffsetA={config.cable.midOffsetA}
        midOffsetB={config.cable.midOffsetB}
        to={config.cable.to}
      />
    </group>
  );
}

function PhoneDevice({ layout }) {
  const config = layout.companion.phone;
  const rotation = toRadians(config.rotationDeg);

  return (
    <group position={config.position} rotation={rotation}>
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
      <CableCurve
        from={config.cable.from}
        midOffsetA={config.cable.midOffsetA}
        midOffsetB={config.cable.midOffsetB}
        to={config.cable.to}
      />
    </group>
  );
}

function DesktopDevice({ layout }) {
  const tower = layout.companion.desktop.tower;
  const keyboard = layout.companion.desktop.keyboard;
  const mouse = layout.companion.desktop.mouse;
  const cable = layout.companion.desktop.cable;
  const rotation = toRadians(tower.rotationDeg);

  return (
    <>
      <group position={tower.position} rotation={rotation} scale={tower.scale}>
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
      <DeskKeyboard position={keyboard.position} scale={keyboard.scale} />
      <DeskMouse position={mouse.position} scale={mouse.scale} />
      <CableCurve
        color={cable.color}
        from={cable.from}
        midOffsetA={cable.midOffsetA}
        midOffsetB={cable.midOffsetB}
        to={cable.to}
      />
    </>
  );
}

function CoffeeMug({ position }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.16, 18]} />
        <meshStandardMaterial color="#ece9e1" roughness={0.92} />
      </mesh>
      <mesh castShadow position={[0.08, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.04, 0.008, 10, 22]} />
        <meshStandardMaterial color="#d8b287" roughness={0.74} />
      </mesh>
    </group>
  );
}

function DeskNotebook({ position, rotationDeg }) {
  return (
    <mesh castShadow receiveShadow position={position} rotation={toRadians(rotationDeg)}>
      <boxGeometry args={[0.46, 0.03, 0.32]} />
      <meshStandardMaterial color="#d6c2a2" roughness={0.92} />
    </mesh>
  );
}

function DockHub({ position }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.04, 0.16]} />
        <meshStandardMaterial color="#444a53" metalness={0.18} roughness={0.64} />
      </mesh>
      {[-0.1, 0, 0.1].map((offset) => (
        <mesh key={offset} position={[offset, 0.01, 0.081]}>
          <boxGeometry args={[0.04, 0.02, 0.01]} />
          <meshStandardMaterial color="#111827" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function DeskSpeakerPair({ positions }) {
  return (
    <>
      {positions.map((position) => (
        <group key={position.join('-')} position={position}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[0.24, 0.42, 0.22]} />
            <meshStandardMaterial color="#2a2f36" metalness={0.18} roughness={0.62} />
          </mesh>
          <mesh position={[0, 0.08, 0.12]}>
            <cylinderGeometry args={[0.06, 0.06, 0.02, 18]} />
            <meshStandardMaterial color="#15181e" roughness={0.46} />
          </mesh>
          <mesh position={[0, -0.08, 0.12]}>
            <cylinderGeometry args={[0.035, 0.035, 0.02, 18]} />
            <meshStandardMaterial color="#15181e" roughness={0.46} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function DeskLamp({ position }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 0.32, 20]} />
        <meshStandardMaterial color="#d8d8d1" roughness={0.66} />
      </mesh>
      <mesh castShadow position={[0.06, 0.58, -0.04]} rotation={[0, 0, THREE.MathUtils.degToRad(-18)]}>
        <cylinderGeometry args={[0.016, 0.026, 0.62, 18]} />
        <meshStandardMaterial color="#4b4844" roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0.18, 0.8, -0.12]}>
        <coneGeometry args={[0.18, 0.22, 20]} />
        <meshStandardMaterial color="#efe1cd" roughness={0.9} />
      </mesh>
    </group>
  );
}

function DeskPlant({ position }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 0.24, 18]} />
        <meshStandardMaterial color="#8b6546" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0.34, 0]}>
        <sphereGeometry args={[0.16, 18, 18]} />
        <meshStandardMaterial color="#6e915f" roughness={0.88} />
      </mesh>
      <mesh castShadow position={[-0.1, 0.34, 0.06]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#769b64" roughness={0.88} />
      </mesh>
      <mesh castShadow position={[0.1, 0.3, -0.04]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#5d7f55" roughness={0.88} />
      </mesh>
    </group>
  );
}

function DeskAccessories({ layout }) {
  const { accessories } = layout;
  const { items } = accessories;

  return (
    <>
      {items.includes('mug') ? <CoffeeMug position={accessories.mug.position} /> : null}
      {items.includes('notebook') ? <DeskNotebook position={accessories.notebook.position} rotationDeg={accessories.notebook.rotationDeg} /> : null}
      {items.includes('hub') ? <DockHub position={accessories.hub.position} /> : null}
      {items.includes('speakers') ? <DeskSpeakerPair positions={accessories.speakers.positions} /> : null}
      {items.includes('lamp') ? <DeskLamp position={accessories.lamp.position} /> : null}
      {items.includes('plant') ? <DeskPlant position={accessories.plant.position} /> : null}
    </>
  );
}

function RoomDecor({ layout, scene }) {
  const accent = scene.appearance.accent || '#7dd3fc';
  const { room } = layout;

  return (
    <>
      <mesh position={room.rug.position} receiveShadow rotation={toRadians(room.rug.rotationDeg)}>
        <planeGeometry args={[2.9, 1.86]} />
        <meshStandardMaterial color="#d6bf9d" roughness={0.96} />
      </mesh>

      <group position={room.shelf.position}>
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

    </>
  );
}

function CozyRoomEnvironment({ layout, lightBoost, scene }) {
  const accent = useMemo(() => new THREE.Color(scene.appearance.accent || '#7dd3fc'), [scene.appearance.accent]);
  const warmSun = useMemo(() => accent.clone().lerp(new THREE.Color('#ffd2a3'), 0.72), [accent]);
  const { room } = layout;

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

      <mesh position={room.window.glowPlane}>
        <planeGeometry args={[2.2, 1.32]} />
        <meshBasicMaterial color="#fff0cf" opacity={0.84} transparent />
      </mesh>
      <mesh position={room.window.panelPlane}>
        <planeGeometry args={[2.42, 1.54]} />
        <meshBasicMaterial color="#8e654b" />
      </mesh>
      <mesh position={room.window.frameCenter}>
        <boxGeometry args={[0.06, 1.54, 0.04]} />
        <meshStandardMaterial color="#8e654b" roughness={0.82} />
      </mesh>
      <mesh position={room.window.frameCenter}>
        <boxGeometry args={[2.42, 0.06, 0.04]} />
        <meshStandardMaterial color="#8e654b" roughness={0.82} />
      </mesh>

      <mesh position={room.curtains.left.position} rotation={toRadians(room.curtains.left.rotationDeg)}>
        <planeGeometry args={[1.22, 2.8]} />
        <meshStandardMaterial color="#c58761" opacity={0.84} roughness={0.96} transparent />
      </mesh>
      <mesh position={room.curtains.right.position} rotation={toRadians(room.curtains.right.rotationDeg)}>
        <planeGeometry args={[1.16, 2.72]} />
        <meshStandardMaterial color="#e2c29f" opacity={0.84} roughness={0.96} transparent />
      </mesh>

      <mesh position={room.desk.top.position} receiveShadow>
        <boxGeometry args={[4.6, 0.14, 1.84]} />
        <meshStandardMaterial color="#7b5439" roughness={0.86} />
      </mesh>
      {room.desk.legs.map((leg) => (
        <mesh castShadow key={leg.join('-')} position={leg}>
          <boxGeometry args={[0.14, 0.88, 0.14]} />
          <meshStandardMaterial color="#6d4932" roughness={0.84} />
        </mesh>
      ))}

      <mesh position={room.desk.mat.position} receiveShadow>
        <boxGeometry args={[1.44, 0.02, 0.76]} />
        <meshStandardMaterial color="#3b3430" opacity={0.92} roughness={0.82} transparent />
      </mesh>

      <mesh position={room.chair.stoolBase.position} receiveShadow rotation={toRadians(room.chair.stoolBase.rotationDeg)}>
        <cylinderGeometry args={[0.72, 0.72, 0.14, 28]} />
        <meshStandardMaterial color="#4f3c31" roughness={0.92} />
      </mesh>
      <mesh position={room.chair.seat.position} receiveShadow rotation={toRadians(room.chair.seat.rotationDeg)}>
        <boxGeometry args={[0.94, 0.12, 0.84]} />
        <meshStandardMaterial color="#8c6346" roughness={0.9} />
      </mesh>
      <mesh position={room.chair.backrest.position} receiveShadow rotation={toRadians(room.chair.backrest.rotationDeg)}>
        <boxGeometry args={[0.86, 0.56, 0.12]} />
        <meshStandardMaterial color="#8c6346" roughness={0.9} />
      </mesh>
    </>
  );
}

function CompanionSetup({ layout, scene, selectedDevice }) {
  const device = resolveCompanionDevice(layout, selectedDevice);

  return (
    <>
      <RoomDecor layout={layout} scene={scene} />
      {device === 'laptop' ? <LaptopDevice layout={layout} /> : null}
      {device === 'phone' ? <PhoneDevice layout={layout} /> : null}
      {device === 'desktop' ? <DesktopDevice layout={layout} /> : null}
      <DeskAccessories layout={layout} />
    </>
  );
}

function MonitorRig({ layout, product, scene, settings }) {
  const groupRef = useRef(null);
  const screenMaterialRef = useRef(null);
  const metrics = useMemo(() => buildMetrics(product), [product]);
  const pose = useMemo(() => getMonitorPose(layout, product, metrics), [layout, product, metrics]);
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
  const layout = useMemo(() => getSceneLayout(scene.id), [scene.id]);

  useEffect(() => {
    positionCamera(camera, orbitRef.current, cameraTargetRef.current, layout);
    updateCameraPose(camera, orbitRef.current, cameraTargetRef.current, true);
  }, [camera, layout]);

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
      <CozyRoomEnvironment layout={layout} lightBoost={settings.lightBoost} scene={scene} />
      <MonitorRig layout={layout} product={product} scene={scene} settings={settings} />
      <group visible={settings.propsVisible}>
        <CompanionSetup layout={layout} scene={scene} selectedDevice={companionDevice} />
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
