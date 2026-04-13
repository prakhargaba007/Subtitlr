"use client";

import React, { useState, useEffect } from "react";
import {
  Container,
  Title,
  Button,
  Group,
  Card,
  Text,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Stack,
  Grid,
  Pagination,
  TextInput as SearchInput,
  Box,
  Alert,
  LoadingOverlay,
  Table,
  ScrollArea,
  FileInput,
  Image,
  Paper,
  Flex,
} from "@mantine/core";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconEye,
  IconUpload,
  IconFilter,
} from "@tabler/icons-react";
// import axios from "axios";
import axiosInstance from "@/utils/axios";
import BadgeIcon from "@/components/BadgeIcon";

interface BadgeData {
  _id: string;
  name: string;
  description: string;
  icon: string;
  level: string;
  category: string;
  criteria: {
    count?: number;
    xp?: number;
    rank?: string;
    [key: string]: any;
  };
  isActive: boolean;
  createdAt: string;
}

interface BadgeStats {
  totalBadges: number;
  activeBadges: number;
  inactiveBadges: number;
  byCategory: Array<{ _id: string; count: number }>;
  byLevel: Array<{ _id: string; count: number }>;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const BadgesPage = () => {
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [stats, setStats] = useState<BadgeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [currentBadge, setCurrentBadge] = useState<BadgeData | null>(null);
  
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
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterLevel, setFilterLevel] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [sortBy, setSortBy] = useState("newest");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "",
    level: "",
    category: "",
    criteria: {} as {
      count?: number;
      xp?: number;
      rank?: string;
      [key: string]: any;
    },
    isActive: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const categoryOptions = [
    { value: "video_watch", label: "Video Watch" },
    { value: "game_play", label: "Game Play" },
    // { value: "quiz_answer", label: "Quiz Answer" },
    // { value: "app_watchtime", label: "App Watchtime" },
    // { value: "top_player", label: "Top Player" },
    { value: "xp_milestone", label: "XP Milestone" },
  ];

  const levelOptions = [
    { value: "Bronze", label: "Bronze" },
    { value: "Silver", label: "Silver" },
    { value: "Gold", label: "Gold" },
    { value: "Diamond", label: "Diamond" },
  ];

