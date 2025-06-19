/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";

const MODEL_NAME = 'gemini-2.5-flash-preview-04-17';
const API_KEY = process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Chat Elements
const chatDisplayArea = document.querySelector('.chat-display-area') as HTMLDivElement;
const chatInputForm = document.querySelector('.chat-input-form') as HTMLFormElement;
const chatInputElement = document.querySelector('.chat-input') as HTMLInputElement;
const chatSubmitButton = document.querySelector('.chat-submit-button') as HTMLButtonElement;

let chat: Chat | null = null;

const systemInstruction = `Kamu adalah Mr. GenR, seorang pria tampan yang sangat karismatik dan mempesona, dengan pengetahuan luas tentang musik dan seni musik. Sapa pengguna dengan hangat. Gaya bicaramu sopan, ramah, sedikit puitis, dan penuh wawasan musik, seolah berbincang dengan teman dekat. YANG PALING PENTING: Berikan jawaban yang SANGAT RINGKAS dan JELAS untuk setiap pertanyaan. Langsung ke inti permasalahan tanpa bertele-tele, namun tetap pertahankan pesonamu. Hindari paragraf panjang jika tidak benar-benar diperlukan.`;

// --- AppState Interface and Storage ---
interface FinalPromptComponents {
    lyrics?: { text: string; language: string };
    genreMood?: string;
    instruments?: string;
    vocals?: string;
    // instrumentSpecific removed as it's no longer sent to final prompt
}

interface SavedMusicItem {
    id: string;
    title: string; 
    prompt: string; 
    timestamp: Date;
}

interface SavedInstrumentItem {
    id: string;
    title: string; // Added title for AI-generated title
    description: string; 
    timestamp: Date;
}

interface AppState {
    chatHistory: { role: string, parts: { text: string }[] }[];
    lyricCount: number;
    lyricModalSongTitle: string;
    lyricModalOutput: string;
    lyricModalSelectedLanguage: string;
    designCount: number;
    genreMoodModalSelectedGenres: string[];
    genreMoodModalSelectedMood: string | null;
    genreMoodModalOutput: string;
    instrumentDesignCount: number;
    instrumentModalSelectedMain: string[];
    instrumentModalSelectedAdditional: string[];
    instrumentModalOutput: string;
    vocalistDesignCount: number;
    vocalistModalIsMaleSelected: boolean;
    vocalistModalMaleRange: string | null;
    vocalistModalIsFemaleSelected: boolean;
    vocalistModalFemaleRange: string | null;
    vocalistModalArtistRef: string;
    vocalistModalOutput: string;
    instrumentSpecificCount: number; 
    instrumentSpecificModalInput: string;
    instrumentSpecificModalOutput: string;
    instrumentSpecificProgress: number; // New: progress for this card
    notifications: NotificationItem[];
    nextNotificationId: number;
    profilePicUrl: string;
    isSidebarCollapsed: boolean; 

    collectedFinalPromptComponents: FinalPromptComponents;
    lyricPromptSent: boolean;
    genreMoodPromptSent: boolean;
    instrumentPromptSent: boolean;
    vocalistPromptSent: boolean;
    finalMusicPromptOutput: string | null;

    savedMusicItems: SavedMusicItem[];
    savedInstrumentItems: SavedInstrumentItem[];
}

const BASE_APP_STATE_KEY = 'sunoPromptGenR_user_';
const APP_STATE_VERSION = '_v4'; 

function getUserSpecificStorageKey(username: string): string {
    return `${BASE_APP_STATE_KEY}${username}${APP_STATE_VERSION}`;
}

const DEFAULT_PROFILE_PIC_URL = 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWw0bHg0NmFzYTV2b3JocGhpZnhzYmJ2Zms0dHI5bTJkbzBrd2RsciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKWpu2j5jG44WpG/giphy.gif';

let currentAppState: AppState = { 
    chatHistory: [],
    lyricCount: 0,
    lyricModalSongTitle: '',
    lyricModalOutput: '',
    lyricModalSelectedLanguage: 'indonesia',
    designCount: 0,
    genreMoodModalSelectedGenres: [],
    genreMoodModalSelectedMood: null,
    genreMoodModalOutput: '',
    instrumentDesignCount: 0,
    instrumentModalSelectedMain: [],
    instrumentModalSelectedAdditional: [],
    instrumentModalOutput: '',
    vocalistDesignCount: 0,
    vocalistModalIsMaleSelected: false,
    vocalistModalMaleRange: null,
    vocalistModalIsFemaleSelected: false,
    vocalistModalFemaleRange: null,
    vocalistModalArtistRef: '',
    vocalistModalOutput: '',
    instrumentSpecificCount: 0,
    instrumentSpecificModalInput: '',
    instrumentSpecificModalOutput: '',
    instrumentSpecificProgress: 0, // New
    notifications: [],
    nextNotificationId: 1,
    profilePicUrl: DEFAULT_PROFILE_PIC_URL,
    isSidebarCollapsed: false,
    collectedFinalPromptComponents: {},
    lyricPromptSent: false,
    genreMoodPromptSent: false,
    instrumentPromptSent: false,
    vocalistPromptSent: false,
    finalMusicPromptOutput: null,
    savedMusicItems: [
        { id: 'music_default_1', title: 'Melodi Senja (Contoh)', prompt: 'Genre: Lo-fi Hip Hop, Mood: Tenang (Calm), Instruments: Piano, Drum Machine, Synth Pads\nBahasa: Instrumental (tidak ada lirik),\nJudul Lagu : Melodi Senja\nVokalis: Instrumental (tidak ada vokalis),\nMusic Type: Instrumental (Tidak ada lirik)', timestamp: new Date(Date.now() - 86400000 * 2) },
        { id: 'music_default_2', title: 'Pagi Ceria (Contoh)', prompt: 'Genre: Pop Ceria, Mood: Bahagia (Uplifting), Instruments: Ukulele, Gitar Akustik, Perkusi Ringan\nBahasa: Indonesia,\nJudul Lagu : Pagi Ceria\nVokalis: Wanita, Sopran (suara tinggi),\nInclude these lyrics:\n\n[Verse 1]\nMentari bersinar lagi\nEmbun pagi menyejukkan hati', timestamp: new Date(Date.now() - 86400000) }
    ],
    savedInstrumentItems: [
        { id: 'instr_default_1', title: 'Suara Hujan Akustik (Contoh)', description: 'Gitar Akustik, Piano Rhodes, Cello, Suara Hujan.', timestamp: new Date(Date.now() - 3600000 * 5) },
        { id: 'instr_default_2', title: 'Synth Elektronik Klasik (Contoh)', description: 'Drum Machine TR-808, Bass Synth Moog, Synth Pads Juno, Glitch Effects.', timestamp: new Date(Date.now() - 3600000 * 3) }
    ],
};

function resetAppStateToDefaults() {
    currentAppState = {
        chatHistory: [],
        lyricCount: 0,
        lyricModalSongTitle: '',
        lyricModalOutput: '',
        lyricModalSelectedLanguage: 'indonesia',
        designCount: 0,
        genreMoodModalSelectedGenres: [],
        genreMoodModalSelectedMood: null,
        genreMoodModalOutput: '',
        instrumentDesignCount: 0,
        instrumentModalSelectedMain: [],
        instrumentModalSelectedAdditional: [],
        instrumentModalOutput: '',
        vocalistDesignCount: 0,
        vocalistModalIsMaleSelected: false,
        vocalistModalMaleRange: null,
        vocalistModalIsFemaleSelected: false,
        vocalistModalFemaleRange: null,
        vocalistModalArtistRef: '',
        vocalistModalOutput: '',
        instrumentSpecificCount: 0,
        instrumentSpecificModalInput: '',
        instrumentSpecificModalOutput: '',
        instrumentSpecificProgress: 0, // New
        notifications: [],
        nextNotificationId: 1,
        profilePicUrl: DEFAULT_PROFILE_PIC_URL,
        isSidebarCollapsed: false,
        collectedFinalPromptComponents: {},
        lyricPromptSent: false,
        genreMoodPromptSent: false,
        instrumentPromptSent: false,
        vocalistPromptSent: false,
        finalMusicPromptOutput: null,
        savedMusicItems: [ 
            { id: 'music_default_1', title: 'Melodi Senja (Contoh)', prompt: 'Genre: Lo-fi Hip Hop, Mood: Tenang (Calm), Instruments: Piano, Drum Machine, Synth Pads\nBahasa: Instrumental (tidak ada lirik),\nJudul Lagu : Melodi Senja\nVokalis: Instrumental (tidak ada vokalis),\nMusic Type: Instrumental (Tidak ada lirik)', timestamp: new Date(Date.now() - 86400000 * 2) },
            { id: 'music_default_2', title: 'Pagi Ceria (Contoh)', prompt: 'Genre: Pop Ceria, Mood: Bahagia (Uplifting), Instruments: Ukulele, Gitar Akustik, Perkusi Ringan\nBahasa: Indonesia,\nJudul Lagu : Pagi Ceria\nVokalis: Wanita, Sopran (suara tinggi),\nInclude these lyrics:\n\n[Verse 1]\nMentari bersinar lagi\nEmbun pagi menyejukkan hati', timestamp: new Date(Date.now() - 86400000) }
        ],
        savedInstrumentItems: [ 
            { id: 'instr_default_1', title: 'Suara Hujan Akustik (Contoh)', description: 'Gitar Akustik, Piano Rhodes, Cello, Suara Hujan.', timestamp: new Date(Date.now() - 3600000 * 5) },
            { id: 'instr_default_2', title: 'Synth Elektronik Klasik (Contoh)', description: 'Drum Machine TR-808, Bass Synth Moog, Synth Pads Juno, Glitch Effects.', timestamp: new Date(Date.now() - 3600000 * 3) }
        ],
    };

    lyricCount = 0;
    designCount = 0;
    instrumentDesignCount = 0;
    vocalistDesignCount = 0;
    instrumentSpecificCount = 0; 
    notifications = []; 
    unreadNotificationCount = 0;
    nextNotificationId = 1;

    if (songTitleInputElement) songTitleInputElement.value = '';
    if (lyricOutputArea) lyricOutputArea.textContent = 'Masukkan judul lagu dan klik "Buat Lirik" untuk memulai.';
    if (genreMoodOutputArea) genreMoodOutputArea.textContent = 'Pilih genre dan mood, lalu klik tombol di atas untuk menggabungkannya.';
    if (instrumentOutputArea) instrumentOutputArea.textContent = 'Pilih instrumen, lalu klik tombol di atas untuk membuat daftar instrumen.';
    if (vocalistOutputArea) vocalistOutputArea.textContent = 'Pilih jenis vokal, range, dan (opsional) referensi artis, lalu klik tombol di atas.';
    if (instrumentSpecificInputEl) instrumentSpecificInputEl.value = ''; 
    if (instrumentSpecificOutputAreaEl) instrumentSpecificOutputAreaEl.textContent = 'Masukkan deskripsi Anda dan klik "Generate Prompt Instrumen" untuk memulai.'; 
    
    const lyricLanguageRadiosDefault = lyricModal?.querySelector<HTMLInputElement>('input[name="lyric-language"][value="indonesia"]');
    if (lyricLanguageRadiosDefault) lyricLanguageRadiosDefault.checked = true;
    
    genreCheckboxes?.forEach(cb => cb.checked = false);
    moodRadioButtons?.forEach(rb => rb.checked = false);
    instrumentMainCheckboxes?.forEach(cb => cb.checked = false);
    instrumentAdditionalCheckboxes?.forEach(cb => cb.checked = false);
    if(vocalTypeMaleCheckbox) vocalTypeMaleCheckbox.checked = false;
    if(vocalTypeFemaleCheckbox) vocalTypeFemaleCheckbox.checked = false;
    if(maleRangeFieldset) maleRangeFieldset.classList.remove('visible');
    if(femaleRangeFieldset) femaleRangeFieldset.classList.remove('visible');
    maleRangeFieldset?.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach(r => r.checked = false);
    femaleRangeFieldset?.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach(r => r.checked = false);
    if(artistReferenceInput) artistReferenceInput.value = '';

    if (finalMusicPromptOutputContainer) finalMusicPromptOutputContainer.style.display = 'none';
    if (finalMusicPromptOutputArea) finalMusicPromptOutputArea.textContent = '';
    if (copyFinalMusicPromptButton) copyFinalMusicPromptButton.disabled = true;
    if (saveFinalMusicPromptButtonEl) {
        saveFinalMusicPromptButtonEl.style.display = 'none';
        saveFinalMusicPromptButtonEl.disabled = true;
        saveFinalMusicPromptButtonEl.textContent = 'Simpan';
    }
    sendPromptButtons.forEach(button => {
        button.disabled = false;
        button.textContent = 'Kirim Prompt';
        button.classList.remove('sent');
    });
    // Reset "Save Prompt" and "Copy Prompt" buttons in Instrument Specific Modal
    if (saveInstrumentSpecificToCollectionButtonEl) {
        saveInstrumentSpecificToCollectionButtonEl.disabled = true; // Disabled until prompt is generated
        saveInstrumentSpecificToCollectionButtonEl.textContent = 'Save Prompt';
    }
    if (copyInstrumentSpecificPromptButtonEl) {
        copyInstrumentSpecificPromptButtonEl.disabled = true;
        copyInstrumentSpecificPromptButtonEl.textContent = 'Copy Prompt';
    }
}


function saveApplicationState() {
    if (typeof localStorage === 'undefined') return;

    const loggedInUser = localStorage.getItem(LOGGED_IN_USER_KEY);
    if (!loggedInUser) {
        return; 
    }
    const storageKey = getUserSpecificStorageKey(loggedInUser);

    const appStateToSave: AppState = {
        ...currentAppState,
        notifications: currentAppState.notifications.map(n => ({ ...n, timestamp: n.timestamp.toISOString() as any })),
        savedMusicItems: currentAppState.savedMusicItems.map(item => ({ ...item, timestamp: item.timestamp.toISOString() as any })),
        savedInstrumentItems: currentAppState.savedInstrumentItems.map(item => ({ ...item, timestamp: item.timestamp.toISOString() as any })),
        
        lyricCount: lyricCount,
        lyricModalSongTitle: songTitleInputElement?.value || '',
        lyricModalOutput: lyricOutputArea?.textContent || '',
        lyricModalSelectedLanguage: lyricModal?.querySelector<HTMLInputElement>('input[name="lyric-language"]:checked')?.value || 'indonesia',
        
        designCount: designCount,
        genreMoodModalSelectedGenres: genreCheckboxes ? Array.from(genreCheckboxes).filter(cb => cb.checked).map(cb => cb.value) : [],
        genreMoodModalSelectedMood: moodRadioButtons ? Array.from(moodRadioButtons).find(rb => rb.checked)?.value || null : null,
        genreMoodModalOutput: genreMoodOutputArea?.textContent || '',

        instrumentDesignCount: instrumentDesignCount,
        instrumentModalSelectedMain: instrumentMainCheckboxes ? Array.from(instrumentMainCheckboxes).filter(cb => cb.checked).map(cb => cb.value) : [],
        instrumentModalSelectedAdditional: instrumentAdditionalCheckboxes ? Array.from(instrumentAdditionalCheckboxes).filter(cb => cb.checked).map(cb => cb.value) : [],
        instrumentModalOutput: instrumentOutputArea?.textContent || '',
        
        vocalistDesignCount: vocalistDesignCount,
        vocalistModalIsMaleSelected: vocalTypeMaleCheckbox?.checked || false,
        vocalistModalIsFemaleSelected: vocalTypeFemaleCheckbox?.checked || false,
        vocalistModalMaleRange: maleRangeFieldset?.querySelector<HTMLInputElement>('input[name="male-range"]:checked')?.value || null,
        vocalistModalFemaleRange: femaleRangeFieldset?.querySelector<HTMLInputElement>('input[name="female-range"]:checked')?.value || null,
        vocalistModalArtistRef: artistReferenceInput?.value || '',
        vocalistModalOutput: vocalistOutputArea?.textContent || '',

        instrumentSpecificCount: instrumentSpecificCount, 
        instrumentSpecificModalInput: instrumentSpecificInputEl?.value || '',
        instrumentSpecificModalOutput: instrumentSpecificOutputAreaEl?.textContent || '',
        instrumentSpecificProgress: currentAppState.instrumentSpecificProgress, // New
        
        nextNotificationId: nextNotificationId,
        profilePicUrl: sidebarProfileImageEl?.src || DEFAULT_PROFILE_PIC_URL,
        isSidebarCollapsed: sidebarEl?.classList.contains('sidebar-collapsed') || false,
    };
    
    localStorage.setItem(storageKey, JSON.stringify(appStateToSave));
}


