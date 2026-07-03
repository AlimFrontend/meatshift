# Meat Shift

**Fast-paced 2D arena action game** built with vanilla JavaScript and Canvas — wave survival, dash mechanics, wall jumps, and ground-pound combos.

## Overview

Meat Shift is a browser arcade shooter where you fight escalating enemy waves in a confined arena. The codebase is split into focused modules (physics, combat, rendering, audio, upgrades) with a centralized config layer — no framework overhead, full control over the game loop.

## Stack

- **Language:** JavaScript (ES modules)
- **Rendering:** HTML5 Canvas
- **Audio:** Web Audio API
- **Build:** None — static `index.html`, open and play

## Features

- Platformer physics: run, jump, double jump, dash, wall slide/jump
- Ground-pound AoE attack with cooldown
- Wave-based enemy spawning and upgrade system
- Particle effects and screen shake
- Tunable balance via `js/config.js` (no magic numbers in game logic)

## Getting Started

```bash
git clone https://github.com/AlimFullstack/meatshift.git
cd meatshift
```

Serve the folder with any static server:

```bash
npx serve .
# or
python -m http.server 8080
```

Open `http://localhost:8080` (or the port shown) and play.

> No `npm install` required — zero dependencies by design.
