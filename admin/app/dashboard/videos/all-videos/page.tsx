"use client";

import { useEffect, useState } from "react";
import {
  Container,
  Title,
  Button,
  Card,
  Text,
  Group,
  Badge,
  Progress,
  Modal,
  TextInput,
  Textarea,
  Select,
  Pagination,
  Loader,
  Table,
  ActionIcon,
  Menu,
  Tooltip,
  Flex,
  Box,
  Divider,
  Paper,
  Stack,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDisclosure } from "@mantine/hooks";
import {
  Upload,
  Video,
  Search,
  Edit,
  Trash,
  Eye,
  MoreVertical,
  Check,
  AlertCircle,
  Clock,
  RefreshCw,
  Filter,
} from "lucide-react";
import axiosInstance from "@/utils/axios";
import { formatDistanceToNow } from "date-fns";

// Define video type
interface Video {
  _id: string;
  title: string;
  description: string;
  status: "uploaded" | "processing" | "processed" | "failed";
  processingProgress: number;
  createdAt: string;
  uploadedBy: {
    name: string;
    userName: string;
  };
  processedVersions?: {
    "1080p"?: { path: string; size: number; url: string };
    "720p"?: { path: string; size: number; url: string };
    "480p"?: { path: string; size: number; url: string };
  };
  originalPath?: string;
  originalUrl?: string;
  processingError?: string;
}

