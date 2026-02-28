// client/src/components/ErrorBoundary.jsx
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Send to error reporting service (e.g., Sentry) if available
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { contexts: { react: errorInfo } });
    // }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <h1 className="text-2xl md:text-3xl font-bold text-red-400 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-400 mb-6">
              An unexpected error occurred. Please try reloading the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-blue-400 to-blue-500 text-[#1a1a1a] font-semibold rounded-lg hover:from-blue-300 hover:to-blue-400 transition-all shadow-lg shadow-blue-500/20"
            >
              Reload Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="text-xs text-red-300 bg-black/50 p-4 rounded overflow-auto max-h-64">
                  {this.state.error.toString()}
                  {this.state.error.stack && `\n\n${this.state.error.stack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
