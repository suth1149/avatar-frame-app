import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isFetching, setIsFetching] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const fetchInProgress = useRef(false);

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      await requestPermission();
    } catch (error) {
      Alert.alert('Lỗi', `Không thể yêu cầu quyền camera: ${error.message}`);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleBarcodeScanned = async ({ data }) => {
    const documentId = typeof data === 'string' ? data.trim() : '';
    if (!documentId || fetchInProgress.current) return;

    fetchInProgress.current = true;
    setIsFetching(true);
    try {
      const frameSnapshot = await getDoc(doc(db, 'shared_frames', documentId));
      if (!frameSnapshot.exists()) {
        Alert.alert('Không tìm thấy', 'Mã QR này không liên kết với khung ảnh được chia sẻ.');
        fetchInProgress.current = false;
        setIsFetching(false);
        return;
      }

      router.push({
        pathname: '/edit-avatar',
        params: { importedConfig: JSON.stringify(frameSnapshot.data()) },
      });
    } catch (error) {
      Alert.alert('Lỗi', `Không thể tải khung ảnh: ${error.message}`);
      fetchInProgress.current = false;
      setIsFetching(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.permissionScreen}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.permissionText}>Đang kiểm tra quyền camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Ionicons name="camera-outline" size={54} color="#007AFF" />
        <Text style={styles.permissionTitle}>Cần quyền truy cập camera</Text>
        <Text style={styles.permissionText}>Cho phép camera để quét mã QR của khung ảnh.</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={handleRequestPermission}
          disabled={isRequestingPermission}
        >
          {isRequestingPermission
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.permissionButtonText}>Cấp quyền camera</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={isFetching ? undefined : handleBarcodeScanned}
      />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Quay lại">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Quét mã QR</Text>
        <View style={styles.backButton} />
      </View>
      <View pointerEvents="none" style={styles.scanOverlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.instruction}>Đưa mã QR vào giữa khung hình</Text>
      </View>
      {isFetching ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Đang tải khung ảnh...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 48,
    paddingBottom: 14,
  },
  backButton: { width: 34, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 260, height: 260, borderColor: '#fff', borderWidth: 3, borderRadius: 18 },
  instruction: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    fontSize: 14,
    marginTop: 20,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  loadingText: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 12 },
  permissionScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', padding: 28 },
  permissionTitle: { color: '#222', fontSize: 20, fontWeight: '700', marginTop: 18, textAlign: 'center' },
  permissionText: { color: '#666', fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: 'center' },
  permissionButton: {
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 22,
    minWidth: 180,
    minHeight: 48,
    paddingHorizontal: 18,
  },
  permissionButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
