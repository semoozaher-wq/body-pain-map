import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

/**
 * Prevents an uncaught render error from turning the whole app into a blank
 * screen. Keep this component dependency-free so it works in Expo Go and web.
 */
export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'حدث خطأ غير متوقع داخل التطبيق.';

    return {
      hasError: true,
      message,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Keep the original error available in Metro/production logs.
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>حصل خطأ في التطبيق</Text>
        <Text style={styles.message}>
          التطبيق منع الشاشة البيضاء. جرّب إعادة فتح الشاشة مرة تانية.
        </Text>
        {this.state.message ? (
          <Text selectable style={styles.error}>
            {this.state.message}
          </Text>
        ) : null}
        <Button title="إعادة المحاولة" onPress={this.handleReload} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    marginBottom: 12,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    marginBottom: 16,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  error: {
    marginBottom: 20,
    maxWidth: 600,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
