import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Decal, useGLTF } from '@react-three/drei'
import { TSHIRT_MODEL_PATH } from '../../config/constants'
import {
  createTextDecalTexture,
  getCottonNormalMap,
  getCottonRoughnessMap,
} from '../../utils/fabricTextures'
import { createRealisticTShirtGeometry } from '../../utils/tshirtGeometry'
import type { DesignElement, TShirtSide, TShirtSize } from '../../types/configurator'

// La taille (XS à XXL) est enregistrée uniquement en base de données (aucun impact sur l'échelle 3D du modèle)

interface DecalLayerProps {
  element: DesignElement
  isSelected: boolean
  fabricNormalMap: THREE.Texture | null
  onSelect: (id: string) => void
  onStartDrag: (id: string) => void
}

/**
 * Décalque 3D (Image ou Texte) projeté sur le maillage T_Shirt_male.
 * Utilise un polygonOffset élevé pour éviter tout conflit de profondeur (z-fighting) avec les plis.
 */
function TShirtDecalItem({
  element,
  isSelected,
  fabricNormalMap,
  onSelect,
  onStartDrag,
}: DecalLayerProps) {
  const [imageTexture, setImageTexture] = useState<THREE.Texture | null>(null)

  useEffect(() => {
    if (element.type !== 'image' || !element.imageUrl) {
      setImageTexture(null)
      return
    }

    let isMounted = true
    const loader = new THREE.TextureLoader()
    loader.load(
      element.imageUrl,
      (tex) => {
        if (!isMounted) return
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 16
        tex.needsUpdate = true
        setImageTexture(tex)
      },
      undefined,
      () => {
        if (isMounted) setImageTexture(null)
      }
    )

    return () => {
      isMounted = false
    }
  }, [element.type, element.imageUrl])

  const textTexture = useMemo(() => {
    if (element.type !== 'text') return null
    return createTextDecalTexture(element)
  }, [
    element.type,
    element.text,
    element.fontFamily,
    element.fontSize,
    element.textColor,
    element.strokeColor,
    element.strokeWidth,
  ])

  const activeTexture = element.type === 'image' ? imageTexture : textTexture
  if (!activeTexture) return null

  const aspect = element.type === 'image' ? element.aspectRatio || 1 : 2.0
  const width = element.scale
  const height = element.scale / aspect

  // Coordonnées Z calibrées sur la surface thoracique (+0.14) et dorsale (-0.12)
  const decalPosition: [number, number, number] = [
    element.position[0],
    element.position[1],
    element.side === 'front' ? 0.14 : -0.12,
  ]

  const decalRotation: [number, number, number] =
    element.side === 'front'
      ? [0, 0, element.rotation]
      : [0, Math.PI, element.rotation]

  return (
    <Decal
      position={decalPosition}
      rotation={decalRotation}
      scale={[width, height, 0.32]}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect(element.id)
        if (!element.locked) {
          onStartDrag(element.id)
        }
      }}
    >
      <meshStandardMaterial
        map={activeTexture}
        normalMap={fabricNormalMap}
        normalScale={new THREE.Vector2(0.85, 0.85)}
        transparent
        alphaTest={0.02}
        depthTest={true}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-16}
        polygonOffsetUnits={-4}
        roughness={0.85}
        metalness={0.0}
        emissive={
          isSelected ? new THREE.Color('#111111') : new THREE.Color('#000000')
        }
        emissiveIntensity={isSelected ? 0.08 : 0}
      />
    </Decal>
  )
}

interface TShirtCoreMeshProps {
  geometry: THREE.BufferGeometry
  bakedMaterial?: THREE.MeshStandardMaterial | null
  color: string
  size: TShirtSize
  activeSide: TShirtSide
  isFrozen?: boolean
  elements: Array<DesignElement>
  selectedElementId: string | null
  isCapturingPreview: boolean
  onSelectElement: (id: string | null) => void
  onUpdateElement: (id: string, patch: Partial<DesignElement>) => void
  onDeleteElement: (id: string) => void
  onCommitHistory: () => void
}

