# Play wallet CTA and exact approvals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an in-place RainbowKit `Connect wallet` CTA on Play for disconnected accounts and approve only the exact USDC amount required by the current direct or bulk purchase.

**Architecture:** Keep `ApprovalButton` as the route-specific allowance gate and keep `ExploreButton` as the single checkout action slot. Pass `isConnected` through `Play` to `ExpeditionConfigurator`; the action slot switches to a RainbowKit modal opener only when disconnected, while connected purchases retain the existing readiness, spender, receipt, and generation flow.

**Tech Stack:** React 19, TypeScript, wagmi 2, RainbowKit 2, viem bigint amounts, Vitest, Testing Library, pnpm.

## Global Constraints

- Use English for source, identifiers, filenames, tests, commits, and technical documentation.
- Preserve the existing direct purchase, bulk purchase, ticket-selection, receipt provenance, and backend Planet-generation flows.
- Keep route-specific spenders: Jackpot for direct purchases and BatchPurchaseFacilitator for bulk orders.
- Keep USDC amounts as bigint in six-decimal base units until display formatting.
- Submit `approve(spender, exactPurchaseAmount)`; never use an unlimited approval value.
- Show `Approve USDC` only when the resolved `allowance(wallet, spender)` is below the exact current amount.
- Do not change contract addresses, chain configuration, ticket ABI, purchase arguments, quantity limits, or bulk threshold.
- Do not stage or modify unrelated existing working-tree changes.

---

### Task 1: Add failing Play wallet CTA tests

**Files:**
- Modify: `src/components/explore/ExpeditionConfigurator.test.tsx`
- Modify: `src/pages/Play.test.tsx`

**Interfaces:**
- Consumes: the existing `ExpeditionConfigurator` props and the RainbowKit `useConnectModal` hook.
- Produces: failing assertions that define the disconnected CTA label, modal callback, and absence of the Explore action.

- [ ] **Step 1: Add a deterministic RainbowKit modal mock to both test files**

Use a hoisted mock so tests do not require a real `RainbowKitProvider`:

```tsx
const openConnectModal = vi.hoisted(() => vi.fn());

vi.mock('@rainbow-me/rainbowkit', () => ({
  useConnectModal: () => ({ openConnectModal }),
}));
```

Reset `openConnectModal` in each test file's existing cleanup hook.

- [ ] **Step 2: Add the configurator interaction test**

Render the existing configurator props with `isConnected={false}`, then assert the exact CTA and invoke it:

```tsx
it('opens the wallet modal instead of offering Explore when disconnected', async () => {
  const user = userEvent.setup();
  render(<ExpeditionConfigurator {...props} isConnected={false} />);

  const connect = screen.getByRole('button', { name: 'Connect wallet' });
  expect(connect).toBeEnabled();
  expect(screen.queryByRole('button', { name: /^Explore 3/ })).not.toBeInTheDocument();

  await user.click(connect);
  expect(openConnectModal).toHaveBeenCalledOnce();
});
```

- [ ] **Step 3: Update the Play disconnected-account test**

Set `mocks.account.isConnected = false`, render `<Play />`, and assert `Connect wallet` is present while the `Explore 3` action and duplicate wallet purchase notice are absent. Click the CTA and assert the mocked modal opener was called.

- [ ] **Step 4: Run the focused tests and verify they fail for the missing behavior**

Run:

```text
pnpm exec vitest run src/components/explore/ExpeditionConfigurator.test.tsx src/pages/Play.test.tsx
```

Expected: the new disconnected CTA assertions fail because the current component still renders `Explore` and does not expose the modal opener.

### Task 2: Implement the disconnected Play CTA

**Files:**
- Modify: `src/components/explore/ExploreButton.tsx`
- Modify: `src/components/explore/ExpeditionConfigurator.tsx`
- Modify: `src/pages/Play.tsx`

**Interfaces:**
- Consumes: `isConnected` from wagmi in `Play`, `useConnectModal()` from RainbowKit, and the existing action/button props.
- Produces: `ExploreButton` with a `connectWallet?: boolean` mode and `ExpeditionConfigurator` with required `isConnected: boolean` input.

- [ ] **Step 1: Add the `connectWallet` action mode to `ExploreButton`**

Import `useConnectModal`, call it inside the component, and give the mode priority over the normal label:

```tsx
const { openConnectModal } = useConnectModal();

if (connectWallet) {
  return (
    <button
      type="button"
      onClick={() => openConnectModal?.()}
      disabled={openConnectModal === undefined}
      className="min-h-14 w-full rounded-[14px] bg-[var(--primary)] px-5 font-hud text-sm font-bold uppercase tracking-[0.02em] text-[var(--primary-foreground)] transition-[scale,background-color] duration-150 ease-out active:not-disabled:scale-[0.96] hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:bg-[var(--text-disabled)] disabled:text-[var(--surface)]"
    >
      Connect wallet
    </button>
  );
}
```

Add `connectWallet?: boolean` to the props. In this mode ignore checkout readiness disabled state; only disable while RainbowKit has not exposed its modal opener.

- [ ] **Step 2: Pass connection state through `ExpeditionConfigurator`**

Add `isConnected: boolean` to the prop type and set `connectWallet={!isConnected}` on the action. Pass the existing `checkoutDisabled` unchanged for the connected Explore path. Keep `ApprovalButton` around the action so its existing `amount === 0n` passthrough handles disconnected accounts without an allowance request.

- [ ] **Step 3: Prevent disconnected accounts from producing a non-zero approval amount in `Play`**

Include `isConnected` in both readiness expressions:

```tsx
const directReady = isConnected && !isBulk && bounds !== null && validStaticTickets && manualSelectionComplete && direct.isReady;
const bulkReady = isConnected && isBulk && meetsBulkMinimum && !bulk.hasActiveOrder && bulk.create.isReady;
```

