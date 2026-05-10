import { useEffect } from "react";
export const useClickOutside = (ref, isActive, onDismiss) => {
    useEffect(() => {
        if (!isActive)
            return;
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                onDismiss();
            }
        };
        const handleEscape = (event) => {
            if (event.key === "Escape") {
                onDismiss();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [ref, isActive, onDismiss]);
};
