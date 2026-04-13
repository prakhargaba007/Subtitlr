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
  FileText,
  Video,
  Book,
  Filter,
} from "lucide-react";
import axiosInstance from "@/utils/axios";
import { formatDistanceToNow } from "date-fns";
import LessonForm from "@/components/LessonForm";
import Image from "next/image";
import moment from "moment";
import CategorySelector from "@/components/CategorySelector";
import TagSelector from "@/components/TagSelector";

interface Lesson {
  _id: string;
  title: string;
  description: string;
  content: string;
  category: {
    _id: string;
    name: string;
  };
  duration: number;
  difficulty: string;
  lessonType: string;
  isPublished: boolean;
  isActive: boolean;
  isPreview?: boolean;
  isFeatured?: boolean;
  createdAt: string;
  video?: {
    _id: string;
    title: string;
    status: string;
  };
  quiz?: {
    _id: string;
    title: string;
  };
  tags?: Array<{
    _id: string;
    name: string;
    description?: string;
    isActive: boolean;
  }>;
  lessonImage?: string;
  imageUrl?: string;
  file?: {
    _id: string;
    originalName: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  };
  author?: {
    _id: string;
    name: string;
    userName: string;
    role?: string;
  };
  createdBy?: {
    _id: string;
    name: string;
    userName: string;
  };
}

