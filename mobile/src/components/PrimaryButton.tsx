import { Pressable, Text, StyleSheet, type GestureResponderEvent } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export function PrimaryButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: (e: GestureResponderEvent) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  disabled: { opacity: 0.5 },
  label: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
