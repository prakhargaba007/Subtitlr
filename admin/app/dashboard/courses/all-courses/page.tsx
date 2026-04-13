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
  MultiSelect,
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
  List,
  PlusCircle,
  Check,
  X,
  Edit2,
  Star,
  Users,
  DollarSign,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import axiosInstance from "@/utils/axios";
import RecentVideos from "@/components/RecentVideos";
import { useFeatures } from "@/hooks/useFeatures";
import FileSelector from "@/components/FileSelector";
import AuthorSelector from "@/components/AuthorSelector";
import CategorySelector from "@/components/CategorySelector";
import TagSelector from "@/components/TagSelector";

interface Course {
  _id: string;
  title: string;
  description: string;
  category: {
    _id: string;
    name: string;
    slug: string;
  };
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedTimeToComplete: number;
  modules: Array<{
    _id: string;
    module: {
      _id: string;
      title: string;
      description: string;
      order: number;
      estimatedTimeToComplete: number;
      xpValue: number;
      totalXP: number;
      isPublished: boolean;
      isActive: boolean;
    };
    order: number;
  }>;
  imageUrl?: string;
  file?: string;
  isPublished: boolean;
  isActive: boolean;
  isFeatured: boolean;
  createdBy: {
    _id: string;
    name: string;
    userName: string;
  };
  author: {
    _id: string;
    name: string;
    userName: string;
    role?: string;
  };
  enrollmentCount: number;
  rating: number;
  price: number;
  totalXP: number;
  completionXP: number;
  slug: string;
  tags: Array<{
    _id: string;
    name: string;
    description?: string;
    isActive: boolean;
  }>;
  learningPoints: Array<{
    text: string;
    order: number;
  }>;
  language: string;
  expiryPeriod:
    | "1month"
    | "3months"
    | "6months"
    | "1year"
    | "2years"
    | "lifetime";
  createdAt: string;
  updatedAt: string;
}

interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface Module {
  _id: string;
  title: string;
  description: string;
  estimatedTimeToComplete: number;
  xpValue: number;
  totalXP: number;
  isPublished: boolean;
  isActive: boolean;
  course?: string;
}

interface Tag {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export default function AllCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  console.log("categories", categories);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const { features, loading: featuresLoading } = useFeatures();
  // console.log("features", features);

