import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppColors } from '@/constants/AppColors';
import { Fonts } from '@/constants/Fonts';

interface CustomHeaderProps {
  title: string;
  /** When true, use minimal top padding (for use inside SafeAreaView with edges excluding top) */
  compact?: boolean;
}

export function CustomHeader({ title, compact }: CustomHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingTop: compact ? 8 : insets.top }]}>
      <View style={styles.inner}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: AppColors.background.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: AppColors.text.secondary,
  },
  inner: {
    paddingHorizontal: 25,
    paddingVertical: 4,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    fontSize: 25,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.link,
  },
});
