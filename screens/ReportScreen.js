import React, { useState } from 'react';
import { View, Button, Image, TextInput, Text, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Video } from 'expo-av';

const ReportScreen = () => {
  const [media, setMedia] = useState(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);

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
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
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

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <TextInput
        placeholder="Olay açıklaması yazınız..."
        value={description}
        onChangeText={setDescription}
        style={{
          borderColor: 'gray',
          borderWidth: 1,
          padding: 10,
          marginBottom: 10,
          borderRadius: 6,
        }}
        multiline
        numberOfLines={4}
      />

      <Button title="📸 Fotoğraf / Video Çek" onPress={takePhoto} />
      <View style={{ marginVertical: 6 }} />
      <Button title="🖼️ Galeriden Seç" onPress={pickMedia} />
      <View style={{ marginVertical: 6 }} />
      <Button title="📍 Konum Al" onPress={getLocation} />

      {media && (
        <View style={{ marginTop: 16 }}>
          {media.type === 'video' || media.uri?.endsWith('.mp4') ? (
            <Video
              source={{ uri: media.uri }}
              rate={1.0}
              volume={1.0}
              isMuted={false}
              resizeMode="cover"
              shouldPlay
              useNativeControls
              style={{ width: '100%', height: 200 }}
            />
          ) : (
            <Image
              source={{ uri: media.uri }}
              style={{ width: '100%', height: 200, borderRadius: 10 }}
            />
          )}
        </View>
      )}

      {location && (
        <Text style={{ marginTop: 10 }}>
          Konum: {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
        </Text>
      )}
    </ScrollView>
  );
};

export default ReportScreen;
