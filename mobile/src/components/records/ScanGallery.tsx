/**
 * Displays the images a radiographer or lab technician uploaded against a
 * record, so the patient can see the actual scan and not merely be told one
 * exists.
 *
 * AUTHENTICATION. These files are served by the backend's /api/files route,
 * which checks that the caller is entitled to this patient's records before
 * returning any bytes. They are not public URLs — the previous static /uploads
 * path handed a patient's X-ray to anyone who asked, and was removed. React
 * Native's <Image> can carry request headers, so the session token travels with
 * each fetch.
 *
 * URL SHAPE. Only the filename is taken from whatever the record stored. Rows
 * written before the authenticated route existed hold an absolute .../uploads/
 * URL, and rows written since hold .../api/files/. Deriving the request from the
 * basename means both work, with no data migration and no dead images in older
 * records.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { BASE_URL } from "../../api/client";
import { useAuthStore } from "../../store/authStore";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const C = {
  ink: "#0A0E1A",
  inkSoft: "#4B5563",
  inkMuted: "#9CA3AF",
  card: "#FFFFFF",
  cardBorder: "#E5E7EB",
  bgAlt: "#F4F5F7",
  primary: "#059669",
};

/** Strip any host and directory, keeping just the stored filename. */
function fileNameOf(url: string): string {
  return url.split("?")[0].split("/").filter(Boolean).pop() ?? url;
}

/** Build the authenticated URL for a stored image reference. */
function authenticatedUrl(url: string, category: "radiology" | "lab"): string {
  // BASE_URL already ends in /api.
  return `${BASE_URL}/files/${category}/${fileNameOf(url)}`;
}

type Props = {
  /** Whatever the record stored — absolute URLs, old or new shape. */
  urls: string[];
  category?: "radiology" | "lab";
  /** Shown above the thumbnails, e.g. "CHEST X-RAY". */
  label?: string;
};

export default function ScanGallery({ urls, category = "radiology", label }: Props) {
  const token = useAuthStore((s) => s.token);
  const [viewing, setViewing] = useState<number | null>(null);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  if (!urls?.length) return null;

  // Passed to <Image>; the backend rejects the request without it.
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const sources = urls.map((u) => ({ uri: authenticatedUrl(u, category), headers }));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <MaterialIcons name="photo-library" size={14} color={C.inkSoft} />
        <Text style={styles.headerText}>
          {label ? `${label} · ` : ""}{urls.length} image{urls.length === 1 ? "" : "s"}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {sources.map((src, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.85}
            onPress={() => !failed[i] && setViewing(i)}
            style={styles.thumbWrap}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Open image ${i + 1} of ${urls.length}`}
          >
            {failed[i] ? (
              // A failed load is shown rather than hidden: a patient who was
              // told an image exists should not be left with a blank space.
              <View style={[styles.thumb, styles.thumbFailed]}>
                <MaterialIcons name="broken-image" size={20} color={C.inkMuted} />
                <Text style={styles.failedText}>Unavailable</Text>
              </View>
            ) : (
              <>
                <Image
                  source={src}
                  style={styles.thumb}
                  resizeMode="cover"
                  onLoadStart={() => setLoading((p) => ({ ...p, [i]: true }))}
                  onLoadEnd={() => setLoading((p) => ({ ...p, [i]: false }))}
                  onError={() => {
                    setFailed((p) => ({ ...p, [i]: true }));
                    setLoading((p) => ({ ...p, [i]: false }));
                  }}
                />
                {loading[i] && (
                  <View style={styles.thumbLoading}>
                    <ActivityIndicator size="small" color={C.primary} />
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Full-screen viewer. A thumbnail is not enough to actually look at a
          scan, so tapping opens it large on a dark ground. */}
      <Modal
        visible={viewing !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <View style={styles.viewer}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setViewing(null)}
            accessibilityRole="button"
            accessibilityLabel="Close image"
          >
            <MaterialIcons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {viewing !== null && (
            <ScrollView
              // Pinch-to-zoom, because clinical images are worth inspecting.
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              contentContainerStyle={styles.viewerContent}
            >
              <Image
                source={sources[viewing]}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </ScrollView>
          )}

          {urls.length > 1 && viewing !== null && (
            <View style={styles.pager}>
              <TouchableOpacity
                disabled={viewing === 0}
                onPress={() => setViewing(Math.max(0, viewing - 1))}
                style={styles.pagerBtn}
              >
                <MaterialIcons
                  name="chevron-left"
                  size={28}
                  color={viewing === 0 ? "#4B5563" : "#FFFFFF"}
                />
              </TouchableOpacity>

              <Text style={styles.pagerText}>{viewing + 1} / {urls.length}</Text>

              <TouchableOpacity
                disabled={viewing === urls.length - 1}
                onPress={() => setViewing(Math.min(urls.length - 1, viewing + 1))}
                style={styles.pagerBtn}
              >
                <MaterialIcons
                  name="chevron-right"
                  size={28}
                  color={viewing === urls.length - 1 ? "#4B5563" : "#FFFFFF"}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 7 },
  headerText: { fontSize: 11, fontWeight: "600", color: C.inkSoft, letterSpacing: 0.3 },

  strip: { gap: 8, paddingRight: 4 },
  thumbWrap: { position: "relative" },
  thumb: {
    width: 74,
    height: 74,
    borderRadius: 10,
    backgroundColor: C.bgAlt,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  thumbFailed: { alignItems: "center", justifyContent: "center", gap: 3 },
  failedText: { fontSize: 9, color: C.inkMuted },
  thumbLoading: {
    ...StyleSheet.absoluteFill as object,
    alignItems: "center",
    justifyContent: "center",
  },

  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)" },
  viewerContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  fullImage: { width: SCREEN_W, height: SCREEN_H * 0.75 },
  closeBtn: {
    position: "absolute",
    top: 48,
    right: 18,
    zIndex: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  pager: {
    position: "absolute",
    bottom: 44,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  pagerBtn: { padding: 6 },
  pagerText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", minWidth: 54, textAlign: "center" },
});