function loadApplicationState(usernameToLoad?: string) {
    if (typeof localStorage === 'undefined' || !usernameToLoad) {
        resetAppStateToDefaults(); 
        renderUIFromState();
        if (!usernameToLoad && !API_KEY) { 
             if (chatDisplayArea) chatDisplayArea.innerHTML = '<p class="error-message">Error: API Key tidak dikonfigurasi. Chat tidak tersedia.</p>';
        }
        return;
    }

    const storageKey = getUserSpecificStorageKey(usernameToLoad);
    const savedStateString = localStorage.getItem(storageKey);

    if (!savedStateString) { 
        resetAppStateToDefaults();
        if (API_KEY) {
            initializeChatAndWelcome(); 
        } else {
            if (chatDisplayArea) chatDisplayArea.innerHTML = '<p class="error-message">Error: API Key tidak dikonfigurasi. Chat tidak tersedia.</p>';
            if(chatInputElement) chatInputElement.disabled = true;
            if(chatSubmitButton) chatSubmitButton.disabled = true;
        }
        renderUIFromState();
        saveApplicationState(); 
        return;
    }

    try {
        const savedState = JSON.parse(savedStateString) as AppState;
        currentAppState = {
            ...savedState, 
            notifications: (savedState.notifications || []).map(n => ({...n, timestamp: new Date(n.timestamp as any) })),
            savedMusicItems: (savedState.savedMusicItems || []).map(item => ({...item, timestamp: new Date(item.timestamp as any) })),
            savedInstrumentItems: (savedState.savedInstrumentItems || []).map(item => ({...item, timestamp: new Date(item.timestamp as any) })),
            instrumentSpecificProgress: savedState.instrumentSpecificProgress || 0, // New
        };
        // Ensure default structure for potentially missing new fields like `title` in savedInstrumentItems
        currentAppState.savedInstrumentItems = currentAppState.savedInstrumentItems.map(item => ({
            ...item,
            title: item.title || `Instrumen ${item.id.substring(0,5)}...` // Fallback title
        }));


        lyricCount = currentAppState.lyricCount;
        designCount = currentAppState.designCount;
        instrumentDesignCount = currentAppState.instrumentDesignCount;
        vocalistDesignCount = currentAppState.vocalistDesignCount;
        instrumentSpecificCount = currentAppState.instrumentSpecificCount || 0; 
        notifications = currentAppState.notifications; 
        unreadNotificationCount = notifications.filter(n => !n.read).length;
        nextNotificationId = currentAppState.nextNotificationId || 1;


        if (API_KEY) {
            if (currentAppState.chatHistory && currentAppState.chatHistory.length > 0) {
                 chat = ai.chats.create({ model: MODEL_NAME, config: { systemInstruction }, history: currentAppState.chatHistory });
                if (chatDisplayArea) {
                    chatDisplayArea.innerHTML = '';
                    currentAppState.chatHistory.forEach(msg => {
                        if (msg.role === 'user') addMessageToDisplay(msg.parts[0].text, 'user');
                        else if (msg.role === 'model') addMessageToDisplay(msg.parts[0].text, 'ai');
                    });
                }
            } else {
                initializeChatAndWelcome(); 
            }
            if (chatInputElement) chatInputElement.disabled = false;
            if (chatSubmitButton) chatSubmitButton.disabled = false;
        } else {
            if (chatDisplayArea) chatDisplayArea.innerHTML = '<p class="error-message">Error: API Key tidak dikonfigurasi. Chat tidak tersedia.</p>';
            if(chatInputElement) chatInputElement.disabled = true;
            if(chatSubmitButton) chatSubmitButton.disabled = true;
        }
        renderUIFromState();

    } catch (error) {
        console.error(`Error loading application state for user ${usernameToLoad}:`, error);
        localStorage.removeItem(storageKey); 
        resetAppStateToDefaults(); 
        if (API_KEY) {
            initializeChatAndWelcome();
        }
        renderUIFromState();
    }
}

function renderUIFromState() {
    if (songTitleInputElement) songTitleInputElement.value = currentAppState.lyricModalSongTitle;
    if (lyricOutputArea) lyricOutputArea.textContent = currentAppState.lyricModalOutput || 'Masukkan judul lagu dan klik "Buat Lirik" untuk memulai.';
    const lyricLanguageRadiosForLoad = lyricModal?.querySelectorAll<HTMLInputElement>('input[name="lyric-language"]');
    if (lyricLanguageRadiosForLoad) {
        const langRadioToSelect = Array.from(lyricLanguageRadiosForLoad).find(radio => radio.value === currentAppState.lyricModalSelectedLanguage);
        if (langRadioToSelect) langRadioToSelect.checked = true;
        else { 
            const defaultLang = Array.from(lyricLanguageRadiosForLoad).find(radio => radio.value === 'indonesia');
            if (defaultLang) defaultLang.checked = true;
        }
    }
    
    if (genreCheckboxes) genreCheckboxes.forEach(cb => { cb.checked = currentAppState.genreMoodModalSelectedGenres.includes(cb.value); });
    if (moodRadioButtons) {
        const moodRadioToSelect = Array.from(moodRadioButtons).find(rb => rb.value === currentAppState.genreMoodModalSelectedMood);
        if (moodRadioToSelect) moodRadioToSelect.checked = true; else { /* No mood selected is fine */ }
    }
    if(genreMoodOutputArea) genreMoodOutputArea.textContent = currentAppState.genreMoodModalOutput || 'Pilih genre dan mood, lalu klik tombol di atas untuk menggabungkannya.';

    if(instrumentMainCheckboxes) instrumentMainCheckboxes.forEach(cb => { cb.checked = currentAppState.instrumentModalSelectedMain.includes(cb.value); });
    if(instrumentAdditionalCheckboxes) instrumentAdditionalCheckboxes.forEach(cb => { cb.checked = currentAppState.instrumentModalSelectedAdditional.includes(cb.value); });
    if(instrumentOutputArea) instrumentOutputArea.textContent = currentAppState.instrumentModalOutput || 'Pilih instrumen, lalu klik tombol di atas untuk membuat daftar instrumen.';

    if(vocalTypeMaleCheckbox) vocalTypeMaleCheckbox.checked = currentAppState.vocalistModalIsMaleSelected;
    if(vocalTypeFemaleCheckbox) vocalTypeFemaleCheckbox.checked = currentAppState.vocalistModalIsFemaleSelected;
    if(maleRangeFieldset && currentAppState.vocalistModalMaleRange) {
        const maleRangeToSelect = maleRangeFieldset.querySelector<HTMLInputElement>(`input[name="male-range"][value="${currentAppState.vocalistModalMaleRange}"]`);
        if(maleRangeToSelect) maleRangeToSelect.checked = true;
    }
    if(femaleRangeFieldset && currentAppState.vocalistModalFemaleRange) {
        const femaleRangeToSelect = femaleRangeFieldset.querySelector<HTMLInputElement>(`input[name="female-range"][value="${currentAppState.vocalistModalFemaleRange}"]`);
        if(femaleRangeToSelect) femaleRangeToSelect.checked = true;
    }
    if(maleRangeFieldset && vocalTypeMaleCheckbox) maleRangeFieldset.classList.toggle('visible', currentAppState.vocalistModalIsMaleSelected);
    if(femaleRangeFieldset && vocalTypeFemaleCheckbox) femaleRangeFieldset.classList.toggle('visible', currentAppState.vocalistModalIsFemaleSelected);
    if(artistReferenceInput) artistReferenceInput.value = currentAppState.vocalistModalArtistRef;
    if(vocalistOutputArea) vocalistOutputArea.textContent = currentAppState.vocalistModalOutput || 'Pilih jenis vokal, range, dan (opsional) referensi artis, lalu klik tombol di atas.';

    if (instrumentSpecificInputEl) instrumentSpecificInputEl.value = currentAppState.instrumentSpecificModalInput;
    if (instrumentSpecificOutputAreaEl) instrumentSpecificOutputAreaEl.textContent = currentAppState.instrumentSpecificModalOutput || 'Masukkan deskripsi Anda dan klik "Generate Prompt Instrumen" untuk memulai.';
    
    const instrumentSpecificOutputIsValid = currentAppState.instrumentSpecificModalOutput &&
                                           !currentAppState.instrumentSpecificModalOutput.includes('sedang menghasilkan') &&
                                           !currentAppState.instrumentSpecificModalOutput.includes('Masukkan deskripsi') &&
                                           !currentAppState.instrumentSpecificModalOutput.includes('Error') &&
                                           !currentAppState.instrumentSpecificModalOutput.includes('Oops');

    if (saveInstrumentSpecificToCollectionButtonEl) {
        if (saveInstrumentSpecificToCollectionButtonEl.textContent !== 'Tersimpan!' && saveInstrumentSpecificToCollectionButtonEl.textContent !== 'Menyimpan...') {
            saveInstrumentSpecificToCollectionButtonEl.textContent = 'Save Prompt';
        }
        saveInstrumentSpecificToCollectionButtonEl.disabled = !instrumentSpecificOutputIsValid || saveInstrumentSpecificToCollectionButtonEl.textContent === 'Tersimpan!' || saveInstrumentSpecificToCollectionButtonEl.textContent === 'Menyimpan...';
    }
    if (copyInstrumentSpecificPromptButtonEl) {
        if (copyInstrumentSpecificPromptButtonEl.textContent !== 'Tersalin!') {
            copyInstrumentSpecificPromptButtonEl.textContent = 'Copy Prompt';
        }
         if (!copyInstrumentSpecificPromptButtonEl.disabled || copyInstrumentSpecificPromptButtonEl.textContent !== 'Tersalin!') {
            copyInstrumentSpecificPromptButtonEl.disabled = !instrumentSpecificOutputIsValid;
        }
    }


    renderNotifications(); 
    if (sidebarProfileImageEl) sidebarProfileImageEl.src = currentAppState.profilePicUrl || DEFAULT_PROFILE_PIC_URL;
    applySidebarState(currentAppState.isSidebarCollapsed);
    renderCollectedPrompts(); 
    updateAllCardDisplays(); 

    if (currentAppState.finalMusicPromptOutput && finalMusicPromptOutputArea && finalMusicPromptOutputContainer && copyFinalMusicPromptButton && saveFinalMusicPromptButtonEl) {
        finalMusicPromptOutputArea.textContent = currentAppState.finalMusicPromptOutput;
        finalMusicPromptOutputContainer.style.display = 'block';
        copyFinalMusicPromptButton.disabled = false;
        saveFinalMusicPromptButtonEl.style.display = 'block'; 
        saveFinalMusicPromptButtonEl.disabled = false;
        saveFinalMusicPromptButtonEl.textContent = 'Simpan';
    } else if (finalMusicPromptOutputContainer && copyFinalMusicPromptButton && saveFinalMusicPromptButtonEl) {
        finalMusicPromptOutputContainer.style.display = 'none';
        copyFinalMusicPromptButton.disabled = true;
        saveFinalMusicPromptButtonEl.style.display = 'none';
    }

    sendPromptButtons.forEach(button => {
        const type = button.dataset.type as 'lyrics' | 'genreMood' | 'instruments' | 'vocals'; // Removed 'instrumentSpecific'
        let isSent = false;
        if (type === 'lyrics') isSent = currentAppState.lyricPromptSent;
        else if (type === 'genreMood') isSent = currentAppState.genreMoodPromptSent;
        else if (type === 'instruments') isSent = currentAppState.instrumentPromptSent;
        else if (type === 'vocals') isSent = currentAppState.vocalistPromptSent;

        if (isSent) {
            button.disabled = true;
            button.textContent = 'Terkirim';
            button.classList.add('sent');
        } else {
            button.disabled = false;
            button.textContent = 'Kirim Prompt';
            button.classList.remove('sent');
        }
    });
}


function initializeChatAndWelcome() {
    const loggedInUser = localStorage.getItem(LOGGED_IN_USER_KEY);
    if (!API_KEY || !loggedInUser) { 
        if (chatDisplayArea) {
            chatDisplayArea.innerHTML = '';
            addMessageToDisplay("<strong>Penting:</strong> Fitur chat tidak tersedia. Pastikan API Key dikonfigurasi dan Anda telah login.", 'error');
        }
        if (chatInputElement) chatInputElement.disabled = true;
        if (chatSubmitButton) chatSubmitButton.disabled = true;
        currentAppState.chatHistory = []; 
        chat = null;
        return;
    }
    
    if (chatInputElement) chatInputElement.disabled = false;
    if (chatSubmitButton) chatSubmitButton.disabled = false;

    chat = ai.chats.create({ model: MODEL_NAME, config: { systemInstruction }, history: currentAppState.chatHistory });
    
    if (!currentAppState.chatHistory || currentAppState.chatHistory.length === 0) {
        if (chatDisplayArea) chatDisplayArea.innerHTML = ''; 
        addWelcomeMessage(); 
    } else {
        // Chat history already loaded and displayed
    }
}


function addMessageToDisplay(message: string, sender: 'user' | 'ai' | 'loading' | 'error' | 'welcome') {
    if (!chatDisplayArea) return;

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('chat-message');

    switch (sender) {
        case 'user':
            messageDiv.classList.add('user-message');
            messageDiv.textContent = message;
            break;
        case 'ai':
        case 'welcome': 
            messageDiv.classList.add('ai-message');
            messageDiv.innerHTML = message; 
            break;
        case 'loading':
            messageDiv.classList.add('loading-message');
            messageDiv.id = 'loading-indicator';
            messageDiv.textContent = message;
            break;
        case 'error':
            messageDiv.classList.add('error-message');
            messageDiv.innerHTML = message; 
            break;
    }
    chatDisplayArea.appendChild(messageDiv);
    chatDisplayArea.scrollTop = chatDisplayArea.scrollHeight; 
}

