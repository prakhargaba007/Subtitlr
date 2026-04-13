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
  Stack,
  Textarea,
  NumberInput,
  Switch,
  MultiSelect,
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
  Gamepad2,
  Target,
  Clock,
  Trophy,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import axiosInstance from "@/utils/axios";
import { formatDistanceToNow } from "date-fns";

interface QuizGame {
  _id: string;
  name: string;
  description: string;
  type: string;
  difficulty: string;
  timeLimit: number;
  passingScore: number;
  bonusXp: number;
  shuffleQuestions: boolean;
  showExplanations: boolean;
  quizzes: Array<{
    _id: string;
    question: string;
    category?: {
      _id: string;
      name: string;
    };
    xpValue: number;
  }>;
  isActive: boolean;
  createdAt: string;
  createdBy: {
    _id: string;
    name: string;
    userName: string;
  };
}

interface Quiz {
  _id: string;
  question: string;
  category?: {
    _id: string;
    name: string;
  };
  xpValue: number;
  type: string;
}

export default function QuizGameManager() {
  // State
  const [quizGames, setQuizGames] = useState<QuizGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpened, { open: openCreate, close: closeCreate }] =
    useDisclosure(false);
  const [editOpened, { open: openEdit, close: closeEdit }] =
    useDisclosure(false);
  const [viewOpened, { open: openView, close: closeView }] =
    useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] =
    useDisclosure(false);
  const [currentQuizGame, setCurrentQuizGame] = useState<QuizGame | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState<string | null>("all");
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "strategy",
    difficulty: "medium",
    timeLimit: 30,
    passingScore: 70,
    bonusXp: 50,
    shuffleQuestions: true,
    showExplanations: true,
    quizzes: [] as string[],
  });

  // Available quizzes for selection
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);

  // Selected quizzes with order
  const [selectedQuizzes, setSelectedQuizzes] = useState<Quiz[]>([]);

  // Fetch quiz games
  const fetchQuizGames = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "10");

      if (typeFilter) params.append("type", typeFilter);
      if (difficultyFilter) params.append("difficulty", difficultyFilter);
      if (activeTab === "active") params.append("isActive", "true");
      else if (activeTab === "inactive") params.append("isActive", "false");

      const response = await axiosInstance.get(
        `/api/quiz-games?${params.toString()}`
      );
      setQuizGames(response.data.quizGames || []);
      setTotalPages(response.data.pagination?.pages || 1);
    } catch (error) {
      console.error("Error fetching quiz games:", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch quiz games",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch available quizzes
  const fetchAvailableQuizzes = async () => {
    try {
      const response = await axiosInstance.get(
        "/api/quizzes?limit=1000&isActive=true"
      );
      setAvailableQuizzes(response.data.quizzes || []);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
    }
  };

  useEffect(() => {
    fetchQuizGames();
    fetchAvailableQuizzes();
  }, [page, activeTab]);

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      type: "strategy",
      difficulty: "medium",
      timeLimit: 30,
      passingScore: 70,
      bonusXp: 50,
      shuffleQuestions: true,
      showExplanations: true,
      quizzes: [],
    });
    setSelectedQuizzes([]);
  };

  // Add quiz to selection
  const addQuizToSelection = (quizId: string) => {
    const quiz = availableQuizzes.find((q) => q._id === quizId);
    if (quiz && !selectedQuizzes.find((q) => q._id === quizId)) {
      const newSelected = [...selectedQuizzes, quiz];
      setSelectedQuizzes(newSelected);
      setFormData({ ...formData, quizzes: newSelected.map((q) => q._id) });
    }
  };

  // Remove quiz from selection
  const removeQuizFromSelection = (quizId: string) => {
    const newSelected = selectedQuizzes.filter((q) => q._id !== quizId);
    setSelectedQuizzes(newSelected);
    setFormData({ ...formData, quizzes: newSelected.map((q) => q._id) });
  };

  // Move quiz up in order
  const moveQuizUp = (index: number) => {
    if (index > 0) {
      const newSelected = [...selectedQuizzes];
      [newSelected[index - 1], newSelected[index]] = [
        newSelected[index],
        newSelected[index - 1],
      ];
      setSelectedQuizzes(newSelected);
      setFormData({ ...formData, quizzes: newSelected.map((q) => q._id) });
    }
  };

  // Move quiz down in order
  const moveQuizDown = (index: number) => {
    if (index < selectedQuizzes.length - 1) {
      const newSelected = [...selectedQuizzes];
      [newSelected[index], newSelected[index + 1]] = [
        newSelected[index + 1],
        newSelected[index],
      ];
      setSelectedQuizzes(newSelected);
      setFormData({ ...formData, quizzes: newSelected.map((q) => q._id) });
    }
  };

  const handleOpenCreate = () => {
    resetForm();
    openCreate();
  };

  const handleOpenEdit = (quizGame: QuizGame) => {
    // Set the selected quizzes in the same order as they appear in the game
    const orderedQuizzes = quizGame.quizzes
      .map((gameQuiz) =>
        availableQuizzes.find(
          (availableQuiz) => availableQuiz._id === gameQuiz._id
        )
      )
      .filter(Boolean) as Quiz[];

    setSelectedQuizzes(orderedQuizzes);
    setFormData({
      name: quizGame.name,
      description: quizGame.description,
      type: quizGame.type,
      difficulty: quizGame.difficulty,
      timeLimit: quizGame.timeLimit,
      passingScore: quizGame.passingScore,
      bonusXp: quizGame.bonusXp,
      shuffleQuestions: quizGame.shuffleQuestions,
      showExplanations: quizGame.showExplanations,
      quizzes: quizGame.quizzes.map((q) => q._id),
    });
    setCurrentQuizGame(quizGame);
    openEdit();
  };

  const handleCreateQuizGame = async () => {
    try {
      setSubmitting(true);

      if (!formData.name || selectedQuizzes.length === 0) {
        notifications.show({
          title: "Error",
          message:
            "Please fill in all required fields and select at least one quiz",
          color: "red",
        });
        return;
      }

      await axiosInstance.post("/api/quiz-games", formData);

      notifications.show({
        title: "Success",
        message: "Quiz game created successfully",
        color: "green",
      });

      closeCreate();
      fetchQuizGames();
    } catch (error) {
      console.error("Error creating quiz game:", error);
      notifications.show({
        title: "Error",
        message: "Failed to create quiz game",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateQuizGame = async () => {
    if (!currentQuizGame) return;

    try {
      setSubmitting(true);
      await axiosInstance.put(
        `/api/quiz-games/${currentQuizGame._id}`,
        formData
      );

      notifications.show({
        title: "Success",
        message: "Quiz game updated successfully",
        color: "green",
      });

      closeEdit();
      fetchQuizGames();
    } catch (error) {
      console.error("Error updating quiz game:", error);
      notifications.show({
        title: "Error",
        message: "Failed to update quiz game",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuizGame = async () => {
    if (!currentQuizGame) return;

    try {
      await axiosInstance.delete(`/api/quiz-games/${currentQuizGame._id}`);

      notifications.show({
        title: "Success",
        message: "Quiz game deleted successfully",
        color: "green",
      });

      closeDelete();
      fetchQuizGames();
    } catch (error) {
      console.error("Error deleting quiz game:", error);
      notifications.show({
        title: "Error",
        message: "Failed to delete quiz game",
        color: "red",
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "strategy":
        return <Target size={16} />;
      case "pokermaths":
        return <Gamepad2 size={16} />;
      default:
        return <Gamepad2 size={16} />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "green";
      case "medium":
        return "yellow";
      case "hard":
        return "red";
      default:
        return "blue";
    }
  };

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Quiz Games Management</Title>
        <Button leftSection={<Plus size={16} />} onClick={handleOpenCreate}>
          Create Quiz Game
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
            placeholder="Search quiz games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            leftSection={<Search size={16} />}
          />

          <Select
            placeholder="Filter by type"
            data={[
              { value: "strategy", label: "Strategy" },
              { value: "pokermaths", label: "Poker Maths" },
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            clearable
          />

          <Select
            placeholder="Filter by difficulty"
            data={[
              { value: "easy", label: "Easy" },
              { value: "medium", label: "Medium" },
              { value: "hard", label: "Hard" },
            ]}
            value={difficultyFilter}
            onChange={setDifficultyFilter}
            clearable
          />
        </Group>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab value="all">All Games</Tabs.Tab>
          <Tabs.Tab value="active">Active</Tabs.Tab>
          <Tabs.Tab value="inactive">Inactive</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Quiz Games Table */}
      {loading ? (
        <Flex justify="center" align="center" h={200}>
          <Loader />
        </Flex>
      ) : quizGames.length === 0 ? (
        <Card withBorder p="xl" radius="md">
          <Text ta="center" fw={500} size="lg">
            No quiz games found
          </Text>
          <Text ta="center" c="dimmed" mt="sm">
            Create your first quiz game to get started
          </Text>
          <Button
            fullWidth
            leftSection={<Plus size={16} />}
            onClick={handleOpenCreate}
            mt="md"
          >
            Create Quiz Game
          </Button>
        </Card>
      ) : (
        <>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Difficulty</Table.Th>
                <Table.Th>Quizzes</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th style={{ width: 80 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {quizGames.map((game) => (
                <Table.Tr key={game._id}>
                  <Table.Td>
                    <Group gap="xs">
                      {getTypeIcon(game.type)}
                      <div>
                        <Text fw={500}>{game.name}</Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {game.description}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">
                      {game.type === "strategy" ? "Strategy" : "Poker Maths"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={getDifficultyColor(game.difficulty)}
                      variant="light"
                    >
                      {game.difficulty.charAt(0).toUpperCase() +
                        game.difficulty.slice(1)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Badge color="blue" variant="light">
                        {game.quizzes.length} questions
                      </Badge>
                      <Tooltip label={`${game.timeLimit}s per question`}>
                        <Badge
                          leftSection={<Clock size={12} />}
                          color="gray"
                          variant="light"
                        >
                          {game.timeLimit}s
                        </Badge>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={game.isActive ? "blue" : "gray"}
                      variant="light"
                    >
                      {game.isActive ? "Active" : "Inactive"}
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
                            setCurrentQuizGame(game);
                            openView();
                          }}
                        >
                          View Details
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Edit size={16} />}
                          onClick={() => handleOpenEdit(game)}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<Trash size={16} />}
                          color="red"
                          onClick={() => {
                            setCurrentQuizGame(game);
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

      {/* Create Quiz Game Modal */}
      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="Create New Quiz Game"
        size="lg"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Game Name"
            placeholder="Enter game name"
            required
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.currentTarget.value })
            }
          />

          <Textarea
            label="Description"
            placeholder="Enter game description"
            rows={3}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.currentTarget.value })
            }
          />

          <Group grow>
            <Select
              label="Type"
              required
              data={[
                { value: "strategy", label: "Strategy" },
                { value: "pokermaths", label: "Poker Maths" },
              ]}
              value={formData.type}
              onChange={(value) =>
                setFormData({ ...formData, type: value || "strategy" })
              }
            />

            <Select
              label="Difficulty"
              required
              data={[
                { value: "easy", label: "Easy" },
                { value: "medium", label: "Medium" },
                { value: "hard", label: "Hard" },
              ]}
              value={formData.difficulty}
              onChange={(value) =>
                setFormData({ ...formData, difficulty: value || "medium" })
              }
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Time Limit (seconds)"
              min={10}
              max={300}
              value={formData.timeLimit}
              onChange={(value) =>
                setFormData({ ...formData, timeLimit: Number(value) || 30 })
              }
            />

            <NumberInput
              label="Passing Score (%)"
              min={1}
              max={100}
              value={formData.passingScore}
              onChange={(value) =>
                setFormData({ ...formData, passingScore: Number(value) || 70 })
              }
            />

            <NumberInput
              label="Bonus XP"
              min={0}
              value={formData.bonusXp}
              onChange={(value) =>
                setFormData({ ...formData, bonusXp: Number(value) || 50 })
              }
            />
          </Group>

          {/* <Group grow>
            <Switch
              label="Shuffle Questions"
              checked={formData.shuffleQuestions}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  shuffleQuestions: e.currentTarget.checked,
                })
              }
            />

            <Switch
              label="Show Explanations"
              checked={formData.showExplanations}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  showExplanations: e.currentTarget.checked,
                })
              }
            />
          </Group> */}

          {/* Quiz Selection with Ordering */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Select Quizzes *
            </Text>
            <Select
              placeholder="Choose a quiz to add"
              data={availableQuizzes
                .filter(
                  (quiz) => !selectedQuizzes.find((s) => s._id === quiz._id)
                )
                .map((quiz) => ({
                  value: quiz._id,
                  label: `${quiz.question.substring(0, 60)}...${
                    quiz.category ? ` (${quiz.category.name})` : ""
                  }`,
                }))}
              onChange={(value) => {
                if (value) {
                  addQuizToSelection(value);
                }
              }}
              searchable
              clearable
              value=""
            />

            {/* Selected Quizzes with Ordering */}
            {selectedQuizzes.length > 0 && (
              <Box mt="md">
                <Text size="sm" fw={500} mb="xs">
                  Selected Quizzes ({selectedQuizzes.length})
                </Text>
                <Stack gap="xs">
                  {selectedQuizzes.map((quiz, index) => (
                    <Card key={quiz._id} p="sm" withBorder>
                      <Group justify="space-between">
                        <Group gap="sm" w={"80%"}>
                          <Text size="xs" c="dimmed" style={{ minWidth: 20 }}>
                            {index + 1}.
                          </Text>
                          <div style={{ flex: 1 }}>
                            <Text size="sm" lineClamp={1}>
                              {quiz.question}
                            </Text>
                            {quiz.category && (
                              <Text size="xs" c="dimmed">
                                {quiz.category.name}
                              </Text>
                            )}
                          </div>
                          <Badge size="sm" color="blue">
                            {quiz.xpValue} XP
                          </Badge>
                        </Group>
                        <Group gap="xs">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() => moveQuizUp(index)}
                            disabled={index === 0}
                          >
                            <ArrowUp size={14} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() => moveQuizDown(index)}
                            disabled={index === selectedQuizzes.length - 1}
                          >
                            <ArrowDown size={14} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => removeQuizFromSelection(quiz._id)}
                          >
                            <Trash size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Box>
            )}
          </div>

          <Group justify="flex-end" mt="lg">
            <Button variant="outline" onClick={closeCreate}>
              Cancel
            </Button>
            <Button onClick={handleCreateQuizGame} loading={submitting}>
              Create Game
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Edit Quiz Game Modal */}
      <Modal
        opened={editOpened}
        onClose={closeEdit}
        title="Edit Quiz Game"
        size="lg"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Game Name"
            placeholder="Enter game name"
            required
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.currentTarget.value })
            }
          />

          <Textarea
            label="Description"
            placeholder="Enter game description"
            rows={3}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.currentTarget.value })
            }
          />

          <Group grow>
            <Select
              label="Type"
              required
              data={[
                { value: "strategy", label: "Strategy" },
                { value: "pokermaths", label: "Poker Maths" },
              ]}
              value={formData.type}
              onChange={(value) =>
                setFormData({ ...formData, type: value || "strategy" })
              }
            />

            <Select
              label="Difficulty"
              required
              data={[
                { value: "easy", label: "Easy" },
                { value: "medium", label: "Medium" },
                { value: "hard", label: "Hard" },
              ]}
              value={formData.difficulty}
              onChange={(value) =>
                setFormData({ ...formData, difficulty: value || "medium" })
              }
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Time Limit (seconds)"
              min={10}
              max={300}
              value={formData.timeLimit}
              onChange={(value) =>
                setFormData({ ...formData, timeLimit: Number(value) || 30 })
              }
            />

            <NumberInput
              label="Passing Score (%)"
              min={1}
              max={100}
              value={formData.passingScore}
              onChange={(value) =>
                setFormData({ ...formData, passingScore: Number(value) || 70 })
              }
            />

            <NumberInput
              label="Bonus XP"
              min={0}
              value={formData.bonusXp}
              onChange={(value) =>
                setFormData({ ...formData, bonusXp: Number(value) || 50 })
              }
            />
          </Group>

          {/* <Group grow>
            <Switch
              label="Shuffle Questions"
              checked={formData.shuffleQuestions}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  shuffleQuestions: e.currentTarget.checked,
                })
              }
            />

            <Switch
              label="Show Explanations"
              checked={formData.showExplanations}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  showExplanations: e.currentTarget.checked,
                })
              }
            />
          </Group> */}

          {/* Quiz Selection with Ordering - Same as create modal */}
          <div>
            <Text size="sm" fw={500} mb="xs">
              Select Quizzes *
            </Text>
            <Select
              placeholder="Choose a quiz to add"
              data={availableQuizzes
                .filter(
                  (quiz) => !selectedQuizzes.find((s) => s._id === quiz._id)
                )
                .map((quiz) => ({
                  value: quiz._id,
                  label: `${quiz.question.substring(0, 60)}...${
                    quiz.category ? ` (${quiz.category.name})` : ""
                  }`,
                }))}
              onChange={(value) => {
                if (value) {
                  addQuizToSelection(value);
                }
              }}
              searchable
              clearable
              value=""
            />

            {/* Selected Quizzes with Ordering */}
            {selectedQuizzes.length > 0 && (
              <Box mt="md">
                <Text size="sm" fw={500} mb="xs">
                  Selected Quizzes ({selectedQuizzes.length})
                </Text>
                <Stack gap="xs">
                  {selectedQuizzes.map((quiz, index) => (
                    <Card key={quiz._id} p="sm" withBorder>
                      <Group justify="space-between">
                        <Box w="80%">
                          <Group gap="sm" wrap="nowrap">
                            <Text size="xs" c="dimmed" style={{ minWidth: 20 }}>
                              {index + 1}.
                            </Text>
                            <div style={{ flex: 1, width: "100%" }}>
                              <Text size="sm" lineClamp={1} w="100%">
                                {quiz.question}
                              </Text>
                              {quiz.category && (
                                <Text size="xs" c="dimmed">
                                  {quiz.category.name}
                                </Text>
                              )}
                            </div>
                            <Badge size="sm" color="blue">
                              {quiz.xpValue} XP
                            </Badge>
                          </Group>
                        </Box>
                        <Group gap="xs">
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() => moveQuizUp(index)}
                            disabled={index === 0}
                          >
                            <ArrowUp size={14} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            onClick={() => moveQuizDown(index)}
                            disabled={index === selectedQuizzes.length - 1}
                          >
                            <ArrowDown size={14} />
                          </ActionIcon>
                          <ActionIcon
                            size="sm"
                            variant="subtle"
                            color="red"
                            onClick={() => removeQuizFromSelection(quiz._id)}
                          >
                            <Trash size={14} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Box>
            )}
          </div>

          <Group justify="flex-end" mt="lg">
            <Button variant="outline" onClick={closeEdit}>
              Cancel
            </Button>
            <Button onClick={handleUpdateQuizGame} loading={submitting}>
              Update Game
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* View Modal */}
      {currentQuizGame && (
        <Modal
          opened={viewOpened}
          onClose={closeView}
          title="Quiz Game Details"
          size="lg"
          centered
        >
          <Card withBorder>
            <Stack gap="md">
              <div>
                <Text fw={500}>Game Name</Text>
                <Text>{currentQuizGame.name}</Text>
              </div>

              <div>
                <Text fw={500}>Description</Text>
                <Text>{currentQuizGame.description}</Text>
              </div>

              <Group grow>
                <div>
                  <Text fw={500}>Type</Text>
                  <Badge leftSection={getTypeIcon(currentQuizGame.type)}>
                    {currentQuizGame.type === "strategy"
                      ? "Strategy"
                      : "Poker Maths"}
                  </Badge>
                </div>
                <div>
                  <Text fw={500}>Difficulty</Text>
                  <Badge color={getDifficultyColor(currentQuizGame.difficulty)}>
                    {currentQuizGame.difficulty.charAt(0).toUpperCase() +
                      currentQuizGame.difficulty.slice(1)}
                  </Badge>
                </div>
              </Group>

              <div>
                <Text fw={500}>Quizzes ({currentQuizGame.quizzes.length})</Text>
                <Box mt="xs" style={{ maxHeight: 200, overflowY: "auto" }}>
                  {currentQuizGame.quizzes.map((quiz, index) => (
                    <Card key={quiz._id} p="xs" mb="xs" withBorder>
                      <Group justify="space-between">
                        <Text size="sm" lineClamp={2}>
                          {index + 1}. {quiz.question}
                        </Text>
                        <Badge size="sm" color="blue">
                          {quiz.xpValue} XP
                        </Badge>
                      </Group>
                    </Card>
                  ))}
                </Box>
              </div>
            </Stack>
          </Card>

          <Group justify="flex-end" mt="lg">
            <Button variant="outline" onClick={closeView}>
              Close
            </Button>
            <Button
              onClick={() => {
                closeView();
                handleOpenEdit(currentQuizGame);
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
        title="Delete Quiz Game"
        centered
      >
        <Text>
          Are you sure you want to delete this quiz game? This action cannot be
          undone.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={closeDelete}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDeleteQuizGame}>
            Delete
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
