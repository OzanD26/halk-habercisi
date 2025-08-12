// App.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import ReportScreen from './screens/ReportScreen';
import AdminReportsScreen from './screens/AdminReportsScreen';
import NewsScreen from './screens/NewsScreen'; // <-- Haber ekranı

const Tab = createBottomTabNavigator();

function UserTabs() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#1565C0',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 6 },
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
    </NavigationContainer>
  );
}

export default function App() {
  const [mode, setMode] = useState(null); // 'user' veya 'admin'

  if (!mode) {
    // Giriş modu seçme ekranı
    return (
      <SafeAreaProvider>
        <View style={styles.container}>
          <Text style={styles.title}>📰 Halk Habercisi</Text>

          <TouchableOpacity style={styles.button} onPress={() => setMode('user')}>
            <Text style={styles.buttonText}>👤 Kullanıcı Olarak Devam Et</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#444' }]}
            onPress={() => setMode('admin')}
          >
            <Text style={styles.buttonText}>🔑 Admin Girişi</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {mode === 'user'
        ? <UserTabs />
        : <AdminReportsScreen onBack={() => setMode(null)} />
      }
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f0f4f7', padding: 20
  },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 40, color: '#333' },
  button: {
    backgroundColor: '#1565C0',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 10,
    width: '80%'
  },
  buttonText: { color: '#fff', fontSize: 16, textAlign: 'center', fontWeight: '600' }
});
