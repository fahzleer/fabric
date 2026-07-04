"use client";

import { Float } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type * as THREE from "three";

/**
 * Reads a `--token: H S% L%` custom property and returns a THREE.Color-parsable
 * hsl() string. THREE.Color.setStyle only recognizes the legacy comma-separated
 * `hsl(h, s%, l%)` syntax — the modern space-separated CSS Color 4 form (which
 * is what these tokens are stored as) parses as white/unset, silently.
 */
function readCssHsl(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const parts = raw.split(/\s+/);
  if (parts.length !== 3) return fallback;
  const [h, s, l] = parts;
  return `hsl(${h}, ${s}, ${l})`;
}

type ShapeKind = "icosahedron" | "torus" | "box" | "octahedron";

type ShapeSpec = {
  kind: ShapeKind;
  position: [number, number, number];
  scale: number;
  color: string;
  wireframe: boolean;
  spinSpeed: number;
};

function Shape({ spec }: { spec: ShapeSpec }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * spec.spinSpeed;
    ref.current.rotation.y += delta * spec.spinSpeed * 0.7;
  });

  const geometry = useMemo(() => {
    switch (spec.kind) {
      case "icosahedron":
        return <icosahedronGeometry args={[1, 0]} />;
      case "torus":
        return <torusGeometry args={[0.7, 0.28, 12, 32]} />;
      case "box":
        return <boxGeometry args={[1.2, 1.2, 1.2]} />;
      case "octahedron":
        return <octahedronGeometry args={[1, 0]} />;
    }
  }, [spec.kind]);

  return (
    <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.6}>
      <mesh ref={ref} position={spec.position} scale={spec.scale}>
        {geometry}
        <meshStandardMaterial
          color={spec.color}
          wireframe={spec.wireframe}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
    </Float>
  );
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 5]} intensity={1.1} />
      <pointLight position={[-4, -2, -3]} intensity={0.4} />
    </>
  );
}

export type PrimitiveSceneVariant = "hero" | "accent" | "band";

const VARIANT_CAMERA: Record<PrimitiveSceneVariant, [number, number, number]> = {
  hero: [0, 0, 6],
  accent: [0, 0, 4],
  band: [0, 0, 8],
};

function buildShapes(variant: PrimitiveSceneVariant): ShapeSpec[] {
  const brand = readCssHsl("--brand", "hsl(355, 78%, 48%)");
  const bone = readCssHsl("--foreground", "hsl(40, 15%, 94%)");
  const ink = readCssHsl("--background", "hsl(0, 0%, 3%)");

  if (variant === "accent") {
    return [
      {
        kind: "icosahedron",
        position: [0, 0, 0],
        scale: 1.1,
        color: brand,
        wireframe: false,
        spinSpeed: 0.25,
      },
    ];
  }

  if (variant === "band") {
    const kinds: ShapeKind[] = ["torus", "octahedron", "box", "icosahedron", "torus"];
    return kinds.map((kind, i) => ({
      kind,
      position: [(i - 2) * 3.2, i % 2 === 0 ? 0.6 : -0.6, -(i % 3)],
      scale: 0.6 + (i % 3) * 0.15,
      color: i % 2 === 0 ? brand : bone,
      wireframe: i % 2 === 1,
      spinSpeed: 0.15 + i * 0.05,
    }));
  }

  // hero
  return [
    {
      kind: "icosahedron",
      position: [-1.6, 0.4, 0],
      scale: 1.3,
      color: brand,
      wireframe: false,
      spinSpeed: 0.2,
    },
    {
      kind: "torus",
      position: [1.7, -0.6, -1],
      scale: 1,
      color: bone,
      wireframe: true,
      spinSpeed: 0.35,
    },
    {
      kind: "octahedron",
      position: [0.2, 1.4, -2],
      scale: 0.8,
      color: ink,
      wireframe: true,
      spinSpeed: 0.3,
    },
    {
      kind: "box",
      position: [-0.6, -1.3, -1.5],
      scale: 0.7,
      color: brand,
      wireframe: true,
      spinSpeed: 0.4,
    },
  ];
}

/**
 * The actual R3F/three.js scene. Never import this file directly from a
 * page — always go through `<SceneCanvas>`, which lazy-loads it (`ssr:
 * false`) and gates it behind the reduced-motion/device-capability check.
 * Geometry is procedural (drei primitives), matching the explicit decision
 * to skip a Blender/asset pipeline for this redesign.
 */
export function PrimitiveScene({ variant }: { variant: PrimitiveSceneVariant }) {
  const shapes = useMemo(() => buildShapes(variant), [variant]);

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: VARIANT_CAMERA[variant], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <SceneLights />
      {shapes.map((spec, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static, never reordered
        <Shape key={i} spec={spec} />
      ))}
    </Canvas>
  );
}
