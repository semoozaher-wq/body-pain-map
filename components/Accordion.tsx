import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

type AccordionItemProps = { title: string; summary?: string; children: React.ReactNode; tone?: 'default' | 'danger' };

export function AccordionItem({ title, summary, children, tone = 'default' }: AccordionItemProps) {
  const [open, setOpen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: open ? 1 : 0, duration: 280, useNativeDriver: true }).start();
  }, [open, progress]);
  return (
    <View style={[styles.item, open && styles.openItem, tone === 'danger' && styles.dangerItem]}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.header} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[styles.arrow, open && styles.arrowOpen]}>{open ? '⌃' : '⌄'}</Text>
        <View style={styles.headerCopy}><Text style={[styles.title, tone === 'danger' && styles.dangerTitle]}>{title}</Text>{summary && !open ? <Text style={styles.summary}>{summary}</Text> : null}</View>
      </Pressable>
      {open ? <Animated.View style={[styles.content, { opacity: progress, transform: [{ scaleY: progress }] }]}>{children}</Animated.View> : null}
    </View>
  );
}

export function AccordionGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: { gap: 9 },
  item: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0EAED', borderRadius: 16, overflow: 'hidden' },
  openItem: { borderColor: '#B9E5DF', shadowColor: '#0E7C86', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  dangerItem: { borderColor: '#F0D5CF', backgroundColor: '#FFFDFC' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', minHeight: 62, paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  arrow: { color: '#0E7C86', fontSize: 24, fontWeight: '900', width: 24, textAlign: 'center' },
  arrowOpen: { color: '#0E5962' },
  headerCopy: { flex: 1 },
  title: { color: '#203745', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  dangerTitle: { color: '#A63B2F' },
  summary: { color: '#71808C', fontSize: 11, textAlign: 'right', marginTop: 3 },
  content: { paddingHorizontal: 16, paddingBottom: 16, transformOrigin: 'top' as any },
});
