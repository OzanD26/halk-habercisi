// screens/AdminReportsScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, ActivityIndicator,
  Linking, StyleSheet, RefreshControl, Alert, FlatList, Modal, useWindowDimensions
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Video } from 'expo-av';
import {
  collection, doc, onSnapshot, orderBy, query,
  updateDoc, deleteDoc, where,
} from 'firebase/firestore';
import { ref as sRef, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';

// --- Demirören koyu tema paleti (App & NewsScreen ile uyumlu)
const colors = {
  bg: '#0E0F12',
  card: '#16181D',
  cardMuted: '#1A1C22',
  border: '#2A2D34',
  outline: '#2F333B',
  text: '#E6E8EA',
  textMuted: '#A5ABB3',
  primary: '#E30613',
  ok: '#10B981',
  warn: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  placeholder: '#0F1116',
};

const TABS = [
  { key: 'all', label: 'Tümü' },
  { key: 'pending', label: 'Bekleyen' },
  { key: 'approved', label: 'Onaylı' },
];

export default function AdminReportsScreen({ onBack }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;
  const horizontalPadding = 12;
  const gap = 12;
  const numColumns = isTablet ? 2 : 1;
  const cardWidth = Math.floor((width - horizontalPadding * 2 - gap * (numColumns - 1)));

  const [tab, setTab] = useState('all');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [diagnostic, setDiagnostic] = useState({ mode: 'ordered', lastError: '' });

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [previewUri, setPreviewUri] = useState('');

  const unsubRef = useRef(null);

  const ensureUrl = useCallback(async (item) => {
    if (item?.storagePath) {
      try {
        return await getDownloadURL(sRef(storage, item.storagePath));
      } catch (e) {
        console.log('getDownloadURL error:', e?.message);
      }
    }
    return item?.mediaUrl || '';
  }, []);

  const makeQuery = useCallback((base, mode) => {
    if (tab === 'pending') {
      return mode === 'ordered'
        ? query(base, where('approved', '==', false), orderBy('createdAt', 'desc'))
        : query(base, where('approved', '==', false));
    }
    if (tab === 'approved') {
      return mode === 'ordered'
        ? query(base, where('approved', '==', true), orderBy('createdAt', 'desc'))
        : query(base, where('approved', '==', true));
    }
    return mode === 'ordered' ? query(base, orderBy('createdAt', 'desc')) : base;
  }, [tab]);

  const attachListener = useCallback(async (mode = 'ordered') => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    setLoading(true);

    const base = collection(db, 'reports');
    try {
      const q = makeQuery(base, mode);
      unsubRef.current = onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) => {
          const data = snap.docs.map((d) => {
            const v = d.data();
            return {
              id: d.id,
              description: v.description || '',
              mediaUrl: v.mediaUrl || '',
              storagePath: v.storagePath || null,
              mediaType: v.mediaType || 'image',
              approved: !!v.approved,
              location: v.location || null,
              createdAt: v.createdAt?.toDate?.() ?? null,
            };
          });
          setReports(data);
          setDiagnostic({ mode, lastError: '' });
          setLoading(false);
          setRefreshing(false);
        },
        (err) => {
          console.warn('onSnapshot error:', err?.code, err?.message);
          if (mode === 'ordered') {
            setDiagnostic({ mode: 'fallback', lastError: `${err?.code || ''} ${err?.message || ''}`.trim() });
            attachListener('fallback');
          } else {
            setDiagnostic({ mode: 'error', lastError: `${err?.code || ''} ${err?.message || ''}`.trim() });
            setLoading(false);
            setRefreshing(false);
          }
        }
      );
    } catch (e) {
      console.warn('attachListener try/catch error:', e?.message);
      if (mode === 'ordered') {
        setDiagnostic({ mode: 'fallback', lastError: e?.message || '' });
        attachListener('fallback');
      } else {
        setDiagnostic({ mode: 'error', lastError: e?.message || '' });
        setLoading(false);
      }
    }
  }, [makeQuery]);

  useEffect(() => {
    attachListener('ordered');
    return () => { if (unsubRef.current) unsubRef.current(); };
  }, [tab, attachListener]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    attachListener('ordered');
  }, [attachListener]);

  const approveToggle = async (id, approved) => {
    try {
      await updateDoc(doc(db, 'reports', id), { approved: !approved });
    } catch (e) {
      Alert.alert('Hata', `${e.code || ''} ${e.message || 'Güncellenemedi.'}`.trim());
    }
  };

  const deleteReport = async (id, storagePath) => {
    Alert.alert('Silinsin mi?', 'Bu raporu kalıcı olarak silmek istiyor musun?', [
      { text: 'İptal' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            if (storagePath) {
              try {
                await deleteObject(sRef(storage, storagePath));
              } catch (se) {
                console.log('Storage delete warning:', se?.code || '', se?.message || '');
              }
            }
            await deleteDoc(doc(db, 'reports', id));
            if (previewOpen) setPreviewOpen(false);
          } catch (e) {
            Alert.alert('Hata', `${e.code || ''} ${e.message || 'Silinemedi.'}`.trim());
          }
        },
      },
    ]);
  };

  const openPreview = useCallback(async (item) => {
    setPreviewItem(item);
    setPreviewUri('');
    setPreviewOpen(true);
    const uri = await ensureUrl(item);
    setPreviewUri(uri);
  }, [ensureUrl]);

  const emptyText = useMemo(() => {
    if (loading) return '';
    if (reports.length) return '';
    if (tab === 'pending') return 'Bekleyen rapor bulunamadı.';
    if (tab === 'approved') return 'Onaylı rapor bulunamadı.';
    return 'Hiç rapor bulunamadı.';
  }, [loading, reports.length, tab]);

  const renderItem = ({ item, index }) => {
    const styleCard = [
      styles.card,
      {
        width: isTablet
          ? Math.floor((cardWidth + gap) / numColumns) - gap
          : cardWidth,
        marginRight: isTablet && (index % numColumns !== numColumns - 1) ? gap : 0,
      },
    ];
    return (
      <View style={styleCard}>
        <Text style={styles.desc} numberOfLines={3}>{item.description || '(Açıklama yok)'}</Text>

        <TouchableOpacity activeOpacity={0.9} onPress={() => openPreview(item)}>
          {item.mediaType === 'video'
            ? <AsyncVideo item={item} ensureUrl={ensureUrl} />
            : <AsyncImage item={item} ensureUrl={ensureUrl} />
          }
        </TouchableOpacity>

        {item.location && (
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(`https://maps.google.com/?q=${item.location.latitude},${item.location.longitude}`)
            }
          >
            <Text style={styles.link}>
              📍 Haritada Gör ({item.location.latitude.toFixed(5)}, {item.location.longitude.toFixed(5)})
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Tarih yok'}
          </Text>
          <Text style={[styles.badge, item.approved ? styles.badgeOk : styles.badgePending]}>
            {item.approved ? 'Onaylı' : 'Bekliyor'}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: item.approved ? '#E67E22' : colors.ok }]}
            onPress={() => approveToggle(item.id, item.approved)}
          >
            <Text style={styles.btnText}>{item.approved ? 'Onayı Kaldır' : 'Onayla'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.danger }]}
            onPress={() => deleteReport(item.id, item.storagePath)}
          >
            <Text style={styles.btnText}>Sil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.textMuted }}>Raporlar yükleniyor…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.back}>
              <Text style={styles.backTxt}>←</Text>
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Demirören – Admin</Text>
            <Text style={styles.headerSub}>Rapor Moderasyonu</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.refresh} onPress={onRefresh}>
            <Text style={styles.refreshTxt}>Yenile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status */}
      <View style={styles.diagRow}>
        <Text style={styles.diagText} numberOfLines={2}>
          {`Kayıt: ${reports.length} • Mod: ${diagnostic.mode}${diagnostic.lastError ? ` • Hata: ${diagnostic.lastError}` : ''}`}
        </Text>
      </View>

      {/* Segmented Tabs */}
      <View style={styles.tabsWrap}>
        <View style={styles.tabs}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={reports}
        key={numColumns}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: 24, paddingTop: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            progressBackgroundColor={colors.placeholder}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null}
      />

      {/* Preview Modal */}
      <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
        <View style={styles.previewBackdrop}>
          <View style={styles.previewTop}>
            <TouchableOpacity onPress={() => setPreviewOpen(false)} style={styles.previewClose}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Kapat</Text>
            </TouchableOpacity>

            {previewItem && (
              <View style={styles.previewActions}>
                <TouchableOpacity
                  onPress={() => approveToggle(previewItem.id, previewItem.approved)}
                  style={[styles.pill, { backgroundColor: previewItem.approved ? '#E67E22' : colors.ok }]}
                >
                  <Text style={styles.pillTxt}>{previewItem.approved ? 'Onayı Kaldır' : 'Onayla'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteReport(previewItem.id, previewItem.storagePath)}
                  style={[styles.pill, { backgroundColor: colors.danger }]}
                >
                  <Text style={styles.pillTxt}>Sil</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.previewBody}>
            {!previewUri ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : previewItem?.mediaType === 'video' ? (
              <Video source={{ uri: previewUri }} style={styles.previewMedia} useNativeControls resizeMode="contain" />
            ) : (
              <Image source={{ uri: previewUri }} style={styles.previewMedia} resizeMode="contain" />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function AsyncImage({ item, ensureUrl }) {
  const [uri, setUri] = React.useState(item.mediaUrl || '');
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const fresh = await ensureUrl(item);
      if (mounted) setUri(fresh);
    })();
    return () => { mounted = false; };
  }, [item?.id, item?.storagePath, item?.mediaUrl, ensureUrl]);
  if (!uri) {
    return (
      <View style={[styles.media, styles.mediaPlaceholder]}>
        <Text style={{ color: colors.textMuted }}>Görsel yok</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.media} />;
}

