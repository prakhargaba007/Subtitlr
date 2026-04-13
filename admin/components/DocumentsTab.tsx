"use client";

import React, { useState } from "react";
import {
  Stack,
  Title,
  Group,
  Button,
  Text,
  Card,
  ActionIcon,
  Modal,
  TextInput,
  FileInput,
  Select,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { FileText, Plus, Eye, Download } from "lucide-react";
import { updateLead, updateProject } from "@/utils/api";
import axiosInstance from "@/utils/axios";
import { FileDetailsModal, FileDetailsData } from "@/FileDetailsModal";
import { LeadDocument } from "@/types";
import { ProjectDocument } from "@/types";

export type DocumentsTabEntityType = "lead" | "project";

export interface DocumentItem {
  _id?: string;
  fileId?: any;
  fileUrl?: string;
  filePath?: string;
  name?: string;
  uploadDate?: string;
}

export interface DocumentsTabProps {
  documents: DocumentItem[] | undefined;
  entityType: DocumentsTabEntityType;
  entityId: string;
  onRefresh: () => void | Promise<void>;
  /** Base URL for file links (e.g. S3 or backend). Trailing slash is stripped. */
  backendUrl?: string;
}

const DOCUMENT_TITLE_OPTIONS = [
  "Layout Plan",
  "Quotation",
  "Agreement",
  "NOC / Approvals",
  "Aadhar Card",
  "PAN Card",
  "Others",
] as const;

const OTHERS_VALUE = "Others";

function getDisplayName(document: DocumentItem): string {
  const file = document.fileId;
  if (document.name) return document.name;
  if (file?.title) return file.title;
  if (file?.originalName) return file.originalName;
  return "Document";
}

function getFilePath(document: DocumentItem): string | undefined {
  return document.filePath ?? document.fileUrl ?? document.fileId?.filePath;
}

function getUploadedOn(document: DocumentItem): string | undefined {
  return document.uploadDate ?? document.fileId?.createdAt ?? document.fileId?.updatedAt;
}

function buildFileDetails(document: DocumentItem, displayName: string): FileDetailsData {
  const file: any = document.fileId;
  const fileId = typeof file === "string" ? file : file?._id;
  return {
    _id: fileId,
    title: (typeof file === "object" && file?.title) || displayName,
    originalName: (typeof file === "object" && file?.originalName) || displayName,
    fileName:
      (typeof file === "object" && (file?.fileName || file?.originalName)) || displayName,
    filePath:
      (typeof file === "object" && file?.filePath) || document.filePath || document.fileUrl,
    fileSize: (typeof file === "object" && file?.fileSize) || 0,
    mimeType: (typeof file === "object" && file?.mimeType) || "application/pdf",
    uploadedBy: typeof file === "object" ? file?.uploadedBy : undefined,
    createdAt:
      (typeof file === "object" && file?.createdAt) || document.uploadDate || new Date().toISOString(),
    updatedAt:
      (typeof file === "object" && (file?.updatedAt || file?.createdAt)) ||
      document.uploadDate ||
      new Date().toISOString(),
  };
}

export function DocumentsTab({
  documents,
  entityType,
  entityId,
  onRefresh,
  backendUrl: backendUrlProp,
}: DocumentsTabProps) {
  const backendUrl =
    backendUrlProp?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_S3_BASE_URL?.replace(/\/$/, "") ||
    "";

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedTitleOption, setSelectedTitleOption] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileDetailsData | null>(null);

  const list = documents ?? [];

  const handleUpload = async () => {
    if (!uploadFile) {
      notifications.show({
        title: "Validation",
        message: "Please select a file to upload",
        color: "red",
      });
      return;
    }
    const title =
      selectedTitleOption === OTHERS_VALUE ? customTitle.trim() : (selectedTitleOption ?? "").trim();
    if (!title) {
      notifications.show({
        title: "Validation",
        message:
          selectedTitleOption === OTHERS_VALUE
            ? "Please enter a document title"
            : "Please select or enter a document title",
        color: "red",
      });
      return;
    }

    const uploadType =
      entityType === "lead" ? "lead_document" : "project_document";

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", title);
      formData.append("uploadType", uploadType);

      const uploadResponse = await axiosInstance.post(
        "/api/files/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      const uploaded = uploadResponse.data?.data;
      if (!uploaded?._id || !uploaded?.filePath) {
        throw new Error("Invalid file upload response");
      }

      if (entityType === "lead") {
        const existing = (list as LeadDocument[]).map((d) => ({
          fileId: (d.fileId as any)?._id != null ? (d.fileId as any)._id : d.fileId,
        }));
        await updateLead(entityId, {
          documents: [...existing, { fileId: uploaded._id }],
        });
      } else {
        const existing = (list as ProjectDocument[]).map((d) => ({
          fileId: (d.fileId as any)?._id != null ? (d.fileId as any)._id : d.fileId,
        }));
        await updateProject(entityId, {
          documents: [...existing, { fileId: uploaded._id }],
        });
      }

      notifications.show({
        title: "Success",
        message:
          entityType === "lead"
            ? "Document uploaded and linked to lead"
            : "Document uploaded and linked to project",
        color: "green",
      });

      setUploadModalOpen(false);
      setUploadFile(null);
      setSelectedTitleOption(null);
      setCustomTitle("");
      await onRefresh();
    } catch (error: any) {
      console.error("Document upload error", error);
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.message ||
          error.message ||
          "Failed to upload document",
        color: "red",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={4}>Documents</Title>
          <Button
            leftSection={<Plus size={16} />}
            size="sm"
            onClick={() => setUploadModalOpen(true)}
          >
            Upload Document
          </Button>
        </Group>

        {list.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No documents uploaded yet.
          </Text>
        ) : (
          <Stack gap="md">
            {list.map((document) => {
              const displayName = getDisplayName(document);
              const filePath = getFilePath(document);
              const fileUrl =
                filePath && backendUrl
                  ? `${backendUrl}/${filePath}`
                  : filePath
                    ? filePath
                    : "#";
              const uploadedOn = getUploadedOn(document);

              return (
                <Card
                  key={document._id ?? (document.fileId as any)?._id}
                  withBorder
                  p="sm"
                >
                  <Group justify="apart">
                    <Group>
                      <FileText size={16} />
                      <Text>{displayName}</Text>
                    </Group>
                    {fileUrl !== "#" && (
                      <Group gap="xs">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => {
                            setSelectedFile(
                              buildFileDetails(document, displayName)
                            );
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          component="a"
                          href={fileUrl}
                          download
                        >
                          <Download size={16} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" mt="xs">
                    Uploaded on:{" "}
                    {uploadedOn
                      ? new Date(uploadedOn).toLocaleDateString()
                      : "—"}
                  </Text>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>

      <Modal
        opened={uploadModalOpen}
        onClose={() => {
          if (!uploading) {
            setUploadModalOpen(false);
            setUploadFile(null);
            setSelectedTitleOption(null);
            setCustomTitle("");
          }
        }}
        title="Upload Document"
        centered
      >
        <Stack>
          <Select
            label="Document Title"
            placeholder="Select or choose Others to type"
            data={[...DOCUMENT_TITLE_OPTIONS]}
            value={selectedTitleOption}
            onChange={(value) => setSelectedTitleOption(value)}
            allowDeselect={false}
            required
          />
          {selectedTitleOption === OTHERS_VALUE && (
            <TextInput
              label="Custom Document Title"
              placeholder="Enter a title for this document"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.currentTarget.value)}
              required
            />
          )}
          <FileInput
            label="Select File"
            placeholder="Choose a file to upload"
            value={uploadFile}
            onChange={setUploadFile}
            accept="image/*,application/pdf"
            required
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="outline"
              onClick={() => {
                if (uploading) return;
                setUploadModalOpen(false);
                setUploadFile(null);
                setSelectedTitleOption(null);
                setCustomTitle("");
              }}
            >
              Cancel
            </Button>
            <Button loading={uploading} onClick={handleUpload}>
              Upload
            </Button>
          </Group>
        </Stack>
      </Modal>

      <FileDetailsModal
        opened={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedFile(null);
        }}
        file={selectedFile}
      />
    </>
  );
}
