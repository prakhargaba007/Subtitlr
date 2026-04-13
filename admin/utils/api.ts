import axiosInstance from "@/utils/axios";

// Lead API Functions
export const getLeads = async (params: any) => {
  const queryParams = new URLSearchParams();

  // Add all params to query string
  Object.keys(params).forEach((key) => {
    if (
      params[key] !== undefined &&
      params[key] !== null &&
      params[key] !== ""
    ) {
      queryParams.append(key, params[key]);
    }
  });

  const response = await axiosInstance.get(`/api/leads?${queryParams.toString()}`);
  return response.data;
};

export const getLead = async (id: string) => {
  const response = await axiosInstance.get(`/api/leads/${id}`);
  // console.log("response", response);
  return response.data;
};

/** Creates a lead via layout-request API (no OTP). Payload: { userDetails, houseDetails, source?, sourceDetails?, receivedDate? } */
export const createLead = async (data: Record<string, unknown>) => {
  const response = await axiosInstance.post("/api/leads/layout-request", data);
  return response.data;
};

export const updateLead = async (
  id: string,
  data: Record<string, unknown>
) => {
  const response = await axiosInstance.put(`/api/leads/${id}`, data);
  return response.data;
};

export const deleteLead = async (id: string) => {
  const response = await axiosInstance.delete(`/api/leads/${id}`);
  return response.data;
};

export const addFollowUp = async (leadId: string, data: any) => {
  const response = await axiosInstance.post(`/api/leads/${leadId}/follow-up`, data);
  return response.data;
};

export const updateFollowUp = async (
  leadId: string,
  followUpId: string,
  data: any
) => {
  const response = await axiosInstance.put(
    `/api/leads/${leadId}/follow-up/${followUpId}`,
    data
  );
  return response.data;
};

export const addConversation = async (leadId: string, data: any) => {
  const response = await axiosInstance.post(
    `/api/leads/${leadId}/conversation`,
    data
  );
  return response.data;
};

export const convertToStudent = async (leadId: string) => {
  const response = await axiosInstance.post(`/api/leads/${leadId}/convert`);
  return response.data;
};

export const convertLeadToProject = async (
  leadId: string,
  data?: { clientId?: string; projectName?: string; startDate?: string; expectedEndDate?: string }
) => {
  const response = await axiosInstance.post(
    `/api/leads/${leadId}/convert-to-project`,
    data || {}
  );
  return response.data;
};

export const getUpcomingFollowUps = async (params: any = { days: 7 }) => {
  const queryParams = new URLSearchParams();

  // Add all params to query string
  Object.keys(params).forEach((key) => {
    if (
      params[key] !== undefined &&
      params[key] !== null &&
      params[key] !== ""
    ) {
      queryParams.append(key, params[key].toString());
    }
  });

  const response = await axiosInstance.get(
    `/api/leads/upcoming-followups?${queryParams.toString()}`
  );
  return response.data;
};

export const getLeadStats = async (params: any = {}) => {
  const queryParams = new URLSearchParams();

  // Add all params to query string
  Object.keys(params).forEach((key) => {
    if (
      params[key] !== undefined &&
      params[key] !== null &&
      params[key] !== ""
    ) {
      queryParams.append(key, params[key]);
    }
  });

  const response = await axiosInstance.get(
    `/api/leads/stats?${queryParams.toString()}`
  );
  return response.data;
};

// Dashboard API Functions
export const getDashboardStats = async () => {
  const response = await axiosInstance.get("/api/dashboard/stats");
  return response.data;
};

export const getTotalUsers = async () => {
  const response = await axiosInstance.get("/api/dashboard/stats/users");
  return response.data;
};

export const getTotalViews = async () => {
  const response = await axiosInstance.get("/api/dashboard/stats/views");
  return response.data;
};

export const getTotalVideos = async () => {
  const response = await axiosInstance.get("/api/dashboard/stats/videos");
  return response.data;
};

export const getCoursesSold = async () => {
  const response = await axiosInstance.get("/api/dashboard/stats/courses-sold");
  return response.data;
};

export const getTimeBasedStats = async (period: number = 30) => {
  const response = await axiosInstance.get(
    `/api/dashboard/stats/time-based?period=${period}`
  );
  return response.data;
};

// Project API Functions
export const getProjects = async (params: Record<string, string | number> = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      queryParams.append(key, String(params[key]));
    }
  });
  const response = await axiosInstance.get(`/api/projects?${queryParams.toString()}`);
  return response.data;
};

export const getProject = async (id: string) => {
  const response = await axiosInstance.get(`/api/projects/${id}`);
  return response.data;
};

export const createProject = async (data: Record<string, unknown>) => {
  const response = await axiosInstance.post("/api/projects", data);
  return response.data;
};

export const updateProject = async (id: string, data: Record<string, unknown>) => {
  const response = await axiosInstance.patch(`/api/projects/${id}`, data);
  return response.data;
};

export const deleteProject = async (id: string) => {
  const response = await axiosInstance.delete(`/api/projects/${id}`);
  return response.data;
};

// User/Engineer API
export const getUsersByRole = async (role: string) => {
  const response = await axiosInstance.get(`/api/user/role/${role}`);
  return response.data;
};

