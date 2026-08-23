import mineIcon from '@/assets/mine-icon.png';
import { PlanetIcon, TicketsIcon } from '@/components/icons/TicketsIcon';
import { PlanetGif } from '@/components/planets/PlanetGif';
import { useCurrentLeaderboard } from '@/hooks/useLeaderboard';
import { formatMinerals } from '@/lib/minerals';
import { useState } from 'react';
import { createRandomLandingPlanetPreviews } from './landingPlanetPreview';

const UPGRADE_STAGES = [
  {
    level: '1',
    bonus: '+10%',
    ornament: 'crystal',
  },
  {
    level: '2',
    bonus: '+25%',
    ornament: 'winged',
  },
  {
    level: '3',
    bonus: '+50%',
    ornament: 'crowned',
  },
] as const;

const UPGRADE_CRYSTAL_KEYS = ['primary', 'secondary', 'tertiary'] as const;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatScore(scoreMicros: string) {
  return formatMinerals(BigInt(scoreMicros));
}

export function LandingMiningLeaderboard() {
  const [upgradePlanets] = useState(() => createRandomLandingPlanetPreviews(UPGRADE_STAGES.length));
  const leaderboard = useCurrentLeaderboard(0, 5);
  const rows = leaderboard.data?.rows.slice(0, 5) ?? [];
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
          <span className="landing-mining-title-line landing-split-line-accent">Upgrade.</span>
          <span className="landing-mining-title-line landing-split-line-accent">Climb higher.</span>
        </h2>
        <p>
          Spend mined Minerals to upgrade production and climb the leaderboard.
        </p>
        <p className="landing-mining-upgrade-note">
          Each upgrade increases your Planet level and mining output.
        </p>
      </div>

      <div className="landing-mining-stage">
        <div className="landing-mining-upgrade-preview" data-testid="landing-upgrade-preview">
          <div className="landing-mining-upgrade-header">
            <span>PLANET UPGRADE PATH</span>
            <span>3 LEVELS</span>
          </div>

          <div className="landing-mining-upgrade-gallery">
            {UPGRADE_STAGES.map((stage, index) => {
              const preview = upgradePlanets[index];
              return (
              <figure
                className={`landing-mining-upgrade-stage landing-mining-upgrade-stage--${stage.ornament}`}
                data-testid="landing-upgrade-stage"
                data-level={stage.level}
                data-ornament={stage.ornament}
                data-planet-visual-seed={preview.visualTraitsHash}
                key={stage.level}
              >
                <span className="landing-mining-upgrade-ornament" aria-hidden="true">
                  {UPGRADE_CRYSTAL_KEYS.slice(0, Number(stage.level)).map((crystalKey) => (
                    <i key={crystalKey} />
                  ))}
                </span>
                <div className="landing-mining-upgrade-media">
                  <PlanetGif preview={preview} deferGeneration />
                </div>
                <figcaption>
                  <span>LEVEL {stage.level}</span>
                  <span>{stage.bonus}</span>
                </figcaption>
              </figure>
              );
            })}
          </div>

          <div className="landing-mining-upgrade-impact">
            <div className="landing-mining-upgrade-impact-header">
              <span>UPGRADE IMPACT</span>
              <span>MINING OUTPUT</span>
            </div>
            <ol>
              {UPGRADE_STAGES.map((stage) => (
                <li key={stage.level}>
                  <span>0{stage.level}</span>
                  <span
                    className="landing-mining-upgrade-impact-meter"
                    data-testid="landing-upgrade-impact-meter"
                    aria-hidden="true"
                  >
                    <i />
                  </span>
                  <strong>{stage.bonus}</strong>
                </li>
              ))}
            </ol>
          </div>

          <ol className="landing-mining-upgrade-track" aria-label="Planet upgrade levels">
            {UPGRADE_STAGES.map((stage) => (
              <li key={stage.level}>
                <span>{stage.level}</span>
              </li>
            ))}
          </ol>
          <div className="landing-mining-upgrade-footer">
            <img src={mineIcon} alt="" />
            <span>Mine Minerals to unlock the next level.</span>
          </div>
        </div>

        <div className="landing-mining-standings">
          <div className="landing-mining-standings-header">
            <span>LIVE STANDINGS</span>
            <span>{hasRows ? 'TOP 5' : 'LEADERBOARD'}</span>
          </div>
          <div className="landing-mining-active-players">
            <span>ACTIVE PLAYERS</span>
            <strong data-testid="landing-active-players">{leaderboard.data?.total ?? '-'}</strong>
          </div>

          {hasRows ? (
            <ol className="landing-mining-standings-list">
              {rows.map((row) => (
                <li key={row.walletAddress} data-rank={row.rank}>
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
                : leaderboard.error
                  ? 'Standings temporarily unavailable.'
                : 'Standings appear as Planets begin mining.'}
            </p>
          )}
          <div className="landing-mining-standings-footer">
            <div className="landing-mining-prizes">
              <span className="landing-mining-prizes-title">PRIZES</span>
              <span><TicketsIcon /> Megapot Tickets <small>(USDC)</small></span>
              <span><PlanetIcon /> 1/1 NFT Planets</span>
            </div>
            <a className="landing-button landing-button-small" href="/leaderboard">
              View leaderboard
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
