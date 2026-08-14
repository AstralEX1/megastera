# Megastera text-only wordmark

## Goal

Remove the graphic logo mark from the Megastera interface and keep one consistent
text-only wordmark, `MEGASTERA`, on the Landing page and the `/play` page.

The Landing footer uses the same wordmark so the page has no remaining alternate
brand treatment.

## Scope

- Remove the shared `BrandMark` SVG from the application shell.
- Replace the split `Mega`/`stera` shell copy with the single `MEGASTERA` value.
- Remove the decorative `M` mark from the Landing header and footer.
- Render `MEGASTERA` in uppercase in the Landing header, Landing footer, and the
  shared shell used by `/play`.
- Keep routing, navigation, wallet controls, purchase flow, page layout, and
  existing Landing motion unchanged.
- Do not modify any unrelated working-tree changes already present in the repository.

## Design and implementation

`src/config/copy.ts` becomes the single source for the visible application brand
name through a `brandName` entry. `src/components/layout/Layout.tsx` consumes
that value directly and no longer imports or renders `BrandMark`. The unused
`src/components/layout/BrandMark.tsx` module is removed after all references are
deleted.

`src/pages/Landing.tsx` keeps the existing `landing-wordmark` links and
`LandingSplitText` behavior, but removes the `landing-wordmark-mark` element and
passes the shared uppercase brand value to the text renderer in both locations.
The related mark-only CSS is removed; typography, spacing, focus behavior, and
responsive layout remain otherwise unchanged.

## Verification

- Focused tests assert the Landing and shared shell expose `MEGASTERA` and no
  graphic mark.
- `rg` confirms there are no active `BrandMark` imports/usages or Landing mark
  elements.
- Run the repository gate required by `AGENTS.md`: lint, typecheck, tests,
  production build, Prisma generation/validation, and the planet-generator
  golden suite.
- If a local browser runtime is available, inspect `/` and `/play` visually;
  browser inspection is reported separately from local test/build results.
