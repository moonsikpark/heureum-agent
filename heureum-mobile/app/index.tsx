import { useRef, useCallback, useEffect } from 'react';
import { StyleSheet, Dimensions, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Device from 'expo-device';
import * as Battery from 'expo-battery';
import { Accelerometer, Gyroscope, Barometer } from 'expo-sensors';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import { Paths, File as FSFile, Directory } from 'expo-file-system';
import * as SMS from 'expo-sms';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';

const FRONTEND_URL =
  Constants.expoConfig?.extra?.frontendUrl ||
  process.env.EXPO_PUBLIC_FRONTEND_URL ||
  'http://localhost:5173';

const PLATFORM_URL =
  Constants.expoConfig?.extra?.platformUrl ||
  process.env.EXPO_PUBLIC_PLATFORM_URL ||
  'http://localhost:8001';

const INJECTED_JS = `
(function() {
  var pending = {};
  var nextId = 1;
  window.mobileBridge = {
    available: true,
    request: function(action, params) {
      return new Promise(function(resolve) {
        var id = nextId++;
        pending[id] = resolve;
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, action: action, params: params || {} }));
      });
    }
  };
  window.__mobileBridgeResolve = function(id, data) {
    if (pending[id]) { pending[id](data); delete pending[id]; }
  };
})();
true;
`;

type Params = Record<string, unknown>;

function readSensor<T>(
  SensorClass: { addListener: (cb: (data: T) => void) => { remove: () => void }; setUpdateInterval: (ms: number) => void },
  timeoutMs = 2000,
): Promise<T | null> {
  return new Promise((resolve) => {
    SensorClass.setUpdateInterval(100);
    const timer = setTimeout(() => {
      sub.remove();
      resolve(null);
    }, timeoutMs);
    const sub = SensorClass.addListener((data) => {
      clearTimeout(timer);
      sub.remove();
      resolve(data);
    });
  });
}

async function getDeviceInfo() {
  const [batteryLevel, batteryState] = await Promise.all([
    Battery.getBatteryLevelAsync(),
    Battery.getBatteryStateAsync(),
  ]);
  const screen = Dimensions.get('window');
  return {
    model: Device.modelName,
    brand: Device.brand,
    manufacturer: Device.manufacturer,
    osName: Device.osName,
    osVersion: Device.osVersion,
    deviceType: Device.deviceType,
    totalMemory: Device.totalMemory,
    battery: {
      level: Math.round(batteryLevel * 100),
      state: Battery.BatteryState[batteryState],
    },
    screen: {
      width: screen.width,
      height: screen.height,
      scale: screen.scale,
    },
  };
}

async function getSensorData() {
  const [accel, gyro, baro] = await Promise.all([
    readSensor<{ x: number; y: number; z: number }>(Accelerometer),
    readSensor<{ x: number; y: number; z: number }>(Gyroscope),
    readSensor<{ pressure: number }>(Barometer),
  ]);
  return {
    accelerometer: accel ? { x: accel.x, y: accel.y, z: accel.z } : null,
    gyroscope: gyro ? { x: gyro.x, y: gyro.y, z: gyro.z } : null,
    barometer: baro ? { pressure: baro.pressure } : null,
  };
}

async function getContacts(p: Params) {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return { error: 'Contacts permission denied' };
  const query = typeof p.query === 'string' ? p.query : undefined;
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    ...(query ? { name: query } : {}),
    pageSize: 50,
    pageOffset: 0,
  });
  return {
    count: data.length,
    contacts: data.map((c) => ({
      id: c.id,
      name: c.name,
      phones: c.phoneNumbers?.map((ph) => ph.number) ?? [],
      emails: c.emails?.map((e) => e.email) ?? [],
    })),
  };
}

async function getLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { error: 'Location permission denied' };
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    altitude: loc.coords.altitude,
    accuracy: loc.coords.accuracy,
    timestamp: loc.timestamp,
  };
}

async function takePhoto(p: Params) {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (perm.status !== 'granted') return { error: 'Camera permission denied' };
  const facing = p.camera === 'front' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back;
  const result = await ImagePicker.launchCameraAsync({
    cameraType: facing,
    quality: 0.7,
    base64: false,
  });
  if (result.canceled) return { canceled: true };
  const asset = result.assets[0];
  return { uri: asset.uri, width: asset.width, height: asset.height };
}

async function sendNotification(p: Params) {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return { error: 'Notification permission denied' };
  const title = typeof p.title === 'string' ? p.title : 'Notification';
  const body = typeof p.body === 'string' ? p.body : '';
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
  return { success: true, notificationId: id };
}

async function getClipboard() {
  const text = await Clipboard.getStringAsync();
  return { text };
}

async function setClipboard(p: Params) {
  const text = typeof p.text === 'string' ? p.text : '';
  await Clipboard.setStringAsync(text);
  return { success: true };
}

async function readFile(p: Params) {
  const rawPath = typeof p.path === 'string' ? p.path : '';
  if (!rawPath) return { error: 'No path provided' };
  const file = new FSFile(Paths.document, rawPath);
  if (!file.exists) return { error: 'File not found' };
  const content = file.text();
  return { path: file.uri, content, size: file.size };
}

async function writeFile(p: Params) {
  const rawPath = typeof p.path === 'string' ? p.path : '';
  const content = typeof p.content === 'string' ? p.content : '';
  if (!rawPath) return { error: 'No path provided' };
  const file = new FSFile(Paths.document, rawPath);
  file.create();
  file.write(content);
  return { success: true, path: file.uri };
}

