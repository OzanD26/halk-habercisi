// screens/AuthScreen.js
import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { signInWithPhoneNumber, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const colors = {
  bg: '#0E0F12',
  card: '#16181D',
  border: '#2A2D34',
  text: '#E6E8EA',
  textMuted: '#A5ABB3',
  primary: '#E30613',
  outline: '#2F333B',
};

export default function AuthScreen() {
  const recaptchaRef = useRef(null);

  // ❗ saf JS; TS generics yok
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState(''); // +90XXXXXXXXXX
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const sendCode = async () => {
    const p = (phone || '').trim();
    if (!p.startsWith('+') || p.length < 10) {
      Alert.alert('Telefon Hatası', 'Lütfen telefon numaranı uluslararası formatta gir (+90XXXXXXXXXX).');
      return;
    }
    if (mode === 'register' && fullName.trim().length < 3) {
      Alert.alert('Ad Soyad', 'Lütfen ad soyad gir.');
      return;
    }
    try {
      setSending(true);
      const conf = await signInWithPhoneNumber(auth, p, recaptchaRef.current);
      setConfirmation(conf);
      Alert.alert('SMS Gönderildi', 'Telefonuna gelen doğrulama kodunu gir.');
    } catch (e) {
      Alert.alert('Gönderim Hatası', e?.message || 'Kod gönderilemedi.');
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async () => {
    if (!confirmation) return;
    if (code.trim().length < 4) {
      Alert.alert('Kod Hatası', 'Doğrulama kodunu gir.');
      return;
    }
    try {
      setVerifying(true);
      const cred = await confirmation.confirm(code.trim());
      const user = cred.user;

      if (mode === 'register') {
        try {
          if (fullName.trim()) {
            await updateProfile(user, { displayName: fullName.trim() });
          }
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            fullName: fullName.trim(),
            phone: user.phoneNumber,
            createdAt: serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.log('profile/write err:', e?.message);
        }
      } else {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            fullName: user.displayName || '',
            phone: user.phoneNumber,
            createdAt: serverTimestamp(),
          }, { merge: true });
        }
      }

      // başarılı doğrulama → App.js onAuthStateChanged ile sekmelere geçilir
    } catch (e) {
      Alert.alert('Doğrulama Hatası', e?.message || 'Kod hatalı olabilir.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.root}>
      {/* reCAPTCHA */}
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={auth.app.options}
        attemptInvisibleVerification
      />

      <View style={styles.card}>
        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => setMode('register')} style={[styles.tab, mode === 'register' && styles.tabActive]}>
            <Text style={[styles.tabTxt, mode === 'register' && styles.tabTxtActive]}>Kayıt Ol</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('login')} style={[styles.tab, mode === 'login' && styles.tabActive]}>
            <Text style={[styles.tabTxt, mode === 'login' && styles.tabTxtActive]}>Giriş Yap</Text>
          </TouchableOpacity>
        </View>

        {mode === 'register' && (
          <>
            <Text style={styles.label}>Ad Soyad</Text>
            <TextInput
              placeholder="Örn: Deniz Yılmaz"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
            />
          </>
        )}

        <Text style={styles.label}>Telefon</Text>
        <TextInput
          placeholder="+90XXXXXXXXXX"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
        />

        {!confirmation ? (
          <TouchableOpacity style={[styles.btn, sending && { opacity: 0.7 }]} onPress={sendCode} disabled={sending}>
            <Text style={styles.btnTxt}>{mode === 'register' ? 'SMS Kodu Gönder' : 'Giriş Kodu Gönder'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text style={styles.label}>SMS Kodu</Text>
            <TextInput
              placeholder="6 haneli kod"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={styles.input}
              value={code}
              onChangeText={setCode}
            />
            <TouchableOpacity style={[styles.btn, verifying && { opacity: 0.7 }]} onPress={verifyCode} disabled={verifying}>
              <Text style={styles.btnTxt}>Doğrula</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => { setConfirmation(null); setCode(''); }} style={styles.linkBtn}>
              <Text style={styles.linkTxt}>Kodu almak için geri dön</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.note}>
        Devam ederek telefon numaranla doğrulama yapılacağını onaylıyorsun.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: 16, justifyContent: 'center' },
  card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden', marginBottom: 14 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: 'transparent' },
  tabActive: { backgroundColor: colors.primary },
  tabTxt: { color: colors.textMuted, fontWeight: '800' },
  tabTxtActive: { color: '#fff' },
  label: { color: colors.text, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: '#0F1116', color: colors.text, borderWidth: 1, borderColor: colors.outline,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12
  },
  btn: { backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', paddingVertical: 14, marginTop: 14 },
  btnTxt: { color: '#fff', fontWeight: '800' },
  linkBtn: { alignItems: 'center', marginTop: 10 },
  linkTxt: { color: colors.textMuted, textDecorationLine: 'underline' },
  note: { marginTop: 12, color: colors.textMuted, textAlign: 'center' },
});
