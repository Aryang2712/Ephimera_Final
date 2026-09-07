# Ephimera Landing Page Export

This folder contains the complete, standalone landing page featuring:
- **WebGL AeroShards 3D background** with pearl reflections, continuous drift, and mouse repulsion/physics.
- **Canvas ParticleText** header for `EPHIMERA` with interactive scatter, gather, and pointer repulsion.
- **Apple Liquid Glass Action Cards** with animated loading spinners.
- **React Bits `<CardSwap />` 3D Stack** with `Black Ops One` font, right-offset card placement, and GSAP timeline physics.

---

## 🚀 How to Use / Integrate

### Option 1: Direct HTML Drop-in
1. Copy `index.html` into your other repository's `public/` or `dist/` folder (or root for static sites).
2. Open `index.html` directly in any web browser or serve it with any web server (`npx serve`, `live-server`, `python -m http.server`, etc.).

### Option 2: Connecting Dashboard & Player Links
Whenever you have your dashboard or player URL ready, open `index.html` and update lines 521 and 535:
```html
<!-- Update href with your dashboard or live player link -->
<a href="/YOUR_DASHBOARD_OR_PLAYER_LINK" class="cta-card-btn player" id="btnLaunchPlayer">
  ...
</a>

<!-- Update href with your secondary or scratchpad link -->
<a href="/YOUR_SIMULATION_OR_SECONDARY_LINK" class="cta-card-btn scratchpad" id="btnLaunchScratchpad">
  ...
</a>
```

---

## 🎨 Typography & Libraries Loaded (via CDN)
- **Google Fonts**: `Inter`, `Black Ops One`, `JetBrains Mono`
- **GSAP 3.12.5**: `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js`
- **ScrollTrigger**: `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js`
