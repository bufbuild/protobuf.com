import clsx from "clsx";
import React from "react";
import styles from "./maintained-by.module.css";
import BufLogo from "./buf.svg";

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
