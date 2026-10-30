export interface LanguageDefinition {
    code: string;
    name: string;
    nativeName: string;
    script: string;
}
export declare const PROJECT_LANGUAGES: LanguageDefinition[];
export interface MultilingualBroadcastInput {
    sourceText: string;
    sourceLanguage?: string;
    targetLanguages?: string[];
    districtId?: string;
}
export interface TranslatedItem {
    languageCode: string;
    languageName: string;
    translatedText: string;
    isReviewedOfficial: boolean;
    status: 'VERIFIED_READY' | 'SYNTHETIC_DRAFT';
}
export interface MultilingualBroadcastResult {
    originalText: string;
    sourceLanguage: string;
    translations: TranslatedItem[];
    retainedOfficialSource: string;
    complianceNotice: string;
}
export declare class TranslationService {
    /**
     * Translate an emergency broadcast into all 12 project languages,
     * guaranteeing that the verified official English source is retained alongside.
     */
    translateBroadcast(input: MultilingualBroadcastInput): MultilingualBroadcastResult;
}
export declare const translationService: TranslationService;
