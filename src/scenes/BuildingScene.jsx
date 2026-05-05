import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';

// ─── MATERIALS — vibrant, colourful palette ───────────────────────────────────
const MAT = {
  // Shared structural — warm cream walls, terracotta roof
  wall:        new THREE.MeshStandardMaterial({ color: '#FFF8EE', roughness: 0.78, metalness: 0.0 }),
  wallDark:    new THREE.MeshStandardMaterial({ color: '#F0E6D2', roughness: 0.80, metalness: 0.0 }),
  roof:        new THREE.MeshStandardMaterial({ color: '#C44E2A', roughness: 0.65, metalness: 0.06 }), // terracotta
  roofTrim:    new THREE.MeshStandardMaterial({ color: '#8C3520', roughness: 0.72, metalness: 0.0 }),
  window:      new THREE.MeshStandardMaterial({ color: '#A8D4F0', roughness: 0.0,  metalness: 0.15, transparent: true, opacity: 0.75 }),
  windowFrame: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.85, metalness: 0.0 }),
  door:        new THREE.MeshStandardMaterial({ color: '#2D6B8C', roughness: 0.70, metalness: 0.12 }), // deep teal door
  ground:      new THREE.MeshStandardMaterial({ color: '#E8E2D4', roughness: 0.95, metalness: 0.0 }),
  chimney:     new THREE.MeshStandardMaterial({ color: '#B85C38', roughness: 0.80, metalness: 0.0 }),
  trim:        new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.85, metalness: 0.0 }),
  step:        new THREE.MeshStandardMaterial({ color: '#D4C8B0', roughness: 0.88, metalness: 0.0 }),
  scanMat:     new THREE.MeshBasicMaterial({ color: '#2D6B8C', transparent: true, opacity: 0.9 }),
  garden:      new THREE.MeshStandardMaterial({ color: '#6EC86E', roughness: 0.92, metalness: 0.0 }),
  driveway:    new THREE.MeshStandardMaterial({ color: '#C8BFA8', roughness: 0.88, metalness: 0.0 }),
  treeTrunk:   new THREE.MeshStandardMaterial({ color: '#8C6840', roughness: 0.88, metalness: 0.0 }),
  treeLeaf:    new THREE.MeshStandardMaterial({ color: '#4AAE4A', roughness: 0.92, metalness: 0.0 }),
  signage:     new THREE.MeshStandardMaterial({ color: '#4F7BF5', roughness: 0.55, metalness: 0.3 }),
  metalDark:   new THREE.MeshStandardMaterial({ color: '#7098C8', roughness: 0.45, metalness: 0.55 }),
  concrete:    new THREE.MeshStandardMaterial({ color: '#D0C8B8', roughness: 0.88, metalness: 0.0 }),
  glassLobby:  new THREE.MeshStandardMaterial({ color: '#78C4E8', roughness: 0.0,  metalness: 0.25, transparent: true, opacity: 0.55 }),
  figBody:     new THREE.MeshStandardMaterial({ color: '#4A6A9A', roughness: 0.85, metalness: 0.0 }),

  // Neighbourhood scene — vivid colourful palette
  wallCream:   new THREE.MeshStandardMaterial({ color: '#FFF3D4', roughness: 0.78, metalness: 0.0 }),
  wallSage:    new THREE.MeshStandardMaterial({ color: '#B8D4B0', roughness: 0.80, metalness: 0.0 }),
  roofTerra:   new THREE.MeshStandardMaterial({ color: '#D05830', roughness: 0.65, metalness: 0.08 }),
  roofTrim2:   new THREE.MeshStandardMaterial({ color: '#9C4020', roughness: 0.72, metalness: 0.0 }),
  doorTeal:    new THREE.MeshStandardMaterial({ color: '#1A8080', roughness: 0.65, metalness: 0.14 }),
  lawn:        new THREE.MeshStandardMaterial({ color: '#5ECC5E', roughness: 0.92, metalness: 0.0 }),
  path:        new THREE.MeshStandardMaterial({ color: '#CEB898', roughness: 0.90, metalness: 0.0 }),
  leafA:       new THREE.MeshStandardMaterial({ color: '#55C855', roughness: 0.92, metalness: 0.0 }),
  leafB:       new THREE.MeshStandardMaterial({ color: '#3EA83E', roughness: 0.92, metalness: 0.0 }),
  leafC:       new THREE.MeshStandardMaterial({ color: '#2D7A2D', roughness: 0.92, metalness: 0.0 }),
  figBlue:     new THREE.MeshStandardMaterial({ color: '#3A5AAE', roughness: 0.85, metalness: 0.0 }),
  figRed:      new THREE.MeshStandardMaterial({ color: '#D44030', roughness: 0.85, metalness: 0.0 }),
  figGreen:    new THREE.MeshStandardMaterial({ color: '#1A9060', roughness: 0.85, metalness: 0.0 }),
  figGold:     new THREE.MeshStandardMaterial({ color: '#D48A20', roughness: 0.85, metalness: 0.0 }),
  figPurple:   new THREE.MeshStandardMaterial({ color: '#7A40A0', roughness: 0.85, metalness: 0.0 }),
  skin:        new THREE.MeshStandardMaterial({ color: '#E0A878', roughness: 0.82, metalness: 0.0 }),
};

// ─── WINDOW COMPONENT ─────────────────────────────────────────────────────────
function Window({ position, size = [0.55, 0.7, 0.06] }) {
  return (
    <group position={position}>
      <mesh material={MAT.windowFrame}>
        <boxGeometry args={[size[0] + 0.05, size[1] + 0.05, size[2]]} />
      </mesh>
      <mesh position={[0, 0, 0.02]} material={MAT.window}>
        <boxGeometry args={[size[0] - 0.06, size[1] - 0.06, 0.04]} />
      </mesh>
      <mesh position={[0, 0, 0.04]} material={MAT.windowFrame}>
        <boxGeometry args={[size[0] - 0.08, 0.03, 0.02]} />
      </mesh>
      <mesh position={[0, 0, 0.04]} material={MAT.windowFrame}>
        <boxGeometry args={[0.03, size[1] - 0.08, 0.02]} />
      </mesh>
    </group>
  );
}