/**
 * Maillage principal du t-shirt :
 * - Recentre géométriquement les sommets (geom.center()) pour que X=0 soit le centre exact du buste
 * - Désactive l'aoMap défectueuse du fichier GLB (qui contenait une tache noire au dos)
 * - Conserve la normalMap photographique du coton tissé et les vrais plis géométriques 3D
 * - La modification de la taille (XS-XXL) n'altère pas le maillage 3D (enregistrée uniquement en backend)
 */
function TShirtCoreMesh({
  geometry,
  bakedMaterial,
  color,
  activeSide,
  isFrozen = false,
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onCommitHistory,
}: TShirtCoreMeshProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const elapsedRef = useRef(0)

  const [draggingId, setDraggingId] = useState<string | null>(null)

  const fallbackNormalMap = useMemo(() => getCottonNormalMap(), [])
  const fallbackRoughnessMap = useMemo(() => getCottonRoughnessMap(), [])

  const preparedGeometry = useMemo(() => {
    const geom = geometry.clone()
    geom.center()
    geom.computeVertexNormals()
    return geom
  }, [geometry])

  // Matériau PBR coton : conserve la normalMap textile haute définition mais retire l'aoMap tachée au dos
  const cottonMaterial = useMemo(() => {
    const nativeNormalMap = bakedMaterial?.normalMap || fallbackNormalMap
    nativeNormalMap.anisotropy = 16

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      normalMap: nativeNormalMap,
      normalScale: new THREE.Vector2(1.6, 1.6),
      roughnessMap: fallbackRoughnessMap,
      roughness: 0.88,
      metalness: 0.02,
      aoMap: null, // Supprime la tache noire cuite au dos du modèle GLB d'origine
      side: THREE.DoubleSide,
    })

    mat.needsUpdate = true
    return mat
  }, [bakedMaterial, fallbackNormalMap, fallbackRoughnessMap])

  // Variables d'animation spring (entrée et couleur, échelle fixe 1.0 indépendante de la taille)
  const entranceProgress = useRef(0)
  const entranceVelocity = useRef(0)
  const currentColor = useRef(new THREE.Color(color))
  const targetColor = useMemo(() => new THREE.Color(color), [color])
  const currentScale = useRef(new THREE.Vector3(0.92, 0.92, 0.92))

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    if (!isFrozen) {
      elapsedRef.current += dt
    }
    const t = elapsedRef.current

    // 1. Animation d'entrée fluide sans rebond excessif
    const stiffness = 95
    const damping = 18
    const force = (1 - entranceProgress.current) * stiffness
    entranceVelocity.current += (force - entranceVelocity.current * damping) * dt
    entranceProgress.current = Math.min(
      1,
      entranceProgress.current + entranceVelocity.current * dt
    )

    // 2. Transition spring de la couleur du coton en temps réel
    currentColor.current.lerp(targetColor, 1 - Math.exp(-12 * dt))
    cottonMaterial.color.copy(currentColor.current)

    // 3. Échelle constante 1.0 (la taille XS-XXL n'a aucun impact sur le modèle 3D)
    const entryScale = THREE.MathUtils.lerp(0.92, 1.0, entranceProgress.current)
    const targetScaleVec = new THREE.Vector3(entryScale, entryScale, entryScale)
    currentScale.current.lerp(targetScaleVec, 1 - Math.exp(-10 * dt))

    if (groupRef.current) {
      groupRef.current.scale.copy(currentScale.current)

      if (isFrozen) {
        // Modèle figé : retour fluide à la posture strictement immobile (0, 0, 0)
        const snapFactor = 1 - Math.exp(-15 * dt)
        groupRef.current.position.y = THREE.MathUtils.lerp(
          groupRef.current.position.y,
          0,
          snapFactor
        )
        groupRef.current.rotation.y = THREE.MathUtils.lerp(
          groupRef.current.rotation.y,
          0,
          snapFactor
        )
        groupRef.current.rotation.z = THREE.MathUtils.lerp(
          groupRef.current.rotation.z,
          0,
          snapFactor
        )
      } else {
        // Flottement global très doux lorsque le modèle n'est pas figé
        const floatY = Math.sin(t * 1.3) * 0.004
        const entryY = (1 - entranceProgress.current) * -0.08
        groupRef.current.position.y = entryY + floatY
        groupRef.current.rotation.y =
          (1 - entranceProgress.current) * 0.35 + Math.sin(t * 0.8) * 0.012
        groupRef.current.rotation.z = Math.cos(t * 1.1) * 0.005
      }
    }
  })

  useEffect(() => {
    if (!draggingId) return
    const handleUp = () => {
      setDraggingId(null)
      onCommitHistory()
    }
    window.addEventListener('pointerup', handleUp)
    return () => window.removeEventListener('pointerup', handleUp)
  }, [draggingId, onCommitHistory])

  // Déplacement direct par glisser-déposer 3D sur le maillage du t-shirt
  const handlePointerMoveOnShirt = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingId || !meshRef.current) return
    e.stopPropagation()

    const localPoint = meshRef.current.worldToLocal(e.point.clone())
    const clampedX = THREE.MathUtils.clamp(localPoint.x, -0.12, 0.12)
    const clampedY = THREE.MathUtils.clamp(localPoint.y, -0.22, 0.14)

    onUpdateElement(draggingId, {
      position: [
        clampedX,
        clampedY,
        activeSide === 'front' ? 0.14 : -0.12,
      ],
    })
  }

  return (
    <group ref={groupRef}>
      <mesh
        ref={meshRef}
        geometry={preparedGeometry}
        material={cottonMaterial}
        castShadow
        receiveShadow
        dispose={null}
        onPointerMove={handlePointerMoveOnShirt}
        onPointerDown={(e) => {
          if (e.object === meshRef.current && !draggingId) {
            onSelectElement(null)
          }
        }}
      >
        {elements.map((el) => (
          <TShirtDecalItem
            key={el.id}
            element={el}
            isSelected={el.id === selectedElementId}
            fabricNormalMap={cottonMaterial.normalMap}
            onSelect={(id) => onSelectElement(id)}
            onStartDrag={(id) => setDraggingId(id)}
          />
        ))}
      </mesh>
    </group>
  )
}

