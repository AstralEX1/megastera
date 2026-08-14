import mineIcon from '@/assets/mine-icon.png';
import { useCurrentLeaderboard } from '@/hooks/useLeaderboard';
import { formatMinerals } from '@/lib/minerals';

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatScore(scoreMicros: string) {
  return formatMinerals(BigInt(scoreMicros));
}

export function LandingMiningLeaderboard() {
  const leaderboard = useCurrentLeaderboard(0, 3);
  const rows = leaderboard.data?.rows.slice(0, 3) ?? [];
  const hasRows = !leaderboard.isLoading && !leaderboard.error && rows.length > 0;

  return (
    <section
      className="landing-section landing-container landing-mining-leaderboard"
      aria-label="Mining and leaderboard"
      aria-labelledby="landing-mining-title"
    >
      <div className="landing-mining-copy">
        <span className="landing-kicker">MINING / LEADERBOARD</span>
        <h2 id="landing-mining-title">
          <span className="landing-mining-title-line">Keep mining.</span>
          <span className="landing-mining-title-line landing-split-line-accent">Climb higher.</span>
        </h2>
        <p>
          Once generated, your Planet keeps mining minerals and competing for leaderboard rewards.
        </p>
        <p className="landing-mining-bonus-note">
          Same type bonus: collect 3, 5, or 10 Planets of one type to boost mining by +5%, +7.5%, or +10%.
        </p>
        <a className="landing-button landing-button-small landing-mining-cta" href="/leaderboard">
          View leaderboard
        </a>
      </div>

      <div className="landing-mining-stage">
        <div className="landing-mining-planet">
          <img
            src="/artifacts/megastera-generated/planet-05.gif"
            alt="Generated Planet preview"
            loading="lazy"
          />
          <div className="landing-mining-planet-label">
            <img src={mineIcon} alt="" />
            <span>PLANET / MINING</span>
          </div>
        </div>

        <div className="landing-mining-standings">
          <div className="landing-mining-standings-header">
            <span>LIVE STANDINGS</span>
            <span>{hasRows ? 'TOP 3' : 'LEADERBOARD'}</span>
          </div>

          {hasRows ? (
            <ol className="landing-mining-standings-list">
              {rows.map((row) => (
                <li key={row.walletAddress}>
                  <span className="landing-mining-rank">#{row.rank}</span>
                  <span className="landing-mining-wallet">{shortAddress(row.walletAddress)}</span>
                  <strong>{formatScore(row.scoreMicros)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="landing-mining-standings-empty">
              {leaderboard.isLoading
                ? 'Syncing standings.'
                : 'Standings appear as Planets begin mining.'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
