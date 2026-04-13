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
  ColorInput,
  NumberInput,
  FileInput,
  Image,
  Card,
  SimpleGrid,
  rem,
  Select,
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
  IconCategory,
  IconSearch,
  IconFilter,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";

interface LessonCategory {
  _id: string;
  name: string;
  description: string;
  imageUrl?: string;
  iconUrl?: string;
  color: string;
  isActive: boolean;
  order: number;
  type: string;
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

export default function LessonCategories() {
  const [categories, setCategories] = useState<LessonCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<LessonCategory | null>(
    null
  );
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3498db",
    order: 0,
    type: "N/A",
  });
  const [categoryImage, setCategoryImage] = useState<File | null>(null);
  const [categoryIcon, setCategoryIcon] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

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
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("order");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Fetch all categories
  const fetchCategories = async () => {
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
      if (typeFilter) {
        params.append("type", typeFilter);
      }

      const response = await axiosInstance.get(`/api/categories?${params}`);
      setCategories(response.data.categories);
      setPagination(response.data.pagination);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch categories",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [
    pagination.currentPage,
    itemsPerPage,
    sortBy,
    sortOrder,
    searchQuery,
    typeFilter,
  ]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pagination.currentPage !== 1) {
        setPagination((prev) => ({ ...prev, currentPage: 1 }));
      } else {
        fetchCategories();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, typeFilter]);

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

  // Handle number input changes
  const handleNumberChange = (value: number | string, name: string) => {
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Handle pagination change
  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };

  // Handle search input change
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  // Handle type filter change
  const handleTypeFilterChange = (value: string | null) => {
    setTypeFilter(value);
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
    setTypeFilter(null);
    setSortBy("order");
    setSortOrder("asc");
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  // Open modal for creating a new category
  const handleCreateCategory = () => {
    setEditMode(false);
    setCurrentCategory(null);
    setFormData({
      name: "",
      description: "",
      color: "#3498db",
      order: 0,
      type: "photo&video",
    });
    setCategoryImage(null);
    setCategoryIcon(null);
    open();
  };

  // Open modal for editing a category
  const handleEditCategory = (category: LessonCategory) => {
    setEditMode(true);
    setCurrentCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      color: category.color || "#3498db",
      order: category.order || 0,
      type: category.type || "photo&video",
    });
    setCategoryImage(null);
    setCategoryIcon(null);
    open();
  };

  // Toggle category active status
  const toggleCategoryStatus = async (category: LessonCategory) => {
    if (
      window.confirm(
        `Are you sure you want to ${
          category.isActive ? "deactivate" : "activate"
        } this category?`
      )
    ) {
      try {
        await axiosInstance.patch(
          `/api/categories/${category._id}/toggle-status`
        );
        notifications.show({
          title: "Success",
          message: `Category ${
            category.isActive ? "deactivated" : "activated"
          } successfully`,
          color: "green",
        });
        fetchCategories();
      } catch (error) {
        notifications.show({
          title: "Error",
          message: "Failed to update category status",
          color: "red",
        });
      }
    }
  };

  // Submit form for creating or updating a category
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("color", formData.color);
      formDataToSend.append("order", formData.order.toString());
      formDataToSend.append("type", formData.type);

      formDataToSend.append("uploadType", "categories");

      if (categoryImage) {
        formDataToSend.append("categoryImage", categoryImage);
      }

      // We're now using a single file upload approach
      // if (categoryIcon) {
      //   formDataToSend.append("categoryIcon", categoryIcon);
      // }

      if (editMode && currentCategory) {
        // Update existing category
        await axiosInstance.put(
          `/api/categories/${currentCategory._id}`,
          formDataToSend,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        notifications.show({
          title: "Success",
          message: "Category updated successfully",
          color: "green",
        });
      } else {
        // Create new category
        await axiosInstance.post("/api/categories", formDataToSend, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        notifications.show({
          title: "Success",
          message: "Category created successfully",
          color: "green",
        });
      }

      // Close modal and refresh categories
      close();
      fetchCategories();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.response?.data?.message || "Failed to save category",
        color: "red",
      });
    }
  };

  // Delete a category
  const handleDeleteCategory = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this category?")) {
      try {
        await axiosInstance.delete(`/api/categories/${id}`);
        notifications.show({
          title: "Success",
          message: "Category deleted successfully",
          color: "green",
        });
        fetchCategories();
      } catch (error) {
        notifications.show({
          title: "Error",
          message: "Failed to delete category",
          color: "red",
        });
      }
    }
  };

  // Render grid view
  const renderGridView = () => {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
        {categories.map((category) => {
          console.log(process.env.NEXT_PUBLIC_BACKEND_URL, category.imageUrl);
          return (
            <Card
              key={category._id}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
            >
              <Card.Section>
                {category.imageUrl ? (
                  <Image
                    src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${category.imageUrl}`}
                    height={160}
                    alt={category.name}
                    fallbackSrc="https://placehold.co/300x160?text=No+Image"
                  />
                ) : (
                  <div
                    style={{
                      height: 160,
                      backgroundColor: "#f0f0f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IconPhoto size={48} color="#aaa" />
                  </div>
                )}
              </Card.Section>

              <Group justify="space-between" mt="md" mb="xs">
                <Text fw={500}>{category.name}</Text>
                <Badge
                  color={category.isActive ? "green" : "red"}
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleCategoryStatus(category)}
                >
                  {category.isActive ? "Active" : "Inactive"}
                </Badge>
              </Group>

              <Text size="sm" c="dimmed" lineClamp={2} mb="md">
                {category.description}
              </Text>

              <Group mt="auto">
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    backgroundColor: category.color,
                    marginRight: 8,
                  }}
                />
                <Text size="xs" c="dimmed">
                  Order: {category.order}
                </Text>
                <Badge size="sm">{category.type || "N/A"}</Badge>
              </Group>

              <Group mt="md" justify="flex-end">
                <Tooltip label="Edit">
                  <ActionIcon
                    variant="subtle"
                    color="blue"
                    onClick={() => handleEditCategory(category)}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={category.isActive ? "Deactivate" : "Activate"}>
                  <ActionIcon
                    variant="subtle"
                    color={category.isActive ? "orange" : "green"}
                    onClick={() => toggleCategoryStatus(category)}
                  >
                    {category.isActive ? (
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
                    onClick={() => handleDeleteCategory(category._id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    );
  };

  // Render table view
  const renderTableView = () => {
    return (
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Order</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Image</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Color</Table.Th>
            <Table.Th>Created At</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {categories.map((category) => (
            <Table.Tr key={category._id}>
              <Table.Td>{category.order}</Table.Td>
              <Table.Td>{category.name}</Table.Td>
              <Table.Td style={{ maxWidth: "200px" }}>
                <Text lineClamp={2}>{category.description || "-"}</Text>
              </Table.Td>
              <Table.Td w="100px">
                <Image
                  src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${category.imageUrl}`}
                  height={100}
                  width="auto"
                  fit="contain"
                  alt={category.name}
                  fallbackSrc="https://placehold.co/300x160?text=No+Image"
                />
              </Table.Td>
              <Table.Td>
                <Badge
                  color={category.isActive ? "green" : "red"}
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleCategoryStatus(category)}
                >
                  {category.isActive ? "Active" : "Inactive"}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Badge>{category.type || "N/A"}</Badge>
              </Table.Td>

              <Table.Td>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      backgroundColor: category.color,
                      marginRight: 8,
                    }}
                  />
                  {category.color}
                </div>
              </Table.Td>
              <Table.Td>
                {new Date(category.createdAt).toLocaleDateString()}
              </Table.Td>
              <Table.Td>
                <Group>
                  <Tooltip label="Edit">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => handleEditCategory(category)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip
                    label={category.isActive ? "Deactivate" : "Activate"}
                  >
                    <ActionIcon
                      variant="subtle"
                      color={category.isActive ? "orange" : "green"}
                      onClick={() => toggleCategoryStatus(category)}
                    >
                      {category.isActive ? (
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
                      onClick={() => handleDeleteCategory(category._id)}
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
    );
  };

  return (
    <Container size="xl">
      <Paper p="md" shadow="xs" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={2}>Categories</Title>
          <Group>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleCreateCategory}
            >
              Create New Category
            </Button>
          </Group>
        </Group>

        {/* Search and Filter Controls */}
        <Paper p="md" mb="md" withBorder>
          <Stack>
            <Flex gap="md" wrap="wrap" align="end">
              <TextInput
                placeholder="Search categories..."
                leftSection={<IconSearch size={16} />}
                value={searchQuery}
                onChange={handleSearchChange}
                style={{ flex: 1, minWidth: 200 }}
              />
              <Select
                placeholder="Filter by type"
                data={[{ value: "photo&video", label: "Photo & Video" }]}
                value={typeFilter}
                onChange={handleTypeFilterChange}
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
                Showing {categories.length} of {pagination.totalCount}{" "}
                categories
              </Text>
              {/* <Group gap="xs">
                <Text size="sm">Sort by:</Text>
                <Button
                  variant={sortBy === "order" ? "filled" : "outline"}
                  size="xs"
                  onClick={() => handleSortChange("order")}
                >
                  Order {sortBy === "order" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
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
        ) : categories.length === 0 ? (
          <Text ta="center" py="xl" c="dimmed">
            {searchQuery || typeFilter
              ? "No categories found matching your search criteria."
              : "No categories found. Create your first category!"}
          </Text>
        ) : (
          <>
            {viewMode === "table" ? renderTableView() : renderGridView()}

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

      {/* Modal for creating/editing categories */}
      <Modal
        opened={opened}
        onClose={close}
        title={editMode ? "Edit Category" : "Create New Category"}
        size="lg"
        centered
      >
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Category Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter category name"
            required
            mb="md"
          />

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter category description"
            mb="md"
          />

          <Group grow mb="md">
            <NumberInput
              label="Order"
              value={formData.order}
              onChange={(value) => handleNumberChange(value, "order")}
              placeholder="Enter display order"
              min={0}
            />

            <ColorInput
              label="Color"
              name="color"
              value={formData.color}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  color: value,
                })
              }
              format="hex"
              swatches={[
                "#3498db",
                "#1abc9c",
                "#e74c3c",
                "#f39c12",
                "#9b59b6",
                "#34495e",
              ]}
            />
          </Group>

          <Select
            label="Category Type"
            value={formData.type}
            onChange={(value) =>
              setFormData({
                ...formData,
                type: value || "N/A",
              })
            }
            data={[{ value: "photo&video", label: "Photo & Video" }]}
            mb="md"
          />

          <FileInput
            label="Category Image"
            placeholder="Upload image"
            accept="image/png,image/jpeg,image/webp"
            value={categoryImage}
            onChange={setCategoryImage}
            leftSection={<IconPhoto size={rem(16)} />}
            clearable
            mb="md"
          />

          {editMode && currentCategory && currentCategory.imageUrl && (
            <div style={{ marginBottom: "1rem" }}>
              <Text size="sm" fw={500} mb="xs">
                Current Image:
              </Text>
              <Image
                src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${currentCategory.imageUrl}`}
                height={100}
                width="auto"
                fit="contain"
                alt="Current category image"
                mb="md"
              />
            </div>
          )}

          <Group justify="flex-end" mt="xl">
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16} />}>
              {editMode ? "Update" : "Create"}
            </Button>
          </Group>
        </form>
      </Modal>
    </Container>
  );
}