function addWelcomeMessage() {
    const welcomeText = "Halo! Saya Mr. GenR, pemandu karismatik Anda di dunia musik. Ada yang bisa saya bantu rangkai hari ini?";
    addMessageToDisplay(welcomeText, 'welcome');
}

async function handleChatSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!chatInputElement || !chatSubmitButton || !chat || !API_KEY || !localStorage.getItem(LOGGED_IN_USER_KEY)) return;
    const userInput = chatInputElement.value.trim();
    if (!userInput) return;

    addMessageToDisplay(userInput, 'user');
    currentAppState.chatHistory.push({ role: 'user', parts: [{ text: userInput }] });

    chatInputElement.value = '';
    chatSubmitButton.disabled = true;
    chatInputElement.disabled = true;

    addMessageToDisplay("Mr. GenR sedang mengetik...", 'loading');

    try {
        const response: GenerateContentResponse = await chat.sendMessage({ message: userInput });
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) loadingIndicator.remove();
        addMessageToDisplay(response.text, 'ai');
        currentAppState.chatHistory.push({ role: 'model', parts: [{ text: response.text }] });
    } catch (error) {
        console.error("Error sending message:", error);
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) loadingIndicator.remove();
        addMessageToDisplay("<strong>Oops!</strong> Gangguan saat menghubungi Mr. GenR. Coba lagi sesaat.", 'error');
    } finally {
        if (chatSubmitButton) chatSubmitButton.disabled = false;
        if (chatInputElement) {
            chatInputElement.disabled = false;
            chatInputElement.focus();
        }
        saveApplicationState();
    }
}

// --- App Lock Overlay ---
const appBlockOverlay = document.getElementById('app-block-overlay') as HTMLDivElement;
function lockApp() {
    if(appBlockOverlay) appBlockOverlay.style.display = 'flex';
    document.body.classList.add('app-locked');
}
function unlockApp() {
    if(appBlockOverlay) appBlockOverlay.style.display = 'none';
    document.body.classList.remove('app-locked');
}

// --- Notification System ---
interface NotificationItem { id: number; title: string; message: string; read: boolean; timestamp: Date; }
let notifications: NotificationItem[] = []; 
let unreadNotificationCount = 0;
let nextNotificationId = 1; 
const notificationBellButton = document.getElementById('notification-bell-button') as HTMLButtonElement;
const notificationPanel = document.getElementById('notification-panel') as HTMLDivElement | null;
const notificationBadge = document.getElementById('notification-badge') as HTMLSpanElement;
const notificationListEl = document.getElementById('notification-list') as HTMLDivElement;
const markAllReadButton = document.getElementById('mark-all-read-button') as HTMLButtonElement;


function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return `${interval} tahun lalu`;
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return `${interval} bulan lalu`;
    interval = Math.floor(seconds / 86400);
    if (interval > 1) return `${interval} hari lalu`;
    if (interval === 1) return "Kemarin";
    interval = Math.floor(seconds / 3600);
    if (interval > 1) return `${interval} jam lalu`;
    if (interval === 1) return "1 jam lalu";
    interval = Math.floor(seconds / 60);
    if (interval > 1) return `${interval} menit lalu`;
    if (interval === 1) return "1 menit lalu";
    return "Baru saja";
}

function renderNotifications() {
    if (!notificationListEl || !notificationBadge) return;
    notificationListEl.innerHTML = '';
    const currentNotifications = currentAppState.notifications || [];

    if (currentNotifications.length === 0) {
        notificationListEl.innerHTML = '<p class="no-notifications">Tidak ada notifikasi baru.</p>';
    } else {
        currentNotifications.forEach(n => {
            const item = document.createElement('div');
            item.classList.add('notification-item');
            if (!n.read) item.classList.add('unread');
            item.setAttribute('role', 'listitem');
            item.tabIndex = 0;
            item.dataset.notificationId = n.id.toString();

            const title = document.createElement('div');
            title.classList.add('notification-title');
            title.textContent = n.title;

            const message = document.createElement('div');
            message.classList.add('notification-message');
            message.textContent = n.message;

            const timestamp = document.createElement('div');
            timestamp.classList.add('notification-timestamp');
            timestamp.textContent = formatTimeAgo(new Date(n.timestamp)); 

            item.append(title, message, timestamp);
            item.addEventListener('click', () => markNotificationAsRead(n.id));
            item.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') markNotificationAsRead(n.id); });
            notificationListEl.appendChild(item);
        });
    }
    
    unreadNotificationCount = currentNotifications.filter(n => !n.read).length;
    notificationBadge.textContent = unreadNotificationCount > 0 ? unreadNotificationCount.toString() : '';
    notificationBadge.classList.toggle('visually-hidden', unreadNotificationCount === 0);
    if(markAllReadButton) markAllReadButton.disabled = unreadNotificationCount === 0;
}

function addNotification(title: string, message: string) {
    const newNotification: NotificationItem = { 
        id: currentAppState.nextNotificationId++, 
        title, 
        message, 
        read: false, 
        timestamp: new Date() 
    };
    currentAppState.notifications.unshift(newNotification);
    renderNotifications(); 
    if(notificationPanel && !notificationPanel.classList.contains('visible')) {
        notificationBellButton?.classList.add('pulse');
        setTimeout(() => notificationBellButton?.classList.remove('pulse'), 1000);
    }
    saveApplicationState();
}

function toggleNotificationPanel() {
    if (!notificationPanel || !notificationBellButton) return;
    const isVisible = notificationPanel.classList.toggle('visible');
    notificationBellButton.setAttribute('aria-expanded', String(isVisible));
    if (isVisible) {
        notificationBellButton?.classList.remove('pulse');
    }
}

function markNotificationAsRead(notificationId: number) {
    const notification = currentAppState.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
        notification.read = true;
        renderNotifications(); 
        saveApplicationState();
    }
}

function handleMarkAllRead() {
    currentAppState.notifications.forEach(notif => { if (!notif.read) notif.read = true; });
    renderNotifications(); 
    saveApplicationState();
}


// --- Modal and Card Functionality ---
const buatLirikCard = document.getElementById('buat-lirik-card') as HTMLDivElement;
let lyricCount = 0; 
const songTitleInputElement = document.getElementById('song-title-input') as HTMLInputElement;
const lyricModal = document.getElementById('lyric-modal') as HTMLDivElement;
const lyricOutputArea = document.getElementById('lyric-output-area') as HTMLDivElement;
const generateLyricButton = document.getElementById('generate-lyric-button') as HTMLButtonElement;

const designGenreCard = document.getElementById('design-genre-card') as HTMLDivElement;
let designCount = 0; 
const genreMoodModal = document.getElementById('genre-mood-modal') as HTMLDivElement;
const genreCheckboxes = genreMoodModal?.querySelectorAll<HTMLInputElement>('input[name="genre"][type="checkbox"]');
const moodRadioButtons = genreMoodModal?.querySelectorAll<HTMLInputElement>('input[name="mood"][type="radio"]');
const generateGenreMoodButton = document.getElementById('generate-genre-mood-button') as HTMLButtonElement;
const genreMoodOutputArea = document.getElementById('genre-mood-output-area') as HTMLDivElement;

const instrumentDesignCard = document.getElementById('instrument-design-card') as HTMLDivElement;
let instrumentDesignCount = 0; 
const instrumentModal = document.getElementById('instrument-modal') as HTMLDivElement;
const instrumentMainCheckboxes = instrumentModal?.querySelectorAll<HTMLInputElement>('input[name="instrument-main"][type="checkbox"]');
const instrumentAdditionalCheckboxes = instrumentModal?.querySelectorAll<HTMLInputElement>('input[name="instrument-additional"][type="checkbox"]');
const generateInstrumentListButton = document.getElementById('generate-instrument-list-button') as HTMLButtonElement; 
const instrumentOutputArea = document.getElementById('instrument-output-area') as HTMLDivElement;

const vocalistDesignCard = document.getElementById('vocalist-design-card') as HTMLDivElement;
let vocalistDesignCount = 0; 
const vocalistModal = document.getElementById('vocalist-modal') as HTMLDivElement;
const vocalTypeMaleCheckbox = document.getElementById('vocal-type-male') as HTMLInputElement;
const vocalTypeFemaleCheckbox = document.getElementById('vocal-type-female') as HTMLInputElement;
const maleRangeFieldset = document.getElementById('male-range-fieldset') as HTMLFieldSetElement;
const femaleRangeFieldset = document.getElementById('female-range-fieldset') as HTMLFieldSetElement;
const artistReferenceInput = document.getElementById('artist-reference-input') as HTMLInputElement;
const generateVocalistButton = document.getElementById('generate-vocalist-button') as HTMLButtonElement;
const vocalistOutputArea = document.getElementById('vocalist-output-area') as HTMLDivElement;

// New Card: Khusus Instrumen
const instrumentSpecificCardEl = document.getElementById('instrument-specific-card') as HTMLDivElement;
let instrumentSpecificCount = 0; 
const instrumentSpecificModalEl = document.getElementById('instrument-specific-modal') as HTMLDivElement;
const instrumentSpecificInputEl = document.getElementById('instrument-specific-input') as HTMLTextAreaElement;
const generateInstrumentSpecificPromptButtonEl = document.getElementById('generate-instrument-specific-prompt-button') as HTMLButtonElement;
const instrumentSpecificOutputAreaEl = document.getElementById('instrument-specific-output-area') as HTMLDivElement;
const saveInstrumentSpecificToCollectionButtonEl = document.getElementById('save-instrument-specific-to-collection-button') as HTMLButtonElement;
const copyInstrumentSpecificPromptButtonEl = document.getElementById('copy-instrument-specific-prompt-button') as HTMLButtonElement;


// --- DOM Elements for Data Cards ---
const buatLirikValueElement = document.getElementById('buat-lirik-value') as HTMLSpanElement;
const buatLirikProgressBarElement = document.getElementById('buat-lirik-progress-bar') as HTMLDivElement;
const buatLirikPercentageElement = document.getElementById('buat-lirik-percentage') as HTMLSpanElement;
const designGenreValueElement = document.getElementById('design-genre-value') as HTMLSpanElement;
const designGenreProgressBarElement = document.getElementById('design-genre-progress-bar') as HTMLDivElement;
const designGenrePercentageElement = document.getElementById('design-genre-percentage') as HTMLSpanElement;
const instrumentDesignValueElement = document.getElementById('instrument-design-value') as HTMLSpanElement;
const instrumentDesignProgressBarElement = document.getElementById('instrument-design-progress-bar') as HTMLDivElement;
const instrumentDesignPercentageElement = document.getElementById('instrument-design-percentage') as HTMLSpanElement;
const vocalistDesignValueElement = document.getElementById('vocalist-design-value') as HTMLSpanElement;
const vocalistDesignProgressBarElement = document.getElementById('vocalist-design-progress-bar') as HTMLDivElement;
const vocalistDesignPercentageElement = document.getElementById('vocalist-design-percentage') as HTMLSpanElement;
const instrumentSpecificValueEl = document.getElementById('instrument-specific-value') as HTMLSpanElement;
const instrumentSpecificProgressBarEl = document.getElementById('instrument-specific-progress-bar') as HTMLDivElement;
const instrumentSpecificPercentageEl = document.getElementById('instrument-specific-percentage') as HTMLSpanElement;

// --- FINAL PROMPT FEATURE ELEMENTS ---
const collectedPromptsDisplayArea = document.getElementById('collected-prompts-display') as HTMLDivElement;
const generateMusicPromptButton = document.getElementById('generate-music-prompt-button') as HTMLButtonElement;
const finalMusicPromptOutputContainer = document.getElementById('final-music-prompt-output-container') as HTMLDivElement;
const finalMusicPromptOutputArea = document.getElementById('final-music-prompt-output-area') as HTMLDivElement;
const copyFinalMusicPromptButton = document.getElementById('copy-final-music-prompt-button') as HTMLButtonElement;
const saveFinalMusicPromptButtonEl = document.getElementById('save-final-music-prompt-button') as HTMLButtonElement;
const sendPromptButtons = document.querySelectorAll<HTMLButtonElement>('.send-prompt-button');

// --- SAVED PROMPTS MODAL ELEMENTS ---
const savedPromptsModalEl = document.getElementById('saved-prompts-modal') as HTMLDivElement;
const savedPromptsModalCloseButtonEl = document.getElementById('saved-prompts-modal-close') as HTMLButtonElement;
const musikKamuTabButtonEl = document.getElementById('musik-kamu-tab-button') as HTMLButtonElement;
const instrumenKamuTabButtonEl = document.getElementById('instrumen-kamu-tab-button') as HTMLButtonElement;
const musikKamuTabContentEl = document.getElementById('musik-kamu-tab-content') as HTMLDivElement;
const instrumenKamuTabContentEl = document.getElementById('instrumen-kamu-tab-content') as HTMLDivElement;
const savedMusicTableBodyEl = document.getElementById('saved-music-table-body') as HTMLTableSectionElement;
const savedInstrumentsTableBodyEl = document.getElementById('saved-instruments-table-body') as HTMLTableSectionElement;
const noSavedMusicMessageEl = document.getElementById('no-saved-music-message') as HTMLParagraphElement;
const noSavedInstrumentsMessageEl = document.getElementById('no-saved-instruments-message') as HTMLParagraphElement;


function updateCardDisplay(type: 'lyrics' | 'genreMood' | 'instruments' | 'vocals' | 'instrumentSpecific') {
    let valueEl: HTMLSpanElement | null = null,
        progressEl: HTMLDivElement | null = null,
        percentageEl: HTMLSpanElement | null = null,
        cardName = '',
        currentCount = 0; 
    let isPromptSent = false;
    let progressPercentage = 0;

    switch (type) {
        case 'lyrics':
            valueEl = buatLirikValueElement; progressEl = buatLirikProgressBarElement; percentageEl = buatLirikPercentageElement; cardName = "Buat Lirik";
            currentCount = currentAppState.lyricCount; isPromptSent = currentAppState.lyricPromptSent;
            progressPercentage = isPromptSent ? 25 : 0;
            break;
        case 'genreMood':
            valueEl = designGenreValueElement; progressEl = designGenreProgressBarElement; percentageEl = designGenrePercentageElement; cardName = "Desain Genre & Mood";
            currentCount = currentAppState.designCount; isPromptSent = currentAppState.genreMoodPromptSent;
            progressPercentage = isPromptSent ? 25 : 0;
            break;
        case 'instruments':
            valueEl = instrumentDesignValueElement; progressEl = instrumentDesignProgressBarElement; percentageEl = instrumentDesignPercentageElement; cardName = "Desain Instrumen";
            currentCount = currentAppState.instrumentDesignCount; isPromptSent = currentAppState.instrumentPromptSent;
            progressPercentage = isPromptSent ? 25 : 0;
            break;
        case 'vocals':
            valueEl = vocalistDesignValueElement; progressEl = vocalistDesignProgressBarElement; percentageEl = vocalistDesignPercentageElement; cardName = "Desain Vokalis";
            currentCount = currentAppState.vocalistDesignCount; isPromptSent = currentAppState.vocalistPromptSent;
            progressPercentage = isPromptSent ? 25 : 0;
            break;
        case 'instrumentSpecific':
            valueEl = instrumentSpecificValueEl; progressEl = instrumentSpecificProgressBarEl; percentageEl = instrumentSpecificPercentageEl; cardName = "Khusus Instrumen";
            currentCount = currentAppState.instrumentSpecificCount;
            progressPercentage = currentAppState.instrumentSpecificProgress || 0; // Use new progress state
            break;
    }

    if (valueEl) valueEl.textContent = currentCount.toString();
    if (progressEl && percentageEl) {
        progressEl.style.width = `${progressPercentage}%`;
        const progressBarContainer = progressEl.parentElement;
        if (progressBarContainer) {
            progressBarContainer.setAttribute('aria-valuenow', progressPercentage.toString());
            progressBarContainer.setAttribute('aria-label', `${progressPercentage}% progress untuk ${cardName}`);
        }
        percentageEl.textContent = `${progressPercentage}%`;
    }
}

