import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  BounceIn,
  FadeIn,
  FadeOut,
  Extrapolation,
  LinearTransition,
  interpolate,
  interpolateColor,
  useDerivedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  ZoomOut,
} from 'react-native-reanimated';
import ActionLoadingModal from '../components/ActionLoadingModal';

const { width } = Dimensions.get('window');
const CANVAS_SIZE = width * 0.85;
const STICKER_THUMB_WIDTH = 50;
const STICKER_THUMB_MARGIN = 10;
const STICKER_ITEM_STRIDE = STICKER_THUMB_WIDTH + STICKER_THUMB_MARGIN;
const TRASH_X = CANVAS_SIZE / 2;
const TRASH_Y = CANVAS_SIZE - 36;

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

const assetToDataUri = async (asset) => {
  if (!asset) return null;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      const fallbackUri = asset.base64
        ? (asset.base64.startsWith('data:')
          ? asset.base64
          : `data:image/jpeg;base64,${asset.base64}`)
        : asset.uri || null;
      const img = new window.Image();
      img.onload = () => {
        const MAX_SIZE = 500;
        let targetW = img.width || MAX_SIZE;
        let targetH = img.height || MAX_SIZE;
        if (targetW > MAX_SIZE || targetH > MAX_SIZE) {
          if (targetW > targetH) {
            targetH = Math.round((targetH * MAX_SIZE) / targetW);
            targetW = MAX_SIZE;
          } else {
            targetW = Math.round((targetW * MAX_SIZE) / targetH);
            targetH = MAX_SIZE;
          }
        }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fallbackUri);
          return;
        }

        try {
          const MAX_DATA_URI_BYTES = 40 * 1024;
          let dataUri;
          while (true) {
            canvas.width = targetW;
            canvas.height = targetH;
            ctx.drawImage(img, 0, 0, targetW, targetH);

            for (let quality = 0.6; quality >= 0.2; quality -= 0.1) {
              dataUri = canvas.toDataURL('image/jpeg', quality);
              const base64Length = dataUri.length - dataUri.indexOf(',') - 1;
              if (Math.ceil((base64Length * 3) / 4) < MAX_DATA_URI_BYTES) {
                resolve(dataUri);
                return;
              }
            }

            if (targetW <= 128 && targetH <= 128) {
              resolve(dataUri);
              return;
            }
            targetW = Math.max(128, Math.round(targetW * 0.75));
            targetH = Math.max(128, Math.round(targetH * 0.75));
          }
        } catch (error) {
          resolve(fallbackUri);
        }
      };
      img.onerror = () => resolve(fallbackUri);
      img.src = asset.uri;
    });
  }

  if (asset.base64) {
    return asset.base64.startsWith('data:')
      ? asset.base64
      : `data:image/jpeg;base64,${asset.base64}`;
  }
  return asset.uri || null;
};

