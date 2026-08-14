# Play wallet CTA and exact approval design

## Scope

Update the Play checkout so a disconnected wallet sees a `Connect wallet` CTA in
the existing purchase slot, while preserving the current direct purchase, bulk
purchase, ticket-selection, receipt, and backend-generation flows. Replace the
current unlimited USDC approval with an approval for the exact amount required by
the active purchase route and quantity.

## Approach

Keep `ApprovalButton` as the route-agnostic allowance gate and add a small wallet
action mode to the existing `ExploreButton`. The wallet action uses RainbowKit's
`useConnectModal` hook, so Play opens the standard connection modal in place and
does not depend on a header navigation action. `ExpeditionConfigurator` receives
the connection state so its CTA is enabled for connection when no wallet is
connected, while the existing checkout readiness guards remain active once a
wallet is connected.

The approval wrapper remains around the downstream action. While disconnected,
the parent supplies no non-zero approval amount, so no allowance read or approval
CTA is shown. Once connected and the active purchase is ready, the route-specific
spender and exact current purchase total are passed to `ApprovalButton`.

## Approval and allowance flow

1. Select the route-specific spender: Jackpot for direct purchases and the batch
   facilitator for bulk orders.
2. Read `USDC.allowance(wallet, spender)` through the existing allowance hook.
3. If the allowance is loading or cannot be read, show the existing explicit
   status/error state.
4. If `allowance < amount`, submit `USDC.approve(spender, amount)` where `amount`
   is the exact current purchase total in six-decimal base units.
5. Wait for a successful approval receipt, refetch the allowance, and reset the
   approval write state.
6. Render the downstream Explore action whenever the refreshed allowance is at
   least the current amount. A later quantity increase may legitimately require a
   new approval for the larger amount; lowering the quantity must not prompt for
   approval when the existing allowance still covers it.

## Error handling

Preserve the current fail-closed behavior: an unresolved allowance must not be
treated as sufficient, a reverted receipt must not trigger `onApproved`, and
write or receipt errors remain visible below the approval CTA. If the modal hook
is unavailable during provider hydration, the connection CTA remains present but
disabled until RainbowKit exposes its open function.

## Tests

- Play renders `Connect wallet` instead of `Explore` when the account is
  disconnected and invokes the modal opener on click.
- `ApprovalButton` submits the exact amount to the route-specific spender.
- A sufficient allowance renders the downstream action without an approval CTA.
- A successful approval refetches allowance and does not re-offer approval after
  the refreshed allowance covers the amount.
- Existing reverted-receipt, route-specific spender, and direct/bulk behavior
  remain covered.

## Non-goals

- No contract addresses, chain configuration, ticket ABI, purchase arguments, or
  receipt provenance changes.
- No change to the actual ticket price, quantity limits, or bulk-order threshold.
- No change to the header/mobile wallet surfaces.
- No deployment, funded transaction, or live mainnet verification claim.