  const statusOptions = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ];

  useEffect(() => {
    fetchBadges();
    fetchStats();
  }, []);

  // Refetch badges when pagination, search, or filters change
  useEffect(() => {
    fetchBadges();
  }, [pagination.currentPage, itemsPerPage, sortBy, filterCategory, filterLevel, filterStatus]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pagination.currentPage !== 1) {
        setPagination(prev => ({ ...prev, currentPage: 1 }));
      } else {
        fetchBadges();
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
    setFilterCategory("");
    setFilterLevel("");
    setFilterStatus("");
    setSortBy("newest");
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const fetchBadges = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchQuery,
        sort: "createdAt",
        order: "desc",
      });

      if (filterCategory) params.append("category", filterCategory);
      if (filterLevel) params.append("level", filterLevel);
      if (filterStatus) params.append("isActive", filterStatus);

      const response = await axiosInstance.get(`/api/badges?${params}`);
      const badgesData = response.data.badges || [];
      const paginationData = response.data.pagination || {
        currentPage: 1,
        totalPages: 1,
        totalCount: badgesData.length,
        limit: itemsPerPage,
        hasNextPage: false,
        hasPrevPage: false,
      };

      setBadges(badgesData);
      setPagination(paginationData);
    } catch (error: any) {
      console.error("Error fetching badges:", error);
      setError(error.response?.data?.message || "Failed to fetch badges");
      setBadges([]);
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

  const fetchStats = async () => {
    try {
      const response = await axiosInstance.get("/api/badges/stats");
      setStats(response.data);
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      // Don't show error for stats, just fail silently
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      icon: "",
      level: "",
      category: "",
      criteria: {} as {
        count?: number;
        xp?: number;
        rank?: string;
        [key: string]: any;
      },
      isActive: true,
    });
    setSelectedFile(null);
    setPreviewUrl("");
  };

  const openCreateModal = () => {
    resetForm();
    setCreateModalOpen(true);
  };

  const openEditModal = (badge: BadgeData) => {
    setCurrentBadge(badge);
    setFormData({
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      level: badge.level,
      category: badge.category,
      criteria: badge.criteria,
      isActive: badge.isActive,
    });
    setSelectedFile(null);
    setPreviewUrl(badge.icon || "");
    setEditModalOpen(true);
  };

  const openViewModal = (badge: BadgeData) => {
    setCurrentBadge(badge);
    setViewModalOpen(true);
  };

  // Helper function to get full image URL
  const getImageUrl = (iconPath: string) => {
    if (!iconPath) return "";
    // if (iconPath.startsWith("http")) return iconPath;
    // if (iconPath.startsWith("/"))
    //   return `${
    //     process.env.NEXT_PUBLIC_S3_BASE_URL || "http://localhost:8080"
    //   }${iconPath}`;
    // console.log(
    //   "`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/${iconPath}`",
    //   `${
    //     process.env.NEXT_PUBLIC_S3_BASE_URL || "http://localhost:8080"
    //   }/${iconPath}`
    // );

    return `${
      process.env.NEXT_PUBLIC_S3_BASE_URL || "http://localhost:8080"
    }/${iconPath}`;
  };

  const handleFileChange = (file: File | null) => {
    // Clean up previous URL
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl("");
    }
  };

  // Cleanup effect for URL objects
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);

      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append("name", formData.name);
      submitData.append("description", formData.description);
      submitData.append("level", formData.level);
      submitData.append("category", formData.category);
      submitData.append("criteria", JSON.stringify(formData.criteria));
      submitData.append("isActive", formData.isActive.toString());

      // Add file if selected
      if (selectedFile) {
        submitData.append("badgeIcon", selectedFile);
      } else if (!createModalOpen && formData.icon) {
        // For edit mode, if no new file selected, keep existing icon
        submitData.append("icon", formData.icon);
      }

      if (createModalOpen) {
        await axiosInstance.post("/api/badges", submitData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        await axiosInstance.put(
          `/api/badges/${currentBadge?._id}`,
          submitData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      }

      setCreateModalOpen(false);
      setEditModalOpen(false);
      resetForm();
      fetchBadges();
      fetchStats();
    } catch (error: any) {
      console.error("Error saving badge:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.msg ||
        "Error saving badge";
      setError(errorMessage);
    }
  };

  const handleDelete = async (badgeId: string) => {
    if (confirm("Are you sure you want to delete this badge?")) {
      try {
        setError(null);
        await axiosInstance.delete(`/api/badges/${badgeId}`);
        fetchBadges();
        fetchStats();
      } catch (error: any) {
        console.error("Error deleting badge:", error);
        const errorMessage =
          error.response?.data?.message || "Error deleting badge";
        setError(errorMessage);
      }
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Bronze":
        return "orange";
      case "Silver":
        return "gray";
      case "Gold":
        return "yellow";
      case "Diamond":
        return "blue";
      default:
        return "gray";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "video_watch":
        return "blue";
      case "game_play":
        return "green";
      case "quiz_answer":
        return "purple";
      case "app_watchtime":
        return "cyan";
      case "top_player":
        return "red";
      case "xp_milestone":
        return "teal";
      default:
        return "gray";
    }
  };

  const formatCriteria = (criteria: any) => {
    if (!criteria || typeof criteria !== "object") return "No criteria set";

    if (criteria.count) return `Complete ${criteria.count} activities`;
    if (criteria.xp) return `Reach ${criteria.xp} XP`;
    if (criteria.rank) return `Achieve rank ${criteria.rank.replace("_", " ")}`;

    // Fallback for other criteria structures
    const entries = Object.entries(criteria);
    if (entries.length === 0) return "No criteria set";

    return entries.map(([key, value]) => `${key}: ${value}`).join(", ");
  };

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading} />

      <Group justify="space-between" mb="lg">
        <Title order={2}>Badges Management</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
          Create Badge
        </Button>
      </Group>

      {/* Error Alert */}
      {error && (
        <Alert
          color="red"
          mb="lg"
          onClose={() => setError(null)}
          withCloseButton
        >
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      {/* {stats && (
        <Grid mb="lg">
          <Grid.Col span={4}>
            <Card shadow="sm" padding="lg">
              <Text size="lg" fw={500} c="blue">
                Total Badges
              </Text>
              <Text size="xl" fw={700}>
                {stats.totalBadges}
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={4}>
            <Card shadow="sm" padding="lg">
              <Text size="lg" fw={500} c="green">
                Active Badges
              </Text>
              <Text size="xl" fw={700}>
                {stats.activeBadges}
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={4}>
            <Card shadow="sm" padding="lg">
              <Text size="lg" fw={500} c="orange">
                Inactive Badges
              </Text>
              <Text size="xl" fw={700}>
                {stats.inactiveBadges}
              </Text>
            </Card>
          </Grid.Col>
          <Grid.Col span={3}>
            <Card shadow="sm" padding="lg">
              <Text size="lg" fw={500} c="purple">
                Categories
              </Text>
              <Text size="xl" fw={700}>
                {stats.byCategory?.length || 0}
              </Text>
            </Card>
          </Grid.Col>
        </Grid>
      )} */}

      {/* Search and Filter Controls */}
      <Paper p="md" mb="lg" withBorder>
        <Stack>
          <Flex gap="md" wrap="wrap" align="end">
            <TextInput
              placeholder="Search badges by name or description..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={handleSearchChange}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Select
              placeholder="Category"
              value={filterCategory}
              onChange={(value) => setFilterCategory(value || "")}
              data={[{ value: "", label: "All Categories" }, ...categoryOptions]}
              clearable
              leftSection={<IconFilter size={16} />}
              style={{ minWidth: 150 }}
            />
            <Select
              placeholder="Level"
              value={filterLevel}
              onChange={(value) => setFilterLevel(value || "")}
              data={[{ value: "", label: "All Levels" }, ...levelOptions]}
              clearable
              style={{ minWidth: 150 }}
            />
            <Select
              placeholder="Status"
              value={filterStatus}
              onChange={(value) => setFilterStatus(value || "")}
              data={[{ value: "", label: "All Status" }, ...statusOptions]}
              clearable
              style={{ minWidth: 150 }}
            />
            {/* <Select
              placeholder="Sort by"
              data={[
                { value: "newest", label: "Newest First" },
                { value: "oldest", label: "Oldest First" },
                { value: "name", label: "Name A-Z" },
                { value: "level", label: "Level" },
              ]}
              value={sortBy}
              onChange={handleSortChange}
              style={{ minWidth: 150 }}
            /> */}
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
              Showing {badges.length} of {pagination.totalCount} badges
            </Text>
          </Group>
        </Stack>
      </Paper>

      {/* Badges Table */}
      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "50px",
          }}
        >
          <LoadingOverlay visible={true} />
        </div>
      ) : badges.length === 0 ? (
        <Text ta="center" py="xl" c="dimmed">
          {searchQuery || filterCategory || filterLevel || filterStatus 
            ? "No badges found matching your search criteria." 
            : "No badges found. Create your first badge!"
          }
        </Text>
      ) : (
        <Card shadow="sm">
          <ScrollArea>
            <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Icon</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Level</Table.Th>
                <Table.Th>Criteria</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {badges.map((badge) => (
                <Table.Tr key={badge._id}>
                  <Table.Td>
                    {badge.icon &&
                    (badge.icon.startsWith("/") ||
                      badge.icon.startsWith("http") ||
                      badge.icon.startsWith("")) ? (
                      <Image
                        src={getImageUrl(badge.icon)}
                        alt={badge.name}
                        width={40}
                        height={40}
                        fit="contain"
                        style={{
                          borderRadius: 4,
                          objectFit: "contain",
                          width: 70,
                          height: 70,
                        }}
                      />
                    ) : (
                      <div className="w-[70px] h-[70px] flex items-center justify-center">
                        No Image
                      </div>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>{badge.name}</Text>
                    <Text size="sm" c="dimmed">
                      {badge.description}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getCategoryColor(badge.category)}>
                      {badge.category.replace("_", " ")}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getLevelColor(badge.level)}>
                      {badge.level}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatCriteria(badge.criteria)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={badge.isActive ? "green" : "red"}>
                      {badge.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => openViewModal(badge)}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="orange"
                        onClick={() => openEditModal(badge)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(badge._id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>

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
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        opened={createModalOpen || editModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditModalOpen(false);
          setError(null);
          resetForm();
        }}
        title={createModalOpen ? "Create Badge" : "Edit Badge"}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <Stack>
            {/* Error Alert in Modal */}
            {error && (
              <Alert color="red" mb="md">
                {error}
              </Alert>
            )}

            <TextInput
              label="Badge Name"
              placeholder="Enter badge name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
            <Textarea
              label="Description"
              placeholder="Enter badge description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              required
            />
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                Badge Icon
              </Text>
              <FileInput
                placeholder="Choose badge icon image"
                accept="image/*"
                value={selectedFile}
                onChange={handleFileChange}
                leftSection={<IconUpload size={16} />}
              />
              {formData.icon && (
                <Card withBorder p="sm" style={{ width: "fit-content" }}>
                  <Image
                    src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${formData.icon}`}
                    alt="Badge icon preview"
                    width={60}
                    height={60}
                    fit="contain"
                  />
                </Card>
              )}
              {!previewUrl && formData.icon && !selectedFile && (
                <Card withBorder p="sm" style={{ width: "fit-content" }}>
                  <Image
                    src={getImageUrl(formData.icon)}
                    alt="Current badge icon"
                    width={60}
                    height={60}
                    fit="contain"
                    fallbackSrc=""
                  />
                  <Text size="xs" c="dimmed" ta="center" mt="xs">
                    Current icon
                  </Text>
                </Card>
              )}
            </Stack>
            <Group grow>
              <Select
                label="Category"
                placeholder="Select category"
                value={formData.category}
                onChange={(value) =>
                  setFormData({ ...formData, category: value || "" })
                }
                data={categoryOptions}
                required
              />
              <Select
                label="Level"
                placeholder="Select level"
                value={formData.level}
                onChange={(value) =>
                  setFormData({ ...formData, level: value || "" })
                }
                data={levelOptions}
                required
              />
            </Group>

            {/* Criteria Section */}
            <Card withBorder p="md">
              <Text fw={500} mb="sm">
                Criteria
              </Text>
              <Group grow>
                <NumberInput
                  label="Count/Value"
                  placeholder="e.g., 50 for 50 videos"
                  value={
                    formData.criteria?.count || formData.criteria?.xp || ""
                  }
                  onChange={(value) => {
                    const criteria = { ...formData.criteria };
                    const numValue =
                      typeof value === "string"
                        ? parseInt(value) || 0
                        : value || 0;
                    if (formData.category === "xp_milestone") {
                      criteria.xp = numValue;
                    } else {
                      criteria.count = numValue;
                    }
                    setFormData({ ...formData, criteria });
                  }}
                />
                {formData.category === "top_player" && (
                  <Select
                    label="Rank Type"
                    placeholder="Select rank type"
                    value={formData.criteria?.rank || ""}
                    onChange={(value) => {
                      const criteria = {
                        ...formData.criteria,
                        rank: value || undefined,
                      };
                      setFormData({ ...formData, criteria });
                    }}
                    data={[
                      { value: "top_week", label: "Top of Week" },
                      { value: "top_month", label: "Top of Month" },
                      { value: "top_year", label: "Top of Year" },
                    ]}
                  />
                )}
              </Group>
            </Card>

            <Select
              label="Status"
              value={formData.isActive ? "true" : "false"}
              onChange={(value) =>
                setFormData({ ...formData, isActive: value === "true" })
              }
              data={[
                { value: "true", label: "Active" },
                { value: "false", label: "Inactive" },
              ]}
            />

            <Group justify="flex-end">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateModalOpen(false);
                  setEditModalOpen(false);
                  setError(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit">
                {createModalOpen ? "Create Badge" : "Update Badge"}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        opened={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title="Badge Details"
        size="md"
      >
        {currentBadge && (
          <Stack>
            {/* {currentBadge.icon &&
            (currentBadge.icon.startsWith("/") ||
              currentBadge.icon.startsWith("http")) ? (
              <Box style={{ textAlign: "center" }}>
                <Image
                  src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${currentBadge.icon}`}
                  alt={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${currentBadge.icon}`}
                  width={80}
                  height={80}
                  fit="contain"
                  style={{ borderRadius: 8 }}
                />
                <Text size="lg" fw={500} mt="sm">
                  {currentBadge.name}
                </Text>
                <Badge color={getLevelColor(currentBadge.level)} mt="xs">
                  {currentBadge.level}
                </Badge>
              </Box>
            ) : (
              <BadgeIcon
                icon={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${currentBadge.icon}`}
                name={currentBadge.name}
                level={currentBadge.level}
                category={currentBadge.category}
                size="lg"
                showLabels={true}
              />
            )} */}
            <Box style={{ textAlign: "center" }}>
              <Image
                src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${currentBadge.icon}`}
                alt={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${currentBadge.icon}`}
                width={80}
                height={80}
                fit="contain"
                style={{ borderRadius: 8 }}
              />
              <Text size="lg" fw={500} mt="sm">
                {currentBadge.name}
              </Text>
              <Badge color={getLevelColor(currentBadge.level)} mt="xs">
                {currentBadge.level}
              </Badge>
            </Box>
            <Text c="dimmed">{currentBadge.description}</Text>

            <Group>
              <Badge color={currentBadge.isActive ? "green" : "red"}>
                {currentBadge.isActive ? "Active" : "Inactive"}
              </Badge>
            </Group>

            <Card withBorder p="md">
              <Text fw={500} mb="sm">
                Criteria
              </Text>
              <Text>{formatCriteria(currentBadge.criteria)}</Text>
            </Card>

            <Text size="sm" c="dimmed">
              Created: {new Date(currentBadge.createdAt).toLocaleDateString()}
            </Text>
          </Stack>
        )}
      </Modal>
    </Container>
  );
};

export default BadgesPage;
