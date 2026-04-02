import { Component } from 'react';
import styles from './ErrorBoundary.module.css';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { title = 'Что-то пошло не так', minimal } = this.props;

    if (minimal) {
      return (
        <div className={styles.minimal}>
          <p className={styles.minimalText}>⚠️ Ошибка загрузки</p>
          <button className={styles.retryBtn} onClick={() => this.setState({ hasError: false, error: null })}>
            Попробовать снова
          </button>
        </div>
      );
    }

    return (
      <div className={styles.screen}>
        <div className={styles.icon}>😵</div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>
          Произошла неожиданная ошибка. Попробуй обновить приложение.
        </p>
        {this.state.error && (
          <p className={styles.errorDetail}>{this.state.error.message}</p>
        )}
        <button
          className={styles.reloadBtn}
          onClick={() => window.location.reload()}
        >
          🔄 Обновить приложение
        </button>
        <button
          className={styles.retryBtn}
          onClick={() => this.setState({ hasError: false, error: null })}
        >
          Попробовать снова
        </button>
      </div>
    );
  }
}
