import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Avatar Frame</Text>
      <Text style={styles.subtitle}>Tạo khung ảnh của riêng bạn hoặc quét mã QR để xem khung được chia sẻ.</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/edit-avatar')}>
        <Ionicons name="create-outline" size={22} color="#fff" />
        <Text style={styles.buttonText}>Tạo Frame Mới</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/scanner')}>
        <Ionicons name="qr-code-outline" size={22} color="#007AFF" />
        <Text style={styles.secondaryButtonText}>Quét mã QR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: 24,
  },
  title: { color: '#222', fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#666', fontSize: 15, lineHeight: 22, marginBottom: 32, textAlign: 'center' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 14,
    paddingHorizontal: 24,
    paddingVertical: 15,
    width: '100%',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#007AFF',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 15,
    width: '100%',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '700' },
});
