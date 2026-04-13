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
  Filter,
  HelpCircle,
  Award,
  Tag,
} from "lucide-react";
import axiosInstance from "@/utils/axios";
import { formatDistanceToNow } from "date-fns";
import QuizForm from "@/components/QuizForm";
import CategorySelector from "@/components/CategorySelector";

interface Quiz {
  _id: string;
  question: string;
  questionType: string;
  options: Array<{
    text: string;
    isCorrect: boolean;
  }>;
  category?: {
    _id: string;
    name: string;
  };
  tags?: Array<{
    _id: string;
    name: string;
  }>;
  type: string;
  explanation?: string;
  xpValue: number;
  isActive: boolean;
  createdAt: string;
  createdBy: {
    _id: string;
    name: string;
    userName: string;
  };
}

export default function AllQuizzesPage() {
  // State
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [viewOpened, { open: openView, close: closeView }] = useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<string | null>("all");
  const [submitting, setSubmitting] = useState(false);

  // Fetch quizzes
  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "25");
      
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      
      if (categoryFilter) {
        params.append("category", categoryFilter);
      }
      
      if (typeFilter) {
        params.append("type", typeFilter);
      }
      
      if (activeTab === "active") {
        params.append("isActive", "true");
      } else if (activeTab === "inactive") {
        params.append("isActive", "false");
      }
      
      const response = await axiosInstance.get(`/api/quizzes?${params.toString()}`);
      
      setQuizzes(response.data.quizzes || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch quizzes",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchQuizzes();
  }, [page, activeTab]);

  // Apply filters
  const handleApplyFilters = () => {
    setPage(1); // Reset to first page when applying filters
    fetchQuizzes();
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setCategoryFilter(null);
    setTypeFilter(null);
    setPage(1);
    fetchQuizzes();
  };

  // Create quiz
  const handleCreateQuiz = async (formData: FormData) => {
    try {
      setSubmitting(true);
      await axiosInstance.post("/api/quizzes", formData);
      
      notifications.show({
        title: "Success",
        message: "Quiz created successfully",
        color: "green",
      });
      
      closeCreate();
      fetchQuizzes();
    } catch (error) {
      console.error("Error creating quiz:", error);
      notifications.show({
        title: "Error",
        message: "Failed to create quiz",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Update quiz
  const handleUpdateQuiz = async (formData: FormData) => {
    if (!currentQuiz) return;
    
    try {
      setSubmitting(true);
      await axiosInstance.put(`/api/quizzes/${currentQuiz._id}`, formData);
      
      notifications.show({
        title: "Success",
        message: "Quiz updated successfully",
        color: "green",
      });
      
      closeEdit();
      fetchQuizzes();
    } catch (error) {
      console.error("Error updating quiz:", error);
      notifications.show({
        title: "Error",
        message: "Failed to update quiz",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete quiz
  const handleDeleteQuiz = async () => {
    if (!currentQuiz) return;
    
    try {
      await axiosInstance.delete(`/api/quizzes/${currentQuiz._id}`);
      
      notifications.show({
        title: "Success",
        message: "Quiz deleted successfully",
        color: "green",
      });
      
      closeDelete();
      fetchQuizzes();
    } catch (error) {
      console.error("Error deleting quiz:", error);
      notifications.show({
        title: "Error",
        message: "Failed to delete quiz",
        color: "red",
      });
    }
  };

  // Get quiz type icon
  const getQuizTypeIcon = (type: string) => {
    switch (type) {
      case "lesson":
        return <HelpCircle size={16} />;
      case "games":
        return <Award size={16} />;
      default:
        return <HelpCircle size={16} />;
    }
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Quizzes Management</Title>
        <Button
          leftSection={<Plus size={16} />}
          onClick={openCreate}
        >
          Create Quiz
        </Button>
      </Group>

      {/* Filters */}
      <Card withBorder mb="md">
        <Group mb="xs" align="center">
          <Filter size={16} />
          <Text fw={500}>Filters</Text>
        </Group>
        
        <Group grow mb="md">
          <TextInput
            placeholder="Search quizzes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<Search size={16} />}
          />
          
          <CategorySelector
            // placeholder="Filter by category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            categoryType="quiz"
            label=""
          />
        </Group>
        
        <Group grow>
          <Select
            placeholder="Filter by type"
            data={[
              { value: "lesson", label: "Lesson Quiz" },
              { value: "games", label: "Game Quiz" },
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            clearable
          />
        </Group>
        
        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={handleResetFilters}>
            Reset
          </Button>
          <Button onClick={handleApplyFilters}>
            Apply Filters
          </Button>
        </Group>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="all">
            All Quizzes
          </Tabs.Tab>
          <Tabs.Tab value="active">
            Active
          </Tabs.Tab>
          <Tabs.Tab value="inactive">
            Inactive
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Quizzes Table */}
      {loading ? (
        <Flex justify="center" align="center" h={200}>
          <Loader />
        </Flex>
      ) : quizzes.length === 0 ? (
        <Card withBorder p="xl" radius="md">
          <Text ta="center" fw={500} size="lg">
            No quizzes found
          </Text>
          <Text ta="center" c="dimmed" mt="sm">
            {searchQuery || categoryFilter || typeFilter
              ? "Try adjusting your filters"
              : "Create your first quiz to get started"}
          </Text>
          <Button
            fullWidth
            leftSection={<Plus size={16} />}
            onClick={openCreate}
            mt="md"
          >
            Create Quiz
          </Button>
        </Card>
      ) : (
        <>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Question</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>XP Value</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {quizzes.map((quiz) => (
                <Table.Tr key={quiz._id}>
                  <Table.Td>
                    <Group gap="xs">
                      {getQuizTypeIcon(quiz.type)}
                      <Text lineClamp={1}>{quiz.question}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">
                      {quiz.type === "lesson" ? "Lesson Quiz" : "Game Quiz"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{quiz.category?.name || "N/A"}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color="green" variant="light">
                      {quiz.xpValue} XP
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge 
                      color={quiz.isActive ? "blue" : "gray"}
                      variant="light"
                    >
                      {quiz.isActive ? "Active" : "Inactive"}
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
                            setCurrentQuiz(quiz);
                            openView();
                          }}
                        >
                          View Details
                        </Menu.Item>
                        <Menu.Item 
                          leftSection={<Edit size={16} />}
                          onClick={() => {
                            setCurrentQuiz(quiz);
                            openEdit();
                          }}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item 
                          leftSection={<Trash size={16} />}
                          color="red"
                          onClick={() => {
                            setCurrentQuiz(quiz);
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
              <Pagination 
                value={page} 
                onChange={setPage} 
                total={totalPages} 
              />
            </Group>
          )}
        </>
      )}

      {/* Create Quiz Modal */}
      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="Create New Quiz"
        size="xl"
        centered
      >
        <QuizForm
          onSubmit={handleCreateQuiz}
          isLoading={submitting}
        />
      </Modal>

      {/* Edit Quiz Modal */}
      {currentQuiz && (
        <Modal
          opened={editOpened}
          onClose={closeEdit}
          title={`Edit Quiz`}
          size="xl"
          centered
        >
          <QuizForm
            initialValues={{
              question: currentQuiz.question,
              questionType: currentQuiz.questionType,
              options: currentQuiz.options,
              explanation: currentQuiz.explanation,
              xpValue: currentQuiz.xpValue,
              type: currentQuiz.type,
              category: currentQuiz.category?._id,
              tags: currentQuiz.tags?.map(tag => tag._id) || [],
              isActive: currentQuiz.isActive,
            }}
            onSubmit={handleUpdateQuiz}
            isLoading={submitting}
            isEdit={true}
          />
        </Modal>
      )}

      {/* View Quiz Modal */}
      {currentQuiz && (
        <Modal
          opened={viewOpened}
          onClose={closeView}
          title="Quiz Details"
          size="lg"
          centered
        >
          <Card withBorder>
            <Text fw={500}>Question</Text>
            <Text mb="md">{currentQuiz.question}</Text>

            <Text fw={500}>Options</Text>
            <Box mb="md">
              {currentQuiz.options.map((option, index) => (
                <Group key={index} mb="xs">
                  <Badge color={option.isCorrect ? "green" : "gray"} mr="xs">
                    {option.isCorrect ? "✓" : index + 1}
                  </Badge>
                  <Text>{option.text}</Text>
                </Group>
              ))}
            </Box>

            {currentQuiz.explanation && (
              <>
                <Text fw={500}>Explanation</Text>
                <Text mb="md">{currentQuiz.explanation}</Text>
              </>
            )}

            <Group grow mb="md">
              <Box>
                <Text fw={500}>Type</Text>
                <Badge>
                  {currentQuiz.type === "lesson" ? "Lesson Quiz" : "Game Quiz"}
                </Badge>
              </Box>
              <Box>
                <Text fw={500}>XP Value</Text>
                <Badge color="green">{currentQuiz.xpValue} XP</Badge>
              </Box>
            </Group>

            <Group grow mb="md">
              <Box>
                <Text fw={500}>Category</Text>
                <Text>{currentQuiz.category?.name || "N/A"}</Text>
              </Box>
              <Box>
                <Text fw={500}>Status</Text>
                <Badge color={currentQuiz.isActive ? "blue" : "gray"}>
                  {currentQuiz.isActive ? "Active" : "Inactive"}
                </Badge>
              </Box>
            </Group>

            {currentQuiz.tags && currentQuiz.tags.length > 0 && (
              <Box mb="md">
                <Text fw={500}>Tags</Text>
                <Group mt="xs">
                  {currentQuiz.tags.map((tag) => (
                    <Badge key={tag._id} leftSection={<Tag size={12} />}>
                      {tag.name}
                    </Badge>
                  ))}
                </Group>
              </Box>
            )}

            <Text fw={500}>Created</Text>
            <Text mb="md">
              {formatDistanceToNow(new Date(currentQuiz.createdAt), { addSuffix: true })} by {currentQuiz.createdBy?.name || "Unknown"}
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
        title="Delete Quiz"
        centered
      >
        <Text>
          Are you sure you want to delete this quiz? This action cannot be undone.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={closeDelete}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteQuiz}>
            Delete
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}