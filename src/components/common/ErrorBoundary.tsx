import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Language } from '../../types';
import { getTranslation } from '../../i18n';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  lang?: Language;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('BioAI.Lab ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-3xl space-y-4 my-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-6 h-6 shrink-0 text-rose-600 dark:text-rose-400" />
            <h3 className="text-base font-extrabold">
              {this.props.fallbackTitle || 'Tool Execution Error'}
            </h3>
          </div>
          <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed font-medium">
            An unexpected error occurred while executing this component. The rest of the application remains functional.
          </p>
          {this.state.error?.message && (
            <div className="p-3 bg-white/80 dark:bg-slate-900 border border-rose-200 dark:border-rose-900 rounded-xl font-mono text-[11px] text-rose-900 dark:text-rose-200 break-all">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReset}
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {getTranslation(this.props.lang || 'en', 'retryComponent')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
