import { useEffect } from "react";
export const useInitialColumnsHydration = ({ readColumns, readUiState, applyHydratedUiState, setColumns, setLoadError, setIsLoading, setIsUiStateHydrated, }) => {
    useEffect(() => {
        const controller = new AbortController();
        const syncColumns = async () => {
            try {
                setLoadError(null);
                const [nextColumns, nextUiState] = await Promise.all([
                    readColumns(controller.signal),
                    readUiState(controller.signal),
                ]);
                setColumns(nextColumns);
                applyHydratedUiState(nextUiState, nextColumns);
            }
            catch (error) {
                if (error.name !== "AbortError") {
                    setColumns([]);
                    setLoadError("Agent data is currently unavailable.");
                }
            }
            finally {
                setIsLoading(false);
                setIsUiStateHydrated(true);
            }
        };
        void syncColumns();
        return () => {
            controller.abort();
        };
    }, [
        applyHydratedUiState,
        readColumns,
        readUiState,
        setColumns,
        setIsLoading,
        setIsUiStateHydrated,
        setLoadError,
    ]);
};