// ─── SCAN BOX ─────────────────────────────────────────────────────────────────
function ScanBox({ position, size, delay = 0 }) {
  const groupRef = useRef();
  const matRef   = useRef(new THREE.MeshBasicMaterial({ color: '#2D6B8C', transparent: true, opacity: 0.85 }));

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t     = clock.getElapsedTime();
    const cycle = ((t + delay) % 4) / 4;
    const opacity = cycle < 0.1  ? cycle / 0.1
                  : cycle < 0.7  ? 1
                  : cycle < 0.9  ? (1 - (cycle - 0.7) / 0.2)
                  : 0;
    matRef.current.opacity = opacity * 0.85;
    groupRef.current.scale.setScalar(0.96 + Math.sin(t * 2 + delay) * 0.02);
  });

  const edgeMat  = matRef.current;
  const cornerLen = 0.18;
  const thick     = 0.015;
  const [w, h, d] = size;

  const corners = [
    [[-w/2,  h/2, d/2+0.01], [cornerLen, thick,     thick]],
    [[-w/2 + cornerLen/2 - thick/2,  h/2, d/2+0.01], [thick, cornerLen, thick]],
    [[ w/2,  h/2, d/2+0.01], [cornerLen, thick,     thick]],
    [[ w/2 - cornerLen/2 + thick/2,  h/2, d/2+0.01], [thick, cornerLen, thick]],
    [[-w/2, -h/2, d/2+0.01], [cornerLen, thick,     thick]],
    [[-w/2 + cornerLen/2 - thick/2, -h/2, d/2+0.01], [thick, cornerLen, thick]],
    [[ w/2, -h/2, d/2+0.01], [cornerLen, thick,     thick]],
    [[ w/2 - cornerLen/2 + thick/2, -h/2, d/2+0.01], [thick, cornerLen, thick]],
  ];

  return (
    <group ref={groupRef} position={position}>
      {corners.map(([pos, geo], i) => (
        <mesh key={i} position={pos} material={edgeMat}>
          <boxGeometry args={geo} />
        </mesh>
      ))}
    </group>
  );
}

