import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const imageUri = params.uri; // Nhận ảnh được truyền sang

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi Tiết Ảnh</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Hiển thị phóng to bức ảnh */}
      <View style={styles.imageContainer}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.fullImage} resizeMode="contain" />
        ) : (
          <Text style={styles.noImageText}>Không tìm thấy ảnh</Text>
        )}
      </View>

      {/* Nút quay lại trang chủ */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.homeButton} onPress={() => router.push('/')}>
          <Ionicons name="home" size={20} color="#fff" />
          <Text style={styles.homeBtnText}>Về Màn Hình Chính</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  backBtn: { padding: 4 },
  imageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  fullImage: { width: width * 0.9, height: width * 0.9, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  noImageText: { color: '#888', fontSize: 15 },
  footer: { padding: 20, alignItems: 'center' },
  homeButton: { flexDirection: 'row', backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, alignItems: 'center', gap: 8 },
  homeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' }
});