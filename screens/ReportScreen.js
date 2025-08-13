// screens/ReportScreen.js
import React, { useRef, useState } from 'react';
import {
  View, Text, Image, TextInput, ScrollView, Alert,
  TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet,
  SafeAreaView, Linking
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { Video } from 'expo-av';
import uuid from 'react-native-uuid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const { width } = Dimensions.get('window');
const BUCKET = 'halk-habercisi.firebasestorage.app';

// 🔹 Firebase REST upload (mevcut fonksiyonun)
async function uploadViaREST(localUri, remotePath, contentType, onProgress) {
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) throw new Error('Local file not found');

  const startUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodeURIComponent(remotePath)}&uploadType=resumable`;

  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(info.size || 0),
      'X-Goog-Upload-Header-Content-Type': contentType,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ name: remotePath, contentType }),
  });

  if (!startRes.ok) {
    const body = await startRes.text();
    throw new Error(`Session start failed [${startRes.status}]: ${body}`);
  }

  const uploadUrl = startRes.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) throw new Error('No upload URL returned');

  if (onProgress) onProgress(0.1);

  const putRes = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Type': contentType,
    },
  });

  if (putRes.status !== 200) {
    throw new Error(`Upload failed [${putRes.status}]: ${putRes.body}`);
  }

  if (onProgress) onProgress(1);

  const meta = JSON.parse(putRes.body);
  const url = `https://firebasestorage.googleapis.com/v0/b/${meta.bucket}/o/${encodeURIComponent(meta.name)}?alt=media&token=${meta.downloadTokens}`;
  return url;
}

const MAX_DESC = 400;

