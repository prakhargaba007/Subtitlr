"use client";

import React from "react";
import { Modal, Stack, Text, Group, Button } from "@mantine/core";
import { IconFile } from "@tabler/icons-react";

export interface FileDetailsData {
  _id?: string;
  title?: string;
  originalName?: string;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: {
    _id?: string;
    name?: string;
    userName?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface FileDetailsModalProps {
  opened: boolean;
  onClose: () => void;
  file: FileDetailsData | null;
  title?: string;
  formatFileSize?: (bytes: number) => string;
}

export function FileDetailsModal({
  opened,
  onClose,
  file,
  title = "File Details",
  formatFileSize,
}: FileDetailsModalProps) {
  const formatSize = (bytes: number | undefined) => {
    if (bytes == null) return "";
    if (formatFileSize) return formatFileSize(bytes);
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const safeDate = (value?: string) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg" centered>
      <Stack>
        {file && (
          <>
            {/* File Preview Section */}
            <div>
              <Text size="sm" fw={500} mb="xs">
                File Preview
              </Text>
              <div
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "16px",
                  backgroundColor: "#f8f9fa",
                  minHeight: "200px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {file?.mimeType?.startsWith("image/") ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${file.filePath}`}
                    alt={file?.originalName}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "300px",
                      objectFit: "contain",
                      borderRadius: "4px",
                    }}
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = "none";
                      const fallback =
                        target.parentElement?.querySelector(
                          ".fallback-content"
                        );
                      if (fallback) {
                        (fallback as HTMLElement).style.display = "flex";
                      }
                    }}
                  />
                ) : file?.mimeType?.startsWith("video/") ? (
                  <video
                    controls
                    style={{
                      maxWidth: "100%",
                      maxHeight: "300px",
                      borderRadius: "4px",
                    }}
                  >
                    <source
                      src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${file.filePath}`}
                      type={file.mimeType}
                    />
                    Your browser does not support the video tag.
                  </video>
                ) : file?.mimeType === "application/pdf" ? (
                  <iframe
                    src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${file.filePath}`}
                    width="100%"
                    height="400"
                    style={{ border: "none", borderRadius: "4px" }}
                    title={file.originalName}
                  />
                ) : file?.mimeType?.startsWith("text/") ? (
                  <div
                    style={{
                      width: "100%",
                      maxHeight: "300px",
                      overflow: "auto",
                      backgroundColor: "white",
                      padding: "16px",
                      borderRadius: "4px",
                      border: "1px solid #ddd",
                      fontFamily: "monospace",
                      fontSize: "12px",
                    }}
                  >
                    <Text size="xs" c="dimmed">
                      Text content preview not available
                    </Text>
                    <Text size="xs" c="dimmed">
                      Download the file to view content
                    </Text>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <IconFile size={48} color="#666" />
                    <Text size="sm" c="dimmed">
                      Preview not available
                    </Text>
                    <Text size="xs" c="dimmed">
                      Download the file to view content
                    </Text>
                  </div>
                )}

                {/* Fallback content for failed image loads */}
                <div
                  className="fallback-content"
                  style={{
                    display: "none",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <IconFile size={48} color="#666" />
                  <Text size="sm" c="dimmed">
                    Image failed to load
                  </Text>
                  <Text size="xs" c="dimmed">
                    Download the file to view content
                  </Text>
                </div>
              </div>
            </div>

            {/* File Information Section */}
            <div>
              <Text size="sm" fw={500} mb="xs">
                File Information
              </Text>
              <div
                style={{
                  backgroundColor: "#f8f9fa",
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px solid #e0e0e0",
                }}
              >
                {file.title && (
                  <Text size="sm" fw={500} mb="xs">
                    Title: {file.title}
                  </Text>
                )}
                {file.originalName && (
                  <Text size="sm" c="dimmed">
                    Original Name: {file.originalName}
                  </Text>
                )}
                {file.fileName && (
                  <Text size="sm" c="dimmed">
                    File Name: {file.fileName}
                  </Text>
                )}
                {file.fileSize != null && formatSize(file.fileSize) && (
                  <Text size="sm" c="dimmed">
                    Size: {formatSize(file.fileSize)}
                  </Text>
                )}
                {file.mimeType && (
                  <Text size="sm" c="dimmed">
                    Type: {file.mimeType}
                  </Text>
                )}
                {file.uploadedBy?.name && (
                  <Text size="sm" c="dimmed">
                    Uploaded By: {file.uploadedBy.name}
                  </Text>
                )}
                {safeDate(file.createdAt) && (
                  <Text size="sm" c="dimmed">
                    Created: {safeDate(file.createdAt)}
                  </Text>
                )}
                {safeDate(file.updatedAt) && (
                  <Text size="sm" c="dimmed">
                    Last Updated: {safeDate(file.updatedAt)}
                  </Text>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <Group justify="space-between">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}

