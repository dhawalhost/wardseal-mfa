import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Animated,
  Modal,
  Platform,
  Alert
} from 'react-native';
import { Shield, Bell, CheckCircle, XCircle, Smartphone, MapPin, Globe, Clock, ChevronRight } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import axios from 'axios';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface PushRequest {
  id: string;
  user_id: string;
  app_name: string;
  ip_address: string;
  location: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'denied';
}

const API_BASE = 'http://localhost:8090'; // Use your machine's IP for real device testing

export default function App() {
  const [requests, setRequests] = useState<PushRequest[]>([]);
  const [isRegistered, setIsRegistered] = useState(false);
  const [activeRequest, setActiveRequest] = useState<PushRequest | null>(null);
  const [userID, setUserID] = useState('user_123');

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    registerForPushNotificationsAsync();

    // Listen for SSE events if registered (Simulating push via SSE for local dev)
    let eventSource: any;
    if (isRegistered) {
      // In React Native, we can use EventSource polyfill or just long polling for simulation.
      // For this demo, I'll use a simple interval to poll for new requests from the manager.
      const poll = setInterval(async () => {
        try {
          // This is a simulation since native EventSource isn't built-in
          const response = await axios.get(`${API_BASE}/status/latest?user_id=${userID}`);
          if (response.data && response.data.status === 'pending' && (!activeRequest || activeRequest.id !== response.data.id)) {
            setActiveRequest(response.data);
            setRequests(prev => [response.data, ...prev.filter(r => r.id !== response.data.id)]);
          }
        } catch (e) { }
      }, 3000);
      return () => clearInterval(poll);
    }
  }, [isRegistered]);

  async function registerForPushNotificationsAsync() {
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Failed to get push token for push notification!');
        return;
      }
    }
  }

  const handleRegister = async () => {
    try {
      await axios.post(`${API_BASE}/register`, {
        device_id: Device.modelName || 'mobile_device',
        device_name: Device.deviceName || 'WardSeal Mobile',
        user_id: userID,
        push_token: 'native_expo_token'
      });
      setIsRegistered(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }).start();
    } catch (err) {
      Alert.alert("Registration Failed", "Make sure the backend is running at " + API_BASE);
    }
  };

  const handleDecision = async (id: string, approved: boolean) => {
    if (approved) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (hasHardware) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirm Authentication',
          fallbackLabel: 'Use Passcode',
        });
        if (!result.success) return;
      }
    }

    try {
      await axios.post(`${API_BASE}/decision`, {
        request_id: id,
        approved
      });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: approved ? 'approved' : 'denied' } : r));
      setActiveRequest(null);
    } catch (err) {
      console.error("Decision failed", err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.iconBox}>
            <Shield size={24} color="#3b82f6" />
          </View>
          <Text style={styles.logoText}>WardSeal MFA</Text>
        </View>
        <View style={[styles.statusBadge, isRegistered ? styles.statusActive : styles.statusInactive]}>
          <Text style={[styles.statusText, isRegistered ? { color: '#10b981' } : { color: '#64748b' }]}>
            {isRegistered ? 'LINKED' : 'NOT LINKED'}
          </Text>
        </View>
      </View>

      {!isRegistered ? (
        <View style={styles.setupContainer}>
          <View style={styles.setupCard}>
            <View style={styles.setupIconBox}>
              <Smartphone size={48} color="#3b82f6" />
            </View>
            <Text style={styles.setupTitle}>Setup your device</Text>
            <Text style={styles.setupDesc}>
              Link this device to your WardSeal account to start receiving secure push notifications for logins.
            </Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister}>
              <Text style={styles.btnText}>Link Device</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* HISTORY */}
          <Text style={styles.sectionHeader}>RECENT ACTIVITY</Text>
          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No recent requests. Your account is secure.</Text>
            </View>
          ) : (
            requests.map((req) => (
              <View key={req.id} style={styles.historyCard}>
                <View style={styles.historyInfo}>
                  <View style={[styles.historyIconBox, req.status === 'approved' ? { backgroundColor: 'rgba(16, 185, 129, 0.1)' } : { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    {req.status === 'approved' ?
                      <CheckCircle size={20} color="#10b981" /> :
                      <XCircle size={20} color="#ef4444" />
                    }
                  </View>
                  <View>
                    <Text style={styles.historyAppName}>{req.app_name}</Text>
                    <Text style={styles.historyTime}>{new Date(req.timestamp).toLocaleTimeString()}</Text>
                  </View>
                </View>
                <View style={styles.historyStatus}>
                  <Text style={[styles.statusLabel, req.status === 'approved' ? { color: '#10b981' } : { color: '#ef4444' }]}>
                    {req.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ACTIVE REQUEST MODAL */}
      <Modal visible={!!activeRequest} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconBox}>
                <Bell size={32} color="#3b82f6" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Login Request</Text>
                <Text style={styles.modalSubtitle}>Awaiting your approval</Text>
              </View>
            </View>

            <View style={styles.requestDetails}>
              <View style={styles.detailItem}>
                <Globe size={16} color="#64748b" />
                <Text style={styles.detailText}>{activeRequest?.app_name}</Text>
              </View>
              <View style={styles.detailItem}>
                <MapPin size={16} color="#64748b" />
                <Text style={styles.detailText}>{activeRequest?.location} ({activeRequest?.ip_address})</Text>
              </View>
              <View style={styles.detailItem}>
                <Clock size={16} color="#64748b" />
                <Text style={styles.detailText}>Just now</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnDanger]}
                onPress={() => handleDecision(activeRequest!.id, false)}
              >
                <Text style={styles.btnText}>Deny</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnSuccess]}
                onPress={() => handleDecision(activeRequest!.id, true)}
              >
                <Text style={styles.btnText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <Text style={styles.footerText}>POWERED BY WARDSEAL ZERO-TRUST</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginTop: Platform.OS === 'android' ? 25 : 0,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  logoText: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: -0.5,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusInactive: {
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  setupCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 32,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  setupIconBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 24,
    borderRadius: 999,
    marginBottom: 24,
  },
  setupTitle: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  setupDesc: {
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
    width: '100%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
    padding: 20,
  },
  sectionHeader: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  emptyState: {
    padding: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    fontSize: 14,
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  historyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  historyIconBox: {
    padding: 10,
    borderRadius: 12,
  },
  historyAppName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  historyTime: {
    color: '#64748b',
    fontSize: 12,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  historyStatus: {
    marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 32,
    paddingBottom: 48,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 24,
  },
  modalIconBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 24,
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    color: '#64748b',
    fontSize: 14,
  },
  requestDetails: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 20,
    gap: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  btn: {
    flex: 1,
    padding: 18,
    borderRadius: 20,
    alignItems: 'center',
  },
  btnSuccess: {
    backgroundColor: '#10b981',
  },
  btnDanger: {
    backgroundColor: '#ef4444',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    opacity: 0.5,
  }
});
