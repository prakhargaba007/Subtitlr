"use client";
import { useState, useEffect } from "react";
import {
  Container,
  Title,
  Paper,
  Tabs,
  TextInput,
  Textarea,
  Button,
  Group,
  Select,
  MultiSelect,
  Switch,
  Table,
  Badge,
  Text,
  Loader,
  Divider,
  Alert,
  Modal,
  ActionIcon,
  Tooltip,
  Box,
  Card,
  SimpleGrid,
  FileInput,
  Pagination,
  Stack,
  Flex,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconSend,
  IconDeviceMobile,
  IconUsers,
  IconHistory,
  IconCheck,
  IconX,
  IconTrash,
  IconInfoCircle,
  IconBellRinging,
  IconUserCheck,
  IconAlertTriangle,
  IconBroadcast,
  IconSearch,
  IconFilter,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";
import NotificationHistoryTab from "@/components/Notification/NotificationHistory";
import NotifiactionDashboardTab from "@/components/Notification/NotifiactionDashboardTab";
import DeviceTokensTab from "@/components/Notification/DeviceTokensTab";

interface DeviceToken {
  _id: string;
  expoPushToken: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    userName: string;
    role: string;
  } | null;
  isLoggedIn: boolean;
  isNewUser: boolean;
  deviceInfo: {
    platform?: string;
    version?: string;
    model?: string;
  };
  lastSeen: string;
  createdAt: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  userName: string;
  role: string;
}

