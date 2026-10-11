import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection } from 'firebase/firestore';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import { db } from '../firebaseConfig';

const { width } = Dimensions.get('window');
const PREVIEW_SIZE = Math.min(width * 0.9, 420);

const STICKER_SOURCES = {
  s1: require('../assets/stickers/sticker1.png'),
  s2: require('../assets/stickers/sticker2.png'),
  s3: require('../assets/stickers/sticker3.png'),
  s4: require('../assets/stickers/sticker4.png'),
  s5: require('../assets/stickers/sticker5.png'),
  s6: require('../assets/stickers/sticker6.png'),
  s7: require('../assets/stickers/sticker7.png'),
  s8: require('../assets/stickers/sticker8.png'),
  s9: require('../assets/stickers/sticker9.png'),
  s10: require('../assets/stickers/sticker10.png'),
};

function getParamString(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFrameConfig(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(getParamString(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

function getElementSource(element) {
  if (element.stickerId && STICKER_SOURCES[element.stickerId]) {
    return STICKER_SOURCES[element.stickerId];
  }
  return typeof element.imageUri === 'string' ? { uri: element.imageUri } : null;
}

export default function DetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const frameConfig = useMemo(() => parseFrameConfig(params.frameConfig), [params.frameConfig]);
  const frameRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedDocumentId, setSharedDocumentId] = useState(null);

  const backgroundUri = frameConfig?.backgroundUri || frameConfig?.background?.uri;
  const elements = Array.isArray(frameConfig?.elements) ? frameConfig.elements : [];
  const sourceCanvasSize = Number(frameConfig?.canvasSize) > 0 ? Number(frameConfig.canvasSize) : PREVIEW_SIZE;
  const previewScale = PREVIEW_SIZE / sourceCanvasSize;

  const handleSave = async () => {
    if (!frameConfig || !frameRef.current) {
      Alert.alert('Lỗi', 'Không có khung ảnh hợp lệ để lưu.');
      return;
    }

    setIsSaving(true);
    try {
      if (Platform.OS === 'web') {
        const imageUri = await captureRef(frameRef.current, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        const link = document.createElement('a');
        link.href = imageUri;
        link.download = 'avatar-frame.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Alert.alert('Đã lưu', 'Ảnh khung đã được tải xuống.');
        return;
      }

      const MediaLibrary = require('expo-media-library');
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        Alert.alert('Thiếu quyền', 'Bạn cần cấp quyền lưu ảnh vào thư viện.');
        return;
      }

      const imageUri = await captureRef(frameRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await MediaLibrary.Asset.create(imageUri);
      Alert.alert('Thành công', 'Khung ảnh đã được lưu vào thư viện.');
    } catch (error) {
      Alert.alert('Lỗi', `Không thể lưu ảnh: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    if (!frameConfig) {
      Alert.alert('Lỗi', 'Không có cấu hình khung ảnh hợp lệ để chia sẻ.');
      return;
    }
    if (sharedDocumentId) return;

    setIsSharing(true);
    try {
      const document = await addDoc(collection(db, 'shared_frames'), frameConfig);
      setSharedDocumentId(document.id);
    } catch (error) {
      Alert.alert('Lỗi', `Không thể chia sẻ khung ảnh: ${error.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.backButton} accessibilityLabel="Quay lại">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Xem trước khung</Text>
        <View style={styles.headerSpacer} />
      </View>

      {frameConfig ? (
        <View
          ref={frameRef}
          collapsable={false}
          style={styles.frame}
          accessibilityLabel="Bản xem trước khung ảnh"
        >
          {backgroundUri ? (
            <Image source={{ uri: backgroundUri }} style={styles.background} resizeMode="cover" />
          ) : null}
          {elements.map((element, index) => {
            const source = getElementSource(element);
            if (!source) return null;
            const size = Number(element.size || (Number(element.scale) || 1) * 70) * previewScale;
            const x = Number(element.x || 0) * previewScale;
            const y = Number(element.y || 0) * previewScale;
            const rotation = Number(element.rotation ?? element.rotate ?? 0);

            return (
              <Image
                key={element.id || `${element.stickerId || 'image'}-${index}`}
                source={source}
                resizeMode="contain"
                style={[
                  styles.element,
                  {
                    left: x,
                    top: y,
                    width: size,
                    height: size,
                    transform: [{ rotate: `${rotation}deg` }],
                  },
                ]}
              />
            );
          })}
        </View>
      ) : (
        <Text style={styles.errorText}>Không tìm thấy cấu hình khung ảnh.</Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.saveButton, isSaving && styles.disabledButton]}
          onPress={handleSave}
          disabled={isSaving || isSharing}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="download-outline" size={19} color="#fff" />
              <Text style={styles.actionText}>Lưu</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton, (isSharing || sharedDocumentId) && styles.disabledButton]}
          onPress={handleShare}
          disabled={isSaving || isSharing || Boolean(sharedDocumentId)}
        >
          {isSharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="share-social-outline" size={19} color="#fff" />
              <Text style={styles.actionText}>{sharedDocumentId ? 'Đã chia sẻ' : 'Share'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {sharedDocumentId ? (
        <View style={styles.qrSection}>
          <Text style={styles.qrTitle}>Quét mã QR để mở khung ảnh</Text>
          <View style={styles.qrContainer}>
            <QRCode value={sharedDocumentId} size={190} />
          </View>
          <Text style={styles.documentId}>Mã khung: {sharedDocumentId}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', backgroundColor: '#f8f9fa', padding: 18, paddingTop: 42 },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerSpacer: { width: 32 },
  frame: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    backgroundColor: '#fff',
    borderColor: '#ddd',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  background: { width: '100%', height: '100%', position: 'absolute' },
  element: { position: 'absolute' },
  errorText: { color: '#b00020', marginVertical: 30, textAlign: 'center' },
  actions: { width: '100%', flexDirection: 'row', gap: 12, marginTop: 20 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 10 },
  saveButton: { backgroundColor: '#28a745' },
  shareButton: { backgroundColor: '#007AFF' },
  disabledButton: { opacity: 0.65 },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  qrSection: { alignItems: 'center', marginTop: 24, marginBottom: 30 },
  qrTitle: { color: '#333', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  qrContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  documentId: { color: '#666', fontSize: 12, marginTop: 10 },
});
