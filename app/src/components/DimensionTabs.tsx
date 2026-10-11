import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GroupDimension } from '../features/knowledge/group';
import { colors, radius, spacing, type } from '../lib/theme';
import { tapFeedback } from '../lib/haptics';

const DIMS: { key: GroupDimension; label: string }[] = [
  { key: 'theme', label: '主题' },
  { key: 'level', label: '等级' },
  { key: 'pos', label: '词性' },
  { key: 'mastery', label: '掌握度' },
];

export default function DimensionTabs({
  value,
  onChange,
}: {
  value: GroupDimension;
  onChange: (d: GroupDimension) => void;
}) {
  return (
    <View style={styles.row}>
      {DIMS.map((d) => (
        <Pressable
          key={d.key}
          style={[styles.chip, value === d.key && styles.active]}
          onPress={() => {
            tapFeedback();
            onChange(d.key);
          }}
        >
          <Text style={value === d.key ? styles.textActive : styles.text}>{d.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.bg,
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { ...type.label, color: colors.primaryDeep },
  textActive: { ...type.label, color: colors.textOnPrimary },
});

