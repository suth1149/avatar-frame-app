import React, { useEffect, useRef, useState } from 'react';
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
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { db } from '../firebaseConfig';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isFetching, setIsFetching] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const fetchInProgress = useRef(false);
  const laserPosition = useSharedValue(10);
  const frameScale = useSharedValue(1);
  const frameBorderProgress = useSharedValue(0);

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: laserPosition.value }],
  }));
  const scanFrameStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      frameBorderProgress.value,
      [0, 1],
      ['#fff', '#28a745'],
    ),
    transform: [{ scale: frameScale.value }],
  }));

  useEffect(() => {
    laserPosition.value = withRepeat(
      withTiming(245, { duration: 1600 }),
      -1,
      true,
    );

    return () => cancelAnimation(laserPosition);
  }, [laserPosition]);

  useEffect(() => {
    if (isFetching) {
      frameScale.value = withSpring(0.92);
      frameBorderProgress.value = withTiming(1, { duration: 180 });
    } else {
      frameScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 900 }),
          withTiming(1, { duration: 900 }),
        ),
        -1,
        false,
      );
      frameBorderProgress.value = withTiming(0, { duration: 180 });
    }

    return () => cancelAnimation(frameScale);
  }, [frameBorderProgress, frameScale, isFetching]);

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

      fetchInProgress.current = false;
      setIsFetching(false);
      router.replace({
        pathname: '/edit-avatar',
        params: { importedConfig: encodeURIComponent(JSON.stringify(frameSnapshot.data())) },
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
      {isFetching ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Đang tải khung ảnh...</Text>
        </View>
      ) : null}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Quay lại">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Quét mã QR</Text>
        <View style={styles.backButton} />
      </View>
      <View pointerEvents="none" style={styles.scanOverlay}>
        <Animated.View style={[styles.scanFrame, scanFrameStyle]}>
          {!isFetching ? (
            <Animated.View style={[styles.laserLine, laserStyle]} />
          ) : null}
        </Animated.View>
        <Text style={styles.instruction}>Đưa mã QR vào giữa khung hình</Text>
      </View>
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
  scanFrame: {
    width: 260,
    height: 260,
    borderColor: '#fff',
    borderWidth: 3,
    borderRadius: 18,
    overflow: 'hidden',
  },
  laserLine: {
    position: 'absolute',
    left: '4%',
    top: 0,
    width: '92%',
    height: 3,
    backgroundColor: '#00E5FF',
    borderRadius: 2,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
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
