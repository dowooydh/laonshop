"use client";

// 홈 히어로의 "진짜 WebGL 순간" (핸드오버 §2·§3) — 부유하는 발광 크리스탈.
// 클라이언트 전용(dynamic ssr:false로 로드). 저사양 GPU에선 PerformanceMonitor로 DPR 자동 하향(§7).
import { Canvas } from "@react-three/fiber";
import { Float, Icosahedron, MeshDistortMaterial, PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useState } from "react";

export default function HeroCanvas() {
  const [dpr, setDpr] = useState<number>(1.5);

  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 42 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 3, 4]} intensity={2.2} color="#4FD1FF" />
      <directionalLight position={[-4, -2, -2]} intensity={1.6} color="#8B5CFF" />
      <pointLight position={[0, 0, 3]} intensity={2} color="#C6FF4F" distance={8} />

      <Float speed={1.3} rotationIntensity={1.1} floatIntensity={1.8}>
        <Icosahedron args={[1.35, 12]}>
          <MeshDistortMaterial
            color="#12151f"
            emissive="#1b3a55"
            emissiveIntensity={0.35}
            roughness={0.25}
            metalness={0.55}
            distort={0.42}
            speed={1.6}
          />
        </Icosahedron>
      </Float>

      <EffectComposer>
        <Bloom intensity={1.1} luminanceThreshold={0.15} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
