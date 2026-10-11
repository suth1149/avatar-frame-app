import React, { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebaseConfig';

const { width } = Dimensions.get('window');
const CANVAS_SIZE = width * 0.85;

const getBlobFromUri = async (uri) => {
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function () {
      reject(new TypeError('Network request failed'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
};

const INITIAL_STICKERS = [
  { id: 's1', uri: require('../assets/stickers/sticker1.png') },
  { id: 's2', uri: require('../assets/stickers/sticker2.png') },
  { id: 's3', uri: require('../assets/stickers/sticker3.png') },
  { id: 's4', uri: require('../assets/stickers/sticker4.png') },
  { id: 's5', uri: require('../assets/stickers/sticker5.png') },
  { id: 's6', uri: require('../assets/stickers/sticker6.png') },
  { id: 's7', uri: require('../assets/stickers/sticker7.png') },
  { id: 's8', uri: require('../assets/stickers/sticker8.png') },
  { id: 's9', uri: require('../assets/stickers/sticker9.png') },
  { id: 's10', uri: require('../assets/stickers/sticker10.png') },
];

function getParamString(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseImportedConfig(value) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(getParamString(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    Alert.alert('Lỗi', 'Cấu hình khung ảnh được chia sẻ không hợp lệ.');
    return null;
  }
}

function getImportedElements(config) {
  if (!Array.isArray(config?.elements)) return [];
  const sourceCanvasSize = Number(config.canvasSize) > 0 ? Number(config.canvasSize) : CANVAS_SIZE;
  const scale = CANVAS_SIZE / sourceCanvasSize;

  return config.elements
    .filter((element) => element && (element.stickerId || typeof element.imageUri === 'string'))
    .map((element, index) => ({
      instanceId: String(element.id || `imported-${index}`),
      stickerId: element.stickerId || null,
      imageUri: typeof element.imageUri === 'string' ? element.imageUri : null,
      x: Number(element.x || 0) * scale,
      y: Number(element.y || 0) * scale,
      size: Number(element.size || (Number(element.scale) || 1) * 70) * scale,
      rotate: Number(element.rotation ?? element.rotate ?? 0),
    }));
}

export default function EditAvatarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [importedConfig] = useState(() => parseImportedConfig(getParamString(params.importedConfig)));
  const initialBackground = importedConfig?.backgroundUri
    || importedConfig?.background?.uri
    || getParamString(params.uri)
    || null;

  const [backgroundUri, setBackgroundUri] = useState(initialBackground);
  const [backgroundImageData, setBackgroundImageData] = useState(null);
  const [availableStickers, setAvailableStickers] = useState(INITIAL_STICKERS);
  const [activeStickers, setActiveStickers] = useState(() => getImportedElements(importedConfig));
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const webDragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialElementX: 0,
    initialElementY: 0,
    instanceId: null,
  });

  const selectedSticker = activeStickers.find((sticker) => sticker.instanceId === selectedInstanceId);

  const handleStickerWheel = (event) => {
    if (Platform.OS !== 'web' || event.deltaX || !event.deltaY) return;
    event.currentTarget.scrollLeft += event.deltaY;
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Thông báo', 'Cần cấp quyền truy cập thư viện để chọn ảnh.');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      return result.canceled ? null : result.assets?.[0] || null;
    } catch (error) {
      Alert.alert('Lỗi', `Không thể chọn ảnh: ${error.message}`);
      return null;
    }
  };

  const handlePickBackground = async () => {
    const asset = await pickImage();
    if (!asset) return;
    setBackgroundUri(asset.uri);
    setBackgroundImageData({
      mimeType: asset.mimeType || 'image/jpeg',
    });
  };

  const handlePickNewSticker = async () => {
    const asset = await pickImage();
    if (!asset) return;

    const newStickerTemplate = {
      id: `custom-${Date.now()}`,
      uri: { uri: asset.uri },
      imageUri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
    };
    setAvailableStickers((previous) => [...previous, newStickerTemplate]);
  };

  const handleAddStickerToCanvas = (stickerTemplate) => {
    const newInstance = {
      instanceId: `${Date.now()}-${Math.random()}`,
      stickerId: stickerTemplate.id.startsWith('custom-') ? null : stickerTemplate.id,
      imageUri: stickerTemplate.imageUri || null,
      mimeType: stickerTemplate.mimeType || null,
      x: 80,
      y: 80,
      size: 70,
      rotate: 0,
    };
    setActiveStickers((previous) => [...previous, newInstance]);
    setSelectedInstanceId(newInstance.instanceId);
  };

  const updateStickerParam = (key, value) => {
    if (!selectedInstanceId) return;
    setActiveStickers((previous) => previous.map((sticker) => (
      sticker.instanceId === selectedInstanceId ? { ...sticker, [key]: value } : sticker
    )));
  };

  const removeSelectedSticker = () => {
    if (!selectedInstanceId) return;
    setActiveStickers((previous) => previous.filter((sticker) => sticker.instanceId !== selectedInstanceId));
    setSelectedInstanceId(null);
  };

  const createPanResponder = (instanceId) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => setSelectedInstanceId(instanceId),
    onPanResponderMove: (event, gestureState) => {
      setActiveStickers((previous) => previous.map((sticker) => {
        if (sticker.instanceId !== instanceId) return sticker;
        return {
          ...sticker,
          x: sticker.x + gestureState.dx - (sticker.lastDx || 0),
          y: sticker.y + gestureState.dy - (sticker.lastDy || 0),
          lastDx: gestureState.dx,
          lastDy: gestureState.dy,
        };
      }));
    },
    onPanResponderRelease: () => {
      setActiveStickers((previous) => previous.map((sticker) => (
        sticker.instanceId === instanceId ? { ...sticker, lastDx: 0, lastDy: 0 } : sticker
      )));
    },
    onPanResponderTerminate: () => {
      setActiveStickers((previous) => previous.map((sticker) => (
        sticker.instanceId === instanceId ? { ...sticker, lastDx: 0, lastDy: 0 } : sticker
      )));
    },
  });

  const handleWebMouseDown = (event, instanceId) => {
    if (Platform.OS !== 'web') return;
    event.stopPropagation();
    setSelectedInstanceId(instanceId);

    const sticker = activeStickers.find((item) => item.instanceId === instanceId);
    if (!sticker) return;

    webDragRef.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialElementX: sticker.x,
      initialElementY: sticker.y,
      instanceId,
    };

    const onMouseMove = (moveEvent) => {
      if (!webDragRef.current.isDragging) return;
      const dx = moveEvent.clientX - webDragRef.current.startX;
      const dy = moveEvent.clientY - webDragRef.current.startY;

      setActiveStickers((previous) => previous.map((item) => (
        item.instanceId === webDragRef.current.instanceId
          ? {
            ...item,
            x: webDragRef.current.initialElementX + dx,
            y: webDragRef.current.initialElementY + dy,
          }
          : item
      )));
    };

    const onMouseUp = () => {
      webDragRef.current.isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const uploadImageData = async (uri, mimeType) => {
    const blob = await getBlobFromUri(uri);
    const filePath = `shared_frames/images/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const storageReference = ref(storage, filePath);
    const upload = await uploadBytes(storageReference, blob, {
      contentType: mimeType || 'image/jpeg',
    });
    return getDownloadURL(upload.ref);
  };

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      const isDeviceUri = (uri) => typeof uri === 'string'
        && /^(file|content|ph|assets-library):/i.test(uri);

      const [sharedBackgroundUri, sharedElements] = await Promise.all([
        backgroundImageData && isDeviceUri(backgroundUri)
          ? uploadImageData(backgroundUri, backgroundImageData.mimeType)
          : Promise.resolve(backgroundUri),
        Promise.all(activeStickers.map(async (sticker) => ({
          stickerId: sticker.stickerId,
          imageUri: isDeviceUri(sticker.imageUri)
            ? await uploadImageData(sticker.imageUri, sticker.mimeType)
            : sticker.imageUri,
          x: sticker.x,
          y: sticker.y,
          rotation: sticker.rotate,
          size: sticker.size,
          scale: sticker.size / 70,
        }))),
      ]);

      const frameConfig = {
        version: 1,
        canvasSize: CANVAS_SIZE,
        backgroundUri: sharedBackgroundUri,
        elements: sharedElements,
      };

      router.push({
        pathname: '/detail',
        params: { frameConfig: JSON.stringify(frameConfig) },
      });
    } catch (error) {
      Alert.alert('Lỗi', `Không thể chuẩn bị ảnh để chia sẻ: ${error.message}`);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Quay lại">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chỉnh sửa khung</Text>
        <TouchableOpacity
          style={[styles.completeButton, isCompleting && styles.disabledButton]}
          onPress={handleComplete}
          disabled={isCompleting}
        >
          {isCompleting
            ? <Text style={styles.completeButtonText}>Đang xử lý...</Text>
            : <Text style={styles.completeButtonText}>Hoàn thành</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.canvasContainer}>
        {backgroundUri ? (
          <Image source={{ uri: backgroundUri }} style={styles.bgImage} />
        ) : (
          <TouchableOpacity style={styles.backgroundPlaceholder} onPress={handlePickBackground}>
            <Ionicons name="image-outline" size={36} color="#888" />
            <Text style={styles.backgroundPlaceholderText}>Chọn ảnh nền</Text>
          </TouchableOpacity>
        )}

        {activeStickers.map((item) => {
          const template = availableStickers.find((sticker) => sticker.id === item.stickerId);
          const source = item.imageUri ? { uri: item.imageUri } : template?.uri;
          if (!source) return null;
          const panResponder = createPanResponder(item.instanceId);

          return (
            <View
              key={item.instanceId}
              {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
              onMouseDown={(event) => handleWebMouseDown(event, item.instanceId)}
              style={[
                styles.stickerItem,
                {
                  transform: [
                    { translateX: item.x },
                    { translateY: item.y },
                    { rotate: `${item.rotate}deg` },
                  ],
                },
              ]}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => setSelectedInstanceId(item.instanceId)}>
                <Image
                  source={source}
                  style={{
                    width: item.size,
                    height: item.size,
                    borderWidth: selectedInstanceId === item.instanceId ? 2 : 0,
                    borderColor: '#007AFF',
                  }}
                />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={styles.toolbar}>
        <View style={styles.toolbarHeader}>
          <Text style={styles.sectionTitle}>Thêm ảnh và sticker vào khung</Text>
          {selectedInstanceId && (
            <TouchableOpacity style={styles.deleteBtn} onPress={removeSelectedSticker}>
              <Ionicons name="trash-outline" size={16} color="#ff3b30" />
              <Text style={styles.deleteText}>Xóa phần tử</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.uploadNotice}>Ảnh cá nhân sẽ được tải lên Firebase khi bấm Hoàn thành để có thể chia sẻ.</Text>

        <View style={styles.addActions}>
          <TouchableOpacity style={styles.addAction} onPress={handlePickBackground}>
            <Ionicons name="image-outline" size={18} color="#007AFF" />
            <Text style={styles.addActionText}>Ảnh nền</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addAction} onPress={handlePickNewSticker}>
            <Ionicons name="add-circle-outline" size={18} color="#007AFF" />
            <Text style={styles.addActionText}>Thêm ảnh</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          onWheel={handleStickerWheel}
          style={styles.stickerRow}
          contentContainerStyle={styles.stickerRowContent}
        >
          {availableStickers.map((sticker) => (
            <TouchableOpacity
              key={sticker.id}
              onPress={() => handleAddStickerToCanvas(sticker)}
              style={styles.stickerThumb}
            >
              <Image source={sticker.uri} style={styles.stickerThumbImage} />
              <View style={styles.plusBadge}>
                <Ionicons name="add" size={10} color="#fff" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedSticker ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.controlScrollRow}>
            <View style={styles.controlCard}>
              <Text style={styles.label}>Xoay: {selectedSticker.rotate}°</Text>
              <View style={styles.sliderActions}>
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={() => updateStickerParam('rotate', selectedSticker.rotate - 15)}
                >
                  <Ionicons name="remove" size={14} color="#333" />
                </TouchableOpacity>
                <View style={styles.barLine} />
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={() => updateStickerParam('rotate', selectedSticker.rotate + 15)}
                >
                  <Ionicons name="add" size={14} color="#333" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.controlCard}>
              <Text style={styles.label}>Kích thước: {selectedSticker.size}px</Text>
              <View style={styles.sliderActions}>
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={() => updateStickerParam('size', Math.max(30, selectedSticker.size - 10))}
                >
                  <Ionicons name="remove" size={14} color="#333" />
                </TouchableOpacity>
                <View style={styles.barLine} />
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={() => updateStickerParam('size', selectedSticker.size + 10)}
                >
                  <Ionicons name="add" size={14} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.hintText}>Chọn ảnh hoặc sticker để thêm vào khung; kéo, xoay và đổi kích thước.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0', paddingTop: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  completeButton: { backgroundColor: '#007AFF', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 8 },
  disabledButton: { opacity: 0.65 },
  completeButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  canvasContainer: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: '#fff',
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
    position: 'relative',
  },
  bgImage: { width: '100%', height: '100%', position: 'absolute' },
  backgroundPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  backgroundPlaceholderText: { color: '#888', fontSize: 14 },
  stickerItem: { position: 'absolute', top: 0, left: 0, ...(Platform.OS === 'web' ? { cursor: 'grab' } : {}) },
  toolbar: {
    backgroundColor: '#fff',
    position: 'absolute',
    bottom: 0,
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 15,
    elevation: 15,
    minHeight: 240,
  },
  toolbarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#666' },
  uploadNotice: { color: '#777', fontSize: 10, marginBottom: 7 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ffe5e5', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  deleteText: { color: '#ff3b30', fontSize: 11, fontWeight: '600' },
  addActions: { flexDirection: 'row', gap: 9, marginBottom: 8 },
  addAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#d7e8ff', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6 },
  addActionText: { color: '#007AFF', fontSize: 12, fontWeight: '600' },
  stickerRow: { height: 60, flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  stickerRowContent: { flexDirection: 'row', alignItems: 'center', paddingRight: 20 },
  stickerThumb: { position: 'relative', padding: 6, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginRight: 10, backgroundColor: '#f9f9f9', width: 50, height: 50, flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
  stickerThumbImage: { width: 35, height: 35, resizeMode: 'contain' },
  plusBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: '#007AFF', borderRadius: 6, width: 12, height: 12, justifyContent: 'center', alignItems: 'center' },
  controlScrollRow: { flexDirection: 'row', gap: 10 },
  controlCard: { width: 150, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 4, color: '#444' },
  sliderActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlBtn: { padding: 4, backgroundColor: '#e0e0e0', borderRadius: 4 },
  barLine: { flex: 1, height: 2, backgroundColor: '#ccc', marginHorizontal: 8, borderRadius: 2 },
  hintText: { fontSize: 11, color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 6 },
});
