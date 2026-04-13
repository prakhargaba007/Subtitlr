"use client";

import { useState } from "react";
import {
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Switch,
  Button,
  Group,
  Box,
  Stack,
  Divider,
  FileInput,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { Upload } from "lucide-react";
import VideoSelector from "./VideoSelector";
import FileSelector from "./FileSelector";
import AuthorSelector from "./AuthorSelector";
import Image from "next/image";
import CategorySelector from "./CategorySelector";
import TagSelector from "./TagSelector";

interface LessonFormProps {
  initialValues?: any;
  onSubmit: (values: any) => void;
  isLoading?: boolean;
  isEdit?: boolean;
}

type OptionType = { value: string; label: string };

export default function LessonForm({
  initialValues = {},
  onSubmit,
  isLoading = false,
  isEdit = false,
}: LessonFormProps) {
  const [loading, setLoading] = useState(false);
  console.log("initialValues", initialValues);

  const form = useForm({
    initialValues: {
      title: "",
      description: "",
      content: "",
      category: "",
      author: "",
      difficulty: "beginner",
      points: 10,
      lessonType: "video",
      quiz: "",
      isPublished: false,
      isActive: true,
      isPreview: false,
      isFeatured: false,
      tags: [],
      lessonImage: null,
      imageUrl: null,
      video: null,
      file: "",
      ...initialValues,
    },
    validate: {
      title: (value) => (value ? null : "Title is required"),
      description: (value) => (value ? null : "Description is required"),
      content: (value) => (value ? null : "Content is required"),
      category: (value) => (value ? null : "Category is required"),
      author: (value) => (value ? null : "Author is required"),
    },
  });
  console.log("form.values.imageUrl", form.values.author);

  // Category and Tag data are handled by corresponding selectors

  const handleSubmit = (values: any) => {
    const formData = new FormData();
    // Ensure uploadType is available to multer before any file parts
    formData.append("uploadType", "lessons");

    Object.entries(values).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (key === "tags") {
          formData.append(key, JSON.stringify(value));
        } else if (key === "lessonImage" && value instanceof File) {
          formData.append(key, value);
        } else if (key === "video") {
          // Handle video field - extract ID if it's an object, otherwise use the value as is
          if (
            typeof value === "object" &&
            value !== null &&
            (value as any)._id
          ) {
            formData.append(key, (value as any)._id);
          } else if (typeof value === "string") {
            formData.append(key, value);
          }
        } else if (key !== "lessonImage" && key !== "duration") {
          formData.append(key, value.toString());
        }
      }
    });

    onSubmit(formData);
  };

  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <TextInput
          label="Title"
          placeholder="Enter lesson title"
          required
          {...form.getInputProps("title")}
          disabled={isLoading || loading}
        />

        <Textarea
          label="Description"
          placeholder="Enter lesson description"
          required
          minRows={3}
          {...form.getInputProps("description")}
          disabled={isLoading || loading}
        />

        <Textarea
          label="Content"
          placeholder="Enter lesson content (supports markdown)"
          required
          minRows={6}
          {...form.getInputProps("content")}
          disabled={isLoading || loading}
        />

        <CategorySelector
          label="Category"
          value={form.values.category || null}
          onChange={(value) => form.setFieldValue("category", value || "")}
          required
          error={form.errors.category as string}
          categoryType="lesson"
          showCreateButton
        />

        <AuthorSelector
          label="Author"
          placeholder="Select author"
          value={form.values.author}
          onChange={(value) => form.setFieldValue("author", value || "")}
          required
          error={form.errors.author as string}
          disabled={isLoading || loading}
        />

        <Group grow>
          <Select
            label="Lesson Type"
            placeholder="Select lesson type"
            data={[
              { value: "video", label: "Video" },
              { value: "text", label: "Text" },
              { value: "interactive", label: "Interactive" },
              { value: "mixed", label: "Mixed" },
            ]}
            {...form.getInputProps("lessonType")}
            disabled={isLoading || loading}
          />

          <Select
            label="Difficulty"
            placeholder="Select difficulty"
            data={[
              { value: "beginner", label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced", label: "Advanced" },
            ]}
            {...form.getInputProps("difficulty")}
            disabled={isLoading || loading}
          />
        </Group>

        <Group grow>
          <NumberInput
            label="Points"
            placeholder="Enter points value"
            min={0}
            {...form.getInputProps("points")}
            disabled={isLoading || loading}
          />
        </Group>

        <Box my="md">
          <Text size="sm" fw={500} ta="center" mb={5}>
            Video & Image
          </Text>
          <Divider />
        </Box>

        {/* Video Selector */}
        <VideoSelector
          label="Video"
          value={form.values.video}
          onChange={(value) => {
            // console.log("value", value);
            return form.setFieldValue("video", value);
          }}
          error={form.errors.video as string | undefined}
          required={
            form.values.lessonType === "video" ||
            form.values.lessonType === "mixed"
          }
        />

        <FileInput
          label="Thumbnail Image"
          description="If image is already uploaded then don't upload again"
          placeholder="Upload thumbnail image"
          accept="image/*"
          {...form.getInputProps("lessonImage")}
          disabled={isLoading || loading}
          leftSection={<Upload size={16} />}
        />

        {form.values.imageUrl && (
          <Image
            src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${form.values.imageUrl}`}
            alt="Thumbnail Image"
            width={100}
            height={100}
          />
        )}

        <FileSelector
          label="Additional File"
          placeholder="Select an additional file (optional)"
          value={form.values.file}
          onChange={(value) => form.setFieldValue("file", value)}
          description="Select a file that will be associated with this lesson"
        />
        {/* {isEdit && (initialValues.imageUrl || initialValues.lessonImage) && (
          <Box mt={5}>
            <Text size="xs" c="dimmed">
              Current image:{" "}
              {(initialValues.imageUrl || initialValues.lessonImage)
                ?.split("/")
                .pop()}
            </Text>
            <img
              src={
                initialValues.imageUrl
                  ? `${process.env.NEXT_PUBLIC_S3_BASE_URL}/${initialValues.imageUrl}`
                  : initialValues.lessonImage
              }
              alt="Current thumbnail"
              style={{
                maxWidth: "100px",
                maxHeight: "60px",
                marginTop: "5px",
                borderRadius: "4px",
              }}
            />
          </Box>
        )} */}

        <Box my="md">
          <Text size="sm" fw={500} ta="center" mb={5}>
            Additional Settings
          </Text>
          <Divider />
        </Box>

        {/* <Select
          label="Quiz"
          placeholder="Select quiz (optional)"
          data={quizzes}
          clearable
          searchable
          {...form.getInputProps("quiz")}
          disabled={isLoading || loading}
        /> */}

        <TagSelector
          value={(form.values.tags as string[]) || []}
          onChange={(value) => form.setFieldValue("tags", value)}
          label="Tags"
          placeholder="Select or create tags"
          showCreateButton={false}
        />

        <Group>
          <Switch
            label="Published"
            {...form.getInputProps("isPublished", { type: "checkbox" })}
            disabled={isLoading || loading}
          />

          <Switch
            label="Active"
            {...form.getInputProps("isActive", { type: "checkbox" })}
            disabled={isLoading || loading}
          />

          {/* <Switch
            label="Preview Available"
            {...form.getInputProps("isPreview", { type: "checkbox" })}
            disabled={isLoading || loading}
          /> */}

          <Switch
            label="Featured"
            {...form.getInputProps("isFeatured", { type: "checkbox" })}
            disabled={isLoading || loading}
          />
        </Group>

        <Group justify="flex-end" mt="xl">
          <Button type="submit" loading={isLoading}>
            {isEdit ? "Update Lesson" : "Create Lesson"}
          </Button>
        </Group>
      </Stack>
    </Box>
  );
}
