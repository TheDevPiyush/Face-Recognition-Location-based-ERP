import React, { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import { CustomHeader } from '@/components/CustomHeader';
import { AppColors } from '@/constants/AppColors';
import { Fonts } from '@/constants/Fonts';
import type { CurrentUser } from '@/types/user';

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string | null | undefined;
  last?: boolean;
}) {
  const display = value ?? '—';
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Ionicons name={icon} size={18} color={AppColors.text.link} style={styles.infoIcon} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} numberOfLines={1}>
          {display}
        </Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { logout } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Image upload state
  const [uploading, setUploading] = useState(false);

  const handleEditPicture = useCallback(async () => {
    if (!user?.can_update_picture) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        'Please allow access to your photos to update your profile picture.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset?.uri) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('profile_picture', {
        uri: asset.uri,
        name: 'profile.jpg',
        type: 'image/jpeg',
      } as any);

      const response = await apiService.patchCurrentUser(formData);
      setUser(response);

      Alert.alert('Success', 'Profile picture updated!');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update image';
      Alert.alert('Error', msg);
    } finally {
      setUploading(false);
    }
  }, [user]);


  const fetchUser = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getCurrentUser();
      console.log(data)
      setUser(data);
    } catch (e) {
      console.log(e)
      const msg = e instanceof Error ? e.message : 'Failed to load profile';
      setError(msg);
      setUser(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchUser();
    }, [fetchUser])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUser();
  }, [fetchUser]);

  const handleLogout = useCallback(() => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }, [logout]);

  if (loading && !user) {
    return (
      <View style={styles.screen}>
        <CustomHeader title="Profile" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={AppColors.primary[600]} />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      </View>
    );
  }

  if (error && !user) {
    return (
      <View style={styles.screen}>
        <CustomHeader title="Profile" />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={AppColors.status.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchUser(); }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const batchLabel = user?.batch?.name ?? user?.batch?.code ?? null;
  const roleLabel = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : null;

  return (
    <View style={styles.screen}>
      <CustomHeader title="Profile" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppColors.primary[600]} />
        }
      >
        <View style={styles.avatarCard}>
          <View style={styles.avatarWrapper}>
            {user?.profile_picture ? (
              <Image source={{ uri: user.profile_picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color={AppColors.text.link} />
              </View>
            )}
            {/* Edit icon overlay if allowed */}
            {user?.can_update_picture ? (
              <TouchableOpacity style={styles.editIcon} activeOpacity={0.7} onPress={handleEditPicture} disabled={uploading}>
                <Ionicons name="create-outline" size={22} color={AppColors.primary[600]} />
                {uploading ? <ActivityIndicator size={16} color={AppColors.primary[600]} style={{ position: 'absolute', top: -18, right: -18 }} /> : null}
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name} numberOfLines={1}>{user?.name ?? 'No name'}</Text>
            {user?.email ? (
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <InfoRow icon="mail-outline" label="Email" value={user?.email ?? null} />
          <InfoRow icon="person-outline" label="Role" value={roleLabel} />
          <InfoRow icon="school-outline" label="Batch" value={batchLabel} last />
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={AppColors.status.error} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: AppColors.background.primary,
  },
  container: {
    flex: 1,
    backgroundColor: AppColors.background.primary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppColors.background.primary,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.secondary,
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: AppColors.primary[600],
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 15,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.inverse,
  },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  avatarWrapper: {
    marginRight: 16,
    position: 'relative',
  },
  editIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: AppColors.background.primary,
    borderRadius: 16,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: AppColors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 22,
    fontFamily: Fonts.Helix.Bold,
    color: AppColors.text.primary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.secondary,
  },
  card: {
    backgroundColor: AppColors.surface.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.primary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border.default,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoIcon: {
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.tertiary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.primary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: AppColors.status.error,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.status.error,
  },
});
