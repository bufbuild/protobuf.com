import clsx from "clsx";
import BufLogo from "./buf.svg";
import styles from "./maintained-by.module.css";

export const MaintainedBy = ({ className }: { className?: string }) => {
  return (
    <div className={clsx(styles.createdByWrapper, className)}>
      <a href="https://buf.build" className={clsx(styles.bufButton)}>
        <span>Maintained by</span>
        <div className={styles.bufLogo}>
          <BufLogo />
        </div>
      </a>
    </div>
  );
};
