"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  Button,
  Group,
  Text,
  Modal,
  TextInput,
  Textarea,
  Badge,
  ActionIcon,
  Tooltip,
  Loader,
  Paper,
  Title,
  Container,
  Select,
  FileInput,
  Image,
  Tabs,
  NumberInput,
  MultiSelect,
  Switch,
  rem,
  Pagination,
  Stack,
  Flex,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconCircleCheck,
  IconCircleX,
  IconPhoto,
  IconDeviceFloppy,
  IconStar,
  IconStarFilled,
  IconClockHour3,
  IconEye,
  IconThumbUp,
  IconSearch,
  IconFilter,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";

interface Tag {
  _id: string;
  name: string;
}

interface Category {
  _id: string;
  name: string;
}

interface User {
  _id: string;
  name: string;
  userName: string;
}

interface YoutubeBinge {
  _id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  tags: Tag[];
  users: User[];
  categories: Category[];
  isFeatured: boolean;
  type: "Youtube" | "Shorts";
  duration: number;
  xpValue: number;
  views: number;
  likes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function AllYoutubeVideos() {
  const router = useRouter();
  const [videos, setVideos] = useState<YoutubeBinge[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<YoutubeBinge[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [editMode, setEditMode] = useState(false);
  const [currentVideo, setCurrentVideo] = useState<YoutubeBinge | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("all");
  
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
  const [sortBy, setSortBy] = useState("newest");
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const [tags, setTags] = useState<{ value: string; label: string }[]>([]);
  const [categories, setCategories] = useState<
    { value: string; label: string }[]
  >([]);
  const [users, setUsers] = useState<{ value: string; label: string }[]>([]);

  const [thumbnail, setThumbnail] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    videoUrl: "",
    tags: [] as string[],
    users: [] as string[],
    categories: [] as string[],
    isFeatured: false,
    type: "Youtube",
    duration: 0,
    xpValue: 0,
  });

  // Fetch all videos with pagination and search
  const fetchVideos = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: itemsPerPage.toString(),
        sort: sortBy,
      });

      // Add search query if provided
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      // Add status filter
      if (statusFilter) {
        if (statusFilter === "active") {
          params.append("active", "true");
        } else if (statusFilter === "inactive") {
          params.append("active", "false");
        } else if (statusFilter === "featured") {
          params.append("featured", "true");
        }
      }

      // Add tab-based filters
      if (activeTab === "youtube") {
        params.append("type", "Youtube");
      } else if (activeTab === "shorts") {
        params.append("type", "Shorts");
      } else if (activeTab === "featured") {
        params.append("featured", "true");
      } else if (activeTab === "active") {
        params.append("active", "true");
      } else if (activeTab === "inactive") {
        params.append("active", "false");
      }

      const response = await axiosInstance.get(`/api/youtube-binge?${params.toString()}`);

      // Handle response with pagination
      const videosData = response.data.videos || [];
      const paginationData = response.data.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalCount: videosData.length,
        limit: itemsPerPage,
        hasNextPage: false,
        hasPrevPage: false,
      };

      setVideos(videosData);
      setFilteredVideos(videosData);
      setPagination(paginationData);
    } catch (error) {
      console.error("Error fetching videos:", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch videos",
        color: "red",
      });
      setVideos([]);
      setFilteredVideos([]);
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

  // Fetch tags, categories, and users for the form
  const fetchFormData = async () => {
    try {
      // Fetch tags
      try {
        const tagsResponse = await axiosInstance.get("/api/tags");
        const tagOptions = tagsResponse.data.map((tag: Tag) => ({
          value: tag._id,
          label: tag.name,
        }));
        setTags(tagOptions);
      } catch (error) {
        console.error("Error fetching tags:", error);
        setTags([]);
      }

      // Fetch categories - using lesson categories as a fallback
      try {
        const params = new URLSearchParams({
          type: "binge",
        });
        const categoriesResponse = await axiosInstance.get(
          `/api/categories?${params.toString()}`
        );
        const categoryOptions = categoriesResponse.data.map(
          (category: Category) => ({
            value: category._id,
            label: category.name,
          })
        );
        setCategories(categoryOptions);
      } catch (categoryError) {
        console.error("Error fetching categories:", categoryError);

        // Try fetching lesson categories as a fallback
        try {
          const lessonCategoriesResponse = await axiosInstance.get(
            "/api/categories/lessons-categories"
          );
          const lessonCategoryOptions = lessonCategoriesResponse.data.map(
            (category: Category) => ({
              value: category._id,
              label: category.name,
            })
          );
          setCategories(lessonCategoryOptions);
        } catch (lessonCategoryError) {
          console.error(
            "Error fetching lesson categories:",
            lessonCategoryError
          );
          setCategories([]);
        }
      }

      // Fetch users (instructors and influencers)
      try {
        const usersResponse = await axiosInstance.get(
          "/api/user/role/instructor"
        );
        const influencersResponse = await axiosInstance.get(
          "/api/user/role/influencer"
        );

        const allUsers = [
          ...(usersResponse.data || []),
          ...(influencersResponse.data || []),
        ];
        const userOptions = allUsers.map((user: User) => ({
          value: user._id,
          label: `${user.name || "Unknown"} (${
            user.userName || "No username"
          })`,
        }));
        setUsers(userOptions);
      } catch (userError) {
        console.error("Error fetching users:", userError);
        setUsers([]);
      }
    } catch (error) {
      console.error("General error in fetchFormData:", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch form data",
        color: "red",
      });
    }
  };

  // Handle pagination change
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle status filter change
  const handleStatusFilterChange = (value: string | null) => {
    setStatusFilter(value);
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
    setStatusFilter(null);
    setSortBy("newest");
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  useEffect(() => {
    fetchVideos();
    fetchFormData();

    // Check for edit query parameter
    const searchParams = new URLSearchParams(window.location.search);
    const editId = searchParams.get("edit");
    if (editId) {
      handleEditFromUrl(editId);
    }
  }, []);

  // Handle editing from URL parameter (when coming from details page)
  const handleEditFromUrl = async (videoId: string) => {
    try {
      const response = await axiosInstance.get(`/api/youtube-binge/${videoId}`);
      const videoToEdit = response.data;
      handleEditVideo(videoToEdit);
    } catch (error) {
      console.error("Error fetching video to edit:", error);
      notifications.show({
        title: "Error",
        message: "Failed to load video for editing",
        color: "red",
      });
    }
  };

  // Refetch videos when pagination, search, sort, or tab changes
  useEffect(() => {
    fetchVideos();
  }, [pagination.currentPage, itemsPerPage, sortBy, activeTab, statusFilter]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pagination.currentPage !== 1) {
        setPagination(prev => ({ ...prev, currentPage: 1 }));
      } else {
        fetchVideos();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle select changes
  const handleSelectChange = (name: string, value: any) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Open modal for creating a new video
  const handleCreateVideo = () => {
    setEditMode(false);
    setCurrentVideo(null);
    setFormData({
      title: "",
      description: "",
      videoUrl: "",
      tags: [],
      users: [],
      categories: [],
      isFeatured: false,
      type: "Youtube",
      duration: 0,
      xpValue: 0,
    });
    setThumbnail(null);
    open();
  };

  // Open modal for editing a video
  const handleEditVideo = (video: YoutubeBinge) => {
    setEditMode(true);
    setCurrentVideo(video);
    setFormData({
      title: video.title || "",
      description: video.description || "",
      videoUrl: video.videoUrl || "",
      tags: video.tags ? video.tags.map((tag) => tag?._id).filter(Boolean) : [],
      users: video.users
        ? video.users.map((user) => user?._id).filter(Boolean)
        : [],
      categories: video.categories
        ? video.categories.map((category) => category?._id).filter(Boolean)
        : [],
      isFeatured: video.isFeatured || false,
      type: video.type || "Youtube",
      duration: video.duration || 0,
      xpValue: video.xpValue || 0,
    });
    setThumbnail(null);
    open();
  };

  // Toggle video featured status
  const toggleFeatured = async (video: YoutubeBinge) => {
    try {
      await axiosInstance.patch(
        `/api/youtube-binge/${video._id}/toggle-featured`
      );
      notifications.show({
        title: "Success",
        message: `Video ${
          video.isFeatured ? "unfeatured" : "featured"
        } successfully`,
        color: "green",
      });
      fetchVideos();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to update featured status",
        color: "red",
      });
    }
  };

  // Toggle video active status
  const toggleActive = async (video: YoutubeBinge) => {
    try {
      await axiosInstance.patch(
        `/api/youtube-binge/${video._id}/toggle-active`
      );
      notifications.show({
        title: "Success",
        message: `Video ${
          video.isActive ? "deactivated" : "activated"
        } successfully`,
        color: "green",
      });
      fetchVideos();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to update active status",
        color: "red",
      });
    }
  };

  // Submit form for creating or updating a video
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("title", formData.title);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("videoUrl", formData.videoUrl);
      formDataToSend.append("type", formData.type);
      formDataToSend.append("duration", formData.duration.toString());
      formDataToSend.append("xpValue", formData.xpValue.toString());
      formDataToSend.append("isFeatured", formData.isFeatured.toString());

      // Append arrays
      formData.tags.forEach((tag) => {
        formDataToSend.append("tags", tag);
      });

      formData.users.forEach((user) => {
        formDataToSend.append("users", user);
      });

      formData.categories.forEach((category) => {
        formDataToSend.append("categories", category);
      });

      // Append thumbnail if exists
      if (thumbnail) {
        formDataToSend.append("thumbnail", thumbnail);
      }

      if (editMode && currentVideo) {
        // Update existing video
        await axiosInstance.put(
          `/api/youtube-binge/${currentVideo._id}`,
          formDataToSend,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        notifications.show({
          title: "Success",
          message: "Video updated successfully",
          color: "green",
        });
      } else {
        // Create new video
        await axiosInstance.post("/api/youtube-binge", formDataToSend, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        notifications.show({
          title: "Success",
          message: "Video created successfully",
          color: "green",
        });
      }

      // Close modal and refresh videos
      close();
      fetchVideos();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.response?.data?.message || "Failed to save video",
        color: "red",
      });
    }
  };

  // Delete a video
  const handleDeleteVideo = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this video?")) {
      try {
        await axiosInstance.delete(`/api/youtube-binge/${id}`);
        notifications.show({
          title: "Success",
          message: "Video deleted successfully",
          color: "green",
        });
        fetchVideos();
      } catch (error) {
        notifications.show({
          title: "Error",
          message: "Failed to delete video",
          color: "red",
        });
      }
    }
  };

  // Format duration in minutes:seconds
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <Container size="xl">
      <Paper p="md" shadow="xs" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={2}>YouTube Binge Content</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreateVideo}
          >
            Add New Video
          </Button>
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab} mb="md">
          <Tabs.List>
            <Tabs.Tab value="all">All Videos</Tabs.Tab>
            <Tabs.Tab value="youtube">YouTube</Tabs.Tab>
            <Tabs.Tab value="shorts">Shorts</Tabs.Tab>
            <Tabs.Tab value="featured">Featured</Tabs.Tab>
            <Tabs.Tab value="active">Active</Tabs.Tab>
            <Tabs.Tab value="inactive">Inactive</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* Search and Filter Controls */}
        <Paper p="md" mb="md" withBorder>
          <Stack>
            <Flex gap="md" wrap="wrap" align="end">
              <TextInput
                placeholder="Search videos by title, description, or tags..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={handleSearchChange}
                style={{ flex: 1, minWidth: 200 }}
              />
              <Select
                placeholder="Filter by status"
                data={[
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                  { value: "featured", label: "Featured" },
                ]}
                value={statusFilter}
                onChange={handleStatusFilterChange}
                clearable
                leftSection={<IconFilter size={16} />}
                style={{ minWidth: 150 }}
              />
              <Select
                placeholder="Sort by"
                data={[
                  { value: "newest", label: "Newest First" },
                  { value: "oldest", label: "Oldest First" },
                  { value: "popular", label: "Most Popular" },
                  { value: "likes", label: "Most Liked" },
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
                Showing {filteredVideos.length} of {pagination.totalCount} videos
              </Text>
            </Group>
          </Stack>
        </Paper>

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
        ) : filteredVideos.length === 0 ? (
          <Text ta="center" py="xl" c="dimmed">
            {searchQuery || statusFilter 
              ? "No videos found matching your search criteria." 
              : "No videos found. Create your first video!"
            }
          </Text>
        ) : (
          <>
            <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Thumbnail</Table.Th>
                <Table.Th>Title</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Featured</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Views</Table.Th>
                {/* <Table.Th>Likes</Table.Th> */}
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredVideos.map((video) => (
                <Table.Tr key={video._id}>
                  <Table.Td className="w-1/7">
                    {video.thumbnailUrl ? (
                      <Image
                        src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${video.thumbnailUrl}`}
                        height={50}
                        width={80}
                        fit="cover"
                        alt={video.title}
                        fallbackSrc="https://placehold.co/80x50?text=No+Image"
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          router.push(
                            `/dashboard/binge-content/video-details/${video._id}`
                          )
                        }
                      />
                    ) : (
                      <div
                        style={{
                          width: 80,
                          height: 50,
                          backgroundColor: "#f0f0f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          router.push(
                            `/dashboard/binge-content/video-details/${video._id}`
                          )
                        }
                      >
                        <IconPhoto size={24} color="#aaa" />
                      </div>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text
                      lineClamp={1}
                      style={{ maxWidth: "200px", cursor: "pointer" }}
                      onClick={() =>
                        router.push(
                          `/dashboard/binge-content/video-details/${video._id}`
                        )
                      }
                    >
                      {video.title}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={video.type === "Youtube" ? "blue" : "pink"}>
                      {video.type}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <IconClockHour3 size={16} />
                      <Text>{formatDuration(video.duration)}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      color={video.isFeatured ? "yellow" : "gray"}
                      onClick={() => toggleFeatured(video)}
                    >
                      {video.isFeatured ? (
                        <IconStarFilled size={18} />
                      ) : (
                        <IconStar size={18} />
                      )}
                    </ActionIcon>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={video.isActive ? "green" : "red"}
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleActive(video)}
                    >
                      {video.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <IconEye size={16} />
                      <Text>{video.views.toLocaleString()}</Text>
                    </Group>
                  </Table.Td>
                  {/* <Table.Td>
                    <Group gap="xs">
                      <IconThumbUp size={16} />
                      <Text>{video.likes.toLocaleString()}</Text>
                    </Group>
                  </Table.Td> */}
                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip label="View Details">
                        <ActionIcon
                          variant="subtle"
                          color="teal"
                          onClick={() =>
                            router.push(
                              `/dashboard/binge-content/video-details/${video._id}`
                            )
                          }
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Edit">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => handleEditVideo(video)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip
                        label={video.isActive ? "Deactivate" : "Activate"}
                      >
                        <ActionIcon
                          variant="subtle"
                          color={video.isActive ? "orange" : "green"}
                          onClick={() => toggleActive(video)}
                        >
                          {video.isActive ? (
                            <IconCircleX size={16} />
                          ) : (
                            <IconCircleCheck size={16} />
                          )}
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => handleDeleteVideo(video._id)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
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

      {/* Modal for creating/editing videos */}
      <Modal
        opened={opened}
        onClose={close}
        title={editMode ? "Edit Video" : "Add New Video"}
        size="lg"
        centered
      >
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter video title"
            required
            mb="md"
          />

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter video description"
            minRows={3}
            mb="md"
          />

          <TextInput
            label="Video URL"
            name="videoUrl"
            value={formData.videoUrl}
            onChange={handleChange}
            placeholder="Enter YouTube video URL"
            required
            mb="md"
          />

          <Group grow mb="md">
            <Select
              label="Content Type"
              value={formData.type}
              onChange={(value) => handleSelectChange("type", value)}
              data={[
                { value: "Youtube", label: "YouTube Video" },
                { value: "Shorts", label: "YouTube Short" },
              ]}
            />

            <NumberInput
              label="Duration (seconds)"
              value={formData.duration}
              onChange={(value) => handleSelectChange("duration", value)}
              placeholder="Enter duration in seconds"
              min={0}
            />
          </Group>

          <Group grow mb="md">
            <NumberInput
              label="XP Value"
              value={formData.xpValue}
              onChange={(value) => handleSelectChange("xpValue", value)}
              placeholder="Enter XP value for completion"
              min={0}
            />
          </Group>

          <MultiSelect
            label="Tags"
            data={tags}
            value={formData.tags}
            onChange={(value) => handleSelectChange("tags", value)}
            placeholder="Select tags"
            searchable
            mb="md"
          />

          <MultiSelect
            label="Categories"
            data={categories}
            value={formData.categories}
            onChange={(value) => handleSelectChange("categories", value)}
            placeholder="Select categories"
            searchable
            mb="md"
          />

          <MultiSelect
            label="Users"
            data={users}
            value={formData.users}
            onChange={(value) => handleSelectChange("users", value)}
            placeholder="Select users"
            searchable
            mb="md"
          />

          <FileInput
            label="Thumbnail"
            placeholder="Upload thumbnail image"
            accept="image/png,image/jpeg,image/webp"
            value={thumbnail}
            onChange={setThumbnail}
            leftSection={<IconPhoto size={rem(16)} />}
            clearable
            mb="md"
          />

          <Switch
            label="Featured"
            checked={formData.isFeatured}
            onChange={(event) =>
              handleSelectChange("isFeatured", event.currentTarget.checked)
            }
            mb="xl"
          />

          {editMode && currentVideo && currentVideo.thumbnailUrl && (
            <div style={{ marginBottom: "1rem" }}>
              <Text size="sm" fw={500} mb="xs">
                Current Thumbnail:
              </Text>
              <Image
                src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${currentVideo.thumbnailUrl}`}
                height={100}
                width={180}
                fit="cover"
                alt="Current thumbnail"
                mb="md"
              />
            </div>
          )}

          <Group justify="flex-end" mt="xl">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16} />}>
              {editMode ? "Update" : "Save"}
            </Button>
          </Group>
        </form>
      </Modal>
    </Container>
  );
}