function updateAllCardDisplays() {
    updateCardDisplay('lyrics');
    updateCardDisplay('genreMood');
    updateCardDisplay('instruments');
    updateCardDisplay('vocals');
    updateCardDisplay('instrumentSpecific'); 
}


function renderCollectedPrompts() {
    if (!collectedPromptsDisplayArea || !currentAppState.collectedFinalPromptComponents) return;
    collectedPromptsDisplayArea.innerHTML = '';

    const dl = document.createElement('dl');
    let hasContent = false;

    // Order changed: instrumentSpecific removed
    const componentsOrder: Array<keyof FinalPromptComponents> = ['lyrics', 'genreMood', 'instruments', 'vocals'];
    const componentLabels: Record<string, string> = {
        lyrics: 'Lirik',
        genreMood: 'Kombinasi Genre & Mood',
        instruments: 'Daftar Instrumen (Umum)',
        vocals: 'Vokalis'
    };

    componentsOrder.forEach(key => {
        const componentKey = key as keyof FinalPromptComponents;
        if (currentAppState.collectedFinalPromptComponents[componentKey]) {
            hasContent = true;
            const dt = document.createElement('dt');
            let label = componentLabels[componentKey];
            let contentText = '';

            if (componentKey === 'lyrics' && currentAppState.collectedFinalPromptComponents.lyrics) {
                const lang = currentAppState.collectedFinalPromptComponents.lyrics.language;
                const langDisplay = lang.charAt(0).toUpperCase() + lang.slice(1).replace('_romaji', ' (Romaji)');
                label = `Lirik (${langDisplay})`;
                contentText = currentAppState.collectedFinalPromptComponents.lyrics.text;
            } else {
                contentText = currentAppState.collectedFinalPromptComponents[componentKey] as string;
            }

            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.textContent = contentText;
            dl.append(dt, dd);
        }
    });

    if (hasContent) {
        collectedPromptsDisplayArea.appendChild(dl);
    } else {
        const p = document.createElement('p');
        p.classList.add('placeholder');
        p.textContent = 'Belum ada komponen prompt yang dikirim.';
        collectedPromptsDisplayArea.appendChild(p);
    }
}


sendPromptButtons.forEach(button => {
    button.addEventListener('click', (event) => {
        const targetButton = event.target as HTMLButtonElement;
        const type = targetButton.dataset.type as 'lyrics' | 'genreMood' | 'instruments' | 'vocals'; // instrumentSpecific removed
        if (!type || !currentAppState.collectedFinalPromptComponents) return;

        let outputText = '';
        let language = '';
        let success = false;
        let cardNameForNotification = '';

        switch (type) {
            case 'lyrics':
                cardNameForNotification = "Lirik";
                if (lyricOutputArea) outputText = lyricOutputArea.textContent || '';
                const langRadios = lyricModal?.querySelectorAll<HTMLInputElement>('input[name="lyric-language"]:checked');
                if (langRadios && langRadios.length > 0) language = langRadios[0].value;
                if (outputText.trim() && !outputText.includes('sedang merangkai') && !outputText.includes('Judul lagu tidak boleh kosong') && !outputText.includes('Error') && !outputText.includes('Oops') && language) {
                    currentAppState.collectedFinalPromptComponents.lyrics = { text: outputText, language };
                    currentAppState.lyricPromptSent = true;
                    success = true;
                }
                break;
            case 'genreMood':
                cardNameForNotification = "Genre & Mood";
                if (genreMoodOutputArea) outputText = genreMoodOutputArea.textContent || '';
                 if (outputText.trim() && !outputText.includes('Pilih') && !outputText.includes('sedang memproses') && !outputText.includes('Error') && !outputText.includes('Oops') && outputText.endsWith('.')) {
                    currentAppState.collectedFinalPromptComponents.genreMood = outputText;
                    currentAppState.genreMoodPromptSent = true;
                    success = true;
                }
                break;
            case 'instruments':
                cardNameForNotification = "Instrumen";
                if (instrumentOutputArea) outputText = instrumentOutputArea.textContent || '';
                 if (outputText.trim() && !outputText.includes('Pilih') && !outputText.includes('sedang merancang') && !outputText.includes('Error') && !outputText.includes('Oops') && outputText.endsWith('.')) {
                    currentAppState.collectedFinalPromptComponents.instruments = outputText;
                    currentAppState.instrumentPromptSent = true;
                    success = true;
                }
                break;
            case 'vocals':
                cardNameForNotification = "Vokalis";
                if (vocalistOutputArea) outputText = vocalistOutputArea.textContent || '';
                if (outputText.trim() && !outputText.includes('sedang mendesain') && !outputText.includes('Error') && !outputText.includes('Oops') && !outputText.includes('Pilih')) {
                    currentAppState.collectedFinalPromptComponents.vocals = outputText;
                    currentAppState.vocalistPromptSent = true;
                    success = true;
                }
                break;
        }

        if (success) {
            targetButton.disabled = true;
            targetButton.textContent = 'Terkirim';
            targetButton.classList.add('sent');
            updateCardDisplay(type); 
            renderCollectedPrompts();
            addNotification("Komponen Terkirim!", `Data "${cardNameForNotification}" telah dikirim ke Final Prompt.`);

            if (type === 'lyrics') { hideLyricModal(); showGenreMoodModal(); }
            else if (type === 'genreMood') { hideGenreMoodModal(); showInstrumentModal(); }
            else if (type === 'instruments') { hideInstrumentModal(); showVocalistModal(); } 
            else if (type === 'vocals') { hideVocalistModal(); }

        } else {
            addNotification("Gagal Mengirim", `Tidak ada output valid dari "${cardNameForNotification}" untuk dikirim.`);
        }
        saveApplicationState();
    });
});

function getDisplayLanguageName(langCode?: string): string {
    if (!langCode) return 'Instrumental (tidak ada lirik)';
    switch (langCode) {
        case 'indonesia': return 'Indonesia';
        case 'english': return 'Inggris';
        case 'japanese_romaji': return 'Jepang (Romaji)';
        default: return langCode.charAt(0).toUpperCase() + langCode.slice(1);
    }
}

async function handleGenerateFinalMusicPrompt() {
    if (!generateMusicPromptButton || !finalMusicPromptOutputArea || !finalMusicPromptOutputContainer || !copyFinalMusicPromptButton || !saveFinalMusicPromptButtonEl || !currentAppState.collectedFinalPromptComponents || !API_KEY || !localStorage.getItem(LOGGED_IN_USER_KEY)) {
         if (finalMusicPromptOutputArea) finalMusicPromptOutputArea.innerHTML = `<p style="color:var(--accent-red);">Pastikan API Key tersedia dan Anda telah login untuk fitur ini.</p>`;
        return;
    }


    generateMusicPromptButton.disabled = true;
    finalMusicPromptOutputArea.innerHTML = `<p>Mr. GenR sedang menyusun prompt musik final Anda, tunggu sebentar...</p>`;
    finalMusicPromptOutputContainer.style.display = 'block';
    copyFinalMusicPromptButton.disabled = true;
    saveFinalMusicPromptButtonEl.style.display = 'none'; 
    saveFinalMusicPromptButtonEl.disabled = true;

    const collectedComponents = currentAppState.collectedFinalPromptComponents;
    let dataForAI = "Analisis informasi berikut dan gunakan untuk mengisi TEMPLATE WAJIB.\n\nDATA YANG DIKUMPULKAN:\n";

    const genreMoodText = collectedComponents.genreMood || "Tidak ada";
    dataForAI += `- Kombinasi Genre & Mood: ${genreMoodText}\n`;

    const language = getDisplayLanguageName(collectedComponents.lyrics?.language);
    dataForAI += `- Bahasa Lirik: ${language}\n`;

    const vocalistText = collectedComponents.vocals || "Instrumental (tidak ada vokalis)";
    dataForAI += `- Deskripsi Vokalis: ${vocalistText}\n`;

    let songTitle = "Belum Ada Judul";
    let actualLyricsForFinalPrompt = "";
    if (collectedComponents.lyrics?.text) {
        const allLyricLines = collectedComponents.lyrics.text.split('\n');
        if (allLyricLines.length > 0 && allLyricLines[0].trim() !== "") songTitle = allLyricLines[0].trim();
        if (allLyricLines.length > 2) actualLyricsForFinalPrompt = allLyricLines.slice(2).join('\n').trim();
    }
    dataForAI += `- Judul Lagu: ${songTitle}\n`;
    dataForAI += `- Lirik Lagu:\n${actualLyricsForFinalPrompt || 'Tidak ada lirik'}\n`;
    
    const instrumentsForPrompt = collectedComponents.instruments || "Tidak ditentukan";
    dataForAI += `- Daftar Instrumen: ${instrumentsForPrompt}\n`;


    const outputTemplate = `Genre: [genre dari data], Mood: [mood dari data], Instruments: ${instrumentsForPrompt}
Bahasa: [bahasa lirik dari data],
Judul Lagu : [judul lagu dari data]
Vokalis: [vokalis dari data],
${actualLyricsForFinalPrompt ? `Include these lyrics:\n\n[lirik dari data]` : 'Music Type: Instrumental (Tidak ada lirik)'}`;

    const aiPromptForFinalMusic = `
        Anda adalah seorang ahli pembuat prompt musik untuk AI Text-to-Music. 
        Tugas Anda adalah menggunakan DATA YANG DIKUMPULKAN untuk mengisi TEMPLATE WAJIB secara akurat.
        TEMPLATE WAJIB sudah memiliki bagian Instruments yang diisi dengan Daftar Instrumen.
        Setelah mengisi template dengan informasi yang ada, Anda HARUS menambahkan saran kreatif Anda sendiri mengenai:
        1. Tempo (misalnya: slow, medium, fast, spesifik BPM jika bisa).
        2. Nuansa atau atmosfer tambahan (misalnya: cinematic, dreamy, energetic, melancholic, epic).
        3. Karakteristik musik lainnya (misalnya: powerful build-up, minimalist, groovy, acoustic, electronic).
        4. Kualitas produksi (misalnya: clean mix, lofi quality, studio recording, live concert feel).
        Integrasikan saran-saran ini ke dalam hasil akhir, baik dengan memperkaya deskripsi di dalam template (misalnya, menambahkan "120 BPM" ke baris Genre/Mood) atau sebagai baris tambahan setelah blok lirik jika lebih sesuai.
        Pastikan output akhir tetap menjaga struktur inti dari TEMPLATE WAJIB.

        ${dataForAI}

        TEMPLATE WAJIB UNTUK OUTPUT (isi placeholder [] dengan data yang relevan dari DATA YANG DIKUMPULKAN dan tambahkan detail dari saran kreatifmu. Bagian 'Instruments' sudah terisi, jangan ubah itu kecuali untuk menambahkan detail kreatif):
        ${outputTemplate}

        Format output HANYA berupa string prompt musik final yang siap pakai. 
        JANGAN sertakan sapaan, penjelasan, atau teks tambahan apapun di luar prompt musik itu sendiri.
        PENTING: Jika lirik tidak ada, bagian "Include these lyrics:" harus dihilangkan atau diganti dengan deskripsi bahwa musiknya instrumental.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: MODEL_NAME, contents: aiPromptForFinalMusic });
        const finalOutput = response.text.trim();
        finalMusicPromptOutputArea.textContent = finalOutput;
        copyFinalMusicPromptButton.disabled = false;
        saveFinalMusicPromptButtonEl.style.display = 'block'; 
        saveFinalMusicPromptButtonEl.disabled = false;
        saveFinalMusicPromptButtonEl.textContent = 'Simpan';
        currentAppState.finalMusicPromptOutput = finalOutput;
        addNotification("Prompt Musik Final Tersusun!", "Prompt musik Anda dengan sentuhan AI telah berhasil dibuat.");
    } catch (error) {
        console.error("Error generating final music prompt with AI:", error);
        finalMusicPromptOutputArea.innerHTML = `<p style="color:var(--accent-red);"><strong>Oops!</strong> Gagal menyusun prompt musik final dengan AI. Menggunakan format dasar.</p>`;
        
        let fallbackPrompt = "";
        let fGenres = "Tidak ditentukan";
        let fMood = "Tidak ditentukan";

        if (collectedComponents.genreMood) {
            const fullGenreMood = collectedComponents.genreMood.replace(/\.$/, ""); 
            let tempParts = fullGenreMood.split(/,\s*/).map(p => p.trim()).filter(p => p !== "");
            const knownMoods = ["Triumphant", "Misterius", "Tenang (Calm)", "Sedih (Melancholic)", "Bahagia (Uplifting)", "Nostalgia", "Eksperimental"];
            let extractedMood = "";
            const remainingGenreParts = [];
            for (const part of tempParts) {
                if (knownMoods.includes(part) && !extractedMood) { extractedMood = part; }
                else { remainingGenreParts.push(part); }
            }
            if (extractedMood) fMood = extractedMood;
            if (remainingGenreParts.length > 0) fGenres = remainingGenreParts.join(', ');
            else if (!extractedMood && tempParts.length > 0) fGenres = tempParts.join(', '); 
        }
        
        fallbackPrompt += `Genre: ${fGenres}, Mood: ${fMood}, Instruments: ${instrumentsForPrompt}\n`; 
        fallbackPrompt += `Bahasa: ${language},\n`;
        fallbackPrompt += `Judul Lagu : ${songTitle}\n`;
        fallbackPrompt += `Vokalis: ${collectedComponents.vocals || "Instrumental (tidak ada vokalis)"},\n`;
        
        if (actualLyricsForFinalPrompt) {
            fallbackPrompt += `Include these lyrics:\n\n${actualLyricsForFinalPrompt}\n`;
        } else {
            fallbackPrompt += `Music Type: Instrumental (Tidak ada lirik)\n`;
        }
        
        finalMusicPromptOutputArea.textContent = fallbackPrompt.trim();
        copyFinalMusicPromptButton.disabled = false;
        saveFinalMusicPromptButtonEl.style.display = 'block'; 
        saveFinalMusicPromptButtonEl.disabled = false;
        saveFinalMusicPromptButtonEl.textContent = 'Simpan';
        currentAppState.finalMusicPromptOutput = fallbackPrompt.trim();
        addNotification("Prompt Musik (Fallback)", "Prompt musik dasar berhasil disusun (tanpa tambahan AI).");

    } finally {
        generateMusicPromptButton.disabled = false;
        saveApplicationState();
    }
}

async function handleCopyFinalMusicPrompt() {
    if (!finalMusicPromptOutputArea || !copyFinalMusicPromptButton) return;
    const textToCopy = finalMusicPromptOutputArea.textContent;
    if (textToCopy && textToCopy.trim() !== '' && !textToCopy.includes('sedang menyusun') && !textToCopy.includes('Error') && !textToCopy.includes('Oops')) {
        try {
            await navigator.clipboard.writeText(textToCopy);
            const originalButtonText = copyFinalMusicPromptButton.textContent;
            copyFinalMusicPromptButton.textContent = 'Tersalin!';
            copyFinalMusicPromptButton.disabled = true;
            setTimeout(() => {
                copyFinalMusicPromptButton.textContent = originalButtonText;
                copyFinalMusicPromptButton.disabled = false;
            }, 2000);
        } catch (err) {
            console.error('Gagal menyalin prompt musik final:', err);
             addNotification("Gagal Menyalin", "Tidak dapat menyalin prompt ke clipboard.");
        }
    }
}

async function handleSaveFinalMusicPrompt() {
    if (!finalMusicPromptOutputArea || !saveFinalMusicPromptButtonEl || !currentAppState.finalMusicPromptOutput) return;

    const promptText = currentAppState.finalMusicPromptOutput;
    if (!promptText || promptText.trim() === '' || promptText.includes('sedang menyusun') || promptText.includes('Error') || promptText.includes('Oops')) {
        addNotification("Gagal Menyimpan", "Tidak ada prompt valid untuk disimpan.");
        return;
    }

    let title = "Musik Prompt Tanpa Judul";
    const titleRegex = /Judul Lagu\s*:\s*(.*?)(\n|$)/im;
    const titleMatch = promptText.match(titleRegex);
    if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
    } else {
        title = `Prompt Musik ${new Date().toLocaleTimeString()}`;
    }

    const newSavedItem: SavedMusicItem = {
        id: `music_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        title: title,
        prompt: promptText,
        timestamp: new Date()
    };

    currentAppState.savedMusicItems.unshift(newSavedItem); 

    saveApplicationState();
    addNotification("Prompt Disimpan", `Prompt musik "${title}" berhasil disimpan ke Musik Kamu.`);

    saveFinalMusicPromptButtonEl.textContent = 'Tersimpan!';
    saveFinalMusicPromptButtonEl.disabled = true;

    if (savedPromptsModalEl?.classList.contains('visible') && musikKamuTabContentEl?.classList.contains('active')) {
        renderSavedMusicTable();
    }
}


