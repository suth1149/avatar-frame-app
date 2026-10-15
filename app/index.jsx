import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

function AnimatedPressable({ children, entering, onPressIn, onPressOut, style, ...props }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={entering} style={animatedStyle}>
      <Pressable
        {...props}
        style={style}
        onPressIn={(event) => {
          scale.value = withSpring(0.95);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = withSpring(1);
          onPressOut?.(event);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [showIntro, setShowIntro] = useState(true);
  const logoScale = useSharedValue(0);
  const firstBadgeScale = useSharedValue(0);
  const secondBadgeScale = useSharedValue(0);
  const thirdBadgeScale = useSharedValue(0);
  const titleProgress = useSharedValue(0);
  const subtitleProgress = useSharedValue(0);
  const introOpacity = useSharedValue(1);
  const introScale = useSharedValue(1);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));
  const firstBadgeStyle = useAnimatedStyle(() => ({
    opacity: firstBadgeScale.value,
    transform: [{ scale: firstBadgeScale.value }, { rotate: '-14deg' }],
  }));
  const secondBadgeStyle = useAnimatedStyle(() => ({
    opacity: secondBadgeScale.value,
    transform: [{ scale: secondBadgeScale.value }, { rotate: '12deg' }],
  }));
  const thirdBadgeStyle = useAnimatedStyle(() => ({
    opacity: thirdBadgeScale.value,
    transform: [{ scale: thirdBadgeScale.value }, { rotate: '-8deg' }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleProgress.value,
    transform: [{ translateY: 25 * (1 - titleProgress.value) }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleProgress.value,
    transform: [{ translateY: 25 * (1 - subtitleProgress.value) }],
  }));
  const introStyle = useAnimatedStyle(() => ({
    opacity: introOpacity.value,
    transform: [{ scale: introScale.value }],
  }));

  useEffect(() => {
    logoScale.value = withSpring(1);
    firstBadgeScale.value = withDelay(250, withSpring(1));
    secondBadgeScale.value = withDelay(500, withSpring(1));
    thirdBadgeScale.value = withDelay(750, withSpring(1));
    titleProgress.value = withDelay(450, withTiming(1, { duration: 500 }));
    subtitleProgress.value = withDelay(450, withTiming(1, { duration: 500 }));

    const introTimer = setTimeout(() => {
      introOpacity.value = withTiming(0, { duration: 350 }, (finished) => {
        if (finished) runOnJS(setShowIntro)(false);
      });
      introScale.value = withTiming(1.12, { duration: 350 });
    }, 1900);

    return () => clearTimeout(introTimer);
  }, [
    firstBadgeScale,
    introOpacity,
    introScale,
    logoScale,
    secondBadgeScale,
    subtitleProgress,
    thirdBadgeScale,
    titleProgress,
  ]);

  return (
    <View style={styles.container}>
      <Animated.Text
        entering={FadeInDown.delay(100).springify()}
        style={styles.title}
      >
        Avatar Frame
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(200).springify()}
        style={styles.subtitle}
      >
        Tạo khung ảnh của riêng bạn hoặc quét mã QR để xem khung được chia sẻ.
      </Animated.Text>

      <AnimatedPressable
        entering={FadeInDown.delay(300).springify()}
        style={styles.primaryButton}
        onPress={() => router.push('/edit-avatar')}
      >
        <Ionicons name="create-outline" size={22} color="#fff" />
        <Text style={styles.buttonText}>Tạo Frame Mới</Text>
      </AnimatedPressable>

      <AnimatedPressable
        entering={FadeInDown.delay(400).springify()}
        style={styles.secondaryButton}
        onPress={() => router.push('/scanner')}
      >
        <Ionicons name="qr-code-outline" size={22} color="#007AFF" />
        <Text style={styles.secondaryButtonText}>Quét mã QR</Text>
      </AnimatedPressable>

      {showIntro ? (
        <Animated.View style={[styles.introOverlay, introStyle]}>
          <View style={styles.introArtwork}>
            <Animated.View style={[styles.introLogo, logoStyle]}>
              <Ionicons name="camera-outline" size={56} color="#fff" />
            </Animated.View>
            <Animated.View style={[styles.badge, styles.firstBadge, firstBadgeStyle]}>
              <Ionicons name="heart" size={20} color="#ff6584" />
            </Animated.View>
            <Animated.View style={[styles.badge, styles.secondBadge, secondBadgeStyle]}>
              <Ionicons name="sparkles" size={20} color="#ffb020" />
            </Animated.View>
            <Animated.View style={[styles.badge, styles.thirdBadge, thirdBadgeStyle]}>
              <Ionicons name="camera" size={20} color="#29b6a6" />
            </Animated.View>
          </View>
          <Animated.Text style={[styles.introTitle, titleStyle]}>
            Avatar Frame
          </Animated.Text>
          <Animated.Text style={[styles.introSubtitle, subtitleStyle]}>
            Tạo khung ảnh của riêng bạn
          </Animated.Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: 24,
  },
  title: { color: '#222', fontSize: 28, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  subtitle: { color: '#666', fontSize: 15, lineHeight: 22, marginBottom: 32, textAlign: 'center' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 14,
    paddingHorizontal: 24,
    paddingVertical: 15,
    width: '100%',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#007AFF',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 15,
    width: '100%',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '700' },
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    zIndex: 10,
  },
  introArtwork: {
    width: 200,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  introLogo: {
    width: 112,
    height: 112,
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 30,
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  badge: {
    position: 'absolute',
    width: 46,
    height: 46,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    justifyContent: 'center',
    shadowColor: '#222',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  firstBadge: { top: 8, left: 8 },
  secondBadge: { top: 28, right: 4 },
  thirdBadge: { bottom: 0, left: 28 },
  introTitle: { color: '#222', fontSize: 30, fontWeight: '800', marginTop: 12 },
  introSubtitle: { color: '#666', fontSize: 15, marginTop: 10 },
});
