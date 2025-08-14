// App.js
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import ReportScreen from './screens/ReportScreen';
import AdminReportsScreen from './screens/AdminReportsScreen';
import NewsScreen from './screens/NewsScreen';
import AuthScreen from './screens/AuthScreen';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

const Tab = createBottomTabNavigator();

const palette = {
  primary: '#E30613',
  light: { bg: '#F7F7F9', card: '#FFFFFF', border: '#E6E8EC', text: '#222222' },
  dark:  { bg: '#0E0F12', card: '#16181D', border: '#2A2D34', text: '#E6E8EA' },
};

function makeNavTheme(colorScheme) {
  const c = colorScheme === 'dark' ? palette.dark : palette.light;
  return {
    ...(colorScheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(colorScheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: palette.primary,
      background: c.bg,
      card: c.card,
      border: c.border,
      text: c.text,
      notification: palette.primary,
    },
  };
}

function UserTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: '#A5ABB3',
        tabBarStyle: {
          height: 60, paddingBottom: 8, paddingTop: 6,
          backgroundColor: '#16181D', borderTopColor: '#2A2D34', borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Anasayfa') return <Ionicons name="home" size={size} color={color} />;
          if (route.name === 'Haber') return <Ionicons name="newspaper" size={size} color={color} />;
          return null;
        },
      })}
    >
      <Tab.Screen name="Anasayfa" component={ReportScreen} />
      <Tab.Screen name="Haber" component={NewsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const systemScheme = useColorScheme();
  const colorScheme = systemScheme ?? 'light';
  const navTheme = useMemo(() => makeNavTheme(colorScheme), [colorScheme]);

  const [mode, setMode] = useState(null);          // 'user' | 'admin'
  const [user, setUser] = useState(null);          // Firebase user (anon olabilir)
  const [remember, setRemember] = useState(false); // Beni hatırla tercihi
  const [bootReady, setBootReady] = useState(false); // ✅ “hazır” bayrağı

  // Auth dinleyici
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return unsub;
  }, []);

  // rememberMe oku (her durumda bootReady = true yapılır)
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem('rememberMe');
        setRemember(v === 'true');
      } catch (e) {
        setRemember(false);
      } finally {
        setBootReady(true);
      }
    })();
  }, []);

  // Uygulama ilk açıldığında yalnız bir kez kısa loading göster
  if (!bootReady && mode === null) {
    return (
      <SafeAreaProvider>
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Yükleniyor…</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // Mod seçimi ekranı
  if (!mode) {
    const c = colorScheme === 'dark' ? palette.dark : palette.light;
    return (
      <SafeAreaProvider>
        <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
        <View style={[styles.landingContainer, { backgroundColor: c.bg }]}>
          <Text style={[styles.landingTitle, { color: c.text }]}>📰 Halk Habercisi</Text>

          <TouchableOpacity
            style={[styles.landingButton, { backgroundColor: palette.primary }]}
            onPress={() => setMode('user')}
          >
            <Text style={styles.landingButtonText}>👤 Kullanıcı Olarak Devam Et</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.landingButton, { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 }]}
            onPress={() => setMode('admin')}
          >
            <Text style={[styles.landingButtonText, { color: c.text }]}>🔑 Admin Girişi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  // Kullanıcı modu: anonim kullanıcıyı girişli sayma
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navTheme}>
        {mode === 'user'
          ? (
              (user && !user.isAnonymous)
                ? (remember ? <UserTabs /> : <AuthScreen />) // remember kapalıysa AuthScreen göster
                : <AuthScreen />
            )
          : <AdminReportsScreen onBack={() => setMode(null)} />
        }
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  landingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  landingTitle: { fontSize: 26, fontWeight: '800', marginBottom: 40 },
  landingButton: {
    paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12,
    marginVertical: 10, width: '80%', alignItems: 'center',
  },
  landingButtonText: { color: '#fff', fontSize: 16, textAlign: 'center', fontWeight: '700' },
});
