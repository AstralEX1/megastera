import './Landing.css';
import { useEffect } from 'react';
import { COPY } from '@/config/copy';
import { LandingLiveJackpot } from '@/components/landing/LandingLiveJackpot';
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks';
import { LandingMiningLeaderboard } from '@/components/landing/LandingMiningLeaderboard';
import { LandingPlanetCard } from '@/components/landing/LandingPlanetCard';
import { LandingSplitText } from '@/components/landing/LandingSplitText';
import { PlanetGeneratorHero } from '@/components/landing/PlanetGeneratorHero';

const generatedPlanetAssets = [
  { image: '/artifacts/megastera-generated/planet-01.gif', name: 'Draheunia', rarity: 'Common', ticketId: '5001', minerals: 25, numbers: [7, 14, 18, 23, 29], bonus: 3 },
  { image: '/artifacts/megastera-generated/planet-05.gif', name: 'Wheuagawa III', rarity: 'Uncommon', ticketId: '5005', minerals: 75, numbers: [4, 11, 19, 27, 36], bonus: 8 },
  { image: '/artifacts/megastera-generated/planet-09.gif', name: 'Auclagua-94', rarity: 'Common', ticketId: '5009', minerals: 10, numbers: [2, 13, 21, 30, 37], bonus: 6 },
] as const;

export function Landing() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Megastera';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="landing" data-testid="megastera-landing">
      <a className="landing-skip-link" href="#landing-main">Skip to content</a>
      <header className="landing-header">
        <a className="landing-wordmark" href="/" aria-label="Megastera home">
          <LandingSplitText text={COPY.brandName} className="landing-wordmark-name" />
        </a>
        <a className="landing-button landing-button-small" href="/play">
          <LandingSplitText text="Play" className="landing-button-label" />
        </a>
      </header>

      <main id="landing-main">
        <section className="landing-hero landing-container" aria-labelledby="hero-title">
          <div className="landing-hero-copy">
            <h1 id="hero-title" className="landing-hero-title">
              <LandingSplitText
                tag="span"
                className="landing-split-line"
                text="Explore. Mine."
                delay={34}
                duration={0.78}
                splitType="chars"
                from={{ opacity: 0, y: 48, rotateX: -70 }}
                to={{ opacity: 1, y: 0, rotateX: 0 }}
              />
              <LandingSplitText
                tag="span"
                className="landing-split-line landing-split-line-accent"
                text="Win."
                delay={46}
                duration={0.86}
                from={{ opacity: 0, y: 52, rotateX: -70, filter: 'blur(8px)' }}
                to={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
                splitType="chars"
              />
            </h1>
            <LandingSplitText
              tag="p"
              className="landing-hero-subtitle"
              text="Every ticket becomes a Planet and enters the draw."
              splitType="lines"
              delay={72}
              duration={0.8}
            />
            <div className="landing-hero-actions">
              <a className="landing-button landing-button-primary" href="/play">
                <LandingSplitText text="Play" className="landing-button-label" />
              </a>
            </div>
          </div>

          <div className="landing-hero-visual">
            <PlanetGeneratorHero />
          </div>

          <div className="landing-hero-live">
            <LandingLiveJackpot />
          </div>
        </section>

        <section className="landing-section landing-container landing-mechanics" aria-labelledby="mechanics-title" aria-label="Two mechanics: Megapot Ticket and Planet">
          <div className="landing-mechanics-heading">
            <div>
              <LandingSplitText tag="span" className="landing-kicker" text="Two mechanics" />
              <h2 id="mechanics-title">
                <LandingSplitText tag="span" className="landing-mechanics-title-line" text="One ticket." />
                <LandingSplitText
                  tag="span"
                  className="landing-mechanics-title-line landing-split-line-accent"
                  text="One Planet."
                  delay={48}
                  duration={0.82}
                />
              </h2>
            </div>
            <LandingSplitText
              tag="p"
              className="landing-mechanics-intro"
              text="One Megapot Ticket creates one traceable Planet. The two stay linked from the draw to the leaderboard."
              splitType="lines"
              delay={74}
              duration={0.82}
            />
          </div>

          <div className="landing-mechanics-grid">
            <article className="landing-mechanic landing-ticket-mechanic">
              <div className="landing-ticket-visual">
                <div className="landing-ticket-visual-stack">
                  {generatedPlanetAssets.map((ticket) => (
                    <div
                      className="landing-megapot-ticket"
                      data-ticket-id={ticket.ticketId}
                      key={ticket.ticketId}
                      role="img"
                      aria-label={`Megapot Ticket ${ticket.ticketId} preview with five numbers and one bonus ball`}
                    >
                      <div className="landing-megapot-ticket-head">
                        <LandingSplitText tag="span" className="landing-ticket-visual-top" text="MEGAPOT / DAILY DRAW" delay={24} />
                        <LandingSplitText tag="span" className="landing-megapot-ticket-price" text="$1 USDC" delay={28} />
                      </div>
                      <LandingSplitText tag="strong" className="landing-ticket-visual-title" text="TICKET" splitType="chars" delay={42} />
                      <div className="landing-ticket-balls" aria-hidden="true">
                        {ticket.numbers.map((number) => <span className="landing-ticket-ball" key={number}>{number}</span>)}
                        <span className="landing-ticket-ball landing-ticket-ball-bonus">{ticket.bonus}</span>
                      </div>
                      <div className="landing-megapot-ticket-foot">
                        <LandingSplitText tag="span" className="landing-ticket-visual-bottom" text="5 NUMBERS + BONUS" delay={24} />
                        <LandingSplitText tag="span" className="landing-megapot-ticket-id" text={`TICKET / ${ticket.ticketId}`} delay={28} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <h3><LandingSplitText tag="span" text="Megapot Tickets" /></h3>
              <LandingSplitText
                tag="p"
                text="Each ticket enters the Megapot draw and can win the jackpot."
                splitType="lines"
                delay={66}
                duration={0.78}
              />
            </article>

            <article className="landing-mechanic landing-planet-mechanic">
              <div className="landing-mechanic-planet-stack">
                {generatedPlanetAssets.map((planet) => (
                  <LandingPlanetCard
                    key={planet.ticketId}
                    image={planet.image}
                    name={planet.name}
                    rarity={planet.rarity}
                    ticketId={planet.ticketId}
                    minerals={planet.minerals}
                  />
                ))}
              </div>
              <h3><LandingSplitText tag="span" text="Planets" /></h3>
              <LandingSplitText
                tag="span"
                className="landing-planet-coordinates-kicker"
                text="Generated from your ticket numbers"
                delay={48}
                duration={0.72}
              />
              <LandingSplitText
                tag="p"
                className="landing-planet-coordinates-copy"
                text="Your ticket numbers become the coordinates that generate your Planet. Every Planet is unique and keeps mining minerals after the draw."
                splitType="lines"
                delay={66}
                duration={0.82}
              />
              <a className="landing-button landing-button-small landing-planet-cta" href="/play">
                <LandingSplitText text="Play" className="landing-button-label" />
              </a>
            </article>
          </div>
        </section>

        <LandingMiningLeaderboard />
        <LandingHowItWorks />
      </main>

      <footer className="landing-footer landing-container">
        <a className="landing-wordmark" href="/" aria-label="Megastera home">
          <LandingSplitText text={COPY.brandName} className="landing-wordmark-name" />
        </a>
        <LandingSplitText tag="span" className="landing-footer-tagline" text="Explore Planets. Win prizes." />
        <LandingSplitText
          tag="span"
          className="landing-footer-meta"
          text="Ticket → Planet → Rewards"
        />
      </footer>
    </div>
  );
}
