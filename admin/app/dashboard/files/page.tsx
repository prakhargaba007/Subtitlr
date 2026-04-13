"use client";
import React, { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Title,
  Button,
  Group,
  Text,
  Table,
  Modal,
  TextInput,
  FileInput,
  Select,
  Badge,
  ActionIcon,
  Tooltip,
  Loader,
  Pagination,
  Stack,
  Card,
  SimpleGrid,
  rem,
  Flex,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconUpload,
  IconSearch,
  IconTrash,
  IconEye,
  IconLink,
  IconUnlink,
  IconDownload,
  IconFile,
  IconPhoto,
  IconVideo,
  IconScript,
  IconFilter,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";
import { FileDetailsModal } from "@/FileDetailsModal";

interface FileData {
  _id: string;
  title: string;
  originalName: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  // uploadType: string;
  // referenceCount: number;
  uploadedBy: {
    _id: string;
    name: string;
    userName: string;
  };
  // references: Array<{
  //   model: string;
  //   documentId: string;
  //   field: string;
  //   referencedAt: string;
  // }>;
  createdAt: string;
  updatedAt: string;
}

interface FileStats {
  overall: {
    totalFiles: number;
    totalSize: number;
    // totalReferences: number;
    // avgReferences: number;
  };
  // byType: Array<{
  //   _id: string;
  //   count: number;
  //   totalSize: number;
  // }>;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [stats, setStats] = useState<FileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpened, { open: openUpload, close: closeUpload }] =
    useDisclosure(false);
  const [detailsModalOpened, { open: openDetails, close: closeDetails }] =
    useDisclosure(false);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);

  // Pagination and search states
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState("newest");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState("");

  // const [referenceForm, setReferenceForm] = useState({
  //   model: "User",
  //   documentId: "",
  //   field: "profilePicture",
  // });

  // Fetch files
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const response = await axiosInstance.get(`/api/files/all?${params}`);
      const filesData = response.data.data.files || [];
      const paginationData = response.data.data.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalCount: filesData.length,
        limit: itemsPerPage,
        hasNextPage: false,
        hasPrevPage: false,
      };

      setFiles(filesData);
      setPagination(paginationData);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch files",
        color: "red",
      });
      setFiles([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        limit: itemsPerPage,
        hasNextPage: false,
        hasPrevPage: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch file statistics
  const fetchStats = async () => {
    try {
      const response = await axiosInstance.get("/api/files/stats");
      setStats(response.data.data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  useEffect(() => {
    fetchFiles();
    fetchStats();
  }, []);

  // Refetch files when pagination, search, or items per page changes
  useEffect(() => {
    fetchFiles();
  }, [pagination.currentPage, itemsPerPage, sortBy]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pagination.currentPage !== 1) {
        setPagination(prev => ({ ...prev, currentPage: 1 }));
      } else {
        fetchFiles();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Handle pagination change
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle sort change
  const handleSortChange = (value: string | null) => {
    if (value) {
      setSortBy(value);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setSortBy("newest");
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!uploadedFile) {
      notifications.show({
        title: "Error",
        message: "Please select a file to upload",
        color: "red",
      });
      return;
    }

    if (!fileTitle.trim()) {
      notifications.show({
        title: "Error",
        message: "Please enter a title for the file",
        color: "red",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("title", fileTitle.trim());
      // formData.append("uploadType", uploadType);

      const response = await axiosInstance.post("/api/files/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      notifications.show({
        title: "Success",
        message: "File uploaded successfully",
        color: "green",
      });

      closeUpload();
      setUploadedFile(null);
      setFileTitle("");
      // setUploadType("general");
      fetchFiles();
      fetchStats();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.response?.data?.message || "Failed to upload file",
        color: "red",
      });
    }
  };

  // Handle file reference
  // const handleFileReference = async () => {
  //   if (!selectedFile || !referenceForm.documentId || !referenceForm.field) {
  //     notifications.show({
  //       title: "Error",
  //       message: "Please fill in all required fields",
  //       color: "red",
  //   });
  //     return;
  //   }

  //   try {
  //     await axiosInstance.post("/api/files/reference", {
  //       fileId: selectedFile._id,
  //       ...referenceForm,
  //     });

  //     notifications.show({
  //       title: "Success",
  //       message: "File referenced successfully",
  //       color: "green",
  //     });

  //     closeReference();
  //     setReferenceForm({
  //       model: "User",
  //       documentId: "",
  //       field: "profilePicture",
  //     });
  //     fetchFiles();
  //     fetchStats();
  //   } catch (error: any) {
  //     notifications.show({
  //       title: "Error",
  //       message: error.response?.data?.message || "Failed to reference file",
  //       color: "red",
  //     });
  //   }
  // };

  // Handle file deletion
  const handleFileDelete = async (fileId: string) => {
    if (window.confirm("Are you sure you want to delete this file?")) {
      try {
        await axiosInstance.delete(`/api/files/${fileId}`);
        notifications.show({
          title: "Success",
          message: "File deleted successfully",
          color: "green",
        });
        fetchFiles();
        fetchStats();
      } catch (error: any) {
        notifications.show({
          title: "Error",
          message: error.response?.data?.message || "Failed to delete file",
          color: "red",
        });
      }
    }
  };

  // Get file icon based on MIME type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return IconPhoto;
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

  return (
    <Container size="xl">
      <Paper p="md" shadow="xs" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={2}>File Management</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={openUpload}>
            Upload New File
          </Button>
        </Group>

        {/* Statistics Cards */}
        {stats && (
          <SimpleGrid cols={2} mb="md">
            <Card p="md" withBorder>
              <Text size="sm" c="dimmed">
                Total Files
              </Text>
              <Text size="xl" fw={700}>
                {stats.overall?.totalFiles}
              </Text>
            </Card>
            <Card p="md" withBorder>
              <Text size="sm" c="dimmed">
                Total Size
              </Text>
              <Text size="xl" fw={700}>
                {formatFileSize(stats.overall?.totalSize)}
              </Text>
            </Card>
          </SimpleGrid>
        )}

        {/* Search and Filter Controls */}
        <Paper p="md" mb="md" withBorder>
          <Stack>
            <Flex gap="md" wrap="wrap" align="end">
              <TextInput
                placeholder="Search files by name..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={handleSearchChange}
                style={{ flex: 1, minWidth: 200 }}
              />
              <Select
                placeholder="Sort by"
                data={[
                  { value: "newest", label: "Newest First" },
                  { value: "oldest", label: "Oldest First" },
                  { value: "name", label: "Name A-Z" },
                  { value: "size", label: "Size" },
                ]}
                value={sortBy}
                onChange={handleSortChange}
                style={{ minWidth: 150 }}
              />
              <Select
                placeholder="Items per page"
                data={[
                  { value: "5", label: "5 per page" },
                  { value: "10", label: "10 per page" },
                  { value: "20", label: "20 per page" },
                  { value: "50", label: "50 per page" },
                ]}
                value={itemsPerPage.toString()}
                onChange={(value) => setItemsPerPage(parseInt(value || "10"))}
                style={{ minWidth: 120 }}
              />
            </Flex>

            {/* Results Summary */}
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Showing {files.length} of {pagination.totalCount} files
              </Text>
            </Group>
          </Stack>
        </Paper>

        {/* Files Table */}
        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "50px",
            }}
          >
            <Loader />
          </div>
        ) : files.length === 0 ? (
          <Text ta="center" py="xl" c="dimmed">
            {searchQuery
              ? "No files found matching your search criteria."
              : "No files found. Upload your first file!"
            }
          </Text>
        ) : (
          <>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>File</Table.Th>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Original Name</Table.Th>
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
                          <FileIcon size={24} />
                          <Text size="sm" c="dimmed">
                            {file.mimeType.split('/')[0].toUpperCase()}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {file.title}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {file.originalName}
                        </Text>
                      </Table.Td>
                      <Table.Td>{formatFileSize(file.fileSize)}</Table.Td>
                      <Table.Td>{file.uploadedBy?.name || "Unknown"}</Table.Td>
                      <Table.Td>
                        <Group>
                          <Tooltip label="View Details">
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              onClick={() => {
                                setSelectedFile(file);
                                openDetails();
                              }}
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete File">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleFileDelete(file._id)}
                            >
                              <IconTrash size={16} />
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
            {pagination.totalPages > 1 && (
              <Group justify="center" mt="xl">
                <Pagination
                  value={pagination.currentPage}
                  onChange={handlePageChange}
                  total={pagination.totalPages}
                  size="sm"
                  withEdges
                />
              </Group>
            )}
          </>
        )}
      </Paper>

      {/* Upload Modal */}
      <Modal
        opened={uploadModalOpened}
        onClose={closeUpload}
        title="Upload New File"
        size="md"
        centered
      >
        <Stack>
          <TextInput
            label="File Title"
            placeholder="Enter a title for this file"
            value={fileTitle}
            onChange={(event) => setFileTitle(event.currentTarget.value)}
            required
          />
          <FileInput
            label="Select File"
            placeholder="Choose a file to upload"
            value={uploadedFile}
            onChange={setUploadedFile}
            accept="image/*,application/pdf"
            leftSection={<IconUpload size={rem(16)} />}
            required
          />

          <Group justify="flex-end">
            <Button variant="outline" onClick={closeUpload}>
              Cancel
            </Button>
            <Button onClick={handleFileUpload} disabled={!uploadedFile || !fileTitle.trim()}>
              Upload
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* File Details Modal */}
      <FileDetailsModal
        opened={detailsModalOpened}
        onClose={closeDetails}
        file={selectedFile}
        formatFileSize={formatFileSize}
      />
    </Container>
  );
}