  // Module management state
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [modules, setModules] = useState<Course["modules"]>([]);
  const [modulesLoading, setModulesLoading] = useState(false);
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
  const [modulesOpened, { open: openModules, close: closeModules }] =
    useDisclosure(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  console.log("statusFilter", statusFilter);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<string | null>("all");
  const [isPaidCourse, setIsPaidCourse] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    difficulty: "beginner" as "beginner" | "intermediate" | "advanced",
    price: 0,
    completionXP: 100,
    language: "en",
    tags: "",
    selectedTags: [] as string[], // Array of selected tag IDs
    author: "", // Author field
    learningPoints: [] as Array<{ text: string; order: number }>, // Learning points array
    expiryPeriod: "lifetime" as
      | "1month"
      | "3months"
      | "6months"
      | "1year"
      | "2years"
      | "lifetime", // Expiry period
    isPublished: false,
    isActive: true,
    isFeatured: false,
    file: "",
    thumbnail: null as File | null, // Add thumbnail field
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      category: "",
      difficulty: "beginner",
      price: 0,
      completionXP: 100,
      language: "en",
      tags: "",
      selectedTags: [],
      author: "",
      learningPoints: [],
      expiryPeriod: "lifetime",
      isPublished: false,
      isActive: true,
      isFeatured: false,
      file: "",
      thumbnail: null, // Add thumbnail field
    });
    setIsPaidCourse(false);
  };

  const handleCreateCourse = async () => {
    try {
      setSubmitting(true);

      // Validate required fields
      if (!formData.title.trim()) {
        notifications.show({
          title: "Validation Error",
          message: "Course title is required",
          color: "red",
        });
        return;
      }

      if (!formData.description.trim()) {
        notifications.show({
          title: "Validation Error",
          message: "Course description is required",
          color: "red",
        });
        return;
      }

      if (!formData.category) {
        notifications.show({
          title: "Validation Error",
          message: "Course category is required",
          color: "red",
        });
        return;
      }

      const courseData = new FormData();

      // Add all form fields
      courseData.append("title", formData.title.trim());
      courseData.append("description", formData.description.trim());
      courseData.append("category", formData.category);
      courseData.append("difficulty", formData.difficulty);
      // estimatedTimeToComplete is computed on backend
      courseData.append("completionXP", formData.completionXP.toString());
      courseData.append("language", formData.language);
      courseData.append("author", formData.author);
      courseData.append("isPublished", formData.isPublished.toString());
      courseData.append("isActive", formData.isActive.toString());
      courseData.append("isFeatured", formData.isFeatured.toString());
      courseData.append("file", formData.file);

      // Handle thumbnail image upload
      if (formData.thumbnail) {
        courseData.append("courseImage", formData.thumbnail);
      }

      // Handle price - always 0 for free courses, but keep structure for paid courses
      courseData.append(
        "price",
        isPaidCourse ? formData.price.toString() : "0"
      );

      // Handle tags - use selectedTags if available, fallback to tags string
      if (formData.selectedTags.length > 0) {
        courseData.append("tags", JSON.stringify(formData.selectedTags));
      } else if (formData.tags.trim()) {
        const tagsArray = formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
        courseData.append("tags", JSON.stringify(tagsArray));
      }

      // Handle learning points
      if (formData.learningPoints.length > 0) {
        courseData.append(
          "learningPoints",
          JSON.stringify(formData.learningPoints)
        );
      }

      // Handle expiry settings
      courseData.append("expiryPeriod", formData.expiryPeriod);

      const response = await axiosInstance.post("/api/courses", courseData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      notifications.show({
        title: "Success",
        message: "Course created successfully",
        color: "green",
      });

      resetForm();
      closeCreate();
      fetchCourses();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.response?.data?.message || "Failed to create course",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fetchCourses = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...(searchQuery && { search: searchQuery }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(difficultyFilter && { difficulty: difficultyFilter }),
        ...(statusFilter === "published" && { isPublished: "true" }),
        ...(statusFilter === "draft" && { isPublished: "false" }),
        ...(statusFilter === "inactive" && { isActive: "false" }),
        ...(statusFilter === "featured" && { featured: "true" }),
      });

      const response = await axiosInstance.get(`/api/courses?${params}`);
      setCourses(response.data.courses || response.data);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch courses",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const params = new URLSearchParams({
        type: "course",
      });
      const response = await axiosInstance.get(
        `/api/categories?${params.toString()}`
      );
      setCategories(response.data.categories || response.data);
    } catch (error) {
      // Fail silently for filters
    }
  };

  const fetchTags = async () => {
    try {
      const response = await axiosInstance.get("/api/tags");
      console.log("response", response);
      setTags(response?.data?.tags?.filter((tag: Tag) => tag?.isActive || true));
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };


  useEffect(() => {
    fetchCourses();
  }, [page, activeTab]);

  useEffect(() => {
    fetchCategories();
    fetchTags();
  }, []);

  const handleSearch = () => {
    setPage(1);
    fetchCourses();
  };

  const populateEditForm = (course: Course) => {
    setFormData({
      title: course.title,
      description: course.description,
      category: course.category._id,
      difficulty: course.difficulty,
      price: course.price,
      completionXP: course.completionXP,
      language: course.language,
      tags: course.tags?.map((tag) => tag.name)?.join(", ") || "",
      selectedTags: course.tags?.map((tag) => tag._id) || [],
      author: course.author?._id || "",
      learningPoints: course.learningPoints || [],
      expiryPeriod: course.expiryPeriod || "lifetime",
      isPublished: course.isPublished,
      isActive: course.isActive,
      isFeatured: course.isFeatured,
      file: course.file || "",
      thumbnail: null, // Add thumbnail field (for edit, we don't populate with existing file)
    });
    setIsPaidCourse(course.price > 0);
  };

  const handleEditCourse = async () => {
    try {
      setSubmitting(true);

      // Validate required fields
      if (!formData.title.trim()) {
        notifications.show({
          title: "Validation Error",
          message: "Course title is required",
          color: "red",
        });
        return;
      }

      if (!formData.description.trim()) {
        notifications.show({
          title: "Validation Error",
          message: "Course description is required",
          color: "red",
        });
        return;
      }

      if (!formData.category) {
        notifications.show({
          title: "Validation Error",
          message: "Course category is required",
          color: "red",
        });
        return;
      }

      if (!currentCourse) return;

      const courseData = new FormData();

      // Add all form fields
      courseData.append("title", formData.title.trim());
      courseData.append("description", formData.description.trim());
      courseData.append("category", formData.category);
      courseData.append("difficulty", formData.difficulty);
      // estimatedTimeToComplete is computed on backend
      courseData.append("completionXP", formData.completionXP.toString());
      courseData.append("language", formData.language);
      courseData.append("author", formData.author);
      courseData.append("isPublished", formData.isPublished.toString());
      courseData.append("isActive", formData.isActive.toString());
      courseData.append("isFeatured", formData.isFeatured.toString());
      courseData.append("file", formData.file);

      // Handle thumbnail image upload
      if (formData.thumbnail) {
        courseData.append("courseImage", formData.thumbnail);
      }

      // Handle price - always 0 for free courses, but keep structure for paid courses
      courseData.append(
        "price",
        isPaidCourse ? formData.price.toString() : "0"
      );

      // Handle tags - use selectedTags if available, fallback to tags string
      if (formData.selectedTags.length > 0) {
        courseData.append("tags", JSON.stringify(formData.selectedTags));
      } else if (formData.tags.trim()) {
        const tagsArray = formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);
        courseData.append("tags", JSON.stringify(tagsArray));
      }

      // Handle learning points
      if (formData.learningPoints.length > 0) {
        courseData.append(
          "learningPoints",
          JSON.stringify(formData.learningPoints)
        );
      }

      // Handle expiry settings
      courseData.append("expiryPeriod", formData.expiryPeriod);

      const response = await axiosInstance.put(
        `/api/courses/${currentCourse._id}`,
        courseData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      notifications.show({
        title: "Success",
        message: "Course updated successfully",
        color: "green",
      });

      resetForm();
      closeEdit();
      fetchCourses();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.response?.data?.message || "Failed to update course",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setCategoryFilter(null);
    setDifficultyFilter(null);
    setStatusFilter(null);
    setPage(1);
    fetchCourses();
  };

  // Module management functions
  const fetchAllModules = async () => {
    try {
      const response = await axiosInstance.get("/api/modules");
      setAllModules(response.data.modules || response.data);
    } catch (error) {
      console.error("Error fetching modules:", error);
    }
  };

  const fetchModulesForCourse = async (courseId: string) => {
    try {
      setModulesLoading(true);
      const response = await axiosInstance.get(`/api/courses/${courseId}`);
      setModules(response.data.modules || []);
    } catch (error) {
      console.error("Error fetching course modules:", error);
      setModules([]);
    } finally {
      setModulesLoading(false);
    }
  };

  const addModuleToCourse = async (moduleId: string, order: number = 1) => {
    if (!currentCourse) return;

    try {
      const response = await axiosInstance.post(
        `/api/courses/${currentCourse._id}/modules`,
        { moduleId, order }
      );

      // Update local state
      setModules(response.data.modules || []);

      // Update the course in the courses list
      setCourses((prev) =>
        prev.map((course) =>
          course._id === currentCourse._id
            ? { ...course, modules: response.data.modules || [] }
            : course
        )
      );

      notifications.show({
        title: "Success",
        message: "Module added to course successfully",
        color: "green",
      });
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.message || "Failed to add module to course",
        color: "red",
      });
    }
  };

  const removeModuleFromCourse = async (moduleId: string) => {
    if (!currentCourse) return;

    try {
      const response = await axiosInstance.delete(
        `/api/courses/${currentCourse._id}/modules/${moduleId}`
      );

      // Update local state
      setModules(response.data.modules || []);

      // Update the course in the courses list
      setCourses((prev) =>
        prev.map((course) =>
          course._id === currentCourse._id
            ? { ...course, modules: response.data.modules || [] }
            : course
        )
      );

      notifications.show({
        title: "Success",
        message: "Module removed from course successfully",
        color: "green",
      });
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.message ||
          "Failed to remove module from course",
        color: "red",
      });
    }
  };

  const updateModuleOrder = async (moduleId: string, newOrder: number) => {
    if (!currentCourse) return;

    try {
      const response = await axiosInstance.put(
        `/api/courses/${currentCourse._id}/modules/${moduleId}/order`,
        { newOrder }
      );

      // Update local state
      setModules(response.data.modules || []);

      // Update the course in the courses list
      setCourses((prev) =>
        prev.map((course) =>
          course._id === currentCourse._id
            ? { ...course, modules: response.data.modules || [] }
            : course
        )
      );

      notifications.show({
        title: "Success",
        message: "Module order updated successfully",
        color: "green",
      });
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message:
          error.response?.data?.message || "Failed to update module order",
        color: "red",
      });
    }
  };

  const startEditingOrder = (moduleId: string, currentOrder: number) => {
    setEditingOrder(moduleId);
    setTempOrder(currentOrder);
  };

  const cancelEditingOrder = () => {
    setEditingOrder(null);
    setTempOrder(0);
  };

  const saveOrderChange = (moduleId: string) => {
    updateModuleOrder(moduleId, tempOrder);
    setEditingOrder(null);
    setTempOrder(0);
  };

  const openModulesModal = (course: Course) => {
    setCurrentCourse(course);
    setEditingOrder(null);
    fetchModulesForCourse(course._id);
    fetchAllModules();
    openModules();
  };

  // Learning points management functions
  const addLearningPoint = () => {
    const newPoint = {
      text: "",
      order: formData.learningPoints.length,
    };
    setFormData({
      ...formData,
      learningPoints: [...formData.learningPoints, newPoint],
    });
  };

  const updateLearningPoint = (index: number, text: string) => {
    const updatedPoints = [...formData.learningPoints];
    updatedPoints[index] = { ...updatedPoints[index], text };
    setFormData({ ...formData, learningPoints: updatedPoints });
  };

  const removeLearningPoint = (index: number) => {
    const updatedPoints = formData.learningPoints.filter((_, i) => i !== index);
    // Reorder the remaining points
    const reorderedPoints = updatedPoints.map((point, i) => ({
      ...point,
      order: i,
    }));
    setFormData({ ...formData, learningPoints: reorderedPoints });
  };

  const moveLearningPoint = (index: number, direction: "up" | "down") => {
    const points = [...formData.learningPoints];
    const newIndex = direction === "up" ? index - 1 : index + 1;

    if (newIndex >= 0 && newIndex < points.length) {
      // Swap the points
      [points[index], points[newIndex]] = [points[newIndex], points[index]];

      // Update the order
      const reorderedPoints = points.map((point, i) => ({
        ...point,
        order: i,
      }));

      setFormData({ ...formData, learningPoints: reorderedPoints });
    }
  };

  if (features) {
    return (
      <div className="flex justify-center items-center h-screen">
        <RecentVideos />
      </div>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "green";
      case "intermediate":
        return "yellow";
      case "advanced":
        return "red";
      default:
        return "gray";
    }
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
    <>
      <Container size="xl" py="md">
        <Group justify="space-between" mb="xl">
          <Title order={2}>Courses Management</Title>
          <Button leftSection={<Plus size={16} />} onClick={openCreate}>
            Create Course
          </Button>
        </Group>

        {/* Filters */}
        <Card withBorder mb="md" p="md">
          <Group justify="space-between" mb="md">
            <Text fw={500}>Filters</Text>
            <Button variant="light" size="xs" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          </Group>

          <Group>
            <TextInput
              placeholder="Search courses..."
              leftSection={<Search size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              style={{ minWidth: 200 }}
            />

            <CategorySelector
              label="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              required={false}
              categoryType="course"
            />

            <Select
              placeholder="Difficulty"
              data={[
                { value: "beginner", label: "Beginner" },
                { value: "intermediate", label: "Intermediate" },
                { value: "advanced", label: "Advanced" },
              ]}
              value={difficultyFilter}
              onChange={setDifficultyFilter}
              clearable
              style={{ minWidth: 120 }}
            />

            <Select
              placeholder="Status"
              data={[
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft" },
                { value: "inactive", label: "Inactive" },
                { value: "featured", label: "Featured" },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              style={{ minWidth: 120 }}
            />

            <Button onClick={handleSearch} leftSection={<Filter size={16} />}>
              Search
            </Button>
          </Group>
        </Card>

        {/* Main Content */}
        <Card withBorder>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab
                value="all"
                onClick={() => {
                  setStatusFilter(null);
                  setPage(1);
                }}
              >
                All Courses
              </Tabs.Tab>
              <Tabs.Tab
                value="published"
                onClick={() => {
                  setStatusFilter("published");
                  setPage(1);
                }}
              >
                Published
              </Tabs.Tab>
              <Tabs.Tab
                value="draft"
                onClick={() => {
                  setStatusFilter("draft");
                  setPage(1);
                }}
              >
                Draft
              </Tabs.Tab>
              <Tabs.Tab
                value="featured"
                onClick={() => {
                  setStatusFilter("featured");
                  setPage(1);
                }}
              >
                Featured
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value={activeTab || "all"} pt="md">
              {loading ? (
                <Flex justify="center" align="center" h={200}>
                  <Loader />
                </Flex>
              ) : courses.length === 0 ? (
                <Card withBorder p="xl" radius="md">
                  <Text ta="center" fw={500} size="lg">
                    No courses found
                  </Text>
                  <Text ta="center" c="dimmed" mt="sm">
                    {searchQuery ||
                    categoryFilter ||
                    difficultyFilter ||
                    statusFilter
                      ? "Try adjusting your filters"
                      : "Create your first course to get started"}
                  </Text>
                  <Button
                    fullWidth
                    leftSection={<Plus size={16} />}
                    mt="md"
                    onClick={openCreate}
                  >
                    Create Course
                  </Button>
                </Card>
              ) : (
                <>
                  <Table striped highlightOnHover withTableBorder>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Course</Table.Th>
                        <Table.Th>Category</Table.Th>
                        <Table.Th>Difficulty</Table.Th>
                        <Table.Th>Modules</Table.Th>
                        {/* <Table.Th>Duration</Table.Th> */}
                        <Table.Th>Price</Table.Th>
                        <Table.Th>XP</Table.Th>
                        {/* <Table.Th>Expiry</Table.Th> */}
                        <Table.Th>Status</Table.Th>
                        <Table.Th style={{ width: 80 }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {courses.map((course) => (
                        <Table.Tr key={course._id}>
                          <Table.Td>
                            <Group gap="xs">
                              {course.isFeatured && (
                                <Star size={16} color="gold" fill="gold" />
                              )}
                              <BookOpen size={16} />
                              <Box>
                                <Text fw={500}>{course.title}</Text>
                                <Text size="xs" c="dimmed">
                                  {course.enrollmentCount} enrollments
                                </Text>
                              </Box>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {course.category?.name || "N/A"}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={getDifficultyColor(course.difficulty)}
                              variant="light"
                              size="sm"
                            >
                              {course.difficulty}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Button
                              variant="light"
                              size="xs"
                              leftSection={<List size={12} />}
                              onClick={() => openModulesModal(course)}
                            >
                              {course.modules?.length || 0} modules
                            </Button>
                          </Table.Td>
                          {/* <Table.Td>
                            <Group gap="xs">
                              <Clock size={14} />
                              <Text size="sm">
                                {course.estimatedTimeToComplete || 0} min
                              </Text>
                            </Group>
                          </Table.Td> */}
                          <Table.Td>
                            <Group gap="xs">
                              <DollarSign size={14} />
                              <Text size="sm">
                                {course.price === 0
                                  ? "Free"
                                  : `$${course.price}`}
                              </Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              variant="light"
                              size="sm"
                              leftSection={<Trophy size={12} />}
                            >
                              {course.completionXP || 0}
                            </Badge>
                          </Table.Td>
                          {/* <Table.Td>
                            <Text size="sm" fw={500}>
                              {course.expiryPeriod === "lifetime"
                                ? "Lifetime"
                                : course.expiryPeriod
                                    ?.replace(/([a-z])([A-Z])/g, "$1 $2")
                                    .replace(/^./, (str) =>
                                      str.toUpperCase()
                                    )}
                            </Text>
                          </Table.Td> */}
                          <Table.Td>
                            <Badge
                              color={getStatusColor(
                                course.isPublished,
                                course.isActive
                              )}
                              variant="light"
                            >
                              {getStatusText(
                                course.isPublished,
                                course.isActive
                              )}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Menu position="bottom-end" withArrow>
                              <Menu.Target>
                                <ActionIcon variant="subtle" size="sm">
                                  <MoreVertical size={14} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<Eye size={14} />}
                                  onClick={() => {
                                    setCurrentCourse(course);
                                    openView();
                                  }}
                                >
                                  View
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<BookOpen size={14} />}
                                  onClick={() => openModulesModal(course)}
                                >
                                  Manage Modules
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<Edit size={14} />}
                                  onClick={() => {
                                    setCurrentCourse(course);
                                    populateEditForm(course);
                                    openEdit();
                                  }}
                                >
                                  Edit
                                </Menu.Item>
                                {/* <Menu.Item
                                  leftSection={<Trash size={14} />}
                                  color="red"
                                  onClick={() => {
                                    setCurrentCourse(course);
                                    openDelete();
                                  }}
                                >
                                  Delete
                                </Menu.Item> */}
                              </Menu.Dropdown>
                            </Menu>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>

                  {totalPages > 1 && (
                    <Group justify="center" mt="md">
                      <Pagination
                        value={page}
                        onChange={setPage}
                        total={totalPages}
                      />
                    </Group>
                  )}
                </>
              )}
            </Tabs.Panel>
          </Tabs>
        </Card>

        {/* View Course Modal */}
        {currentCourse && (
          <Modal
            opened={viewOpened}
            onClose={closeView}
            title={currentCourse.title}
            size="lg"
            centered
          >
            <Card withBorder>
              <Text fw={500}>Description</Text>
              <Text mb="md">{currentCourse.description}</Text>

              <Group grow mb="md">
                <Box>
                  <Text fw={500}>Category</Text>
                  <Text>{currentCourse.category?.name || "N/A"}</Text>
                </Box>
                <Box>
                  <Text fw={500}>Difficulty</Text>
                  <Badge color={getDifficultyColor(currentCourse.difficulty)}>
                    {currentCourse.difficulty}
                  </Badge>
                </Box>
              </Group>

              <Group grow mb="md">
                <Box>
                  <Text fw={500}>Duration</Text>
                  <Text>
                    {(() => {
                      const totalSeconds = currentCourse.estimatedTimeToComplete || 0;
                      const hours = Math.floor(totalSeconds / 3600);
                      const minutes = Math.floor((totalSeconds % 3600) / 60);
                      const seconds = totalSeconds % 60;
                      let result = "";
                      if (hours > 0) result += `${hours}h `;
                      if (minutes > 0) result += `${minutes}m `;
                      if (hours === 0 && minutes === 0) result += `${seconds}s`;
                      return result.trim() || "0s";
                    })()}
                  </Text>
                </Box>
                <Box>
                  <Text fw={500}>Price</Text>
                  <Text>
                    {currentCourse.price === 0
                      ? "Free"
                      : `$${currentCourse.price}`}
                  </Text>
                </Box>
              </Group>

              <Group grow mb="md">
                <Box>
                  <Text fw={500}>Total XP</Text>
                  <Text>{currentCourse.totalXP} XP</Text>
                </Box>
                <Box>
                  <Text fw={500}>Modules</Text>
                  <Text>{currentCourse.modules?.length || 0} modules</Text>
                </Box>
              </Group>

              {currentCourse.file && (
                <Box mb="md">
                  <Text fw={500}>Associated File</Text>
                  <Text size="sm" c="dimmed">
                    File ID: {currentCourse.file}
                  </Text>
                </Box>
              )}

              <Group grow mb="md">
                <Box>
                  <Text fw={500}>Status</Text>
                  <Badge
                    color={getStatusColor(
                      currentCourse.isPublished,
                      currentCourse.isActive
                    )}
                  >
                    {getStatusText(
                      currentCourse.isPublished,
                      currentCourse.isActive
                    )}
                  </Badge>
                </Box>
                <Box>
                  <Text fw={500}>Featured</Text>
                  <Badge color={currentCourse.isFeatured ? "yellow" : "gray"}>
                    {currentCourse.isFeatured ? "Yes" : "No"}
                  </Badge>
                </Box>
              </Group>

              <Text fw={500}>Created By</Text>
              <Text mb="md">
                {currentCourse.createdBy?.name ||
                  currentCourse.createdBy?.userName}
              </Text>

              <Text fw={500}>Created</Text>
              <Text mb="md">
                {new Date(currentCourse.createdAt).toLocaleString()}
              </Text>
            </Card>

            <Group justify="flex-end" mt="lg">
              <Button variant="outline" onClick={closeView}>
                Close
              </Button>
            </Group>
          </Modal>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          opened={deleteOpened}
          onClose={closeDelete}
          title="Delete Course"
          centered
        >
          <Text>
            Are you sure you want to delete the course "{currentCourse?.title}"?
            This action cannot be undone.
          </Text>
          <Group justify="flex-end" mt="xl">
            <Button variant="outline" onClick={closeDelete}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={submitting}
              onClick={() => {
                notifications.show({
                  title: "Coming Soon",
                  message: "Delete functionality will be added",
                  color: "blue",
                });
                closeDelete();
              }}
            >
              Delete
            </Button>
          </Group>
        </Modal>

        {/* Create Course Modal */}
        <Modal
          opened={createOpened}
          onClose={() => {
            resetForm();
            closeCreate();
          }}
          title="Create New Course"
          size="lg"
          centered
        >
          <TextInput
            label="Course Title"
            placeholder="Enter course title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.currentTarget.value })
            }
            required
            mb="md"
          />

          <Textarea
            label="Description"
            placeholder="Enter course description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.currentTarget.value })
            }
            required
            mb="md"
            rows={4}
          />

          <CategorySelector
            label="Category"
            value={formData.category}
            onChange={(value) =>
              setFormData({ ...formData, category: value || "" })
            }
            required
            categoryType="course"
            showCreateButton={false}
          />

          <AuthorSelector
            label="Author"
            placeholder="Select author"
            value={formData.author}
            onChange={(value) =>
              setFormData({ ...formData, author: value || "" })
            }
            required
            mb="md"
            currentAuthor={currentCourse?.author}
          />

          <Select
            label="Difficulty Level"
            placeholder="Select difficulty"
            data={[
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced", label: "Advanced" },
            ]}
            value={formData.difficulty}
            onChange={(value) =>
              setFormData({
                ...formData,
                difficulty: value as "beginner" | "intermediate" | "advanced",
              })
            }
            required
            mb="md"
          />

          <Group grow>
            <NumberInput
              label="Completion XP Reward"
              placeholder="100"
              value={formData.completionXP}
              onChange={(value) =>
                setFormData({ ...formData, completionXP: Number(value) || 100 })
              }
              min={0}
            />
          </Group>

          <Group grow mt="md">
            <Select
              label="Language"
              placeholder="Select language"
              data={[
                { value: "en", label: "English" },
                { value: "hi", label: "Hindi" },
              ]}
              value={formData.language}
              onChange={(value) =>
                setFormData({ ...formData, language: value || "en" })
              }
              required
            />
            <div>
              <Text size="sm" fw={500} mb="xs">
                Course Type
              </Text>
              <Group>
                <Badge
                  color={!isPaidCourse ? "green" : "gray"}
                  variant={!isPaidCourse ? "filled" : "light"}
                  style={{ cursor: "pointer" }}
                  onClick={() => setIsPaidCourse(false)}
                >
                  Free Course
                </Badge>
                <Badge
                  color={isPaidCourse ? "blue" : "gray"}
                  variant={isPaidCourse ? "filled" : "light"}
                  // style={{ cursor: "pointer" }}
                  // onClick={() => setIsPaidCourse(true)}
                >
                  Paid Course (Future)
                </Badge>
              </Group>
            </div>
          </Group>

          {isPaidCourse && (
            <NumberInput
              label="Course Price ($)"
              placeholder="0.00"
              value={formData.price}
              onChange={(value) =>
                setFormData({ ...formData, price: Number(value) || 0 })
              }
              min={0}
              step={0.01}
              mt="md"
              description="Note: Paid course functionality is planned for future release"
            />
          )}

          {/* Course Thumbnail Upload */}
          <Box mt="md" mb="md">
            <Text size="sm" fw={500} mb="xs">
              Course Thumbnail Image
            </Text>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  thumbnail: e.target.files?.[0] || null,
                })
              }
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
          </Box>

          <FileSelector
            label="Additional File"
            placeholder="Select an additional file (optional)"
            value={formData.file}
            onChange={(value) =>
              setFormData({ ...formData, file: value || "" })
            }
            description="Select a file that will be associated with this course"
          />

          <TagSelector
            label="Tags"
            placeholder="Select tags for this course"
            value={formData.selectedTags}
            onChange={(value) =>
              setFormData({ ...formData, selectedTags: value })
            }
            showCreateButton={false}
          />

          {/* Learning Points Section */}
          <Box mt="md" mb="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Learning Points
              </Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<Plus size={12} />}
                onClick={addLearningPoint}
              >
                Add Point
              </Button>
            </Group>
            {formData.learningPoints.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="md">
                No learning points added yet. Click "Add Point" to get started.
              </Text>
            ) : (
              <Stack gap="xs">
                {formData.learningPoints.map((point, index) => (
                  <Card key={index} withBorder p="sm">
                    <Group gap="xs">
                      <Text
                        size="sm"
                        fw={500}
                        c="dimmed"
                        style={{ minWidth: "20px" }}
                      >
                        {index + 1}.
                      </Text>
                      <TextInput
                        placeholder="Enter learning point..."
                        value={point.text}
                        onChange={(e) =>
                          updateLearningPoint(index, e.currentTarget.value)
                        }
                        style={{ flex: 1 }}
                        size="sm"
                      />
                      <Group gap="xs">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={() => moveLearningPoint(index, "up")}
                          disabled={index === 0}
                        >
                          <ChevronUp size={12} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={() => moveLearningPoint(index, "down")}
                          disabled={
                            index === formData.learningPoints.length - 1
                          }
                        >
                          <ChevronDown size={12} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => removeLearningPoint(index)}
                        >
                          <Trash size={12} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>

          {/* Expiry Settings Section */}
          <Box mt="md" mb="md">
            <Text size="sm" fw={500} mb="xs">
              Course Expiry Settings
            </Text>
            <Select
              label="Expiry Period"
              placeholder="Select expiry period"
              data={[
                { value: "lifetime", label: "Lifetime (No Expiry)" },
                { value: "1month", label: "1 Month" },
                { value: "3months", label: "3 Months" },
                { value: "6months", label: "6 Months" },
                { value: "1year", label: "1 Year" },
                { value: "2years", label: "2 Years" },
              ]}
              value={formData.expiryPeriod}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  expiryPeriod: value as
                    | "1month"
                    | "3months"
                    | "6months"
                    | "1year"
                    | "2years"
                    | "lifetime",
                })
              }
              required
              searchable
            />
          </Box>

          <Divider my="md" />

          <Text size="sm" fw={500} mb="xs">
            Course Settings
          </Text>

          <Group mb="md">
            <Switch
              label="Publish Course"
              description="Make course visible to users"
              checked={formData.isPublished}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  isPublished: e.currentTarget.checked,
                })
              }
            />
            <Switch
              label="Active"
              description="Course is active and accessible"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.currentTarget.checked })
              }
            />
          </Group>

          <Switch
            label="Featured Course"
            description="Show in featured courses section"
            checked={formData.isFeatured}
            onChange={(e) =>
              setFormData({ ...formData, isFeatured: e.currentTarget.checked })
            }
            mb="md"
          />

          <Group justify="flex-end" mt="xl">
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                closeCreate();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCourse}
              loading={submitting}
              leftSection={<Plus size={16} />}
            >
              Create Course
            </Button>
          </Group>
        </Modal>

        {/* Edit Course Modal */}
        <Modal
          opened={editOpened}
          onClose={() => {
            resetForm();
            closeEdit();
          }}
          title="Edit Course"
          size="lg"
          centered
        >
          <TextInput
            label="Course Title"
            placeholder="Enter course title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.currentTarget.value })
            }
            required
            mb="md"
          />

          <Textarea
            label="Description"
            placeholder="Enter course description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.currentTarget.value })
            }
            required
            mb="md"
            rows={4}
          />

          <CategorySelector
            label="Category"
            value={formData.category}
            onChange={(value) =>
              setFormData({ ...formData, category: value || "" })
            }
            required
            categoryType="course"
            showCreateButton={false}
          />

          <AuthorSelector
            label="Author"
            placeholder="Select author"
            value={formData.author}
            onChange={(value) =>
              setFormData({ ...formData, author: value || "" })
            }
            required
            mb="md"
            currentAuthor={currentCourse?.author}
          />

          <Select
            label="Difficulty Level"
            placeholder="Select difficulty"
            data={[
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced", label: "Advanced" },
            ]}
            value={formData.difficulty}
            onChange={(value) =>
              setFormData({
                ...formData,
                difficulty: value as "beginner" | "intermediate" | "advanced",
              })
            }
            required
            mb="md"
          />

          <Group grow>
            <NumberInput
              label="Completion XP Reward"
              placeholder="100"
              value={formData.completionXP}
              onChange={(value) =>
                setFormData({ ...formData, completionXP: Number(value) || 100 })
              }
              min={0}
            />
          </Group>

          <Group grow mt="md">
            <Select
              label="Language"
              placeholder="Select language"
              data={[
                { value: "en", label: "English" },
                { value: "hi", label: "Hindi" },
              ]}
              value={formData.language}
              onChange={(value) =>
                setFormData({ ...formData, language: value || "en" })
              }
              required
            />
            <div>
              <Text size="sm" fw={500} mb="xs">
                Course Type
              </Text>
              <Group>
                <Badge
                  color={!isPaidCourse ? "green" : "gray"}
                  variant={!isPaidCourse ? "filled" : "light"}
                  style={{ cursor: "pointer" }}
                  onClick={() => setIsPaidCourse(false)}
                >
                  Free Course
                </Badge>
                <Badge
                  color={isPaidCourse ? "blue" : "gray"}
                  variant={isPaidCourse ? "filled" : "light"}
                  // style={{ cursor: "pointer" }}
                  // onClick={() => setIsPaidCourse(true)}
                >
                  Paid Course (Future)
                </Badge>
              </Group>
            </div>
          </Group>

          {isPaidCourse && (
            <NumberInput
              label="Course Price ($)"
              placeholder="0.00"
              value={formData.price}
              onChange={(value) =>
                setFormData({ ...formData, price: Number(value) || 0 })
              }
              min={0}
              step={0.01}
              mt="md"
              description="Note: Paid course functionality is planned for future release"
            />
          )}

          {/* Course Thumbnail Upload */}
          <Box mt="md">
            <Text size="sm" fw={500} mb="xs">
              Course Thumbnail Image
            </Text>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  thumbnail: e.target.files?.[0] || null,
                })
              }
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ced4da",
                borderRadius: "4px",
                fontSize: "14px",
              }}
            />
            <Text size="xs" c="dimmed" mt="xs">
              Upload a thumbnail image for the course (JPG, PNG, etc.)
            </Text>
          </Box>

          <FileSelector
            label="Additional File"
            placeholder="Select an additional file (optional)"
            value={formData.file}
            onChange={(value) =>
              setFormData({ ...formData, file: value || "" })
            }
            description="Select a file that will be associated with this course"
          />

          <TagSelector
            label="Tags"
            placeholder="Select tags for this course"
            value={formData.selectedTags}
            onChange={(value) =>
              setFormData({ ...formData, selectedTags: value })
            }
            showCreateButton={false}
          />

          {/* Learning Points Section */}
          <Box mt="md" mb="md">
            <Group justify="space-between" mb="xs">
              <Text size="sm" fw={500}>
                Learning Points
              </Text>
              <Button
                size="xs"
                variant="light"
                leftSection={<Plus size={12} />}
                onClick={addLearningPoint}
              >
                Add Point
              </Button>
            </Group>
            {formData.learningPoints.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="md">
                No learning points added yet. Click "Add Point" to get started.
              </Text>
            ) : (
              <Stack gap="xs">
                {formData.learningPoints.map((point, index) => (
                  <Card key={index} withBorder p="sm">
                    <Group gap="xs">
                      <Text
                        size="sm"
                        fw={500}
                        c="dimmed"
                        style={{ minWidth: "20px" }}
                      >
                        {index + 1}.
                      </Text>
                      <TextInput
                        placeholder="Enter learning point..."
                        value={point.text}
                        onChange={(e) =>
                          updateLearningPoint(index, e.currentTarget.value)
                        }
                        style={{ flex: 1 }}
                        size="sm"
                      />
                      <Group gap="xs">
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={() => moveLearningPoint(index, "up")}
                          disabled={index === 0}
                        >
                          <ChevronUp size={12} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          onClick={() => moveLearningPoint(index, "down")}
                          disabled={
                            index === formData.learningPoints.length - 1
                          }
                        >
                          <ChevronDown size={12} />
                        </ActionIcon>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => removeLearningPoint(index)}
                        >
                          <Trash size={12} />
                        </ActionIcon>
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>

          {/* Expiry Settings Section */}
          <Box mt="md" mb="md">
            <Text size="sm" fw={500} mb="xs">
              Course Expiry Settings
            </Text>
            <Select
              label="Expiry Period"
              placeholder="Select expiry period"
              data={[
                { value: "lifetime", label: "Lifetime (No Expiry)" },
                { value: "1month", label: "1 Month" },
                { value: "3months", label: "3 Months" },
                { value: "6months", label: "6 Months" },
                { value: "1year", label: "1 Year" },
                { value: "2years", label: "2 Years" },
              ]}
              value={formData.expiryPeriod}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  expiryPeriod: value as
                    | "1month"
                    | "3months"
                    | "6months"
                    | "1year"
                    | "2years"
                    | "lifetime",
                })
              }
              required
              searchable
            />
          </Box>

          <Divider my="md" />

          <Text size="sm" fw={500} mb="xs">
            Course Settings
          </Text>

          <Group mb="md">
            <Switch
              label="Publish Course"
              description="Make course visible to users"
              checked={formData.isPublished}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  isPublished: e.currentTarget.checked,
                })
              }
            />
            <Switch
              label="Active"
              description="Course is active and accessible"
              checked={formData.isActive}
              onChange={(e) =>
                setFormData({ ...formData, isActive: e.currentTarget.checked })
              }
            />
          </Group>

          <Switch
            label="Featured Course"
            description="Show in featured courses section"
            checked={formData.isFeatured}
            onChange={(e) =>
              setFormData({ ...formData, isFeatured: e.currentTarget.checked })
            }
            mb="md"
          />

          <Group justify="flex-end" mt="xl">
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                closeEdit();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditCourse}
              loading={submitting}
              leftSection={<Edit size={16} />}
            >
              Update Course
            </Button>
          </Group>
        </Modal>

        {/* Module Management Modal */}
        {currentCourse && (
          <Modal
            opened={modulesOpened}
            onClose={closeModules}
            title={`Manage Modules - ${currentCourse.title}`}
            size="xl"
            centered
          >
            <Tabs defaultValue="course-modules">
              <Tabs.List>
                <Tabs.Tab value="course-modules">Course Modules</Tabs.Tab>
                <Tabs.Tab value="all-modules">All Available Modules</Tabs.Tab>
              </Tabs.List>

              {/* Course Modules Tab */}
              <Tabs.Panel value="course-modules" pt="md">
                {modulesLoading ? (
                  <Loader />
                ) : (
                  <>
                    {modules.length === 0 ? (
                      <Text c="dimmed" ta="center" py="xl">
                        No modules assigned to this course yet.
                      </Text>
                    ) : (
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Module</Table.Th>
                            <Table.Th>Duration</Table.Th>
                            <Table.Th>XP</Table.Th>
                            <Table.Th>Order</Table.Th>
                            <Table.Th>Status</Table.Th>
                            <Table.Th>Actions</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {modules
                            .sort((a, b) => a.order - b.order)
                            .map((moduleObj) => (
                              <Table.Tr key={moduleObj._id}>
                                <Table.Td>
                                  <Box>
                                    <Text fw={500} size="sm">
                                      {moduleObj.module.title}
                                    </Text>
                                    <Text size="xs" c="dimmed" truncate="end">
                                      {moduleObj.module.description}
                                    </Text>
                                  </Box>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm">
                                    {moduleObj.module.estimatedTimeToComplete}{" "}
                                    min
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Badge color="blue" variant="light" size="sm">
                                    {moduleObj.module.totalXP} XP
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  {editingOrder === moduleObj.module._id ? (
                                    <Group gap="xs">
                                      <NumberInput
                                        size="xs"
                                        w={60}
                                        value={tempOrder}
                                        onChange={(value) =>
                                          setTempOrder(Number(value) || 0)
                                        }
                                        min={1}
                                      />
                                      <ActionIcon
                                        size="sm"
                                        color="green"
                                        onClick={() =>
                                          saveOrderChange(moduleObj.module._id)
                                        }
                                      >
                                        <Check size={12} />
                                      </ActionIcon>
                                      <ActionIcon
                                        size="sm"
                                        color="red"
                                        onClick={cancelEditingOrder}
                                      >
                                        <X size={12} />
                                      </ActionIcon>
                                    </Group>
                                  ) : (
                                    <Group gap="xs">
                                      <Text size="sm">{moduleObj.order}</Text>
                                      <ActionIcon
                                        size="sm"
                                        variant="subtle"
                                        onClick={() =>
                                          startEditingOrder(
                                            moduleObj.module._id,
                                            moduleObj.order
                                          )
                                        }
                                      >
                                        <Edit2 size={12} />
                                      </ActionIcon>
                                    </Group>
                                  )}
                                </Table.Td>
                                <Table.Td>
                                  <Group gap="xs">
                                    <Badge
                                      color={
                                        moduleObj.module.isPublished
                                          ? "green"
                                          : "orange"
                                      }
                                      variant="light"
                                      size="xs"
                                    >
                                      {moduleObj.module.isPublished
                                        ? "Published"
                                        : "Draft"}
                                    </Badge>
                                    <Badge
                                      color={
                                        moduleObj.module.isActive
                                          ? "blue"
                                          : "gray"
                                      }
                                      variant="light"
                                      size="xs"
                                    >
                                      {moduleObj.module.isActive
                                        ? "Active"
                                        : "Inactive"}
                                    </Badge>
                                  </Group>
                                </Table.Td>
                                <Table.Td>
                                  <ActionIcon
                                    color="red"
                                    variant="subtle"
                                    size="sm"
                                    onClick={() =>
                                      removeModuleFromCourse(
                                        moduleObj.module._id
                                      )
                                    }
                                    disabled={editingOrder !== null}
                                  >
                                    <Trash size={12} />
                                  </ActionIcon>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                        </Table.Tbody>
                      </Table>
                    )}
                  </>
                )}
              </Tabs.Panel>

              {/* All Modules Tab */}
              <Tabs.Panel value="all-modules" pt="md">
                {allModules.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    No modules available.
                  </Text>
                ) : (
                  <Table>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Module</Table.Th>
                        <Table.Th>Duration</Table.Th>
                        <Table.Th>XP</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {allModules.map((module) => {
                        const isAlreadyInCourse = modules.some(
                          (moduleObj) => moduleObj.module._id === module._id
                        );
                        const nextOrder =
                          Math.max(...modules.map((m) => m.order), 0) + 1;

                        return (
                          <Table.Tr key={module._id}>
                            <Table.Td>
                              <Box>
                                <Text fw={500} size="sm">
                                  {module.title}
                                </Text>
                                <Text size="xs" c="dimmed" truncate="end">
                                  {module.description}
                                </Text>
                              </Box>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {module.estimatedTimeToComplete} min
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge color="blue" variant="light" size="sm">
                                {module.totalXP} XP
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <Badge
                                  color={
                                    module.isPublished ? "green" : "orange"
                                  }
                                  variant="light"
                                  size="xs"
                                >
                                  {module.isPublished ? "Published" : "Draft"}
                                </Badge>
                                <Badge
                                  color={module.isActive ? "blue" : "gray"}
                                  variant="light"
                                  size="xs"
                                >
                                  {module.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Button
                                size="xs"
                                variant={
                                  isAlreadyInCourse ? "subtle" : "filled"
                                }
                                color={isAlreadyInCourse ? "gray" : "blue"}
                                disabled={isAlreadyInCourse}
                                onClick={() =>
                                  addModuleToCourse(module._id, nextOrder)
                                }
                              >
                                {isAlreadyInCourse ? "Added" : "Add"}
                              </Button>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                )}
              </Tabs.Panel>
            </Tabs>
          </Modal>
        )}
      </Container>
    </>
  );
}
