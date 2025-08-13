// screens/NewsScreen.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, RefreshControl,
  TouchableOpacity, Linking, Image, StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_KEY = 'pub_fbfef3c3f2bf4b0badd612c674014946'; // newsdata.io key
const BASE = 'https://newsdata.io/api/1/news';

// --- Dark tema renkleri (ReportScreen koyu tema ile aynı)
const colors = {
  bg: '#0E0F12',
  card: '#16181D',
  border: '#2A2D34',
  text: '#E6E8EA',
  textMuted: '#A5ABB3',
  outline: '#2F333B',
  primary: '#E30613',
  placeholder: '#0F1116',
};

export default function NewsScreen() {
  const [items, setItems] = useState([]);
  const [nextPage, setNextPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadingRef = useRef(false);

  const buildUrl = (page = null) => {
    const params = new URLSearchParams({
      apikey: API_KEY,
      country: 'tr',
      language: 'tr',
      // category: 'top,technology', // istersen aç
      // q: 'deprem',                 // istersen arama
    });
    if (page) params.append('page', page);
    return `${BASE}?${params.toString()}`;
  };

  const fetchNews = useCallback(async (page = null, mode = 'append') => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!page) setError('');

    try {
      const res = await fetch(buildUrl(page));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const results = Array.isArray(json?.results) ? json.results : [];
      const mapped = results.map((it) => ({
        title: it.title || 'Başlık yok',
        url: it.link || it.url,
        publishedAt: it.pubDate ? new Date(it.pubDate) : null,
        source: it.source_id || 'Kaynak',
        image: it.image_url || null,
        description: it.description || '',
      }));

      setNextPage(json?.nextPage || null);

      if (mode === 'replace') {
        setItems(mapped);
      } else {
        setItems((prev) => (page ? [...prev, ...mapped] : mapped));
      }
    } catch (e) {
      setError(e.message || 'Haberler alınamadı');
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(null, 'replace');
  }, [fetchNews]);

  const onRefresh = () => {
    setRefreshing(true);
    setNextPage(null);
    fetchNews(null, 'replace');
  };

  const onEndReached = () => {
    if (!nextPage || loadingMore || loadingRef.current) return;
    setLoadingMore(true);
    fetchNews(nextPage, 'append');
  };

  const renderItem = ({ item }) => {
    const time = item.publishedAt ? item.publishedAt.toLocaleString() : '';
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => item.url && Linking.openURL(item.url)}
      >
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.thumbPlaceholderIcon}>📰</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.source}{time ? ` • ${time}` : ''}
          </Text>
          <Text style={styles.desc} numberOfLines={3}>{item.description}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: 16 }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 8, color: colors.textMuted }}>Haberler yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      {error ? <Text style={styles.error}>Hata: {error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item, idx) => item.url || String(idx)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            titleColor={colors.textMuted}
            progressBackgroundColor={colors.placeholder}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>Haber bulunamadı.</Text>}
        onEndReachedThreshold={0.6}
        onEndReached={onEndReached}
        ListFooterComponent={ListFooter}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },

  error: { color: colors.primary, textAlign: 'center', marginTop: 10 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },

  card: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },

  thumb: {
    width: 100,
    height: 80,
    borderRadius: 10,
    backgroundColor: colors.placeholder,
  },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderIcon: { fontSize: 20, color: colors.textMuted },

  title: { fontWeight: '800', fontSize: 16, color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  desc: { fontSize: 13, color: colors.text, opacity: 0.85, marginTop: 6 },
});
