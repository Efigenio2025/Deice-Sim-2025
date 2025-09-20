// pages/_app.js
import '../styles/globals.css';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function generateFlakes(count) {
  return Array.from({ length: count }, (_, index) => {
    const depth = Math.random();
    const scale = (0.6 + depth * 1.1).toFixed(2);
    const opacity = (0.25 + (1 - depth) * 0.65).toFixed(2);

    return {
      id: index,
      left: `${(Math.random() * 100).toFixed(2)}vw`,
      duration: `${(14 + Math.random() * 12).toFixed(2)}s`,
      delay: `${(-Math.random() * 24).toFixed(2)}s`,
      scale,
      drift: `${(Math.random() * 40 - 20).toFixed(2)}vw`,
      opacity,
      blur: Math.random() < 0.35 ? `${(Math.random() * 1.5).toFixed(2)}px` : '0px',
    };
  });
}

function Snowfall() {
  const [mountNode, setMountNode] = useState(null);
  const [flakes, setFlakes] = useState([]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const container = document.createElement('div');
    container.className = 'pm-snowField';
    document.body.appendChild(container);
    setMountNode(container);

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const desiredCount = () => {
      if (mediaQuery.matches) {
        return 0;
      }
      const width = window.innerWidth;
      if (width >= 1440) return 240;
      if (width >= 1024) return 200;
      if (width >= 720) return 160;
      return 120;
    };

    const refreshFlakes = () => {
      const count = desiredCount();
      setFlakes(count > 0 ? generateFlakes(count) : []);
    };

    refreshFlakes();

    let resizeTimeout = null;
    const handleResize = () => {
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        refreshFlakes();
      }, 160);
    };

    window.addEventListener('resize', handleResize);

    const handleMotionPreference = () => {
      refreshFlakes();
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMotionPreference);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleMotionPreference);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout);
      }
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleMotionPreference);
      } else if (typeof mediaQuery.removeListener === 'function') {
        mediaQuery.removeListener(handleMotionPreference);
      }
      document.body.removeChild(container);
    };
  }, []);

  if (!mountNode) {
    return null;
  }

  return createPortal(
    <>
      {flakes.map((flake) => (
        <span
          key={flake.id}
          className="pm-snowflake"
          style={{
            left: flake.left,
            '--pm-snow-duration': flake.duration,
            '--pm-snow-delay': flake.delay,
            '--pm-snow-scale': flake.scale,
            '--pm-snow-drift': flake.drift,
            '--pm-snow-opacity': flake.opacity,
            '--pm-snow-blur': flake.blur,
          }}
        />
      ))}
    </>,
    mountNode
  );
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.add('piedmont');
    return () => {
      document.body.classList.remove('piedmont');
    };
  }, []);

  return (
    <>
      <Snowfall />
      <Component {...pageProps} />
    </>
  );
}