async function listFiles(p: Params) {
  const rawPath = typeof p.path === 'string' ? p.path : '';
  const dir = rawPath ? new Directory(Paths.document, rawPath) : Paths.document;
  if (!dir.exists) return { error: 'Directory not found' };
  const entries = dir.list();
  const files = entries.map((e) => ({ name: e.name, isDirectory: e instanceof Directory }));
  return { path: dir.uri, files };
}

async function sendSms(p: Params) {
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) return { error: 'SMS not available on this device' };
  const phones = Array.isArray(p.phones) ? p.phones.map(String) : [];
  const message = typeof p.message === 'string' ? p.message : '';
  const { result } = await SMS.sendSMSAsync(phones, message);
  return { result };
}

async function shareContent(p: Params) {
  const message = typeof p.message === 'string' ? p.message : '';
  const url = typeof p.url === 'string' ? p.url : undefined;
  const result = await Share.share({ message, url });
  return { action: result.action, activityType: result.activityType };
}

async function triggerHaptic(p: Params) {
  const style = typeof p.style === 'string' ? p.style : 'medium';
  const impactMap: Record<string, Haptics.ImpactFeedbackStyle> = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  };
  await Haptics.impactAsync(impactMap[style] || Haptics.ImpactFeedbackStyle.Medium);
  return { success: true, style };
}

async function openUrl(p: Params) {
  const url = typeof p.url === 'string' ? p.url : '';
  if (!url) return { error: 'No URL provided' };
  const result = await WebBrowser.openBrowserAsync(url);
  return { type: result.type };
}

async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) {
    console.log('[Heureum] Push notifications require a physical device');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('[Heureum] Push notification permission denied');
    return;
  }

  // Get raw device push token (FCM on Android, APNs on iOS)
  const tokenData = await Notifications.getDevicePushTokenAsync();
  const token = tokenData.data;
  const deviceType = Platform.OS; // 'ios' or 'android'

  console.log(`[Heureum] Device push token (${deviceType}):`, token.substring(0, 20) + '...');

  // Register with backend
  try {
    const response = await fetch(`${PLATFORM_URL}/api/v1/notifications/register-device/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token, device_type: deviceType }),
    });
    if (response.ok) {
      console.log('[Heureum] Push token registered with backend');
    } else {
      console.warn('[Heureum] Push token registration failed:', response.status);
    }
  } catch (err: any) {
    console.warn('[Heureum] Push token registration error:', err.message);
  }
}

export default function Home() {
  const webViewRef = useRef<WebView>(null);
  const webViewLoaded = useRef(false);
  const pendingToken = useRef<string | null>(null);
  const { authToken } = useLocalSearchParams<{ authToken?: string }>();

  const navigateToTokenExchange = useCallback((token: string) => {
    const exchangeUrl = `${PLATFORM_URL}/api/v1/auth/token/exchange/?token=${encodeURIComponent(token)}`;
    webViewRef.current?.injectJavaScript(
      `window.location.href = ${JSON.stringify(exchangeUrl)}; true;`
    );
  }, []);

  // Register push token on mount
  useEffect(() => {
    registerPushToken();

    // Handle notification taps (when user taps a notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[Heureum] Notification tapped:', data);
      // Could navigate WebView to a specific page based on data
    });

    // Handle foreground notifications
    const notificationSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Heureum] Foreground notification:', notification.request.content);
    });

    return () => {
      responseSubscription.remove();
      notificationSubscription.remove();
    };
  }, []);

  // Handle auth token passed from deep link route (app/auth/callback.tsx)
  useEffect(() => {
    if (authToken) {
      if (webViewLoaded.current) {
        navigateToTokenExchange(authToken);
      } else {
        // WebView not ready yet — defer until onLoadEnd
        pendingToken.current = authToken;
      }
    }
  }, [authToken, navigateToTokenExchange]);

  const handleWebViewLoadEnd = useCallback(() => {
    webViewLoaded.current = true;
    if (pendingToken.current) {
      const token = pendingToken.current;
      pendingToken.current = null;
      navigateToTokenExchange(token);
    }
  }, [navigateToTokenExchange]);

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    let msg: { id: number; action: string; params?: Params };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    let result: unknown;
    const p = msg.params || {};
    try {
      switch (msg.action) {
        case 'get_device_info': result = await getDeviceInfo(); break;
        case 'get_sensor_data': result = await getSensorData(); break;
        case 'get_contacts': result = await getContacts(p); break;
        case 'get_location': result = await getLocation(); break;
        case 'take_photo': result = await takePhoto(p); break;
        case 'send_notification': result = await sendNotification(p); break;
        case 'get_clipboard': result = await getClipboard(); break;
        case 'set_clipboard': result = await setClipboard(p); break;
        case 'read_file': result = await readFile(p); break;
        case 'write_file': result = await writeFile(p); break;
        case 'list_files': result = await listFiles(p); break;
        case 'send_sms': result = await sendSms(p); break;
        case 'share_content': result = await shareContent(p); break;
        case 'trigger_haptic': result = await triggerHaptic(p); break;
        case 'open_url': result = await openUrl(p); break;
        default: result = { error: `Unknown action: ${msg.action}` };
      }
    } catch (err: any) {
      result = { error: err.message || 'Native bridge error' };
    }

    webViewRef.current?.injectJavaScript(
      `window.__mobileBridgeResolve(${msg.id}, ${JSON.stringify(result)}); true;`
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: FRONTEND_URL }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        sharedCookiesEnabled
        injectedJavaScript={INJECTED_JS}
        onMessage={handleMessage}
        onLoadEnd={handleWebViewLoadEnd}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  webview: {
    flex: 1,
  },
});
