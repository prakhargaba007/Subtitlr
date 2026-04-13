"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Loader,
  Paper,
  Title,
  Container,
  Select,
  Image,
  Tabs,
  Pagination,
  Flex,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconCircleCheck,
  IconCircleX,
  IconUser,
  IconSearch,
  IconEye,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";
import { useRouter } from "next/navigation";
import UserModal from "@/components/UserModal";

interface User {
  _id: string;
  name: string;
  email: string;
  userName: string;
  phoneNumber?: number;
  role: "student" | "admin" | "sub-admin";
  profilePicture?: string;
  bio?: string;
  isActive: boolean;
  isVerified: boolean;
  accessPermissions?: string[];
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
    website?: string;
    youtube?: string;
  };
  createdAt: string;
  updatedAt: string;
}


export default function AllProfiles() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [editMode, setEditMode] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("all");
  console.log("activeTab", activeTab);
  // Search and pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  // Fetch users with backend parameters
  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Build query parameters
      const params: any = {
        page: currentPage,
        limit: pageSize,
        sort: "createdAt",
        order: "desc",
      };

      // Add search parameter
      if (debouncedSearchQuery.trim()) {
        params.search = debouncedSearchQuery.trim();
      }

      // Add role filter based on active tab
      if (activeTab && activeTab !== "all") {
        if (activeTab === "customers") {
          params.role = "customer";
        }
        if (activeTab === "sub-admins") {
          params.role = "sub-admin";
        }
      }

      const response = await axiosInstance.get("/api/user/all", { params });
      console.log("response", response.data);

      const { data: users, total, totalPages: pages } = response.data;

      setUsers(users);
      setTotalUsers(total);
      setTotalPages(pages);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch users",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 when search or filters change
  const resetToFirstPage = () => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      fetchUsers();
    }
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize]);

  useEffect(() => {
    resetToFirstPage();
  }, [activeTab, debouncedSearchQuery]);

  // Open modal for creating a new user
  const handleCreateUser = () => {
    setEditMode(false);
    setCurrentUser(null);
    open();
  };

  // Open modal for editing a user
  const handleEditUser = (user: User) => {
    setEditMode(true);
    setCurrentUser(user);
    open();
  };

  // Toggle user active status
  const toggleUserStatus = async (user: User) => {
    if (
      window.confirm(
        `Are you sure you want to ${user.isActive ? "deactivate" : "activate"
        } this user?`
      )
    ) {
      try {
        const endpoint = user.isActive
          ? "/api/user/deactivate"
          : "/api/user/reactivate";
        await axiosInstance.put(endpoint, { userId: user._id });

        notifications.show({
          title: "Success",
          message: `User ${user.isActive ? "deactivated" : "activated"
            } successfully`,
          color: "green",
        });
        fetchUsers();
      } catch (error) {
        notifications.show({
          title: "Error",
          message: "Failed to update user status",
          color: "red",
        });
      }
    }
  };

  // Handle modal success callback
  const handleModalSuccess = () => {
    fetchUsers();
  };

  // View user details
  const handleViewUser = (id: string) => {
    router.push(`/dashboard/profiles/${id}`);
  };

  // Delete a user
  const handleDeleteUser = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await axiosInstance.delete(`/api/user/delete/${id}`);
        notifications.show({
          title: "Success",
          message: "User deleted successfully",
          color: "green",
        });
        fetchUsers();
      } catch (error) {
        notifications.show({
          title: "Error",
          message: "Failed to delete user",
          color: "red",
        });
      }
    }
  };

  return (
    <Container size="xl">
      <Paper p="md" shadow="xs" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={2}>Manage Profiles</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreateUser}
          >
            Create New Profile
          </Button>
        </Group>

        {/* Search and Page Size Controls */}
        <Flex gap="md" mb="md" align="end">
          <TextInput
            label="Search Profiles"
            placeholder="Search by name, email, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1 }}
          />
          <Select
            label="Page Size"
            value={pageSize.toString()}
            onChange={(value) => {
              setPageSize(parseInt(value || "10"));
              setCurrentPage(1);
            }}
            data={[
              { value: "10", label: "10 per page" },
              { value: "20", label: "20 per page" },
              { value: "50", label: "50 per page" },
              { value: "100", label: "100 per page" },
            ]}
            w={140}
          />
        </Flex>

        <Tabs value={activeTab} onChange={setActiveTab} mb="md">
          <Tabs.List>
            <Tabs.Tab value="all">All Profiles</Tabs.Tab>
            <Tabs.Tab value="customers">Customers</Tabs.Tab>
            <Tabs.Tab value="sub-admins">Sub Admins</Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {/* Results Summary */}
        {!loading && (
          <Text size="sm" c="dimmed" mb="md">
            Showing {users.length} of {totalUsers} profiles
            {searchQuery && ` matching "${searchQuery}"`}
            {activeTab && activeTab !== "all" && ` (${activeTab})`}
          </Text>
        )}

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
        ) : users.length === 0 ? (
          <Text ta="center" py="xl" c="dimmed">
            {searchQuery
              ? "No profiles found matching your search."
              : "No profiles found."}
          </Text>
        ) : (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Profile</Table.Th>
                <Table.Th>Name</Table.Th>
                {/* <Table.Th>Username</Table.Th>  */}
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created At</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {users.map((user) => (
                <Table.Tr key={user._id}>
                  <Table.Td>
                    {user.profilePicture ? (
                      <Image
                        src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${user.profilePicture}`}
                        height={50}
                        width={50}
                        style={{
                          width: 50,
                          height: 50,
                        }}
                        radius="xl"
                        fit="cover"
                        alt={user.name}
                        fallbackSrc="https://placehold.co/50x50?text=User"
                      />
                    ) : (
                      <div
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: "50%",
                          backgroundColor: "#f0f0f0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconUser size={24} color="#aaa" />
                      </div>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <div
                      className="w-40"
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={user.name}
                    >
                      {user.name}
                    </div></Table.Td>
                  {/* <Table.Td>
                    <div
                      className="w-40"
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={user.userName}
                    >
                      {user.userName}
                    </div>
                  </Table.Td> */}
                  <Table.Td>
                    <div
                      className="w-40"
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={user.email}
                    >
                      {user.email}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        user.role === "admin"
                          ? "red"
                          : user.role === "sub-admin"
                            ? "orange"
                            : "gray"
                      }
                    >
                      {user.role}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={user.isActive ? "green" : "red"}
                      style={{ cursor: "pointer" }}
                      onClick={() => toggleUserStatus(user)}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </Table.Td>
                  <Table.Td>
                    <Group>
                      <Tooltip label="View Details">
                        <ActionIcon
                          variant="subtle"
                          color="green"
                          onClick={() => handleViewUser(user._id)}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Edit">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => handleEditUser(user)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip
                        label={user.isActive ? "Deactivate" : "Activate"}
                      >
                        <ActionIcon
                          variant="subtle"
                          color={user.isActive ? "orange" : "green"}
                          onClick={() => toggleUserStatus(user)}
                        >
                          {user.isActive ? (
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
                          onClick={() => handleDeleteUser(user._id)}
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
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <Flex justify="center" mt="md">
            <Pagination
              value={currentPage}
              onChange={setCurrentPage}
              total={totalPages}
              size="sm"
              withEdges
            />
          </Flex>
        )}
      </Paper>

      {/* User Modal Component */}
      <UserModal
        opened={opened}
        onClose={close}
        editMode={editMode}
        currentUser={currentUser}
        onSuccess={handleModalSuccess}
      />
    </Container>
  );
}
