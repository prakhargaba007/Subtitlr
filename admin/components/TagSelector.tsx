"use client";

import { useState, useEffect } from "react";
import { MultiSelect, Loader, Button, Group, Modal, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Plus } from "lucide-react";
import axiosInstance from "@/utils/axios";
import { notifications } from "@mantine/notifications";

interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  showCreateButton?: boolean;
}

export default function TagSelector({
  value,
  onChange,
  label = "Tags",
  placeholder = "Select or create tags",
  required = false,
  error,
  showCreateButton = false
}: TagSelectorProps) {
  const [tags, setTags] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [newTag, setNewTag] = useState({
    name: ""
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch tags
  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/api/tags");
      
      const tagsData = response.data.tags || response.data;
      if (Array.isArray(tagsData)) {
        setTags(
          tagsData.map((tag: any) => ({
            value: tag._id,
            label: tag.name,
          }))
        );
      } else {
        console.error("Tags response is not an array:", tagsData);
        setTags([]);
      }
    } catch (error) {
      console.error("Error fetching tags:", error);
      notifications.show({
        title: "Error",
        message: "Failed to load tags",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Create tag
  const handleCreateTag = async () => {
    if (!newTag.name) {
      notifications.show({
        title: "Error",
        message: "Tag name is required",
        color: "red",
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await axiosInstance.post("/api/tags", { name: newTag.name });
      
      notifications.show({
        title: "Success",
        message: "Tag created successfully",
        color: "green",
      });
      
      closeCreate();
      setNewTag({ name: "" });
      
      // Refresh tags and select the new one
      await fetchTags();
      
      if (response.data && response.data.tag && response.data.tag._id) {
        onChange([...value, response.data.tag._id]);
      }
    } catch (error) {
      console.error("Error creating tag:", error);
      notifications.show({
        title: "Error",
        message: "Failed to create tag",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle creating a tag directly from the MultiSelect
  const handleCreateOption = (query: string) => {
    setNewTag({ ...newTag, name: query });
    openCreate();
    return null;
  };

  useEffect(() => {
    fetchTags();
  }, []);

  return (
    <>
      <Group align="flex-end" grow={showCreateButton}>
        <MultiSelect
          label={label}
          placeholder={placeholder}
          data={tags}
          value={value}
          onChange={onChange}
          searchable
          clearable
          required={required}
          error={error}
          rightSection={loading ? <Loader size="xs" /> : null}
          rightSectionWidth={40}
          styles={{ rightSection: { pointerEvents: 'none' } } as any}
        />
        
        {showCreateButton && (
          <Button 
            leftSection={<Plus size={16} />}
            onClick={openCreate}
          >
            Create
          </Button>
        )}
      </Group>
      
      {/* Create Tag Modal */}
      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="Create New Tag"
        size="md"
        centered
      >
        <TextInput
          label="Name"
          placeholder="Enter tag name"
          required
          value={newTag.name}
          onChange={(e) => setNewTag({ ...newTag, name: e.currentTarget.value })}
          mb="md"
        />
        
        {/* Color selection removed */}
        
        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={closeCreate}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateTag}
            loading={submitting}
          >
            Create
          </Button>
        </Group>
      </Modal>
    </>
  );
} 