import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { TShirtModel } from '../canvas/TShirtModel'
import type {
  DesignElement,
  TShirtSide,
  TShirtSize,
} from '../../types/configurator'

type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>

interface Card3DCanvasProps {
  color: string
  size: TShirtSize
  activeSide: TShirtSide
  isVisible: boolean
  elements: Array<DesignElement>
}

function CardCameraRig({
  activeSide,
  controlsRef,
}: {
  activeSide: TShirtSide
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()
  const isTransitioning = useRef(false)
  const targetAzimuth = useRef(0)
  const targetDistance = 1.72

  useEffect(() => {
    targetAzimuth.current = activeSide === 'front' ? 0 : Math.PI
    isTransitioning.current = true
  }, [activeSide])

  useFrame((_, delta) => {
    if (!isTransitioning.current || !controlsRef.current) return

    const dt = Math.min(delta, 0.05)
    const controls = controlsRef.current
    const offset = camera.position.clone().sub(controls.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)

    let angleDiff = targetAzimuth.current - spherical.theta
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

    const distDiff = targetDistance - spherical.radius
    const polarDiff = Math.PI / 2 - 0.03 - spherical.phi

    const springStep = 1 - Math.exp(-8.5 * dt)
    spherical.theta += angleDiff * springStep
    spherical.radius += distDiff * springStep
    spherical.phi += polarDiff * springStep

    offset.setFromSpherical(spherical)
    camera.position.copy(controls.target).add(offset)
    controls.update()

    if (
      Math.abs(angleDiff) < 0.01 &&
      Math.abs(distDiff) < 0.01 &&
      Math.abs(polarDiff) < 0.01
    ) {
      isTransitioning.current = false
    }
  })

  return null
}

/**
 * Canvas 3D ultra-léger dédié aux cartes du catalogue :
 * - Reste monté en permanence (zéro latence de création WebGL au scroll, aucun flash d'ancien SVG)
 * - frameloop="demand" hors écran pour 0% de charge GPU au scroll
 * - Utilise le vrai TShirtModel (.glb avec plis et decals) sans le coût multi-passes de ContactShadows
 */
export const Card3DCanvas: React.FC<Card3DCanvasProps> = React.memo(
  function Card3DCanvas({ color, size, activeSide, isVisible, elements }) {
    const controlsRef = useRef<OrbitControlsImpl | null>(null)

    return (
      <div className="relative w-full h-full bg-[#E5E5E5] overflow-hidden rounded-none">
        <Canvas
          frameloop={isVisible ? 'always' : 'demand'}
          dpr={1}
          camera={{ position: [0, 0, 1.72], fov: 25, near: 0.1, far: 15 }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
        >
          {/* Éclairage Studio direct (sans requête réseau HDRI ni shadow map lourde par carte) */}
          <ambientLight intensity={0.95} />
          <hemisphereLight
            color="#ffffff"
            groundColor="#d4d4d4"
            intensity={0.75}
          />
          <directionalLight
            position={[2.0, 2.6, 2.6]}
            intensity={1.35}
            color="#ffffff"
          />
          <directionalLight
            position={[-2.0, 2.6, -2.6]}
            intensity={1.35}
            color="#ffffff"
          />
          <directionalLight
            position={[-2.4, 1.0, 1.8]}
            intensity={0.5}
            color="#f5f5f5"
          />

          <TShirtModel
            color={color}
            size={size}
            activeSide={activeSide}
            isFrozen={true}
            elements={elements}
            selectedElementId={null}
            isCapturingPreview={false}
            onSelectElement={() => {}}
            onUpdateElement={() => {}}
            onCommitHistory={() => {}}
            onDeleteElement={() => {}}
          />

          {/* Ombre au sol légère par simple disque (0ms GPU contre 8ms pour ContactShadows) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.34, 0]}
            scale={[0.46, 0.24, 1]}
          >
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial
              color="#000000"
              transparent
              opacity={0.14}
              depthWrite={false}
            />
          </mesh>

          <OrbitControls
            ref={controlsRef}
            enableRotate
            enableZoom={false}
            enablePan={false}
            enableDamping
            dampingFactor={0.07}
            rotateSpeed={0.75}
            minPolarAngle={Math.PI / 2.6}
            maxPolarAngle={Math.PI - Math.PI / 2.6}
            target={[0, 0, 0]}
          />

          <CardCameraRig activeSide={activeSide} controlsRef={controlsRef} />
        </Canvas>
      </div>
    )
  }
)
