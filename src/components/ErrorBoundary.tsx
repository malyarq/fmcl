import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    t?: (key: string) => string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    copied: boolean;
}

// App-level error boundary to surface fatal UI errors.
class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        copied: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, copied: false };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white p-8">
                    <div className="max-w-2xl w-full bg-white dark:bg-zinc-800 rounded-lg p-8 border border-zinc-200 dark:border-zinc-700">
                        <h1 className="text-3xl font-bold text-red-500 dark:text-red-400 mb-4">
                            {this.props.t?.('error.something_went_wrong') || 'Something Went Wrong'}
                        </h1>
                        <p className="text-zinc-600 dark:text-zinc-300 mb-6">
                            {this.props.t?.('error.unexpected_error') || 'The application encountered an unexpected error. Please try restarting the launcher.'}
                        </p>

                        <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded border border-zinc-200 dark:border-zinc-700 mb-6 overflow-auto max-h-64">
                            <pre className="text-sm text-red-600 dark:text-red-300 font-mono">
                                {this.state.error?.toString()}
                                {'\n\n'}
                                {this.state.error?.stack}
                            </pre>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded transition-colors"
                            >
                                {this.props.t?.('error.restart_launcher') || 'Restart Launcher'}
                            </button>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(
                                        `Error: ${this.state.error?.toString()}\n\nStack: ${this.state.error?.stack}`
                                    );
                                    this.setState({ copied: true });
                                    setTimeout(() => this.setState({ copied: false }), 2000);
                                }}
                                className="bg-zinc-200 hover:bg-zinc-300 text-zinc-900 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-white font-bold py-3 px-6 rounded transition-colors"
                            >
                                {this.state.copied 
                                    ? (this.props.t?.('error.copied') || 'Copied!')
                                    : (this.props.t?.('error.copy_error') || 'Copy Error')}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
