<div align="center">
  <h1>Megastera</h1>
  <p><strong>One Megapot ticket. Two outcomes: a shot at the jackpot and a Planet that keeps playing.</strong></p>
  <p>
    <a href="https://megastera.vercel.app"><img src="https://img.shields.io/badge/Play-Megastera-6C5CE7?style=for-the-badge" alt="Play Megastera" /></a>
    <a href="https://x.com/MegasteraGame"><img src="https://img.shields.io/badge/Follow-@MegasteraGame-000000?style=for-the-badge&logo=x&logoColor=white" alt="Follow Megastera on X" /></a>
    <a href="https://x.com/AstralEX163/status/2088334372063654047"><img src="https://img.shields.io/badge/Watch-Game_Review-1DA1F2?style=for-the-badge" alt="Watch the Megastera game review" /></a>
  </p>
  <img
    src="https://github.com/user-attachments/assets/8bcd7b58-bec4-4e94-aaff-05c377cf35e3"
    alt="A procedurally generated Megastera Planet"
    width="281"
  />
</div>

Megastera is a live space tycoon on Base where every eligible Megapot ticket becomes persistent game progression. The ticket still enters the real Megapot drawing; its confirmed onchain receipt also generates a unique Planet that mines minerals, can be upgraded, reacts to future drawings, and competes on the seasonal leaderboard.

## The game in 60 seconds

1. **Choose an expedition.** Connect a wallet, pick ticket coordinates, and buy with USDC on Base.
2. **Enter Megapot.** These are real Megapot tickets with the normal jackpot and winnings lifecycle.
3. **Discover Planets.** Each confirmed ticket deterministically reveals one Planet with its own type, rarity, terrain, satellites, appearance, and mining rate.
4. **Build an economy.** Planets continuously mine minerals. Collecting matching types unlocks production bonuses.
5. **Make a trade-off.** Spend minerals to permanently upgrade a Planet. Your leaderboard balance drops now, but your future production rises.
6. **React to the draw.** Every settled Megapot drawing creates a new **Galaxy Pulse** that changes mining rates for selected Planet types.
7. **Race the season.** Grow the strongest economy, climb the leaderboard, and compete for seasonal rewards—while every new expedition still carries a jackpot chance.

### Why it is fun

- **Two reveals from one action:** jackpot anticipation plus a collectible Planet reveal.
- **Progress survives the drawing:** a losing ticket can still create a valuable long-term game asset.
- **Real strategy:** collect matching types, decide when to spend leaderboard minerals on upgrades, and adapt to Galaxy Pulse effects.
- **A shared changing universe:** Megapot winning numbers reshape production for every player at the same time.
- **Competition with a deadline:** seasonal standings turn collection and optimization into a race.

Megastera already has **40+ early players** in the live ticket-to-Planet and leaderboard loop.

## Live gameplay systems

### Planets, collections, and minerals

Ticket data deterministically generates one of ten Planet types and a wide set of visual and economic traits. The selected bonus ball strongly biases the associated Planet type—currently 55%—without making the reveal predictable.

Every Planet mines minerals from the moment it is generated. Owning 3, 5, or 10 Planets of the same type applies +5%, +7.5%, or +10% production to every matching Planet. Minerals are both the live leaderboard score and the currency used for upgrades.

Planets are persistent Megastera game records linked to onchain ticket provenance. Discovering one does **not** require a second NFT mint transaction.

### Planet upgrades

Players can spend earned minerals to upgrade an individual Planet through three permanent levels:

| Level | Total Planet bonus |
| ---: | ---: |
| 1 | +10% |
| 2 | +25% |
| 3 | +50% |

Upgrade costs scale with the extra production being purchased. The connected wallet signs a Sign-In with Ethereum (SIWE) message to prove ownership; the upgrade itself spends in-game minerals rather than sending a funded onchain transaction. Purchases are owner-bound and idempotent, so the same level cannot be charged twice.

### Galaxy Pulse

Galaxy Pulse turns every Megapot settlement into a game-wide economic event:

1. A finalized `JackpotSettled` event supplies the drawing ID and winning numbers.
2. Megastera derives a deterministic seed from that public result.
3. The seed creates four Pulse slots. Each slot selects a Planet type and a mining modifier between -50% and +50%.
4. If the same type appears more than once, its modifiers stack.
5. The newest Pulse affects all matching Planets until the next drawing settles.

The result is shared, verifiable game state: a draw can suddenly strengthen one collection, weaken another, and change the best upgrade strategy without erasing any Planet's permanent progress.

### Seasons and rewards

The leaderboard ranks wallets by spendable minerals, so upgrading creates a deliberate short-term cost for a long-term production advantage. Same-type collection bonuses, Planet levels, and the current Galaxy Pulse all contribute to mining speed.

