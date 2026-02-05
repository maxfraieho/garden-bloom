// i18n type definitions

export type Locale = 'uk' | 'en' | 'fr' | 'de' | 'it';

export interface Translations {
  // Sidebar
  sidebar: {
    digitalGarden: string;
    home: string;
    graph: string;
    chat: string;
    toggleNavigation: string;
    fileStructure: string;
  };
  
  // Search
  search: {
    placeholder: string;
    noResults: string;
    clearSearch: string;
  };
  
  // Graph page
  graph: {
    title: string;
    description: string;
    empty: string;
    zoomIn: string;
    zoomOut: string;
    reset: string;
    dragToPan: string;
    notesCount: string;
    connectionsCount: string;
  };
  
  // Local graph legend
  localGraph: {
    current: string;
    linksHere: string;
    linkedFromHere: string;
  };
  
  // Backlinks
  backlinks: {
    linkedFrom: string;
  };
  
  // Tags
  tags: {
    allTags: string;
    tagsInGarden: string;
    tagInGarden: string;
    noTagsYet: string;
    allNotes: string;
    notesTagged: string;
    noteTagged: string;
    noNotesWithTag: string;
    viewAllTags: string;
    updated: string;
  };
  
  // Index / Home
  index: {
    digitalGarden: string;
    description: string;
    allNotes: string;
    notesInGarden: string;
    browseTags: string;
    knowledgeMap: string;
    exploreGraph: string;
    viewGraph: string;
    recentNotes: string;
    connectedThoughts: string;
    connections: string;
    lastUpdated: string;
  };
  
  // Not found
  notFound: {
    title: string;
    message: string;
    returnHome: string;
  };
  
  // Tag page
  tagPage: {
    noTagSpecified: string;
    returnToGarden: string;
  };
  
  // Common
  common: {
    note: string;
    notes: string;
    tag: string;
    tags: string;
  };
  
  // Export Modal
  export: {
    title: string;
    description: string;
    settingsTab: string;
    previewTab: string;
    folderSelection: string;
    selectAll: string;
    folders: string;
    noFolders: string;
    formatSelection: string;
    markdownFormat: string;
    markdownDescription: string;
    jsonFormat: string;
    jsonDescription: string;
    jsonlFormat: string;
    jsonlDescription: string;
    additionalOptions: string;
    includeMetadata: string;
    includeContent: string;
    willExport: string;
    notesFrom: string;
    approximateSize: string;
    cancel: string;
    copy: string;
    copied: string;
    copyToClipboard: string;
    download: string;
    selectAtLeastOne: string;
    exportSuccess: string;
    copySuccess: string;
    copyError: string;
    selectFoldersForExport: string;
    truncatedPreview: string;
  };
  
  // Access Zones
  zones: {
    title: string;
    description: string;
    createNew: string;
    createFirst: string;
    createTitle: string;
    createDescription: string;
    noZones: string;
    zoneName: string;
    zoneNamePlaceholder: string;
    zoneDescription: string;
    zoneDescriptionPlaceholder: string;
    folderSelection: string;
    clearAll: string;
    accessType: string;
    webOnly: string;
    webOnlyDesc: string;
    mcpOnly: string;
    mcpOnlyDesc: string;
    webAndMcp: string;
    webAndMcpDesc: string;
    timeToLive: string;
    custom: string;
    customMinutes: string;
    minutes: string;
    creating: string;
    create: string;
    revoke: string;
    revokeConfirmTitle: string;
    revokeConfirmDescription: string;
    copied: string;
    urlCopied: string;
    qrTitle: string;
    accessUrl: string;
    downloadQR: string;
    qrDownloaded: string;
    qrDownloadError: string;
  };
  
  // Zone View (Guest Access)
  zoneView: {
    loading: string;
    expired: string;
    expiredDescription: string;
    accessDenied: string;
    invalidZone: string;
    sharedAccess: string;
    availableNotes: string;
    selectNote: string;
    selectNoteDescription: string;
    readOnlyNotice: string;
    selectFoldersForPreview: string;
    noNotesInFolders: string;
    notesPreview: string;
  };
  
  // Access Gate
  accessGate: {
    title: string;
    description: string;
    placeholder: string;
    unlock: string;
    hint: string;
  };
 
   // Editor
   editor: {
     newNote: string;
     editNote: string;
     placeholder: string;
     titlePlaceholder: string;
     save: string;
     cancel: string;
     saving: string;
     saved: string;
     error: string;
     draftFound: string;
     draftRestored: string;
     restoreDraft: string;
     discardDraft: string;
     titleRequired: string;
     copiedToClipboard: string;
     preview: string;
     edit: string;
     addTag: string;
     unsavedChanges: string;
     focusMode: string;
     splitView: string;
     toolbar: {
       bold: string;
       italic: string;
       heading1: string;
       heading2: string;
       heading3: string;
       link: string;
       wikilink: string;
       code: string;
       quote: string;
       bulletList: string;
       numberedList: string;
       table: string;
       strikethrough: string;
       hr: string;
       codeBlock: string;
     };
   };
}

export interface LocaleInfo {
  code: Locale;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LOCALES: LocaleInfo[] = [
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
];

export const DEFAULT_LOCALE: Locale = 'uk';
