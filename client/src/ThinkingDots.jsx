import React, { useEffect, useRef } from 'react';
import './ThinkingDots.css';

/**
 * ThinkingDots - React Bits Component
 * "A dot matrix breathing around a drifting cloud of density"
 */
export default function ThinkingDots({
  dotSpacing = 28,
  baseDotSize = 1.2,
  maxDotSize = 4.2,
  baseOpacity = 0.12,
  maxOpacity = 0.85,
  dotColor = '#ffffff',
  accentColor = '#A855F7',
  iridescent = true,
  speed = 0.8,
  cloudCount = 3,
  interactive = true,
  className = '',
  style = {}
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = null;
    let width = 0;
    let height = 0;
    let dpr = 1;

    // Mouse tracker
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      active: false,
      radius: 180
    };

    const handlePointerMove = (e) => {
      const rect = container.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.active = true;
    };

    const handlePointerLeave = () => {
      mouse.active = false;
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    if (interactive) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerleave', handlePointerLeave);
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    window.addEventListener('resize', resize);
    resize();

    // Drifting clouds of density
    const clouds = [
      { seedX: 0.15, seedY: 0.35, speedX: 0.32, speedY: 0.24, radius: 260, weight: 1.0 },
      { seedX: 0.65, seedY: 0.75, speedX: -0.28, speedY: 0.38, radius: 300, weight: 0.85 },
      { seedX: 0.85, seedY: 0.25, speedX: 0.22, speedY: -0.31, radius: 220, weight: 0.75 }
    ].slice(0, Math.max(1, cloudCount));

    // Rainbow iridescent color palette
    const rainbowColors = [
      'rgba(255, 107, 107, ',  // Coral red
      'rgba(254, 202, 87, ',   // Gold yellow
      'rgba(72, 219, 251, ',   // Cyan
      'rgba(255, 159, 243, ',  // Pink
      'rgba(168, 85, 247, '    // Purple
    ];

    let startTime = performance.now();

    const render = (now) => {
      const time = (now - startTime) * 0.001 * speed;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.12;
      mouse.y += (mouse.targetY - mouse.y) * 0.12;

      // Update cloud positions
      const activeClouds = clouds.map((c, i) => {
        const cx = (width * 0.5) + Math.sin(time * c.speedX + c.seedX * 10) * (width * 0.38) + Math.cos(time * 0.15 + i) * (width * 0.1);
        const cy = (height * 0.5) + Math.cos(time * c.speedY + c.seedY * 10) * (height * 0.34) + Math.sin(time * 0.18 + i) * (height * 0.1);
        const radius = c.radius * (0.85 + Math.sin(time * 0.5 + i * 2) * 0.15);
        return { x: cx, y: cy, radius, weight: c.weight };
      });

      // Grid of dots
      const cols = Math.ceil(width / dotSpacing);
      const rows = Math.ceil(height / dotSpacing);
      const offsetX = (width - (cols - 1) * dotSpacing) / 2;
      const offsetY = (height - (rows - 1) * dotSpacing) / 2;

      for (let r = 0; r < rows; r++) {
        const y = offsetY + r * dotSpacing;

        for (let c = 0; c < cols; c++) {
          const x = offsetX + c * dotSpacing;

          // Compute density influence from drifting clouds
          let density = 0;
          for (let i = 0; i < activeClouds.length; i++) {
            const cl = activeClouds[i];
            const dx = x - cl.x;
            const dy = y - cl.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < cl.radius) {
              const falloff = 1 - dist / cl.radius;
              density += falloff * falloff * cl.weight;
            }
          }

          // Mouse interactive density
          if (mouse.active) {
            const mdx = x - mouse.x;
            const mdy = y - mouse.y;
            const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mDist < mouse.radius) {
              const mFalloff = 1 - mDist / mouse.radius;
              density += mFalloff * mFalloff * 1.2;
            }
          }

          density = Math.min(density, 1.4);

          // Subtle organic breathing oscillation
          const wave = Math.sin(time * 1.2 + x * 0.015 + y * 0.015) * 0.1;
          const currentDensity = Math.max(0, density + wave);

          // Calculate radius & opacity
          const radius = baseDotSize + (maxDotSize - baseDotSize) * Math.min(currentDensity, 1);
          const opacity = Math.min(1, baseOpacity + (maxOpacity - baseOpacity) * currentDensity);

          // Draw dot
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);

          if (iridescent && currentDensity > 0.45) {
            // Tinch of rainbow on higher-density nodes
            const colorIdx = Math.floor((x + y + time * 60) * 0.02) % rainbowColors.length;
            const rainbowColor = rainbowColors[Math.abs(colorIdx)];
            ctx.fillStyle = `${rainbowColor}${opacity})`;
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          }

          ctx.fill();

          // Subtle glowing halo on dense clusters
          if (currentDensity > 0.75) {
            ctx.beginPath();
            ctx.arc(x, y, radius * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(168, 85, 247, ${opacity * 0.18})`;
            ctx.fill();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      if (interactive) {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerleave', handlePointerLeave);
      }
    };
  }, [dotSpacing, baseDotSize, maxDotSize, baseOpacity, maxOpacity, dotColor, accentColor, iridescent, speed, cloudCount, interactive]);

  return (
    <div ref={containerRef} className={`thinking-dots-container ${className}`.trim()} style={style}>
      <canvas ref={canvasRef} className="thinking-dots-canvas" />
    </div>
  );
}
