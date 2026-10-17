import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Heart, MessageSquare } from 'lucide-react'
import {
  type MaamfoogouDesign,
  toggleDesignLike,
} from '../../services/maamfoogouStore'
import { Card3DCanvas } from './Card3DCanvas'
import { normalizedTo3DElements } from '../../utils/designElementMapper'
import type { TShirtSide, TShirtSize } from '../../types/configurator'

interface FeaturedDesignCardProps {
  design: MaamfoogouDesign
  cardIndex: number
  isLikedByCurrentUser: boolean
  onSelectDesign: (designId: string) => void
}

export const FeaturedDesignCard: React.FC<FeaturedDesignCardProps> = ({
  design,
  cardIndex,
  isLikedByCurrentUser,
  onSelectDesign,
}) => {
  // Diapositives 3D : 1. Face 3D -> 2. Dos 3D -> 3. Variantes de couleur 3D
  const slides = useMemo(() => {
    const base: Array<{
      id: string
      label: string
      side: TShirtSide
      color: string
    }> = [
      {
        id: 'front',
        label: 'Vue Face 3D',
        side: 'front',
        color: design.tshirtColor,
      },
      {
        id: 'back',
        label: 'Vue Dos 3D',
        side: 'back',
        color: design.tshirtColor,
      },
    ]

    const variants = (design.colorVariants || []).map((v, idx) => ({
      id: `var_${idx}`,
      label: v.label,
      side: 'front' as TShirtSide,
      color: v.color,
    }))

    return [...base, ...variants]
  }, [design.colorVariants, design.tshirtColor])

  const elements3D = useMemo(
    () => normalizedTo3DElements(design.elements),
    [design.elements]
  )

  const [activeSlide, setActiveSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // État optimiste du bouton Like (Section 5)
  const [optimisticLiked, setOptimisticLiked] = useState(isLikedByCurrentUser)
  const [optimisticLikesCount, setOptimisticLikesCount] = useState(
    design.likesCount
  )

  useEffect(() => {
    setOptimisticLiked(isLikedByCurrentUser)
    setOptimisticLikesCount(design.likesCount)
  }, [isLikedByCurrentUser, design.likesCount])

  const cardRef = useRef<HTMLDivElement | null>(null)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)

  // 1. Respecter prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // 2. IntersectionObserver : met en pause le frameloop hors écran SANS démonter le canvas 3D (0 latence au scroll)
  useEffect(() => {
    const el = cardRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry) {
          setIsVisible(entry.isIntersecting)
        }
      },
      { rootMargin: '150px 0px', threshold: 0.05 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 3. Rotation automatique 3D toutes les 3.6s avec démarrage décalé par carte
  useEffect(() => {
    if (prefersReducedMotion || isPaused || !isVisible || slides.length <= 1) {
      return
    }

    let intervalId: ReturnType<typeof setInterval> | null = null
    const staggerDelay = (cardIndex % 5) * 650

    const startTimeout = setTimeout(() => {
      intervalId = setInterval(() => {
        setActiveSlide((prev) => (prev + 1) % slides.length)
      }, 3600)
    }, staggerDelay)

    return () => {
      clearTimeout(startTimeout)
      if (intervalId) clearInterval(intervalId)
    }
  }, [prefersReducedMotion, isPaused, isVisible, slides.length, cardIndex])

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation()

    const prevLiked = optimisticLiked
    const prevCount = optimisticLikesCount
    const nextLiked = !prevLiked

    setOptimisticLiked(nextLiked)
    setOptimisticLikesCount(Math.max(0, prevCount + (nextLiked ? 1 : -1)))

    try {
      const res = toggleDesignLike(design.id)
      if (res.requiresAuth) {
        setOptimisticLiked(prevLiked)
        setOptimisticLikesCount(prevCount)
      }
    } catch {
      setOptimisticLiked(prevLiked)
      setOptimisticLikesCount(prevCount)
    }
  }

  const uniqueSwatches = useMemo(() => {
    const list = [
      design.tshirtColor,
      ...(design.colorVariants || []).map((v) => v.color),
    ]
    return Array.from(new Set(list))
  }, [design.tshirtColor, design.colorVariants])

  const currentSlide = slides[activeSlide] || slides[0]

  return (
    <article
      ref={cardRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      onPointerDown={(e) => {
        pointerDownPos.current = { x: e.clientX, y: e.clientY }
      }}
      onPointerUp={(e) => {
        if (!pointerDownPos.current) return
        const dx = Math.abs(e.clientX - pointerDownPos.current.x)
        const dy = Math.abs(e.clientY - pointerDownPos.current.y)
        pointerDownPos.current = null
        if (dx < 6 && dy < 6) {
          onSelectDesign(design.id)
        }
      }}
      className="group flex flex-col bg-white cursor-pointer select-none"
    >
      {/* Modèle 3D permanent (Card3DCanvas) : aucun démontage au scroll et aucun SVG 2D affiché */}
      <div className="relative aspect-[3/4] w-full bg-[#F2F2F2] overflow-hidden rounded-none">
        <Card3DCanvas
          color={currentSlide.color}
          size={(design.size as TShirtSize) || 'L'}
          activeSide={currentSlide.side}
          isVisible={isVisible}
          elements={elements3D}
        />

        {/* Badges minimalistes BZB en haut à gauche (0px border-radius) */}
        <div className="pointer-events-none absolute top-2.5 left-2.5 flex flex-col items-start gap-1 z-10">
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] bg-white text-[#111111] border border-[#E5E5E5] rounded-none">
            {design.source === 'team' ? 'ATELIER' : 'CRÉATEUR'}
          </span>
          <span className="px-1.5 py-0.5 text-[9px] font-medium bg-white/90 text-[#666666] rounded-none">
            {currentSlide.label}
          </span>
        </div>

        {/* Bouton Like minimaliste en haut à droite (0px border-radius) */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={handleToggleLike}
          aria-label={
            optimisticLiked
              ? 'Retirer des favoris'
              : 'Liker et sauvegarder pour acheter plus tard'
          }
          className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-none flex items-center justify-center transition-colors duration-200 ${
            optimisticLiked
              ? 'bg-[#111111] text-white'
              : 'bg-white/90 text-[#111111] hover:bg-white'
          }`}
        >
          <Heart
            className={`w-4 h-4 ${optimisticLiked ? 'fill-current' : ''}`}
          />
        </button>
      </div>

      {/* Barre d'indicateurs segmentée fine sous le modèle 3D (2px, style BZB) */}
      <div
        className="w-full h-[2px] bg-[#E5E5E5] mt-1.5 flex"
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {slides.map((slide, idx) => (
          <button
            key={slide.id}
            type="button"
            aria-label={`Afficher ${slide.label}`}
            onClick={() => setActiveSlide(idx)}
            className={`flex-1 h-full transition-colors duration-300 ${
              idx === activeSlide
                ? 'bg-[#111111]'
                : 'bg-transparent hover:bg-[#BDBDBD]'
            }`}
          />
        ))}
      </div>

      {/* Pied de carte épuré BZB */}
      <div
        onClick={() => onSelectDesign(design.id)}
        className="pt-2.5 pb-1 flex flex-col gap-1"
      >
        {/* Pastilles de variantes de couleur (0px border-radius) */}
        <div
          className="flex items-center gap-1.5 mb-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {uniqueSwatches.slice(0, 4).map((hex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                const targetIdx = slides.findIndex(
                  (s) => s.color.toLowerCase() === hex.toLowerCase()
                )
                if (targetIdx >= 0) setActiveSlide(targetIdx)
              }}
              className="w-3.5 h-3.5 rounded-none border border-[#CCCCCC]"
              style={{ backgroundColor: hex }}
              title="Tester cette couleur en 3D"
            />
          ))}
        </div>

        <h3 className="text-[13px] font-normal text-[#111111] leading-snug line-clamp-1 group-hover:underline">
          {design.name}
        </h3>

        <p className="text-[11px] text-[#757575] leading-none">
          Par {design.creatorName}
        </p>

        <div className="mt-1 flex items-center justify-between text-[13px] text-[#111111]">
          <span className="font-normal">
            {design.price.toLocaleString('fr-FR')} FCFA
          </span>

          <div className="flex items-center gap-3 text-[11px] text-[#666666]">
            <span
              className={`inline-flex items-center gap-1 ${
                optimisticLiked ? 'text-[#111111] font-medium' : ''
              }`}
            >
              <Heart
                className={`w-3 h-3 ${optimisticLiked ? 'fill-current' : ''}`}
              />
              {optimisticLikesCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {design.commentsCount}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
