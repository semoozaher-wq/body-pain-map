import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[BodyMap Pain] runtime render error', error, info.componentStack);
  }

  private recover = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || 'حدث خطأ غير متوقع.';
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>حصل خطأ أثناء تشغيل التطبيق</Text>
          <Text style={styles.body}>التطبيق ما انهارش بصمت. جرّب إعادة فتحه، ولو الخطأ اتكرر ابعت رسالة الخطأ الظاهرة تحت.</Text>
          <Text selectable style={styles.error}>{message}</Text>
          <Pressable accessibilityRole="button" onPress={this.recover} style={styles.button}>
            <Text style={styles.buttonText}>إعادة فتح التطبيق</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#F5FAFA' },
  card: { width: '100%', maxWidth: 620, borderRadius: 20, padding: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9E7E6', gap: 12 },
  title: { fontSize: 20, fontWeight: '900', color: '#143A40', textAlign: 'right' },
  body: { fontSize: 14, lineHeight: 22, color: '#52676A', textAlign: 'right' },
  error: { fontSize: 12, lineHeight: 18, color: '#8A3737', backgroundColor: '#FFF3F1', borderRadius: 10, padding: 10, textAlign: 'left' },
  button: { minHeight: 46, borderRadius: 12, backgroundColor: '#0B7774', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
