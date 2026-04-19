import { Component, ErrorInfo, ReactNode } from 'react';
import { formatTechnicalErrorDetails } from '../utils/displayError';
import { FatalErrorView } from './error/FatalErrorView';

interface Props {
    children: ReactNode;
    t?: (key: string) => string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    technicalDetails: string | null;
}

// App-level error boundary to surface fatal UI errors.
class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        technicalDetails: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, technicalDetails: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({
            technicalDetails: buildTechnicalDetails(error, errorInfo)
        });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <FatalErrorView
                    error={this.state.error}
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
