import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './common/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an exception: ", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
          <div className="text-center max-w-md bg-slate-905 p-8 rounded-2xl border border-slate-800">
            <h1 className="text-3xl font-bold text-slate-100 mb-3">Something went wrong.</h1>
            <p className="text-slate-400 text-sm mb-6">An unexpected UI error has occurred. Try hard refreshing your page state.</p>
            <Button onClick={() => window.location.reload()} variant="primary">
              Reload Interface
            </Button>
          </div>
        </div>
      );
    }

    return this.children;
  }
}