export default function AllLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  // console.log("currentLesson", currentLesson?.lessonImage);
  // console.log("currentLesson", currentLesson?.imageUrl);

  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [editOpened, { open: openEdit, close: closeEdit }] =
    useDisclosure(false);
  const [viewOpened, { open: openView, close: closeView }] =
    useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] =
    useDisclosure(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<string | null>("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchLessons = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(typeFilter && { lessonType: typeFilter }),
        ...(activeTab === "published" && { isPublished: "true" }),
        ...(activeTab === "draft" && { isPublished: "false" }),
        ...(activeTab === "featured" && { isFeatured: "true" }),
        ...(activeTab === "inactive" && { isActive: "false" }),
      });

      if (selectedTags.length) {
        params.append("tags", JSON.stringify(selectedTags));
      }

      const response = await axiosInstance.get(`/api/lessons?${params}`);
      setLessons(response.data.lessons || response.data);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch lessons",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Removed category fetch; CategorySelector handles loading internally

  useEffect(() => {
    fetchLessons();
  }, [page, activeTab, itemsPerPage, searchQuery, categoryFilter, typeFilter, selectedTags]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (page !== 1) {
        setPage(1);
      } else {
        fetchLessons();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, categoryFilter, typeFilter]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setCategoryFilter(null);
    setTypeFilter(null);
    setPage(1);
    setSelectedTags([]);
  };

  const handleCreateLesson = async (formData: FormData) => {
    try {
      setSubmitting(true);
      await axiosInstance.post("/api/lessons", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      notifications.show({
        title: "Success",
        message: "Lesson created successfully",
        color: "green",
      });

      closeCreate();
      fetchLessons();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to create lesson",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateLesson = async (formData: FormData) => {
    if (!currentLesson) return;

    try {
      setSubmitting(true);
      // Log all form data entries

      formData.append("uploadType", "lessons");
      const formDataEntries: Record<string, any> = {};
      for (const [key, value] of formData.entries()) {
        formDataEntries[key] = value;
      }
      console.log("formData entries:", formDataEntries);

      await axiosInstance.put(`/api/lessons/${currentLesson._id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      notifications.show({
        title: "Success",
        message: "Lesson updated successfully",
        color: "green",
      });

      closeEdit();
      fetchLessons();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to update lesson",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!currentLesson) return;

    try {
      await axiosInstance.delete(`/api/lessons/${currentLesson._id}`);

      notifications.show({
        title: "Success",
        message: "Lesson deleted successfully",
        color: "green",
      });

      closeDelete();
      fetchLessons();
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to delete lesson",
        color: "red",
      });
    }
  };

  const getLessonTypeIcon = (type: string) => {
    const icons = {
      video: <Video size={16} />,
      text: <FileText size={16} />,
      interactive: <Book size={16} />,
      mixed: <Book size={16} />,
    };
    return icons[type as keyof typeof icons] || <FileText size={16} />;
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors = {
      beginner: "green",
      intermediate: "yellow",
      advanced: "red",
    };
    return colors[difficulty as keyof typeof colors] || "gray";
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Lessons Management</Title>
        <Button leftSection={<Plus size={16} />} onClick={openCreate}>
          Create Lesson
        </Button>
      </Group>

      {/* Filters */}
      <Paper p="md" mb="lg" withBorder>
        <Stack>
          <Flex gap="md" wrap="wrap" align="end">
            <TextInput
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              leftSection={<Search size={16} />}
              style={{ flex: 1, minWidth: 200 }}
            />

            <CategorySelector
              label="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              categoryType="lesson"
              style={{ minWidth: 200 }}
            />
            <TagSelector
              value={selectedTags}
              onChange={setSelectedTags}
              label="Tags"
              placeholder="Filter by tags"
            />

            <Select
              placeholder="Filter by type"
              data={[
                { value: "video", label: "Video" },
                { value: "text", label: "Text" },
                { value: "interactive", label: "Interactive" },
                { value: "mixed", label: "Mixed" },
              ]}
              value={typeFilter}
              onChange={setTypeFilter}
              clearable
              style={{ minWidth: 150 }}
            />

            <Select
              placeholder="Items per page"
              data={[
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
              Showing {lessons.length} lessons
              {(searchQuery || categoryFilter || typeFilter || selectedTags.length) ? " (filtered)" : ""}
            </Text>
          </Group>
        </Stack>
      </Paper>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="all">All Lessons</Tabs.Tab>
          <Tabs.Tab value="published">Published</Tabs.Tab>
          <Tabs.Tab value="draft">Drafts</Tabs.Tab>
          <Tabs.Tab value="featured">Featured</Tabs.Tab>
          <Tabs.Tab value="inactive">Inactive</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Lessons Table */}
      {loading ? (
        <Flex justify="center" align="center" h={200}>
          <Loader />
        </Flex>
      ) : lessons.length === 0 ? (
        <Card withBorder p="xl" radius="md">
          <Text ta="center" fw={500} size="lg">
            No lessons found
          </Text>
          <Text ta="center" c="dimmed" mt="sm">
            {searchQuery || categoryFilter || typeFilter
              ? "Try adjusting your filters"
              : "Create your first lesson to get started"}
          </Text>
          <Button
            fullWidth
            leftSection={<Plus size={16} />}
            onClick={openCreate}
            mt="md"
          >
            Create Lesson
          </Button>
        </Card>
      ) : (
        <>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lessons.map((lesson) => (
                <Table.Tr key={lesson._id}>
                  <Table.Td>
                    <Group gap="xs">
                      {getLessonTypeIcon(lesson.lessonType)}
                      <Text fw={500}>{lesson.title}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{lesson.category?.name || "N/A"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">{lesson.lessonType}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {/* <Badge
                        color={getDifficultyColor(lesson.difficulty)}
                        variant="dot"
                        size="sm"
                      >
                        {lesson.difficulty}
                      </Badge> */}
                      <Text size="sm">
                        {lesson.duration
                          ? new Date(lesson.duration * 1000)
                              .toISOString()
                              .substr(11, 8)
                          : "00:00:00"}
                      </Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Badge
                        color={lesson.isPublished ? "green" : "yellow"}
                        variant="light"
                      >
                        {lesson.isPublished ? "Published" : "Draft"}
                      </Badge>
                      {lesson.isFeatured && (
                        <Badge color="orange" variant="light">
                          Featured
                        </Badge>
                      )}
                    </Group>
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
                            setCurrentLesson(lesson);
                            openView();
                          }}
                        >
                          View Details
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Edit size={16} />}
                          onClick={() => {
                            setCurrentLesson(lesson);
                            openEdit();
                          }}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Trash size={16} />}
                          color="red"
                          onClick={() => {
                            setCurrentLesson(lesson);
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

      {/* Create Lesson Modal */}
      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="Create New Lesson"
        size="xl"
        centered
      >
        <LessonForm onSubmit={handleCreateLesson} isLoading={submitting} />
      </Modal>

      {/* Edit Lesson Modal */}
      {currentLesson && (
        <Modal
          opened={editOpened}
          onClose={closeEdit}
          title={`Edit Lesson: ${currentLesson.title}`}
          size="xl"
          centered
        >
          <LessonForm
            initialValues={{
              ...currentLesson,
              category: currentLesson.category?._id,
              quiz: currentLesson.quiz?._id,
              imageUrl: currentLesson.imageUrl,
              tags: currentLesson.tags?.map((tag) => tag._id) || [],
              author: currentLesson.author?._id,
            }}
            onSubmit={handleUpdateLesson}
            isLoading={submitting}
            isEdit={true}
          />
        </Modal>
      )}

      {/* View Lesson Modal */}
      {currentLesson && (
        <Modal
          opened={viewOpened}
          onClose={closeView}
          title={`Lesson Details: ${currentLesson.title}`}
          size="lg"
          centered
        >
          <Card withBorder>
            {currentLesson.imageUrl && (
              <Image
                src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${currentLesson.imageUrl}`}
                alt={currentLesson.title}
                width={200}
                height={200}
                className="w-full h-full object-cover"
              />
            )}
            <Text fw={500}>Title</Text>
            <Text mb="md">{currentLesson.title}</Text>

            <Text fw={500}>Description</Text>
            <Text mb="md">{currentLesson.description}</Text>

            <Group grow mb="md">
              <Box>
                <Text fw={500}>Category</Text>
                <Text>{currentLesson.category?.name || "N/A"}</Text>
              </Box>
            </Group>

            <Group grow mb="md">
              <Box>
                <Text fw={500}>Lesson Type</Text>
                <Badge>{currentLesson.lessonType}</Badge>
              </Box>
              <Box>
                <Text fw={500}>Difficulty</Text>
                <Badge color={getDifficultyColor(currentLesson.difficulty)}>
                  {currentLesson.difficulty}
                </Badge>
              </Box>
            </Group>

            <Group grow mb="md">
              <Box>
                <Text fw={500}>Duration</Text>
                <Text>{currentLesson.duration} minutes</Text>
              </Box>
              <Box>
                <Text fw={500}>Status</Text>
                <Badge color={currentLesson.isPublished ? "green" : "yellow"}>
                  {currentLesson.isPublished ? "Published" : "Draft"}
                </Badge>
              </Box>
            </Group>

            {currentLesson.video && (
              <Box mb="md">
                <Text fw={500}>Video</Text>
                <Group>
                  <Badge leftSection={<Video size={14} />}>
                    {currentLesson.video.title}
                  </Badge>
                  <Badge
                    color={
                      currentLesson.video.status === "processed"
                        ? "green"
                        : "yellow"
                    }
                  >
                    {currentLesson.video.status}
                  </Badge>
                </Group>
              </Box>
            )}

            {currentLesson.file && (
              <Box mb="md">
                <Text fw={500}>Associated File</Text>
                <Text size="sm" c="dimmed">
                  File ID: {currentLesson.file.originalName}
                </Text>
              </Box>
            )}

            <Text fw={500}>Created</Text>
            <Text mb="md">
              {new Date(currentLesson.createdAt).toLocaleString()}
            </Text>
          </Card>
          <Group justify="flex-end" mt="lg">
            <Button variant="outline" onClick={closeView}>
              Close
            </Button>
            <Button
              onClick={() => {
                closeView();
                openEdit();
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
        title="Delete Lesson"
        centered
      >
        <Text>
          Are you sure you want to delete the lesson "{currentLesson?.title}"?
          This action cannot be undone.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={closeDelete}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteLesson}>
            Delete
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
