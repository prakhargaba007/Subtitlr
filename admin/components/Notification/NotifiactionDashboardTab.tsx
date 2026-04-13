import { SimpleGrid, Card, Text, Title, Group, Button } from "@mantine/core";
import {
  IconBellRinging,
  IconDeviceMobile,
  IconUserCheck,
  IconSend,
  IconBroadcast,
} from "@tabler/icons-react";
import NotificationHistoryTab from "@/components/Notification/NotificationHistory";

interface NotificationHistory {
  _id: string;
  title: string;
  body: string;
  data: any;
  sentTo: string[];
  sentBy: string;
  sentAt: string;
  status: "success" | "partial" | "failed";
  successCount: number;
  failureCount: number;
}

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

export default function NotifiactionDashboardTab({
  notificationHistory,
  deviceTokens,
  setActiveTab,
  setNotificationForm,
}: {
  notificationHistory: NotificationHistory[];
  deviceTokens: DeviceToken[];
  setActiveTab: (tab: string) => void;
  setNotificationForm: (form: any) => void;
}) {
  return (
  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <IconBellRinging size={30} color="blue" />
      <Text fw={700} mt="md">
        Total Notifications
      </Text>
      <Text size="xl" fw={700} mt="xs">
        {notificationHistory.length}
      </Text>
      <Text size="xs" c="dimmed">
        Last 30 days
      </Text>
    </Card>

    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <IconDeviceMobile size={30} color="green" />
      <Text fw={700} mt="md">
        Registered Devices
      </Text>
      <Text size="xl" fw={700} mt="xs">
        {deviceTokens.length}
      </Text>
      <Text size="xs" c="dimmed">
        Active devices
      </Text>
    </Card>

    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <IconUserCheck size={30} color="violet" />
      <Text fw={700} mt="md">
        Active Users
      </Text>
      <Text size="xl" fw={700} mt="xs">
        {deviceTokens.filter((token) => token.isLoggedIn).length}
      </Text>
      <Text size="xs" c="dimmed">
        Currently logged in
      </Text>
    </Card>

    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{ gridColumn: "span 3" }}
    >
      <Title order={4} mb="md">
        Quick Actions
      </Title>
      <Group>
        <Button
          leftSection={<IconSend size={16} />}
          onClick={() => setActiveTab("send")}
        >
          Send New Notification
        </Button>

        <Button
          leftSection={<IconBroadcast size={16} />}
          variant="outline"
          onClick={() => {
            setActiveTab("send");
            setNotificationForm((prev: any) => ({
              ...prev,
              sendToAll: true,
              title: "Important Announcement",
              body: "We have an important announcement to share with all users.",
            }));
          }}
        >
          Broadcast Announcement
        </Button>
      </Group>
    </Card>

    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{ gridColumn: "span 3" }}
    >
      <NotificationHistoryTab
        bordered={false}
        loading={false}
        notificationHistory={notificationHistory}
      />
    </Card>
  </SimpleGrid>
  );
}
