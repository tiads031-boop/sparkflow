import { registerPlugin } from '@capacitor/core';
import type { SchoolImportData } from '../utils/schoolImport';
export const SchoolImport = registerPlugin<{ open(options: { adapter: string; url: string }): Promise<SchoolImportData> }>('SchoolImport');
export interface AutomationStatus { policyAccess: boolean; exactAlarms: boolean; error: string }
export const CourseAutomation = registerPlugin<{
  status(): Promise<AutomationStatus>;
  openSettings(options: { kind: 'policy' | 'exact' }): Promise<void>;
  sync(options: { mode: 'off' | 'dnd' | 'silent'; windows: { start: number; end: number }[] }): Promise<void>;
}>('CourseAutomation');
