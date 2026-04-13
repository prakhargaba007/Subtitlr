"use client";

import { useState } from "react";
import {
  TextInput,
  Textarea,
  Button,
  Group,
  Box,
  Stack,
  Select,
  NumberInput,
  Switch,
  Paper,
  Text,
  ActionIcon,
  Divider
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { Plus, Trash } from "lucide-react";
import CategorySelector from "./CategorySelector";
import TagSelector from "./TagSelector";

interface QuizFormProps {
  initialValues?: any;
  onSubmit: (values: any) => void;
  isLoading?: boolean;
  isEdit?: boolean;
}

export default function QuizForm({
  initialValues = {},
  onSubmit,
  isLoading = false,
  isEdit = false,
}: QuizFormProps) {
  // Form setup
  const form = useForm({
    initialValues: {
      question: "",
      questionType: "multiple-choice",
      options: [
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
      ],
      explanation: "",
      xpValue: 30,
      type: "lesson",
      category: "",
      tags: [],
      isActive: true,
      ...initialValues,
    },
    validate: {
      question: (value) => (value ? null : "Question is required"),
      options: {
        text: (value) => (value ? null : "Option text is required"),
      },
    },
  });

  // Add option
  const handleAddOption = () => {
    form.insertListItem("options", { text: "", isCorrect: false });
  };

  // Remove option
  const handleRemoveOption = (index: number) => {
    // Ensure at least 2 options remain
    if (form.values.options.length <= 2) {
      notifications.show({
        title: "Error",
        message: "A quiz must have at least 2 options",
        color: "red",
      });
      return;
    }

    // If removing the correct option, set the first remaining option as correct
    const isRemovingCorrect = form.values.options[index].isCorrect;
    form.removeListItem("options", index);

    if (isRemovingCorrect && form.values.options.length > 0) {
      const updatedOptions = [...form.values.options];
      updatedOptions[0].isCorrect = true;
      form.setFieldValue("options", updatedOptions);
    }
  };

  // Set correct option
  const handleSetCorrect = (index: number) => {
    const updatedOptions = form.values.options.map((option: any, i: number) => ({
      ...option,
      isCorrect: i === index,
    }));
    form.setFieldValue("options", updatedOptions);
  };

  // Handle form submission
  const handleSubmit = (values: any) => {
    // Validate that one option is marked as correct
    const hasCorrectOption = values.options.some((option: any) => option.isCorrect);
    if (!hasCorrectOption) {
      notifications.show({
        title: "Error",
        message: "At least one option must be marked as correct",
        color: "red",
      });
      return;
    }

    // Create form data for submission
    const formData = new FormData();

    // Add text fields
    Object.keys(values).forEach((key) => {
      if (key !== "options" && key !== "tags" && values[key] !== null && values[key] !== undefined) {
        formData.append(key, values[key].toString());
      }
    });

    // Add options as JSON
    formData.append("options", JSON.stringify(values.options));

    // Add tags as JSON if present
    if (values.tags && values.tags.length > 0) {
      formData.append("tags", JSON.stringify(values.tags));
    }

    onSubmit(formData);
  };

  return (
    <Box component="form" onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <TextInput
          label="Question"
          placeholder="Enter quiz question"
          required
          {...form.getInputProps("question")}
          disabled={isLoading}
        />

        <Select
          label="Question Type"
          placeholder="Select question type"
          data={[{ value: "multiple-choice", label: "Multiple Choice" }]}
          {...form.getInputProps("questionType")}
          disabled={isLoading}
        />

        <Paper withBorder p="md" radius="md">
          <Text fw={500} mb="sm">Options</Text>
          <Stack gap="sm">
            {form.values.options.map((option: any, index: number) => (
              <Group key={index} wrap="nowrap" align="flex-start">
                <TextInput
                  placeholder={`Option ${index + 1}`}
                  style={{ flex: 1 }}
                  {...form.getInputProps(`options.${index}.text`)}
                  disabled={isLoading}
                />
                <Switch
                  label="Correct"
                  checked={option.isCorrect}
                  onChange={() => handleSetCorrect(index)}
                  disabled={isLoading || option.isCorrect}
                />
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={() => handleRemoveOption(index)}
                  disabled={isLoading || form.values.options.length <= 2}
                >
                  <Trash size={16} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              leftSection={<Plus size={16} />}
              variant="outline"
              onClick={handleAddOption}
              disabled={isLoading}
            >
              Add Option
            </Button>
          </Stack>
        </Paper>

        <Textarea
          label="Explanation"
          placeholder="Explain the correct answer (shown after submission)"
          minRows={3}
          {...form.getInputProps("explanation")}
          disabled={isLoading}
        />

        <NumberInput
          label="XP Value"
          placeholder="Points awarded for correct answer"
          min={1}
          {...form.getInputProps("xpValue")}
          disabled={isLoading}
        />

        <Divider label="Classification" labelPosition="center" />

        <Select
          label="Quiz Type"
          placeholder="Select quiz type"
          data={[
            { value: "lesson", label: "Lesson Quiz" },
            { value: "games", label: "Game Quiz" },
          ]}
          {...form.getInputProps("type")}
          disabled={isLoading}
        />

        <CategorySelector
          label="Category"
          value={form.values.category}
          onChange={(value) => form.setFieldValue("category", value)}
          error={form.errors.category as string | undefined}
          categoryType="quiz"
          showCreateButton
        />

        <TagSelector
          label="Tags"
          value={form.values.tags}
          onChange={(value) => form.setFieldValue("tags", value)}
          error={form.errors.tags as string | undefined}
          showCreateButton
        />

        <Switch
          label="Active"
          {...form.getInputProps("isActive", { type: "checkbox" })}
          disabled={isLoading}
        />

        <Group justify="flex-end" mt="xl">
          <Button type="submit" loading={isLoading}>
            {isEdit ? "Update Quiz" : "Create Quiz"}
          </Button>
        </Group>
      </Stack>
    </Box>
  );
} 