interface NotificationHistory {
  _id: string;
  title: string;
  body: string;
  data: any;
  imageUrl?: string;
  sentTo: string[];
  sentBy: string;
  sentAt: string;
  status: "success" | "partial" | "failed";
  successCount: number;
  failureCount: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<string | null>("send");
  const [deviceTokens, setDeviceTokens] = useState<DeviceToken[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [notificationHistory, setNotificationHistory] = useState<
    NotificationHistory[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedToken, setSelectedToken] = useState<DeviceToken | null>(null);
  
  // Pagination and search states for history tab
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
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("newest");
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    body: "",
    data: "{}",
    imageFile: null as File | null,
    sendToAll: false,
    selectedRole: "",
    selectedUsers: [] as string[],
    onlyLoggedIn: true,
  });

  // Fetch device tokens
  const fetchDeviceTokens = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/api/device-tokens");
      setDeviceTokens(response.data.deviceTokens);
    } catch (error) {
      console.error("Error fetching device tokens:", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch device tokens",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch users for the dropdown
  const fetchUsers = async () => {
    try {
      const response = await axiosInstance.get("/api/user");
      setUsers(response.data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  // Fetch notification history
  const fetchNotificationHistory = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: pagination.currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (statusFilter) params.append("status", statusFilter);

      const response = await axiosInstance.get(
        `/api/device-tokens/notification-history?${params.toString()}`
      );

      if (response.data && response.data.notifications) {
        const notificationsData = response.data.notifications.map((notification: any) => ({
          _id: notification._id,
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          imageUrl: notification.imageUrl,
          sentTo: notification.sentTo || ["Unknown"],
          sentBy: notification.sentBy ? notification.sentBy.name : "System",
          sentAt: notification.createdAt,
          status: notification.status,
          successCount: notification.successCount,
          failureCount: notification.failureCount,
        }));

        const paginationData = response.data.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalCount: notificationsData.length,
          limit: itemsPerPage,
          hasNextPage: false,
          hasPrevPage: false,
        };

        setNotificationHistory(notificationsData);
        setPagination(paginationData);
      } else {
        // Fallback to placeholder data if API doesn't return expected format
        const fallbackData: NotificationHistory[] = [
          {
            _id: "1",
            title: "New Course Available",
            body: "Check out our latest poker strategy course!",
            data: { screen: "CourseDetails", courseId: "123" },
            sentTo: ["All Users"],
            sentBy: "Admin",
            sentAt: new Date().toISOString(),
            status: "success" as const,
            successCount: 42,
            failureCount: 0,
          },
          {
            _id: "2",
            title: "Maintenance Notice",
            body: "The platform will be down for maintenance on Sunday from 2-4 AM EST",
            data: {},
            sentTo: ["Instructors", "Students"],
            sentBy: "System",
            sentAt: new Date(Date.now() - 86400000).toISOString(),
            status: "partial" as const,
            successCount: 38,
            failureCount: 3,
          },
        ];
        
        setNotificationHistory(fallbackData);
        setPagination({
          currentPage: 1,
          totalPages: 1,
          totalCount: fallbackData.length,
          limit: itemsPerPage,
          hasNextPage: false,
          hasPrevPage: false,
        });
      }
    } catch (error) {
      console.error("Error fetching notification history:", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch notification history",
        color: "red",
      });
      setNotificationHistory([]);
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

  useEffect(() => {
    if (activeTab === "devices") {
      fetchDeviceTokens();
    } else if (activeTab === "history") {
      fetchNotificationHistory();
    } else if (activeTab === "dashboard") {
      fetchDeviceTokens();
      fetchNotificationHistory();
    }

    // Always fetch users for the dropdown
    fetchUsers();
  }, [activeTab]);

  // Refetch notification history when pagination, search, or filters change
  useEffect(() => {
    if (activeTab === "history") {
      fetchNotificationHistory();
    }
  }, [pagination.currentPage, itemsPerPage, sortBy, statusFilter]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (pagination.currentPage !== 1) {
        setPagination(prev => ({ ...prev, currentPage: 1 }));
      } else {
        fetchNotificationHistory();
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

  const handleNotificationFormChange = (field: string, value: any) => {
    setNotificationForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle image file selection
  const handleImageFileChange = (file: File | null) => {
    setNotificationForm((prev) => ({
      ...prev,
      imageFile: file,
    }));
  };

  const handleSendNotification = async () => {
    try {
      setSendingNotification(true);

      let endpoint = "";
      let formData = new FormData();
      
      // Add basic notification data
      formData.append("title", notificationForm.title);
      formData.append("body", notificationForm.body);
      formData.append("data", notificationForm.data || "{}");
      formData.append("uploadType", "notifications");
      
      // Add image file if selected
      if (notificationForm.imageFile) {
        formData.append("notificationImage", notificationForm.imageFile);
      }

      if (notificationForm.sendToAll) {
        endpoint = "/api/device-tokens/broadcast";
        formData.append("onlyLoggedIn", notificationForm.onlyLoggedIn.toString());
      } else if (notificationForm.selectedRole) {
        endpoint = "/api/device-tokens/broadcast";
        formData.append("role", notificationForm.selectedRole);
        formData.append("onlyLoggedIn", notificationForm.onlyLoggedIn.toString());
      } else if (notificationForm.selectedUsers.length > 0) {
        // This would need to be implemented in the backend
        endpoint = "/api/device-tokens/send-to-users";
        formData.append("userIds", JSON.stringify(notificationForm.selectedUsers));
      } else {
        notifications.show({
          title: "Error",
          message: "Please select recipients for the notification",
          color: "red",
        });
        setSendingNotification(false);
        return;
      }

      const response = await axiosInstance.post(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      notifications.show({
        title: "Success",
        message: "Notification sent successfully",
        color: "green",
      });

      // Reset form
      setNotificationForm({
        title: "",
        body: "",
        data: "{}",
        imageFile: null,
        sendToAll: false,
        selectedRole: "",
        selectedUsers: [],
        onlyLoggedIn: true,
      });

      // Refresh notification history
      if (activeTab === "history") {
        fetchNotificationHistory();
      }
    } catch (error) {
      console.error("Error sending notification:", error);
      notifications.show({
        title: "Error",
        message: "Failed to send notification",
        color: "red",
      });
    } finally {
      setSendingNotification(false);
    }
  };

  const handleDeleteToken = async (tokenId: string) => {
    try {
      await axiosInstance.delete(`/api/device-tokens/${tokenId}`);
      notifications.show({
        title: "Success",
        message: "Device token deleted successfully",
        color: "green",
      });
      fetchDeviceTokens();
    } catch (error) {
      console.error("Error deleting device token:", error);
      notifications.show({
        title: "Error",
        message: "Failed to delete device token",
        color: "red",
      });
    }
  };

  const viewTokenDetails = (token: DeviceToken) => {
    setSelectedToken(token);
    open();
  };

  const renderSendNotificationTab = () => (
    <Paper p="md" shadow="xs" withBorder>
      <Title order={3} mb="md">
        Send Notification
      </Title>

      <TextInput
        label="Title"
        placeholder="Notification title"
        required
        value={notificationForm.title}
        onChange={(e) => handleNotificationFormChange("title", e.target.value)}
        mb="md"
      />

      <Textarea
        label="Message"
        placeholder="Notification message"
        required
        minRows={3}
        value={notificationForm.body}
        onChange={(e) => handleNotificationFormChange("body", e.target.value)}
        mb="md"
      />

      <Divider my="md" label="Notification Image (Optional)" labelPosition="center" />
      
      <FileInput
        label="Image File"
        placeholder="Choose an image file"
        accept="image/png,image/jpeg"
        value={notificationForm.imageFile}
        onChange={handleImageFileChange}
        description="Select an image file to include in the notification (JPG, PNG)"
        mb="md"
      />

      {notificationForm.imageFile && (
        <Box mb="md">
          <Text size="sm" mb="xs">Selected Image:</Text>
          <Text size="xs" c="dimmed">
            {notificationForm.imageFile.name} ({(notificationForm.imageFile.size / 1024 / 1024).toFixed(2)} MB)
          </Text>
        </Box>
      )}

      {/* <Textarea
        label="Data (JSON)"
        placeholder='{"screen": "Home", "param": "value"}'
        value={notificationForm.data}
        onChange={(e) => handleNotificationFormChange("data", e.target.value)}
        mb="md"
        description="Optional JSON data to send with the notification"
      /> */}

      <Divider my="md" label="Recipients" labelPosition="center" />

      <Switch
        label="Send to all users"
        checked={notificationForm.sendToAll}
        onChange={(e) =>
          handleNotificationFormChange("sendToAll", e.currentTarget.checked)
        }
        mb="md"
      />

      {!notificationForm.sendToAll && (
        <>
          <Select
            label="Send to role"
            placeholder="Select a role"
            data={[
              { value: "admin", label: "Admins" },
              { value: "instructor", label: "Instructors" },
              { value: "student", label: "Students" },
              { value: "influencer", label: "Influencers" },
            ]}
            value={notificationForm.selectedRole}
            onChange={(value) =>
              handleNotificationFormChange("selectedRole", value)
            }
            mb="md"
            clearable
          />

          {/* {!notificationForm.selectedRole && ( */}
          {false && (
            <MultiSelect
              label="Send to specific users"
              placeholder="Select users"
              data={users.map((user) => ({
                value: user._id,
                label: `${user.name} (${user.email})`,
              }))}
              value={notificationForm.selectedUsers}
              onChange={(value) =>
                handleNotificationFormChange("selectedUsers", value)
              }
              searchable
              mb="md"
            />
          )}
        </>
      )}

      <Switch
        label="Only send to logged-in users"
        checked={notificationForm.onlyLoggedIn}
        onChange={(e) =>
          handleNotificationFormChange("onlyLoggedIn", e.currentTarget.checked)
        }
        mb="md"
      />

      <Group justify="flex-end" mt="xl">
        <Button
          leftSection={<IconSend size={16} />}
          onClick={handleSendNotification}
          loading={sendingNotification}
        >
          Send Notification
        </Button>
      </Group>
    </Paper>
  );

  const renderHistoryTab = () => (
    <>
      {/* Search and Filter Controls */}
      <Paper p="md" mb="lg" withBorder>
        <Stack>
          <Flex gap="md" wrap="wrap" align="end">
            <TextInput
              placeholder="Search notifications by title or content..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={handleSearchChange}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Select
              placeholder="Filter by status"
              data={[
                { value: "success", label: "Success" },
                { value: "partial", label: "Partial" },
                { value: "failed", label: "Failed" },
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
                { value: "status", label: "Status" },
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
              Showing {notificationHistory.length} of {pagination.totalCount} notifications
            </Text>
          </Group>
        </Stack>
      </Paper>

      {/* Notifications History Table */}
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
      ) : notificationHistory.length === 0 ? (
        <Text ta="center" py="xl" c="dimmed">
          {searchQuery || statusFilter 
            ? "No notifications found matching your search criteria." 
            : "No notification history found."
          }
        </Text>
      ) : (
        <Paper shadow="sm" withBorder>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Content</Table.Th>
                <Table.Th>Sent To</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Success/Failure</Table.Th>
                <Table.Th>Sent By</Table.Th>
                <Table.Th>Date</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {notificationHistory.map((notification) => (
                <Table.Tr key={notification._id}>
                  <Table.Td>
                    <Text fw={500}>{notification.title}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2} style={{ maxWidth: "200px" }}>
                      {notification.body}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{notification.sentTo.join(", ")}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        notification.status === "success"
                          ? "green"
                          : notification.status === "partial"
                          ? "yellow"
                          : "red"
                      }
                    >
                      {notification.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      <Text component="span" c="green">
                        ✓ {notification.successCount}
                      </Text>
                      {" / "}
                      <Text component="span" c="red">
                        ✗ {notification.failureCount}
                      </Text>
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{notification.sentBy}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(notification.sentAt).toLocaleDateString()}
                    </Text>
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
        </Paper>
      )}
    </>
  );

  return (
    <Container size="xl">
      <Title order={2} mb="md">
        Notifications Management
      </Title>

      <Tabs value={activeTab} onChange={setActiveTab} mb="md">
        <Tabs.List>
          <Tabs.Tab
            value="dashboard"
            leftSection={<IconInfoCircle size={16} />}
          >
            Dashboard
          </Tabs.Tab>
          <Tabs.Tab value="send" leftSection={<IconSend size={16} />}>
            Send Notification
          </Tabs.Tab>
          {/* <Tabs.Tab
            value="devices"
            leftSection={<IconDeviceMobile size={16} />}
          >
            Device Tokens
          </Tabs.Tab> */}
          <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
            History
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {activeTab === "dashboard" &&
        NotifiactionDashboardTab({
          notificationHistory: notificationHistory,
          deviceTokens: deviceTokens,
          setActiveTab: setActiveTab,
          setNotificationForm: setNotificationForm,
        })}
      {activeTab === "send" && renderSendNotificationTab()}
      {activeTab === "devices" &&
        DeviceTokensTab({
          loading: false,
          deviceTokens: deviceTokens as DeviceToken[],
          viewTokenDetails: viewTokenDetails,
          handleDeleteToken: handleDeleteToken,
          opened: opened,
          close: close,
          selectedToken: selectedToken,
        })}
      {activeTab === "history" && renderHistoryTab()}
    </Container>
  );
}
