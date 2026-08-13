# Roadmap

## Hackathon submission

- Run the full local verification gate.
- Apply the backend Planet migration to the approved PostgreSQL instance.
- Perform one approved browser smoke: buy/confirm → GIF generation → My Planets → mining.
- Record the demo and publish the Megastera repository/write-up.

## After the deadline, only with explicit product approval

- Move GIF generation to a durable worker if synchronous batches become a bottleneck.
- Add durable rate limiting and structured generation observability.
- Add user-facing retry/reconciliation for receipts that were confirmed but not generated.
- Revisit whether any on-chain ownership or NFT layer is actually needed; it is not part of
  the current product contract.

## Explicitly out of scope

- Planet vouchers, NFT minting, contract holdings, Planet event projection, and continuous
  Ticket indexing.
- Per-second/daily mineral writes, transfer ledgers, same-type bonuses, and application
  auth.
- Mainnet activation, production transactions, and secret management from the repository.
