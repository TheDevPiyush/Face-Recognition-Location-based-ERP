import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
    View,
    ScrollView,
    Text,
    TouchableOpacity,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
    StyleSheet,
    Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiService } from '@/services/api';
import { Announcement } from '@/types/announcement';
import { CustomHeader } from '@/components/CustomHeader';
import { useAuth } from '@/contexts/AuthContext';
import { Fonts } from '@/constants/Fonts';
import { AppColors } from '@/constants/AppColors';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio, Video, ResizeMode } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context'


function formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `0:${String(sec).padStart(2, '0')}`;
}

function AudioPlayer({ uri }: { uri: string }) {
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const soundRef = useRef<Audio.Sound | null>(null);
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadAndPlay = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(
                { uri },
                { shouldPlay: true },
                (status) => {
                    if (status.isLoaded) {
                        setPosition(status.positionMillis);
                        if (status.durationMillis != null) setDuration(status.durationMillis);
                        if ((status as { didJustFinish?: boolean }).didJustFinish) setPlaying(false);
                    }
                }
            );
            soundRef.current = sound;
            const status = await sound.getStatusAsync();
            if (status.isLoaded) {
                setDuration(status.durationMillis ?? 0);
                setPosition(status.positionMillis);
            }
            setPlaying(true);
        } catch (e) {
            setPlaying(false);
        }
    };

    const playPause = async () => {
        try {
            if (soundRef.current) {
                if (playing) {
                    await soundRef.current.pauseAsync();
                    setPlaying(false);
                    if (progressInterval.current) {
                        clearInterval(progressInterval.current);
                        progressInterval.current = null;
                    }
                } else {
                    await soundRef.current.playAsync();
                    setPlaying(true);
                }
                return;
            }
            await loadAndPlay();
        } catch (e) {
            setPlaying(false);
        }
    };

    useEffect(() => {
        if (playing && soundRef.current) {
            progressInterval.current = setInterval(async () => {
                if (soundRef.current) {
                    const s = await soundRef.current.getStatusAsync();
                    if (s.isLoaded) setPosition(s.positionMillis);
                }
            }, 200);
        }
        return () => {
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
        };
    }, [playing]);

    useEffect(() => {
        return () => {
            soundRef.current?.unloadAsync().catch(() => { });
        };
    }, []);

    const progress = duration > 0 ? position / duration : 0;

    return (
        <View style={styles.audioBubble}>
            <TouchableOpacity
                style={styles.audioPlayBtn}
                onPress={playPause}
                activeOpacity={0.7}
            >
                <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.audioBody}>
                <View style={styles.audioProgressBar}>
                    <View style={[styles.audioProgressFill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={[styles.audioDuration, { fontFamily: Fonts.Helix.Medium }]}>
                    {formatDuration(position)}{duration > 0 ? ` / ${formatDuration(duration)}` : ''}
                </Text>
            </View>
        </View>
    );
}

function VideoPlayer({ uri }: { uri: string }) {
    const videoRef = useRef<Video>(null);
    return (
        <View style={styles.videoCard}>
            <Video
                ref={videoRef}
                source={{ uri }}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                style={styles.videoPlayer}
            />
        </View>
    );
}

const CHAR_LIMIT = 150;

