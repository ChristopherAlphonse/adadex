import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[adadex] UI crashed", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          className="design-console flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-foreground"
          role="alert"
        >
          <h1 className="text-lg font-semibold">Adadex UI failed to load</h1>
          <p className="max-w-lg text-center text-sm text-muted-foreground">
            {this.state.error.message}
          </p>
          <button
            type="button"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
