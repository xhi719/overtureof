import styles from './DigitalNumber.module.css';

/** Decorative display only. Its caller supplies the accessible numeric text. */
export function DigitalNumber({ value }: { value: string }) {
  return <span className={styles.number} aria-hidden="true">{value}</span>;
}