export default function AllVideosPage() {
  // State
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpened, { open: openUpload, close: closeUpload }] =
    useDisclosure(false);
  const [viewOpened, { open: openView, close: closeView }] =
    useDisclosure(false);
  const [editOpened, { open: openEdit, close: closeEdit }] =
    useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] =
    useDisclosure(false);
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStartedAt, setUploadStartedAt] = useState<number | null>(null);
  const [bytesUploaded, setBytesUploaded] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [uploadBps, setUploadBps] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const [selectedResolution, setSelectedResolution] = useState<string>("720p");
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Build URL for serving video (supports CDN base or backend)
  const buildVideoUrl = (keyOrPath: string) => {
    const cdn = process.env.NEXT_PUBLIC_CDN_BASE_URL as string | undefined;
    if (cdn) return `${cdn.replace(/\/$/, "")}/${keyOrPath.replace(/^\//, "")}`;
    // return `${process.env.NEXT_PUBLIC_BACKEND_URL}/${keyOrPath.replace(/^\//, "")}`;
    return keyOrPath;
  };

  // Format helpers for speed and ETA
  const formatBitsPerSecond = (bps: number) => {
    if (!bps || bps <= 0) return "0 bps";
    const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
    let idx = 0;
    let value = bps;
    while (value >= 1000 && idx < units.length - 1) {
      value /= 1000;
      idx++;
    }
    return `${value.toFixed(2)} ${units[idx]}`;
  };

  const formatSeconds = (seconds: number) => {
    if (!isFinite(seconds) || seconds < 0) return "--";
    const s = Math.round(seconds);
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const r = (s % 60).toString().padStart(2, "0");
    return `${m}:${r}`;
  };

  // Fetch videos
  const fetchVideos = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        sortBy,
        sortOrder,
      });

      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      if (statusFilter) {
        params.append("status", statusFilter);
      }

      const response = await axiosInstance.get(`/api/videos?${params}`);
      setVideos(response.data.videos);
      setTotalPages(response.data.pagination.pages);
    } catch (error) {
      console.error("Error fetching videos:", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch videos",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Upload video
  const handleUpload = async () => {
    if (!title || !videoFile) {
      notifications.show({
        title: "Error",
        message: "Please provide a title and select a video file",
        color: "red",
      });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setBytesUploaded(0);
      setBytesTotal(0);
      const startedAt = Date.now();
      setUploadStartedAt(startedAt);
      // Try S3 presigned flow first
      try {
        const presign = await axiosInstance.post(`/api/videos/upload-url`, {
          filename: videoFile.name,
          mimeType: videoFile.type,
        });
        const { uploadUrl, key } = presign.data;
        // Use XHR to get upload progress for S3 PUT
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", videoFile.type);
          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const loaded = evt.loaded;
              const total = evt.total;
              const elapsedSec = (Date.now() - startedAt) / 1000;
              const bps = elapsedSec > 0 ? (loaded * 8) / elapsedSec : 0;
              setBytesUploaded(loaded);
              setBytesTotal(total);
              setUploadBps(bps);
              setUploadProgress(Math.floor((loaded / total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploadProgress(100);
              resolve();
            } else {
              reject(new Error(`S3 upload failed with status ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("Network error during S3 upload"));
          xhr.send(videoFile);
        });
        await axiosInstance.post(`/api/videos/upload`, {
          title,
          description,
          s3Key: key,
          mimeType: videoFile.type,
          fileSize: videoFile.size,
          originalFilename: videoFile.name,
        });
      } catch (e) {
        // Fallback to legacy multipart upload (local storage mode)
        const formData = new FormData();
        formData.append("title", title);
        formData.append("description", description);
        formData.append("video", videoFile);
        await axiosInstance.post(`/api/videos/upload`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const total = progressEvent.total || videoFile.size;
            const loaded = progressEvent.loaded || 0;
            const elapsedSec = uploadStartedAt
              ? (Date.now() - uploadStartedAt) / 1000
              : 0;
            const bps = elapsedSec > 0 ? (loaded * 8) / elapsedSec : 0;
            setBytesUploaded(loaded);
            setBytesTotal(total);
            setUploadBps(bps);
            setUploadProgress(Math.floor((loaded / total) * 100));
          },
        });
      }

      notifications.show({
        title: "Success",
        message: "Video uploaded successfully and queued for processing",
        color: "green",
      });

      closeUpload();
      setTitle("");
      setDescription("");
      setVideoFile(null);
      setUploadProgress(0);
      setBytesUploaded(0);
      setBytesTotal(0);
      setUploadBps(0);
      setUploadStartedAt(null);
      fetchVideos();
    } catch (error) {
      console.error("Error uploading video:", error);
      notifications.show({
        title: "Error",
        message: "Failed to upload video",
        color: "red",
      });
    } finally {
      setUploading(false);
    }
  };

  // Update video
  const handleUpdate = async () => {
    if (!currentVideo || !title) {
      notifications.show({
        title: "Error",
        message: "Please provide a title",
        color: "red",
      });
      return;
    }

    try {
      setUploading(true);
      await axiosInstance.put(`/api/videos/${currentVideo._id}`, {
        title,
        description,
      });

      notifications.show({
        title: "Success",
        message: "Video updated successfully",
        color: "green",
      });

      closeEdit();
      fetchVideos();
    } catch (error) {
      console.error("Error updating video:", error);
      notifications.show({
        title: "Error",
        message: "Failed to update video",
        color: "red",
      });
    } finally {
      setUploading(false);
    }
  };

  // Delete video
  const handleDelete = async () => {
    if (!currentVideo) return;

    try {
      await axiosInstance.delete(`/api/videos/${currentVideo._id}`);
      notifications.show({
        title: "Success",
        message: "Video deleted successfully",
        color: "green",
      });
      closeDelete();
      fetchVideos();
    } catch (error) {
      console.error("Error deleting video:", error);
      notifications.show({
        title: "Error",
        message: "Failed to delete video",
        color: "red",
      });
    }
  };

  // View video details
  const handleView = (video: Video) => {
    setCurrentVideo(video);
    openView();
  };

  // Edit video
  const handleEdit = (video: Video) => {
    setCurrentVideo(video);
    setTitle(video.title);
    setDescription(video.description || "");
    openEdit();
  };

  // Check video processing status
  const checkProcessingStatus = async () => {
    const processingVideos = videos.filter(
      (video) => video.status === "uploaded" || video.status === "processing"
    );

    if (processingVideos.length === 0) {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      return;
    }

    for (const video of processingVideos) {
      try {
        const response = await axiosInstance.get(
          `/api/videos/${video._id}/status`
        );
        const { status, progress } = response.data;

        if (status !== video.status || progress !== video.processingProgress) {
          setVideos((prevVideos) =>
            prevVideos.map((v) =>
              v._id === video._id
                ? { ...v, status, processingProgress: progress }
                : v
            )
          );

          // If all videos are processed, stop the interval
          if (
            videos.every(
              (v) =>
                v._id === video._id ||
                v.status === "processed" ||
                v.status === "failed"
            )
          ) {
            if (refreshInterval) {
              clearInterval(refreshInterval);
              setRefreshInterval(null);
            }
            fetchVideos(); // Refresh to get full data
          }
        }
      } catch (error) {
        console.error(`Error checking status for video ${video._id}:`, error);
      }
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (!bytes) return "N/A";
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Byte";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)).toString());
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  // Status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "uploaded":
        return "blue";
      case "processing":
        return "yellow";
      case "processed":
        return "green";
      case "failed":
        return "red";
      default:
        return "gray";
    }
  };

  // Status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "uploaded":
        return <Upload size={16} />;
      case "processing":
        return <RefreshCw size={16} className="animate-spin" />;
      case "processed":
        return <Check size={16} />;
      case "failed":
        return <AlertCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  // Initial fetch and refetch on dependencies change
  useEffect(() => {
    fetchVideos();
  }, [page, itemsPerPage, sortBy, sortOrder, searchQuery, statusFilter]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (page !== 1) {
        setPage(1);
      } else {
        fetchVideos();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, statusFilter]);

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle status filter change
  const handleStatusFilterChange = (value: string | null) => {
    setStatusFilter(value);
  };

  // Handle sort change
  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter(null);
    setSortBy("createdAt");
    setSortOrder("desc");
    setPage(1);
  };

  // Set up status checking interval for processing videos
  useEffect(() => {
    if (
      videos.some(
        (video) => video.status === "uploaded" || video.status === "processing"
      )
    ) {
      if (!refreshInterval) {
        const interval = setInterval(checkProcessingStatus, 5000);
        setRefreshInterval(interval);
      }
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [videos]);

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Video Management</Title>
        <Button leftSection={<Upload size={16} />} onClick={openUpload}>
          Upload Video
        </Button>
      </Group>

      {/* Search and Filter Controls */}
      <Paper p="md" mb="lg" withBorder>
        <Stack>
          <Flex gap="md" wrap="wrap" align="end">
            <TextInput
              placeholder="Search videos..."
              leftSection={<Search size={16} />}
              value={searchQuery}
              onChange={handleSearchChange}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Select
              placeholder="Filter by status"
              data={[
                { value: "uploaded", label: "Uploaded" },
                { value: "processing", label: "Processing" },
                { value: "processed", label: "Processed" },
                { value: "failed", label: "Failed" },
              ]}
              value={statusFilter}
              onChange={handleStatusFilterChange}
              clearable
              leftSection={<Filter size={16} />}
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
            {/* <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button> */}
          </Flex>
          
          {/* Results Summary */}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {videos.length} videos
              {searchQuery || statusFilter ? " (filtered)" : ""}
            </Text>
            {/* <Group gap="xs">
              <Text size="sm">Sort by:</Text>
              <Button
                variant={sortBy === "createdAt" ? "filled" : "outline"}
                size="xs"
                onClick={() => handleSortChange("createdAt")}
              >
                Date {sortBy === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
              </Button>
              <Button
                variant={sortBy === "title" ? "filled" : "outline"}
                size="xs"
                onClick={() => handleSortChange("title")}
              >
                Title {sortBy === "title" && (sortOrder === "asc" ? "↑" : "↓")}
              </Button>
              <Button
                variant={sortBy === "status" ? "filled" : "outline"}
                size="xs"
                onClick={() => handleSortChange("status")}
              >
                Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
              </Button>
            </Group> */}
          </Group>
        </Stack>
      </Paper>

      {loading ? (
        <Flex justify="center" align="center" h={200}>
          <Loader />
        </Flex>
      ) : videos.length === 0 ? (
        <Card withBorder p="xl" radius="md">
          <Text ta="center" fw={500} size="lg">
            No videos found
          </Text>
          <Text ta="center" c="dimmed" mt="sm">
            {searchQuery || statusFilter 
              ? "No videos match your search criteria. Try adjusting your filters." 
              : "Upload your first video to get started"
            }
          </Text>
          <Button
            fullWidth
            leftSection={<Upload size={16} />}
            onClick={openUpload}
            mt="md"
          >
            Upload Video
          </Button>
        </Card>
      ) : (
        <>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Progress</Table.Th>
                <Table.Th>Uploaded</Table.Th>
                <Table.Th>By</Table.Th>
                <Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {videos.map((video) => (
                <Table.Tr key={video._id}>
                  <Table.Td>
                    <Group gap="xs">
                      <Video size={16} />
                      <Text fw={500}>{video.title}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={getStatusColor(video.status)}
                      leftSection={getStatusIcon(video.status)}
                    >
                      {video.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {video.status === "processing" ? (
                      <Progress
                        value={video.processingProgress}
                        size="sm"
                        color={
                          video.processingProgress < 100 ? "blue" : "green"
                        }
                      />
                    ) : video.status === "processed" ? (
                      <Text c="green" size="sm">
                        Complete
                      </Text>
                    ) : video.status === "failed" ? (
                      <Text c="red" size="sm">
                        Failed
                      </Text>
                    ) : (
                      <Text c="dimmed" size="sm">
                        Waiting
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={new Date(video.createdAt).toLocaleString()}>
                      <Text size="sm">
                        {formatDistanceToNow(new Date(video.createdAt), {
                          addSuffix: true,
                        })}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{video.uploadedBy?.name || "Unknown"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Menu position="bottom-end" withArrow>
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <MoreVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<Eye size={16} />}
                          onClick={() => handleView(video)}
                        >
                          View Details
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Edit size={16} />}
                          onClick={() => handleEdit(video)}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Trash size={16} />}
                          color="red"
                          onClick={() => {
                            setCurrentVideo(video);
                            openDelete();
                          }}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {totalPages > 1 && (
            <Group justify="center" mt="lg">
              <Pagination value={page} onChange={setPage} total={totalPages} />
            </Group>
          )}
        </>
      )}

      {/* Upload Modal */}
      <Modal
        opened={uploadOpened}
        onClose={closeUpload}
        title="Upload New Video"
        centered
        size="md"
      >
        <TextInput
          label="Title"
          placeholder="Enter video title"
          required
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          mb="md"
        />
        <Textarea
          label="Description"
          placeholder="Enter video description (optional)"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          mb="md"
          autosize
          minRows={3}
        />
        <Box mb="md">
          <Text size="sm" fw={500} mb={5}>
            Video File <span style={{ color: "red" }}>*</span>
          </Text>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />
          <Text size="xs" c="dimmed" mt={5}>
            Supported formats: MP4, WebM, MOV, AVI (max 500MB)
          </Text>
        </Box>
        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={closeUpload}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            loading={uploading}
            disabled={!title || !videoFile}
          >
            Upload
          </Button>
        </Group>
        {uploading && (
          <Box mt="md">
            <Text fw={500} mb="xs">Uploading</Text>
            <Progress value={uploadProgress} color={uploadProgress < 100 ? "blue" : "green"} />
            <Group justify="space-between" mt={6}>
              <Text size="xs" c="dimmed">{uploadProgress}%</Text>
              <Text size="xs" c="dimmed">
                {formatFileSize(bytesUploaded)} / {formatFileSize(bytesTotal)}
              </Text>
            </Group>
            <Group justify="space-between" mt={4}>
              <Text size="xs" c="dimmed">Speed: {formatBitsPerSecond(uploadBps)}</Text>
              <Text size="xs" c="dimmed">
                ETA: {uploadBps > 0 && bytesTotal > bytesUploaded
                  ? formatSeconds(((bytesTotal - bytesUploaded) * 8) / uploadBps)
                  : "--"}
              </Text>
            </Group>
          </Box>
        )}
      </Modal>

      {/* View Modal */}
      {currentVideo && (
        <Modal
          opened={viewOpened}
          onClose={closeView}
          title={`Video Details: ${currentVideo.title}`}
          centered
          size="lg"
        >
          <Card withBorder>
            {currentVideo.status === "processed" &&
            currentVideo.processedVersions ? (
              <Box mb="md">
                <Text fw={500} mb="xs">
                  Preview
                </Text>
                {/* Debug info */}
                {/* {process.env.NODE_ENV === "development" && (
                  <Box
                    p="xs"
                    bg="gray.1"
                    mb="xs"
                    style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}
                  >
                    <Text fw={700} size="xs">
                      Debug Info:
                    </Text>
                    <Text size="xs">Status: {currentVideo.status}</Text>
                    <Text size="xs">
                      Has processedVersions:{" "}
                      {currentVideo.processedVersions ? "Yes" : "No"}
                    </Text>
                    <Text size="xs">
                      Available versions:{" "}
                      {currentVideo.processedVersions
                        ? Object.keys(currentVideo.processedVersions)
                            .filter(
                              (key) =>
                                currentVideo.processedVersions?.[
                                  key as keyof typeof currentVideo.processedVersions
                                ]?.path
                            )
                            .join(", ")
                        : "None"}
                    </Text>
                    <Text size="xs">
                      Selected resolution: {selectedResolution}
                    </Text>
                    <Text size="xs">
                      Video path:{" "}
                      {currentVideo.processedVersions?.[
                        selectedResolution as keyof typeof currentVideo.processedVersions
                      ]?.path || "Not available"}
                    </Text>
                    <Text size="xs">
                      Full URL:{" "}
                      {`${process.env.NEXT_PUBLIC_BACKEND_URL}/${
                        currentVideo.processedVersions?.[
                          selectedResolution as keyof typeof currentVideo.processedVersions
                        ]?.path || ""
                      }`}
                    </Text>
                  </Box>
                )} */}

                <Select
                  value={selectedResolution}
                  onChange={(value) => setSelectedResolution(value || "720p")}
                  data={Object.keys(currentVideo.processedVersions)
                    .filter(
                      (res) =>
                        currentVideo.processedVersions?.[
                          res as keyof typeof currentVideo.processedVersions
                        ]?.url
                    )
                    .map((res) => ({ value: res, label: res }))}
                  mb="xs"
                />

                {currentVideo.processedVersions?.[
                  selectedResolution as keyof typeof currentVideo.processedVersions
                ]?.path ? (
                  <video
                    controls
                    controlsList="nodownload"
                    width="100%"
                    src={buildVideoUrl(
                      currentVideo.processedVersions[
                        selectedResolution as keyof typeof currentVideo.processedVersions
                      ]?.url as string
                    )}
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <Text c="red">Selected resolution not available.</Text>
                )}
              </Box>
            ) : (
              <Box mb="md">
                <Text c="dimmed" mb="md">
                  {currentVideo.status === "failed"
                    ? "Video processing failed"
                    : "Video is being processed and will be available soon"}
                </Text>

                {/* Debug info */}
                {/* {process.env.NODE_ENV === "development" && (
                  <Box
                    p="xs"
                    bg="gray.1"
                    mb="xs"
                    style={{ fontSize: "12px", whiteSpace: "pre-wrap" }}
                  >
                    <Text fw={700} size="xs">
                      Debug Info:
                    </Text>
                    <Text size="xs">Status: {currentVideo.status}</Text>
                    <Text size="xs">
                      Progress: {currentVideo.processingProgress}%
                    </Text>
                    <Text size="xs">
                      Has processedVersions:{" "}
                      {currentVideo.processedVersions ? "Yes" : "No"}
                    </Text>
                    <Text size="xs">
                      Raw processedVersions:{" "}
                      {JSON.stringify(
                        currentVideo.processedVersions || {},
                        null,
                        2
                      )}
                    </Text>
                    {currentVideo.originalPath && (
                      <Text size="xs">
                        Original path: {currentVideo.originalPath}
                      </Text>
                    )}
                    {currentVideo.processingError && (
                      <Text size="xs" c="red">
                        Error: {currentVideo.processingError}
                      </Text>
                    )}
                  </Box>
                )} */}

                {/* Show original video if available */}
                {currentVideo.originalPath && (
                  <>
                    <Text fw={500} mb="xs">
                      Original Video (Unprocessed)
                    </Text>
                    <video
                      controls
                      width="100%"
                      src={buildVideoUrl(currentVideo.originalUrl as string)}
                    >
                      Your browser does not support the video tag.
                    </video>
                  </>
                )}
              </Box>
            )}

            <Divider my="md" />

            <Text fw={500}>Title</Text>
            <Text mb="md">{currentVideo.title}</Text>

            <Text fw={500}>Description</Text>
            <Text mb="md">{currentVideo.description || "No description"}</Text>

            <Text fw={500}>Status</Text>
            <Badge
              color={getStatusColor(currentVideo.status)}
              leftSection={getStatusIcon(currentVideo.status)}
              mb="md"
            >
              {currentVideo.status}
            </Badge>

            {currentVideo.status === "processing" && (
              <>
                <Text fw={500}>Processing Progress</Text>
                <Progress
                  value={currentVideo.processingProgress}
                  mb="md"
                  color={
                    currentVideo.processingProgress < 100 ? "blue" : "green"
                  }
                  // label={`${currentVideo.processingProgress}%`}
                />
              </>
            )}

            {currentVideo.status === "failed" &&
              currentVideo.processingError && (
                <>
                  <Text fw={500}>Error</Text>
                  <Text c="red" mb="md">
                    {currentVideo.processingError}
                  </Text>
                </>
              )}

            <Text fw={500}>Uploaded</Text>
            <Text mb="md">
              {new Date(currentVideo.createdAt).toLocaleString()}
            </Text>

            <Text fw={500}>Uploaded By</Text>
            <Text mb="md">{currentVideo.uploadedBy?.name || "Unknown"}</Text>

            {currentVideo.status === "processed" &&
              currentVideo.processedVersions && (
                <>
                  <Text fw={500}>Available Resolutions</Text>
                  <Group mb="md">
                    {Object.entries(currentVideo.processedVersions).map(
                      ([resolution, data]) =>
                        data && (
                          <Badge key={resolution}>
                            {resolution} ({formatFileSize(data.size)})
                          </Badge>
                        )
                    )}
                  </Group>
                </>
              )}
          </Card>
          <Group justify="flex-end" mt="lg">
            <Button onClick={closeView}>Close</Button>
          </Group>
        </Modal>
      )}

      {/* Edit Modal */}
      <Modal
        opened={editOpened}
        onClose={closeEdit}
        title="Edit Video"
        centered
      >
        <TextInput
          label="Title"
          placeholder="Enter video title"
          required
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          mb="md"
        />
        <Textarea
          label="Description"
          placeholder="Enter video description (optional)"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          mb="md"
          autosize
          minRows={3}
        />
        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={closeEdit}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} loading={uploading}>
            Update
          </Button>
        </Group>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteOpened}
        onClose={closeDelete}
        title="Delete Video"
        centered
      >
        <Text>
          Are you sure you want to delete the video "{currentVideo?.title}"?
          This action cannot be undone.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={closeDelete}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDelete}>
            Delete
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
