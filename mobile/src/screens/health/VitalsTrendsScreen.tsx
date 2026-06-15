import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Dimensions,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons as Icon } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";

import { getMyVitalsTrends } from "../../api/patient"; // adapt path to your client
import LoadingSpinner from "../../components/common/LoadingSpinner";

const C = {
  primary: "#059669",
  primaryGhost: "#ECFDF5",
  coral: "#FF5757",
  coralLight: "#FFE4E4",
  blue: "#3B82F6",
  blueLight: "#DBEAFE",
  amber: "#F59E0B",
  amberLight: "#FEF3C7",
  violet: "#8B5CF6",
  violetLight: "#EDE9FE",
  ink: "#0A0E1A",
  inkSoft: "#4B5563",
  inkMuted: "#9CA3AF",
  bg: "#FAFAFB",
  card: "#FFFFFF",
  cardBorder: "#E5E7EB",
};

const W = Dimensions.get("window").width;

interface Point {
  date: string;
  visitNumber: string | null;
  systolic: number | null;
  diastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  weight: number | null;
}

type Metric = "bp" | "pulse" | "temperature" | "weight" | "spo2";

const METRICS: {
  key: Metric;
  label: string;
  icon: string;
  color: string;
  unit: string;
}[] = [
  {
    key: "bp",
    label: "Blood Pressure",
    icon: "favorite",
    color: C.coral,
    unit: "mmHg",
  },
  {
    key: "pulse",
    label: "Pulse",
    icon: "monitor-heart",
    color: C.violet,
    unit: "bpm",
  },
  {
    key: "temperature",
    label: "Temperature",
    icon: "device-thermostat",
    color: C.amber,
    unit: "°C",
  },
  {
    key: "weight",
    label: "Weight",
    icon: "monitor-weight",
    color: C.blue,
    unit: "kg",
  },
  { key: "spo2", label: "SpO₂", icon: "air", color: C.primary, unit: "%" },
];

const chartConfig = (color: string) => ({
  backgroundGradientFrom: "#fff",
  backgroundGradientTo: "#fff",
  decimalPlaces: 1,
  color: (opacity = 1) =>
    color +
    Math.round(opacity * 255)
      .toString(16)
      .padStart(2, "0"),
  labelColor: () => C.inkMuted,
  propsForDots: { r: "4", strokeWidth: "2", stroke: color, fill: "#fff" },
  propsForBackgroundLines: { stroke: "#F3F4F6" },
});

