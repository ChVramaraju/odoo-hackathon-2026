/**
 * HexCanvas — Brightloop Architectural 3D Hexagonal Terrain
 *
 * Faithfully reproduces the Bipsync reference design:
 *  - Interconnected, tightly packed hexagonal slabs with visible depth & vertical column sides.
 *  - Triple concentric stepped bevels (outer chamfer lip, middle ridge, sunken inner plate).
 *  - Physically based satin forest and metallic emerald surfaces with soft specular sheen.
 *  - Balanced diffuse luminance & specular highlights matching the Bipsync tactile metallic plates.
 *  - Glowing emerald & mint chamfer wireframe contours.
 *  - Eye-level architectural perspective with rolling terraces, mouse parallax, and WebGL fallback.
 */

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface TileData {
  container: THREE.Group;
  baseY: number;
  phase: number;
  speed: number;
}

interface TerrainSceneProps {
  reducedMotion: boolean;
}

const TerrainScene: React.FC<TerrainSceneProps> = ({ reducedMotion }) => {
  const { camera } = useThree();
  const hexGroupRef = useRef<THREE.Group>(null);
  const emeraldLightRef = useRef<THREE.PointLight>(null);
  const mintLightRef = useRef<THREE.PointLight>(null);
  const underGlowRef = useRef<THREE.PointLight>(null);

  const mouseRef = useRef({ x: 0, y: 0 });
  const targetRotRef = useRef({ x: 0.22, y: -0.14 });

  // Camera orientation gazing across the terrain
  useEffect(() => {
    camera.lookAt(-0.5, 0.8, 0);
  }, [camera]);

  // Track mouse parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Construct the architectural hexagonal landscape
  const { hexGroup, tiles } = useMemo(() => {
    const group = new THREE.Group();
    const tileList: TileData[] = [];

    const hexRadius = 1.85;
    const baseHeight = 1.8;
    const rows = 14;
    const cols = 20;

    const xSpacing = hexRadius * Math.sqrt(3);
    const zSpacing = hexRadius * 1.5;

    // Shared geometries with multi-layer concentric stepped beveling
    const outerCylinderGeom = new THREE.CylinderGeometry(hexRadius * 0.96, hexRadius, baseHeight, 6);
    const midStepGeom = new THREE.CylinderGeometry(hexRadius * 0.88, hexRadius * 0.88, baseHeight * 1.02, 6);
    const innerRecessGeom = new THREE.CylinderGeometry(hexRadius * 0.78, hexRadius * 0.78, baseHeight * 1.04, 6);

    const outerEdgesGeom = new THREE.EdgesGeometry(outerCylinderGeom, 15);
    const midEdgesGeom = new THREE.EdgesGeometry(midStepGeom, 15);
    const innerEdgesGeom = new THREE.EdgesGeometry(innerRecessGeom, 15);

    // Physically based materials: Color-tuned to match Bipsync reference's tactile satin metallic plates
    const matSatinForest = new THREE.MeshStandardMaterial({
      color: 0x1a4633,
      roughness: 0.30,
      metalness: 0.45,
      emissive: new THREE.Color(0x041f15),
      emissiveIntensity: 0.30,
      flatShading: true,
    });

    const matSlateEmerald = new THREE.MeshStandardMaterial({
      color: 0x225840,
      roughness: 0.25,
      metalness: 0.50,
      emissive: new THREE.Color(0x072d1e),
      emissiveIntensity: 0.40,
      flatShading: true,
    });

    const matDeepObsidian = new THREE.MeshStandardMaterial({
      color: 0x0c2419,
      roughness: 0.40,
      metalness: 0.40,
      emissive: new THREE.Color(0x02110a),
      emissiveIntensity: 0.20,
      flatShading: true,
    });

    const matMintCrest = new THREE.MeshStandardMaterial({
      color: 0x2e6f52,
      roughness: 0.20,
      metalness: 0.55,
      emissive: new THREE.Color(0x0c3d28),
      emissiveIntensity: 0.50,
      flatShading: true,
    });

    const matInnerPlate = new THREE.MeshStandardMaterial({
      color: 0x1e4f3a,
      roughness: 0.28,
      metalness: 0.48,
      emissive: new THREE.Color(0x06281b),
      emissiveIntensity: 0.35,
      flatShading: true,
    });

    // Glowing edge bevel lines in vivid emerald & mint
    const edgeDark = new THREE.LineBasicMaterial({
      color: 0x236846,
      transparent: true,
      opacity: 0.65,
    });

    const edgeEmerald = new THREE.LineBasicMaterial({
      color: 0x00c982,
      transparent: true,
      opacity: 0.90,
    });

    const edgeMint = new THREE.LineBasicMaterial({
      color: 0x8cf5c2,
      transparent: true,
      opacity: 0.95,
    });

    for (let r = -Math.floor(rows / 2); r <= Math.floor(rows / 2); r++) {
      for (let c = -Math.floor(cols / 2); c <= Math.floor(cols / 2); c++) {
        const xOffset = Math.abs(r) % 2 === 1 ? xSpacing * 0.5 : 0;
        const xPos = c * xSpacing + xOffset;
        const zPos = r * zSpacing;

        // Smooth coordinated undulating terrain (flowing terraces)
        const dist = Math.sqrt(xPos * xPos * 0.65 + zPos * zPos);
        const wave = Math.sin(xPos * 0.18 + zPos * 0.14) * 1.5 + Math.cos(dist * 0.20) * 1.0;
        const steppedLevel = Math.round(wave * 1.8) * 0.45;
        const heightScale = Math.max(0.55, 1.0 + steppedLevel * 0.50);

        // Architectural material assignment
        const score = Math.sin(c * 0.70 + 1.1) * Math.cos(r * 0.74);
        let chosenMat = matSatinForest;
        let chosenOuterEdge = edgeEmerald;
        let chosenInnerEdge = edgeDark;

        if (steppedLevel > 0.50 && score > 0.22) {
          chosenMat = matMintCrest;
          chosenOuterEdge = edgeMint;
          chosenInnerEdge = edgeEmerald;
        } else if (steppedLevel > 0.08 || score > 0.12) {
          chosenMat = matSlateEmerald;
          chosenOuterEdge = edgeEmerald;
          chosenInnerEdge = edgeEmerald;
        } else if (steppedLevel < -0.35) {
          chosenMat = matDeepObsidian;
          chosenOuterEdge = edgeDark;
          chosenInnerEdge = edgeDark;
        }

        const tileContainer = new THREE.Group();

        // 1. Outer main hexagonal pillar
        const outerMesh = new THREE.Mesh(outerCylinderGeom, chosenMat);
        outerMesh.castShadow = true;
        outerMesh.receiveShadow = true;
        outerMesh.scale.set(1, heightScale, 1);
        tileContainer.add(outerMesh);

        // 2. Outer beveled perimeter wireframe
        const outerWire = new THREE.LineSegments(outerEdgesGeom, chosenOuterEdge);
        outerWire.scale.set(1, heightScale, 1);
        tileContainer.add(outerWire);

        // 3. Middle raised concentric bevel ridge & wire
        const midWire = new THREE.LineSegments(midEdgesGeom, chosenInnerEdge);
        midWire.scale.set(1, heightScale * 1.015, 1);
        tileContainer.add(midWire);

        // 4. Inner sunken metallic plate + inner wireframe
        const innerMesh = new THREE.Mesh(innerRecessGeom, matInnerPlate);
        innerMesh.scale.set(1, heightScale * 1.025, 1);
        tileContainer.add(innerMesh);

        const innerWire = new THREE.LineSegments(innerEdgesGeom, chosenOuterEdge);
        innerWire.scale.set(1, heightScale * 1.04, 1);
        tileContainer.add(innerWire);

        // Position tile
        const baseY = steppedLevel - heightScale * 0.5;
        tileContainer.position.set(xPos, baseY, zPos);
        tileContainer.rotation.y = Math.PI / 6;

        tileList.push({
          container: tileContainer,
          baseY,
          phase: dist * 0.22 + (xPos + zPos) * 0.08,
          speed: 0.50 + Math.abs(Math.sin(c * 1.3 + r * 0.7)) * 0.24,
        });

        group.add(tileContainer);
      }
    }

    // Architectural vantage point: sweeps across the hero banner with prominent foreground tiles
    group.position.set(2.8, -1.8, 0.5);
    group.rotation.x = 0.22;
    group.rotation.y = -0.14;
    group.rotation.z = -0.04;

    return { hexGroup: group, tiles: tileList };
  }, []);

  // Continuous subtle cinematic animation & mouse parallax
  useFrame(({ clock }) => {
    if (!hexGroupRef.current) return;
    const time = clock.getElapsedTime();

    if (!reducedMotion) {
      // Smooth mouse parallax damping
      targetRotRef.current.y +=
        (-0.14 + mouseRef.current.x * 1.5 * 0.04 - targetRotRef.current.y) * 0.04;
      targetRotRef.current.x +=
        (0.22 - mouseRef.current.y * 0.9 * 0.03 - targetRotRef.current.x) * 0.04;

      hexGroupRef.current.rotation.y =
        targetRotRef.current.y + Math.sin(time * 0.12) * 0.012;
      hexGroupRef.current.rotation.x =
        targetRotRef.current.x + Math.cos(time * 0.10) * 0.008;

      // Slow, fluid undulating pulse across tiles
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const offset = Math.sin(time * t.speed + t.phase) * 0.14;
        t.container.position.y = t.baseY + offset;
      }

      // Soft orbiting emerald and mint illumination
      if (emeraldLightRef.current) {
        emeraldLightRef.current.position.x = Math.sin(time * 0.24) * 12;
        emeraldLightRef.current.position.z = Math.cos(time * 0.24) * 8 + 2;
      }
      if (mintLightRef.current) {
        mintLightRef.current.position.x = Math.cos(time * 0.18) * 10 + 4;
        mintLightRef.current.position.y = 8 + Math.sin(time * 0.26) * 2.0;
      }
      if (underGlowRef.current) {
        underGlowRef.current.position.x = 2 + Math.sin(time * 0.16) * 4;
        underGlowRef.current.position.z = 2 + Math.cos(time * 0.16) * 3;
      }
    }
  });

  return (
    <>
      {/* Ambient forest atmosphere */}
      <ambientLight intensity={2.6} color="#081a11" />

      {/* Hemisphere light: emerald sky illumination + deep shadow ground */}
      <hemisphereLight args={['#00c982', '#020f08', 2.0]} />

      {/* Crisp directional key light directly illuminating the top faces towards camera */}
      <directionalLight
        position={[4, 18, 14]}
        intensity={3.8}
        color="#f4fef8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
      />

      {/* Secondary side directional light for rich emerald rim reflections */}
      <directionalLight position={[-10, 12, 8]} intensity={2.0} color="#00c982" />

      {/* Primary emerald point light sweeping across terrace contours */}
      <pointLight
        ref={emeraldLightRef}
        position={[-1, 6, 5]}
        intensity={8.5}
        color="#00c982"
        distance={40}
      />

      {/* Mint rim light accentuating edge bevels */}
      <pointLight
        ref={mintLightRef}
        position={[9, 9, 0]}
        intensity={5.8}
        color="#8cf5c2"
        distance={35}
      />

      {/* Sub-crevice emerald glow emanating from between and beneath tiles */}
      <pointLight
        ref={underGlowRef}
        position={[2, -1, 3]}
        intensity={6.5}
        color="#059669"
        distance={25}
      />

      {/* Soft back fill light */}
      <directionalLight position={[-12, -6, -8]} intensity={1.5} color="#04160d" />

      {/* The full architectural terrain */}
      <primitive ref={hexGroupRef} object={hexGroup} />
    </>
  );
};

export const HexCanvas: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    // Check reduced motion preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);

    // Verify WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }

    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!hasWebGL) {
    // Rich CSS Hexagonal Gradient Fallback
    return (
      <div
        className={`w-full h-full relative overflow-hidden ${className}`}
        role="presentation"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-forest-950 via-forest-900 to-forest-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(0,201,130,0.22),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(140,245,194,0.12),transparent_50%)]" />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full ${className}`}
      role="presentation"
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [3.0, 7.5, 12.5], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.30,
        }}
        shadows
      >
        <TerrainScene reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
};
