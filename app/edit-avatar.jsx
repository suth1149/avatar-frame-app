import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, ScrollView, Dimensions, Alert, Platform, PanResponder } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { captureRef } from 'react-native-view-shot';

const { width } = Dimensions.get('window');

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

export default function EditAvatarScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const backgroundUri = params.uri;
  const viewRef = useRef();

  const [availableStickers, setAvailableStickers] = useState(INITIAL_STICKERS);
  const [activeStickers, setActiveStickers] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);

  // Lưu trữ vị trí bắt đầu kéo trên Web để tính delta chính xác
  const webDragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialElementX: 0, initialElementY: 0, instanceId: null });

  const selectedSticker = activeStickers.find(s => s.instanceId === selectedInstanceId);

  // Sửa lỗi lấy ảnh từ thư viện không hiển thị sau khi crop/chọn
  const handlePickNewSticker = async () => {
    let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Thông báo", "Cần cấp quyền truy cập thư viện để thêm sticker!");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedAsset = result.assets[0];
      const newStickerTemplate = {
        id: Date.now().toString(),
        uri: { uri: selectedAsset.uri } // Chuẩn hóa cú pháp { uri: '...' } cho Image component
      };
      setAvailableStickers(prev => [...prev, newStickerTemplate]);
    }
  };

  const handleAddStickerToCanvas = (stickerTemplate) => {
    const newInstance = {
      instanceId: Date.now().toString() + Math.random().toString(),
      uri: stickerTemplate.uri,
      x: 80,
      y: 80,
      size: 70,
      rotate: 0,
    };
    setActiveStickers(prev => [...prev, newInstance]);
    setSelectedInstanceId(newInstance.instanceId);
  };

  const updateStickerParam = (key, value) => {
    if (!selectedInstanceId) return;
    setActiveStickers(prev => prev.map(s => s.instanceId === selectedInstanceId ? { ...s, [key]: value } : s));
  };

  const removeSelectedSticker = () => {
    if (!selectedInstanceId) return;
    setActiveStickers(prev => prev.filter(s => s.instanceId !== selectedInstanceId));
    setSelectedInstanceId(null);
  };

  // Cấu hình PanResponder tối ưu cho Mobile (Điện thoại)
  const createPanResponder = (instanceId) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setSelectedInstanceId(instanceId);
      },
      onPanResponderMove: (evt, gestureState) => {
        setActiveStickers(prev =>
          prev.map(s => {
            if (s.instanceId === instanceId) {
              return {
                ...s,
                x: s.x + gestureState.dx - (s.lastDx || 0),
                y: s.y + gestureState.dy - (s.lastDy || 0),
                lastDx: gestureState.dx,
                lastDy: gestureState.dy,
              };
            }
            return s;
          })
        );
      },
      onPanResponderRelease: () => {
        setActiveStickers(prev =>
          prev.map(s => s.instanceId === instanceId ? { ...s, lastDx: 0, lastDy: 0 } : s)
        );
      },
      onPanResponderTerminate: () => {
        setActiveStickers(prev =>
          prev.map(s => s.instanceId === instanceId ? { ...s, lastDx: 0, lastDy: 0 } : s)
        );
      }
    });
  };

  // Xử lý kéo thả bằng chuột trên Laptop (Web) mượt mà, không bị mất lệnh khi chuột ra ngoài
  const handleWebMouseDown = (e, instanceId) => {
    if (Platform.OS !== 'web') return;
    e.stopPropagation();
    setSelectedInstanceId(instanceId);

    const sticker = activeStickers.find(s => s.instanceId === instanceId);
    if (!sticker) return;

    webDragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialElementX: sticker.x,
      initialElementY: sticker.y,
      instanceId: instanceId
    };

    const onMouseMove = (moveEvent) => {
      if (!webDragRef.current.isDragging) return;
      const dx = moveEvent.clientX - webDragRef.current.startX;
      const dy = moveEvent.clientY - webDragRef.current.startY;

      setActiveStickers(prev =>
        prev.map(s => {
          if (s.instanceId === webDragRef.current.instanceId) {
            return {
              ...s,
              x: webDragRef.current.initialElementX + dx,
              y: webDragRef.current.initialElementY + dy
            };
          }
          return s;
        })
      );
    };

    const onMouseUp = () => {
      webDragRef.current.isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleSaveAndReturn = async () => {
      try {
          let finalUri = backgroundUri;

          if (Platform.OS !== 'web') {
              const MediaLibrary = await import('expo-media-library');
              const permission = await MediaLibrary.requestPermissionsAsync();
              
              if (permission.granted) {
                  finalUri = await captureRef(viewRef, {
                      format: 'png',
                      quality: 1,
                      result: 'tmpfile',
                  });
                  await MediaLibrary.saveToLibraryAsync(finalUri);
              } else {
                  Alert.alert("Thông báo", "Cần cấp quyền lưu ảnh vào thư viện!");
                  return;
              }
          } else {
              // Hỗ trợ chụp màn hình trên web hoặc thông báo
              try {
                  finalUri = await captureRef(viewRef, {
                      format: 'png',
                      quality: 1,
                  });
              } catch (err) {
                  console.log("Web capture note:", err);
              }
              Alert.alert("Thông báo", "Đã lưu trạng thái khung ảnh thành công!");
          }

          router.replace({
              pathname: '/',
              params: { resultUri: finalUri }
          });
      } catch (error) {
          Alert.alert("Lỗi", "Không thể lưu ảnh: " + error.message);
      }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>avata frame</Text>
        <TouchableOpacity style={styles.downloadBtn} onPress={handleSaveAndReturn}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View ref={viewRef} style={styles.canvasContainer} collapsable={false}>
        {backgroundUri ? (
          <Image source={{ uri: backgroundUri }} style={styles.bgImage} />
        ) : null}

        {activeStickers.map((item) => {
          const panResponder = createPanResponder(item.instanceId);
          return (
            <View
              key={item.instanceId}
              {...(Platform.OS !== 'web' ? panResponder.panHandlers : {})}
              onMouseDown={(e) => handleWebMouseDown(e, item.instanceId)}
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
                  source={typeof item.uri === 'string' ? { uri: item.uri } : item.uri}
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
          <Text style={styles.sectionTitle}>Kho Element (.png) - Vuốt để xem đủ các mẫu</Text>
          {selectedInstanceId && (
            <TouchableOpacity style={styles.deleteBtn} onPress={removeSelectedSticker}>
              <Ionicons name="trash-outline" size={16} color="#ff3b30" />
              <Text style={styles.deleteText}>Xóa phần tử</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={true}
          style={styles.stickerRow} 
          contentContainerStyle={styles.stickerRowContainer}
        >
          <TouchableOpacity onPress={handlePickNewSticker} style={styles.addStickerFolderBtn}>
            <View style={styles.circlePlus}>
              <Ionicons name="add" size={18} color="#007AFF" />
            </View>
            <Text style={styles.addFolderText}>Thêm .png</Text>
          </TouchableOpacity>

          {availableStickers.map((sticker) => (
            <TouchableOpacity
              key={sticker.id}
              onPress={() => handleAddStickerToCanvas(sticker)}
              style={styles.stickerThumb}
            >
              <Image source={sticker.uri} style={{ width: 35, height: 35, resizeMode: 'contain' }} />
              <View style={styles.plusBadge}>
                <Ionicons name="add" size={10} color="#fff" />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedInstanceId ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.controlScrollRow}>
            <View style={styles.controlCard}>
              <Text style={styles.label}>Rotate: {selectedSticker?.rotate}°</Text>
              <View style={styles.sliderActions}>
                <TouchableOpacity style={styles.controlBtn} onPress={() => updateStickerParam('rotate', selectedSticker.rotate - 15)}>
                  <Ionicons name="remove" size={14} color="#333" />
                </TouchableOpacity>
                <View style={styles.barLine} />
                <TouchableOpacity style={styles.controlBtn} onPress={() => updateStickerParam('rotate', selectedSticker.rotate + 15)}>
                  <Ionicons name="add" size={14} color="#333" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.controlCard}>
              <Text style={styles.label}>Size: {selectedSticker?.size}px</Text>
              <View style={styles.sliderActions}>
                <TouchableOpacity style={styles.controlBtn} onPress={() => updateStickerParam('size', Math.max(30, selectedSticker.size - 10))}>
                  <Ionicons name="remove" size={14} color="#333" />
                </TouchableOpacity>
                <View style={styles.barLine} />
                <TouchableOpacity style={styles.controlBtn} onPress={() => updateStickerParam('size', selectedSticker.size + 10)}>
                  <Ionicons name="add" size={14} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.hintText}>💡 Vuốt sang phải để xem trọn bộ sticker và bấm chọn đưa vào khung</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0', paddingTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  downloadBtn: { backgroundColor: '#007AFF', padding: 8, borderRadius: 8 },
  canvasContainer: { width: width * 0.85, height: width * 0.85, backgroundColor: '#fff', alignSelf: 'center', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#ccc', position: 'relative' },
  bgImage: { width: '100%', height: '100%', position: 'absolute' },
  stickerItem: { position: 'absolute', top: 0, left: 0, ...(Platform.OS === 'web' ? { cursor: 'grab' } : {}) },
  toolbar: { backgroundColor: '#fff', position: 'absolute', bottom: 0, width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 15, elevation: 15, minHeight: 210 },
  toolbarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#666' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ffe5e5', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  deleteText: { color: '#ff3b30', fontSize: 11, fontWeight: '600' },
  
  stickerRow: { flexDirection: 'row', marginBottom: 10, minHeight: 60 },
  stickerRowContainer: { alignItems: 'center', paddingRight: 20 },

  addStickerFolderBtn: { width: 50, height: 50, borderWidth: 1, borderColor: '#007AFF', borderStyle: 'dashed', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10, backgroundColor: '#f0f8ff' },
  circlePlus: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e1f0ff', justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  addFolderText: { fontSize: 9, color: '#007AFF', fontWeight: 'bold' },
  stickerThumb: { position: 'relative', padding: 6, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginRight: 10, backgroundColor: '#f9f9f9', width: 50, height: 50, justifyContent: 'center', alignItems: 'center' },
  plusBadge: { position: 'absolute', bottom: 2, right: 2, backgroundColor: '#007AFF', borderRadius: 6, width: 12, height: 12, justifyContent: 'center', alignItems: 'center' },
  controlScrollRow: { flexDirection: 'row', gap: 10 },
  controlCard: { width: 150, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 4, color: '#444' },
  sliderActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlBtn: { padding: 4, backgroundColor: '#e0e0e0', borderRadius: 4 },
  barLine: { flex: 1, height: 2, backgroundColor: '#ccc', marginHorizontal: 8, borderRadius: 2 },
  hintText: { fontSize: 11, color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 8 }
});