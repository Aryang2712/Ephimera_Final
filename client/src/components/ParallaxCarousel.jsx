import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import './ParallaxCarousel.css';

const DEFAULT_ITEMS = [
  { id: 1, name: 'photo 1', title: 'Core Swarm Engineering', subtitle: 'WebRTC data plane & chunk pipeline' },
  { id: 2, name: 'photo 2', title: 'Distributed Systems Labs', subtitle: '650ms deadline race algorithms' },
  { id: 3, name: 'photo 3', title: 'Media Architecture & Transcoding', subtitle: 'Real-time multi-rendition HLS & ABR' },
  { id: 4, name: 'photo 4', title: 'Swarm Protocols & Cryptography', subtitle: 'HMAC auth & AES-128 key delivery' },
  { id: 5, name: 'photo 5', title: 'Peer Mesh Infrastructure', subtitle: 'Zero-latency signaling and discovery' }
];

export default function ParallaxCarousel({
  items = DEFAULT_ITEMS,
  parallaxIntensity = 0.22,
  autoPlay = true,
  autoPlaySpeed = 3600,
  className = ''
}) {
  const containerRef = useRef(null);
  const trackRef = useRef(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const stateRef = useRef({
    startX: 0,
    currentX: 0,
    targetX: 0,
    currentProgress: 0,
    velocity: 0,
    isPointerDown: false,
    cardWidth: 400,
    gap: 24,
    totalItems: items.length,
    isHovered: false
  });

  const updateCardWidth = useCallback(() => {
    if (!containerRef.current) return;
    const firstCard = containerRef.current.querySelector('.parallax-card');
    if (firstCard) {
      stateRef.current.cardWidth = firstCard.getBoundingClientRect().width;
      stateRef.current.gap = 24;
    }
  }, []);

  // Animation Loop with Lerping & Parallax calculation
  useEffect(() => {
    updateCardWidth();
    window.addEventListener('resize', updateCardWidth);

    let rafId = null;
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const state = stateRef.current;

      // Autoplay drift when not dragging or hovering
      if (autoPlay && !state.isPointerDown && !state.isHovered) {
        // Handled via interval or subtle drift
      }

      // Smooth lerping
      state.currentX += (state.targetX - state.currentX) * Math.min(1, 10 * dt);

      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${state.currentX}px, 0, 0)`;

        // Calculate parallax for each card
        const cardStep = state.cardWidth + state.gap;
        const cards = trackRef.current.querySelectorAll('.parallax-card');
        
        cards.forEach((card, i) => {
          const cardCenter = state.currentX + i * cardStep + state.cardWidth / 2;
          const containerWidth = containerRef.current?.getBoundingClientRect().width || 1000;
          const offsetFromCenter = (cardCenter - containerWidth / 2) / (containerWidth / 2);

          const inner = card.querySelector('.parallax-card-inner');
          if (inner) {
            const parallaxX = offsetFromCenter * parallaxIntensity * 100;
            inner.style.transform = `translate3d(${-parallaxX}px, 0, 0) scale(1.08)`;
          }
        });

        // Determine active index
        const currentIdx = Math.max(0, Math.min(items.length - 1, Math.round(-state.currentX / cardStep)));
        setCurrentIndex(currentIdx);
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateCardWidth);
    };
  }, [items.length, parallaxIntensity, autoPlay, updateCardWidth]);

  // Autoplay Timer
  useEffect(() => {
    if (!autoPlay) return;

    const interval = setInterval(() => {
      if (!stateRef.current.isPointerDown && !stateRef.current.isHovered) {
        const nextIndex = (currentIndex + 1) % items.length;
        goToIndex(nextIndex);
      }
    }, autoPlaySpeed);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlaySpeed, currentIndex, items.length]);

  const goToIndex = (index) => {
    const state = stateRef.current;
    const clampedIndex = Math.max(0, Math.min(items.length - 1, index));
    const step = state.cardWidth + state.gap;
    state.targetX = -clampedIndex * step;
    setCurrentIndex(clampedIndex);
  };

  const handlePointerDown = (e) => {
    stateRef.current.isPointerDown = true;
    stateRef.current.startX = e.clientX || e.touches?.[0]?.clientX || 0;
    stateRef.current.startTargetX = stateRef.current.targetX;
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!stateRef.current.isPointerDown) return;
    const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
    const delta = clientX - stateRef.current.startX;
    
    // Bounded bounds with rubber band effect
    const maxBound = 0;
    const minBound = -(items.length - 1) * (stateRef.current.cardWidth + stateRef.current.gap);
    
    let newTarget = stateRef.current.startTargetX + delta;
    if (newTarget > maxBound) {
      newTarget = maxBound + (newTarget - maxBound) * 0.3;
    } else if (newTarget < minBound) {
      newTarget = minBound + (newTarget - minBound) * 0.3;
    }

    stateRef.current.targetX = newTarget;
  };

  const handlePointerUp = () => {
    if (!stateRef.current.isPointerDown) return;
    stateRef.current.isPointerDown = false;
    setIsDragging(false);

    // Snap to nearest slide
    const step = stateRef.current.cardWidth + stateRef.current.gap;
    const nearestIndex = Math.max(0, Math.min(items.length - 1, Math.round(-stateRef.current.targetX / step)));
    goToIndex(nearestIndex);
  };

  return (
    <div
      ref={containerRef}
      className={`parallax-carousel-root ${isDragging ? 'is-dragging' : ''} ${className}`}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={() => {
        handlePointerUp();
        stateRef.current.isHovered = false;
      }}
      onMouseEnter={() => {
        stateRef.current.isHovered = true;
      }}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
    >
      <div className="parallax-carousel-viewport">
        <div ref={trackRef} className="parallax-carousel-track">
          {items.map((item, idx) => (
            <div
              key={item.id || idx}
              className={`parallax-card ${idx === currentIndex ? 'is-active' : ''}`}
              onClick={() => goToIndex(idx)}
            >
              <div className="parallax-card-inner">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="parallax-card-image" />
                ) : (
                  <div className="parallax-card-skeleton">
                    <Camera size={32} className="about-photo-icon" style={{ opacity: 0.6, marginBottom: '0.6rem' }} />
                    <span className="parallax-badge">{item.name}</span>
                  </div>
                )}
              </div>

              {(item.title || item.subtitle) && (
                <div className="parallax-card-caption">
                  {item.title && <h4>{item.title}</h4>}
                  {item.subtitle && <p>{item.subtitle}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="parallax-carousel-controls">
        <div className="parallax-pagination">
          {items.map((_, idx) => (
            <button
              key={idx}
              className={`parallax-dot ${idx === currentIndex ? 'is-active' : ''}`}
              onClick={() => goToIndex(idx)}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            className="parallax-nav-btn"
            onClick={() => goToIndex(currentIndex - 1)}
            disabled={currentIndex === 0}
            aria-label="Previous slide"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="parallax-nav-btn"
            onClick={() => goToIndex(currentIndex + 1)}
            disabled={currentIndex === items.length - 1}
            aria-label="Next slide"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