// --- Sidebar Navigation ---
const sidebarHomeButton = document.getElementById('sidebar-home-button') as HTMLAnchorElement;
const sidebarNavLinks = document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav ul li:not(#sidebar-toggle-li) a');

function setActiveSidebarLink(activeLink: HTMLAnchorElement | null) {
    sidebarNavLinks.forEach(link => {
        link.parentElement?.classList.remove('active');
    });
    if (activeLink && activeLink.parentElement) {
        activeLink.parentElement.classList.add('active');
    }
}

function handleHomeButtonClick(event: MouseEvent) {
    event.preventDefault();
    
    if (lyricModal?.classList.contains('visible')) hideLyricModal();
    if (genreMoodModal?.classList.contains('visible')) hideGenreMoodModal();
    if (instrumentModal?.classList.contains('visible')) hideInstrumentModal();
    if (instrumentSpecificModalEl?.classList.contains('visible')) hideInstrumentSpecificModal();
    if (vocalistModal?.classList.contains('visible')) hideVocalistModal();
    if (profilePicModalEl?.classList.contains('visible')) hideProfilePicModal();
    if (authModal?.classList.contains('visible')) hideAuthModal();
    if (aboutModalEl?.classList.contains('visible')) hideAboutModal();
    if (savedPromptsModalEl?.classList.contains('visible')) hideSavedPromptsModal();

    if (notificationPanel?.classList.contains('visible')) {
        toggleNotificationPanel();
    }
    setActiveSidebarLink(sidebarHomeButton);
}


// --- Sidebar Toggle ---
const sidebarToggleEl = document.getElementById('sidebar-toggle') as HTMLAnchorElement;
const sidebarEl = document.getElementById('sidebar') as HTMLElement;
const dashboardContainerEl = document.querySelector('.dashboard-container') as HTMLDivElement;
const mainPanelCenterColumn = document.getElementById('main-panel-center-column') as HTMLDivElement;
const sidebarToggleChevronPathEl = document.getElementById('sidebar-toggle-chevron') as unknown as SVGPathElement;
const CHEVRON_LEFT_PATH = "M13.293 7.293a1 1 0 00-1.414 0L7.586 11.586a1 1 0 000 1.414l4.293 4.293a1 1 0 001.414-1.414L9.707 12l3.586-3.586a1 1 0 000-1.414z";
const CHEVRON_RIGHT_PATH = "M10.707 16.707a1 1 0 001.414 0l4.293-4.293a1 1 0 000-1.414L12.121 7.293a1 1 0 00-1.414 1.414L14.293 12l-3.586 3.586a1 1 0 000 1.414z";

function applySidebarState(isCollapsed: boolean) {
    if (!sidebarEl || !dashboardContainerEl || !sidebarToggleChevronPathEl || !mainPanelCenterColumn) return;
    sidebarEl.classList.toggle('sidebar-collapsed', isCollapsed);
    dashboardContainerEl.classList.toggle('layout-sidebar-collapsed', isCollapsed);
    sidebarToggleEl.setAttribute('aria-expanded', String(!isCollapsed));
    sidebarToggleChevronPathEl.setAttribute('d', isCollapsed ? CHEVRON_RIGHT_PATH : CHEVRON_LEFT_PATH);
    mainPanelCenterColumn.style.paddingLeft = isCollapsed ? 'var(--main-content-padding-default)' : 'var(--main-content-padding-with-protrusion)';
}

function toggleSidebar() {
    if (!sidebarEl) return;
    const isCollapsed = sidebarEl.classList.toggle('sidebar-collapsed');
    applySidebarState(isCollapsed);
    currentAppState.isSidebarCollapsed = isCollapsed;
    saveApplicationState();
}


// --- Profile Pic ---
const sidebarProfileImageEl = document.getElementById('sidebar-profile-image') as HTMLImageElement;
const profilePicTriggerEl = document.getElementById('profile-pic-trigger') as HTMLDivElement;
const profilePicModalEl = document.getElementById('profile-pic-modal') as HTMLDivElement;
const profilePicUrlInputEl = document.getElementById('profile-pic-url-input') as HTMLInputElement;
const saveProfilePicButtonEl = document.getElementById('save-profile-pic-button') as HTMLButtonElement;
const profilePicModalCloseButtonEl = document.getElementById('profile-pic-modal-close') as HTMLButtonElement;
const profilePicErrorAreaEl = document.getElementById('profile-pic-error-area') as HTMLDivElement;

function showProfilePicModal() {
    if (profilePicModalEl) {
        profilePicModalEl.classList.add('visible');
        profilePicModalEl.setAttribute('aria-hidden', 'false');
        if(profilePicUrlInputEl) {
            profilePicUrlInputEl.value = currentAppState.profilePicUrl !== DEFAULT_PROFILE_PIC_URL ? currentAppState.profilePicUrl : '';
            profilePicUrlInputEl.focus();
        }
        if(profilePicErrorAreaEl) profilePicErrorAreaEl.style.display = 'none';
    }
}
function hideProfilePicModal() {
    if (profilePicModalEl) {
        profilePicModalEl.classList.remove('visible');
        profilePicModalEl.setAttribute('aria-hidden', 'true');
    }
}
function isValidImageUrl(url: string): boolean {
    if (!url) return false;
    try {
        const u = new URL(url);
        return /\.(jpg|jpeg|png|gif)$/i.test(u.pathname) && (u.protocol === "http:" || u.protocol === "https:");
    } catch (_) {
        return false;
    }
}

function handleSaveProfilePic() {
    if (!profilePicUrlInputEl || !sidebarProfileImageEl || !profilePicErrorAreaEl) return;
    const newUrl = profilePicUrlInputEl.value.trim();
    if (isValidImageUrl(newUrl)) {
        currentAppState.profilePicUrl = newUrl;
        sidebarProfileImageEl.src = newUrl;
        if(profilePicErrorAreaEl) profilePicErrorAreaEl.style.display = 'none';
        hideProfilePicModal();
        saveApplicationState();
        addNotification("Gambar Profil Diperbarui", "Gambar profil Anda telah berhasil diubah.");
    } else if (newUrl === '') { 
        currentAppState.profilePicUrl = DEFAULT_PROFILE_PIC_URL;
        sidebarProfileImageEl.src = DEFAULT_PROFILE_PIC_URL;
        if(profilePicErrorAreaEl) profilePicErrorAreaEl.style.display = 'none';
        hideProfilePicModal();
        saveApplicationState();
        addNotification("Gambar Profil Direset", "Gambar profil Anda telah direset ke default.");
    } else {
        if(profilePicErrorAreaEl) {
            profilePicErrorAreaEl.textContent = 'URL gambar tidak valid. Pastikan menggunakan JPG, JPEG, PNG, atau GIF dan URL yang benar.';
            profilePicErrorAreaEl.style.display = 'block';
        }
    }
}

// --- Auth ---
const authModal = document.getElementById('auth-modal') as HTMLDivElement;
const loginFormSection = document.getElementById('login-form-section') as HTMLElement;
const registerFormSection = document.getElementById('register-form-section') as HTMLElement;
const mainLoginButton = document.getElementById('main-login-button') as HTMLButtonElement;
const modalLoginActionButton = document.getElementById('modal-login-action-button') as HTMLButtonElement;
const modalRegisterActionButton = document.getElementById('modal-register-action-button') as HTMLButtonElement;
const showRegisterFormButton = document.getElementById('show-register-form-button') as HTMLButtonElement;
const showLoginFormButton = document.getElementById('show-login-form-button') as HTMLButtonElement;
const authModalCloseButton = document.getElementById('auth-modal-close-button') as HTMLButtonElement;

const loginUsernameInput = document.getElementById('login-username-input') as HTMLInputElement;
const loginPasswordInput = document.getElementById('login-password-input') as HTMLInputElement;
const loginErrorMessage = document.getElementById('login-error-message') as HTMLDivElement;

const registerUsernameInput = document.getElementById('register-username-input') as HTMLInputElement;
const registerPasswordInput = document.getElementById('register-password-input') as HTMLInputElement;
const registerMessageArea = document.getElementById('register-message-area') as HTMLDivElement;

const LOGGED_IN_USER_KEY = 'sunoPromptGenRLoggedInUser';
const USER_REGISTRY_KEY = 'sunoPromptGenRUserRegistry';

function showAuthModal(view: 'login' | 'register' = 'login') {
    if (!authModal || !loginFormSection || !registerFormSection) return;
    authModal.classList.add('visible');
    authModal.setAttribute('aria-hidden', 'false');
    if (view === 'login') {
        loginFormSection.classList.remove('auth-view-hidden');
        registerFormSection.classList.add('auth-view-hidden');
        authModal.setAttribute('aria-labelledby', 'auth-modal-title-login');
        if(loginUsernameInput) loginUsernameInput.focus();
    } else {
        loginFormSection.classList.add('auth-view-hidden');
        registerFormSection.classList.remove('auth-view-hidden');
        authModal.setAttribute('aria-labelledby', 'auth-modal-title-register');
        if(registerUsernameInput) registerUsernameInput.focus();
    }
    if(loginErrorMessage) loginErrorMessage.style.display = 'none';
    if(registerMessageArea) registerMessageArea.innerHTML = '';
}

function hideAuthModal() {
    if (authModal) {
        authModal.classList.remove('visible');
        authModal.setAttribute('aria-hidden', 'true');
    }
}

function mockPasswordHash(password: string): string {
    try {
        return window.btoa(password.split("").reverse().join("") + "SunoGenRSalt");
    } catch (e) { 
        return password + "_SunoGenRSalt_rev";
    }
}

function handleModalLogin() {
    if (!loginUsernameInput || !loginPasswordInput || !loginErrorMessage || typeof localStorage === 'undefined') return;
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;

    if (!username || !password) {
        loginErrorMessage.textContent = 'Username dan password tidak boleh kosong.';
        loginErrorMessage.style.display = 'block';
        return;
    }

    const users = JSON.parse(localStorage.getItem(USER_REGISTRY_KEY) || '{}');
    if (users[username] && users[username] === mockPasswordHash(password)) {
        localStorage.setItem(LOGGED_IN_USER_KEY, username);
        loginErrorMessage.style.display = 'none';
        hideAuthModal();
        
        loadApplicationState(username); 
        
        unlockApp();
        if (mainLoginButton) {
            mainLoginButton.textContent = `Logout (${username})`;
            mainLoginButton.setAttribute('aria-label', `Logout ${username}`);
        }
        addNotification("Login Berhasil", `Selamat datang kembali, ${username}!`);
    } else {
        loginErrorMessage.textContent = 'Username atau password salah.';
        loginErrorMessage.style.display = 'block';
    }
}

function handleModalRegister() {
    if (!registerUsernameInput || !registerPasswordInput || !registerMessageArea || typeof localStorage === 'undefined') return;
    const username = registerUsernameInput.value.trim();
    const password = registerPasswordInput.value;
    registerMessageArea.innerHTML = '';

    if (!username || username.length < 3) {
        registerMessageArea.innerHTML = `<p class="error-message">Username minimal 3 karakter.</p>`;
        return;
    }
    if (!password || password.length < 6) {
        registerMessageArea.innerHTML = `<p class="error-message">Password minimal 6 karakter.</p>`;
        return;
    }

    const users = JSON.parse(localStorage.getItem(USER_REGISTRY_KEY) || '{}');
    if (users[username]) {
        registerMessageArea.innerHTML = `<p class="error-message">Username "${username}" sudah digunakan.</p>`;
    } else {
        users[username] = mockPasswordHash(password);
        localStorage.setItem(USER_REGISTRY_KEY, JSON.stringify(users));
        registerMessageArea.innerHTML = `<p class="success-message">Akun "${username}" berhasil dibuat! Silakan login.</p>`;
        registerUsernameInput.value = '';
        registerPasswordInput.value = '';
        setTimeout(() => showAuthModal('login'), 1500);
    }
}

function handleLogout() {
    if (typeof localStorage === 'undefined') return;
    const loggedInUser = localStorage.getItem(LOGGED_IN_USER_KEY);
    
    if (loggedInUser) {
        saveApplicationState(); 
        addNotification("Logout Berhasil", `Sampai jumpa lagi, ${loggedInUser}!`);
    }
    
    localStorage.removeItem(LOGGED_IN_USER_KEY);
    
    resetAppStateToDefaults(); 

    if (mainLoginButton) {
        mainLoginButton.textContent = 'Login';
        mainLoginButton.setAttribute('aria-label', 'Login');
    }
    lockApp();
    
    if (chatDisplayArea) chatDisplayArea.innerHTML = ''; 
    if (chatInputElement) {
        chatInputElement.disabled = true;
        chatInputElement.value = '';
    }
    if (chatSubmitButton) chatSubmitButton.disabled = true;
    chat = null; 

    renderUIFromState(); 
    showAuthModal('login');
}

function loadLoginState() {
    if (typeof localStorage === 'undefined') {
        lockApp(); 
        if (mainLoginButton) mainLoginButton.style.display = 'none'; 
        resetAppStateToDefaults(); 
        renderUIFromState();
        return;
    }

    const userRegistryString = localStorage.getItem(USER_REGISTRY_KEY);
    let users = {};
    if (userRegistryString) {
        try { users = JSON.parse(userRegistryString); } 
        catch (e) { console.error("Error parsing user registry:", e); localStorage.removeItem(USER_REGISTRY_KEY); }
    }
    if (Object.keys(users).length === 0) {
        const defaultAdminUsername = "Admin"; 
        const defaultAdminPassword = "123";
        users[defaultAdminUsername] = mockPasswordHash(defaultAdminPassword);
        localStorage.setItem(USER_REGISTRY_KEY, JSON.stringify(users));
    }

    const loggedInUser = localStorage.getItem(LOGGED_IN_USER_KEY);
    if (loggedInUser) {
        unlockApp();
        if (mainLoginButton) {
            mainLoginButton.textContent = `Logout (${loggedInUser})`;
            mainLoginButton.setAttribute('aria-label', `Logout ${loggedInUser}`);
        }
        loadApplicationState(loggedInUser); 
    } else {
        lockApp();
        if (mainLoginButton) {
            mainLoginButton.textContent = 'Login';
            mainLoginButton.setAttribute('aria-label', 'Login');
        }
        resetAppStateToDefaults(); 
        renderUIFromState(); 

        if (chatDisplayArea) chatDisplayArea.innerHTML = '';
        if (chatInputElement) chatInputElement.disabled = true;
        if (chatSubmitButton) chatSubmitButton.disabled = true;

        showAuthModal('login');
    }
}

// --- About Modal ---
const aboutModalEl = document.getElementById('about-modal') as HTMLDivElement;
const sidebarAboutButton = document.getElementById('sidebar-about-button') as HTMLAnchorElement;
const aboutModalCloseButtonEl = document.getElementById('about-modal-close') as HTMLButtonElement;

function showAboutModal() {
    if (aboutModalEl) {
        aboutModalEl.classList.add('visible');
        aboutModalEl.setAttribute('aria-hidden', 'false');
        aboutModalCloseButtonEl?.focus(); 
    }
}
function hideAboutModal() {
    if (aboutModalEl) {
        aboutModalEl.classList.remove('visible');
        aboutModalEl.setAttribute('aria-hidden', 'true');
    }
}


// --- Initialize and Attach Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadLoginState(); 

    if (chatInputForm && chatDisplayArea && chatInputElement && chatSubmitButton) {
        chatInputForm.addEventListener('submit', handleChatSubmit);
    } else { console.error("Essential chat UI elements not found."); }

    if (sidebarHomeButton) {
        sidebarHomeButton.addEventListener('click', handleHomeButtonClick);
    }
    sidebarNavLinks.forEach(link => {
        if (link.id === 'sidebar-home-button') { /* Handled */ }
        else if (link.id === 'sidebar-threads-link' || link.id === 'sidebar-youtube-link' || link.id === 'sidebar-music-library-link') {
            link.addEventListener('click', (e) => { setActiveSidebarLink(link as HTMLAnchorElement); });
        } else if (link.id === 'sidebar-about-button') {
            link.addEventListener('click', (e) => { e.preventDefault(); showAboutModal(); setActiveSidebarLink(link as HTMLAnchorElement); });
        } else if (link.id === 'sidebar-saved-prompts-button') {
            link.addEventListener('click', (e) => { e.preventDefault(); showSavedPromptsModal(); setActiveSidebarLink(link as HTMLAnchorElement); });
        } else { 
            link.addEventListener('click', (e) => {
                e.preventDefault();
                setActiveSidebarLink(link as HTMLAnchorElement);
                addNotification("Fitur Dalam Pengembangan", `Fitur "${link.getAttribute('aria-label') || 'ini'}" sedang dalam pengembangan.`);
            });
        }
    });

    if (sidebarToggleEl) sidebarToggleEl.addEventListener('click', (e) => { e.preventDefault(); toggleSidebar(); });
    if (notificationBellButton) notificationBellButton.addEventListener('click', toggleNotificationPanel);
    if (markAllReadButton) markAllReadButton.addEventListener('click', handleMarkAllRead);
    document.addEventListener('click', (event) => {
        if (notificationPanel && notificationPanel.classList.contains('visible')) {
            const target = event.target as Node;
            if (!notificationPanel.contains(target) && target !== notificationBellButton && !notificationBellButton.contains(target)) {
                toggleNotificationPanel();
            }
        }
    });

    if (profilePicTriggerEl) {
        profilePicTriggerEl.addEventListener('click', showProfilePicModal);
        profilePicTriggerEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') showProfilePicModal(); });
    }
    if (saveProfilePicButtonEl) saveProfilePicButtonEl.addEventListener('click', handleSaveProfilePic);
    if (profilePicModalCloseButtonEl) profilePicModalCloseButtonEl.addEventListener('click', hideProfilePicModal);
    // Removed: if (profilePicModalEl) profilePicModalEl.addEventListener('click', (e) => { if (e.target === profilePicModalEl) hideProfilePicModal(); });

    if (mainLoginButton) {
        mainLoginButton.addEventListener('click', () => {
            if (localStorage.getItem(LOGGED_IN_USER_KEY)) { handleLogout(); } 
            else { showAuthModal('login'); }
        });
    }
    if (modalLoginActionButton) modalLoginActionButton.addEventListener('click', handleModalLogin);
    if (modalRegisterActionButton) modalRegisterActionButton.addEventListener('click', handleModalRegister);
    if (showRegisterFormButton) showRegisterFormButton.addEventListener('click', () => showAuthModal('register'));
    if (showLoginFormButton) showLoginFormButton.addEventListener('click', () => showAuthModal('login'));
    if (authModalCloseButton) authModalCloseButton.addEventListener('click', hideAuthModal);
    // Removed: if (authModal) authModal.addEventListener('click', (e) => { if (e.target === authModal) hideAuthModal(); });

    if (sidebarAboutButton && aboutModalEl && aboutModalCloseButtonEl) {
        aboutModalCloseButtonEl.addEventListener('click', hideAboutModal);
        // Removed: aboutModalEl.addEventListener('click', (e) => { if (e.target === aboutModalEl) hideAboutModal(); });
    }

    if (savedPromptsModalEl && savedPromptsModalCloseButtonEl && musikKamuTabButtonEl && instrumenKamuTabButtonEl) {
        savedPromptsModalCloseButtonEl.addEventListener('click', hideSavedPromptsModal);
        // Removed: savedPromptsModalEl.addEventListener('click', (e) => { if (e.target === savedPromptsModalEl) hideSavedPromptsModal(); });
        musikKamuTabButtonEl.addEventListener('click', () => switchSavedPromptsTab('music'));
        instrumenKamuTabButtonEl.addEventListener('click', () => switchSavedPromptsTab('instruments'));
    }

    if (generateMusicPromptButton) generateMusicPromptButton.addEventListener('click', handleGenerateFinalMusicPrompt);
    if (copyFinalMusicPromptButton) copyFinalMusicPromptButton.addEventListener('click', handleCopyFinalMusicPrompt);
    if (saveFinalMusicPromptButtonEl) saveFinalMusicPromptButtonEl.addEventListener('click', handleSaveFinalMusicPrompt);

    const lyricModalCloseButton = document.getElementById('lyric-modal-close') as HTMLButtonElement;
    if (buatLirikCard) {
        buatLirikCard.addEventListener('click', showLyricModal);
        buatLirikCard.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') showLyricModal(); });
    }
    if (lyricModalCloseButton) lyricModalCloseButton.addEventListener('click', hideLyricModal);
    if (generateLyricButton) {
        if (!API_KEY) { generateLyricButton.disabled = true; generateLyricButton.title="API Key tidak dikonfigurasi"; }
        generateLyricButton.addEventListener('click', handleGenerateLyric);
    }
    // Removed: if (lyricModal) lyricModal.addEventListener('click', (e) => { if (e.target === lyricModal) hideLyricModal(); });

    const genreMoodModalCloseButton = document.getElementById('genre-mood-modal-close') as HTMLButtonElement;
    if (designGenreCard) {
        designGenreCard.addEventListener('click', showGenreMoodModal);
        designGenreCard.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') showGenreMoodModal(); });
    }
    if (genreMoodModalCloseButton) genreMoodModalCloseButton.addEventListener('click', hideGenreMoodModal);
    if (generateGenreMoodButton) { generateGenreMoodButton.addEventListener('click', handleGenerateGenreMood); }
    // Removed: if (genreMoodModal) genreMoodModal.addEventListener('click', (e) => { if (e.target === genreMoodModal) hideGenreMoodModal(); });

    const instrumentModalCloseButton = document.getElementById('instrument-modal-close') as HTMLButtonElement;
    if (instrumentDesignCard) {
        instrumentDesignCard.addEventListener('click', showInstrumentModal);
        instrumentDesignCard.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') showInstrumentModal(); });
    }
    if (instrumentModalCloseButton) instrumentModalCloseButton.addEventListener('click', hideInstrumentModal);
    if (generateInstrumentListButton) { generateInstrumentListButton.addEventListener('click', handleGenerateInstrumentList); }
    // Removed: if (instrumentModal) instrumentModal.addEventListener('click', (e) => { if (e.target === instrumentModal) hideInstrumentModal(); });

    const vocalistModalCloseButton = document.getElementById('vocalist-modal-close') as HTMLButtonElement;
    if (vocalistDesignCard) {
        vocalistDesignCard.addEventListener('click', showVocalistModal);
        vocalistDesignCard.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') showVocalistModal(); });
    }
    if (vocalistModalCloseButton) vocalistModalCloseButton.addEventListener('click', hideVocalistModal);
    if (generateVocalistButton) { generateVocalistButton.addEventListener('click', handleGenerateVocalistDescription); }
    // Removed: if (vocalistModal) vocalistModal.addEventListener('click', (e) => { if (e.target === vocalistModal) hideVocalistModal(); });
    
    // New Card: Khusus Instrumen
    const instrumentSpecificModalCloseButtonEl = document.getElementById('instrument-specific-modal-close') as HTMLButtonElement;
    if (instrumentSpecificCardEl) {
        instrumentSpecificCardEl.addEventListener('click', showInstrumentSpecificModal);
        instrumentSpecificCardEl.addEventListener('keydown', (e) => { if(e.key === 'Enter' || e.key === ' ') showInstrumentSpecificModal(); });
    }
    if (instrumentSpecificModalCloseButtonEl) instrumentSpecificModalCloseButtonEl.addEventListener('click', hideInstrumentSpecificModal);
    if (generateInstrumentSpecificPromptButtonEl) {
         if (!API_KEY) { generateInstrumentSpecificPromptButtonEl.disabled = true; generateInstrumentSpecificPromptButtonEl.title="API Key tidak dikonfigurasi"; }
        generateInstrumentSpecificPromptButtonEl.addEventListener('click', handleGenerateInstrumentSpecificPrompt);
    }
    // Removed: if (instrumentSpecificModalEl) instrumentSpecificModalEl.addEventListener('click', (e) => { if (e.target === instrumentSpecificModalEl) hideInstrumentSpecificModal(); });
    if (saveInstrumentSpecificToCollectionButtonEl) {
        saveInstrumentSpecificToCollectionButtonEl.addEventListener('click', handleSaveInstrumentSpecificToCollection);
    }
    if (copyInstrumentSpecificPromptButtonEl) {
        copyInstrumentSpecificPromptButtonEl.addEventListener('click', handleCopyInstrumentSpecificPrompt);
    }


    if (vocalTypeMaleCheckbox && maleRangeFieldset) vocalTypeMaleCheckbox.addEventListener('change', () => { maleRangeFieldset.classList.toggle('visible', vocalTypeMaleCheckbox.checked); if (!vocalTypeMaleCheckbox.checked) maleRangeFieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach(r => r.checked = false); });
    if (vocalTypeFemaleCheckbox && femaleRangeFieldset) vocalTypeFemaleCheckbox.addEventListener('change', () => { femaleRangeFieldset.classList.toggle('visible', vocalTypeFemaleCheckbox.checked); if (!vocalTypeFemaleCheckbox.checked) femaleRangeFieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach(r => r.checked = false); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (lyricModal?.classList.contains('visible')) hideLyricModal();
            else if (genreMoodModal?.classList.contains('visible')) hideGenreMoodModal();
            else if (instrumentModal?.classList.contains('visible')) hideInstrumentModal();
            else if (instrumentSpecificModalEl?.classList.contains('visible')) hideInstrumentSpecificModal();
            else if (vocalistModal?.classList.contains('visible')) hideVocalistModal();
            else if (profilePicModalEl?.classList.contains('visible')) hideProfilePicModal();
            else if (authModal?.classList.contains('visible')) hideAuthModal();
            else if (aboutModalEl?.classList.contains('visible')) hideAboutModal();
            else if (savedPromptsModalEl?.classList.contains('visible')) hideSavedPromptsModal();
            else if (notificationPanel?.classList.contains('visible')) toggleNotificationPanel();
        }
    });
});

