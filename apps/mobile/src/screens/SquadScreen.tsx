/**
 * Команда. docs/SPEC.md §6.14 — табы «Сегодня» и «Лидерборд».
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Avatar, Card, Pill } from '../components/primitives';
import { colors, fonts, radius, spacing } from '../design/tokens';
import { scale, type } from '../design/type';
import { pluralDays } from '../lib/format';
import { useStore } from '../lib/store';

export function SquadScreen() {
  const [tab, setTab] = useState<'today' | 'board'>('today');

  const squadName = useStore((s) => s.squadName);
  const squadStreak = useStore((s) => s.squadStreak);
  const members = useStore((s) => s.members);
  const feed = useStore((s) => s.feed);
  const profile = useStore((s) => s.profile);
  const nudge = useStore((s) => s.nudge);
  const react = useStore((s) => s.reactToEvent);

  // §6.14: лидерборд только среди друзей, свой ряд подсвечен.
  const board = useMemo(() => {
    const rows = [
      ...members.map((m) => ({ id: m.id, name: m.name, points: m.streak * 10, me: false })),
      { id: profile.id, name: profile.name, points: profile.points, me: true },
    ];
    return rows.sort((a, b) => b.points - a.points);
  }, [members, profile]);

  const invite = (): void => {
    Share.share({
      message: `Вставай со мной в RISE. Заходи в команду «${squadName}»: rise.app/j/DEMO01`,
    }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.tabs}>
        <TabButton label="Сегодня" active={tab === 'today'} onPress={() => setTab('today')} />
        <TabButton label="Лидерборд" active={tab === 'board'} onPress={() => setTab('board')} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'today' ? (
          <>
            <Card tone="lime" style={styles.hero}>
              <Text style={type.eyebrow}>{squadName.toUpperCase()}</Text>
              <Text style={styles.heroValue}>
                {squadStreak} {pluralDays(squadStreak)} 🔥
              </Text>
              <Text style={type.body}>Пока никто не проспал. Не подведи своих.</Text>
            </Card>

            <Text style={type.eyebrow}>УЧАСТНИКИ</Text>
            {members.map((member) => (
              <Card key={member.id} style={styles.member}>
                <Avatar id={member.id} name={member.name} dimmed={!member.wokeUpAt} />
                <View style={styles.memberText}>
                  <Text style={type.label}>{member.name}</Text>
                  <Text style={type.caption}>
                    {member.wokeUpAt ? `встал в ${member.wokeUpAt} ✓` : 'ещё спит 😴'}
                  </Text>
                </View>
                {member.wokeUpAt ? (
                  <Pill label={`🔥 ${member.streak}`} tone="good" />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={member.nudgedToday}
                    onPress={() => nudge(member.id)}
                    style={[styles.nudge, member.nudgedToday ? styles.nudgeUsed : null]}
                  >
                    <Text style={styles.nudgeLabel}>
                      {member.nudgedToday ? 'Отправлено' : 'Разбудить'}
                    </Text>
                  </Pressable>
                )}
              </Card>
            ))}

            <Text style={[type.eyebrow, styles.section]}>ЛЕНТА</Text>
            {feed.map((event) => (
              <Card key={event.id} style={styles.event}>
                <Avatar id={event.actorId} name={event.actorName} size={36} />
                <View style={styles.eventText}>
                  <Text style={type.body}>
                    <Text style={styles.eventActor}>{event.actorName}</Text> {event.text}
                  </Text>
                  <Text style={type.caption}>{event.ago} назад</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => react(event.id)}
                  style={[styles.reaction, event.reactedByMe ? styles.reactionOn : null]}
                >
                  <Text style={styles.reactionEmoji}>{event.emoji}</Text>
                  <Text style={styles.reactionCount}>{event.reactions}</Text>
                </Pressable>
              </Card>
            ))}

            <Card style={styles.referral}>
              <Text style={type.label}>🎁 Приведи друга</Text>
              <Text style={type.caption}>Награда придёт, когда он пройдёт 3 подъёма</Text>
              <Button label="📲 Пригласить" variant="primary" onPress={invite} />
            </Card>
          </>
        ) : (
          <>
            {board.map((row, index) => (
              <Card key={row.id} style={[styles.boardRow, row.me ? styles.boardRowMe : null]}>
                <Text style={styles.place}>{index + 1}</Text>
                <Avatar id={row.id} name={row.name} size={36} />
                <Text style={[type.label, styles.boardName]}>{row.name}</Text>
                <Text style={styles.points}>{row.points}</Text>
              </Card>
            ))}
            <Text style={[type.caption, styles.boardNote]}>
              Соревнуешься только с друзьями — это мотивирует, а не давит масштабом.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({
  label, active, onPress,
}: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active ? styles.tabActive : null]}
    >
      <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  tabActive: { backgroundColor: colors.ink },
  tabLabel: { fontFamily: fonts.bold, fontSize: scale(14), color: colors.inkSoft },
  tabLabelActive: { color: colors.card },

  hero: { gap: spacing.xs },
  heroValue: { ...type.display, fontSize: scale(40) },

  member: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  memberText: { flex: 1, gap: 2 },
  nudge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
  },
  nudgeUsed: { backgroundColor: colors.line },
  nudgeLabel: { fontFamily: fonts.bold, fontSize: scale(12.5), color: colors.ink },

  section: { marginTop: spacing.sm },
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  eventText: { flex: 1, gap: 2 },
  eventActor: { fontFamily: fonts.extrabold, color: colors.ink },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  reactionOn: { backgroundColor: colors.lime },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontFamily: fonts.bold, fontSize: scale(12), color: colors.ink },

  referral: { gap: spacing.sm, marginTop: spacing.sm },

  boardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  boardRowMe: { backgroundColor: colors.lime },
  place: { fontFamily: fonts.extrabold, fontSize: scale(16), color: colors.inkSoft, width: 22 },
  boardName: { flex: 1 },
  points: { fontFamily: fonts.extrabold, fontSize: scale(16), color: colors.ink },
  boardNote: { textAlign: 'center', marginTop: spacing.sm },
});
