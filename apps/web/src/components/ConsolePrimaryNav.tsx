import {
  FACTORY_NAV_INDEX,
  PRIMARY_NAV_ITEMS,
  PRIMARY_NAV_KEY_HINT,
  type PrimaryNavIndex,
} from "../app/constants";
import { isFactoryHostConnected } from "../runtime/factoryHost";

type ConsolePrimaryNavProps = {
  activePrimaryNav: PrimaryNavIndex;
  onPrimaryNavChange: (index: PrimaryNavIndex) => void;
};

export const ConsolePrimaryNav = ({
  activePrimaryNav,
  onPrimaryNavChange,
}: ConsolePrimaryNavProps) => (
  <nav className="console-primary-nav" aria-label="Primary navigation">
    <div className="console-primary-nav-tabs">
      {PRIMARY_NAV_ITEMS.filter(
        (item) => item.index !== FACTORY_NAV_INDEX || isFactoryHostConnected(),
      ).map((item) => (
        <button
          aria-current={item.index === activePrimaryNav ? "page" : undefined}
          className="console-primary-nav-tab"
          data-active={item.index === activePrimaryNav ? "true" : "false"}
          key={item.index}
          onClick={() => {
            onPrimaryNavChange(item.index);
          }}
          type="button"
        >
          [{item.index}] {item.label}
        </button>
      ))}
    </div>
    <p className="console-primary-nav-hint">Press {PRIMARY_NAV_KEY_HINT} to navigate</p>
  </nav>
);