// Functions for showing/hiding modals
function showLyricModal() { if (lyricModal) { lyricModal.classList.add('visible'); lyricModal.setAttribute('aria-hidden', 'false'); if(songTitleInputElement) songTitleInputElement.focus(); } }
function hideLyricModal() { if (lyricModal) { lyricModal.classList.remove('visible'); lyricModal.setAttribute('aria-hidden', 'true'); } }
function showGenreMoodModal() { if (genreMoodModal) { genreMoodModal.classList.add('visible'); genreMoodModal.setAttribute('aria-hidden', 'false'); const firstCheckbox = genreMoodModal.querySelector<HTMLInputElement>('input[type="checkbox"]'); if(firstCheckbox) firstCheckbox.focus(); } }
function hideGenreMoodModal() { if (genreMoodModal) { genreMoodModal.classList.remove('visible'); genreMoodModal.setAttribute('aria-hidden', 'true'); } }
function showInstrumentModal() { if (instrumentModal) { instrumentModal.classList.add('visible'); instrumentModal.setAttribute('aria-hidden', 'false'); const firstCheckbox = instrumentModal.querySelector<HTMLInputElement>('input[type="checkbox"]'); if(firstCheckbox) firstCheckbox.focus(); } }
function hideInstrumentModal() { if (instrumentModal) { instrumentModal.classList.remove('visible'); instrumentModal.setAttribute('aria-hidden', 'true'); } }
function showVocalistModal() { if (vocalistModal) { vocalistModal.classList.add('visible'); vocalistModal.setAttribute('aria-hidden', 'false'); if(vocalTypeMaleCheckbox) vocalTypeMaleCheckbox.focus(); } }
function hideVocalistModal() { if (vocalistModal) { vocalistModal.classList.remove('visible'); vocalistModal.setAttribute('aria-hidden', 'true'); } }
function showInstrumentSpecificModal() { if (instrumentSpecificModalEl) { instrumentSpecificModalEl.classList.add('visible'); instrumentSpecificModalEl.setAttribute('aria-hidden', 'false'); if(instrumentSpecificInputEl) instrumentSpecificInputEl.focus(); } }
function hideInstrumentSpecificModal() { if (instrumentSpecificModalEl) { instrumentSpecificModalEl.classList.remove('visible'); instrumentSpecificModalEl.setAttribute('aria-hidden', 'true'); } }

