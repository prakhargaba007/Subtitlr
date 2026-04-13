"use client";

import React, { useState, useEffect } from "react";
import {
  Button,
  Group,
  Text,
  Title,
  Card,
  Grid,
  Badge,
  ActionIcon,
  Stack,
  Loader,
  TextInput,
  Select,
  Pagination,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconEye,
  IconHeart,
  IconMessage,
  IconSearch,
  IconFilter,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import axiosInstance from "@/utils/axios";
import PostModal from "@/components/PostModal";
import Image from "next/image";

interface Post {
  _id: string;
  title: string;
  description: string;
  content: string;
  postType: "image" | "video";
  isPublished: boolean;
  views: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  publishedAt: string;
  imagePath: string;
  category: {
    _id: string;
    name: string;
    color: string;
  };
  tags: Array<{
    _id: string;
    name: string;
  }>;
  author: {
    _id: string;
    name: string;
    userName: string;
    profilePicture?: string;
  };
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editMode, setEditMode] = useState(false);

  // Fetch posts
  const fetchPosts = async (page = 1, search = "", type = "", status = "") => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
      });

      if (search) params.append("search", search);
      if (type) params.append("postType", type);
      if (status) params.append("isPublished", status);

      const response = await axiosInstance.get(`/api/posts?${params}`);
      setPosts(response.data.posts || []);
      setTotalPages(response.data.pagination?.totalPages || 1);
      setCurrentPage(response.data.pagination?.currentPage || 1);
    } catch (error) {
      console.error("Error fetching posts:", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch posts",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(currentPage, searchQuery, filterType || "", filterStatus || "");
  }, [currentPage, searchQuery, filterType, filterStatus]);

  // Handle create new post
  const handleCreatePost = () => {
    setSelectedPost(null);
    setEditMode(false);
    openModal();
  };

  // Handle edit post
  const handleEditPost = (post: Post) => {
    setSelectedPost(post);
    setEditMode(true);
    openModal();
  };

  // Handle delete post
  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      await axiosInstance.delete(`/api/posts/${postId}`);
      notifications.show({
        title: "Success",
        message: "Post deleted successfully",
        color: "green",
      });
      fetchPosts(currentPage, searchQuery, filterType || "", filterStatus || "");
    } catch (error) {
      notifications.show({
        title: "Error",
        message: "Failed to delete post",
        color: "red",
      });
    }
  };

  // Handle modal success
  const handleModalSuccess = () => {
    fetchPosts(currentPage, searchQuery, filterType || "", filterStatus || "");
  };

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
    fetchPosts(1, searchQuery, filterType || "", filterStatus || "");
  };

  // Handle reset filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterType(null);
    setFilterStatus(null);
    setCurrentPage(1);
    fetchPosts(1, "", "", "");
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={1}>Posts Management</Title>
            <Text c="dimmed">Create and manage your posts</Text>
          </div>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreatePost}
            size="md"
          >
            Create New Post
          </Button>
        </Group>

        {/* Search and Filters */}
        <Card withBorder p="md" mb="md">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <TextInput
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={<IconSearch size={16} />}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Select
                placeholder="Filter by type"
                value={filterType}
                onChange={setFilterType}
                data={[
                  { value: "image", label: "Image Posts" },
                  { value: "video", label: "Video Posts" },
                ]}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Select
                placeholder="Filter by status"
                value={filterStatus}
                onChange={setFilterStatus}
                data={[
                  { value: "true", label: "Published" },
                  { value: "false", label: "Draft" },
                ]}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 2 }}>
              <Group>
                <Button onClick={handleSearch} size="sm">
                  Search
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResetFilters}
                  size="sm"
                >
                  Reset
                </Button>
              </Group>
            </Grid.Col>
          </Grid>
        </Card>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader size="lg" />
        </div>
      ) : posts.length === 0 ? (
        <Card withBorder p="xl" className="text-center">
          <Text size="lg" c="dimmed" mb="md">
            No posts found
          </Text>
          <Text c="dimmed" mb="md">
            {searchQuery || filterType || filterStatus
              ? "Try adjusting your search criteria"
              : "Create your first post to get started"}
          </Text>
          <Button onClick={handleCreatePost} leftSection={<IconPlus size={16} />}>
            Create First Post
          </Button>
        </Card>
      ) : (
        <>
          <Grid>
            {posts.map((post) => {
              console.log("NEXT_PUBLIC_S3_BASE_URL", process.env.NEXT_PUBLIC_S3_BASE_URL+ post.imagePath);
              return (
                <Grid.Col key={post._id} span={{ base: 12, sm: 6, md: 4 }}>
                  <Card withBorder shadow="sm" radius="md" className="h-full">
                    <Card.Section>
                      {post.postType === "image" ? (
                        <div
                          className="flex items-center justify-center bg-black/10"
                          style={{ height: 200, overflow: "hidden", position: "relative" }}
                        >
                          <Image
                            src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${post.imagePath}`}
                            alt={post.title}
                            // fill
                            height={200}
                            width={800}
                            style={{
                              objectFit: "contain",
                              width: "100%",
                              height: "100%",
                              position: "absolute",
                            }}
                            sizes="(max-width: 600px) 100vw, 33vw"
                            priority={false}
                          />
                        </div>
                      ) : (
                        <div
                          className="flex items-center justify-center bg-gray-100"
                          style={{ height: 200 }}
                        >
                          <IconEye size={48} color="#666" />
                        </div>
                      )}
                    </Card.Section>

                    <Stack p="md" className="grow">
                      <div>
                        <Group justify="space-between" mb="xs">
                          <Badge
                            color={post.category.color || "blue"}
                            variant="light"
                            size="sm"
                          >
                            {post.category.name}
                          </Badge>
                          <Badge
                            color={post.isPublished ? "green" : "orange"}
                            variant="light"
                            size="sm"
                          >
                            {post.isPublished ? "Published" : "Draft"}
                          </Badge>
                        </Group>

                        <Title order={4} lineClamp={2} mb="xs">
                          {post.title}
                        </Title>

                        <Text size="sm" c="dimmed" lineClamp={2} mb="md">
                          {post.description}
                        </Text>

                        {post.tags.length > 0 && (
                          <Group gap="xs" mb="md">
                            {post.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag._id} variant="outline" size="xs">
                                {tag.name}
                              </Badge>
                            ))}
                            {post.tags.length > 3 && (
                              <Badge variant="outline" size="xs">
                                +{post.tags.length - 3}
                              </Badge>
                            )}
                          </Group>
                        )}

                        <Group justify="space-between" c="dimmed" mb="md">
                          <Group gap="lg">
                            <Group gap="xs">
                              <IconEye size={14} />
                              <Text size="xs">{post.views}</Text>
                            </Group>
                            <Group gap="xs">
                              <IconHeart size={14} />
                              <Text size="xs">{post.likeCount}</Text>
                            </Group>
                          </Group>
                          <Text size="xs">
                            {new Date(post.createdAt).toLocaleDateString()}
                          </Text>
                        </Group>
                      </div>

                      <Group justify="space-between" mt="auto">
                        <Text size="xs" c="dimmed">
                          by {post.author.name}
                        </Text>
                        <Group gap="xs">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => handleEditPost(post)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeletePost(post._id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Stack>
                  </Card>
                </Grid.Col>
              )
            })}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {/* Post Modal */}
      <PostModal
        opened={modalOpened}
        onClose={closeModal}
        editMode={editMode}
        currentPost={selectedPost}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
