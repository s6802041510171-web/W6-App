import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  PermissionsAndroid,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Buffer } from 'buffer';

// Initialize BleManager strictly on native platforms to prevent web crash
let manager: any = null;
if (Platform.OS !== 'web') {
  const { BleManager } = require('react-native-ble-plx');
  manager = new BleManager();
}

const SERVICE_UUID = 'aee04821-1973-4e1f-a590-e84b10d580e7';
const CHAR_UUID = 'cde07b1a-889b-44b7-a99f-c888dddac729';

export default function App() {
  const [devices, setDevices] = useState<any[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<any | null>(null);
  const [receivedData, setReceivedData] = useState<string>('');
  const [writeValue, setWriteValue] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return (
          granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    }
    return true;
  };

  useEffect(() => {
    if (Platform.OS !== 'web') {
      requestPermissions();
    }
    return () => {
      if (manager) {
        manager.stopDeviceScan();
      }
    };
  }, []);

  const startScan = async () => {
    if (Platform.OS === 'web') {
      // Mock data for web demonstration
      setDevices([
        { id: '4F:3A:88:91:02:11', name: 'ESP32_PERIPHERAL_LAB', rssi: -58 },
        { id: '1A:8C:E2:00:B4:77', name: 'STUDIO_CORE_NODE', rssi: -74 },
        { id: '90:B3:21:4E:99:FF', name: 'SYNTH_BEACON_01', rssi: -82 },
      ]);
      return;
    }

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      Alert.alert('PERMISSION DENIED', 'Please allow Bluetooth permissions to proceed.');
      return;
    }

    setDevices([]);
    setIsScanning(true);

    manager.startDeviceScan(null, null, (error: any, device: any) => {
      if (error) {
        setIsScanning(false);
        return;
      }
      if (device && (device.name || device.localName)) {
        setDevices((prev) => {
          if (prev.some((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      }
    });

    setTimeout(() => {
      if (manager) manager.stopDeviceScan();
      setIsScanning(false);
    }, 8000);
  };

  const connectToDevice = async (device: any) => {
    if (Platform.OS === 'web') {
      setConnectedDevice(device);
      return;
    }

    if (!manager) return;
    manager.stopDeviceScan();
    setIsScanning(false);

    try {
      const connected = await manager.connectToDevice(device.id);
      const discovered = await connected.discoverAllServicesAndCharacteristics();
      setConnectedDevice(discovered);
    } catch {
      Alert.alert('CONNECTION ERROR', 'Failed to pair with selected target.');
    }
  };

  const readCharacteristic = async () => {
    if (Platform.OS === 'web') {
      setReceivedData('INIT_STATE // READY FOR IDENTITY INPUT');
      return;
    }

    if (!connectedDevice || !manager) return;
    try {
      const char = await manager.readCharacteristicForDevice(
        connectedDevice.id,
        SERVICE_UUID,
        CHAR_UUID
      );
      const rawData = Buffer.from(char.value || '', 'base64').toString('utf-8');
      setReceivedData(rawData);
    } catch {
      Alert.alert('READ ERROR', 'Unable to fetch stream from peripheral.');
    }
  };

  const writeCharacteristic = async () => {
    if (!writeValue.trim()) {
      Alert.alert('EMPTY PAYLOAD', 'Please enter your name & identification.');
      return;
    }

    if (Platform.OS === 'web') {
      setReceivedData(`GRADE_PREDICTION: [A] // VERIFIED FOR: ${writeValue.toUpperCase()}`);
      setWriteValue('');
      return;
    }

    if (!connectedDevice || !manager) return;
    try {
      const base64Value = Buffer.from(writeValue, 'utf-8').toString('base64');
      await manager.writeCharacteristicWithResponseForDevice(
        connectedDevice.id,
        SERVICE_UUID,
        CHAR_UUID,
        base64Value
      );
      setWriteValue('');
    } catch {
      Alert.alert('WRITE ERROR', 'Transmission rejected by peripheral.');
    }
  };

  const disconnectDevice = async () => {
    if (Platform.OS === 'web') {
      setConnectedDevice(null);
      setReceivedData('');
      return;
    }

    if (!connectedDevice || !manager) return;
    try {
      await manager.cancelDeviceConnection(connectedDevice.id);
      setConnectedDevice(null);
      setReceivedData('');
    } catch {
      // Clean fallback
      setConnectedDevice(null);
    }
  };

  return (
    <SafeAreaView style={styles.canvas}>
      <StatusBar barStyle="light-content" />

      {/* Frame Container */}
      <View style={styles.frame}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.collectionCode}>EXP. 2026 // MONOCHROME</Text>
          <Text style={styles.brandTitle}>BLE MATRIX</Text>
          <View style={styles.divider} />
        </View>

        {!connectedDevice ? (
          /* Scanning Screen */
          <View style={styles.content}>
            <TouchableOpacity
              style={[styles.primaryButton, isScanning && styles.buttonDisabled]}
              onPress={startScan}
              disabled={isScanning}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {isScanning ? 'SEARCHING FREQUENCIES...' : 'DISCOVER SIGNALS'}
              </Text>
            </TouchableOpacity>

            <View style={styles.listHeaderContainer}>
              <Text style={styles.sectionLabel}>DETECTED NODES</Text>
              <Text style={styles.sectionCount}>({devices.length})</Text>
            </View>

            <FlatList
              data={devices}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.artCard}
                  onPress={() => connectToDevice(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.artCardHeader}>
                    <Text style={styles.nodeName}>
                      {item.name || item.localName || 'UNTITLED NODE'}
                    </Text>
                    <Text style={styles.nodeRssi}>{item.rssi ?? '--'} dBm</Text>
                  </View>
                  <Text style={styles.nodeAddress}>{item.id}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>NO PERIPHERALS IN RANGE</Text>
                  <Text style={styles.emptySubtext}>TAP DISCOVER SIGNALS TO INITIALIZE</Text>
                </View>
              }
            />
          </View>
        ) : (
          /* Connected Dashboard */
          <View style={styles.content}>
            {/* Status Panel */}
            <View style={styles.connectedBadge}>
              <View style={styles.dotIndicator} />
              <Text style={styles.connectedStatusText}>
                LINKED: {connectedDevice.name || connectedDevice.id}
              </Text>
            </View>

            {/* Read Terminal Box */}
            <View style={styles.terminalBox}>
              <Text style={styles.terminalLabel}>DATA TERMINAL</Text>
              <Text style={styles.terminalValue}>
                {receivedData || 'AWAITING READ SIGNAL...'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={readCharacteristic}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>READ VALUE</Text>
            </TouchableOpacity>

            {/* Input Section */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>TRANSMIT IDENTITY</Text>
              <TextInput
                style={styles.artInput}
                value={writeValue}
                onChangeText={setWriteValue}
                placeholder="YOUR NAME & PARTNER"
                placeholderTextColor="#666666"
                selectionColor="#FFFFFF"
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={writeCharacteristic}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>WRITE VALUE</Text>
              </TouchableOpacity>
            </View>

            {/* Disconnect Action */}
            <TouchableOpacity
              style={styles.outlineDangerButton}
              onPress={disconnectDevice}
              activeOpacity={0.8}
            >
              <Text style={styles.outlineDangerText}>TERMINATE CONNECTION</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>INDUSTRIAL COMPUTING LAB // KMUTNB</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    backgroundColor: '#000000',
  },
  frame: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 36 : 16,
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 24,
  },
  collectionCode: {
    color: '#777777',
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '600',
    marginBottom: 4,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: '#262626',
    marginTop: 16,
  },
  content: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  primaryButtonText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  secondaryButton: {
    backgroundColor: '#141414',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    marginBottom: 20,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  outlineDangerButton: {
    borderWidth: 1,
    borderColor: '#444444',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  outlineDangerText: {
    color: '#AAAAAA',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  listHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    marginBottom: 12,
  },
  sectionLabel: {
    color: '#888888',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
  },
  sectionCount: {
    color: '#555555',
    fontSize: 11,
    letterSpacing: 1,
  },
  listContainer: {
    paddingBottom: 20,
  },
  artCard: {
    backgroundColor: '#0A0A0A',
    borderColor: '#222222',
    borderWidth: 1,
    padding: 18,
    marginBottom: 10,
  },
  artCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  nodeRssi: {
    color: '#666666',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  nodeAddress: {
    color: '#555555',
    fontSize: 11,
    marginTop: 6,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#444444',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
  },
  emptySubtext: {
    color: '#333333',
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 6,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#262626',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
  },
  connectedStatusText: {
    color: '#CCCCCC',
    fontSize: 11,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  terminalBox: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#333333',
    padding: 20,
    marginBottom: 12,
  },
  terminalLabel: {
    color: '#555555',
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 12,
  },
  terminalValue: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  formGroup: {
    marginTop: 8,
  },
  inputLabel: {
    color: '#777777',
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 8,
  },
  artInput: {
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#0A0A0A',
    color: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  footer: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    alignItems: 'center',
  },
  footerText: {
    color: '#444444',
    fontSize: 9,
    letterSpacing: 2,
  },
});