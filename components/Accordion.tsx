// components/Accordion.tsx

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Spacing, BorderRadius, Shadows } from '../constants/spacing';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AccordionProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isWarning?: boolean;
}

export default function Accordion({ title, icon, children, defaultOpen = false, isWarning = false }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsOpen(!isOpen);
  };

  return (
    <View style={[styles.container, isOpen && Shadows.sm]}>
      <TouchableOpacity onPress={toggleOpen} activeOpacity={0.7} style={styles.header}>
        <View style={styles.headerLeft}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={[styles.title, isWarning && { color: Colors.danger }]}>{title}</Text>
        </View>
        <Text style={[styles.arrow, isOpen && styles.arrowOpen]}>▼</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 20,
    marginRight: Spacing.md,
  },
  title: {
    fontFamily: Fonts.arabic.bold,
    fontSize: Fonts.sizes.md,
    color: Colors.textPrimary,
  },
  arrow: {
    fontSize: 14,
    color: Colors.textSecondary,
    transform: [{ rotate: '0deg' }],
  },
  arrowOpen: {
    transform: [{ rotate: '180deg' }],
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.md,
  },
});