**100% of the Megapot referral fees received by Megastera are allocated to the seasonal leaderboard reward pool.** Season 1 rewards are settled manually after standings lock; automated reward settlement is a future expansion, not part of the current repository.

## Megapot integration

The [Inco Summer Game Jam](https://www.inco.org/blog/summer-game-jam-resources-and-what-to-build) asks Megapot-track games to make Megapot a meaningful part of the core loop. In Megastera, Megapot provides the purchase action, immutable Planet provenance, jackpot outcome, Galaxy Pulse seed, player ticket history, winnings, claims, and the referral-funded reward flywheel.

```text
Wallet + USDC
  ├─ 1–10 tickets ──> Jackpot.buyTickets
  └─ 11–50 tickets ─> BatchPurchaseFacilitator.createBatchOrder
                              │ keeper execution
                              ▼
TicketPurchased receipt ──> verification ──> Planet + mining + leaderboard

JackpotSettled ──> winning numbers ──> Galaxy Pulse ──> mining-rate changes
Megapot Data API ──> ticket/win history ──> Jackpot.claimWinnings ──> USDC
```

### Base mainnet contracts

| Contract | Purpose | Address |
| --- | --- | --- |
| Jackpot | Direct ticket purchases, drawing state, settlement, winnings claims | [`0x3bAe…42a2`](https://basescan.org/address/0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2) |
| USDC | Ticket payment asset | [`0x8335…2913`](https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) |
| BatchPurchaseFacilitator | Keeper-executed bulk expeditions | [`0xBA34…76F`](https://basescan.org/address/0xBA343479D98a1Ed333899999D95a7343B808a76F) |

Megastera targets Base mainnet, chain ID `8453`.

### Purchase paths

- **1–10 tickets:** the app simulates and submits `Jackpot.buyTickets`. Selected coordinates and quick picks are sent as normal Megapot ticket numbers.
- **11–50 tickets:** the app creates a keeper-executed batch order. Up to ten tickets can use selected coordinates; the remaining tickets are generated dynamically by the facilitator.
- **Attribution:** every purchase includes the bytes32 source tag `MEGASTERA` and the approved project referrer. This identifies eligible Planet receipts and directs Megapot referral fees into the reward flywheel.

### From receipt to Planet

The browser never gets to declare that a Planet exists. After purchase, the backend verifies the exact `TicketPurchased` transaction hash and log index against Base mainnet. It checks the canonical Jackpot address, `MEGASTERA` source tag, recipient and ticket fields, confirmation depth, and canonical block hash.

Only then does it persist the ticket and deterministically generate the Planet and GIF. The immutable `transactionHash:logIndex` key makes generation retry-safe and prevents one ticket from creating duplicate Planets. For bulk orders, provenance comes from each keeper execution that actually minted tickets—not from the earlier order-creation transaction.

### Drawing state, history, and claims

- Live drawing state comes from the Jackpot contract.
- Ticket history, settled rounds, and wallet wins come from the Megapot Data API through a same-origin backend proxy.
- Winning claims are simulated and then sent directly to `Jackpot.claimWinnings`; Megastera never takes custody of player winnings.
- Galaxy Pulse ingests finalized Jackpot settlement receipts and derives its effects from the winning numbers.

See the official [Megapot developer guide](https://llms.megapot.io), [contract documentation](https://docs.megapot.io), and [Data API](https://api.megapot.io/v1/docs) for protocol-level details.

## Architecture at a glance

**Frontend:** React 19, TypeScript, Vite, wagmi, viem, RainbowKit<br>
**Backend:** Hono, PostgreSQL, Prisma<br>
**Planet rendering:** shared deterministic generator<br>
**Protocol:** Megapot on Base mainnet

The active runtime is intentionally small: verified ticket receipts, deterministic backend Planets, spendable mineral accounts, upgrades, Galaxy Pulse rounds, and leaderboard records. Deeper implementation and operational detail lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/OPERATIONS.md`](docs/OPERATIONS.md), and [`api/README.md`](api/README.md).

## Run locally

Requirements: Node.js 22+, pnpm 11+, PostgreSQL, and a Base RPC endpoint.

```bash
pnpm install
pnpm db:generate
pnpm db:validate
pnpm api:server
pnpm dev
```

Copy the required placeholders from [`.env.example`](.env.example) into your local environment. Never expose server credentials through `VITE_*` variables.

## Quality gate

```bash
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @megaplanets/planet-generator golden
pnpm build
```

## License

See [`LICENSE`](LICENSE) and the planet generator's [`THIRD_PARTY_NOTICES.md`](packages/planet-generator/THIRD_PARTY_NOTICES.md).
