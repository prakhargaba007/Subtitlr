"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Container,
  Title,
  Text,
  Paper,
  Group,
  Badge,
  Divider,
  Flex,
  Box,
  Button,
  Loader,
  Grid,
  Avatar,
  Card,
  Image,
  ActionIcon,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconArrowLeft,
  IconEdit,
  IconEye,
  IconThumbUp,
  IconClock,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";

interface Tag {
  _id: string;
  name: string;
}

interface User {
  _id: string;
  name: string;
  userName: string;
  profilePicture?: string;
  role: string;
}

interface Category {
  _id: string;
  name: string;
  color: string;
}

interface YoutubeBinge {
  _id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  tags: Tag[];
  users: User[];
  categories: Category[];
  isFeatured: boolean;
  type: "Youtube" | "Shorts";
  duration: number;
  views: number;
  likes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function VideoDetails() {
  const router = useRouter();
  const params = useParams();
  const videoId = params.id as string;

  const [video, setVideo] = useState<YoutubeBinge | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [videoEmbedUrl, setVideoEmbedUrl] = useState<string>("");
  console.log("videoEmbedUrl", videoEmbedUrl);

  useEffect(() => {
    fetchVideoDetails();
  }, [videoId]);

  const fetchVideoDetails = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/api/youtube-binge/${videoId}`);
      setVideo(response.data);
      // console.log("response.data", response.data);

      // Extract YouTube video ID from URL
      //   const youtubeId = extractYoutubeId(response.data.videoUrl);
      //   if (youtubeId) {
      setVideoEmbedUrl(
        `https://www.youtube.com/embed/${response.data.videoUrl}`
      );
      //   }
    } catch (error) {
      console.error("Error fetching video details:", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch video details",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const extractYoutubeId = (url: string): string | null => {
    if (!url) return null;

    // Handle different YouTube URL formats
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);

    return match && match[2].length === 11 ? match[2] : null;
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleEditVideo = () => {
    router.push(`/dashboard/binge-content/all-youtube-videos?edit=${videoId}`);
  };

  const goBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Flex justify="center" align="center" h={400}>
          <Loader size="lg" />
        </Flex>
      </Container>
    );
  }

  if (!video) {
    return (
      <Container size="lg" py="xl">
        <Paper p="xl" withBorder>
          <Title order={3}>Video not found</Title>
          <Text mt="md">
            The requested video could not be found or has been deleted.
          </Text>
          <Button
            mt="lg"
            leftSection={<IconArrowLeft size={16} />}
            onClick={goBack}
          >
            Go Back
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Button
        mb="lg"
        variant="subtle"
        leftSection={<IconArrowLeft size={16} />}
        onClick={goBack}
      >
        Back to Videos
      </Button>

      <Paper shadow="xs" p="md" withBorder>
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Box
              style={{
                position: "relative",
                paddingBottom: "56.25%",
                height: 0,
                overflow: "hidden",
                borderRadius: "8px",
              }}
            >
              {videoEmbedUrl ? (
                <iframe
                  src={videoEmbedUrl}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    border: "none",
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={video.title}
                />
              ) : (
                <Flex justify="center" align="center" h={300} bg="gray.1">
                  <Text>Video URL is invalid or cannot be embedded</Text>
                </Flex>
              )}
            </Box>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder shadow="sm" p="md">
              <Title order={3} mb="xs">
                Video Stats
              </Title>
              <Divider mb="md" />

              <Group mb="xs">
                <IconEye size={18} />
                <Text>{video.views || 0} views</Text>
              </Group>

              {/* <Group mb="xs">
                <IconThumbUp size={18} />
                <Text>{video.likes || 0} likes</Text>
              </Group> */}

              <Group mb="xs">
                <IconClock size={18} />
                <Text>Duration: {formatDuration(video.duration)}</Text>
              </Group>

              <Divider my="md" />

              <Group>
                <Badge color={video.isActive ? "green" : "red"}>
                  {video.isActive ? "Active" : "Inactive"}
                </Badge>

                <Badge color={video.isFeatured ? "blue" : "gray"}>
                  {video.isFeatured ? "Featured" : "Not Featured"}
                </Badge>

                <Badge color={video.type === "Shorts" ? "pink" : "violet"}>
                  {video.type}
                </Badge>
              </Group>

              <Button
                fullWidth
                mt="md"
                leftSection={<IconEdit size={16} />}
                onClick={handleEditVideo}
              >
                Edit Video
              </Button>
            </Card>
          </Grid.Col>
        </Grid>

        <Box mt="lg">
          <Title order={2}>{video.title}</Title>
          <Text color="dimmed" size="sm" mt="xs">
            Added on {new Date(video.createdAt).toLocaleDateString()}
          </Text>

          <Divider my="md" />

          <Title order={4}>Description</Title>
          <Text mt="xs" style={{ whiteSpace: "pre-line" }}>
            {video.description || "No description provided."}
          </Text>

          <Divider my="md" />

          <Grid>
            {video.tags && video.tags.length > 0 && (
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Title order={4} mb="sm">
                  Tags
                </Title>
                <Group>
                  {video.tags.map((tag) => (
                    <Badge key={tag._id} color="blue" variant="light">
                      {tag.name}
                    </Badge>
                  ))}
                </Group>
              </Grid.Col>
            )}

            {video.categories && video.categories.length > 0 && (
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Title order={4} mb="sm">
                  Categories
                </Title>
                <Group>
                  {video.categories.map((category) => (
                    <Badge
                      key={category._id}
                      color={category.color || "gray"}
                      variant="light"
                    >
                      {category.name}
                    </Badge>
                  ))}
                </Group>
              </Grid.Col>
            )}

            {video.users && video.users.length > 0 && (
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Title order={4} mb="sm">
                  Associated Users
                </Title>
                {video.users.map((user) => (
                  <Group key={user._id} mb="xs">
                    <Avatar
                      src={
                        user.profilePicture ? `/${user.profilePicture}` : null
                      }
                      radius="xl"
                      size="md"
                    >
                      {user.name?.charAt(0) || user.userName?.charAt(0) || "U"}
                    </Avatar>
                    <Box>
                      <Text size="sm" fw={500}>
                        {user.name}
                      </Text>
                      <Text size="xs" color="dimmed">
                        {user.role}
                      </Text>
                    </Box>
                  </Group>
                ))}
              </Grid.Col>
            )}
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
}
