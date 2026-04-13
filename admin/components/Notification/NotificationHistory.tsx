import {
  Paper,
  Title,
  Loader,
  Alert,
  SimpleGrid,
  Card,
  Group,
  Badge,
  Text,
  Divider,
  Box,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";

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

export default function NotificationHistoryTab({
  bordered,
  loading,
  notificationHistory,
}: {
  bordered: boolean;
  loading: boolean;
  notificationHistory: NotificationHistory[];
}) {
  return (
    <Paper
      p={bordered ? "md" : "0"}
      shadow={bordered ? "xs" : "none"}
      withBorder={bordered}
    >
      <Title order={3} mb="md">
        Notification History
      </Title>

      {loading ? (
        <div
          style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
        >
          <Loader />
        </div>
      ) : notificationHistory.length === 0 ? (
        <Alert
          icon={<IconInfoCircle size={16} />}
          title="No notifications"
          color="blue"
        >
          No notifications have been sent yet.
        </Alert>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {notificationHistory.map((notification) => (
            <Card
              key={notification._id}
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
            >
              <Group justify="space-between" mb="xs">
                <Text fw={700}>{notification.title}</Text>
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
              </Group>

              <Text size="sm" c="dimmed" mb="md">
                {notification.body}
              </Text>

              <Divider my="sm" />

              <Text size="sm">
                <b>Sent to:</b> {notification.sentTo.join(", ")}
              </Text>

              <Text size="sm">
                <b>Sent by:</b> {notification.sentBy}
              </Text>

              <Text size="sm">
                <b>Sent at:</b> {new Date(notification.sentAt).toLocaleString()}
              </Text>

              <Text size="sm">
                <b>Delivery:</b> {notification.successCount} successful,{" "}
                {notification.failureCount} failed
              </Text>

              {notification.data &&
                Object.keys(notification.data).length > 0 && (
                  <Box mt="md">
                    <Text size="sm" fw={700}>
                      Data:
                    </Text>
                    <Text size="xs" style={{ fontFamily: "monospace" }}>
                      {JSON.stringify(notification.data, null, 2)}
                    </Text>
                  </Box>
                )}
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Paper>
  );
}
