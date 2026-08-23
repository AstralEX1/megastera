import { formatUnits } from 'viem';
import { DepthText } from '@/components/common/DepthText';
import { Countdown } from '@/components/lottery/Countdown';
import { useJackpotState } from '@/hooks/useJackpotState';
import { LandingSplitText } from './LandingSplitText';

function formatJackpot(amount: bigint | undefined) {
  if (amount === undefined) return '$-';
  return `$${Number(formatUnits(amount, 6)).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;
}

export function LandingLiveJackpot() {
  const { state, phase } = useJackpotState();
  const drawingLabel = phase === 'open' ? 'DRAWING IN' : 'DRAWING LIVE';

  return (
    <aside className="landing-live-jackpot" aria-label="Live jackpot and drawing countdown">
      <div className="landing-live-jackpot-layout" data-testid="landing-jackpot-layout">
        <div className="landing-live-jackpot-main">
          <div className="landing-live-jackpot-header">
            <LandingSplitText tag="span" className="landing-kicker" text="LIVE JACKPOT" />
            <div
              className="landing-live-jackpot-drawing-panel"
              data-testid="landing-drawing-in"
            >
              <div className="landing-live-jackpot-countdown-line">
                <LandingSplitText
                  tag="span"
                  className="landing-micro-label"
                  text={drawingLabel}
                  delay={30}
                  duration={0.58}
                />
                <Countdown drawingTimeUnix={state?.drawingTime} />
              </div>
            </div>
          </div>
          <div className="landing-live-jackpot-echo" data-testid="landing-jackpot-echo">
            <DepthText
              text={formatJackpot(state?.prizePool)}
              faceColor="var(--landing-dust)"
              depthColor="var(--landing-mineral)"
              layers={64}
              depth={2.35}
              tilt={8}
              smoothing={0.24}
              perspective={1_800}
              orbitSpeed={0.06}
              pointerTracking
              autoOrbit
              fontSize="clamp(3.25rem, 9.2vw, 8.2rem)"
              fontWeight={1_000}
              shadow
              className="landing-live-jackpot-depth"
            />
          </div>
          <a
            className="landing-powered-by landing-live-jackpot-powered-by"
            href="https://megapot.io/ecosystem"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Powered by Megapot"
          >
            <img
              src="/brand/powered-by-megapot.svg"
              alt=""
              width="150"
              height="34"
              draggable="false"
            />
          </a>
        </div>
      </div>
    </aside>
  );
}
