import { useEffect } from 'react';
import { Atmosphere } from './Atmosphere';
import { Book } from './Book';
import { Dust } from './Dust';
import { HalftoneBackdrop } from './HalftoneBackdrop';

interface ExperienceProps {
  onReady: () => void;
}

export function Experience({ onReady }: ExperienceProps) {
  useEffect(() => {
    const timer = window.setTimeout(onReady, 80);
    return () => window.clearTimeout(timer);
  }, [onReady]);

  return (
    <>
      <color attach="background" args={['#080605']} />
      <HalftoneBackdrop />
      <Atmosphere />
      <Book />
      <Dust />
    </>
  );
}
