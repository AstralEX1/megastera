# Play UI refinement design

## Scope

Refine the desktop Play ticket configurator presentation without changing ticket
selection, approval, purchase, backend generation, or mobile behavior.

## Coordinates disclosure

On desktop widths, keep the Coordinates disclosure panel on the right and keep
its toggle immediately to the panel's left. Increase the toggle from `52x160px`
to `104x320px`, and increase the arrow and vertical label proportionally. Anchor
the toggle by its right edge to the panel so the enlarged control does not drift
away from the panel at narrower desktop widths.

Keep the existing mobile disclosure below the configurator, including its
current labels, state, and panel behavior.

## Win up to headline

Use the existing landing display scale as the Play `Billboard` size:
`clamp(3.45rem, 5.6vw, 5.3rem)`. Configure `DepthText` with:

- `depth={4}`
- `layers={32}`
- `fontWeight={800}` for Extra Bold
- the existing face/depth colors, animation, perspective, and shadow behavior

This keeps the change local to the Play headline and avoids introducing a new
global typography token for one usage.

## Verification

Update focused `ExpeditionConfigurator` assertions for the new DepthText layer
count, font size, weight, and deepest layer transform. Add assertions for the
enlarged desktop toggle and its panel-relative positioning while preserving the
mobile disclosure behavior. Run the focused tests, then the repository gate
required by `AGENTS.md` where the local environment permits it. Report browser
visual validation separately from local test/build results.

## Non-goals

- No Megapot contract or purchase-flow changes.
- No changes to Coordinates ticket data or quick-pick behavior.
- No changes to mobile layout beyond preserving the existing disclosure.
- No changes to the landing page headline.
