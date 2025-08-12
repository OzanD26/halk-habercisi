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

// 🔹 Firebase REST upload fonksiyonu
async function uploadViaREST(localUri, remotePath, contentType, onProgress) {
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) throw new Error('Local file not found');

  const startUrl = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o?name=${encodeURIComponent(remotePath)}&uploadType=resumable`;

  console.log('[REST START] url:', startUrl, ' size:', info.size, ' ct:', contentType);

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
    console.log('[REST ERROR start]', startRes.status, body);
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
    console.log('[REST ERROR put]', putRes.status, putRes.body);
    throw new Error(`Upload failed [${putRes.status}]: ${putRes.body}`);
  }

  if (onProgress) onProgress(1);

  const meta = JSON.parse(putRes.body);
  const url = `https://firebasestorage.googleapis.com/v0/b/${meta.bucket}/o/${encodeURIComponent(meta.name)}?alt=media&token=${meta.downloadTokens}`;
  console.log('[REST OK] path:', meta.name, ' bucket:', meta.bucket);
  return url;
}

const ReportScreen = ({ onBack }) => {
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState(null);
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

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeriye erişim izni vermen gerekiyor.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setMedia({ ...asset, _resolvedType: resolveMediaType(asset) });
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
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setMedia({ ...asset, _resolvedType: resolveMediaType(asset) });
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
      quality: 0.7,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setMedia({ ...asset, _resolvedType: resolveMediaType(asset) });
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
      console.log('[Location ERROR]', e);
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
    }, 300);
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
      setDescription('');
      setLocation(null);
      stopFakeProgress(1);
    } catch (error) {
      console.log('[UPLOAD/WRITE ERROR]', error);
      stopFakeProgress(0);
      Alert.alert('❌ Hata', error?.message || 'Bildirim gönderilemedi.');
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 400);
    }
  };

  const isVideo = media?._resolvedType === 'video';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>← Geri</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.title}>📰 Halk Habercisi</Text>

        {media && (
          <View style={styles.card}>
            {isVideo ? (
              <Video key={media.uri} style={styles.media} source={{ uri: media.uri }} useNativeControls resizeMode="cover" />
            ) : (
              <Image key={media.uri} source={{ uri: media.uri }} style={styles.media} />
            )}
          </View>
        )}

        {isUploading && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          </View>
        )}

        <View style={styles.card}>
          <TextInput
            placeholder="🗒️ Olay açıklaması yazınız..."
            value={description}
            onChangeText={setDescription}
            style={styles.input}
            multiline
          />
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={takePhoto} disabled={isUploading}>
            <Text style={styles.buttonText}>📸 Fotoğraf Çek</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={takeVideo} disabled={isUploading}>
            <Text style={styles.buttonText}>🎥 Video Çek</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={pickMedia} disabled={isUploading}>
            <Text style={styles.buttonText}>🖼️ Galeriden Seç</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={getLocation} disabled={isUploading}>
            <Text style={styles.buttonText}>📍 Konum Al</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.submitContainer}>
          <TouchableOpacity style={[styles.button, { width: '95%' }]} onPress={uploadReport} disabled={isUploading}>
            {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>🚀 Gönder</Text>}
          </TouchableOpacity>
        </View>

        {location && (
          <Text style={styles.locationText}>
            📌 Konum: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f4f7' },
  container: { paddingHorizontal: 16, alignItems: 'center' },
  backButton: { alignSelf: 'flex-start', marginBottom: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#ddd', borderRadius: 6 },
  backText: { fontSize: 16, color: '#333' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, color: '#333', textAlign: 'center' },
  card: { width: '100%', backgroundColor: '#fff', padding: 12, borderRadius: 12, elevation: 3, marginBottom: 12 },
  media: { width: '100%', height: width * 0.6, borderRadius: 10, backgroundColor: '#ddd' },
  input: { fontSize: 16, color: '#333', minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 12 },
  button: { flex: 1, marginHorizontal: 5, backgroundColor: '#1565C0', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  submitContainer: { width: '100%', marginTop: 16, alignItems: 'center' },
  locationText: { marginTop: 14, fontSize: 14, color: '#444', textAlign: 'center' },
  progressContainer: { width: '100%', backgroundColor: '#ddd', borderRadius: 8, overflow: 'hidden', marginBottom: 8, height: 20, justifyContent: 'center' },
  progressBar: { height: '100%', backgroundColor: '#4caf50' },
  progressText: { position: 'absolute', alignSelf: 'center', color: '#fff', fontWeight: 'bold' },
});

export default ReportScreen;
