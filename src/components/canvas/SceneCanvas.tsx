import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import {
  Crosshair,
  RotateCcw,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { TShirtModel } from './TShirtModel'
import type {
  DesignElement,
  TShirtSide,
  TShirtSize,
} from '../../types/configurator'

type OrbitControlsImpl = React.ComponentRef<typeof OrbitControls>

export interface SceneCanvasHandle {
  captureFrontAndBackPreviews: () => Promise<{
    frontDataUrl: string
    backDataUrl: string
  }>
}

interface SceneCanvasProps {
  color: string
  size: TShirtSize
  activeSide: TShirtSide
  zoom: number
  isFrozen?: boolean
  elements: Array<DesignElement>
  selectedElementId: string | null
  modelPath?: string
  onSelectElement?: (id: string | null) => void
  onUpdateElement?: (id: string, patch: Partial<DesignElement>) => void
  onDeleteElement?: (id: string) => void
  onCommitHistory?: () => void
}

class EnvironmentErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

/**
 * Contrôleur de caméra téléobjectif studio (FOV 25°) avec transitions spring fluides
 */
function CameraRig({
  activeSide,
  zoom,
  isFrozen,
  controlsRef,
  onReadyCapture,
}: {
  activeSide: TShirtSide
  zoom: number
  isFrozen: boolean
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  onReadyCapture: (
    fn: () => Promise<{ frontDataUrl: string; backDataUrl: string }>
  ) => void
}) {
  const { camera, gl, scene } = useThree()
  const isTransitioning = useRef(false)
  const targetAzimuth = useRef(0)
  const targetDistance = useRef(1.85)

  useEffect(() => {
    targetAzimuth.current = activeSide === 'front' ? 0 : Math.PI
    targetDistance.current = THREE.MathUtils.clamp(1.85 / zoom, 1.15, 2.6)
    isTransitioning.current = true
  }, [activeSide, zoom, isFrozen])

  useFrame((_, delta) => {
    if (!isTransitioning.current || !controlsRef.current) return

    const dt = Math.min(delta, 0.05)
    const controls = controlsRef.current
    const offset = camera.position.clone().sub(controls.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)

    let angleDiff = targetAzimuth.current - spherical.theta
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

    const distDiff = targetDistance.current - spherical.radius
    const polarDiff = Math.PI / 2 - 0.04 - spherical.phi

    const springStep = 1 - Math.exp(-9.0 * dt)
    spherical.theta += angleDiff * springStep
    spherical.radius += distDiff * springStep
    spherical.phi += polarDiff * springStep

    offset.setFromSpherical(spherical)
    camera.position.copy(controls.target).add(offset)
    controls.update()

    if (
      Math.abs(angleDiff) < 0.008 &&
      Math.abs(distDiff) < 0.008 &&
      Math.abs(polarDiff) < 0.008
    ) {
      isTransitioning.current = false
    }
  })

  useEffect(() => {
    onReadyCapture(async () => {
      const savedPos = camera.position.clone()
      const savedTarget = controlsRef.current
        ? controlsRef.current.target.clone()
        : new THREE.Vector3(0, 0, 0)

      // 1. Capture studio haute netteté de la vue Devant (+Z)
      camera.position.set(0, 0, 1.82)
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()
      gl.render(scene, camera)
      const frontDataUrl = gl.domElement.toDataURL('image/png')

      // 2. Capture studio haute netteté de la vue Dos (-Z)
      camera.position.set(0, 0, -1.82)
      camera.lookAt(0, 0, 0)
      camera.updateMatrixWorld()
      gl.render(scene, camera)
      const backDataUrl = gl.domElement.toDataURL('image/png')

      // Restauration de la caméra
      camera.position.copy(savedPos)
      camera.lookAt(savedTarget)
      camera.updateMatrixWorld()
      if (controlsRef.current) {
        controlsRef.current.target.copy(savedTarget)
        controlsRef.current.update()
      }
      gl.render(scene, camera)

      return { frontDataUrl, backDataUrl }
    })
  }, [camera, gl, scene, controlsRef, onReadyCapture])

  return null
}

export const SceneCanvas = forwardRef<SceneCanvasHandle, SceneCanvasProps>(
  function SceneCanvas(
    {
      color,
      size,
      activeSide,
      zoom,
      isFrozen = false,
      elements,
      selectedElementId,
      modelPath,
      onSelectElement = () => {},
      onUpdateElement = () => {},
      onDeleteElement = () => {},
      onCommitHistory = () => {},
    },
    ref
  ) {
    const controlsRef = useRef<OrbitControlsImpl | null>(null)
    const captureFnRef = useRef<
      (() => Promise<{ frontDataUrl: string; backDataUrl: string }>) | null
    >(null)
    const [isCapturingPreview, setIsCapturingPreview] = useState(false)

    useImperativeHandle(ref, () => ({
      captureFrontAndBackPreviews: async () => {
        if (!captureFnRef.current) {
          return { frontDataUrl: '', backDataUrl: '' }
        }
        setIsCapturingPreview(true)
        await new Promise((resolve) => requestAnimationFrame(resolve))
        const result = await captureFnRef.current()
        setIsCapturingPreview(false)
        return result
      },
    }))

    const selectedElement = useMemo(
      () =>
        elements.find(
          (el) => el.id === selectedElementId && el.side === activeSide
        ) || null,
      [elements, selectedElementId, activeSide]
    )

    return (
      <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black shadow-2xl">
        {/* Halo de studio photographique dynamique adapté à la teinte du t-shirt */}
        <div
          className="pointer-events-none absolute inset-0 opacity-45 transition-all duration-700"
          style={{
            background: `radial-gradient(circle at 50% 44%, ${color}66 0%, rgba(24,24,27,0.4) 52%, transparent 78%)`,
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Barre d'outils flottante d'édition rapide pour l'élément sélectionné */}
        {selectedElement && !isCapturingPreview && (
          <div className="absolute left-1/2 top-14 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-zinc-900/90 px-3 py-1.5 text-white shadow-2xl backdrop-blur-xl sm:top-4">
            <span className="mr-1.5 max-w-[90px] truncate text-[11px] font-semibold text-amber-400">
              {selectedElement.type === 'image'
                ? selectedElement.originalFileName || 'Image'
                : selectedElement.text}
            </span>
            <button
              type="button"
              title="Réduire la taille"
              onClick={() => {
                onUpdateElement(selectedElement.id, {
                  scale: Math.max(
                    0.06,
                    Number((selectedElement.scale - 0.015).toFixed(3))
                  ),
                })
                onCommitHistory()
              }}
              className="rounded-full p-1.5 hover:bg-white/15 active:scale-95"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Agrandir la taille"
              onClick={() => {
                onUpdateElement(selectedElement.id, {
                  scale: Math.min(
                    0.3,
                    Number((selectedElement.scale + 0.015).toFixed(3))
                  ),
                })
                onCommitHistory()
              }}
              className="rounded-full p-1.5 hover:bg-white/15 active:scale-95"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Pivoter -15°"
              onClick={() => {
                onUpdateElement(selectedElement.id, {
                  rotation: selectedElement.rotation - Math.PI / 12,
                })
                onCommitHistory()
              }}
              className="rounded-full p-1.5 hover:bg-white/15 active:scale-95"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Pivoter +15°"
              onClick={() => {
                onUpdateElement(selectedElement.id, {
                  rotation: selectedElement.rotation + Math.PI / 12,
                })
                onCommitHistory()
              }}
              className="rounded-full p-1.5 hover:bg-white/15 active:scale-95"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Recentrer sur le buste"
              onClick={() => {
                onUpdateElement(selectedElement.id, {
                  position: [
                    0,
                    0.04,
                    selectedElement.side === 'front' ? 0.14 : -0.12,
                  ],
                  rotation: 0,
                })
                onCommitHistory()
              }}
              className="rounded-full p-1.5 hover:bg-white/15 active:scale-95"
            >
              <Crosshair className="h-3.5 w-3.5" />
            </button>
            <div className="mx-0.5 h-4 w-px bg-white/15" />
            <button
              type="button"
              title="Supprimer cet élément"
              onClick={() => onDeleteElement(selectedElement.id)}
              className="rounded-full p-1.5 text-rose-400 hover:bg-rose-500/20 active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0, 1.85], fov: 25, near: 0.1, far: 20 }}
          gl={{
            antialias: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.12,
          }}
        >
          {/* Éclairage Studio symétrique (Devant & Dos) + HDRI */}
          <ambientLight intensity={0.75} />
          <hemisphereLight
            color="#ffffff"
            groundColor="#27272a"
            intensity={0.65}
          />
          {/* Key Light Avant (+Z) */}
          <directionalLight
            position={[2.2, 2.8, 2.8]}
            intensity={1.35}
            color="#fffbeb"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0002}
          />
          {/* Key Light Arrière (-Z) pour éclairer parfaitement le dos du t-shirt */}
          <directionalLight
            position={[-2.2, 2.8, -2.8]}
            intensity={1.35}
            color="#fffbeb"
          />
          {/* Fill Lights latérales */}
          <directionalLight
            position={[-2.8, 1.2, 2.0]}
            intensity={0.65}
            color="#e0e7ff"
          />
          <directionalLight
            position={[2.8, 1.2, -2.0]}
            intensity={0.65}
            color="#e0e7ff"
          />

          <EnvironmentErrorBoundary>
            <React.Suspense fallback={null}>
              <Environment preset="city" environmentIntensity={0.55} />
            </React.Suspense>
          </EnvironmentErrorBoundary>

          {/* Modèle 3D scanné avec plis cuits et matériau PBR coton */}
          <TShirtModel
            color={color}
            size={size}
            activeSide={activeSide}
            isFrozen={isFrozen}
            elements={elements}
            selectedElementId={selectedElementId}
            isCapturingPreview={isCapturingPreview}
            modelPath={modelPath}
            onSelectElement={onSelectElement}
            onUpdateElement={onUpdateElement}
            onDeleteElement={onDeleteElement}
            onCommitHistory={onCommitHistory}
          />

          {/* Ombre de contact douce sous le t-shirt */}
          <ContactShadows
            position={[0, -0.34, 0]}
            opacity={0.55}
            scale={1.55}
            blur={2.3}
            far={0.85}
            resolution={512}
            color="#000000"
          />

          <OrbitControls
            ref={controlsRef}
            enableRotate={!isFrozen}
            enableDamping
            dampingFactor={0.05}
            rotateSpeed={0.75}
            zoomSpeed={0.85}
            enablePan={false}
            minDistance={1.15}
            maxDistance={2.6}
            minPolarAngle={Math.PI / 3.2}
            maxPolarAngle={Math.PI - Math.PI / 3.2}
            target={[0, 0, 0]}
          />

          <CameraRig
            activeSide={activeSide}
            zoom={zoom}
            isFrozen={isFrozen}
            controlsRef={controlsRef}
            onReadyCapture={(fn) => {
              captureFnRef.current = fn
            }}
          />
        </Canvas>
      </div>
    )
  }
)
