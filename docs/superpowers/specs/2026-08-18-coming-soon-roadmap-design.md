# Coming Soon Roadmap Design

## Goal
Add a new `Coming Soon` tab that presents the Megastera product roadmap without touching ticket purchase, planet generation, mining, leaderboard data, API, or database behavior.

## Visual direction
The page uses the existing application shell and design tokens: near-black space background, bordered dark surfaces, Sora HUD headings, JetBrains Mono micro-labels, white primary text, muted secondary text, and the existing violet accent.

The layout is a simple vertical mission path rather than an animated scene. Genesis is explicitly marked `Completed` in green and each completed Genesis item receives its own check marker. `Mid-Season 1 Update` is the brightest milestone because it is the next planned release. Later milestones use normal readable text with quieter borders and timeline markers rather than lowering the opacity of entire cards.

Roadmap cards size to their text content. No placeholder illustration space is reserved. Season 2 and Season 3 remain text-only until dedicated artwork is supplied later.

## Roadmap content

### Genesis
- Megastera Launch
- Initial Player Acquisition
- Season 1 Begins

### Mid-Season 1 Update
- Minerals Become an In-Game Currency
- Planet Upgrades
- Mineral Rewards Based on Ticket Results

### Season 1 Finale
- Final Leaderboard Snapshot
- USDC Rewards for Top Players
- Unique 1/1 NFT Planets for the Top 10

### Season 2 — Stellar Expansion
- Stars as a New Game Asset
- Stellar Systems
- New Gameplay Mechanics

Season 1 assets carry forward into Season 2 and play a crucial role in the new Stellar Expansion mechanics. This note is visually separated behind a small `Legacy` disclosure control.

### Season 3 — Galactic Conflict
- PvP Gameplay
- Attack and Defend Stellar Systems
- Starships
- Captains
- Fleet-Based Mechanics
- Expanded Gameplay Built Around Player Competition

## Interaction and motion
Keep motion intentionally restrained. Adapt the pointer spotlight interaction from React Bits `SpotlightCard` for the active Mid-Season milestone only. No parallax, scroll choreography, continuous motion, 3D, orbital animation, or decorative ship animation. Respect keyboard focus and reduced-motion expectations.

## Architecture
Create a standalone `ComingSoon` page and one roadmap-specific spotlight component. Add a new navigation key and `/coming-soon` route through the existing History API router. The feature remains frontend-only and isolated from all game data flows.

## Verification
Add route coverage, navigation label coverage, and page rendering/accessibility coverage. The repository pull-request verification workflow must pass database validation, lint, typecheck, tests, and build.
