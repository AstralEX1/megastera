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
Motion stays restrained and function-specific rather than decorative:

- React Bits `Galaxy`, adapted as a very low-density OGL star field behind the page. It has no pointer interaction and uses low glow/speed values.
- React Bits `BlurText`, adapted for the `Roadmap` heading as a short one-time focus reveal.
- React Bits `DecryptedText`, adapted for the small `Coming Soon` telemetry label only.
- React Bits `FadeContent`, adapted so each of the five milestones reveals once as it enters the viewport with a small blur and vertical offset.
- The existing React Bits-inspired `SpotlightCard` remains limited to the active Mid-Season milestone.
- Completed Genesis checkmarks resolve in a short staggered sequence.
- The completed portion of the timeline animates from Genesis to the current milestone only; future timeline segments stay quiet.
- The Season 1 Legacy icon receives a very subtle periodic glow, with no continuous spinning or movement.

No parallax, cursor gimmicks, hyperspeed, 3D, illustration animation, orbital artwork, ship artwork, or repeating milestone entrance animations. All effects respect reduced-motion preferences. WebGL-unavailable environments retain a static low-contrast background fallback.

## Architecture
Create a standalone `ComingSoon` page plus small isolated React Bits-inspired presentation components under `src/components/common/reactBits`. Add a new navigation key and `/coming-soon` route through the existing History API router. The feature remains frontend-only and isolated from all game data flows.

## Verification
Add route coverage, navigation label coverage, page rendering/accessibility coverage, and explicit integration coverage for the restrained ambient motion layers. The repository pull-request verification workflow must pass database validation, lint, typecheck, tests, and build.
