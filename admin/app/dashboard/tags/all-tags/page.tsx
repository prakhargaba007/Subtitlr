"use client";
import React, { useState, useEffect } from "react";
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
  Pagination,
  Stack,
  Flex,
  Select,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconCircleCheck,
  IconCircleX,
  IconUxCircle,
  IconSearch,
  IconFilter,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";

interface Tag {
  _id: string;
  name: string;
  description: string;
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

export default function AllTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [editMode, setEditMode] = useState(false);
  const [currentTag, setCurrentTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

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
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Fetch all tags
  const fetchTags = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
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

      const response = await axiosInstance.get(`/api/tags?${params}`);
      setTags(response.data.tags);
      setPagination(response.data.pagination);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch tags",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [pagination.currentPage, itemsPerPage, sortBy, sortOrder, searchQuery, statusFilter]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pagination.currentPage !== 1) {
        setPagination(prev => ({ ...prev, currentPage: 1 }));
      } else {
        fetchTags();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, statusFilter]);

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
  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter(null);
    setSortBy("name");
    setSortOrder("asc");
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  // Open modal for creating a new tag
  const handleCreateTag = () => {
    setEditMode(false);
    setFormData({ name: "", description: "" });
    open();
  };

  // Open modal for editing a tag
  const handleEditTag = (tag: Tag) => {
    setEditMode(true);
    setCurrentTag(tag);
    setFormData({
      name: tag.name,
      description: tag.description || "",
    });
    open();
  };

  // Toggle tag active status
  const toggleTagStatus = async (tag: Tag) => {
    if (window.confirm("Are you sure you want to delete this tag?")) {
      try {
        await axiosInstance.put(`/api/tags/${tag._id}`, {
          isActive: !tag.isActive,
        });
        notifications.show({
          title: "Success",
          message: `Tag ${
            tag.isActive ? "deactivated" : "activated"
          } successfully`,
          color: "green",
        });
        fetchTags();
      } catch (error) {
        notifications.show({
          title: "Error",
          message: "Failed to update tag status",
          color: "red",
        });
      }
    }
  };

  // Submit form for creating or updating a tag
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editMode && currentTag) {
        // Update existing tag
        await axiosInstance.put(`/api/tags/${currentTag._id}`, formData);
        notifications.show({
          title: "Success",
          message: "Tag updated successfully",
          color: "green",
        });
      } else {
        // Create new tag
        await axiosInstance.post("/api/tags", formData);
        notifications.show({
          title: "Success",
          message: "Tag created successfully",
          color: "green",
        });
      }

      // Close modal and refresh tags
      close();
      fetchTags();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.response?.data?.message || "Failed to save tag",
        color: "red",
      });
    }
  };

  // Delete a tag
  const handleDeleteTag = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this tag?")) {
      try {
        await axiosInstance.delete(`/api/tags/${id}`);
        notifications.show({
          title: "Success",
          message: "Tag deleted successfully",
          color: "green",
        });
        fetchTags();
      } catch (error) {
        notifications.show({
          title: "Error",
          message: "Failed to delete tag",
          color: "red",
        });
      }
    }
  };

  return (
    <Container size="xl">
      <Paper p="md" shadow="xs" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={2}>All Tags</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreateTag}
          >
            Create New Tag
          </Button>
        </Group>

        {/* Search and Filter Controls */}
        <Paper p="md" mb="md" withBorder>
          <Stack>
            <Flex gap="md" wrap="wrap" align="end">
              <TextInput
                placeholder="Search tags..."
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
                ]}
                value={statusFilter}
                onChange={handleStatusFilterChange}
                clearable
                leftSection={<IconFilter size={16} />}
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
                Showing {tags.length} of {pagination.totalCount} tags
              </Text>
              {/* <Group gap="xs">
                <Text size="sm">Sort by:</Text>
                <Button
                  variant={sortBy === "name" ? "filled" : "outline"}
                  size="xs"
                  onClick={() => handleSortChange("name")}
                >
                  Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant={sortBy === "createdAt" ? "filled" : "outline"}
                  size="xs"
                  onClick={() => handleSortChange("createdAt")}
                >
                  Date {sortBy === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
              </Group> */}
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
        ) : tags.length === 0 ? (
          <Text ta="center" py="xl" c="dimmed">
            {searchQuery || statusFilter 
              ? "No tags found matching your search criteria." 
              : "No tags found. Create your first tag!"
            }
          </Text>
        ) : (
          <>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created At</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tags.map((tag) => (
                  <Table.Tr key={tag._id}>
                    <Table.Td>{tag.name}</Table.Td>
                    <Table.Td className="" w="50%">
                      {tag.description || "-"}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={tag.isActive ? "green" : "red"}
                        style={{ cursor: "pointer" }}
                        onClick={() => toggleTagStatus(tag)}
                      >
                        {tag.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {new Date(tag.createdAt).toLocaleDateString()}
                    </Table.Td>
                    <Table.Td>
                      <Group>
                        <Tooltip label="Edit">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => handleEditTag(tag)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label={tag.isActive ? "Deactivate" : "Activate"}>
                          <ActionIcon
                            variant="subtle"
                            color={tag.isActive ? "orange" : "green"}
                            onClick={() => toggleTagStatus(tag)}
                          >
                            {tag.isActive ? (
                              <IconUxCircle size={16} />
                            ) : (
                              <IconCircleCheck size={16} />
                            )}
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeleteTag(tag._id)}
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

      {/* Modal for creating/editing tags */}
      <Modal
        opened={opened}
        onClose={close}
        title={editMode ? "Edit Tag" : "Create New Tag"}
        centered
      >
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Tag Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter tag name"
            required
            mb="md"
          />

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter tag description (optional)"
            mb="xl"
          />

          <Group justify="flex-end">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">{editMode ? "Update" : "Create"}</Button>
          </Group>
        </form>
      </Modal>
    </Container>
  );
}
