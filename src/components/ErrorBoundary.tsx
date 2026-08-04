import { Component, ErrorInfo, ReactNode } from 'react';
import { formatTechnicalErrorDetails } from '../utils/displayError';
import { FatalErrorView } from './error/FatalErrorView';

interface Props {
    children: ReactNode;
    t?: (key: string) => string;
    mode?: 'recover' | 'restart';
    onRecover?: () => Promise<void> | void;
    onRestart?: () => Promise<void> | void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    technicalDetails: string | null;
    actionPending: boolean;
    actionError: Error | null;
}

// App-level error boundary to surface fatal UI errors.
class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        technicalDetails: null,
        actionPending: false,
        actionError: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            technicalDetails: null,
            actionPending: false,
            actionError: null,
        };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({
            technicalDetails: buildTechnicalDetails(error, errorInfo)
        });
    }

    private handleAction = async () => {
        const mode = this.props.mode ?? 'recover';
        const action = mode === 'restart' ? this.props.onRestart : this.props.onRecover;
        if (!action || this.state.actionPending) return;

        this.setState({ actionPending: true, actionError: null });
        try {
            await action();
            if (mode === 'recover') {
                this.setState({
                    hasError: false,
                    error: null,
                    technicalDetails: null,
                    actionPending: false,
                    actionError: null,
                });
            } else {
                this.setState({ actionPending: false });
            }
        } catch (error) {
            const actionError = toError(error);
            this.setState((current) => ({
                actionPending: false,
                actionError,
                technicalDetails: [
                    current.technicalDetails,
                    `Recovery action failed:\n${formatTechnicalErrorDetails(actionError)}`,
                ].filter(Boolean).join('\n\n'),
            }));
        }
    };

    public render() {
        if (this.state.hasError) {
            const mode = this.props.mode ?? 'recover';
            const hasAction = mode === 'restart' ? Boolean(this.props.onRestart) : Boolean(this.props.onRecover);
            return (
                <FatalErrorView
                    actionError={this.state.actionError}
                    actionMode={hasAction ? mode : undefined}
                    actionPending={this.state.actionPending}
                    error={this.state.error}
                    onAction={hasAction ? () => { void this.handleAction(); } : undefined}
                    t={this.props.t}
                    technicalDetails={this.state.technicalDetails}
                />
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

function buildTechnicalDetails(error: Error, errorInfo: ErrorInfo) {
    const sections = [formatTechnicalErrorDetails(error)];
    const componentStack = errorInfo.componentStack?.trim();

    if (componentStack) {
        sections.push(`Component stack:\n${componentStack}`);
    }

    return sections.filter(Boolean).join('\n\n');
}

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error('Recovery action failed');
}