// ─── SCAN LINE ────────────────────────────────────────────────────────────────
function ScanLine({ top = 3.5 }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() % 3.5) / 3.5;
    ref.current.position.y = top - t * (top * 2);
    ref.current.material.opacity = t < 0.05 ? t / 0.05
                                 : t > 0.9  ? (1 - (t - 0.9) / 0.1)
                                 : 0.6;
  });
  return (
    <mesh ref={ref} position={[0, top, 1.5]}>
      <planeGeometry args={[8, 0.025]} />
      <meshBasicMaterial color="#2D6B8C" transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── APARTMENT BUILDING ───────────────────────────────────────────────────────
function ApartmentBuilding() {
  const W = 4, H = 4.5, D = 2;
  const floorH = H / 4;
  const winY = [floorH * 0.52, floorH * 1.52, floorH * 2.52, floorH * 3.52];
  const winX = [-1.1, 0, 1.1];

  return (
    <group>
      <mesh position={[0, -0.08, 0]} receiveShadow material={MAT.ground}>
        <boxGeometry args={[6.5, 0.12, 5.5]} />
      </mesh>
      <gridHelper args={[6.0, 12, '#D8E8F0', '#E8F0F8']} position={[0, -0.01, 0]} />

      {/* Main body */}
      <mesh position={[0, H/2, 0]} castShadow receiveShadow material={MAT.wall}>
        <boxGeometry args={[W, H, D]} />
      </mesh>

      {/* Floor band separators */}
      {[1, 2, 3].map(i => (
        <mesh key={i} position={[0, floorH * i, 0]} material={MAT.wallDark}>
          <boxGeometry args={[W + 0.05, 0.06, D + 0.05]} />
        </mesh>
      ))}

      {/* Parapet */}
      <mesh position={[0, H + 0.14, 0]} castShadow material={MAT.trim}>
        <boxGeometry args={[W + 0.1, 0.28, D + 0.1]} />
      </mesh>

      {/* Water tank */}
      <mesh position={[0.9, H + 0.57, -0.3]} castShadow material={MAT.concrete}>
        <boxGeometry args={[0.9, 0.55, 0.65]} />
      </mesh>

      {/* Lobby glass */}
      <mesh position={[0, floorH * 0.34, D/2 + 0.02]} material={MAT.glassLobby}>
        <boxGeometry args={[W * 0.68, floorH * 0.58, 0.06]} />
      </mesh>

      {/* Front windows — 3 cols × 4 rows */}
      {winY.map((y, row) =>
        winX.map((x, col) => (
          <Window key={`f-${row}-${col}`} position={[x, y, D/2 + 0.02]} size={[0.5, 0.6, 0.06]} />
        ))
      )}

      {/* Side windows left */}
      {winY.map((y, row) => (
        <Window key={`sl-${row}`} position={[-W/2 - 0.02, y, 0]} size={[0.45, 0.55, 0.06]} />
      ))}

      {/* Side windows right */}
      {winY.map((y, row) => (
        <Window key={`sr-${row}`} position={[W/2 + 0.02, y, 0]} size={[0.45, 0.55, 0.06]} />
      ))}

      {/* Balconies at floors 2, 3, 4 */}
      {[1, 2, 3].map(i => (
        <group key={i}>
          <mesh position={[0, floorH * i - 0.08, D/2 + 0.22]} material={MAT.step}>
            <boxGeometry args={[W * 0.75, 0.1, 0.42]} />
          </mesh>
          <mesh position={[0, floorH * i + 0.24, D/2 + 0.42]} material={MAT.trim}>
            <boxGeometry args={[W * 0.75, 0.05, 0.03]} />
          </mesh>
        </group>
      ))}

      {/* Entrance steps */}
      <mesh position={[0, -0.22, D/2 + 0.4]} castShadow receiveShadow material={MAT.step}>
        <boxGeometry args={[1.5, 0.12, 0.45]} />
      </mesh>

      <ScanBox position={[0, H/2, 0]} size={[W, H, D]} delay={0} />
      <ScanBox position={[0, H * 0.75, D/2]} size={[W * 0.85, H * 0.22, 0.2]} delay={1.5} />
      <ScanLine top={5.5} />
    </group>
  );
}

// ─── VILLA BUILDING ───────────────────────────────────────────────────────────
function VillaBuilding() {
  const W = 3.2, H = 2.4, D = 2.8;

  return (
    <group>
      <mesh position={[0, -0.08, 0.8]} receiveShadow material={MAT.ground}>
        <boxGeometry args={[8.0, 0.12, 7.0]} />
      </mesh>
      <gridHelper args={[7.5, 15, '#D8E8F0', '#E8F0F8']} position={[0, -0.01, 0.8]} />

      {/* Garden */}
      <mesh position={[0, -0.01, 3.2]} receiveShadow material={MAT.garden}>
        <boxGeometry args={[5.0, 0.05, 2.0]} />
      </mesh>

      {/* Driveway */}
      <mesh position={[W/2 + 1.0, -0.01, 2.0]} receiveShadow material={MAT.driveway}>
        <boxGeometry args={[2.2, 0.04, 4.0]} />
      </mesh>

      {/* Boundary walls */}
      <mesh position={[0, 0.16, 4.2]} castShadow material={MAT.step}>
        <boxGeometry args={[6.0, 0.3, 0.15]} />
      </mesh>
      <mesh position={[-3.0, 0.16, 2.4]} castShadow material={MAT.step}>
        <boxGeometry args={[0.15, 0.3, 3.6]} />
      </mesh>

      {/* Tree */}
      <group position={[-2.0, 0, 3.0]}>
        <mesh position={[0, 0.55, 0]} castShadow material={MAT.treeTrunk}>
          <cylinderGeometry args={[0.1, 0.14, 1.1, 8]} />
        </mesh>
        <mesh position={[0, 1.4, 0]} castShadow material={MAT.treeLeaf}>
          <sphereGeometry args={[0.6, 8, 6]} />
        </mesh>
      </group>

      {/* Front steps */}
      <mesh position={[0, -0.22, D/2 + 0.35]} castShadow receiveShadow material={MAT.step}>
        <boxGeometry args={[1.0, 0.12, 0.4]} />
      </mesh>
      <mesh position={[0, -0.36, D/2 + 0.65]} castShadow receiveShadow material={MAT.step}>
        <boxGeometry args={[1.3, 0.12, 0.4]} />
      </mesh>

      {/* Main body */}
      <mesh position={[0, H/2, 0]} castShadow receiveShadow material={MAT.wall}>
        <boxGeometry args={[W, H, D]} />
      </mesh>

      {/* Side wings */}
      <mesh position={[-W/2 - 0.45, H/2 - 0.3, 0]} castShadow material={MAT.wallDark}>
        <boxGeometry args={[0.9, H - 0.6, D * 0.7]} />
      </mesh>
      <mesh position={[W/2 + 0.45, H/2 - 0.3, 0]} castShadow material={MAT.wallDark}>
        <boxGeometry args={[0.9, H - 0.6, D * 0.7]} />
      </mesh>

      {/* Cornice */}
      <mesh position={[0, H + 0.06, 0]} castShadow material={MAT.trim}>
        <boxGeometry args={[W + 0.12, 0.1, D + 0.12]} />
      </mesh>

      {/* Windows front */}
      <Window position={[-0.9, H * 0.65, D/2 + 0.02]} />
      <Window position={[ 0.9, H * 0.65, D/2 + 0.02]} />
      <Window position={[-0.9, H * 0.28, D/2 + 0.02]} />
      <Window position={[ 0.9, H * 0.28, D/2 + 0.02]} />

      {/* Windows side */}
      <Window position={[-W/2 - 0.02, H * 0.65, -0.4]} size={[0.48, 0.62, 0.06]} />
      <Window position={[-W/2 - 0.02, H * 0.28, -0.4]} size={[0.48, 0.62, 0.06]} />
      <Window position={[ W/2 + 0.02, H * 0.65, -0.4]} size={[0.48, 0.62, 0.06]} />
      <Window position={[ W/2 + 0.02, H * 0.28, -0.4]} size={[0.48, 0.62, 0.06]} />

      {/* Door */}
      <mesh position={[0, 0.65, D/2 + 0.03]} castShadow material={MAT.door}>
        <boxGeometry args={[0.7, 1.3, 0.06]} />
      </mesh>
      <mesh position={[0, 0.65, D/2 + 0.05]} material={MAT.windowFrame}>
        <boxGeometry args={[0.82, 1.42, 0.04]} />
      </mesh>

      {/* Hip roof */}
      <mesh position={[0, H + 0.8, D/4]} rotation={[-Math.PI * 0.26, 0, 0]} castShadow material={MAT.roof}>
        <boxGeometry args={[W + 0.3, 0.08, D/2 + 0.5]} />
      </mesh>
      <mesh position={[0, H + 0.8, -D/4]} rotation={[Math.PI * 0.26, 0, 0]} castShadow material={MAT.roof}>
        <boxGeometry args={[W + 0.3, 0.08, D/2 + 0.5]} />
      </mesh>
      <mesh position={[-W/2 - 0.05, H + 0.5, 0]} rotation={[0, 0, Math.PI * 0.22]} castShadow material={MAT.roofTrim}>
        <boxGeometry args={[0.08, D * 0.6, D + 0.3]} />
      </mesh>
      <mesh position={[W/2 + 0.05, H + 0.5, 0]} rotation={[0, 0, -Math.PI * 0.22]} castShadow material={MAT.roofTrim}>
        <boxGeometry args={[0.08, D * 0.6, D + 0.3]} />
      </mesh>
      <mesh position={[0, H + 1.32, 0]} castShadow material={MAT.roofTrim}>
        <boxGeometry args={[W - 0.6, 0.1, 0.2]} />
      </mesh>

      {/* Chimneys */}
      <mesh position={[-0.7, H + 1.5, -0.4]} castShadow material={MAT.chimney}>
        <boxGeometry args={[0.28, 0.5, 0.28]} />
      </mesh>
      <mesh position={[-0.7, H + 1.78, -0.4]} material={MAT.trim}>
        <boxGeometry args={[0.34, 0.06, 0.34]} />
      </mesh>
      <mesh position={[0.7, H + 1.4, -0.3]} castShadow material={MAT.chimney}>
        <boxGeometry args={[0.22, 0.35, 0.22]} />
      </mesh>
      <mesh position={[0.7, H + 1.61, -0.3]} material={MAT.trim}>
        <boxGeometry args={[0.28, 0.05, 0.28]} />
      </mesh>

      {/* Garage */}
      <mesh position={[W/2 + 1.2, 0.9, 0.3]} castShadow receiveShadow material={MAT.wallDark}>
        <boxGeometry args={[1.5, 1.8, D * 0.6]} />
      </mesh>
      <mesh position={[W/2 + 1.2, 1.84, 0.3]} castShadow material={MAT.roof}>
        <boxGeometry args={[1.62, 0.1, D * 0.6 + 0.12]} />
      </mesh>
      <mesh position={[W/2 + 1.2, 0.75, D * 0.3 + 0.04]} material={MAT.door}>
        <boxGeometry args={[1.2, 1.4, 0.06]} />
      </mesh>

      {/* Porch columns */}
      {[-0.55, 0.55].map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.9, D/2 + 0.22]} castShadow material={MAT.step}>
            <cylinderGeometry args={[0.07, 0.09, 1.8, 8]} />
          </mesh>
          <mesh position={[x, 1.82, D/2 + 0.22]} material={MAT.step}>
            <boxGeometry args={[0.18, 0.08, 0.18]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.9, D/2 + 0.22]} material={MAT.step}>
        <boxGeometry args={[1.3, 0.1, 0.18]} />
      </mesh>

      <ScanBox position={[0, H/2, 0]} size={[W, H, D]} delay={0} />
      <ScanBox position={[0, H * 0.65, D/2]} size={[W * 0.8, H * 0.3, 0.2]} delay={1.5} />
      <ScanBox position={[-W/2, H * 0.4, 0]} size={[0.2, H * 0.5, D * 0.6]} delay={2.8} />
      <ScanLine />
    </group>
  );
}

