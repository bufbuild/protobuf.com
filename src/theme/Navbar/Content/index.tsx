import {
  splitNavbarItems,
  useNavbarMobileSidebar,
  useThemeConfig,
} from "@docusaurus/theme-common/internal";
import NavbarColorModeToggle from "@theme/Navbar/ColorModeToggle";
import NavbarLogo from "@theme/Navbar/Logo";
import NavbarMobileSidebarToggle from "@theme/Navbar/MobileSidebar/Toggle";
import NavbarSearch from "@theme/Navbar/Search";
import type { Props as NavbarItemConfig } from "@theme/NavbarItem";
import NavbarItem from "@theme/NavbarItem";
import SearchBar from "@theme/SearchBar";
import clsx from "clsx";
import type { JSX, ReactNode } from "react";
import { MaintainedBy } from "../../components/maintained-by";
import styles from "./styles.module.css";

function useNavbarItems() {
  // TODO temporary casting until ThemeConfig type is improved
  return useThemeConfig().navbar.items as NavbarItemConfig[];
}

function NavbarItems({ items }: { items: NavbarItemConfig[] }): JSX.Element {
  const mobileSidebar = useNavbarMobileSidebar();
  // biome-ignore lint/suspicious/noArrayIndexKey: static navbar items
  const renderedItems = items.map((item, i) => <NavbarItem {...item} key={i} />);
  if (mobileSidebar.shouldRender) {
    return <>{renderedItems}</>;
  }
  return <div className={styles.linkList}>{renderedItems}</div>;
}

function NavbarContentLayout({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className={clsx("navbar__inner", styles.inner)}>
      <div className="navbar__items">{left}</div>
      <div className="navbar__items navbar__items--right">{right}</div>
    </div>
  );
}

export default function NavbarContent() {
  const mobileSidebar = useNavbarMobileSidebar();
  const items = useNavbarItems();
  const [leftItems, rightItems] = splitNavbarItems(items);
  const autoAddSearchBar = !items.some((item) => item.type === "search");
  return (
    <NavbarContentLayout
      left={
        // TODO stop hardcoding items?
        <>
          {!mobileSidebar.disabled && <NavbarMobileSidebarToggle />}
          <NavbarLogo />
          <NavbarItems items={leftItems} />
          <div className={styles.rightWrapper}>
            <NavbarColorModeToggle className={styles.colorModeToggle} />
            {autoAddSearchBar && (
              <NavbarSearch>
                <SearchBar />
              </NavbarSearch>
            )}
            <MaintainedBy className="desktop-only" />
          </div>
        </>
      }
      right={<NavbarItems items={rightItems} />}
    />
  );
}