function TextContentCard({ text, title }: { text: string, title: string }) {
    const [showFullModal, setShowFullModal] = useState(false);
    const isLong = text.length > CHAR_LIMIT;
    const preview = isLong ? text.slice(0, CHAR_LIMIT).trim() + '…' : text;

    return (
        <>
            <View style={styles.textContentCard}>
                <Text style={[styles.textContentPreview, { fontFamily: Fonts.Helix.Medium }]}>
                    {preview}
                </Text>
                {isLong && (
                    <TouchableOpacity
                        onPress={() => setShowFullModal(true)}
                        style={styles.readMoreBtn}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.readMoreText}>Read more</Text>
                        <Ionicons name="chevron-forward" size={14} color={AppColors.primary[600]} />
                    </TouchableOpacity>
                )}
            </View>
            <Modal visible={showFullModal} transparent animationType="fade">
                <View style={styles.readMoreOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowFullModal(false)} />
                    <View style={styles.readMoreModal} onStartShouldSetResponder={() => true}>
                        <View style={styles.readMoreModalHeader}>
                            <Text style={[styles.readMoreModalTitle, { fontFamily: Fonts.Helix.SemiBold }]}>
                                {title}
                            </Text>
                            <TouchableOpacity onPress={() => setShowFullModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                <Ionicons name="close" size={24} color="#374151" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.readMoreModalScroll} showsVerticalScrollIndicator={false}>
                            <Text style={[styles.readMoreModalText, { fontFamily: Fonts.Helix.Medium }]}>{text}</Text>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    content: {
        padding: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        color: '#000',
    },
    createButton: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: AppColors.primary[600],
        borderRadius: 12,
    },
    createButtonText: {
        color: '#fff',
        fontFamily: Fonts.Helix.Medium,
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        fontSize: 16,
        color: '#999',
    },
    announcementCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        overflow: 'hidden',
        borderLeftWidth: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 16,
    },
    cardTitle: {
        fontSize: 16,
        color: '#000',
        flex: 1,
        marginRight: 8,
    },
    badges: {
        flexDirection: 'row',
        gap: 6,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        fontSize: 11,
    },
    pinnedBadge: {
        backgroundColor: '#FFC107',
        color: '#000',
    },
    typeBadgeText: {
        color: '#fff',
        fontSize: 11,
    },
    cardDescription: {
        fontSize: 14,
        color: '#666',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    cardContent: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    textContent: {
        fontSize: 14,
        color: '#333',
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
    },
    textContentCard: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        marginHorizontal: 16,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: AppColors.primary[200],
    },
    textContentPreview: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 22,
    },
    readMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 10,
    },
    readMoreText: {
        fontSize: 14,
        color: AppColors.primary[600],
        fontFamily: Fonts.Helix.SemiBold,
    },
    readMoreOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    readMoreModal: {
        backgroundColor: '#fff',
        borderRadius: 16,
        maxHeight: '80%',
        width: '100%',
        overflow: 'hidden',
    },
    readMoreModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    readMoreModalTitle: {
        fontSize: 18,
        color: '#111827',
    },
    readMoreModalScroll: {
        maxHeight: 400,
        padding: 16,
    },
    readMoreModalText: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 24,
    },
    audioBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 156, 250, 0.24)',
        marginHorizontal: 16,
        marginBottom: 12,
        paddingVertical: 12,
        paddingLeft: 12,
        paddingRight: 16,
        borderRadius: 12,
        gap: 12,
    },
    audioPlayBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(23, 131, 255, 0.91)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioBody: {
        flex: 1,
    },
    audioProgressBar: {
        height: 4,
        backgroundColor: 'rgba(23, 131, 255, 0.49)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
    },
    audioProgressFill: {
        height: '100%',
        backgroundColor: 'rgba(23, 131, 255, 0.79)',
        borderRadius: 2,
    },
    audioDuration: {
        fontSize: 12,
        color: '#374151',
    },
    videoCard: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
    },
    videoPlayer: {
        width: '100%',
        height: 200,
    },
    footer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        color: '#999',
    },
    deleteButton: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#FF3B30',
        borderRadius: 6,
        fontFamily: Fonts.Helix.SemiBold,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 12,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 16,
        maxHeight: '90%',
    },
    formTitle: {
        fontSize: 20,
        marginBottom: 20,
        fontFamily: Fonts.Helix.SemiBold,
        color: '#111827',
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        fontSize: 14,
        fontFamily: Fonts.Helix.Medium,
    },
    textArea: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        fontSize: 14,
        height: 100,
        textAlignVertical: 'top',
        color: '#111827',
        fontFamily: Fonts.Helix.Medium,
    },
    submitButton: {
        backgroundColor: AppColors.primary[600],
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    submitButtonText: {
        color: '#fff',
        fontFamily: Fonts.Helix.SemiBold,
        fontSize: 16,
    },
    checkboxRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
    },
    checkboxItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default function AnnouncementsScreen() {
    const { user } = useAuth();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [formData, setFormData] = useState<{
        title: string;
        description: string;
        announcement_type: 'text' | 'audio' | 'video';
        text_content: string;
        audio_url: string;
        video_url: string;
        is_published: boolean;
        is_pinned: boolean;
    }>({
        title: '',
        description: '',
        announcement_type: 'text',
        text_content: '',
        audio_url: '',
        video_url: '',
        is_published: true,
        is_pinned: false,
    });

    const isAdmin = user?.is_staff || false;

    useFocusEffect(
        useCallback(() => {
            fetchAnnouncements();
        }, [])
    );

    const fetchAnnouncements = async () => {
        try {
            setLoading(true);
            const data = await apiService.getAnnouncements();
            setAnnouncements(Array.isArray(data) ? data : (data as any).results || []);
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch announcements');
        } finally {
            setLoading(false);
        }
    };

    const handleFormChange = (field: string, value: string | boolean) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSubmit = async () => {
        if (!formData.title.trim()) {
            Alert.alert('Validation Error', 'Title is required');
            return;
        }

        const type = formData.announcement_type;
        if (type === 'text' && !formData.text_content.trim()) {
            Alert.alert('Validation Error', 'Text content is required for text announcements');
            return;
        }

        if (type === 'audio' && !formData.audio_url.trim()) {
            Alert.alert('Validation Error', 'Audio URL is required for audio announcements');
            return;
        }

        if (type === 'video' && !formData.video_url.trim()) {
            Alert.alert('Validation Error', 'Video URL is required for video announcements');
            return;
        }

        try {
            setSubmitting(true);
            const type = formData.announcement_type;
            const payload = {
                title: formData.title,
                description: formData.description || undefined,
                announcement_type: type,
                text_content: type === 'text' ? formData.text_content : undefined,
                audio_url: type === 'audio' ? formData.audio_url : undefined,
                video_url: type === 'video' ? formData.video_url : undefined,
                is_published: formData.is_published,
                is_pinned: formData.is_pinned,
            };

            await apiService.createAnnouncement(payload);
            Alert.alert('Success', 'Announcement created successfully');

            setFormData({
                title: '',
                description: '',
                announcement_type: 'text',
                text_content: '',
                audio_url: '',
                video_url: '',
                is_published: true,
                is_pinned: false,
            });
            setShowForm(false);
            fetchAnnouncements();
        } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create announcement');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id: number) => {
        Alert.alert(
            'Delete Announcement',
            'Are you sure you want to delete this announcement?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiService.deleteAnnouncement(id);
                            Alert.alert('Success', 'Announcement deleted successfully');
                            fetchAnnouncements();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete announcement');
                        }
                    },
                },
            ]
        );
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'text':
                return '#007AFF';
            case 'audio':
                return '#9C27B0';
            case 'video':
                return '#F44336';
            default:
                return '#999';
        }
    };

    const renderContent = (announcement: Announcement) => {
        const type = announcement.announcement_type;
        switch (type) {
            case 'text':
                return announcement.text_content ? (
                    <TextContentCard text={announcement.text_content} title={announcement.title} />
                ) : null;
            case 'audio':
                return announcement.audio_url ? (
                    <AudioPlayer uri={announcement.audio_url} />
                ) : null;
            case 'video':
                return announcement.video_url ? (
                    <VideoPlayer uri={announcement.video_url} />
                ) : null;
            default:
                return null;
        }
    };

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: false,
            quality: 1,
        });
        if (!result.canceled && result.assets && result.assets[0].uri) {
            return result.assets[0].uri;
        }
        return null;
    };

    const recordVideo = async () => {
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: false,
            quality: 1,
        });
        if (!result.canceled && result.assets && result.assets[0].uri) {
            return result.assets[0].uri;
        }
        return null;
    };

    const pickAudio = async (): Promise<string | null> => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['audio/*', 'audio/mpeg', 'audio/mp3', 'audio/m4a', 'audio/aac', 'audio/wav'],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.[0]?.uri) return null;
            return result.assets[0].uri;
        } catch {
            return null;
        }
    };

    const recordAudio = async (): Promise<string | null> => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Microphone permission is required to record audio.');
                return null;
            }
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            // Return a promise that resolves when user stops - we'll use a simple approach:
            // Show alert to stop, then stop and return URI.
            return new Promise((resolve) => {
                const checkStop = () => {
                    Alert.alert(
                        'Recording',
                        'Tap OK when done recording.',
                        [
                            {
                                text: 'Stop & Use',
                                onPress: async () => {
                                    try {
                                        await recording.stopAndUnloadAsync();
                                        const uri = recording.getURI();
                                        resolve(uri || null);
                                    } catch {
                                        resolve(null);
                                    }
                                },
                            },
                            { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
                        ],
                        { cancelable: false }
                    );
                };
                checkStop();
            });
        } catch (e) {
            Alert.alert('Error', 'Failed to start recording.');
            return null;
        }
    };

    const uploadMedia = async (uri: string, type: 'audio' | 'video'): Promise<string> => {
        const ext = type === 'audio' ? 'm4a' : 'mp4';
        const mime = type === 'audio' ? 'audio/m4a' : 'video/mp4';
        const formData = new FormData();
        formData.append('file', {
            uri: Platform.OS === 'android' && !uri.startsWith('file://') ? `file://${uri}` : uri,
            type: mime,
            name: `announcement-media.${ext}`,
        } as unknown as Blob);
        const { url } = await apiService.uploadAnnouncementMedia(formData);
        return url;
    };

    return (
        <SafeAreaView style={styles.container}>
            <CustomHeader title="Announcements" compact />

            <View style={{ flex: 1 }}>
                {/* Header with Create Button */}
                {isAdmin && (
                    <View style={styles.content}>
                        <TouchableOpacity
                            style={[styles.createButton, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
                            onPress={() => setShowForm(true)}
                            activeOpacity={0.6}
                        >
                            <Ionicons name="add" size={20} color="#fff" />
                            <Text style={[styles.createButtonText, { fontFamily: Fonts.Helix.SemiBold }]}>New Announcement</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Loading State */}
                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={styles.emptyText}>Loading announcements...</Text>
                    </View>
                )}

                {/* Empty State */}
                {!loading && announcements.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No announcements</Text>
                    </View>
                )}

                {/* Announcements List */}
                {!loading && announcements.length > 0 && (
                    <ScrollView style={styles.content}>
                        {announcements.map((announcement) => (
                            <View
                                key={announcement.id}
                                style={[
                                    styles.announcementCard,
                                    { borderLeftColor: getTypeColor(announcement.announcement_type) },
                                ]}
                            >
                                <View style={styles.cardHeader}>
                                    <Text style={[styles.cardTitle, { fontFamily: Fonts.Helix.SemiBold }]}>{announcement.title}</Text>
                                    <View style={styles.badges}>
                                        {announcement.is_pinned && (
                                            <View style={[styles.badge, styles.pinnedBadge]}>
                                                <Text>📌</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                {announcement.description && (
                                    <Text style={[styles.cardDescription, { fontFamily: Fonts.Helix.SemiBold }]}>{announcement.description}</Text>
                                )}

                                <View style={styles.footer}>
                                    <View>
                                        <Text style={[styles.footerText, { fontFamily: Fonts.Helix.SemiBold }]}>
                                            {announcement.created_by?.name || 'Admin'}
                                        </Text>
                                        <Text style={[styles.footerText, { fontFamily: Fonts.Helix.SemiBold }]}>
                                            {new Date(announcement.published_at).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    {isAdmin && (
                                        <TouchableOpacity
                                            style={styles.deleteButton}
                                            onPress={() => handleDelete(announcement.id)}
                                        >
                                            <Ionicons name='trash-bin-outline' color={"white"} />
                                            <Text style={styles.deleteButtonText}>Delete</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {renderContent(announcement)}

                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Create Form Modal */}
            {isAdmin && (
                <Modal
                    visible={showForm}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowForm(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.formTitle}>Create Announcement</Text>

                            <ScrollView>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Title *"
                                    value={formData.title}
                                    onChangeText={(text) => handleFormChange('title', text)}
                                    editable={!submitting}
                                />

                                <TextInput
                                    style={styles.textArea}
                                    placeholder="Description (Optional)"
                                    value={formData.description}
                                    onChangeText={(text) => handleFormChange('description', text)}
                                    multiline
                                    editable={!submitting}
                                />

                                <Text style={{ marginBottom: 10, fontFamily: Fonts.Helix.SemiBold, color: '#111827' }}>
                                    Type
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                                    {[
                                        { type: 'text' as const, icon: 'document-text-outline' as const, label: 'Text' },
                                        { type: 'audio' as const, icon: 'musical-notes-outline' as const, label: 'Audio' },
                                        { type: 'video' as const, icon: 'videocam-outline' as const, label: 'Video' },
                                    ].map(({ type, icon, label }) => (
                                        <TouchableOpacity
                                            key={type}
                                            style={{
                                                flex: 1,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 6,
                                                paddingVertical: 12,
                                                borderWidth: 2,
                                                borderColor: formData.announcement_type === type ? AppColors.primary[600] : '#E5E7EB',
                                                borderRadius: 12,
                                                backgroundColor: formData.announcement_type === type ? AppColors.primary[50] : 'transparent',
                                            }}
                                            onPress={() => handleFormChange('announcement_type', type)}
                                        >
                                            <Ionicons
                                                name={icon}
                                                size={18}
                                                color={formData.announcement_type === type ? AppColors.primary[600] : '#6B7280'}
                                            />
                                            <Text
                                                style={{
                                                    color: formData.announcement_type === type ? AppColors.primary[600] : '#6B7280',
                                                    fontFamily: Fonts.Helix.SemiBold,
                                                    fontSize: 14,
                                                }}
                                            >
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {((formData.announcement_type as string) === 'text') && (
                                    <TextInput
                                        style={[styles.textArea, { height: 120 }]}
                                        placeholder="Content *"
                                        value={formData.text_content}
                                        onChangeText={(text) => handleFormChange('text_content', text)}
                                        multiline
                                        editable={!submitting}
                                    />
                                )}

                                {((formData.announcement_type as string) === 'audio') && (
                                    <View>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Audio URL (or record/pick below) *"
                                            value={formData.audio_url}
                                            onChangeText={(text) => handleFormChange('audio_url', text)}
                                            editable={!submitting}
                                        />
                                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                            <TouchableOpacity
                                                style={[styles.createButton, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, (submitting || uploadingMedia) && { opacity: 0.6 }]}
                                                onPress={async () => {
                                                    const uri = await recordAudio();
                                                    if (uri) {
                                                        try {
                                                            setUploadingMedia(true);
                                                            const url = await uploadMedia(uri, 'audio');
                                                            handleFormChange('audio_url', url);
                                                            Alert.alert('Success', 'Audio uploaded!');
                                                        } catch (e) {
                                                            Alert.alert('Error', 'Audio upload failed');
                                                        } finally {
                                                            setUploadingMedia(false);
                                                        }
                                                    }
                                                }}
                                                disabled={submitting || uploadingMedia}
                                            >
                                                {uploadingMedia ? (
                                                    <>
                                                        <ActivityIndicator size="small" color="#fff" />
                                                        <Text style={[styles.createButtonText, { fontFamily: Fonts.Helix.Medium }]}>Uploading…</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Ionicons name="mic-outline" size={18} color="#fff" />
                                                        <Text style={[styles.createButtonText, { fontFamily: Fonts.Helix.Medium }]}>Record</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.createButton, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, (submitting || uploadingMedia) && { opacity: 0.6 }]}
                                                onPress={async () => {
                                                    const uri = await pickAudio();
                                                    if (uri) {
                                                        try {
                                                            setUploadingMedia(true);
                                                            const url = await uploadMedia(uri, 'audio');
                                                            handleFormChange('audio_url', url);
                                                            Alert.alert('Success', 'Audio uploaded!');
                                                        } catch (e) {
                                                            Alert.alert('Error', 'Audio upload failed');
                                                        } finally {
                                                            setUploadingMedia(false);
                                                        }
                                                    } else {
                                                        Alert.alert('Info', 'No audio file selected.');
                                                    }
                                                }}
                                                disabled={submitting || uploadingMedia}
                                            >
                                                {uploadingMedia ? (
                                                    <>
                                                        <ActivityIndicator size="small" color="#fff" />
                                                        <Text style={[styles.createButtonText, { fontFamily: Fonts.Helix.Medium }]}>Uploading…</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Ionicons name="folder-open-outline" size={18} color="#fff" />
                                                        <Text style={[styles.createButtonText, { fontFamily: Fonts.Helix.Medium }]}>Pick</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                {((formData.announcement_type as string) === 'video') && (
                                    <View>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Video URL *"
                                            value={formData.video_url}
                                            onChangeText={(text) => handleFormChange('video_url', text)}
                                            editable={!submitting}
                                        />
                                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                            <TouchableOpacity
                                                style={[styles.createButton, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, (submitting || uploadingMedia) && { opacity: 0.6 }]}
                                                onPress={async () => {
                                                    const uri = await recordVideo();
                                                    if (uri) {
                                                        try {
                                                            setUploadingMedia(true);
                                                            const url = await uploadMedia(uri, 'video');
                                                            handleFormChange('video_url', url);
                                                            Alert.alert('Success', 'Video uploaded!');
                                                        } catch (e) {
                                                            Alert.alert('Error', 'Video upload failed');
                                                        } finally {
                                                            setUploadingMedia(false);
                                                        }
                                                    }
                                                }}
                                                disabled={submitting || uploadingMedia}
                                            >
                                                {uploadingMedia ? (
                                                    <>
                                                        <ActivityIndicator size="small" color="#fff" />
                                                        <Text style={[styles.createButtonText, { fontFamily: Fonts.Helix.Medium }]}>Uploading…</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Ionicons name="videocam-outline" size={18} color="#fff" />
                                                        <Text style={[styles.createButtonText, { fontFamily: Fonts.Helix.Medium }]}>Record</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.createButton, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, (submitting || uploadingMedia) && { opacity: 0.6 }]}
                                                onPress={async () => {
                                                    const uri = await pickVideo();
                                                    if (uri) {
                                                        try {
                                                            setUploadingMedia(true);
                                                            const url = await uploadMedia(uri, 'video');
                                                            handleFormChange('video_url', url);
                                                            Alert.alert('Success', 'Video uploaded!');
                                                        } catch (e) {
                                                            Alert.alert('Error', 'Video upload failed');
                                                        } finally {
                                                            setUploadingMedia(false);
                                                        }
                                                    }
                                                }}
                                                disabled={submitting || uploadingMedia}
                                            >
                                                {uploadingMedia ? (
                                                    <>
                                                        <ActivityIndicator size="small" color="#fff" />
                                                        <Text style={[styles.createButtonText, { fontFamily: Fonts.Helix.Medium }]}>Uploading…</Text>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Ionicons name="folder-open-outline" size={18} color="#fff" />
                                                        <Text style={[styles.createButtonText, { fontFamily: Fonts.Helix.Medium }]}>Pick</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}

                                <View style={styles.checkboxRow}>
                                    <TouchableOpacity
                                        style={styles.checkboxItem}
                                        onPress={() =>
                                            handleFormChange('is_published', !formData.is_published)
                                        }
                                    >
                                        <Text style={{ marginRight: 8, fontSize: 18 }}>
                                            {formData.is_published ? '✓' : '○'}
                                        </Text>
                                        <Text style={{ color: '#000' }}>Publish Now</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.checkboxItem}
                                        onPress={() => handleFormChange('is_pinned', !formData.is_pinned)}
                                    >
                                        <Text style={{ marginRight: 8, fontSize: 18 }}>
                                            {formData.is_pinned ? '✓' : '○'}
                                        </Text>
                                        <Text style={{ color: '#000' }}>Pin to Top</Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={[styles.submitButton, (submitting || uploadingMedia) && { opacity: 0.6 }]}
                                    onPress={handleSubmit}
                                    disabled={submitting || uploadingMedia}
                                >
                                    {submitting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : uploadingMedia ? (
                                        <>
                                            <ActivityIndicator size="small" color="#fff" />
                                            <Text style={styles.submitButtonText}>Uploading…</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Ionicons name="send" size={18} color="#fff" />
                                            <Text style={styles.submitButtonText}>Create</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{
                                        padding: 14,
                                        alignItems: 'center',
                                        marginTop: 8,
                                        backgroundColor: '#E9ECEF',
                                        borderRadius: 8,
                                    }}
                                    onPress={() => setShowForm(false)}
                                    disabled={submitting}
                                >
                                    <Text style={{ color: '#333', fontSize: 16 }}>
                                        Cancel
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </SafeAreaView>
    );
}
