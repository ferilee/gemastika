export type MemberRole = "admin" | "pengurus" | "anggota";
export type MembershipStatus = "pending" | "approved" | "rejected";

export type Member = {
  id: number;
  name: string;
  email: string;
  school: string;
  wa: string;
  telegram: string;
  photoUrl: string;
  profileUrl: string;
  role: MemberRole;
  roles: MemberRole[];
  membershipStatus: MembershipStatus;
  approvedAt: string;
  newMemberBadge: number;
  newMemberBadgeSeen: number;
  xp: number;
};

export type Agenda = {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  description: string;
};

export type News = {
  id: number;
  title: string;
  category: string;
  author: string;
  date: string;
  imageUrl: string;
  summary: string;
  content: string;
  documentUrl: string;
  createdByEmail: string;
  publishStatus: "pending" | "approved" | "rejected";
  reviewedBy: string;
  reviewedAt: string;
};

export type Portfolio = {
  id: number;
  teacherName: string;
  school: string;
  title: string;
  description: string;
  link: string;
  photoUrl: string;
  createdByEmail: string;
  publishStatus: "pending" | "approved" | "rejected";
  reviewedBy: string;
  reviewedAt: string;
};

export type LearningResourceCategory = "RPP / Modul Ajar" | "Materi Pembelajaran" | "Asesmen Interaktif" | "LKPD Interaktif" | "Bank Soal" | "Media Pembelajaran" | "Praktik Baik" | "Perangkat Administrasi";

export type LearningResource = {
  id: number;
  title: string;
  category: LearningResourceCategory;
  description: string;
  phase: string;
  grade: string;
  topic: string;
  semester: string;
  curriculum: string;
  sourceType: "file" | "link";
  resourceUrl: string;
  fileName: string;
  thumbnailUrl: string;
  tags: string;
  storageKey: string;
  thumbnailStorageKey: string;
  viewCount: number;
  downloadCount: number;
  createdByEmail: string;
  publishStatus: "pending" | "approved" | "rejected";
  reviewedBy: string;
  reviewedAt: string;
  createdAt: string;
};

export type LearningResourceVersion = { id: number; resourceId: number; version: number; resourceUrl: string; fileName: string; storageKey: string; changeNote: string; createdByEmail: string; createdAt: string };

export type BoardMember = {
  id: number;
  memberId: number;
  name: string;
  title: string;
  contact: string;
  sortOrder: number;
  createdAt: string;
};

export type HomeQuickLink = {
  id: number;
  title: string;
  subtitle: string;
  href: string;
  sortOrder: number;
};

export type HomeQuote = {
  text: string;
  author: string;
};

export type HomeContent = {
  quickLinks: HomeQuickLink[];
  quote: HomeQuote;
};

export type CommentTargetType = "news" | "portfolio" | "learning_resource";

export type CommentItem = {
  id: number;
  targetType: CommentTargetType;
  targetId: number;
  parentId: number | null;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: string;
};

export type ReactionItem = {
  targetId: number;
  reaction: string;
  count: number;
  reacted: boolean;
};
