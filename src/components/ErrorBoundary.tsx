import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('DevBoard failed to render:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="fatal-error-page" role="alert">
          <div>
            <span className="eyebrow">APPLICATION ERROR</span>
            <h1>DevBoard could not load.</h1>
            <p>Something went wrong while rendering this page. Reload to try again.</p>
            <button type="button" onClick={() => window.location.reload()}>
              Reload application
            </button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
