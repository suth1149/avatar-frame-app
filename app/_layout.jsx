import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Màn hình trang chủ đặt trực tiếp (hoặc bạn có thể đổi tên tùy ý) */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      
      {/* Màn hình chỉnh sửa avatar */}
      <Stack.Screen name="edit-avatar" options={{ headerShown: false }} />

      {/* Màn hình quét mã QR */}
      <Stack.Screen name="scanner" options={{ headerShown: false }} />
      
      {/* Màn hình xem chi tiết ảnh */}
      <Stack.Screen 
        name="detail" 
        options={{ 
          presentation: 'modal', 
          headerShown: false,
          title: 'Chi tiết ảnh'
        }} 
      />
    </Stack>
  );
}