import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Dùng state để lưu giữ lại ảnh kết quả, tránh bị mất khi chuyển qua lại các màn hình
  const [savedImageUri, setSavedImageUri] = useState(null);

  useEffect(() => {
    if (params.resultUri) {
      setSavedImageUri(params.resultUri);
    }
  }, [params.resultUri]);

  const pickImage = async (useCamera = false) => {
    let permissionResult = useCamera 
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert("Thông báo", "Bạn cần cấp quyền để sử dụng tính năng này!");
      return;
    }

    let result = useCamera 
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
      
    if (!result.canceled) {
      router.push({
        pathname: '/edit-avatar',
        params: { uri: result.assets[0].uri }
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>avata frame</Text>
      
      {/* Khung hiển thị ảnh kết quả: Nhấp vào ảnh sẽ chuyển qua trang chi tiết */}
      <View style={styles.frameBox}>
        {savedImageUri ? (
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={() => router.push({ pathname: '/detail', params: { uri: savedImageUri } })}
            style={{ width: '100%', height: '100%' }}
          >
            <Image source={{ uri: savedImageUri }} style={styles.resultImage} />
          </TouchableOpacity>
        ) : (
          <Text style={styles.frameText}>Chưa có ảnh nào được tạo</Text>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.addButton} onPress={() => pickImage(false)}>
          <Ionicons name="images" size={20} color="#fff" />
          <Text style={styles.btnText}>Thư Viện</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.addButton, styles.cameraBtn]} onPress={() => pickImage(true)}>
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={styles.btnText}>Chụp Ảnh</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  frameBox: { width: 280, height: 280, borderWidth: 2, borderColor: '#333', borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', marginBottom: 30, overflow: 'hidden' },
  frameText: { color: '#888', fontSize: 14 },
  resultImage: { width: '100%', height: '100%' },
  buttonRow: { flexDirection: 'row', gap: 15 },
  addButton: { flexDirection: 'row', backgroundColor: '#007AFF', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center', gap: 8 },
  cameraBtn: { backgroundColor: '#34C759' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' }
});