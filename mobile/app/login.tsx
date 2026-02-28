import React, { useEffect, useRef, useState } from 'react';
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

type Step = 'email' | 'otp';

export default function LoginScreen() {
  const [step, setStep]         = useState<Step>('email');
  const [email, setEmail]       = useState('');
  const [code, setCode]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [codeFocused, setCodeFocused]   = useState(false);
  const [resendTimer, setResendTimer]   = useState(0);

  const codeInputRef = useRef<TextInput>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const { sendCode, verifyCode } = useAuth();

  const facescanSource = require('@/assets/images/facescan.mp4');
  const player = useVideoPlayer(facescanSource);

  useEffect(() => {
    player.loop = true;
    player.play();
  }, [player]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [resendTimer]);

  // ── Step 1: Send OTP ────────────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Required', 'Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      await sendCode(email.trim());
      setStep('otp');
      setResendTimer(60);
      setTimeout(() => codeInputRef.current?.focus(), 300);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to send code. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: Verify OTP ──────────────────────────────────────────────────
  const handleVerifyCode = async () => {
    if (!code.trim()) {
      Alert.alert('Required', 'Please enter the verification code.');
      return;
    }

    setIsLoading(true);
    try {
      await verifyCode(email.trim(), code.trim());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Invalid code. Please try again.';
      Alert.alert('Verification Failed', message);
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setIsLoading(true);
    try {
      await sendCode(email.trim());
      setResendTimer(60);
      setCode('');
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to resend code.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setCode('');
    setResendTimer(0);
    clearInterval(timerRef.current!);
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
          {/* Header */}
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

            {/* Back button on OTP step */}
            {step === 'otp' && (
              <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={isLoading}>
                <Ionicons name="arrow-back" size={16} color={AppColors.text.secondary} />
                <Text style={styles.backButtonText}>Change email</Text>
              </TouchableOpacity>
            )}

            {/* Step title */}
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>
                {step === 'email' ? 'Welcome back' : 'Check your email'}
              </Text>
              <Text style={styles.stepSubtitle}>
                {step === 'email'
                  ? 'Enter your email to receive a sign-in code'
                  : `We sent a 6-digit code to\n${email}`}
              </Text>
            </View>

            {/* Email step */}
            {step === 'email' && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
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
                    returnKeyType="done"
                    onSubmitEditing={handleSendCode}
                  />
                </View>
              </View>
            )}

            {/* OTP step */}
            {step === 'otp' && (
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Verification Code</Text>
                <View style={[styles.inputWrapper, codeFocused && styles.inputWrapperFocused]}>
                  <Ionicons
                    name="key-outline"
                    size={18}
                    color={codeFocused ? AppColors.primary[600] : AppColors.text.tertiary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={codeInputRef}
                    style={[styles.textInput, styles.codeInput]}
                    placeholder="000000"
                    placeholderTextColor={AppColors.text.tertiary}
                    value={code}
                    onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                    onFocus={() => setCodeFocused(true)}
                    onBlur={() => setCodeFocused(false)}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    editable={!isLoading}
                    returnKeyType="done"
                    onSubmitEditing={handleVerifyCode}
                    maxLength={6}
                  />
                </View>

                {/* Resend */}
                <TouchableOpacity
                  style={styles.resendRow}
                  onPress={handleResend}
                  disabled={resendTimer > 0 || isLoading}
                >
                  <Text style={[
                    styles.resendText,
                    resendTimer > 0 && styles.resendTextDisabled,
                  ]}>
                    {resendTimer > 0
                      ? `Resend code in ${resendTimer}s`
                      : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Primary action button */}
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
              onPress={step === 'email' ? handleSendCode : handleVerifyCode}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color={AppColors.text.inverse} size="small" />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>
                    {step === 'email' ? 'Send Code' : 'Verify & Sign In'}
                  </Text>
                  <Ionicons
                    name={step === 'email' ? 'send-outline' : 'checkmark-circle-outline'}
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
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 24,
  },

  // Header
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
      android: { elevation: 0 },
    }),
    borderWidth: 1,
    borderColor: AppColors.border.light,
  },

  // Back button
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 13,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.secondary,
    marginLeft: 4,
  },

  // Step header
  stepHeader: {
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontFamily: Fonts.Helix.Bold,
    color: AppColors.text.primary,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  stepSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.secondary,
    lineHeight: 19,
  },

  // Fields
  fieldContainer: { marginBottom: 18 },
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
  inputIcon: { marginRight: 10 },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.text.primary,
    paddingVertical: 0,
  },
  codeInput: {
    letterSpacing: 4,
    fontSize: 18,
  },

  // Resend
  resendRow: {
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  resendText: {
    fontSize: 13,
    fontFamily: Fonts.Helix.Medium,
    color: AppColors.primary[600],
  },
  resendTextDisabled: {
    color: AppColors.text.tertiary,
  },

  // Primary button
  primaryButton: {
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
      android: { elevation: 4 },
    }),
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: Fonts.Helix.SemiBold,
    color: AppColors.text.inverse,
    letterSpacing: -0.2,
  },
  buttonIcon: { marginLeft: 6 },
});