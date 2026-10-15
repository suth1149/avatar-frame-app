import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const SHIMMER_WIDTH = 76;
const PROGRESS_WIDTH = 224;

export default function ActionLoadingModal({
  visible,
  title,
  subtitle,
  iconName = 'sparkles-outline',
}) {
  const outerRotation = useSharedValue(0);
  const innerRotation = useSharedValue(360);
  const iconScale = useSharedValue(0.85);
  const shimmerProgress = useSharedValue(0);

  const outerFrameStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRotation.value}deg` }],
  }));
  const innerFrameStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRotation.value}deg` }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: interpolate(
        shimmerProgress.value,
        [0, 1],
        [-SHIMMER_WIDTH, PROGRESS_WIDTH],
      ),
    }],
  }));

  useEffect(() => {
    if (!visible) return undefined;

    outerRotation.value = withRepeat(
      withTiming(360, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
    innerRotation.value = withRepeat(
      withTiming(0, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
    iconScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 700 }),
        withTiming(0.85, { duration: 700 }),
      ),
      -1,
      false,
    );
    shimmerProgress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(outerRotation);
      cancelAnimation(innerRotation);
      cancelAnimation(iconScale);
      cancelAnimation(shimmerProgress);
    };
  }, [iconScale, innerRotation, outerRotation, shimmerProgress, visible]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={styles.overlay}
      accessibilityRole="progressbar"
      accessibilityLabel={title}
    >
      <View style={styles.card}>
        <View style={styles.animationStage}>
          <Animated.View style={[styles.frame, styles.outerFrame, outerFrameStyle]} />
          <Animated.View style={[styles.frame, styles.innerFrame, innerFrameStyle]} />
          <Animated.View style={[styles.centerIcon, iconStyle]}>
            <Ionicons name={iconName} size={32} color="#007AFF" />
          </Animated.View>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressHighlight, shimmerStyle]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    padding: 24,
    zIndex: 999,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    maxWidth: 360,
    paddingHorizontal: 28,
    paddingVertical: 26,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  animationStage: {
    alignItems: 'center',
    height: 136,
    justifyContent: 'center',
    marginBottom: 10,
    width: 136,
  },
  frame: {
    position: 'absolute',
    borderRadius: 26,
    borderWidth: 3,
  },
  outerFrame: {
    width: 116,
    height: 116,
    borderColor: '#b6d6ff',
  },
  innerFrame: {
    width: 82,
    height: 82,
    borderColor: '#007AFF',
    borderRadius: 20,
    borderWidth: 2,
  },
  centerIcon: {
    alignItems: 'center',
    backgroundColor: '#edf5ff',
    borderRadius: 18,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  title: {
    color: '#202938',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  progressTrack: {
    backgroundColor: '#e8eef6',
    borderRadius: 4,
    height: 6,
    marginTop: 22,
    overflow: 'hidden',
    width: PROGRESS_WIDTH,
  },
  progressHighlight: {
    backgroundColor: '#1684ff',
    borderRadius: 4,
    height: '100%',
    width: SHIMMER_WIDTH,
  },
});