const ReportScreen = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState(null);
  const [mediaSizeKB, setMediaSizeKB] = useState(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressTimer = useRef(null);

  const resolveMediaType = (asset) => {
    const t = (asset?.type || '').toLowerCase();
    if (t.includes('video')) return 'video';
    if (t.includes('image')) return 'image';
    const mime = (asset?.mimeType || '').toLowerCase();
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('image/')) return 'image';
    const path = (asset?.uri || '').split('?')[0].toLowerCase();
    const ext = path.split('.').pop();
    return ['mp4', 'mov', 'm4v', '3gp', 'mkv', 'webm'].includes(ext) ? 'video' : 'image';
  };

  const afterPickSetInfo = async (asset) => {
    setMedia({ ...asset, _resolvedType: resolveMediaType(asset) });
    try {
      const info = await FileSystem.getInfoAsync(asset.uri);
      if (info.exists && info.size) {
        setMediaSizeKB(Math.round(info.size / 1024));
      } else {
        setMediaSizeKB(null);
      }
    } catch {
      setMediaSizeKB(null);
    }
  };

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeriye erişim izni vermen gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      await afterPickSetInfo(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kamera izni olmadan fotoğraf çekemezsin.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length > 0) {
      await afterPickSetInfo(result.assets[0]);
    }
  };

  const takeVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kamera izni olmadan video çekemezsin.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets?.length > 0) {
      await afterPickSetInfo(result.assets[0]);
    }
  };

  const getLocation = async () => {
    try {
      const services = await Location.hasServicesEnabledAsync();
      if (!services) {
        Alert.alert('Konum Kapalı', 'Lütfen konum servislerini açın.', [
          { text: 'Ayarları Aç', onPress: () => Linking.openSettings() }, { text: 'İptal' }
        ]);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Konum izni verilmedi.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 8000,
        maximumAge: 3000,
      });
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (e) {
      Alert.alert('Hata', 'Konum alınamadı.');
    }
  };

  const startFakeProgress = () => {
    setProgress(0.02);
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.max(0.01, (1 - p) * 0.05);
        return next >= 0.9 ? 0.9 : next;
      });
    }, 280);
  };

  const stopFakeProgress = (final = 1) => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    setProgress(final);
  };

  const uploadReport = async () => {
    if (!media || !description.trim() || !location) {
      Alert.alert('Eksik Bilgi', 'Lütfen medya, açıklama ve konumu giriniz.');
      return;
    }

    setIsUploading(true);
    startFakeProgress();

    const mediaId = uuid.v4();
    const cleanUri = (media.uri || '').split('?')[0];
    const fallbackExt = media._resolvedType === 'video' ? 'mp4' : 'jpg';
    const extension = (cleanUri.split('.').pop() || fallbackExt).toLowerCase();
    const baseName = `${mediaId}.${extension}`;
    const remotePath = `reports/${baseName}`;
    let contentType = media?.mimeType || (media._resolvedType === 'video' ? 'video/mp4' : 'image/jpeg');

    try {
      const downloadURL = await uploadViaREST(
        media.uri,
        remotePath,
        contentType,
        (p) => { if (p >= 1) stopFakeProgress(1); }
      );

      const payload = {
        description: description.trim(),
        mediaUrl: downloadURL,
        storagePath: remotePath,
        bucket: BUCKET,
        mediaType: media._resolvedType,
        location: { latitude: location.latitude, longitude: location.longitude },
        createdAt: serverTimestamp(),
        approved: false,
      };

      await addDoc(collection(db, 'reports'), payload);

      Alert.alert('✅ Başarılı', 'Olay bildiriminiz başarıyla gönderildi.');
      setMedia(null);
      setMediaSizeKB(null);
      setDescription('');
      setLocation(null);
      stopFakeProgress(1);
    } catch (error) {
      stopFakeProgress(0);
      Alert.alert('❌ Hata', error?.message || 'Bildirim gönderilemedi.');
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 400);
    }
  };

  const isVideo = media?._resolvedType === 'video';
  const remain = Math.max(0, MAX_DESC - description.length);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 8 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Üst Bar */}
        <View style={styles.appHeader}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backChip}>
              <Text style={styles.backChipText}>←</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Demirören Medya</Text>
            <Text style={styles.brandSub}>Halk Habercisi • Yurttaş Bildirimi</Text>
          </View>
          <View style={styles.dotLive}><Text style={styles.dotLiveText}>●</Text></View>
        </View>

        {/* Medya Önizleme */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Medya</Text>
          {media ? (
            <>
              <View style={styles.mediaWrap}>
                {isVideo ? (
                  <Video
                    key={media.uri}
                    style={styles.media}
                    source={{ uri: media.uri }}
                    useNativeControls
                    resizeMode="cover"
                  />
                ) : (
                  <Image key={media.uri} source={{ uri: media.uri }} style={styles.media} />
                )}
              </View>

              {/* Medya Bilgi Rozetleri */}
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{isVideo ? 'Video' : 'Fotoğraf'}</Text>
                </View>
                {typeof media?.duration === 'number' && isVideo ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      Süre: {Math.round(media.duration)} sn
                    </Text>
                  </View>
                ) : null}
                {mediaSizeKB ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{mediaSizeKB} KB</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.row}>
                <TouchableOpacity style={[styles.btnOutline, { flex: 1 }]} onPress={pickMedia} disabled={isUploading}>
                  <Text style={styles.btnOutlineText}>🖼️ Değiştir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnGhost, { flex: 1 }]}
                  onPress={() => { setMedia(null); setMediaSizeKB(null); }}
                  disabled={isUploading}
                >
                  <Text style={styles.btnGhostText}>🗑️ Kaldır</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity style={styles.placeholder} activeOpacity={0.8} onPress={pickMedia} disabled={isUploading}>
              <Text style={styles.placeholderIcon}>📷</Text>
              <Text style={styles.placeholderTitle}>Fotoğraf/Video ekle</Text>
              <Text style={styles.placeholderDesc}>Galeri veya kameradan seçerek başlayın</Text>
              <View style={styles.placeholderRow}>
                <TouchableOpacity style={styles.smallPill} onPress={takePhoto} disabled={isUploading}>
                  <Text style={styles.smallPillText}>📸 Çek</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallPill} onPress={takeVideo} disabled={isUploading}>
                  <Text style={styles.smallPillText}>🎥 Video</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallPill} onPress={pickMedia} disabled={isUploading}>
                  <Text style={styles.smallPillText}>🖼️ Galeri</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Açıklama */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Açıklama</Text>
          <Text style={styles.helper}>Olayı yer, zaman ve detaylarla kısa ve net anlatın.</Text>
          <TextInput
            placeholder="🗒️ Örn: Beşiktaş’ta saat 19:10’da trafik kazası. İki araç..."
            value={description}
            onChangeText={(t) => t.length <= MAX_DESC && setDescription(t)}
            style={styles.input}
            multiline
          />
          <View style={styles.counterRow}>
            <Text style={styles.counterHint}>Maks. {MAX_DESC} karakter</Text>
            <Text style={styles.counterNum}>{remain}</Text>
          </View>
        </View>

        {/* Konum */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Konum</Text>
          <View style={[styles.row, { alignItems: 'center' }]}>
            <TouchableOpacity style={[styles.btnOutline, { flex: 1 }]} onPress={getLocation} disabled={isUploading}>
              <Text style={styles.btnOutlineText}>📍 Konumu Al</Text>
            </TouchableOpacity>
            {location && (
              <View style={styles.locPill}>
                <Text style={styles.locPillText}>
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </Text>
              </View>
            )}
          </View>
          {!location && <Text style={styles.helperMuted}>Konum doğruluğu haber değeri için önemlidir.</Text>}
        </View>

        {/* İlerleme */}
        {isUploading && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
        )}

        {/* Gönder */}
        <View style={styles.stickySubmit}>
          <TouchableOpacity
            style={[styles.btnPrimary, { opacity: isUploading ? 0.7 : 1 }]}
            onPress={uploadReport}
            disabled={isUploading}
          >
            {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>🚀 Gönder</Text>}
          </TouchableOpacity>
        </View>

        {/* Basın İlkeleri / Güvenlik */}
        <View style={styles.cardMuted}>
          <Text style={styles.sectionTitleMuted}>Basın İlkeleri</Text>
          <Text style={styles.bullet}>• Kişisel bilgileri ifşa etmeyin, yüzleri mümkünse kadraj dışında tutun.</Text>
          <Text style={styles.bullet}>• Görseli manipüle etmeyin; gerçekliği teyit edilebilir içerik gönderin.</Text>
          <Text style={styles.bullet}>• Güvenliğinizden emin olmadan çekim yapmayın.</Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const colors = {
  bg: '#0E0F12',
  card: '#16181D',
  cardMuted: '#1A1C22',
  border: '#2A2D34',
  text: '#E6E8EA',
  textMuted: '#A5ABB3',
  primary: '#E30613', // Demirören kırmızısı
  primaryDark: '#B7050F',
  outline: '#2F333B',
  green: '#34C759'
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { paddingHorizontal: 16 },

  // Header
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  backChip: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginRight: 10
  },
  backChipText: { color: colors.text, fontSize: 18, fontWeight: '600' },
  brand: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  brandSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  dotLive: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.primary, marginLeft: 8, alignItems: 'center', justifyContent: 'center'
  },
  dotLiveText: { color: '#fff', fontSize: 7, marginTop: -1 },

  // Cards
  card: {
    width: '100%',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12
  },
  cardMuted: {
    width: '100%',
    backgroundColor: colors.cardMuted,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12
  },

  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  sectionTitleMuted: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  helper: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  helperMuted: { color: colors.textMuted, fontSize: 12, marginTop: 8 },

  // Media
  mediaWrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: '#0b0c10' },
  media: { width: '100%', height: width * 0.6, backgroundColor: '#0b0c10' },

  placeholder: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outline,
    borderRadius: 12, paddingVertical: 22, alignItems: 'center'
  },
  placeholderIcon: { fontSize: 38, color: colors.text },
  placeholderTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  placeholderDesc: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  placeholderRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallPill: {
    borderWidth: 1, borderColor: colors.outline, borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10
  },
  smallPillText: { color: colors.text, fontWeight: '600', fontSize: 12 },

  // Badges
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 6, flexWrap: 'wrap' },
  badge: {
    backgroundColor: '#0F1116', borderWidth: 1, borderColor: colors.outline,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10
  },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '600' },

  // Inputs
  input: {
    fontSize: 15,
    color: colors.text,
    minHeight: 110,
    textAlignVertical: 'top',
    backgroundColor: '#0F1116',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 10,
    padding: 12
  },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  counterHint: { color: colors.textMuted, fontSize: 11 },
  counterNum: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },

  // Buttons
  row: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 10 },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.2 },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.outline,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnOutlineText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  btnGhost: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnGhostText: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },

  // Location
  locPill: {
    marginLeft: 8,
    backgroundColor: '#0F1116',
    borderWidth: 1, borderColor: colors.outline,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10
  },
  locPillText: { color: colors.text, fontSize: 12, fontWeight: '700' },

  // Progress
  progressContainer: {
    width: '100%',
    backgroundColor: '#0F1116',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outline,
    marginBottom: 8,
    height: 22,
    justifyContent: 'center'
  },
  progressBar: { height: '100%', backgroundColor: colors.green },
  progressText: { position: 'absolute', alignSelf: 'center', color: '#0E0F12', fontWeight: '900' },

  // Submit
  stickySubmit: {
    width: '100%',
    marginTop: 8
  },

  // Bullets
  bullet: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 }
});

export default ReportScreen;
