
export type AnnouncementType = 'text' | 'audio' | 'anthem' | 'vande';
export type TargetMode = 'WHOLE_SCHOOL' | 'SELECTED_GRADE';

export interface Announcement {
  id?: string;
  type: AnnouncementType;
  content: string; // text or base64 audio
  target_mode: TargetMode;
  grade?: string; // nullable
  divisions?: string[]; // array of strings
  created_at?: string;
  created_by?: string;
}

export interface UserProfile {
  id: string;
  email: string;
}

export interface ReceiverConfig {
  grade: string;
  division: string;
}
