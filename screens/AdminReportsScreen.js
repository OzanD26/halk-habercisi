// screens/AdminReportsScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, ActivityIndicator,
  Linking, StyleSheet, RefreshControl, Alert, FlatList, useWindowDimensions, Modal
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { Video } from 'expo-av';
import {
  collection, doc, onSnapshot, orderBy, query,
  updateDoc, deleteDoc, where,
} from 'firebase/firestore';
import { ref as sRef, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebaseConfig'; // auth/ensureAuthReady gerekmiyor (read/update/delete herkese açık)

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
    return mode === 'ordered'
      ? query(base, orderBy('createdAt', 'desc'))
      : base;
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

  // Test modu: herkes onay/sil yapabilir (rules'ta allow update/delete: if true;)
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
            // Storage silme denemesi (izin yoksa hata yakalanır ve Firestore yine silinir)
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
            style={[styles.button, { backgroundColor: item.approved ? '#E67E22' : 'green' }]}
            onPress={() => approveToggle(item.id, item.approved)}
          >
            <Text style={styles.buttonText}>{item.approved ? 'Onayı Kaldır' : 'Onayla'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: 'red' }]}
            onPress={() => deleteReport(item.id, item.storagePath)}
          >
            <Text style={styles.buttonText}>Sil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" style={{ marginTop: 50 }} />;
  }

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Admin – Raporlar (Test Modu)</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.diagBtn} onPress={onRefresh}>
            <Text style={styles.diagBtnText}>Yenile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Durum Çizgisi */}
      <View style={styles.diagRow}>
        <Text style={styles.diagText} numberOfLines={2}>
          {`Kayıt: ${reports.length} • Mod: ${diagnostic.mode}${diagnostic.lastError ? ` • Hata: ${diagnostic.lastError}` : ''}`}
        </Text>
      </View>

      {/* Sekmeler */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Liste */}
      <FlatList
        data={reports}
        key={numColumns}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: 24, paddingTop: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={emptyText ? <Text style={styles.empty}>{emptyText}</Text> : null}
      />

      {/* Tam ekran Önizleme Modal */}
      <Modal
        visible={previewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewOpen(false)}
      >
        <View style={styles.previewBackdrop}>
          <View style={[styles.previewHeader, { paddingTop: insets.top + 6 }]}>
            <TouchableOpacity onPress={() => setPreviewOpen(false)} style={styles.previewClose}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Kapat</Text>
            </TouchableOpacity>

            {previewItem && (
              <View style={styles.previewActions}>
                <TouchableOpacity
                  onPress={() => approveToggle(previewItem.id, previewItem.approved)}
                  style={[styles.pill, { backgroundColor: previewItem.approved ? '#E67E22' : '#10B981' }]}
                >
                  <Text style={styles.pillText}>{previewItem.approved ? 'Onayı Kaldır' : 'Onayla'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => deleteReport(previewItem.id, previewItem.storagePath)}
                  style={[styles.pill, { backgroundColor: '#EF4444' }]}
                >
                  <Text style={styles.pillText}>Sil</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.previewBody}>
            {!previewUri ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : previewItem?.mediaType === 'video' ? (
              <Video
                source={{ uri: previewUri }}
                style={styles.previewMedia}
                useNativeControls
                resizeMode="contain"
              />
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
        <Text style={{ color: '#6b7280' }}>Görsel yok</Text>
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
        <Text style={{ color: '#6b7280' }}>Video yok</Text>
      </View>
    );
  }
  return <Video source={{ uri }} style={styles.media} useNativeControls resizeMode="cover" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f7fb' },

  header: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginLeft: 6 },

  backButton: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#e5e7eb', borderRadius: 8 },
  backText: { fontSize: 16, color: '#111827' },

  diagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#eef2ff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c7d2fe',
  },
  diagText: { color: '#1e3a8a', fontSize: 12, flex: 1 },

  diagBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#4f46e5', borderRadius: 8 },
  diagBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  tab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  tabActive: { backgroundColor: '#e8f0fe' },
  tabText: { color: '#6b7280', fontWeight: '600' },
  tabTextActive: { color: '#1d4ed8' },

  card: { backgroundColor: '#fff', padding: 12, borderRadius: 10, elevation: 1 },
  desc: { fontSize: 16, fontWeight: '500', marginBottom: 8, color: '#111827' },
  media: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: '#ddd' },
  mediaPlaceholder: { alignItems: 'center', justifyContent: 'center' },

  link: { color: '#1d4ed8', marginTop: 8, textDecorationLine: 'underline' },

  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  meta: { color: '#6b7280', fontSize: 12, flexShrink: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, color: '#fff', overflow: 'hidden', fontSize: 12, fontWeight: '700' },
  badgeOk: { backgroundColor: '#10B981' },
  badgePending: { backgroundColor: '#F59E0B' },

  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 },
  button: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },

  empty: { textAlign: 'center', marginTop: 40, color: '#6b7280' },

  // Preview modal
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, justifyContent: 'space-between',
  },
  previewClose: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)' },
  previewActions: { flexDirection: 'row', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999 },
  pillText: { color: '#fff', fontWeight: '700' },
  previewBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewMedia: { width: '100%', height: '100%' },
});