// Daily Visits API
export const getDailyVisitsByProject = async (
  projectId: string,
  params?: { page?: number; limit?: number; from?: string; to?: string; status?: string }
) => {
  const queryParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, String(value));
      }
    });
  }
  const qs = queryParams.toString();
  const response = await axiosInstance.get(
    `/api/daily-visits/project/${projectId}${qs ? `?${qs}` : ""}`
  );
  return response.data;
};

export const getDailyVisitById = async (visitId: string) => {
  const response = await axiosInstance.get(`/api/daily-visits/${visitId}`);
  return response.data;
};

/** Create a daily visit (scheduled slot with no images, or completed visit with images + timelineProgress). */
export const createDailyVisit = async (data: {
  projectId: string;
  engineerId: string;
  date: string;
  notes?: string;
}) => {
  const response = await axiosInstance.post("/api/daily-visits", data);
  return response.data;
};

/** Update a daily visit (e.g. set status to missed/rescheduled/cancelled, or add images/timelineProgress). */
export const updateDailyVisit = async (
  visitId: string,
  data: { status?: string; notes?: string; progressNotes?: string; timelineProgress?: string; images?: unknown[] }
) => {
  const response = await axiosInstance.patch(`/api/daily-visits/${visitId}`, data);
  return response.data;
};

// Timeline API Functions
export const getTimelineByProject = async (projectId: string) => {
  const response = await axiosInstance.get(`/api/timelines/project/${projectId}`);
  return response.data;
};

export const createTimeline = async (data: { projectId: string; generatedBy: "AI" | "admin"; phases?: any[] }) => {
  const response = await axiosInstance.post("/api/timelines", data);
  return response.data;
};

export const addPhaseToTimeline = async (
  timelineId: string,
  data: {
    name: string;
    description?: string;
    plannedStart: string;
    plannedEnd: string;
    payment?: { fromClient?: { amount?: number }; toContractor?: { amount?: number; contractorId?: string } };
  }
) => {
  const response = await axiosInstance.post(`/api/timelines/${timelineId}/phases`, data);
  return response.data;
};

export const updatePhaseInTimeline = async (
  timelineId: string,
  phaseId: string,
  data: {
    name?: string;
    description?: string;
    plannedStart?: string;
    plannedEnd?: string;
    actualEnd?: string;
    status?: string;
    notes?: string;
    materialsUsed?: Array<{ _id?: string; materialId?: string; name: string; quantity?: number; unit?: string; unitPrice: number; amount?: number; notes?: string }>;
    payment?: {
      fromClient?: { amount?: number; notes?: string; collected?: boolean; payments?: Array<{ amount: number; paidAt?: string; paidBy?: string; notes?: string }> };
      toContractor?: { amount?: number; contractorId?: string; notes?: string; paid?: boolean; payments?: Array<{ amount: number; paidAt?: string; paidBy?: string; notes?: string }> };
    };
  }
) => {
  const response = await axiosInstance.patch(
    `/api/timelines/${timelineId}/phases/${phaseId}`,
    data
  );
  return response.data;
};

/** Record a partial/full amount collected from client for a phase */
export const recordCollectionFromClient = async (
  timelineId: string,
  phaseId: string,
  data: { amount: number; notes?: string }
) => {
  const response = await axiosInstance.post(
    `/api/timelines/${timelineId}/phases/${phaseId}/collect`,
    data
  );
  return response.data;
};

/** Record a partial/full amount paid to contractor for a phase */
export const recordPaymentToContractor = async (
  timelineId: string,
  phaseId: string,
  data: { amount: number; notes?: string }
) => {
  const response = await axiosInstance.post(
    `/api/timelines/${timelineId}/phases/${phaseId}/pay`,
    data
  );
  return response.data;
};

export const updateTimeline = async (timelineId: string, data: { overallProgress?: string }) => {
  const response = await axiosInstance.patch(`/api/timelines/${timelineId}`, data);
  return response.data;
};

export const addMaterialToPhase = async (
  timelineId: string,
  phaseId: string,
  data: { materialId?: string; name?: string; quantity?: number; unit?: string; unitPrice?: number; notes?: string }
) => {
  const response = await axiosInstance.post(
    `/api/timelines/${timelineId}/phases/${phaseId}/materials`,
    data
  );
  return response.data;
};

// Material API Functions
export interface MaterialFilterParams {
  page?: number;
  limit?: number;
  sortBy?: "name" | "currentPrice" | "createdAt";
  order?: "asc" | "desc";
}

export interface MaterialPayload {
  name: string;
  currentPrice: number;
  unit?: string;
  description?: string;
}

export const getMaterials = async (params: MaterialFilterParams = {}) => {
  const queryParams = new URLSearchParams();
  Object.keys(params).forEach((key) => {
    const value = (params as any)[key];
    if (value !== undefined && value !== null && value !== "") {
      queryParams.append(key, String(value));
    }
  });

  const response = await axiosInstance.get(
    `/api/materials?${queryParams.toString()}`
  );
  return response.data;
};

export const getMaterial = async (id: string) => {
  const response = await axiosInstance.get(`/api/materials/${id}`);
  return response.data;
};

export const createMaterial = async (data: MaterialPayload) => {
  const response = await axiosInstance.post("/api/materials", data);
  return response.data;
};

export const updateMaterial = async (id: string, data: Partial<MaterialPayload>) => {
  const response = await axiosInstance.patch(`/api/materials/${id}`, data);
  return response.data;
};

export const deleteMaterial = async (id: string) => {
  const response = await axiosInstance.delete(`/api/materials/${id}`);
  return response.data;
};
