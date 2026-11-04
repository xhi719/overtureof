'use client';
import { useLayoutEffect, useState } from 'react';
import styles from './OccupationDetail.module.css';

function formatProbability(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);
}

/** A visual reveal only: the accessible and final value is always the supplied probability. */
export function AnimatedProbability({ value, locale }: { value: number; locale: string }) {
  const [display, setDisplay] = useState(value);

  useLayoutEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let interval: ReturnType<typeof setInterval> | undefined;
    let finish: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (interval !== undefined) clearInterval(interval);
      if (finish !== undefined) clearTimeout(finish);
      interval = undefined;
      finish = undefined;
      setDisplay(value);
    };
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      if (event.matches) stop();
    };
    preference.addEventListener('change', onPreferenceChange);
    if (preference.matches) {
      setDisplay(value);
    } else {
      const roll = () => setDisplay(Math.floor(Math.random() * 1001) / 1000);
      roll();
      interval = setInterval(roll, 75);
      finish = setTimeout(stop, 1650);
    }
    return () => {
      if (interval !== undefined) clearInterval(interval);
      if (finish !== undefined) clearTimeout(finish);
      preference.removeEventListener('change', onPreferenceChange);
    };
  }, [value, locale]);

  return <strong className={styles.probabilityValue}><span className={styles.srOnly}>{formatProbability(value, locale)}</span><span className={styles.probabilityDigits} aria-hidden="true">{formatProbability(display, locale)}</span></strong>;
}
