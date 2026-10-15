import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Animated, {
  Easing,
  Keyframe,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { db } from '../firebaseConfig';
import ActionLoadingModal from '../components/ActionLoadingModal';

const { width } = Dimensions.get('window');
const PREVIEW_SIZE = Math.min(width * 0.9, 420);
const CONFETTI_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE'];

function ConfettiOverlay({ trigger }) {
  if (!trigger) return null;

  return (
    <View pointerEvents="none" style={styles.confettiOverlay}>
      {Array.from({ length: 16 }, (_, index) => {
        const angle = (index / 16) * Math.PI * 2;
        const distance = 100 + (index % 4) * 18;
        const burstX = Math.round(Math.cos(angle) * distance);
        const burstY = Math.round(Math.sin(angle) * distance);
        const animation = new Keyframe({
          0: {
            opacity: 1,
            transform: [
              { translateX: 0 },
              { translateY: 0 },
              { scale: 0 },
              { rotate: '0deg' },
            ],
          },
          35: {
            opacity: 1,
            transform: [
              { translateX: burstX * 0.7 },
              { translateY: burstY - 60 },
              { scale: 1.2 },
              { rotate: '140deg' },
            ],
          },
          100: {
            opacity: 0,
            transform: [
              { translateX: burstX },
              { translateY: burstY + 120 },
              { scale: 0.6 },
              { rotate: '320deg' },
            ],
          },
        }).duration(1200);

        return (
          <Animated.View
            key={`${trigger}-${index}`}
            entering={animation}
            style={[
              styles.confettiParticle,
              {
                left: PREVIEW_SIZE / 2 - 5,
                top: PREVIEW_SIZE / 2 - 7,
                backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

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
    const raw = decodeURIComponent(getParamString(value));
    const parsed = JSON.parse(raw);
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
  const saveInProgressRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedDocumentId, setSharedDocumentId] = useState(null);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const confettiTimeoutRef = useRef(null);
  const flipProgress = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const imageOpacity = useSharedValue(0.25);
  const polaroidRotation = useSharedValue(-3.5);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));
  const imageDevelopStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));
  const polaroidSwingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${polaroidRotation.value}deg` }],
  }));
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
      zIndex: flipProgress.value < 0.5 ? 2 : 1,
    };
  });
  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: flipProgress.value >= 0.5 ? 2 : 1,
    };
  });

  const backgroundUri = frameConfig?.backgroundUri || frameConfig?.background?.uri;
  const elements = Array.isArray(frameConfig?.elements) ? frameConfig.elements : [];
  const sourceCanvasSize = Number(frameConfig?.canvasSize) > 0 ? Number(frameConfig.canvasSize) : PREVIEW_SIZE;
  const previewScale = PREVIEW_SIZE / sourceCanvasSize;
  const todayDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const triggerPolaroidDevelopAndSwing = useCallback(() => {
    flashOpacity.value = withSequence(
      withTiming(0.95, { duration: 80 }),
      withTiming(0, { duration: 400 }),
    );
    imageOpacity.value = 0.25;
    imageOpacity.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
    polaroidRotation.value = withSequence(
      withTiming(16, { duration: 120 }),
      withTiming(-12, { duration: 420 }),
      withTiming(8, { duration: 360 }),
      withTiming(-4, { duration: 320 }),
      withSpring(-3.5),
    );
  }, [flashOpacity, imageOpacity, polaroidRotation]);

  const toggleFlip = (toBack) => {
    const nextState = typeof toBack === 'boolean' ? toBack : !isFlipped;
    setIsFlipped(nextState);
    flipProgress.value = withSpring(nextState ? 1 : 0, {
      damping: 14,
      stiffness: 90,
    });
  };

  useEffect(() => {
    triggerPolaroidDevelopAndSwing();
  }, [triggerPolaroidDevelopAndSwing]);

  useEffect(() => () => {
    if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
  }, []);

  const triggerConfetti = () => {
    setConfettiTrigger((previous) => previous + 1);
    if (confettiTimeoutRef.current) clearTimeout(confettiTimeoutRef.current);
    confettiTimeoutRef.current = setTimeout(() => setConfettiTrigger(0), 1500);
  };

  const handleSave = async () => {
    if (!frameConfig || !frameRef.current) {
      Alert.alert('Lỗi', 'Không có khung ảnh hợp lệ để lưu.');
      return;
    }
    if (saveInProgressRef.current) return;

    saveInProgressRef.current = true;
    try {
      if (isFlipped) {
        toggleFlip(false);
        await new Promise((resolve) => setTimeout(resolve, 650));
      }
      setIsSaving(true);
      triggerPolaroidDevelopAndSwing();

      if (Platform.OS === 'web') {
        await new Promise((resolve) => setTimeout(resolve, 900));
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
        triggerConfetti();
        Alert.alert('Đã lưu', 'Ảnh khung đã được tải xuống.');
        return;
      }

      const MediaLibrary = require('expo-media-library');
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        Alert.alert('Thiếu quyền', 'Bạn cần cấp quyền lưu ảnh vào thư viện.');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 900));
      const imageUri = await captureRef(frameRef.current, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      await MediaLibrary.saveToLibraryAsync(imageUri);
      triggerConfetti();
      Alert.alert('Thành công', 'Khung ảnh đã được lưu vào thư viện.');
    } catch (error) {
      Alert.alert('Lỗi', `Không thể lưu ảnh: ${error.message}`);
    } finally {
      setIsSaving(false);
      saveInProgressRef.current = false;
    }
  };

  const handleShare = async () => {
    if (!frameConfig) {
      Alert.alert('Lỗi', 'Không có cấu hình khung ảnh hợp lệ để chia sẻ.');
      return;
    }
    if (sharedDocumentId) {
      toggleFlip(true);
      return;
    }

    setIsSharing(true);
    try {
      const document = await addDoc(collection(db, 'shared_frames'), frameConfig);
      setSharedDocumentId(document.id);
      toggleFlip(true);
    } catch (error) {
      Alert.alert('Lỗi', `Không thể chia sẻ khung ảnh: ${error.message}`);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.backButton} accessibilityLabel="Quay lại">
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Xem trước khung</Text>
          <View style={styles.headerSpacer} />
        </View>

        {frameConfig ? (
          <View style={styles.flipContainer}>
            <ConfettiOverlay trigger={confettiTrigger} />
            <Animated.View style={[styles.flipFace, frontAnimatedStyle]}>
              <View style={styles.polaroidAssembly}>
                <View style={styles.rope} />
                <View style={styles.clothespin}>
                  <View style={styles.clothespinTop} />
                  <View style={styles.clothespinBody}>
                    <View style={styles.clothespinSplit} />
                  </View>
                </View>
                <Animated.View
                  style={[
                    styles.polaroidCard,
                    styles.polaroidTransformOrigin,
                    polaroidSwingStyle,
                  ]}
                >
                  <View
                    ref={frameRef}
                    collapsable={false}
                    style={styles.frame}
                    accessibilityLabel="Bản xem trước khung ảnh"
                  >
                    <Animated.View style={[styles.frameContents, imageDevelopStyle]}>
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
                    </Animated.View>
                  </View>
                  <View style={styles.polaroidCaption}>
                    <Text style={styles.captionTitle}>Avatar Frame <Text style={styles.captionDot}>•</Text> Studio</Text>
                    <Text style={styles.captionDate}>{todayDate}</Text>
                  </View>
                </Animated.View>
              </View>
            </Animated.View>
            <Animated.View style={[styles.flipFace, styles.backFace, styles.frame, backAnimatedStyle]}>
              {sharedDocumentId ? (
                <View style={styles.qrFaceContent}>
                  <Text style={styles.qrTitle}>Quét mã QR để mở khung ảnh</Text>
                  <View style={styles.qrContainer}>
                    <QRCode value={sharedDocumentId} size={180} />
                  </View>
                  <Text style={styles.documentId}>Mã khung: {sharedDocumentId}</Text>
                </View>
              ) : null}
            </Animated.View>
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
            style={[styles.actionButton, styles.shareButton, isSharing && styles.disabledButton]}
            onPress={handleShare}
            disabled={isSaving || isSharing}
          >
            {isSharing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="share-social-outline" size={19} color="#fff" />
                <Text style={styles.actionText}>{sharedDocumentId ? 'Mã QR' : 'Share'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {sharedDocumentId ? (
          <TouchableOpacity
            style={styles.flipButton}
            onPress={() => toggleFlip(!isFlipped)}
          >
            <Ionicons name="swap-horizontal-outline" size={18} color="#007AFF" />
            <Text style={styles.flipButtonText}>
              {isFlipped ? 'Lật xem Mặt trước' : 'Lật xem Mã QR'}
            </Text>
          </TouchableOpacity>
        ) : null}

      </ScrollView>
      <ActionLoadingModal
        visible={isSharing}
        title="Đang tạo mã QR chia sẻ..."
        subtitle="Đang đồng bộ cấu hình lên Cloud Firestore"
        iconName="qr-code-outline"
      />
      <ActionLoadingModal
        visible={isSaving}
        title="Đang xuất ảnh..."
        subtitle="Đang lưu khung ảnh vào thư viện thiết bị"
        iconName="download-outline"
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.flashOverlay, flashStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flexGrow: 1, alignItems: 'center', backgroundColor: '#f8f9fa', padding: 18, paddingTop: 42 },
  header: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerSpacer: { width: 32 },
  flipContainer: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    marginBottom: 116,
    position: 'relative',
  },
  confettiOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  confettiParticle: {
    position: 'absolute',
    borderRadius: 2,
    height: 14,
    width: 10,
  },
  flipFace: {
    alignItems: 'center',
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
  },
  backFace: {
    backgroundColor: '#fff',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrFaceContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    width: '100%',
  },
  polaroidAssembly: {
    alignItems: 'center',
    marginTop: 34,
    marginBottom: 12,
    position: 'relative',
  },
  rope: {
    position: 'absolute',
    top: 8,
    left: -24,
    right: -24,
    height: 3,
    backgroundColor: '#b79b72',
    borderRadius: 2,
    shadowColor: '#604c32',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    zIndex: 1,
  },
  clothespin: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'flex-end',
    position: 'absolute',
    top: -18,
    width: 34,
    zIndex: 3,
  },
  clothespinTop: {
    position: 'absolute',
    top: 0,
    width: 9,
    height: 13,
    backgroundColor: '#b9854f',
    borderColor: '#8e6338',
    borderRadius: 4,
    borderWidth: 1,
  },
  clothespinBody: {
    alignItems: 'center',
    backgroundColor: '#d5a66f',
    borderColor: '#9f7549',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    height: 33,
    justifyContent: 'center',
    width: 28,
    shadowColor: '#4a3522',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  clothespinSplit: { backgroundColor: '#986b41', height: 24, width: 1 },
  polaroidCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 4,
    elevation: 8,
    padding: 10,
    paddingBottom: 0,
    shadowColor: '#172033',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    zIndex: 2,
  },
  polaroidTransformOrigin: {
    transformOrigin: ['50%', '0%', 0],
  },
  polaroidCaption: {
    alignItems: 'center',
    height: 62,
    justifyContent: 'center',
    width: '100%',
  },
  captionTitle: { color: '#30343b', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  captionDot: { color: '#cc9a5b' },
  captionDate: { color: '#8a8f98', fontSize: 11, letterSpacing: 1, marginTop: 5, textTransform: 'uppercase' },
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
  frameContents: { ...StyleSheet.absoluteFillObject },
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
  flipButton: {
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: '#c8ddf8',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 42,
    paddingHorizontal: 16,
  },
  flipButtonText: { color: '#007AFF', fontSize: 14, fontWeight: '700' },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    zIndex: 2000,
  },
});
