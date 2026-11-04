'use client';
import {usePathname} from 'next/navigation';
import styles from './FrontierWatermark.module.css';

/** Decorative brand image; the administrator area keeps its own layout. */
export function FrontierWatermark() {
 const pathname=usePathname();
 if (/^\/[^/]+\/admin(?:\/|$)/.test(pathname)) return null;
 return <img className={styles.mark} src="/images/frontier-era-logo.png" alt="" aria-hidden="true" width={1122} height={1402} decoding="async" onError={event => { event.currentTarget.hidden = true; }} />;
}
