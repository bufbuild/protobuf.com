import React from "react";
import NavbarItem from "@theme/NavbarItem";
import NavbarColorModeToggle from "@theme/Navbar/ColorModeToggle";
import SearchBar from "@theme/SearchBar";
import {
  splitNavbarItems,
  useNavbarMobileSidebar,
  useThemeConfig
} from "@docusaurus/theme-common/internal";
import NavbarMobileSidebarToggle from "@theme/Navbar/MobileSidebar/Toggle";
import NavbarLogo from "@theme/Navbar/Logo";
import NavbarSearch from "@theme/Navbar/Search";
import clsx from "clsx";
import styles from "./styles.module.css";
import { MaintainedBy } from "../../components/maintained-by";
import type { Props as NavbarItemConfig } from "@theme/NavbarItem";

function useNavbarItems() {
  // TODO temporary casting until ThemeConfig type is improved
  return useThemeConfig().navbar.items as NavbarItemConfig[];
}

function NavbarItems({ items }: { items: NavbarItemConfig[] }): JSX.Element {
  const mobileSidebar = useNavbarMobileSidebar();
  const renderedItems = items.map((item, i) => <NavbarItem {...item} key={i} />);
  if (mobileSidebar.shouldRender) {
    return <>{renderedItems}</>;
  }
  return <div className={styles.linkList}>{renderedItems}</div>;
}

function NavbarContentLayout({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
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
          <MaintainedBy className="desktop-only" />
        </>
      }
      right={
        // TODO stop hardcoding items?
        // Ask the user to add the respective navbar items => more flexible
        <>
          <NavbarItems items={rightItems} />
          <NavbarColorModeToggle className={styles.colorModeToggle} />
          {autoAddSearchBar && (
            <NavbarSearch>
              <SearchBar />
            </NavbarSearch>
          )}
        </>
      }
    />
  );
}