// ─── COMMERCIAL BUILDING ──────────────────────────────────────────────────────
function CommercialBuilding() {
  const W = 5, H = 1.8, D = 2.5;

  return (
    <group>
      <mesh position={[0, -0.08, 0]} receiveShadow material={MAT.ground}>
        <boxGeometry args={[7.5, 0.12, 5.5]} />
      </mesh>
      <gridHelper args={[7.0, 14, '#D8E8F0', '#E8F0F8']} position={[0, -0.01, 0]} />

      {/* Pavement strip */}
      <mesh position={[0, -0.02, D/2 + 1.0]} receiveShadow material={MAT.driveway}>
        <boxGeometry args={[W + 0.8, 0.06, 1.8]} />
      </mesh>

      {/* Main body */}
      <mesh position={[0, H/2, 0]} castShadow receiveShadow material={MAT.wall}>
        <boxGeometry args={[W, H, D]} />
      </mesh>

      {/* Flat roof cap */}
      <mesh position={[0, H + 0.06, 0]} castShadow material={MAT.trim}>
        <boxGeometry args={[W + 0.1, 0.1, D + 0.1]} />
      </mesh>

      {/* Signage board */}
      <mesh position={[0, H + 0.38, D/2 - 0.15]} castShadow material={MAT.signage}>
        <boxGeometry args={[3.2, 0.45, 0.1]} />
      </mesh>
      {[-1.3, 1.3].map((x, i) => (
        <mesh key={i} position={[x, H + 0.22, D/2 - 0.12]} material={MAT.metalDark}>
          <boxGeometry args={[0.05, 0.25, 0.05]} />
        </mesh>
      ))}

      {/* Large display windows */}
      {[-1.6, 1.6].map((x, i) => (
        <Window key={i} position={[x, H * 0.52, D/2 + 0.02]} size={[1.1, H * 0.72, 0.08]} />
      ))}

      {/* Recessed entrance */}
      <mesh position={[0, H * 0.38, D/2 - 0.1]} material={MAT.wallDark}>
        <boxGeometry args={[1.2, H * 0.72, 0.22]} />
      </mesh>
      <mesh position={[0, H * 0.38, D/2 + 0.02]} material={MAT.glassLobby}>
        <boxGeometry args={[1.0, H * 0.68, 0.06]} />
      </mesh>

      {/* Metal canopy */}
      <mesh position={[0, H * 0.72, D/2 + 0.5]} castShadow material={MAT.metalDark}>
        <boxGeometry args={[1.5, 0.06, 1.0]} />
      </mesh>
      {[-0.6, 0.6].map((x, i) => (
        <mesh key={i} position={[x, H * 0.60, D/2 + 0.5]} material={MAT.metalDark}>
          <boxGeometry args={[0.04, H * 0.22, 0.04]} />
        </mesh>
      ))}

      {/* Edge accent strips */}
      <mesh position={[-W/2 + 0.04, H/2, 0]} castShadow material={MAT.wallDark}>
        <boxGeometry args={[0.06, H, D]} />
      </mesh>
      <mesh position={[W/2 - 0.04, H/2, 0]} castShadow material={MAT.wallDark}>
        <boxGeometry args={[0.06, H, D]} />
      </mesh>

      <ScanBox position={[0, H/2, 0]} size={[W, H, D]} delay={0} />
      <ScanBox position={[-1.6, H * 0.52, D/2]} size={[1.1, H * 0.72, 0.2]} delay={1.2} />
      <ScanBox position={[1.6, H * 0.52, D/2]} size={[1.1, H * 0.72, 0.2]} delay={2.4} />
      <ScanLine />
    </group>
  );
}

