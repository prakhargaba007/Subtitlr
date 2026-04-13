"use client";

import React, { useState, useEffect } from "react";
import { Select, Button, Group, Loader, Box } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import axiosInstance from "@/utils/axios";
import UserModal from "@/components/UserModal";

export interface SelectableUser {
  _id: string;
  name?: string;
  email?: string;
  userName?: string;
  phoneNumber?: number;
}

interface UserSelectorProps {
  value: string;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  role?: string;
  description?: string;
}

export default function UserSelector({
  value,
  onChange,
  label = "Select User",
  placeholder = "Choose a user",
  required = false,
  error,
  role = "customer",
  description,
}: UserSelectorProps) {
  const [users, setUsers] = useState<SelectableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetchUsers = async (search?: string) => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        limit: 50,
        sort: "createdAt",
        order: "desc",
        ...(role && { role }),
        ...(search?.trim() && { search: search.trim() }),
      };
      const response = await axiosInstance.get("/api/user/all", { params });
      const userData = response.data?.data || response.data || [];
      setUsers(Array.isArray(userData) ? userData : []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [role]);

  const handleSearchChange = (search: string) => {
    setSearchValue(search);
    const timeoutId = setTimeout(() => fetchUsers(search), 300);
    return () => clearTimeout(timeoutId);
  };

  const handleCreateSuccess = () => {
    fetchUsers();
  };

  const userOptions = users.map((user) => ({
    value: user._id,
    label: [user.name, user.email, user.userName].filter(Boolean).join(" • ") || user._id,
  }));

  return (
    <>
      <Group align="flex-end" wrap="nowrap" gap="xs">
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Select
            label={label}
            placeholder={placeholder}
            data={userOptions}
            value={value}
            onChange={onChange}
            required={required}
            searchable
            searchValue={searchValue}
            onSearchChange={handleSearchChange}
            error={error}
            description={description}
            rightSection={loading ? <Loader size="xs" /> : undefined}
            nothingFoundMessage={
              searchValue ? "No users found" : "No users available"
            }
            clearable
          />
        </Box>
        <Button
          variant="outline"
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpen(true)}
          style={{ flexShrink: 0 }}
        >
          Create User
        </Button>
      </Group>

      <UserModal
        opened={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        editMode={false}
        currentUser={null}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}
