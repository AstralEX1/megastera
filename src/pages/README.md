# Page ownership

`src/App.tsx` owns the small History API router. The current demo path is:

| Route/view | Owner | Responsibility |
| --- | --- | --- |
| Home | `Home.tsx` | Explain the Megapot → Planet loop and live jackpot context. |
| Play | `Play.tsx` | Dynamic ticket checkout, canonical receipt verification, and backend Planet generation. |
| Tickets | `Tickets.tsx` | Megapot ticket/history surfaces; Data API data is never mint authority. |
| My Planets | `Planets.tsx` | Database-backed Planet GIFs, traits, mining, and ticket provenance. |
| Planet detail | `Planets.tsx` | Deep-linked backend Planet detail and mining state. |
| Leaderboard | `Leaderboard.tsx` | Daily UTC snapshot and historical day reads. |
| Lab | `Lab.tsx` | Development-only deterministic generator inspection; never database authority. |

When changing the game loop, read [`../../docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md)
and [`../../docs/OPERATIONS.md`](../../docs/OPERATIONS.md) first. Keep RPC writes and
receipt validation explicit in the owning hook/page; keep display interpolation local.
