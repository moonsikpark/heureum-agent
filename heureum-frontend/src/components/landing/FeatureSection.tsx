import { useIntersectionObserver } from '../../lib/useIntersectionObserver';
import './FeatureSection.css';

interface FeatureSectionProps {
  id: string;
  title: string;
  titleAccent: string;
  description: string;
  index: number;
  children: React.ReactNode;
}

export default function FeatureSection({
  id,
  title,
  titleAccent,
  description,
  index,
  children,
}: FeatureSectionProps) {
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0.1 });

  return (
    <section
      id={id}
      ref={ref}
      className={`feature-section ${isVisible ? 'feature-visible' : ''} ${
        index % 2 === 1 ? 'feature-reversed' : ''
      }`}
    >
      <div className="feature-inner">
        <div className="feature-text" style={{ '--stagger': 0 } as React.CSSProperties}>
          <h2 className="feature-heading">
            {title}{' '}
            <span className="landing-gradient-text">{titleAccent}</span>
          </h2>
          <p className="feature-description">{description}</p>
        </div>
        <div className="feature-mockup" style={{ '--stagger': 1 } as React.CSSProperties}>
          {children}
        </div>
      </div>
    </section>
  );
}
