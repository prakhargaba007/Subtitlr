"use client";
import React, { useState, useEffect } from "react";
import {
  Modal,
  TextInput,
  Textarea,
  Button,
  Group,
  Select,
  FileInput,
  Image,
  SimpleGrid,
  Title,
  Text,
  MultiSelect,
  rem,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconPhoto,
  IconDeviceFloppy,
  IconBrandTwitter,
  IconBrandLinkedin,
  IconBrandGithub,
  IconWorld,
  IconBrandYoutube,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";

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
  createdAt: string;
  updatedAt: string;
}

interface UserModalProps {
  opened: boolean;
  onClose: () => void;
  editMode: boolean;
  currentUser: User | null;
  onSuccess: () => void;
}

// Available permissions based on navigation items
const availablePermissions = [
  { value: "dashboard", label: "Dashboard" },
  { value: "categories", label: "Categories" },
  { value: "tags", label: "Tags" },
  { value: "files", label: "File Management" },
  { value: "posts", label: "Posts" },

];

export default function UserModal({
  opened,
  onClose,
  editMode,
  currentUser,
  onSuccess,
}: UserModalProps) {
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    userName: "",
    phoneNumber: "",
    role: "client",
    bio: "",
    password: "",
    twitter: "",
    linkedin: "",
    github: "",
    website: "",
    youtube: "",
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

  // Reset form when modal opens/closes or user changes
  useEffect(() => {
    if (opened) {
      if (editMode && currentUser) {
        // Edit mode - populate with current user data
        setFormData({
          name: currentUser.name || "",
          email: currentUser.email || "",
          userName: currentUser.userName || "",
          phoneNumber: currentUser.phoneNumber?.toString() || "",
          role: currentUser.role || "client",
          bio: currentUser.bio || "",
          password: "", // Don't pre-fill password for security
          twitter: currentUser.socialLinks?.twitter || "",
          linkedin: currentUser.socialLinks?.linkedin || "",
          github: currentUser.socialLinks?.github || "",
          website: currentUser.socialLinks?.website || "",
          youtube: currentUser.socialLinks?.youtube || "",
        });
        setSelectedPermissions(currentUser.accessPermissions || []);
      } else {
        // Create mode - reset form
        setFormData({
          name: "",
          email: "",
          userName: "",
          phoneNumber: "",
          role: "client",
          bio: "",
          password: "",
          twitter: "",
          linkedin: "",
          github: "",
          website: "",
          youtube: "",
        });
        setSelectedPermissions([]);
      }
      setProfilePicture(null);
    }
  }, [opened, editMode, currentUser]);

  // Submit form for creating or updating a user
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("email", formData.email);
      formDataToSend.append("userName", formData.userName);
      formDataToSend.append("role", formData.role);
      formDataToSend.append("bio", formData.bio);

      formDataToSend.append("uploadType", "profiles");

      if (formData.phoneNumber) {
        formDataToSend.append("phoneNumber", formData.phoneNumber);
      }

      // Add password for new users or when updating password
      if (!editMode || (editMode && formData.password.trim() !== "")) {
        formDataToSend.append("password", formData.password);
      }

      // Add social links
      const socialLinks = {
        twitter: formData.twitter,
        linkedin: formData.linkedin,
        github: formData.github,
        website: formData.website,
        youtube: formData.youtube,
      };

      formDataToSend.append("socialLinks", JSON.stringify(socialLinks));

      // Add access permissions for sub-admin
      if (formData.role === "sub-admin") {
        formDataToSend.append(
          "accessPermissions",
          JSON.stringify(selectedPermissions)
        );
      }

      if (profilePicture) {
        formDataToSend.append("profilePicture", profilePicture);
      }

      if (editMode && currentUser) {
        // Update existing user
        await axiosInstance.put(
          `/api/user/update-profile/${currentUser._id}`,
          formDataToSend,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
        notifications.show({
          title: "Success",
          message: "User updated successfully",
          color: "green",
        });
      } else {
        // Create new user
        await axiosInstance.post("/api/user/create", formDataToSend, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        notifications.show({
          title: "Success",
          message: "User created successfully",
          color: "green",
        });
      }

      // Close modal and refresh data
      onClose();
      onSuccess();
    } catch (error: any) {
      notifications.show({
        title: "Error",
        message: error.response?.data?.message || "Failed to save user",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editMode ? "Edit Profile" : "Create New Profile"}
      size="lg"
      centered
    >
      <form onSubmit={handleSubmit}>
        <SimpleGrid cols={1} mb="md">
          <TextInput
            label="Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter full name"
            required
          />

        </SimpleGrid>

        <SimpleGrid cols={2} mb="md">
          <TextInput
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter email address"
            required
          />

          <TextInput
            label="Phone Number"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleChange}
            placeholder="Enter phone number"
          />
        </SimpleGrid>

        {/* Password field - required for new users, optional for editing */}
        <TextInput
          label={
            editMode
              ? "New Password (leave empty to keep current)"
              : "Password"
          }
          name="password"
          type={showPassword ? "text" : "password"}
          value={formData.password}
          onChange={handleChange}
          placeholder={
            editMode ? "Enter new password to change" : "Enter password"
          }
          required={!editMode}
          rightSection={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showPassword ? (
                <IconEyeOff size={16} />
              ) : (
                <IconEye size={16} />
              )}
            </button>
          }
          mb="md"
        />

        <Select
          label="Role"
          name="role"
          value={formData.role}
          onChange={(value) => {
            setFormData({ ...formData, role: value || "client" });
            // Clear permissions when role changes
            if (value !== "sub-admin") {
              setSelectedPermissions([]);
            }
          }}
          data={[
            { value: "client", label: "Client" },
            { value: "sub-admin", label: "Sub Admin" },
            { value: "engineer", label: "Engineer" },
          ]}
          mb="md"
        />

        {/* Show permissions selector only for sub-admin role */}
        {formData.role === "sub-admin" && (
          <>
            <Title order={4} mb="xs">
              Access Permissions
            </Title>
            <Text size="sm" c="dimmed" mb="xs">
              Select which sections this sub-admin can access:
            </Text>
            <MultiSelect
              label="Allowed Sections"
              placeholder="Select permissions"
              value={selectedPermissions}
              onChange={setSelectedPermissions}
              data={availablePermissions}
              searchable
              clearable
              mb="md"
            />
          </>
        )}

        <Textarea
          label="Bio"
          name="bio"
          value={formData.bio}
          onChange={handleChange}
          placeholder="Enter bio"
          minRows={3}
          mb="md"
        />

        <Title order={4} mb="xs">
          Social Links
        </Title>

        <SimpleGrid cols={2} mb="md">
          <TextInput
            label="Twitter"
            name="twitter"
            value={formData.twitter}
            onChange={handleChange}
            placeholder="Twitter profile URL"
            leftSection={<IconBrandTwitter size={16} />}
          />

          <TextInput
            label="LinkedIn"
            name="linkedin"
            value={formData.linkedin}
            onChange={handleChange}
            placeholder="LinkedIn profile URL"
            leftSection={<IconBrandLinkedin size={16} />}
          />
        </SimpleGrid>

        <SimpleGrid cols={2} mb="md">
          <TextInput
            label="GitHub"
            name="github"
            value={formData.github}
            onChange={handleChange}
            placeholder="GitHub profile URL"
            leftSection={<IconBrandGithub size={16} />}
          />

          <TextInput
            label="Website"
            name="website"
            value={formData.website}
            onChange={handleChange}
            placeholder="Personal website URL"
            leftSection={<IconWorld size={16} />}
          />
        </SimpleGrid>

        <TextInput
          label="YouTube"
          name="youtube"
          value={formData.youtube}
          onChange={handleChange}
          placeholder="YouTube channel URL"
          leftSection={<IconBrandYoutube size={16} />}
          mb="md"
        />

        <FileInput
          label="Profile Picture"
          placeholder="Upload profile picture"
          accept="image/png,image/jpeg,image/webp"
          value={profilePicture}
          onChange={setProfilePicture}
          leftSection={<IconPhoto size={rem(16)} />}
          clearable
          mb="md"
        />

        {editMode && currentUser && currentUser.profilePicture && (
          <div style={{ marginBottom: "1rem" }}>
            <Text size="sm" fw={500} mb="xs">
              Current Profile Picture:
            </Text>
            <Image
              src={`${process.env.NEXT_PUBLIC_S3_BASE_URL}/${currentUser.profilePicture}`}
              height={100}
              width={100}
              radius="xl"
              fit="cover"
              alt="Current profile picture"
              mb="md"
            />
          </div>
        )}

        <Group justify="flex-end" mt="xl">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={loading}
          >
            {editMode ? "Update" : "Create"}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
