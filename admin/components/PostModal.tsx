"use client";

import React, { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Button,
  Group,
  Stack,
  Title,
  Text,
  FileInput,
  Image,
  SimpleGrid,
  rem,
  Select,
  MultiSelect,
  Loader,
  Badge,
  Divider,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPhoto,
  IconDeviceFloppy,
  IconVideo,
  IconX,
  IconUpload,
  IconEye,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";
import CategorySelector from "./CategorySelector";
import TagSelector from "./TagSelector";


interface PostModalProps {
  opened: boolean;
  onClose: () => void;
  editMode: boolean;
  currentPost?: any | null;
  onSuccess: () => void;
}

export default function PostModal({
  opened,
  onClose,
  editMode,
  currentPost,
  onSuccess,
}: PostModalProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Array<{value: string; label: string}>>([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    isPublished: true,
    postType: "image", // image or video
    imagePath: "",
  });

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Fetch available tags
  const fetchTags = async () => {
    try {
      const response = await axiosInstance.get("/api/tags");
      const tagsData = response.data.tags || response.data;
      if (Array.isArray(tagsData)) {
        setAvailableTags(
          tagsData.map((tag: any) => ({
            value: tag._id,
            label: tag.name,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching tags:", error);
    }
  };

  // Reset form when modal opens/closes or post changes
  useEffect(() => {
    if (opened) {
      fetchTags(); // Fetch tags when modal opens
      
      if (editMode && currentPost) {
        // Edit mode - populate with current post data
        setFormData({
          title: currentPost.title || "",
          description: currentPost.description || "",
          content: currentPost.content || "",
          isPublished: currentPost.isPublished ?? true,
          postType: currentPost.postType || "image",
          imagePath: currentPost.imagePath || "",
        });
        setSelectedCategory(currentPost.category?._id || null);
        setSelectedTags(currentPost.tags?.map((tag: any) => tag._id) || []);
        
        // Set image path if exists
        if (currentPost.imagePath) {
          setImagePreview(`${process.env.NEXT_PUBLIC_S3_BASE_URL}/public/${currentPost.imagePath}`);
        }
      } else {
        // Create mode - reset form
        setFormData({
          title: "",
          description: "",
          content: "",
          isPublished: true,
          postType: "image",
          imagePath: "",
        });
        setSelectedCategory(null);
        setSelectedTags([]);
        setSelectedImage(null);
        setImagePreview(null);
      }
    }
  }, [opened, editMode, currentPost]);

  // Submit form for creating or updating a post
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedImage && !formData.imagePath) {
      notifications.show({
        title: "Error",
        message: "Please select an image file",
        color: "red",
      });
      return;
    }

    if (!selectedCategory) {
      notifications.show({
        title: "Error",
        message: "Please select a category",
        color: "red",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Create FormData for file upload
      const postFormData = new FormData();
      postFormData.append('title', formData.title);
      postFormData.append('description', formData.description);
      postFormData.append('content', formData.content);
      postFormData.append('isPublished', formData.isPublished.toString());
      postFormData.append('postType', formData.postType);
      postFormData.append('category', selectedCategory);
      postFormData.append('tags', JSON.stringify(selectedTags));
      postFormData.append('uploadType', 'posts'); // Specify upload type for posts
      
      // Add image file if selected
      if (selectedImage) {
        postFormData.append('image', selectedImage);
      }

      if (editMode && currentPost) {
        // Update existing post
        await axiosInstance.put(`/api/posts/${currentPost._id}`, postFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        notifications.show({
          title: "Success",
          message: "Post updated successfully",
          color: "green",
        });
      } else {
        // Create new post
        await axiosInstance.post("/api/posts", postFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        notifications.show({
          title: "Success",
          message: "Post created successfully",
          color: "green",
        });
      }

      // Close modal and refresh data
      onClose();
      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.response?.data?.message || "Failed to save post",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle image file selection
  const handleImageSelect = (file: File | null) => {
    if (file) {
      setSelectedImage(file);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      
      // Auto-detect post type based on file MIME type
      if (file.type.startsWith("image/")) {
        setFormData({ ...formData, postType: "image" });
      } else if (file.type.startsWith("video/")) {
        setFormData({ ...formData, postType: "video" });
      }
    } else {
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  // Remove selected image
  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setFormData({ ...formData, imagePath: "" });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editMode ? "Edit Post" : "Create New Post"}
      size="xl"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          {/* Basic Information */}
          <Title order={4}>Basic Information</Title>
          
          <TextInput
            label="Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter post title"
            required
          />

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter post description"
            minRows={3}
          />

          <Textarea
            label="Content"
            name="content"
            value={formData.content}
            onChange={handleChange}
            placeholder="Enter post content (optional)"
            minRows={4}
          />

          <SimpleGrid cols={2}>
            <Select
              label="Post Type"
              value={formData.postType}
              onChange={(value) => setFormData({ ...formData, postType: value || "image" })}
              data={[
                { value: "image", label: "Image Post" },
                { value: "video", label: "Video Post" },
              ]}
              required
            />

            <Select
              label="Status"
              value={formData.isPublished ? "published" : "draft"}
              onChange={(value) => setFormData({ ...formData, isPublished: value === "published" })}
              data={[
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft" },
              ]}
              required
            />
          </SimpleGrid>

          <Divider />

          {/* Image Selection */}
          <Title order={4}>Media</Title>
          
          <FileInput
            label="Select Image"
            placeholder="Choose an image file"
            accept="image/*"
            value={selectedImage}
            onChange={handleImageSelect}
            required={!formData.imagePath}
            description="Select an image file for your post"
            leftSection={<IconPhoto size={16} />}
          />

          {/* Image Preview */}
          {imagePreview && (
            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>Image Preview</Text>
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  leftSection={<IconX size={14} />}
                  onClick={handleRemoveImage}
                >
                  Remove
                </Button>
              </Group>
              
              <div
                style={{
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "16px",
                  backgroundColor: "#f8f9fa",
                }}
              >
                <Image
                  src={imagePreview}
                  height={200}
                  width="100%"
                  radius="md"
                  fit="cover"
                  alt="Preview"
                />
                {selectedImage && (
                  <Text size="xs" c="dimmed" mt="xs">
                    File: {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                  </Text>
                )}
              </div>
            </div>
          )}

          <Divider />

          {/* Category and Tags */}
          <Title order={4}>Organization</Title>
          
          <CategorySelector
            label="Category"
            value={selectedCategory}
            onChange={setSelectedCategory}
            required
            showCreateButton={true}
          />

          <TagSelector
            label="Tags"
            value={selectedTags}
            onChange={setSelectedTags}
            placeholder="Select or create tags"
            showCreateButton={true}
          />

          {/* Selected Tags Display */}
          {selectedTags.length > 0 && (
            <div>
              <Text size="sm" fw={500} mb="xs">Selected Tags:</Text>
              <Group gap="xs">
                {selectedTags.map((tagId) => {
                  const tag = availableTags.find(t => t.value === tagId);
                  return (
                    <Badge key={tagId} variant="light" color="blue">
                      {tag ? tag.label : `Tag ${tagId}`}
                    </Badge>
                  );
                })}
              </Group>
            </div>
          )}

          {/* Action Buttons */}
          <Group justify="flex-end" mt="xl">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              leftSection={<IconDeviceFloppy size={16} />}
              loading={loading}
            >
              {editMode ? "Update Post" : "Create Post"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
