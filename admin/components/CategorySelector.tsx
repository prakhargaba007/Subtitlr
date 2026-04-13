"use client";

import { useState, useEffect } from "react";
import { Select, Loader, Text, Button, Group, Modal, TextInput, Textarea, ColorInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Plus } from "lucide-react";
import axiosInstance from "@/utils/axios";
import { notifications } from "@mantine/notifications";

interface CategorySelectorProps {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  label?: string;
  required?: boolean;
  error?: string;
  categoryType?: string;
  showCreateButton?: boolean;
  style?: React.CSSProperties;
}

export default function CategorySelector({
  value,
  onChange,
  label = "Category",
  required = false,
  error,
  categoryType = "photo&video",
  showCreateButton = false,
  style  
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3498db",
    type: categoryType
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      setLoading(true);
      console.log(`Fetching categories of type: ${categoryType}`);
      
      // Try specific endpoint first
      try {
        const response = await axiosInstance.get(`/api/categories/type/${categoryType}`);
        console.log("Categories response:", response.data);
        
        const categoriesData = response.data.categories || response.data;
        if (Array.isArray(categoriesData)) {
          setCategories(
            categoriesData.map((category: any) => ({
              value: category._id,
              label: category.name,
            }))
          );
        } else {
          throw new Error("Response is not an array");
        }
      } catch (specificError) {
        console.error("Error fetching specific categories:", specificError);
        
        // Fallback to all categories
        const fallbackResponse = await axiosInstance.get("/api/categories");
        console.log("Fallback categories response:", fallbackResponse.data);
        
        const fallbackCategoriesData = fallbackResponse.data.categories || fallbackResponse.data;
        if (Array.isArray(fallbackCategoriesData)) {
          const filteredCategories = fallbackCategoriesData
            .filter((cat: any) => !categoryType || cat.type === categoryType || !cat.type)
            .map((category: any) => ({
              value: category._id,
              label: category.name,
            }));
          setCategories(filteredCategories);
        } else {
          setCategories([]);
          throw new Error("Fallback response is not an array");
        }
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      notifications.show({
        title: "Error",
        message: "Failed to load categories",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  // Create category
  const handleCreateCategory = async () => {
    if (!formData.name) {
      notifications.show({
        title: "Error",
        message: "Category name is required",
        color: "red",
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await axiosInstance.post("/api/categories", {
        ...formData,
        type: categoryType
      });
      
      notifications.show({
        title: "Success",
        message: "Category created successfully",
        color: "green",
      });
      
      closeCreate();
      fetchCategories();
      
      // Select the newly created category
      if (response.data && response.data.category && response.data.category._id) {
        onChange(response.data.category._id);
      }
    } catch (error) {
      console.error("Error creating category:", error);
      notifications.show({
        title: "Error",
        message: "Failed to create category",
        color: "red",
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [categoryType]);

  return (
    <>
      <Group align="flex-end" grow={showCreateButton} style={style}>
        <Select
          label={label}
          placeholder="Select category"
          data={categories}
          value={value}
          onChange={onChange}
          searchable
          clearable
          required={required}
          error={categories.length === 0 ? "No categories available" : error}
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
      
      {/* Create Category Modal */}
      <Modal
        opened={createOpened}
        onClose={closeCreate}
        title="Create New Category"
        size="md"
        centered
      >
        <TextInput
          label="Name"
          placeholder="Enter category name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
          mb="md"
        />
        
        <Textarea
          label="Description"
          placeholder="Enter category description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
          mb="md"
          autosize
          minRows={3}
        />
        
        <ColorInput
          label="Color"
          placeholder="Select color"
          value={formData.color}
          onChange={(color) => setFormData({ ...formData, color })}
          mb="md"
        />
        
        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={closeCreate}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateCategory}
            loading={submitting}
          >
            Create
          </Button>
        </Group>
      </Modal>
    </>
  );
} 