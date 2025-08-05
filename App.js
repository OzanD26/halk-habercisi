import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReportScreen from './screens/ReportScreen';
import { getStorage, ref, uploadBytes } from 'firebase/storage';


export default function App() {
  return (
    <SafeAreaProvider>
      <ReportScreen />
    </SafeAreaProvider>
  );
}
