import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import type { FrontendUiStateSnapshot, TerminalView } from "../types";

type UseInitialColumnsHydrationOptions = {
  readColumns: (signal?: AbortSignal) => Promise<TerminalView>;
  readUiState: (signal?: AbortSignal) => Promise<FrontendUiStateSnapshot | null>;
  applyHydratedUiState: (
    snapshot: FrontendUiStateSnapshot | null,
    nextColumns: TerminalView,
  ) => void;
  setColumns: Dispatch<SetStateAction<TerminalView>>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setIsUiStateHydrated: Dispatch<SetStateAction<boolean>>;
};

export const useInitialColumnsHydration = ({
  readColumns,
  readUiState,
  applyHydratedUiState,
  setColumns,
  setLoadError,
  setIsLoading,
  setIsUiStateHydrated,
}: UseInitialColumnsHydrationOptions) => {
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
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setColumns([]);
          setLoadError("Agent data is currently unavailable.");
        }
      } finally {
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