function AsyncVideo({ item, ensureUrl }) {
  const [uri, setUri] = React.useState(item.mediaUrl || '');
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const fresh = await ensureUrl(item);
      if (mounted) setUri(fresh);
    })();
    return () => { mounted = false; };
  }, [item?.id, item?.storagePath, item?.mediaUrl, ensureUrl]);
  if (!uri) {
    return (
      <View style={[styles.media, styles.mediaPlaceholder]}>
        <Text style={{ color: colors.textMuted }}>Video yok</Text>
      </View>
    );
  }
  return <Video source={{ uri }} style={styles.media} useNativeControls resizeMode="cover" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // Header
  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  back: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center'
  },
  backTxt: { color: colors.text, fontSize: 16, fontWeight: '700' },
  refresh: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.primary
  },
  refreshTxt: { color: '#fff', fontWeight: '800', fontSize: 12 },

  // Status bar
  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.cardMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  diagText: { color: colors.textMuted, fontSize: 12, flex: 1 },

  // Tabs (segmented)
  tabsWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: colors.bg,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: 'transparent',
  },
  tabActive: { backgroundColor: colors.primary },
  tabTxt: { color: colors.textMuted, fontWeight: '700' },
  tabTxtActive: { color: '#fff', fontWeight: '800' },

  // Cards
  card: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  desc: { fontSize: 15, fontWeight: '700', marginBottom: 8, color: colors.text },
  media: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: colors.placeholder },
  mediaPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  link: { color: colors.info, marginTop: 8, textDecorationLine: 'underline' },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  meta: { color: colors.textMuted, fontSize: 12, flexShrink: 1 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, color: '#fff', overflow: 'hidden', fontSize: 12, fontWeight: '800'
  },
  badgeOk: { backgroundColor: colors.ok },
  badgePending: { backgroundColor: colors.warn },

  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 10 },
  btn: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },

  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },

  // Preview modal
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  previewTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8
  },
  previewClose: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)' },
  previewActions: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999 },
  pillTxt: { color: '#fff', fontWeight: '800' },
  previewBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewMedia: { width: '100%', height: '100%' },
});
