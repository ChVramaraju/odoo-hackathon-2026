/**
 * HexCanvas — Brightloop Cinematic Architectural 3D Hexagonal Terrain
 *
 * Final Lighting & Material Refinement:
 *  - Preserves the approved large hexagonal geometry (radius 4.6, height 3.2, 7x9 slabs)
 *    and exact low-angle cinematic camera perspective.
 *  - Enriched tile face illumination: lower-center and lower-right tile faces are visibly
 *    illuminated with broad, soft teal and emerald satin sheen.
 *  - Gradual cinematic transition: dark forest green in the distant background (upper z < -3)
 *    to rich, lustrous teal and emerald in the foreground (lower z > 0).
 *  - Subtle light pools focused on center and right slabs; deep natural cast shadows between slabs.
 *  - Softer optical edge bevels (opacity 0.24–0.42) eliminating wireframe appearance.
 *  - Preserves mouse parallax, slow undulation, reduced-motion, and WebGL fallback.
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
  const tealLightRef = useRef<THREE.PointLight>(null);
  const underGlowRef = useRef<THREE.PointLight>(null);

  const mouseRef = useRef({ x: 0, y: 0 });
  const targetRotRef = useRef({ x: 0.26, y: -0.08 });

  // Low, cinematic camera looking across the surface
  useEffect(() => {
    camera.lookAt(0.0, 1.0, -3.0);
  }, [camera]);

  // Subtle mouse-responsive parallax
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

    // Approved large architectural slab dimensions
    const hexRadius = 4.6;
    const baseHeight = 3.2;
    const rows = 7;
    const cols = 9;

    const xSpacing = hexRadius * Math.sqrt(3) * 1.012;
    const zSpacing = hexRadius * 1.5 * 1.012;

    // Slabs with multi-layer concentric stepped beveling & rounded chamfers
    const outerCylinderGeom = new THREE.CylinderGeometry(
      hexRadius * 0.965,
      hexRadius,
      baseHeight,
      6
    );
    const midStepGeom = new THREE.CylinderGeometry(
      hexRadius * 0.86,
      hexRadius * 0.86,
      baseHeight * 1.025,
      6
    );
    const innerRecessGeom = new THREE.CylinderGeometry(
      hexRadius * 0.76,
      hexRadius * 0.76,
      baseHeight * 1.05,
      6
    );

    // Clean edge bevel outlines (threshold 20° extracts clean perimeter contours)
    const outerEdgesGeom = new THREE.EdgesGeometry(outerCylinderGeom, 20);
    const midEdgesGeom = new THREE.EdgesGeometry(midStepGeom, 20);
    const innerEdgesGeom = new THREE.EdgesGeometry(innerRecessGeom, 20);

    // Physically based satin metallic materials with depth graduation
    // 1. Distant background tiles (deep forest & obsidian shadow)
    const matDistantForest = new THREE.MeshPhysicalMaterial({
      color: 0x0a2217,
      roughness: 0.38,
      metalness: 0.44,
      clearcoat: 0.50,
      clearcoatRoughness: 0.25,
      emissive: new THREE.Color(0x02110a),
      emissiveIntensity: 0.20,
      flatShading: true,
    });

    // 2. Midground tiles (slate forest)
    const matMidgroundForest = new THREE.MeshPhysicalMaterial({
      color: 0x164633,
      roughness: 0.26,
      metalness: 0.52,
      clearcoat: 0.80,
      clearcoatRoughness: 0.18,
      emissive: new THREE.Color(0x052417),
      emissiveIntensity: 0.30,
      flatShading: true,
    });

    // 3. Foreground tiles (vibrant satin teal-emerald with broad surface sheen)
    const matForegroundSatin = new THREE.MeshPhysicalMaterial({
      color: 0x22644d,
      roughness: 0.20,
      metalness: 0.58,
      clearcoat: 0.95,
      clearcoatRoughness: 0.12,
      emissive: new THREE.Color(0x093a2a),
      emissiveIntensity: 0.38,
      flatShading: true,
    });

    // 4. Lower-right & elevated crest tiles (lustrous teal-mint metallic)
    const matForegroundTealCrest = new THREE.MeshPhysicalMaterial({
      color: 0x2a795e,
      roughness: 0.16,
      metalness: 0.64,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      emissive: new THREE.Color(0x0e4a36),
      emissiveIntensity: 0.46,
      flatShading: true,
    });

    // 5. Sunken inner plate (satin metallic pool)
    const matInnerPlate = new THREE.MeshPhysicalMaterial({
      color: 0x1b4f3a,
      roughness: 0.22,
      metalness: 0.58,
      clearcoat: 0.88,
      clearcoatRoughness: 0.14,
      emissive: new THREE.Color(0x062a1d),
      emissiveIntensity: 0.32,
      flatShading: true,
    });

    // Soft, non-wireframe edge chamfers
    const edgeDark = new THREE.LineBasicMaterial({
      color: 0x1c563b,
      transparent: true,
      opacity: 0.24,
    });

    const edgeEmerald = new THREE.LineBasicMaterial({
      color: 0x00c982,
      transparent: true,
      opacity: 0.36,
    });

    const edgeTealMint = new THREE.LineBasicMaterial({
      color: 0x5eead4,
      transparent: true,
      opacity: 0.42,
    });

    for (let r = -Math.floor(rows / 2); r <= Math.floor(rows / 2); r++) {
      for (let c = -Math.floor(cols / 2); c <= Math.floor(cols / 2); c++) {
        const xOffset = Math.abs(r) % 2 === 1 ? xSpacing * 0.5 : 0;
        const xPos = c * xSpacing + xOffset;
        const zPos = r * zSpacing;

        // Smooth rolling terrain with stepped terrace elevations
        const dist = Math.sqrt(xPos * xPos * 0.65 + zPos * zPos);
        const wave = Math.sin(xPos * 0.14 + zPos * 0.10) * 1.6 + Math.cos(dist * 0.14) * 1.1;
        const steppedLevel = Math.round(wave * 1.6) * 0.65;
        const heightScale = Math.max(0.60, 1.0 + steppedLevel * 0.40);

        // Depth-based gradual transition from background shadow to foreground teal/emerald
        // Positive zPos is foreground; negative zPos is distant background
        const isForeground = zPos > -1.0;
        const isCenterRight = xPos > -1.0;
        const score = Math.sin(c * 0.65 + 1.1) * Math.cos(r * 0.70);

        let chosenMat = matMidgroundForest;
        let chosenOuterEdge = edgeEmerald;
        let chosenInnerEdge = edgeDark;

        if (zPos < -4.0) {
          // Distant upper background
          chosenMat = matDistantForest;
          chosenOuterEdge = edgeDark;
          chosenInnerEdge = edgeDark;
        } else if (isForeground && isCenterRight) {
          // Lower-center and lower-right: enriched teal and emerald satin sheen
          if (steppedLevel > 0.40 || score > 0.15) {
            chosenMat = matForegroundTealCrest;
            chosenOuterEdge = edgeTealMint;
            chosenInnerEdge = edgeEmerald;
          } else {
            chosenMat = matForegroundSatin;
            chosenOuterEdge = edgeEmerald;
            chosenInnerEdge = edgeDark;
          }
        } else if (isForeground) {
          // Lower-left (beneath dark vignette)
          chosenMat = matForegroundSatin;
          chosenOuterEdge = edgeEmerald;
          chosenInnerEdge = edgeDark;
        } else if (steppedLevel > 0.40) {
          chosenMat = matMidgroundForest;
          chosenOuterEdge = edgeEmerald;
          chosenInnerEdge = edgeDark;
        } else {
          chosenMat = matDistantForest;
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
          phase: dist * 0.18 + (xPos + zPos) * 0.06,
          speed: 0.45 + Math.abs(Math.sin(c * 1.2 + r * 0.6)) * 0.20,
        });

        group.add(tileContainer);
      }
    }

    // Approved group position and orientation
    group.position.set(0.8, -4.0, -2.0);
    group.rotation.x = 0.26;
    group.rotation.y = -0.08;
    group.rotation.z = -0.02;

    return { hexGroup: group, tiles: tileList };
  }, []);

  // Continuous subtle cinematic animation & mouse parallax
  useFrame(({ clock }) => {
    if (!hexGroupRef.current) return;
    const time = clock.getElapsedTime();

    if (!reducedMotion) {
      // Smooth mouse parallax damping
      targetRotRef.current.y +=
        (-0.08 + mouseRef.current.x * 1.5 * 0.03 - targetRotRef.current.y) * 0.04;
      targetRotRef.current.x +=
        (0.26 - mouseRef.current.y * 0.9 * 0.02 - targetRotRef.current.x) * 0.04;

      hexGroupRef.current.rotation.y =
        targetRotRef.current.y + Math.sin(time * 0.10) * 0.010;
      hexGroupRef.current.rotation.x =
        targetRotRef.current.x + Math.cos(time * 0.08) * 0.006;

      // Slow, fluid undulating pulse across tiles
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        const offset = Math.sin(time * t.speed + t.phase) * 0.16;
        t.container.position.y = t.baseY + offset;
      }

      // Slowly moving light reflections across foreground
      if (emeraldLightRef.current) {
        emeraldLightRef.current.position.x = 2.5 + Math.sin(time * 0.20) * 6;
        emeraldLightRef.current.position.z = 6.5 + Math.cos(time * 0.20) * 4;
      }
      if (tealLightRef.current) {
        tealLightRef.current.position.x = 8.5 + Math.cos(time * 0.16) * 5;
        tealLightRef.current.position.y = 6.5 + Math.sin(time * 0.22) * 1.5;
      }
      if (underGlowRef.current) {
        underGlowRef.current.position.x = 2.0 + Math.sin(time * 0.14) * 3;
        underGlowRef.current.position.z = 4.5 + Math.cos(time * 0.14) * 2;
      }
    }
  });

  return (
    <>
      {/* Ambient forest atmosphere — deep base */}
      <ambientLight intensity={2.0} color="#071911" />

      {/* Hemisphere light: vibrant emerald sky radiance + deep shadow ground */}
      <hemisphereLight args={['#00c982', '#020d07', 2.4]} />

      {/* Directional key light illuminating top faces with broad satin highlights */}
      <directionalLight
        position={[4, 18, 14]}
        intensity={5.2}
        color="#f0fcf7"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
      />

      {/* Broad foreground emerald light pool focused on lower-center slabs */}
      <pointLight
        ref={emeraldLightRef}
        position={[2.5, 5.5, 7.0]}
        intensity={12.5}
        color="#00c982"
        distance={38}
      />

      {/* Soft teal light pool focused on lower-right slabs */}
      <pointLight
        ref={tealLightRef}
        position={[8.5, 6.5, 4.5]}
        intensity={8.5}
        color="#2dd4bf"
        distance={32}
      />

      {/* Sub-crevice emerald glow emanating between thick slabs */}
      <pointLight
        ref={underGlowRef}
        position={[2.0, -1.2, 4.5]}
        intensity={7.0}
        color="#059669"
        distance={24}
      />

      {/* Soft emerald side fill across the right flank */}
      <directionalLight position={[12, 8, 2]} intensity={2.2} color="#10b981" />

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
        camera={{ position: [0.0, 8.5, 14.5], fov: 46 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.35,
        }}
        shadows
      >
        <TerrainScene reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
};