function GLTFTShirtLoader(
  props: Omit<TShirtCoreMeshProps, 'geometry' | 'bakedMaterial'> & {
    modelPath: string
  }
) {
  const gltf = useGLTF(props.modelPath, false) as unknown as {
    nodes: Record<string, THREE.Mesh>
    materials: Record<string, THREE.MeshStandardMaterial>
    scene: THREE.Group
  }

  const { extractedGeometry, extractedMaterial } = useMemo(() => {
    if (gltf.nodes?.T_Shirt_male?.geometry) {
      return {
        extractedGeometry: gltf.nodes.T_Shirt_male.geometry,
        extractedMaterial: gltf.materials?.lambert1 || null,
      }
    }

    let foundGeom: THREE.BufferGeometry | null = null
    let foundMat: THREE.MeshStandardMaterial | null = null
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !foundGeom) {
        const m = child as THREE.Mesh
        foundGeom = m.geometry
        if (m.material && !Array.isArray(m.material)) {
          foundMat = m.material as THREE.MeshStandardMaterial
        }
      }
    })

    return {
      extractedGeometry: foundGeom || createRealisticTShirtGeometry(),
      extractedMaterial: foundMat,
    }
  }, [gltf])

  return (
    <TShirtCoreMesh
      {...props}
      geometry={extractedGeometry}
      bakedMaterial={extractedMaterial}
    />
  )
}

class ModelErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[TShirtModel] GLTF load error:', error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export interface TShirtModelProps
  extends Omit<TShirtCoreMeshProps, 'geometry' | 'bakedMaterial'> {
  modelPath?: string
}

export function TShirtModel({
  modelPath = TSHIRT_MODEL_PATH,
  ...rest
}: TShirtModelProps) {
  const fallbackGeometry = useMemo(() => createRealisticTShirtGeometry(), [])

  return (
    <ModelErrorBoundary
      fallback={
        <TShirtCoreMesh
          {...rest}
          geometry={fallbackGeometry}
          bakedMaterial={null}
        />
      }
    >
      <React.Suspense
        fallback={
          <TShirtCoreMesh
            {...rest}
            geometry={fallbackGeometry}
            bakedMaterial={null}
          />
        }
      >
        <GLTFTShirtLoader {...rest} modelPath={modelPath} />
      </React.Suspense>
    </ModelErrorBoundary>
  )
}

if (typeof window !== 'undefined') {
  useGLTF.preload(TSHIRT_MODEL_PATH, false)
}
