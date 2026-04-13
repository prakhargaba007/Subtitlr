// Lead Types (aligned with backend Lead schema)
export interface LeadPlotDetails {
  area?: { value?: number; unit?: string };
  dimensions?: { length?: number; width?: number; unit?: string };
  bedrooms?: string;
  bathrooms?: string;
  parking?: string;
  additionalRequirements?: string;
  location?: { address?: string; locality?: string; pincode?: string };
  plotType?: "residential" | "commercial" | "industrial" | "agricultural" | "mixed-use";
  facing?: string;
  shape?: string;
}

export interface Lead {
  _id: string;
  name?: string;
  mobile: string;
  userId?: string;
  email?: string;
  state?: string;
  city?: string;
  plotDetails?: LeadPlotDetails;
  generatedLayoutUrl?: string;
  layouts?: Array<{ layoutUrl: string; createdAt?: string; houseDetails?: unknown }>;
  isVerified?: boolean;
  source: "website" | "referral" | "social_media" | "linkedin" | "phone_call" | "email" | "other";
  sourceDetails?: string;
  receivedDate?: string;
  status: "new" | "contacted" | "qualified" | "proposal_sent" | "negotiation" | "won" | "lost" | "on_hold";
  followUps?: FollowUp[];
  conversations?: Conversation[];
  documents?: LeadDocument[];
  notes?: string;
  tags?: string[];
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FollowUp {
  _id: string;
  scheduledDate: string;
  completedDate?: string;
  notes?: string;
  status: "scheduled" | "completed" | "missed" | "rescheduled";
}

export interface Conversation {
  _id: string;
  date: string;
  notes?: string;
  contactMethod?: "phone" | "email" | "in_person" | "video_call" | "whatsapp" | "other";
  outcome?: string;
}

export interface LeadDocument {
  _id?: string;
  // After populate, fileId will be the File document; when sending updates we only send {_id, fileId}
  fileId?: any;
  name?: string;
  filePath?: string;
  uploadDate?: string;
}

export interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  proposal_sent: number;
  negotiation: number;
  won: number;
  lost: number;
  on_hold: number;
  conversionRate: string;
  sourceDistribution: {
    source: string;
    count: number;
  }[];
}

/** Query params for GET /api/leads (getAllLeads) */
export interface LeadFilterParams {
  status?: string;
  source?: string;
  isVerified?: boolean;
  city?: string;
  plotType?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: "asc" | "desc";
  search?: string;
}

// Project types (aligned with backend Project schema)
export interface ProjectPlotDetails {
  area?: { value?: number; unit?: string };
  dimensions?: { length?: number; width?: number; unit?: string };
  bedrooms?: string;
  bathrooms?: string;
  parking?: string;
  additionalRequirements?: string;
  location?: { address?: string; locality?: string; pincode?: string };
  plotType?: string;
  facing?: string;
  shape?: string;
}

export interface ProjectDocument {
  _id?: string;
  fileId?: any;
  fileUrl?: string;
  uploadDate?: string;
}

export interface Project {
  _id: string;
  projectName: string;
  clientId?: any;
  engineerIds?: any[];
  startDate: string;
  expectedEndDate: string;
  status: "active" | "delayed" | "completed";
  name?: string;
  mobile?: string;
  userId?: string;
  email?: string;
  state?: string;
  city?: string;
  plotDetails?: ProjectPlotDetails;
  generatedLayoutUrl?: string;
  layouts?: Array<{ layoutUrl: string; createdAt?: string; houseDetails?: unknown }>;
  timelineId?: any;
  documents?: ProjectDocument[];
  notes?: string;
  tags?: string[];
  leadStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Timeline types (aligned with backend Timeline schema)
export interface PhaseMaterial {
  _id?: string;
  materialId?: string;
  name: string;
  quantity?: number;
  unit?: string;
  unitPrice: number;
  amount?: number;
  notes?: string;
}

/** Single payment entry (partial/full) for client collection or contractor payment */
export interface PhasePaymentEntry {
  amount: number;
  paidAt?: string;
  paidBy?: string | EngineerRef;
  notes?: string;
}

export interface PhasePaymentFromClient {
  amount?: number;
  payments?: PhasePaymentEntry[];
  collected?: boolean;
  collectedAt?: string;
  collectedBy?: string | EngineerRef;
  notes?: string;
}

export interface PhasePaymentToContractor {
  amount?: number;
  contractorId?: string | EngineerRef;
  payments?: PhasePaymentEntry[];
  paid?: boolean;
  paidAt?: string;
  paidBy?: string | EngineerRef;
  notes?: string;
}

export interface PhasePayment {
  fromClient?: PhasePaymentFromClient;
  toContractor?: PhasePaymentToContractor;
}

export interface TimelinePhase {
  _id: string;
  name: string;
  description?: string;
  plannedStart: string;
  plannedEnd: string;
  actualEnd?: string;
  status: "pending" | "in_progress" | "completed" | "delayed";
  materialsUsed?: PhaseMaterial[];
  notes?: string;
  details?: Record<string, unknown>;
  payment?: PhasePayment;
}

export interface Timeline {
  _id: string;
  projectId: string | { _id: string; projectName?: string };
  phases: TimelinePhase[];
  generatedBy: "AI" | "admin";
  overallProgress?: "on_track" | "delayed" | "ahead";
  createdAt?: string;
  updatedAt?: string;
}

// Material types (aligned with backend Material schema)
export interface Material {
  _id: string;
  name: string;
  unit?: string;
  currentPrice: number;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Engineer (User with role engineer) - populated fields from ref
export interface EngineerRef {
  _id: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
}

// Daily visit (scheduled slot or completed visit with images, notes, timeline progress)
export interface DailyVisit {
  _id: string;
  projectId: string | { _id: string; projectName?: string };
  engineerId: string | EngineerRef;
  date: string;
  status?: "scheduled" | "completed" | "missed" | "rescheduled" | "cancelled";
  notes?: string;
  timelineProgress?: "on_track" | "delayed" | "ahead";
  progressNotes?: string;
  images?: Array<{ fileId?: string; location?: { coordinates: number[] }; caption?: string }>;
  createdAt?: string;
  updatedAt?: string;
}
