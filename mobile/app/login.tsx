import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { AppColors } from '@/constants/AppColors';
import { Fonts } from '@/constants/Fonts';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const { login } = useAuth();

  const facescanSource = require('@/assets/images/facescan.mp4');
  const player = useVideoPlayer(facescanSource);

  useEffect(() => {
    player.loop = true;
    player.play();
  }, [player]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter both email and password to continue.');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Authentication failed. Please check your credentials.';
      Alert.alert('Authentication Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.videoContainer}>
              <View style={styles.roundVideoContainer}>
                <VideoView 
                  player={player} 
                  style={styles.video}
                  contentFit="contain"
                  nativeControls={false}
                />
              </View>
            </View>

            <View style={styles.brandContainer}>
              <Text style={styles.brandName}>GeoAttend</Text>
              <Text style={styles.brandSubtitle}>
                ERP system based on location & face recognition
              </Text>
            </View>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            {/* Email Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={[
                styles.inputWrapper,
                emailFocused && styles.inputWrapperFocused,
              ]}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={emailFocused ? AppColors.primary[600] : AppColors.text.tertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="you@company.com"
                  placeholderTextColor={AppColors.text.tertiary}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!isLoading}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused,
              ]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={passwordFocused ? AppColors.primary[600] : AppColors.text.tertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your password"
                  placeholderTextColor={AppColors.text.tertiary}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  disabled={isLoading}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={AppColors.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={AppColors.text.inverse} size="small" />
              ) : (
                <>
                  <Text style={styles.signInButtonText}>Sign In</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={AppColors.text.inverse}
                    style={styles.buttonIcon}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AppColors.background.primary,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
  },

  // Header Section
  headerSection: {
    marginBottom: 15,
    alignItems: 'center',
  },
  videoContainer: {
    width: 100,
    height: 100,
    overflow: 'hidden',
    borderRadius: 50,
  },
  roundVideoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  video: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  brandContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  brandName: {
    fontSize: 24,
    fontFamily: Fonts.Helix.Bold,
    color: AppColors.text.primary,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  headerTextContainer: {
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    color: AppColors.text.primary,
    letterSpacing: -0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: AppColors.text.secondary,
    lineHeight: 20,
    textAlign: 'center',
  },

  // Form Card
  formCard: {
    backgroundColor: AppColors.surface.card,
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: AppColors.shadow.md,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 0,
      },
    }),
    borderWidth: 1,
    borderColor: AppColors.border.light,
  },

  // Form Fields
  fieldContainer: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.primary,
    marginBottom: 8,
    letterSpacing: -0.1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.background.secondary,
    borderWidth: 1.5,
    borderColor: AppColors.border.light,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: AppColors.primary[600],
    backgroundColor: AppColors.surface.primary,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.primary,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 6,
  },

  // Sign In Button
  signInButton: {
    flexDirection: 'row',
    backgroundColor: AppColors.primary[600],
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...Platform.select({
      ios: {
        shadowColor: AppColors.primary[600],
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: 15,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.inverse,
    letterSpacing: -0.2,
  },
  buttonIcon: {
    marginLeft: 6,
  },
});