Pass `isConnected={isConnected}` to `ExpeditionConfigurator`. Keep `checkoutDisabled`'s existing `!isConnected` guard; the new connect mode intentionally ignores that guard only for the wallet CTA.

- [ ] **Step 4: Run the focused tests and verify the new CTA behavior passes**

Run:

```text
pnpm exec vitest run src/components/explore/ExpeditionConfigurator.test.tsx src/pages/Play.test.tsx
```

Expected: all existing configurator and Play tests plus the new disconnected CTA tests pass.

### Task 3: Add failing exact-approval and allowance-refresh tests

**Files:**
- Modify: `src/components/common/ApprovalButton.test.tsx`

**Interfaces:**
- Consumes: the existing wagmi and `useUsdcAllowance` mocks.
- Produces: tests requiring exact `approve` arguments and proving a refreshed sufficient allowance renders the downstream action without another approval CTA.

- [ ] **Step 1: Replace the unlimited-approval expectation with an exact amount**

Remove the `maxUint256` import and assert the current amount:

```tsx
expect(state.writeContract).toHaveBeenCalledWith(expect.objectContaining({
  functionName: 'approve',
  args: [spender, 1_000_000n],
}));
```

- [ ] **Step 2: Add the refreshed-allowance regression test**

Start with a zero allowance and a successful approval receipt, render the wrapper, then update the mocked allowance to the approved amount and rerender with the same props. Assert that `refetch` was called once and the downstream action is rendered without `Approve USDC`:

```tsx
it('does not offer approval again after the refreshed allowance covers the amount', () => {
  state.allowance = 0n;
  state.txHash = `0x${'ef'.repeat(32)}`;
  state.receipt = { status: 'success' };

  const props = (
    <ApprovalButton spender={spender} amount={1_000_000n}>
      <button type="button">Explore</button>
    </ApprovalButton>
  );
  const { rerender } = render(props);

  expect(state.refetch).toHaveBeenCalledOnce();
  state.allowance = 1_000_000n;
  rerender(props);

  expect(screen.getByRole('button', { name: 'Explore' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve USDC' })).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the approval tests and verify the exact-amount assertion fails**

Run:

```text
pnpm exec vitest run src/components/common/ApprovalButton.test.tsx
```

Expected: the exact-amount assertion fails because the current implementation passes `maxUint256`; the sufficient-allowance test remains green.

### Task 4: Implement exact approval and preserve allowance gating

**Files:**
- Modify: `src/components/common/ApprovalButton.tsx`

**Interfaces:**
- Consumes: the existing `spender`, `amount`, `useUsdcAllowance`, receipt validation, and refetch flow.
- Produces: an approval write with `args: [spender, amount]` and the existing downstream passthrough when `allowance >= amount`.

- [ ] **Step 1: Update the approval documentation and imports**

Remove `maxUint256` from the viem import and change the component comment from unlimited/"approve once" behavior to exact-current-purchase behavior. Keep the route-specific spender contract intact.

- [ ] **Step 2: Submit the exact amount**

Change only the write arguments:

```tsx
args: [spender, amount],
```

Do not change the receipt success guard, `firedHashRef`, allowance loading/error states, or `needsApproval` comparison:

```tsx
const needsApproval = !!address && amount > 0n && allowance !== undefined && allowance < amount;
```

- [ ] **Step 3: Run the approval tests and verify the allowance regression passes**

Run:

```text
pnpm exec vitest run src/components/common/ApprovalButton.test.tsx
```

Expected: all approval tests pass, including exact amount, sufficient allowance passthrough, reverted receipt, and post-receipt refresh behavior.

### Task 5: Run repository verification and inspect the scoped diff

**Files:**
- Verify only: `src/components/explore/ExploreButton.tsx`, `src/components/explore/ExpeditionConfigurator.tsx`, `src/pages/Play.tsx`, `src/components/common/ApprovalButton.tsx`, `src/components/explore/ExpeditionConfigurator.test.tsx`, `src/pages/Play.test.tsx`, `src/components/common/ApprovalButton.test.tsx`

**Interfaces:**
- Consumes: the completed implementation and focused tests.
- Produces: local evidence for lint, typecheck, tests, build, database validation, and generator golden checks, with live wallet/RPC verification reported separately.

- [ ] **Step 1: Run the focused UI and approval test set**

Run:

```text
pnpm exec vitest run src/components/common/ApprovalButton.test.tsx src/components/explore/ExpeditionConfigurator.test.tsx src/pages/Play.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run the repository gate from the repository root**

Run each command separately:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```

Record any environment-blocked command separately; do not describe local success as live mainnet or browser verification.

- [ ] **Step 3: Review the scoped diff and whitespace**

Run:

```text
git diff --check
git diff -- src/components/explore/ExploreButton.tsx src/components/explore/ExpeditionConfigurator.tsx src/pages/Play.tsx src/components/common/ApprovalButton.tsx src/components/explore/ExpeditionConfigurator.test.tsx src/pages/Play.test.tsx src/components/common/ApprovalButton.test.tsx
```

Confirm that unrelated pre-existing working-tree modifications remain untouched and that no `maxUint256` approval call remains in the active Play checkout.

- [ ] **Step 4: Commit only the scoped implementation files**

```text
git add src/components/explore/ExploreButton.tsx src/components/explore/ExpeditionConfigurator.tsx src/pages/Play.tsx src/components/common/ApprovalButton.tsx src/components/explore/ExpeditionConfigurator.test.tsx src/pages/Play.test.tsx src/components/common/ApprovalButton.test.tsx
git commit -m "feat: add Play wallet CTA and exact approvals"
```
