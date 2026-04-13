"use client";

import { useState, useEffect } from "react";
import {
  Container,
  Title,
  Button,
  Card,
  Text,
  Group,
  Badge,
  Modal,
  TextInput,
  Loader,
  Table,
  ActionIcon,
  Menu,
  Tooltip,
  Flex,
  Box,
  Tabs,
  Select,
  Pagination,
  NumberInput,
  Textarea,
  Switch,
  Divider,
  Paper,
  Stack,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useDisclosure } from "@mantine/hooks";
import {
  Plus,
  Edit,
  Trash,
  Eye,
  MoreVertical,
  Search,
  BookOpen,
  Clock,
  Trophy,
  Filter,
  Image as ImageIcon,
  Video,
  List,
  PlusCircle,
  Check,
  X,
  Edit2,
} from "lucide-react";
import axiosInstance from "@/utils/axios";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import FileSelector from "@/components/FileSelector";
import moment from "moment";

interface Module {
  _id: string;
  title: string;
  description: string;
  lessons: Array<{
    _id: string;
    lesson: {
      _id: string;
      title: string;
      description: string;
      estimatedTimeToComplete: number;
      xpValue: number;
      duration: number;
      lessonType: string;
      isPublished: boolean;
    };
    order: number;
  }>;
  order: number;
  estimatedTimeToComplete: number;
  isPublished: boolean;
  isActive: boolean;
  xpValue: number;
  totalXP: number;
  imageUrl?: string;
  videoIntroUrl?: {
    _id: string;
    title: string;
    url: string;
  };
  file?: string;
  createdBy: {
    _id: string;
    name: string;
    userName: string;
  };
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export default function AllModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentModule, setCurrentModule] = useState<Module | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [allLessons, setAllLessons] = useState<any[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState<string | null>(null);
  const [tempOrder, setTempOrder] = useState<number>(0);

  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [editOpened, { open: openEdit, close: closeEdit }] =
    useDisclosure(false);
  const [viewOpened, { open: openView, close: closeView }] =
    useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] =
    useDisclosure(false);
  const [lessonsOpened, { open: openLessons, close: closeLessons }] =
    useDisclosure(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<string | null>("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    order: 0,
    xpValue: 50,
    isPublished: false,
    isActive: true,
    file: "",
  });

  const fetchModules = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      });

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      // Handle status filter (dropdown)
      if (statusFilter === "published") {
        params.append("isPublished", "true");
      } else if (statusFilter === "draft") {
        params.append("isPublished", "false");
        params.append("isActive", "true");
      } else if (statusFilter === "inactive") {
        params.append("isActive", "false");
      }

      // Handle active tab
      if (activeTab === "published") {
        params.append("isPublished", "true");
      } else if (activeTab === "draft") {
        params.append("isPublished", "false");
        params.append("isActive", "true");
      } else if (activeTab === "inactive") {
        params.append("isActive", "false");
      }

      console.log("Fetching modules with params:", params.toString());
      const response = await axiosInstance.get(`/api/modules?${params}`);
      setModules(response.data.modules || response.data);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch modules",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLessons = async () => {
    try {
      const response = await axiosInstance.get("/api/lessons");
      setAllLessons(response.data.lessons || response.data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch lessons",
        color: "red",
      });
    }
  };

  const fetchLessonsForModule = async (moduleId: string) => {
    try {
      setLessonsLoading(true);
      const response = await axiosInstance.get(`/api/modules/${moduleId}`);

      setLessons(response.data.lessons || []);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch lessons for this module",
        color: "red",
      });
    } finally {
      setLessonsLoading(false);
    }
  };

  const addLessonToModule = async (lessonId: string) => {
    if (!currentModule) return;

    try {
      const response = await axiosInstance.post(
        `/api/modules/${currentModule._id}/lessons`,
        {
          lessonId,
        }
      );

      // Update the lessons for the current module
      setLessons(response.data.module.lessons || []);

      // Update the module in the modules list
      setModules(
        modules.map((module) =>
          module._id === currentModule._id
            ? { ...module, lessons: response.data.module.lessons }
            : module
        )
      );

      notifications.show({
        title: "Success",
        message: "Lesson added to module successfully",
        color: "green",
      });
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.message || "Failed to add lesson to module",
        color: "red",
      });
    }
  };

  const removeLessonFromModule = async (lessonId: string) => {
    if (!currentModule) return;

    try {
      const response = await axiosInstance.delete(
        `/api/modules/${currentModule._id}/lessons/${lessonId}`
      );

      // Update the lessons for the current module
      setLessons(response.data.module.lessons || []);

      // Update the module in the modules list
      setModules(
        modules.map((module) =>
          module._id === currentModule._id
            ? { ...module, lessons: response.data.module.lessons }
            : module
        )
      );

      notifications.show({
        title: "Success",
        message: "Lesson removed from module successfully",
        color: "green",
      });
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.message ||
          "Failed to remove lesson from module",
        color: "red",
      });
    }
  };

  const updateLessonOrder = async (lessonId: string, newOrder: number) => {
    if (!currentModule) return;

    try {
      const response = await axiosInstance.put(
        `/api/modules/${currentModule._id}/lessons/${lessonId}/order`,
        { newOrder }
      );

      // Update the lessons for the current module
      setLessons(response.data.module.lessons || []);

      // Update the module in the modules list
      setModules(
        modules.map((module) =>
          module._id === currentModule._id
            ? { ...module, lessons: response.data.module.lessons }
            : module
        )
      );

      notifications.show({
        title: "Success",
        message: "Lesson order updated successfully",
        color: "green",
      });
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.message || "Failed to update lesson order",
        color: "red",
      });
    }
  };

  const startEditingOrder = (lessonId: string, currentOrder: number) => {
    setEditingOrder(lessonId);
    setTempOrder(currentOrder);
  };

  const cancelEditingOrder = () => {
    setEditingOrder(null);
    setTempOrder(0);
  };

  const saveOrderChange = async (lessonId: string) => {
    await updateLessonOrder(lessonId, tempOrder);
    setEditingOrder(null);
    setTempOrder(0);
  };

  useEffect(() => {
    fetchModules();
  }, [page, activeTab, itemsPerPage, searchQuery, statusFilter]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (page !== 1) {
        setPage(1);
      } else {
        fetchModules();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, statusFilter]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter(null);
    setActiveTab("all");
    setPage(1);
  };

  const handleCreateModule = async () => {
    try {
      setSubmitting(true);
      await axiosInstance.post("/api/modules", formData);

      notifications.show({
        title: "Success",
        message: "Module created successfully",
        color: "green",
      });

      closeCreate();
      resetForm();
      fetchModules();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to create module",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateModule = async () => {
    if (!currentModule) return;

    try {
      setSubmitting(true);
      await axiosInstance.put(`/api/modules/${currentModule._id}`, formData);

      notifications.show({
        title: "Success",
        message: "Module updated successfully",
        color: "green",
      });

      closeEdit();
      resetForm();
      fetchModules();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to update module",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteModule = async () => {
    if (!currentModule) return;

    try {
      await axiosInstance.delete(`/api/modules/${currentModule._id}`);

      notifications.show({
        title: "Success",
        message: "Module deleted successfully",
        color: "red",
      });

      closeDelete();
      fetchModules();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to delete module",
        color: "red",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      order: 0,
      xpValue: 50,
      isPublished: false,
      isActive: true,
      file: "",
    });
  };

  const openEditModal = (module: Module) => {
    setCurrentModule(module);
    setFormData({
      title: module.title,
      description: module.description,
      order: module.order || 0,
      xpValue: module.xpValue || 50,
      isPublished: module.isPublished,
      isActive: module.isActive,
      file: module.file || "",
    });
    openEdit();
  };

  const openLessonsModal = (module: Module) => {
    setCurrentModule(module);
    fetchLessonsForModule(module._id);
    fetchAllLessons();
    // Reset any editing state when opening modal
    setEditingOrder(null);
    setTempOrder(0);
    openLessons();
  };

  const getStatusColor = (isPublished: boolean, isActive: boolean) => {
    if (!isActive) return "red";
    return isPublished ? "green" : "yellow";
  };

  const getStatusText = (isPublished: boolean, isActive: boolean) => {
    if (!isActive) return "Inactive";
    return isPublished ? "Published" : "Draft";
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Modules Management</Title>
        <Button leftSection={<Plus size={16} />} onClick={openCreate}>
          Create Module
        </Button>
      </Group>

      {/* Filters */}
      <Paper p="md" mb="lg" withBorder>
        <Stack>
          <Flex gap="md" wrap="wrap" align="end">
            <TextInput
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              leftSection={<Search size={16} />}
              style={{ flex: 1, minWidth: 200 }}
            />

            <Select
              placeholder="Filter by status"
              data={[
                { value: "published", label: "Published" },
                { value: "draft", label: "Drafts" },
                { value: "inactive", label: "Inactive" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              style={{ minWidth: 150 }}
            />

            <Select
              placeholder="Items per page"
              data={[
                { value: "2", label: "2 per page" },
                { value: "5", label: "5 per page" },
                { value: "10", label: "10 per page" },
              ]}
              value={itemsPerPage.toString()}
              onChange={(value) => setItemsPerPage(parseInt(value || "10"))}
              style={{ minWidth: 120 }}
            />

            <Button variant="outline" onClick={handleResetFilters}>
              Reset
            </Button>
          </Flex>

          {/* Results Summary */}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {modules.length} modules
              {searchQuery || statusFilter ? " (filtered)" : ""}
            </Text>
          </Group>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="all">All Modules</Tabs.Tab>
          <Tabs.Tab value="published">Published</Tabs.Tab>
          <Tabs.Tab value="draft">Drafts</Tabs.Tab>
          <Tabs.Tab value="inactive">Inactive</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Modules Table */}
      {loading ? (
        <Flex justify="center" align="center" h={200}>
          <Loader />
        </Flex>
      ) : modules.length === 0 ? (
        <Card withBorder p="xl" radius="md">
          <Text ta="center" fw={500} size="lg">
            No modules found
          </Text>
          <Text ta="center" c="dimmed" mt="sm">
            {searchQuery || statusFilter
              ? "Try adjusting your filters"
              : "Create your first module to get started"}
          </Text>
          <Button
            fullWidth
            leftSection={<Plus size={16} />}
            onClick={openCreate}
            mt="md"
          >
            Create Module
          </Button>
        </Card>
      ) : (
        <>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Lessons</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>XP Value</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {modules.map((module) => (
                <Table.Tr key={module._id}>
                  <Table.Td>
                    <Group gap="xs">
                      <BookOpen size={16} />
                      <Text fw={500}>{module.title}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<BookOpen size={12} />}
                      onClick={() => openLessonsModal(module)}
                    >
                      {module.lessons?.length || 0} lessons
                    </Button>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Clock size={14} />
                      <Text size="sm">
                        {(() => {
                          const totalSeconds =
                            module.estimatedTimeToComplete || 0;
                          const hours = Math.floor(totalSeconds / 3600);
                          const minutes = Math.floor(
                            (totalSeconds % 3600) / 60
                          );
                          if (hours > 0) {
                            return `${hours}h ${minutes}m`;
                          }
                          return `${minutes}m`;
                        })()}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Trophy size={14} />
                      <Text size="sm">
                        {module.totalXP || module.xpValue || 0} XP
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={getStatusColor(
                        module.isPublished,
                        module.isActive
                      )}
                      variant="light"
                    >
                      {getStatusText(module.isPublished, module.isActive)}
                    </Badge>
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
                          onClick={() => {
                            setCurrentModule(module);
                            openView();
                          }}
                        >
                          View Details
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Edit size={16} />}
                          onClick={() => openEditModal(module)}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<List size={16} />}
                          onClick={() => openLessonsModal(module)}
                        >
                          Manage Lessons
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Trash size={16} />}
                          color="red"
                          onClick={() => {
                            setCurrentModule(module);
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

      {/* Create Module Modal */}
      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="Create New Module"
        size="lg"
        centered
      >
        <Box>
          <TextInput
            label="Title"
            placeholder="Enter module title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.currentTarget.value })
            }
            required
            mb="md"
          />

          <Textarea
            label="Description"
            placeholder="Enter module description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.currentTarget.value })
            }
            required
            mb="md"
            minRows={3}
          />

          {/* <Select
            label="Course"
            placeholder="Select a course"
            data={courses.map(course => ({ value: course._id, label: course.title }))}
            value={formData.course}
            onChange={(value) => setFormData({ ...formData, course: value || "" })}
            required
            mb="md"
            searchable
          /> */}

          <Group grow mb="md">
            <NumberInput
              label="Order"
              placeholder="0"
              value={formData.order}
              onChange={(value) =>
                setFormData({ ...formData, order: Number(value) || 0 })
              }
              min={0}
            />
          </Group>
          <div className="mb-4">
            <FileSelector
              label="Additional File"
              placeholder="Select an additional file (optional)"
              value={formData.file}
              onChange={(value) =>
                setFormData({ ...formData, file: value || "" })
              }

              // description="Select a file that will be associated with this module"
            />
          </div>

          <NumberInput
            label="XP Value"
            placeholder="50"
            value={formData.xpValue}
            onChange={(value) =>
              setFormData({ ...formData, xpValue: Number(value) || 0 })
            }
            min={0}
            mb="md"
          />

          <Group mb="md">
            {/* <Switch
              label="Published"
              checked={formData.isPublished}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  isPublished: e.currentTarget.checked,
                })
              }
            /> */}
            <Switch
              label="Active"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.currentTarget.checked })
              }
            />
          </Group>

          <Group justify="flex-end" mt="xl">
            <Button variant="outline" onClick={closeCreate}>
              Cancel
            </Button>
            <Button onClick={handleCreateModule} loading={submitting}>
              Create Module
            </Button>
          </Group>
        </Box>
      </Modal>

      {/* Edit Module Modal */}
      <Modal
        opened={editOpened}
        onClose={closeEdit}
        title={`Edit Module: ${currentModule?.title}`}
        size="lg"
        centered
      >
        <Box>
          <TextInput
            label="Title"
            placeholder="Enter module title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.currentTarget.value })
            }
            required
            mb="md"
          />

          <Textarea
            label="Description"
            placeholder="Enter module description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.currentTarget.value })
            }
            required
            mb="md"
            minRows={3}
          />

          <Group grow mb="md">
            <NumberInput
              label="Order"
              placeholder="0"
              value={formData.order}
              onChange={(value) =>
                setFormData({ ...formData, order: Number(value) || 0 })
              }
              min={0}
            />
          </Group>
          <div className="mb-4">
            <FileSelector
              label="Additional File"
              placeholder="Select an additional file (optional)"
              value={formData.file}
              onChange={(value) =>
                setFormData({ ...formData, file: value || "" })
              }
            />
          </div>

          <NumberInput
            label="XP Value"
            placeholder="50"
            value={formData.xpValue}
            onChange={(value) =>
              setFormData({ ...formData, xpValue: Number(value) || 0 })
            }
            min={0}
            mb="md"
          />

          <Group mb="md">
            {/* <Switch
              label="Published"
              checked={formData.isPublished}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  isPublished: e.currentTarget.checked,
                })
              }
            /> */}
            <Switch
              label="Active"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.currentTarget.checked })
              }
            />
          </Group>

          <Group justify="flex-end" mt="xl">
            <Button variant="outline" onClick={closeEdit}>
              Cancel
            </Button>
            <Button onClick={handleUpdateModule} loading={submitting}>
              Update Module
            </Button>
          </Group>
        </Box>
      </Modal>

      {/* View Module Modal */}
      {currentModule && (
        <Modal
          opened={viewOpened}
          onClose={closeView}
          title={`Module Details: ${currentModule.title}`}
          size="lg"
          centered
        >
          <Card withBorder>
            {currentModule.imageUrl && (
              <Box mb="md">
                <Image
                  src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${currentModule.imageUrl}`}
                  alt={currentModule.title}
                  width={200}
                  height={200}
                  className="w-full h-full object-cover"
                />
              </Box>
            )}

            <Text fw={500}>Title</Text>
            <Text mb="md">{currentModule.title}</Text>

            <Text fw={500}>Description</Text>
            <Text mb="md">{currentModule.description}</Text>

            <Group grow mb="md">
              <Box>
                <Text fw={500}>Order</Text>
                <Text>{currentModule.order}</Text>
              </Box>
              <Box>
                <Text fw={500}>Estimated Time</Text>
                <Text>
                  {(() => {
                    const totalSeconds =
                      currentModule.estimatedTimeToComplete || 0;
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    if (hours > 0) {
                      return `${hours}h ${minutes}m`;
                    }
                    return `${minutes}m`;
                  })()}{" "}
                  minutes
                </Text>
              </Box>
            </Group>

            <Group grow mb="md">
              <Box>
                <Text fw={500}>XP Value</Text>
                <Text>{currentModule.xpValue} XP</Text>
              </Box>
              <Box>
                <Text fw={500}>Total XP</Text>
                <Text>{currentModule.totalXP} XP</Text>
              </Box>
            </Group>

            {currentModule.file && (
              <Box mb="md">
                <Text fw={500}>Associated File</Text>
                <Text size="sm" c="dimmed">
                  File ID: {currentModule.file}
                </Text>
              </Box>
            )}

            <Group grow mb="md">
              <Box>
                <Text fw={500}>Status</Text>
                <Badge
                  color={getStatusColor(
                    currentModule.isPublished,
                    currentModule.isActive
                  )}
                >
                  {getStatusText(
                    currentModule.isPublished,
                    currentModule.isActive
                  )}
                </Badge>
              </Box>
              <Box>
                <Text fw={500}>Lessons</Text>
                <Text>{currentModule.lessons?.length || 0} lessons</Text>
              </Box>
            </Group>

            {currentModule.videoIntroUrl && (
              <Box mb="md">
                <Text fw={500}>Intro Video</Text>
                <Group>
                  <Badge leftSection={<Video size={14} />}>
                    {currentModule.videoIntroUrl.title}
                  </Badge>
                </Group>
              </Box>
            )}

            <Text fw={500}>Created By</Text>
            <Text mb="md">
              {currentModule.createdBy?.name ||
                currentModule.createdBy?.userName}
            </Text>

            <Text fw={500}>Created</Text>
            <Text mb="md">
              {new Date(currentModule.createdAt).toLocaleString()}
            </Text>

            <Text fw={500}>Last Updated</Text>
            <Text mb="md">
              {new Date(currentModule.updatedAt).toLocaleString()}
            </Text>
          </Card>

          <Group justify="flex-end" mt="lg">
            <Button variant="outline" onClick={closeView}>
              Close
            </Button>
            <Button
              onClick={() => {
                closeView();
                openEditModal(currentModule);
              }}
            >
              Edit
            </Button>
          </Group>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteOpened}
        onClose={closeDelete}
        title="Delete Module"
        centered
      >
        <Text>
          Are you sure you want to delete the module "{currentModule?.title}"?
          This action cannot be undone and will also delete all associated
          lessons.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={closeDelete}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteModule}>
            Delete
          </Button>
        </Group>
      </Modal>

      {/* Lessons Management Modal */}
      {currentModule && (
        <Modal
          opened={lessonsOpened}
          onClose={closeLessons}
          title={`Manage Lessons: ${currentModule.title}`}
          size="xl"
          centered
        >
          <Tabs defaultValue="module-lessons">
            <Tabs.List>
              <Tabs.Tab value="module-lessons">
                Module Lessons ({lessons.length})
              </Tabs.Tab>
              <Tabs.Tab value="all-lessons">
                All Available Lessons ({allLessons.length})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="module-lessons" pt="md">
              <Box>
                <Group justify="space-between" mb="md">
                  <Text fw={500}>Current Module Lessons</Text>
                  <Text size="sm" c="dimmed">
                    Total XP:{" "}
                    {lessons.reduce(
                      (sum, lessonObj) => sum + (lessonObj.lesson.xpValue || 0),
                      0
                    )}{" "}
                    XP
                  </Text>
                </Group>

                <Divider mb="md" />

                {lessonsLoading ? (
                  <Flex justify="center" align="center" h={100}>
                    <Loader />
                  </Flex>
                ) : lessons.length === 0 ? (
                  <Card withBorder p="xl" radius="md">
                    <Text ta="center" fw={500} size="lg">
                      No lessons in this module
                    </Text>
                    <Text ta="center" c="dimmed" mt="sm">
                      Switch to "All Available Lessons" tab to add lessons to
                      this module.
                    </Text>
                  </Card>
                ) : (
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Order</Table.Th>
                        <Table.Th>Title</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Duration</Table.Th>
                        <Table.Th>XP</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {lessons
                        .sort((a, b) => a.order - b.order)
                        .map((lessonObj) => {
                          const lesson = lessonObj.lesson;
                          return (
                            <Table.Tr key={lessonObj._id}>
                              <Table.Td>
                                {editingOrder === lessonObj._id ? (
                                  <Group gap="xs">
                                    <NumberInput
                                      size="xs"
                                      value={tempOrder}
                                      onChange={(value) =>
                                        setTempOrder(Number(value) || 0)
                                      }
                                      min={0}
                                      w={60}
                                    />
                                    <ActionIcon
                                      color="green"
                                      variant="light"
                                      size="xs"
                                      onClick={() =>
                                        saveOrderChange(lesson._id)
                                      }
                                    >
                                      <Check size={12} />
                                    </ActionIcon>
                                    <ActionIcon
                                      color="gray"
                                      variant="light"
                                      size="xs"
                                      onClick={cancelEditingOrder}
                                    >
                                      <X size={12} />
                                    </ActionIcon>
                                  </Group>
                                ) : (
                                  <Group gap="xs">
                                    <Badge variant="light" size="sm">
                                      {lessonObj.order}
                                    </Badge>
                                    <ActionIcon
                                      variant="subtle"
                                      size="xs"
                                      onClick={() =>
                                        startEditingOrder(
                                          lessonObj._id,
                                          lessonObj.order
                                        )
                                      }
                                    >
                                      <Edit2 size={12} />
                                    </ActionIcon>
                                  </Group>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Text fw={500} size="sm">
                                  {lesson.title}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge variant="light" size="sm">
                                  {lesson.lessonType || "video"}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {lesson.duration || 0} min
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  variant="light"
                                  size="sm"
                                  leftSection={<Trophy size={12} />}
                                >
                                  {lesson.xpValue || 0}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  color={
                                    lesson.isPublished ? "green" : "yellow"
                                  }
                                  variant="light"
                                  size="sm"
                                >
                                  {lesson.isPublished ? "Published" : "Draft"}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Tooltip label="Remove from module">
                                  <ActionIcon
                                    color="red"
                                    variant="light"
                                    size="sm"
                                    disabled={editingOrder === lessonObj._id}
                                    onClick={() =>
                                      removeLessonFromModule(lesson._id)
                                    }
                                  >
                                    <Trash size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                    </Table.Tbody>
                  </Table>
                )}
              </Box>
            </Tabs.Panel>

            <Tabs.Panel value="all-lessons" pt="md">
              <Box>
                <Group justify="space-between" mb="md">
                  <Text fw={500}>All Available Lessons</Text>
                  <Text size="sm" c="dimmed">
                    Click + to add lesson to this module
                  </Text>
                </Group>

                <Divider mb="md" />

                {allLessons.length === 0 ? (
                  <Card withBorder p="xl" radius="md">
                    <Text ta="center" fw={500} size="lg">
                      No lessons available
                    </Text>
                    <Text ta="center" c="dimmed" mt="sm">
                      Create lessons first before adding them to modules.
                    </Text>
                  </Card>
                ) : (
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Title</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Duration</Table.Th>
                        <Table.Th>XP</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {allLessons.map((lesson) => {
                        const isInModule = lessons.some(
                          (moduleLesson) =>
                            moduleLesson.lesson._id === lesson._id
                        );
                        return (
                          <Table.Tr
                            key={lesson._id}
                            opacity={isInModule ? 0.5 : 1}
                          >
                            <Table.Td>
                              <Text fw={500} size="sm">
                                {lesson.title}
                                {isInModule && (
                                  <Badge
                                    ml="xs"
                                    size="xs"
                                    color="blue"
                                    variant="light"
                                  >
                                    In Module
                                  </Badge>
                                )}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" size="sm">
                                {lesson.lessonType || "video"}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{lesson.duration || 0} min</Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                variant="light"
                                size="sm"
                                leftSection={<Trophy size={12} />}
                              >
                                {lesson.xpValue || lesson.points || 0}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={lesson.isPublished ? "green" : "yellow"}
                                variant="light"
                                size="sm"
                              >
                                {lesson.isPublished ? "Published" : "Draft"}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              {isInModule ? (
                                <Tooltip label="Already in module">
                                  <ActionIcon disabled size="sm">
                                    <Check size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              ) : (
                                <Tooltip label="Add to module">
                                  <ActionIcon
                                    color="green"
                                    variant="light"
                                    size="sm"
                                    onClick={() =>
                                      addLessonToModule(lesson._id)
                                    }
                                  >
                                    <PlusCircle size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                )}
              </Box>
            </Tabs.Panel>
          </Tabs>

          <Group justify="flex-end" mt="xl">
            <Button variant="outline" onClick={closeLessons}>
              Close
            </Button>
            <Button
              onClick={() => {
                closeLessons();
                openEditModal(currentModule);
              }}
            >
              Edit Module
            </Button>
          </Group>
        </Modal>
      )}
    </Container>
  );
}