export default function VitalsTrendsScreen() {
  const [points, setPoints] = useState<Point[]>([]);
  const [latest, setLatest] = useState<Point | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metric, setMetric] = useState<Metric>("bp");

  const fetchData = useCallback(async () => {
    try {
      const res = await getMyVitalsTrends();
      const data = res.data?.data;
      setPoints(data?.points ?? []);
      setLatest(data?.latest ?? null);
    } catch {
      setPoints([]);
      setLatest(null);
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (loading) return <LoadingSpinner message="Loading health trends…" />;

  const active = METRICS.find((m) => m.key === metric)!;

  // Build chart data for the selected metric
  const filtered = points.filter((p) => {
    if (metric === "bp") return p.systolic != null;
    return p[metric] != null;
  });

  const labels = filtered.map((p, i) => {
    // show ~5 labels max
    const step = Math.max(1, Math.ceil(filtered.length / 5));
    if (i % step !== 0) return "";
    const d = new Date(p.date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  });

  const datasets =
    metric === "bp"
      ? [
          {
            data: filtered.map((p) => p.systolic ?? 0),
            color: () => C.coral,
            strokeWidth: 2,
          },
          {
            data: filtered.map((p) => p.diastolic ?? 0),
            color: () => C.blue,
            strokeWidth: 2,
          },
        ]
      : [
          {
            data: filtered.map((p) => Number(p[metric]) || 0),
            color: () => active.color,
            strokeWidth: 2,
          },
        ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[C.primary]}
            tintColor={C.primary}
          />
        }
      >
        {/* Subtitle */}
        <Text style={styles.subtitle}>Your vitals across all hospital visits</Text>

        {/* Latest snapshot cards */}
        {latest && (
          <View style={styles.snapshotRow}>
            <View style={[styles.snapCard, { borderColor: `${C.coral}30` }]}>
              <Icon name="favorite" size={14} color={C.coral} />
              <Text style={[styles.snapValue, { color: C.coral }]}>
                {latest.systolic ?? "—"}/{latest.diastolic ?? "—"}
              </Text>
              <Text style={styles.snapLabel}>BP mmHg</Text>
            </View>
            <View style={[styles.snapCard, { borderColor: `${C.violet}30` }]}>
              <Icon name="monitor-heart" size={14} color={C.violet} />
              <Text style={[styles.snapValue, { color: C.violet }]}>
                {latest.pulse ?? "—"}
              </Text>
              <Text style={styles.snapLabel}>Pulse bpm</Text>
            </View>
            <View style={[styles.snapCard, { borderColor: `${C.blue}30` }]}>
              <Icon name="monitor-weight" size={14} color={C.blue} />
              <Text style={[styles.snapValue, { color: C.blue }]}>
                {latest.weight ?? "—"}
              </Text>
              <Text style={styles.snapLabel}>Weight kg</Text>
            </View>
          </View>
        )}

        {/* Metric selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.metricRow}
        >
          {METRICS.map((m) => {
            const isActive = metric === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                onPress={() => setMetric(m.key)}
                style={[
                  styles.metricPill,
                  isActive && {
                    backgroundColor: m.color,
                    borderColor: m.color,
                  },
                ]}
              >
                <Icon
                  name={m.icon as any}
                  size={13}
                  color={isActive ? "#fff" : m.color}
                />
                <Text
                  style={[
                    styles.metricText,
                    { color: isActive ? "#fff" : C.inkSoft },
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Chart */}
        {filtered.length < 2 ? (
          <View style={styles.empty}>
            <Icon name="show-chart" size={32} color={C.inkMuted} />
            <Text style={styles.emptyTitle}>Not enough data yet</Text>
            <Text style={styles.emptyBody}>
              Trends appear after at least two visits with recorded vitals.
            </Text>
          </View>
        ) : (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>{active.label}</Text>
              <Text style={styles.chartUnit}>{active.unit}</Text>
            </View>
            {metric === "bp" && (
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: C.coral }]}
                  />
                  <Text style={styles.legendText}>Systolic</Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: C.blue }]}
                  />
                  <Text style={styles.legendText}>Diastolic</Text>
                </View>
              </View>
            )}
            <LineChart
              data={{ labels, datasets }}
              width={W - 56}
              height={220}
              chartConfig={chartConfig(active.color)}
              bezier
              withInnerLines
              withOuterLines={false}
              style={{ borderRadius: 12, marginLeft: -8 }}
            />
            <Text style={styles.chartFootnote}>
              {filtered.length} readings · oldest to newest
            </Text>
          </View>
        )}

        {/* Reading list */}
        {filtered.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionLabel}>All Readings</Text>
            {[...filtered].reverse().map((p, i) => {
              const d = new Date(p.date);
              return (
                <View key={i} style={styles.readingCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.readingDate}>
                      {d.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                    {p.visitNumber && (
                      <Text style={styles.readingVisit}>{p.visitNumber}</Text>
                    )}
                  </View>
                  <Text style={[styles.readingValue, { color: active.color }]}>
                    {metric === "bp"
                      ? `${p.systolic}/${p.diastolic}`
                      : `${p[metric]}`}
                    <Text style={styles.readingUnit}> {active.unit}</Text>
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  subtitle: {
    fontSize: 13,
    color: C.inkMuted,
    fontWeight: "500",
    marginBottom: 16,
  },

  snapshotRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  snapCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  snapValue: {
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  snapLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: C.inkMuted,
    marginTop: 2,
  },

  metricRow: { gap: 8, paddingBottom: 14 },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: C.card,
  },
  metricText: { fontSize: 12, fontWeight: "700" },

  chartCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  chartTitle: { fontSize: 16, fontWeight: "800", color: C.ink },
  chartUnit: { fontSize: 11, fontWeight: "700", color: C.inkMuted },
  legendRow: { flexDirection: "row", gap: 14, marginBottom: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: "600", color: C.inkSoft },
  chartFootnote: {
    fontSize: 10,
    color: C.inkMuted,
    textAlign: "center",
    marginTop: 6,
    fontWeight: "500",
  },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: C.inkSoft,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  readingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 6,
  },
  readingDate: { fontSize: 13, fontWeight: "700", color: C.ink },
  readingVisit: {
    fontSize: 11,
    color: C.inkMuted,
    marginTop: 1,
    fontFamily: "monospace",
  },
  readingValue: { fontSize: 16, fontWeight: "800" },
  readingUnit: { fontSize: 11, fontWeight: "600", color: C.inkMuted },

  empty: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: C.ink, marginTop: 10 },
  emptyBody: {
    fontSize: 12,
    color: C.inkSoft,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
});
