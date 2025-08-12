
// screens/NewsScreen.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, RefreshControl,
  TouchableOpacity, Linking, Image, StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_KEY = 'pub_fbfef3c3f2bf4b0badd612c674014946'; // newsdata.io key'in
// KATEGORİ örneği: category=top,politics,sports (virgülle ayrılır)
// Daha fazla parametre: q=, from_date=, to_date=, etc.
const BASE = 'https://newsdata.io/api/1/news';

export default function NewsScreen() {
  const [items, setItems] = useState([]);
  const [nextPage, setNextPage] = useState(null);
  const [loading, setLoading] = useState(true);       // ilk yükleme
  const [loadingMore, setLoadingMore] = useState(false); // sayfa ekleme
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadingRef = useRef(false); // ardışık istekleri engelle

  const buildUrl = (page = null) => {
    const params = new URLSearchParams({
      apikey: API_KEY,
      country: 'tr',
      language: 'tr',
      // category: 'top', // istersen aç
      // q: 'deprem',     // anahtar kelime araması için örnek
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

      // newsdata.io yanıt yapısı: { status, totalResults, results: [...], nextPage }
      const results = Array.isArray(json?.results) ? json.results : [];

      const mapped = results.map((it) => {
        // Alan örnekleri: title, link, pubDate, source_id, image_url, description, content
        return {
          title: it.title || 'Başlık yok',
          url: it.link || it.url,
          publishedAt: it.pubDate ? new Date(it.pubDate) : null,
          source: it.source_id || 'Kaynak',
          image: it.image_url || null,
          description: it.description || '',
        };
      });

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
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => item.url && Linking.openURL(item.url)}>
        {item.image
          ? <Image source={{ uri: item.image }} style={styles.thumb} />
          : <View style={[styles.thumb, styles.thumbPlaceholder]} />
        }
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>{item.source} {time ? `• ${time}` : ''}</Text>
          <Text style={styles.desc} numberOfLines={3}>{item.description}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: 16 }}>
        <ActivityIndicator />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8, color: '#64748b' }}>Haberler yükleniyor...</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
  root: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  error: { color: '#ef4444', textAlign: 'center', marginTop: 10 },
  empty: { textAlign: 'center', marginTop: 40, color: '#64748b' },

  card: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 10, marginBottom: 10, elevation: 1 },
  thumb: { width: 100, height: 80, borderRadius: 10, backgroundColor: '#e2e8f0' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '700', fontSize: 16, color: '#0f172a' },
  meta: { fontSize: 12, color: '#64748b', marginTop: 2 },
  desc: { fontSize: 13, color: '#334155', marginTop: 6 },
});
