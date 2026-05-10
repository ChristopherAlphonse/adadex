import { useEffect } from "react";
import { isEditableEventTarget, parsePrimaryNavKey } from "../hotkeys";
export const useConsoleKeyboardShortcuts = ({ setActivePrimaryNav, }) => {
    useEffect(() => {
        const handleWindowKeyDown = (event) => {
            if (isEditableEventTarget(event.target)) {
                return;
            }
            const nextPrimaryNav = parsePrimaryNavKey(event.key);
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
