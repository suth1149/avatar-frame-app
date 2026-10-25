import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
} from 'firebase/firestore';
import Animated, {
  BounceIn,
  Extrapolation,
  FadeInDown,
  Keyframe,
  LinearTransition,
  ZoomOut,
  cancelAnimation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { db } from '../firebaseConfig';

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

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'background', label: 'Có ảnh nền' },
  { id: 'stickers', label: 'Nhiều Sticker' },
];

const CAROUSEL_COLORS = ['#E3F2FD', '#FCE4EC', '#FFF3E0', '#E8F5E9', '#F3E5F5'];
const MODAL_CONTENT_ENTERING = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 12 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }] },
}).duration(360);

function getElementSource(element) {
  if (element.stickerId && STICKER_SOURCES[element.stickerId]) {
    return STICKER_SOURCES[element.stickerId];
  }
  return typeof element.imageUri === 'string' ? { uri: element.imageUri } : null;
}

function getFrameElements(item) {
  return Array.isArray(item.elements) ? item.elements : [];
}

function getBackgroundUri(item) {
  return item.backgroundUri || item.background?.uri || null;
}

function FramePreview({ item, size, modal = false }) {
  const { width } = useWindowDimensions();
  const elements = getFrameElements(item);
  const backgroundUri = getBackgroundUri(item);
  const sourceCanvasSize = Number(item.canvasSize) > 0
    ? Number(item.canvasSize)
    : modal ? 300 : width * 0.85;
  const previewScale = size / sourceCanvasSize;

  return (
    <View
      style={[
        modal ? styles.modalPreviewBox : styles.preview,
        {
          width: Number(size) > 0 ? size : 220,
          height: Number(size) > 0 ? size : 220,
          minWidth: Number(size) > 0 ? size : 220,
          minHeight: Number(size) > 0 ? size : 220,
          maxWidth: Number(size) > 0 ? size : 220,
          maxHeight: Number(size) > 0 ? size : 220,
          position: 'relative',
          overflow: 'hidden',
          alignSelf: 'center',
          flexShrink: 0,
        },
      ]}
    >
      {backgroundUri ? (
        <Image
          source={{ uri: backgroundUri }}
          resizeMode="cover"
          style={styles.previewBackground}
        />
      ) : (
        <View style={styles.previewPlaceholder}>
          <Ionicons name="image-outline" size={28} color="#b6bdc8" />
        </View>
      )}
      {elements.map((element, index) => {
        const source = getElementSource(element);
        if (!source) return null;

        const elementSize = Number(element.size) > 0
          ? Number(element.size)
          : (Number(element.scale) || 1) * 70;
        const x = Number(element.x) || 0;
        const y = Number(element.y) || 0;
        const rotation = Number(element.rotation ?? element.rotate) || 0;

        return (
          <Image
            key={element.id || `${element.stickerId || 'image'}-${index}`}
            source={source}
            resizeMode="contain"
            style={[
              styles.previewElement,
              {
                left: x * previewScale,
                top: y * previewScale,
                width: elementSize * previewScale,
                height: elementSize * previewScale,
                transform: [{ rotate: `${rotation}deg` }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function AnimatedCollectionCard({
  item,
  index,
  cardWidth,
  layoutMode,
  isJiggleMode,
  onLongPress,
  onPress,
  onDelete,
  isDeleting,
  entering,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const jiggleAngle = useSharedValue(0);
  const elements = getFrameElements(item);
  const gridPreviewSize = Math.max(80, Math.min((windowWidth - 48) / 2 - 20, 155));
  const previewSize = layoutMode === 'grid'
    ? gridPreviewSize
    : layoutMode === 'list'
      ? Math.min(200, windowWidth * 0.48)
      : Math.max(cardWidth - 24, 80);
  const cardWidthStyle = layoutMode === 'grid'
    ? '48%'
    : layoutMode === 'list'
      ? '100%'
      : cardWidth;
  const title = item.title || item.name || 'Khung ảnh';

  const jiggleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${jiggleAngle.value}deg` }],
  }));

  useEffect(() => {
    if (isJiggleMode) {
      jiggleAngle.value = withRepeat(
        withSequence(
          withTiming(-2.2, { duration: 90 }),
          withTiming(2.2, { duration: 90 }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(jiggleAngle);
      jiggleAngle.value = withSpring(0);
    }

    return () => cancelAnimation(jiggleAngle);
  }, [isJiggleMode, jiggleAngle]);

  return (
    <Animated.View
      entering={entering}
      exiting={ZoomOut.duration(220)}
      layout={LinearTransition.springify().damping(16).stiffness(120)}
      style={[
        styles.card,
        { width: cardWidthStyle },
        layoutMode === 'list' && styles.listCard,
        jiggleStyle,
      ]}
    >
      <Pressable
        onLongPress={onLongPress}
        onPress={() => {
          if (!isJiggleMode) onPress?.(item);
        }}
        delayLongPress={350}
        style={[
          styles.cardContent,
          layoutMode === 'list' && styles.listCardContent,
        ]}
      >
        <FramePreview item={item} size={previewSize} />

        <View style={styles.cardMetadata}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.cardDetail}>
            {elements.length} sticker{elements.length === 1 ? '' : 's'}
          </Text>
          {layoutMode === 'list' ? (
            <Text style={styles.cardDetail}>
              {(item?.backgroundUri || item?.background?.uri) ? 'Có ảnh nền' : 'Không có ảnh nền'}            </Text>
          ) : null}
        </View>
      </Pressable>

      {isJiggleMode ? (
        <Pressable
          accessibilityLabel={`Xóa ${title}`}
          disabled={isDeleting}
          onPress={() => onDelete(item)}
          style={styles.deleteButton}
        >
          <Animated.View
            entering={BounceIn}
            exiting={ZoomOut.duration(160)}
            style={styles.deleteButtonInner}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="close" size={18} color="#fff" />
            )}
          </Animated.View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

function Carousel3DCard({
  item,
  index,
  scrollX,
  cardWidth,
  onLongPress,
  onPress,
  isJiggleMode,
  onDelete,
  isDeleting,
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * cardWidth,
      index * cardWidth,
      (index + 1) * cardWidth,
    ];
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.82, 1, 0.82],
      Extrapolation.CLAMP,
    );
    const rotateY = interpolate(
      scrollX.value,
      inputRange,
      [35, 0, -35],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [22, 0, 22],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.6, 1, 0.6],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [
        { perspective: 1100 },
        { translateY },
        { scale },
        { rotateY: `${rotateY}deg` },
      ],
    };
  });

  return (
    <Animated.View
      exiting={ZoomOut.duration(220)}
      style={[styles.carouselCardSlot, { width: cardWidth }, animatedStyle]}
    >
      <AnimatedCollectionCard
        item={item}
        index={index}
        cardWidth={cardWidth}
        layoutMode="carousel"
        isJiggleMode={isJiggleMode}
        onLongPress={onLongPress}
        onPress={onPress}
        onDelete={onDelete}
        isDeleting={isDeleting}
        entering={FadeInDown.delay(index * 70).springify()}
      />
    </Animated.View>
  );
}

export default function CollectionScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const CARD_WIDTH = Math.min(windowWidth * 0.72, 280);
  const CARD_ITEM_SIZE = CARD_WIDTH;
  const SPACING = (windowWidth - CARD_WIDTH) / 2;
  const flatListRef = useRef(null);
  const carouselDragRef = useRef({
    active: false,
    startX: 0,
    startOffset: 0,
    lastOffset: 0,
    moved: false,
  });
  const ignoreCarouselClickUntil = useRef(0);
  const [frames, setFrames] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [layoutMode, setLayoutMode] = useState('grid');
  const [isJiggleMode, setIsJiggleMode] = useState(false);
  const [deletingIds, setDeletingIds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [showSelectedFrameQr, setShowSelectedFrameQr] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselScrollX = useSharedValue(0);
  const modalProgress = useSharedValue(0);
  const onCarouselScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      carouselScrollX.value = event.contentOffset.x;
    },
  });

  const loadFrames = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const snapshot = await getDocs(collection(db, 'shared_frames'));
      setFrames(snapshot.docs.map((frameDocument) => ({
        id: frameDocument.id,
        ...frameDocument.data(),
      })));
    } catch (error) {
      setLoadError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFrames();
  }, [loadFrames]);

  const filteredFrames = useMemo(() => frames.filter((item) => {
    if (activeFilter === 'background') return Boolean(getBackgroundUri(item));
    if (activeFilter === 'stickers') return getFrameElements(item).length >= 3;
    return true;
  }), [activeFilter, frames]);
  const activeProgress = useDerivedValue(() => carouselScrollX.value / CARD_WIDTH);
  const carouselColors = filteredFrames.map(
    (_, index) => CAROUSEL_COLORS[index % CAROUSEL_COLORS.length],
  );
  const carouselBackgroundStyle = useAnimatedStyle(() => {
    if (carouselColors.length < 2) {
      return { backgroundColor: carouselColors[0] || CAROUSEL_COLORS[0] };
    }

    const lastColorIndex = carouselColors.length - 1;
    const colorProgress = interpolate(
      activeProgress.value,
      [0, lastColorIndex],
      [0, lastColorIndex],
      Extrapolation.CLAMP,
    );
    return {
      backgroundColor: interpolateColor(
        colorProgress,
        carouselColors.map((_, index) => index),
        carouselColors,
      ),
    };
  });
  const modalBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(modalProgress.value, [0, 1], [0, 1]),
  }));
  const modalCardStyle = useAnimatedStyle(() => {
    const progress = modalProgress.value;
    return {
      opacity: progress,
      transform: [
        { perspective: 1000 },
        { translateY: interpolate(progress, [0, 1], [60, 0]) },
        { scale: interpolate(progress, [0, 1], [0.6, 1]) },
        { rotateX: `${interpolate(progress, [0, 1], [15, 0])}deg` },
      ],
    };
  });

  useEffect(() => {
    carouselScrollX.value = 0;
    setCarouselIndex(0);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [activeFilter, carouselScrollX, layoutMode, CARD_ITEM_SIZE]);

  useEffect(() => {
    const lastIndex = Math.max(filteredFrames.length - 1, 0);
    if (carouselIndex > lastIndex) {
      setCarouselIndex(lastIndex);
      flatListRef.current?.scrollToOffset({
        offset: lastIndex * CARD_ITEM_SIZE,
        animated: false,
      });
    }
  }, [CARD_ITEM_SIZE, carouselIndex, filteredFrames.length]);

  const goToCarouselIndex = useCallback((index) => {
    const targetIndex = Math.max(0, Math.min(index, filteredFrames.length - 1));
    setCarouselIndex(targetIndex);
    flatListRef.current?.scrollToOffset({
      offset: targetIndex * CARD_ITEM_SIZE,
      animated: true,
    });
  }, [CARD_ITEM_SIZE, filteredFrames.length]);

  const handleCarouselScrollEnd = useCallback((event) => {
    const offset = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.max(
      0,
      Math.min(Math.round(offset / CARD_ITEM_SIZE), filteredFrames.length - 1),
    );
    setCarouselIndex(nextIndex);
  }, [CARD_ITEM_SIZE, filteredFrames.length]);

  const handleCarouselMouseDown = useCallback((event) => {
    if (Platform.OS !== 'web' || (event.nativeEvent?.button ?? event.button) !== 0) return;

    const scrollNode = flatListRef.current?.getScrollableNode?.()
      || flatListRef.current?.getNativeScrollRef?.();
    const startOffset = scrollNode?.scrollLeft ?? carouselIndex * CARD_ITEM_SIZE;
    const startX = event.nativeEvent?.clientX ?? event.clientX;
    if (typeof startX !== 'number') return;

    carouselDragRef.current = {
      active: true,
      startX,
      startOffset,
      lastOffset: startOffset,
      moved: false,
    };
  }, [CARD_ITEM_SIZE, carouselIndex]);

  const handleCarouselMouseMove = useCallback((event) => {
    if (Platform.OS !== 'web' || !carouselDragRef.current.active) return;
    const clientX = event.nativeEvent?.clientX ?? event.clientX;
    if (typeof clientX !== 'number') return;

    const offset = Math.max(
      0,
      carouselDragRef.current.startOffset - (clientX - carouselDragRef.current.startX),
    );
    if (Math.abs(clientX - carouselDragRef.current.startX) > 5) {
      carouselDragRef.current.moved = true;
    }
    carouselDragRef.current.lastOffset = offset;
    flatListRef.current?.scrollToOffset({ offset, animated: false });
    event.preventDefault?.();
  }, []);

  const handleCarouselMouseUp = useCallback(() => {
    if (Platform.OS !== 'web' || !carouselDragRef.current.active) return;
    carouselDragRef.current.active = false;
    if (carouselDragRef.current.moved) {
      ignoreCarouselClickUntil.current = Date.now() + 250;
    }
    const targetIndex = Math.max(
      0,
      Math.min(
        Math.round(carouselDragRef.current.lastOffset / CARD_ITEM_SIZE),
        filteredFrames.length - 1,
      ),
    );
    goToCarouselIndex(targetIndex);
  }, [CARD_ITEM_SIZE, filteredFrames.length, goToCarouselIndex]);

  const handleCarouselCardPress = useCallback((item) => {
    if (Date.now() < ignoreCarouselClickUntil.current) return;
    setSelectedFrame(item);
  }, []);

  useEffect(() => {
    if (!selectedFrame) return;
    setShowSelectedFrameQr(false);
    modalProgress.value = withSpring(1, { damping: 15, stiffness: 110 });
  }, [modalProgress, selectedFrame]);

  const clearSelectedFrame = useCallback(() => {
    setSelectedFrame(null);
  }, []);

  const closeFrameModal = useCallback(() => {
    modalProgress.value = withTiming(0, { duration: 180 }, (finished) => {
      if (finished) runOnJS(clearSelectedFrame)();
    });
  }, [clearSelectedFrame, modalProgress]);

  const useSelectedTemplate = useCallback(() => {
    if (!selectedFrame) return;
    const importedConfig = encodeURIComponent(JSON.stringify(selectedFrame));
    modalProgress.value = 0;
    setSelectedFrame(null);
    router.push({ pathname: '/edit-avatar', params: { importedConfig } });
  }, [modalProgress, router, selectedFrame]);

  const handleDelete = useCallback(async (item) => {
    if (deletingIds.includes(item.id)) return;
    setDeletingIds((current) => [...current, item.id]);
    try {
      await deleteDoc(doc(db, 'shared_frames', item.id));
      setFrames((current) => current.filter((frame) => frame.id !== item.id));
    } catch (error) {
      Alert.alert('Lỗi', `Không thể xóa khung ảnh: ${error.message}`);
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== item.id));
    }
  }, [deletingIds]);

  const cardWidth = layoutMode === 'carousel' ? CARD_WIDTH : windowWidth - 32;
  const nextLayoutMode = layoutMode === 'grid'
    ? 'list'
    : layoutMode === 'list'
      ? 'carousel'
      : 'grid';
  const currentLayoutLabel = layoutMode === 'grid'
    ? 'Lưới 2 cột'
    : layoutMode === 'list'
      ? 'Danh sách'
      : '3D Carousel';
  const MODAL_PREVIEW_SIZE = Math.min(windowWidth - 80, 260);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Quay lại"
          onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
          style={styles.headerIconButton}
        >
          <Ionicons name="arrow-back" size={23} color="#263238" />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Bộ Sưu Tập Khung</Text>
          <Text style={styles.headerSubtitle}>{frames.length} khung được chia sẻ</Text>
        </View>
        <Pressable
          accessibilityLabel={`Chế độ hiện tại: ${currentLayoutLabel}. Nhấn để chuyển chế độ.`}
          onPress={() => setLayoutMode(nextLayoutMode)}
          style={styles.modeButton}
        >
          <Ionicons
            name={layoutMode === 'grid'
              ? 'grid-outline'
              : layoutMode === 'list'
                ? 'list-outline'
                : 'albums-outline'}
            size={18}
            color="#5b4acc"
          />
          <Text style={styles.modeButtonText}>{currentLayoutLabel}</Text>
        </Pressable>
        <Pressable
          onPress={() => setIsJiggleMode((current) => !current)}
          style={[styles.manageButton, isJiggleMode && styles.manageButtonActive]}
        >
          <Text style={[styles.manageButtonText, isJiggleMode && styles.manageButtonTextActive]}>
            {isJiggleMode ? 'Xong' : 'Quản lý'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={{ flexGrow: 0, minHeight: 48, marginBottom: 8 }}
      >
        {FILTERS.map((filter) => (
          <Pressable
            key={filter.id}
            onPress={() => setActiveFilter(filter.id)}
            style={[
              styles.filterTab,
              activeFilter === filter.id && styles.filterTabActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter.id && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#6C5CE7" />
          <Text style={styles.stateText}>Đang tải bộ sưu tập...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.stateContainer}>
          <Ionicons name="cloud-offline-outline" size={38} color="#98a1ad" />
          <Text style={styles.stateTitle}>Không thể tải bộ sưu tập</Text>
          <Text style={styles.stateText}>{loadError.message}</Text>
          <Pressable onPress={loadFrames} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : filteredFrames.length === 0 ? (
        <View style={styles.stateContainer}>
          <Ionicons name="images-outline" size={42} color="#aab2bd" />
          <Text style={styles.stateTitle}>Chưa có khung ảnh phù hợp</Text>
          <Text style={styles.stateText}>Hãy thử bộ lọc khác hoặc quay lại sau.</Text>
        </View>
      ) : layoutMode === 'carousel' ? (
        <Animated.View
          style={[styles.carouselContainer, carouselBackgroundStyle]}
          onMouseMove={Platform.OS === 'web' ? handleCarouselMouseMove : undefined}
          onMouseUp={Platform.OS === 'web' ? handleCarouselMouseUp : undefined}
          onMouseLeave={Platform.OS === 'web' ? handleCarouselMouseUp : undefined}
        >
          <Animated.FlatList
            ref={flatListRef}
            horizontal
            data={filteredFrames}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <Carousel3DCard
                item={item}
                index={index}
                scrollX={carouselScrollX}
                cardWidth={CARD_WIDTH}
                isJiggleMode={isJiggleMode}
                onLongPress={() => setIsJiggleMode((current) => !current)}
                onPress={handleCarouselCardPress}
                onDelete={handleDelete}
                isDeleting={deletingIds.includes(item.id)}
              />
            )}
            onScroll={onCarouselScroll}
            onScrollEndDrag={handleCarouselScrollEnd}
            onMomentumScrollEnd={handleCarouselScrollEnd}
            onMouseDown={Platform.OS === 'web' ? handleCarouselMouseDown : undefined}
            scrollEventThrottle={16}
            snapToInterval={CARD_ITEM_SIZE}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            scrollEnabled
            nestedScrollEnabled
            style={styles.carouselList}
            contentContainerStyle={{
              paddingHorizontal: (windowWidth - CARD_WIDTH) / 2,
              alignItems: 'center',
            }}
            getItemLayout={(_, index) => ({
              length: CARD_ITEM_SIZE,
              offset: CARD_ITEM_SIZE * index,
              index,
            })}
            removeClippedSubviews={false}
          />
          <Pressable
            accessibilityLabel="Khung trước"
            disabled={carouselIndex <= 0}
            onPress={() => goToCarouselIndex(carouselIndex - 1)}
            style={[
              styles.carouselArrow,
              styles.carouselArrowLeft,
              carouselIndex <= 0 && styles.carouselArrowDisabled,
            ]}
          >
            <Ionicons name="chevron-back" size={22} color="#4d456f" />
          </Pressable>
          <Pressable
            accessibilityLabel="Khung tiếp theo"
            disabled={carouselIndex >= filteredFrames.length - 1}
            onPress={() => goToCarouselIndex(carouselIndex + 1)}
            style={[
              styles.carouselArrow,
              styles.carouselArrowRight,
              carouselIndex >= filteredFrames.length - 1 && styles.carouselArrowDisabled,
            ]}
          >
            <Ionicons name="chevron-forward" size={22} color="#4d456f" />
          </Pressable>
        </Animated.View>
      ) : (
        <ScrollView contentContainerStyle={styles.cardsContainer}>
          <View style={styles.cardsWrap}>
            {filteredFrames.map((item, index) => (
              <AnimatedCollectionCard
                key={item.id}
                item={item}
                index={index}
                cardWidth={cardWidth}
                layoutMode={layoutMode}
                isJiggleMode={isJiggleMode}
                onLongPress={() => setIsJiggleMode((current) => !current)}
                onPress={setSelectedFrame}
                onDelete={handleDelete}
                isDeleting={deletingIds.includes(item.id)}
                entering={FadeInDown.delay(index * 70).springify()}
              />
            ))}
          </View>
        </ScrollView>
      )}

      {selectedFrame ? (
        <View style={styles.modalOverlay} accessibilityViewIsModal>
          <Animated.View style={[styles.modalBackdrop, modalBackdropStyle]} />
          <Pressable
            accessibilityLabel="Đóng chi tiết khung"
            onPress={closeFrameModal}
            style={styles.modalBackdropPressable}
          />
          <Animated.View
            style={[
              styles.modalCard,
              {
                width: Math.min(windowWidth - 36, 340),
                backgroundColor: '#ffffff',
                borderRadius: 24,
                padding: 20,
                overflow: 'hidden',
              },
              modalCardStyle,
            ]}
          >
            <View style={{ width: '100%', alignItems: 'center' }}>
              {/* 1. Header */}
              <View
                style={[
                  styles.modalHeader,
                  {
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 14,
                    zIndex: 2,
                  },
                ]}
              >
                <View style={styles.modalHeading}>
                  <Text style={styles.modalTitle} numberOfLines={1}>
                    Chi tiết khung ảnh
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedFrame.title || selectedFrame.name || 'Khung ảnh'}
                    {' · '}
                    {getFrameElements(selectedFrame).length} sticker
                    {getFrameElements(selectedFrame).length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Đóng"
                  onPress={closeFrameModal}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={22} color="#445064" />
                </Pressable>
              </View>

              {/* 2. Hộp khóa cứng kích thước cho FramePreview (Không bao giờ bị sụp chiều cao) */}
              <View
                style={{
                  width: MODAL_PREVIEW_SIZE,
                  height: MODAL_PREVIEW_SIZE,
                  minHeight: MODAL_PREVIEW_SIZE,
                  maxHeight: MODAL_PREVIEW_SIZE,
                  alignSelf: 'center',
                  marginVertical: 12,
                  borderRadius: 16,
                  overflow: 'hidden',
                  position: 'relative',
                  backgroundColor: '#f3f4f8',
                  flexShrink: 0,
                }}
              >
                <FramePreview
                  item={selectedFrame}
                  size={MODAL_PREVIEW_SIZE}
                />
              </View>

              {/* 3. Nút bật/tắt QR */}
              <Pressable
                onPress={() => setShowSelectedFrameQr((current) => !current)}
                style={[styles.qrToggleButton, { marginTop: 4, marginBottom: 8 }]}
              >
                <Ionicons
                  name={showSelectedFrameQr ? 'eye-off-outline' : 'qr-code-outline'}
                  size={18}
                  color="#5b4acc"
                />
                <Text style={styles.qrToggleText}>
                  {showSelectedFrameQr ? 'Ẩn mã QR' : 'Hiện mã QR chia sẻ'}
                </Text>
              </Pressable>

              {showSelectedFrameQr ? (
                <Animated.View
                  entering={MODAL_CONTENT_ENTERING}
                  style={[styles.modalQrBadge, { marginBottom: 12 }]}
                >
                  <QRCode value={selectedFrame.id} size={110} />
                  <Text style={styles.modalQrCaption}>Quét để mở khung ảnh</Text>
                </Animated.View>
              ) : null}

              {/* 4. Các nút hành động */}
              <Pressable
                onPress={useSelectedTemplate}
                style={[styles.useTemplateButton, { width: '100%', marginTop: 4 }]}
              >
                <Ionicons name="color-wand-outline" size={19} color="#fff" />
                <Text style={styles.useTemplateText}>Dùng mẫu khung này</Text>
              </Pressable>
              <Pressable
                onPress={closeFrameModal}
                style={[styles.closeModalButton, { width: '100%', marginTop: 8 }]}
              >
                <Text style={styles.closeModalText}>Đóng</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f8fc',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 10,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 24, 38, 0.58)',
  },
  modalBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    elevation: 18,
    maxHeight: '92%',
    overflow: 'hidden',
    padding: 20,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
  },
  modalScroll: {
    width: '100%',
  },
  modalContent: {
    alignItems: 'center',
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 16,
    width: '100%',
  },
  modalHeading: {
    flex: 1,
    minWidth: 0,
  },
  modalTitle: {
    color: '#202631',
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#7b8491',
    fontSize: 12,
    marginTop: 4,
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: '#f0f2f7',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: 12,
    width: 36,
  },
  modalPreviewWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPreviewBox: {
    alignSelf: 'center',
    backgroundColor: '#F3F4F8',
    borderColor: '#E5E7EB',
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  qrToggleButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  qrToggleText: {
    color: '#5b4acc',
    fontSize: 13,
    fontWeight: '700',
  },
  modalQrBadge: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e8eaf0',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 4,
    padding: 14,
  },
  modalQrCaption: {
    color: '#7b8491',
    fontSize: 11,
    marginTop: 9,
  },
  useTemplateButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#6C5CE7',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 50,
  },
  useTemplateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  closeModalButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#F3F4F8',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 44,
  },
  closeModalText: {
    color: '#697586',
    fontSize: 13,
    fontWeight: '700',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerIconButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  modeButton: {
    alignItems: 'center',
    backgroundColor: '#ece9ff',
    borderRadius: 13,
    flexDirection: 'row',
    gap: 5,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  modeButtonText: {
    color: '#5b4acc',
    fontSize: 11,
    fontWeight: '700',
  },
  headerTitleContainer: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: '#202631',
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#7b8491',
    fontSize: 11,
    marginTop: 2,
  },
  manageButton: {
    alignItems: 'center',
    backgroundColor: '#ece9ff',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 11,
  },
  manageButtonActive: {
    backgroundColor: '#6C5CE7',
  },
  manageButtonText: {
    color: '#5b4acc',
    fontSize: 12,
    fontWeight: '700',
  },
  manageButtonTextActive: {
    color: '#fff',
  },
  filterBar: {
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  filterTab: {
    backgroundColor: '#fff',
    borderColor: '#e8eaf0',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  filterTabActive: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  filterText: {
    color: '#66707e',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  cardsContainer: {
    width: '100%',
    paddingTop: 2,
    paddingBottom: 28,
  },
  cardsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    rowGap: 14,
  },
  carouselContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  carouselList: {
    flexGrow: 1,
    width: '100%',
    overflow: 'scroll',
  },
  carouselCardSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselArrow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderColor: 'rgba(91, 74, 204, 0.14)',
    borderRadius: 23,
    borderWidth: 1,
    elevation: 5,
    height: 46,
    justifyContent: 'center',
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -23 }],
    width: 46,
    zIndex: 3,
    shadowColor: '#25304a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
  },
  carouselArrowLeft: {
    left: 12,
  },
  carouselArrowRight: {
    right: 12,
  },
  carouselArrowDisabled: {
    opacity: 0.42,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    elevation: 3,
    marginBottom: 1,
    overflow: 'visible',
    padding: 12,
    shadowColor: '#25304a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  listCard: {
    minHeight: 180,
  },
  cardContent: {
    alignItems: 'flex-start',
  },
  listCardContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  preview: {
    backgroundColor: '#f0f2f7',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewBackground: {
    height: '100%',
    left: 0,
    position: 'absolute',
    top: 0,
    width: '100%',
  },
  previewPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#eef0f5',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  previewElement: {
    position: 'absolute',
  },
  cardMetadata: {
    flex: 1,
    minWidth: 0,
    paddingTop: 10,
  },
  cardTitle: {
    color: '#252b36',
    fontSize: 14,
    fontWeight: '700',
  },
  cardDetail: {
    color: '#84909d',
    fontSize: 11,
    marginTop: 5,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#ff3b30',
    borderColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 4,
    width: 32,
    zIndex: 2,
  },
  deleteButtonInner: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  stateContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  stateTitle: {
    color: '#303846',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  stateText: {
    color: '#7b8491',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#6C5CE7',
    borderRadius: 12,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
