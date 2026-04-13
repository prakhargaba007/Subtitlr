import {
  Paper,
  Title,
  Loader,
  Alert,
  Table,
  Badge,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  Modal,
  Button,
} from "@mantine/core";
import { IconInfoCircle, IconTrash } from "@tabler/icons-react";

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

export default function DeviceTokensTab({
  loading,
  deviceTokens,
  viewTokenDetails,
  handleDeleteToken,
  opened,
  close,
  selectedToken,
}: {
  loading: boolean;
  deviceTokens: DeviceToken[];
  viewTokenDetails: (token: DeviceToken) => void;
  handleDeleteToken: (tokenId: string) => void;
  opened: boolean;
  close: () => void;
  selectedToken: DeviceToken | null;
}) {
  // Helper function to get badge color based on role
  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case "admin":
        return "red";
      case "instructor":
        return "blue";
      case "student":
        return "green";
      case "influencer":
        return "violet";
      default:
        return "gray";
    }
  };
  return (
    <Paper p="md" shadow="xs" withBorder>
      <Title order={3} mb="md">
        Device Tokens
      </Title>

      {loading ? (
        <div
          style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
        >
          <Loader />
        </div>
      ) : deviceTokens.length === 0 ? (
        <Alert
          icon={<IconInfoCircle size={16} />}
          title="No device tokens"
          color="blue"
        >
          No device tokens have been registered yet.
        </Alert>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>User</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Device</Table.Th>
              <Table.Th>Last Seen</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {deviceTokens.map((token) => (
              <Table.Tr key={token._id}>
                <Table.Td>
                  {token.userId ? (
                    <div>
                      <Text size="sm" fw={500}>
                        {token.userId.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {token.userId.email}
                      </Text>
                      <Badge
                        size="xs"
                        color={getRoleBadgeColor(token.userId.role)}
                      >
                        {token.userId.role}
                      </Badge>
                    </div>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Guest User
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge color={token.isLoggedIn ? "green" : "gray"}>
                    {token.isLoggedIn ? "Logged In" : "Logged Out"}
                  </Badge>
                  {token.isNewUser && (
                    <Badge color="blue" ml={5}>
                      New
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {token.deviceInfo?.platform || "Unknown"}
                    {token.deviceInfo?.version
                      ? ` ${token.deviceInfo.version}`
                      : ""}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {token.deviceInfo?.model || "Unknown Device"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {new Date(token.lastSeen).toLocaleDateString()}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {new Date(token.lastSeen).toLocaleTimeString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group>
                    <Tooltip label="View Details">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => viewTokenDetails(token)}
                      >
                        <IconInfoCircle size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete Token">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteToken(token._id)}
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

      <Modal
        opened={opened}
        onClose={close}
        title="Device Token Details"
        size="lg"
      >
        {selectedToken && (
          <div>
            <Text fw={700}>Token ID:</Text>
            <Text mb="md">{selectedToken._id}</Text>

            <Text fw={700}>Push Token:</Text>
            <Text mb="md" style={{ wordBreak: "break-all" }}>
              {selectedToken.expoPushToken}
            </Text>

            <Text fw={700}>User:</Text>
            <Text mb="md">
              {selectedToken.userId
                ? `${selectedToken.userId.name} (${selectedToken.userId.email})`
                : "Guest User"}
            </Text>

            <Text fw={700}>Device Info:</Text>
            <Text mb="md">
              Platform: {selectedToken.deviceInfo?.platform || "Unknown"}
              <br />
              Version: {selectedToken.deviceInfo?.version || "Unknown"}
              <br />
              Model: {selectedToken.deviceInfo?.model || "Unknown"}
            </Text>

            <Text fw={700}>Status:</Text>
            <Group mb="md">
              <Badge color={selectedToken.isLoggedIn ? "green" : "gray"}>
                {selectedToken.isLoggedIn ? "Logged In" : "Logged Out"}
              </Badge>
              {selectedToken.isNewUser && <Badge color="blue">New User</Badge>}
            </Group>

            <Text fw={700}>Dates:</Text>
            <Text>
              Last Seen: {new Date(selectedToken.lastSeen).toLocaleString()}
              <br />
              Registered: {new Date(selectedToken.createdAt).toLocaleString()}
            </Text>

            <Group justify="flex-end" mt="xl">
              <Button
                color="red"
                onClick={() => {
                  handleDeleteToken(selectedToken._id);
                  close();
                }}
              >
                Delete Token
              </Button>
            </Group>
          </div>
        )}
      </Modal>
    </Paper>
  );
}
