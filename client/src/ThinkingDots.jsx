import React, { useEffect, useRef } from 'react';
import './ThinkingDots.css';

/**
 * Helper to convert Hex to RGB
 */
const hexToRgb = (hex) => {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16)
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }
  return { r: 54, g: 42, b: 131 }; // Default #362A83
};

/**
 * ThinkingDots - React Bits Component
 * "A dot matrix breathing around a drifting cloud of density"
 * All dots styled with uniform Meteorite color #362A83
 */
export default function ThinkingDots({
  dotSpacing = 28,
  baseDotSize = 1.2,
  maxDotSize = 4.2,
  baseOpacity = 0.25,
  maxOpacity = 0.95,
  dotColor = '#362A83',
  speed = 2.4,
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

    const rgb = hexToRgb(dotColor);

    // Mouse tracker
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      active: false,
      radius: 200
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

    // Drifting clouds of density with increased drift speeds
    const clouds = [
      { seedX: 0.15, seedY: 0.35, speedX: 0.68, speedY: 0.54, radius: 280, weight: 1.0 },
      { seedX: 0.65, seedY: 0.75, speedX: -0.62, speedY: 0.72, radius: 320, weight: 0.85 },
      { seedX: 0.85, seedY: 0.25, speedX: 0.55, speedY: -0.64, radius: 240, weight: 0.75 }
    ].slice(0, Math.max(1, cloudCount));

    let startTime = performance.now();

    const render = (now) => {
      const time = (now - startTime) * 0.001 * speed;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.18;
      mouse.y += (mouse.targetY - mouse.y) * 0.18;

      // Update cloud positions
      const activeClouds = clouds.map((c, i) => {
        const cx = (width * 0.5) + Math.sin(time * c.speedX + c.seedX * 10) * (width * 0.38) + Math.cos(time * 0.35 + i) * (width * 0.1);
        const cy = (height * 0.5) + Math.cos(time * c.speedY + c.seedY * 10) * (height * 0.34) + Math.sin(time * 0.38 + i) * (height * 0.1);
        const radius = c.radius * (0.85 + Math.sin(time * 0.9 + i * 2) * 0.15);
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

          // Dynamic breathing wave oscillation
          const wave = Math.sin(time * 2.2 + x * 0.02 + y * 0.02) * 0.14;
          const currentDensity = Math.max(0, density + wave);

          // Calculate radius & opacity
          const radius = baseDotSize + (maxDotSize - baseDotSize) * Math.min(currentDensity, 1);
          const opacity = Math.min(1, baseOpacity + (maxOpacity - baseOpacity) * currentDensity);

          // Draw uniform #362A83 meteorite dot
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
          ctx.fill();

          // Subtle glowing aura on dense clusters
          if (currentDensity > 0.7) {
            ctx.beginPath();
            ctx.arc(x, y, radius * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity * 0.25})`;
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
  }, [dotSpacing, baseDotSize, maxDotSize, baseOpacity, maxOpacity, dotColor, speed, cloudCount, interactive]);

  return (
    <div ref={containerRef} className={`thinking-dots-container ${className}`.trim()} style={style}>
      <canvas ref={canvasRef} className="thinking-dots-canvas" />
    </div>
  );
}
