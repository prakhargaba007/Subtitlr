"use client";
import React, { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Badge,
  Group,
  Button,
  Image,
  Grid,
  Card,
  Divider,
  Stack,
  Avatar,
  ActionIcon,
  Tooltip,
  Loader,
  Alert,
  SimpleGrid,
  Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconEdit,
  IconUser,
  IconMail,
  IconPhone,
  IconCalendar,
  IconAward,
  IconTrophy,
  IconBook,
  IconTarget,
  IconBrandTwitter,
  IconBrandLinkedin,
  IconBrandGithub,
  IconWorld,
  IconBrandYoutube,
  IconShield,
  IconSettings,
  IconActivity,
  IconClock,
} from "@tabler/icons-react";
import { useRouter, useParams } from "next/navigation";
import { useDisclosure } from "@mantine/hooks";
import axiosInstance from "@/utils/axios";
import UserModal from "@/components/UserModal";

interface User {
  _id: string;
  name: string;
  email: string;
  userName: string;
  phoneNumber?: number;
  role: "student" | "instructor" | "influencer" | "admin" | "sub-admin";
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
  preferences?: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    darkMode?: boolean;
  };
  skillLevel?: string;
  level?: number;
  xp?: number;
  streakCount?: number;
  gamePlayed?: number;
  badges?: any[];
  achievements?: any[];
  enrolledCourses?: string[];
  completedCourses?: string[];
  interests?: string[];
  gender?: string;
  language?: string;
  dateOfBirth?: string;
  hasUpdatedProfile?: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function UserDetailPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/api/user/${userId}`);
      setUser(response.data.data || response.data);
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to fetch user details",
        color: "red",
      });
      router.push("/dashboard/profiles/all-profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId]);

  const handleEditUser = () => {
    open();
  };

  const handleModalSuccess = () => {
    fetchUser(); // Refresh user data after successful update
  };

  const handleBack = () => {
    router.push("/dashboard/profiles/all-profiles");
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "instructor":
        return "blue";
      case "influencer":
        return "purple";
      case "admin":
        return "red";
      case "sub-admin":
        return "orange";
      default:
        return "gray";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <Container size="xl">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "50vh",
          }}
        >
          <Loader size="lg" />
        </div>
      </Container>
    );
  }

  if (!user) {
    return (
      <Container size="xl">
        <Alert color="red" title="User not found">
          The requested user could not be found.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Group>
          <ActionIcon variant="subtle" onClick={handleBack}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>User Profile Details</Title>
        </Group>
        <Button leftSection={<IconEdit size={16} />} onClick={handleEditUser}>
          Edit Profile
        </Button>
      </Group>

      <Grid>
        {/* Left Column - Profile Info */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" shadow="xs" withBorder>
            <Stack align="center" gap="md">
              {user.profilePicture ? (
                <Image
                  src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${user.profilePicture}`}
                  height={150}
                  width={150}
                  radius="xl"
                  fit="cover"
                  alt={user.name}
                />
              ) : (
                <Avatar size={150} radius="xl">
                  <IconUser size={80} />
                </Avatar>
              )}

              <div style={{ textAlign: "center" }}>
                <Title order={3}>{user.name}</Title>
                <Text size="sm" c="dimmed">
                  @{user.userName}
                </Text>
                <Badge color={getRoleColor(user.role)} size="lg" mt="xs">
                  {user.role.toUpperCase()}
                </Badge>
              </div>

              {/* Status Badges */}
              <Group>
                <Badge color={user.isActive ? "green" : "red"} variant="light">
                  {user.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge color={user.isVerified ? "blue" : "gray"} variant="light">
                  {user.isVerified ? "Verified" : "Unverified"}
                </Badge>
              </Group>

              {/* Bio */}
              {user.bio && (
                <Box>
                  <Text size="sm" ta="center" c="dimmed">
                    {user.bio}
                  </Text>
                </Box>
              )}
            </Stack>
          </Paper>

          {/* Social Links */}
          {user.socialLinks && (
            <Paper p="md" shadow="xs" withBorder mt="md">
              <Title order={4} mb="md">
                Social Links
              </Title>
              <Stack gap="sm">
                {user.socialLinks.twitter && (
                  <Group gap="sm">
                    <IconBrandTwitter size={20} color="#1DA1F2" />
                    <Text size="sm" component="a" href={user.socialLinks.twitter} target="_blank">
                      Twitter
                    </Text>
                  </Group>
                )}
                {user.socialLinks.linkedin && (
                  <Group gap="sm">
                    <IconBrandLinkedin size={20} color="#0077B5" />
                    <Text size="sm" component="a" href={user.socialLinks.linkedin} target="_blank">
                      LinkedIn
                    </Text>
                  </Group>
                )}
                {user.socialLinks.github && (
                  <Group gap="sm">
                    <IconBrandGithub size={20} />
                    <Text size="sm" component="a" href={user.socialLinks.github} target="_blank">
                      GitHub
                    </Text>
                  </Group>
                )}
                {user.socialLinks.website && (
                  <Group gap="sm">
                    <IconWorld size={20} color="#0066CC" />
                    <Text size="sm" component="a" href={user.socialLinks.website} target="_blank">
                      Website
                    </Text>
                  </Group>
                )}
                {user.socialLinks.youtube && (
                  <Group gap="sm">
                    <IconBrandYoutube size={20} color="#FF0000" />
                    <Text size="sm" component="a" href={user.socialLinks.youtube} target="_blank">
                      YouTube
                    </Text>
                  </Group>
                )}
              </Stack>
            </Paper>
          )}
        </Grid.Col>

        {/* Right Column - Detailed Information */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Stack gap="md">
            {/* Personal Information */}
            <Paper p="md" shadow="xs" withBorder>
              <Title order={3} mb="md">
                Personal Information
              </Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Group gap="sm">
                  <IconMail size={20} color="#666" />
                  <div>
                    <Text size="xs" c="dimmed">
                      Email
                    </Text>
                    <Text size="sm" fw={500}>
                      {user.email}
                    </Text>
                  </div>
                </Group>

                {user.phoneNumber && (
                  <Group gap="sm">
                    <IconPhone size={20} color="#666" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Phone
                      </Text>
                      <Text size="sm" fw={500}>
                        {user.phoneNumber}
                      </Text>
                    </div>
                  </Group>
                )}

                <Group gap="sm">
                  <IconCalendar size={20} color="#666" />
                  <div>
                    <Text size="xs" c="dimmed">
                      Joined
                    </Text>
                    <Text size="sm" fw={500}>
                      {formatDate(user.createdAt)}
                    </Text>
                  </div>
                </Group>

                {user.dateOfBirth && (
                  <Group gap="sm">
                    <IconCalendar size={20} color="#666" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Date of Birth
                      </Text>
                      <Text size="sm" fw={500}>
                        {formatDate(user.dateOfBirth)}
                      </Text>
                    </div>
                  </Group>
                )}

                {user.gender && (
                  <Group gap="sm">
                    <IconUser size={20} color="#666" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Gender
                      </Text>
                      <Text size="sm" fw={500}>
                        {user.gender}
                      </Text>
                    </div>
                  </Group>
                )}

                {user.language && (
                  <Group gap="sm">
                    <IconSettings size={20} color="#666" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Language
                      </Text>
                      <Text size="sm" fw={500}>
                        {user.language.toUpperCase()}
                      </Text>
                    </div>
                  </Group>
                )}
              </SimpleGrid>
            </Paper>

            {/* Learning Progress */}
            {/* {(user.level || user.xp || user.skillLevel) && (
              <Paper p="md" shadow="xs" withBorder>
                <Title order={3} mb="md">
                  Learning Progress
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                  {user.level && (
                    <Group gap="sm">
                      <IconTrophy size={20} color="#FFD700" />
                      <div>
                        <Text size="xs" c="dimmed">
                          Level
                        </Text>
                        <Text size="sm" fw={500}>
                          {user.level}
                        </Text>
                      </div>
                    </Group>
                  )}

                  {user.xp !== undefined && (
                    <Group gap="sm">
                      <IconAward size={20} color="#FF6B35" />
                      <div>
                        <Text size="xs" c="dimmed">
                          XP Points
                        </Text>
                        <Text size="sm" fw={500}>
                          {user.xp.toLocaleString()}
                        </Text>
                      </div>
                    </Group>
                  )}

                  {user.skillLevel && (
                    <Group gap="sm">
                      <IconTarget size={20} color="#4CAF50" />
                      <div>
                        <Text size="xs" c="dimmed">
                          Skill Level
                        </Text>
                        <Text size="sm" fw={500}>
                          {user.skillLevel.charAt(0).toUpperCase() + user.skillLevel.slice(1)}
                        </Text>
                      </div>
                    </Group>
                  )}

                  {user.streakCount !== undefined && (
                    <Group gap="sm">
                      <IconActivity size={20} color="#FF5722" />
                      <div>
                        <Text size="xs" c="dimmed">
                          Current Streak
                        </Text>
                        <Text size="sm" fw={500}>
                          {user.streakCount} days
                        </Text>
                      </div>
                    </Group>
                  )}

                  {user.gamePlayed !== undefined && (
                    <Group gap="sm">
                      <IconBook size={20} color="#9C27B0" />
                      <div>
                        <Text size="xs" c="dimmed">
                          Games Played
                        </Text>
                        <Text size="sm" fw={500}>
                          {user.gamePlayed}
                        </Text>
                      </div>
                    </Group>
                  )}

                  {user.enrolledCourses && (
                    <Group gap="sm">
                      <IconBook size={20} color="#2196F3" />
                      <div>
                        <Text size="xs" c="dimmed">
                          Enrolled Courses
                        </Text>
                        <Text size="sm" fw={500}>
                          {user.enrolledCourses.length}
                        </Text>
                      </div>
                    </Group>
                  )}
                </SimpleGrid>
              </Paper>
            )} */}

            {/* Permissions (for sub-admins) */}
            {user.role === "sub-admin" && user.accessPermissions && user.accessPermissions.length > 0 && (
              <Paper p="md" shadow="xs" withBorder>
                <Title order={3} mb="md">
                  Access Permissions
                </Title>
                <Group gap="sm">
                  {user.accessPermissions.map((permission, index) => (
                    <Badge key={index} variant="light" color="blue">
                      {permission}
                    </Badge>
                  ))}
                </Group>
              </Paper>
            )}

            {/* Preferences */}
            {user.preferences && (
              <Paper p="md" shadow="xs" withBorder>
                <Title order={3} mb="md">
                  Preferences
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                  <Group gap="sm">
                    <IconMail size={20} color="#666" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Email Notifications
                      </Text>
                      <Badge color={user.preferences.emailNotifications ? "green" : "red"} variant="light">
                        {user.preferences.emailNotifications ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </Group>

                  <Group gap="sm">
                    <IconActivity size={20} color="#666" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Push Notifications
                      </Text>
                      <Badge color={user.preferences.pushNotifications ? "green" : "red"} variant="light">
                        {user.preferences.pushNotifications ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </Group>

                  <Group gap="sm">
                    <IconSettings size={20} color="#666" />
                    <div>
                      <Text size="xs" c="dimmed">
                        Dark Mode
                      </Text>
                      <Badge color={user.preferences.darkMode ? "dark" : "gray"} variant="light">
                        {user.preferences.darkMode ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </Group>
                </SimpleGrid>
              </Paper>
            )}

            {/* System Information */}
            <Paper p="md" shadow="xs" withBorder>
              <Title order={3} mb="md">
                System Information
              </Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Group gap="sm">
                  <IconClock size={20} color="#666" />
                  <div>
                    <Text size="xs" c="dimmed">
                      Created At
                    </Text>
                    <Text size="sm" fw={500}>
                      {formatDateTime(user.createdAt)}
                    </Text>
                  </div>
                </Group>

                <Group gap="sm">
                  <IconClock size={20} color="#666" />
                  <div>
                    <Text size="xs" c="dimmed">
                      Last Updated
                    </Text>
                    <Text size="sm" fw={500}>
                      {formatDateTime(user.updatedAt)}
                    </Text>
                  </div>
                </Group>

                <Group gap="sm">
                  <IconUser size={20} color="#666" />
                  <div>
                    <Text size="xs" c="dimmed">
                      Profile Updated
                    </Text>
                    <Badge color={user.hasUpdatedProfile ? "green" : "orange"} variant="light">
                      {user.hasUpdatedProfile ? "Yes" : "No"}
                    </Badge>
                  </div>
                </Group>
              </SimpleGrid>
            </Paper>
          </Stack>
        </Grid.Col>
      </Grid>

      {/* User Modal Component */}
      <UserModal
        opened={opened}
        onClose={close}
        editMode={true}
        currentUser={user}
        onSuccess={handleModalSuccess}
      />
    </Container>
  );
}
