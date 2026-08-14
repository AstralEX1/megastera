# Season 1 leaderboard presentation

## Design read

This is a preserve-mode redesign of a live leaderboard in a dark sci-fi game. The
audience is players who need to understand the active season, prize promise, and
their current position at a glance.

Design dials:

- `DESIGN_VARIANCE: 6` for a deliberate split layout without changing the page
  information architecture.
- `MOTION_INTENSITY: 2` because this is a live data surface and should stay calm;
  existing value count-up motion remains unchanged.
- `VISUAL_DENSITY: 5` to make the prize context visible while keeping the standings
  readable on mobile.

## Current surface and constraints

- Keep the existing `/leaderboard` route and `Leaderboard` page.
- Keep live refresh, loading, error, empty, wallet rank, and current mining data
  behavior unchanged.
- Keep the existing dark palette, Sora HUD headings, JetBrains Mono telemetry, and
  rounded panel language.
- Do not change API contracts, ranking calculations, period semantics, or backend
  prize logic.
- Do not invent payout amounts.

## Chosen design

Add a Season 1 command panel directly below the page header and above the standings.
The left side carries the season identity and deadline. The right side carries two
compact prize statements:

1. `USDC` for the fungible prize category.
2. `1/1 PLANET NFT` for the unique planet prize category.

Supporting copy states that the top 10 places receive USDC and 1/1 Planet NFT prizes
at the end of Season 1. The deadline is shown as `August 23, 2026`.

The panel uses the existing violet/cyan space language with a restrained diagonal
surface treatment. It is one hierarchy-setting block, not a new dashboard of cards.

## Rank treatment

The table remains the source of standings. Rank styling is semantic and consistent
across desktop and mobile:

- Rank 1 uses a muted gold tint and border.
- Rank 2 uses a muted silver tint and border.
- Rank 3 uses a muted bronze tint and border.
- Ranks 4 through 10 use a cool cyan highlight to identify the rest of the prize
  zone without competing with the podium.
- Ranks 11 and above retain the neutral row treatment.
- The connected wallet highlight remains visible alongside the rank treatment.

No repeated `TOP 10` label is rendered in every row. The rank number and tonal
hierarchy carry the meaning with less visual noise.

## Responsive behavior

- At desktop widths, the Season 1 panel uses a two-column layout and keeps the prize
  categories aligned to the right.
- Below the medium breakpoint, the panel stacks identity and prizes, and each prize
  category remains readable without horizontal overflow.
- The existing desktop table and mobile article list both receive the same rank tier
  classes so the semantics do not disappear on mobile.

## Accessibility and verification

- Rank colors are paired with the visible rank number and are not the only source of
  meaning.
- Existing focus styles and button behavior remain unchanged.
- The new copy uses sentence case and avoids payout amounts that were not specified;
  the top-10 prize-zone interpretation follows the requested emphasis on ranks 4
  through 10.
- Add assertions for Season 1 copy, the August 23 deadline, and rank-tier classes in
  the existing page/table tests.
- Run the targeted leaderboard tests, then the repository lint, typecheck, and build
  gates that are available in the workspace.
