import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './LandingPage.css';

export default function LandingPage({ onLaunchDashboard }) {
  const aeroCanvasRef = useRef(null);
  const particleCanvasRef = useRef(null);
  const particleContainerRef = useRef(null);
  const cardContainerRef = useRef(null);

  // 1. AeroShards 3D WebGL Background Engine
  useEffect(() => {
    const canvas = aeroCanvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'high-performance' });
    if (!gl) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    const vsSource = `
      attribute vec3 aPosition;
      attribute vec3 aOffset;
      attribute vec3 aRotation;
      attribute vec3 aColor;
      attribute float aScale;
      attribute float aPhase;

      uniform mat4 uProjection;
      uniform mat4 uView;
      uniform float uTime;

      varying vec3 vNormal;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      varying float vChromatic;

      mat4 rotationMatrix(vec3 axis, float angle) {
        axis = normalize(axis);
        float s = sin(angle);
        float c = cos(angle);
        float oc = 1.0 - c;
        return mat4(
          oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
          oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
          oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
          0.0,                                0.0,                                0.0,                                1.0
        );
      }

      void main() {
        vec3 pos = aPosition * aScale;
        float spinTime = uTime * 0.6 + aPhase;
        mat4 rot = rotationMatrix(normalize(aRotation), spinTime);
        vec4 rotatedPos = rot * vec4(pos, 1.0);

        vec3 offset = aOffset;
        offset.x += sin(uTime * 0.32 + aPhase) * 0.55 + cos(uTime * 0.15 + aPhase * 2.1) * 0.25;
        offset.y += cos(uTime * 0.26 + aPhase * 1.3) * 0.45 + sin(uTime * 0.12 + aPhase) * 0.2;
        offset.z += sin(uTime * 0.20 + aPhase * 0.8) * 0.35;

        vec4 worldPosition = vec4(rotatedPos.xyz + offset, 1.0);
        gl_Position = uProjection * uView * worldPosition;

        vNormal = normalize((rot * vec4(aPosition, 0.0)).xyz);
        vColor = aColor;
        vWorldPos = worldPosition.xyz;
        vChromatic = clamp(0.0075 * (1.0 + abs(vNormal.z)), 0.0, 0.02);
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      varying float vChromatic;
      uniform float uTime;

      void main() {
        vec3 lightDir = normalize(vec3(0.5, 0.8, 1.2));
        vec3 viewDir = normalize(vec3(0.0, 0.0, 5.0) - vWorldPos);

        float diff = max(dot(vNormal, lightDir), 0.0);
        float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);

        vec3 pearl = vec3(0.66, 0.54, 0.95) * fresnel * 1.5;
        vec3 baseColor = vColor * (0.35 + diff * 0.65) + pearl;

        vec3 halfVector = normalize(lightDir + viewDir);
        float spec = pow(max(dot(vNormal, halfVector), 0.0), 32.0);
        vec3 finalColor = baseColor + vec3(1.0, 0.95, 1.0) * spec * 0.8;

        gl_FragColor = vec4(finalColor, 0.92);
      }
    `;

    const createShader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
    gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(program);
    gl.useProgram(program);

    const shardVertices = new Float32Array([
      0.0,  0.45, 0.0,  -0.3, 0.0, 0.1,   0.0, -0.45, 0.0,
      0.0,  0.45, 0.0,   0.0, -0.45, 0.0,  0.3, 0.0, 0.1,
      0.0,  0.45, 0.0,   0.3, 0.0, -0.1,  0.0, -0.45, 0.0,
      0.0,  0.45, 0.0,   0.0, -0.45, 0.0, -0.3, 0.0, -0.1
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, shardVertices, gl.STATIC_DRAW);

    const NUM_SHARDS = 250;
    const shardData = [];
    const shardColorBase = [0.537, 0.415, 0.741];
    const accentColorBase = [0.658, 0.333, 0.968];

    for (let i = 0; i < NUM_SHARDS; i++) {
      const isAccent = Math.random() > 0.65;
      const color = isAccent ? accentColorBase : shardColorBase;
      shardData.push({
        x: (Math.random() - 0.5) * 10.0,
        y: (Math.random() - 0.5) * 7.5,
        z: (Math.random() - 0.5) * 5.0,
        rotX: Math.random() - 0.5,
        rotY: Math.random() - 0.5,
        rotZ: Math.random() - 0.5,
        scale: (0.2 + Math.random() * 0.3) * 0.7,
        color: [color[0] + (Math.random()-0.5)*0.1, color[1] + (Math.random()-0.5)*0.1, color[2] + (Math.random()-0.5)*0.1],
        phase: Math.random() * Math.PI * 2
      });
    }

    const perspectiveMatrix = (fovy, aspect, near, far) => {
      const f = 1.0 / Math.tan(fovy / 2);
      const nf = 1 / (near - far);
      return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, (2 * far * near) * nf, 0
      ];
    };

    const uProjLoc = gl.getUniformLocation(program, 'uProjection');
    const uViewLoc = gl.getUniformLocation(program, 'uView');
    const uTimeLoc = gl.getUniformLocation(program, 'uTime');

    const aPosLoc = gl.getAttribLocation(program, 'aPosition');
    const aOffsetLoc = gl.getAttribLocation(program, 'aOffset');
    const aRotLoc = gl.getAttribLocation(program, 'aRotation');
    const aColorLoc = gl.getAttribLocation(program, 'aColor');
    const aScaleLoc = gl.getAttribLocation(program, 'aScale');
    const aPhaseLoc = gl.getAttribLocation(program, 'aPhase');

    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 3, gl.FLOAT, false, 0, 0);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.07, 0.059, 0.09, 1.0);

    let animId;
    let startTime = performance.now();
    const renderFrame = (now) => {
      const time = (now - startTime) * 0.001;
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const aspect = width / height;
      const proj = perspectiveMatrix(Math.PI / 4, aspect, 0.1, 100.0);
      const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -4.5, 1];

      gl.uniformMatrix4fv(uProjLoc, false, new Float32Array(proj));
      gl.uniformMatrix4fv(uViewLoc, false, new Float32Array(view));
      gl.uniform1f(uTimeLoc, time);

      for (let i = 0; i < NUM_SHARDS; i++) {
        const s = shardData[i];
        gl.vertexAttrib3f(aOffsetLoc, s.x, s.y, s.z);
        gl.vertexAttrib3f(aRotLoc, s.rotX, s.rotY, s.rotZ);
        gl.vertexAttrib3f(aColorLoc, s.color[0], s.color[1], s.color[2]);
        gl.vertexAttrib1f(aScaleLoc, s.scale);
        gl.vertexAttrib1f(aPhaseLoc, s.phase);
        gl.drawArrays(gl.TRIANGLES, 0, 12);
      }
      animId = requestAnimationFrame(renderFrame);
    };
    animId = requestAnimationFrame(renderFrame);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // 2. ParticleText Canvas Engine
  useEffect(() => {
    const container = particleContainerRef.current;
    const canvas = particleCanvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const text = 'EPHIMERA';
    const particleSize = 2.2;
    const density = 3;
    const color = '#ffffff';
    const highlightColor = '#A855F7';
    const scatter = 180;
    const gatherDuration = 1600;
    const stagger = 420;
    const pointerRepel = 45;
    const repelRadius = 130;
    const idleDrift = 0.7;

    let particles = [];
    let animationFrame = null;
    let gathering = false;
    let gatherStart = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const pointer = { active: false, x: 0, y: 0, smoothX: 0, smoothY: 0 };

    const hexToRgb = hex => {
      const clean = hex.replace('#', '').trim();
      if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
      return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16)
      };
    };
    const mixRgb = (from, to, amount) => ({
      r: Math.round(from.r + (to.r - from.r) * amount),
      g: Math.round(from.g + (to.g - from.g) * amount),
      b: Math.round(from.b + (to.b - from.b) * amount)
    });
    const rgbToCss = rgb => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
    const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

    const startGather = (fromScatter = true) => {
      if (!particles.length) return;
      const now = performance.now();
      particles.forEach(p => {
        if (fromScatter) {
          const angle = p.seed * Math.PI * 2;
          const dist = scatter * (0.35 + p.depth * 0.75);
          p.x = p.targetX + Math.cos(angle) * dist + (p.depth - 0.5) * scatter * 0.55;
          p.y = p.targetY + Math.sin(angle) * dist + (p.seed - 0.5) * scatter * 0.55;
        }
        p.startX = p.x;
        p.startY = p.y;
        p.delay = p.seed * stagger;
      });
      gatherStart = now;
      gathering = true;
    };

    const sampleText = async () => {
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      if (width <= 0 || height <= 0) return;

      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const fontSize = Math.min(Math.max(width * 0.12, 42), 92);
      const font = `900 ${fontSize}px 'Inter', sans-serif`;

      try {
        await document.fonts.load(font);
      } catch (e) {}

      const offscreen = document.createElement('canvas');
      const offCtx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!offCtx) return;

      offCtx.font = font;
      const metrics = offCtx.measureText(text);
      const textWidth = Math.max(1, Math.ceil(metrics.width));
      const textHeight = Math.max(1, Math.ceil(fontSize * 1.2));
      const padding = 20;

      offscreen.width = textWidth + padding * 2;
      offscreen.height = textHeight + padding * 2;
      offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
      offCtx.font = font;
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.fillStyle = '#ffffff';
      offCtx.fillText(text, offscreen.width / 2, offscreen.height / 2);

      const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const targets = [];
      const step = Math.max(2, Math.floor(density));

      for (let y = 0; y < offscreen.height; y += step) {
        for (let x = 0; x < offscreen.width; x += step) {
          const alpha = imageData.data[(y * offscreen.width + x) * 4 + 3];
          if (alpha > 40) {
            targets.push({
              x: width / 2 - offscreen.width / 2 + x,
              y: height / 2 - offscreen.height / 2 + y,
              alpha: alpha / 255
            });
          }
        }
      }

      const baseRgb = hexToRgb(color);
      const highlightRgb = hexToRgb(highlightColor);

      particles = targets.map((target, index) => {
        const seed = ((index * 9301 + 49297) % 233280) / 233280;
        const depth = 0.45 + (((index * 233 + 97) % 1000) / 1000) * 0.9;
        const blend = clamp(target.x / Math.max(1, width) + (seed - 0.5) * 0.4, 0, 1);
        const particleColor = rgbToCss(mixRgb(baseRgb, highlightRgb, blend));
        const angle = seed * Math.PI * 2;
        const dist = scatter * (0.35 + depth * 0.75);
        const startX = target.x + Math.cos(angle) * dist;
        const startY = target.y + Math.sin(angle) * dist;

        return {
          x: startX,
          y: startY,
          startX,
          startY,
          targetX: target.x,
          targetY: target.y,
          size: Math.max(0.8, particleSize * (0.75 + target.alpha * 0.45)),
          color: particleColor,
          seed,
          depth,
          delay: seed * stagger
        };
      });

      pointer.x = width / 2;
      pointer.y = height / 2;
      pointer.smoothX = pointer.x;
      pointer.smoothY = pointer.y;

      startGather(false);
    };

    const render = now => {
      ctx.clearRect(0, 0, width, height);
      pointer.smoothX += (pointer.x - pointer.smoothX) * 0.18;
      pointer.smoothY += (pointer.y - pointer.smoothY) * 0.18;

      let complete = true;
      particles.forEach(p => {
        let baseX = p.targetX;
        let baseY = p.targetY;
        let progress = 1;

        if (gathering) {
          const local = (now - gatherStart - p.delay) / gatherDuration;
          progress = clamp(local, 0, 1);
          const eased = easeOutCubic(progress);
          baseX = p.startX + (p.targetX - p.startX) * eased;
          baseY = p.startY + (p.targetY - p.startY) * eased;
          if (progress < 1) complete = false;
        } else if (idleDrift > 0) {
          const driftTime = now * 0.001;
          baseX += Math.sin(driftTime * 0.9 + p.seed * 10) * idleDrift * p.depth;
          baseY += Math.cos(driftTime * 0.75 + p.depth * 10) * idleDrift * p.depth;
        }

        if (pointer.active && pointerRepel > 0 && repelRadius > 0) {
          const dx = baseX - pointer.smoothX;
          const dy = baseY - pointer.smoothY;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < repelRadius) {
            const force = Math.pow(1 - distance / repelRadius, 2) * pointerRepel;
            baseX += (dx / distance) * force;
            baseY += (dy / distance) * force;
          }
        }

        p.x += (baseX - p.x) * 0.22;
        p.y += (baseY - p.y) * 0.22;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      });

      if (gathering && complete) gathering = false;
      animationFrame = requestAnimationFrame(render);
    };

    const handlePointerMove = e => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const handlePointerEnter = () => {
      pointer.active = true;
      startGather(true);
    };
    const handlePointerLeave = () => { pointer.active = false; };
    const handleClick = () => startGather(true);

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerenter', handlePointerEnter);
    container.addEventListener('pointerleave', handlePointerLeave);
    container.addEventListener('click', handleClick);
    window.addEventListener('resize', sampleText);

    sampleText();
    animationFrame = requestAnimationFrame(render);

    return () => {
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerenter', handlePointerEnter);
      container.removeEventListener('pointerleave', handlePointerLeave);
      container.removeEventListener('click', handleClick);
      window.removeEventListener('resize', sampleText);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  // 3. CardSwap 3D GSAP Engine
  useEffect(() => {
    const container = cardContainerRef.current;
    if (!container) return;

    const cardEls = Array.from(container.querySelectorAll('.swap-card'));
    if (cardEls.length === 0) return;

    const config = {
      cardDistance: 55,
      verticalDistance: 55,
      delay: 4500,
      skewAmount: 5,
      durDrop: 1.8,
      durMove: 1.8,
      durReturn: 1.8,
      promoteOverlap: 0.9,
      returnDelay: 0.05,
      ease: 'elastic.out(0.6, 0.9)'
    };

    const makeSlot = (i, distX, distY, total) => ({
      x: i * distX,
      y: -i * distY,
      z: -i * distX * 1.5,
      zIndex: total - i
    });

    const placeNow = (el, slot, skew) => {
      gsap.set(el, {
        x: slot.x,
        y: slot.y,
        z: slot.z,
        xPercent: -50,
        yPercent: -50,
        skewY: skew,
        transformOrigin: 'center center',
        zIndex: slot.zIndex,
        force3D: true
      });
    };

    let order = Array.from({ length: cardEls.length }, (_, i) => i);
    let tl = null;
    let intervalId = null;
    let isSwapping = false;

    const total = cardEls.length;
    cardEls.forEach((el, i) => {
      placeNow(el, makeSlot(i, config.cardDistance, config.verticalDistance, total), config.skewAmount);
    });

    const swap = () => {
      if (order.length < 2) return;
      isSwapping = true;

      const [front, ...rest] = order;
      const elFront = cardEls[front];
      tl = gsap.timeline({
        onComplete: () => { isSwapping = false; }
      });

      tl.to(elFront, {
        y: '+=480',
        duration: config.durDrop,
        ease: config.ease
      });

      tl.addLabel('promote', `-=${config.durDrop * config.promoteOverlap}`);
      rest.forEach((idx, i) => {
        const el = cardEls[idx];
        const slot = makeSlot(i, config.cardDistance, config.verticalDistance, total);
        tl.set(el, { zIndex: slot.zIndex }, 'promote');
        tl.to(
          el,
          {
            x: slot.x,
            y: slot.y,
            z: slot.z,
            duration: config.durMove,
            ease: config.ease
          },
          `promote+=${i * 0.12}`
        );
      });

      const backSlot = makeSlot(total - 1, config.cardDistance, config.verticalDistance, total);
      tl.addLabel('return', `promote+=${config.durMove * config.returnDelay}`);
      tl.call(() => { gsap.set(elFront, { zIndex: backSlot.zIndex }); }, undefined, 'return');
      tl.to(
        elFront,
        {
          x: backSlot.x,
          y: backSlot.y,
          z: backSlot.z,
          duration: config.durReturn,
          ease: config.ease
        },
        'return'
      );

      tl.call(() => { order = [...rest, front]; });
    };

    const startTimer = () => {
      clearInterval(intervalId);
      intervalId = setInterval(swap, config.delay);
    };

    startTimer();

    const handleMouseEnter = () => { tl?.pause(); clearInterval(intervalId); };
    const handleMouseLeave = () => { tl?.play(); startTimer(); };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    const clickHandlers = cardEls.map((card) => {
      const handler = () => {
        if (!isSwapping) {
          swap();
          startTimer();
        }
      };
      card.addEventListener('click', handler);
      return { card, handler };
    });

    return () => {
      clearInterval(intervalId);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      clickHandlers.forEach(({ card, handler }) => card.removeEventListener('click', handler));
    };
  }, []);

  const [isLoading, setIsLoading] = React.useState(false);

  const handleLaunch = () => {
    if (isLoading) return;
    setIsLoading(true);
    setTimeout(() => {
      if (onLaunchDashboard) onLaunchDashboard();
    }, 380);
  };

  return (
    <div className="landing-root">
      {/* 3D WebGL Background */}
      <div className="aero-shards">
        <canvas ref={aeroCanvasRef} className="aero-shards__canvas" />
      </div>
      <div className="vignette-overlay" />

      <div className="page-wrapper">
        <section className="hero-section">
          {/* ParticleText Header */}
          <div ref={particleContainerRef} className="particle-text-container">
            <div className="particle-text">
              <canvas ref={particleCanvasRef} className="particle-text__canvas" />
              <span className="particle-text__sr">EPHIMERA</span>
            </div>
          </div>

          <div className="hero-tagline">
            Decentralized <span>Hybrid P2P-CDN</span> Video Streaming Pipeline
          </div>

          <p className="hero-description">
            HTTP Live Streaming (.m3u8/.ts) powered by WebRTC DataChannels, a 650ms deadline race against origin CDN fallback, dynamic Adaptive Bitrate (ABR) laddering, and on-the-fly video transcoding.
          </p>

          {/* Single Centered Action Button */}
          <div className="hero-actions">
            <button
              className={`cta-card-btn player ${isLoading ? 'is-loading' : ''}`}
              onClick={handleLaunch}
              disabled={isLoading}
            >
              {isLoading && (
                <div className="btn-loader" style={{ display: 'flex' }}>
                  <svg className="spinner-svg" viewBox="0 0 24 24">
                    <circle className="spinner-track" cx="12" cy="12" r="9" fill="none" strokeWidth="2.5" />
                    <circle className="spinner-head" cx="12" cy="12" r="9" fill="none" strokeWidth="2.5" />
                  </svg>
                </div>
              )}
              <div className="btn-content">
                <span className="btn-title">Launch Live P2P Player</span>
                <span className="btn-sub">
                  {isLoading ? 'Connecting WebRTC Swarm...' : 'Stream HLS, upload video & inspect live swarm'}
                </span>
              </div>
            </button>
          </div>

          {/* Split Layout: FEATURES left text + Right offset 3D CardSwap */}
          <div className="card-swap-section">
            <div className="features-left-block">
              <span className="features-kicker">Architecture & Tech Stack</span>
              <h2 className="features-title">FEATURES</h2>
              <p className="features-subtitle">
                High-throughput decentralized video mesh streaming powered by WebRTC, real-time transcoding, and intelligent swarm topologies.
              </p>
            </div>

            <div className="card-swap-wrapper">
              <div ref={cardContainerRef} className="card-swap-container" id="cardSwapContainer">
                <article className="swap-card theme-1">
                  <div>
                    <h2 className="banner-title">WebRTC DataChannel Swarms</h2>
                    <p className="card-description">
                      Browser peers query chunk inventories over direct WebRTC DataChannels with an aggressive 650ms deadline race against origin CDN fallback.
                    </p>
                  </div>
                  <div className="banner-chips">
                    <span className="banner-chip">650ms Deadline Race</span>
                    <span className="banner-chip">Direct P2P DataChannels</span>
                    <span className="banner-chip">Origin CDN Fallback</span>
                    <span className="banner-chip">Zero Buffer Stalls</span>
                  </div>
                </article>

                <article className="swap-card theme-2">
                  <div>
                    <h2 className="banner-title">On-The-Fly Transcoder & Seeder</h2>
                    <p className="card-description">
                      Drag and drop any video file to automatically transcode it into multi-rendition HLS playlists and immediately seed newly minted segments to the swarm.
                    </p>
                  </div>
                  <div className="banner-chips">
                    <span className="banner-chip">FFmpeg 8.1 Transcoding</span>
                    <span className="banner-chip">Instant Chunk Hashing</span>
                    <span className="banner-chip">Automated Master Manifests</span>
                    <span className="banner-chip">Live Seeder Swarm</span>
                  </div>
                </article>

                <article className="swap-card theme-1">
                  <div>
                    <h2 className="banner-title">Adaptive Bitrate Ladder (ABR)</h2>
                    <p className="card-description">
                      Seamlessly adapts between 720p HD and 360p SD renditions with path-normalized P2P chunk routing across dynamic network conditions.
                    </p>
                  </div>
                  <div className="banner-chips">
                    <span className="banner-chip">720p HD & 360p SD Profiles</span>
                    <span className="banner-chip">Normalized Chunk Map</span>
                    <span className="banner-chip">Dynamic Bandwidth Throttle</span>
                    <span className="banner-chip">Zero Visual Artifacts</span>
                  </div>
                </article>

                <article className="swap-card theme-2">
                  <div>
                    <h2 className="banner-title">HMAC Auth & AES-128 DRM</h2>
                    <p className="card-description">
                      Cryptographic HMAC-SHA256 tokens for private rooms and 16-byte AES-128 key delivery for end-to-end protected video payloads.
                    </p>
                  </div>
                  <div className="banner-chips">
                    <span className="banner-chip">HMAC-SHA256 Signatures</span>
                    <span className="banner-chip">AES-128 Key Delivery</span>
                    <span className="banner-chip">Encrypted Segment Payloads</span>
                    <span className="banner-chip">Private Swarm Gatekeeping</span>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <footer>
          <div>⚡ Ephimera P2P-CDN Streaming Architecture</div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span>Live WebRTC Engine</span>
            <span>HLS Multi-Bitrate</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
