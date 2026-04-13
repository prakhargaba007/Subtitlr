"use client";

import React, { useState, useEffect } from "react";
import {
  Select,
  Text,
  Group,
  Button,
  Modal,
  Table,
  TextInput,
  ActionIcon,
  Tooltip,
  Loader,
  Pagination,
  Badge,
  Stack,
  rem,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconSearch,
  IconEye,
  IconDownload,
  IconFile,
  IconImageInPicture,
  IconVideo,
  IconScript,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";

interface FileData {
  _id: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: {
    _id: string;
    name: string;
    userName: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface FileSelectorProps {
  value?: string;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  searchable?: boolean;
  description?: string;
  error?: string;
}

export default function FileSelector({
  value,
  onChange,
  label = "Select File",
  placeholder = "Choose a file",
  required = false,
  disabled = false,
  clearable = true,
  searchable = true,
  description,
  error,
}: FileSelectorProps) {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [previewModalOpened, { open: openPreview, close: closePreview }] =
    useDisclosure(false);

  // Fetch files
  const fetchFiles = async (page = 1, search = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (search) params.append("search", search);

      const response = await axiosInstance.get(`/api/files/all?${params}`);
      setFiles(response.data.files);
      setTotalPages(response.data.pagination.totalPages);
      setCurrentPage(response.data.pagination.currentPage);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch files",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Get file icon based on MIME type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return IconImageInPicture;
    if (mimeType.startsWith("video/")) return IconVideo;
    if (mimeType.startsWith("text/") || mimeType.includes("document"))
      return IconScript;
    return IconFile;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Get selected file data for display
  const selectedFileData = files.find((file) => file._id === value);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchFiles(1, searchQuery);
  };

  const handleResetSearch = () => {
    setSearchQuery("");
    setCurrentPage(1);
    fetchFiles(1, "");
  };

  return (
    <>
      <Select
        label={label}
        placeholder={placeholder}
        value={value || null}
        onChange={onChange}
        required={required}
        disabled={disabled}
        clearable={clearable}
        searchable={searchable}
        description={description}
        error={error}
        data={files.map((file) => ({
          value: file._id,
          label: file.originalName,
        }))}
        rightSection={
          <Button
            variant="subtle"
            size="xs"
            onClick={() => fetchFiles()}
            disabled={loading}
          >
            Browse Files
          </Button>
        }
        // styles={{
        //   rightSection: {
        //     width: "auto",
        //     paddingRight: 8,
        //   },
        // }}
      />

      {/* File Browser Modal */}
      <Modal
        opened={previewModalOpened}
        onClose={closePreview}
        title="File Browser"
        size="xl"
        centered
      >
        <Stack>
          {/* Search */}
          <Group>
            <TextInput
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
              leftSection={<IconSearch size={16} />}
            />
            <Button variant="outline" onClick={handleSearch}>
              Search
            </Button>
            <Button variant="light" onClick={handleResetSearch}>
              Reset
            </Button>
          </Group>

          {/* Files Table */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "50px" }}>
              <Loader />
            </div>
          ) : (
            <>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>File</Table.Th>
                    <Table.Th>Size</Table.Th>
                    <Table.Th>Uploaded By</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {files.map((file) => {
                    const FileIcon = getFileIcon(file.mimeType);
                    return (
                      <Table.Tr key={file._id}>
                        <Table.Td>
                          <Group>
                            <FileIcon size={20} />
                            <Text size="sm" fw={500}>
                              {file.originalName}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatFileSize(file.fileSize)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{file.uploadedBy?.name || "Unknown"}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group>
                            <Tooltip label="Select File">
                              <Button
                                size="xs"
                                variant={value === file._id ? "filled" : "outline"}
                                color={value === file._id ? "blue" : "gray"}
                                onClick={() => {
                                  onChange(file._id);
                                  closePreview();
                                }}
                              >
                                {value === file._id ? "Selected" : "Select"}
                              </Button>
                            </Tooltip>
                            <Tooltip label="Preview">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => {
                                  setSelectedFile(file);
                                  openPreview();
                                }}
                              >
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Download">
                              <ActionIcon
                                variant="subtle"
                                color="green"
                                onClick={() => {
                                  const link = document.createElement("a");
                                  link.href = `${process.env.NEXT_PUBLIC_BACKEND_URL}/${file.filePath}`;
                                  link.download = file.originalName;
                                  link.click();
                                }}
                              >
                                <IconDownload size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination
                    total={totalPages}
                    value={currentPage}
                    onChange={(page) => {
                      setCurrentPage(page);
                      fetchFiles(page, searchQuery);
                    }}
                  />
                </Group>
              )}
            </>
          )}
        </Stack>
      </Modal>

      {/* File Preview Modal */}
      <Modal
        opened={previewModalOpened}
        onClose={closePreview}
        title="File Preview"
        size="lg"
        centered
      >
        <Stack>
          {selectedFile && (
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
                  {selectedFile.mimeType.startsWith("image/") ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_BACKEND_URL}/${selectedFile.filePath}`}
                      alt={selectedFile.originalName}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "300px",
                        objectFit: "contain",
                        borderRadius: "4px",
                      }}
                    />
                  ) : selectedFile.mimeType.startsWith("video/") ? (
                    <video
                      controls
                      style={{
                        maxWidth: "100%",
                        maxHeight: "300px",
                        borderRadius: "4px",
                      }}
                    >
                      <source
                        src={`${process.env.NEXT_PUBLIC_BACKEND_URL}/${selectedFile.filePath}`}
                        type={selectedFile.mimeType}
                      />
                      Your browser does not support the video tag.
                    </video>
                  ) : selectedFile.mimeType === "application/pdf" ? (
                    <iframe
                      src={`${process.env.NEXT_PUBLIC_BACKEND_URL}/${selectedFile.filePath}`}
                      width="100%"
                      height="400"
                      style={{ border: "none", borderRadius: "4px" }}
                      title={selectedFile.originalName}
                    />
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
                  <Text size="sm" c="dimmed">
                    Original Name: {selectedFile.originalName}
                  </Text>
                  <Text size="sm" c="dimmed">
                    File Name: {selectedFile.fileName}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Size: {formatFileSize(selectedFile.fileSize)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Type: {selectedFile.mimeType}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Uploaded By: {selectedFile.uploadedBy?.name || "Unknown"}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Created: {new Date(selectedFile.createdAt).toLocaleDateString()}
                  </Text>
                </div>
              </div>

              {/* Action Buttons */}
              <Group justify="space-between">
                <Button
                  variant="outline"
                  leftSection={<IconDownload size={16} />}
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = `${process.env.NEXT_PUBLIC_BACKEND_URL}/${selectedFile.filePath}`;
                    link.download = selectedFile.originalName;
                    link.click();
                  }}
                >
                  Download File
                </Button>
                <Button
                  variant="filled"
                  onClick={() => {
                    onChange(selectedFile._id);
                    closePreview();
                  }}
                >
                  Select This File
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