// ─── INDUSTRIAL BUILDING ──────────────────────────────────────────────────────
function IndustrialBuilding() {
  const W = 6, H = 1.6, D = 4;

  return (
    <group>
      <mesh position={[0, -0.08, 0]} receiveShadow material={MAT.ground}>
        <boxGeometry args={[9.5, 0.12, 7.0]} />
      </mesh>
      <gridHelper args={[9.0, 18, '#D8E8F0', '#E8F0F8']} position={[0, -0.01, 0]} />

      {/* Main industrial body */}
      <mesh position={[0, H/2, 0]} castShadow receiveShadow material={MAT.concrete}>
        <boxGeometry args={[W, H, D]} />
      </mesh>

      {/* Shallow gabled roof — front slope */}
      <mesh position={[0, H + 0.2, D/4]} rotation={[-0.09, 0, 0]} castShadow material={MAT.metalDark}>
        <boxGeometry args={[W + 0.2, 0.07, D/2 + 0.35]} />
      </mesh>
      {/* Back slope */}
      <mesh position={[0, H + 0.2, -D/4]} rotation={[0.09, 0, 0]} castShadow material={MAT.metalDark}>
        <boxGeometry args={[W + 0.2, 0.07, D/2 + 0.35]} />
      </mesh>
      {/* Ridge cap */}
      <mesh position={[0, H + 0.38, 0]} castShadow material={MAT.metalDark}>
        <boxGeometry args={[W + 0.2, 0.1, 0.18]} />
      </mesh>

      {/* Loading bay door */}
      <mesh position={[1.0, 0.72, D/2 + 0.03]} castShadow material={MAT.metalDark}>
        <boxGeometry args={[2.0, 1.42, 0.07]} />
      </mesh>
      <mesh position={[1.0, 0.72, D/2 + 0.05]} material={MAT.roof}>
        <boxGeometry args={[2.14, 1.56, 0.04]} />
      </mesh>

      {/* Office annex on left */}
      <mesh position={[-W/2 - 0.75, 1.1, D * 0.22]} castShadow receiveShadow material={MAT.wall}>
        <boxGeometry args={[1.5, 2.2, D * 0.45]} />
      </mesh>
      <mesh position={[-W/2 - 0.75, 2.26, D * 0.22]} castShadow material={MAT.roof}>
        <boxGeometry args={[1.6, 0.1, D * 0.45 + 0.12]} />
      </mesh>
      <Window position={[-W/2 - 0.77, 1.3, D * 0.22 + D * 0.225 + 0.02]} size={[0.5, 0.6, 0.06]} />
      <mesh position={[-W/2 - 0.75, 0.55, D * 0.22 + D * 0.225 + 0.04]} material={MAT.door}>
        <boxGeometry args={[0.6, 1.1, 0.06]} />
      </mesh>

      {/* High windows on main body */}
      {[-1.8, -0.3, 1.8].map((x, i) => (
        <Window key={i} position={[x, H * 0.72, D/2 + 0.02]} size={[0.65, 0.38, 0.06]} />
      ))}

      <ScanBox position={[0, H/2, 0]} size={[W, H, D]} delay={0} />
      <ScanBox position={[1.0, 0.72, D/2]} size={[2.0, 1.42, 0.2]} delay={1.8} />
      <ScanLine />
    </group>
  );
}

// ─── SMALL HOUSE ─────────────────────────────────────────────────────────────
function SmallHouse({ position, scale = 1 }) { // eslint-disable-line no-unused-vars
  const W = 1.3 * scale, H = 1.1 * scale, D = 1.2 * scale;
  return (
    <group position={position}>
      <mesh position={[0, H/2, 0]} castShadow receiveShadow material={MAT.wall}>
        <boxGeometry args={[W, H, D]} />
      </mesh>
      <mesh position={[0, H + 0.22*scale, 0]} rotation={[0, Math.PI/4, 0]} castShadow material={MAT.roof}>
        <coneGeometry args={[W*0.75, 0.44*scale, 4]} />
      </mesh>
      <mesh position={[0, H*0.30, D/2+0.01]} material={MAT.door}>
        <boxGeometry args={[0.22*scale, 0.50*scale, 0.04]} />
      </mesh>
      <Window position={[W*0.28, H*0.67, D/2+0.01]} size={[0.28*scale, 0.28*scale, 0.04]} />
    </group>
  );
}

// ─── WALKING FIGURE (animated) ────────────────────────────────────────────────
function WalkingFigure({ baseX, baseZ, amplitude = 0.7, speed = 0.32, phase = 0, body = MAT.figBody, head = MAT.step }) {
  const ref  = useRef();
  const legL = useRef();
  const legR = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed + phase;
    ref.current.position.x = baseX + Math.sin(t) * amplitude;
    ref.current.rotation.y = Math.cos(t) >= 0 ? 0 : Math.PI;
    if (legL.current) legL.current.rotation.x =  Math.sin(t * 2) * 0.35;
    if (legR.current) legR.current.rotation.x = -Math.sin(t * 2) * 0.35;
  });
  return (
    <group ref={ref} position={[baseX, 0, baseZ]}>
      <group ref={legL} position={[-0.075, 0.14, 0]}>
        <mesh castShadow material={body}>
          <boxGeometry args={[0.10, 0.28, 0.10]} />
        </mesh>
      </group>
      <group ref={legR} position={[0.075, 0.14, 0]}>
        <mesh castShadow material={body}>
          <boxGeometry args={[0.10, 0.28, 0.10]} />
        </mesh>
      </group>
      <mesh position={[0, 0.44, 0]} castShadow material={body}>
        <boxGeometry args={[0.22, 0.30, 0.13]} />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow material={head}>
        <sphereGeometry args={[0.12, 8, 6]} />
      </mesh>
    </group>
  );
}

// ─── STREET LAMP ─────────────────────────────────────────────────────────────
function StreetLamp({ position }) { // eslint-disable-line no-unused-vars
  return (
    <group position={position}>
      <mesh position={[0, 0.8, 0]} castShadow material={MAT.metalDark}>
        <cylinderGeometry args={[0.04, 0.055, 1.6, 6]} />
      </mesh>
      <mesh position={[0.28, 1.63, 0]} material={MAT.metalDark}>
        <boxGeometry args={[0.56, 0.04, 0.04]} />
      </mesh>
      <mesh position={[0.56, 1.58, 0]} material={MAT.signage}>
        <boxGeometry args={[0.14, 0.09, 0.14]} />
      </mesh>
      <pointLight position={[0.56, 1.52, 0]} intensity={0.5} color="#FFF5D0" distance={3.5} />
    </group>
  );
}

