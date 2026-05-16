/* ============================================================
   AI Video Studio Pro — state.js
   Application state (single source of truth)
   ============================================================ */

var state = {
    user: null,
    videoFile: null,
    audioFile: null,
    audioBlob: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    apiKeys: {},
    exportQuality: '720p',
    mediaRecorder: null,
    recordedChunks: [],
    isRecording: false,
    currentAvatar: 'default',
    currentScene: 'studio',
    generatedContent: [],
    projects: [
        {
            name: 'Nuovo Progetto',
            date: 'Oggi, ' + new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
            active: true
        }
    ],
    storageUsed: 0,
    currentTab: 'create'
};
