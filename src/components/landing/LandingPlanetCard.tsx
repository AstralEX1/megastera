import mineralIcon from '@/assets/mineral-icon.png';

type LandingPlanetRarity = 'Common' | 'Uncommon' | 'Epic' | 'Legendary';

type LandingPlanetCardProps = {
  image: string;
  name: string;
  type: string;
  rarity: LandingPlanetRarity;
  ticketId: string;
  rate: string;
  active: boolean;
};

export function LandingPlanetCard({
  image,
  name,
  type,
  rarity,
  ticketId,
  rate,
  active,
}: LandingPlanetCardProps) {
  return (
    <article
      className={`landing-planet-card landing-planet-card--${rarity.toLowerCase()}`}
      data-rarity={rarity}
      data-active={active}
      aria-hidden={!active}
    >
      <div className="landing-planet-card-media">
        <img src={image} alt={`${name} Planet preview`} loading="lazy" />
        <span className="landing-planet-card-type">{type}</span>
      </div>
      <div className="landing-planet-card-body">
        <div className="landing-planet-card-heading">
          <h3>{name}</h3>
          <span>{rarity}</span>
        </div>
        <div className="landing-planet-card-metrics">
          <span>
            <img src={mineralIcon} alt="Minerals" />
            {rate} / day
          </span>
          <span>Ticket #{ticketId}</span>
        </div>
      </div>
    </article>
  );
}
