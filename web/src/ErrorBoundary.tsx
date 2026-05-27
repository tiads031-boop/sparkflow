import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{
          padding: '24px',
          fontFamily: 'monospace',
          color: '#ff5555',
          background: '#1a1a1a',
          minHeight: '100vh',
          whiteSpace: 'pre-wrap',
          fontSize: '13px',
          lineHeight: 1.6,
        }}>
          <h1 style={{ color: '#ff8888', marginBottom: 16 }}>⚠️ Runtime Error</h1>
          <div style={{ color: '#ffdddd', fontWeight: 'bold', marginBottom: 12 }}>
            {this.state.error.name}: {this.state.error.message}
          </div>
          <details open style={{ marginTop: 16 }}>
            <summary style={{ color: '#888', cursor: 'pointer' }}>Stack trace</summary>
            <pre style={{ marginTop: 8, color: '#bbb' }}>{this.state.error.stack}</pre>
          </details>
          {this.state.errorInfo && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ color: '#888', cursor: 'pointer' }}>Component stack</summary>
              <pre style={{ marginTop: 8, color: '#bbb' }}>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