async function handleGenerateLyric() {
    if (!songTitleInputElement || !generateLyricButton || !lyricOutputArea) return;
    const songTitle = songTitleInputElement.value.trim();
    if (!songTitle) { lyricOutputArea.innerHTML = `<p style="color: var(--accent-red);">Judul lagu tidak boleh kosong.</p>`; return; }
    
    if (!API_KEY || !localStorage.getItem(LOGGED_IN_USER_KEY)) {
        lyricOutputArea.innerHTML = `<p style="color:var(--accent-red);"><strong>Error:</strong> API Key tidak tersedia atau Anda belum login.</p>`;
        if(generateLyricButton) generateLyricButton.disabled = true;
        return;
    }
    if(generateLyricButton) generateLyricButton.disabled = false;

    let selectedLanguage = 'indonesia';
    const lyricLanguageRadios = lyricModal?.querySelectorAll<HTMLInputElement>('input[name="lyric-language"]');
    if (lyricLanguageRadios) { const checkedRadio = Array.from(lyricLanguageRadios).find(radio => radio.checked); if (checkedRadio) selectedLanguage = checkedRadio.value; }

    let languageForMessage = 'Indonesia';
    if (selectedLanguage === 'english') languageForMessage = 'Inggris';
    else if (selectedLanguage === 'japanese_romaji') languageForMessage = 'Jepang (Romaji)';

    generateLyricButton.disabled = true;
    lyricOutputArea.innerHTML = `<p>Mr. GenR sedang merangkai kata untuk lagu "${songTitle}" dalam bahasa ${languageForMessage}...</p>`;

    let finalPrompt = '';
    const baseInstruction = `Lirik harus mengikuti struktur lagu Pop/Pop Ballad yang umum (misalnya: Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus, Outro). Pastikan setiap bagian diberi label yang jelas (contoh: [Verse 1], [Chorus]). Jangan sertakan komentar, penjelasan makna, atau teks tambahan apapun selain judul dan lirik itu sendiri.`;

    if (selectedLanguage === 'indonesia') {
        finalPrompt = `Buatkan lirik lagu lengkap dalam Bahasa Indonesia untuk lagu berjudul "${songTitle}". Baris pertama HANYA berisi judul lagu: "${songTitle}". Setelah judul, berikan satu baris kosong, lalu tuliskan lirik lagunya. ${baseInstruction}`;
    } else if (selectedLanguage === 'english') {
        finalPrompt = `Create complete song lyrics in English for a song titled "${songTitle}". The first line MUST ONLY contain the song title: "${songTitle}". After the title, provide a single blank line, then write the song lyrics. ${baseInstruction}`;
    } else if (selectedLanguage === 'japanese_romaji') {
        finalPrompt = `Create complete song lyrics in Japanese, written exclusively in Romaji, for a song titled "${songTitle}". The first line MUST ONLY contain the song title: "${songTitle}". After the title, provide a single blank line, then write the song lyrics. Ensure the output is exclusively Romaji. ${baseInstruction}`;
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: MODEL_NAME, contents: finalPrompt });
        lyricOutputArea.textContent = response.text.trim();
        lyricCount = (currentAppState.lyricCount || 0) + 1; 
        currentAppState.lyricCount = lyricCount; 
        updateCardDisplay('lyrics');
        addNotification("Lirik Berhasil Dibuat!", `Lirik untuk "${songTitle}" (${languageForMessage}) telah selesai.`);
    } catch (error) {
        console.error("Error generating lyrics:", error);
        lyricOutputArea.innerHTML = `<p style="color:var(--accent-red);"><strong>Oops!</strong> Gagal membuat lirik. Coba lagi nanti.</p>`;
    }
    finally {
        if(generateLyricButton) generateLyricButton.disabled = false;
        currentAppState.lyricModalSongTitle = songTitleInputElement.value;
        currentAppState.lyricModalOutput = lyricOutputArea.textContent || '';
        currentAppState.lyricModalSelectedLanguage = selectedLanguage;
        saveApplicationState();
    }
}