// ─── VILLA HERO SCENE ─────────────────────────────────────────────────────────
function NeighbourhoodScene() {
  const W = 4.2, H = 2.8, D = 3.8;

  return (
    <group scale={[0.60, 0.60, 0.60]}>
      {/* ── GROUND ── */}
      <mesh position={[0, -0.08, 0]} receiveShadow material={MAT.ground}>
        <boxGeometry args={[20, 0.14, 18]} />
      </mesh>
      <gridHelper args={[19, 38, '#D8E8F0', '#E8F0F8']} position={[0, -0.01, 0]} />

      {/* ── FRONT LAWN ── */}
      <mesh position={[0, -0.01, 3.2]} receiveShadow material={MAT.lawn}>
        <boxGeometry args={[7.0, 0.05, 3.0]} />
      </mesh>

      {/* ── GARDEN PATH — straight to front door ── */}
      <mesh position={[0, 0.01, 2.4]} receiveShadow material={MAT.path}>
        <boxGeometry args={[0.9, 0.04, 3.8]} />
      </mesh>

      {/* ── DRIVEWAY right side ── */}
      <mesh position={[3.8, 0.01, 1.8]} receiveShadow material={MAT.path}>
        <boxGeometry args={[2.2, 0.04, 5.0]} />
      </mesh>

      {/* ── BOUNDARY WALL — front of property ── */}
      <mesh position={[0, 0.2, 4.9]} castShadow material={MAT.wallCream}>
        <boxGeometry args={[9.0, 0.38, 0.18]} />
      </mesh>
      {/* Gate posts */}
      <mesh position={[-0.6, 0.5, 4.9]} castShadow material={MAT.wallCream}>
        <boxGeometry args={[0.22, 0.95, 0.22]} />
      </mesh>
      <mesh position={[ 0.6, 0.5, 4.9]} castShadow material={MAT.wallCream}>
        <boxGeometry args={[0.22, 0.95, 0.22]} />
      </mesh>

      {/* ── MAIN VILLA BODY ── */}
      <mesh position={[0, H/2, 0]} castShadow receiveShadow material={MAT.wallCream}>
        <boxGeometry args={[W, H, D]} />
      </mesh>

      {/* ── SIDE WINGS ── */}
      <mesh position={[-W/2 - 0.55, (H-0.6)/2, 0]} castShadow material={MAT.wallSage}>
        <boxGeometry args={[1.1, H - 0.6, D * 0.72]} />
      </mesh>
      <mesh position={[W/2 + 0.55, (H-0.6)/2, 0]} castShadow material={MAT.wallSage}>
        <boxGeometry args={[1.1, H - 0.6, D * 0.72]} />
      </mesh>

      {/* ── CORNICE ── */}
      <mesh position={[0, H + 0.08, 0]} castShadow material={MAT.step}>
        <boxGeometry args={[W + 0.16, 0.12, D + 0.16]} />
      </mesh>

      {/* ── GABLE ROOF — 25° natural pitch ── */}
      {/* Eave soffit plate (flat overhang base) */}
      <mesh position={[0, H + 0.10, 0]} castShadow material={MAT.roofTrim2}>
        <boxGeometry args={[W + 0.6, 0.10, D + 0.6]} />
      </mesh>
      {/* Front slope */}
      <mesh position={[0, H + 0.40, D * 0.26]} rotation={[-Math.PI * 0.135, 0, 0]} castShadow material={MAT.roofTerra}>
        <boxGeometry args={[W + 0.55, 0.18, D * 0.57]} />
      </mesh>
      {/* Back slope */}
      <mesh position={[0, H + 0.40, -D * 0.26]} rotation={[ Math.PI * 0.135, 0, 0]} castShadow material={MAT.roofTerra}>
        <boxGeometry args={[W + 0.55, 0.18, D * 0.57]} />
      </mesh>
      {/* Left gable triangle — solid fill between the two slopes */}
      <mesh position={[-W/2 - 0.01, H + 0.40, 0]} castShadow material={MAT.roofTerra}>
        <boxGeometry args={[0.18, 0.68, D * 0.5]} />
      </mesh>
      <mesh position={[-W/2 - 0.01, H + 0.60, 0]} rotation={[0, 0, 0]} castShadow material={MAT.roofTerra}>
        <boxGeometry args={[0.18, 0.30, D * 0.35]} />
      </mesh>
      {/* Right gable triangle */}
      <mesh position={[ W/2 + 0.01, H + 0.40, 0]} castShadow material={MAT.roofTerra}>
        <boxGeometry args={[0.18, 0.68, D * 0.5]} />
      </mesh>
      <mesh position={[ W/2 + 0.01, H + 0.60, 0]} castShadow material={MAT.roofTerra}>
        <boxGeometry args={[0.18, 0.30, D * 0.35]} />
      </mesh>
      {/* Ridge cap */}
      <mesh position={[0, H + 0.78, 0]} castShadow material={MAT.roofTrim2}>
        <boxGeometry args={[W + 0.55, 0.13, 0.26]} />
      </mesh>

      {/* ── CHIMNEYS ── */}
      <mesh position={[-0.8, H + 0.95, -0.5]} castShadow material={MAT.roofTrim2}>
        <boxGeometry args={[0.30, 0.55, 0.30]} />
      </mesh>
      <mesh position={[-0.8, H + 1.24, -0.5]} material={MAT.step}>
        <boxGeometry args={[0.38, 0.07, 0.38]} />
      </mesh>
      <mesh position={[ 0.8, H + 0.88, -0.35]} castShadow material={MAT.roofTrim2}>
        <boxGeometry args={[0.24, 0.40, 0.24]} />
      </mesh>
      <mesh position={[ 0.8, H + 1.10, -0.35]} material={MAT.step}>
        <boxGeometry args={[0.30, 0.06, 0.30]} />
      </mesh>

      {/* ── FRONT WINDOWS (2 floors) ── */}
      <Window position={[-1.0, H * 0.68, D/2 + 0.02]} />
      <Window position={[ 1.0, H * 0.68, D/2 + 0.02]} />
      <Window position={[-1.0, H * 0.30, D/2 + 0.02]} />
      <Window position={[ 1.0, H * 0.30, D/2 + 0.02]} />
      {/* Side windows */}
      <Window position={[-W/2 - 0.02, H * 0.66, -0.3]} size={[0.48, 0.62, 0.06]} />
      <Window position={[-W/2 - 0.02, H * 0.28, -0.3]} size={[0.48, 0.62, 0.06]} />
      <Window position={[ W/2 + 0.02, H * 0.66, -0.3]} size={[0.48, 0.62, 0.06]} />
      <Window position={[ W/2 + 0.02, H * 0.28, -0.3]} size={[0.48, 0.62, 0.06]} />

      {/* ── FRONT DOOR ── */}
      <mesh position={[0, 0.68, D/2 + 0.04]} castShadow material={MAT.doorTeal}>
        <boxGeometry args={[0.75, 1.36, 0.07]} />
      </mesh>
      <mesh position={[0, 0.68, D/2 + 0.06]} material={MAT.step}>
        <boxGeometry args={[0.88, 1.50, 0.04]} />
      </mesh>

      {/* ── PORCH — 4 columns + lintel ── */}
      {[-0.7, -0.23, 0.23, 0.7].map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.95, D/2 + 0.28]} castShadow material={MAT.step}>
            <cylinderGeometry args={[0.07, 0.09, 1.9, 8]} />
          </mesh>
          <mesh position={[x, 1.95, D/2 + 0.28]} material={MAT.step}>
            <boxGeometry args={[0.20, 0.09, 0.20]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 2.02, D/2 + 0.28]} material={MAT.step}>
        <boxGeometry args={[1.6, 0.10, 0.20]} />
      </mesh>

      {/* ── FRONT STEPS ── */}
      <mesh position={[0, -0.20, D/2 + 0.38]} castShadow material={MAT.step}>
        <boxGeometry args={[1.1, 0.13, 0.42]} />
      </mesh>
      <mesh position={[0, -0.34, D/2 + 0.68]} castShadow material={MAT.step}>
        <boxGeometry args={[1.4, 0.13, 0.42]} />
      </mesh>

      {/* ── GARAGE (right wing) ── */}
      <mesh position={[W/2 + 1.55, 1.0, 0.4]} castShadow receiveShadow material={MAT.wallSage}>
        <boxGeometry args={[1.8, 2.0, D * 0.65]} />
      </mesh>
      <mesh position={[W/2 + 1.55, 2.06, 0.4]} castShadow material={MAT.roofTerra}>
        <boxGeometry args={[1.92, 0.11, D * 0.65 + 0.14]} />
      </mesh>
      <mesh position={[W/2 + 1.55, 0.82, D * 0.325 + 0.05]} material={MAT.doorTeal}>
        <boxGeometry args={[1.4, 1.55, 0.07]} />
      </mesh>

      {/* ── TREES — left side (bright spring green) ── */}
      <group position={[-5.8, 0, 0.5]}>
        <mesh position={[0, 0.85, 0]} castShadow material={MAT.treeTrunk}><cylinderGeometry args={[0.13, 0.18, 1.7, 8]} /></mesh>
        <mesh position={[0, 2.15, 0]} castShadow material={MAT.leafA}><sphereGeometry args={[0.90, 9, 7]} /></mesh>
      </group>
      <group position={[-4.8, 0, -1.8]}>
        <mesh position={[0, 0.75, 0]} castShadow material={MAT.treeTrunk}><cylinderGeometry args={[0.11, 0.15, 1.5, 8]} /></mesh>
        <mesh position={[0, 1.9,  0]} castShadow material={MAT.leafA}><sphereGeometry args={[0.75, 9, 7]} /></mesh>
      </group>
      <group position={[-5.2, 0, 3.5]}>
        <mesh position={[0, 0.7, 0]} castShadow material={MAT.treeTrunk}><cylinderGeometry args={[0.10, 0.14, 1.4, 8]} /></mesh>
        <mesh position={[0, 1.8, 0]} castShadow material={MAT.leafB}><sphereGeometry args={[0.70, 9, 7]} /></mesh>
      </group>

      {/* ── TREES — right side (mid forest green) ── */}
      <group position={[5.8, 0, 0.5]}>
        <mesh position={[0, 0.85, 0]} castShadow material={MAT.treeTrunk}><cylinderGeometry args={[0.13, 0.18, 1.7, 8]} /></mesh>
        <mesh position={[0, 2.15, 0]} castShadow material={MAT.leafB}><sphereGeometry args={[0.90, 9, 7]} /></mesh>
      </group>
      <group position={[4.8, 0, -1.8]}>
        <mesh position={[0, 0.75, 0]} castShadow material={MAT.treeTrunk}><cylinderGeometry args={[0.11, 0.15, 1.5, 8]} /></mesh>
        <mesh position={[0, 1.9,  0]} castShadow material={MAT.leafB}><sphereGeometry args={[0.75, 9, 7]} /></mesh>
      </group>
      <group position={[5.2, 0, 3.5]}>
        <mesh position={[0, 0.7, 0]} castShadow material={MAT.treeTrunk}><cylinderGeometry args={[0.10, 0.14, 1.4, 8]} /></mesh>
        <mesh position={[0, 1.8, 0]} castShadow material={MAT.leafA}><sphereGeometry args={[0.70, 9, 7]} /></mesh>
      </group>

      {/* ── BACKGROUND TREES (deep forest) ── */}
      <group position={[-2.2, 0, -3.8]}>
        <mesh position={[0, 0.65, 0]} castShadow material={MAT.treeTrunk}><cylinderGeometry args={[0.09, 0.13, 1.3, 8]} /></mesh>
        <mesh position={[0, 1.65, 0]} castShadow material={MAT.leafC}><sphereGeometry args={[0.62, 8, 7]} /></mesh>
      </group>
      <group position={[ 2.5, 0, -3.8]}>
        <mesh position={[0, 0.65, 0]} castShadow material={MAT.treeTrunk}><cylinderGeometry args={[0.09, 0.13, 1.3, 8]} /></mesh>
        <mesh position={[0, 1.65, 0]} castShadow material={MAT.leafC}><sphereGeometry args={[0.62, 8, 7]} /></mesh>
      </group>

      {/* ── WALKING PEOPLE — 5 figures with distinct colours ── */}
      <WalkingFigure baseX={0.0}  baseZ={3.8} amplitude={1.4} speed={0.28} phase={0.0} body={MAT.figBlue}   head={MAT.skin} />
      <WalkingFigure baseX={-1.8} baseZ={4.0} amplitude={0.9} speed={0.22} phase={2.1} body={MAT.figRed}    head={MAT.skin} />
      <WalkingFigure baseX={-3.8} baseZ={1.5} amplitude={0.7} speed={0.30} phase={1.3} body={MAT.figGreen}  head={MAT.skin} />
      <WalkingFigure baseX={3.6}  baseZ={2.2} amplitude={0.6} speed={0.26} phase={3.8} body={MAT.figGold}   head={MAT.skin} />
      <WalkingFigure baseX={2.2}  baseZ={4.5} amplitude={1.0} speed={0.24} phase={5.0} body={MAT.figPurple} head={MAT.skin} />

      {/* ── SCAN BOXES — entire villa + facade ── */}
      <ScanBox position={[0, H/2,     0]}      size={[W,     H,     D]}     delay={0}   />
      <ScanBox position={[0, H * 0.7, D/2]}    size={[W * 0.85, H * 0.35, 0.25]} delay={1.4} />
      <ScanBox position={[0, H + 0.45, 0]}     size={[W + 0.55, 0.9,  D + 0.55]} delay={2.6} />
      <ScanLine top={4.8} />
    </group>
  );
}

