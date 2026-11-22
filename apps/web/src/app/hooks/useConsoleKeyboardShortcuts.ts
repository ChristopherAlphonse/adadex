import { useEffect } from "react";

import { isFactoryHostConnected } from "../../runtime/factoryHost";
import { FACTORY_NAV_INDEX, type PrimaryNavIndex } from "../constants";
import { isEditableEventTarget, parsePrimaryNavKey } from "../hotkeys";

type UseConsoleKeyboardShortcutsOptions = {
  setActivePrimaryNav: (index: PrimaryNavIndex) => void;
};

export const useConsoleKeyboardShortcuts = ({
  setActivePrimaryNav,
}: UseConsoleKeyboardShortcutsOptions) => {
  useEffect(() => {
    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      const nextPrimaryNav = parsePrimaryNavKey(event.key);

      if (nextPrimaryNav === FACTORY_NAV_INDEX && !isFactoryHostConnected()) {
        return;
      }

      if (nextPrimaryNav !== null) {
        setActivePrimaryNav(nextPrimaryNav);
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [setActivePrimaryNav]);
};
