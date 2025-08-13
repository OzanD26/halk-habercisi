// App.js
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import ReportScreen from './screens/ReportScreen';
import AdminReportsScreen from './screens/AdminReportsScreen';
import NewsScreen from './screens/NewsScreen';

const Tab = createBottomTabNavigator();

// ---- Tema renkleri (Demirören uyumlu)
const palette = {
  primary: '#E30613', // Demirören kırmızısı
  light: {
    bg: '#F7F7F9',
    card: '#FFFFFF',
    border: '#E6E8EC',
    text: '#222222',
    textMuted: '#666A70',
    tabInactive: '#94A3B8',
  },
  dark: {
    bg: '#0E0F12',
    card: '#16181D',
    border: '#2A2D34',
    text: '#E6E8EA',
    textMuted: '#A5ABB3',
    tabInactive: '#7C8796',
  },
};

// ---- React Navigation tema nesneleri
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

function UserTabs({ colorScheme }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: '#A5ABB3', // pasif gri
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
          backgroundColor: '#16181D', // ✅ sabit koyu renk
          borderTopColor: '#2A2D34',
          borderTopWidth: 1,
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
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setMode] = useState(null); // 'user' | 'admin'
  const colorScheme = systemScheme ?? 'light';
  const navTheme = useMemo(() => makeNavTheme(colorScheme), [colorScheme]);
  const c = colorScheme === 'dark' ? palette.dark : palette.light;

  if (!mode) {
    // Giriş modu seçme ekranı (tema uyumlu)
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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navTheme}>
        {mode === 'user'
          ? <UserTabs colorScheme={colorScheme} />
          : <AdminReportsScreen onBack={() => setMode(null)} />
        }
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  landingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  landingTitle: { fontSize: 26, fontWeight: '800', marginBottom: 40 },
  landingButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  landingButtonText: { color: '#fff', fontSize: 16, textAlign: 'center', fontWeight: '700' },
});
