import type { LegacyPattern, Pattern, StoredPattern } from "./types.js";
export declare const DEFAULT_VARIABLE_REFERENCE_PATTERN: string[];
export declare function parsePattern(text: string, variableReferencePattern: string[]): Pattern;
export declare function serializePattern(pattern: StoredPattern, variableReferencePattern: string[]): string;
export declare function parseLegacyPattern(text: string, variableReferencePattern: string[]): LegacyPattern;
export declare function serializeLegacyPattern(pattern: LegacyPattern, variableReferencePattern: string[]): string;