function CanvasSticker({ item, source, selected, panHandlers, onMouseDown, onSelect }) {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(item.rotate);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  useEffect(() => {
    rotation.value = withSpring(item.rotate);
    if (selected) {
      scale.value = withSequence(
        withSpring(1.08),
        withSpring(1),
      );
    }
  }, [item.rotate, item.size, rotation, scale, selected]);

  return (
    <Animated.View
      entering={BounceIn.duration(350)}
      exiting={ZoomOut.duration(200)}
      {...panHandlers}
      onMouseDown={onMouseDown}
      style={[
        styles.stickerItem,
        {
          transform: [
            { translateX: item.x },
            { translateY: item.y },
          ],
        },
      ]}
    >
      <Animated.View style={animatedStyle}>
        <TouchableOpacity activeOpacity={1} onPress={onSelect}>
          <Image
            source={source}
            style={{
              width: item.size,
              height: item.size,
              borderWidth: selected ? 2 : 0,
              borderColor: '#007AFF',
            }}
          />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

function DockStickerThumb({ sticker, index, scrollX, activeThumbIndex, onPress }) {
  const animatedStyle = useAnimatedStyle(() => {
    const viewportCenter = (width - 30) / 2;
    const itemCenter = index * STICKER_ITEM_STRIDE + STICKER_THUMB_WIDTH / 2;
    const distanceFromCenter = Math.abs(itemCenter - scrollX.value - viewportCenter);
    const centerFocus = interpolate(
      distanceFromCenter,
      [0, STICKER_ITEM_STRIDE / 2, STICKER_ITEM_STRIDE, STICKER_ITEM_STRIDE * 2.5],
      [1, 1, 0.5, 0],
      Extrapolation.CLAMP,
    );
    const distanceFromActive = activeThumbIndex.value < 0
      ? Number.POSITIVE_INFINITY
      : Math.abs(index - activeThumbIndex.value);
    const hoverFocus = distanceFromActive <= 2
      ? interpolate(distanceFromActive, [0, 1, 2], [1, 0.5, 0], Extrapolation.CLAMP)
      : 0;
    const focus = Math.max(centerFocus, hoverFocus);

    return {
      opacity: interpolate(focus, [0, 0.35, 1], [0.75, 1, 1], Extrapolation.CLAMP),
      transform: [
        { scale: interpolate(focus, [0, 0.5, 1], [0.88, 1.1, 1.25], Extrapolation.CLAMP) },
        { translateY: interpolate(focus, [0, 0.5, 1], [0, -3, -6], Extrapolation.CLAMP) },
      ],
    };
  });
  const handlePressIn = () => {
    activeThumbIndex.value = index;
  };
  const handlePressOut = () => {
    activeThumbIndex.value = -1;
  };

  return (
    <Animated.View
      layout={LinearTransition.springify()}
      style={[styles.stickerThumb, animatedStyle]}
      onMouseEnter={Platform.OS === 'web' ? handlePressIn : undefined}
      onMouseLeave={Platform.OS === 'web' ? handlePressOut : undefined}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Image source={sticker.uri} style={styles.stickerThumbImage} />
        <View style={styles.plusBadge}>
          <Ionicons name="add" size={10} color="#fff" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function parseImportedConfig(value) {
  if (!value) return null;

  try {
    const raw = decodeURIComponent(getParamString(value));
    const parsed = JSON.parse(raw);
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
  const [availableStickers, setAvailableStickers] = useState(INITIAL_STICKERS);
  const [activeStickers, setActiveStickers] = useState(() => getImportedElements(importedConfig));
  const [selectedInstanceId, setSelectedInstanceId] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isDraggingSticker, setIsDraggingSticker] = useState(false);
  const trashProximity = useSharedValue(0);
  const scrollX = useSharedValue(0);
  const activeThumbIndex = useSharedValue(-1);
  const trashZoneScale = useDerivedValue(() => (
    interpolate(trashProximity.value, [0, 1], [1, 1.28], Extrapolation.CLAMP)
  ));
  const nativeDragRef = useRef(null);
  const webDragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialElementX: 0,
    initialElementY: 0,
    x: 0,
    y: 0,
    size: 0,
    instanceId: null,
  });

  const selectedSticker = activeStickers.find((sticker) => sticker.instanceId === selectedInstanceId);

  const stickerScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });
  const animatedCanvasStyle = useAnimatedStyle(() => ({
    borderColor: isDraggingSticker
      ? interpolateColor(trashProximity.value, [0, 0.5, 1], ['#007AFF', '#FF9500', '#FF3B30'])
      : '#ccc',
    borderWidth: isDraggingSticker ? 2.5 : 1,
  }));
  const animatedTrashStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      trashProximity.value,
      [0, 0.5, 1],
      ['rgba(0, 122, 255, 0.85)', 'rgba(255, 149, 0, 0.92)', 'rgba(255, 59, 48, 1)'],
    ),
    transform: [{ scale: trashZoneScale.value }],
  }));

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
        quality: 0.25,
        base64: true,
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
    const dataUri = await assetToDataUri(asset);
    setBackgroundUri(dataUri);
  };

  const handlePickNewSticker = async () => {
    const asset = await pickImage();
    if (!asset) return;

    const dataUri = await assetToDataUri(asset);
    const newStickerTemplate = {
      id: `custom-${Date.now()}`,
      uri: { uri: dataUri },
      imageUri: dataUri,
    };
    setAvailableStickers((previous) => [...previous, newStickerTemplate]);
  };

  const handleAddStickerToCanvas = (stickerTemplate) => {
    const newInstance = {
      instanceId: `${Date.now()}-${Math.random()}`,
      stickerId: stickerTemplate.id.startsWith('custom-') ? null : stickerTemplate.id,
      imageUri: stickerTemplate.imageUri || null,
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

  const calculateTrashProximity = (stickerX, stickerY, stickerSize) => {
    const centerX = stickerX + stickerSize / 2;
    const centerY = stickerY + stickerSize / 2;
    const distance = Math.hypot(centerX - TRASH_X, centerY - TRASH_Y);
    return Math.max(0, Math.min(1, (160 - distance) / (160 - 45)));
  };

  const finishDrag = (instanceId, shouldDelete) => {
    if (shouldDelete) {
      setActiveStickers((previous) => previous.filter((sticker) => sticker.instanceId !== instanceId));
      setSelectedInstanceId(null);
    }
    setIsDraggingSticker(false);
    trashProximity.value = withSpring(0);
    nativeDragRef.current = null;
  };

  const createPanResponder = (instanceId) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      const sticker = activeStickers.find((item) => item.instanceId === instanceId);
      if (!sticker) return;
      nativeDragRef.current = { x: sticker.x, y: sticker.y, size: sticker.size };
      setSelectedInstanceId(instanceId);
      trashProximity.value = calculateTrashProximity(sticker.x, sticker.y, sticker.size);
      setIsDraggingSticker(true);
    },
    onPanResponderMove: (event, gestureState) => {
      const drag = nativeDragRef.current;
      if (!drag) return;
      drag.x += gestureState.dx - (drag.lastDx || 0);
      drag.y += gestureState.dy - (drag.lastDy || 0);
      drag.lastDx = gestureState.dx;
      drag.lastDy = gestureState.dy;
      trashProximity.value = calculateTrashProximity(drag.x, drag.y, drag.size);
      setActiveStickers((previous) => previous.map((sticker) => (
        sticker.instanceId === instanceId
          ? { ...sticker, x: drag.x, y: drag.y }
          : sticker
      )));
    },
    onPanResponderRelease: () => {
      const drag = nativeDragRef.current;
      if (drag) finishDrag(instanceId, trashProximity.value > 0.78);
    },
    onPanResponderTerminate: () => {
      const drag = nativeDragRef.current;
      if (drag) finishDrag(instanceId, false);
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
      x: sticker.x,
      y: sticker.y,
      size: sticker.size,
      instanceId,
    };
    trashProximity.value = calculateTrashProximity(sticker.x, sticker.y, sticker.size);
    setIsDraggingSticker(true);

    const onMouseMove = (moveEvent) => {
      if (!webDragRef.current.isDragging) return;
      const dx = moveEvent.clientX - webDragRef.current.startX;
      const dy = moveEvent.clientY - webDragRef.current.startY;
      const x = webDragRef.current.initialElementX + dx;
      const y = webDragRef.current.initialElementY + dy;
      webDragRef.current.x = x;
      webDragRef.current.y = y;
      trashProximity.value = calculateTrashProximity(x, y, webDragRef.current.size);

      setActiveStickers((previous) => previous.map((item) => (
        item.instanceId === webDragRef.current.instanceId
          ? {
            ...item,
            x,
            y,
          }
          : item
      )));
    };

    const onMouseUp = () => {
      const drag = webDragRef.current;
      webDragRef.current.isDragging = false;
      if (drag.instanceId === instanceId) {
        finishDrag(instanceId, trashProximity.value > 0.78);
      }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleComplete = async () => {
    if (isCompleting) return;
    setIsCompleting(true);
    try {
      const frameConfig = {
        version: 1,
        canvasSize: CANVAS_SIZE,
        backgroundUri: backgroundUri || null,
        elements: activeStickers.map((sticker) => ({
          stickerId: sticker.stickerId || null,
          imageUri: sticker.imageUri || null,
          x: Number(sticker.x || 0),
          y: Number(sticker.y || 0),
          rotation: Number(sticker.rotate || 0),
          size: Number(sticker.size || 70),
          scale: Number(sticker.size || 70) / 70,
        })),
      };

      router.push({
        pathname: '/detail',
        params: { frameConfig: encodeURIComponent(JSON.stringify(frameConfig)) },
      });
    } catch (error) {
      const serverResponse = error?.customData?.serverResponse;
      const details = [
        error?.code,
        error?.message || String(error),
        typeof serverResponse === 'string' ? serverResponse.slice(0, 300) : null,
      ].filter(Boolean).join('\n');
      Alert.alert('Lỗi', `Không thể chuẩn bị ảnh để chia sẻ:\n${details}`);
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

      <Animated.View style={[styles.canvasContainer, animatedCanvasStyle]}>
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
            <CanvasSticker
              key={item.instanceId}
              item={item}
              source={source}
              selected={selectedInstanceId === item.instanceId}
              panHandlers={Platform.OS !== 'web' ? panResponder.panHandlers : undefined}
              onMouseDown={(event) => handleWebMouseDown(event, item.instanceId)}
              onSelect={() => setSelectedInstanceId(item.instanceId)}
            />
          );
        })}
        {isDraggingSticker ? (
          <Animated.View style={[styles.trashZone, animatedTrashStyle]} pointerEvents="none">
            <Ionicons name="trash-outline" size={22} color="#fff" />
            <Text style={styles.trashZoneText}>Thả để xóa</Text>
          </Animated.View>
        ) : null}
      </Animated.View>

      <Animated.View style={styles.toolbar} layout={LinearTransition.springify()}>
        <Animated.View style={styles.toolbarHeader} layout={LinearTransition.springify()}>
          <Text style={styles.sectionTitle}>Thêm ảnh và sticker vào khung</Text>
          {selectedInstanceId && (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <TouchableOpacity style={styles.deleteBtn} onPress={removeSelectedSticker}>
                <Ionicons name="trash-outline" size={16} color="#ff3b30" />
                <Text style={styles.deleteText}>Xóa phần tử</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>

        <Text style={styles.uploadNotice}>Ảnh cá nhân được đóng gói trực tiếp trong cấu hình khung để chia sẻ.</Text>

        <Animated.View style={styles.addActions} layout={LinearTransition.springify()}>
          <TouchableOpacity style={styles.addAction} onPress={handlePickBackground}>
            <Ionicons name="image-outline" size={18} color="#007AFF" />
            <Text style={styles.addActionText}>Ảnh nền</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addAction} onPress={handlePickNewSticker}>
            <Ionicons name="add-circle-outline" size={18} color="#007AFF" />
            <Text style={styles.addActionText}>Thêm ảnh</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator
          onScroll={stickerScrollHandler}
          scrollEventThrottle={16}
          onWheel={handleStickerWheel}
          style={styles.stickerRow}
          contentContainerStyle={styles.stickerRowContent}
        >
          {availableStickers.map((sticker, index) => (
            <DockStickerThumb
              key={sticker.id}
              sticker={sticker}
              index={index}
              scrollX={scrollX}
              activeThumbIndex={activeThumbIndex}
              onPress={() => handleAddStickerToCanvas(sticker)}
            />
          ))}
        </Animated.ScrollView>

        {selectedSticker ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition.springify()}
          >
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.controlScrollRow}
            >
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
            </Animated.ScrollView>
          </Animated.View>
        ) : (
          <Text style={styles.hintText}>Chọn ảnh hoặc sticker để thêm vào khung; kéo, xoay và đổi kích thước.</Text>
        )}
      </Animated.View>
      <ActionLoadingModal
        visible={isCompleting}
        title="Đang khởi tạo khung ảnh..."
        subtitle="Đang đóng gói bố cục và hình ảnh của bạn"
        iconName="color-wand-outline"
      />
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
  trashZone: {
    position: 'absolute',
    bottom: 10,
    left: '50%',
    marginLeft: -62,
    width: 124,
    height: 50,
    alignItems: 'center',
    borderColor: '#cbd5e1',
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  trashZoneText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
  stickerRow: { height: 72, flexGrow: 0, flexShrink: 0, marginBottom: 8 },
  stickerRowContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 20 },
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