function handleGenerateGenreMood() { 
    if (!genreCheckboxes || !moodRadioButtons || !generateGenreMoodButton || !genreMoodOutputArea) return;

    const selectedGenres = Array.from(genreCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
    const selectedMoodRadio = Array.from(moodRadioButtons).find(rb => rb.checked);
    const selectedMood = selectedMoodRadio ? selectedMoodRadio.value : null;

    if (selectedGenres.length === 0 && !selectedMood) {
        genreMoodOutputArea.innerHTML = `<p style="color:var(--accent-red);">Pilih minimal satu genre atau satu mood.</p>`;
        return;
    }

    if(generateGenreMoodButton) generateGenreMoodButton.disabled = true;
    genreMoodOutputArea.innerHTML = `<p>Mr. GenR sedang memproses pilihan Anda...</p>`;

    const parts: string[] = [];
    if (selectedGenres.length > 0) { parts.push(...selectedGenres); }
    if (selectedMood) { parts.push(selectedMood); }
    const outputText = parts.join(', ') + (parts.length > 0 ? '.' : ''); 

    genreMoodOutputArea.textContent = outputText;
    if (parts.length > 0) {
        designCount = (currentAppState.designCount || 0) + 1;
        currentAppState.designCount = designCount;
        updateCardDisplay('genreMood');
        addNotification("Kombinasi Genre & Mood Dibuat!", `Pilihan Anda: ${outputText}`);
    } else {  genreMoodOutputArea.innerHTML = `<p style="color:var(--accent-red);">Tidak ada pilihan yang valid.</p>`; }
    
    if(generateGenreMoodButton) generateGenreMoodButton.disabled = false;
    currentAppState.genreMoodModalSelectedGenres = selectedGenres;
    currentAppState.genreMoodModalSelectedMood = selectedMood;
    currentAppState.genreMoodModalOutput = outputText;
    saveApplicationState();
}

function handleGenerateInstrumentList() { 
    if (!instrumentMainCheckboxes || !instrumentAdditionalCheckboxes || !generateInstrumentListButton || !instrumentOutputArea) return;

    const selectedMainInstruments = Array.from(instrumentMainCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
    const selectedAdditionalInstruments = Array.from(instrumentAdditionalCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

    if (selectedMainInstruments.length === 0 && selectedAdditionalInstruments.length === 0) {
        instrumentOutputArea.innerHTML = `<p style="color:var(--accent-red);">Pilih minimal satu instrumen utama atau tambahan.</p>`;
        return;
    }

    if(generateInstrumentListButton) generateInstrumentListButton.disabled = true;
    instrumentOutputArea.innerHTML = `<p>Mr. GenR sedang menyusun daftar instrumen...</p>`;

    const allInstruments = [...selectedMainInstruments, ...selectedAdditionalInstruments];
    const outputText = allInstruments.join(', ') + (allInstruments.length > 0 ? '.' : '');

    instrumentOutputArea.textContent = outputText;
    if (allInstruments.length > 0) {
        instrumentDesignCount = (currentAppState.instrumentDesignCount || 0) + 1; 
        currentAppState.instrumentDesignCount = instrumentDesignCount;
        updateCardDisplay('instruments');
        addNotification("Daftar Instrumen Dibuat!", `Instrumen terpilih: ${outputText}`);
    } else { instrumentOutputArea.innerHTML = `<p style="color:var(--accent-red);">Tidak ada instrumen yang dipilih.</p>`; }
    
    if(generateInstrumentListButton) generateInstrumentListButton.disabled = false;
    currentAppState.instrumentModalSelectedMain = selectedMainInstruments;
    currentAppState.instrumentModalSelectedAdditional = selectedAdditionalInstruments;
    currentAppState.instrumentModalOutput = outputText;
    saveApplicationState();
}

async function handleGenerateInstrumentSpecificPrompt() {
    if (!instrumentSpecificInputEl || !generateInstrumentSpecificPromptButtonEl || !instrumentSpecificOutputAreaEl || !saveInstrumentSpecificToCollectionButtonEl || !copyInstrumentSpecificPromptButtonEl) return;
    const userInput = instrumentSpecificInputEl.value.trim();

    if (!userInput) {
        instrumentSpecificOutputAreaEl.innerHTML = `<p style="color: var(--accent-red);">Deskripsi instrumen tidak boleh kosong.</p>`;
        return;
    }

    if (!API_KEY || !localStorage.getItem(LOGGED_IN_USER_KEY)) {
        instrumentSpecificOutputAreaEl.innerHTML = `<p style="color:var(--accent-red);"><strong>Error:</strong> API Key tidak tersedia atau Anda belum login untuk fitur ini.</p>`;
        if(generateInstrumentSpecificPromptButtonEl) generateInstrumentSpecificPromptButtonEl.disabled = true;
        saveInstrumentSpecificToCollectionButtonEl.disabled = true;
        copyInstrumentSpecificPromptButtonEl.disabled = true;
        return;
    }
    if(generateInstrumentSpecificPromptButtonEl) generateInstrumentSpecificPromptButtonEl.disabled = false; // Will be disabled during processing
    saveInstrumentSpecificToCollectionButtonEl.disabled = true;
    copyInstrumentSpecificPromptButtonEl.disabled = true;


    generateInstrumentSpecificPromptButtonEl.disabled = true;
    instrumentSpecificOutputAreaEl.innerHTML = `<p>Mr. GenR sedang menghasilkan prompt untuk instrumen spesifik Anda...</p>`;

    const promptForAI = `User wants an instrument sound described as: "${userInput}". 
    Generate a detailed and creative 'Text-To-Instrument' prompt suitable for an AI music generator that focuses on specific instrument sounds. 
    Describe sonic characteristics, articulation, playing style, mood, and any unique instrumental textures or effects. 
    If the user's input is brief or vague, offer concrete suggestions and examples of musical terms or ideas to enrich the prompt. 
    The output should be ONLY the final instrument prompt string, ready to be used.`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({ model: MODEL_NAME, contents: promptForAI });
        const generatedPrompt = response.text.trim();
        instrumentSpecificOutputAreaEl.textContent = generatedPrompt;
        
        instrumentSpecificCount = (currentAppState.instrumentSpecificCount || 0) + 1;
        currentAppState.instrumentSpecificCount = instrumentSpecificCount;

        // Update progress for Khusus Instrumen card
        if (currentAppState.instrumentSpecificProgress >= 100) {
            currentAppState.instrumentSpecificProgress = 5; // Reset to 0 and add 5 for current generation
        } else {
            currentAppState.instrumentSpecificProgress = (currentAppState.instrumentSpecificProgress || 0) + 5;
        }

        updateCardDisplay('instrumentSpecific');
        addNotification("Prompt Instrumen Khusus Dibuat!", "Prompt instrumen spesifik telah dihasilkan oleh AI.");

        currentAppState.instrumentSpecificModalInput = userInput;
        currentAppState.instrumentSpecificModalOutput = generatedPrompt;
        if(saveInstrumentSpecificToCollectionButtonEl) saveInstrumentSpecificToCollectionButtonEl.disabled = false; 
        if(copyInstrumentSpecificPromptButtonEl) copyInstrumentSpecificPromptButtonEl.disabled = false;

    } catch (error) {
        console.error("Error generating specific instrument prompt:", error);
        instrumentSpecificOutputAreaEl.innerHTML = `<p style="color:var(--accent-red);"><strong>Oops!</strong> Gagal menghasilkan prompt instrumen. Coba lagi nanti.</p>`;
        currentAppState.instrumentSpecificModalOutput = instrumentSpecificOutputAreaEl.textContent; 
        if(saveInstrumentSpecificToCollectionButtonEl) saveInstrumentSpecificToCollectionButtonEl.disabled = true;
        if(copyInstrumentSpecificPromptButtonEl) copyInstrumentSpecificPromptButtonEl.disabled = true;
    } finally {
        if(generateInstrumentSpecificPromptButtonEl) generateInstrumentSpecificPromptButtonEl.disabled = false;
        saveApplicationState();
    }
}

async function handleCopyInstrumentSpecificPrompt() {
    if (!instrumentSpecificOutputAreaEl || !copyInstrumentSpecificPromptButtonEl) return;
    const textToCopy = instrumentSpecificOutputAreaEl.textContent?.trim();

    if (textToCopy && !textToCopy.includes('sedang menghasilkan') && !textToCopy.includes('Masukkan deskripsi') && !textToCopy.includes('Error') && !textToCopy.includes('Oops')) {
        try {
            await navigator.clipboard.writeText(textToCopy);
            const originalButtonText = copyInstrumentSpecificPromptButtonEl.textContent;
            copyInstrumentSpecificPromptButtonEl.textContent = 'Tersalin!';
            copyInstrumentSpecificPromptButtonEl.disabled = true;
            addNotification("Prompt Instrumen Disalin", "Prompt instrumen spesifik berhasil disalin ke clipboard.");
            setTimeout(() => {
                copyInstrumentSpecificPromptButtonEl.textContent = originalButtonText || 'Copy Prompt';
                const isValidOutput = instrumentSpecificOutputAreaEl.textContent?.trim() &&
                                  !instrumentSpecificOutputAreaEl.textContent.includes('sedang menghasilkan') &&
                                  !instrumentSpecificOutputAreaEl.textContent.includes('Masukkan deskripsi');
                copyInstrumentSpecificPromptButtonEl.disabled = !isValidOutput;
            }, 2000);
        } catch (err) {
            console.error('Gagal menyalin prompt instrumen spesifik:', err);
            addNotification("Gagal Menyalin", "Tidak dapat menyalin prompt instrumen ke clipboard.");
        }
    } else {
        addNotification("Gagal Menyalin", "Tidak ada prompt valid untuk disalin.");
    }
}


async function handleSaveInstrumentSpecificToCollection() {
    if (!instrumentSpecificOutputAreaEl || !saveInstrumentSpecificToCollectionButtonEl || !API_KEY || !localStorage.getItem(LOGGED_IN_USER_KEY)) {
        addNotification("Gagal Menyimpan", "Tidak dapat menyimpan. Pastikan API Key dan login sudah benar.");
        return;
    }

    const instrumentDescription = instrumentSpecificOutputAreaEl.textContent?.trim();
    if (!instrumentDescription || instrumentDescription.includes('sedang menghasilkan') || instrumentDescription.includes('Masukkan deskripsi') || instrumentDescription.includes('Error') || instrumentDescription.includes('Oops')) {
        addNotification("Gagal Menyimpan", "Tidak ada deskripsi instrumen valid untuk disimpan.");
        return;
    }

    saveInstrumentSpecificToCollectionButtonEl.disabled = true;
    saveInstrumentSpecificToCollectionButtonEl.textContent = 'Menyimpan...';
    if(copyInstrumentSpecificPromptButtonEl) copyInstrumentSpecificPromptButtonEl.disabled = true;


    let title = `Instrumen Kustom ${new Date().toLocaleTimeString()}`; // Default title
    try {
        const titlePrompt = `Based on the following instrument description, generate a concise and descriptive title (3-5 words) for it. The title should be suitable for a list of saved instrument sound designs. Output ONLY the title itself, nothing else.\n\nInstrument Description:\n${instrumentDescription}`;
        const titleResponse: GenerateContentResponse = await ai.models.generateContent({model: MODEL_NAME, contents: titlePrompt});
        const aiTitle = titleResponse.text.trim();
        if (aiTitle) {
            title = aiTitle;
        }
    } catch (error) {
        console.error("Error generating title for instrument:", error);
        addNotification("Info Judul", "Gagal membuat judul otomatis, menggunakan judul default.");
    }

    const newSavedInstrument: SavedInstrumentItem = {
        id: `instr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        title: title,
        description: instrumentDescription,
        timestamp: new Date()
    };

    currentAppState.savedInstrumentItems.unshift(newSavedInstrument);
    saveApplicationState();
    addNotification("Instrumen Disimpan", `Deskripsi instrumen "${title}" berhasil disimpan ke Koleksi Instrumen Kamu.`);

    saveInstrumentSpecificToCollectionButtonEl.textContent = 'Tersimpan!';

    if (savedPromptsModalEl?.classList.contains('visible') && instrumenKamuTabContentEl?.classList.contains('active')) {
        renderSavedInstrumentsTable();
    }
}


function getVocalRangeLabel(rangeValue: string, gender: 'Pria' | 'Wanita'): string {
    if (gender === 'Pria') {
        switch (rangeValue) {
            case 'Tenor': return 'Tenor (suara tinggi)';
            case 'Bariton': return 'Bariton (suara sedang)';
            case 'Bass': return 'Bass (suara rendah)';
            default: return rangeValue;
        }
    } else if (gender === 'Wanita') {
        switch (rangeValue) {
            case 'Sopran': return 'Sopran (suara tinggi)';
            case 'Mezzo-Soprano': return 'Mezzo-Soprano (suara sedang)';
            case 'Alto': return 'Alto (suara rendah)';
            default: return rangeValue;
        }
    }
    return rangeValue; 
}


async function handleGenerateVocalistDescription() {
    if (!generateVocalistButton || !vocalistOutputArea || !vocalTypeMaleCheckbox ||
        !vocalTypeFemaleCheckbox || !artistReferenceInput || !maleRangeFieldset || !femaleRangeFieldset) return;

    const isMaleSelected = vocalTypeMaleCheckbox.checked;
    const isFemaleSelected = vocalTypeFemaleCheckbox.checked;
    const maleRangeValue = maleRangeFieldset.querySelector<HTMLInputElement>('input[name="male-range"]:checked')?.value;
    const femaleRangeValue = femaleRangeFieldset.querySelector<HTMLInputElement>('input[name="female-range"]:checked')?.value;
    const artistRef = artistReferenceInput.value.trim();

    generateVocalistButton.disabled = true;
    vocalistOutputArea.innerHTML = `<p>Mr. GenR sedang mendesain vokalis...</p>`;

    currentAppState.vocalistModalIsMaleSelected = isMaleSelected;
    currentAppState.vocalistModalIsFemaleSelected = isFemaleSelected;
    currentAppState.vocalistModalMaleRange = maleRangeValue || null;
    currentAppState.vocalistModalFemaleRange = femaleRangeValue || null;
    currentAppState.vocalistModalArtistRef = artistRef;

    if (!artistRef) { 
        let selectedGender: 'Pria' | 'Wanita' | null = null;
        let selectedRangeValue: string | null = null;

        if (isMaleSelected && isFemaleSelected) {
            vocalistOutputArea.innerHTML = `<p style="color:var(--accent-red);">Pilih hanya satu jenis kelamin vokal (Pria atau Wanita) jika tidak menggunakan referensi artis.</p>`;
            generateVocalistButton.disabled = false; return;
        } else if (isMaleSelected) {
            selectedGender = 'Pria'; selectedRangeValue = maleRangeValue || null;
            if (!selectedRangeValue) { vocalistOutputArea.innerHTML = `<p style="color:var(--accent-red);">Pilih rentang nada untuk vokalis pria.</p>`; generateVocalistButton.disabled = false; return; }
        } else if (isFemaleSelected) {
            selectedGender = 'Wanita'; selectedRangeValue = femaleRangeValue || null;
            if (!selectedRangeValue) { vocalistOutputArea.innerHTML = `<p style="color:var(--accent-red);">Pilih rentang nada untuk vokalis wanita.</p>`; generateVocalistButton.disabled = false; return; }
        } else {
            vocalistOutputArea.innerHTML = `<p style="color:var(--accent-red);">Pilih minimal satu tipe vokal (Pria/Wanita).</p>`;
            generateVocalistButton.disabled = false; return;
        }
        
        const fullRangeLabel = getVocalRangeLabel(selectedRangeValue!, selectedGender);
        const outputText = `${selectedGender}, ${fullRangeLabel}.`;
        
        vocalistOutputArea.textContent = outputText;
        currentAppState.vocalistModalOutput = outputText;
        vocalistDesignCount = (currentAppState.vocalistDesignCount || 0) + 1;
        currentAppState.vocalistDesignCount = vocalistDesignCount;
        updateCardDisplay('vocals');
        addNotification("Karakter Vokalis Dibuat!", `Vokalis: ${outputText}`);
        generateVocalistButton.disabled = false;
        saveApplicationState();

    } else { 
        if (!API_KEY || !localStorage.getItem(LOGGED_IN_USER_KEY)) {
            vocalistOutputArea.innerHTML = `<p style="color:var(--accent-red);"><strong>Error:</strong> API Key tidak tersedia atau Anda belum login untuk fitur referensi artis.</p>`;
            generateVocalistButton.disabled = false; return;
        }

        const prompt = `Analisis artis bernama "${artistRef}". Tentukan jenis kelamin (Pria atau Wanita) dan rentang suara tipikalnya (misalnya Tenor, Sopran, Alto, Bariton, Bass, Mezzo-Soprano). Format jawaban HANYA sebagai berikut: "${artistRef}, [Jenis Kelamin Teridentifikasi], [Rentang Suara Teridentifikasi (label lengkap dengan deskripsi dalam kurung seperti 'Tenor (suara tinggi)' atau 'Alto (suara rendah)')]." Jangan sertakan komentar, sapaan, atau teks tambahan apapun selain format yang diminta. Contoh: "Adele, Wanita, Mezzo-Soprano (suara sedang)." atau "Bruno Mars, Pria, Tenor (suara tinggi)."`;
        
        try {
            const response: GenerateContentResponse = await ai.models.generateContent({ model: MODEL_NAME, contents: prompt });
            let aiResponseText = response.text.trim();
            if (!aiResponseText.toLowerCase().startsWith(artistRef.toLowerCase())) {
                const gender = isMaleSelected ? "Pria" : (isFemaleSelected ? "Wanita" : "Tidak ditentukan");
                const range = isMaleSelected && maleRangeValue ? getVocalRangeLabel(maleRangeValue, "Pria") : (isFemaleSelected && femaleRangeValue ? getVocalRangeLabel(femaleRangeValue, "Wanita") : "Tidak ditentukan");
                aiResponseText = `${artistRef}, ${gender}, ${range} (berdasarkan pilihan manual, AI tidak dapat memproses referensi artis secara spesifik saat ini).`;
                 addNotification("Info Tambahan Vokalis", "AI tidak dapat memproses referensi artis secara spesifik, hasil berdasarkan pilihan manual.");
            }

            vocalistOutputArea.textContent = aiResponseText;
            currentAppState.vocalistModalOutput = aiResponseText;
            vocalistDesignCount = (currentAppState.vocalistDesignCount || 0) + 1;
            currentAppState.vocalistDesignCount = vocalistDesignCount;
            updateCardDisplay('vocals');
            addNotification("Desain Vokalis Selesai!", `Karakteristik vokalis untuk "${artistRef}" telah berhasil didesain.`);
        } catch (error) {
            console.error("Error generating vocalist description with artist ref:", error);
            vocalistOutputArea.innerHTML = `<p style="color:var(--accent-red);"><strong>Oops!</strong> Gagal mendesain vokalis dengan referensi artis. Coba lagi nanti.</p>`;
            currentAppState.vocalistModalOutput = vocalistOutputArea.textContent; 
        } finally {
            generateVocalistButton.disabled = false;
            saveApplicationState();
        }
    }
}

// --- Saved Prompts Modal Functionality ---
function showSavedPromptsModal() {
    if (savedPromptsModalEl) {
        savedPromptsModalEl.classList.add('visible');
        savedPromptsModalEl.setAttribute('aria-hidden', 'false');
        renderSavedMusicTable(); 
        renderSavedInstrumentsTable(); 
        switchSavedPromptsTab('music', true); 
        musikKamuTabButtonEl?.focus();
    }
}

function hideSavedPromptsModal() {
    if (savedPromptsModalEl) {
        savedPromptsModalEl.classList.remove('visible');
        savedPromptsModalEl.setAttribute('aria-hidden', 'true');
    }
}

function renderSavedMusicTable(itemsToRender?: SavedMusicItem[]) {
    if (!savedMusicTableBodyEl || !noSavedMusicMessageEl) return;
    savedMusicTableBodyEl.innerHTML = '';
    const items = itemsToRender || currentAppState.savedMusicItems || [];

    if (items.length === 0) {
        noSavedMusicMessageEl.style.display = 'block';
        savedMusicTableBodyEl.style.display = 'none'; return;
    }
    
    noSavedMusicMessageEl.style.display = 'none';
    savedMusicTableBodyEl.style.display = '';

    items.forEach((item, index) => {
        const row = savedMusicTableBodyEl.insertRow();
        row.insertCell().textContent = (index + 1).toString();
        row.insertCell().textContent = item.title;
        row.insertCell().textContent = formatTimeAgo(new Date(item.timestamp));
        
        const actionCell = row.insertCell();
        actionCell.classList.add('actions-cell');
        const downloadButton = document.createElement('button');
        downloadButton.classList.add('table-action-button');
        downloadButton.textContent = 'Unduh';
        downloadButton.setAttribute('aria-label', `Download prompt untuk ${item.title}`);
        downloadButton.addEventListener('click', () => handleDownloadSavedItem('music', item.id, item.title, item.prompt));
        
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('table-action-button', 'delete');
        deleteButton.textContent = 'Hapus';
        deleteButton.setAttribute('aria-label', `Hapus prompt ${item.title}`);
        deleteButton.dataset.testid = `delete-music-${item.id}`;
        deleteButton.addEventListener('click', () => handleDeleteSavedItem('music', item.id, item.title));
        actionCell.append(downloadButton, deleteButton);
    });
}

function renderSavedInstrumentsTable(itemsToRender?: SavedInstrumentItem[]) {
    if (!savedInstrumentsTableBodyEl || !noSavedInstrumentsMessageEl) return;
    savedInstrumentsTableBodyEl.innerHTML = '';
    const items = itemsToRender || currentAppState.savedInstrumentItems || [];

    if (items.length === 0) {
        noSavedInstrumentsMessageEl.style.display = 'block';
        savedInstrumentsTableBodyEl.style.display = 'none'; return;
    }
    noSavedInstrumentsMessageEl.style.display = 'none';
    savedInstrumentsTableBodyEl.style.display = '';

    items.forEach((item, index) => {
        const row = savedInstrumentsTableBodyEl.insertRow();
        row.insertCell().textContent = (index + 1).toString();
        row.insertCell().textContent = item.title || "Tanpa Judul"; // Display title
        
        const descCell = row.insertCell(); // Description (shortened)
        const maxLength = 50; // Max length for short description
        descCell.textContent = item.description.length > maxLength ? item.description.substring(0, maxLength) + "..." : item.description;
        if (item.description.length > maxLength) {
            descCell.title = item.description; // Full description on hover
        }

        row.insertCell().textContent = formatTimeAgo(new Date(item.timestamp));
        
        const actionCell = row.insertCell();
        actionCell.classList.add('actions-cell');
        const downloadButton = document.createElement('button');
        downloadButton.classList.add('table-action-button');
        downloadButton.textContent = 'Unduh';
        downloadButton.setAttribute('aria-label', `Download deskripsi instrumen ${item.title || item.id}`);
        downloadButton.addEventListener('click', () => handleDownloadSavedItem('instrument', item.id, item.title || `Instrumen_${item.id}`, item.description));
        
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('table-action-button', 'delete');
        deleteButton.textContent = 'Hapus';
        deleteButton.setAttribute('aria-label', `Hapus deskripsi instrumen ${item.title || item.id}`);
        deleteButton.dataset.testid = `delete-instrument-${item.id}`;
        deleteButton.addEventListener('click', () => handleDeleteSavedItem('instrument', item.id, item.title || item.description.substring(0,30) + "..."));
        actionCell.append(downloadButton, deleteButton);
    });
}

function handleDownloadSavedItem(type: 'music' | 'instrument', id: string, title: string, content: string) {
    const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    addNotification("Konten Diunduh", `File "${filename}" telah diunduh.`);
}

function handleDeleteSavedItem(type: 'music' | 'instrument', id: string, name: string) {
    const itemName = type === 'music' ? `musik "${name}"` : `instrumen "${name}"`;
    if (window.confirm(`Apakah Anda yakin ingin menghapus ${itemName}? Tindakan ini tidak dapat diurungkan.`)) {
        if (type === 'music') {
            const updatedItems = currentAppState.savedMusicItems.filter(item => item.id !== id);
            currentAppState.savedMusicItems = updatedItems;
            renderSavedMusicTable(updatedItems);
        } else {
            const updatedItems = currentAppState.savedInstrumentItems.filter(item => item.id !== id);
            currentAppState.savedInstrumentItems = updatedItems;
            renderSavedInstrumentsTable(updatedItems);
        }
        saveApplicationState();
        addNotification("Item Dihapus", `${itemName.charAt(0).toUpperCase() + itemName.slice(1)} telah berhasil dihapus.`);
    }
}


function switchSavedPromptsTab(tabToActivate: 'music' | 'instruments', immediate = false) {
    if (!musikKamuTabButtonEl || !instrumenKamuTabButtonEl || !musikKamuTabContentEl || !instrumenKamuTabContentEl) return;

    const musicTabActive = tabToActivate === 'music';
    musikKamuTabButtonEl.classList.toggle('active', musicTabActive);
    musikKamuTabButtonEl.setAttribute('aria-selected', String(musicTabActive));
    instrumenKamuTabButtonEl.classList.toggle('active', !musicTabActive);
    instrumenKamuTabButtonEl.setAttribute('aria-selected', String(!musicTabActive));

    if (immediate) {
        musikKamuTabContentEl.style.transition = 'none';
        instrumenKamuTabContentEl.style.transition = 'none';
    } else {
        musikKamuTabContentEl.style.transition = ''; 
        instrumenKamuTabContentEl.style.transition = '';
    }

    if (musicTabActive) {
        musikKamuTabContentEl.classList.add('active');
        instrumenKamuTabContentEl.classList.remove('active');
    } else {
        instrumenKamuTabContentEl.classList.add('active');
        musikKamuTabContentEl.classList.remove('active');
    }
    
    if(immediate){
        void musikKamuTabContentEl.offsetWidth;
        void instrumenKamuTabContentEl.offsetWidth;
        musikKamuTabContentEl.style.transition = '';
        instrumenKamuTabContentEl.style.transition = '';
    }
}