// ─── CAMERA CONTROLLER ────────────────────────────────────────────────────────
function CameraController({ mouseX, mouseY, neighbourhood = false }) {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.x += (mouseX * 1.5 - camera.position.x) * 0.04;
    const targetY = neighbourhood ? mouseY * 0.4 + 1.8 : mouseY * 0.5 + 4;
    camera.position.y += (targetY - camera.position.y) * 0.04;
    camera.lookAt(0, neighbourhood ? 0.9 : 1.5, 0);
  });
  return null;
}

// ─── NAMED EXPORT for cinematic use in EntryScreen ───────────────────────────
export { NeighbourhoodScene };

// ─── SCENE ROOT ───────────────────────────────────────────────────────────────
export default function BuildingScene({
  mouseX = 0, mouseY = 0,
  propertyType = null, subType = '',
  staticCamera = false,           // lock camera at settled position — no drift, no grow
}) {
  const type = (propertyType || '').toLowerCase();
  const sub  = (subType || '').toLowerCase();

  const isNeighbourhood = !propertyType;

  let Model;
  if (isNeighbourhood) {
    Model = NeighbourhoodScene;
  } else if (type === 'industrial') {
    Model = IndustrialBuilding;
  } else if (type === 'commercial') {
    Model = CommercialBuilding;
  } else if (sub === 'villa' || sub === 'plot') {
    Model = VillaBuilding;
  } else {
    Model = ApartmentBuilding;
  }

  const fov        = isNeighbourhood ? 48 : staticCamera ? 42 : 52;
  // staticCamera: start at the settled position so there is zero drift
  const camPos     = isNeighbourhood
    ? [0, 1.8, 6]
    : staticCamera ? [0, 3.5, 16] : [6, 5, 11];
  const shadowScale = isNeighbourhood ? 22 : 10;

  return (
    <Canvas
      camera={{ position: camPos, fov }}
      shadows
      dpr={staticCamera ? 1 : [1, 1.5]}
      style={{ background: 'transparent' }}
      resize={staticCamera ? { scroll: false, debounce: { scroll: 0, resize: 0 } } : undefined}
      onCreated={({ gl, camera }) => {
        gl.setPixelRatio(staticCamera ? 1 : Math.min(window.devicePixelRatio, 2));
        if (staticCamera) camera.lookAt(0, 2, 0);
      }}
    >
      <ambientLight intensity={isNeighbourhood ? 1.4 : 0.9} color={isNeighbourhood ? '#FFF5E8' : '#FFFFFF'} />
      <directionalLight
        position={[8, 14, 8]}
        intensity={isNeighbourhood ? 2.8 : 1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={40}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        color={isNeighbourhood ? '#FFE0A0' : '#FFFFF8'}
      />
      <directionalLight position={[-4, 4, -4]} intensity={isNeighbourhood ? 0.6 : 0.4} color={isNeighbourhood ? '#C8D8FF' : '#E8F0FF'} />
      <pointLight position={[0, 6, 4]} intensity={isNeighbourhood ? 0.5 : 0.3} color={isNeighbourhood ? '#FFD580' : '#FAFAF0'} />

      {/* Camera animation only when interactive — never in processing screen */}
      {!staticCamera && (
        <CameraController mouseX={mouseX} mouseY={mouseY} neighbourhood={isNeighbourhood} />
      )}

      {/* Float adds bobbing animation — completely disabled for processing screen */}
      {staticCamera ? (
        <group><Model /></group>
      ) : (
        <Float
          speed={isNeighbourhood ? 0.8 : 1.4}
          rotationIntensity={isNeighbourhood ? 0.008 : 0.04}
          floatIntensity={isNeighbourhood ? 0.06 : 0.3}
        >
          <Model />
        </Float>
      )}

      <ContactShadows
        position={[0, -0.02, 0]}
        opacity={isNeighbourhood ? 0.18 : 0.22}
        scale={shadowScale}
        blur={isNeighbourhood ? 3.5 : 2.5}
        far={isNeighbourhood ? 8 : 4}
        color="#2D6B8C"
      />
    </Canvas>
  );
}
