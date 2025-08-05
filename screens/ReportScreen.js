import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Video } from 'expo-av';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../firebaseConfig';
import uuid from 'react-native-uuid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

const { width } = Dimensions.get('window');

const ReportScreen = () => {
  const insets = useSafeAreaInsets();

  const [media, setMedia] = useState(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const pickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      setMedia(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Kamera izni gerekli.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets.length > 0) {
      setMedia(result.assets[0]);
    }
  };

  const takeVideo = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Kamera izni gerekli.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets.length > 0) {
      setMedia(result.assets[0]);
    }
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      alert('Konum izni verilmedi.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setLocation(loc.coords);
  };

  const uploadReport = async () => {
    if (!media || !description || !location) {
      Alert.alert('Eksik Bilgi', 'Lütfen medya, açıklama ve konumu giriniz.');
      return;
    }

    try {
      setIsUploading(true);

      console.log("📷 Medya URI:", media?.uri);
      console.log("📷 Medya tipi:", media?.type);
      console.log("📝 Açıklama:", description);
      console.log("🌍 Konum:", location);

      const mediaId = uuid.v4();
      const cleanUri = media.uri.split('?')[0];
      const extension = cleanUri.split('.').pop();
      const fileName = `${mediaId}.${extension}`;
      const mediaRef = ref(storage, `reports/${fileName}`);

      const fileData = await FileSystem.readAsStringAsync(media.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const blob = new Blob(
        [decode(fileData)],
        {
          type: media.type === 'video' || media.uri.endsWith('.mp4')
            ? 'video/mp4'
            : 'image/jpeg'
        }
      );

      console.log("🚀 Yükleme başlıyor:", fileName);

      await uploadBytes(mediaRef, blob);
      const downloadURL = await getDownloadURL(mediaRef);

      console.log("✅ Yükleme tamamlandı:", downloadURL);

      await addDoc(collection(db, 'reports'), {
        description,
        mediaUrl: downloadURL,
        mediaType: media.type?.includes('video') || media.uri.endsWith('.mp4') ? 'video' : 'image',
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        createdAt: serverTimestamp(),
        approved: false,
      });

      Alert.alert('✅ Başarılı', 'Olay bildiriminiz gönderildi.');
      setMedia(null);
      setDescription('');
      setLocation(null);
    } catch (error) {
      console.error("❌ Yükleme Hatası:", error);
      Alert.alert('❌ Hata', 'Bildirim gönderilemedi.');
    } finally {
      setIsUploading(false);
    }
  };

  const ActionButton = ({ text, onPress, disabled, isLoading, isFull }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        isFull && { width: '95%' },
        disabled && { opacity: 0.5 },
      ]}
    >
      {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{text}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>📰 Halk Habercisi</Text>

        {media && (
          <View style={styles.card}>
            {media.type === 'video' || media.uri?.endsWith('.mp4') ? (
              <Video source={{ uri: media.uri }} useNativeControls resizeMode="cover" style={styles.media} />
            ) : (
              <Image source={{ uri: media.uri }} style={styles.media} />
            )}
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
          <ActionButton text="📸 Fotoğraf Çek" onPress={takePhoto} disabled={isUploading} />
          <ActionButton text="🎥 Video Çek" onPress={takeVideo} disabled={isUploading} />
        </View>

        <View style={styles.row}>
          <ActionButton text="🖼️ Galeriden Seç" onPress={pickMedia} disabled={isUploading} />
          <ActionButton text="📍 Konum Al" onPress={getLocation} disabled={isUploading} />
        </View>

        <View style={styles.submitContainer}>
          <ActionButton
            text={isUploading ? 'Gönderiliyor...' : '🚀 Gönder'}
            onPress={uploadReport}
            disabled={isUploading}
            isFull
            isLoading={isUploading}
          />
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
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f4f7',
  },
  container: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 12,
  },
  media: {
    width: '100%',
    height: width * 0.6,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
  input: {
    fontSize: 16,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
    backgroundColor: '#1565C0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  submitContainer: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  locationText: {
    marginTop: 14,
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
  },
});

export default ReportScreen;
